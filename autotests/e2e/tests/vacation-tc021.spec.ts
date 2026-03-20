import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc021Data } from "../data/VacationTc021Data";

test("vacation_tc021 - Available days decrease atomically on vacation create @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc021Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const balanceUrl = tttConfig.buildUrl(data.buildAvailableDaysUrl());
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Get available days BEFORE creation
    const beforeResp = await request.get(balanceUrl, { headers: authHeaders });
    const beforeBalance = await beforeResp.json();
    const beforeArtifact = testInfo.outputPath("step1-balance-before.json");
    await writeFile(beforeArtifact, JSON.stringify(beforeBalance, null, 2), "utf-8");
    await testInfo.attach("step1-balance-before", { path: beforeArtifact, contentType: "application/json" });

    expect(beforeResp.status(), "Balance fetch should return 200").toBe(200);
    const beforeDays = Number(beforeBalance.availablePaidDays);
    expect(beforeDays, "Available days should be > 0 before test").toBeGreaterThan(0);

    // Step 2: Create 5-day REGULAR vacation
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step2-create.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step2-create", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const vac = createBody.vacation;
    expect(vac).toBeTruthy();
    expect(vac.status).toBe("NEW");
    createdVacationId = vac.id;

    const vacationWorkingDays = vac.regularDays;
    expect(vacationWorkingDays, "Vacation should have regularDays > 0").toBeGreaterThan(0);

    // Step 3: Get available days AFTER creation
    const afterResp = await request.get(balanceUrl, { headers: authHeaders });
    const afterBalance = await afterResp.json();
    const afterArtifact = testInfo.outputPath("step3-balance-after.json");
    await writeFile(afterArtifact, JSON.stringify(afterBalance, null, 2), "utf-8");
    await testInfo.attach("step3-balance-after", { path: afterArtifact, contentType: "application/json" });

    expect(afterResp.status()).toBe(200);
    const afterDays = Number(afterBalance.availablePaidDays);

    // Step 4: Compare — available days should have decreased
    const decrease = beforeDays - afterDays;

    const comparisonArtifact = testInfo.outputPath("step4-comparison.json");
    await writeFile(comparisonArtifact, JSON.stringify({
      beforeDays,
      afterDays,
      decrease,
      vacationWorkingDays,
      exactMatch: decrease === vacationWorkingDays,
    }, null, 2), "utf-8");
    await testInfo.attach("step4-comparison", { path: comparisonArtifact, contentType: "application/json" });

    // Available days should decrease by exactly the number of working days
    expect(
      decrease,
      `Available days should decrease by ${vacationWorkingDays}: before=${beforeDays}, after=${afterDays}, decrease=${decrease}`,
    ).toBe(vacationWorkingDays);
  } finally {
    if (createdVacationId) {
      await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
    }
  }
});
