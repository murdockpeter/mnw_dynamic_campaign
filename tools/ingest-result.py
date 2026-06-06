from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from engine.result_model import MissionResult
from engine.runtime import CampaignRuntime, RuntimeConfig
from storage.json_store import JsonCampaignStore


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Ingest a normalized mission result, update campaign state, and persist it."
    )
    parser.add_argument("--campaign-id", default="silent_meridian")
    parser.add_argument("--result", required=True, help="Path to normalized mission-result JSON.")
    parser.add_argument("--state-dir", default=str(REPO_ROOT / "state"))
    parser.add_argument("--advance-hours", type=float, default=24.0)
    args = parser.parse_args()

    campaign_dir = REPO_ROOT / "campaigns" / args.campaign_id
    modules_config = read_json(campaign_dir / "modules.json")

    store = JsonCampaignStore(args.state_dir)
    state = store.load_state(args.campaign_id)
    result = MissionResult.from_dict(read_json(Path(args.result)))

    runtime = CampaignRuntime(
        RuntimeConfig(
            enabled_modules=modules_config["enabled_modules"],
            module_config=modules_config["module_config"],
        )
    )
    runtime.initialize(state)
    runtime.ingest_result(state, result)
    runtime.advance_time(state, args.advance_hours)

    # Carry campaign forward to the mission we just processed. A later mission-graph
    # layer can make this more sophisticated.
    state.current_mission_id = result.mission_id

    state_path = store.save_state(state)
    results_path = store.append_result(args.campaign_id, result)

    output = {
        "campaign_id": args.campaign_id,
        "state_path": str(state_path),
        "results_path": str(results_path),
        "mission_id": result.mission_id,
        "outcome": result.outcome,
        "advance_hours": args.advance_hours,
    }
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
