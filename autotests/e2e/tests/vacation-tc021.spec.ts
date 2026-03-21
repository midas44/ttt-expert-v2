import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc021Data } from "../data/VacationTc021Data";

test("TC-VAC-021: Create vacation — verify available days decrease @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc021Data.create(
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
    // Step 1: GET available days before creation
    const availableUrl = tttConfig.buildUrl(data.availableDaysEndpoint);
    const beforeParams = new URLSearchParams({
      employeeLogin: data.login,
      paymentDate: data.paymentMonth,
      newDays: "0",
    });
    const beforeResponse = await request.get(
      `${availableUrl}?${beforeParams.toString()}`,
      { headers },
    );
    const beforeJson = await beforeResponse.json();

    const beforeArtifact = testInfo.outputPath("step1-available-before.json");
    await writeFile(
      beforeArtifact,
      JSON.stringify(
        { params: Object.fromEntries(beforeParams), response: beforeJson, status: beforeResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step1-available-before", {
      path: beforeArtifact,
      contentType: "application/json",
    });

    expect(
      beforeResponse.ok(),
      `Available days GET failed: ${beforeResponse.status()} ${JSON.stringify(beforeJson)}`,
    ).toBeTruthy();

    // Extract available paid days — response may be a number or an object
    const daysBefore =
      typeof beforeJson === "number"
        ? beforeJson
        : beforeJson.availablePaidDays ?? beforeJson.available ?? beforeJson;
    expect(typeof daysBefore, "Available days should be a number").toBe("number");

    // Step 2: Create 5-day REGULAR vacation
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

    const createArtifact = testInfo.outputPath("step2-create.json");
    await writeFile(
      createArtifact,
      JSON.stringify(
        { request: body, response: createJson, status: createResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step2-create", {
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

    // Step 3: GET available days after creation
    const afterResponse = await request.get(
      `${availableUrl}?${beforeParams.toString()}`,
      { headers },
    );
    const afterJson = await afterResponse.json();

    const afterArtifact = testInfo.outputPath("step3-available-after.json");
    await writeFile(
      afterArtifact,
      JSON.stringify(
        { response: afterJson, status: afterResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step3-available-after", {
      path: afterArtifact,
      contentType: "application/json",
    });

    expect(
      afterResponse.ok(),
      `Available days GET after failed: ${afterResponse.status()}`,
    ).toBeTruthy();

    const daysAfter =
      typeof afterJson === "number"
        ? afterJson
        : afterJson.availablePaidDays ?? afterJson.available ?? afterJson;
    expect(typeof daysAfter, "Available days after should be a number").toBe("number");

    // Step 4: Verify decrease
    // The number of working days in Mon-Fri (5 calendar days) = 5 working days
    const decrease = daysBefore - daysAfter;

    const compareArtifact = testInfo.outputPath("step4-compare.json");
    await writeFile(
      compareArtifact,
      JSON.stringify(
        {
          daysBefore,
          daysAfter,
          decrease,
          expectedDecrease: "≥ 1 (working days in the vacation period)",
        },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step4-compare", {
      path: compareArtifact,
      contentType: "application/json",
    });

    expect(decrease, "Available days should decrease after creating a vacation").toBeGreaterThan(0);
    // For a Mon-Fri vacation, expect exactly 5 working days decrease
    // (unless there's a holiday in the period, which would reduce working days)
    expect(decrease).toBeGreaterThanOrEqual(3);
    expect(decrease).toBeLessThanOrEqual(5);
  } finally {
    // Cleanup: delete created vacation
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
