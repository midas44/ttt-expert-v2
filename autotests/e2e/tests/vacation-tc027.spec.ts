import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc027Data } from "../data/VacationTc027Data";

test("TC-VAC-027: Update dates of APPROVED vacation — status resets to NEW @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc027Data.create(
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

    // Step 2: Approve the vacation (NEW → APPROVED)
    // pvaynmaster is CPO (ROLE_DEPARTMENT_MANAGER) — self-approves
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

    // Step 3: PUT update with changed dates (APPROVED → NEW reset)
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

    // Step 4: Verify status reset to NEW (key business rule)
    const updatedVacation = updateJson.vacation ?? updateJson;
    expect(
      updatedVacation.status,
      "Status should reset to NEW after editing APPROVED vacation dates",
    ).toBe("NEW");

    // Step 5: Verify dates were updated
    expect(
      updatedVacation.startDate,
      "Start date should be updated",
    ).toBe(data.updatedStartDate);
    expect(
      updatedVacation.endDate,
      "End date should be updated",
    ).toBe(data.updatedEndDate);

    // Step 6: Verify days were recalculated
    const updatedDays =
      (updatedVacation.regularDays ?? 0) + (updatedVacation.administrativeDays ?? 0);
    expect(
      updatedDays,
      "Days should be recalculated for new date range",
    ).toBeGreaterThan(0);
  } finally {
    // Cleanup: status is NEW after update, so direct delete works
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
