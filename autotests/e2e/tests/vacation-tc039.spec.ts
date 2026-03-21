import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc039Data } from "../data/VacationTc039Data";

test("TC-VAC-039: NEW → APPROVED (approver approves) @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc039Data.create(
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
    // Step 1: Create vacation (NEW status — pvaynmaster self-approves as CPO)
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

    // Step 2: Approve the vacation
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

    // Step 3: Verify status is APPROVED
    const approvedVacation = approveJson.vacation ?? approveJson;
    expect(approvedVacation.status, "Status should be APPROVED after approval").toBe(
      "APPROVED",
    );
  } finally {
    // Cleanup: cancel then delete (APPROVED cannot be deleted directly)
    if (createdVacationId) {
      const cancelUrl = tttConfig.buildUrl(
        `/api/vacation/v1/vacations/cancel/${createdVacationId}`,
      );
      await request.put(cancelUrl, { headers });

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
