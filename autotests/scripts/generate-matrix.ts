#!/usr/bin/env npx tsx
/**
 * Traceability Matrix Generator
 *
 * Reads all archived test results from history/, cross-references with
 * the manifest and collection definitions, and generates a self-contained
 * HTML traceability matrix at history/matrix.html.
 *
 * Usage: npx tsx scripts/generate-matrix.ts
 */
import * as fs from "fs";
import * as path from "path";

import * as yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, "..");
const HISTORY_DIR = path.join(ROOT, "history");
const TEST_DATA_DIR = path.join(ROOT, "test-data");
const MANIFEST_PATH = path.join(ROOT, "manifest/test-cases.json");
const MANIFEST_DIR = path.join(ROOT, "manifest");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RunMeta {
  runId: string;
  timestamp: string;
  env: string;
  appUrl: string;
  testDataMode: string;
  testDataRunId: string;
  runStatus: string;
  durationMs: number;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  flakyCount: number;
}

interface TestEntry {
  testId: string | null;
  title: string;
  status: string;
  durationMs: number;
  project: string;
  browser: string;
  tags: string[];
  file: string;
  error: string | null;
  retry: number;
}

interface RunResults {
  meta: RunMeta;
  tests: TestEntry[];
}

interface ManifestCase {
  test_id: string;
  title: string;
  priority: string;
  type: string;
}

interface ManifestModule {
  xlsx_path: string;
  suites: Record<string, { test_cases: ManifestCase[] }>;
}

interface CollectionCase {
  test_id: string;
  module: string;
}

interface CollectionManifest {
  collection_name: string;
  tag: string;
  cases: CollectionCase[];
}

interface TcInfo {
  testId: string;
  title: string;
  module: string;
  priority: string;
  type: string;
  xlsxPath: string;
  collections: string[];
  runs: Map<string, TestEntry>; // runId -> result
}

// ---------------------------------------------------------------------------
// TC ID → Module mapping
// ---------------------------------------------------------------------------
const PREFIX_TO_MODULE: Record<string, string> = {
  "TC-ACC": "accounting",
  "TC-ADM": "admin",
  "TC-CS": "cross-service",
  "TC-DO": "day-off",
  "TC-PLN": "planner",
  "TC-RPT": "reports",
  "TC-SEC": "security",
  "TC-SL": "sick-leave",
  "TC-STAT": "statistics",
  "TC-T2724": "t2724",
  "TC-T3404": "t3404",
  "TC-VAC": "vacation",
};

