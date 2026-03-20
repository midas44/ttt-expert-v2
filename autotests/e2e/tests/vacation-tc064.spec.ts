import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc064Data } from "../data/VacationTc064Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc064 - Delete vacation leaves orphan approval records (known bug) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc064Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  expect(
    data.optionalApproverLogins.length,
    "Need at least 1 optional approver",
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

    // Step 2: Verify approval records exist before delete
    const db = new DbClient(tttConfig);
    let approvalsBefore: Record<string, unknown>[];
    try {
      approvalsBefore = await db.query(
        `SELECT va.id, va.status, e.login
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee e ON va.employee = e.id
         WHERE va.vacation = $1
         ORDER BY va.id`,
        [createdVacationId],
      );

      const beforeArtifact = testInfo.outputPath("step2-approvals-before-delete.json");
      await writeFile(beforeArtifact, JSON.stringify(approvalsBefore, null, 2), "utf-8");
      await testInfo.attach("step2-approvals-before-delete", { path: beforeArtifact, contentType: "application/json" });

      expect(
        approvalsBefore.length,
        "Should have approval records before delete",
      ).toBeGreaterThanOrEqual(data.optionalApproverLogins.length);
    } finally {
      await db.close();
    }

    // Step 3: Delete the vacation (soft delete → status=DELETED)
    const deleteResponse = await request.delete(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });

    const deleteBody = await deleteResponse.json();
    const deleteArtifact = testInfo.outputPath("step3-delete.json");
    await writeFile(deleteArtifact, JSON.stringify(deleteBody, null, 2), "utf-8");
    await testInfo.attach("step3-delete", { path: deleteArtifact, contentType: "application/json" });

    expect(deleteResponse.status(), "Delete should return 200").toBe(200);

    // Step 4: Verify vacation is DELETED
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step4-verify-deleted.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-verify-deleted", { path: getArtifact, contentType: "application/json" });

    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("DELETED");

    // Step 5: Check approval records AFTER delete — BUG: they persist (orphaned)
    const db2 = new DbClient(tttConfig);
    try {
      const approvalsAfter = await db2.query(
        `SELECT va.id, va.status, e.login
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee e ON va.employee = e.id
         WHERE va.vacation = $1
         ORDER BY va.id`,
        [createdVacationId],
      );

      const afterArtifact = testInfo.outputPath("step5-approvals-after-delete.json");
      await writeFile(afterArtifact, JSON.stringify({
        approvalsBefore: approvalsBefore.length,
        approvalsAfter: approvalsAfter.length,
        orphanedRecords: approvalsAfter,
        bug: "Soft delete does not cascade to vacation_approval — records persist as orphans",
      }, null, 2), "utf-8");
      await testInfo.attach("step5-approvals-after-delete", { path: afterArtifact, contentType: "application/json" });

      // BUG: approval records survive soft delete
      expect(
        approvalsAfter.length,
        "BUG: Approval records persist after vacation deletion (orphan)",
      ).toBe(approvalsBefore.length);
    } finally {
      await db2.close();
    }

    // Cleanup already done (vacation is DELETED)
    createdVacationId = null;
  } finally {
    // Fallback cleanup
    if (createdVacationId) {
      await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
    }
  }
});
