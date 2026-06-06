from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from engine.campaign_model import CampaignMetadata, CampaignState, UnitState
from engine.generator_context import GenerationContext
from engine.result_model import MissionEvent, MissionResult
from engine.runtime import CampaignRuntime, RuntimeConfig
from storage.json_store import JsonCampaignStore


class PersistenceSmokeTest(unittest.TestCase):
    def test_end_to_end_persistence_loop(self) -> None:
        state = CampaignState(
            metadata=CampaignMetadata(
                campaign_id="silent_meridian",
                title="Silent Meridian",
                theater="South China Sea",
            ),
            current_mission_id="norwegian_shadow.norwegian_shadow.bear_gap",
            campaign_clock="2028-03-14T02:30:00Z",
        )
        state.upsert_unit(
            UnitState(
                unit_id="uss_north_dakota",
                name="USS North Dakota",
                faction="US",
                platform_type="submarine",
                dbid=1015,
                ammo={"mk48_mod7": 12, "decoy_mk3": 8},
            )
        )

        runtime = CampaignRuntime(
            RuntimeConfig(
                enabled_modules=["damage", "ammo"],
                module_config={
                    "damage": {"repair_rate_per_day": 0.12},
                    "ammo": {"allow_negative": False},
                },
            )
        )
        runtime.initialize(state)

        result = MissionResult(
            mission_id="norwegian_shadow.norwegian_shadow.bear_gap",
            outcome="success",
            time_elapsed_hours=5.0,
            events=[
                MissionEvent(
                    event_type="weapon_expended",
                    unit_id="uss_north_dakota",
                    weapon_key="mk48_mod7",
                    amount=3,
                ),
                MissionEvent(
                    event_type="unit_damaged",
                    unit_id="uss_north_dakota",
                    amount=0.20,
                ),
            ],
        )
        runtime.ingest_result(state, result)
        runtime.advance_time(state, 24.0)

        with tempfile.TemporaryDirectory() as tmpdir:
            store = JsonCampaignStore(tmpdir)
            store.save_state(state)
            store.append_result(state.metadata.campaign_id, result)
            loaded = store.load_state(state.metadata.campaign_id)

            self.assertEqual(loaded.order_of_battle["uss_north_dakota"].ammo["mk48_mod7"], 9)
            self.assertLess(loaded.order_of_battle["uss_north_dakota"].damage, 0.20)
            self.assertEqual(len(loaded.mission_history), 1)

            plan = runtime.build_generation_plan(
                loaded,
                GenerationContext(
                    campaign_id=loaded.metadata.campaign_id,
                    current_mission_id=loaded.current_mission_id,
                    requested_next_mission_id="norwegian_shadow.norwegian_shadow.broken_datum",
                ),
            )

            directive_types = {item.directive_type for item in plan.directives}
            self.assertIn("override_unit_ammo", directive_types)
            self.assertIn("adjust_unit_damage", directive_types)


if __name__ == "__main__":
    unittest.main()
