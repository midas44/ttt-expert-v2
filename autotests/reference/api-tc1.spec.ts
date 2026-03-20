import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { ApiTc1Data } from "../data/ApiTc1Data";

test("api_tc1 - get, change and reset server clock @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const data = new ApiTc1Data();
  const apiToken = tttConfig.apiToken;

  // Guard: fail fast on envs without API token
  expect(apiToken, "apiToken must be configured for this env").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(`/api/ttt${data.clockEndpoint}`);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET current server time
  const getResponse = await request.get(baseUrl, { headers: authHeaders });
  expect(getResponse.status()).toBe(200);

  const getBody = await getResponse.json();
  const serverTime: string = getBody.time;
  expect(serverTime).toMatch(data.timeFormatPattern);

  const todayDate = data.extractDate(serverTime);

  const getArtifactPath = testInfo.outputPath("step1-get-clock.json");
  await writeFile(getArtifactPath, JSON.stringify(getBody, null, 2), "utf-8");
  await testInfo.attach("step1-get-clock", { path: getArtifactPath, contentType: "application/json" });

  // Step 2: PATCH clock to +1 day
  const futureTime = data.computeFutureTime(serverTime);
  const futureDate = data.computeFutureDate(serverTime);

  const patchResponse = await request.patch(baseUrl, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: { time: futureTime },
  });
  expect(patchResponse.status()).toBe(200);

  const patchBody = await patchResponse.json();
  const patchedTime: string = patchBody.time;
  expect(data.extractDate(patchedTime)).toBe(futureDate);

  const patchArtifactPath = testInfo.outputPath("step2-patch-clock.json");
  await writeFile(patchArtifactPath, JSON.stringify(patchBody, null, 2), "utf-8");
  await testInfo.attach("step2-patch-clock", { path: patchArtifactPath, contentType: "application/json" });

  // Step 3: POST reset clock
  const resetResponse = await request.post(`${baseUrl}/reset`, { headers: authHeaders });
  expect(resetResponse.status()).toBe(200);

  const resetBody = await resetResponse.json();
  const resetTime: string = resetBody.time;
  expect(data.extractDate(resetTime)).toBe(todayDate);

  const resetArtifactPath = testInfo.outputPath("step3-reset-clock.json");
  await writeFile(resetArtifactPath, JSON.stringify(resetBody, null, 2), "utf-8");
  await testInfo.attach("step3-reset-clock", { path: resetArtifactPath, contentType: "application/json" });
});
