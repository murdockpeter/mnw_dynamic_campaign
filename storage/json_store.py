from __future__ import annotations

import json
from pathlib import Path

from engine.campaign_model import CampaignState
from engine.result_model import MissionResult


class JsonCampaignStore:
    def __init__(self, base_dir: str | Path) -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def state_path(self, campaign_id: str) -> Path:
        return self.base_dir / campaign_id / "campaign_state.json"

    def result_history_path(self, campaign_id: str) -> Path:
        return self.base_dir / campaign_id / "mission_results.json"

    def save_state(self, state: CampaignState) -> Path:
        path = self.state_path(state.metadata.campaign_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state.to_dict(), indent=2), encoding="utf-8")
        return path

    def load_state(self, campaign_id: str) -> CampaignState:
        path = self.state_path(campaign_id)
        payload = json.loads(path.read_text(encoding="utf-8"))
        return CampaignState.from_dict(payload)

    def append_result(self, campaign_id: str, result: MissionResult) -> Path:
        path = self.result_history_path(campaign_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            payload = json.loads(path.read_text(encoding="utf-8"))
        else:
            payload = []
        payload.append(result.to_dict())
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path
