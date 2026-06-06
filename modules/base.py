from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from engine.campaign_model import CampaignState
from engine.generator_context import GenerationContext, GenerationDirective
from engine.result_model import MissionResult


@dataclass
class ModuleDescriptor:
    name: str
    description: str
    config: dict[str, Any] = field(default_factory=dict)


class PersistenceModule(Protocol):
    descriptor: ModuleDescriptor

    def initialize_state(self, state: CampaignState, config: dict[str, Any]) -> None: ...

    def ingest_result(
        self, state: CampaignState, result: MissionResult, config: dict[str, Any]
    ) -> None: ...

    def advance_time(
        self, state: CampaignState, hours: float, config: dict[str, Any]
    ) -> None: ...

    def prepare_generation(
        self, state: CampaignState, context: GenerationContext, config: dict[str, Any]
    ) -> list[GenerationDirective]: ...
