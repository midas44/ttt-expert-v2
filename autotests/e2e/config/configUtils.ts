import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

const BROWSER_NAMES = ["firefox", "chrome", "edge"] as const;
export type BrowserName = (typeof BROWSER_NAMES)[number];

const WAIT_UNTIL_VALUES = [
  "load",
  "domcontentloaded",
  "networkidle",
  "commit",
] as const;
export type WaitUntilValue = (typeof WAIT_UNTIL_VALUES)[number];

/**
 * Loads and parses a YAML file, validating it exists and contains an object.
 */
export function readYaml(filePath: string): Record<string, unknown> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, "utf-8");
  const parsed = yaml.load(content);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `Config file must contain a YAML mapping (object): ${resolved}`,
    );
  }
  return parsed as Record<string, unknown>;
}

/**
 * Validates and returns a finite number, falling back to `fallback` when value is null/undefined.
 */
export function readNumber(
  value: unknown,
  fallback: number,
  field: string,
): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(
      `Invalid number for "${field}": ${JSON.stringify(value)}`,
    );
  }
  return num;
}

/**
 * Validates and returns a non-empty string, falling back to `fallback` when value is null/undefined.
 */
export function readString(
  value: unknown,
  fallback: string,
  field: string,
): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  const str = String(value);
  if (str.trim().length === 0) {
    throw new Error(`Empty string for "${field}"`);
  }
  return str;
}

/**
 * Validates the browser name against allowed values.
 */
export function readBrowserName(value: unknown): BrowserName {
  const name = String(value ?? "chrome").toLowerCase();
  if (!BROWSER_NAMES.includes(name as BrowserName)) {
    throw new Error(
      `Invalid browserName "${name}". Allowed: ${BROWSER_NAMES.join(", ")}`,
    );
  }
  return name as BrowserName;
}

/**
 * Validates the waitUntil value against Playwright's allowed values.
 */
export function readWaitUntil(value: unknown): WaitUntilValue {
  const val = String(value ?? "networkidle").toLowerCase();
  if (!WAIT_UNTIL_VALUES.includes(val as WaitUntilValue)) {
    throw new Error(
      `Invalid waitUntil "${val}". Allowed: ${WAIT_UNTIL_VALUES.join(", ")}`,
    );
  }
  return val as WaitUntilValue;
}

const TEST_DATA_MODES = ["static", "dynamic", "saved"] as const;
export type TestDataMode = (typeof TEST_DATA_MODES)[number];

/**
 * Validates the test data mode against allowed values.
 */
export function readTestDataMode(value: unknown): TestDataMode {
  const mode = String(value ?? "static").toLowerCase();
  if (!TEST_DATA_MODES.includes(mode as TestDataMode)) {
    throw new Error(
      `Invalid testDataMode "${mode}". Allowed: ${TEST_DATA_MODES.join(", ")}`,
    );
  }
  return mode as TestDataMode;
}
