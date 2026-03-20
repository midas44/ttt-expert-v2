import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc033Data } from "../data/VacationTc033Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc033 - Optional approvals preserved/reset on date change @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc033Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  expect(
    data.optionalApproverLogins.length,
    "Need at least 1 optional approver login",
  ).toBeGreaterThanOrEqual(1);

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation with optional approvers
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const createVac = createBody.vacation;
    expect(createVac).toBeTruthy();
    expect(createVac.status).toBe("NEW");
    createdVacationId = createVac.id;

    // Step 2: Verify initial approval records in DB (ASKED)
    const db = new DbClient(tttConfig);
    let initialApprovals: Record<string, unknown>[] = [];
    try {
      initialApprovals = await db.query(
        `SELECT va.id, va.status, e.login
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee e ON va.employee = e.id
         WHERE va.vacation = $1
         ORDER BY va.id`,
        [createdVacationId],
      );

      const dbArtifact = testInfo.outputPath("step2-initial-approvals.json");
      await writeFile(dbArtifact, JSON.stringify(initialApprovals, null, 2), "utf-8");
      await testInfo.attach("step2-initial-approvals", { path: dbArtifact, contentType: "application/json" });

      expect(
        initialApprovals.length,
        `Expected at least ${data.optionalApproverLogins.length} approval records`,
      ).toBeGreaterThanOrEqual(data.optionalApproverLogins.length);

      // Verify each optional approver has ASKED status
      for (const requestedLogin of data.optionalApproverLogins) {
        const match = initialApprovals.find(
          (r: Record<string, unknown>) => r.login === requestedLogin,
        );
        expect(match, `Initial approval for ${requestedLogin} should exist`).toBeTruthy();
        expect(match!.status, `Initial approval for ${requestedLogin} should be ASKED`).toBe("ASKED");
      }
    } finally {
      await db.close();
    }

    // Step 3: Update vacation dates (shift to different week)
    const updateResponse = await request.put(
      `${baseUrl}/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildUpdateBody(createdVacationId),
      },
    );

    const updateBody = await updateResponse.json();
    const updateArtifact = testInfo.outputPath("step3-update.json");
    await writeFile(updateArtifact, JSON.stringify(updateBody, null, 2), "utf-8");
    await testInfo.attach("step3-update", { path: updateArtifact, contentType: "application/json" });

    expect(updateResponse.status(), "Update should return 200").toBe(200);
    const updateVac = updateBody.vacation ?? updateBody;
    // After update, status should be NEW (update on NEW stays NEW)
    expect(updateVac.status).toBe("NEW");

    // Verify dates changed
    expect(updateVac.startDate).toBe(data.updatedStartDate);
    expect(updateVac.endDate).toBe(data.updatedEndDate);

    // Step 4: Verify approval records after update — should be ASKED (reset)
    const db2 = new DbClient(tttConfig);
    try {
      const updatedApprovals = await db2.query(
        `SELECT va.id, va.status, e.login
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee e ON va.employee = e.id
         WHERE va.vacation = $1
         ORDER BY va.id`,
        [createdVacationId],
      );

      const dbArtifact2 = testInfo.outputPath("step4-post-update-approvals.json");
      await writeFile(dbArtifact2, JSON.stringify(updatedApprovals, null, 2), "utf-8");
      await testInfo.attach("step4-post-update-approvals", { path: dbArtifact2, contentType: "application/json" });

      // Approvals should still exist after update
      expect(
        updatedApprovals.length,
        `Expected at least ${data.optionalApproverLogins.length} approval records after update`,
      ).toBeGreaterThanOrEqual(data.optionalApproverLogins.length);

      // Each optional approver should be in ASKED status (reset from any previous state)
      for (const requestedLogin of data.optionalApproverLogins) {
        const match = updatedApprovals.find(
          (r: Record<string, unknown>) => r.login === requestedLogin,
        );
        expect(match, `Post-update approval for ${requestedLogin} should exist`).toBeTruthy();
        expect(
          match!.status,
          `Post-update approval for ${requestedLogin} should be ASKED (reset)`,
        ).toBe("ASKED");
      }
    } finally {
      await db2.close();
    }
  } finally {
    // Cleanup: delete the vacation
    if (createdVacationId) {
      const delResp = await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
      const delArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        await writeFile(delArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(delArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: delArtifact, contentType: "application/json" });
    }
  }
});
