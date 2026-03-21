import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc037Data } from "../data/VacationTc037Data";

test("vacation_tc037 - Update vacation as approver via EDIT_APPROVER permission @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc037Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const approveUrl = tttConfig.buildUrl(data.approveEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation (pvaynmaster = owner + auto-assigned approver as DM)
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });
    const createBody = await createResp.json();

    const step1Artifact = testInfo.outputPath("step1-create-vacation.json");
    await writeFile(step1Artifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create-vacation", { path: step1Artifact, contentType: "application/json" });

    expect(createResp.status(), "Create should return 200").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createdVacationId, "Should get vacation ID").toBeTruthy();

    const initialStatus = createBody.vacation?.status;
    const approverLogin = createBody.vacation?.approver?.login;

    const step1bArtifact = testInfo.outputPath("step1b-approver-check.json");
    await writeFile(step1bArtifact, JSON.stringify({
      vacationId: createdVacationId,
      status: initialStatus,
      approverLogin,
      ownerLogin: data.login,
      isSelfApprover: approverLogin === data.login,
      note: "pvaynmaster as DM self-approves — is both owner and approver",
    }, null, 2), "utf-8");
    await testInfo.attach("step1b-approver-check", { path: step1bArtifact, contentType: "application/json" });

    expect(approverLogin, "pvaynmaster should be self-approver").toBe(data.login);

    // Step 2: Update vacation with new dates and comment (as approver)
    // Status is NEW — EDIT_APPROVER is available (not in NON_EDITABLE_STATUSES)
    const updateResp = await request.put(`${vacUrl}/${createdVacationId}`, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildUpdateBody(createdVacationId!),
    });
    const updateBody = await updateResp.json();

    const step2Artifact = testInfo.outputPath("step2-update-as-approver.json");
    await writeFile(step2Artifact, JSON.stringify({
      request: data.buildUpdateBody(createdVacationId!),
      status: updateResp.status(),
      body: updateBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-update-as-approver", { path: step2Artifact, contentType: "application/json" });

    expect(updateResp.status(), "Update as approver should return 200").toBe(200);

    // Verify dates changed
    const updatedStartDate = updateBody.vacation?.startDate;
    const updatedEndDate = updateBody.vacation?.endDate;
    expect(updatedStartDate, "Start date should be updated").toBe(data.updatedStartDate);
    expect(updatedEndDate, "End date should be updated").toBe(data.updatedEndDate);

    // Status should remain NEW (same-status update: NEW→NEW)
    expect(updateBody.vacation?.status, "Status should remain NEW after update").toBe("NEW");

    // Step 3: Approve the vacation, then update again (APPROVED status)
    const approveResp = await request.put(`${approveUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    let approveBody: Record<string, unknown> = {};
    try { approveBody = await approveResp.json(); } catch { /* empty */ }

    const step3Artifact = testInfo.outputPath("step3-approve.json");
    await writeFile(step3Artifact, JSON.stringify({
      status: approveResp.status(),
      body: approveBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-approve", { path: step3Artifact, contentType: "application/json" });

    expect(approveResp.status(), "Approve should return 200").toBe(200);

    // Step 4: Update again — APPROVED status, approver edit should still work
    // EDIT_APPROVER: isApprover && !NON_EDITABLE_STATUSES → APPROVED is editable
    // But owner edit on APPROVED + date change → resets to NEW
    const updateResp2 = await request.put(`${vacUrl}/${createdVacationId}`, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: {
        id: createdVacationId,
        login: data.login,
        startDate: data.startDate,  // back to original dates
        endDate: data.endDate,
        paymentType: "REGULAR",
        paymentMonth: data.paymentMonth,
        comment: "Second update after approve — TC-037",
        optionalApprovers: [],
        notifyAlso: [],
      },
    });
    const updateBody2 = await updateResp2.json();

    const step4Artifact = testInfo.outputPath("step4-update-after-approve.json");
    await writeFile(step4Artifact, JSON.stringify({
      status: updateResp2.status(),
      body: updateBody2,
      note: "Owner edits dates on APPROVED vacation → status resets to NEW",
    }, null, 2), "utf-8");
    await testInfo.attach("step4-update-after-approve", { path: step4Artifact, contentType: "application/json" });

    expect(updateResp2.status(), "Update after approve should return 200").toBe(200);

    // APPROVED → NEW reset when owner edits dates
    const statusAfterUpdate = updateBody2.vacation?.status;
    expect(statusAfterUpdate, "Status should reset to NEW after date edit on APPROVED").toBe("NEW");

    // Step 5: Verify via GET that changes persisted
    const getResp = await request.get(`${vacUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResp.json();

    const step5Artifact = testInfo.outputPath("step5-verify-get.json");
    await writeFile(step5Artifact, JSON.stringify({
      status: getResp.status(),
      body: getBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step5-verify-get", { path: step5Artifact, contentType: "application/json" });

    expect(getResp.status()).toBe(200);
    expect(getBody.startDate, "GET should show original start date").toBe(data.startDate);
    expect(getBody.endDate, "GET should show original end date").toBe(data.endDate);
    expect(getBody.status, "GET should show NEW status").toBe("NEW");
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    }
  }
});
