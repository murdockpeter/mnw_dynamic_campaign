from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class GenerationContext:
    campaign_id: str
    current_mission_id: str | None
    requested_next_mission_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class GenerationDirective:
    source_module: str
    directive_type: str
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class GenerationPlan:
    mission_id: str | None
    directives: list[GenerationDirective] = field(default_factory=list)

    def add(self, directive: GenerationDirective) -> None:
        self.directives.append(directive)