function moduleFromId(testId: string): string {
  const prefix = testId.replace(/-\d+$/, "");
  return PREFIX_TO_MODULE[prefix] ?? "unknown";
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

function loadRuns(): RunResults[] {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  const dirs = fs.readdirSync(HISTORY_DIR).filter((d) => {
    const fp = path.join(HISTORY_DIR, d);
    return (
      fs.statSync(fp).isDirectory() &&
      fs.existsSync(path.join(fp, "results.json"))
    );
  });

  return dirs
    .map((d) => {
      const raw = fs.readFileSync(
        path.join(HISTORY_DIR, d, "results.json"),
        "utf-8",
      );
      return JSON.parse(raw) as RunResults;
    })
    .sort((a, b) => a.meta.timestamp.localeCompare(b.meta.timestamp));
}

function loadManifest(): Map<string, { tc: ManifestCase; module: string; xlsxPath: string }> {
  const map = new Map<string, { tc: ManifestCase; module: string; xlsxPath: string }>();
  if (!fs.existsSync(MANIFEST_PATH)) return map;

  const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  for (const [mod, data] of Object.entries(raw.modules) as [string, ManifestModule][]) {
    for (const suite of Object.values(data.suites)) {
      for (const tc of suite.test_cases) {
        map.set(tc.test_id, { tc, module: mod, xlsxPath: data.xlsx_path });
      }
    }
  }
  return map;
}

function loadCollections(): Map<string, Set<string>> {
  // testId -> Set<collectionName>
  const map = new Map<string, Set<string>>();
  const files = fs
    .readdirSync(MANIFEST_DIR)
    .filter((f) => f.startsWith("collection-") && f.endsWith(".json"));

  for (const f of files) {
    const raw = JSON.parse(
      fs.readFileSync(path.join(MANIFEST_DIR, f), "utf-8"),
    ) as CollectionManifest;
    for (const c of raw.cases) {
      if (!map.has(c.test_id)) map.set(c.test_id, new Set());
      map.get(c.test_id)!.add(raw.collection_name);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Build index
// ---------------------------------------------------------------------------

function buildIndex(
  runs: RunResults[],
  manifest: Map<string, { tc: ManifestCase; module: string; xlsxPath: string }>,
  collections: Map<string, Set<string>>,
): TcInfo[] {
  const index = new Map<string, TcInfo>();

  for (const run of runs) {
    for (const t of run.tests) {
      if (!t.testId) continue;

      if (!index.has(t.testId)) {
        const m = manifest.get(t.testId);
        const cols = collections.get(t.testId);
        index.set(t.testId, {
          testId: t.testId,
          title: m?.tc.title ?? t.title.replace(/\s*@[\w-]+/g, "").replace(/^TC-[A-Z0-9]+-\d+:\s*/, ""),
          module: m?.module ?? moduleFromId(t.testId),
          priority: m?.tc.priority ?? "",
          type: m?.tc.type ?? "",
          xlsxPath: m?.xlsxPath ?? "",
          collections: cols ? Array.from(cols) : [],
          runs: new Map(),
        });
      }

      const tc = index.get(t.testId)!;
      // Keep worst status if multiple entries per run (multi-project)
      const existing = tc.runs.get(run.meta.runId);
      if (!existing || statusRank(t.status) > statusRank(existing.status)) {
        tc.runs.set(run.meta.runId, t);
      }
    }
  }

  return Array.from(index.values()).sort((a, b) =>
    a.testId.localeCompare(b.testId),
  );
}

function statusRank(status: string): number {
  switch (status) {
    case "failed": return 4;
    case "timedOut": return 3;
    case "flaky": return 2;
    case "passed": return 1;
    case "skipped": return 0;
    default: return 3;
  }
}

// ---------------------------------------------------------------------------
// TC ID ↔ className mapping
// ---------------------------------------------------------------------------

const MODULE_TO_CLASS_PREFIX: Record<string, string> = {
  accounting: "Accounting",
  admin: "Admin",
  "cross-service": "CrossService",
  "day-off": "Dayoff",
  planner: "Planner",
  reports: "Reports",
  security: "Security",
  "sick-leave": "SickLeave",
  statistics: "Statistics",
  t2724: "T2724",
  t3404: "T3404",
  vacation: "Vacation",
};

function tcIdToClassName(testId: string): string {
  const module = moduleFromId(testId);
  const classPrefix = MODULE_TO_CLASS_PREFIX[module];
  if (!classPrefix) return "";
  const num = testId.replace(/^TC-[A-Z0-9]+-/, "");
  return `${classPrefix}Tc${num}Data`;
}

// ---------------------------------------------------------------------------
// Synthetic dataset generation
// ---------------------------------------------------------------------------

interface SynthResult {
  synthId: string;
  coveredCount: number;
  totalCount: number;
  missingTcIds: string[];
}

function generateSyntheticDataSet(
  tcList: TcInfo[],
  runs: RunResults[],
): SynthResult {
  const now = new Date();
  const ts = [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const synthId = `synth-${ts}`;
  const synthDir = path.join(TEST_DATA_DIR, synthId);

  // Runs sorted newest first for "latest passing" lookup
  const runsByTime = [...runs].sort(
    (a, b) => b.meta.timestamp.localeCompare(a.meta.timestamp),
  );

  let coveredCount = 0;
  const missingTcIds: string[] = [];
  const sourceRuns = new Set<string>();

  fs.mkdirSync(synthDir, { recursive: true });

  for (const tc of tcList) {
    const className = tcIdToClassName(tc.testId);
    if (!className) {
      missingTcIds.push(tc.testId);
      continue;
    }

    // Find latest run where this TC passed
    let found = false;
    for (const run of runsByTime) {
      const entry = tc.runs.get(run.meta.runId);
      if (!entry || entry.status !== "passed") continue;

      const dataRunId = run.meta.testDataRunId;
      if (!dataRunId) continue;

      const srcFile = path.join(TEST_DATA_DIR, dataRunId, `${className}.yml`);
      if (!fs.existsSync(srcFile)) continue;

      // Copy the YAML file
      fs.copyFileSync(srcFile, path.join(synthDir, `${className}.yml`));
      sourceRuns.add(dataRunId);
      coveredCount++;
      found = true;
      break;
    }

    if (!found) {
      missingTcIds.push(tc.testId);
    }
  }

  // Write _meta.yml
  const meta = {
    runId: synthId,
    generatedAt: now.toISOString(),
    sourceMode: "synthetic",
    description: "Best-of dataset: latest passing test data per TC",
    coveredTcs: coveredCount,
    totalTcs: tcList.length,
    sourceDataRuns: Array.from(sourceRuns).sort(),
  };
  fs.writeFileSync(
    path.join(synthDir, "_meta.yml"),
    yaml.dump(meta, { lineWidth: 120, quotingType: '"' }),
    "utf-8",
  );

  return { synthId, coveredCount, totalCount: tcList.length, missingTcIds };
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateHtml(
  tcList: TcInfo[],
  runs: RunResults[],
  synth: SynthResult | null,
): string {
  const MAX_RUNS = 30;
  const visibleRuns = runs.slice(-MAX_RUNS);
  const allCollections = new Set<string>();
  const allModules = new Set<string>();
  for (const tc of tcList) {
    allModules.add(tc.module);
    for (const c of tc.collections) allCollections.add(c);
  }

  const sortedModules = Array.from(allModules).sort();
  const sortedCollections = Array.from(allCollections).sort();

  // Build run header info
  const runHeaders = visibleRuns.map((r) => {
    return {
      runId: r.meta.runId,
      env: r.meta.env,
      mode: r.meta.testDataMode,
      testDataRunId: r.meta.testDataRunId || "",
      passed: r.meta.passedCount,
      failed: r.meta.failedCount,
      total: r.meta.totalTests,
    };
  });

  // Build table rows
  const rows = tcList.map((tc) => {
    const totalRuns = visibleRuns.filter((r) => tc.runs.has(r.meta.runId)).length;
    const passedRuns = visibleRuns.filter((r) => tc.runs.get(r.meta.runId)?.status === "passed").length;
    const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : -1;

    const cells = visibleRuns.map((r) => {
      const entry = tc.runs.get(r.meta.runId);
      if (!entry) return `<td class="cell-empty">-</td>`;

      const cls = `status-${entry.status}`;
      const dur = entry.durationMs > 0 ? `${(entry.durationMs / 1000).toFixed(1)}s` : "";
      const errTip = entry.error ? `\nError: ${esc(entry.error.slice(0, 200))}` : "";
      const tip = `${entry.status}${dur ? ` (${dur})` : ""}${entry.project ? `\n${entry.project}` : ""}${errTip}`;
      return `<td class="cell-status ${cls}" title="${esc(tip)}"><span class="dot"></span></td>`;
    });

    const docsRef = tc.xlsxPath ? esc(tc.xlsxPath) : esc(tc.module);
    const colsAttr = tc.collections.map((c) => esc(c)).join(" ");

    return `<tr data-module="${esc(tc.module)}" data-collections="${colsAttr}" data-passrate="${passRate}">
      <td class="col-id">${esc(tc.testId)}</td>
      <td class="col-title" title="${esc(tc.title)}">${esc(tc.title)}</td>
      <td class="col-module">${esc(tc.module)}</td>
      <td class="col-priority">${esc(tc.priority)}</td>
      <td class="col-docs" title="${docsRef}">${docsRef}</td>
      <td class="col-rate ${passRate === 100 ? "rate-perfect" : passRate >= 80 ? "rate-good" : passRate >= 0 ? "rate-bad" : ""}">${passRate >= 0 ? passRate + "%" : "-"}</td>
      ${cells.join("\n      ")}
    </tr>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Test Traceability Matrix</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; font-size: 13px; background: #0d1117; color: #c9d1d9; }

  .header { padding: 16px 24px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
  .header h1 { font-size: 18px; color: #f0f6fc; }
  .header .meta { color: #8b949e; font-size: 12px; }
  .header .stats { display: flex; gap: 12px; }
  .header .stat { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .stat-tcs { background: #1f6feb33; color: #58a6ff; }
  .stat-runs { background: #3fb95033; color: #56d364; }

  .tabs { display: flex; gap: 4px; padding: 8px 24px; background: #161b22; border-bottom: 1px solid #30363d; flex-wrap: wrap; }
  .tab { padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; color: #8b949e; background: transparent; border: 1px solid transparent; transition: all 0.15s; }
  .tab:hover { color: #c9d1d9; background: #21262d; }
  .tab.active { color: #f0f6fc; background: #1f6feb; border-color: #1f6feb; }
  .tab-sep { width: 1px; background: #30363d; margin: 2px 4px; }

  .table-wrap { overflow-x: auto; padding: 0; }
  table { border-collapse: collapse; width: max-content; min-width: 100%; }
  th, td { padding: 6px 10px; border: 1px solid #21262d; white-space: nowrap; text-align: left; }
  th { background: #161b22; color: #8b949e; font-weight: 600; font-size: 11px; position: sticky; top: 0; z-index: 2; }
  tr:hover { background: #161b2288; }
  tr:nth-child(even) { background: #0d111766; }
  tr:nth-child(even):hover { background: #161b2288; }
  tr.hidden { display: none; }

  .col-id { font-weight: 600; color: #58a6ff; min-width: 110px; position: sticky; left: 0; z-index: 1; background: inherit; }
  th.col-id { z-index: 3; background: #161b22; }
  .col-title { max-width: 280px; overflow: hidden; text-overflow: ellipsis; color: #c9d1d9; }
  .col-module { color: #8b949e; }
  .col-priority { color: #d2a8ff; }
  .col-docs { max-width: 200px; overflow: hidden; text-overflow: ellipsis; color: #8b949e; font-size: 11px; }
  .col-rate { text-align: center; font-weight: 600; }
  .rate-perfect { color: #56d364; }
  .rate-good { color: #d29922; }
  .rate-bad { color: #f85149; }


  .cell-status { text-align: center; padding: 4px; cursor: default; }
  .cell-empty { text-align: center; color: #30363d; }
  .dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; }
  .status-passed .dot { background: #238636; }
  .status-failed .dot { background: #da3633; }
  .status-flaky .dot { background: #d29922; }
  .status-skipped .dot { background: #484f58; }
  .status-timedOut .dot { background: #bc4c78; }
  .status-interrupted .dot { background: #6e7681; }

  .run-hdr { font-size: 10px; text-align: center; min-width: 60px; }
  .run-hdr .run-id { display: block; color: #c9d1d9; font-family: monospace; font-size: 9px; white-space: nowrap; }
  .run-hdr .mode-badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 9px; margin-top: 2px; }
  .run-hdr .run-data-id { display: block; font-size: 8px; color: #d2a8ff; margin-top: 1px; }
  .mode-dynamic { background: #1f6feb33; color: #58a6ff; }
  .mode-saved { background: #3fb95033; color: #56d364; }
  .mode-static { background: #484f5833; color: #8b949e; }

  .synth-banner { padding: 10px 24px; background: #1c2128; border-bottom: 1px solid #30363d; font-size: 12px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .synth-banner .synth-label { color: #d2a8ff; font-weight: 600; }
  .synth-banner .synth-id { color: #f0f6fc; font-family: monospace; background: #30363d; padding: 2px 8px; border-radius: 4px; user-select: all; }
  .synth-banner .synth-coverage { color: #8b949e; }
  .synth-banner .synth-hint { color: #6e7681; font-size: 11px; }

  .summary-bar { padding: 8px 24px; background: #0d1117; border-top: 1px solid #30363d; color: #8b949e; font-size: 12px; position: sticky; bottom: 0; }

  [title] { cursor: default; }
</style>
</head>
<body>

<div class="header">
  <h1>Test Traceability Matrix</h1>
  <div class="meta">Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC</div>
  <div class="stats">
    <span class="stat stat-tcs">${tcList.length} test cases</span>
    <span class="stat stat-runs">${visibleRuns.length} runs${runs.length > MAX_RUNS ? ` (of ${runs.length})` : ""}</span>
  </div>
</div>

<div class="tabs">
  <div class="tab active" data-filter="all">All</div>
  <div class="tab-sep"></div>
  ${sortedModules.map((m) => `<div class="tab" data-filter="module:${esc(m)}">${esc(m)}</div>`).join("\n  ")}
  ${sortedCollections.length > 0 ? `<div class="tab-sep"></div>` : ""}
  ${sortedCollections.map((c) => `<div class="tab" data-filter="col:${esc(c)}">col:${esc(c)}</div>`).join("\n  ")}
</div>

${synth ? `<div class="synth-banner">
  <span class="synth-label">Synthetic dataset:</span>
  <span class="synth-id">${esc(synth.synthId)}</span>
  <span class="synth-coverage">${synth.coveredCount}/${synth.totalCount} TCs covered</span>
  <span class="synth-hint">Use: savedDataSet: ${esc(synth.synthId)}</span>
</div>` : ""}

<div class="table-wrap">
<table>
<thead>
<tr>
  <th class="col-id">TC ID</th>
  <th>Title</th>
  <th>Module</th>
  <th>Priority</th>
  <th>Test Docs</th>
  <th>Pass%</th>
  ${runHeaders.map((r) => `<th class="run-hdr" title="Run: ${esc(r.runId)}&#10;Data: ${esc(r.testDataRunId)}"><span class="run-id">${esc(r.runId)}</span><span class="mode-badge mode-${esc(r.mode)}">${esc(r.mode)}</span>${r.testDataRunId ? `<span class="run-data-id">${esc(r.testDataRunId)}</span>` : ""}</th>`).join("\n  ")}
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>

<div class="summary-bar" id="summary"></div>

<script>
(function() {
  const tabs = document.querySelectorAll('.tab');
  const rows = document.querySelectorAll('tbody tr');
  const summary = document.getElementById('summary');

  function updateSummary() {
    let visible = 0, total = 0;
    rows.forEach(r => {
      if (!r.classList.contains('hidden')) { visible++; }
      total++;
    });
    summary.textContent = visible + ' of ' + total + ' test cases shown';
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const filter = this.getAttribute('data-filter');

      rows.forEach(r => {
        if (filter === 'all') {
          r.classList.remove('hidden');
        } else if (filter.startsWith('module:')) {
          const mod = filter.slice(7);
          r.classList.toggle('hidden', r.getAttribute('data-module') !== mod);
        } else if (filter.startsWith('col:')) {
          const col = filter.slice(4);
          const cols = (r.getAttribute('data-collections') || '').split(' ');
          r.classList.toggle('hidden', !cols.includes(col));
        }
      });
      updateSummary();
    });
  });

  updateSummary();
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("[matrix] Loading history...");
  const runs = loadRuns();
  if (runs.length === 0) {
    console.log("[matrix] No history runs found in", HISTORY_DIR);
    process.exit(0);
  }
  console.log(`[matrix] Found ${runs.length} run(s)`);

  console.log("[matrix] Loading manifest...");
  const manifest = loadManifest();
  console.log(`[matrix] Manifest: ${manifest.size} test cases`);

  console.log("[matrix] Loading collections...");
  const collections = loadCollections();

  console.log("[matrix] Building index...");
  const tcList = buildIndex(runs, manifest, collections);
  console.log(`[matrix] ${tcList.length} test cases across runs`);

  console.log("[matrix] Generating synthetic dataset...");
  const synth = generateSyntheticDataSet(tcList, runs);
  console.log(
    `[matrix] Synthetic: ${synth.synthId} — ${synth.coveredCount}/${synth.totalCount} TCs covered`,
  );
  if (synth.missingTcIds.length > 0) {
    console.log(
      `[matrix] Missing (never passed): ${synth.missingTcIds.join(", ")}`,
    );
  }

  console.log("[matrix] Generating HTML...");
  const html = generateHtml(tcList, runs, synth);

  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const outPath = path.join(HISTORY_DIR, "matrix.html");
  fs.writeFileSync(outPath, html, "utf-8");
  console.log(`[matrix] Written: ${outPath}`);
}

main();
