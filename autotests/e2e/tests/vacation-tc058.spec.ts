import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc058Data } from "../data/VacationTc058Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc058 - optional approver approves (ASKED -> APPROVED) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc058Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation with one optional approver
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

    // Step 2: Query DB for the vacation_approval record (should be ASKED)
    const db = new DbClient(tttConfig);
    let approvalId: number;
    try {
      const approvalRows = await db.query(
        `SELECT va.id, va.status, e.login
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee e ON va.employee = e.id
         WHERE va.vacation = $1
         ORDER BY va.id`,
        [createdVacationId],
      );

      const dbBeforeArtifact = testInfo.outputPath("step2-db-before.json");
      await writeFile(dbBeforeArtifact, JSON.stringify(approvalRows, null, 2), "utf-8");
      await testInfo.attach("step2-db-before", { path: dbBeforeArtifact, contentType: "application/json" });

      expect(approvalRows.length, "Should have at least 1 approval record").toBeGreaterThanOrEqual(1);
      const targetApproval = approvalRows.find(
        (r: Record<string, unknown>) => r.login === data.optionalApproverLogin,
      );
      expect(targetApproval, `Approval record for ${data.optionalApproverLogin} should exist`).toBeTruthy();
      expect(targetApproval.status).toBe("ASKED");
      approvalId = targetApproval.id as number;
    } finally {
      await db.close();
    }

    // Step 3: PATCH optional approval status to APPROVED
    // Endpoint: PATCH /api/vacation/v1/employee-dayOff-approvers/{approvalId}
    // Uses the vacation_approval record ID (not the vacation ID)
    const optionalApprovalUrl = tttConfig.buildUrl(
      `${data.optionalApprovalEndpoint}/${approvalId}`,
    );

    const patchResponse = await request.patch(optionalApprovalUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: { status: "APPROVED" },
    });

    let patchBody: Record<string, unknown> = {};
    try { patchBody = await patchResponse.json(); } catch { /* empty */ }
    const patchArtifact = testInfo.outputPath("step3-patch-approval.json");
    await writeFile(patchArtifact, JSON.stringify({ status: patchResponse.status(), body: patchBody }, null, 2), "utf-8");
    await testInfo.attach("step3-patch-approval", { path: patchArtifact, contentType: "application/json" });

    expect(patchResponse.status(), `PATCH optional approval should return 200, got ${patchResponse.status()}`).toBe(200);

    // Step 4: Verify DB — approval status changed to APPROVED
    const db2 = new DbClient(tttConfig);
    try {
      const afterRows = await db2.query(
        `SELECT va.id, va.status, e.login
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee e ON va.employee = e.id
         WHERE va.vacation = $1
         ORDER BY va.id`,
        [createdVacationId],
      );

      const dbAfterArtifact = testInfo.outputPath("step4-db-after.json");
      await writeFile(dbAfterArtifact, JSON.stringify(afterRows, null, 2), "utf-8");
      await testInfo.attach("step4-db-after", { path: dbAfterArtifact, contentType: "application/json" });

      const updatedApproval = afterRows.find(
        (r: Record<string, unknown>) => r.login === data.optionalApproverLogin,
      );
      expect(updatedApproval, "Approval record should still exist").toBeTruthy();
      expect(
        updatedApproval.status,
        "Optional approval should now be APPROVED",
      ).toBe("APPROVED");
    } finally {
      await db2.close();
    }

    // Step 5: Verify main vacation status unchanged (optional approval is informational)
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step5-verify-main-status.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step5-verify-main-status", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(
      getVac.status,
      "Main vacation status should be unchanged (optional approval is informational)",
    ).toBe("NEW");
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
