import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc052Data } from "../data/VacationTc052Data";

test("TC-VAC-052: Invalid transition NEW → PAID (skipping approval) @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc052Data.create(
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

    // Step 2: Try to pay directly (NEW → PAID — invalid transition)
    const payUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/pay/${createdVacationId}`,
    );
    const payBody = {
      regularDaysPayed: vacationData.regularDays ?? 5,
      administrativeDaysPayed: vacationData.administrativeDays ?? 0,
    };

    const payResponse = await request.put(payUrl, {
      headers,
      data: payBody,
    });

    // Pay may return non-JSON on some errors; handle gracefully
    let payJson: Record<string, unknown> = {};
    try {
      payJson = await payResponse.json();
    } catch {
      payJson = { rawStatus: payResponse.status() };
    }

    const payArtifact = testInfo.outputPath("step2-pay-attempt.json");
    await writeFile(
      payArtifact,
      JSON.stringify(
        { request: payBody, response: payJson, status: payResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step2-pay-attempt", {
      path: payArtifact,
      contentType: "application/json",
    });

    // Step 3: Verify rejection
    expect(
      payResponse.status(),
      "Pay on NEW vacation should return 400",
    ).toBe(400);

    // Verify status is still NEW (unchanged)
    const getUrl = `${baseUrl}/${createdVacationId}`;
    const getResponse = await request.get(getUrl, { headers });
    const getJson = await getResponse.json();

    const getArtifact = testInfo.outputPath("step3-verify-unchanged.json");
    await writeFile(
      getArtifact,
      JSON.stringify(
        { response: getJson, status: getResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step3-verify-unchanged", {
      path: getArtifact,
      contentType: "application/json",
    });

    expect(getResponse.ok(), "GET should succeed").toBeTruthy();
    const currentVacation = getJson.vacation ?? getJson;
    expect(
      currentVacation.status,
      "Status should still be NEW after failed pay attempt",
    ).toBe("NEW");
  } finally {
    // Cleanup: delete NEW vacation
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
