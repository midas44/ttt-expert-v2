import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc007Data } from "../data/VacationTc007Data";

test("vacation_tc007 - create REGULAR vacation 5 calendar days (Mon-Fri boundary) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc007Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create REGULAR vacation (Mon-Fri, 5 calendar days)
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create-5day.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create-5day", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const vacation = createBody.vacation;
    expect(vacation, "Response should contain vacation object").toBeTruthy();
    expect(vacation.status).toBe("NEW");
    createdVacationId = vacation.id;
    expect(createdVacationId).toBeTruthy();

    // Verify days calculation — Mon-Fri = 5 working days
    // API returns regularDays/administrativeDays, not a single "days" field
    expect(vacation.regularDays, "Mon-Fri REGULAR should yield 5 working days").toBe(5);
    expect(vacation.administrativeDays).toBe(0);
    expect(vacation.startDate).toBe(data.startDate);
    expect(vacation.endDate).toBe(data.endDate);
    expect(vacation.paymentType).toBe("REGULAR");

    // Verify approver assigned (pvaynmaster is self-approver)
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
