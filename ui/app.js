async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

function renderCampaignSummary(data) {
  const root = document.getElementById("campaign-summary");
  const items = [
    ["Campaign", data.state.metadata.title],
    ["Campaign ID", data.state.metadata.campaign_id],
    ["Theater", data.state.metadata.theater],
    ["Persistence", data.state.metadata.active_persistence_system],
    ["Current Mission", data.state.current_mission_id],
    ["Clock", data.state.campaign_clock]
  ];

  root.innerHTML = items.map(([key, value]) => `
    <div class="kv-item">
      <div class="key">${key}</div>
      <div class="value">${value ?? "-"}</div>
    </div>
  `).join("");
}

function renderModuleSummary(data) {
  const root = document.getElementById("module-summary");
  root.innerHTML = data.modules.enabled_modules.map((name) => {
    const config = data.modules.module_config[name] || {};
    return `
      <div class="stack-item">
        <div class="title">${name}</div>
        <div class="meta">${Object.keys(config).length ? JSON.stringify(config) : "No module-specific config"}</div>
      </div>
    `;
  }).join("");
}

function renderHeroStats(data) {
  const unitCount = Object.keys(data.state.order_of_battle).length;
  const destroyedCount = Object.values(data.state.order_of_battle).filter((u) => u.destroyed).length;
  const directiveCount = data.plan.directives.length;
  const moduleCount = data.modules.enabled_modules.length;

  const root = document.getElementById("hero-stats");
  root.innerHTML = [
    ["Tracked Units", unitCount],
    ["Destroyed Units", destroyedCount],
    ["Active Modules", moduleCount],
    ["Generation Directives", directiveCount]
  ].map(([label, value]) => `
    <div class="stat">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `).join("");
}

function readinessPill(unit) {
  if (unit.destroyed) return '<span class="pill bad">Destroyed</span>';
  if (unit.damage > 0.2 || unit.readiness < 0.8) return '<span class="pill warn">Degraded</span>';
  return '<span class="pill ok">Operational</span>';
}

