const DEFAULT_SCENARIO_COUNT = 3;
const MIN_TARGET_DISTANCE_KM = 20;
const MAX_TARGET_DISTANCE_KM = 500;

const ESCALATION_CATALOG = {
  peacetime: {
    label: "Peacetime Patrol",
    level: 0,
    cue: "National command authority wants presence, classification, and restraint while the battlespace stays below open conflict."
  },
  heightened_tension: {
    label: "High Alert",
    level: 1,
    cue: "The theater is under military pressure. Command wants rapid warning, clean classification, and readiness to strike if ordered."
  },
  crisis: {
    label: "Crisis Response",
    level: 2,
    cue: "The situation is unstable and may break into combat on short notice. Seize initiative without losing the boat."
  },
  open_warfare: {
    label: "Open Warfare",
    level: 3,
    cue: "Hostilities are underway. Destroy hostile combat power, survive the counterattack, and keep pressure on the theater objective."
  }
};

const CAMPAIGN_CLIMATE_CATALOG = {
  surveillance: {
    label: "Peacetime Patrol",
    description: "Start with presence, classification, and shadowing before the theater heats up.",
    defaultEscalation: "peacetime",
    defaultRoe: "weapons_tight",
    sequence: ["initial_scout", "crosscurrent", "barrier_tide", "closing_arc"]
  },
  breakout_hunt: {
    label: "High Alert Interdiction",
    description: "Start under pressure and build toward a deliberate strike against a breakout or convoy route.",
    defaultEscalation: "heightened_tension",
    defaultRoe: "military_targets_of_opportunity",
    sequence: ["first_vector", "datum_shift", "containment_run", "closing_window"]
  },
  sea_denial: {
    label: "Open Warfare Sea Denial",
    description: "Start in combat conditions with authority to attack hostile forces and shape the sea lanes by force.",
    defaultEscalation: "open_warfare",
    defaultRoe: "hostile_flagged_free_fire",
    sequence: ["screen_probe", "route_bend", "kill_box", "terminal_shadow"]
  }
};

const MISSION_STANCE_CATALOG = {
  aggressive_intercept: {
    label: "Aggressive Intercept",
    cue: "Get forward on the route, compress the intercept geometry, and accept more exposure to force a firing solution sooner."
  },
  quiet_shadow: {
    label: "Quiet Shadow",
    cue: "Stay offset, preserve stealth, and keep contact from the edge of certainty instead of forcing a close prosecution."
  },
  wide_area_search: {
    label: "Broad Area Search",
    cue: "Trade immediacy for wider search coverage so you can rebuild the picture when the first cue is wrong."
  },
  barrier_support: {
    label: "Barrier Support",
    cue: "Use support geometry, hold the likely seam, and turn the problem into a prepared interception instead of a chase."
  }
};

const ROE_CATALOG = {
  weapons_tight: {
    label: "Weapons Tight",
    cue: "Self-defense only unless command issues a specific strike order against a designated hostile unit.",
    attackAuthority: "Self-defense only.",
    briefingLine: "Hold fire except in self-defense."
  },
  designated_targets_only: {
    label: "Designated Targets Only",
    cue: "You may attack only the specifically designated hostile target once classification is solid.",
    attackAuthority: "Attack only the designated target after positive identification.",
    briefingLine: "Attack authority applies only to the designated hostile unit."
  },
  military_targets_of_opportunity: {
    label: "Military Targets Of Opportunity",
    cue: "You may engage hostile military contacts of opportunity, but avoid wasting weapons on neutral or civilian traffic.",
    attackAuthority: "Hostile military targets of opportunity may be engaged.",
    briefingLine: "Hostile military targets of opportunity may be engaged."
  },
  hostile_flagged_free_fire: {
    label: "Free Fire On Hostile-Flagged Units",
    cue: "Any hostile-flagged enemy unit may be attacked once detected. Civilian and neutral traffic remain protected.",
    attackAuthority: "Engage any hostile-flagged enemy unit.",
    briefingLine: "Engage any hostile-flagged enemy unit."
  }
};

const MISSION_TYPE_CATALOG = {
  asw: {
    label: "ASW",
    description: "Hunt hostile submarines, rebuild contact, contain the breakout, and strike the designated sub or screen when ordered.",
    operationType: "ASW",
    availability: "stable",
    supportByFamily: {
      sub_hunt: "supported",
      surface_shadow: "unsupported"
    }
  },
  asuw_military: {
    label: "ASuW Military Only",
    description: "Track and attack hostile military units while minimizing interaction with civilian traffic.",
    operationType: "ASuW",
    availability: "stable",
    supportByFamily: {
      surface_shadow: "supported",
      sub_hunt: "partial"
    }
  },
  asuw_convoy: {
    label: "ASuW Escorted Convoy",
    description: "Shadow escorted traffic, identify the decisive ship, and strike through or around the screen.",
    operationType: "ASuW",
    availability: "stable",
    supportByFamily: {
      surface_shadow: "supported",
      sub_hunt: "partial"
    }
  },
  submerged_escort: {
    label: "Submerged Escort",
    description: "Screen a friendly surface group from below, build warning, and break up threats before they reach the force.",
    operationType: "ASuW",
    availability: "stable",
    supportByFamily: {
      surface_shadow: "partial",
      sub_hunt: "partial"
    }
  },
  civilian_defense: {
    label: "Civilian Defense",
    description: "Protect civilian or neutral shipping while identifying and suppressing hostile threats around the route.",
    operationType: "ASuW",
    availability: "stable",
    supportByFamily: {
      surface_shadow: "partial",
      sub_hunt: "unsupported"
    }
  },
  blockade_relief: {
    label: "Blockade Relief",
    description: "Keep a sea lane open long enough for relief traffic to pass under escort and submarine cover.",
    operationType: "ASuW",
    availability: "stable",
    supportByFamily: {
      surface_shadow: "partial",
      sub_hunt: "unsupported"
    }
  },
  spec_ops: {
    label: "Spec Ops",
    description: "Experimental mission family. Biases the briefing toward insertion, reconnaissance, or covert shoreline support without changing the core combat geometry yet.",
    operationType: "Special Operations",
    availability: "experimental",
    supportByFamily: {
      surface_shadow: "partial",
      sub_hunt: "unsupported"
    }
  },
  counter_piracy: {
    label: "Counter-Piracy",
    description: "Experimental mission family. Biases the mission toward vessel protection, interception, and selective surface engagement.",
    operationType: "Maritime Security",
    availability: "experimental",
    supportByFamily: {
      surface_shadow: "partial",
      sub_hunt: "unsupported"
    }
  },
  counter_terror: {
    label: "Counter-Terror",
    description: "Experimental mission family. Biases the mission toward interdiction of designated hostile cells, facilitators, or disguised logistics traffic.",
    operationType: "Maritime Security",
    availability: "experimental",
    supportByFamily: {
      surface_shadow: "partial",
      sub_hunt: "unsupported"
    }
  },
  land_attack: {
    label: "Land Attack",
    description: "Experimental placeholder. The current mission generation and MNW scripting path do not yet place or prosecute land targets.",
    operationType: "Land Attack",
    availability: "experimental",
    supportByFamily: {
      surface_shadow: "future",
      sub_hunt: "future"
    }
  }
};

const EXPERIMENTAL_PLOT_SEED_CATALOG = {
  none: {
    label: "None",
    description: "No experimental plot overlay. Use the stable mission arc only."
  },
  grey_zone_smuggling_crackdown: {
    label: "Grey-Zone Smuggling Crackdown",
    description: "Frames the operation around deniable maritime logistics, suspect auxiliaries, and escalation pressure below declared war.",
    summaryPrefix: "Signals traffic points to a grey-zone logistics network operating under naval cover.",
    cuePrefix: "Expect disguised traffic, politically sensitive identification, and pressure to build a prosecutable contact picture before any attack.",
    commandIntent: "Command wants actionable attribution before the logistics chain can shift or disperse."
  },
  hostage_recovery_window: {
    label: "Hostage Recovery Window",
    description: "Frames the operation around a short-duration recovery opportunity tied to a convoy, ferry, or covert transfer point.",
    summaryPrefix: "A short hostage-recovery opportunity has opened inside the wider naval picture.",
    cuePrefix: "Timing matters more than attrition. Build contact cleanly and be ready to isolate the decisive vessel fast.",
    commandIntent: "Command wants the recovery window preserved until the designated intervention point is confirmed."
  },
  blockade_relief_corridor: {
    label: "Blockade Relief Corridor",
    description: "Frames the operation around keeping a relief corridor open long enough for escorted traffic to pass.",
    summaryPrefix: "Relief shipping needs a temporary corridor through contested water.",
    cuePrefix: "Expect pressure from screening forces and hostile pickets trying to close the lane before the convoy clears.",
    commandIntent: "Command wants enough sea room created for relief traffic to move without exposing the boat unnecessarily."
  },
  littoral_special_recon: {
    label: "Littoral Special Recon",
    description: "Frames the operation around covert reconnaissance, submerged delivery, and discreet exfiltration support near the shoreline.",
    summaryPrefix: "A covert littoral reconnaissance task is tied into the wider submarine patrol.",
    cuePrefix: "Avoid theatrical escalation. The mission should feel like intelligence support until command explicitly shifts to attack.",
    commandIntent: "Command wants clean reconnaissance support and a survivable exfiltration path if the shoreline picture turns hostile."
  }
};

const TONE_CATALOG = CAMPAIGN_CLIMATE_CATALOG;
const AUTHORING_POSTURES = MISSION_STANCE_CATALOG;

const TASK_CATALOG = {
  classify_trail: {
    label: "Classify And Trail",
    objectiveLine: "Classify the likely main contact and trail without forcing a premature attack.",
    mapIntent: "Use the marked probable contact area and support cueing to build a clean track.",
    endCondition: "Recover with the contact picture intact and enough reporting to drive the next operation."
  },
  reacquire_contact: {
    label: "Re-Acquire Contact",
    objectiveLine: "Rebuild the contact picture inside the marked search area and restore a usable trail.",
    mapIntent: "Work the search area first, then pivot to the likely egress line only if the picture firms up.",
    endCondition: "Recover after restoring a usable trail or after exhausting the marked search geometry."
  },
  hold_barrier: {
    label: "Hold Barrier",
    objectiveLine: "Hold the marked barrier line and prevent a clean transit through the seam.",
    mapIntent: "Treat the intercept gate and barrier station as decision points rather than exact target positions.",
    endCondition: "Recover once the barrier picture is clear and the enemy route has been forced to resolve."
  },
  intercept_gate: {
    label: "Intercept Gate",
    objectiveLine: "Cut ahead of the marked route and challenge the transit at the likely gate.",
    mapIntent: "Use the likely egress marker to get in front of the movement instead of chasing the datum.",
    endCondition: "Recover once you have classified the route choice and denied an easy transit."
  },
  confirm_route: {
    label: "Confirm Route",
    objectiveLine: "Confirm which corridor is real and leave a clean handoff for follow-on forces.",
    mapIntent: "Compare the likely contact area against the marked route decision point before committing.",
    endCondition: "Recover once command has a clear route picture for follow-on forces."
  },
  classify_screen: {
    label: "Classify The Screen",
    objectiveLine: "Probe the screen edges, identify escorts, and avoid getting sucked into the wrong layer.",
    mapIntent: "Use the support and barrier markers to understand where the screen is strongest.",
    endCondition: "Recover once you can describe the escort layout and main screen axis."
  },
  trail_handoff: {
    label: "Trail To Handoff",
    objectiveLine: "Carry contact into the terminal phase and preserve a clean handoff for support forces.",
    mapIntent: "Stay connected to the marked route and barrier cues long enough to hand the picture forward.",
    endCondition: "Recover after preserving contact long enough for the handoff."
  },
  designated_strike: {
    label: "Designated Strike",
    objectiveLine: "Classify the designated high-value target, attack it, and leave the area before the counter-search closes.",
    mapIntent: "Use the marked route and search cues to stalk the formation, identify the target, fire from advantage, and exit along the withdrawal geometry.",
    endCondition: "Mission ends when the designated target is destroyed or the strike window is clearly lost and you withdraw intact."
  },
  break_contact_escape: {
    label: "Break Contact And Escape",
    objectiveLine: "Break contact, clear the enemy search geometry, and exit the area with the boat intact.",
    mapIntent: "Treat the withdrawal line as a real escape axis and avoid re-entering the search net once you disengage.",
    endCondition: "Mission ends when you clear the pursuit geometry and recover with the boat combat effective."
  }
};

const MISSION_LIBRARY = {
  initial_scout: {
    name: "Initial Scout",
    summary: "Build the first tactical picture on the enemy movement and withdraw cleanly.",
    cue: "Initial contacts are thin and ambiguous. Preserve stealth and establish the route picture.",
    taskType: "classify_trail"
  },
  crosscurrent: {
    name: "Crosscurrent",
    summary: "The enemy adjusts course and screening posture. Re-establish contact and refine the route estimate.",
    cue: "Expect a tighter helo pattern and more disciplined maneuver around the lead unit.",
    taskType: "reacquire_contact"
  },
  barrier_tide: {
    name: "Barrier Tide",
    summary: "The route is bending into a constrained firing window. Identify the designated high-value unit, sink it, and get clear before the barrier closes.",
    cue: "Command has shifted from surveillance to attack. Classification must be positive before you fire.",
    taskType: "designated_strike"
  },
  closing_arc: {
    name: "Closing Arc",
    summary: "The enemy screen is fully alerted. Break contact, survive the search, and preserve the boat after the strike phase.",
    cue: "Assume retaliation geometry is active and use the withdrawal axis as your real objective.",
    taskType: "break_contact_escape"
  },
  first_vector: {
    name: "First Vector",
    summary: "Intercept the opening move and classify the breakout axis before it widens.",
    cue: "Expect sparse reporting and a narrow early prosecution window.",
    taskType: "intercept_gate"
  },
  datum_shift: {
    name: "Datum Shift",
    summary: "The contact picture breaks and reforms. Push back in and restore the track.",
    cue: "Search cues are intermittent and the opposing force is exploiting clutter.",
    taskType: "reacquire_contact"
  },
  containment_run: {
    name: "Containment Run",
    summary: "The breakout is boxed into a narrow seam. Kill the designated submarine or lead escort before it slips through the gate.",
    cue: "The strike order is active. Delay will let the target cross under a tighter screen.",
    taskType: "designated_strike"
  },
  closing_window: {
    name: "Closing Window",
    summary: "The enemy is reacting to your attack. Clear the search geometry and preserve combat power for the next decision cycle.",
    cue: "Counter-detection risk is high. Recover only after you have broken pursuit.",
    taskType: "break_contact_escape"
  },
  screen_probe: {
    name: "Screen Probe",
    summary: "Probe the screen, confirm intent, and keep the initiative without overcommitting.",
    cue: "The opening layer is disciplined but not yet fully closed.",
    taskType: "classify_screen"
  },
  route_bend: {
    name: "Route Bend",
    summary: "The enemy shifts axis and tries to force a route decision under pressure.",
    cue: "The support picture is thickening around the turn point.",
    taskType: "intercept_gate"
  },
  kill_box: {
    name: "Kill Box",
    summary: "Contain the movement inside prepared geometry, destroy the decisive hostile unit, and survive the immediate response.",
    cue: "You already have broad attack authority. Use it against the designated combatant before the formation disperses.",
    taskType: "designated_strike"
  },
  terminal_shadow: {
    name: "Terminal Shadow",
    summary: "The strike is complete or imminent. Break away, spoil the counter-search, and exit with the boat intact.",
    cue: "Open warfare conditions still apply, but survival now matters as much as additional kills.",
    taskType: "break_contact_escape"
  }
};

