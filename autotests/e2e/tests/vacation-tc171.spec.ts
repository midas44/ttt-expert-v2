import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc171Data } from "../data/VacationTc171Data";

test("vacation_tc171 - boundary: today/future accepted, yesterday rejected @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc171Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: POST with startDate >= today → should SUCCEED
    const acceptedResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildAcceptedCreateBody(),
    });

    const acceptedBody = await acceptedResponse.json();
    const acceptedArtifact = testInfo.outputPath("step1-accepted-response.json");
    await writeFile(acceptedArtifact, JSON.stringify(acceptedBody, null, 2), "utf-8");
    await testInfo.attach("step1-accepted-response", { path: acceptedArtifact, contentType: "application/json" });

    expect(
      acceptedResponse.status(),
      `Start date >= today should be accepted. Got ${acceptedResponse.status()}: ${JSON.stringify(acceptedBody)}`,
    ).toBe(200);

    const acceptedVac = acceptedBody.vacation;
    expect(acceptedVac, "Response should contain vacation object").toBeTruthy();
    expect(acceptedVac.status).toBe("NEW");
    expect(acceptedVac.startDate).toBe(data.acceptedStartDate);
    createdVacationId = acceptedVac.id;

    // Step 2: POST with startDate = yesterday → should FAIL
    const rejectedResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildRejectedCreateBody(),
    });

    const rejectedBody = await rejectedResponse.json();
    const rejectedArtifact = testInfo.outputPath("step2-rejected-response.json");
    await writeFile(rejectedArtifact, JSON.stringify(rejectedBody, null, 2), "utf-8");
    await testInfo.attach("step2-rejected-response", { path: rejectedArtifact, contentType: "application/json" });

    expect(
      rejectedResponse.status(),
      `Yesterday's start date should be rejected. Got ${rejectedResponse.status()}`,
    ).toBe(400);

    // Verify error references past date validation
    const errorStr = JSON.stringify(rejectedBody).toLowerCase();
    expect(
      errorStr,
      "Error should reference past date validation",
    ).toContain("past");
  } finally {
    // Cleanup: DELETE the accepted vacation
    if (createdVacationId) {
      await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
    }
  }
});
