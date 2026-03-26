import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc030Data } from "../../data/day-off/DayoffTc030Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";
import { RescheduleDialog } from "../../pages/RescheduleDialog";
import { DayOffRequestPage } from "../../pages/DayOffRequestPage";

/**
 * TC-DO-030: CPO self-approval (PROJECT role).
 *
 * CPO/department managers are auto-assigned as their own approver.
 * This test creates a transfer request via UI (so the system assigns
 * the CPO as approver), then navigates to the Approval page to self-approve.
 */
test("TC-DO-030: CPO self-approval @regress", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc030Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.cpoLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);
  const rescheduleDialog = new RescheduleDialog(page);
  const requestPage = new DayOffRequestPage(page);

  let createdRequestId: number | null = null;

  try {
    // Step 1: Login as CPO employee
    await login.run();

    // Step 2: Navigate to Days off tab and create a transfer request
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Click edit on the target holiday row
    await dayOffPage.clickEditButton(data.originalDateDisplay);
    await globalConfig.delay();

    // Step 4: Select a personal date in the reschedule dialog
    await rescheduleDialog.waitForOpen();
    const { day, month, year } = data.personalDateParts;
    await rescheduleDialog.selectDate(day, month, year);
    await globalConfig.delay();

    // Step 5: Confirm the transfer request
    await rescheduleDialog.clickOk();
    await rescheduleDialog.waitForClose();
    await globalConfig.delay();

    // Step 6: Verify request created with arrow format + NEW status
    const arrowPattern = new RegExp(`${data.originalDateDisplay}.*\u2192`);
    const arrowRow = dayOffPage.dayOffRow(arrowPattern);
    await expect(arrowRow.first()).toBeVisible({ timeout: 15_000 });
    await verification.captureStep(testInfo, "transfer-request-created");

    // Extract the created request ID for cleanup later
    const listUrl = tttConfig.buildUrl(
      `/api/vacation/v1/employee-dayOff?login=${data.cpoLogin}&status=NEW`,
    );
    const listResp = await request.get(listUrl, {
      headers: { API_SECRET_TOKEN: tttConfig.apiToken },
    });
    if (listResp.ok()) {
      const body = await listResp.json();
      const items = body?.content ?? body ?? [];
      if (Array.isArray(items) && items.length > 0) {
        const match = items.find(
          (r: { originalDate?: string }) =>
            r.originalDate === data.originalDate,
        );
        if (match) createdRequestId = match.id;
      }
    }

    // Step 7: Navigate to the approval page (CPO should see own request)
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "approval-page-loaded");

    // Step 8: Find own request by employee name pattern
    const row = requestPage.requestRow(data.employeePattern);
    await expect(
      row.first(),
      "CPO should see own request in Approval tab",
    ).toBeVisible({ timeout: 15_000 });

    // Step 9: Approve own request
    const approveResponse = page.waitForResponse(
      (resp) => resp.url().includes("dayOff") && resp.status() < 400,
      { timeout: 15_000 },
    );
    await requestPage.clickApprove(data.employeePattern);
    await approveResponse;
    await globalConfig.delay();

    // Step 10: Verify request disappeared from Approval tab (now APPROVED)
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    await expect(
      requestPage.requestRow(data.employeePattern).first(),
    ).not.toBeVisible({ timeout: 10_000 });
    await verification.captureStep(testInfo, "self-approved");
  } finally {
    // CLEANUP: delete the created request if we got its ID
    if (createdRequestId) {
      const deleteUrl = tttConfig.buildUrl(
        `/api/vacation/v1/employee-dayOff/${createdRequestId}`,
      );
      await request
        .delete(deleteUrl, {
          headers: { API_SECRET_TOKEN: tttConfig.apiToken },
        })
        .catch(() => {});
    }

    await logout.runViaDirectUrl();
    await page.close();
  }
});
