import {
  buildCampaignBlueprint,
  getContinuationChoiceCatalog,
  getTheaterTemplates,
  getToneCatalog
} from "../shared/campaign-generator.mjs";

const desktopApi = globalThis.mnwDesktop ?? null;
let currentWizardBlueprint = null;
let desktopInfo = null;
let packageIdSyncEnabled = true;
let workflowStatus = null;

async function loadJson(targetPath) {
  const response = await fetch(targetPath);
  if (!response.ok) {
    throw new Error(`Failed to load ${targetPath}`);
  }
  return response.json();
}

function setWorkspaceMode(mode) {
  const views = {
    setup: document.getElementById("setup-view"),
    authoring: document.getElementById("authoring-view"),
    tracking: document.getElementById("tracking-view")
  };
  const buttons = {
    setup: document.getElementById("mode-setup"),
    authoring: document.getElementById("mode-authoring"),
    tracking: document.getElementById("mode-tracking")
  };

  Object.entries(views).forEach(([key, node]) => {
    node?.classList.toggle("active", key === mode);
  });
  Object.entries(buttons).forEach(([key, node]) => {
    node?.classList.toggle("active", key === mode);
  });

  document.querySelectorAll(".mode-scope").forEach((node) => {
    const showInSetup = node.classList.contains("mode-setup-only") && mode === "setup";
    const showInAuthoring = node.classList.contains("mode-authoring-only") && mode === "authoring";
    const showInTracking = node.classList.contains("mode-tracking-only") && mode === "tracking";
    node.classList.toggle("active", showInSetup || showInAuthoring || showInTracking);
  });
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

function renderDesktopStatus(info) {
  const root = document.getElementById("desktop-status");
  if (!info) {
    root.innerHTML = `
      <div class="stack-item">
        <div class="title">Browser Preview Mode</div>
        <div class="meta">Campaign previews are available. File generation, build, deploy, and ingest require the Electron desktop app.</div>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="stack-item">
      <div class="title">Electron Desktop Mode</div>
      <div class="meta">Platform: ${info.platform}</div>
    </div>
    <div class="stack-item">
      <div class="title">Bundled Content Root</div>
      <div class="meta">${info.repoRoot}</div>
    </div>
    <div class="stack-item">
      <div class="title">Writable Workspace</div>
      <div class="meta">${info.workspaceRoot}</div>
    </div>
  `;
}

function renderWorkflowStatus(status) {
  const root = document.getElementById("workflow-status");
  if (!root) {
    return;
  }
  if (!status) {
    root.innerHTML = `
      <div class="status-summary">
        <div class="title">Browser Preview Mode</div>
        <div class="meta">Workflow status becomes available in the packaged desktop app.</div>
      </div>
    `;
    return;
  }
  workflowStatus = status;
  const readyPill = status.readyToPlay
    ? '<span class="pill ok">Ready To Play</span>'
    : '<span class="pill warn">Needs Attention</span>';
  root.innerHTML = `
    <div class="status-summary">
      <div class="title">${status.campaignId}</div>
      <div class="meta">${readyPill}</div>
      <div class="meta">${status.recommendation}</div>
    </div>
    <div class="status-checklist">
      ${status.steps.map((step) => `
        <div class="status-step">
          <span class="pill ${step.state === "complete" ? "ok" : "warn"}">${step.state === "complete" ? "Done" : "Next"}</span>
          <div>
            <div class="status-step-label">${step.label}</div>
            <div class="status-step-detail">${step.detail}</div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

async function refreshWorkflowStatus() {
  if (!desktopApi?.getWorkflowStatus) {
    renderWorkflowStatus(null);
    return null;
  }
  const campaignId = document.getElementById("desktop-campaign-id")?.value.trim()
    || document.getElementById("settings-campaign-id")?.value.trim()
    || "silent_meridian";
  const packageId = document.getElementById("desktop-package-id")?.value.trim()
    || document.getElementById("settings-package-id")?.value.trim()
    || campaignId;
  const status = await desktopApi.getWorkflowStatus({ campaignId, packageId });
  renderWorkflowStatus(status);
  return status;
}

function setTrackingRuntimeAvailability(hasRuntime, message = "") {
  const emptyState = document.getElementById("tracking-empty-state");
  const runtimeContent = document.getElementById("tracking-runtime-content");
  const emptyCopy = document.getElementById("tracking-empty-copy");
  if (emptyState) {
    emptyState.style.display = hasRuntime ? "none" : "block";
  }
  if (runtimeContent) {
    runtimeContent.style.display = hasRuntime ? "block" : "none";
  }
  if (emptyCopy && message) {
    emptyCopy.textContent = message;
  }
}

function renderRuntimeUnavailable(reason) {
  const campaignSummary = document.getElementById("campaign-summary");
  const moduleSummary = document.getElementById("module-summary");
  const heroStats = document.getElementById("hero-stats");
  const message = reason || "Campaign Tracking now shows real runtime data only. No runtime snapshot has been loaded yet.";

  if (campaignSummary) {
    campaignSummary.innerHTML = `
      <div class="stack-item">
        <div class="title">No Runtime Loaded</div>
        <div class="meta">Refresh Campaign Tracking from current campaign state after the campaign exists in MNW.</div>
      </div>
    `;
  }

  if (moduleSummary) {
    moduleSummary.innerHTML = `
      <div class="stack-item">
        <div class="title">No Module State Loaded</div>
        <div class="meta">Module summaries appear here after a real runtime snapshot is exported.</div>
      </div>
    `;
  }

  if (heroStats) {
    heroStats.innerHTML = `
      <div class="stat">
        <div class="label">Runtime Status</div>
        <div class="value">Waiting</div>
      </div>
      <div class="stat">
        <div class="label">Source</div>
        <div class="value">Real Only</div>
      </div>
    `;
  }

  setTrackingRuntimeAvailability(false, message);
}

function renderHeroStats(data) {
  const root = document.getElementById("hero-stats");
  const stats = [
    ["Tracked Units", Object.keys(data.state.order_of_battle).length],
    ["Destroyed Units", Object.values(data.state.order_of_battle).filter((unit) => unit.destroyed).length],
    ["Active Modules", data.modules.enabled_modules.length],
    ["Generation Directives", data.plan.directives.length]
  ];
  root.innerHTML = stats.map(([label, value]) => `
    <div class="stat">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `).join("");
}

function readinessPill(unit) {
  if (unit.destroyed) {
    return '<span class="pill bad">Destroyed</span>';
  }
  if (unit.damage > 0.2 || unit.readiness < 0.8) {
    return '<span class="pill warn">Degraded</span>';
  }
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
      ${(data.result.events || []).map((event) => `
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
          <span class="pill ok">${data.plan.mission_id ?? "-"}</span>
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
    { name: "prepare_generation", detail: "Module emits generation directives instead of writing scenarios itself." },
    { name: "portable backend", detail: "The Electron path mirrors build, deploy, export, ingest, and campaign generation without removing the original scripts." }
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
    const candidates = [unit.name, unit.unit_id, ...((unit.notes && unit.notes.aliases) || [])];
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

function collectStatusItems(rawText, data) {
  const items = [];
  const statusRegex = /(-\s*)?(Ownship:|Vessel:)\s*(.+?)\s*-\s*Country:\s*(.+?)\s*[\r\n]+\s*-\s*Status:\s*(.+)/gi;
  let match;
  while ((match = statusRegex.exec(rawText)) !== null) {
    const entryType = match[2].trim().toLowerCase().replace(":", "");
    const platformName = match[3].trim();
    const country = match[4].trim();
    const status = match[5].trim();
    items.push({
      entry_type: entryType,
      platform_name: platformName,
      normalized_platform_name: normalizePlatformName(platformName),
      country,
      status,
      resolved_unit_id: resolveUnitIdFromStatus({ entry_type: entryType, platform_name: platformName, country }, data)
    });
  }
  return items;
}

function parseDebriefText(rawText, data) {
  const missionMatch = rawText.match(/Mission Name:\s*(.+)/i);
  const missionName = missionMatch ? missionMatch[1].trim() : "";
  const missionMap = {
    "Bear Gap": "norwegian_shadow.norwegian_shadow.bear_gap",
    "Broken Datum": "norwegian_shadow.norwegian_shadow.broken_datum",
    "Bashi Screen": "iron_archipelago.iron_archipelago.bashi_screen",
    "Crosscurrent": "iron_archipelago.iron_archipelago.crosscurrent"
  };
  const outcome = /SUCCESS/i.test(rawText) ? "success" : /FAILED/i.test(rawText) ? "failure" : "unknown";
  const parsedPlatforms = collectStatusItems(rawText, data);
  const events = parsedPlatforms.flatMap((item) => {
    const classification = classifyStatus(item.status);
    if (!classification.event_type) {
      return [];
    }
    return [{
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
        ...(classification.event_type === "unit_damaged" ? { interpreted_status: item.status } : {})
      }
    }];
  });

  return {
    mission_id: missionMap[missionName] || data.plan.mission_id || data.state.current_mission_id || "",
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

function pickPreferredUnitId(events) {
  const resolved = events.find((event) => event.unit_id);
  return resolved ? resolved.unit_id : null;
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
    events.push({ event_type: "weapon_expended", unit_id: unitId, amount: weaponAmount, weapon_key: weaponKey, metadata: {} });
  }
  if (unitId && damageAmount > 0) {
    events.push({ event_type: "unit_damaged", unit_id: unitId, amount: damageAmount, weapon_key: null, metadata: {} });
  }
  if (unitId && destroyed) {
    events.push({ event_type: "unit_destroyed", unit_id: unitId, amount: 1, weapon_key: null, metadata: {} });
  }
  return {
    mission_id: missionId || data.state.current_mission_id || "",
    outcome,
    time_elapsed_hours: hours,
    events,
    metadata: { source }
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
  const units = Object.values(data.state.order_of_battle);
  const unitSelect = document.getElementById("builder-unit");
  const missionInput = document.getElementById("builder-mission-id");
  const preview = document.getElementById("builder-json");
  const saveButton = document.getElementById("builder-save");
  unitSelect.innerHTML = units.map((unit) => `
    <option value="${unit.unit_id}">${unit.name} (${unit.unit_id})</option>
  `).join("");
  missionInput.value = data.plan.mission_id || data.state.current_mission_id || "";
  setBuilderStatus("Build the result here, then save it directly. Download and copy remain available only if you want a record outside the app.");

  const refreshPreview = () => {
    const payload = buildManualResult(data);
    preview.textContent = JSON.stringify(payload, null, 2);
    return payload;
  };

  ["builder-mission-id", "builder-outcome", "builder-hours", "builder-unit", "builder-weapon-key", "builder-weapon-amount", "builder-damage-amount", "builder-destroyed", "builder-source"].forEach((id) => {
    const node = document.getElementById(id);
    node.oninput = refreshPreview;
    node.onchange = refreshPreview;
  });
  document.getElementById("builder-generate").onclick = refreshPreview;
  document.getElementById("builder-download").onclick = () => {
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
  };
  document.getElementById("builder-copy").onclick = async () => {
    const payload = refreshPreview();
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };
  saveButton.onclick = async () => {
    const payload = refreshPreview();
    if (!desktopApi?.saveManualResult) {
      setBuilderStatus("Desktop app required to save manual results directly into campaign state.");
      return;
    }
    if (!payload.mission_id) {
      setBuilderStatus("Mission ID is required before saving the result.");
      return;
    }
    const campaignId = document.getElementById("desktop-campaign-id").value.trim() || data.state.metadata.campaign_id || "silent_meridian";
    setBuilderStatus(`Saving result for ${payload.mission_id} and refreshing Campaign Tracking...`);
    const result = await desktopApi.saveManualResult({
      campaignId,
      result: payload,
      advanceHours: 24.0
    });
    setDesktopOutput(result);
    setDesktopOpsStatus(`Manual result saved for ${campaignId}.`);
    setBuilderStatus(`Saved ${payload.outcome} result for ${payload.mission_id}. Campaign Tracking refreshed.`);
    if (result.runtime?.payload) {
      hydrateRuntime(result.runtime.payload);
      setWorkspaceMode("tracking");
    }
    await refreshWorkflowStatus();
  };
  refreshPreview();
}

function renderDebriefParser(data) {
  const input = document.getElementById("parser-input");
  const preview = document.getElementById("parser-json");
  const refresh = () => {
    const payload = parseDebriefText(input.value, data);
    preview.textContent = JSON.stringify(payload, null, 2);
    return payload;
  };
  document.getElementById("parser-run").onclick = refresh;
  document.getElementById("parser-apply").onclick = () => {
    const payload = refresh();
    populateManualBuilderFromPayload(payload, data);
    document.getElementById("builder-generate").click();
  };
  refresh();
}

function renderSettingsPreview(settings) {
  const preferredCampaignId = settings.preferredCampaignId || "silent_meridian";
  const preferredPackageId = settings.preferredPackageId || preferredCampaignId || "silent_meridian";
  document.getElementById("settings-json").textContent = JSON.stringify(settings, null, 2);
  document.getElementById("settings-game-path").value = settings.gameCampaignPath || "";
  document.getElementById("settings-user-path").value = settings.userCampaignPath || "";
  document.getElementById("settings-campaign-id").value = preferredCampaignId;
  document.getElementById("settings-package-id").value = preferredPackageId;
  document.getElementById("settings-source-dir").value = settings.preferredPackageSourceDir || "";
  document.getElementById("settings-output-path").value = settings.preferredPackageOutputPath || "";
  packageIdSyncEnabled = preferredPackageId === preferredCampaignId;
  document.getElementById("settings-package-sync").checked = packageIdSyncEnabled;
  syncDesktopOpsDefaults({
    preferredCampaignId,
    preferredPackageId
  });
  syncAuthoringDefaults({
    preferredCampaignId
  }, {
    refreshPreview: Boolean(document.getElementById("wizard-theater"))
  });
}

function syncPackageIdFromCampaign() {
  if (packageIdSyncEnabled) {
    document.getElementById("settings-package-id").value = document.getElementById("settings-campaign-id").value.trim();
  }
  syncDesktopOpsDefaults({
    preferredCampaignId: document.getElementById("settings-campaign-id").value.trim(),
    preferredPackageId: document.getElementById("settings-package-id").value.trim()
  });
  syncAuthoringDefaults({
    preferredCampaignId: document.getElementById("settings-campaign-id").value.trim()
  });
}

function syncDesktopOpsDefaults({ preferredCampaignId, preferredPackageId }) {
  const desktopCampaignId = document.getElementById("desktop-campaign-id");
  const desktopPackageId = document.getElementById("desktop-package-id");
  if (desktopCampaignId) {
    desktopCampaignId.value = preferredCampaignId || "silent_meridian";
  }
  if (desktopPackageId) {
    desktopPackageId.value = preferredPackageId || preferredCampaignId || "silent_meridian";
  }
}

function campaignIdToTitle(campaignId) {
  return String(campaignId || "")
    .trim()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function syncAuthoringDefaults({ preferredCampaignId }, options = {}) {
  const wizardCampaignId = document.getElementById("wizard-campaign-id");
  const wizardTitle = document.getElementById("wizard-title");
  if (wizardCampaignId) {
    wizardCampaignId.value = preferredCampaignId || "generated_campaign";
  }
  if (wizardTitle && options.syncTitle !== false) {
    wizardTitle.value = campaignIdToTitle(preferredCampaignId) || "Generated Campaign";
  }
  if (options.refreshPreview !== false && document.getElementById("wizard-theater")) {
    renderWizardPreview(buildCampaignBlueprint(collectWizardSpec()));
  }
}

function collectDesktopSettingsForm() {
  return {
    gameCampaignPath: document.getElementById("settings-game-path").value.trim(),
    userCampaignPath: document.getElementById("settings-user-path").value.trim(),
    preferredCampaignId: document.getElementById("settings-campaign-id").value.trim() || "silent_meridian",
    preferredPackageId: document.getElementById("settings-package-id").value.trim() || document.getElementById("settings-campaign-id").value.trim() || "silent_meridian",
    preferredPackageSourceDir: document.getElementById("settings-source-dir").value.trim(),
    preferredPackageOutputPath: document.getElementById("settings-output-path").value.trim(),
    firstLaunchComplete: true
  };
}

function setSettingsStatus(message) {
  document.getElementById("settings-status").textContent = message;
}

function renderWizardPreview(blueprint) {
  currentWizardBlueprint = blueprint;
  const enemySummary = blueprint.enemies
    .map((enemy) => `${enemy.name} | ${enemy.faction} ${enemy.platformType}`)
    .join("<br>");
  document.getElementById("wizard-summary").innerHTML = `
    <div class="wizard-block">
      <strong>${blueprint.title}</strong>
      <div class="wizard-meta">${blueprint.theaterName} | ${blueprint.toneLabel} | Seed ${blueprint.seed}</div>
      <div class="muted">${blueprint.description}</div>
    </div>
    <div class="wizard-block">
      <strong>Player</strong>
      <div class="wizard-meta">${blueprint.player.name} | ${blueprint.player.faction} ${blueprint.player.platformType}</div>
      <div class="muted">DBID ${blueprint.player.dbid} | Package namespace: ${blueprint.packageNamespace}</div>
    </div>
    <div class="wizard-block">
      <strong>Opposing Force</strong>
      <div class="wizard-meta">${blueprint.enemies.length} tracked opposing units</div>
      <div class="muted">${enemySummary}</div>
    </div>
    <div class="wizard-block">
      <strong>Route Logic</strong>
      <div class="wizard-meta">${blueprint.family} geometry</div>
      <div class="muted">Player and opposition pathing are seeded from theater corridors, then jittered deterministically from the campaign seed.</div>
    </div>
  `;
  document.getElementById("wizard-scenarios").innerHTML = blueprint.scenarios.map((scenario, index) => `
    <div class="wizard-block">
      <strong>Scenario ${index + 1}: ${scenario.name}</strong>
      <div class="wizard-meta">${scenario.missionId}</div>
      ${scenario.geometry.routeVariantLabel ? `<div class="wizard-meta">Route Variant: ${scenario.geometry.routeVariantLabel}</div>` : ""}
      <div class="muted">${scenario.summary}</div>
      <div class="muted"><code>${scenario.geometry.routeSummary}</code></div>
      <div class="muted">Enemy Transit: ${scenario.geometry.enemyTransitSummary}</div>
    </div>
  `).join("");
}

function collectWizardSpec() {
  return {
    title: document.getElementById("wizard-title").value.trim(),
    campaignId: document.getElementById("wizard-campaign-id").value.trim(),
    theater: document.getElementById("wizard-theater").value,
    tone: document.getElementById("wizard-tone").value,
    year: Number(document.getElementById("wizard-year").value || 2028),
    scenarioCount: Number(document.getElementById("wizard-scenario-count").value || 3),
    playerName: document.getElementById("wizard-player-name").value.trim()
  };
}

function setWizardStatus(message) {
  document.getElementById("wizard-status").textContent = message;
}

function setDesktopOpsStatus(message) {
  document.getElementById("desktop-ops-status").textContent = message;
}

function setBuilderStatus(message) {
  const node = document.getElementById("builder-status");
  if (node) {
    node.textContent = message;
  }
}

function setDesktopOutput(value) {
  document.getElementById("desktop-output").textContent = JSON.stringify(value, null, 2);
}

function setContinuationStatus(message) {
  const node = document.getElementById("continuation-status");
  if (node) {
    node.textContent = message;
  }
}

function renderContinuationPlanner(data) {
  const objectiveSelect = document.getElementById("continuation-objective");
  const riskSelect = document.getElementById("continuation-risk");
  const tempoSelect = document.getElementById("continuation-tempo");
  const preview = document.getElementById("continuation-preview");
  const actionButton = document.getElementById("continuation-generate");
  if (!objectiveSelect || !riskSelect || !tempoSelect || !preview || !actionButton) {
    return;
  }

  const catalog = getContinuationChoiceCatalog();
  const currentMissionId = data.state.current_mission_id || "-";
  const missionCount = Array.isArray(data.state.mission_history) ? data.state.mission_history.length : 0;

  const refreshPreview = () => {
    const objective = catalog.objectives[objectiveSelect.value] || catalog.objectives.pursue_contact;
    const risk = catalog.riskPostures[riskSelect.value] || catalog.riskPostures.balanced;
    const tempo = catalog.operationalTempos[tempoSelect.value] || catalog.operationalTempos.deliberate;
    preview.innerHTML = `
      <div class="wizard-block">
        <strong>${objective.label}</strong>
        <div class="wizard-meta">${risk.label} posture | ${tempo.label} tempo</div>
        <div class="muted">${objective.summaries[data.state.world_state?.route_family] || objective.summaries.surface_shadow}</div>
      </div>
      <div class="wizard-block">
        <strong>Campaign State</strong>
        <div class="wizard-meta">Current mission: ${currentMissionId}</div>
        <div class="muted">${missionCount} mission result${missionCount === 1 ? "" : "s"} recorded. The new scenario will be appended to the existing campaign chain and staged for immediate play.</div>
      </div>
      <div class="wizard-block">
        <strong>Command Intent</strong>
        <div class="muted">${risk.cue}</div>
      </div>
    `;
  };

  objectiveSelect.onchange = refreshPreview;
  riskSelect.onchange = refreshPreview;
  tempoSelect.onchange = refreshPreview;
  refreshPreview();

  actionButton.onclick = async () => {
    if (!desktopApi?.continueCampaign) {
      setContinuationStatus("Desktop app required to append and deploy continuation scenarios.");
      return;
    }
    const campaignId = document.getElementById("desktop-campaign-id").value.trim() || data.state.metadata.campaign_id || "silent_meridian";
    setContinuationStatus("Appending the next scenario, rebuilding the package, and refreshing runtime state...");
    const result = await desktopApi.continueCampaign({
      campaignId,
      objective: objectiveSelect.value,
      riskPosture: riskSelect.value,
      operationalTempo: tempoSelect.value
    });
    setDesktopOutput(result);
    setContinuationStatus(`Appended ${result.continuation.mission_name} and refreshed Campaign Tracking.`);
    if (result.runtime?.payload) {
      hydrateRuntime(result.runtime.payload);
    } else if (result.continuation?.runtime) {
      hydrateRuntime(result.continuation.runtime);
    }
    await refreshWorkflowStatus();
  };
}

function populateWizardSelectors() {
  const theaterSelect = document.getElementById("wizard-theater");
  const toneSelect = document.getElementById("wizard-tone");
  if (!theaterSelect || !toneSelect) {
    return;
  }
  theaterSelect.innerHTML = Object.values(getTheaterTemplates()).map((theater) => `
    <option value="${theater.id}">${theater.label}</option>
  `).join("");
  toneSelect.innerHTML = Object.entries(getToneCatalog()).map(([key, tone]) => `
    <option value="${key}">${tone.label}</option>
  `).join("");
  theaterSelect.value = "luzon_strait";
  toneSelect.value = "surveillance";
}

function syncWizardDefaultsWithTheater() {
  const theaterSelect = document.getElementById("wizard-theater");
  if (!theaterSelect) {
    return;
  }
  const theater = getTheaterTemplates()[theaterSelect.value];
  if (!theater) {
    return;
  }
  document.getElementById("wizard-year").value = theater.defaultYear;
  document.getElementById("wizard-player-name").value = theater.player.name;
}

function toggleDesktopOnlyButtons(enabled) {
  ["wizard-generate", "wizard-build", "wizard-deploy", "desktop-export-runtime", "builder-save", "continuation-generate"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = !enabled;
    }
  });
}

function initializeGuideLink() {
  const button = document.getElementById("tracking-open-guide");
  if (!button) {
    return;
  }
  button.onclick = async () => {
    if (desktopApi?.openDesktopGuide) {
      await desktopApi.openDesktopGuide();
      return;
    }
    window.open("../DESKTOP_APP_GUIDE.md", "_blank", "noopener,noreferrer");
  };
}

async function initializeWizard() {
  if (!document.getElementById("wizard-theater")) {
    return;
  }
  populateWizardSelectors();
  syncWizardDefaultsWithTheater();
  renderWizardPreview(buildCampaignBlueprint(collectWizardSpec()));
  document.getElementById("wizard-theater").onchange = () => {
    syncWizardDefaultsWithTheater();
    renderWizardPreview(buildCampaignBlueprint(collectWizardSpec()));
  };
  ["wizard-title", "wizard-campaign-id", "wizard-tone", "wizard-year", "wizard-scenario-count", "wizard-player-name"].forEach((id) => {
    document.getElementById(id).oninput = () => renderWizardPreview(buildCampaignBlueprint(collectWizardSpec()));
  });
  document.getElementById("wizard-preview").onclick = () => {
    renderWizardPreview(buildCampaignBlueprint(collectWizardSpec()));
    setWizardStatus("Preview updated using the deterministic rule-based generator.");
  };
  document.getElementById("wizard-generate").onclick = async () => {
    if (!desktopApi) {
      setWizardStatus("Desktop app required to write campaign files.");
      return;
    }
    const result = await desktopApi.generateCampaign({ spec: collectWizardSpec(), dryRun: false });
    document.getElementById("desktop-package-id").value = result.blueprint.campaignId;
    document.getElementById("desktop-campaign-id").value = result.blueprint.campaignId;
    document.getElementById("settings-campaign-id").value = result.blueprint.campaignId;
    document.getElementById("settings-package-id").value = result.blueprint.campaignId;
    document.getElementById("settings-source-dir").value = `${desktopInfo.workspaceRoot}/src/packages/${result.blueprint.campaignId}`;
    document.getElementById("settings-output-path").value = `${desktopInfo.workspaceRoot}/dist/${result.blueprint.campaignId}.kyt`;
    setDesktopOutput(result);
    setWizardStatus(`Campaign files written for ${result.blueprint.campaignId}. Campaign Tracking is initialized for the first mission.`);
    if (result.runtime?.payload) {
      hydrateRuntime(result.runtime.payload);
    }
    await refreshWorkflowStatus();
  };
  document.getElementById("wizard-build").onclick = async () => {
    if (!desktopApi) {
      setWizardStatus("Desktop app required to build packages.");
      return;
    }
    const blueprint = currentWizardBlueprint || buildCampaignBlueprint(collectWizardSpec());
    const result = await desktopApi.buildPackage({
      sourceDir: `${desktopInfo.workspaceRoot}/src/packages/${blueprint.campaignId}`,
      outputPath: `${desktopInfo.workspaceRoot}/dist/${blueprint.campaignId}.kyt`
    });
    setDesktopOutput(result);
    setWizardStatus(`Built ${blueprint.campaignId}.kyt with MD5 ${result.hash}.`);
    await refreshWorkflowStatus();
  };
  document.getElementById("wizard-deploy").onclick = async () => {
    if (!desktopApi) {
      setWizardStatus("Desktop app required to deploy packages.");
      return;
    }
    const blueprint = currentWizardBlueprint || buildCampaignBlueprint(collectWizardSpec());
    const result = await desktopApi.deployPackage({
      packagePath: `${desktopInfo.workspaceRoot}/dist/${blueprint.campaignId}.kyt`
    });
    setDesktopOutput(result);
    setWizardStatus(`Deployed ${blueprint.campaignId}.kyt to the configured campaign targets.`);
    await refreshWorkflowStatus();
  };
}

async function initializeDesktopOps() {
  const exportButton = document.getElementById("desktop-export-runtime");
  if (!exportButton) {
    return;
  }
  exportButton.onclick = async () => {
    if (!desktopApi) {
      setDesktopOpsStatus("Desktop app required to refresh runtime state.");
      return;
    }
    const campaignId = document.getElementById("desktop-campaign-id").value.trim() || "silent_meridian";
    const result = await desktopApi.exportRuntime({ campaignId });
    setDesktopOutput(result);
    setDesktopOpsStatus(`Campaign Tracking refreshed from current state for ${campaignId}.`);
    if (result.payload) {
      hydrateRuntime(result.payload);
      setWorkspaceMode("tracking");
    }
    await refreshWorkflowStatus();
  };
}

async function initializeDesktopSettings() {
  const fallbackSettings = {
    ...(desktopInfo?.defaults || {}),
    preferredCampaignId: "silent_meridian",
    preferredPackageId: "silent_meridian",
    preferredPackageSourceDir: desktopInfo ? `${desktopInfo.workspaceRoot}/src/packages/iron_archipelago` : "",
    preferredPackageOutputPath: desktopInfo ? `${desktopInfo.workspaceRoot}/dist/iron_archipelago.kyt` : "",
    firstLaunchComplete: false
  };
  const settings = desktopApi ? await desktopApi.loadSettings() : fallbackSettings;
  renderSettingsPreview(settings);
  syncPackageIdFromCampaign();
  document.getElementById("mode-setup")?.addEventListener("click", () => setWorkspaceMode("setup"));
  document.getElementById("mode-authoring")?.addEventListener("click", () => setWorkspaceMode("authoring"));
  document.getElementById("mode-tracking")?.addEventListener("click", () => setWorkspaceMode("tracking"));

  document.getElementById("settings-package-sync")?.addEventListener("change", (event) => {
    packageIdSyncEnabled = event.target.checked;
    if (packageIdSyncEnabled) {
      syncPackageIdFromCampaign();
    }
  });

  document.getElementById("settings-campaign-id")?.addEventListener("input", syncPackageIdFromCampaign);
  document.getElementById("settings-package-id")?.addEventListener("input", () => {
    syncDesktopOpsDefaults({
      preferredCampaignId: document.getElementById("settings-campaign-id").value.trim(),
      preferredPackageId: document.getElementById("settings-package-id").value.trim()
    });
    syncAuthoringDefaults({
      preferredCampaignId: document.getElementById("settings-campaign-id").value.trim()
    }, {
      syncTitle: false
    });
  });

  document.getElementById("settings-save")?.addEventListener("click", async () => {
    if (!desktopApi) {
      setSettingsStatus("Desktop app required to persist settings.");
      return;
    }
    const saved = await desktopApi.saveSettings(collectDesktopSettingsForm());
    renderSettingsPreview(saved);
    setSettingsStatus("Desktop settings saved.");
    await refreshWorkflowStatus();
  });

  document.getElementById("settings-use-generated")?.addEventListener("click", async () => {
    const campaignId = document.getElementById("wizard-campaign-id")?.value.trim() || "generated_campaign";
    const baseRoot = desktopInfo?.workspaceRoot || "";
    const settingsCampaignId = document.getElementById("settings-campaign-id");
    const settingsPackageId = document.getElementById("settings-package-id");
    const settingsSourceDir = document.getElementById("settings-source-dir");
    const settingsOutputPath = document.getElementById("settings-output-path");
    if (settingsCampaignId) {
      settingsCampaignId.value = campaignId;
    }
    if (packageIdSyncEnabled && settingsPackageId) {
      settingsPackageId.value = campaignId;
    }
    if (settingsSourceDir) {
      settingsSourceDir.value = baseRoot ? `${baseRoot}/src/packages/${campaignId}` : "";
    }
    if (settingsOutputPath) {
      settingsOutputPath.value = baseRoot ? `${baseRoot}/dist/${campaignId}.kyt` : "";
    }
    syncDesktopOpsDefaults({
      preferredCampaignId: campaignId,
      preferredPackageId: settingsPackageId?.value.trim() || campaignId
    });
    syncAuthoringDefaults({
      preferredCampaignId: campaignId
    });
    setSettingsStatus(`Prepared settings defaults for ${campaignId}. Save them to persist.`);
    await refreshWorkflowStatus();
  });

  if (!settings.firstLaunchComplete) {
    setWorkspaceMode("setup");
    setSettingsStatus("First launch detected. Confirm the MNW paths and preferred IDs, then save settings once.");
  } else {
    setWorkspaceMode("authoring");
    setSettingsStatus("Desktop settings loaded.");
  }
}

function hydrateRuntime(data) {
  setTrackingRuntimeAvailability(true);
  renderCampaignSummary(data);
  renderModuleSummary(data);
  renderHeroStats(data);
  renderContinuationPlanner(data);
  renderOob(data);
  renderMissionResult(data);
  renderGenerationPlan(data);
  renderContracts();
  renderManualBuilder(data);
  renderDebriefParser(data);
}

async function loadInitialRuntime() {
  if (desktopApi) {
    desktopInfo = await desktopApi.getDesktopInfo();
    renderDesktopStatus(desktopInfo);
    toggleDesktopOnlyButtons(true);
    const result = await desktopApi.loadRuntimeSnapshot();
    return result?.payload || null;
  }
  renderDesktopStatus(null);
  toggleDesktopOnlyButtons(false);
  try {
    return await loadJson("../generated/ui/runtime.json");
  } catch {
    return null;
  }
}

async function main() {
  const runtime = await loadInitialRuntime();
  await refreshWorkflowStatus();
  if (runtime) {
    hydrateRuntime(runtime);
  } else {
    renderRuntimeUnavailable("No runtime snapshot exists yet. Generate a campaign first to initialize tracking, or refresh from current campaign state after MNW has loaded the campaign.");
  }
  initializeGuideLink();
  await initializeDesktopSettings();
  await initializeWizard();
  await initializeDesktopOps();
}

main().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#ffb4b4;background:#07131d">${error.stack}</pre>`;
});
