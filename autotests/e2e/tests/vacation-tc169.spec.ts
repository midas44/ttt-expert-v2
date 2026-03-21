import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc169Data } from "../data/VacationTc169Data";

test("vacation_tc169 - update vacation start date to past — validation rejects @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc169Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create valid vacation with future dates
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResp.json();
    const step1Artifact = testInfo.outputPath("step1-create-valid.json");
    await writeFile(step1Artifact, JSON.stringify({
      request: data.buildCreateBody(),
      status: createResp.status(),
      body: createBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step1-create-valid", { path: step1Artifact, contentType: "application/json" });

    expect(createResp.status(), "Create should return 200").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createdVacationId, "Should get vacation ID").toBeTruthy();

    const originalStartDate = createBody.vacation?.startDate;

    // Step 2: Attempt to update with past start date
    const updateBody = data.buildUpdateBody(createdVacationId!);
    const updateResp = await request.put(`${vacUrl}/${createdVacationId}`, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: updateBody,
    });

    const updateRespBody = await updateResp.json();
    const step2Artifact = testInfo.outputPath("step2-update-past-date.json");
    await writeFile(step2Artifact, JSON.stringify({
      request: updateBody,
      status: updateResp.status(),
      body: updateRespBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-update-past-date", { path: step2Artifact, contentType: "application/json" });

    // Step 3: Verify HTTP 400
    expect(updateResp.status(), "Should return 400 for past start date").toBe(400);

    // Step 4: Verify error code
    const errorCode = updateRespBody.errorCode ?? updateRespBody.error_code;
    expect(errorCode, "errorCode should be exception.validation").toBe(data.expectedErrorCode);

    // Step 5: Verify past-date violation in errors array
    const errors: Array<{ field?: string; code?: string; message?: string }> = updateRespBody.errors ?? [];
    const errorCodes = errors.map(e => e.code);

    const step5Artifact = testInfo.outputPath("step5-validation-errors.json");
    await writeFile(step5Artifact, JSON.stringify({
      errorCount: errors.length,
      errors,
      expectedViolation: data.expectedViolationCode,
      note: "VacationUpdateValidator delegates to VacationCreateValidator.isStartEndDatesCorrect()",
    }, null, 2), "utf-8");
    await testInfo.attach("step5-validation-errors", { path: step5Artifact, contentType: "application/json" });

    expect(
      errorCodes,
      "Should contain validation.vacation.start.date.in.past",
    ).toContain(data.expectedViolationCode);

    // Step 6: Verify past-date error targets startDate field
    const pastDateError = errors.find(e => e.code === data.expectedViolationCode);
    expect(pastDateError?.field, "Past date error should target startDate field").toBe("startDate");

    // Step 7: Verify vacation entity NOT modified — GET the vacation
    const getResp = await request.get(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    const getBody = await getResp.json();

    const step7Artifact = testInfo.outputPath("step7-verify-unchanged.json");
    await writeFile(step7Artifact, JSON.stringify({
      originalStartDate,
      currentStartDate: getBody.vacation?.startDate ?? getBody.startDate,
      isUnchanged: (getBody.vacation?.startDate ?? getBody.startDate) === originalStartDate,
      note: "Validation failure should leave the vacation entity unchanged",
    }, null, 2), "utf-8");
    await testInfo.attach("step7-verify-unchanged", { path: step7Artifact, contentType: "application/json" });

    const currentStartDate = getBody.vacation?.startDate ?? getBody.startDate;
    expect(currentStartDate, "Vacation start date should be unchanged after failed update").toBe(originalStartDate);
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    }
  }
});
