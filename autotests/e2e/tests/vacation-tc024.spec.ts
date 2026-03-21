import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc024Data } from "../data/VacationTc024Data";

test("TC-VAC-024: Create vacation with comment @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc024Data.create(
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
    // Step 1: Create vacation with comment
    const body = {
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: data.paymentType,
      paymentMonth: data.paymentMonth,
      comment: data.comment,
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

    // Step 2: Verify comment is present in create response
    expect(
      vacationData.comment,
      "Comment should be present in create response",
    ).toBe(data.comment);

    // Step 3: GET vacation by ID and verify comment persisted
    const getUrl = `${baseUrl}/${createdVacationId}`;
    const getResponse = await request.get(getUrl, { headers });
    const getJson = await getResponse.json();

    const getArtifact = testInfo.outputPath("step3-get.json");
    await writeFile(
      getArtifact,
      JSON.stringify(
        { response: getJson, status: getResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step3-get", {
      path: getArtifact,
      contentType: "application/json",
    });

    expect(
      getResponse.ok(),
      `GET failed: ${getResponse.status()} ${JSON.stringify(getJson)}`,
    ).toBeTruthy();

    const fetchedVacation = getJson.vacation ?? getJson;
    expect(
      fetchedVacation.comment,
      "Comment should persist in GET response",
    ).toBe(data.comment);
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
