import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc170Data } from "../data/VacationTc170Data";

test("vacation_tc170 - past start date + end before start — both validation errors returned @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc170Data.create(globalConfig.testDataMode);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: Attempt to create vacation with past start date AND end before start
  const createResp = await request.post(vacUrl, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.buildCreateBody(),
  });

  const createBody = await createResp.json();
  const step1Artifact = testInfo.outputPath("step1-create-invalid.json");
  await writeFile(step1Artifact, JSON.stringify({
    request: data.buildCreateBody(),
    status: createResp.status(),
    body: createBody,
  }, null, 2), "utf-8");
  await testInfo.attach("step1-create-invalid", { path: step1Artifact, contentType: "application/json" });

  // Step 2: Verify HTTP 400
  expect(createResp.status(), "Should return 400 for invalid dates").toBe(400);

  // Step 3: Verify errorCode is exception.validation
  const errorCode = createBody.errorCode ?? createBody.error_code;
  expect(errorCode, "errorCode should be exception.validation").toBe(data.expectedErrorCode);

  // Step 4: Verify BOTH validation errors are present
  const errors: Array<{ field?: string; code?: string; message?: string }> = createBody.errors ?? [];

  const step4Artifact = testInfo.outputPath("step4-validation-errors.json");
  await writeFile(step4Artifact, JSON.stringify({
    errorCount: errors.length,
    errors,
    expectedViolations: data.expectedViolations,
    note: "isStartEndDatesCorrect() collects both violations in single pass, then returns false — subsequent validators short-circuited",
  }, null, 2), "utf-8");
  await testInfo.attach("step4-validation-errors", { path: step4Artifact, contentType: "application/json" });

  const errorCodes = errors.map(e => e.code);

  // 4a: Past date violation present
  expect(
    errorCodes,
    "Should contain validation.vacation.start.date.in.past",
  ).toContain("validation.vacation.start.date.in.past");

  // 4b: Date order violation present
  expect(
    errorCodes,
    "Should contain validation.vacation.dates.order",
  ).toContain("validation.vacation.dates.order");

  // Step 5: Verify NO other unexpected validation errors (duration, next-year)
  const unexpectedCodes = errorCodes.filter(
    code => !data.expectedViolations.includes(code!),
  );

  const step5Artifact = testInfo.outputPath("step5-no-extra-errors.json");
  await writeFile(step5Artifact, JSON.stringify({
    unexpectedCodes,
    note: "isValidVacationDuration() and isNextVacationAvailable() should be short-circuited by && operator",
    conclusion: unexpectedCodes.length === 0
      ? "Confirmed: only date-related validations returned, subsequent validators skipped"
      : `Unexpected: ${unexpectedCodes.length} extra validation error(s) found`,
  }, null, 2), "utf-8");
  await testInfo.attach("step5-no-extra-errors", { path: step5Artifact, contentType: "application/json" });

  expect(unexpectedCodes.length, "No unexpected validation errors should be present").toBe(0);

  // Step 6: Verify past-date error targets startDate field
  const pastDateError = errors.find(e => e.code === "validation.vacation.start.date.in.past");
  expect(pastDateError?.field, "Past date error should target startDate field").toBe("startDate");

  // Step 7: Verify no vacation was created (negative test — nothing to clean up)
  expect(createBody.vacation, "No vacation entity should be created").toBeUndefined();
});
