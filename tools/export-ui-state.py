from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from engine.campaign_model import CampaignState
from engine.generator_context import GenerationContext
from engine.result_model import MissionResult
from engine.runtime import CampaignRuntime, RuntimeConfig
from storage.json_store import JsonCampaignStore


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def infer_next_mission_id(state: CampaignState) -> str | None:
    current = state.current_mission_id or ""
    if current.endswith("bear_gap"):
        return "norwegian_shadow.norwegian_shadow.broken_datum"
    if current:
        return current
    return None


def load_or_bootstrap_state(store: JsonCampaignStore, campaign_dir: Path, campaign_id: str) -> CampaignState:
    state_path = store.state_path(campaign_id)
    if state_path.exists():
        return store.load_state(campaign_id)

    bootstrap_path = campaign_dir / "bootstrap_state.json"
    state = CampaignState.from_dict(read_json(bootstrap_path))
    store.save_state(state)
    return state


def load_latest_result(store: JsonCampaignStore, campaign_dir: Path, campaign_id: str) -> MissionResult:
    result_path = store.result_history_path(campaign_id)
    if result_path.exists():
        payload = json.loads(result_path.read_text(encoding="utf-8"))
        if payload:
            return MissionResult.from_dict(payload[-1])

    bootstrap_result = campaign_dir / "bootstrap_result.json"
    return MissionResult.from_dict(read_json(bootstrap_result))


def main() -> int:
    parser = argparse.ArgumentParser(description="Export live persistence state into a UI-friendly JSON snapshot.")
    parser.add_argument("--campaign-id", default="silent_meridian")
    parser.add_argument(
        "--output",
        default=str(REPO_ROOT / "generated" / "ui" / "runtime.json"),
    )
    parser.add_argument(
        "--state-dir",
        default=str(REPO_ROOT / "state"),
    )
    args = parser.parse_args()

    campaign_dir = REPO_ROOT / "campaigns" / args.campaign_id
    campaign_config = read_json(campaign_dir / "campaign.json")
    module_config = read_json(campaign_dir / "modules.json")

    store = JsonCampaignStore(args.state_dir)
    state = load_or_bootstrap_state(store, campaign_dir, args.campaign_id)

    runtime = CampaignRuntime(
        RuntimeConfig(
            enabled_modules=module_config["enabled_modules"],
            module_config=module_config["module_config"],
        )
    )
    runtime.initialize(state)

    result = load_latest_result(store, campaign_dir, args.campaign_id)

    context = GenerationContext(
        campaign_id=args.campaign_id,
        current_mission_id=state.current_mission_id,
        requested_next_mission_id=infer_next_mission_id(state),
    )
    plan = runtime.build_generation_plan(state, context)

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "campaign": campaign_config,
        "modules": module_config,
        "state": state.to_dict(),
        "result": result.to_dict(),
        "plan": {
            "mission_id": plan.mission_id,
            "directives": [asdict(item) for item in plan.directives],
        },
    }

    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
