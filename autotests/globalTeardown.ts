import * as fs from "fs";
import * as path from "path";
import { readYaml, readTestDataMode } from "@common/config/configUtils";
import { finalizeRun, type RunMeta } from "./e2e/data/yamlArtifactStore";

/**
 * Playwright globalTeardown — finalizes the test-data run.
 *
 * Writes _meta.yml and updates the `latest` symlink (dynamic/saved modes).
 * History archival is handled by the JSON reporter (onEnd) to avoid race conditions.
 */
export default function globalTeardown(): void {
  const globalYml = readYaml(path.resolve(__dirname, "e2e/config/common/global.yml"));
  const mode = readTestDataMode(globalYml["testDataMode"]);

  if (mode === "static") return;

  // Read run ID from .current-run-id
  const runIdFile = path.resolve(__dirname, "test-data/.current-run-id");
  if (!fs.existsSync(runIdFile)) return;
  const runId = fs.readFileSync(runIdFile, "utf-8").trim();
  if (!runId) return;

  // Read env + appUrl from ttt config
  const tttYml = readYaml(path.resolve(__dirname, "../config/ttt/ttt.yml"));
  const env = String(tttYml["env"] ?? "qa-1");

  const envDir = path.resolve(__dirname, "../config/ttt/envs");
  let appUrl = "";
  try {
    readYaml(path.resolve(envDir, `${env}.yml`));
    const template = String(tttYml["appUrl"] ?? "");
    appUrl = template.replace("***", env);
  } catch {
    appUrl = `https://ttt-${env}.noveogroup.com`;
  }

  const meta: RunMeta = {
    runId,
    generatedAt: new Date().toISOString(),
    env,
    appUrl,
    sourceMode: mode,
  };

  finalizeRun(meta);
  console.log(`[test-data] Run finalized: ${runId}`);
}
