import {
  buildCampaignBlueprint,
  getExperimentalPlotSeedCatalog,
  getCampaignClimateCatalog,
  getContinuationChoiceCatalog,
  getMissionStanceCatalog,
  getMissionTypeCatalog,
  getRoeCatalog,
  getTheaterTemplates,
} from "../shared/campaign-generator.mjs";

const desktopApi = globalThis.mnwDesktop ?? null;
let currentWizardBlueprint = null;
let desktopInfo = null;
let packageIdSyncEnabled = true;
let workflowStatus = null;
let authoringStageOverride = null;
let currentOperationalMap = null;
let currentRuntimePayload = null;

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
  const worldState = data.state.world_state || {};
  const items = [
    ["Campaign", data.state.metadata.title],
    ["Campaign ID", data.state.metadata.campaign_id],
    ["Theater", data.state.metadata.theater],
    ["Campaign Climate", worldState.campaign_climate || worldState.tone || "-"],
    ["Mission Type", worldState.mission_type || data.state.metadata.mission_type || "-"],
    ["Experimental", worldState.experimental_features?.enabled ? `On (${worldState.experimental_features.plotSeedLabel || worldState.experimental_features.plotSeed || "Custom"})` : "Off"],
    ["Mission Stance", worldState.mission_stance || worldState.posture || "-"],
    ["ROE", worldState.rules_of_engagement || "-"],
    ["Escalation", worldState.escalation_key || "-"],
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

function getAuthoringFlowStepKey(status) {
  if (authoringStageOverride) {
    return authoringStageOverride;
  }
  if (!status?.steps?.length) {
    return "setup";
  }
  const nextPending = status.steps.find((step) => ["setup", "files", "build", "deploy"].includes(step.key) && step.state !== "complete");
  if (nextPending) {
    return nextPending.key;
  }
  if (!status.readyToPlay) {
    return "ready";
  }
  return "ready";
}

function getVisibleAuthoringFlowSteps(status) {
  if (!status) {
    return [];
  }
  const flowSteps = [
    ...status.steps.filter((step) => ["setup", "files", "build", "deploy"].includes(step.key)),
    {
      key: "ready",
      label: "Ready In MNW",
      state: status.readyToPlay ? "complete" : "pending",
      detail: status.readyToPlay
        ? "Package is deployed and Campaign Tracking has a live runtime snapshot."
        : "After deploy, load the campaign in MNW and refresh Campaign Tracking."
    }
  ];

  if (!authoringStageOverride) {
    return flowSteps;
  }

  const overrideIndex = flowSteps.findIndex((step) => step.key === authoringStageOverride);
  if (overrideIndex === -1) {
    return flowSteps;
  }

  return flowSteps.map((step, index) => {
    if (index < overrideIndex) {
      return step;
    }
    if (index === overrideIndex) {
      return { ...step, state: "pending" };
    }
    return { ...step, state: "pending" };
  });
}

function updateAuthoringActionState(status = workflowStatus) {
  const currentStepKey = getAuthoringFlowStepKey(status);
  const desktopEnabled = Boolean(desktopApi);
  const actionButtons = {
    files: document.getElementById("wizard-generate"),
    build: document.getElementById("wizard-build"),
    deploy: document.getElementById("wizard-deploy")
  };

  Object.entries(actionButtons).forEach(([key, button]) => {
    if (!button) {
      return;
    }
    button.disabled = !desktopEnabled || currentStepKey !== key;
  });

  const startOverButton = document.getElementById("wizard-start-over");
  if (startOverButton) {
    const hasProgress = Boolean(status?.steps?.some((step) => step.state === "complete")) || Boolean(authoringStageOverride);
    startOverButton.disabled = !desktopEnabled || !hasProgress;
  }
}

function renderWorkflowStatus(status) {
  workflowStatus = status;
  const root = document.getElementById("authoring-flow");
  const summary = document.getElementById("authoring-flow-summary");
  const readyBadge = document.getElementById("authoring-flow-ready");
  if (!root || !summary || !readyBadge) {
    return;
  }
  if (!status) {
    summary.textContent = "Workflow state is only available in the Electron desktop app.";
    readyBadge.textContent = "Browser Preview";
    root.innerHTML = `
      <div class="flow-step current">
        <div class="flow-step-head">
          <div class="flow-step-index">Step 01</div>
          <div class="flow-step-state">Preview Only</div>
        </div>
        <div class="flow-step-title">Desktop Setup</div>
        <div class="flow-step-detail">Launch the packaged desktop app to save settings, write files, build, deploy, and track workflow progress.</div>
      </div>
    `;
    updateAuthoringActionState(null);
    return;
  }

  const flowSteps = getVisibleAuthoringFlowSteps(status);
  const currentKey = getAuthoringFlowStepKey(status);

  summary.textContent = authoringStageOverride
    ? `${status.campaignId}: Start over is active. Follow the highlighted step to rebuild the package flow.`
    : `${status.campaignId}: ${status.recommendation}`;
  readyBadge.textContent = status.readyToPlay && !authoringStageOverride ? "Ready To Play" : "In Progress";
  readyBadge.className = `badge ${status.readyToPlay && !authoringStageOverride ? "" : "alt"}`;
  root.innerHTML = flowSteps.map((step, index) => {
    const stateLabel = step.state === "complete" ? "Complete" : currentKey === step.key ? "Current" : "Waiting";
    const stateClass = step.state === "complete" ? "complete" : currentKey === step.key ? "current" : "locked pending";
    return `
      <div class="flow-step ${stateClass}">
        <div class="flow-step-head">
          <div class="flow-step-index">Step ${String(index + 1).padStart(2, "0")}</div>
          <div class="flow-step-state">${stateLabel}</div>
        </div>
        <div class="flow-step-title">${step.label}</div>
        <div class="flow-step-detail">${step.detail}</div>
      </div>
    `;
  }).join("");
  updateAuthoringActionState(status);
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
  currentRuntimePayload = null;
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
  renderAisContacts({ contacts: [] });
  setAisStatus("No AIS data loaded.");
}

function renderHeroStats(data) {
  const root = document.getElementById("hero-stats");
  const worldState = data.state.world_state || {};
  const stats = [
    ["Tracked Units", Object.keys(data.state.order_of_battle).length],
    ["Destroyed Units", Object.values(data.state.order_of_battle).filter((unit) => unit.destroyed).length],
    ["Active Modules", data.modules.enabled_modules.length],
    ["Generation Directives", data.plan.directives.length],
    ["Escalation", worldState.escalation_key || "-"],
    ["Mission Type", worldState.mission_type || "-"],
    ["ROE", worldState.rules_of_engagement || "-"]
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
  const maskedSettings = {
    ...settings,
    ais: settings.ais ? {
      ...settings.ais,
      token: settings.ais.token ? "********" : "",
      latestSample: settings.ais.latestSample ? {
        fetchedAt: settings.ais.latestSample.fetchedAt || null,
        theaterName: settings.ais.latestSample.theaterName || null,
        radiusKm: settings.ais.latestSample.radiusKm || null,
        contactCount: Array.isArray(settings.ais.latestSample.contacts) ? settings.ais.latestSample.contacts.length : 0
      } : null
    } : undefined
  };
  document.getElementById("settings-json").textContent = JSON.stringify(maskedSettings, null, 2);
  document.getElementById("settings-game-path").value = settings.gameCampaignPath || "";
  document.getElementById("settings-user-path").value = settings.userCampaignPath || "";
  document.getElementById("settings-campaign-id").value = preferredCampaignId;
  document.getElementById("settings-package-id").value = preferredPackageId;
  document.getElementById("settings-source-dir").value = settings.preferredPackageSourceDir || "";
  document.getElementById("settings-output-path").value = settings.preferredPackageOutputPath || "";
  document.getElementById("settings-ais-enabled").checked = Boolean(settings.ais?.enabled);
  document.getElementById("settings-ais-radius-km").value = settings.ais?.queryRadiusKm || 160;
  document.getElementById("settings-ais-token").value = settings.ais?.token || "";
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
    refreshCurrentWizardBlueprint();
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
    ais: {
      enabled: document.getElementById("settings-ais-enabled").checked,
      provider: "aisstream",
      token: document.getElementById("settings-ais-token").value.trim(),
      queryRadiusKm: Number(document.getElementById("settings-ais-radius-km").value || 160)
    },
    firstLaunchComplete: true
  };
}

function mergeDetectedDesktopSettings(settings = {}, detected = {}) {
  return {
    ...settings,
    gameCampaignPath: settings.gameCampaignPath || detected.gameCampaignPath || "",
    userCampaignPath: settings.userCampaignPath || detected.userCampaignPath || "",
    preferredCampaignId: settings.preferredCampaignId || detected.preferredCampaignId || "silent_meridian",
    preferredPackageId: settings.preferredPackageId || detected.preferredPackageId || settings.preferredCampaignId || detected.preferredCampaignId || "silent_meridian",
    preferredPackageSourceDir: settings.preferredPackageSourceDir || detected.preferredPackageSourceDir || "",
    preferredPackageOutputPath: settings.preferredPackageOutputPath || detected.preferredPackageOutputPath || ""
  };
}

function applyDetectedDesktopPaths(detected = {}) {
  if (detected.gameCampaignPath) {
    document.getElementById("settings-game-path").value = detected.gameCampaignPath;
  }
  if (detected.userCampaignPath) {
    document.getElementById("settings-user-path").value = detected.userCampaignPath;
  }
  if (detected.preferredCampaignId && !document.getElementById("settings-campaign-id").value.trim()) {
    document.getElementById("settings-campaign-id").value = detected.preferredCampaignId;
  }
  if (detected.preferredPackageId && (!document.getElementById("settings-package-id").value.trim() || packageIdSyncEnabled)) {
    document.getElementById("settings-package-id").value = detected.preferredPackageId;
  }
  if (detected.preferredPackageSourceDir) {
    document.getElementById("settings-source-dir").value = detected.preferredPackageSourceDir;
  }
  if (detected.preferredPackageOutputPath) {
    document.getElementById("settings-output-path").value = detected.preferredPackageOutputPath;
  }
  syncDesktopOpsDefaults({
    preferredCampaignId: document.getElementById("settings-campaign-id").value.trim(),
    preferredPackageId: document.getElementById("settings-package-id").value.trim()
  });
  syncAuthoringDefaults({
    preferredCampaignId: document.getElementById("settings-campaign-id").value.trim()
  }, {
    syncTitle: false
  });
}

function setSettingsStatus(message) {
  document.getElementById("settings-status").textContent = message;
}

function refreshCurrentWizardBlueprint() {
  currentWizardBlueprint = buildCampaignBlueprint(collectWizardSpec());
  if (currentWizardBlueprint?.warnings?.length) {
    setWizardStatus(currentWizardBlueprint.warnings.join(" "));
  }
  return currentWizardBlueprint;
}

function collectWizardSpec() {
  const maxTargetDistanceValue = document.getElementById("wizard-max-target-distance-km").value;
  const experimentalEnabled = Boolean(document.getElementById("wizard-experimental-enabled")?.checked);
  const plotSeed = document.getElementById("wizard-plot-seed")?.value || "none";
  return {
    title: document.getElementById("wizard-title").value.trim(),
    campaignId: document.getElementById("wizard-campaign-id").value.trim(),
    theater: document.getElementById("wizard-theater").value,
    campaignClimate: document.getElementById("wizard-climate").value,
    tone: document.getElementById("wizard-climate").value,
    missionType: document.getElementById("wizard-mission-type").value,
    missionStance: document.getElementById("wizard-stance").value,
    posture: document.getElementById("wizard-stance").value,
    rulesOfEngagement: document.getElementById("wizard-roe").value,
    roe: document.getElementById("wizard-roe").value,
    year: Number(document.getElementById("wizard-year").value || 2028),
    scenarioCount: Number(document.getElementById("wizard-scenario-count").value || 2),
    playerName: document.getElementById("wizard-player-name").value.trim(),
    experimentalFeatures: {
      enabled: experimentalEnabled,
      plotSeed
    },
    authoringConstraints: {
      maxDistanceToPrimaryTargetKm: maxTargetDistanceValue ? Number(maxTargetDistanceValue) : null
    }
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

function resolveOperationalMapForTheater(theaterNameOrLabel) {
  const theaterEntry = Object.values(getTheaterTemplates()).find((theater) => (
    theater.theaterName === theaterNameOrLabel || theater.label === theaterNameOrLabel || theater.id === theaterNameOrLabel
  ));
  if (!theaterEntry) {
    return null;
  }
  if (theaterEntry.id === "south_china_sea") {
    return {
      title: "South China Sea SLOC Map",
      src: "../docs/south-china-sea-sloc-map.html",
      relativeName: "south-china-sea-sloc-map.html"
    };
  }
  if (theaterEntry.id === "norwegian_sea") {
    return {
      title: "Norwegian Sea SLOC Map",
      src: "../docs/norwegian-sea-sloc-map.html",
      relativeName: "norwegian-sea-sloc-map.html"
    };
  }
  return null;
}

function renderOperationalMapForTracking(theaterNameOrLabel) {
  const title = document.getElementById("tracking-map-title");
  const copy = document.getElementById("tracking-map-copy");
  const link = document.getElementById("tracking-map-link");
  const badge = document.getElementById("tracking-map-badge");
  if (!title || !copy || !link || !badge) {
    return;
  }

  const map = resolveOperationalMapForTheater(theaterNameOrLabel);
  currentOperationalMap = map;
  if (!map) {
    title.textContent = "No theater map loaded";
    copy.textContent = "This campaign theater does not have an embedded operational SLOC page yet.";
    link.disabled = true;
    delete link.dataset.relativeName;
    badge.textContent = "Unavailable";
    return;
  }

  title.textContent = map.title;
  copy.textContent = "Open the existing operational SLOC page inside Campaign Tracking.";
  link.disabled = false;
  link.dataset.relativeName = map.relativeName;
  badge.textContent = "Theater Linked";
}

async function resolveOperationalMapSrc(map) {
  if (!map) {
    return null;
  }
  if (desktopApi?.getOperationalMapUrl && map.relativeName) {
    return desktopApi.getOperationalMapUrl({ relativeName: map.relativeName });
  }
  return map.src;
}

async function openOperationalMapInApp(map = currentOperationalMap) {
  if (!map) {
    return;
  }
  const overlay = document.getElementById("tracking-map-overlay");
  const frame = document.getElementById("tracking-map-frame");
  const title = document.getElementById("tracking-map-overlay-title");
  const kicker = document.getElementById("tracking-map-overlay-kicker");
  if (!overlay || !frame || !title || !kicker) {
    return;
  }
  const resolvedSrc = await resolveOperationalMapSrc(map);
  if (!resolvedSrc) {
    return;
  }
  title.textContent = map.title;
  kicker.textContent = map.relativeName ? "Operational Area Map" : "Map Unavailable";
  frame.src = resolvedSrc;
  overlay.hidden = false;
}

function closeOperationalMapInApp() {
  const overlay = document.getElementById("tracking-map-overlay");
  const frame = document.getElementById("tracking-map-frame");
  if (!overlay || !frame) {
    return;
  }
  frame.src = "about:blank";
  overlay.hidden = true;
}

function setDesktopOutput(value) {
  const output = document.getElementById("desktop-output");
  if (output) {
    output.textContent = JSON.stringify(value, null, 2);
  }
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
        <div class="muted">${missionCount} mission result${missionCount === 1 ? "" : "s"} recorded. Climate: ${data.state.world_state?.campaign_climate || data.state.world_state?.tone || "-"}. Mission type: ${data.state.world_state?.mission_type || "-"}. Experimental: ${data.state.world_state?.experimental_features?.enabled ? data.state.world_state?.experimental_features?.plotSeedLabel || data.state.world_state?.experimental_features?.plotSeed || "On" : "Off"}. ROE: ${data.state.world_state?.rules_of_engagement || "-"}. Escalation: ${data.state.world_state?.escalation_key || "-"}. The reserved next mission will be regenerated from the latest result, and one additional slot will stay chained behind it.</div>
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
      setContinuationStatus("Desktop app required to regenerate the reserved next mission and redeploy the campaign.");
      return;
    }
    const campaignId = document.getElementById("desktop-campaign-id").value.trim() || data.state.metadata.campaign_id || "silent_meridian";
    setContinuationStatus("Regenerating the reserved next mission, extending the chain by one slot, rebuilding the package, and refreshing runtime state...");
    const result = await desktopApi.continueCampaign({
      campaignId,
      objective: objectiveSelect.value,
      riskPosture: riskSelect.value,
      operationalTempo: tempoSelect.value
    });
    setDesktopOutput(result);
    setContinuationStatus(`Regenerated ${result.continuation.mission_name}, preserved a reserved follow-on slot, and refreshed Campaign Tracking.`);
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
  const climateSelect = document.getElementById("wizard-climate");
  const missionTypeSelect = document.getElementById("wizard-mission-type");
  const stanceSelect = document.getElementById("wizard-stance");
  const roeSelect = document.getElementById("wizard-roe");
  const experimentalEnabled = Boolean(document.getElementById("wizard-experimental-enabled")?.checked);
  const plotSeedSelect = document.getElementById("wizard-plot-seed");
  if (!theaterSelect || !climateSelect || !missionTypeSelect || !stanceSelect || !roeSelect || !plotSeedSelect) {
    return;
  }
  const previousTheater = theaterSelect.value || "luzon_strait";
  const previousClimate = climateSelect.value || "surveillance";
  const previousMissionType = missionTypeSelect.value;
  const previousStance = stanceSelect.value || "wide_area_search";
  const previousRoe = roeSelect.value || "weapons_tight";
  const previousPlotSeed = plotSeedSelect.value || "none";
  theaterSelect.innerHTML = Object.values(getTheaterTemplates()).map((theater) => `
    <option value="${theater.id}">${theater.label}</option>
  `).join("");
  climateSelect.innerHTML = Object.entries(getCampaignClimateCatalog()).map(([key, climate]) => `
    <option value="${key}">${climate.label}</option>
  `).join("");
  missionTypeSelect.innerHTML = Object.entries(getMissionTypeCatalog())
    .filter(([, missionType]) => experimentalEnabled || missionType.availability !== "experimental")
    .map(([key, missionType]) => `
    <option value="${key}">${missionType.label}${missionType.availability === "experimental" ? " [Experimental]" : ""}</option>
  `).join("");
  plotSeedSelect.innerHTML = Object.entries(getExperimentalPlotSeedCatalog()).map(([key, plotSeed]) => `
    <option value="${key}">${plotSeed.label}</option>
  `).join("");
  stanceSelect.innerHTML = Object.entries(getMissionStanceCatalog()).map(([key, posture]) => `
    <option value="${key}">${posture.label}</option>
  `).join("");
  roeSelect.innerHTML = Object.entries(getRoeCatalog()).map(([key, roe]) => `
    <option value="${key}">${roe.label}</option>
  `).join("");
  theaterSelect.value = theaterSelect.querySelector(`option[value="${previousTheater}"]`)
    ? previousTheater
    : "luzon_strait";
  climateSelect.value = climateSelect.querySelector(`option[value="${previousClimate}"]`)
    ? previousClimate
    : "surveillance";
  missionTypeSelect.value = previousMissionType && missionTypeSelect.querySelector(`option[value="${previousMissionType}"]`)
    ? previousMissionType
    : "asuw_military";
  stanceSelect.value = stanceSelect.querySelector(`option[value="${previousStance}"]`)
    ? previousStance
    : "wide_area_search";
  roeSelect.value = roeSelect.querySelector(`option[value="${previousRoe}"]`)
    ? previousRoe
    : "weapons_tight";
  plotSeedSelect.value = experimentalEnabled && plotSeedSelect.querySelector(`option[value="${previousPlotSeed}"]`)
    ? previousPlotSeed
    : "none";
  plotSeedSelect.disabled = !experimentalEnabled;
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
  const missionTypeSelect = document.getElementById("wizard-mission-type");
  if (missionTypeSelect) {
    missionTypeSelect.value = theater.family === "sub_hunt" ? "asw" : "asuw_military";
  }
}

function toggleDesktopOnlyButtons(enabled) {
  ["desktop-export-runtime", "builder-save", "continuation-generate"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = !enabled;
    }
  });
  updateAuthoringActionState(workflowStatus);
}

