import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc069Data } from "../../data/day-off/DayoffTc069Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../../pages/DayOffRequestPage";
import { DbClient } from "../../config/db/dbClient";
import {
  findNotificationEmails,
  getDbTimestamp,
} from "../../data/vacation/queries/vacationNotificationQueries";
import { deleteTransferRequest } from "../../data/day-off/queries/dayoffQueries";

/**
 * TC-DO-069: Email notification sent on day-off approval.
 *
 * Creates a NEW transfer request, logs in as manager, approves it,
 * then verifies that a notification email is generated for the employee.
 * Event: DayOffApprovedEvent → NOTIFY_DAYOFF_STATUS_CHANGE_TO_EMPLOYEE
 */
test("TC-DO-069: Email notification sent on approval @regress @day-off @col-absences", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc069Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const requestPage = new DayOffRequestPage(page);
  const db = new DbClient(tttConfig);

  try {
    // Record DB timestamp before approval action
    const beforeTs = await getDbTimestamp(db);

    // Step 1: Login as manager
    await login.run();

    // Step 2: Navigate to day-off approval page
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "approval-page-loaded");

    // Step 3: Verify the employee's request row is visible
    const row = requestPage.requestRow(data.employeePattern);
    await expect(
      row.first(),
      `Should see request from ${data.employeeLogin}`,
    ).toBeVisible();

    // Step 4: Approve the request
    await requestPage.clickApprove(data.employeePattern);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "after-approve");

    // Step 5: Trigger email batch send to flush the queue
    await request.post(
      tttConfig.buildUrl("/api/email/v1/test/emails/send"),
      { headers: { API_SECRET_TOKEN: tttConfig.apiToken } },
    );

    // Step 6: Wait for async email processing
    await new Promise((r) => setTimeout(r, 4000));

    // Step 7: Check ttt_email for notification to the employee
    // Template: NOTIFY_DAYOFF_STATUS_CHANGE_TO_EMPLOYEE
    const emails = await findNotificationEmails(
      db,
      data.employeeEmail,
      beforeTs,
      "%",
    );

    expect(
      emails.length,
      `Expected at least one notification email to employee (${data.employeeEmail}) after day-off approval`,
    ).toBeGreaterThanOrEqual(1);

    // Verify the email has a body (non-empty content)
    if (emails.length > 0) {
      const emailBody = await db.queryOne<{ body: string }>(
        `SELECT body FROM ttt_email.email WHERE id = $1::uuid`,
        [emails[0].id],
      );
      expect(emailBody.body, "Notification email should have body content").toBeTruthy();
    }

    await verification.captureStep(testInfo, "email-verified");
  } finally {
    await deleteTransferRequest(db, data.requestId);
    await db.close();
    await logout.runViaDirectUrl();
    await page.close();
  }
});
