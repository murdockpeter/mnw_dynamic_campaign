const DEFAULT_SCENARIO_COUNT = 3;

const TONE_CATALOG = {
  surveillance: {
    label: "Surveillance Escalation",
    sequence: ["initial_scout", "crosscurrent", "barrier_tide", "closing_arc"]
  },
  breakout_hunt: {
    label: "Breakout Hunt",
    sequence: ["first_vector", "datum_shift", "containment_run", "closing_window"]
  },
  sea_denial: {
    label: "Sea Denial",
    sequence: ["screen_probe", "route_bend", "kill_box", "terminal_shadow"]
  }
};

const MISSION_LIBRARY = {
  initial_scout: {
    name: "Initial Scout",
    summary: "Build the first tactical picture on the enemy movement and withdraw cleanly.",
    cue: "Initial contacts are thin and ambiguous. Preserve stealth and establish the route picture."
  },
  crosscurrent: {
    name: "Crosscurrent",
    summary: "The enemy adjusts course and screening posture. Re-establish contact and refine the route estimate.",
    cue: "Expect a tighter helo pattern and more disciplined maneuver around the lead unit."
  },
  barrier_tide: {
    name: "Barrier Tide",
    summary: "The battlespace thickens into a barrier problem. Track the turn and stay ahead of the containment line.",
    cue: "The route is bending toward a constricted approach. Escorts will favor layered search arcs."
  },
  closing_arc: {
    name: "Closing Arc",
    summary: "The operation reaches its containment phase. Confirm the decisive route and survive the endgame.",
    cue: "Support is forward, but the player submarine still has to hold the decisive geometry."
  },
  first_vector: {
    name: "First Vector",
    summary: "Intercept the opening move and classify the breakout axis before it widens.",
    cue: "Expect sparse reporting and a narrow early prosecution window."
  },
  datum_shift: {
    name: "Datum Shift",
    summary: "The contact picture breaks and reforms. Push back in and restore the track.",
    cue: "Search cues are intermittent and the opposing force is exploiting clutter."
  },
  containment_run: {
    name: "Containment Run",
    summary: "Barrier forces tighten while the target tries to slip through the seam.",
    cue: "Plan for heavier support, denser contacts, and a more defined egress route."
  },
  closing_window: {
    name: "Closing Window",
    summary: "The final opportunity to seal the route before the operational picture resets.",
    cue: "Any late exposure will draw aggressive screening behavior."
  },
  screen_probe: {
    name: "Screen Probe",
    summary: "Probe the screen, confirm intent, and keep the initiative without overcommitting.",
    cue: "The opening layer is disciplined but not yet fully closed."
  },
  route_bend: {
    name: "Route Bend",
    summary: "The enemy shifts axis and tries to force a route decision under pressure.",
    cue: "The support picture is thickening around the turn point."
  },
  kill_box: {
    name: "Kill Box",
    summary: "Contain the movement inside a prepared geometry and survive the counter-search.",
    cue: "The generated path now favors a barrier-like prosecution problem."
  },
  terminal_shadow: {
    name: "Terminal Shadow",
    summary: "Carry contact into the final phase and leave a clean handoff for follow-on forces.",
    cue: "The route is now constrained, but exposure risk is highest."
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
  return Math.max(1, Math.min(4, Math.round(count)));
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

function pickArchetypes(tone, count) {
  const selectedTone = TONE_CATALOG[tone] || TONE_CATALOG.surveillance;
  return selectedTone.sequence.slice(0, count).map((key) => ({
    slug: key,
    ...MISSION_LIBRARY[key]
  }));
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

function toFixedCoord(value) {
  return Number(value).toFixed(6);
}

function jitterPoint([lat, lon], rng, latDelta = 0.08, lonDelta = 0.12) {
  const latOffset = (rng() - 0.5) * latDelta;
  const lonOffset = (rng() - 0.5) * lonDelta;
  return [Number((lat + latOffset).toFixed(6)), Number((lon + lonOffset).toFixed(6))];
}

function summarizePath(points) {
  return points
    .map(([lat, lon]) => `${toFixedCoord(lat)}, ${toFixedCoord(lon)}`)
    .join(" -> ");
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
  const ddg = jitterPoint([16.18, 117.96], rng, scale, scale);
  const ddgScreen = jitterPoint([16.5, 118.16], rng, scale, scale);
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

function buildScenarioRecord(template, campaignId, missionDef, index, count, year, rng) {
  const startBase = template.id === "luzon_strait"
    ? `${year}-04-02T04:20:00Z`
    : `${year}-03-14T02:30:00Z`;
  const startTime = plusHours(startBase, index * 18);
  const rawGeometry = template.family === "surface_shadow"
    ? buildSurfaceShadowGeometry(template, index, count, rng)
    : buildSubHuntGeometry(template, index, count, rng);
  const geometry = applyGeometrySafety(template.id, template.family, rawGeometry, rng);
  const missionKey = `${campaignId}.${campaignId}.${missionDef.slug}`;

  return {
    slug: missionDef.slug,
    missionId: missionKey,
    name: missionDef.name,
    summary: missionDef.summary,
    cue: missionDef.cue,
    index,
    family: template.family,
    startIso: startTime.iso,
    startMnw: startTime.mnw,
    geometry,
    description: `${missionDef.summary} ${missionDef.cue}`,
    objectiveText: "Keep your submarine combat effective and raise antennas to conclude the mission.",
    successText: `${missionDef.name} surveillance is complete. Higher command has the refined route picture and can posture the next move using your report.`
  };
}

export function getTheaterTemplates() {
  return THEATER_TEMPLATES;
}

export function getToneCatalog() {
  return TONE_CATALOG;
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
  referenceIso,
  objective = "pursue_contact",
  riskPosture = "balanced",
  operationalTempo = "deliberate",
  priorMissionCount = 0,
  lastOutcome = "success"
} = {}) {
  const theater = THEATER_TEMPLATES[theaterId] || THEATER_TEMPLATES.luzon_strait;
  const family = theater.family;
  const objectiveDef = CONTINUATION_OBJECTIVES[objective] || CONTINUATION_OBJECTIVES.pursue_contact;
  const riskDef = RISK_POSTURES[riskPosture] || RISK_POSTURES.balanced;
  const tempoDef = OPERATIONAL_TEMPOS[operationalTempo] || OPERATIONAL_TEMPOS.deliberate;
  const ordinal = missionIndex + 1;
  const slug = `${objectiveDef.slugPrefix}_${String(ordinal).padStart(2, "0")}`;
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
  const rawGeometry = family === "surface_shadow"
    ? buildSurfaceShadowGeometry(theater, missionIndex, densityCount, rng)
    : buildSubHuntGeometry(theater, missionIndex, densityCount, rng);
  const geometry = applyGeometrySafety(theater.id, family, rawGeometry, rng);
  const outcomeLine = lastOutcome === "failure"
    ? "The previous mission ended badly, so the next operation is framed around regaining control without losing the boat."
    : lastOutcome === "partial_success"
      ? "The previous mission produced useful contact data, but the enemy still has room to maneuver."
      : "The previous mission produced enough tactical clarity to drive a purposeful follow-on operation.";
  const name = `${objectiveDef.baseName} ${ordinal}`;
  const summary = objectiveDef.summaries[family] || objectiveDef.summaries.surface_shadow;
  const cue = `${riskDef.cue} ${outcomeLine}`;
  const description = `${summary} ${cue}`;
  const missionId = `${campaignId}.${campaignId}.${slug}`;
  const objectiveText = family === "surface_shadow"
    ? "Keep your submarine combat effective, preserve the track picture, and raise antennas when you are ready to conclude the mission."
    : "Keep your submarine combat effective, contain the breakout geometry, and raise antennas when you are ready to conclude the mission.";
  const successText = `${name} is complete. Higher command can roll your updated track, damage, and readiness picture into the next decision cycle.`;

  return {
    slug,
    missionId,
    name,
    summary,
    cue,
    index: missionIndex,
    family,
    startIso,
    startMnw: formatMnwFromIso(startIso),
    geometry,
    description,
    objectiveText,
    successText,
    continuation: {
      objective,
      objectiveLabel: objectiveDef.label,
      riskPosture,
      riskLabel: riskDef.label,
      operationalTempo,
      tempoLabel: tempoDef.label,
      advanceHours: tempoDef.advanceHours
    }
  };
}

export function buildCampaignBlueprint(spec = {}) {
  const campaignId = sanitizeCampaignId(spec.campaignId || spec.title);
  const theater = THEATER_TEMPLATES[spec.theater] || THEATER_TEMPLATES.luzon_strait;
  const scenarioCount = clampScenarioCount(spec.scenarioCount);
  const title = String(spec.title || theater.label).trim() || "Generated Campaign";
  const tone = TONE_CATALOG[spec.tone] ? spec.tone : "surveillance";
  const year = Number(spec.year || theater.defaultYear || 2028);
  const playerName = String(spec.playerName || theater.player.name).trim() || theater.player.name;
  const seed = hashSeed(`${campaignId}:${theater.id}:${tone}:${year}:${scenarioCount}:${playerName}`);
  const rng = mulberry32(seed);
  const archetypes = pickArchetypes(tone, scenarioCount);
  const scenarios = archetypes.map((missionDef, index) => {
    return buildScenarioRecord(theater, campaignId, missionDef, index, scenarioCount, year, rng);
  });

  return {
    seed,
    campaignId,
    title,
    theaterId: theater.id,
    theaterLabel: theater.label,
    theaterName: theater.theaterName,
    description: spec.description || `${title} is a ${TONE_CATALOG[tone].label.toLowerCase()} campaign set in the ${theater.theaterName}.`,
    tone,
    toneLabel: TONE_CATALOG[tone].label,
    year,
    family: theater.family,
    player: {
      ...theater.player,
      name: playerName
    },
    enemies: theater.enemies.map((enemy) => ({ ...enemy })),
    scenarios,
    packageNamespace: `${campaignId}.${campaignId}`
  };
}
