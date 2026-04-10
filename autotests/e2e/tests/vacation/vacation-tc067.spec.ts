import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc067Data } from "../../data/vacation/VacationTc067Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { DbClient } from "../../config/db/dbClient";
import {
  findNotificationEmails,
  getDbTimestamp,
} from "../../data/vacation/queries/vacationNotificationQueries";

/**
 * TC-VAC-067: Cancel vacation → notification to approver.
 * Creates a vacation, cancels it via API, and verifies that a
 * cancellation notification email is generated for the approver.
 * Template: NOTIFY_VACATION_DELETE_CANCEL_TO_APPROVER ("[TTT] Изменение статуса заявки")
 */
test("TC-VAC-067: Cancel vacation — notification to approver @regress @vacation @col-absences", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc067Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const db = new DbClient(tttConfig);

  try {
    // Create vacation first
    const vacation = await setup.createVacation(
      data.startDate,
      data.endDate,
      "REGULAR",
    );

    // Flush creation emails and wait
    await request.post(
      tttConfig.buildUrl("/api/email/v1/test/emails/send"),
      { headers: { API_SECRET_TOKEN: tttConfig.apiToken } },
    );
    await new Promise((r) => setTimeout(r, 2000));

    // Record timestamp before cancellation
    const beforeCancelTs = await getDbTimestamp(db);

    // Cancel the vacation — triggers cancel notification
    await setup.cancelVacation(vacation.id);

    // Trigger email batch send
    await request.post(
      tttConfig.buildUrl("/api/email/v1/test/emails/send"),
      { headers: { API_SECRET_TOKEN: tttConfig.apiToken } },
    );

    // Wait for async email processing
    await new Promise((r) => setTimeout(r, 3000));

    // Check DB for cancel notification to the approver
    // Template: NOTIFY_VACATION_DELETE_CANCEL_TO_APPROVER → subject "Изменение статуса заявки"
    const emails = await findNotificationEmails(
      db,
      data.approverEmail,
      beforeCancelTs,
      "%Изменение статуса заявки%",
    );

    expect(
      emails.length,
      `Expected cancellation notification to approver (${data.approverEmail})`,
    ).toBeGreaterThanOrEqual(1);

    // Cleanup: hard-delete the canceled vacation
    await setup.deleteVacation(vacation.id);
  } finally {
    await db.close();
  }
});