function resetAuthoringFlow() {
  authoringStageOverride = "files";
  populateWizardSelectors();
  syncAuthoringDefaults({
    preferredCampaignId: document.getElementById("settings-campaign-id")?.value.trim() || "generated_campaign"
  }, {
    syncTitle: true,
    refreshPreview: false
  });
  syncWizardDefaultsWithTheater();
  refreshCurrentWizardBlueprint();
  renderWorkflowStatus(workflowStatus);
  setWizardStatus("Authoring reset to the first action step. Existing files on disk remain until you overwrite them.");
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

function initializeOperationalMapLink() {
  const link = document.getElementById("tracking-map-link");
  const closeButton = document.getElementById("tracking-map-close");
  const overlay = document.getElementById("tracking-map-overlay");
  if (!link || !closeButton || !overlay) {
    return;
  }
  link.onclick = async () => {
    await openOperationalMapInApp();
  };
  closeButton.onclick = () => closeOperationalMapInApp();
  overlay.onclick = (event) => {
    if (event.target === overlay) {
      closeOperationalMapInApp();
    }
  };
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) {
      closeOperationalMapInApp();
    }
  });
}

async function initializeWizard() {
  if (!document.getElementById("wizard-theater")) {
    return;
  }
  populateWizardSelectors();
  syncWizardDefaultsWithTheater();
  refreshCurrentWizardBlueprint();
  document.getElementById("wizard-theater").onchange = () => {
    syncWizardDefaultsWithTheater();
    refreshCurrentWizardBlueprint();
  };
  ["wizard-title", "wizard-campaign-id", "wizard-climate", "wizard-mission-type", "wizard-stance", "wizard-roe", "wizard-year", "wizard-scenario-count", "wizard-player-name", "wizard-max-target-distance-km"].forEach((id) => {
    document.getElementById(id).oninput = () => refreshCurrentWizardBlueprint();
  });
  document.getElementById("wizard-experimental-enabled").onchange = () => {
    populateWizardSelectors();
    refreshCurrentWizardBlueprint();
  };
  document.getElementById("wizard-plot-seed").onchange = () => refreshCurrentWizardBlueprint();
  document.getElementById("wizard-start-over").onclick = () => {
    resetAuthoringFlow();
  };
  document.getElementById("wizard-generate").onclick = async () => {
    if (!desktopApi) {
      setWizardStatus("Desktop app required to write campaign files.");
      return;
    }
    authoringStageOverride = null;
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
    authoringStageOverride = null;
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
    authoringStageOverride = null;
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
    preferredCampaignId: "silent_meridian",
    preferredPackageId: "silent_meridian",
    preferredPackageSourceDir: desktopInfo ? `${desktopInfo.workspaceRoot}/src/packages/silent_meridian` : "",
    preferredPackageOutputPath: desktopInfo ? `${desktopInfo.workspaceRoot}/dist/silent_meridian.kyt` : "",
    firstLaunchComplete: false
  };
  let settings = desktopApi ? await desktopApi.loadSettings() : fallbackSettings;
  if (desktopApi?.detectDesktopPaths) {
    const shouldAutoDetect = !settings.gameCampaignPath
      || !settings.userCampaignPath
      || !settings.preferredPackageSourceDir
      || !settings.preferredPackageOutputPath;
    if (shouldAutoDetect) {
      const detected = await desktopApi.detectDesktopPaths();
      settings = mergeDetectedDesktopSettings(settings, detected);
    }
  }
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

  document.getElementById("settings-find-paths")?.addEventListener("click", async () => {
    if (!desktopApi?.detectDesktopPaths) {
      setSettingsStatus("Path detection is only available in the Electron desktop app.");
      return;
    }
    setSettingsStatus("Scanning for Steam, MNW campaign folders, and workspace defaults...");
    const detected = await desktopApi.detectDesktopPaths();
    applyDetectedDesktopPaths(detected);
    const findings = Array.isArray(detected.findings) ? detected.findings.join(" ") : "Path scan completed.";
    const followUp = detected.status?.gameCampaignFound && detected.status?.userCampaignFound
      ? "Review the filled paths, then save settings."
      : "Review the filled paths carefully, adjust any that look wrong, then save settings.";
    setSettingsStatus(`${findings} ${followUp}`);
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
    if (desktopApi?.detectDesktopPaths) {
      setSettingsStatus("First launch detected. Automatic path detection has filled the common MNW folders and workspace paths. Review them, then save settings once.");
    } else {
      setSettingsStatus("First launch detected. Confirm the MNW paths and preferred IDs, then save settings once.");
    }
  } else {
    setWorkspaceMode("authoring");
    setSettingsStatus("Desktop settings loaded.");
  }
}

function hydrateRuntime(data) {
  currentRuntimePayload = data;
  setTrackingRuntimeAvailability(true);
  renderCampaignSummary(data);
  renderModuleSummary(data);
  renderHeroStats(data);
  renderContinuationPlanner(data);
  renderOperationalMapForTracking(data.state?.metadata?.theater || data.campaign?.theater);
  renderOob(data);
  renderMissionResult(data);
  renderManualBuilder(data);
  renderDebriefParser(data);
  renderAisSummaryPlaceholder(data);
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

function averagePoints(points) {
  if (!points.length) {
    return null;
  }
  const totals = points.reduce((acc, [lat, lon]) => {
    acc.lat += lat;
    acc.lon += lon;
    return acc;
  }, { lat: 0, lon: 0 });
  return [
    Number((totals.lat / points.length).toFixed(6)),
    Number((totals.lon / points.length).toFixed(6))
  ];
}

function deriveTheaterCenter(theaterName) {
  const templates = Object.values(getTheaterTemplates());
  const template = templates.find((item) => item.theaterName === theaterName || item.label === theaterName);
  if (!template) {
    return null;
  }
  const route = template.route || {};
  const variant = Array.isArray(route.variants) && route.variants.length ? route.variants[0] : route;
  const points = [
    ...(variant.playerCorridor || []),
    ...(variant.enemyCorridor || []),
    ...(variant.supportCorridor || []),
    ...(variant.heloCorridor || []),
    ...(variant.airCorridor || [])
  ].filter((point) => Array.isArray(point) && point.length === 2);
  return averagePoints(points);
}

function setAisStatus(message) {
  const node = document.getElementById("tracking-ais-status");
  if (node) {
    node.textContent = message;
  }
}

function renderAisDebug(result) {
  const root = document.getElementById("tracking-ais-debug-json");
  const badge = document.getElementById("tracking-ais-debug-badge");
  if (!root || !badge) {
    return;
  }
  const payload = result?.debug ? {
    provider: result.provider || "aisstream",
    theaterName: result.theaterName || null,
    center: result.center || null,
    radiusKm: result.radiusKm || null,
    contactCount: Array.isArray(result.contacts) ? result.contacts.length : 0,
    messageCount: result.debug.messageCount || 0,
    uniqueVessels: result.debug.uniqueVessels || 0,
    sampledMessages: result.debug.sampledMessages || []
  } : {};
  root.textContent = JSON.stringify(payload, null, 2);
  badge.textContent = result?.debug?.messageCount ? `${result.debug.messageCount} Msg` : "Empty";
}

function renderAisContacts(result) {
  const root = document.getElementById("tracking-ais-list");
  const copy = document.getElementById("tracking-ais-copy");
  if (!root || !copy) {
    return;
  }
  if (!result?.contacts?.length) {
    root.innerHTML = "";
    copy.textContent = "Enable AISStream in Setup, save the key locally, then use this to sample live contacts around the current theater.";
    renderAisDebug(result);
    return;
  }
  copy.textContent = result.center
    ? `${result.theaterName || "Current theater"} centered near ${result.center[0].toFixed(3)}, ${result.center[1].toFixed(3)} with a ${result.radiusKm} km query radius.`
    : "Live AIS sample loaded.";
  root.innerHTML = result.contacts.map((contact) => `
    <div class="event">
      <div class="head">
        <strong>${contact.name || "Unnamed Vessel"}</strong>
        <span class="pill alt">${contact.mmsi || "No MMSI"}</span>
      </div>
      <div class="muted">
        ${contact.lat.toFixed(4)}, ${contact.lon.toFixed(4)}
        ${Number.isFinite(contact.distanceKm) ? ` | ${contact.distanceKm.toFixed(1)} km` : ""}
        ${Number.isFinite(contact.sog) ? ` | ${contact.sog.toFixed(1)} kt` : ""}
        ${Number.isFinite(contact.cog) ? ` | COG ${contact.cog.toFixed(0)}` : ""}
      </div>
    </div>
  `).join("");
  renderAisDebug(result);
}

function renderAisSummaryPlaceholder(data) {
  const theaterName = data?.state?.metadata?.theater || data?.campaign?.theater || "";
  const center = deriveTheaterCenter(theaterName);
  const copy = document.getElementById("tracking-ais-copy");
  if (copy && center) {
    copy.textContent = `Enable AISStream in Setup, save the key locally, then use this to sample live contacts around ${theaterName} near ${center[0].toFixed(3)}, ${center[1].toFixed(3)}.`;
  }
  renderAisDebug(null);
}

async function refreshAisContacts() {
  if (!desktopApi?.fetchAisContacts) {
    setAisStatus("Desktop app required for AISStream access.");
    return;
  }
  const theaterName = currentRuntimePayload?.state?.metadata?.theater || currentRuntimePayload?.campaign?.theater || "";
  const center = deriveTheaterCenter(theaterName);
  if (!center) {
    setAisStatus("Unable to derive a theater query center yet.");
    return;
  }
  const radiusKm = Number(document.getElementById("settings-ais-radius-km")?.value || 160);
  setAisStatus("Refreshing AIS contacts from AISStream...");
  try {
    const result = await desktopApi.fetchAisContacts({ center, radiusKm, theaterName });
    setAisStatus(result.status || "AIS refresh complete.");
    renderAisContacts(result);
  } catch (error) {
    setAisStatus(error.message || "AIS refresh failed.");
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
  initializeOperationalMapLink();
  await initializeDesktopSettings();
  await initializeWizard();
  await initializeDesktopOps();
  document.getElementById("tracking-ais-refresh")?.addEventListener("click", refreshAisContacts);
}

main().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#ffb4b4;background:#07131d">${error.stack}</pre>`;
});
