from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from engine.campaign_model import CampaignState, MissionRecord
from engine.generator_context import GenerationContext, GenerationPlan
from engine.result_model import MissionResult
from modules.ammo import AmmoModule
from modules.base import PersistenceModule
from modules.damage import DamageModule


MODULE_REGISTRY: dict[str, type[PersistenceModule]] = {
    "damage": DamageModule,
    "ammo": AmmoModule,
}


@dataclass
class RuntimeConfig:
    enabled_modules: list[str]
    module_config: dict[str, dict[str, Any]]


class CampaignRuntime:
    def __init__(self, config: RuntimeConfig) -> None:
        self.config = config
        self.modules: dict[str, PersistenceModule] = {}
        for module_name in config.enabled_modules:
            module_cls = MODULE_REGISTRY[module_name]
            self.modules[module_name] = module_cls()

    def initialize(self, state: CampaignState) -> CampaignState:
        state.enabled_modules = list(self.modules.keys())
        for name, module in self.modules.items():
            module.initialize_state(state, self.config.module_config.get(name, {}))
        return state

    def ingest_result(self, state: CampaignState, result: MissionResult) -> CampaignState:
        for name, module in self.modules.items():
            module.ingest_result(state, result, self.config.module_config.get(name, {}))
        state.mission_history.append(
            MissionRecord(
                mission_id=result.mission_id,
                outcome=result.outcome,
                time_elapsed_hours=result.time_elapsed_hours,
                event_count=len(result.events),
                notes=dict(result.metadata),
            )
        )
        return state

    def advance_time(self, state: CampaignState, hours: float) -> CampaignState:
        for name, module in self.modules.items():
            module.advance_time(state, hours, self.config.module_config.get(name, {}))
        return state

    def build_generation_plan(
        self, state: CampaignState, context: GenerationContext
    ) -> GenerationPlan:
        plan = GenerationPlan(
            mission_id=context.requested_next_mission_id or state.current_mission_id
        )
        for name, module in self.modules.items():
            for directive in module.prepare_generation(
                state, context, self.config.module_config.get(name, {})
            ):
                plan.add(directive)
        return plan
