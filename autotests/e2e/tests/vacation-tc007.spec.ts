import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc007Data } from "../data/VacationTc007Data";

test("TC-VAC-007: Create REGULAR vacation = 5 calendar days (boundary) @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc007Data.create(globalConfig.testDataMode, tttConfig);
  const apiToken = tttConfig.apiToken;

  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const headers = { [data.authHeaderName]: apiToken, "Content-Type": "application/json" };

  let createdVacationId: number | null = null;

  try {
    // Step 1: POST create REGULAR vacation Mon-Fri (5 calendar days)
    const createBody = {
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: data.paymentType,
      paymentMonth: data.paymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const createResponse = await request.post(baseUrl, {
      headers,
      data: createBody,
    });

    const createJson = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create-5day-vacation.json");
    await writeFile(createArtifact, JSON.stringify({ request: createBody, response: createJson, status: createResponse.status() }, null, 2), "utf-8");
    await testInfo.attach("step1-create-5day-vacation", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), `Expected 200 but got ${createResponse.status()}: ${JSON.stringify(createJson)}`).toBe(200);

    const vacation = createJson.vacation;
    expect(vacation, "Response must include vacation object").toBeTruthy();
    createdVacationId = vacation.id;
    expect(createdVacationId, "Vacation must have an id").toBeTruthy();
    expect(vacation.status).toBe("NEW");
    expect(vacation.paymentType).toBe("REGULAR");
    // Mon-Fri = 5 calendar days; working days may be 4 if a holiday falls in the range
    expect(vacation.regularDays).toBeGreaterThanOrEqual(4);
    expect(vacation.regularDays).toBeLessThanOrEqual(5);
    expect(vacation.administrativeDays).toBe(0);
    expect(vacation.startDate).toBe(data.startDate);
    expect(vacation.endDate).toBe(data.endDate);

    // Step 2: GET to confirm persistence
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, { headers });
    expect(getResponse.status()).toBe(200);

    const getJson = await getResponse.json();
    const getArtifact = testInfo.outputPath("step2-get-5day-vacation.json");
    await writeFile(getArtifact, JSON.stringify(getJson, null, 2), "utf-8");
    await testInfo.attach("step2-get-5day-vacation", { path: getArtifact, contentType: "application/json" });

    const getVacation = getJson.vacation ?? getJson;
    expect(getVacation.id).toBe(createdVacationId);
    expect(getVacation.regularDays).toBeGreaterThanOrEqual(4);
  } finally {
    if (createdVacationId) {
      const deleteResponse = await request.delete(`${baseUrl}/${createdVacationId}`, { headers });
      const deleteArtifact = testInfo.outputPath("cleanup-delete-vacation.json");
      await writeFile(deleteArtifact, JSON.stringify({ id: createdVacationId, status: deleteResponse.status() }, null, 2), "utf-8");
      await testInfo.attach("cleanup-delete-vacation", { path: deleteArtifact, contentType: "application/json" });
    }
  }
});
