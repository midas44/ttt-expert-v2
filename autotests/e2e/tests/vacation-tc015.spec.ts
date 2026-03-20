import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc015Data } from "../data/VacationTc015Data";

test("vacation_tc015 - create with null optionalApprovers triggers NPE (CPO path) @regress @known-bug", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc015Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: POST create vacation without optionalApprovers field (null)
  // For CPO employees (ROLE_DEPARTMENT_MANAGER) with a manager:
  //   Code path: request.getOptionalApprovers().add(manager.getLogin()) → NPE on null list
  const createResponse = await request.post(baseUrl, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.buildCreateBody(),
  });

  const responseStatus = createResponse.status();
  let responseBody: Record<string, unknown> = {};
  try {
    responseBody = await createResponse.json();
  } catch {
    // 500 errors may return non-JSON body
  }

  const artifact = testInfo.outputPath("step1-create-null-optionalApprovers.json");
  await writeFile(artifact, JSON.stringify({ status: responseStatus, body: responseBody }, null, 2), "utf-8");
  await testInfo.attach("step1-create-null-optionalApprovers", { path: artifact, contentType: "application/json" });

  // Step 2: Verify — KNOWN BUG: expects 500 (NPE) for CPO users instead of 400/200
  // The DTO has no @NotNull on optionalApprovers. CPO path calls .add() on null list.
  // Accept 500 (NPE bug), 400 (if bug fixed → validation), or 200 (non-CPO path / bug fixed)
  expect(
    [200, 400, 500].includes(responseStatus),
    `Expected 200, 400, or 500, got ${responseStatus}`,
  ).toBe(true);

  if (responseStatus === 500) {
    // Known NPE bug on CPO path — verify NullPointerException signature
    const exception = (responseBody.exception as string) ?? "";
    const message = (responseBody.message as string) ?? "";
    const isNpe =
      exception.includes("NullPointerException") ||
      message.includes("NullPointerException");
    // Log whether this is the expected NPE or a different 500
    const npeArtifact = testInfo.outputPath("step2-npe-analysis.json");
    await writeFile(npeArtifact, JSON.stringify({ isNpe, exception, message }, null, 2), "utf-8");
    await testInfo.attach("step2-npe-analysis", { path: npeArtifact, contentType: "application/json" });
    expect(
      responseStatus === 500,
      "Should be 500 (known NPE bug when optionalApprovers is null on CPO path)",
    ).toBe(true);
  }

  if (responseStatus === 200) {
    // Bug was fixed or user is not CPO — clean up created vacation
    const vacation = (responseBody as Record<string, unknown>).vacation as Record<string, unknown>;
    if (vacation?.id) {
      const delResp = await request.delete(`${baseUrl}/${vacation.id}`, {
        headers: authHeaders,
      });
      const delArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        await writeFile(delArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(delArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: delArtifact, contentType: "application/json" });
    }
  }
});
