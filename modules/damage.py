from __future__ import annotations

from engine.campaign_model import CampaignState
from engine.generator_context import GenerationContext, GenerationDirective
from engine.result_model import MissionResult
from modules.base import ModuleDescriptor


class DamageModule:
    descriptor = ModuleDescriptor(
        name="damage",
        description="Tracks unit damage, destruction, and simple passive repair over time.",
        config={"repair_rate_per_day": 0.08},
    )

    def initialize_state(self, state: CampaignState, config: dict) -> None:
        module_state = state.ensure_module_state(self.descriptor.name)
        module_state.setdefault("repair_rate_per_day", config.get("repair_rate_per_day", 0.08))

    def ingest_result(self, state: CampaignState, result: MissionResult, config: dict) -> None:
        for event in result.events:
            if not event.unit_id or event.unit_id not in state.order_of_battle:
                continue
            unit = state.order_of_battle[event.unit_id]
            if event.event_type == "unit_damaged":
                amount = float(event.amount or 0.0)
                unit.damage = max(0.0, min(1.0, unit.damage + amount))
                unit.readiness = max(0.0, 1.0 - unit.damage)
            elif event.event_type == "unit_destroyed":
                unit.destroyed = True
                unit.damage = 1.0
                unit.readiness = 0.0

    def advance_time(self, state: CampaignState, hours: float, config: dict) -> None:
        repair_rate_per_day = float(config.get("repair_rate_per_day", 0.08))
        repair_delta = repair_rate_per_day * (hours / 24.0)
        for unit in state.order_of_battle.values():
            if unit.destroyed or unit.damage <= 0.0:
                continue
            unit.damage = max(0.0, unit.damage - repair_delta)
            unit.readiness = max(0.0, 1.0 - unit.damage)

    def prepare_generation(
        self, state: CampaignState, context: GenerationContext, config: dict
    ) -> list[GenerationDirective]:
        directives: list[GenerationDirective] = []
        for unit in state.order_of_battle.values():
            if unit.destroyed:
                directives.append(
                    GenerationDirective(
                        source_module=self.descriptor.name,
                        directive_type="exclude_unit",
                        payload={"unit_id": unit.unit_id, "reason": "destroyed"},
                    )
                )
            elif unit.damage > 0.0:
                directives.append(
                    GenerationDirective(
                        source_module=self.descriptor.name,
                        directive_type="adjust_unit_damage",
                        payload={
                            "unit_id": unit.unit_id,
                            "damage": unit.damage,
                            "readiness": unit.readiness,
                        },
                    )
                )
        return directives
