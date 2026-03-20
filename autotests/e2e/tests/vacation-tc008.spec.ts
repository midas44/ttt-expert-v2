import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc008Data } from "../data/VacationTc008Data";

test("vacation_tc008 - create ADMINISTRATIVE vacation 1 day @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc008Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create ADMINISTRATIVE vacation (single working day)
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create-admin-1day.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create-admin-1day", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const vacation = createBody.vacation;
    expect(vacation, "Response should contain vacation object").toBeTruthy();
    expect(vacation.status).toBe("NEW");
    createdVacationId = vacation.id;
    expect(createdVacationId).toBeTruthy();

    // Verify: 1 working day, ADMINISTRATIVE type
    // API returns regularDays/administrativeDays, not a single "days" field
    expect(vacation.administrativeDays, "Single working day should yield administrativeDays=1").toBe(1);
    expect(vacation.regularDays).toBe(0);
    expect(vacation.startDate).toBe(data.startDate);
    expect(vacation.endDate).toBe(data.endDate);
    expect(vacation.paymentType).toBe("ADMINISTRATIVE");

    // ADMINISTRATIVE doesn't consume paid leave days
    expect(vacation.approver).toBeTruthy();
  } finally {
    // Cleanup
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
