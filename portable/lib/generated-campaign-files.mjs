import fs from "node:fs/promises";
import path from "node:path";

import { buildCampaignBlueprint } from "../../shared/campaign-generator.mjs";
function toBase64Utf8(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function missionMetadataRecord(name, description, objectiveText, messages) {
  return {
    name: { de: "", el: "", en: toBase64Utf8(name), es: "", fr: "", pl: "", ro: "", ru: "", zh: "" },
    description: { de: "", el: "", en: toBase64Utf8(description), es: "", fr: "", pl: "", ro: "", ru: "", zh: "" },
    objectives: {
      primary_withdraw_intact: {
        de: "",
        el: "",
        en: toBase64Utf8(objectiveText),
        es: "",
        fr: "",
        pl: "",
        ro: "",
        ru: "",
        zh: ""
      }
    },
    messages: Object.fromEntries(
      Object.entries(messages).map(([key, value]) => [
        key,
        { de: "", el: "", en: toBase64Utf8(value), es: "", fr: "", pl: "", ro: "", ru: "", zh: "" }
      ])
    )
  };
}

function campaignMetadataRecord(name, description) {
  return {
    name: { de: "", el: "", en: toBase64Utf8(name), es: "", fr: "", pl: "", ro: "", ru: "", zh: "" },
    description: { de: "", el: "", en: toBase64Utf8(description), es: "", fr: "", pl: "", ro: "", ru: "", zh: "" }
  };
}

function formatGc([lat, lon]) {
  return `GC(${lat.toFixed(6)}, ${lon.toFixed(6)})`;
}

const GENERIC_CARGO_IDS = [
  99992101, 99992105, 99992106, 99992107, 99992108,
  99992109, 99992110, 99992111, 99992201, 99992202,
  99992203, 99992204, 99992205, 99992206, 99992207,
  99992208, 99992209, 99992210, 99992211, 99992301,
  99992302, 99992303, 99992304, 99992305, 99992306,
  99992307, 99992308, 99992309, 99992310, 99992311,
  99992312, 99992313, 99992314, 99992315, 99992401
];

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function offsetPointByKm([lat, lon], angleRadians, distanceKm) {
  const kmPerLat = 111;
  const kmPerLon = Math.max(1, 111 * Math.cos(lat * (Math.PI / 180)));
  return [
    Number((lat + ((Math.sin(angleRadians) * distanceKm) / kmPerLat)).toFixed(6)),
    Number((lon + ((Math.cos(angleRadians) * distanceKm) / kmPerLon)).toFixed(6))
  ];
}

function buildDeconflictedPositions({ center, count, radiusKm, minSpacingKm, seedKey, existingPoints = [] }) {
  if (!Array.isArray(center) || count <= 0) {
    return [];
  }
  const rng = mulberry32(hashSeed(seedKey));
  const positions = [...existingPoints];
  const generated = [];
  const attemptsLimit = Math.max(24, count * 40);
  for (let attempt = 0; attempt < attemptsLimit && generated.length < count; attempt += 1) {
    const angle = rng() * Math.PI * 2;
    const distanceKm = radiusKm * (0.3 + (rng() * 0.7));
    const candidate = offsetPointByKm(center, angle, distanceKm);
    if (positions.every((existing) => haversineDistanceKm(existing, candidate) >= minSpacingKm)) {
      positions.push(candidate);
      generated.push(candidate);
    }
  }
  while (generated.length < count) {
    const angle = (Math.PI * 2 * generated.length) / Math.max(1, count);
    const ringDistanceKm = Math.min(radiusKm, Math.max(minSpacingKm, radiusKm * 0.65));
    const candidate = offsetPointByKm(center, angle, ringDistanceKm);
    positions.push(candidate);
    generated.push(candidate);
  }
  return generated;
}

function pickGenericCargoDbid(seedKey) {
  return GENERIC_CARGO_IDS[hashSeed(seedKey) % GENERIC_CARGO_IDS.length];
}

function buildAnnotationPoiList(annotations = []) {
  return annotations
    .slice(0, 4)
    .map((annotation, index) => {
      const variable = `annotation_poi_${index}`;
      return `${variable} = PointOfInterest("${annotation.label}", Waypoint(${formatGc(annotation.point)}))`;
    })
    .join("\n");
}

function buildAnnotationPoiAttachList(annotations = []) {
  const variables = annotations.slice(0, 4).map((_, index) => `annotation_poi_${index}`);
  return variables.length ? `, ${variables.join(", ")}` : "";
}

function buildAnnotationBriefLines(annotations = []) {
  return annotations
    .slice(0, 4)
    .map((annotation, index) => `${index + 1}. ${annotation.label}: ${annotation.detail}`)
    .join("\n");
}

function factionRuntimeId(faction) {
  if (faction === "RU") {
    return 183;
  }
  if (faction === "CN") {
    return 46;
  }
  return 236;
}

function buildSurfaceMissionScript(blueprint, scenario) {
  const g = scenario.geometry;
  const additionalBarrier = scenario.index >= 1;
  const annotationPoiLines = buildAnnotationPoiList(scenario.tasking?.annotations || []);
  const annotationPoiAttachList = buildAnnotationPoiAttachList(scenario.tasking?.annotations || []);
  const biologicPositions = buildDeconflictedPositions({
    center: g.center,
    count: 3,
    radiusKm: 85,
    minSpacingKm: 12,
    seedKey: `${scenario.missionId}:surface:biologics`
  });
  const aisMerchantTraffic = Array.isArray(scenario.forces?.aisMerchantTraffic) ? scenario.forces.aisMerchantTraffic : [];
  const syntheticMerchantCount = Math.max(0, (scenario.forces?.ambientMerchantCount ?? Math.max(2, scenario.geometry.density + 1)) - aisMerchantTraffic.length);
  const merchantPositions = buildDeconflictedPositions({
    center: g.center,
    count: syntheticMerchantCount,
    radiusKm: 100,
    minSpacingKm: 18,
    seedKey: `${scenario.missionId}:surface:merchants`,
    existingPoints: aisMerchantTraffic.map((contact) => contact.point)
  });
  const biologicBlock = biologicPositions.map((point, idx) => `bio_props = Element.Props.FromDatabaseID(civ_fact, "Biologic ${idx}", ElementCategory.Biologic, 1, ${formatGc(point)})
bio_element = Element(bio_props).SetElevation(${-60 - (idx * 40)}).SetHeading(random.randrange(0, 359))
_P.Element.Spawn(player_spawn_process, bio_element, bio_element.Position)`).join("\n");
  const aisMerchantBlock = aisMerchantTraffic.map((contact, idx) => `cargo_props = Element.Props.FromDatabaseID(civ_fact, "${String(contact.name || `AIS Merchant ${idx + 1}`).replaceAll("\"", "")}", ElementCategory.Ship, ${pickGenericCargoDbid(contact.mmsi || contact.id || `${scenario.missionId}:ais:${idx}`)}, ${formatGc(contact.point)})
cargo_element = Element(cargo_props).SetHeading(random.randrange(180, 280))
_P.Element.Spawn(player_spawn_process, cargo_element, cargo_element.Position)`).join("\n");
  const merchantBlock = merchantPositions.map((point, idx) => `cargo_props = Element.Props.FromDatabaseID(civ_fact, "Merchant ${aisMerchantTraffic.length + idx + 1}", ElementCategory.Ship, _get_random_cargo(), ${formatGc(point)})
cargo_element = Element(cargo_props).SetHeading(random.randrange(180, 280))
_P.Element.Spawn(player_spawn_process, cargo_element, cargo_element.Position)`).join("\n");
  return `import random

##
# Globals
##
_debug_mode = False
_version = "0.0.0"
_msv = "0.113.1"
_author = "MNW Desktop Wizard"
_operation_type = OperationType.ASuW
_date_time = "${scenario.startMnw}"
_weather = EnvTools.GetRandomWeatherParameters()

civ_fact = 0
us_fact = 236
ch_fact = 46

virginia_id = 1015
arleigh_id = 294
p8_id = 2705
t054a_id = 1965
t055_id = 3883
harbin_id = 60

cargo_ids = [
99992101, 99992105, 99992106, 99992107, 99992108,
99992109, 99992110, 99992111, 99992201, 99992202,
99992203, 99992204, 99992205, 99992206, 99992207,
99992208, 99992209, 99992210, 99992211, 99992301,
99992302, 99992303, 99992304, 99992305, 99992306,
99992307, 99992308, 99992309, 99992310, 99992311,
99992312, 99992313, 99992314, 99992315, 99992401
]

def _get_random_cargo():
    return cargo_ids[random.randrange(0, len(cargo_ids))]

player_spawn_pos = ${formatGc(g.playerSpawn)}
datum_pos = ${formatGc(g.datum)}
lead_pos = ${formatGc(g.lead)}
escort_pos = ${formatGc(g.escort)}
barrier_pos = ${formatGc(g.barrier)}
enemy_dest = ${formatGc(g.destination)}
helo_patrol_pos = ${formatGc(g.helo)}
friendly_ddg_pos = ${formatGc(g.ddg)}
friendly_ddg_dest = ${formatGc(g.ddgDest)}
p8_spawn_pos = ${formatGc(g.p8)}
battle_area_center = ${formatGc(g.center)}
withdrawal_poi_pos = ${formatGc(g.withdrawal)}

_diplomacy.AddFactions([civ_fact, us_fact, ch_fact])
_diplomacy.SetTensionLevel(TensionLevel.Increased).SetMissionROE(RulesOfEngagement.Free)
_diplomacy.SetStatus(civ_fact).SetStatus(us_fact).SetStatus(ch_fact, CoalitionStatus.Enemy)

objectives = [
    Obj(_objectives["primary_withdraw_intact"], True).SetStatus(ObjectiveStatus.InProgress),
]

player_spawn_zone = _Z.Circular("Player Spawn Zone", player_spawn_pos, 1000)
player_props = Element.Props.FromElementID(us_fact, "(Player) Virginia B3", ElementCategory.Submarine, virginia_id, player_spawn_pos)
player_element = Element(player_props).SetElevation(-145).SetHeading(275).SetPlayable().SetScope(Global.Scope.Player)
player_spawn_process = _P.Element.Spawn(_mission_started, player_element, player_element.Position)

player_mk48_arsenal_process = _P.Element.Arsenal(player_spawn_process, player_element, BaseCategory.Subsurface, ElementCategory.Torpedo, 1712, 12)
player_mk3_arsenal_process = _P.Element.Arsenal(player_mk48_arsenal_process, player_element, BaseCategory.Subsurface, ElementCategory.Expendable, 126, 12)
player_mk4_arsenal_process = _P.Element.Arsenal(player_mk3_arsenal_process, player_element, BaseCategory.Subsurface, ElementCategory.Expendable, 2458, 12)

preloads = []
for i in range(4):
    preloads.append(ArsenalPacket(BaseCategory.Subsurface, ElementCategory.Torpedo, 1712))
for j in range(14):
    if j <= 7:
        preloads.append(ArsenalPacket(BaseCategory.Subsurface, ElementCategory.Expendable, 126))
    else:
        preloads.append(ArsenalPacket(BaseCategory.Subsurface, ElementCategory.Expendable, 2458))
player_preload_process = _P.Element.PreloadArsenal(player_mk4_arsenal_process, player_element, preloads)

messageModel = MessageModel(
    EMFTools.Protocol.Link_16,
    EMFTools.MicroWaveBands.UHF,
    _date_time,
    MessagePriority.High,
    _messages["mission_from"],
    _messages["mission_to"],
    "TASKING ORDER",
    _messages["mission_objectives"]
)
datum_poi = PointOfInterest("Enemy Datum", Waypoint(datum_pos))
support_poi = PointOfInterest("Support Station", Waypoint(friendly_ddg_dest))
withdrawal_poi = PointOfInterest("Withdrawal Box", Waypoint(withdrawal_poi_pos))
${annotationPoiLines}
messageModel.AttachPOIs([datum_poi, support_poi, withdrawal_poi${annotationPoiAttachList}])
message_process = _P.Message(player_spawn_process, messageModel)

sat_spawn_zone = _Z.Circular("Sat Spawn Zone", player_spawn_pos, 10000)
sat_props = Element.Props.FromDatabaseID(us_fact, "MUOS", ElementCategory.SpaceElement, 1, sat_spawn_zone.RandomPosition())
sat_element = Element(sat_props).SetElevation(500)
sat_spawn_process = _P.Element.Spawn(player_spawn_process, sat_element, sat_element.Position)
transmission = Transmission.Create(EMFTools.Protocol.Link_16, _date_time, 60, 10, 500, EMFTools.MicroWaveBands.UHF)
transmission_process = _P.Element.Radio(sat_spawn_process, sat_element, transmission)

friendly_ddg_props = Element.Props.FromDatabaseID(us_fact, "USS Spruance", ElementCategory.Ship, arleigh_id, friendly_ddg_pos)
friendly_ddg = Element(friendly_ddg_props).SetElevation(0).SetHeading(310).SetHVU(True)
friendly_ddg_spawn = _P.Element.Spawn(player_spawn_process, friendly_ddg, friendly_ddg.Position)
friendly_ddg_plot = _P.Element.Plot(friendly_ddg_spawn, friendly_ddg, Waypoint(friendly_ddg_dest))

p8_props = Element.Props.FromDatabaseID(us_fact, "P-8A Poseidon", ElementCategory.Aircraft, p8_id, p8_spawn_pos)
p8_element = Element(p8_props).SetElevation(5200).SetHeading(255)
p8_spawn = _P.Element.Spawn(friendly_ddg_plot, p8_element, p8_element.Position)
p8_plot = _P.Element.Plot(p8_spawn, p8_element, Waypoint(${formatGc(g.datum)}))

${biologicBlock}

${aisMerchantBlock}

${merchantBlock}

t055_props = Element.Props.FromDatabaseID(ch_fact, "PLAN Lead DDG", ElementCategory.Ship, t055_id, lead_pos)
t055_element = Element(t055_props).SetElevation(0).SetHeading(150).SetHVU(True)
t055_spawn = _P.Element.Spawn(player_spawn_process, t055_element, t055_element.Position)
t055_plot = _P.Element.Plot(t055_spawn, t055_element, Waypoint(enemy_dest))

t054a_props = Element.Props.FromDatabaseID(ch_fact, "PLAN Escort FFG", ElementCategory.Ship, t054a_id, escort_pos)
t054a_element = Element(t054a_props).SetElevation(0).SetHeading(150).SetHVU(True)
t054a_spawn = _P.Element.Spawn(t055_plot, t054a_element, t054a_element.Position)
t054a_plot = _P.Element.Plot(t054a_spawn, t054a_element, Waypoint(${formatGc(g.destination)}))

${additionalBarrier ? `barrier_props = Element.Props.FromDatabaseID(ch_fact, "PLAN Barrier FFG", ElementCategory.Ship, t054a_id, barrier_pos)
barrier_element = Element(barrier_props).SetElevation(0).SetHeading(205)
barrier_spawn = _P.Element.Spawn(t054a_plot, barrier_element, barrier_element.Position)
barrier_plot = _P.Element.Plot(barrier_spawn, barrier_element, Waypoint(${formatGc(g.withdrawal)}))
` : `barrier_plot = t054a_plot
`}
harbin_props = Element.Props.FromDatabaseID(ch_fact, "PLAN Z-9 Screen", ElementCategory.Aircraft, harbin_id, helo_patrol_pos)
harbin_element = Element(harbin_props).SetElevation(950).SetHeading(190).SetHVU(True)
harbin_spawn = _P.Element.Spawn(barrier_plot, harbin_element, harbin_element.Position)
harbin_plot = _P.Element.Plot(harbin_spawn, harbin_element, Waypoint(${formatGc(g.barrier)}))

withdrawal_antenna_trigger = _T.AntennasRaised(True)
player_element.NotifyOnAntennaRaised(withdrawal_antenna_trigger)
withdrawal_complete = _P.Objective.Status(withdrawal_antenna_trigger, objectives[0], ObjectiveStatus.Completed)

player_death_trigger = _T.Manual()
player_nop_trigger = _T.NonOperational()
player_element.NotifyUponDeath(player_death_trigger)
player_element.NotifyNonOperational(player_nop_trigger)
player_lost = _T.Or([player_death_trigger, player_nop_trigger])
player_fail = _P.Objective.Status(player_lost, objectives[0], ObjectiveStatus.Failed)

out_trigger = _T.Objective(objectives)
end_trigger = _T.Manual()
outcome = Out(out_trigger, end_trigger, us_fact)

end_message_model = MessageModel(
    EMFTools.Protocol.Link_16,
    EMFTools.MicroWaveBands.UHF,
    _date_time,
    MessagePriority.High,
    _messages["mission_from"],
    _messages["mission_to"],
    "MISSION STATUS UPDATE",
    _messages["mission_success"]
)
end_message_process = _P.Message(out_trigger, end_message_model)
end_transmission = Transmission.Create(EMFTools.Protocol.Link_16, _date_time, 60, 10, 500, EMFTools.MicroWaveBands.UHF)
end_transmission_process = _P.Element.Radio(end_message_process, sat_element, end_transmission)
`;
}

function buildSubHuntMissionScript(blueprint, scenario) {
  const g = scenario.geometry;
  const supportUnits = Math.max(1, scenario.geometry.density);
  const playerDepthFeet = -380;
  const targetDepthFeet = -520;
  const escortDepthFeet = -620;
  const annotationPoiLines = buildAnnotationPoiList(scenario.tasking?.annotations || []);
  const annotationPoiAttachList = buildAnnotationPoiAttachList(scenario.tasking?.annotations || []);
  const biologicPositions = buildDeconflictedPositions({
    center: g.center,
    count: 4,
    radiusKm: 80,
    minSpacingKm: 12,
    seedKey: `${scenario.missionId}:subhunt:biologics`
  });
  const aisMerchantTraffic = Array.isArray(scenario.forces?.aisMerchantTraffic) ? scenario.forces.aisMerchantTraffic : [];
  const merchantPositions = buildDeconflictedPositions({
    center: g.center,
    count: Math.max(0, (scenario.forces?.ambientMerchantCount ?? (supportUnits + 2)) - aisMerchantTraffic.length),
    radiusKm: 120,
    minSpacingKm: 18,
    seedKey: `${scenario.missionId}:subhunt:merchants`,
    existingPoints: aisMerchantTraffic.map((contact) => contact.point)
  });
  const friendlySurface = scenario.forces?.friendlySurface?.[0] || {
    name: "USS Spruance",
    dbid: 294,
    faction: "US"
  };
  const friendlyAir = scenario.forces?.friendlyAir?.[0] || {
    name: "P-8A Poseidon",
    dbid: 2705,
    faction: "US"
  };
  const primaryTarget = scenario.forces?.enemyPrimary?.find((unit) => unit.notes?.role === "target")
    || scenario.forces?.enemyPrimary?.[0]
    || {
      name: "Yasen Severodvinsk",
      dbid: 667,
      faction: "RU"
    };
  const escortUnit = scenario.forces?.enemyPrimary?.find((unit) => unit.unitId !== primaryTarget.unitId)
    || scenario.forces?.enemyPrimary?.find((unit) => unit.notes?.role === "screen")
    || {
      name: "Akula Screen",
      dbid: 34,
      faction: "RU"
    };
  const enemySupportSurface = scenario.forces?.enemySurfaceSupport || [];
  const enemySupportAir = scenario.forces?.enemyAir || [];
  const supportFaction = enemySupportSurface[0]?.faction || enemySupportAir[0]?.faction || "RU";
  const supportFactionId = factionRuntimeId(supportFaction);
  const supportSurfacePositions = buildDeconflictedPositions({
    center: g.supportGroup,
    count: enemySupportSurface.length,
    radiusKm: 10,
    minSpacingKm: 5,
    seedKey: `${scenario.missionId}:subhunt:support_surface`
  });
  const supportAirPositions = buildDeconflictedPositions({
    center: g.supportGroup,
    count: enemySupportAir.length,
    radiusKm: 10,
    minSpacingKm: 4,
    seedKey: `${scenario.missionId}:subhunt:support_air`
  });
  const biologicBlock = biologicPositions.map((point, idx) => `bio_props = Element.Props.FromDatabaseID(civ_fact, "Biologic %s" % ${idx}, ElementCategory.Biologic, 1, ${formatGc(point)})
bio_element = Element(bio_props).SetElevation(${-60 - (idx * 35)}).SetHeading(random.randrange(0, 359))
_P.Element.Spawn(p8_spawn, bio_element, bio_element.Position)`).join("\n");
  const aisMerchantBlock = aisMerchantTraffic.map((contact, idx) => `cargo_props = Element.Props.FromDatabaseID(civ_fact, "${String(contact.name || `AIS Merchant ${idx + 1}`).replaceAll("\"", "")}", ElementCategory.Ship, ${pickGenericCargoDbid(contact.mmsi || contact.id || `${scenario.missionId}:ais:${idx}`)}, ${formatGc(contact.point)})
cargo_element = Element(cargo_props).SetHeading(random.randrange(200, 280))
_P.Element.Spawn(p8_spawn, cargo_element, cargo_element.Position)`).join("\n");
  const merchantBlock = merchantPositions.map((point, idx) => `cargo_props = Element.Props.FromDatabaseID(civ_fact, "Merchant %s" % (${aisMerchantTraffic.length + idx} + 1), ElementCategory.Ship, _get_random_cargo(), ${formatGc(point)})
cargo_element = Element(cargo_props).SetHeading(random.randrange(200, 280))
_P.Element.Spawn(p8_spawn, cargo_element, cargo_element.Position)`).join("\n");
  const supportGroupBlock = enemySupportSurface.length || enemySupportAir.length
    ? `
support_plot_anchor = russian_plot
${enemySupportSurface.map((unit, index) => {
  const variable = `support_surface_${index}`;
  const spawnAnchor = index === 0 ? "support_plot_anchor" : `support_surface_${index - 1}_plot`;
  return `${variable}_props = Element.Props.FromDatabaseID(${supportFactionId}, "${unit.name}", ElementCategory.Ship, ${unit.dbid}, ${formatGc(supportSurfacePositions[index])})
${variable}_element = Element(${variable}_props).SetElevation(0).SetHeading(225)
${variable}_spawn = _P.Element.Spawn(${spawnAnchor}, ${variable}_element, ${variable}_element.Position)
${variable}_plot = _P.Element.Plot(${variable}_spawn, ${variable}_element, Waypoint(support_group_dest))`;
}).join("\n")}
${enemySupportAir.map((unit, index) => {
  const variable = `support_air_${index}`;
  const spawnAnchor = enemySupportSurface.length
    ? `support_surface_${enemySupportSurface.length - 1}_plot`
    : "support_plot_anchor";
  return `${variable}_props = Element.Props.FromDatabaseID(${supportFactionId}, "${unit.name}", ElementCategory.Aircraft, ${unit.dbid}, ${formatGc(supportAirPositions[index])})
${variable}_element = Element(${variable}_props).SetElevation(600).SetHeading(225)
${variable}_spawn = _P.Element.Spawn(${spawnAnchor}, ${variable}_element, ${variable}_element.Position)
${variable}_plot = _P.Element.Plot(${variable}_spawn, ${variable}_element, Waypoint(${index === 0 ? formatGc(g.center) : "support_group_dest"}))`;
}).join("\n")}
`
    : "";
  return `import random

##
# Globals
##
_debug_mode = False
_version = "0.0.0"
_msv = "0.113.1"
_author = "MNW Desktop Wizard"
_operation_type = OperationType.ASW
_date_time = "${scenario.startMnw}"
_weather = EnvTools.GetRandomWeatherParameters()

civ_fact = 0
us_fact = 236
rus_fact = 183
ch_fact = 46

virginia_id = 1015
arleigh_id = 294
p8_id = 2705
yasen_id = ${primaryTarget.dbid}
escort_id = ${escortUnit.dbid}

cargo_ids = [
99992101, 99992105, 99992106, 99992107, 99992108,
99992109, 99992110, 99992111, 99992201, 99992202,
99992203, 99992204, 99992205, 99992206, 99992207,
99992208, 99992209, 99992210, 99992211, 99992301,
99992302, 99992303, 99992304, 99992305, 99992306,
99992307, 99992308, 99992309, 99992310, 99992311,
99992312, 99992313, 99992314, 99992315, 99992401
]

def _get_random_cargo():
    return cargo_ids[random.randrange(0, len(cargo_ids))]

player_spawn_pos = ${formatGc(g.playerSpawn)}
datum_pos = ${formatGc(g.datum)}
yasen_spawn_pos = ${formatGc(g.yasen)}
escort_spawn_pos = ${formatGc(g.escort)}
support_group_pos = ${formatGc(g.supportGroup)}
support_group_dest = ${formatGc(g.supportDest)}
ddg_spawn_pos = ${formatGc(g.ddg)}
ddg_screen_pos = ${formatGc(g.ddgScreen)}
p8_spawn_pos = ${formatGc(g.p8)}
battle_area_center = ${formatGc(g.center)}
egress_pos = ${formatGc(g.egress)}
withdrawal_zone_pos = ${formatGc(g.withdrawal)}

_diplomacy.AddFactions([civ_fact, us_fact, rus_fact, ch_fact])
_diplomacy.SetTensionLevel(TensionLevel.Increased).SetMissionROE(RulesOfEngagement.Free)
_diplomacy.SetStatus(civ_fact).SetStatus(us_fact).SetStatus(rus_fact, CoalitionStatus.Enemy).SetStatus(ch_fact, CoalitionStatus.Enemy)

objectives = [
    Obj(_objectives["primary_withdraw_intact"], True).SetStatus(ObjectiveStatus.InProgress),
]

player_spawn_zone = _Z.Circular("Player Spawn Zone", player_spawn_pos, 1000)
player_props = Element.Props.FromElementID(us_fact, "(Player) Virginia B3", ElementCategory.Submarine, virginia_id, player_spawn_pos)
player_element = Element(player_props).SetElevation(${playerDepthFeet}).SetHeading(30).SetPlayable().SetScope(Global.Scope.Player)
player_spawn_process = _P.Element.Spawn(_mission_started, player_element, player_element.Position)

player_mk48_arsenal_process = _P.Element.Arsenal(player_spawn_process, player_element, BaseCategory.Subsurface, ElementCategory.Torpedo, 1712, 12)
player_mk3_arsenal_process = _P.Element.Arsenal(player_mk48_arsenal_process, player_element, BaseCategory.Subsurface, ElementCategory.Expendable, 126, 12)
player_mk4_arsenal_process = _P.Element.Arsenal(player_mk3_arsenal_process, player_element, BaseCategory.Subsurface, ElementCategory.Expendable, 2458, 12)

preloads = []
for i in range(4):
    preloads.append(ArsenalPacket(BaseCategory.Subsurface, ElementCategory.Torpedo, 1712))
for j in range(14):
    if j <= 7:
        preloads.append(ArsenalPacket(BaseCategory.Subsurface, ElementCategory.Expendable, 126))
    else:
        preloads.append(ArsenalPacket(BaseCategory.Subsurface, ElementCategory.Expendable, 2458))
player_preload_process = _P.Element.PreloadArsenal(player_mk4_arsenal_process, player_element, preloads)

messageModel = MessageModel(
    EMFTools.Protocol.Link_16,
    EMFTools.MicroWaveBands.UHF,
    _date_time,
    MessagePriority.High,
    _messages["mission_from"],
    _messages["mission_to"],
    "TASKING ORDER",
    _messages["mission_objectives"]
)
datum_poi = PointOfInterest("Breakout Datum", Waypoint(datum_pos))
barrier_poi = PointOfInterest("Likely Egress", Waypoint(egress_pos))
withdrawal_poi = PointOfInterest("Withdrawal Box", Waypoint(withdrawal_zone_pos))
${annotationPoiLines}
messageModel.AttachPOIs([datum_poi, barrier_poi, withdrawal_poi${annotationPoiAttachList}])
message_process = _P.Message(player_spawn_process, messageModel)

sat_spawn_zone = _Z.Circular("Sat Spawn Zone", player_spawn_pos, 10000)
sat_props = Element.Props.FromDatabaseID(us_fact, "MUOS", ElementCategory.SpaceElement, 1, sat_spawn_zone.RandomPosition())
sat_element = Element(sat_props).SetElevation(500)
sat_spawn_process = _P.Element.Spawn(player_spawn_process, sat_element, sat_element.Position)
transmission = Transmission.Create(EMFTools.Protocol.Link_16, _date_time, 60, 10, 500, EMFTools.MicroWaveBands.UHF)
transmission_process = _P.Element.Radio(sat_spawn_process, sat_element, transmission)

ddg_props = Element.Props.FromDatabaseID(${factionRuntimeId(friendlySurface.faction)}, "${friendlySurface.name}", ElementCategory.Ship, arleigh_id if ${friendlySurface.dbid} == 294 else ${friendlySurface.dbid}, ddg_spawn_pos)
ddg_element = Element(ddg_props).SetElevation(0).SetHeading(45).SetHVU(True)
ddg_spawn = _P.Element.Spawn(player_spawn_process, ddg_element, ddg_element.Position)
ddg_plot = _P.Element.Plot(ddg_spawn, ddg_element, Waypoint(ddg_screen_pos))

p8_props = Element.Props.FromDatabaseID(${factionRuntimeId(friendlyAir.faction)}, "${friendlyAir.name}", ElementCategory.Aircraft, p8_id if ${friendlyAir.dbid} == 2705 else ${friendlyAir.dbid}, p8_spawn_pos)
p8_element = Element(p8_props).SetElevation(5000).SetHeading(220)
p8_spawn = _P.Element.Spawn(ddg_plot, p8_element, p8_element.Position)

${biologicBlock}

${aisMerchantBlock}

${merchantBlock}

yasen_spawn_zone = _Z.Circular("Yasen Spawn Zone", yasen_spawn_pos, 12000)
yasen_props = Element.Props.FromDatabaseID(${factionRuntimeId(primaryTarget.faction)}, "${primaryTarget.name}", ElementCategory.Submarine, yasen_id, yasen_spawn_pos)
yasen_element = Element(yasen_props).SetElevation(${targetDepthFeet}).SetHeading(245)
yasen_spawn = _P.Element.Spawn(p8_spawn, yasen_element, yasen_element.Position)
yasen_dive = _P.Element.Dive(yasen_spawn, yasen_element)

escort_spawn_zone = _Z.Circular("Escort Spawn Zone", escort_spawn_pos, 10000)
escort_props = Element.Props.FromDatabaseID(${factionRuntimeId(escortUnit.faction)}, "${escortUnit.name}", ElementCategory.Submarine, escort_id, escort_spawn_pos)
escort_element = Element(escort_props).SetElevation(${escortDepthFeet}).SetHeading(245).SetHVU(True)
escort_spawn = _P.Element.Spawn(yasen_spawn, escort_element, escort_element.Position)
escort_dive = _P.Element.Dive(escort_spawn, escort_element)

yasen_plot = _P.Element.Plot(escort_dive, yasen_element, Waypoint(egress_pos))
escort_plot = _P.Element.Plot(yasen_plot, escort_element, Waypoint(egress_pos))

${supportGroupBlock}

withdrawal_antenna_trigger = _T.AntennasRaised(True)
player_element.NotifyOnAntennaRaised(withdrawal_antenna_trigger)
withdrawal_complete = _P.Objective.Status(withdrawal_antenna_trigger, objectives[0], ObjectiveStatus.Completed)

player_death_trigger = _T.Manual()
player_nop_trigger = _T.NonOperational()
player_element.NotifyUponDeath(player_death_trigger)
player_element.NotifyNonOperational(player_nop_trigger)
player_lost = _T.Or([player_death_trigger, player_nop_trigger])
player_fail = _P.Objective.Status(player_lost, objectives[0], ObjectiveStatus.Failed)

out_trigger = _T.Objective(objectives)
end_trigger = _T.Manual()
outcome = Out(out_trigger, end_trigger, us_fact)

end_message_model = MessageModel(
    EMFTools.Protocol.Link_16,
    EMFTools.MicroWaveBands.UHF,
    _date_time,
    MessagePriority.High,
    _messages["mission_from"],
    _messages["mission_to"],
    "MISSION STATUS UPDATE",
    _messages["mission_success"]
)
end_message_process = _P.Message(out_trigger, end_message_model)
end_transmission = Transmission.Create(EMFTools.Protocol.Link_16, _date_time, 60, 10, 500, EMFTools.MicroWaveBands.UHF)
end_transmission_process = _P.Element.Radio(end_message_process, sat_element, end_transmission)
`;
}

function localeValue(value) {
  return String(value || "").replaceAll("\"", "\"\"");
}

export function buildLocaleCsv(blueprint, scenarioRows) {
  const lines = [
    "Path,Field,en,de,zh,fr,es,ru,ro,pl,el",
    `${blueprint.campaignId}/quest.cmp,name,${localeValue(blueprint.title)},,,,,,,,`,
    `${blueprint.campaignId}/quest.cmp,description,"${localeValue(blueprint.description)}",,,,,,,,`
  ];

  for (const row of scenarioRows) {
    lines.push(row);
  }

  return `${lines.join("\n")}\n`;
}

export function buildQuestScript(campaignMissionIds) {
  let questScript = `##\n# Globals\n##\n_debug_mode = False\n_version = "0.0.0"\n_msv = "0.113.1"\n_author = "MNW Desktop Wizard"\n_difficulty_level = 1\n\n## Missions\n_start = Mis("${campaignMissionIds[0]}")\n`;
  let previousVariable = "_start";
  campaignMissionIds.slice(1).forEach((missionId, index) => {
    const nextVariable = `_m${index + 1}`;
    questScript += `${nextVariable} = ${previousVariable}.PipeMission("${missionId}")\n`;
    previousVariable = nextVariable;
  });
  return questScript;
}

export function buildScenarioPackageArtifacts({ blueprint, scenario }) {
  const isReservedScenario = Boolean(scenario.reserved || scenario.continuation?.reserved);
  const intelLine = scenario.intel?.prose || "Enemy activity is assessed along the current route family, but cueing remains imprecise.";
  const taskLine = scenario.tasking?.primaryTask?.objectiveLine || "Build the tactical picture and preserve the boat.";
  const mapIntentLine = scenario.tasking?.primaryTask?.mapIntent || "Use the marked cues as geometry aids rather than exact truth.";
  const postureLine = scenario.tasking?.posture?.cue || "Command expects you to use the available route and contact cues with judgment.";
  const annotationLines = buildAnnotationBriefLines(scenario.tasking?.annotations || []);
  const messages = {
    mission_from: blueprint.theaterId === "luzon_strait" ? "COMSUBPAC" : "COMSUBLANT",
    mission_to: blueprint.player.name.toUpperCase(),
    mission_objectives: isReservedScenario
      ? `BT\nSUBJ: ${scenario.name.toUpperCase()} - PLACEHOLDER\n\n1. This mission slot is reserved so the campaign chain always has a valid next node.\n\n2. If you do not want to continue the campaign, treat the previous mission as the campaign conclusion.\n\n3. If you do want to continue, do not play this scenario yet.\n\n4. Return to Campaign Tracking.\n\n5. Save the result from the previous mission.\n\n6. Click Continue Campaign so the app can rewrite this scenario with updated tasking, geometry, and supporting forces.\n\n7. Rebuild and redeploy if prompted.\n\n8. Launch this scenario only after the tracker confirms it was regenerated.\n\n9. Current placeholder route summary:\n   ${scenario.geometry.routeSummary}\n\n10. Current placeholder enemy transit:\n   ${scenario.geometry.enemyTransitSummary}`
      : `BT\nSUBJ: ${scenario.name.toUpperCase()}\n\n1. ${scenario.summary}\n\n2. Primary Task:\n   ${taskLine}\n\n3. Posture:\n   ${postureLine}\n\n4. Intel Cue:\n   ${intelLine}\n\n5. Marked Cues:\n   ${annotationLines || "No additional marked cues."}\n\n6. Player Guidance:\n   ${mapIntentLine}\n\n7. Route Summary:\n   ${scenario.geometry.routeSummary}\n\n8. Enemy Transit:\n   ${scenario.geometry.enemyTransitSummary}\n\n9. Keep your submarine combat effective and raise antennas when you are ready to conclude the mission.`,
    mission_success: `BT\nSUBJ: MISSION STATUS - SUCCESS\n\n${scenario.successText}`
  };
  const metadata = missionMetadataRecord(
    scenario.name,
    scenario.description,
    scenario.objectiveText,
    messages
  );
  const missionPath = path.join(blueprint.campaignId, `${scenario.slug}.mis`);
  const files = {
    [missionPath]: blueprint.family === "surface_shadow"
      ? buildSurfaceMissionScript(blueprint, scenario)
      : buildSubHuntMissionScript(blueprint, scenario),
    [`${missionPath}.json`]: `${JSON.stringify(metadata, null, 2)}\n`
  };
  const localeRows = [
    `${missionPath},name,${localeValue(scenario.name)},,,,,,,,`,
    `${missionPath},description,"${localeValue(scenario.description)}",,,,,,,,`,
    `${missionPath},objectives.primary_withdraw_intact,${localeValue(scenario.objectiveText)},,,,,,,,`,
    `${missionPath},messages.mission_from,${localeValue(messages.mission_from)},,,,,,,,`,
    `${missionPath},messages.mission_to,${localeValue(messages.mission_to)},,,,,,,,`,
    `${missionPath},messages.mission_objectives,"${localeValue(messages.mission_objectives)}",,,,,,,,`,
    `${missionPath},messages.mission_success,"${localeValue(messages.mission_success)}",,,,,,,,`
  ];
  return {
    files,
    localeRows
  };
}

export async function buildGeneratedCampaignFiles({ templateRoot, spec }) {
  const blueprint = buildCampaignBlueprint(spec);
  const templateMisPath = path.join(templateRoot, "src", "package", "template.mis.json");
  const templateCmpPath = path.join(templateRoot, "src", "package", "template.cmp.json");
  const templateMis = await fs.readFile(templateMisPath, "utf8");
  const templateCmp = await fs.readFile(templateCmpPath, "utf8");

  const campaignMissionIds = blueprint.scenarios.map((scenario) => scenario.missionId);
  const questScript = buildQuestScript(campaignMissionIds);

  const scenarioRows = [];
  const files = {};

  for (const scenario of blueprint.scenarios) {
    const artifacts = buildScenarioPackageArtifacts({ blueprint, scenario });
    Object.assign(files, artifacts.files);
    scenarioRows.push(...artifacts.localeRows);
  }

  files[path.join(blueprint.campaignId, "quest.cmp")] = questScript;
  files[path.join(blueprint.campaignId, "quest.cmp.json")] = `${JSON.stringify(campaignMetadataRecord(blueprint.title, blueprint.description), null, 2)}\n`;
  files["locale.csv"] = buildLocaleCsv(blueprint, scenarioRows);
  files["manifest.json"] = `${JSON.stringify({ version: "0.0.0", build: "0", dv: "0.0.0", author: "MNW Desktop Wizard", content: [] }, null, 2)}\n`;
  files["template.mis.json"] = templateMis.endsWith("\n") ? templateMis : `${templateMis}\n`;
  files["template.cmp.json"] = templateCmp.endsWith("\n") ? templateCmp : `${templateCmp}\n`;

  const firstMissionId = blueprint.scenarios[0].missionId;
  const campaignConfig = {
    campaign_id: blueprint.campaignId,
    title: blueprint.title,
    theater: blueprint.theaterName,
    description: blueprint.description,
    active_persistence_system: "baseline_modular",
    authoring_constraints: blueprint.authoringConstraints
  };

  const bootstrapState = {
    metadata: campaignConfig,
    current_mission_id: firstMissionId,
    campaign_clock: blueprint.scenarios[0].startIso,
    order_of_battle: {
      ...Object.fromEntries(
        blueprint.theaterUnits.map((unit) => [
          unit.unitId,
          {
            unit_id: unit.unitId,
            name: unit.name,
            faction: unit.faction,
            platform_type: unit.platformType,
            dbid: unit.dbid,
            readiness: 1.0,
            damage: 0.0,
            destroyed: false,
            ammo: { ...(unit.ammo || {}) },
            tags: [...(unit.tags || [])],
            notes: {
              ...(unit.notes || {}),
              ...(blueprint.theaterPicture?.units?.[unit.unitId] || {})
            }
          }
        ])
      )
    },
    mission_history: [],
    world_state: {
      escalation_level: 1,
      tone: blueprint.tone,
      posture: blueprint.posture,
      route_family: blueprint.family,
      theater_picture: blueprint.theaterPicture,
      authoring_constraints: blueprint.authoringConstraints
    },
    module_state: {
      damage: {
        repair_rate_per_day: 0.08
      },
      ammo: {}
    },
    enabled_modules: ["damage", "ammo"]
  };

  const bootstrapResult = {
    mission_id: firstMissionId,
    outcome: "success",
    time_elapsed_hours: 4.0,
    events: [
      {
        event_type: "weapon_expended",
        unit_id: blueprint.player.unitId,
        amount: 0,
        weapon_key: Object.keys(blueprint.player.ammo)[0],
        metadata: {}
      }
    ],
    metadata: {
      source: "bootstrap_example"
    }
  };

  const modulesConfig = {
    enabled_modules: ["damage", "ammo"],
    module_config: {
      damage: {
        repair_rate_per_day: 0.08
      },
      ammo: {
        allow_negative: false
      }
    }
  };

  return {
    blueprint,
    packageFiles: files,
    campaignFiles: {
      "campaign.json": `${JSON.stringify(campaignConfig, null, 2)}\n`,
      "bootstrap_state.json": `${JSON.stringify(bootstrapState, null, 2)}\n`,
      "bootstrap_result.json": `${JSON.stringify(bootstrapResult, null, 2)}\n`,
      "modules.json": `${JSON.stringify(modulesConfig, null, 2)}\n`
    }
  };
}
