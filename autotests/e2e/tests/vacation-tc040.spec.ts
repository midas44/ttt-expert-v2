import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc040Data } from "../data/VacationTc040Data";

test("TC-VAC-040: NEW → REJECTED (approver rejects) @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc040Data.create(
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

    // Step 2: Reject the vacation
    const rejectUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/reject/${createdVacationId}`,
    );
    const rejectResponse = await request.put(rejectUrl, { headers });
    const rejectJson = await rejectResponse.json();

    const rejectArtifact = testInfo.outputPath("step2-reject.json");
    await writeFile(
      rejectArtifact,
      JSON.stringify(
        { response: rejectJson, status: rejectResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step2-reject", {
      path: rejectArtifact,
      contentType: "application/json",
    });

    expect(
      rejectResponse.ok(),
      `Reject failed: ${rejectResponse.status()} ${JSON.stringify(rejectJson)}`,
    ).toBeTruthy();

    // Step 3: Verify status is REJECTED
    const rejectedVacation = rejectJson.vacation ?? rejectJson;
    expect(rejectedVacation.status, "Status should be REJECTED").toBe("REJECTED");
  } finally {
    // Cleanup: REJECTED can be deleted directly
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
