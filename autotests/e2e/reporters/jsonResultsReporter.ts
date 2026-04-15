import * as fs from "fs";
import * as path from "path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { readYaml, readTestDataMode } from "@common/config/configUtils";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

interface RunResultsMeta {
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

interface TestResultEntry {
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
  meta: RunResultsMeta;
  tests: TestResultEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TC_ID_RE = /TC-[A-Z0-9]+-\d+/;
const TAG_RE = /@[\w-]+/g;
const OUTPUT_DIR = path.resolve(__dirname, "../../test-results-json");

function extractTestId(title: string): string | null {
  return title.match(TC_ID_RE)?.[0] ?? null;
}

function extractTags(title: string): string[] {
  return title.match(TAG_RE) ?? [];
}

function browserFromProject(projectName: string): string {
  const first = projectName.split("-")[0];
  if (first === "chrome") return "chromium";
  if (first === "firefox") return "firefox";
  return first;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function readConfigSafe(): { env: string; appUrl: string; testDataMode: string; runId: string; savedDataSet: string } {
  let env = "unknown";
  let appUrl = "";
  let testDataMode = "unknown";
  let runId = "";
  let savedDataSet = "";

  try {
    const globalYml = readYaml(path.resolve(__dirname, "../config/global.yml"));
    testDataMode = readTestDataMode(globalYml["testDataMode"]);
    savedDataSet = String(globalYml["savedDataSet"] ?? "");
  } catch { /* leave defaults */ }

  try {
    const tttYml = readYaml(path.resolve(__dirname, "../../../config/ttt/ttt.yml"));
    env = String(tttYml["env"] ?? "unknown");
    const template = String(tttYml["appUrl"] ?? "");
    appUrl = template.replace("***", env);
  } catch { /* leave defaults */ }

  try {
    const runIdFile = path.resolve(__dirname, "../../test-data/.current-run-id");
    if (fs.existsSync(runIdFile)) {
      runId = fs.readFileSync(runIdFile, "utf-8").trim();
    }
  } catch { /* leave empty */ }

  return { env, appUrl, testDataMode, runId, savedDataSet };
}

// ---------------------------------------------------------------------------
// Reporter
// ---------------------------------------------------------------------------

class JsonResultsReporter implements Reporter {
  private tests: TestResultEntry[] = [];
  private startTime = Date.now();
  private totalTests = 0;
  private config!: ReturnType<typeof readConfigSafe>;

  // Read config in onBegin — runs AFTER globalSetup creates .current-run-id
  onBegin(_config: FullConfig, suite: Suite): void {
    this.startTime = Date.now();
    this.totalTests = suite.allTests().length;
    this.config = readConfigSafe();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const outcome = test.outcome(); // "expected" | "unexpected" | "flaky" | "skipped"
    let status: string;
    if (outcome === "flaky") {
      status = "flaky";
    } else if (outcome === "skipped") {
      status = "skipped";
    } else {
      status = result.status; // "passed" | "failed" | "timedOut" | "interrupted"
    }

    const errorMsg =
      result.errors.length > 0
        ? truncate(result.errors[0].message ?? String(result.errors[0]), 500)
        : null;

    this.tests.push({
      testId: extractTestId(test.title),
      title: test.title,
      status,
      durationMs: result.duration,
      project: test.parent.project()?.name ?? "unknown",
      browser: browserFromProject(test.parent.project()?.name ?? "unknown"),
      tags: extractTags(test.title),
      file: path.relative(
        path.resolve(__dirname, "../../e2e/tests"),
        test.location.file,
      ),
      error: errorMsg,
      retry: result.retry,
    });
  }

  onEnd(result: FullResult): void {
    const durationMs = Date.now() - this.startTime;
    const config = this.config;

    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let flaky = 0;

    // Deduplicate: keep only the last entry per (testId ?? title) + project
    const seen = new Map<string, TestResultEntry>();
    for (const t of this.tests) {
      const key = `${t.testId ?? t.title}::${t.project}`;
      seen.set(key, t);
    }
    const deduped = Array.from(seen.values());

    for (const t of deduped) {
      if (t.status === "passed") passed++;
      else if (t.status === "skipped") skipped++;
      else if (t.status === "flaky") flaky++;
      else failed++;
    }

    const runResults: RunResults = {
      meta: {
        runId: config.runId || `run-${new Date().toISOString().replace(/[:.]/g, "")}`,
        timestamp: new Date().toISOString(),
        env: config.env,
        appUrl: config.appUrl,
        testDataMode: config.testDataMode,
        testDataRunId: config.testDataMode === "saved" && config.savedDataSet
          ? config.savedDataSet
          : config.runId,
        runStatus: result.status,
        durationMs,
        totalTests: this.totalTests,
        passedCount: passed,
        failedCount: failed,
        skippedCount: skipped,
        flakyCount: flaky,
      },
      tests: deduped,
    };

    const json = JSON.stringify(runResults, null, 2);

    // Write to intermediate output dir
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, "results.json"), json, "utf-8");

    // Archive directly to history (avoids race with globalTeardown)
    const historyDir = path.resolve(__dirname, "../../history", runResults.meta.runId);
    fs.mkdirSync(historyDir, { recursive: true });
    fs.writeFileSync(path.join(historyDir, "results.json"), json, "utf-8");
  }

  printsToStdio(): boolean {
    return false;
  }
}

export default JsonResultsReporter;
