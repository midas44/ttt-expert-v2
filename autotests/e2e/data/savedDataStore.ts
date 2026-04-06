import * as path from "path";
import {
  saveArtifact,
  loadArtifact,
  resolveDataSet,
  listRuns,
} from "./yamlArtifactStore";
import { readYaml, readTestDataMode, type TestDataMode } from "../config/configUtils";

/**
 * Mode-aware facade for test data persistence.
 *
 * Public API consumed by all data classes:
 *   - saveToDisk(className, args) — saves YAML artifact (dynamic & saved modes)
 *   - loadSaved(className)        — loads from the configured savedDataSet
 *   - clearSaved(className)       — removes a single artifact from the current dataset
 *   - listSaved()                 — lists class names in the current dataset
 *
 * Mode behaviour:
 *   - "static"  → saveToDisk is a no-op, loadSaved returns undefined
 *   - "dynamic" → saveToDisk writes YAML artifact, loadSaved returns undefined
 *   - "saved"   → saveToDisk writes (on fallback), loadSaved reads from dataset
 */

const GLOBAL_YML = path.resolve(__dirname, "../config/global.yml");

// Lazy-cached config values (read once per process from global.yml)
let _mode: TestDataMode | undefined;
let _dataSet: string | undefined;

function getMode(): TestDataMode {
  if (_mode === undefined) {
    const data = readYaml(GLOBAL_YML);
    _mode = readTestDataMode(data["testDataMode"]);
  }
  return _mode;
}

function getDataSet(): string {
  if (_dataSet === undefined) {
    const data = readYaml(GLOBAL_YML);
    _dataSet = String(data["savedDataSet"] ?? "latest");
  }
  return _dataSet;
}

/**
 * Save constructor args for a data class.
 *
 * Writes a YAML artifact for "dynamic" and "saved" modes.
 * No-op for "static" mode.
 *
 * Data classes call this unconditionally after resolving args —
 * the mode check is handled here.
 */
export function saveToDisk<T>(className: string, args: T): void {
  const mode = getMode();
  if (mode === "static") return;
  saveArtifact(className, args);
}

/**
 * Load saved constructor args for a data class.
 *
 * Returns the args from the configured savedDataSet, or undefined if
 * no saved data exists (triggering dynamic fallback in the data class).
 */
export function loadSaved<T>(className: string): T | undefined {
  const resolved = resolveDataSet(getDataSet());
  if (!resolved) return undefined;
  return loadArtifact<T>(className, resolved);
}

/**
 * Delete a single artifact from the current dataset.
 * Returns true if the file existed and was removed.
 */
export function clearSaved(className: string): boolean {
  const resolved = resolveDataSet(getDataSet());
  if (!resolved) return false;

  const fs = require("fs") as typeof import("fs");
  const basePath = path.resolve(__dirname, "../../../test-data");
  const fp = path.join(basePath, resolved, `${className}.yml`);
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
    return true;
  }
  return false;
}

/**
 * List all saved data class names in the current dataset.
 */
export function listSaved(): string[] {
  const resolved = resolveDataSet(getDataSet());
  if (!resolved) return [];

  const fs = require("fs") as typeof import("fs");
  const basePath = path.resolve(__dirname, "../../../test-data");
  const dir = path.join(basePath, resolved);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f: string) => f.endsWith(".yml") && !f.startsWith("_"))
    .map((f: string) => f.replace(".yml", ""));
}

/**
 * List all available run IDs (newest first).
 */
export { listRuns };