function renderOob(data) {
  const root = document.getElementById("oob-table-wrap");
  const units = Object.values(data.state.order_of_battle);
  root.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Unit</th>
          <th>Faction</th>
          <th>Type</th>
          <th>Damage</th>
          <th>Readiness</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${units.map((unit) => `
          <tr>
            <td><strong>${unit.name}</strong><div class="muted">${unit.unit_id}</div></td>
            <td>${unit.faction}</td>
            <td>${unit.platform_type}</td>
            <td>${(unit.damage * 100).toFixed(0)}%</td>
            <td>${(unit.readiness * 100).toFixed(0)}%</td>
            <td>${readinessPill(unit)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderMissionResult(data) {
  const root = document.getElementById("result-summary");
  root.innerHTML = `
    <div class="event-list">
      <div class="event">
        <div class="head">
          <strong>${data.result.mission_id}</strong>
          <span class="pill ${data.result.outcome === "success" ? "ok" : "warn"}">${data.result.outcome}</span>
        </div>
        <div class="muted">Elapsed: ${data.result.time_elapsed_hours} hours</div>
      </div>
      ${data.result.events.map((event) => `
        <div class="event">
          <div class="head">
            <strong>${event.event_type}</strong>
            <span class="muted">${event.unit_id ?? "-"}</span>
          </div>
          <div class="muted">
            ${event.weapon_key ? `Weapon: ${event.weapon_key} | ` : ""}
            ${event.amount !== null && event.amount !== undefined ? `Amount: ${event.amount}` : "No amount"}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderGenerationPlan(data) {
  const root = document.getElementById("generation-plan");
  root.innerHTML = `
    <div class="directive-list">
      <div class="directive">
        <div class="head">
          <strong>Next Mission</strong>
          <span class="pill ok">${data.plan.mission_id}</span>
        </div>
      </div>
      ${data.plan.directives.map((directive) => `
        <div class="directive">
          <div class="head">
            <strong>${directive.directive_type}</strong>
            <span class="muted">${directive.source_module}</span>
          </div>
          <div class="muted"><code>${JSON.stringify(directive.payload)}</code></div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderContracts() {
  const root = document.getElementById("module-contracts");
  const contracts = [
    { name: "initialize_state", detail: "Module bootstraps its own state into the shared campaign model." },
    { name: "ingest_result", detail: "Module consumes normalized mission-result events and mutates campaign state." },
    { name: "advance_time", detail: "Module updates state between missions without touching MNW files directly." },
    { name: "prepare_generation", detail: "Module emits generation directives instead of writing scenarios itself." }
  ];

  root.innerHTML = `
    <div class="contract-list">
      ${contracts.map((item) => `
        <div class="contract">
          <div class="head"><strong>${item.name}</strong></div>
          <div class="muted">${item.detail}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function normalizePlatformName(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[(),:/-]/g, " ")
    .replace(/\b(ssn|uss|hms|rfs|sns|ship|vessel|ownship)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizePlatformName(value) {
  return new Set(
    normalizePlatformName(value)
      .split(" ")
      .filter((token) => token && !/^\d+$/.test(token))
  );
}

function resolveUnitIdFromStatus(statusItem, data) {
  const units = Object.values(data.state.order_of_battle || {});

  if (statusItem.entry_type === "ownship") {
    const playerUnits = units.filter((unit) => (unit.tags || []).includes("player"));
    if (playerUnits.length === 1) {
      return playerUnits[0].unit_id;
    }
  }

  const targetTokens = tokenizePlatformName(statusItem.platform_name);
  if (!targetTokens.size) {
    return null;
  }

  let bestUnitId = null;
  let bestScore = 0;

  for (const unit of units) {
    const candidates = [
      unit.name,
      unit.unit_id,
      ...((unit.notes && unit.notes.aliases) || [])
    ];
    const unitTokens = new Set();
    candidates.forEach((candidate) => {
      tokenizePlatformName(candidate).forEach((token) => unitTokens.add(token));
    });

    const overlap = [...targetTokens].filter((token) => unitTokens.has(token)).length;
    if (!overlap) {
      continue;
    }

    const union = new Set([...targetTokens, ...unitTokens]);
    let score = overlap / Math.max(union.size, 1);
    if ((unit.faction || "").toUpperCase() === (statusItem.country || "").toUpperCase()) {
      score += 0.25;
    }

    if (score > bestScore) {
      bestScore = score;
      bestUnitId = unit.unit_id;
    }
  }

  return bestScore >= 0.34 ? bestUnitId : null;
}

function extractElapsedHours(rawText) {
  const numericPatterns = [
    /Elapsed(?:\s+Hours)?\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /Mission Duration\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*hours?/i,
    /Time Elapsed\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*hours?/i
  ];
  for (const pattern of numericPatterns) {
    const match = rawText.match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }

  const clockPatterns = [
    /Elapsed(?:\s+Time)?\s*:\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/i,
    /Mission Duration\s*:\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/i
  ];
  for (const pattern of clockPatterns) {
    const match = rawText.match(pattern);
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = Number(match[3] || 0);
      return hours + (minutes / 60) + (seconds / 3600);
    }
  }

  return 0;
}

function classifyStatus(status) {
  const value = (status || "").toUpperCase();
  if (value.includes("DESTROY") || value.includes("SUNK") || value.includes("KILLED")) {
    return { event_type: "unit_destroyed", amount: 1 };
  }
  if (value.includes("NON-OP") || value.includes("NON OP")) {
    return { event_type: "unit_damaged", amount: 1 };
  }
  if (value.includes("HEAVY DAMAGE")) {
    return { event_type: "unit_damaged", amount: 0.75 };
  }
  if (value.includes("MODERATE DAMAGE")) {
    return { event_type: "unit_damaged", amount: 0.5 };
  }
  if (value.includes("LIGHT DAMAGE")) {
    return { event_type: "unit_damaged", amount: 0.25 };
  }
  return { event_type: null, amount: null };
}

function resolveUnitIdFromPlatformName(platformName, data) {
  return resolveUnitIdFromStatus({ entry_type: "vessel", platform_name: platformName, country: "" }, data);
}

function pickPreferredUnitId(events) {
  const resolved = events.find((event) => event.unit_id);
  return resolved ? resolved.unit_id : null;
}

function collectStatusItems(rawText, currentData) {
  const items = [];
  const statusRegex = /(-\s*)?(Ownship:|Vessel:)\s*(.+?)\s*-\s*Country:\s*(.+?)\s*[\r\n]+\s*-\s*Status:\s*(.+)/gi;
  let match;
  while ((match = statusRegex.exec(rawText)) !== null) {
    const entryType = match[2].trim().toLowerCase().replace(":", "");
    const platformName = match[3].trim();
    const country = match[4].trim();
    const status = match[5].trim();
    const resolvedUnitId = resolveUnitIdFromStatus(
      {
        entry_type: entryType,
        platform_name: platformName,
        country
      },
      currentData
    );

    items.push({
      entry_type: entryType,
      platform_name: platformName,
      normalized_platform_name: normalizePlatformName(platformName),
      country,
      status,
      resolved_unit_id: resolvedUnitId
    });
  }
  return items;
}

function parseDebriefText(rawText, currentData) {
  const missionMatch = rawText.match(/Mission Name:\s*(.+)/i);
  const missionName = missionMatch ? missionMatch[1].trim() : "";
  const missionMap = {
    "Bear Gap": "norwegian_shadow.norwegian_shadow.bear_gap",
    "Broken Datum": "norwegian_shadow.norwegian_shadow.broken_datum",
    "Bashi Screen": "iron_archipelago.iron_archipelago.bashi_screen",
    "Crosscurrent": "iron_archipelago.iron_archipelago.crosscurrent"
  };

  const outcome = /SUCCESS/i.test(rawText)
    ? "success"
    : /FAILED/i.test(rawText)
      ? "failure"
      : "unknown";

  const events = [];
  const parsedPlatforms = collectStatusItems(rawText, currentData);
  parsedPlatforms.forEach((item) => {
    const classification = classifyStatus(item.status);
    if (classification.event_type === "unit_destroyed") {
      events.push({
        event_type: classification.event_type,
        unit_id: item.resolved_unit_id,
        amount: classification.amount,
        weapon_key: null,
        metadata: {
          entry_type: item.entry_type,
          platform_name: item.platform_name,
          normalized_platform_name: item.normalized_platform_name,
          country: item.country,
          source: "ui_debrief_text_parser"
        }
      });
    } else if (classification.event_type === "unit_damaged") {
      events.push({
        event_type: classification.event_type,
        unit_id: item.resolved_unit_id,
        amount: classification.amount,
        weapon_key: null,
        metadata: {
          entry_type: item.entry_type,
          platform_name: item.platform_name,
          normalized_platform_name: item.normalized_platform_name,
          country: item.country,
          source: "ui_debrief_text_parser",
          interpreted_status: item.status
        }
      });
    }
  });

  return {
    mission_id: missionMap[missionName] || currentData.plan.mission_id || currentData.state.current_mission_id || "",
    outcome,
    time_elapsed_hours: extractElapsedHours(rawText),
    events,
    metadata: {
      source: "ui_debrief_text_parser",
      mission_name: missionName,
      parsed_status_count: parsedPlatforms.length,
      parsed_platforms: parsedPlatforms
    }
  };
}

function buildManualResult(data) {
  const missionId = document.getElementById("builder-mission-id").value.trim();
  const outcome = document.getElementById("builder-outcome").value;
  const hours = Number(document.getElementById("builder-hours").value || 0);
  const unitId = document.getElementById("builder-unit").value || null;
  const weaponKey = document.getElementById("builder-weapon-key").value.trim();
  const weaponAmount = Number(document.getElementById("builder-weapon-amount").value || 0);
  const damageAmount = Number(document.getElementById("builder-damage-amount").value || 0);
  const destroyed = document.getElementById("builder-destroyed").checked;
  const source = document.getElementById("builder-source").value.trim() || "ui_manual_builder";

  const events = [];

  if (unitId && weaponKey && weaponAmount > 0) {
    events.push({
      event_type: "weapon_expended",
      unit_id: unitId,
      amount: weaponAmount,
      weapon_key: weaponKey,
      metadata: {}
    });
  }

  if (unitId && damageAmount > 0) {
    events.push({
      event_type: "unit_damaged",
      unit_id: unitId,
      amount: damageAmount,
      weapon_key: null,
      metadata: {}
    });
  }

  if (unitId && destroyed) {
    events.push({
      event_type: "unit_destroyed",
      unit_id: unitId,
      amount: 1,
      weapon_key: null,
      metadata: {}
    });
  }

  return {
    mission_id: missionId || data.state.current_mission_id || "",
    outcome,
    time_elapsed_hours: hours,
    events,
    metadata: {
      source
    }
  };
}

function populateManualBuilderFromPayload(payload, data) {
  document.getElementById("builder-mission-id").value = payload.mission_id || data.state.current_mission_id || "";
  document.getElementById("builder-outcome").value = payload.outcome || "success";
  document.getElementById("builder-hours").value = payload.time_elapsed_hours ?? 0;
  document.getElementById("builder-source").value = payload.metadata?.source || "ui_manual_builder";

  const weaponEvent = payload.events.find((event) => event.event_type === "weapon_expended");
  const damageEvent = payload.events.find((event) => event.event_type === "unit_damaged");
  const destroyedEvent = payload.events.find((event) => event.event_type === "unit_destroyed");

  const preferredUnitId = pickPreferredUnitId(payload.events);
  if (preferredUnitId) {
    document.getElementById("builder-unit").value = preferredUnitId;
  }
  document.getElementById("builder-weapon-key").value = weaponEvent?.weapon_key || "";
  document.getElementById("builder-weapon-amount").value = weaponEvent?.amount ?? 0;
  document.getElementById("builder-damage-amount").value = damageEvent?.amount ?? 0;
  document.getElementById("builder-destroyed").checked = Boolean(destroyedEvent);
}

function renderManualBuilder(data) {
  const unitSelect = document.getElementById("builder-unit");
  const missionInput = document.getElementById("builder-mission-id");
  const preview = document.getElementById("builder-json");
  const generateButton = document.getElementById("builder-generate");
  const downloadButton = document.getElementById("builder-download");
  const copyButton = document.getElementById("builder-copy");

  const units = Object.values(data.state.order_of_battle);
  unitSelect.innerHTML = units.map((unit) => `
    <option value="${unit.unit_id}">${unit.name} (${unit.unit_id})</option>
  `).join("");

  missionInput.value = data.plan.mission_id || data.state.current_mission_id || "";

  const refreshPreview = () => {
    const payload = buildManualResult(data);
    preview.textContent = JSON.stringify(payload, null, 2);
    return payload;
  };

  [
    "builder-mission-id",
    "builder-outcome",
    "builder-hours",
    "builder-unit",
    "builder-weapon-key",
    "builder-weapon-amount",
    "builder-damage-amount",
    "builder-destroyed",
    "builder-source"
  ].forEach((id) => {
    const node = document.getElementById(id);
    node.addEventListener("input", refreshPreview);
    node.addEventListener("change", refreshPreview);
  });

  generateButton.addEventListener("click", refreshPreview);

  downloadButton.addEventListener("click", () => {
    const payload = refreshPreview();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "manual_result.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  copyButton.addEventListener("click", async () => {
    const payload = refreshPreview();
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    copyButton.textContent = "Copied";
    setTimeout(() => {
      copyButton.textContent = "Copy JSON";
    }, 1200);
  });

  refreshPreview();
}

function renderDebriefParser(data) {
  const input = document.getElementById("parser-input");
  const runButton = document.getElementById("parser-run");
  const applyButton = document.getElementById("parser-apply");
  const preview = document.getElementById("parser-json");

  let currentPayload = {};

  const refresh = () => {
    currentPayload = parseDebriefText(input.value, data);
    preview.textContent = JSON.stringify(currentPayload, null, 2);
    return currentPayload;
  };

  runButton.addEventListener("click", refresh);
  applyButton.addEventListener("click", () => {
    const payload = refresh();
    populateManualBuilderFromPayload(payload, data);
    document.getElementById("builder-generate").click();
  });

  refresh();
}

async function main() {
  let data;
  try {
    data = await loadJson("../generated/ui/runtime.json");
  } catch (_error) {
    data = await loadJson("./data/sample-runtime.json");
  }
  renderCampaignSummary(data);
  renderModuleSummary(data);
  renderHeroStats(data);
  renderOob(data);
  renderMissionResult(data);
  renderGenerationPlan(data);
  renderContracts();
  renderManualBuilder(data);
  renderDebriefParser(data);
}

main().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#ffb4b4;background:#07131d">${error.stack}</pre>`;
});