const CONTINUATION_OBJECTIVES = {
  pursue_contact: {
    label: "Pursue Contact",
    baseName: "Pursuit Vector",
    slugPrefix: "pursuit_vector",
    summaries: {
      surface_shadow: "Maintain pressure on the enemy route and keep contact alive as the formation reacts to your last report.",
      sub_hunt: "Drive back onto the breakout trail before the opposition can widen the gap and reset the contact picture."
    }
  },
  shadow_safely: {
    label: "Shadow Safely",
    baseName: "Shadow Lattice",
    slugPrefix: "shadow_lattice",
    summaries: {
      surface_shadow: "Preserve stealth while rebuilding the tactical picture from offset positions and indirect cues.",
      sub_hunt: "Stay on the edge of the contact envelope and carry the trail without forcing a close prosecution."
    }
  },
  break_contact: {
    label: "Break Contact",
    baseName: "Silent Reset",
    slugPrefix: "silent_reset",
    summaries: {
      surface_shadow: "Disengage cleanly, preserve the boat, and create space for a later re-entry under better conditions.",
      sub_hunt: "Withdraw from the hottest search arcs, survive the pressure, and regain initiative on your terms."
    }
  },
  defend_chokepoint: {
    label: "Defend Chokepoint",
    baseName: "Barrier Station",
    slugPrefix: "barrier_station",
    summaries: {
      surface_shadow: "Hold the likely turn point and force the enemy route to resolve against your prepared geometry.",
      sub_hunt: "Set up across the likely egress seam and turn the next phase into a containment problem."
    }
  },
  intercept_route: {
    label: "Intercept Route",
    baseName: "Interception Gate",
    slugPrefix: "interception_gate",
    summaries: {
      surface_shadow: "Commit to the most likely route axis and cut ahead of the next movement window.",
      sub_hunt: "Use the latest cues to get ahead of the breakout and challenge the route before it opens up."
    }
  }
};

const RISK_POSTURES = {
  cautious: {
    label: "Cautious",
    cue: "Command emphasizes survivability, signal discipline, and low exposure while the battlespace resets."
  },
  balanced: {
    label: "Balanced",
    cue: "Command wants steady pressure without gambling the campaign on a single noisy attack opportunity."
  },
  aggressive: {
    label: "Aggressive",
    cue: "Command is willing to trade exposure for sharper contact quality and a faster operational decision."
  }
};

const OPERATIONAL_TEMPOS = {
  immediate: {
    label: "Immediate",
    advanceHours: 10
  },
  deliberate: {
    label: "Deliberate",
    advanceHours: 24
  },
  recovery: {
    label: "Recovery",
    advanceHours: 48
  }
};

const THEATER_TEMPLATES = {
  luzon_strait: {
    id: "luzon_strait",
    label: "Luzon Strait",
    family: "surface_shadow",
    theaterName: "Luzon Strait",
    defaultYear: 2028,
    description: "A U.S. submarine campaign shadowing PLAN surface movements through the Bashi and Balintang approaches.",
    player: {
      unitId: "uss_north_carolina",
      name: "USS North Carolina",
      faction: "US",
      platformType: "submarine",
      dbid: 1015,
      ammo: {
        mk48_mod7: 12,
        decoy_mk3: 12,
        decoy_2458: 12
      }
    },
    enemies: [
      { unitId: "plan_lead_ddg", name: "PLAN Lead DDG", faction: "CN", platformType: "surface_combatant", dbid: 3883 },
      { unitId: "plan_escort_ffg", name: "PLAN Escort FFG", faction: "CN", platformType: "surface_combatant", dbid: 1965 }
    ],
    route: {
      playerCorridor: [[20.18, 122.78], [20.44, 122.52], [20.7, 122.18], [20.92, 121.92]],
      enemyCorridor: [[20.88, 121.76], [20.74, 121.92], [20.56, 122.1], [20.28, 122.48]],
      heloCorridor: [[20.74, 122.22], [20.58, 122.4], [20.42, 122.56]],
      supportCorridor: [[19.98, 123.16], [20.18, 122.98], [20.34, 122.82]]
    }
  },
  south_china_sea: {
    id: "south_china_sea",
    label: "South China Sea",
    family: "sub_hunt",
    theaterName: "South China Sea",
    defaultYear: 2028,
    description: "A U.S. submarine campaign hunting a Russian breakout through merchant clutter and support screens.",
    player: {
      unitId: "uss_north_dakota",
      name: "USS North Dakota",
      faction: "US",
      platformType: "submarine",
      dbid: 1015,
      ammo: {
        mk48_mod7: 12,
        decoy_mk3: 8,
        decoy_2458: 8
      }
    },
    enemies: [
      { unitId: "yasen_severodvinsk", name: "Yasen Severodvinsk", faction: "RU", platformType: "submarine", dbid: 667 },
      { unitId: "akula_screen", name: "Akula Screen", faction: "RU", platformType: "submarine", dbid: 34 }
    ],
    route: {
      variants: [
        {
          id: "reed_bank_gate",
          label: "Reed Bank Gate",
          playerCorridor: [[16.4, 118.78], [16.56, 118.56], [16.68, 118.92], [16.78, 119.12]],
          enemyCorridor: [[16.84, 119.32], [16.7, 119.16], [16.52, 118.88], [16.28, 118.2]],
          supportCorridor: [[17.04, 118.42], [16.84, 118.14], [16.54, 117.96]],
          airCorridor: [[16.9, 118.94], [16.76, 118.72], [16.62, 118.44]]
        },
        {
          id: "palawan_seam",
          label: "Palawan Seam",
          playerCorridor: [[14.92, 117.94], [15.14, 117.62], [15.36, 117.28], [15.58, 116.98]],
          enemyCorridor: [[15.86, 116.74], [15.62, 116.98], [15.34, 117.26], [15.04, 117.58]],
          supportCorridor: [[16.18, 117.16], [15.94, 116.86], [15.58, 116.52]],
          airCorridor: [[15.74, 117.46], [15.52, 117.14], [15.3, 116.84]]
        },
        {
          id: "spratly_arc",
          label: "Spratly Arc",
          playerCorridor: [[12.72, 114.9], [12.96, 115.26], [13.2, 115.68], [13.44, 116.02]],
          enemyCorridor: [[13.86, 116.28], [13.58, 115.98], [13.26, 115.64], [12.94, 115.22]],
          supportCorridor: [[14.08, 115.4], [13.82, 115.02], [13.46, 114.72]],
          airCorridor: [[13.76, 116.02], [13.48, 115.66], [13.18, 115.3]]
        },
        {
          id: "luzon_western_approach",
          label: "Luzon Western Approach",
          playerCorridor: [[18.02, 119.22], [17.82, 118.96], [17.58, 118.64], [17.28, 118.34]],
          enemyCorridor: [[17.06, 118.18], [17.28, 118.46], [17.54, 118.82], [17.84, 119.08]],
          supportCorridor: [[16.72, 117.84], [17.02, 118.08], [17.36, 118.32]],
          airCorridor: [[17.56, 119.04], [17.34, 118.74], [17.1, 118.42]]
        },
        {
          id: "scarborough_sweep",
          label: "Scarborough Sweep",
          playerCorridor: [[15.98, 118.86], [16.22, 119.08], [16.48, 119.34], [16.72, 119.58]],
          enemyCorridor: [[17.04, 120.08], [16.82, 119.82], [16.56, 119.48], [16.26, 119.16]],
          supportCorridor: [[16.94, 119.22], [16.72, 118.96], [16.42, 118.74]],
          airCorridor: [[16.88, 119.72], [16.62, 119.42], [16.36, 119.16]]
        },
        {
          id: "thitu_pivot",
          label: "Thitu Pivot",
          playerCorridor: [[11.64, 114.88], [11.92, 115.14], [12.18, 115.44], [12.42, 115.78]],
          enemyCorridor: [[12.88, 116.02], [12.62, 115.72], [12.34, 115.42], [12.04, 115.14]],
          supportCorridor: [[13.08, 115.32], [12.82, 115.04], [12.52, 114.78]],
          airCorridor: [[12.76, 115.82], [12.48, 115.52], [12.18, 115.22]]
        },
        {
          id: "namyet_chain",
          label: "Namyet Chain",
          playerCorridor: [[10.86, 115.42], [11.12, 115.74], [11.38, 116.06], [11.66, 116.34]],
          enemyCorridor: [[12.14, 116.72], [11.88, 116.46], [11.6, 116.16], [11.3, 115.88]],
          supportCorridor: [[12.28, 116.1], [12.02, 115.82], [11.72, 115.54]],
          airCorridor: [[11.96, 116.46], [11.68, 116.18], [11.4, 115.9]]
        },
        {
          id: "central_basin_run",
          label: "Central Basin Run",
          playerCorridor: [[13.92, 116.66], [14.18, 116.98], [14.44, 117.28], [14.7, 117.56]],
          enemyCorridor: [[15.18, 117.84], [14.92, 117.54], [14.64, 117.24], [14.34, 116.92]],
          supportCorridor: [[15.36, 117.2], [15.06, 116.92], [14.78, 116.62]],
          airCorridor: [[15.02, 117.62], [14.74, 117.32], [14.46, 117.02]]
        },
        {
          id: "west_palawan_gate",
          label: "West Palawan Gate",
          playerCorridor: [[11.78, 116.62], [12.02, 116.34], [12.28, 116.04], [12.54, 115.74]],
          enemyCorridor: [[13.08, 115.52], [12.84, 115.78], [12.56, 116.06], [12.26, 116.34]],
          supportCorridor: [[13.28, 116.0], [12.98, 115.72], [12.68, 115.42]],
          airCorridor: [[12.96, 115.54], [12.68, 115.84], [12.38, 116.12]]
        },
        {
          id: "balabac_extension",
          label: "Balabac Extension",
          playerCorridor: [[9.84, 116.82], [10.12, 116.54], [10.38, 116.26], [10.66, 115.98]],
          enemyCorridor: [[11.08, 115.76], [10.84, 116.02], [10.58, 116.28], [10.3, 116.56]],
          supportCorridor: [[11.32, 116.24], [11.04, 115.96], [10.76, 115.68]],
          airCorridor: [[11.02, 115.82], [10.74, 116.12], [10.46, 116.38]]
        },
        {
          id: "calamian_ladder",
          label: "Calamian Ladder",
          playerCorridor: [[11.86, 118.22], [12.12, 117.94], [12.4, 117.64], [12.68, 117.36]],
          enemyCorridor: [[13.18, 117.12], [12.92, 117.4], [12.64, 117.7], [12.34, 117.98]],
          supportCorridor: [[13.4, 117.56], [13.08, 117.28], [12.8, 117.02]],
          airCorridor: [[13.02, 117.16], [12.76, 117.46], [12.48, 117.74]]
        },
        {
          id: "commodore_trough",
          label: "Commodore Trough",
          playerCorridor: [[14.84, 118.92], [15.1, 118.6], [15.34, 118.28], [15.58, 117.98]],
          enemyCorridor: [[16.02, 117.76], [15.8, 118.04], [15.56, 118.34], [15.3, 118.66]],
          supportCorridor: [[16.22, 118.18], [15.94, 117.9], [15.66, 117.62]],
          airCorridor: [[15.86, 117.84], [15.6, 118.14], [15.34, 118.44]]
        }
      ]
    }
  },
  norwegian_sea: {
    id: "norwegian_sea",
    label: "Norwegian Sea",
    family: "sub_hunt",
    theaterName: "Norwegian Sea",
    defaultYear: 2028,
    description: "A U.S. submarine campaign shadowing and containing Russian submarine movements from the Barents and Norwegian Sea approaches.",
    player: {
      unitId: "uss_north_dakota",
      name: "USS North Dakota",
      faction: "US",
      platformType: "submarine",
      dbid: 1015,
      ammo: {
        mk48_mod7: 12,
        decoy_mk3: 8,
        decoy_2458: 8
      }
    },
    enemies: [
      { unitId: "yasen_severodvinsk", name: "Yasen Severodvinsk", faction: "RU", platformType: "submarine", dbid: 667 },
      { unitId: "akula_screen", name: "Akula Screen", faction: "RU", platformType: "submarine", dbid: 34 }
    ],
    route: {
      variants: [
        {
          id: "bear_island_gap",
          label: "Bear Island Gap",
          playerCorridor: [[71.26, 12.84], [71.58, 14.68], [71.92, 16.54], [72.28, 18.46]],
          enemyCorridor: [[74.18, 28.62], [73.74, 26.08], [73.26, 23.48], [72.78, 20.82]],
          supportCorridor: [[70.82, 10.84], [71.18, 12.48], [71.46, 14.24]],
          airCorridor: [[72.36, 18.06], [72.82, 20.02], [73.18, 22.18]]
        },
        {
          id: "lofoten_wall",
          label: "Lofoten Wall",
          playerCorridor: [[68.82, 9.86], [69.16, 11.24], [69.52, 12.78], [69.96, 14.32]],
          enemyCorridor: [[71.18, 19.42], [70.82, 17.54], [70.4, 15.76], [69.92, 13.84]],
          supportCorridor: [[68.12, 8.42], [68.48, 9.72], [68.86, 11.08]],
          airCorridor: [[69.84, 13.56], [70.28, 15.1], [70.72, 16.76]]
        },
        {
          id: "nordkapp_seam",
          label: "Nordkapp Seam",
          playerCorridor: [[70.94, 18.22], [71.26, 20.04], [71.58, 21.98], [71.92, 23.86]],
          enemyCorridor: [[73.16, 31.22], [72.82, 28.88], [72.42, 26.44], [71.98, 24.16]],
          supportCorridor: [[70.18, 16.02], [70.48, 17.66], [70.82, 19.24]],
          airCorridor: [[71.84, 23.32], [72.24, 25.02], [72.66, 26.88]]
        },
        {
          id: "faroe_shetland_exit",
          label: "Faroe-Shetland Exit",
          playerCorridor: [[61.06, -3.62], [61.44, -1.88], [61.92, -0.22], [62.38, 1.52]],
          enemyCorridor: [[64.24, 4.62], [63.76, 2.88], [63.22, 1.02], [62.68, -0.74]],
          supportCorridor: [[60.42, -5.24], [60.86, -3.44], [61.28, -1.78]],
          airCorridor: [[62.14, 1.18], [62.62, 2.92], [63.02, 4.54]]
        },
        {
          id: "jan_mayen_arc",
          label: "Jan Mayen Arc",
          playerCorridor: [[68.26, -5.82], [68.72, -3.92], [69.16, -1.88], [69.58, 0.24]],
          enemyCorridor: [[71.12, 6.82], [70.72, 4.86], [70.22, 2.72], [69.72, 0.62]],
          supportCorridor: [[67.56, -7.12], [67.98, -5.12], [68.42, -3.18]],
          airCorridor: [[69.46, 0.08], [69.96, 2.08], [70.34, 4.04]]
        },
        {
          id: "barents_bastion_edge",
          label: "Barents Bastion Edge",
          playerCorridor: [[72.24, 24.12], [72.56, 26.24], [72.88, 28.42], [73.22, 30.58]],
          enemyCorridor: [[74.86, 36.84], [74.42, 34.26], [73.96, 31.72], [73.48, 29.18]],
          supportCorridor: [[71.48, 22.04], [71.82, 24.04], [72.12, 26.08]],
          airCorridor: [[73.04, 30.16], [73.44, 32.38], [73.88, 34.62]]
        }
      ]
    }
  }
};

