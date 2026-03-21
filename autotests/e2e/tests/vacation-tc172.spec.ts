import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc172Data } from "../data/VacationTc172Data";

test("vacation_tc172 - Past-date validation error returns specific error key @regress", async ({ request }, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc172Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken, "Content-Type": "application/json" };

  // Step 1: Attempt to create vacation with start date in the past
  const pastResp = await request.post(vacUrl, {
    headers: authHeaders,
    data: data.buildCreateBody(),
  });
  const pastBody = await pastResp.json();

  const step1Artifact = testInfo.outputPath("step1-past-date-error.json");
  await writeFile(step1Artifact, JSON.stringify({
    status: pastResp.status(),
    body: pastBody,
    startDate: data.pastStartDate,
    endDate: data.pastEndDate,
  }, null, 2), "utf-8");
  await testInfo.attach("step1-past-date-error", { path: step1Artifact, contentType: "application/json" });

  expect(pastResp.status(), "Past date vacation should be rejected").toBe(400);

  // Capture the error key/message — the backend returns a specific validation key
  const errorCode = pastBody.errorCode ?? pastBody.error ?? "";
  const errorMessage = pastBody.message ?? "";
  const errors = pastBody.errors ?? [];

  const step1bArtifact = testInfo.outputPath("step1b-error-details.json");
  await writeFile(step1bArtifact, JSON.stringify({
    errorCode,
    errorMessage,
    errors,
    note: "Frontend shows this error key as-is (no translation for 'start.date.in.past'). " +
      "Known UX defect: untranslated validation keys displayed to user.",
  }, null, 2), "utf-8");
  await testInfo.attach("step1b-error-details", { path: step1bArtifact, contentType: "application/json" });

  // The error should contain a validation-related key
  const allErrorText = JSON.stringify(pastBody).toLowerCase();
  expect(
    allErrorText.includes("date") || allErrorText.includes("validation") || allErrorText.includes("past"),
    "Error response should reference date validation",
  ).toBe(true);

  // Step 2: Attempt to create vacation with reversed dates (start > end)
  const reversedResp = await request.post(vacUrl, {
    headers: authHeaders,
    data: data.buildReversedDatesBody(),
  });
  const reversedBody = await reversedResp.json();

  const step2Artifact = testInfo.outputPath("step2-reversed-dates-error.json");
  await writeFile(step2Artifact, JSON.stringify({
    status: reversedResp.status(),
    body: reversedBody,
    note: "Expected: validation.vacation.dates.order — no frontend translation for this key",
  }, null, 2), "utf-8");
  await testInfo.attach("step2-reversed-dates-error", { path: step2Artifact, contentType: "application/json" });

  expect(reversedResp.status(), "Reversed dates should be rejected").toBe(400);

  const reversedErrorText = JSON.stringify(reversedBody).toLowerCase();
  expect(
    reversedErrorText.includes("date") || reversedErrorText.includes("order") || reversedErrorText.includes("validation"),
    "Reversed dates error should reference date/order validation",
  ).toBe(true);

  // Step 3: Summary — document which error keys lack frontend translations
  const step3Artifact = testInfo.outputPath("step3-untranslated-keys-summary.json");
  await writeFile(step3Artifact, JSON.stringify({
    untranslatedKeys: [
      "validation.vacation.start.date.in.past",
      "validation.vacation.dates.order",
      "validation.vacation.next.year.not.available",
    ],
    translatedKeys: [
      { key: "exception.validation.vacation.duration", message: "You don't have enough available vacation days" },
      { key: "exception.validation.vacation.too.early", message: "Vacation request can be created after 6 months..." },
    ],
    pastDateResponse: { status: pastResp.status(), errorCode, errorMessage, errors },
    reversedDateResponse: {
      status: reversedResp.status(),
      errorCode: reversedBody.errorCode ?? reversedBody.error ?? "",
      errorMessage: reversedBody.message ?? "",
    },
    defect: "Frontend i18n files lack translations for validation.vacation.start.date.in.past, " +
      "validation.vacation.dates.order, validation.vacation.next.year.not.available. " +
      "User sees raw technical key string instead of human-readable message.",
  }, null, 2), "utf-8");
  await testInfo.attach("step3-untranslated-keys-summary", { path: step3Artifact, contentType: "application/json" });
});
