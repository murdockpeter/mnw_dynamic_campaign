param(
    [string]$RootDir = (Join-Path $PSScriptRoot ".."),
    [string]$OutputPath = (Join-Path $PSScriptRoot "..\\generated\\reports\\repo-analysis.html"),
    [switch]$GitVisibleOnly,
    [switch]$BrightTheme
)

$ErrorActionPreference = "Stop"

function Get-Category {
    param([string]$RelativePath)

    switch -Regex ($RelativePath) {
        '^src/package/' { return 'Authoring Source' }
        '^tools/' { return 'Tooling' }
        '^generated/' { return 'Generated Local Data' }
        '^dist/' { return 'Build Artifact' }
        '^tmp/' { return 'Local Reference Extracts' }
        '^(README\.md|RESEARCH\.md|\.gitignore)$' { return 'Project Docs' }
        default { return 'Other' }
    }
}

function Get-Purpose {
    param([string]$RelativePath)

    switch -Regex ($RelativePath) {
        '^\.gitignore$' { return 'Keeps generated artifacts, temporary extracts, logs, and local-only analysis outputs out of git.' }
        '^README\.md$' { return 'Primary repo guide explaining the project, workflow, AI-tool usage, build/deploy steps, and local DB indexing.' }
        '^RESEARCH\.md$' { return 'Reverse-engineering notes covering MNW package layout, scripting model, and database/archive findings.' }

        '^tools/build\.ps1$' { return 'Builds a valid MNW .kyt package from src/package, recalculates manifest hashes, and writes official-style ZIP entries.' }
        '^tools/deploy\.ps1$' { return 'Copies the built campaign package into the game install and LocalLow campaign folders and verifies hashes.' }
        '^tools/index-db\.ps1$' { return 'Indexes the user''s local MNW .core/.ais database archives into JSON and CSV summaries without redistributing game data.' }
        '^tools/report-repo\.ps1$' { return 'Scans this repo and generates an HTML report describing what each file does.' }

        '^src/package/manifest\.json$' { return 'Package manifest listing every file that should be included in the built .kyt along with MD5 hashes.' }
        '^src/package/locale\.csv$' { return 'Plain-text localization table for campaign and mission names, descriptions, objectives, and messages.' }
        '^src/package/template\.cmp\.json$' { return 'Template sidecar pattern for campaign metadata; useful as a structure reference when generating new campaigns.' }
        '^src/package/template\.mis\.json$' { return 'Template sidecar pattern for mission metadata, objectives, messages, and optional assets.' }
        '^src/package/norwegian_shadow/quest\.cmp$' { return 'The sample campaign chain script that starts mission 1 and pipes into mission 2.' }
        '^src/package/norwegian_shadow/quest\.cmp\.json$' { return 'Localized metadata sidecar for the sample campaign, including the visible in-game title and description.' }
        '^src/package/norwegian_shadow/bear_gap\.mis$' { return 'Mission 1 scenario script. Spawns the player Virginia, Russian breakout contacts, merchant clutter, biologics, and mission-complete logic.' }
        '^src/package/norwegian_shadow/bear_gap\.mis\.json$' { return 'Mission 1 metadata and localized text sidecar encoded the way MNW expects.' }
        '^src/package/norwegian_shadow/broken_datum\.mis$' { return 'Mission 2 scenario script. Adds the escalation layer: DDG, P-8, support group, cueing messages, and mission-complete logic.' }
        '^src/package/norwegian_shadow/broken_datum\.mis\.json$' { return 'Mission 2 metadata and localized text sidecar encoded the way MNW expects.' }

        '^dist/\.gitkeep$' { return 'Placeholder so the build artifact directory exists in git without tracking generated .kyt files.' }
        '^dist/.*\.kyt$' { return 'Built MNW package artifact generated from src/package and intended for testing or release, not source editing.' }

        '^generated/\.gitkeep$' { return 'Placeholder so the generated-data directory exists in git while keeping local analysis outputs ignored.' }
        '^generated/db/db_index\.json$' { return 'Aggregate local DB inventory summary produced by tools/index-db.ps1.' }
        '^generated/db/.*\.summary\.json$' { return 'Per-archive local DB summary containing counts, categories, sample strings, and archive metadata.' }
        '^generated/db/.*\.entries\.csv$' { return 'Per-archive flat entry listing produced from the local MNW DB archives for easy filtering and AI ingestion.' }
        '^generated/reports/repo-analysis\.html$' { return 'Human-readable HTML analysis report describing the purpose of files in this repo.' }

        '^tmp/campaigns\.zip$' { return 'Local copy of the shipped official campaign package archive used as a reference input during reverse engineering.' }
        '^tmp/single_missions\.zip$' { return 'Local copy of the shipped official single-mission package archive used as a reference input during reverse engineering.' }
        '^tmp/samples\.zip$' { return 'Local copy of the shipped samples package archive, mainly useful for understanding package structure and asset packaging.' }

        '^tmp/campaigns/manifest\.json$' { return 'Extracted manifest from the official campaigns package, used to understand package inventory and hash expectations.' }
        '^tmp/campaigns/locale\.csv$' { return 'Extracted localization table from the official campaigns package, used as a reference for field naming and text storage.' }
        '^tmp/campaigns/template\.cmp\.json$' { return 'Extracted official campaign sidecar template reference.' }
        '^tmp/campaigns/template\.mis\.json$' { return 'Extracted official mission sidecar template reference from the campaigns package.' }
        '^tmp/campaigns/from_dusk_till_dawn/quest\.cmp$' { return 'Extracted official campaign chain script for the From Dusk Till Dawn campaign.' }
        '^tmp/campaigns/from_dusk_till_dawn/quest\.cmp\.json$' { return 'Extracted official campaign metadata sidecar for From Dusk Till Dawn.' }
        '^tmp/campaigns/from_dusk_till_dawn/.*\.mis$' { return 'Extracted official mission script from the From Dusk Till Dawn campaign, kept as a reference example.' }
        '^tmp/campaigns/from_dusk_till_dawn/.*\.mis\.json$' { return 'Extracted official mission metadata sidecar from the From Dusk Till Dawn campaign.' }
        '^tmp/campaigns/rainbow_panda/quest\.cmp$' { return 'Extracted official Rainbow Panda campaign chain script used to study mission chaining.' }
        '^tmp/campaigns/rainbow_panda/quest\.cmp\.json$' { return 'Extracted official Rainbow Panda campaign metadata sidecar.' }
        '^tmp/campaigns/rainbow_panda/.*\.mis$' { return 'Extracted official Rainbow Panda mission script used as a reference for scripting patterns and content authoring.' }
        '^tmp/campaigns/rainbow_panda/.*\.mis\.json$' { return 'Extracted official Rainbow Panda mission metadata sidecar used as a localization/reference example.' }

        '^tmp/single_missions/manifest\.json$' { return 'Extracted manifest from the official single-missions package.' }
        '^tmp/single_missions/locale\.csv$' { return 'Extracted localization table from the official single-missions package.' }
        '^tmp/single_missions/template\.cmp\.json$' { return 'Extracted template file retained for completeness from the single-missions package.' }
        '^tmp/single_missions/template\.mis\.json$' { return 'Extracted official mission sidecar template reference from the single-missions package.' }
        '^tmp/single_missions/single_missions/.*\.mis$' { return 'Extracted official standalone mission script used as a scenario-authoring reference.' }
        '^tmp/single_missions/single_missions/.*\.mis\.json$' { return 'Extracted official standalone mission metadata sidecar.' }

        '^tmp/samples/manifest\.json$' { return 'Extracted manifest from the sample asset package.' }
        '^tmp/samples/.*\.(ogg|wav)$' { return 'Extracted sample audio asset from the shipped samples package; useful for understanding asset packaging, not core campaign generation.' }

        default { return 'Repo file with no custom description rule yet; inspect manually if it becomes important.' }
    }
}

