import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc018Data } from "../data/VacationTc018Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc018 - CPO auto-approver self-assignment on vacation create @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc018Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Get employee IDs for assertion (pvaynmaster + manager)
    const db1 = new DbClient(tttConfig);
    let employeeId: number;
    let managerId: number;
    try {
      const empRow = await db1.query<{ id: number; login: string; manager: number }>(
        `SELECT id, login, manager FROM ttt_vacation.employee WHERE login = $1`,
        [data.login],
      );
      expect(empRow.length, "Employee should exist").toBe(1);
      employeeId = empRow[0].id;
      managerId = empRow[0].manager;

      const step1Artifact = testInfo.outputPath("step1-employee-info.json");
      await writeFile(step1Artifact, JSON.stringify({
        login: data.login,
        employeeId,
        managerId,
        managerLogin: data.managerLogin,
        isCPO: true,
        note: "DEPARTMENT_MANAGER → isCPO=true → self-approve + manager as optional",
      }, null, 2), "utf-8");
      await testInfo.attach("step1-employee-info", { path: step1Artifact, contentType: "application/json" });
    } finally {
      await db1.close();
    }

    // Step 2: Create vacation — should trigger CPO auto-approver assignment
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

    // Step 3: Verify approver is self (pvaynmaster) in API response
    const approver = createBody.vacation?.approver;
    const step3Artifact = testInfo.outputPath("step3-approver-check.json");
    await writeFile(step3Artifact, JSON.stringify({
      approver,
      expectedLogin: data.login,
      actualLogin: approver?.login,
      isSelfApproval: approver?.login === data.login,
      note: "CPO/DM sets approverId = employee.getId() (self-approve)",
    }, null, 2), "utf-8");
    await testInfo.attach("step3-approver-check", { path: step3Artifact, contentType: "application/json" });

    expect(approver?.login, "Approver should be self (CPO self-assignment)").toBe(data.login);

    // Step 4: Verify manager added as optional approver in DB
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

      // Find the manager's approval record
      const managerApproval = optApprovals.find(a => a.employee === managerId);

      const step4Artifact = testInfo.outputPath("step4-optional-approvers-db.json");
      await writeFile(step4Artifact, JSON.stringify({
        totalApprovals: optApprovals.length,
        approvals: optApprovals,
        managerApproval,
        managerLogin: data.managerLogin,
        managerId,
        note: "CPO path: request.getOptionalApprovers().add(manager.getLogin()) → synchronizeOptionalApprovals()",
      }, null, 2), "utf-8");
      await testInfo.attach("step4-optional-approvers-db", { path: step4Artifact, contentType: "application/json" });

      expect(managerApproval, "Manager should be added as optional approver in vacation_approval").toBeTruthy();
      expect(managerApproval!.status, "Manager approval status should be ASKED").toBe("ASKED");
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
