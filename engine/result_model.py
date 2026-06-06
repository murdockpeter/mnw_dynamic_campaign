from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class MissionEvent:
    event_type: str
    unit_id: str | None = None
    amount: float | int | None = None
    weapon_key: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class MissionResult:
    mission_id: str
    outcome: str
    time_elapsed_hours: float = 0.0
    events: list[MissionEvent] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "MissionResult":
        return cls(
            mission_id=payload["mission_id"],
            outcome=payload["outcome"],
            time_elapsed_hours=payload.get("time_elapsed_hours", 0.0),
            events=[MissionEvent(**item) for item in payload.get("events", [])],
            metadata=payload.get("metadata", {}),
        )
