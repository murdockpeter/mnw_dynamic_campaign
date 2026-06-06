from __future__ import annotations

from engine.campaign_model import CampaignState
from engine.generator_context import GenerationContext, GenerationDirective
from engine.result_model import MissionResult
from modules.base import ModuleDescriptor


class AmmoModule:
    descriptor = ModuleDescriptor(
        name="ammo",
        description="Tracks ammunition expenditure and carries remaining stocks into generation directives.",
        config={"allow_negative": False},
    )

    def initialize_state(self, state: CampaignState, config: dict) -> None:
        state.ensure_module_state(self.descriptor.name)

    def ingest_result(self, state: CampaignState, result: MissionResult, config: dict) -> None:
        allow_negative = bool(config.get("allow_negative", False))
        for event in result.events:
            if event.event_type != "weapon_expended" or not event.unit_id or not event.weapon_key:
                continue
            unit = state.order_of_battle.get(event.unit_id)
            if unit is None:
                continue
            amount = int(event.amount or 0)
            current = int(unit.ammo.get(event.weapon_key, 0))
            next_value = current - amount
            unit.ammo[event.weapon_key] = next_value if allow_negative else max(0, next_value)

    def advance_time(self, state: CampaignState, hours: float, config: dict) -> None:
        # No passive ammo replenishment in the base module.
        return None

    def prepare_generation(
        self, state: CampaignState, context: GenerationContext, config: dict
    ) -> list[GenerationDirective]:
        directives: list[GenerationDirective] = []
        for unit in state.order_of_battle.values():
            if unit.ammo:
                directives.append(
                    GenerationDirective(
                        source_module=self.descriptor.name,
                        directive_type="override_unit_ammo",
                        payload={"unit_id": unit.unit_id, "ammo": dict(unit.ammo)},
                    )
                )
        return directives