function HtmlEncode {
    param([string]$Value)
    if ($null -eq $Value) { return "" }
    return [System.Net.WebUtility]::HtmlEncode($Value)
}

$resolvedRoot = (Resolve-Path $RootDir).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDir = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$files =
if ($GitVisibleOnly) {
    $visiblePaths = @(git -C $resolvedRoot ls-files --cached --others --exclude-standard)
    foreach ($relative in $visiblePaths) {
        $fullPath = Join-Path $resolvedRoot $relative
        if (Test-Path $fullPath -PathType Leaf) {
            Get-Item $fullPath
        }
    }
}
else {
    Get-ChildItem -Path $resolvedRoot -Recurse -File |
        Where-Object { $_.FullName -notmatch '\\\.git\\' }
}

$files = $files | Sort-Object FullName

$rows = foreach ($file in $files) {
    $relative = $file.FullName.Substring($resolvedRoot.Length + 1).Replace('\', '/')
    [PSCustomObject]@{
        path = $relative
        category = Get-Category $relative
        size_kb = [Math]::Round($file.Length / 1KB, 2)
        purpose = Get-Purpose $relative
    }
}

$categorySummary = $rows | Group-Object category | Sort-Object Name | ForEach-Object {
    [PSCustomObject]@{
        category = $_.Name
        count = $_.Count
    }
}

$generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
$title = if ($GitVisibleOnly) { "MNW Dynamic Campaign Generator Git-Visible Repo Analysis" } else { "MNW Dynamic Campaign Generator Repo Analysis" }
$subtitle =
if ($GitVisibleOnly) {
    "This report inventories only files that are visible to git after applying .gitignore rules. It is the cleanest view of what a contributor or AI tool should care about in the repository."
}
else {
    "This report inventories the repository, explains what each file is for, and distinguishes source files, tooling, local analysis output, build artifacts, and temporary reverse-engineering extracts."
}

$summaryCards = ($categorySummary | ForEach-Object {
    @"
    <div class="card">
      <div class="label">$(HtmlEncode $_.category)</div>
      <div class="value">$($_.count)</div>
    </div>
"@
}) -join "`n"

$tableRows = ($rows | ForEach-Object {
    @"
      <tr>
        <td><code>$(HtmlEncode $_.path)</code></td>
        <td>$(HtmlEncode $_.category)</td>
        <td>$($_.size_kb)</td>
        <td>$(HtmlEncode $_.purpose)</td>
      </tr>
"@
}) -join "`n"

$themeVars =
if ($BrightTheme) {
@"
      --bg: #f3fbff;
      --panel: rgba(255, 255, 255, 0.96);
      --panel-2: rgba(247, 252, 255, 0.98);
      --line: rgba(0, 114, 166, 0.18);
      --text: #082033;
      --muted: #4d6a7d;
      --accent: #0077b8;
      --accent-2: #0bbf9a;
      --warn: #ff9f1c;
      --shadow: 0 28px 70px rgba(8, 32, 51, 0.12);
"@
}
else {
@"
      --bg: #08131c;
      --panel: rgba(13, 31, 45, 0.88);
      --panel-2: rgba(18, 42, 59, 0.92);
      --line: rgba(140, 196, 221, 0.18);
      --text: #e8f3f8;
      --muted: #9db7c7;
      --accent: #7ed0ff;
      --accent-2: #44e3c2;
      --warn: #ffc36b;
      --shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
"@
}

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$title</title>
  <style>
    :root {
$themeVars
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      font: 15px/1.5 "Segoe UI", "Aptos", system-ui, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(11, 191, 154, 0.18), transparent 28%),
        radial-gradient(circle at top right, rgba(0, 119, 184, 0.16), transparent 26%),
        linear-gradient(180deg, var(--bg) 0%, $(if ($BrightTheme) { "#dff6ff" } else { "#0d1a24" }) 48%, var(--bg) 100%);
      min-height: 100vh;
    }
    .wrap {
      width: min(1380px, calc(100vw - 48px));
      margin: 32px auto 56px;
    }
    .hero {
      padding: 28px 30px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: linear-gradient(145deg, $(if ($BrightTheme) { "rgba(255,255,255,0.98), rgba(240,250,255,0.96)" } else { "rgba(12, 28, 40, 0.95), rgba(8, 19, 28, 0.92)" }));
      box-shadow: var(--shadow);
      overflow: hidden;
      position: relative;
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, transparent 0%, $(if ($BrightTheme) { "rgba(0, 119, 184, 0.09)" } else { "rgba(126, 208, 255, 0.08)" }) 50%, transparent 100%);
      transform: translateX(-100%);
      animation: sweep 8s linear infinite;
      pointer-events: none;
    }
    @keyframes sweep {
      to { transform: translateX(100%); }
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(28px, 4vw, 46px);
      line-height: 1.05;
      letter-spacing: 0.02em;
    }
    .subtitle {
      max-width: 980px;
      color: var(--muted);
      margin: 0 0 14px;
      font-size: 16px;
    }
    .meta {
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
      color: var(--accent);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .cards {
      margin: 22px 0 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 14px;
    }
    .card {
      padding: 16px 18px;
      border-radius: 18px;
      background: linear-gradient(180deg, $(if ($BrightTheme) { "rgba(255,255,255,0.98), rgba(235,248,255,0.98)" } else { "rgba(19, 46, 63, 0.92), rgba(14, 31, 43, 0.94)" }));
      border: 1px solid var(--line);
    }
    .card .label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .card .value {
      font-size: 32px;
      font-weight: 700;
      color: var(--accent-2);
    }
    .section {
      margin-top: 24px;
      padding: 24px 26px;
      border-radius: 22px;
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    h2 {
      margin: 0 0 12px;
      font-size: 22px;
      letter-spacing: 0.01em;
    }
    p {
      margin: 0 0 12px;
      color: var(--muted);
    }
    ul {
      margin: 10px 0 0 18px;
      color: var(--muted);
    }
    .callout {
      margin-top: 14px;
      padding: 14px 16px;
      border-left: 4px solid var(--warn);
      background: rgba(255, 195, 107, 0.08);
      color: $(if ($BrightTheme) { "#6f4600" } else { "#f8e7c8" });
      border-radius: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      overflow: hidden;
      border-radius: 18px;
      background: var(--panel-2);
    }
    thead th {
      text-align: left;
      padding: 14px 14px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      border-bottom: 1px solid var(--line);
      background: $(if ($BrightTheme) { "rgba(229, 246, 255, 0.98)" } else { "rgba(10, 23, 33, 0.78)" });
      position: sticky;
      top: 0;
    }
    tbody td {
      padding: 13px 14px;
      vertical-align: top;
      border-bottom: 1px solid rgba(140, 196, 221, 0.08);
      color: $(if ($BrightTheme) { "#0d2a3d" } else { "#dcebf3" });
    }
    tbody tr:hover td {
      background: $(if ($BrightTheme) { "rgba(0, 119, 184, 0.06)" } else { "rgba(126, 208, 255, 0.05)" });
    }
    code {
      color: $(if ($BrightTheme) { "#006ea8" } else { "#9de8ff" });
      font-family: "Cascadia Code", "Consolas", monospace;
      font-size: 13px;
    }
    .table-wrap {
      overflow: auto;
      border-radius: 18px;
      margin-top: 12px;
    }
    .footer {
      margin-top: 16px;
      color: var(--muted);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>$title</h1>
      <p class="subtitle">$subtitle</p>
      <div class="meta">
        <span>Generated $generatedAt</span>
        <span>Root: $(HtmlEncode $resolvedRoot)</span>
        <span>Total Files: $($rows.Count)</span>
        <span>Scope: $(if ($GitVisibleOnly) { "Git-Visible Only" } else { "All Files" })</span>
      </div>
      <div class="cards">
$summaryCards
      </div>
    </section>

    <section class="section">
      <h2>How To Read This Repo</h2>
      <p>$(if ($GitVisibleOnly) { "This filtered view excludes files hidden by .gitignore, so it reflects the effective public or contributor-facing repo surface." } else { "The repo has a clean working core and a noisy local-analysis edge." })</p>
      <ul>
        <li><strong>Authoring Source</strong>: the files you actually edit to create or change campaigns and missions.</li>
        <li><strong>Tooling</strong>: PowerShell scripts that build, deploy, index local DB archives, and now generate this report.</li>
        <li><strong>Generated Local Data</strong>: machine-generated output from tools, useful on your machine but generally not meant for git.</li>
        <li><strong>Build Artifact</strong>: the compiled `.kyt` package ready for testing in the game.</li>
        <li><strong>Local Reference Extracts</strong>: unpacked official game files kept locally as research material.</li>
      </ul>
      <div class="callout">The most important files for actual campaign work are under <code>src/package/</code> and <code>tools/</code>. $(if ($GitVisibleOnly) { "This report is already filtered to that git-relevant surface plus project docs and tracked placeholders." } else { "The <code>tmp/</code> tree is reference material, not the primary authoring surface." })</div>
    </section>

    <section class="section">
      <h2>File-by-File Analysis</h2>
      <p>Each row below explains the role of a concrete file currently present in the repository folder.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Path</th>
              <th>Category</th>
              <th>Size KB</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
$tableRows
          </tbody>
        </table>
      </div>
      <div class="footer">Report generated by <code>tools/report-repo.ps1</code>. Re-run it any time the repo structure changes.</div>
    </section>
  </div>
</body>
</html>
"@

Set-Content -Path $resolvedOutput -Value $html -Encoding UTF8
Write-Output $resolvedOutput
