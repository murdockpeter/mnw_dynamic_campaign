import WebSocket from "ws";

const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";

function radiusToBoundingBox(center, radiusKm) {
  const [lat, lon] = center;
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / Math.max(1, 111 * Math.cos(lat * (Math.PI / 180)));
  return [
    [Number((lat - latDelta).toFixed(6)), Number((lon - lonDelta).toFixed(6))],
    [Number((lat + latDelta).toFixed(6)), Number((lon + lonDelta).toFixed(6))]
  ];
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

function firstFinite(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeAisMessage(rawMessage) {
  const metadata = rawMessage?.Metadata || rawMessage?.MetaData || {};
  const messageType = rawMessage?.MessageType || "UnknownMessage";
  const messagePayload = rawMessage?.Message?.[messageType] || {};
  const mmsi = firstString(
    messagePayload?.UserID,
    metadata?.MMSI,
    metadata?.ShipMMSI,
    metadata?.UserID
  );
  if (!mmsi) {
    return null;
  }
  const lat = firstFinite(
    metadata?.Latitude,
    messagePayload?.Latitude
  );
  const lon = firstFinite(
    metadata?.Longitude,
    messagePayload?.Longitude
  );
  return {
    mmsi,
    messageType,
    lat,
    lon,
    sog: firstFinite(messagePayload?.Sog, metadata?.Sog),
    cog: firstFinite(messagePayload?.Cog, metadata?.Cog),
    heading: firstFinite(messagePayload?.TrueHeading, metadata?.TrueHeading),
    navStatus: firstString(messagePayload?.NavigationalStatus, metadata?.NavigationalStatus),
    name: firstString(
      metadata?.ShipName,
      messagePayload?.Name,
      messagePayload?.ShipName
    ),
    shipType: firstString(
      metadata?.ShipType,
      messagePayload?.Type,
      messagePayload?.TypeAndCargo
    ),
    rawMessage
  };
}

function mergeContacts(existing, update, center) {
  const next = existing || {
    mmsi: update.mmsi,
    name: null,
    lat: null,
    lon: null,
    sog: null,
    cog: null,
    heading: null,
    navStatus: null,
    shipType: null,
    lastMessageType: null
  };
  const merged = {
    ...next,
    name: update.name || next.name,
    lat: Number.isFinite(update.lat) ? Number(update.lat.toFixed(5)) : next.lat,
    lon: Number.isFinite(update.lon) ? Number(update.lon.toFixed(5)) : next.lon,
    sog: Number.isFinite(update.sog) ? Number(update.sog.toFixed(1)) : next.sog,
    cog: Number.isFinite(update.cog) ? Number(update.cog.toFixed(1)) : next.cog,
    heading: Number.isFinite(update.heading) ? Number(update.heading.toFixed(1)) : next.heading,
    navStatus: update.navStatus || next.navStatus,
    shipType: update.shipType || next.shipType,
    lastMessageType: update.messageType || next.lastMessageType
  };
  if (Array.isArray(center) && Number.isFinite(merged.lat) && Number.isFinite(merged.lon)) {
    merged.distanceKm = Number(haversineDistanceKm(center, [merged.lat, merged.lon]).toFixed(1));
  } else {
    merged.distanceKm = null;
  }
  return merged;
}

function collectWsContacts({ apiKey, center, radiusKm, timeoutMs = 4000 }) {
  return new Promise((resolve, reject) => {
    const contacts = new Map();
    const rawMessages = [];
    let messageCount = 0;
    let settled = false;
    let socket = null;

    const finalize = (error = null) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        socket?.close();
      } catch {}
      clearTimeout(timer);
      if (error) {
        reject(error);
        return;
      }
      resolve({
        contacts: [...contacts.values()]
          .filter((contact) => Number.isFinite(contact.lat) && Number.isFinite(contact.lon))
          .sort((left, right) => {
            const leftDistance = Number.isFinite(left.distanceKm) ? left.distanceKm : Number.MAX_SAFE_INTEGER;
            const rightDistance = Number.isFinite(right.distanceKm) ? right.distanceKm : Number.MAX_SAFE_INTEGER;
            return leftDistance - rightDistance;
          })
          .slice(0, 100),
        debug: {
          messageCount,
          uniqueVessels: contacts.size,
          sampledMessages: rawMessages
        }
      });
    };

    const timer = setTimeout(() => finalize(), timeoutMs);

    try {
      socket = new WebSocket(AISSTREAM_URL);
    } catch (error) {
      finalize(error);
      return;
    }

    socket.on("open", () => {
      const subscriptionMessage = {
        APIKey: apiKey,
        BoundingBoxes: [radiusToBoundingBox(center, radiusKm)],
        FilterMessageTypes: [
          "PositionReport",
          "StandardClassBPositionReport",
          "ExtendedClassBPositionReport",
          "ShipStaticData",
          "StaticDataReport"
        ]
      };
      socket.send(JSON.stringify(subscriptionMessage));
    });

    socket.on("message", (eventData) => {
      try {
        const parsed = JSON.parse(String(eventData));
        messageCount += 1;
        if (rawMessages.length < 40) {
          rawMessages.push(parsed);
        }
        const normalized = normalizeAisMessage(parsed);
        if (!normalized) {
          return;
        }
        contacts.set(
          normalized.mmsi,
          mergeContacts(contacts.get(normalized.mmsi), normalized, center)
        );
      } catch {}
    });

    socket.on("error", (error) => {
      finalize(error instanceof Error ? error : new Error("AIS websocket connection failed."));
    });

    socket.on("close", () => {
      finalize();
    });
  });
}

export async function fetchAisContacts({
  settings,
  center,
  radiusKm,
  theaterName
} = {}) {
  const ais = settings?.ais || {};
  if (!ais.enabled) {
    return {
      enabled: false,
      contacts: [],
      status: "AIS integration is disabled in Setup."
    };
  }
  if (!ais.token) {
    return {
      enabled: true,
      contacts: [],
      status: "AIS token missing. Add it in Setup."
    };
  }
  if (!Array.isArray(center) || center.length !== 2) {
    return {
      enabled: true,
      contacts: [],
      status: "No theater center is available yet. Load Campaign Tracking first."
    };
  }

  const effectiveRadiusKm = Number.isFinite(Number(radiusKm))
    ? Number(radiusKm)
    : Number(ais.queryRadiusKm || 160);
  const { contacts, debug } = await collectWsContacts({
    apiKey: ais.token,
    center,
    radiusKm: effectiveRadiusKm
  });

  return {
    enabled: true,
    provider: "aisstream",
    center,
    radiusKm: effectiveRadiusKm,
    theaterName: theaterName || null,
    contacts,
    debug,
    status: contacts.length
      ? `Loaded ${contacts.length} AIS contact${contacts.length === 1 ? "" : "s"} from AISStream.`
      : "AISStream connection succeeded, but no contacts were captured in the current window."
  };
}
