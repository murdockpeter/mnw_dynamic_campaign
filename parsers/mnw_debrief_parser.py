from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


MISSION_NAME_MAP = {
    "Bear Gap": "norwegian_shadow.norwegian_shadow.bear_gap",
    "Broken Datum": "norwegian_shadow.norwegian_shadow.broken_datum",
}


def normalize_platform_name(value: str) -> str:
    normalized = value.lower().strip()
    normalized = re.sub(r"[\(\),:/-]", " ", normalized)
    normalized = re.sub(r"\b(ssn|uss|hms|rfs|sns|ship|vessel|ownship)\b", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def tokenize_platform_name(value: str) -> set[str]:
    return {
        token
        for token in normalize_platform_name(value).split()
        if token and not token.isdigit()
    }


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
        r"(-\s*)?(Ownship:|Vessel:)\s*(.+?)\s*-\s*Country:\s*(.+?)\s*[\r\n]+\s*-\s*Status:\s*(.+)",
        re.IGNORECASE,
    )
    statuses: list[dict] = []
    for match in pattern.finditer(raw_text):
        label = match.group(2).strip().lower().rstrip(":")
        platform_name = match.group(3).strip()
        country = match.group(4).strip()
        status = match.group(5).strip()
        statuses.append(
            {
                "entry_type": label,
                "platform_name": platform_name,
                "country": country,
                "status": status,
            }
        )
    return statuses


def extract_elapsed_hours(raw_text: str) -> float:
    hour_patterns = [
        re.compile(r"Elapsed(?:\s+Hours)?\s*:\s*([0-9]+(?:\.[0-9]+)?)", re.IGNORECASE),
        re.compile(r"Mission Duration\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*hours?", re.IGNORECASE),
        re.compile(r"Time Elapsed\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*hours?", re.IGNORECASE),
    ]
    for pattern in hour_patterns:
        match = pattern.search(raw_text)
        if match:
            return float(match.group(1))

    clock_patterns = [
        re.compile(r"Elapsed(?:\s+Time)?\s*:\s*(\d{1,2}):(\d{2})(?::(\d{2}))?", re.IGNORECASE),
        re.compile(r"Mission Duration\s*:\s*(\d{1,2}):(\d{2})(?::(\d{2}))?", re.IGNORECASE),
    ]
    for pattern in clock_patterns:
        match = pattern.search(raw_text)
        if match:
            hours = int(match.group(1))
            minutes = int(match.group(2))
            seconds = int(match.group(3) or 0)
            return hours + (minutes / 60.0) + (seconds / 3600.0)

    return 0.0


