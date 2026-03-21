import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc047Data } from "../data/VacationTc047Data";

test("TC-VAC-047: APPROVED → REJECTED (approver rejects after approval) @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc047Data.create(
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

    // Step 3: Reject the vacation (APPROVED → REJECTED)
    // Approver can reject even after approval — days returned to pool
    const rejectUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/reject/${createdVacationId}`,
    );
    const rejectResponse = await request.put(rejectUrl, { headers });
    const rejectJson = await rejectResponse.json();

    const rejectArtifact = testInfo.outputPath("step3-reject-after-approval.json");
    await writeFile(
      rejectArtifact,
      JSON.stringify(
        { response: rejectJson, status: rejectResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step3-reject-after-approval", {
      path: rejectArtifact,
      contentType: "application/json",
    });

    expect(
      rejectResponse.ok(),
      `Reject failed: ${rejectResponse.status()} ${JSON.stringify(rejectJson)}`,
    ).toBeTruthy();

    // Step 4: Verify status is REJECTED
    const rejectedVacation = rejectJson.vacation ?? rejectJson;
    expect(
      rejectedVacation.status,
      "Status should be REJECTED after rejecting an APPROVED vacation",
    ).toBe("REJECTED");
  } finally {
    // Cleanup: REJECTED allows direct delete
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
