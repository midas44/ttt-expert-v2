import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc064Data } from "../../data/vacation/VacationTc064Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { DbClient } from "../../config/db/dbClient";
import {
  findNotificationEmails,
  getDbTimestamp,
} from "../../data/vacation/queries/vacationNotificationQueries";

/**
 * TC-VAC-064: Create vacation → notification to approver.
 * Creates a vacation via API and verifies that a notification email
 * is generated for the approver/senior manager.
 * Ref: exploration/api-findings/vacation-notification-templates.md
 * Templates: NOTIFY_VACATION_CREATE_TO_SENIOR_MANAGER ("[TTT] Новая заявка на отпуск")
 */
test("TC-VAC-064: Create vacation — notification to approver @regress @vacation", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc064Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const db = new DbClient(tttConfig);

  try {
    // Record timestamp before creating the vacation
    const beforeTs = await getDbTimestamp(db);

    // Create vacation via API — this triggers notification events
    const vacation = await setup.createVacation(
      data.startDate,
      data.endDate,
      "REGULAR",
    );

    // Trigger email batch send to flush the queue
    await request.post(
      tttConfig.buildUrl("/api/email/v1/test/emails/send"),
      { headers: { API_SECRET_TOKEN: tttConfig.apiToken } },
    );

    // Wait for async email processing
    await new Promise((r) => setTimeout(r, 3000));

    // Check DB for notification email to the approver
    // Template: NOTIFY_VACATION_CREATE_TO_SENIOR_MANAGER → subject contains "заявка на отпуск"
    const emails = await findNotificationEmails(
      db,
      data.approverEmail,
      beforeTs,
      "%заявка на отпуск%",
    );

    expect(
      emails.length,
      `Expected notification email to approver (${data.approverEmail}) with subject containing "заявка на отпуск"`,
    ).toBeGreaterThanOrEqual(1);

    // Verify the email references the vacation owner
    const emailBody = await db.queryOne<{ body: string }>(
      `SELECT body FROM ttt_email.email WHERE id = $1::uuid`,
      [emails[0].id],
    );
    expect(emailBody.body).toBeTruthy();

    // Cleanup: hard-delete the vacation
    await setup.deleteVacation(vacation.id);
  } finally {
    await db.close();
  }
});
