import {
  buildCampaignBlueprint,
  getExperimentalPlotSeedCatalog,
  getCampaignClimateCatalog,
  getContinuationChoiceCatalog,
  getMissionStanceCatalog,
  getMissionTypeCatalog,
  getPlayerSubmarineCatalog,
  getRoeCatalog,
  getSeasonCatalog,
  getTheaterForcePoolCatalog,
  getTheaterTemplates,
  getTimeOfDayCatalog,
} from "../shared/campaign-generator.mjs";
import { updateModalPresentation } from "./update-modal.mjs";

const desktopApi = globalThis.mnwDesktop ?? null;
let currentWizardBlueprint = null;
let desktopInfo = null;
let packageIdSyncEnabled = true;
let workflowStatus = null;
let authoringStageOverride = null;
let currentOperationalMap = null;
let currentOperationalMapMode = "vector";
let currentRuntimePayload = null;
let currentUpdateState = null;
let startupUpdateModalEnabled = false;
let startupUpdateModalDismissed = false;
let startupUpdateApplyRequested = false;
let startupUpdateInstallRequested = false;
let currentCampaignControls = null;
let latestResultPreviewFingerprint = null;
let localPlatformCatalog = null;
let authoredForcePoolSelection = {};

function escapeMarkup(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
  const theater = data.debug?.theater || null;
  const items = [
    ["Campaign", data.state.metadata.title],
    ["Theater", theater?.theaterLabel || data.state.metadata.theater],
    ["Mission", data.state.current_mission_id],
    ["Climate", worldState.campaign_climate || worldState.tone || "-"],
    ["Escalation", worldState.escalation_key || "-"],
    ["ROE", worldState.rules_of_engagement || "-"],
    ["Time", theater?.timeOfDayLabel || worldState.time_of_day_label || "-"],
    ["Player", theater?.playerSubmarineLabel || worldState.player_submarine_label || "-"],
    ["Clock", data.state.campaign_clock]
  ];
  root.innerHTML = items.map(([key, value]) => `
    <div class="kv-item compact-kv-item">
      <div class="key">${key}</div>
      <div class="value">${value ?? "-"}</div>
    </div>
  `).join("");
}

function renderModuleSummary(data) {
  const root = document.getElementById("module-summary");
  const enabledModules = Array.isArray(data.modules.enabled_modules) ? data.modules.enabled_modules : [];
  const worldState = data.state.world_state || {};
  const items = [
    {
      title: `${enabledModules.length} Active Modules`,
      meta: enabledModules.length ? enabledModules.join(", ") : "No enabled modules"
    },
    {
      title: "Persistence System",
      meta: data.state.metadata.active_persistence_system || "Unknown"
    },
    {
      title: "Generation Directives",
      meta: `${data.plan.directives.length} pending directives for the next mission cycle`
    }
  ];
  if (worldState.experimental_features?.enabled) {
    items.push({
      title: "Experimental Overlay",
      meta: worldState.experimental_features.plotSeedLabel || worldState.experimental_features.plotSeed || "Enabled"
    });
  }
  root.innerHTML = items.map((item) => `
    <div class="stack-item compact-stack-item">
      <div class="title">${item.title}</div>
      <div class="meta">${item.meta}</div>
    </div>
  `).join("");
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

  renderTheaterTracking({ debug: { theater: null } });
  renderOperationalMapForTracking("");
  setTrackingRuntimeAvailability(false, message);
  renderAisContacts({ contacts: [] });
  setAisStatus("No AIS data loaded.");
}

function renderHeroStats(data) {
  const root = document.getElementById("hero-stats");
  const worldState = data.state.world_state || {};
  const theater = data.debug?.theater || null;
  const stats = [
    ["Tracked Units", Object.keys(data.state.order_of_battle).length],
    ["Destroyed Units", Object.values(data.state.order_of_battle).filter((unit) => unit.destroyed).length],
    ["Active Modules", data.modules.enabled_modules.length],
    ["Generation Directives", data.plan.directives.length],
    ["Escalation", worldState.escalation_key || "-"],
    ["Mission Type", worldState.mission_type || "-"],
    ["ROE", worldState.rules_of_engagement || "-"],
    ["Time", theater?.timeOfDayLabel || worldState.time_of_day_label || "-"]
  ];
  root.innerHTML = stats.map(([label, value]) => `
    <div class="stat">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `).join("");
}

function theaterStatusPill(unit) {
  if (unit.destroyed) {
    return '<span class="pill bad">Destroyed</span>';
  }
  if (unit.onStage) {
    return '<span class="pill ok">On Stage</span>';
  }
  if ((unit.availability || "").toLowerCase() === "committed") {
    return '<span class="pill warn">Committed</span>';
  }
  if (["repairing", "rearming", "in_transit"].includes(unit.operationalState)) {
    return `<span class="pill warn">${unit.operationalState.replace("_", " ")}</span>`;
  }
  return '<span class="pill alt">Off Stage</span>';
}

