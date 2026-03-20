import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc012Data } from "../data/VacationTc012Data";

test("vacation_tc012 - create next-year vacation on/after Feb 1 (allowed) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc012Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  // Pre-check: this test requires current date >= Feb 1 (next-year block is lifted)
  const now = new Date();
  const feb1 = new Date(now.getFullYear(), 1, 1); // Feb = month index 1
  test.skip(now < feb1, "This test requires current date >= Feb 1 (next-year vacation allowed)");

  try {
    // Step 1: POST create vacation with startDate in next year
    // Since today >= Feb 1, the isNextVacationAvailable() check should pass
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const responseStatus = createResponse.status();
    let responseBody: Record<string, unknown> = {};
    try {
      responseBody = await createResponse.json();
    } catch {
      // Non-JSON response
    }

    const artifact = testInfo.outputPath("step1-create-next-year.json");
    await writeFile(artifact, JSON.stringify({ status: responseStatus, body: responseBody }, null, 2), "utf-8");
    await testInfo.attach("step1-create-next-year", { path: artifact, contentType: "application/json" });

    // Capture vacation ID for cleanup if created
    if ((responseBody as Record<string, unknown>).vacation) {
      const vacation = (responseBody as Record<string, unknown>).vacation as Record<string, unknown>;
      if (vacation?.id) {
        createdVacationId = vacation.id as number;
      }
    }

    // Step 2: KEY ASSERTION — the next-year-not-available error must NOT appear
    if (responseStatus === 400) {
      const errorCode = (responseBody.errorCode as string) ?? "";
      const errors = (responseBody.errors ?? []) as Array<{ code?: string }>;

      const hasNextYearBlock =
        errorCode.includes("next.year.not.available") ||
        errors.some((e) => e.code?.includes("next.year.not.available"));

      expect(
        hasNextYearBlock,
        `Next-year block should NOT trigger after Feb 1, but got: ${JSON.stringify(responseBody)}`,
      ).toBe(false);

      // 400 for other reasons (e.g., insufficient days, crossing) is acceptable
    }

    // If 200 — vacation was created successfully, which also proves next-year is allowed
    if (responseStatus === 200) {
      const vacation = (responseBody as Record<string, unknown>).vacation as Record<string, unknown>;
      expect(vacation, "Response should contain vacation object").toBeTruthy();
      expect(vacation.status).toBe("NEW");
    }

    // Accept 200 (created) or 400 (other validation) — both prove next-year block is not active
    expect(
      [200, 400].includes(responseStatus),
      `Expected 200 or 400, got ${responseStatus}`,
    ).toBe(true);
  } finally {
    // Cleanup: delete if created
    if (createdVacationId) {
      const delResp = await request.delete(`${baseUrl}/${createdVacationId}`, {
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
