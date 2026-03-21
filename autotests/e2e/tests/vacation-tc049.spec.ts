import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc049Data } from "../data/VacationTc049Data";

test("TC-VAC-049: CANCELED → NEW (employee re-opens) @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc049Data.create(
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

    // Step 3: Re-open via PUT update (CANCELED → NEW)
    // Update requires `id` in request body
    const updateBody = {
      id: createdVacationId,
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: data.paymentType,
      paymentMonth: data.paymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const updateUrl = `${baseUrl}/${createdVacationId}`;
    const updateResponse = await request.put(updateUrl, {
      headers,
      data: updateBody,
    });
    const updateJson = await updateResponse.json();

    const updateArtifact = testInfo.outputPath("step3-reopen.json");
    await writeFile(
      updateArtifact,
      JSON.stringify(
        { request: updateBody, response: updateJson, status: updateResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step3-reopen", {
      path: updateArtifact,
      contentType: "application/json",
    });

    expect(
      updateResponse.ok(),
      `Re-open failed: ${updateResponse.status()} ${JSON.stringify(updateJson)}`,
    ).toBeTruthy();

    // Step 4: Verify status is NEW again
    const reopenedVacation = updateJson.vacation ?? updateJson;
    expect(
      reopenedVacation.status,
      "Status should be NEW after re-opening a CANCELED vacation",
    ).toBe("NEW");

    // Verify days were recalculated (regularDays or administrativeDays present)
    const totalDays =
      (reopenedVacation.regularDays ?? 0) +
      (reopenedVacation.administrativeDays ?? 0);
    expect(totalDays, "Days should be recalculated on re-open").toBeGreaterThan(0);
  } finally {
    // Cleanup: delete (status is NEW after re-open)
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