const THEATER_FORCE_POOLS = {
  luzon_strait: {
    sectors: [
      { id: "bashi_channel", label: "Bashi Channel" },
      { id: "balintang_approach", label: "Balintang Approach" },
      { id: "philippine_sea_screen", label: "Philippine Sea Screen" },
      { id: "taiwan_east", label: "East of Taiwan" }
    ],
    friendlySurface: [
      { unitId: "uss_spruance", name: "USS Spruance", faction: "US", platformType: "surface_combatant", dbid: 294, sectors: ["balintang_approach", "philippine_sea_screen"] },
      { unitId: "uss_milius", name: "USS Milius", faction: "US", platformType: "surface_combatant", dbid: 294, sectors: ["bashi_channel", "taiwan_east"] },
      { unitId: "uss_rafael_peralta", name: "USS Rafael Peralta", faction: "US", platformType: "surface_combatant", dbid: 294, sectors: ["philippine_sea_screen", "balintang_approach"] }
    ],
    friendlyAir: [
      { unitId: "p8_triton_watch", name: "P-8A Triton Watch", faction: "US", platformType: "maritime_patrol_aircraft", dbid: 2705, sectors: ["bashi_channel", "balintang_approach", "philippine_sea_screen"] },
      { unitId: "p8_seaborne_cue", name: "P-8A Seaborne Cue", faction: "US", platformType: "maritime_patrol_aircraft", dbid: 2705, sectors: ["taiwan_east", "philippine_sea_screen"] }
    ],
    enemySurface: [
      { unitId: "plan_lead_ddg", name: "PLAN Lead DDG", faction: "CN", platformType: "surface_combatant", dbid: 3883, sectors: ["bashi_channel", "taiwan_east"] },
      { unitId: "plan_escort_ffg", name: "PLAN Escort FFG", faction: "CN", platformType: "surface_combatant", dbid: 1965, sectors: ["bashi_channel", "balintang_approach"] },
      { unitId: "plan_screen_ddg", name: "PLAN Screen DDG", faction: "CN", platformType: "surface_combatant", dbid: 3883, sectors: ["philippine_sea_screen", "balintang_approach"] },
      { unitId: "plan_barrier_ffg", name: "PLAN Barrier FFG", faction: "CN", platformType: "surface_combatant", dbid: 1965, sectors: ["philippine_sea_screen", "bashi_channel"] },
      { unitId: "plan_reserve_ffg", name: "PLAN Reserve FFG", faction: "CN", platformType: "surface_combatant", dbid: 1965, sectors: ["taiwan_east", "bashi_channel"] }
    ],
    enemyAir: [
      { unitId: "plan_z9_screen", name: "PLAN Z-9 Screen", faction: "CN", platformType: "helicopter", dbid: 60, sectors: ["bashi_channel", "balintang_approach"] },
      { unitId: "plan_z9_barrier", name: "PLAN Z-9 Barrier", faction: "CN", platformType: "helicopter", dbid: 60, sectors: ["philippine_sea_screen", "taiwan_east"] }
    ]
  },
  south_china_sea: {
    sectors: [
      { id: "reed_bank_gate", label: "Reed Bank Gate" },
      { id: "palawan_seam", label: "Palawan Seam" },
      { id: "spratly_arc", label: "Spratly Arc" },
      { id: "luzon_western_approach", label: "Luzon Western Approach" },
      { id: "scarborough_sweep", label: "Scarborough Sweep" },
      { id: "central_basin_run", label: "Central Basin Run" }
    ],
    friendlySurface: [
      { unitId: "uss_spruance", name: "USS Spruance", faction: "US", platformType: "surface_combatant", dbid: 294, sectors: ["reed_bank_gate", "scarborough_sweep"] },
      { unitId: "uss_dewey", name: "USS Dewey", faction: "US", platformType: "surface_combatant", dbid: 294, sectors: ["palawan_seam", "central_basin_run"] },
      { unitId: "uss_stockdale", name: "USS Stockdale", faction: "US", platformType: "surface_combatant", dbid: 294, sectors: ["spratly_arc", "luzon_western_approach"] }
    ],
    friendlyAir: [
      { unitId: "p8_barrier_one", name: "P-8A Barrier One", faction: "US", platformType: "maritime_patrol_aircraft", dbid: 2705, sectors: ["reed_bank_gate", "scarborough_sweep", "luzon_western_approach"] },
      { unitId: "p8_barrier_two", name: "P-8A Barrier Two", faction: "US", platformType: "maritime_patrol_aircraft", dbid: 2705, sectors: ["palawan_seam", "spratly_arc", "central_basin_run"] }
    ],
    enemySubsurface: [
      { unitId: "yasen_severodvinsk", name: "Yasen Severodvinsk", faction: "RU", platformType: "submarine", dbid: 667, sectors: ["reed_bank_gate", "scarborough_sweep"], role: "target" },
      { unitId: "akula_screen", name: "Akula Screen", faction: "RU", platformType: "submarine", dbid: 34, sectors: ["reed_bank_gate", "palawan_seam"], role: "screen" },
      { unitId: "akula_pacific_screen", name: "Akula Pacific Screen", faction: "RU", platformType: "submarine", dbid: 34, sectors: ["luzon_western_approach", "scarborough_sweep"], role: "screen" },
      { unitId: "yasen_kazan", name: "Yasen Kazan", faction: "RU", platformType: "submarine", dbid: 667, sectors: ["central_basin_run", "spratly_arc"], role: "target" }
    ],
    enemySurfaceSupport: [
      { unitId: "support_ddg_alpha", name: "Support DDG Alpha", faction: "CN", platformType: "surface_combatant", dbid: 3883, sectors: ["reed_bank_gate", "scarborough_sweep"] },
      { unitId: "support_ddg_beta", name: "Support DDG Beta", faction: "CN", platformType: "surface_combatant", dbid: 3883, sectors: ["spratly_arc", "central_basin_run"] },
      { unitId: "support_frigate_alpha", name: "Support Frigate Alpha", faction: "CN", platformType: "surface_combatant", dbid: 1965, sectors: ["palawan_seam", "central_basin_run"] },
      { unitId: "support_frigate_beta", name: "Support Frigate Beta", faction: "CN", platformType: "surface_combatant", dbid: 1965, sectors: ["luzon_western_approach", "reed_bank_gate"] }
    ],
    enemyAir: [
      { unitId: "support_helo_alpha", name: "Support Helo Alpha", faction: "CN", platformType: "helicopter", dbid: 60, sectors: ["reed_bank_gate", "spratly_arc"] },
      { unitId: "support_helo_beta", name: "Support Helo Beta", faction: "CN", platformType: "helicopter", dbid: 60, sectors: ["palawan_seam", "central_basin_run"] }
    ]
  },
  norwegian_sea: {
    sectors: [
      { id: "bear_island_gap", label: "Bear Island Gap" },
      { id: "lofoten_wall", label: "Lofoten Wall" },
      { id: "nordkapp_seam", label: "Nordkapp Seam" },
      { id: "faroe_shetland_exit", label: "Faroe-Shetland Exit" },
      { id: "jan_mayen_arc", label: "Jan Mayen Arc" },
      { id: "barents_bastion_edge", label: "Barents Bastion Edge" }
    ],
    friendlySurface: [
      { unitId: "uss_truxtun", name: "USS Truxtun", faction: "US", platformType: "surface_combatant", dbid: 294, sectors: ["bear_island_gap", "nordkapp_seam"] },
      { unitId: "uss_laboon", name: "USS Laboon", faction: "US", platformType: "surface_combatant", dbid: 294, sectors: ["lofoten_wall", "jan_mayen_arc"] },
      { unitId: "uss_ross", name: "USS Ross", faction: "US", platformType: "surface_combatant", dbid: 294, sectors: ["faroe_shetland_exit", "jan_mayen_arc"] }
    ],
    friendlyAir: [
      { unitId: "p8_nord_watch", name: "P-8A Nord Watch", faction: "US", platformType: "maritime_patrol_aircraft", dbid: 2705, sectors: ["bear_island_gap", "nordkapp_seam", "barents_bastion_edge"] },
      { unitId: "p8_giuk_scout", name: "P-8A GIUK Scout", faction: "US", platformType: "maritime_patrol_aircraft", dbid: 2705, sectors: ["faroe_shetland_exit", "jan_mayen_arc", "lofoten_wall"] }
    ],
    enemySubsurface: [
      { unitId: "yasen_severodvinsk", name: "Yasen Severodvinsk", faction: "RU", platformType: "submarine", dbid: 667, sectors: ["bear_island_gap", "barents_bastion_edge"], role: "target" },
      { unitId: "yasen_kazan", name: "Yasen Kazan", faction: "RU", platformType: "submarine", dbid: 667, sectors: ["nordkapp_seam", "barents_bastion_edge"], role: "target" },
      { unitId: "akula_screen", name: "Akula Screen", faction: "RU", platformType: "submarine", dbid: 34, sectors: ["bear_island_gap", "lofoten_wall"], role: "screen" },
      { unitId: "akula_gatekeeper", name: "Akula Gatekeeper", faction: "RU", platformType: "submarine", dbid: 34, sectors: ["faroe_shetland_exit", "jan_mayen_arc"], role: "screen" }
    ]
  }
};

const LAND_CLEARANCE_DEGREES = 0.12;
const MAX_POINT_RETRIES = 48;
const MAX_ROUTE_REPAIRS = 28;

const THEATER_LAND_MASKS = {
  luzon_strait: [
    {
      id: "southern_taiwan",
      polygon: [[22.36, 120.62], [22.16, 121.06], [21.98, 121.34], [21.72, 121.22], [21.66, 120.82], [21.92, 120.5]]
    },
    {
      id: "northern_luzon",
      polygon: [[19.86, 121.12], [20.12, 121.78], [20.56, 122.38], [21.06, 122.54], [21.36, 122.06], [21.18, 121.28], [20.76, 120.9], [20.18, 120.84]]
    },
    {
      id: "batanes",
      polygon: [[20.28, 121.72], [20.42, 122.02], [20.64, 122.18], [20.82, 121.94], [20.74, 121.66], [20.48, 121.6]]
    }
  ],
  south_china_sea: [
    {
      id: "west_luzon",
      polygon: [[18.84, 119.5], [17.96, 120.0], [16.98, 120.42], [15.92, 120.56], [15.2, 120.26], [15.06, 119.76], [15.62, 119.28], [16.66, 119.12], [17.62, 119.06], [18.44, 119.14]]
    },
    {
      id: "mindoro",
      polygon: [[13.72, 120.28], [13.44, 121.02], [12.86, 121.28], [12.42, 121.08], [12.34, 120.46], [12.66, 120.02], [13.18, 119.92]]
    },
    {
      id: "palawan",
      polygon: [[11.76, 117.06], [11.24, 117.92], [10.52, 118.64], [9.82, 119.12], [8.94, 118.92], [8.48, 118.26], [8.68, 117.5], [9.42, 116.92], [10.3, 116.62], [11.18, 116.58]]
    },
    {
      id: "northwest_borneo",
      polygon: [[8.22, 114.06], [7.86, 115.02], [7.42, 116.18], [6.88, 117.0], [6.14, 117.1], [5.88, 116.08], [6.2, 114.88], [6.92, 114.08]]
    },
    {
      id: "vietnam_shelf",
      polygon: [[16.88, 109.64], [16.32, 110.54], [15.42, 111.48], [14.54, 112.22], [13.54, 112.92], [12.46, 113.48], [11.34, 114.12], [10.06, 114.76], [8.86, 115.12], [8.48, 114.54], [9.04, 113.44], [10.14, 112.18], [11.26, 111.0], [12.42, 109.98], [13.76, 109.18], [15.2, 108.82], [16.48, 108.94]]
    }
  ],
  norwegian_sea: [
    {
      id: "norway_coast",
      polygon: [[58.02, 4.64], [60.02, 5.22], [62.04, 6.18], [64.12, 8.66], [66.34, 11.62], [68.46, 14.72], [70.48, 18.66], [71.84, 22.18], [72.42, 25.64], [71.98, 28.26], [69.82, 25.84], [67.46, 20.92], [64.94, 14.46], [62.68, 9.16], [60.48, 6.12]]
    },
    {
      id: "faroe_islands",
      polygon: [[61.22, -7.92], [62.0, -6.24], [62.08, -5.48], [61.56, -5.1], [61.12, -5.64], [61.0, -6.72]]
    },
    {
      id: "shetland",
      polygon: [[59.88, -1.92], [60.72, -1.68], [60.86, -0.78], [60.24, -0.52], [59.8, -0.96], [59.72, -1.64]]
    },
    {
      id: "jan_mayen",
      polygon: [[70.98, -9.82], [71.22, -9.28], [71.06, -8.48], [70.72, -8.64], [70.64, -9.34]]
    },
    {
      id: "bear_island",
      polygon: [[74.62, 18.86], [74.76, 19.24], [74.62, 19.54], [74.42, 19.36], [74.44, 18.96]]
    }
  ]
};

function toVector([lat, lon]) {
  return { x: lon, y: lat };
}

function segmentDistanceSquared(point, start, end) {
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  if (vx === 0 && vy === 0) {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    return (dx * dx) + (dy * dy);
  }
  const t = Math.max(0, Math.min(1, (((point.x - start.x) * vx) + ((point.y - start.y) * vy)) / ((vx * vx) + (vy * vy))));
  const px = start.x + (t * vx);
  const py = start.y + (t * vy);
  const dx = point.x - px;
  const dy = point.y - py;
  return (dx * dx) + (dy * dy);
}

function orientation(a, b, c) {
  const value = ((b.y - a.y) * (c.x - b.x)) - ((b.x - a.x) * (c.y - b.y));
  if (Math.abs(value) < 1e-9) {
    return 0;
  }
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + 1e-9
    && b.x + 1e-9 >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y) + 1e-9
    && b.y + 1e-9 >= Math.min(a.y, c.y);
}

