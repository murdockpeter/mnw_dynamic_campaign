#!/usr/bin/env python3
import argparse
import json
import os
import pathlib
import re
import sys
import zipfile

import msgpack


DEFAULT_DB_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\DB"
CATEGORY_FILES = {
    "submarines": "submarines.msg",
    "ships": "ships.msg",
    "aircrafts": "aircrafts.msg",
}


def find_core_archive(db_dir: str) -> str:
    candidates = [
        os.path.join(db_dir, name)
        for name in os.listdir(db_dir)
        if name.endswith(".core")
    ]
    if not candidates:
        raise FileNotFoundError(f"No .core archive found in {db_dir}")
    candidates.sort(key=os.path.getmtime, reverse=True)
    return candidates[0]


def unpack_catalog(archive_path: str, category: str):
    entry_name = CATEGORY_FILES[category]
    with zipfile.ZipFile(archive_path) as zf:
        catalog = msgpack.unpackb(zf.read(entry_name), raw=False, strict_map_key=False)
        names = msgpack.unpackb(zf.read("element_names.msg"), raw=False, strict_map_key=False)
    return catalog, names


def build_records(catalog, names):
    records = []
    for platform_id, platform_row in catalog.items():
        if not isinstance(platform_row, list) or len(platform_row) < 20:
            continue
        platform_name = platform_row[1]
        intro_year = next(
            (value for value in platform_row if isinstance(value, int) and 1900 <= value <= 2100),
            None,
        )
        list_fields = [value for value in platform_row if isinstance(value, list) and value]
        art_tags = next(
            (value for value in list_fields if isinstance(value[0], str) and "/" in value[0] and not value[0].startswith("submarines/")),
            [],
        )
        image_files = next(
            (value for value in list_fields if isinstance(value[0], str) and value[0].startswith("submarines/")),
            [],
        )
        hulls = []
        for hull_id, hull_row in names.items():
            if not isinstance(hull_row, list) or len(hull_row) < 5:
                continue
            if hull_row[4] != platform_id:
                continue
            hulls.append({
                "hullId": hull_id,
                "name": hull_row[1],
                "hullNumber": hull_row[2],
                "boardNumber": hull_row[3],
                "artTags": hull_row[12] if len(hull_row) > 12 else [],
            })
        records.append({
            "platformId": platform_id,
            "platformName": platform_name,
            "introYear": intro_year,
            "description": platform_row[3] if len(platform_row) > 3 else "",
            "artTags": art_tags,
            "imageFiles": image_files,
            "hulls": sorted(hulls, key=lambda hull: hull["hullId"]),
        })
    return sorted(records, key=lambda record: record["platformId"])


def filter_records(records, pattern: str):
    regex = re.compile(pattern, re.IGNORECASE)
    filtered = []
    for record in records:
        haystacks = [record["platformName"]]
        haystacks.extend(hull["name"] for hull in record["hulls"])
        if any(regex.search(value or "") for value in haystacks):
            filtered.append(record)
    return filtered


def render_markdown(archive_path: str, category: str, pattern: str, records):
    lines = [
        "# Local DB Platform Notes",
        "",
        "This file is generated from the local installed MNW database archive on this machine.",
        "",
        f"- Archive: `{os.path.basename(archive_path)}`",
        f"- Category: `{category}`",
        f"- Filter: `{pattern}`",
        "",
    ]
    for record in records:
        lines.append(f"## {record['platformName']} (`platformId={record['platformId']}`)")
        lines.append("")
        lines.append(f"- Intro year: `{record['introYear']}`")
        if record["artTags"]:
            lines.append(f"- Art tags: `{', '.join(record['artTags'])}`")
        lines.append("- Hulls:")
        for hull in record["hulls"]:
            lines.append(
                f"  - `{hull['name']}` `{hull['hullNumber']}` (`hullId={hull['hullId']}`)"
            )
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser(description="Inspect local MNW platform DB records.")
    parser.add_argument("--db-dir", default=DEFAULT_DB_DIR)
    parser.add_argument("--category", choices=sorted(CATEGORY_FILES.keys()), default="submarines")
    parser.add_argument("--pattern", default="Virginia")
    parser.add_argument("--write-json")
    parser.add_argument("--write-markdown")
    args = parser.parse_args()

    archive_path = find_core_archive(args.db_dir)
    catalog, names = unpack_catalog(archive_path, args.category)
    records = filter_records(build_records(catalog, names), args.pattern)
    payload = {
        "archive": os.path.basename(archive_path),
        "category": args.category,
        "pattern": args.pattern,
        "records": records,
    }

    if args.write_json:
        pathlib.Path(args.write_json).parent.mkdir(parents=True, exist_ok=True)
        with open(args.write_json, "w", encoding="utf8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
    if args.write_markdown:
        pathlib.Path(args.write_markdown).parent.mkdir(parents=True, exist_ok=True)
        with open(args.write_markdown, "w", encoding="utf8") as handle:
            handle.write(render_markdown(archive_path, args.category, args.pattern, records))

    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