function renderTheaterTracking(data) {
  const theater = data.debug?.theater || null;
  const summaryRoot = document.getElementById("tracking-theater-summary");
  const sectorsRoot = document.getElementById("tracking-theater-sectors");
  const unitsRoot = document.getElementById("tracking-theater-units");
  const badge = document.getElementById("tracking-theater-badge");
  const countBadge = document.getElementById("tracking-theater-unit-count");
  const unitsCopy = document.getElementById("tracking-theater-units-copy");

  if (!summaryRoot || !sectorsRoot || !unitsRoot || !badge || !countBadge || !unitsCopy) {
    return;
  }

  if (!theater) {
    badge.textContent = "No Theater Data";
    summaryRoot.innerHTML = `
      <div class="stack-item">
        <div class="title">No Theater Context Loaded</div>
        <div class="meta">Export a real runtime snapshot to populate the theater picture.</div>
      </div>
    `;
    sectorsRoot.innerHTML = `
      <div class="stack-item">
        <div class="title">No Sector Data</div>
        <div class="meta">Sector pressure appears here after runtime export.</div>
      </div>
    `;
    unitsRoot.innerHTML = "";
    countBadge.textContent = "0 Units";
    unitsCopy.textContent = "Load a runtime snapshot to inspect sector assignments, availability, and readiness.";
    return;
  }

  const units = Array.isArray(theater.units) ? theater.units : [];
  const sectors = Array.isArray(theater.sectors) ? theater.sectors : [];
  const sectorSummary = sectors.map((sector) => {
    const sectorUnits = units.filter((unit) => unit.currentSector === sector.id || unit.allowedSectors.includes(sector.id));
    const onStageUnits = sectorUnits.filter((unit) => unit.onStage && !unit.destroyed);
    const enemyUnits = sectorUnits.filter((unit) => unit.side !== "US" && !unit.destroyed);
    return {
      id: sector.id,
      label: sector.label || sector.id,
      tracked: sectorUnits.length,
      onStage: onStageUnits.length,
      enemy: enemyUnits.length
    };
  }).sort((left, right) => right.onStage - left.onStage || right.enemy - left.enemy || left.label.localeCompare(right.label));

  const trackedUnits = units.slice().sort((left, right) => {
    if (left.destroyed !== right.destroyed) {
      return left.destroyed ? 1 : -1;
    }
    if (left.onStage !== right.onStage) {
      return left.onStage ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

  const summaryItems = [
    ["Theater", theater.theaterLabel || theater.theaterName || "-"],
    ["Source", theater.source === "runtime" ? "Live Runtime" : "Seed State"],
    ["Climate", theater.campaignClimate || "-"],
    ["Escalation", theater.escalationKey || "-"],
    ["Mission Type", theater.missionType || "-"],
    ["ROE", theater.rulesOfEngagement || "-"],
    ["Stance", theater.missionStance || "-"],
    ["Season", theater.seasonLabel || theater.season || "-"],
    ["Time Of Day", theater.timeOfDayLabel || theater.timeOfDay || "-"],
    ["Player Sub", theater.playerSubmarineLabel || theater.playerSubmarine || "-"]
  ];
  summaryRoot.innerHTML = summaryItems.map(([key, value]) => `
    <div class="kv-item">
      <div class="key">${key}</div>
      <div class="value">${value ?? "-"}</div>
    </div>
  `).join("");

  sectorsRoot.innerHTML = sectorSummary.length
    ? sectorSummary.map((sector) => `
      <div class="stack-item theater-sector-item">
        <div class="title">${sector.label}</div>
        <div class="meta">Tracked: ${sector.tracked} | On Stage: ${sector.onStage} | Enemy: ${sector.enemy}</div>
      </div>
    `).join("")
    : `
      <div class="stack-item">
        <div class="title">No Sector Summary</div>
        <div class="meta">This theater did not expose a sector catalog.</div>
      </div>
    `;

  unitsRoot.innerHTML = trackedUnits.map((unit) => `
    <article class="theater-unit-card">
      <div class="theater-unit-head">
        <div>
          <strong>${unit.name}</strong>
          <div class="muted">${unit.role || unit.theaterRole || unit.platformType}</div>
        </div>
        ${theaterStatusPill(unit)}
      </div>
      <div class="theater-unit-meta">
        <span>${unit.side}</span>
        <span>${unit.platformType}</span>
        <span>${unit.currentSector || "Unassigned"}</span>
      </div>
      <div class="theater-unit-kv">
        <div><span>Readiness</span><strong>${Math.round((Number(unit.readiness) || 0) * 100)}%</strong></div>
        <div><span>Damage</span><strong>${Math.round((Number(unit.damage) || 0) * 100)}%</strong></div>
        <div><span>Availability</span><strong>${unit.availability || "-"}</strong></div>
        <div><span>Status</span><strong>${unit.status || "-"}</strong></div>
        <div><span>Fatigue</span><strong>${Math.round((Number(unit.fatigue) || 0) * 100)}%</strong></div>
        <div><span>Sorties</span><strong>${Number(unit.sorties) || 0}</strong></div>
        <div><span>Recovery</span><strong>${Math.ceil(Number(unit.recoveryHoursRemaining) || 0)}h</strong></div>
      </div>
      <div class="muted theater-unit-foot">
        Allowed Sectors: ${unit.allowedSectors?.length ? unit.allowedSectors.join(", ") : "None"}${unit.lastMissionId ? ` | Last Mission: ${unit.lastMissionId}` : ""}
      </div>
    </article>
  `).join("");

  badge.textContent = theater.source === "runtime" ? "Live Theater" : "Seed Theater";
  countBadge.textContent = `${trackedUnits.length} Units`;
  unitsCopy.textContent = "Sector assignments, readiness, and availability now update from the exported theater picture rather than raw JSON only.";
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
  const advancedRaw = document.getElementById("builder-advanced-events")?.value.trim() || "[]";
  const advancedEvents = JSON.parse(advancedRaw);
  if (!Array.isArray(advancedEvents)) throw new Error("Advanced events must be a JSON array.");
  events.push(...advancedEvents);
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
  const consumed = new Set([weaponEvent, damageEvent, destroyedEvent].filter(Boolean));
  document.getElementById("builder-advanced-events").value = JSON.stringify(payload.events.filter((event) => !consumed.has(event)), null, 2);
}

function renderManualBuilder(data) {
  const units = Object.values(data.state.order_of_battle);
  const unitSelect = document.getElementById("builder-unit");
  const missionInput = document.getElementById("builder-mission-id");
  const preview = document.getElementById("builder-json");
  const saveButton = document.getElementById("builder-save");
  const deltaPreview = document.getElementById("builder-delta-json");
  unitSelect.innerHTML = units.map((unit) => `
    <option value="${unit.unit_id}">${unit.name} (${unit.unit_id})</option>
  `).join("");
  missionInput.value = data.plan.mission_id || data.state.current_mission_id || "";
  setBuilderStatus("Build the result here, then save it directly. Download and copy remain available only if you want a record outside the app.");

  const refreshPreview = async () => {
    try {
      const payload = buildManualResult(data);
      preview.textContent = JSON.stringify(payload, null, 2);
      if (desktopApi?.previewMissionResult) {
        const campaignId = document.getElementById("desktop-campaign-id").value.trim() || data.state.metadata.campaign_id;
        const result = await desktopApi.previewMissionResult({
          campaignId,
          result: payload,
          advanceHours: Number(document.getElementById("builder-advance-hours").value || 0)
        });
        latestResultPreviewFingerprint = result.stateFingerprint || null;
        deltaPreview.textContent = result.valid ? JSON.stringify(result.delta, null, 2) : result.errors.join("\n");
      } else {
        deltaPreview.textContent = "State-delta preview is available in the desktop app.";
      }
      return payload;
    } catch (error) {
      preview.textContent = `Invalid result: ${error.message}`;
      deltaPreview.textContent = "Fix validation errors before saving.";
      return null;
    }
  };

  ["builder-mission-id", "builder-outcome", "builder-hours", "builder-advance-hours", "builder-unit", "builder-weapon-key", "builder-weapon-amount", "builder-damage-amount", "builder-destroyed", "builder-source", "builder-advanced-events"].forEach((id) => {
    const node = document.getElementById(id);
    node.oninput = refreshPreview;
    node.onchange = refreshPreview;
  });
  document.getElementById("builder-generate").onclick = refreshPreview;
  document.getElementById("builder-download").onclick = async () => {
    const payload = await refreshPreview();
    if (!payload) return;
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
    const payload = await refreshPreview();
    if (!payload) return;
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };
  saveButton.onclick = async () => {
    const payload = await refreshPreview();
    if (!payload) return;
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
    try {
      const result = await desktopApi.saveManualResult({
        campaignId,
        result: payload,
        advanceHours: Number(document.getElementById("builder-advance-hours").value || 0),
        expectedStateFingerprint: latestResultPreviewFingerprint
      });
      setDesktopOutput(result);
      setDesktopOpsStatus(`Manual result saved for ${campaignId}.`);
      setBuilderStatus(`Saved ${payload.outcome} result for ${payload.mission_id}. Campaign Tracking refreshed.`);
      if (result.runtime?.payload) {
        hydrateRuntime(result.runtime.payload);
        setWorkspaceMode("tracking");
      }
      await refreshWorkflowStatus();
    } catch (error) {
      setBuilderStatus(`Result was not saved: ${error.message}`);
    }
  };
  refreshPreview();
}

function collectModuleConfig() {
  const enabled_modules = [];
  const module_config = {};
  for (const module of currentCampaignControls?.registry || []) {
    if (document.getElementById(`module-enabled-${module.id}`)?.checked) enabled_modules.push(module.id);
    module_config[module.id] = {};
    for (const [key, field] of Object.entries(module.config || {})) {
      const node = document.getElementById(`module-config-${module.id}-${key}`);
      module_config[module.id][key] = field.type === "boolean" ? Boolean(node?.checked) : Number(node?.value);
    }
  }
  return { enabled_modules, module_config };
}

async function renderCampaignControls(data) {
  const root = document.getElementById("module-controls");
  if (!root) return;
  if (!desktopApi?.loadCampaignControls) {
    root.innerHTML = '<div class="stack-item"><div class="meta">Campaign controls require the desktop app.</div></div>';
    return;
  }
  const campaignId = data.state.metadata.campaign_id;
  currentCampaignControls = await desktopApi.loadCampaignControls({ campaignId });
  root.innerHTML = currentCampaignControls.registry.map((module) => {
    const enabled = currentCampaignControls.modules.enabled_modules.includes(module.id);
    const fields = Object.entries(module.config || {}).map(([key, field]) => {
      const value = currentCampaignControls.modules.module_config?.[module.id]?.[key] ?? field.default;
      if (field.type === "boolean") {
        return `<label class="toggle"><span>${escapeMarkup(field.label)}</span><input id="module-config-${module.id}-${key}" type="checkbox" ${value ? "checked" : ""}></label>`;
      }
      return `<label><span>${escapeMarkup(field.label)}</span><input id="module-config-${module.id}-${key}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}"></label>`;
    }).join("");
    return `<div class="stack-item"><label class="toggle"><strong>${escapeMarkup(module.label)}</strong><input id="module-enabled-${module.id}" type="checkbox" ${enabled ? "checked" : ""}></label><div class="meta">${escapeMarkup(module.description)}</div><div class="field-grid" style="margin-top:10px;">${fields}</div></div>`;
  }).join("");

  document.getElementById("module-controls-save").onclick = async () => {
    const status = document.getElementById("module-controls-status");
    const payload = { campaignId, modules: collectModuleConfig(), expectedFingerprint: currentCampaignControls.modulesFingerprint };
    try {
      const saved = await desktopApi.saveModuleConfig(payload);
      currentCampaignControls.modules = saved.modules;
      currentCampaignControls.modulesFingerprint = saved.fingerprint;
      status.textContent = `Module settings saved. Backup: ${saved.backupPath || "not required"}`;
      await reloadRuntimeForCampaign(campaignId);
    } catch (error) {
      if (String(error.message).includes("Confirm the change")) {
        const confirmed = globalThis.confirm(`${error.message}\n\nDisable anyway?`);
        if (confirmed) {
          const saved = await desktopApi.saveModuleConfig({ ...payload, confirmDisableWithState: true });
          currentCampaignControls.modules = saved.modules;
          currentCampaignControls.modulesFingerprint = saved.fingerprint;
          status.textContent = "Module settings saved with existing state retained.";
          await reloadRuntimeForCampaign(campaignId);
        }
      } else status.textContent = error.message;
    }
  };
  renderStateEditor(currentCampaignControls, data);
}

function buildEditedState(controls) {
  const state = structuredClone(controls.state);
  state.current_mission_id = document.getElementById("state-editor-mission").value.trim();
  state.campaign_clock = document.getElementById("state-editor-clock").value.trim();
  state.world_state = state.world_state || {};
  state.world_state.escalation_key = document.getElementById("state-editor-escalation").value.trim();
  state.world_state.rules_of_engagement = document.getElementById("state-editor-roe").value.trim();
  const unit = state.order_of_battle[document.getElementById("state-editor-unit").value];
  if (unit) {
    unit.damage = Number(document.getElementById("state-editor-damage").value);
    unit.readiness = Number(document.getElementById("state-editor-readiness").value);
    unit.destroyed = document.getElementById("state-editor-destroyed").checked;
    unit.ammo = JSON.parse(document.getElementById("state-editor-ammo").value || "{}");
    state.world_state.theater_picture = state.world_state.theater_picture || {};
    state.world_state.theater_picture.units = state.world_state.theater_picture.units || {};
    const track = state.world_state.theater_picture.units[unit.unit_id] || {};
    track.current_sector = document.getElementById("state-editor-sector").value.trim() || null;
    track.availability = document.getElementById("state-editor-availability").value;
    state.world_state.theater_picture.units[unit.unit_id] = track;
  }
  return state;
}

function renderStateEditor(controls, data) {
  const unitSelect = document.getElementById("state-editor-unit");
  const state = controls.state;
  document.getElementById("state-editor-mission").value = state.current_mission_id || "";
  document.getElementById("state-editor-clock").value = state.campaign_clock || "";
  document.getElementById("state-editor-escalation").value = state.world_state?.escalation_key || "";
  document.getElementById("state-editor-roe").value = state.world_state?.rules_of_engagement || "";
  unitSelect.innerHTML = Object.values(state.order_of_battle || {}).map((unit) => `<option value="${escapeMarkup(unit.unit_id)}">${escapeMarkup(unit.name)}</option>`).join("");
  const loadUnit = () => {
    const unit = state.order_of_battle[unitSelect.value];
    document.getElementById("state-editor-damage").value = unit?.damage ?? 0;
    document.getElementById("state-editor-readiness").value = unit?.readiness ?? 1;
    document.getElementById("state-editor-destroyed").checked = Boolean(unit?.destroyed);
    document.getElementById("state-editor-ammo").value = JSON.stringify(unit?.ammo || {}, null, 2);
    const track = state.world_state?.theater_picture?.units?.[unit?.unit_id] || {};
    document.getElementById("state-editor-sector").value = track.current_sector || unit?.notes?.current_sector || "";
    document.getElementById("state-editor-availability").value = track.availability || unit?.notes?.availability || "available";
  };
  unitSelect.onchange = loadUnit;
  loadUnit();
  const backupSelect = document.getElementById("state-editor-backup");
  backupSelect.innerHTML = controls.stateBackups?.length
    ? controls.stateBackups.map((backupPath) => `<option value="${escapeMarkup(backupPath)}">${escapeMarkup(backupPath.split(/[\\/]/).pop())}</option>`).join("")
    : '<option value="">No backups available</option>';
  const preview = () => {
    const edited = buildEditedState(controls);
    const unitId = unitSelect.value;
    document.getElementById("state-editor-delta").textContent = JSON.stringify({
      current_mission_id: { before: state.current_mission_id, after: edited.current_mission_id },
      campaign_clock: { before: state.campaign_clock, after: edited.campaign_clock },
      unit: { before: state.order_of_battle[unitId], after: edited.order_of_battle[unitId] }
    }, null, 2);
    return edited;
  };
  document.getElementById("state-editor-preview").onclick = preview;
  document.getElementById("state-editor-save").onclick = async () => {
    const status = document.getElementById("state-editor-status");
    try {
      const saved = await desktopApi.saveCampaignState({ campaignId: data.state.metadata.campaign_id, state: preview(), expectedFingerprint: controls.stateFingerprint });
      controls.state = saved.state;
      controls.stateFingerprint = saved.fingerprint;
      status.textContent = `State saved safely. Backup: ${saved.backupPath || "not required"}`;
      await reloadRuntimeForCampaign(data.state.metadata.campaign_id);
    } catch (error) { status.textContent = error.message; }
  };
  document.getElementById("state-editor-restore").onclick = async () => {
    const status = document.getElementById("state-editor-status");
    if (!backupSelect.value) { status.textContent = "No state backup is available to restore."; return; }
    if (!globalThis.confirm(`Restore ${backupSelect.options[backupSelect.selectedIndex].text}? The current state will also be backed up.`)) return;
    try {
      const restored = await desktopApi.restoreCampaignState({
        campaignId: data.state.metadata.campaign_id,
        backupPath: backupSelect.value,
        expectedFingerprint: controls.stateFingerprint
      });
      status.textContent = `Backup restored. Previous current state saved to ${restored.backupPath}.`;
      await reloadRuntimeForCampaign(data.state.metadata.campaign_id);
    } catch (error) { status.textContent = error.message; }
  };
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
  document.getElementById("settings-update-provider").value = settings.updates?.provider || "generic";
  document.getElementById("settings-update-feed-url").value = settings.updates?.feedUrl || "";
  document.getElementById("settings-update-github-owner").value = settings.updates?.githubOwner || "";
  document.getElementById("settings-update-github-repo").value = settings.updates?.githubRepo || "";
  document.getElementById("settings-update-auto-check").checked = settings.updates?.autoCheckOnLaunch !== false;
  document.getElementById("settings-update-allow-prerelease").checked = settings.updates?.allowPrerelease !== false;
  renderUpdateProviderFields(settings.updates?.provider || "generic");
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
  renderQuickSetupSummary(settings);
}

function renderQuickSetupSummary(settings = {}) {
  const gamePath = settings.gameCampaignPath || "";
  const userPath = settings.userCampaignPath || "";
  const sourceDir = settings.preferredPackageSourceDir || "";
  const outputPath = settings.preferredPackageOutputPath || "";
  const ready = Boolean(settings.firstLaunchComplete && gamePath && userPath);
  const gameSummary = document.getElementById("setup-game-path-summary");
  const userSummary = document.getElementById("setup-user-path-summary");
  const sourceSummary = document.getElementById("setup-source-dir-summary");
  const outputSummary = document.getElementById("setup-output-path-summary");
  const readiness = document.getElementById("setup-readiness-summary");
  const autosaveNote = document.getElementById("setup-autosave-note");
  const advancedToggle = document.getElementById("settings-toggle-advanced");

  if (gameSummary) {
    gameSummary.textContent = gamePath || "Not detected yet.";
  }
  if (userSummary) {
    userSummary.textContent = userPath || "Not detected yet.";
  }
  if (sourceSummary) {
    sourceSummary.textContent = sourceDir || "Will be set automatically.";
  }
  if (outputSummary) {
    outputSummary.textContent = outputPath || "Will be set automatically.";
  }
  if (readiness) {
    readiness.innerHTML = ready
      ? `<div class="title">Setup is ready.</div><div class="meta">MNW deploy paths are saved. You can move straight into Authoring.</div>`
      : `<div class="title">Setup still needs attention.</div><div class="meta">The app needs both the game campaign path and the LocalLow user campaign path before it can finish setup automatically.</div>`;
  }
  if (autosaveNote) {
    autosaveNote.textContent = ready
      ? "Setup is already saved. Open Advanced Setup only if you need to override paths, IDs, AIS, or updater behavior."
      : "If both MNW deploy paths are found, the desktop app can save setup automatically and take you straight to Authoring.";
  }
  if (advancedToggle) {
    advancedToggle.textContent = document.getElementById("settings-advanced-panel")?.hidden === false
      ? "Hide Advanced Setup"
      : "Advanced Setup";
  }
}

function toggleAdvancedSetup(forceOpen = null) {
  const panel = document.getElementById("settings-advanced-panel");
  const toggle = document.getElementById("settings-toggle-advanced");
  if (!panel || !toggle) {
    return;
  }
  const shouldOpen = forceOpen == null ? panel.hidden : Boolean(forceOpen);
  panel.hidden = !shouldOpen;
  toggle.textContent = shouldOpen ? "Hide Advanced Setup" : "Advanced Setup";
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

function campaignSeedToTitle(campaignSeed) {
  return String(campaignSeed || "")
    .trim()
    .split("_")
    .filter((part, index, parts) => !(index === parts.length - 1 && /^\d+$/.test(part)))
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function randomIndex(max) {
  if (max <= 0) {
    return 0;
  }
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function generateCampaignSeed() {
  const prefixes = [
    "amber", "arc", "atlas", "black", "cinder", "cold", "deep", "drift",
    "ghost", "iron", "lancer", "north", "polar", "quiet", "scarlet", "silent",
    "steel", "storm", "swift", "trident"
  ];
  const suffixes = [
    "archipelago", "barrier", "bastion", "channel", "current", "dawn", "frontier", "gate",
    "harpoon", "lance", "meridian", "needle", "passage", "reach", "sentinel", "shoal",
    "sound", "spear", "watch", "wake"
  ];
  const serial = String(1000 + randomIndex(9000));
  return `${prefixes[randomIndex(prefixes.length)]}_${suffixes[randomIndex(suffixes.length)]}_${serial}`;
}

function seedFieldLooksGenerated(seedValue = "") {
  return /^[a-z]+_[a-z]+_\d{4}$/.test(String(seedValue || "").trim());
}

function setWizardCampaignSeed(seedValue, options = {}) {
  const wizardCampaignSeed = document.getElementById("wizard-campaign-seed");
  const wizardTitle = document.getElementById("wizard-title");
  if (!wizardCampaignSeed) {
    return "";
  }
  const normalizedSeed = String(seedValue || "").trim() || generateCampaignSeed();
  const priorSeed = wizardCampaignSeed.value.trim();
  wizardCampaignSeed.value = normalizedSeed;
  const shouldSyncTitle = options.syncTitle !== false && wizardTitle && (
    options.forceTitle
    || !wizardTitle.value.trim()
    || wizardTitle.value.trim() === campaignSeedToTitle(priorSeed)
  );
  if (shouldSyncTitle && wizardTitle) {
    wizardTitle.value = campaignSeedToTitle(normalizedSeed) || "Generated Campaign";
  }
  return normalizedSeed;
}

function ensureWizardCampaignSeed(options = {}) {
  const wizardCampaignSeed = document.getElementById("wizard-campaign-seed");
  if (!wizardCampaignSeed) {
    return "";
  }
  const currentSeed = wizardCampaignSeed.value.trim();
  if (options.force) {
    return setWizardCampaignSeed(options.seedValue || generateCampaignSeed(), options);
  }
  if (!currentSeed) {
    return setWizardCampaignSeed(options.seedValue || generateCampaignSeed(), options);
  }
  return currentSeed;
}

function syncAuthoringDefaults({ preferredCampaignId }, options = {}) {
  ensureWizardCampaignSeed({
    force: Boolean(options.forceSeed),
    seedValue: options.seedValue || preferredCampaignId,
    syncTitle: options.syncTitle,
    forceTitle: Boolean(options.forceTitle)
  });
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
    updates: {
      provider: document.getElementById("settings-update-provider").value,
      feedUrl: document.getElementById("settings-update-feed-url").value.trim(),
      githubOwner: document.getElementById("settings-update-github-owner").value.trim(),
      githubRepo: document.getElementById("settings-update-github-repo").value.trim(),
      autoCheckOnLaunch: document.getElementById("settings-update-auto-check").checked,
      allowPrerelease: document.getElementById("settings-update-allow-prerelease").checked
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
  renderQuickSetupSummary({
    ...collectDesktopSettingsForm(),
    firstLaunchComplete: false
  });
}

function setSettingsStatus(message) {
  document.getElementById("settings-status").textContent = message;
}

function renderUpdateProviderFields(provider) {
  document.querySelectorAll(".update-provider-scope").forEach((node) => {
    const showGeneric = provider === "generic" && node.classList.contains("update-provider-generic");
    const showGitHub = provider === "github" && node.classList.contains("update-provider-github");
    node.classList.toggle("active", showGeneric || showGitHub);
  });
}

function summarizeUpdateState(state) {
  if (!state) {
    return "No updater state loaded yet.";
  }
  if (state.status === "unsupported") {
    return "Auto-update only runs in packaged app builds.";
  }
  return state.message || "Updater is idle.";
}

function dismissStartupUpdateModal() {
  startupUpdateApplyRequested = false;
  startupUpdateModalDismissed = true;
  const modal = document.getElementById("startup-update-modal");
  if (modal) modal.hidden = true;
}

async function installStartupUpdate() {
  if (startupUpdateInstallRequested || !desktopApi?.installUpdate) return;
  startupUpdateInstallRequested = true;
  const primaryButton = document.getElementById("startup-update-primary");
  const bypassButton = document.getElementById("startup-update-bypass");
  const status = document.getElementById("startup-update-status");
  if (primaryButton) {
    primaryButton.disabled = true;
    primaryButton.textContent = "Restarting To Apply Update...";
  }
  if (bypassButton) bypassButton.disabled = true;
  if (status) status.textContent = "The update is ready. Closing the app and applying it now.";
  try {
    await desktopApi.installUpdate();
  } catch (error) {
    startupUpdateInstallRequested = false;
    startupUpdateApplyRequested = false;
    renderUpdateState({
      ...(currentUpdateState || {}),
      status: "error",
      message: error.message || "Update installation failed.",
      error: error.message || String(error)
    });
  }
}

function renderStartupUpdateModal(state) {
  const modal = document.getElementById("startup-update-modal");
  if (!modal || !startupUpdateModalEnabled || startupUpdateModalDismissed) return;
  const presentation = updateModalPresentation(state);
  if (!presentation.visible) {
    modal.hidden = true;
    return;
  }

  const wasHidden = modal.hidden;
  modal.hidden = false;
  const title = document.getElementById("startup-update-title");
  const status = document.getElementById("startup-update-status");
  const primaryButton = document.getElementById("startup-update-primary");
  const bypassButton = document.getElementById("startup-update-bypass");
  const progress = document.getElementById("startup-update-progress");
  const progressBar = document.getElementById("startup-update-progress-bar");
  const progressLabel = document.getElementById("startup-update-progress-label");
  if (title) title.textContent = presentation.title;
  if (status) status.textContent = presentation.status;
  if (primaryButton) {
    primaryButton.textContent = presentation.primaryLabel;
    primaryButton.dataset.updateAction = presentation.primaryAction;
    primaryButton.disabled = presentation.primaryDisabled || startupUpdateInstallRequested;
    if (wasHidden && !primaryButton.disabled) queueMicrotask(() => primaryButton.focus());
  }
  if (bypassButton) {
    bypassButton.disabled = presentation.bypassDisabled || startupUpdateInstallRequested;
    if (wasHidden && primaryButton?.disabled && !bypassButton.disabled) queueMicrotask(() => bypassButton.focus());
  }
  if (progress) progress.hidden = !presentation.progressVisible;
  if (progressBar) progressBar.style.width = `${presentation.progressPercent}%`;
  if (progressLabel) {
    progressLabel.hidden = !presentation.progressVisible;
    progressLabel.textContent = `${Math.round(presentation.progressPercent)}%`;
  }

  if (startupUpdateApplyRequested && (state?.status === "downloaded" || state?.updateDownloaded)) {
    void installStartupUpdate();
  }
}

async function runStartupUpdateAction(action) {
  if (action === "dismiss") {
    dismissStartupUpdateModal();
    return;
  }
  try {
    if (action === "check") {
      await desktopApi.checkForUpdates();
    } else if (action === "download") {
      startupUpdateApplyRequested = true;
      const primaryButton = document.getElementById("startup-update-primary");
      const bypassButton = document.getElementById("startup-update-bypass");
      if (primaryButton) {
        primaryButton.disabled = true;
        primaryButton.textContent = "Starting Download...";
      }
      if (bypassButton) bypassButton.disabled = true;
      await desktopApi.downloadUpdate();
      if (currentUpdateState?.status === "downloaded" || currentUpdateState?.updateDownloaded) {
        await installStartupUpdate();
      }
    } else if (action === "install") {
      await installStartupUpdate();
    }
  } catch (error) {
    startupUpdateApplyRequested = false;
    renderUpdateState({
      ...(currentUpdateState || {}),
      status: "error",
      message: error.message || "The update operation failed.",
      error: error.message || String(error)
    });
  }
}

function renderUpdateState(state) {
  currentUpdateState = state;
  const summary = document.getElementById("settings-update-summary");
  const preview = document.getElementById("settings-update-json");
  const checkButton = document.getElementById("settings-check-updates");
  const downloadButton = document.getElementById("settings-download-update");
  const installButton = document.getElementById("settings-install-update");

  if (summary) {
    summary.textContent = summarizeUpdateState(state);
  }
  if (preview) {
    preview.textContent = JSON.stringify(state || {}, null, 2);
  }
  if (checkButton) {
    checkButton.disabled = !state?.canCheck;
  }
  if (downloadButton) {
    downloadButton.disabled = !state?.canDownload;
  }
  if (installButton) {
    installButton.disabled = !state?.canInstall;
  }
  renderStartupUpdateModal(state);
}

async function initializeAppUpdates() {
  renderUpdateProviderFields(document.getElementById("settings-update-provider")?.value || "generic");
  document.getElementById("settings-update-provider")?.addEventListener("change", (event) => {
    renderUpdateProviderFields(event.target.value);
  });

  if (!desktopApi?.getUpdateState) {
    renderUpdateState({
      status: "unsupported",
      message: "Updater controls are only available in the Electron desktop app.",
      canCheck: false,
      canDownload: false,
      canInstall: false
    });
    return;
  }

  startupUpdateModalEnabled = true;
  document.getElementById("startup-update-primary")?.addEventListener("click", (event) => {
    void runStartupUpdateAction(event.currentTarget.dataset.updateAction || "none");
  });
  document.getElementById("startup-update-bypass")?.addEventListener("click", dismissStartupUpdateModal);
  renderUpdateState(await desktopApi.getUpdateState());
  desktopApi.onUpdateState?.((state) => {
    renderUpdateState(state);
  });

  document.getElementById("settings-check-updates")?.addEventListener("click", async () => {
    try {
      await desktopApi.checkForUpdates();
    } catch (error) {
      renderUpdateState({
        ...(currentUpdateState || {}),
        status: "error",
        message: error.message || "Update check failed.",
        error: error.message || String(error)
      });
    }
  });

  document.getElementById("settings-download-update")?.addEventListener("click", async () => {
    try {
      await desktopApi.downloadUpdate();
    } catch (error) {
      renderUpdateState({
        ...(currentUpdateState || {}),
        status: "error",
        message: error.message || "Update download failed.",
        error: error.message || String(error)
      });
    }
  });

  document.getElementById("settings-install-update")?.addEventListener("click", async () => {
    try {
      await desktopApi.installUpdate();
    } catch (error) {
      renderUpdateState({
        ...(currentUpdateState || {}),
        status: "error",
        message: error.message || "Update install failed.",
        error: error.message || String(error)
      });
    }
  });
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
  const merchantTrafficIntensity = Number(document.getElementById("wizard-merchant-traffic-intensity")?.value || 2);
  const biologicClutterIntensity = Number(document.getElementById("wizard-biologic-clutter-intensity")?.value || 2);
  const hostileSurfaceSupportIntensity = Number(document.getElementById("wizard-hostile-surface-support-intensity")?.value || 2);
  const hostileAirSupportIntensity = Number(document.getElementById("wizard-hostile-air-support-intensity")?.value || 2);
  const friendlySupportIntensity = Number(document.getElementById("wizard-friendly-support-intensity")?.value || 2);
  return {
    title: document.getElementById("wizard-title").value.trim(),
    campaignSeed: document.getElementById("wizard-campaign-seed").value.trim(),
    campaignId: document.getElementById("wizard-campaign-seed").value.trim(),
    theater: document.getElementById("wizard-theater").value,
    campaignClimate: document.getElementById("wizard-climate").value,
    tone: document.getElementById("wizard-climate").value,
    missionType: document.getElementById("wizard-mission-type").value,
    season: document.getElementById("wizard-season")?.value || "theater_default",
    timeOfDay: document.getElementById("wizard-time-of-day")?.value || "theater_default",
    missionStance: document.getElementById("wizard-stance").value,
    posture: document.getElementById("wizard-stance").value,
    rulesOfEngagement: document.getElementById("wizard-roe").value,
    roe: document.getElementById("wizard-roe").value,
    year: Number(document.getElementById("wizard-year").value || 2028),
    scenarioCount: Number(document.getElementById("wizard-scenario-count").value || 1),
    playerSubmarine: document.getElementById("wizard-player-submarine")?.value || "virginia_block_iii",
    playerName: document.getElementById("wizard-player-name").value.trim(),
    forcePoolPolicy: collectForcePoolPolicy(),
    experimentalFeatures: {
      enabled: experimentalEnabled,
      plotSeed
    },
    authoringConstraints: {
      maxDistanceToPrimaryTargetKm: maxTargetDistanceValue ? Number(maxTargetDistanceValue) : null,
      merchantTrafficIntensity,
      biologicClutterIntensity,
      hostileSurfaceSupportIntensity,
      hostileAirSupportIntensity,
      friendlySupportIntensity
    }
  };
}

function intensityLevelLabel(value) {
  return ({
    0: "Sparse",
    1: "Light",
    2: "Standard",
    3: "Heavy",
    4: "Surge"
  })[Number(value)] || "Standard";
}

function refreshWizardIntensityLabels() {
  [
    "merchant-traffic-intensity",
    "biologic-clutter-intensity",
    "hostile-surface-support-intensity",
    "hostile-air-support-intensity",
    "friendly-support-intensity"
  ].forEach((suffix) => {
    const input = document.getElementById(`wizard-${suffix}`);
    const label = document.getElementById(`wizard-${suffix}-label`);
    if (input && label) {
      label.textContent = intensityLevelLabel(input.value);
    }
  });
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
      title: "South China Sea Theater Map",
      vectorSrc: "../docs/south-china-sea-sloc-map.html",
      vectorRelativeName: "south-china-sea-sloc-map.html",
      googleSrc: "../docs/south-china-sea-sloc-google-map.html",
      googleRelativeName: "south-china-sea-sloc-google-map.html"
    };
  }
  if (theaterEntry.id === "norwegian_sea") {
    return {
      title: "Norwegian Sea Theater Map",
      vectorSrc: "../docs/norwegian-sea-sloc-map.html",
      vectorRelativeName: "norwegian-sea-sloc-map.html",
      googleSrc: "../docs/norwegian-sea-sloc-google-map.html",
      googleRelativeName: "norwegian-sea-sloc-google-map.html"
    };
  }
  return null;
}

function operationalMapModeMeta(map, mode = currentOperationalMapMode) {
  if (!map) {
    return null;
  }
  if (mode === "google" && map.googleRelativeName) {
    return {
      src: map.googleSrc,
      relativeName: map.googleRelativeName,
      badge: "Google Basemap",
      copy: "Google mode uses the existing theater debug page with ORBAT overlays. Enter a browser-safe API key inside the map page when prompted."
    };
  }
  return {
    src: map.vectorSrc,
    relativeName: map.vectorRelativeName,
    badge: "Vector ORBAT",
    copy: "Vector mode shows the built-in theater corridor and known ORBAT overlay without any external map dependency."
  };
}

function renderOperationalMapForTracking(theaterNameOrLabel) {
  const title = document.getElementById("tracking-map-title");
  const copy = document.getElementById("tracking-map-copy");
  const link = document.getElementById("tracking-map-link");
  const badge = document.getElementById("tracking-map-badge");
  const vectorButton = document.getElementById("tracking-map-mode-vector");
  const googleButton = document.getElementById("tracking-map-mode-google");
  if (!title || !copy || !link || !badge) {
    return;
  }

  const map = resolveOperationalMapForTheater(theaterNameOrLabel);
  currentOperationalMap = map;
  if (!map) {
    title.textContent = "No theater map loaded";
    copy.textContent = "This campaign theater does not have an embedded operational SLOC page yet.";
    link.disabled = true;
    if (vectorButton) vectorButton.disabled = true;
    if (googleButton) googleButton.disabled = true;
    badge.textContent = "Unavailable";
    renderOperationalMapPreview(null);
    return;
  }

  const modeMeta = operationalMapModeMeta(map);
  title.textContent = map.title;
  copy.textContent = modeMeta.copy;
  link.disabled = false;
  if (vectorButton) {
    vectorButton.disabled = false;
    vectorButton.classList.toggle("toggle-active", currentOperationalMapMode === "vector");
  }
  if (googleButton) {
    googleButton.disabled = !map.googleRelativeName;
    googleButton.classList.toggle("toggle-active", currentOperationalMapMode === "google");
  }
  badge.textContent = modeMeta.badge;
  renderOperationalMapPreview(map);
}

async function resolveOperationalMapSrc(map, mode = currentOperationalMapMode) {
  if (!map) {
    return null;
  }
  const modeMeta = operationalMapModeMeta(map, mode);
  if (!modeMeta) {
    return null;
  }
  if (desktopApi?.getOperationalMapUrl && modeMeta.relativeName) {
    return desktopApi.getOperationalMapUrl({ relativeName: modeMeta.relativeName });
  }
  return modeMeta.src;
}

async function renderOperationalMapPreview(map = currentOperationalMap) {
  const frame = document.getElementById("tracking-map-preview-frame");
  const status = document.getElementById("tracking-map-preview-status");
  if (!frame || !status) {
    return;
  }
  if (!map) {
    frame.src = "about:blank";
    status.textContent = "No preview available.";
    return;
  }
  const modeMeta = operationalMapModeMeta(map);
  const resolvedSrc = await resolveOperationalMapSrc(map);
  if (!resolvedSrc) {
    frame.src = "about:blank";
    status.textContent = "Preview unavailable for this theater.";
    return;
  }
  frame.src = resolvedSrc;
  status.textContent = modeMeta.copy;
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
  const modeMeta = operationalMapModeMeta(map);
  title.textContent = map.title;
  kicker.textContent = modeMeta?.badge || "Operational Area Map";
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
        <div class="muted">${missionCount} mission result${missionCount === 1 ? "" : "s"} recorded. Climate: ${data.state.world_state?.campaign_climate || data.state.world_state?.tone || "-"}. Mission type: ${data.state.world_state?.mission_type || "-"}. Season: ${data.state.world_state?.season_label || data.state.world_state?.season || "-"}. Time: ${data.state.world_state?.time_of_day_label || data.state.world_state?.time_of_day || "-"}. Player sub: ${data.state.world_state?.player_submarine_label || data.state.world_state?.player_submarine || "-"}. Experimental: ${data.state.world_state?.experimental_features?.enabled ? data.state.world_state?.experimental_features?.plotSeedLabel || data.state.world_state?.experimental_features?.plotSeed || "On" : "Off"}. ROE: ${data.state.world_state?.rules_of_engagement || "-"}. Escalation: ${data.state.world_state?.escalation_key || "-"}. The reserved next mission will be regenerated from the latest result, and one additional slot will stay chained behind it.</div>
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
    try {
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
    } catch (error) {
      setContinuationStatus(`Continuation files were generated, but the workflow did not finish: ${error.message}`);
    }
  };
}

function populateWizardSelectors() {
  const theaterSelect = document.getElementById("wizard-theater");
  const climateSelect = document.getElementById("wizard-climate");
  const missionTypeSelect = document.getElementById("wizard-mission-type");
  const seasonSelect = document.getElementById("wizard-season");
  const timeOfDaySelect = document.getElementById("wizard-time-of-day");
  const playerSubmarineSelect = document.getElementById("wizard-player-submarine");
  const stanceSelect = document.getElementById("wizard-stance");
  const roeSelect = document.getElementById("wizard-roe");
  const experimentalEnabled = Boolean(document.getElementById("wizard-experimental-enabled")?.checked);
  const plotSeedSelect = document.getElementById("wizard-plot-seed");
  if (!theaterSelect || !climateSelect || !missionTypeSelect || !seasonSelect || !timeOfDaySelect || !playerSubmarineSelect || !stanceSelect || !roeSelect || !plotSeedSelect) {
    return;
  }
  const previousTheater = theaterSelect.value || "luzon_strait";
  const previousClimate = climateSelect.value || "surveillance";
  const previousMissionType = missionTypeSelect.value;
  const previousSeason = seasonSelect.value || "theater_default";
  const previousTimeOfDay = timeOfDaySelect.value || "theater_default";
  const previousPlayerSubmarine = playerSubmarineSelect.value || "virginia_block_iii";
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
  seasonSelect.innerHTML = Object.entries(getSeasonCatalog()).map(([key, season]) => `
    <option value="${key}">${season.label}</option>
  `).join("");
  timeOfDaySelect.innerHTML = Object.entries(getTimeOfDayCatalog()).map(([key, timeOfDay]) => `
    <option value="${key}">${timeOfDay.label}</option>
  `).join("");
  playerSubmarineSelect.innerHTML = Object.entries(getPlayerSubmarineCatalog())
    .filter(([, playerSubmarine]) => playerSubmarine.verifiedDb !== false && playerSubmarine.playerCapable === true)
    .map(([key, playerSubmarine]) => `
    <option value="${key}">${playerSubmarine.label}</option>
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
  seasonSelect.value = seasonSelect.querySelector(`option[value="${previousSeason}"]`)
    ? previousSeason
    : "theater_default";
  timeOfDaySelect.value = timeOfDaySelect.querySelector(`option[value="${previousTimeOfDay}"]`)
    ? previousTimeOfDay
    : "theater_default";
  playerSubmarineSelect.value = playerSubmarineSelect.querySelector(`option[value="${previousPlayerSubmarine}"]`)
    ? previousPlayerSubmarine
    : "virginia_block_iii";
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
  const playerSubmarineSelect = document.getElementById("wizard-player-submarine");
  if (playerSubmarineSelect && playerSubmarineSelect.querySelector('option[value="virginia_block_iii"]')) {
    playerSubmarineSelect.value = "virginia_block_iii";
  }
  const selectedPlayerHull = getPlayerSubmarineCatalog()[playerSubmarineSelect?.value];
  if (selectedPlayerHull) {
    document.getElementById("wizard-player-name").value = selectedPlayerHull.representativeHull;
  }
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
    forceSeed: true,
    seedValue: generateCampaignSeed(),
    syncTitle: true,
    forceTitle: true,
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
  const vectorButton = document.getElementById("tracking-map-mode-vector");
  const googleButton = document.getElementById("tracking-map-mode-google");
  const closeButton = document.getElementById("tracking-map-close");
  const overlay = document.getElementById("tracking-map-overlay");
  if (!link || !closeButton || !overlay) {
    return;
  }
  link.onclick = async () => {
    await openOperationalMapInApp();
  };
  vectorButton?.addEventListener("click", () => {
    currentOperationalMapMode = "vector";
    renderOperationalMapForTracking(currentRuntimePayload?.state?.metadata?.theater || currentRuntimePayload?.campaign?.theater || "");
  });
  googleButton?.addEventListener("click", () => {
    currentOperationalMapMode = "google";
    renderOperationalMapForTracking(currentRuntimePayload?.state?.metadata?.theater || currentRuntimePayload?.campaign?.theater || "");
  });
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
  ensureWizardCampaignSeed({
    force: !seedFieldLooksGenerated(document.getElementById("wizard-campaign-seed")?.value.trim()),
    seedValue: generateCampaignSeed(),
    syncTitle: true,
    forceTitle: true
  });
  syncWizardDefaultsWithTheater();
  refreshPlayerHullSuggestions(false);
  refreshWizardIntensityLabels();
  refreshCurrentWizardBlueprint();
  if (desktopApi?.loadLocalPlatformCatalog) {
    localPlatformCatalog = await desktopApi.loadLocalPlatformCatalog();
    refreshPlayerHullSuggestions(false);
    renderForcePoolEditor(true);
  }
  document.getElementById("wizard-theater").onchange = () => {
    syncWizardDefaultsWithTheater();
    renderForcePoolEditor(true);
    refreshCurrentWizardBlueprint();
  };
  [
    "wizard-title",
    "wizard-campaign-seed",
    "wizard-climate",
    "wizard-mission-type",
    "wizard-season",
    "wizard-time-of-day",
    "wizard-stance",
    "wizard-roe",
    "wizard-year",
    "wizard-scenario-count",
    "wizard-player-submarine",
    "wizard-player-name",
    "wizard-max-target-distance-km",
    "wizard-merchant-traffic-intensity",
    "wizard-biologic-clutter-intensity",
    "wizard-hostile-surface-support-intensity",
    "wizard-hostile-air-support-intensity",
    "wizard-friendly-support-intensity"
  ].forEach((id) => {
    document.getElementById(id).oninput = () => refreshCurrentWizardBlueprint();
  });
  document.getElementById("wizard-year").addEventListener("change", () => renderForcePoolEditor(false));
  [
    "wizard-merchant-traffic-intensity",
    "wizard-biologic-clutter-intensity",
    "wizard-hostile-surface-support-intensity",
    "wizard-hostile-air-support-intensity",
    "wizard-friendly-support-intensity"
  ].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => refreshWizardIntensityLabels());
  });
  document.getElementById("wizard-experimental-enabled").onchange = () => {
    populateWizardSelectors();
    refreshCurrentWizardBlueprint();
  };
  document.getElementById("wizard-plot-seed").onchange = () => refreshCurrentWizardBlueprint();
  document.getElementById("wizard-player-submarine").addEventListener("change", () => refreshPlayerHullSuggestions(true));
  document.getElementById("wizard-db-force-pools-enabled").addEventListener("change", () => {
    renderForcePoolEditor(false);
    refreshCurrentWizardBlueprint();
  });
  document.getElementById("wizard-db-force-refresh").addEventListener("click", async () => {
    const status = document.getElementById("wizard-db-force-status");
    status.textContent = "Refreshing the local MNW database index...";
    localPlatformCatalog = await desktopApi.loadLocalPlatformCatalog({ refresh: true });
    authoredForcePoolSelection = {};
    refreshPlayerHullSuggestions(false);
    renderForcePoolEditor(true);
    refreshCurrentWizardBlueprint();
  });
  document.getElementById("wizard-regenerate-seed").onclick = () => {
    setWizardCampaignSeed(generateCampaignSeed(), {
      syncTitle: true,
      forceTitle: true
    });
    refreshCurrentWizardBlueprint();
  };
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
    try {
      const result = await desktopApi.deployPackage({
        packagePath: `${desktopInfo.workspaceRoot}/dist/${blueprint.campaignId}.kyt`
      });
      setDesktopOutput(result);
      setWizardStatus(`Deployed ${blueprint.campaignId}.kyt to the configured campaign targets. Identity preflight passed.`);
      await refreshWorkflowStatus();
    } catch (error) {
      setWizardStatus(`Deployment blocked: ${error.message}`);
    }
    const forcePoolErrors = validateForcePoolSelection();
    if (forcePoolErrors.length) {
      setWizardStatus(forcePoolErrors.join(" "));
      return;
    }
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
  let autoSavedOnLaunch = false;
  if (desktopApi?.detectDesktopPaths) {
    const shouldAutoDetect = !settings.gameCampaignPath
      || !settings.userCampaignPath
      || !settings.preferredPackageSourceDir
      || !settings.preferredPackageOutputPath;
    if (shouldAutoDetect) {
      const detected = await desktopApi.detectDesktopPaths();
      settings = mergeDetectedDesktopSettings(settings, detected);
      const canAutoSave = !settings.firstLaunchComplete
        && detected.status?.gameCampaignFound
        && detected.status?.userCampaignFound;
      if (canAutoSave) {
        settings = await desktopApi.saveSettings({
          ...settings,
          firstLaunchComplete: true
        });
        autoSavedOnLaunch = true;
      }
    }
  }
  renderSettingsPreview(settings);
  toggleAdvancedSetup(false);
  syncPackageIdFromCampaign();
  document.getElementById("mode-setup")?.addEventListener("click", () => setWorkspaceMode("setup"));
  document.getElementById("mode-authoring")?.addEventListener("click", () => setWorkspaceMode("authoring"));
  document.getElementById("mode-tracking")?.addEventListener("click", () => setWorkspaceMode("tracking"));
  document.getElementById("settings-toggle-advanced")?.addEventListener("click", () => toggleAdvancedSetup());

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
    setSettingsStatus("Desktop settings saved. Setup is ready.");
    setWorkspaceMode("authoring");
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
    if (detected.status?.gameCampaignFound && detected.status?.userCampaignFound && desktopApi) {
      const saved = await desktopApi.saveSettings({
        ...collectDesktopSettingsForm(),
        firstLaunchComplete: true
      });
      renderSettingsPreview(saved);
      setSettingsStatus("Paths detected and saved automatically. Setup is ready.");
      setWorkspaceMode("authoring");
      await refreshWorkflowStatus();
      return;
    }
    const findings = Array.isArray(detected.findings) ? detected.findings.join(" ") : "Path scan completed.";
    const followUp = detected.status?.gameCampaignFound && detected.status?.userCampaignFound
      ? "Paths look valid. Save And Continue will persist them."
      : "Review the filled paths carefully, adjust any that look wrong, then save settings.";
    setSettingsStatus(`${findings} ${followUp}`);
  });

  document.getElementById("settings-use-generated")?.addEventListener("click", async () => {
    const campaignId = document.getElementById("wizard-campaign-seed")?.value.trim() || "generated_campaign";
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
    }, {
      forceSeed: true,
      seedValue: campaignId,
      syncTitle: false
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
    setSettingsStatus(autoSavedOnLaunch ? "Automatic setup completed. Paths were detected and saved." : "Desktop settings loaded.");
  }
}

function hydrateRuntime(data) {
  currentRuntimePayload = data;
  setTrackingRuntimeAvailability(true);
  renderCampaignSummary(data);
  renderModuleSummary(data);
  renderHeroStats(data);
  renderTheaterTracking(data);
  renderContinuationPlanner(data);
  renderOperationalMapForTracking(data.state?.metadata?.theater || data.campaign?.theater);
  renderOob(data);
  renderMissionResult(data);
  renderManualBuilder(data);
  renderDebriefParser(data);
  renderAisSummaryPlaceholder(data);
  renderCampaignControls(data).catch((error) => {
    const status = document.getElementById("module-controls-status");
    if (status) status.textContent = error.message;
  });

  document.getElementById("settings-export-support")?.addEventListener("click", async () => {
    try {
      setSettingsStatus("Building a redacted support bundle...");
      const campaignId = document.getElementById("settings-campaign-id").value.trim() || "silent_meridian";
      const result = await desktopApi.exportSupportBundle({ campaignId });
      setSettingsStatus(`Support bundle written to ${result.outputPath}`);
      setDesktopOutput(result);
    } catch (error) {
      setSettingsStatus(`Support bundle failed: ${error.message}`);
    }
  });
}

function refreshPlayerHullSuggestions(selectRepresentative = false) {
  const status = document.getElementById("wizard-player-catalog-status");
  const selected = getPlayerSubmarineCatalog()[document.getElementById("wizard-player-submarine")?.value];
  if (!status || !selected) return;
  const playerName = document.getElementById("wizard-player-name");
  if (playerName) playerName.value = selected.representativeHull;
  status.textContent = `${selected.representativeHull} is an allowlisted player-capable hull (element ID ${selected.dbid}).`;
  if (selectRepresentative) {
    refreshCurrentWizardBlueprint();
  }
}

function forcePoolDefinitions() {
  const theaterId = document.getElementById("wizard-theater")?.value || "luzon_strait";
  const theater = getTheaterTemplates()[theaterId];
  const base = getTheaterForcePoolCatalog(theaterId);
  const enemyFaction = theater?.enemies?.[0]?.faction || "CN";
  const supportFactions = (key, fallback) => {
    const values = [...new Set((base[key] || []).map((unit) => unit.faction).filter(Boolean))];
    return values.length ? values : fallback;
  };
  return [
    { key: "friendlySurface", label: "Friendly Surface Support", factions: ["US"], roles: ["surface_combatant"], defaults: base.friendlySurface || [], required: 0 },
    { key: "friendlyAir", label: "Friendly Air Support", factions: ["US"], roles: ["asw_helicopter", "maritime_patrol_aircraft", "aircraft"], defaults: base.friendlyAir || [], required: 0 },
    theater?.family === "sub_hunt"
      ? { key: "enemySubsurface", label: "Enemy Subsurface Pool", factions: [enemyFaction], roles: ["subsurface_combatant"], defaults: base.enemySubsurface || [], required: 2 }
      : { key: "enemySurface", label: "Enemy Surface Pool", factions: [enemyFaction], roles: ["surface_combatant"], defaults: base.enemySurface || [], required: 2 },
    { key: "enemySurfaceSupport", label: "Enemy Surface Support", factions: supportFactions("enemySurfaceSupport", [enemyFaction]), roles: ["surface_combatant"], defaults: base.enemySurfaceSupport || [], required: 0 },
    { key: "enemyAir", label: "Enemy Air Support", factions: supportFactions("enemyAir", [enemyFaction]), roles: ["asw_helicopter", "maritime_patrol_aircraft", "aircraft"], defaults: base.enemyAir || [], required: 0 }
  ];
}

function unitsForForcePool(definition) {
  const year = Number(document.getElementById("wizard-year")?.value || 0);
  return (localPlatformCatalog?.catalog?.units || []).filter((unit) => {
    if (year && unit.introYear && unit.introYear > year) return false;
    return definition.factions.includes(unit.faction) && definition.roles.includes(unit.role);
  });
}

function renderForcePoolEditor(reset = false) {
  const root = document.getElementById("wizard-db-force-pools");
  const status = document.getElementById("wizard-db-force-status");
  const toggle = document.getElementById("wizard-db-force-pools-enabled");
  const enabled = Boolean(toggle?.checked);
  if (!root || !status || !toggle) return;
  if (!localPlatformCatalog?.available) {
    root.innerHTML = "";
    status.textContent = localPlatformCatalog?.error || "The local MNW database is not available. Confirm the game path in Setup.";
    toggle.checked = false;
    toggle.disabled = true;
    return;
  }
  toggle.disabled = false;
  const definitions = forcePoolDefinitions();
  if (reset) authoredForcePoolSelection = {};
  for (const definition of definitions) {
    const eligibleIds = new Set(unitsForForcePool(definition).map((unit) => Number(unit.dbid)));
    if (!authoredForcePoolSelection[definition.key]) {
      const defaultIds = new Set(definition.defaults.map((unit) => Number(unit.dbid)));
      authoredForcePoolSelection[definition.key] = new Set(unitsForForcePool(definition).filter((unit) => defaultIds.has(Number(unit.dbid))).map((unit) => Number(unit.dbid)));
    } else {
      authoredForcePoolSelection[definition.key] = new Set([...authoredForcePoolSelection[definition.key]].filter((dbid) => eligibleIds.has(Number(dbid))));
    }
  }
  root.innerHTML = definitions.map((definition) => {
    const units = unitsForForcePool(definition);
    const options = units.length ? units.map((unit) => `
      <label class="force-pool-option">
        <input type="checkbox" data-force-pool="${definition.key}" value="${unit.dbid}" ${authoredForcePoolSelection[definition.key].has(Number(unit.dbid)) ? "checked" : ""} ${enabled ? "" : "disabled"}>
        <span><strong>${escapeMarkup(unit.name)}</strong><span class="muted">${escapeMarkup(unit.platformName)} · DBID ${unit.dbid} · ${unit.introYear || "year unknown"}</span></span>
      </label>`).join("") : '<div class="muted">No matching installed platforms.</div>';
    return `<article class="nested-card force-pool-group"><strong>${definition.label}</strong><div class="muted">${definition.required ? `Select at least ${definition.required}.` : "Optional; zero disables this support pool."}</div>${options}</article>`;
  }).join("");
  root.querySelectorAll("input[data-force-pool]").forEach((node) => {
    node.addEventListener("change", () => {
      const key = node.dataset.forcePool;
      if (node.checked) authoredForcePoolSelection[key].add(Number(node.value));
      else authoredForcePoolSelection[key].delete(Number(node.value));
      updateForcePoolStatus();
      refreshCurrentWizardBlueprint();
    });
  });
  updateForcePoolStatus();
}

function validateForcePoolSelection() {
  if (!document.getElementById("wizard-db-force-pools-enabled")?.checked) return [];
  if (!localPlatformCatalog?.available) return ["Local MNW DB catalog is unavailable."];
  return forcePoolDefinitions().flatMap((definition) => {
    const count = authoredForcePoolSelection[definition.key]?.size || 0;
    return count < definition.required ? [`${definition.label} requires at least ${definition.required} selections.`] : [];
  });
}

function updateForcePoolStatus() {
  const status = document.getElementById("wizard-db-force-status");
  const enabled = document.getElementById("wizard-db-force-pools-enabled")?.checked;
  if (!status) return;
  if (!enabled) {
    status.textContent = `Local index ready: ${localPlatformCatalog?.catalog?.units?.length || 0} selectable units. Enable authored pools to use it.`;
    return;
  }
  const errors = validateForcePoolSelection();
  status.textContent = errors.length ? errors.join(" ") : `Authored pools valid. Source: ${localPlatformCatalog.catalog.source.archiveName}.`;
}

function collectForcePoolPolicy() {
  if (!document.getElementById("wizard-db-force-pools-enabled")?.checked || validateForcePoolSelection().length) return null;
  const byDbid = new Map((localPlatformCatalog?.catalog?.units || []).map((unit) => [Number(unit.dbid), unit]));
  const pools = {};
  for (const definition of forcePoolDefinitions()) {
    pools[definition.key] = [...(authoredForcePoolSelection[definition.key] || [])].map((dbid) => byDbid.get(dbid)).filter(Boolean);
  }
  return { source: "local_mnw_db", indexedArchive: localPlatformCatalog.catalog.source.archiveName, pools };
}

async function reloadRuntimeForCampaign(campaignId) {
  if (!desktopApi?.exportRuntime) return;
  const refreshed = await desktopApi.exportRuntime({ campaignId });
  if (refreshed?.payload) hydrateRuntime(refreshed.payload);
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
  await initializeAppUpdates();
  await initializeWizard();
  await initializeDesktopOps();
  document.getElementById("tracking-ais-refresh")?.addEventListener("click", refreshAisContacts);
}

main().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#ffb4b4;background:#07131d">${error.stack}</pre>`;
});