function segmentsIntersect(pointA, pointB, pointC, pointD) {
  const o1 = orientation(pointA, pointB, pointC);
  const o2 = orientation(pointA, pointB, pointD);
  const o3 = orientation(pointC, pointD, pointA);
  const o4 = orientation(pointC, pointD, pointB);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && onSegment(pointA, pointC, pointB)) return true;
  if (o2 === 0 && onSegment(pointA, pointD, pointB)) return true;
  if (o3 === 0 && onSegment(pointC, pointA, pointD)) return true;
  if (o4 === 0 && onSegment(pointC, pointB, pointD)) return true;

  return false;
}

function pointInPolygon(point, polygon) {
  const [lat, lon] = point;
  let inside = false;
  for (let index = 0, prior = polygon.length - 1; index < polygon.length; prior = index++) {
    const [latA, lonA] = polygon[index];
    const [latB, lonB] = polygon[prior];
    const intersects = ((latA > lat) !== (latB > lat))
      && (lon < (((lonB - lonA) * (lat - latA)) / ((latB - latA) || 1e-9)) + lonA);
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToPolygon(point, polygon) {
  const vectorPoint = toVector(point);
  let minDistanceSquared = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = toVector(polygon[index]);
    const end = toVector(polygon[(index + 1) % polygon.length]);
    minDistanceSquared = Math.min(minDistanceSquared, segmentDistanceSquared(vectorPoint, start, end));
  }
  return Math.sqrt(minDistanceSquared);
}

function polygonCentroid(polygon) {
  const total = polygon.reduce((accumulator, [lat, lon]) => {
    accumulator.lat += lat;
    accumulator.lon += lon;
    return accumulator;
  }, { lat: 0, lon: 0 });
  return [total.lat / polygon.length, total.lon / polygon.length];
}

function getLandMasks(theaterId) {
  return THEATER_LAND_MASKS[theaterId] || [];
}

function pointViolatesLandMask(theaterId, point, clearance = LAND_CLEARANCE_DEGREES) {
  for (const mask of getLandMasks(theaterId)) {
    if (pointInPolygon(point, mask.polygon)) {
      return mask;
    }
    if (distanceToPolygon(point, mask.polygon) < clearance) {
      return mask;
    }
  }
  return null;
}

function segmentViolatesLandMask(theaterId, fromPoint, toPoint, clearance = LAND_CLEARANCE_DEGREES) {
  const midpoint = [
    Number(((fromPoint[0] + toPoint[0]) / 2).toFixed(6)),
    Number(((fromPoint[1] + toPoint[1]) / 2).toFixed(6))
  ];
  const midpointMask = pointViolatesLandMask(theaterId, midpoint, clearance);
  if (midpointMask) {
    return midpointMask;
  }

  const lineStart = toVector(fromPoint);
  const lineEnd = toVector(toPoint);
  for (const mask of getLandMasks(theaterId)) {
    const polygon = mask.polygon;
    for (let index = 0; index < polygon.length; index += 1) {
      const edgeStart = toVector(polygon[index]);
      const edgeEnd = toVector(polygon[(index + 1) % polygon.length]);
      if (segmentsIntersect(lineStart, lineEnd, edgeStart, edgeEnd)) {
        return mask;
      }
    }
  }
  return null;
}

function movePointOffshore(point, polygon, step = LAND_CLEARANCE_DEGREES * 1.35, multiplier = 1) {
  const [centerLat, centerLon] = polygonCentroid(polygon);
  const latVector = point[0] - centerLat;
  const lonVector = point[1] - centerLon;
  const magnitude = Math.hypot(latVector, lonVector) || 1;
  return [
    Number((point[0] + ((latVector / magnitude) * step * multiplier)).toFixed(6)),
    Number((point[1] + ((lonVector / magnitude) * step * multiplier)).toFixed(6))
  ];
}

function pickSafePoint(theaterId, seedPoint, rng, latDelta, lonDelta) {
  let candidate = seedPoint;
  let violatingMask = pointViolatesLandMask(theaterId, candidate);
  if (!violatingMask) {
    return candidate;
  }

  for (let attempt = 0; attempt < MAX_POINT_RETRIES; attempt += 1) {
    candidate = jitterPoint(seedPoint, rng, latDelta, lonDelta);
    violatingMask = pointViolatesLandMask(theaterId, candidate);
    if (!violatingMask) {
      return candidate;
    }
  }

  candidate = seedPoint;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    candidate = movePointOffshore(candidate, violatingMask.polygon, LAND_CLEARANCE_DEGREES * 1.6, attempt);
    violatingMask = pointViolatesLandMask(theaterId, candidate);
    if (!violatingMask) {
      return candidate;
    }
  }

  return seedPoint;
}

function repairRoutePath(theaterId, points, rng) {
  const repaired = [];
  for (let index = 0; index < points.length; index += 1) {
    let candidate = points[index];
    candidate = pickSafePoint(theaterId, candidate, rng, 0.08, 0.12);
    if (!repaired.length) {
      repaired.push(candidate);
      continue;
    }

    const previous = repaired[repaired.length - 1];
    let violatingMask = segmentViolatesLandMask(theaterId, previous, candidate);
    if (!violatingMask) {
      repaired.push(candidate);
      continue;
    }

    const basePoint = candidate;
    for (let attempt = 0; attempt < MAX_ROUTE_REPAIRS; attempt += 1) {
      candidate = jitterPoint(basePoint, rng, 0.1 + (attempt * 0.01), 0.14 + (attempt * 0.015));
      candidate = pickSafePoint(theaterId, candidate, rng, 0.06, 0.08);
      violatingMask = segmentViolatesLandMask(theaterId, previous, candidate);
      if (!violatingMask) {
        break;
      }
    }

    if (violatingMask) {
      candidate = movePointOffshore(basePoint, violatingMask.polygon, LAND_CLEARANCE_DEGREES * 1.8, 2);
    }
    repaired.push(candidate);
  }
  return repaired;
}

function applyGeometrySafety(theaterId, family, geometry, rng) {
  const safeGeometry = { ...geometry };
  const pointKeys = Object.entries(geometry)
    .filter(([, value]) => Array.isArray(value) && value.length === 2 && value.every((entry) => typeof entry === "number"))
    .map(([key]) => key);

  for (const key of pointKeys) {
    safeGeometry[key] = pickSafePoint(theaterId, geometry[key], rng, 0.08, 0.12);
  }

  if (family === "surface_shadow") {
    const routePath = repairRoutePath(theaterId, [
      safeGeometry.playerSpawn,
      safeGeometry.datum,
      safeGeometry.lead,
      safeGeometry.destination,
      safeGeometry.withdrawal
    ], rng);
    [safeGeometry.playerSpawn, safeGeometry.datum, safeGeometry.lead, safeGeometry.destination, safeGeometry.withdrawal] = routePath;

    const enemyPath = repairRoutePath(theaterId, [
      safeGeometry.lead,
      safeGeometry.escort,
      safeGeometry.barrier,
      safeGeometry.destination
    ], rng);
    [safeGeometry.lead, safeGeometry.escort, safeGeometry.barrier, safeGeometry.destination] = enemyPath;
  } else {
    const routePath = repairRoutePath(theaterId, [
      safeGeometry.playerSpawn,
      safeGeometry.datum,
      safeGeometry.yasen,
      safeGeometry.egress,
      safeGeometry.withdrawal
    ], rng);
    [safeGeometry.playerSpawn, safeGeometry.datum, safeGeometry.yasen, safeGeometry.egress, safeGeometry.withdrawal] = routePath;

    const enemyPath = repairRoutePath(theaterId, [
      safeGeometry.yasen,
      safeGeometry.escort,
      safeGeometry.egress
    ], rng);
    [safeGeometry.yasen, safeGeometry.escort, safeGeometry.egress] = enemyPath;

    const supportPath = repairRoutePath(theaterId, [
      safeGeometry.supportGroup,
      safeGeometry.supportDest
    ], rng);
    [safeGeometry.supportGroup, safeGeometry.supportDest] = supportPath;
  }

  safeGeometry.routeSummary = family === "surface_shadow"
    ? summarizePath([safeGeometry.playerSpawn, safeGeometry.datum, safeGeometry.lead, safeGeometry.destination, safeGeometry.withdrawal])
    : summarizePath([safeGeometry.playerSpawn, safeGeometry.datum, safeGeometry.yasen, safeGeometry.egress, safeGeometry.withdrawal]);
  safeGeometry.enemyTransitSummary = family === "surface_shadow"
    ? summarizePath([safeGeometry.lead, safeGeometry.escort, safeGeometry.barrier, safeGeometry.destination])
    : summarizePath([safeGeometry.yasen, safeGeometry.escort, safeGeometry.egress]);
  safeGeometry.safety = {
    landMasksApplied: getLandMasks(theaterId).length,
    clearanceDegrees: LAND_CLEARANCE_DEGREES
  };
  return safeGeometry;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampScenarioCount(value) {
  const count = Number(value || DEFAULT_SCENARIO_COUNT);
  return Math.max(2, Math.min(4, Math.round(count)));
}

function sanitizeCampaignId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "generated_campaign";
}

function plusHours(baseIso, hours) {
  const date = new Date(baseIso);
  date.setUTCHours(date.getUTCHours() + hours);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return {
    iso: date.toISOString(),
    mnw: `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`
  };
}

function normalizeCampaignClimateKey(value) {
  if (CAMPAIGN_CLIMATE_CATALOG[value]) {
    return value;
  }
  return "surveillance";
}

function normalizeMissionStanceKey(value) {
  if (MISSION_STANCE_CATALOG[value]) {
    return value;
  }
  return "wide_area_search";
}

function normalizeEscalationKey(value, fallback = "peacetime") {
  if (ESCALATION_CATALOG[value]) {
    return value;
  }
  return fallback;
}

function escalationLevelForKey(value) {
  return ESCALATION_CATALOG[normalizeEscalationKey(value)].level;
}

function escalationKeyForLevel(level) {
  const numeric = Math.max(0, Math.min(3, Number.isFinite(level) ? Math.round(level) : 0));
  return Object.entries(ESCALATION_CATALOG).find(([, item]) => item.level === numeric)?.[0] || "peacetime";
}

function deriveInitialEscalationKey(climateKey, index = 0) {
  const climate = CAMPAIGN_CLIMATE_CATALOG[normalizeCampaignClimateKey(climateKey)];
  const baseLevel = escalationLevelForKey(climate.defaultEscalation);
  const additionalLevels = climateKey === "sea_denial"
    ? Math.min(index, 1)
    : Math.min(index, 2);
  return escalationKeyForLevel(baseLevel + additionalLevels);
}

function deriveContinuationEscalationKey(currentKey, lastOutcome = "success", objective = "pursue_contact", riskPosture = "balanced") {
  let nextLevel = escalationLevelForKey(currentKey);
  if (objective === "defend_chokepoint" || objective === "intercept_route") {
    nextLevel += 1;
  }
  if (objective === "break_contact") {
    nextLevel -= 1;
  }
  if (riskPosture === "aggressive") {
    nextLevel += 1;
  }
  if (riskPosture === "cautious") {
    nextLevel -= 1;
  }
  if (lastOutcome === "failure") {
    nextLevel += 1;
  }
  if (lastOutcome === "success" && objective === "shadow_safely") {
    nextLevel -= 1;
  }
  return escalationKeyForLevel(nextLevel);
}

function normalizeRoeKey(value, fallback = "weapons_tight") {
  if (ROE_CATALOG[value]) {
    return value;
  }
  return fallback;
}

function deriveRoeKey({ requestedRoe, climateKey, escalationKey, taskType }) {
  if (taskType === "designated_strike") {
    if (requestedRoe === "hostile_flagged_free_fire" || requestedRoe === "military_targets_of_opportunity") {
      return requestedRoe;
    }
    return escalationKey === "open_warfare"
      ? "hostile_flagged_free_fire"
      : "designated_targets_only";
  }
  if (taskType === "break_contact_escape") {
    return "weapons_tight";
  }
  if (ROE_CATALOG[requestedRoe]) {
    return requestedRoe;
  }
  const climate = CAMPAIGN_CLIMATE_CATALOG[normalizeCampaignClimateKey(climateKey)];
  const defaultRoe = normalizeRoeKey(climate?.defaultRoe, "weapons_tight");
  if (escalationKey === "open_warfare") {
    return "hostile_flagged_free_fire";
  }
  if (escalationKey === "crisis" && defaultRoe === "weapons_tight") {
    return "military_targets_of_opportunity";
  }
  return defaultRoe;
}

function defaultMissionTypeForFamily(family) {
  return family === "sub_hunt" ? "asw" : "asuw_military";
}

function normalizeExperimentalSettings(spec = {}) {
  const enabled = Boolean(
    spec.experimentalFeatures?.enabled
    || spec.experimental?.enabled
    || spec.experimentalGeneration
    || spec.enableExperimentalContent
  );
  const requestedPlotSeed = spec.experimentalFeatures?.plotSeed
    || spec.experimental?.plotSeed
    || spec.plotSeed
    || "none";
  const plotSeed = enabled && EXPERIMENTAL_PLOT_SEED_CATALOG[requestedPlotSeed]
    ? requestedPlotSeed
    : "none";
  return {
    enabled,
    plotSeed
  };
}

function normalizeMissionTypeKey(value, family = "surface_shadow", experimental = { enabled: false }) {
  const requested = MISSION_TYPE_CATALOG[value] ? value : defaultMissionTypeForFamily(family);
  if (MISSION_TYPE_CATALOG[requested]?.availability === "experimental" && !experimental.enabled) {
    return defaultMissionTypeForFamily(family);
  }
  const support = MISSION_TYPE_CATALOG[requested]?.supportByFamily?.[family] || "unsupported";
  if (support === "unsupported" || support === "future") {
    return defaultMissionTypeForFamily(family);
  }
  return requested;
}

