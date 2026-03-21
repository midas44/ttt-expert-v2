import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc019Data } from "../data/VacationTc019Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc019 - regular employee auto-approver assignment @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc019Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Look up employee and manager IDs from DB for assertion
    const db1 = new DbClient(tttConfig);
    let managerId: number;
    try {
      const empRow = await db1.query<{
        id: number;
        login: string;
        manager: number;
      }>(
        `SELECT id, login, manager FROM ttt_vacation.employee WHERE login = $1`,
        [data.login],
      );
      expect(empRow.length, "Employee should exist in vacation DB").toBe(1);
      managerId = empRow[0].manager;

      const step1Artifact = testInfo.outputPath("step1-employee-info.json");
      await writeFile(step1Artifact, JSON.stringify({
        employeeLogin: data.login,
        employeeId: empRow[0].id,
        managerId,
        expectedManagerLogin: data.managerLogin,
        note: "Regular employee (not CPO/DM) — manager should be primary approver",
      }, null, 2), "utf-8");
      await testInfo.attach("step1-employee-info", { path: step1Artifact, contentType: "application/json" });
    } finally {
      await db1.close();
    }

    // Step 2: Create vacation for the regular employee
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResp.json();
    const step2Artifact = testInfo.outputPath("step2-create-vacation.json");
    await writeFile(step2Artifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step2-create-vacation", { path: step2Artifact, contentType: "application/json" });

    expect(createResp.status(), "Create should return 200").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createdVacationId, "Should get vacation ID").toBeTruthy();

    // Step 3: Verify approver is the manager (not self)
    const approver = createBody.vacation?.approver;

    const step3Artifact = testInfo.outputPath("step3-approver-check.json");
    await writeFile(step3Artifact, JSON.stringify({
      approver,
      expectedManagerLogin: data.managerLogin,
      actualApproverLogin: approver?.login,
      isManagerApprover: approver?.login === data.managerLogin,
      isSelfApproval: approver?.login === data.login,
      note: "Regular path: vacation.setApproverId(employee.getManager().getId())",
    }, null, 2), "utf-8");
    await testInfo.attach("step3-approver-check", { path: step3Artifact, contentType: "application/json" });

    expect(
      approver?.login,
      `Approver should be manager (${data.managerLogin}), not self (${data.login})`,
    ).toBe(data.managerLogin);

    // Step 4: Verify NO optional approvers auto-added (regular path doesn't add any)
    const db2 = new DbClient(tttConfig);
    try {
      const optApprovals = await db2.query<{
        id: number;
        vacation: number;
        employee: number;
        status: string;
      }>(
        `SELECT va.id, va.vacation, va.employee, va.status
         FROM ttt_vacation.vacation_approval va
         WHERE va.vacation = $1`,
        [createdVacationId],
      );

      const step4Artifact = testInfo.outputPath("step4-optional-approvers-db.json");
      await writeFile(step4Artifact, JSON.stringify({
        totalApprovals: optApprovals.length,
        approvals: optApprovals,
        note: "Regular employee path: no optional approvers auto-added (empty optionalApprovers in request)",
      }, null, 2), "utf-8");
      await testInfo.attach("step4-optional-approvers-db", { path: step4Artifact, contentType: "application/json" });

      expect(
        optApprovals.length,
        "No optional approvers should be auto-added for regular employee",
      ).toBe(0);
    } finally {
      await db2.close();
    }

    // Step 5: Verify vacation status is NEW after creation
    const status = createBody.vacation?.status;
    expect(status, "Vacation should be in NEW status after creation").toBe("NEW");
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    }
  }
});
