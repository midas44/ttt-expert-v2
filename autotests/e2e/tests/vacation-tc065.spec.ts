import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc065Data } from "../data/VacationTc065Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc065 - notify-also with required flag behavior @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc065Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  expect(
    data.notifyAlsoLogins.length,
    "Need at least 1 notify-also login",
  ).toBeGreaterThanOrEqual(1);

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation with notifyAlso list
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const step1Artifact = testInfo.outputPath("step1-create.json");
    await writeFile(step1Artifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create", { path: step1Artifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const createVac = createBody.vacation;
    expect(createVac).toBeTruthy();
    expect(createVac.status).toBe("NEW");
    createdVacationId = createVac.id;

    // Step 2: Verify vacation_notify_also records in DB
    const db = new DbClient(tttConfig);
    try {
      const notifyAlsoRows = await db.query(
        `SELECT vna.id, vna.required, e.login
         FROM ttt_vacation.vacation_notify_also vna
         JOIN ttt_vacation.employee e ON vna.approver = e.id
         WHERE vna.vacation = $1
         ORDER BY vna.id`,
        [createdVacationId],
      );

      const step2Artifact = testInfo.outputPath("step2-db-notify-also.json");
      await writeFile(step2Artifact, JSON.stringify(notifyAlsoRows, null, 2), "utf-8");
      await testInfo.attach("step2-db-notify-also", { path: step2Artifact, contentType: "application/json" });

      // All user-submitted notifyAlso logins should have records
      expect(
        notifyAlsoRows.length,
        `Expected at least ${data.notifyAlsoLogins.length} notify-also records`,
      ).toBeGreaterThanOrEqual(data.notifyAlsoLogins.length);

      // Verify each requested login has a record
      for (const requestedLogin of data.notifyAlsoLogins) {
        const match = notifyAlsoRows.find(
          (r: Record<string, unknown>) => r.login === requestedLogin,
        );
        expect(match, `Notify-also record for ${requestedLogin} should exist`).toBeTruthy();
      }

      // Step 3: Verify required flag — all should be false
      // BUG: EmployeeWatcherServiceImpl.listRequired() is a no-op stub (returns empty list)
      // Therefore, required=true is NEVER set. All notifyAlso entries get required=false.
      const step3Artifact = testInfo.outputPath("step3-required-flag.json");
      const requiredAnalysis = notifyAlsoRows.map((r: Record<string, unknown>) => ({
        login: r.login,
        required: r.required,
        isRequiredTrue: r.required === true,
      }));
      const anyRequired = notifyAlsoRows.some(
        (r: Record<string, unknown>) => r.required === true,
      );

      await writeFile(step3Artifact, JSON.stringify({
        notifyAlsoRecords: requiredAnalysis,
        anyRequiredTrue: anyRequired,
        explanation: "EmployeeWatcherServiceImpl.listRequired() is a no-op stub. "
          + "It always returns an empty list, so required=true is never set. "
          + "All user-submitted notifyAlso entries get required=false. "
          + "The 'mandatory approver via notifyAlso' feature is dead code.",
      }, null, 2), "utf-8");
      await testInfo.attach("step3-required-flag", { path: step3Artifact, contentType: "application/json" });

      // Document the dead code behavior: no records should have required=true
      // because listRequired() always returns empty
      expect(
        anyRequired,
        "Expected NO required=true records (listRequired is a no-op stub)",
      ).toBe(false);

      // Step 4: Verify no extra records from listRequired() (since it's a no-op)
      // Total records should equal the number of user-submitted logins (no required watchers added)
      const step4Artifact = testInfo.outputPath("step4-record-count.json");
      await writeFile(step4Artifact, JSON.stringify({
        userSubmittedCount: data.notifyAlsoLogins.length,
        totalDbRecords: notifyAlsoRows.length,
        extraFromListRequired: notifyAlsoRows.length - data.notifyAlsoLogins.length,
        explanation: "Since listRequired() returns empty, record count should match "
          + "user-submitted logins exactly (no extra required watchers added).",
      }, null, 2), "utf-8");
      await testInfo.attach("step4-record-count", { path: step4Artifact, contentType: "application/json" });

      expect(
        notifyAlsoRows.length,
        "Record count should match user-submitted logins (no extra from listRequired)",
      ).toBe(data.notifyAlsoLogins.length);
    } finally {
      await db.close();
    }
  } finally {
    // Cleanup: delete the vacation
    if (createdVacationId) {
      const delResp = await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
      const cleanupArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        await writeFile(cleanupArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(cleanupArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: cleanupArtifact, contentType: "application/json" });
    }
  }
});
