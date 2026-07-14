import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    input: path.join(process.cwd(), "generated", "reports", "current-start-variance.json"),
    output: path.join(process.cwd(), "generated", "reports", "current-start-variance.html")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--input" && next) {
      args.input = next;
      index += 1;
    } else if (token === "--output" && next) {
      args.output = next;
      index += 1;
    }
  }

  return args;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function frequencyMap(values) {
  return [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())]
    .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])));
}

function uniqueMetricCards(metrics = {}) {
  return Object.entries(metrics).map(([key, value]) => `
    <article class="metric-card">
      <div class="metric-label">${escapeHtml(key.replace(/([A-Z])/g, " $1"))}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
    </article>
  `).join("");
}

function distributionSection(title, entries = []) {
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return `
    <section class="panel">
      <div class="section-kicker">Distribution</div>
      <h2>${escapeHtml(title)}</h2>
      <div class="bars">
        ${entries.map(([label, count]) => `
          <div class="bar-row">
            <div class="bar-label">${escapeHtml(label)}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.max(6, Math.round((count / max) * 100))}%"></div>
            </div>
            <div class="bar-value">${escapeHtml(count)}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function runTable(title, runs = []) {
  return `
    <section class="panel">
      <div class="section-kicker">Run Detail</div>
      <h2>${escapeHtml(title)}</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Route</th>
              <th>Bearing</th>
              <th>Task</th>
              <th>Variation</th>
              <th>Geometry</th>
              <th>Force</th>
              <th>Enemy Primary</th>
            </tr>
          </thead>
          <tbody>
            ${runs.map((run, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(run.route)}</td>
                <td>${escapeHtml(run.bearing)}</td>
                <td>${escapeHtml(run.task)}</td>
                <td>${escapeHtml(run.variation)}</td>
                <td>${escapeHtml(run.geometryProfile || "-")}</td>
                <td>${escapeHtml(run.forceProfile || "-")}</td>
                <td>${escapeHtml((run.primary || []).join(", "))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = JSON.parse(await fs.readFile(args.input, "utf8"));
  const variedRuns = Array.isArray(report.variedSeedRuns)
    ? report.variedSeedRuns
    : (Array.isArray(report.variedIdRuns) ? report.variedIdRuns : []);
  const sameRuns = Array.isArray(report.sameSpecRuns) ? report.sameSpecRuns : [];

  const bearingDistribution = frequencyMap(variedRuns.map((run) => run.bearing));
  const taskDistribution = frequencyMap(variedRuns.map((run) => run.task));
  const variationDistribution = frequencyMap(variedRuns.map((run) => run.variation));
  const routeDistribution = frequencyMap(variedRuns.map((run) => run.route));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MNW Variance Report</title>
  <style>
    :root {
      --bg: #07131d;
      --panel: rgba(15, 34, 49, 0.94);
      --panel-2: rgba(18, 43, 61, 0.96);
      --line: rgba(111, 212, 255, 0.14);
      --text: #ecf7fb;
      --muted: #9ebccc;
      --accent: #74d8ff;
      --accent-2: #57e0b7;
      --accent-3: #ffd06e;
      --shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(87, 224, 183, 0.12), transparent 24%),
        radial-gradient(circle at top right, rgba(116, 216, 255, 0.14), transparent 24%),
        linear-gradient(180deg, #07131d 0%, #091a25 48%, #07131d 100%);
      font: 15px/1.55 "Segoe UI", "Aptos", system-ui, sans-serif;
    }
    .page {
      width: min(calc(100% - 28px), 1320px);
      margin: 0 auto;
      padding: 20px 0 30px;
    }
    .hero, .panel {
      border: 1px solid var(--line);
      border-radius: 22px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    .hero {
      padding: 24px;
      background:
        linear-gradient(180deg, rgba(15, 34, 49, 0.96), rgba(10, 24, 35, 0.98)),
        radial-gradient(circle at top right, rgba(116, 216, 255, 0.08), transparent 34%);
    }
    h1, h2, p { margin: 0; }
    h1 {
      font-size: clamp(2.2rem, 4vw, 3.4rem);
      line-height: 1.03;
      margin-bottom: 10px;
      max-width: 10ch;
    }
    .eyebrow, .section-kicker {
      color: var(--accent);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .hero-copy {
      color: var(--muted);
      max-width: 980px;
    }
    .hero-grid, .metrics-grid, .distribution-grid {
      display: grid;
      gap: 14px;
      margin-top: 16px;
    }
    .hero-grid {
      grid-template-columns: 1.3fr 1fr;
    }
    .metrics-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .distribution-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .panel {
      padding: 18px;
      margin-top: 14px;
      background: var(--panel-2);
    }
    .context-list {
      display: grid;
      gap: 10px;
    }
    .context-item, .metric-card {
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(111, 212, 255, 0.08);
    }
    .context-key, .metric-label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .context-value, .metric-value {
      margin-top: 6px;
      font-size: 1.05rem;
      font-weight: 700;
    }
    .bars {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(150px, 220px) minmax(0, 1fr) 40px;
      gap: 12px;
      align-items: center;
    }
    .bar-label, .bar-value {
      font-size: 13px;
    }
    .bar-track {
      height: 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--accent), var(--accent-2));
    }
    .table-wrap {
      overflow: auto;
      margin-top: 14px;
    }
    table {
      width: 100%;
      min-width: 980px;
      border-collapse: collapse;
    }
    th, td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(111, 212, 255, 0.08);
      vertical-align: top;
    }
    th {
      color: var(--accent);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    td {
      font-size: 13px;
    }
    .summary-line {
      color: var(--muted);
      margin-top: 6px;
    }
    @media (max-width: 980px) {
      .hero-grid, .metrics-grid, .distribution-grid {
        grid-template-columns: 1fr;
      }
      .bar-row {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <div class="eyebrow">MNW Dynamic Campaign</div>
      <h1>Variance Summary</h1>
      <p class="hero-copy">This report compares deterministic repeatability against cross-campaign opening variation using the currently saved start settings. Same-spec runs keep the exact same campaign seed. Varied-seed runs keep the same player selections and only change the campaign seed.</p>
      <div class="hero-grid">
        <div class="panel">
          <div class="section-kicker">Saved Start Profile</div>
          <div class="context-list">
            ${Object.entries(report.base || {}).map(([key, value]) => `
              <div class="context-item">
                <div class="context-key">${escapeHtml(key.replace(/([A-Z])/g, " $1"))}</div>
                <div class="context-value">${escapeHtml(value)}</div>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="panel">
          <div class="section-kicker">Batch Summary</div>
          <h2>${escapeHtml((report.base?.campaignSeed || report.base?.campaignId || "campaign"))}</h2>
          <p class="summary-line">Generated at ${escapeHtml(report.generatedAt)}</p>
          <p class="summary-line">Same-spec runs: ${sameRuns.length}</p>
          <p class="summary-line">Varied-seed runs: ${variedRuns.length}</p>
          <p class="summary-line">Report source: ${escapeHtml(args.input)}</p>
          <p class="summary-line">This HTML focuses on mission-1 opening diversity, because that is where stale feeling shows up first.</p>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="section-kicker">Deterministic Control</div>
      <h2>Same-Spec Unique Counts</h2>
      <div class="metrics-grid">
        ${uniqueMetricCards(report.sameSpecUnique || {})}
      </div>
    </section>

    <section class="panel">
      <div class="section-kicker">Cross-Campaign Spread</div>
      <h2>Varied-Seed Unique Counts</h2>
      <div class="metrics-grid">
        ${uniqueMetricCards(report.variedSeedUnique || report.variedIdUnique || {})}
      </div>
    </section>

    <div class="distribution-grid">
      ${distributionSection("Bearing Spread", bearingDistribution)}
      ${distributionSection("Task Spread", taskDistribution)}
      ${distributionSection("Variation Spread", variationDistribution)}
      ${distributionSection("Route Spread", routeDistribution)}
    </div>

    ${runTable("Varied-Seed Mission 1 Runs", variedRuns)}
    ${runTable("Same-Spec Mission 1 Runs", sameRuns)}
  </div>
</body>
</html>`;

  await fs.mkdir(path.dirname(args.output), { recursive: true });
  await fs.writeFile(args.output, html, "utf8");
  console.log(JSON.stringify({
    input: args.input,
    output: args.output
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