function resolveMissionTypeSupport(value, family = "surface_shadow", experimental = { enabled: false }) {
  const requestedKey = MISSION_TYPE_CATALOG[value] ? value : defaultMissionTypeForFamily(family);
  const requestedDef = MISSION_TYPE_CATALOG[requestedKey] || MISSION_TYPE_CATALOG[defaultMissionTypeForFamily(family)];
  const requiresExperimental = requestedDef.availability === "experimental";
  if (requiresExperimental && !experimental.enabled) {
    const resolvedKey = defaultMissionTypeForFamily(family);
    const resolvedDef = MISSION_TYPE_CATALOG[resolvedKey];
    return {
      requestedKey,
      requestedDef,
      support: "experimental",
      resolvedKey,
      resolvedDef,
      warning: `${requestedDef.label} is experimental and currently disabled. Turn on Experimental Content to try it, or continue with ${resolvedDef.label}.`
    };
  }
  const support = requestedDef.supportByFamily?.[family] || "unsupported";
  const resolvedKey = support === "unsupported" || support === "future"
    ? defaultMissionTypeForFamily(family)
    : requestedKey;
  const resolvedDef = MISSION_TYPE_CATALOG[resolvedKey];
  let warning = resolvedKey !== requestedKey
    ? `${requestedDef.label} is ${support} for ${family}. Falling back to ${resolvedDef.label}.`
    : support === "partial"
      ? `${requestedDef.label} is only partially supported for ${family}. Briefings and force mix are biased accordingly.`
      : null;
  if (requestedKey === "land_attack") {
    warning = support === "future"
      ? "Land Attack is not technically supported by the current generator or MNW scripting path. It remains a gated placeholder and will fall back to a surface-attack mission."
      : warning;
  } else if (requestedDef.availability === "experimental" && resolvedKey === requestedKey) {
    warning = warning
      ? `${warning} Experimental content is enabled, but this mission family still uses narrative overlays on top of the existing geometry.`
      : `${requestedDef.label} is experimental. The current implementation biases briefing language and force mix, but it does not yet have a bespoke mission script family.`;
  }
  return {
    requestedKey,
    requestedDef,
    support,
    resolvedKey,
    resolvedDef,
    warning
  };
}

function commandAuthorityForTheater(theaterId) {
  return theaterId === "luzon_strait" || theaterId === "south_china_sea"
    ? "COMSUBPAC"
    : "COMSUBLANT";
}

function pickArchetypes(climateKey, count) {
  const selectedTone = TONE_CATALOG[normalizeCampaignClimateKey(climateKey)] || TONE_CATALOG.surveillance;
  return selectedTone.sequence.slice(0, count).map((key) => ({
    slug: key,
    ...MISSION_LIBRARY[key]
  }));
}

function scenarioSlotSlug(slotNumber) {
  return `scenario_${String(slotNumber).padStart(2, "0")}`;
}

function formatMnwFromIso(iso) {
  const date = new Date(iso);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
}

function clampAuthoringDistanceKm(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.min(MAX_TARGET_DISTANCE_KM, Math.max(MIN_TARGET_DISTANCE_KM, Math.round(numeric)));
}

function normalizeAuthoringConstraints(spec = {}) {
  const maxDistanceToPrimaryTargetKm = clampAuthoringDistanceKm(
    spec.authoringConstraints?.maxDistanceToPrimaryTargetKm ?? spec.maxDistanceToPrimaryTargetKm
  );
  return {
    maxDistanceToPrimaryTargetKm
  };
}

function toFixedCoord(value) {
  return Number(value).toFixed(6);
}

function haversineDistanceKm([latA, lonA], [latB, lonB]) {
  const earthRadiusKm = 6371;
  const latDelta = (latB - latA) * (Math.PI / 180);
  const lonDelta = (lonB - lonA) * (Math.PI / 180);
  const lat1 = latA * (Math.PI / 180);
  const lat2 = latB * (Math.PI / 180);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2;
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function jitterPoint([lat, lon], rng, latDelta = 0.08, lonDelta = 0.12) {
  const latOffset = (rng() - 0.5) * latDelta;
  const lonOffset = (rng() - 0.5) * lonDelta;
  return [Number((lat + latOffset).toFixed(6)), Number((lon + lonOffset).toFixed(6))];
}

function moveToward([latA, lonA], [latB, lonB], fraction = 0.25) {
  return [
    Number((latA + ((latB - latA) * fraction)).toFixed(6)),
    Number((lonA + ((lonB - lonA) * fraction)).toFixed(6))
  ];
}

function moveAway([latA, lonA], [latB, lonB], fraction = 0.25) {
  return [
    Number((latA - ((latB - latA) * fraction)).toFixed(6)),
    Number((lonA - ((lonB - lonA) * fraction)).toFixed(6))
  ];
}

function movePointAwayByKm([latA, lonA], [latB, lonB], deltaKm = 1) {
  const avgLat = ((latA + latB) / 2) * (Math.PI / 180);
  const kmPerLat = 111;
  const kmPerLon = Math.max(1, 111 * Math.cos(avgLat));
  let xKm = (lonA - lonB) * kmPerLon;
  let yKm = (latA - latB) * kmPerLat;
  let magnitudeKm = Math.hypot(xKm, yKm);
  if (magnitudeKm < 0.001) {
    xKm = deltaKm;
    yKm = 0;
    magnitudeKm = deltaKm;
  }
  const nextXKm = xKm + ((xKm / magnitudeKm) * deltaKm);
  const nextYKm = yKm + ((yKm / magnitudeKm) * deltaKm);
  return [
    Number((latB + (nextYKm / kmPerLat)).toFixed(6)),
    Number((lonB + (nextXKm / kmPerLon)).toFixed(6))
  ];
}

function primaryTargetPointForFamily(family, geometry) {
  return family === "surface_shadow" ? geometry.lead : geometry.yasen;
}

function geometryPointKeysForFamily(family) {
  if (family === "surface_shadow") {
    return [
      "playerSpawn",
      "datum",
      "lead",
      "escort",
      "barrier",
      "destination",
      "helo",
      "ddg",
      "ddgDest",
      "p8",
      "center",
      "withdrawal"
    ];
  }
  return [
    "playerSpawn",
    "datum",
    "yasen",
    "escort",
    "supportGroup",
    "supportDest",
    "ddg",
    "ddgScreen",
    "p8",
    "center",
    "egress",
    "withdrawal"
  ];
}

function scalePointTowardAnchor([lat, lon], [anchorLat, anchorLon], factor) {
  return [
    Number((anchorLat + ((lat - anchorLat) * factor)).toFixed(6)),
    Number((anchorLon + ((lon - anchorLon) * factor)).toFixed(6))
  ];
}

function withUpdatedGeometrySummaries(family, geometry) {
  return {
    ...geometry,
    routeSummary: family === "surface_shadow"
      ? summarizePath([geometry.playerSpawn, geometry.datum, geometry.lead, geometry.destination, geometry.withdrawal])
      : summarizePath([geometry.playerSpawn, geometry.datum, geometry.yasen, geometry.egress, geometry.withdrawal]),
    enemyTransitSummary: family === "surface_shadow"
      ? summarizePath([geometry.lead, geometry.escort, geometry.barrier, geometry.destination])
      : summarizePath([geometry.yasen, geometry.escort, geometry.egress])
  };
}

function geometryDeconflictionRulesForFamily(family) {
  if (family === "surface_shadow") {
    return [
      { left: "playerSpawn", right: "datum", minKm: 10 },
      { left: "playerSpawn", right: "lead", minKm: 18 },
      { left: "lead", right: "escort", minKm: 8 },
      { left: "lead", right: "barrier", minKm: 8 },
      { left: "escort", right: "barrier", minKm: 6 },
      { left: "ddg", right: "ddgDest", minKm: 6 },
      { left: "destination", right: "withdrawal", minKm: 8 }
    ];
  }
  return [
    { left: "playerSpawn", right: "datum", minKm: 10 },
    { left: "playerSpawn", right: "yasen", minKm: 18 },
    { left: "yasen", right: "escort", minKm: 8 },
    { left: "yasen", right: "supportGroup", minKm: 10 },
    { left: "escort", right: "supportGroup", minKm: 8 },
    { left: "supportGroup", right: "supportDest", minKm: 6 },
    { left: "egress", right: "withdrawal", minKm: 8 }
  ];
}

function applyGeometryDeconfliction(family, geometry) {
  const pointKeys = geometryPointKeysForFamily(family).filter((key) => Array.isArray(geometry[key]));
  const constrained = { ...geometry };
  const explicitRules = geometryDeconflictionRulesForFamily(family);
  const seenPairs = new Set();
  const rules = [
    ...explicitRules,
    ...pointKeys.flatMap((left, index) => pointKeys.slice(index + 1).map((right) => ({ left, right, minKm: 4 })))
  ].filter((rule) => {
    const pairKey = [rule.left, rule.right].sort().join(":");
    if (seenPairs.has(pairKey)) {
      return false;
    }
    seenPairs.add(pairKey);
    return true;
  });

  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (const rule of rules) {
      const left = constrained[rule.left];
      const right = constrained[rule.right];
      if (!Array.isArray(left) || !Array.isArray(right)) {
        continue;
      }
      const distanceKm = haversineDistanceKm(left, right);
      if (distanceKm >= rule.minKm) {
        continue;
      }
      const neededKm = rule.minKm - distanceKm;
      if (rule.left === "playerSpawn") {
        constrained[rule.right] = movePointAwayByKm(right, left, neededKm);
      } else if (rule.right === "playerSpawn") {
        constrained[rule.left] = movePointAwayByKm(left, right, neededKm);
      } else {
        constrained[rule.left] = movePointAwayByKm(left, right, neededKm / 2);
        constrained[rule.right] = movePointAwayByKm(right, left, neededKm / 2);
      }
      changed = true;
    }
    if (!changed) {
      break;
    }
  }

  return {
    ...withUpdatedGeometrySummaries(family, constrained),
    deconfliction: {
      pairRuleCount: rules.length
    }
  };
}

function applyAuthoringDistanceConstraints(family, geometry, authoringConstraints = {}) {
  const maxDistanceKm = clampAuthoringDistanceKm(authoringConstraints.maxDistanceToPrimaryTargetKm);
  const primaryTarget = primaryTargetPointForFamily(family, geometry);
  const currentDistanceKm = haversineDistanceKm(geometry.playerSpawn, primaryTarget);
  const pointKeys = geometryPointKeysForFamily(family);
  const farthestGeneratedDistanceKm = pointKeys.reduce((maxDistance, key) => {
    if (key === "playerSpawn" || !Array.isArray(geometry[key])) {
      return maxDistance;
    }
    return Math.max(maxDistance, haversineDistanceKm(geometry.playerSpawn, geometry[key]));
  }, 0);
  const metrics = {
    primaryTargetDistanceKm: Number(currentDistanceKm.toFixed(1)),
    farthestGeneratedDistanceKm: Number(farthestGeneratedDistanceKm.toFixed(1))
  };

  if (!maxDistanceKm || farthestGeneratedDistanceKm <= maxDistanceKm) {
    return {
      geometry: {
        ...withUpdatedGeometrySummaries(family, geometry),
        authoringMetrics: metrics
      },
      metrics
    };
  }

  const anchor = geometry.playerSpawn;
  const scaleFactor = maxDistanceKm / farthestGeneratedDistanceKm;
  const constrainedGeometry = { ...geometry };
  for (const key of pointKeys) {
    if (key === "playerSpawn" || !Array.isArray(geometry[key])) {
      continue;
    }
    constrainedGeometry[key] = scalePointTowardAnchor(geometry[key], anchor, scaleFactor);
  }
  const constrainedDistanceKm = haversineDistanceKm(constrainedGeometry.playerSpawn, primaryTarget);
  const constrainedFarthestDistanceKm = pointKeys.reduce((maxDistance, key) => {
    if (key === "playerSpawn" || !Array.isArray(constrainedGeometry[key])) {
      return maxDistance;
    }
    return Math.max(maxDistance, haversineDistanceKm(constrainedGeometry.playerSpawn, constrainedGeometry[key]));
  }, 0);
  const updatedMetrics = {
    primaryTargetDistanceKm: Number(constrainedDistanceKm.toFixed(1)),
    farthestGeneratedDistanceKm: Number(constrainedFarthestDistanceKm.toFixed(1))
  };
  return {
    geometry: {
      ...withUpdatedGeometrySummaries(family, constrainedGeometry),
      authoringMetrics: updatedMetrics
    },
    metrics: updatedMetrics
  };
}

function finalizeScenarioGeometry(theaterId, family, geometry, rng, authoringConstraints = {}) {
  const initiallyConstrained = applyAuthoringDistanceConstraints(family, geometry, authoringConstraints).geometry;
  const safetyApplied = applyGeometrySafety(theaterId, family, initiallyConstrained, rng);
  const deconflicted = applyGeometryDeconfliction(family, safetyApplied);
  const finalConstrained = applyAuthoringDistanceConstraints(family, deconflicted, authoringConstraints).geometry;
  return applyGeometrySafety(theaterId, family, finalConstrained, rng);
}

function summarizePath(points) {
  return points
    .map(([lat, lon]) => `${toFixedCoord(lat)}, ${toFixedCoord(lon)}`)
    .join(" -> ");
}

function approximateBearingDegrees([latA, lonA], [latB, lonB]) {
  const lat1 = latA * (Math.PI / 180);
  const lat2 = latB * (Math.PI / 180);
  const dLon = (lonB - lonA) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = (Math.cos(lat1) * Math.sin(lat2))
    - (Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon));
  const bearing = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
  return bearing;
}

function bearingLabelFromDegrees(degrees) {
  const labels = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % labels.length;
  return labels[index];
}

function estimateIntelConfidence(template, geometry, index, rng, missionStanceKey = "wide_area_search") {
  const base = template.family === "surface_shadow" ? 72 : 64;
  const densityModifier = Number(geometry?.density || 1) >= 3 ? 6 : 0;
  const progressionModifier = Math.min(10, index * 3);
  const postureModifier = missionStanceKey === "aggressive_intercept"
    ? 6
    : missionStanceKey === "quiet_shadow"
      ? -4
      : missionStanceKey === "barrier_support"
        ? 3
        : 0;
  const noise = Math.round((rng() - 0.5) * 14);
  return Math.max(42, Math.min(91, base + densityModifier + progressionModifier + postureModifier + noise));
}

function buildScenarioIntel(template, geometry, forces, index, rng, missionStanceKey = "wide_area_search") {
  const playerReference = geometry.playerSpawn;
  const likelyContact = template.family === "surface_shadow"
    ? geometry.lead
    : geometry.yasen;
  const axisReference = template.family === "surface_shadow"
    ? geometry.destination
    : geometry.egress;
  const confidence = estimateIntelConfidence(template, geometry, index, rng, missionStanceKey);
  const likelyBearing = bearingLabelFromDegrees(approximateBearingDegrees(playerReference, likelyContact));
  const axisBearing = bearingLabelFromDegrees(approximateBearingDegrees(playerReference, axisReference));
  const sectorLabel = geometry.routeVariantLabel || forces?.sector || "main axis";
  const confidenceLabel = confidence >= 78
    ? "high-confidence"
    : confidence >= 62
      ? "moderate-confidence"
      : "low-confidence";
  const likelyEnemy = template.family === "surface_shadow"
    ? "enemy surface activity"
    : "enemy submarine activity";
  const likelyLocationText = `${likelyEnemy} is most likely ${likelyBearing} of your ingress track near ${sectorLabel}`;
  const confidenceText = `${confidenceLabel} cueing (${confidence}% assessed confidence)`;
  const prose = `${likelyLocationText}. Treat that as ${confidenceText}, not precise localization.`;
  return {
    confidence,
    confidenceLabel,
    likelyBearing,
    axisBearing,
    sectorLabel,
    likelyLocationText,
    confidenceText,
    prose
  };
}

