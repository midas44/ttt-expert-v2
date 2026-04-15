import { readYaml, readTestDataMode } from "@common/config/configUtils";
import { initRun } from "./e2e/data/yamlArtifactStore";
import * as path from "path";

/**
 * Playwright globalSetup — initializes a test-data run directory.
 *
 * Reads the current testDataMode and env, then creates a timestamped
 * run directory under autotests/test-data/ and writes .current-run-id
 * so worker processes can find it.
 *
 * Only activates for "dynamic" and "saved" modes (static needs no artifacts).
 */
export default function globalSetup(): void {
  const globalYml = readYaml(path.resolve(__dirname, "e2e/config/common/global.yml"));
  const mode = readTestDataMode(globalYml["testDataMode"]);

  if (mode === "static") return;

  // Read env from ttt.yml
  const tttYml = readYaml(path.resolve(__dirname, "../config/ttt/ttt.yml"));
  const env = String(tttYml["env"] ?? "qa-1");

  const runId = initRun(env);
  console.log(`[test-data] Run initialized: ${runId} (mode=${mode})`);
}
