import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc057Data } from "../data/VacationTc057Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc057 - create vacation with optional approvers @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc057Data.create(globalConfig.testDataMode, tttConfig);

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

    // Step 2: Verify optional approvers in API response (if returned)
    const responseArtifact = testInfo.outputPath("step2-response-check.json");
    await writeFile(responseArtifact, JSON.stringify({
      hasOptionalApprovers: !!createVac.optionalApprovers,
      optionalApprovers: createVac.optionalApprovers ?? "not in response",
      requestedApprovers: data.optionalApproverLogins,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-response-check", { path: responseArtifact, contentType: "application/json" });

    // Step 3: Verify vacation_approval records in DB
    const db = new DbClient(tttConfig);
    try {
      const approvalRows = await db.query(
        `SELECT va.id, va.status, e.login
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee e ON va.employee = e.id
         WHERE va.vacation = $1
         ORDER BY va.id`,
        [createdVacationId],
      );

      const dbArtifact = testInfo.outputPath("step3-db-approvals.json");
      await writeFile(dbArtifact, JSON.stringify(approvalRows, null, 2), "utf-8");
      await testInfo.attach("step3-db-approvals", { path: dbArtifact, contentType: "application/json" });

      // vacation_approval may include primary approver (auto-assigned) + optional approvers
      expect(
        approvalRows.length,
        `Expected at least ${data.optionalApproverLogins.length} approval records, got ${approvalRows.length}`,
      ).toBeGreaterThanOrEqual(data.optionalApproverLogins.length);

      // Verify each requested optional approver has a record with ASKED status
      for (const requestedLogin of data.optionalApproverLogins) {
        const match = approvalRows.find(
          (r: Record<string, unknown>) => r.login === requestedLogin,
        );
        expect(match, `Approval record for ${requestedLogin} should exist`).toBeTruthy();
        expect(match.status, `Approval for ${requestedLogin} should be ASKED`).toBe("ASKED");
      }
    } finally {
      await db.close();
    }

    // Step 4: GET vacation to verify it still looks correct
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step4-verify.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-verify", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("NEW");
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
