import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc044Data } from "../data/VacationTc044Data";

test("TC-VAC-044: APPROVED → NEW (employee edits dates) @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc044Data.create(
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
    const body = {
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: data.paymentType,
      paymentMonth: data.paymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const createResponse = await request.post(baseUrl, { headers, data: body });
    const createJson = await createResponse.json();

    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(
      createArtifact,
      JSON.stringify(
        { request: body, response: createJson, status: createResponse.status() },
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

    // Step 2: Approve the vacation (NEW → APPROVED)
    const approveUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/approve/${createdVacationId}`,
    );
    const approveResponse = await request.put(approveUrl, { headers });
    const approveJson = await approveResponse.json();

    const approveArtifact = testInfo.outputPath("step2-approve.json");
    await writeFile(
      approveArtifact,
      JSON.stringify(
        { response: approveJson, status: approveResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step2-approve", {
      path: approveArtifact,
      contentType: "application/json",
    });

    expect(
      approveResponse.ok(),
      `Approve failed: ${approveResponse.status()} ${JSON.stringify(approveJson)}`,
    ).toBeTruthy();

    const approvedVacation = approveJson.vacation ?? approveJson;
    expect(approvedVacation.status, "Status should be APPROVED").toBe("APPROVED");

    // Step 3: Update dates (APPROVED → NEW via edit)
    const updateBody = {
      id: createdVacationId,
      login: data.login,
      startDate: data.newStartDate,
      endDate: data.newEndDate,
      paymentType: data.paymentType,
      paymentMonth: data.newPaymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const updateUrl = `${baseUrl}/${createdVacationId}`;
    const updateResponse = await request.put(updateUrl, {
      headers,
      data: updateBody,
    });
    const updateJson = await updateResponse.json();

    const updateArtifact = testInfo.outputPath("step3-update-dates.json");
    await writeFile(
      updateArtifact,
      JSON.stringify(
        { request: updateBody, response: updateJson, status: updateResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step3-update-dates", {
      path: updateArtifact,
      contentType: "application/json",
    });

    expect(
      updateResponse.ok(),
      `Update failed: ${updateResponse.status()} ${JSON.stringify(updateJson)}`,
    ).toBeTruthy();

    // Step 4: Verify status reset to NEW after date edit
    const updatedVacation = updateJson.vacation ?? updateJson;
    expect(
      updatedVacation.status,
      "Status should reset to NEW after editing dates on APPROVED vacation",
    ).toBe("NEW");

    // Verify dates were actually updated
    expect(updatedVacation.startDate, "Start date should be updated").toBe(
      data.newStartDate,
    );
    expect(updatedVacation.endDate, "End date should be updated").toBe(
      data.newEndDate,
    );
  } finally {
    // Cleanup: NEW status allows direct delete
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
