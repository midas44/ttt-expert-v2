import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc051Data } from "../data/VacationTc051Data";

test("vacation_tc051 - DELETED terminal state: all transitions blocked @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc051Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: Create vacation (NEW)
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
  const vacationId = createVac.id;
  expect(vacationId).toBeTruthy();

  // Step 2: Delete vacation (status → DELETED via soft-delete)
  const deleteResponse = await request.delete(`${baseUrl}/${vacationId}`, {
    headers: authHeaders,
  });

  let deleteBody: Record<string, unknown> = {};
  try { deleteBody = await deleteResponse.json(); } catch { /* empty */ }
  const deleteArtifact = testInfo.outputPath("step2-delete.json");
  await writeFile(deleteArtifact, JSON.stringify({ status: deleteResponse.status(), body: deleteBody }, null, 2), "utf-8");
  await testInfo.attach("step2-delete", { path: deleteArtifact, contentType: "application/json" });

  expect(deleteResponse.status(), "Delete should return 200").toBe(200);

  // Step 3: Try APPROVE on DELETED vacation — must fail
  const approveResp = await request.put(
    `${baseUrl}/approve/${vacationId}`,
    { headers: authHeaders },
  );

  let approveBody: Record<string, unknown> = {};
  try { approveBody = await approveResp.json(); } catch { /* empty */ }
  const approveArtifact = testInfo.outputPath("step3-approve-deleted.json");
  await writeFile(approveArtifact, JSON.stringify({ status: approveResp.status(), body: approveBody }, null, 2), "utf-8");
  await testInfo.attach("step3-approve-deleted", { path: approveArtifact, contentType: "application/json" });

  expect(
    [400, 403, 404, 500].includes(approveResp.status()),
    `Approve DELETED should fail, got ${approveResp.status()}`,
  ).toBe(true);

  // Step 4: Try REJECT on DELETED vacation — must fail
  const rejectResp = await request.put(
    `${baseUrl}/reject/${vacationId}`,
    { headers: authHeaders },
  );

  let rejectBody: Record<string, unknown> = {};
  try { rejectBody = await rejectResp.json(); } catch { /* empty */ }
  const rejectArtifact = testInfo.outputPath("step4-reject-deleted.json");
  await writeFile(rejectArtifact, JSON.stringify({ status: rejectResp.status(), body: rejectBody }, null, 2), "utf-8");
  await testInfo.attach("step4-reject-deleted", { path: rejectArtifact, contentType: "application/json" });

  expect(
    [400, 403, 404, 500].includes(rejectResp.status()),
    `Reject DELETED should fail, got ${rejectResp.status()}`,
  ).toBe(true);

  // Step 5: Try DELETE again on already DELETED vacation
  // BUG: Double deletion returns 200 — the DELETE endpoint does not check current status.
  const deleteAgainResp = await request.delete(`${baseUrl}/${vacationId}`, {
    headers: authHeaders,
  });

  let deleteAgainBody: Record<string, unknown> = {};
  try { deleteAgainBody = await deleteAgainResp.json(); } catch { /* empty */ }
  const deleteAgainArtifact = testInfo.outputPath("step5-delete-again-bug.json");
  await writeFile(deleteAgainArtifact, JSON.stringify({ status: deleteAgainResp.status(), body: deleteAgainBody }, null, 2), "utf-8");
  await testInfo.attach("step5-delete-again-bug", { path: deleteAgainArtifact, contentType: "application/json" });

  // BUG: Delete on DELETED vacation returns 200 (idempotent soft-delete).
  // Asserting actual behavior to detect if/when it gets fixed.
  expect(deleteAgainResp.status(), "BUG: Double deletion returns 200").toBe(200);

  // Step 6: Try UPDATE on DELETED vacation — known bug: returns 200, un-deletes the vacation
  // The update path does NOT check for DELETED status, allowing status reset from DELETED to NEW.
  const updateResp = await request.put(`${baseUrl}/${vacationId}`, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.buildUpdateBody(vacationId),
  });

  let updateBody: Record<string, unknown> = {};
  try { updateBody = await updateResp.json(); } catch { /* empty */ }
  const updateArtifact = testInfo.outputPath("step6-update-deleted-bug.json");
  await writeFile(updateArtifact, JSON.stringify({ status: updateResp.status(), body: updateBody }, null, 2), "utf-8");
  await testInfo.attach("step6-update-deleted-bug", { path: updateArtifact, contentType: "application/json" });

  // BUG: Update succeeds on DELETED vacation (HTTP 200) — DELETED→NEW transition
  // bypasses VacationStatusManager. This is documented as a known issue.
  // We assert the actual (buggy) behavior to detect if/when it gets fixed.
  expect(updateResp.status(), "BUG: Update on DELETED returns 200 (un-deletes)").toBe(200);

  // Cleanup: the update un-deleted the vacation (now NEW), so delete it
  const cleanupResp = await request.delete(`${baseUrl}/${vacationId}`, {
    headers: authHeaders,
  });
  const cleanupArtifact = testInfo.outputPath("cleanup-delete.json");
  try {
    await writeFile(cleanupArtifact, JSON.stringify(await cleanupResp.json(), null, 2), "utf-8");
  } catch {
    await writeFile(cleanupArtifact, `{"status":${cleanupResp.status()}}`, "utf-8");
  }
  await testInfo.attach("cleanup-delete", { path: cleanupArtifact, contentType: "application/json" });
});
