import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc063Data } from "../data/VacationTc063Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc063 - Edit dates resets all optional approvals to ASKED @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc063Data.create(globalConfig.testDataMode, tttConfig);

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

    // Step 2: Approve — this transitions to APPROVED
    const approveResponse = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );

    const approveBody = await approveResponse.json();
    const approveArtifact = testInfo.outputPath("step2-approve.json");
    await writeFile(approveArtifact, JSON.stringify(approveBody, null, 2), "utf-8");
    await testInfo.attach("step2-approve", { path: approveArtifact, contentType: "application/json" });

    expect(approveResponse.status()).toBe(200);
    const approveVac = approveBody.vacation ?? approveBody;
    expect(approveVac.status).toBe("APPROVED");

    // Step 3: Check optional approval statuses in DB BEFORE edit (should be ASKED — pvaynmaster approves for himself, optional approvers stay ASKED)
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

      const beforeArtifact = testInfo.outputPath("step3-approvals-before-edit.json");
      await writeFile(beforeArtifact, JSON.stringify(approvalsBefore, null, 2), "utf-8");
      await testInfo.attach("step3-approvals-before-edit", { path: beforeArtifact, contentType: "application/json" });

      expect(approvalsBefore.length, "Should have approval records").toBeGreaterThanOrEqual(1);
    } finally {
      await db.close();
    }

    // Step 4: Update dates (shifts vacation 1+ weeks forward)
    const updateResponse = await request.put(
      `${baseUrl}/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildUpdateBody(createdVacationId),
      },
    );

    const updateBody = await updateResponse.json();
    const updateArtifact = testInfo.outputPath("step4-update-dates.json");
    await writeFile(updateArtifact, JSON.stringify(updateBody, null, 2), "utf-8");
    await testInfo.attach("step4-update-dates", { path: updateArtifact, contentType: "application/json" });

    expect(updateResponse.status(), "Update should return 200").toBe(200);
    const updateVac = updateBody.vacation ?? updateBody;
    // Status should reset from APPROVED to NEW when dates change
    expect(updateVac.status, "Status should reset to NEW after date edit").toBe("NEW");

    // Step 5: Check optional approval statuses AFTER edit — should all be ASKED
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

      const afterArtifact = testInfo.outputPath("step5-approvals-after-edit.json");
      await writeFile(afterArtifact, JSON.stringify({
        before: approvalsBefore,
        after: approvalsAfter,
        updatedStartDate: data.updatedStartDate,
        updatedEndDate: data.updatedEndDate,
      }, null, 2), "utf-8");
      await testInfo.attach("step5-approvals-after-edit", { path: afterArtifact, contentType: "application/json" });

      expect(approvalsAfter.length, "Approval records should still exist after edit").toBeGreaterThanOrEqual(1);

      // All optional approvers should be reset to ASKED
      for (const approverLogin of data.optionalApproverLogins) {
        const match = approvalsAfter.find(
          (r: Record<string, unknown>) => r.login === approverLogin,
        );
        expect(match, `Approval record for ${approverLogin} should exist after edit`).toBeTruthy();
        expect(
          match.status,
          `Approval for ${approverLogin} should be reset to ASKED after date edit`,
        ).toBe("ASKED");
      }
    } finally {
      await db2.close();
    }
  } finally {
    // Cleanup: delete the vacation (should be in NEW status after the edit)
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