def build_unit_candidates(runtime_payload: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not runtime_payload:
        return []

    state = runtime_payload.get("state", runtime_payload)
    order_of_battle = state.get("order_of_battle", {})
    candidates: list[dict[str, Any]] = []
    for unit_id, unit in order_of_battle.items():
        aliases = unit.get("notes", {}).get("aliases", [])
        names = [unit.get("name", ""), unit_id, *aliases]
        candidates.append(
            {
                "unit_id": unit_id,
                "faction": unit.get("faction"),
                "tags": unit.get("tags", []),
                "names": names,
                "tokens": set().union(*(tokenize_platform_name(name) for name in names if name)),
            }
        )
    return candidates


def resolve_unit_id(status_item: dict[str, Any], runtime_payload: dict[str, Any] | None) -> str | None:
    candidates = build_unit_candidates(runtime_payload)
    if not candidates:
        return None

    if status_item.get("entry_type") == "ownship":
        player_units = [item for item in candidates if "player" in item["tags"]]
        if len(player_units) == 1:
            return player_units[0]["unit_id"]

    target_tokens = tokenize_platform_name(status_item["platform_name"])
    if not target_tokens:
        return None

    best_unit_id: str | None = None
    best_score = 0.0
    for candidate in candidates:
        overlap = len(target_tokens & candidate["tokens"])
        if not overlap:
            continue

        union_size = max(len(target_tokens | candidate["tokens"]), 1)
        score = overlap / union_size

        if candidate["faction"] and candidate["faction"].upper() == status_item["country"].upper():
            score += 0.25

        if score > best_score:
            best_score = score
            best_unit_id = candidate["unit_id"]

    if best_score >= 0.34:
        return best_unit_id
    return None


def classify_status(status: str) -> tuple[str | None, float | int | None]:
    status_upper = status.upper()
    if "DESTROY" in status_upper or "SUNK" in status_upper or "KILLED" in status_upper:
        return "unit_destroyed", 1
    if "NON-OP" in status_upper or "NON OP" in status_upper:
        return "unit_damaged", 1.0
    if "HEAVY DAMAGE" in status_upper:
        return "unit_damaged", 0.75
    if "MODERATE DAMAGE" in status_upper:
        return "unit_damaged", 0.5
    if "LIGHT DAMAGE" in status_upper:
        return "unit_damaged", 0.25
    return None, None


def statuses_to_events(statuses: list[dict], runtime_payload: dict[str, Any] | None = None) -> list[dict]:
    events: list[dict] = []
    for item in statuses:
        platform_name = item["platform_name"]
        normalized_name = normalize_platform_name(platform_name)
        unit_id = resolve_unit_id(item, runtime_payload)
        event_type, amount = classify_status(item["status"])
        metadata = {
            "entry_type": item["entry_type"],
            "platform_name": platform_name,
            "normalized_platform_name": normalized_name,
            "country": item["country"],
            "source": "debrief_text_parser",
            "resolved_unit_id": unit_id,
        }
        if event_type == "unit_destroyed":
            events.append(
                {
                    "event_type": event_type,
                    "unit_id": unit_id,
                    "amount": amount,
                    "weapon_key": None,
                    "metadata": metadata,
                }
            )
        elif event_type == "unit_damaged":
            events.append(
                {
                    "event_type": event_type,
                    "unit_id": unit_id,
                    "amount": amount,
                    "weapon_key": None,
                    "metadata": {**metadata, "interpreted_status": item["status"]},
                }
            )
    return events


def parse_debrief_text(raw_text: str, runtime_payload: dict[str, Any] | None = None) -> dict:
    mission_name = extract_mission_name(raw_text)
    mission_id = MISSION_NAME_MAP.get(mission_name or "", mission_name or "")
    statuses = extract_platform_statuses(raw_text)
    events = statuses_to_events(statuses, runtime_payload)
    elapsed_hours = extract_elapsed_hours(raw_text)

    return {
        "mission_id": mission_id,
        "outcome": map_outcome(raw_text),
        "time_elapsed_hours": elapsed_hours,
        "events": events,
        "metadata": {
            "source": "mnw_debrief_text_parser",
            "mission_name": mission_name,
            "parsed_status_count": len(statuses),
            "parsed_platforms": [
                {
                    "entry_type": item["entry_type"],
                    "platform_name": item["platform_name"],
                    "normalized_platform_name": normalize_platform_name(item["platform_name"]),
                    "country": item["country"],
                    "status": item["status"],
                    "resolved_unit_id": resolve_unit_id(item, runtime_payload),
                }
                for item in statuses
            ],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse pasted MNW debrief text into a draft normalized result JSON.")
    parser.add_argument("--input", required=True, help="Path to a text file containing pasted MNW debrief text.")
    parser.add_argument("--output", help="Optional output JSON path.")
    parser.add_argument(
        "--runtime-json",
        help="Optional runtime or state JSON used to resolve parsed platform names to persistent unit IDs.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    raw_text = input_path.read_text(encoding="utf-8")
    runtime_payload = None
    if args.runtime_json:
        runtime_payload = json.loads(Path(args.runtime_json).read_text(encoding="utf-8"))
    payload = parse_debrief_text(raw_text, runtime_payload)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    else:
        print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
