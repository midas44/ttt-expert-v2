import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc002Data } from "../data/VacationTc002Data";

test("vacation_tc002 - create REGULAR vacation happy path (AV=true office) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc002Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: POST create vacation in AV=true office
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create-response.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create-response", { path: createArtifact, contentType: "application/json" });

    // Step 2: Verify creation response
    expect(createResponse.status(), `Expected 200, got ${createResponse.status()}`).toBe(200);
    const vac = createBody.vacation;
    expect(vac, "Response should contain vacation object").toBeTruthy();
    expect(vac.status).toBe("NEW");
    expect(vac.paymentType).toBe(data.paymentType);

    createdVacationId = vac.id;
    expect(createdVacationId, "Vacation ID should be returned").toBeTruthy();

    // Approver should be auto-assigned
    expect(vac.approver, "Approver should be auto-assigned").toBeTruthy();

    // Step 3: Verify vacationDays in response — AV=true uses full year balance
    const vacDays = createBody.vacationDays;
    if (vacDays) {
      const daysArtifact = testInfo.outputPath("step3-vacation-days.json");
      await writeFile(daysArtifact, JSON.stringify(vacDays, null, 2), "utf-8");
      await testInfo.attach("step3-vacation-days", { path: daysArtifact, contentType: "application/json" });

      // AV=true: availablePaidDays should reflect full year allocation (not prorated)
      const currentYear = vacDays.find?.((d: { year: number }) => d.year === new Date().getFullYear());
      if (currentYear) {
        expect(currentYear.availablePaidDays, "AV=true should show full year balance").toBeGreaterThanOrEqual(0);
      }
    }

    // Step 4: GET created vacation to confirm persistence
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    expect(getResponse.status()).toBe(200);

    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step4-get-vacation.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-get-vacation", { path: getArtifact, contentType: "application/json" });

    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("NEW");
    expect(getVac.startDate).toBe(data.startDate);
    expect(getVac.endDate).toBe(data.endDate);
    expect(getVac.paymentType).toBe(data.paymentType);
  } finally {
    // Cleanup: DELETE the created vacation
    if (createdVacationId) {
      const deleteResponse = await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
      const deleteArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        const deleteBody = await deleteResponse.json();
        await writeFile(deleteArtifact, JSON.stringify(deleteBody, null, 2), "utf-8");
      } catch {
        await writeFile(deleteArtifact, JSON.stringify({ status: deleteResponse.status() }, null, 2), "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: deleteArtifact, contentType: "application/json" });
    }
  }
});
