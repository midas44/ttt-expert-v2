import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc032Data } from "../data/VacationTc032Data";

test("vacation_tc032 - update with overlapping dates (crossing blocked) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc032Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let vacationAId: number | null = null;
  let vacationBId: number | null = null;

  try {
    // Step 1: Create vacation A
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
    expect(vacA).toBeTruthy();
    vacationAId = vacA.id;
    expect(vacationAId).toBeTruthy();

    // Step 2: Create vacation B (non-overlapping dates)
    const createBResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBodyB(),
    });

    const createBBody = await createBResponse.json();
    const createBArtifact = testInfo.outputPath("step2-create-B.json");
    await writeFile(createBArtifact, JSON.stringify(createBBody, null, 2), "utf-8");
    await testInfo.attach("step2-create-B", { path: createBArtifact, contentType: "application/json" });

    expect(createBResponse.status(), "Create B should return 200").toBe(200);
    const vacB = createBBody.vacation;
    expect(vacB).toBeTruthy();
    vacationBId = vacB.id;
    expect(vacationBId).toBeTruthy();

    // Step 3: Update B's dates to overlap with A
    const updateResponse = await request.put(
      `${baseUrl}/${vacationBId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildOverlapUpdateBody(vacationBId!),
      },
    );

    const updateStatus = updateResponse.status();
    let updateBody: Record<string, unknown> = {};
    try {
      updateBody = await updateResponse.json();
    } catch {
      // Some error responses may be empty
    }

    const updateArtifact = testInfo.outputPath("step3-update-overlap.json");
    await writeFile(updateArtifact, JSON.stringify({ status: updateStatus, body: updateBody }, null, 2), "utf-8");
    await testInfo.attach("step3-update-overlap", { path: updateArtifact, contentType: "application/json" });

    // Crossing check: findCrossingVacations() returns A → ValidationException
    expect(updateStatus, `Expected 400 for overlapping dates, got ${updateStatus}`).toBe(400);

    // Verify error code indicates crossing
    const errorCode = updateBody.errorCode as string | undefined;
    const errors = updateBody.errors as Array<Record<string, unknown>> | undefined;
    const message = updateBody.message as string | undefined;
    const hasCrossingError =
      errorCode?.includes("crossing") ||
      message?.includes("crossing") ||
      errors?.some((e) =>
        String(e.code ?? "").includes("crossing") ||
        String(e.message ?? "").includes("crossing"),
      );

    const errorArtifact = testInfo.outputPath("error-details.json");
    await writeFile(errorArtifact, JSON.stringify({ errorCode, errors, hasCrossingError }, null, 2), "utf-8");
    await testInfo.attach("error-details", { path: errorArtifact, contentType: "application/json" });

    expect(hasCrossingError, "Error should indicate dates crossing").toBe(true);

    // Step 4: GET B to confirm dates unchanged
    const getResponse = await request.get(`${baseUrl}/${vacationBId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step4-verify-B-unchanged.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-verify-B-unchanged", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.startDate, "B's start date should be unchanged").toBe(data.vacationBStart);
    expect(getVac.endDate, "B's end date should be unchanged").toBe(data.vacationBEnd);
  } finally {
    // Cleanup: delete both vacations
    for (const id of [vacationBId, vacationAId]) {
      if (id) {
        const delResp = await request.delete(`${baseUrl}/${id}`, {
          headers: authHeaders,
        });
        const delArtifact = testInfo.outputPath(`cleanup-delete-${id}.json`);
        try {
          await writeFile(delArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
        } catch {
          await writeFile(delArtifact, `{"status":${delResp.status()}}`, "utf-8");
        }
        await testInfo.attach(`cleanup-delete-${id}`, { path: delArtifact, contentType: "application/json" });
      }
    }
  }
});
