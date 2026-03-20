import * as fs from "fs";
import * as path from "path";

/**
 * Persistent store for test data in "saved" mode.
 *
 * Three test data modes:
 *   - "static"  — hardcoded defaults, zero DB calls, instant
 *   - "dynamic" — queries PostgreSQL for real data each run
 *   - "saved"   — reads from JSON file; if missing, falls back to dynamic + saves
 *
 * Saved data lives in autotests/e2e/data/saved/<TestClassName>.json.
 * Each file stores the constructor arguments used to create the data class instance,
 * enabling reproducible runs without DB access.
 */

const SAVED_DIR = path.resolve(__dirname, "saved");

/** Ensure the saved/ directory exists. */
function ensureDir(): void {
  if (!fs.existsSync(SAVED_DIR)) {
    fs.mkdirSync(SAVED_DIR, { recursive: true });
  }
}

/** Build the file path for a given data class name. */
function filePath(className: string): string {
  return path.resolve(SAVED_DIR, `${className}.json`);
}

/**
 * Load saved constructor args for a data class.
 * Returns undefined if no saved data exists.
 */
export function loadSaved<T>(className: string): T | undefined {
  const fp = filePath(className);
  if (!fs.existsSync(fp)) return undefined;
  const content = fs.readFileSync(fp, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Save constructor args for a data class.
 * Overwrites any existing saved data.
 */
export function saveToDisk<T>(className: string, args: T): void {
  ensureDir();
  const fp = filePath(className);
  fs.writeFileSync(fp, JSON.stringify(args, null, 2), "utf-8");
}

/**
 * Delete saved data for a data class (forces re-generation on next "saved" run).
 */
export function clearSaved(className: string): boolean {
  const fp = filePath(className);
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
    return true;
  }
  return false;
}

/**
 * List all saved data class names.
 */
export function listSaved(): string[] {
  ensureDir();
  return fs
    .readdirSync(SAVED_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}
