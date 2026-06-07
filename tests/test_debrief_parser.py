from __future__ import annotations

import json
import unittest
from pathlib import Path

from parsers.mnw_debrief_parser import parse_debrief_text


REPO_ROOT = Path(__file__).resolve().parent.parent


class DebriefParserTests(unittest.TestCase):
    def test_parser_extracts_elapsed_events_and_unit_ids(self) -> None:
        raw_text = (REPO_ROOT / "parsers" / "sample_debrief_bear_gap.txt").read_text(encoding="utf-8")
        runtime_payload = json.loads((REPO_ROOT / "ui" / "data" / "sample-runtime.json").read_text(encoding="utf-8"))

        payload = parse_debrief_text(raw_text, runtime_payload)

        self.assertEqual(payload["mission_id"], "norwegian_shadow.norwegian_shadow.bear_gap")
        self.assertEqual(payload["outcome"], "success")
        self.assertAlmostEqual(payload["time_elapsed_hours"], 5.0)
        self.assertEqual(payload["metadata"]["parsed_status_count"], 3)

        events = payload["events"]
        self.assertEqual(len(events), 2)

        damaged_event = next(event for event in events if event["event_type"] == "unit_damaged")
        destroyed_event = next(event for event in events if event["event_type"] == "unit_destroyed")

        self.assertEqual(damaged_event["unit_id"], "uss_north_dakota")
        self.assertAlmostEqual(damaged_event["amount"], 0.5)
        self.assertEqual(destroyed_event["unit_id"], "yasen_severodvinsk")
        self.assertEqual(destroyed_event["amount"], 1)

    def test_parser_without_runtime_still_returns_platform_metadata(self) -> None:
        raw_text = (REPO_ROOT / "parsers" / "sample_debrief_bear_gap.txt").read_text(encoding="utf-8")

        payload = parse_debrief_text(raw_text)

        self.assertEqual(payload["metadata"]["parsed_platforms"][0]["resolved_unit_id"], None)
        self.assertEqual(payload["events"][0]["metadata"]["resolved_unit_id"], None)


if __name__ == "__main__":
    unittest.main()
