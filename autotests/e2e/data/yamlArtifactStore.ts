import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

/**
 * YAML artifact store for test data persistence.
 *
 * Stores per-class YAML files in timestamped run directories:
 *   autotests/test-data/<runId>/<ClassName>.yml
 *
 * Used by savedDataStore.ts (the public facade) — not imported directly by data classes.
 */

const TEST_DATA_DIR = path.resolve(__dirname, "../../../test-data");
const RUN_ID_FILE = path.join(TEST_DATA_DIR, ".current-run-id");

/** Cached run ID for the current process (read once from .current-run-id). */
let cachedRunId: string | undefined;

// ---------------------------------------------------------------------------
// Run lifecycle (called from globalSetup / globalTeardown)
// ---------------------------------------------------------------------------

export interface RunMeta {
  runId: string;
  generatedAt: string;
  env: string;
  appUrl: string;
  sourceMode: string;
}

/**
 * Initialize a new run directory and write the .current-run-id marker.
 * Called once from globalSetup.
 */
export function initRun(env: string): string {
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
  const runId = `${ts}-${env}`;

  const runDir = path.join(TEST_DATA_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(RUN_ID_FILE, runId, "utf-8");
  cachedRunId = runId;
  return runId;
}

/**
 * Write _meta.yml and update the `latest` symlink.
 * Called once from globalTeardown.
 */
export function finalizeRun(meta: RunMeta): void {
  const runDir = path.join(TEST_DATA_DIR, meta.runId);
  if (!fs.existsSync(runDir)) return;

  // Write _meta.yml
  const content = yaml.dump(meta, { lineWidth: 120, quotingType: '"' });
  fs.writeFileSync(path.join(runDir, "_meta.yml"), content, "utf-8");

  // Update `latest` symlink atomically (write temp, rename)
  const latestLink = path.join(TEST_DATA_DIR, "latest");
  const tmpLink = `${latestLink}.tmp.${process.pid}`;
  try {
    fs.symlinkSync(meta.runId, tmpLink);
    fs.renameSync(tmpLink, latestLink);
  } catch {
    // Fallback: remove + create (non-atomic but works on all platforms)
    try { fs.unlinkSync(tmpLink); } catch { /* ignore */ }
    try { fs.unlinkSync(latestLink); } catch { /* ignore */ }
    try { fs.symlinkSync(meta.runId, latestLink); } catch { /* ignore */ }
  }

  // Clean up .current-run-id
  try { fs.unlinkSync(RUN_ID_FILE); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Per-class artifact I/O (called from savedDataStore facade)
// ---------------------------------------------------------------------------

/**
 * Get the current run ID (reads .current-run-id lazily, caches in-process).
 */
export function getRunId(): string {
  if (cachedRunId) return cachedRunId;
  if (!fs.existsSync(RUN_ID_FILE)) {
    throw new Error(
      `No active test-data run. Ensure globalSetup ran (missing ${RUN_ID_FILE}).`,
    );
  }
  cachedRunId = fs.readFileSync(RUN_ID_FILE, "utf-8").trim();
  return cachedRunId;
}

/**
 * Save a data class's constructor args as a YAML artifact.
 */
export function saveArtifact<T>(className: string, args: T): void {
  const runId = getRunId();
  const runDir = path.join(TEST_DATA_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const doc = {
    className,
    runId,
    savedAt: new Date().toISOString(),
    args,
  };

  const content = yaml.dump(doc, { lineWidth: 120, quotingType: '"' });
  fs.writeFileSync(path.join(runDir, `${className}.yml`), content, "utf-8");
}

/**
 * Load a data class's constructor args from a YAML artifact.
 * Returns undefined if the file does not exist.
 */
export function loadArtifact<T>(className: string, dataSet: string): T | undefined {
  const resolved = resolveDataSet(dataSet);
  if (!resolved) return undefined;

  const fp = path.join(TEST_DATA_DIR, resolved, `${className}.yml`);
  if (!fs.existsSync(fp)) return undefined;

  const raw = fs.readFileSync(fp, "utf-8");
  const doc = yaml.load(raw) as { args?: T } | undefined;
  return doc?.args;
}

/**
 * Resolve a dataSet identifier to an actual directory name.
 * - "latest" follows the symlink
 * - Any other string is returned as-is if the directory exists
 */
export function resolveDataSet(dataSet: string): string | undefined {
  if (dataSet === "latest") {
    const latestLink = path.join(TEST_DATA_DIR, "latest");
    if (!fs.existsSync(latestLink)) return undefined;
    // Read symlink target (relative name)
    try {
      return fs.readlinkSync(latestLink);
    } catch {
      return undefined;
    }
  }

  const dir = path.join(TEST_DATA_DIR, dataSet);
  if (fs.existsSync(dir)) return dataSet;
  return undefined;
}

/**
 * List all available run directories (sorted newest first).
 */
export function listRuns(): string[] {
  if (!fs.existsSync(TEST_DATA_DIR)) return [];
  return fs
    .readdirSync(TEST_DATA_DIR)
    .filter((entry) => {
      if (entry === "latest" || entry.startsWith(".")) return false;
      const fp = path.join(TEST_DATA_DIR, entry);
      return fs.statSync(fp).isDirectory();
    })
    .sort()
    .reverse();
}
