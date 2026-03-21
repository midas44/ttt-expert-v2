import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc013Data } from "../data/VacationTc013Data";

test("TC-VAC-013: Create overlapping vacation (start inside existing) — 400 @regress", async ({
  request,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc013Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const apiToken = tttConfig.apiToken;

  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const headers = {
    [data.authHeaderName]: apiToken,
    "Content-Type": "application/json",
  };

  let setupVacationId: number | null = null;

  try {
    // Step 1: Create setup vacation (Mon-Fri) — this is the "existing" vacation
    const setupBody = {
      login: data.login,
      startDate: data.setupStartDate,
      endDate: data.setupEndDate,
      paymentType: data.paymentType,
      paymentMonth: data.setupPaymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const setupResponse = await request.post(baseUrl, {
      headers,
      data: setupBody,
    });
    const setupJson = await setupResponse.json();

    const setupArtifact = testInfo.outputPath("step1-setup-vacation.json");
    await writeFile(
      setupArtifact,
      JSON.stringify(
        {
          request: setupBody,
          response: setupJson,
          status: setupResponse.status(),
        },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step1-setup-vacation", {
      path: setupArtifact,
      contentType: "application/json",
    });

    expect(
      setupResponse.ok(),
      `Setup vacation creation failed: ${setupResponse.status()} ${JSON.stringify(setupJson)}`,
    ).toBeTruthy();
    // Response wraps data: {vacation: {...}, vacationDays: {...}}
    setupVacationId = setupJson.vacation?.id ?? setupJson.id;
    expect(setupVacationId, "Setup vacation must have an id").toBeTruthy();

    // Step 2: Try to create overlapping vacation (start date inside setup range)
    const overlapBody = {
      login: data.login,
      startDate: data.overlapStartDate,
      endDate: data.overlapEndDate,
      paymentType: data.paymentType,
      paymentMonth: data.overlapPaymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const overlapResponse = await request.post(baseUrl, {
      headers,
      data: overlapBody,
    });
    const overlapJson = await overlapResponse.json();

    const overlapArtifact = testInfo.outputPath("step2-overlap-attempt.json");
    await writeFile(
      overlapArtifact,
      JSON.stringify(
        {
          request: overlapBody,
          response: overlapJson,
          status: overlapResponse.status(),
        },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step2-overlap-attempt", {
      path: overlapArtifact,
      contentType: "application/json",
    });

    // Step 3: Verify HTTP 400 with crossing error
    expect(overlapResponse.status()).toBe(data.expectedHttpStatus);

    const errors: Array<{
      field?: string;
      code?: string;
      message?: string;
    }> = overlapJson.errors ?? [];
    // Error may appear as code or message depending on the validation layer
    const crossingError = errors.find(
      (e) =>
        e.code === data.expectedErrorCode ||
        e.message === data.expectedErrorCode,
    );
    expect(
      crossingError,
      `Expected "${data.expectedErrorCode}" in errors[] code or message, got: ${JSON.stringify(errors)}`,
    ).toBeTruthy();
  } finally {
    // Cleanup: delete the setup vacation
    if (setupVacationId) {
      const deleteResponse = await request.delete(
        `${baseUrl}/${setupVacationId}`,
        { headers },
      );
      const deleteArtifact = testInfo.outputPath("cleanup-delete-setup.json");
      await writeFile(
        deleteArtifact,
        JSON.stringify(
          { id: setupVacationId, status: deleteResponse.status() },
          null,
          2,
        ),
        "utf-8",
      );
      await testInfo.attach("cleanup-delete-setup", {
        path: deleteArtifact,
        contentType: "application/json",
      });
    }
  }
});
