from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class CampaignMetadata:
    campaign_id: str
    title: str
    theater: str
    description: str = ""
    active_persistence_system: str = "default"


@dataclass
class UnitState:
    unit_id: str
    name: str
    faction: str
    platform_type: str
    dbid: int | None = None
    readiness: float = 1.0
    damage: float = 0.0
    destroyed: bool = False
    ammo: dict[str, int] = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    notes: dict[str, Any] = field(default_factory=dict)


@dataclass
class MissionRecord:
    mission_id: str
    outcome: str
    time_elapsed_hours: float = 0.0
    event_count: int = 0
    notes: dict[str, Any] = field(default_factory=dict)


@dataclass
class CampaignState:
    metadata: CampaignMetadata
    current_mission_id: str | None = None
    campaign_clock: str = ""
    order_of_battle: dict[str, UnitState] = field(default_factory=dict)
    mission_history: list[MissionRecord] = field(default_factory=list)
    world_state: dict[str, Any] = field(default_factory=dict)
    module_state: dict[str, dict[str, Any]] = field(default_factory=dict)
    enabled_modules: list[str] = field(default_factory=list)

    def ensure_module_state(self, module_name: str) -> dict[str, Any]:
        return self.module_state.setdefault(module_name, {})

    def upsert_unit(self, unit: UnitState) -> None:
        self.order_of_battle[unit.unit_id] = unit

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "CampaignState":
        metadata = CampaignMetadata(**payload["metadata"])
        order_of_battle = {
            key: UnitState(**value)
            for key, value in payload.get("order_of_battle", {}).items()
        }
        mission_history = [
            MissionRecord(**item) for item in payload.get("mission_history", [])
        ]
        return cls(
            metadata=metadata,
            current_mission_id=payload.get("current_mission_id"),
            campaign_clock=payload.get("campaign_clock", ""),
            order_of_battle=order_of_battle,
            mission_history=mission_history,
            world_state=payload.get("world_state", {}),
            module_state=payload.get("module_state", {}),
            enabled_modules=payload.get("enabled_modules", []),
        )