function resolveScenarioTarget(template, forces = {}) {
  const prioritizedTargets = template.family === "surface_shadow"
    ? [...(forces.enemyPrimary || [])].sort((left, right) => {
      const leftPriority = /lead|flag|command|capital|ddg|cg|carrier/i.test(left?.name || "") ? 1 : 0;
      const rightPriority = /lead|flag|command|capital|ddg|cg|carrier/i.test(right?.name || "") ? 1 : 0;
      return rightPriority - leftPriority;
    })
    : (forces.enemyPrimary || []).filter((unit) => unit.role === "target" || unit.notes?.role === "target");
  const fallbackTargets = template.family === "surface_shadow"
    ? forces.enemyPrimary || []
    : forces.enemyPrimary || [];
  const target = prioritizedTargets[0] || fallbackTargets[0] || null;
  return {
    unit: target,
    name: target?.name || (template.family === "surface_shadow" ? "enemy flagship" : "enemy breakout submarine")
  };
}

function experimentalPlotSeedDefinition(key) {
  return EXPERIMENTAL_PLOT_SEED_CATALOG[key] || EXPERIMENTAL_PLOT_SEED_CATALOG.none;
}

function buildPlotSeedOverlay(experimental = {}) {
  if (!experimental.enabled || !experimental.plotSeed || experimental.plotSeed === "none") {
    return null;
  }
  const seed = experimentalPlotSeedDefinition(experimental.plotSeed);
  return {
    key: experimental.plotSeed,
    label: seed.label,
    description: seed.description,
    summaryPrefix: seed.summaryPrefix,
    cuePrefix: seed.cuePrefix,
    commandIntent: seed.commandIntent
  };
}

function buildScenarioAnnotations(template, geometry, forces, missionDef, missionStanceKey, intel, options = {}) {
  const task = TASK_CATALOG[missionDef.taskType] || TASK_CATALOG.classify_trail;
  const annotations = [];
  const missionStance = MISSION_STANCE_CATALOG[normalizeMissionStanceKey(missionStanceKey)] || MISSION_STANCE_CATALOG.wide_area_search;
  const escalation = ESCALATION_CATALOG[normalizeEscalationKey(options.escalationKey, "peacetime")] || ESCALATION_CATALOG.peacetime;
  const roe = ROE_CATALOG[normalizeRoeKey(options.roeKey, "weapons_tight")] || ROE_CATALOG.weapons_tight;
  const missionType = MISSION_TYPE_CATALOG[normalizeMissionTypeKey(options.missionTypeKey, template.family)] || MISSION_TYPE_CATALOG[defaultMissionTypeForFamily(template.family)];
  const scenarioTarget = resolveScenarioTarget(template, forces);
  const likelyContactPoint = template.family === "surface_shadow"
    ? geometry.datum
    : geometry.yasen;
  const interceptPoint = template.family === "surface_shadow"
    ? geometry.destination
    : geometry.egress;
  const supportPoint = template.family === "surface_shadow"
    ? geometry.ddgDest
    : geometry.ddgScreen;
  const barrierPoint = template.family === "surface_shadow"
    ? geometry.barrier
    : geometry.supportDest;

  annotations.push({
    id: "likely_contact_area",
    label: "Likely Contact Area",
    kind: "search_area",
    point: likelyContactPoint,
    detail: `${intel.likelyLocationText}. ${intel.confidenceText}.`
  });
  annotations.push({
    id: "intercept_gate",
    label: "Intercept Gate",
    kind: "intercept_gate",
    point: interceptPoint,
    detail: "Likely route decision point. Use this as a geometry cue, not a guaranteed enemy position."
  });
  annotations.push({
    id: "support_window",
    label: "Support Search Line",
    kind: "support_zone",
    point: supportPoint,
    detail: "Friendly support is most relevant around this axis if you want to work with cueing instead of chasing every contact yourself."
  });
  annotations.push({
    id: "barrier_station",
    label: "Barrier Station",
    kind: "barrier_station",
    point: barrierPoint,
    detail: "Useful holding point if you choose to turn the mission into a containment problem."
  });

  if (task === TASK_CATALOG.designated_strike) {
    annotations.push({
      id: "designated_target",
      label: "Designated Target",
      kind: "target",
      point: template.family === "surface_shadow" ? geometry.lead : geometry.yasen,
      detail: `Command strike authority applies to ${scenarioTarget.name} once classification is positive.`
    });
    annotations.push({
      id: "withdrawal_axis",
      label: "Withdrawal Axis",
      kind: "withdrawal",
      point: geometry.withdrawal,
      detail: "After the attack, break away on this axis instead of circling back into the screen."
    });
  }

  if (task === TASK_CATALOG.break_contact_escape) {
    annotations.push({
      id: "withdrawal_axis",
      label: "Withdrawal Axis",
      kind: "withdrawal",
      point: geometry.withdrawal,
      detail: "Use this as a real escape geometry and avoid re-entering the enemy search net."
    });
  }

  const objectiveLine = task === TASK_CATALOG.designated_strike
    ? `Positively identify ${scenarioTarget.name}, attack it, and withdraw before the escorts can localize your firing point.`
    : task.objectiveLine;
  const mapIntent = task === TASK_CATALOG.designated_strike
    ? `Stalk from the marked likely contact area, use the route gate to predict the turn, fire from advantage, then exit along the withdrawal axis.`
    : task.mapIntent;
  const endCondition = task === TASK_CATALOG.designated_strike
    ? `End the mission only after ${scenarioTarget.name} is destroyed or the attack opportunity is lost and you have disengaged cleanly.`
    : task === TASK_CATALOG.break_contact_escape
      ? "End the mission after you have opened distance, cleared the search geometry, and recovered with the boat intact."
      : task.endCondition;

  return {
    primaryTask: {
      key: missionDef.taskType || "classify_trail",
      label: task.label,
      objectiveLine,
      mapIntent,
      endCondition,
      designatedTarget: task === TASK_CATALOG.designated_strike ? scenarioTarget.name : null,
      attackRequired: task === TASK_CATALOG.designated_strike
    },
    missionType,
    missionStance,
    posture: missionStance,
    escalation,
    rulesOfEngagement: roe,
    roe,
    annotations
  };
}

function getRouteVariantSet(template, index, rng) {
  const variants = template.route?.variants;
  if (Array.isArray(variants) && variants.length) {
    const baseVariantIndex = Math.floor(rng() * variants.length);
    const variantIndex = (baseVariantIndex + Math.max(0, index)) % variants.length;
    return {
      ...variants[variantIndex],
      variantIndex,
      variantCount: variants.length
    };
  }
  return {
    ...template.route,
    id: template.route?.id || "default_route",
    label: template.route?.label || `${template.label} Default Route`,
    variantIndex: 0,
    variantCount: 1
  };
}

function getTheaterSectorCatalog(template) {
  const configured = THEATER_FORCE_POOLS[template.id]?.sectors;
  if (Array.isArray(configured) && configured.length) {
    return configured;
  }
  if (Array.isArray(template.route?.variants) && template.route.variants.length) {
    return template.route.variants.map((variant) => ({ id: variant.id, label: variant.label }));
  }
  return [{ id: "main_axis", label: "Main Axis" }];
}

function buildTheaterUnitCatalog(template, playerName) {
  const pools = THEATER_FORCE_POOLS[template.id] || {};
  const catalog = [];

  const addUnit = (unit, tags = [], notes = {}) => {
    if (!unit?.unitId || catalog.some((item) => item.unitId === unit.unitId)) {
      return;
    }
    catalog.push({
      unitId: unit.unitId,
      name: unit.name,
      faction: unit.faction,
      platformType: unit.platformType,
      dbid: unit.dbid,
      ammo: { ...(unit.ammo || {}) },
      tags,
      notes: {
        sectors: Array.isArray(unit.sectors) ? [...unit.sectors] : [],
        theater_role: notes.theater_role || "theater_contact",
        role: unit.role || notes.role || null
      }
    });
  };

  addUnit({
    ...template.player,
    name: playerName
  }, ["player"], { theater_role: "player" });

  template.enemies.forEach((enemy) => {
    addUnit(enemy, ["enemy"], { theater_role: "core_enemy" });
  });

  ["friendlySurface", "friendlyAir", "enemySurface", "enemyAir", "enemySubsurface", "enemySurfaceSupport"].forEach((key) => {
    (pools[key] || []).forEach((unit) => {
      const tags = unit.faction === "US" ? ["friendly_support"] : ["enemy"];
      addUnit(unit, tags, { theater_role: key });
    });
  });

  return catalog;
}

function initializeTheaterPicture(template, unitCatalog, rng, previous = null) {
  const sectors = getTheaterSectorCatalog(template);
  const priorUnits = previous?.units || {};
  const units = {};

  unitCatalog.forEach((unit, index) => {
    const sectorChoices = unit.notes?.sectors?.length ? unit.notes.sectors : sectors.map((sector) => sector.id);
    const fallbackSector = sectorChoices[Math.floor((rng() * sectorChoices.length) || 0)] || sectors[index % sectors.length]?.id || "main_axis";
    const prior = priorUnits[unit.unitId] || {};
    units[unit.unitId] = {
      current_sector: prior.current_sector || fallbackSector,
      availability: prior.availability || "available",
      last_mission_id: prior.last_mission_id || null,
      last_assigned_index: Number.isFinite(prior.last_assigned_index) ? prior.last_assigned_index : -1,
      on_stage: false
    };
  });

  return {
    theater_id: template.id,
    sectors,
    units
  };
}

function pickScenarioSector(template, geometry, index) {
  if (geometry?.routeVariantId) {
    return geometry.routeVariantId;
  }
  const sectors = getTheaterSectorCatalog(template);
  return sectors[index % sectors.length]?.id || sectors[0]?.id || "main_axis";
}

function selectUnitsForMission(pool = [], theaterPicture, scenarioSector, desiredCount, missionIndex) {
  if (!Array.isArray(pool) || !pool.length || desiredCount <= 0) {
    return [];
  }

  const ranked = [...pool].sort((left, right) => {
    const leftTrack = theaterPicture.units[left.unitId] || {};
    const rightTrack = theaterPicture.units[right.unitId] || {};
    const leftSector = leftTrack.current_sector === scenarioSector ? 1 : 0;
    const rightSector = rightTrack.current_sector === scenarioSector ? 1 : 0;
    if (leftSector !== rightSector) {
      return rightSector - leftSector;
    }
    const leftRecent = Number.isFinite(leftTrack.last_assigned_index) ? leftTrack.last_assigned_index : -1;
    const rightRecent = Number.isFinite(rightTrack.last_assigned_index) ? rightTrack.last_assigned_index : -1;
    if (leftRecent !== rightRecent) {
      return leftRecent - rightRecent;
    }
    return left.name.localeCompare(right.name);
  });

  const selected = ranked.slice(0, Math.min(desiredCount, ranked.length)).map((unit) => ({ ...unit }));
  selected.forEach((unit) => {
    theaterPicture.units[unit.unitId] = {
      ...(theaterPicture.units[unit.unitId] || {}),
      current_sector: scenarioSector,
      availability: "committed",
      last_assigned_index: missionIndex,
      on_stage: true
    };
  });
  return selected;
}

function summarizeOffstageUnits(pool = [], selected = []) {
  const selectedIds = new Set(selected.map((unit) => unit.unitId));
  return pool.filter((unit) => !selectedIds.has(unit.unitId)).map((unit) => unit.name);
}

function deconflictTrafficPoints(points = [], anchorPoints = [], minTrafficKm = 6, minAnchorKm = 4) {
  const result = points.map((point) => [...point]);
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (let index = 0; index < result.length; index += 1) {
      let point = result[index];
      for (const anchor of anchorPoints) {
        if (!Array.isArray(anchor)) {
          continue;
        }
        const distanceKm = haversineDistanceKm(point, anchor);
        if (distanceKm < minAnchorKm) {
          point = movePointAwayByKm(point, anchor, minAnchorKm - distanceKm);
          changed = true;
        }
      }
      for (let otherIndex = 0; otherIndex < result.length; otherIndex += 1) {
        if (index === otherIndex) {
          continue;
        }
        const other = result[otherIndex];
        const distanceKm = haversineDistanceKm(point, other);
        if (distanceKm < minTrafficKm) {
          point = movePointAwayByKm(point, other, (minTrafficKm - distanceKm) / 2);
          changed = true;
        }
      }
      result[index] = point;
    }
    if (!changed) {
      break;
    }
  }
  return result;
}

