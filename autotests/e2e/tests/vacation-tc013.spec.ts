import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc013Data } from "../data/VacationTc013Data";

test("vacation_tc013 - create overlapping vacation (start inside existing) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc013Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let vacationAId: number | null = null;

  try {
    // Step 1: Create vacation A (the "existing" vacation)
    const createAResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBodyA(),
    });

    const createABody = await createAResponse.json();
    const createAArtifact = testInfo.outputPath("step1-create-A.json");
    await writeFile(createAArtifact, JSON.stringify(createABody, null, 2), "utf-8");
    await testInfo.attach("step1-create-A", { path: createAArtifact, contentType: "application/json" });

    expect(createAResponse.status(), "Create A should return 200").toBe(200);
    const vacA = createABody.vacation;
    expect(vacA, "Response should contain vacation object").toBeTruthy();
    expect(vacA.status).toBe("NEW");
    vacationAId = vacA.id;
    expect(vacationAId).toBeTruthy();

    // Step 2: Create vacation B with start date inside A's range
    const createBResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBodyB(),
    });

    const createBBody = await createBResponse.json();
    const createBArtifact = testInfo.outputPath("step2-create-B-overlap.json");
    await writeFile(createBArtifact, JSON.stringify(createBBody, null, 2), "utf-8");
    await testInfo.attach("step2-create-B-overlap", { path: createBArtifact, contentType: "application/json" });

    // Step 3: Verify rejection — overlapping dates
    expect(createBResponse.status(), `Expected 400, got ${createBResponse.status()}`).toBe(400);

    // ValidationException serializes crossing code into `message` field (not `errorCode`):
    //   errorCode: "exception.validation.fail"
    //   message: "exception.validation.vacation.dates.crossing"
    //   errors[].message: "exception.validation.vacation.dates.crossing"
    const topMessage = createBBody.message ?? "";
    const errors = createBBody.errors ?? [];
    const hasCrossingError =
      topMessage.includes("crossing") ||
      errors.some((e: { message?: string }) => e.message?.includes("crossing"));

    expect(
      hasCrossingError,
      `Expected crossing error in message or errors[].message, got: ${JSON.stringify(createBBody)}`,
    ).toBe(true);

    // Verify field-level error references startDate
    if (errors.length > 0) {
      const crossingErr = errors.find((e: { message?: string }) =>
        e.message?.includes("crossing"),
      );
      if (crossingErr) {
        expect(crossingErr.field).toBe("startDate");
      }
    }
  } finally {
    // Cleanup: delete vacation A
    if (vacationAId) {
      const delResp = await request.delete(`${baseUrl}/${vacationAId}`, {
        headers: authHeaders,
      });
      const delArtifact = testInfo.outputPath("cleanup-delete-A.json");
      try {
        await writeFile(delArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(delArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete-A", { path: delArtifact, contentType: "application/json" });
    }
  }
});
