import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc043Data } from "../data/VacationTc043Data";

test("TC-VAC-043: REJECTED → APPROVED (re-approval without edit) @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc043Data.create(
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

    // Step 2: Reject the vacation (NEW → REJECTED)
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

    const rejectedVacation = rejectJson.vacation ?? rejectJson;
    expect(rejectedVacation.status, "Status should be REJECTED").toBe("REJECTED");

    // Step 3: Re-approve the vacation without editing (REJECTED → APPROVED)
    const approveUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/approve/${createdVacationId}`,
    );
    const approveResponse = await request.put(approveUrl, { headers });
    const approveJson = await approveResponse.json();

    const approveArtifact = testInfo.outputPath("step3-reapprove.json");
    await writeFile(
      approveArtifact,
      JSON.stringify(
        { response: approveJson, status: approveResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step3-reapprove", {
      path: approveArtifact,
      contentType: "application/json",
    });

    expect(
      approveResponse.ok(),
      `Re-approve failed: ${approveResponse.status()} ${JSON.stringify(approveJson)}`,
    ).toBeTruthy();

    // Step 4: Verify status is APPROVED after re-approval
    const reapprovedVacation = approveJson.vacation ?? approveJson;
    expect(
      reapprovedVacation.status,
      "Status should be APPROVED after re-approval from REJECTED",
    ).toBe("APPROVED");
  } finally {
    // Cleanup: cancel (APPROVED→CANCELED) then delete
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
