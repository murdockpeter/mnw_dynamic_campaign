from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


MISSION_NAME_MAP = {
    "Bear Gap": "norwegian_shadow.norwegian_shadow.bear_gap",
    "Broken Datum": "norwegian_shadow.norwegian_shadow.broken_datum",
}


def normalize_platform_name(value: str) -> str:
    normalized = value.lower().strip()
    normalized = re.sub(r"[\(\),]", " ", normalized)
    normalized = re.sub(r"\bssn\b", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def map_outcome(raw_text: str) -> str:
    upper = raw_text.upper()
    if "SUCCESS" in upper:
        return "success"
    if "FAILED" in upper:
        return "failure"
    return "unknown"


def extract_mission_name(raw_text: str) -> str | None:
    match = re.search(r"Mission Name:\s*(.+)", raw_text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


def extract_platform_statuses(raw_text: str) -> list[dict]:
    pattern = re.compile(
        r"(?:Ownship:|Vessel:)\s*(.+?)\s*-\s*Country:\s*(.+?)\s*[\r\n]+\s*-\s*Status:\s*(.+)",
        re.IGNORECASE,
    )
    statuses: list[dict] = []
    for match in pattern.finditer(raw_text):
        platform_name = match.group(1).strip()
        country = match.group(2).strip()
        status = match.group(3).strip()
        statuses.append(
            {
                "platform_name": platform_name,
                "country": country,
                "status": status,
            }
        )
    return statuses


def statuses_to_events(statuses: list[dict]) -> list[dict]:
    events: list[dict] = []
    for item in statuses:
        status_upper = item["status"].upper()
        platform_name = item["platform_name"]
        normalized_name = normalize_platform_name(platform_name)
        metadata = {
            "platform_name": platform_name,
            "normalized_platform_name": normalized_name,
            "country": item["country"],
            "source": "debrief_text_parser",
        }
        if "DESTROY" in status_upper:
            events.append(
                {
                    "event_type": "unit_destroyed",
                    "unit_id": None,
                    "amount": 1,
                    "weapon_key": None,
                    "metadata": metadata,
                }
            )
        elif "NON-OP" in status_upper or "NON OP" in status_upper:
            events.append(
                {
                    "event_type": "unit_damaged",
                    "unit_id": None,
                    "amount": 1.0,
                    "weapon_key": None,
                    "metadata": {**metadata, "interpreted_status": item["status"]},
                }
            )
    return events


def parse_debrief_text(raw_text: str) -> dict:
    mission_name = extract_mission_name(raw_text)
    mission_id = MISSION_NAME_MAP.get(mission_name or "", mission_name or "")
    statuses = extract_platform_statuses(raw_text)
    events = statuses_to_events(statuses)

    return {
        "mission_id": mission_id,
        "outcome": map_outcome(raw_text),
        "time_elapsed_hours": 0.0,
        "events": events,
        "metadata": {
            "source": "mnw_debrief_text_parser",
            "mission_name": mission_name,
            "parsed_status_count": len(statuses),
            "parsed_platforms": [
                {
                    "platform_name": item["platform_name"],
                    "normalized_platform_name": normalize_platform_name(item["platform_name"]),
                    "country": item["country"],
                    "status": item["status"],
                }
                for item in statuses
            ],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse pasted MNW debrief text into a draft normalized result JSON.")
    parser.add_argument("--input", required=True, help="Path to a text file containing pasted MNW debrief text.")
    parser.add_argument("--output", help="Optional output JSON path.")
    args = parser.parse_args()

    input_path = Path(args.input)
    raw_text = input_path.read_text(encoding="utf-8")
    payload = parse_debrief_text(raw_text)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    else:
        print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
