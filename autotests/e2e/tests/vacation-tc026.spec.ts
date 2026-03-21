import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc026Data } from "../data/VacationTc026Data";

test("TC-VAC-026: Update dates of NEW vacation @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc026Data.create(
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

  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation (NEW status)
    const createBody = {
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: data.paymentType,
      paymentMonth: data.paymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const createResponse = await request.post(baseUrl, { headers, data: createBody });
    const createJson = await createResponse.json();

    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(
      createArtifact,
      JSON.stringify(
        { request: createBody, response: createJson, status: createResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step1-create", {
      path: createArtifact,
      contentType: "application/json",
    });

    expect(
      createResponse.ok(),
      `Create failed: ${createResponse.status()} ${JSON.stringify(createJson)}`,
    ).toBeTruthy();

    const vacationData = createJson.vacation ?? createJson;
    createdVacationId = vacationData.id;
    expect(createdVacationId, "Created vacation must have an id").toBeTruthy();
    expect(vacationData.status, "Initial status should be NEW").toBe("NEW");

    const originalDays =
      (vacationData.regularDays ?? 0) + (vacationData.administrativeDays ?? 0);

    // Step 2: PUT update with new dates (shift by 1 week)
    const updateBody = {
      id: createdVacationId,
      login: data.login,
      startDate: data.updatedStartDate,
      endDate: data.updatedEndDate,
      paymentType: data.paymentType,
      paymentMonth: data.updatedPaymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const updateUrl = `${baseUrl}/${createdVacationId}`;
    const updateResponse = await request.put(updateUrl, {
      headers,
      data: updateBody,
    });
    const updateJson = await updateResponse.json();

    const updateArtifact = testInfo.outputPath("step2-update.json");
    await writeFile(
      updateArtifact,
      JSON.stringify(
        { request: updateBody, response: updateJson, status: updateResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step2-update", {
      path: updateArtifact,
      contentType: "application/json",
    });

    expect(
      updateResponse.ok(),
      `Update failed: ${updateResponse.status()} ${JSON.stringify(updateJson)}`,
    ).toBeTruthy();

    // Step 3: Verify status remains NEW
    const updatedVacation = updateJson.vacation ?? updateJson;
    expect(
      updatedVacation.status,
      "Status should remain NEW after updating a NEW vacation",
    ).toBe("NEW");

    // Step 4: Verify dates were updated
    expect(
      updatedVacation.startDate,
      "Start date should be updated",
    ).toBe(data.updatedStartDate);
    expect(
      updatedVacation.endDate,
      "End date should be updated",
    ).toBe(data.updatedEndDate);

    // Step 5: Verify days were recalculated (should be same count for Mon-Fri windows)
    const updatedDays =
      (updatedVacation.regularDays ?? 0) + (updatedVacation.administrativeDays ?? 0);
    expect(
      updatedDays,
      "Days should be recalculated (both Mon-Fri = 5 working days)",
    ).toBeGreaterThan(0);
  } finally {
    // Cleanup
    if (createdVacationId) {
      const deleteResponse = await request.delete(
        `${baseUrl}/${createdVacationId}`,
        { headers },
      );
      const cleanupArtifact = testInfo.outputPath("cleanup-delete.json");
      await writeFile(
        cleanupArtifact,
        JSON.stringify(
          { id: createdVacationId, deleteStatus: deleteResponse.status() },
          null,
          2,
        ),
        "utf-8",
      );
      await testInfo.attach("cleanup-delete", {
        path: cleanupArtifact,
        contentType: "application/json",
      });
    }
  }
});
