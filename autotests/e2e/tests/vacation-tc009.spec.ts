import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc009Data } from "../data/VacationTc009Data";

test("vacation_tc009 - create with insufficient available days (AV=false) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc009Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: POST create vacation with duration exceeding accrued days (AV=false)
    // AV=false offices use monthly accrual — even multi-year employees have << 777 days
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create-response.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create-response", { path: createArtifact, contentType: "application/json" });

    // Capture vacation ID BEFORE assertions (for cleanup if unexpectedly created)
    if (createBody.vacation?.id) {
      createdVacationId = createBody.vacation.id;
    }

    // Step 2: Verify rejection — insufficient accrued days
    expect(createResponse.status(), `Expected 400, got ${createResponse.status()}`).toBe(400);

    // Check for duration validation error code
    const errorCode = createBody.errorCode ?? "";
    const errors = createBody.errors ?? [];
    const hasDurationError =
      errorCode.includes("duration") ||
      errors.some((e: { code?: string }) => e.code?.includes("duration"));

    expect(
      hasDurationError,
      `Expected validation.vacation.duration error, got: ${JSON.stringify(createBody)}`,
    ).toBe(true);

    // If errors array present, verify field reference
    if (errors.length > 0) {
      const durationErr = errors.find((e: { code?: string }) => e.code?.includes("duration"));
      if (durationErr) {
        expect(
          ["startDate", "endDate"],
          "Duration error should reference startDate or endDate",
        ).toContain(durationErr.field);
      }
    }
  } finally {
    // Cleanup: if vacation was unexpectedly created, delete it
    if (createdVacationId) {
      await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
    }
  }
});
