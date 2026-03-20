import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc030Data } from "../data/VacationTc030Data";

test("vacation_tc030 - update PAID vacation is immutable (rejected) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc030Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: Verify the vacation is actually PAID
  const getResponse = await request.get(`${baseUrl}/${data.paidVacationId}`, {
    headers: authHeaders,
  });

  const getBody = await getResponse.json();
  const getArtifact = testInfo.outputPath("step1-verify-paid.json");
  await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
  await testInfo.attach("step1-verify-paid", { path: getArtifact, contentType: "application/json" });

  expect(getResponse.status(), "GET should return 200").toBe(200);
  const vacation = getBody.vacation ?? getBody;
  expect(vacation.status, "Vacation should be in PAID status").toBe("PAID");

  // Step 2: Attempt to update dates — should be rejected
  const updateResponse = await request.put(
    `${baseUrl}/${data.paidVacationId}`,
    {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildUpdateBody(),
    },
  );

  const updateStatus = updateResponse.status();
  let updateBody: Record<string, unknown> = {};
  try {
    updateBody = await updateResponse.json();
  } catch {
    // Some error responses may be empty
  }

  const updateArtifact = testInfo.outputPath("step2-update-paid.json");
  await writeFile(updateArtifact, JSON.stringify({ status: updateStatus, body: updateBody }, null, 2), "utf-8");
  await testInfo.attach("step2-update-paid", { path: updateArtifact, contentType: "application/json" });

  // PAID is in NON_EDITABLE_STATUSES — permission service returns empty permissions.
  // checkVacation() → hasAccess() or isNextStateAvailable() fails → ServiceException.
  // Accept 400 (status not allowed) or 403 (no permission).
  expect(
    [400, 403].includes(updateStatus),
    `Expected 400 or 403 for PAID immutability, got ${updateStatus}`,
  ).toBe(true);

  // Step 3: GET again to confirm vacation unchanged
  const verifyResponse = await request.get(`${baseUrl}/${data.paidVacationId}`, {
    headers: authHeaders,
  });

  const verifyBody = await verifyResponse.json();
  const verifyArtifact = testInfo.outputPath("step3-verify-unchanged.json");
  await writeFile(verifyArtifact, JSON.stringify(verifyBody, null, 2), "utf-8");
  await testInfo.attach("step3-verify-unchanged", { path: verifyArtifact, contentType: "application/json" });

  expect(verifyResponse.status()).toBe(200);
  const verifyVac = verifyBody.vacation ?? verifyBody;
  expect(verifyVac.status, "Status should still be PAID").toBe("PAID");
  // Dates should be unchanged
  expect(verifyVac.startDate).toBe(data.originalStartDate);
  expect(verifyVac.endDate).toBe(data.originalEndDate);
});
