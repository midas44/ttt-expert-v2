import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc028Data } from "../data/VacationTc028Data";

test("TC-VAC-028: Update CANCELED vacation — re-opens with new dates @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc028Data.create(
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

    // Step 2: Cancel the vacation (NEW → CANCELED)
    const cancelUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/cancel/${createdVacationId}`,
    );
    const cancelResponse = await request.put(cancelUrl, { headers });
    const cancelJson = await cancelResponse.json();

    const cancelArtifact = testInfo.outputPath("step2-cancel.json");
    await writeFile(
      cancelArtifact,
      JSON.stringify(
        { response: cancelJson, status: cancelResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step2-cancel", {
      path: cancelArtifact,
      contentType: "application/json",
    });

    expect(
      cancelResponse.ok(),
      `Cancel failed: ${cancelResponse.status()} ${JSON.stringify(cancelJson)}`,
    ).toBeTruthy();

    const canceledVacation = cancelJson.vacation ?? cancelJson;
    expect(canceledVacation.status, "Status should be CANCELED").toBe("CANCELED");

    // Step 3: PUT update with new dates (CANCELED → NEW, re-opens)
    // CANCELED/REJECTED vacations skip day limit validation in update path
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

    const updateArtifact = testInfo.outputPath("step3-update.json");
    await writeFile(
      updateArtifact,
      JSON.stringify(
        { request: updateBody, response: updateJson, status: updateResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step3-update", {
      path: updateArtifact,
      contentType: "application/json",
    });

    expect(
      updateResponse.ok(),
      `Update failed: ${updateResponse.status()} ${JSON.stringify(updateJson)}`,
    ).toBeTruthy();

    // Step 4: Verify status transitions to NEW (re-opens the vacation)
    // VacationStatusManager.add(CANCELED, NEW, ROLE_EMPLOYEE) — confirmed by TC-049
    const updatedVacation = updateJson.vacation ?? updateJson;
    expect(
      updatedVacation.status,
      "Status should transition to NEW after updating a CANCELED vacation",
    ).toBe("NEW");

    // Step 5: Verify new dates are applied
    expect(
      updatedVacation.startDate,
      "Start date should be updated to new value",
    ).toBe(data.updatedStartDate);
    expect(
      updatedVacation.endDate,
      "End date should be updated to new value",
    ).toBe(data.updatedEndDate);

    // Step 6: Verify days were recalculated
    const updatedDays =
      (updatedVacation.regularDays ?? 0) + (updatedVacation.administrativeDays ?? 0);
    expect(
      updatedDays,
      "Days should be recalculated for new date range",
    ).toBeGreaterThan(0);
  } finally {
    // Cleanup: status is NEW after re-open, so direct delete works
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