function buildAisMerchantTraffic(family, geometry, density, authoringConstraints = {}, aisSnapshot = null) {
  const contacts = Array.isArray(aisSnapshot?.contacts) ? aisSnapshot.contacts : [];
  if (!contacts.length) {
    return [];
  }
  const playerSpawn = geometry.playerSpawn;
  const maxImportedContacts = Math.max(2, Math.min(8, density + 2));
  const filtered = contacts
    .filter((contact) => Number.isFinite(Number(contact.lat)) && Number.isFinite(Number(contact.lon)))
    .map((contact) => ({
      ...contact,
      point: [Number(contact.lat), Number(contact.lon)],
      distanceKm: haversineDistanceKm(playerSpawn, [Number(contact.lat), Number(contact.lon)])
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, maxImportedContacts);
  if (!filtered.length) {
    return [];
  }
  const anchorPoints = geometryPointKeysForFamily(family)
    .map((key) => geometry[key])
    .filter((point) => Array.isArray(point));
  const adjustedPoints = deconflictTrafficPoints(
    filtered.map((contact) => contact.point),
    anchorPoints,
    8,
    5
  );
  return filtered.map((contact, index) => ({
    id: `ais_${contact.mmsi || index + 1}`,
    mmsi: contact.mmsi || null,
    name: contact.name || `AIS Merchant ${index + 1}`,
    point: adjustedPoints[index],
    source: "aisstream",
    distanceKm: Number(haversineDistanceKm(playerSpawn, adjustedPoints[index]).toFixed(1))
  }));
}

function buildScenarioForces(template, geometry, index, theaterPicture, rng, authoringConstraints = {}, aisSnapshot = null, missionTypeKey = null) {
  const pools = THEATER_FORCE_POOLS[template.id] || {};
  const scenarioSector = pickScenarioSector(template, geometry, index);
  const density = Number(geometry?.density || 1);
  const resolvedMissionType = normalizeMissionTypeKey(missionTypeKey, template.family);
  const aisMerchantTraffic = buildAisMerchantTraffic(template.family, geometry, density, authoringConstraints, aisSnapshot);

  if (template.family === "surface_shadow") {
    const desiredPrimaryCount = resolvedMissionType === "submerged_escort" ? 1 : 2;
    const enemyPrimary = selectUnitsForMission(
      [...(pools.enemySurface || [])],
      theaterPicture,
      scenarioSector,
      desiredPrimaryCount,
      index
    );
    const usedEnemyIds = new Set(enemyPrimary.map((unit) => unit.unitId));
    const barrierCandidates = (pools.enemySurface || []).filter((unit) => !usedEnemyIds.has(unit.unitId));
    const enemySecondary = density >= 2 || resolvedMissionType === "asuw_convoy" || resolvedMissionType === "civilian_defense" || resolvedMissionType === "blockade_relief"
      ? selectUnitsForMission(barrierCandidates, theaterPicture, scenarioSector, resolvedMissionType === "asuw_convoy" ? 2 : 1, index)
      : [];
    const enemyAir = selectUnitsForMission(pools.enemyAir || [], theaterPicture, scenarioSector, 1, index);
    const friendlySurface = selectUnitsForMission(
      pools.friendlySurface || [],
      theaterPicture,
      scenarioSector,
      resolvedMissionType === "submerged_escort" || resolvedMissionType === "blockade_relief" ? 2 : 1,
      index
    );
    const friendlyAir = selectUnitsForMission(pools.friendlyAir || [], theaterPicture, scenarioSector, 1, index);
    const extraMerchantTraffic = resolvedMissionType === "asuw_convoy" || resolvedMissionType === "civilian_defense" || resolvedMissionType === "blockade_relief" ? 3 : 0;
    return {
      sector: scenarioSector,
      missionType: resolvedMissionType,
      friendlySurface,
      friendlyAir,
      enemyPrimary,
      enemySecondary,
      enemyAir,
      ambientMerchantCount: Math.max(3, density + 2 + Math.floor(rng() * 2) + extraMerchantTraffic),
      aisMerchantTraffic,
      ambientBiologicCount: 3 + Math.floor(rng() * 2),
      offstageEnemy: summarizeOffstageUnits([...(pools.enemySurface || []), ...(pools.enemyAir || [])], [...enemyPrimary, ...enemySecondary, ...enemyAir]),
      offstageFriendly: summarizeOffstageUnits([...(pools.friendlySurface || []), ...(pools.friendlyAir || [])], [...friendlySurface, ...friendlyAir])
    };
  }

  const targetPool = (pools.enemySubsurface || []).filter((unit) => unit.role === "target");
  const screenPool = (pools.enemySubsurface || []).filter((unit) => unit.role !== "target");
  const enemyPrimary = [
    ...selectUnitsForMission(targetPool, theaterPicture, scenarioSector, 1, index),
    ...selectUnitsForMission(screenPool, theaterPicture, scenarioSector, 1, index)
  ];
  const enemySurfaceSupport = selectUnitsForMission(
    pools.enemySurfaceSupport || [],
    theaterPicture,
    scenarioSector,
    density >= 3 ? 2 : 1,
    index
  );
  const enemyAir = density >= 2
    ? selectUnitsForMission(pools.enemyAir || [], theaterPicture, scenarioSector, 1, index)
    : [];
  const friendlySurface = selectUnitsForMission(
    pools.friendlySurface || [],
    theaterPicture,
    scenarioSector,
    resolvedMissionType === "submerged_escort" ? 2 : 1,
    index
  );
  const friendlyAir = selectUnitsForMission(pools.friendlyAir || [], theaterPicture, scenarioSector, 1, index);
  return {
    sector: scenarioSector,
    missionType: resolvedMissionType,
    friendlySurface,
    friendlyAir,
    enemyPrimary,
    enemySurfaceSupport,
    enemyAir,
    ambientMerchantCount: Math.max(3, density + 2 + Math.floor(rng() * 2) + (resolvedMissionType === "submerged_escort" ? 1 : 0)),
    aisMerchantTraffic,
    ambientBiologicCount: 4 + Math.floor(rng() * 2),
    offstageEnemy: summarizeOffstageUnits(
      [...(pools.enemySubsurface || []), ...(pools.enemySurfaceSupport || []), ...(pools.enemyAir || [])],
      [...enemyPrimary, ...enemySurfaceSupport, ...enemyAir]
    ),
    offstageFriendly: summarizeOffstageUnits([...(pools.friendlySurface || []), ...(pools.friendlyAir || [])], [...friendlySurface, ...friendlyAir])
  };
}

function applyAuthoringPostureToGeometry(template, family, geometry, postureKey) {
  const posture = AUTHORING_POSTURES[normalizeMissionStanceKey(postureKey)] || AUTHORING_POSTURES.wide_area_search;
  const next = { ...geometry };
  const contactReference = family === "surface_shadow" ? geometry.lead : geometry.yasen;
  const routeGate = family === "surface_shadow" ? geometry.destination : geometry.egress;

  switch (postureKey) {
    case "aggressive_intercept":
      next.playerSpawn = moveToward(geometry.playerSpawn, contactReference, 0.28);
      next.datum = moveToward(geometry.datum, contactReference, 0.18);
      if (geometry.ddg) next.ddg = moveToward(geometry.ddg, routeGate, 0.18);
      if (geometry.ddgScreen) next.ddgScreen = moveToward(geometry.ddgScreen, routeGate, 0.18);
      if (geometry.supportDest) next.supportDest = moveToward(geometry.supportDest, routeGate, 0.2);
      break;
    case "quiet_shadow":
      next.playerSpawn = moveAway(geometry.playerSpawn, contactReference, 0.22);
      next.withdrawal = moveAway(geometry.withdrawal, contactReference, 0.18);
      if (geometry.ddg) next.ddg = moveAway(geometry.ddg, contactReference, 0.12);
      if (geometry.p8) next.p8 = moveAway(geometry.p8, contactReference, 0.08);
      break;
    case "barrier_support":
      next.playerSpawn = moveToward(geometry.playerSpawn, routeGate, 0.12);
      if (geometry.ddg) next.ddg = moveToward(geometry.ddg, routeGate, 0.26);
      if (geometry.ddgScreen) next.ddgScreen = moveToward(geometry.ddgScreen, routeGate, 0.24);
      if (geometry.supportGroup) next.supportGroup = moveToward(geometry.supportGroup, routeGate, 0.18);
      if (geometry.supportDest) next.supportDest = moveToward(geometry.supportDest, routeGate, 0.18);
      break;
    case "wide_area_search":
    default:
      next.playerSpawn = moveAway(geometry.playerSpawn, contactReference, 0.1);
      if (geometry.p8) next.p8 = moveToward(geometry.p8, geometry.center, 0.14);
      break;
  }

  next.missionStance = {
    key: normalizeMissionStanceKey(postureKey),
    label: posture.label,
    cue: posture.cue
  };
  next.routeSummary = family === "surface_shadow"
    ? summarizePath([next.playerSpawn, next.datum, next.lead, next.destination, next.withdrawal])
    : summarizePath([next.playerSpawn, next.datum, next.yasen, next.egress, next.withdrawal]);
  next.enemyTransitSummary = family === "surface_shadow"
    ? summarizePath([next.lead, next.escort, next.barrier, next.destination])
    : summarizePath([next.yasen, next.escort, next.egress]);
  return next;
}

function buildSurfaceShadowGeometry(template, index, count, rng) {
  const enemyBase = template.route.enemyCorridor;
  const playerBase = template.route.playerCorridor;
  const heloBase = template.route.heloCorridor;
  const supportBase = template.route.supportCorridor;
  const scale = 0.04 + (index * 0.015);
  const playerSpawn = jitterPoint(playerBase[Math.min(index, playerBase.length - 1)], rng, scale, scale * 1.2);
  const datum = jitterPoint(enemyBase[1], rng, scale, scale * 1.3);
  const lead = jitterPoint(enemyBase[0], rng, scale, scale * 1.2);
  const escort = jitterPoint(enemyBase[1], rng, scale, scale);
  const barrier = jitterPoint(enemyBase[2], rng, scale, scale);
  const destination = jitterPoint(enemyBase[3], rng, scale, scale * 1.2);
  const helo = jitterPoint(heloBase[Math.min(index, heloBase.length - 1)], rng, scale, scale);
  const ddg = jitterPoint(supportBase[0], rng, scale, scale);
  const ddgDest = jitterPoint(supportBase[1], rng, scale, scale);
  const p8 = jitterPoint([21.08 - (index * 0.05), 123.02 - (index * 0.08)], rng, scale, scale);
  const center = jitterPoint(enemyBase[1], rng, scale, scale);
  const withdrawal = jitterPoint([playerSpawn[0] - 0.08, playerSpawn[1] + 0.28], rng, scale, scale);

  return {
    playerSpawn,
    datum,
    lead,
    escort,
    barrier,
    destination,
    helo,
    ddg,
    ddgDest,
    p8,
    center,
    withdrawal,
    supportStation: ddgDest,
    routeSummary: summarizePath([playerSpawn, datum, lead, destination, withdrawal]),
    enemyTransitSummary: summarizePath([lead, escort, barrier, destination]),
    density: Math.min(1 + index, count)
  };
}

function buildSubHuntGeometry(template, index, count, rng) {
  const routeSet = getRouteVariantSet(template, index, rng);
  const playerBase = routeSet.playerCorridor;
  const enemyBase = routeSet.enemyCorridor;
  const supportBase = routeSet.supportCorridor;
  const airBase = routeSet.airCorridor;
  const scale = 0.05 + (index * 0.02);
  const playerSpawn = jitterPoint(playerBase[Math.min(index, playerBase.length - 1)], rng, scale, scale);
  const datum = jitterPoint(enemyBase[1], rng, scale, scale);
  const yasen = jitterPoint(enemyBase[0], rng, scale, scale);
  const escort = jitterPoint(enemyBase[1], rng, scale, scale);
  const egress = jitterPoint(enemyBase[3], rng, scale, scale);
  const supportGroup = jitterPoint(supportBase[0], rng, scale, scale);
  const supportDest = jitterPoint(supportBase[2], rng, scale, scale);
  const ddg = jitterPoint(supportBase[1] || supportBase[0], rng, scale, scale);
  const ddgScreen = jitterPoint(supportBase[2] || supportBase[1] || supportBase[0], rng, scale, scale);
  const p8 = jitterPoint(airBase[0], rng, scale, scale);
  const center = jitterPoint(enemyBase[2], rng, scale, scale);
  const withdrawal = jitterPoint([playerSpawn[0], playerSpawn[1] - 1.35], rng, scale, scale);

  return {
    routeVariantId: routeSet.id,
    routeVariantLabel: routeSet.label,
    playerSpawn,
    datum,
    yasen,
    escort,
    egress,
    supportGroup,
    supportDest,
    ddg,
    ddgScreen,
    p8,
    center,
    withdrawal,
    routeSummary: summarizePath([playerSpawn, datum, yasen, egress, withdrawal]),
    enemyTransitSummary: summarizePath([yasen, escort, egress]),
    density: Math.min(1 + index, count)
  };
}

function buildScenarioRecord(
  template,
  campaignId,
  missionDef,
  index,
  count,
  year,
  rng,
  theaterPicture,
  postureKey = "wide_area_search",
  authoringConstraints = {},
  slotNumber = index + 1,
  reserved = false,
  aisSnapshot = null,
  options = {}
) {
  const startBase = template.id === "luzon_strait"
    ? `${year}-04-02T04:20:00Z`
    : `${year}-03-14T02:30:00Z`;
  const startTime = plusHours(startBase, index * 18);
  const rawGeometry = template.family === "surface_shadow"
    ? buildSurfaceShadowGeometry(template, index, count, rng)
    : buildSubHuntGeometry(template, index, count, rng);
  const normalizedMissionStance = normalizeMissionStanceKey(postureKey);
  const experimental = options?.experimental || { enabled: false, plotSeed: "none" };
  const resolvedMissionType = normalizeMissionTypeKey(options?.missionTypeKey, template.family, experimental);
  const commandAuthority = commandAuthorityForTheater(template.id);
  const escalationKey = deriveInitialEscalationKey(options?.campaignClimateKey || "surveillance", index);
  const roeKey = deriveRoeKey({
    requestedRoe: options?.requestedRoeKey || null,
    climateKey: options?.campaignClimateKey || "surveillance",
    escalationKey,
    taskType: missionDef.taskType
  });
  const postureGeometry = applyAuthoringPostureToGeometry(template, template.family, rawGeometry, normalizedMissionStance);
  const geometry = finalizeScenarioGeometry(template.id, template.family, postureGeometry, rng, authoringConstraints);
  const forces = buildScenarioForces(template, geometry, index, theaterPicture, rng, authoringConstraints, aisSnapshot, resolvedMissionType);
  const intel = buildScenarioIntel(template, geometry, forces, index, rng, normalizedMissionStance);
  const tasking = buildScenarioAnnotations(template, geometry, forces, missionDef, normalizedMissionStance, intel, {
    escalationKey,
    roeKey,
    missionTypeKey: resolvedMissionType
  });
  const plotSeedOverlay = buildPlotSeedOverlay(experimental);
  const slug = scenarioSlotSlug(slotNumber);
  const missionKey = `${campaignId}.${campaignId}.${slug}`;
  const summary = reserved
    ? "Reserved follow-on mission slot. Update the previous mission result in Campaign Tracking before playing this scenario."
    : plotSeedOverlay?.summaryPrefix
      ? `${plotSeedOverlay.summaryPrefix} ${missionDef.summary}`
      : missionDef.summary;
  const cue = reserved
    ? "This mission slot exists so the campaign chain always has a valid next mission available inside MNW."
    : plotSeedOverlay?.cuePrefix
      ? `${plotSeedOverlay.cuePrefix} ${missionDef.cue}`
      : missionDef.cue;
  const description = reserved
    ? `${summary} This placeholder exists so MNW always has a valid next mission, but its content is intended to be rewritten before play.`
    : `${summary} ${cue} Escalation: ${tasking.escalation.label}. ROE: ${tasking.rulesOfEngagement.label}. Task: ${tasking.primaryTask.objectiveLine} ${plotSeedOverlay?.commandIntent ? `Command intent: ${plotSeedOverlay.commandIntent} ` : ""}Intel cue: ${intel.prose}`;
  const objectiveText = reserved
    ? "This is a reserved follow-on mission slot. If you want to continue the campaign, return to Campaign Tracking, save the result from the previous mission, and use Continue Campaign to regenerate this scenario before play. If you do not want to continue, treat the previous mission as the campaign conclusion."
    : `${plotSeedOverlay?.commandIntent ? `${plotSeedOverlay.commandIntent} ` : ""}${tasking.primaryTask.objectiveLine} ${tasking.rulesOfEngagement.briefingLine} ${tasking.primaryTask.mapIntent} ${tasking.primaryTask.endCondition} ${intel.prose}`;
  const successText = reserved
    ? `Scenario ${slotNumber} placeholder completed.`
    : tasking.primaryTask.attackRequired
      ? `${tasking.primaryTask.designatedTarget} was struck and the boat cleared the retaliation envelope. ${commandAuthority} can now build the next move around your attack report.`
      : `${missionDef.name} is complete. ${commandAuthority} has the updated route picture and can shape the next operation from your report.`;

  return {
    slug,
    missionId: missionKey,
    name: `Scenario ${slotNumber}`,
    summary,
    cue,
    slotNumber,
    archetypeSlug: missionDef.slug,
    index,
    family: template.family,
    startIso: startTime.iso,
    startMnw: startTime.mnw,
    geometry,
    forces,
    intel,
    tasking,
    description,
    objectiveText,
    successText,
    reserved,
    campaignClimate: options?.campaignClimateKey || "surveillance",
    missionType: resolvedMissionType,
    missionStance: normalizedMissionStance,
    experimental: {
      enabled: experimental.enabled,
      plotSeed: experimental.plotSeed,
      plotSeedLabel: plotSeedOverlay?.label || null
    },
    escalationKey,
    escalationLevel: tasking.escalation.level,
    roeKey,
    continuation: {
      reserved,
      escalationKey,
      roeKey
    }
  };
}

export function getTheaterTemplates() {
  return THEATER_TEMPLATES;
}

export function getToneCatalog() {
  return TONE_CATALOG;
}

export function getCampaignClimateCatalog() {
  return CAMPAIGN_CLIMATE_CATALOG;
}

export function getAuthoringPostureCatalog() {
  return AUTHORING_POSTURES;
}

export function getMissionStanceCatalog() {
  return MISSION_STANCE_CATALOG;
}

export function getMissionTypeCatalog() {
  return MISSION_TYPE_CATALOG;
}

export function getExperimentalPlotSeedCatalog() {
  return EXPERIMENTAL_PLOT_SEED_CATALOG;
}

export function getRoeCatalog() {
  return ROE_CATALOG;
}

export function getEscalationCatalog() {
  return ESCALATION_CATALOG;
}

export function getTheaterCommandAuthority(theaterId) {
  return commandAuthorityForTheater(theaterId);
}

export function findTheaterTemplateByName(name) {
  return Object.values(THEATER_TEMPLATES).find((template) => template.theaterName === name || template.label === name) || null;
}

export function getContinuationChoiceCatalog() {
  return {
    objectives: CONTINUATION_OBJECTIVES,
    riskPostures: RISK_POSTURES,
    operationalTempos: OPERATIONAL_TEMPOS
  };
}

export function buildContinuationScenario({
  campaignId,
  theaterId,
  year,
  playerName,
  missionIndex = 0,
  slotNumber = missionIndex + 1,
  slugOverride = null,
  referenceIso,
  objective = "pursue_contact",
  riskPosture = "balanced",
  operationalTempo = "deliberate",
  priorMissionCount = 0,
  lastOutcome = "success",
  theaterPicture: previousTheaterPicture = null,
  posture = "wide_area_search",
  missionStance = null,
  missionType = null,
  campaignClimate = "surveillance",
  currentEscalation = null,
  requestedRoe = null,
  authoringConstraints = {},
  reserved = false,
  aisSnapshot = null,
  experimental = { enabled: false, plotSeed: "none" }
} = {}) {
  const theater = THEATER_TEMPLATES[theaterId] || THEATER_TEMPLATES.luzon_strait;
  const family = theater.family;
  const commandAuthority = commandAuthorityForTheater(theater.id);
  const objectiveDef = CONTINUATION_OBJECTIVES[objective] || CONTINUATION_OBJECTIVES.pursue_contact;
  const riskDef = RISK_POSTURES[riskPosture] || RISK_POSTURES.balanced;
  const tempoDef = OPERATIONAL_TEMPOS[operationalTempo] || OPERATIONAL_TEMPOS.deliberate;
  const ordinal = slotNumber;
  const slug = slugOverride || scenarioSlotSlug(slotNumber);
  const startIso = plusHours(referenceIso || `${year}-01-01T00:00:00Z`, tempoDef.advanceHours).iso;
  const rng = mulberry32(hashSeed([
    campaignId,
    theater.id,
    objective,
    riskPosture,
    operationalTempo,
    startIso,
    playerName,
    priorMissionCount,
    lastOutcome
  ].join(":")));
  const densityCount = Math.max(4, priorMissionCount + 2);
  const theaterCatalog = buildTheaterUnitCatalog(theater, playerName);
  const theaterPicture = initializeTheaterPicture(theater, theaterCatalog, rng, previousTheaterPicture);
  const rawGeometry = family === "surface_shadow"
    ? buildSurfaceShadowGeometry(theater, missionIndex, densityCount, rng)
    : buildSubHuntGeometry(theater, missionIndex, densityCount, rng);
  const normalizedMissionStance = normalizeMissionStanceKey(missionStance || posture);
  const resolvedMissionType = normalizeMissionTypeKey(missionType, family, experimental);
  const escalationKey = deriveContinuationEscalationKey(
    normalizeEscalationKey(currentEscalation, deriveInitialEscalationKey(campaignClimate, missionIndex)),
    lastOutcome,
    objective,
    riskPosture
  );
  const postureGeometry = applyAuthoringPostureToGeometry(theater, family, rawGeometry, normalizedMissionStance);
  const normalizedAuthoringConstraints = normalizeAuthoringConstraints({ authoringConstraints });
  const geometry = finalizeScenarioGeometry(theater.id, family, postureGeometry, rng, normalizedAuthoringConstraints);
  const forces = buildScenarioForces(theater, geometry, missionIndex, theaterPicture, rng, normalizedAuthoringConstraints, aisSnapshot, resolvedMissionType);
  let derivedTaskType = "reacquire_contact";
  if (objective === "break_contact") {
    derivedTaskType = "break_contact_escape";
  } else if (objective === "intercept_route" && escalationLevelForKey(escalationKey) >= 2) {
    derivedTaskType = "designated_strike";
  } else if (objective === "defend_chokepoint" && escalationLevelForKey(escalationKey) >= 3) {
    derivedTaskType = "designated_strike";
  } else if (objective === "defend_chokepoint") {
    derivedTaskType = "hold_barrier";
  } else if (objective === "intercept_route") {
    derivedTaskType = "intercept_gate";
  } else if (objective === "shadow_safely") {
    derivedTaskType = "classify_trail";
  }
  const continuationMissionDef = {
    taskType: derivedTaskType
  };
  const roeKey = deriveRoeKey({
    requestedRoe,
    climateKey: campaignClimate,
    escalationKey,
    taskType: derivedTaskType
  });
  const intel = buildScenarioIntel(theater, geometry, forces, missionIndex, rng, normalizedMissionStance);
  const tasking = buildScenarioAnnotations(theater, geometry, forces, continuationMissionDef, normalizedMissionStance, intel, {
    escalationKey,
    roeKey,
    missionTypeKey: resolvedMissionType
  });
  const plotSeedOverlay = buildPlotSeedOverlay(experimental);
  const outcomeLine = lastOutcome === "failure"
    ? "The previous mission ended badly, so the next operation is framed around regaining control without losing the boat."
    : lastOutcome === "partial_success"
      ? "The previous mission produced useful contact data, but the enemy still has room to maneuver."
      : "The previous mission produced enough tactical clarity to drive a purposeful follow-on operation.";
  const name = `Scenario ${slotNumber}`;
  const summary = reserved
    ? "Reserved follow-on mission slot. Update the previous mission result in Campaign Tracking before playing this scenario."
    : plotSeedOverlay?.summaryPrefix
      ? `${plotSeedOverlay.summaryPrefix} ${objectiveDef.summaries[family] || objectiveDef.summaries.surface_shadow}`
      : (objectiveDef.summaries[family] || objectiveDef.summaries.surface_shadow);
  const cue = reserved
    ? "This mission slot exists so the campaign chain always has a valid next mission available inside MNW."
    : `${plotSeedOverlay?.cuePrefix ? `${plotSeedOverlay.cuePrefix} ` : ""}${riskDef.cue} ${outcomeLine}`;
  const description = reserved
    ? `${summary} This placeholder exists so MNW always has a valid next mission, but its content is intended to be rewritten before play.`
    : `${summary} ${cue} Escalation: ${tasking.escalation.label}. ROE: ${tasking.rulesOfEngagement.label}. Task: ${tasking.primaryTask.objectiveLine} ${plotSeedOverlay?.commandIntent ? `Command intent: ${plotSeedOverlay.commandIntent} ` : ""}Intel cue: ${intel.prose}`;
  const missionId = `${campaignId}.${campaignId}.${slug}`;
  const objectiveText = reserved
    ? "This is a reserved follow-on mission slot. If you want to continue the campaign, return to Campaign Tracking, save the result from the previous mission, and use Continue Campaign to regenerate this scenario before play. If you do not want to continue, treat the previous mission as the campaign conclusion."
    : family === "surface_shadow"
      ? `${plotSeedOverlay?.commandIntent ? `${plotSeedOverlay.commandIntent} ` : ""}${tasking.primaryTask.objectiveLine} ${tasking.rulesOfEngagement.briefingLine} ${tasking.primaryTask.mapIntent} ${tasking.primaryTask.endCondition} Keep your submarine combat effective and recover when ready. ${intel.prose}`
      : `${plotSeedOverlay?.commandIntent ? `${plotSeedOverlay.commandIntent} ` : ""}${tasking.primaryTask.objectiveLine} ${tasking.rulesOfEngagement.briefingLine} ${tasking.primaryTask.mapIntent} ${tasking.primaryTask.endCondition} Keep your submarine combat effective and recover when ready. ${intel.prose}`;
  const successText = reserved
    ? `${name} placeholder completed.`
    : tasking.primaryTask.attackRequired
      ? `${tasking.primaryTask.designatedTarget} was destroyed and the boat disengaged. ${commandAuthority} can now exploit the strike results in the next cycle.`
      : `${name} is complete. ${commandAuthority} can roll your updated track, damage, and readiness picture into the next decision cycle.`;

  return {
    slug,
    missionId,
    name,
    summary,
    cue,
    slotNumber,
    index: missionIndex,
    family,
    startIso,
    startMnw: formatMnwFromIso(startIso),
    geometry,
    forces,
    intel,
    tasking,
    description,
    objectiveText,
    successText,
    reserved,
    theaterPicture,
    campaignClimate,
    missionType: resolvedMissionType,
    missionStance: normalizedMissionStance,
    experimental: {
      enabled: experimental.enabled,
      plotSeed: experimental.plotSeed,
      plotSeedLabel: plotSeedOverlay?.label || null
    },
    escalationKey,
    escalationLevel: tasking.escalation.level,
    roeKey,
    continuation: {
      objective,
      objectiveLabel: objectiveDef.label,
      riskPosture,
      riskLabel: riskDef.label,
      operationalTempo,
      tempoLabel: tempoDef.label,
      advanceHours: tempoDef.advanceHours,
      posture: normalizedMissionStance,
      postureLabel: (AUTHORING_POSTURES[normalizedMissionStance] || AUTHORING_POSTURES.wide_area_search).label,
      campaignClimate,
      missionType: resolvedMissionType,
      missionTypeLabel: (MISSION_TYPE_CATALOG[resolvedMissionType] || MISSION_TYPE_CATALOG[defaultMissionTypeForFamily(family)]).label,
      experimentalEnabled: experimental.enabled,
      plotSeed: experimental.plotSeed,
      plotSeedLabel: plotSeedOverlay?.label || null,
      escalationKey,
      escalationLabel: tasking.escalation.label,
      roeKey,
      roeLabel: tasking.rulesOfEngagement.label,
      reserved
    }
  };
}

export function buildCampaignBlueprint(spec = {}) {
  const campaignId = sanitizeCampaignId(spec.campaignId || spec.title);
  const theater = THEATER_TEMPLATES[spec.theater] || THEATER_TEMPLATES.luzon_strait;
  const scenarioCount = clampScenarioCount(spec.scenarioCount);
  const title = String(spec.title || theater.label).trim() || "Generated Campaign";
  const tone = normalizeCampaignClimateKey(spec.campaignClimate || spec.tone);
  const year = Number(spec.year || theater.defaultYear || 2028);
  const playerName = String(spec.playerName || theater.player.name).trim() || theater.player.name;
  const posture = normalizeMissionStanceKey(spec.missionStance || spec.posture);
  const experimental = normalizeExperimentalSettings(spec);
  const missionTypeSupport = resolveMissionTypeSupport(spec.missionType, theater.family, experimental);
  const missionType = missionTypeSupport.resolvedKey;
  const requestedRoe = normalizeRoeKey(spec.rulesOfEngagement || spec.roe || CAMPAIGN_CLIMATE_CATALOG[tone].defaultRoe);
  const authoringConstraints = normalizeAuthoringConstraints(spec);
  const warnings = missionTypeSupport.warning ? [missionTypeSupport.warning] : [];
  const seed = hashSeed(`${campaignId}:${theater.id}:${tone}:${posture}:${missionType}:${requestedRoe}:${year}:${scenarioCount}:${playerName}`);
  const rng = mulberry32(seed);
  const archetypes = pickArchetypes(tone, scenarioCount);
  const theaterUnits = buildTheaterUnitCatalog(theater, playerName);
  const theaterPicture = initializeTheaterPicture(theater, theaterUnits, rng);
  const scenarios = archetypes.map((missionDef, index) => {
    const reserved = index === scenarioCount - 1;
    return buildScenarioRecord(
      theater,
      campaignId,
      missionDef,
      index,
      scenarioCount,
      year,
      rng,
      theaterPicture,
      posture,
      authoringConstraints,
      index + 1,
      reserved,
      spec.aisSnapshot || null,
      {
        campaignClimateKey: tone,
        requestedRoeKey: requestedRoe,
        missionTypeKey: missionType,
        experimental
      }
    );
  });

  return {
    seed,
    campaignId,
    title,
    theaterId: theater.id,
    theaterLabel: theater.label,
    theaterName: theater.theaterName,
    description: spec.description || `${title} is a ${TONE_CATALOG[tone].label.toLowerCase()} campaign set in the ${theater.theaterName}.`,
    campaignClimate: tone,
    campaignClimateLabel: TONE_CATALOG[tone].label,
    missionType,
    missionTypeLabel: MISSION_TYPE_CATALOG[missionType].label,
    missionTypeSupport: missionTypeSupport.support,
    requestedMissionType: missionTypeSupport.requestedKey,
    experimentalFeatures: {
      enabled: experimental.enabled,
      plotSeed: experimental.plotSeed,
      plotSeedLabel: experimentalPlotSeedDefinition(experimental.plotSeed).label
    },
    tone,
    toneLabel: TONE_CATALOG[tone].label,
    missionStance: posture,
    missionStanceLabel: AUTHORING_POSTURES[posture].label,
    posture,
    postureLabel: AUTHORING_POSTURES[posture].label,
    requestedRoe,
    requestedRoeLabel: ROE_CATALOG[requestedRoe].label,
    rulesOfEngagement: requestedRoe,
    rulesOfEngagementLabel: ROE_CATALOG[requestedRoe].label,
    authoringConstraints,
    year,
    family: theater.family,
    player: {
      ...theater.player,
      name: playerName
    },
    enemies: theater.enemies.map((enemy) => ({ ...enemy })),
    theaterUnits,
    theaterPicture,
    scenarios,
    warnings,
    packageNamespace: `${campaignId}.${campaignId}`
  };
}
