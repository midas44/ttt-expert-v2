import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc042Data } from "../data/VacationTc042Data";

test("TC-VAC-042: NEW → DELETED (employee deletes) @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc042Data.create(
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
  const createdVacationId = vacationData.id;
  expect(createdVacationId, "Created vacation must have an id").toBeTruthy();
  expect(vacationData.status, "Initial status should be NEW").toBe("NEW");

  // Step 2: Delete the vacation (soft delete)
  const deleteResponse = await request.delete(
    `${baseUrl}/${createdVacationId}`,
    { headers },
  );

  const deleteArtifact = testInfo.outputPath("step2-delete.json");
  await writeFile(
    deleteArtifact,
    JSON.stringify(
      { id: createdVacationId, status: deleteResponse.status() },
      null,
      2,
    ),
    "utf-8",
  );
  await testInfo.attach("step2-delete", {
    path: deleteArtifact,
    contentType: "application/json",
  });

  expect(
    deleteResponse.ok(),
    `Delete failed: ${deleteResponse.status()}`,
  ).toBeTruthy();

  // Step 3: Verify vacation is no longer accessible via GET
  // Soft-deleted vacations are excluded from default queries
  const getResponse = await request.get(
    `${baseUrl}/${createdVacationId}`,
    { headers },
  );

  const verifyArtifact = testInfo.outputPath("step3-verify-deleted.json");
  const verifyBody = getResponse.ok() ? await getResponse.json() : null;
  await writeFile(
    verifyArtifact,
    JSON.stringify(
      {
        getStatus: getResponse.status(),
        body: verifyBody,
        isDeleted: !getResponse.ok() || verifyBody?.status === "DELETED",
      },
      null,
      2,
    ),
    "utf-8",
  );
  await testInfo.attach("step3-verify-deleted", {
    path: verifyArtifact,
    contentType: "application/json",
  });

  // Either 404 (not found) or the vacation has DELETED status
  if (getResponse.ok() && verifyBody) {
    const vac = verifyBody.vacation ?? verifyBody;
    expect(vac.status, "Soft-deleted vacation should have DELETED status").toBe(
      "DELETED",
    );
  } else {
    expect(
      [404, 403].includes(getResponse.status()),
      `Expected 404 or 403 for deleted vacation, got ${getResponse.status()}`,
    ).toBeTruthy();
  }
  // No cleanup needed — the delete IS the test action
});
