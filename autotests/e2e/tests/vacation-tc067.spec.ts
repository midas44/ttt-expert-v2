import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc067Data } from "../data/VacationTc067Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc067 - Change approver preserves optional approver list @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc067Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation with 2 optional approvers
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

    // Step 2: Verify initial approval records in DB (primary + optionals)
    const db = new DbClient(tttConfig);
    let originalApproverLogin: string;
    try {
      const initialApprovals = await db.query(
        `SELECT va.id, va.status, e.login
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee e ON va.employee = e.id
         WHERE va.vacation = $1
         ORDER BY va.id`,
        [createdVacationId],
      );

      const initialArtifact = testInfo.outputPath("step2-initial-approvals.json");
      await writeFile(initialArtifact, JSON.stringify(initialApprovals, null, 2), "utf-8");
      await testInfo.attach("step2-initial-approvals", { path: initialArtifact, contentType: "application/json" });

      // Should have primary approver + 2 optional approvers
      expect(
        initialApprovals.length,
        `Expected at least 3 approval records (primary + 2 optional), got ${initialApprovals.length}`,
      ).toBeGreaterThanOrEqual(3);

      // Get the original primary approver login
      const primaryRow = await db.query(
        `SELECT e.login FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.approver = e.id
         WHERE v.id = $1`,
        [createdVacationId],
      );
      originalApproverLogin = primaryRow[0].login as string;

      const primaryArtifact = testInfo.outputPath("step2-original-approver.json");
      await writeFile(primaryArtifact, JSON.stringify({
        originalApproverLogin,
        optionalApprovers: data.optionalApproverLogins,
      }, null, 2), "utf-8");
      await testInfo.attach("step2-original-approver", { path: primaryArtifact, contentType: "application/json" });
    } finally {
      await db.close();
    }

    // Step 3: Change approver to new login
    const passUrl = `${baseUrl}/pass/${createdVacationId}`;
    const passResponse = await request.put(passUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildChangeApproverBody(),
    });

    const passBody = await passResponse.json();
    const passArtifact = testInfo.outputPath("step3-change-approver.json");
    await writeFile(passArtifact, JSON.stringify(passBody, null, 2), "utf-8");
    await testInfo.attach("step3-change-approver", { path: passArtifact, contentType: "application/json" });

    expect(passResponse.status(), "Change approver should return 200").toBe(200);

    // Step 4: Verify new approver is primary + old optionals preserved in DB
    const db2 = new DbClient(tttConfig);
    try {
      // Check new primary approver
      const newPrimaryRow = await db2.query(
        `SELECT e.login FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.approver = e.id
         WHERE v.id = $1`,
        [createdVacationId],
      );

      const newPrimaryLogin = newPrimaryRow[0].login as string;

      const newPrimaryArtifact = testInfo.outputPath("step4-new-primary.json");
      await writeFile(newPrimaryArtifact, JSON.stringify({
        newPrimaryLogin,
        expectedNewPrimary: data.newApproverLogin,
      }, null, 2), "utf-8");
      await testInfo.attach("step4-new-primary", { path: newPrimaryArtifact, contentType: "application/json" });

      expect(newPrimaryLogin, "New approver should be the one we passed").toBe(data.newApproverLogin);

      // Check all approval records after change
      const afterApprovals = await db2.query(
        `SELECT va.id, va.status, e.login
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee e ON va.employee = e.id
         WHERE va.vacation = $1
         ORDER BY va.id`,
        [createdVacationId],
      );

      const afterArtifact = testInfo.outputPath("step4-after-approvals.json");
      await writeFile(afterArtifact, JSON.stringify({
        approvalRecords: afterApprovals,
        totalCount: afterApprovals.length,
        originalPrimary: originalApproverLogin,
        newPrimary: data.newApproverLogin,
        originalOptionals: data.optionalApproverLogins,
      }, null, 2), "utf-8");
      await testInfo.attach("step4-after-approvals", { path: afterArtifact, contentType: "application/json" });

      // After reassignment: old primary should be added as optional (ASKED)
      // Existing optional approvers should be preserved
      // Total: old_primary + original optionals (+ possibly new primary)
      const approvalLogins = afterApprovals.map(
        (r: Record<string, unknown>) => r.login as string,
      );

      // Original optional approvers should still be present
      for (const optLogin of data.optionalApproverLogins) {
        expect(
          approvalLogins.includes(optLogin),
          `Optional approver ${optLogin} should still be in approval records`,
        ).toBe(true);

        const optRow = afterApprovals.find(
          (r: Record<string, unknown>) => r.login === optLogin,
        );
        expect(
          optRow.status,
          `Optional approver ${optLogin} should have ASKED status`,
        ).toBe("ASKED");
      }

      // Old primary should now appear as optional with ASKED status
      const oldPrimaryInApprovals = afterApprovals.find(
        (r: Record<string, unknown>) => r.login === originalApproverLogin,
      );
      expect(
        oldPrimaryInApprovals,
        `Old primary ${originalApproverLogin} should be added as optional approver`,
      ).toBeTruthy();
      expect(
        oldPrimaryInApprovals.status,
        `Old primary ${originalApproverLogin} should have ASKED status`,
      ).toBe("ASKED");
    } finally {
      await db2.close();
    }
  } finally {
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
