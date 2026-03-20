import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc020Data } from "../data/VacationTc020Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc020 - Create vacation: DEPARTMENT_MANAGER self-approval @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc020Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation
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

    // Step 2: Verify self-approval in API response
    // approver is an object with login, latinFirstName, etc.
    const approverLogin = typeof createVac.approver === "string"
      ? createVac.approver
      : createVac.approver?.login;

    const approverArtifact = testInfo.outputPath("step2-approver-check.json");
    await writeFile(approverArtifact, JSON.stringify({
      vacationId: createdVacationId,
      employeeLogin: data.login,
      approverLogin,
      approverObject: createVac.approver,
      isSelfApproval: approverLogin === data.login,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-approver-check", { path: approverArtifact, contentType: "application/json" });

    // pvaynmaster (DEPARTMENT_MANAGER) auto-assigns self as approver
    expect(
      approverLogin,
      `Approver should be self (${data.login}) for DEPARTMENT_MANAGER`,
    ).toBe(data.login);

    // Step 3: Verify in DB — vacation.approver = vacation.employee (same person)
    const db = new DbClient(tttConfig);
    try {
      const dbRows = await db.query(
        `SELECT v.id,
                emp.login AS employee_login,
                apr.login AS approver_login,
                v.approver = (SELECT id FROM ttt_vacation.employee WHERE login = $2) AS is_self_approval
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee emp ON v.employee = emp.id
         JOIN ttt_vacation.employee apr ON v.approver = apr.id
         WHERE v.id = $1`,
        [createdVacationId, data.login],
      );

      const dbArtifact = testInfo.outputPath("step3-db-verify.json");
      await writeFile(dbArtifact, JSON.stringify(dbRows, null, 2), "utf-8");
      await testInfo.attach("step3-db-verify", { path: dbArtifact, contentType: "application/json" });

      expect(dbRows.length).toBeGreaterThanOrEqual(1);
      const row = dbRows[0];
      expect(row.employee_login, "Employee should be the creator").toBe(data.login);
      expect(row.approver_login, "Approver should be self").toBe(data.login);
      expect(row.is_self_approval, "DB confirms self-approval").toBe(true);
    } finally {
      await db.close();
    }

    // Step 4: Verify approval works (self-approve should succeed)
    const approveResponse = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );

    const approveBody = await approveResponse.json();
    const approveArtifact = testInfo.outputPath("step4-self-approve.json");
    await writeFile(approveArtifact, JSON.stringify(approveBody, null, 2), "utf-8");
    await testInfo.attach("step4-self-approve", { path: approveArtifact, contentType: "application/json" });

    expect(approveResponse.status(), "Self-approval should succeed").toBe(200);
    const approveVac = approveBody.vacation ?? approveBody;
    expect(approveVac.status, "Status should be APPROVED after self-approval").toBe("APPROVED");
  } finally {
    // Cleanup: cancel then delete
    if (createdVacationId) {
      await request.put(`${baseUrl}/cancel/${createdVacationId}`, {
        headers: authHeaders,
      });
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
