import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc068Data } from "../../data/vacation/VacationTc068Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { DbClient } from "../../config/db/dbClient";
import {
  findNotificationEmails,
  getDbTimestamp,
} from "../../data/vacation/queries/vacationNotificationQueries";

/**
 * TC-VAC-068: Also-notify recipients receive notification.
 * Creates a vacation with a colleague in the notifyAlso list,
 * then verifies a notification email is sent to that colleague.
 * Template: NOTIFY_VACATION_CREATE_TO_ALSO ("[TTT] Уведомление об отпуске сотрудника")
 */
test("TC-VAC-068: Also-notify recipients receive notification @regress @vacation @col-absences", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc068Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const db = new DbClient(tttConfig);

  try {
    // Clear any previous emails to the colleague to avoid false positives
    const beforeTs = await getDbTimestamp(db);

    // Create vacation with notifyAlso containing the colleague
    const vacation = await setup.createVacationWithOptions(
      data.startDate,
      data.endDate,
      { paymentType: "REGULAR", notifyAlso: [data.colleagueLogin] },
    );

    // Trigger email batch send to flush the queue
    await request.post(
      tttConfig.buildUrl("/api/email/v1/test/emails/send"),
      { headers: { API_SECRET_TOKEN: tttConfig.apiToken } },
    );

    // Wait for async email processing
    await new Promise((r) => setTimeout(r, 3000));

    // Check DB for notification email to the also-notify colleague
    // Template: NOTIFY_VACATION_CREATE_TO_ALSO → subject contains "отпуске сотрудника"
    const emails = await findNotificationEmails(
      db,
      data.colleagueEmail,
      beforeTs,
      "%отпуске сотрудника%",
    );

    expect(
      emails.length,
      `Expected notification email to also-notify colleague (${data.colleagueEmail}) with subject containing "отпуске сотрудника"`,
    ).toBeGreaterThanOrEqual(1);

    // Verify the notifyAlso entry exists in DB
    const notifyAlsoRow = await db.queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM ttt_vacation.vacation_notify_also vna
       JOIN ttt_vacation.vacation v ON vna.vacation = v.id
       JOIN ttt_vacation.employee e ON vna.approver = e.id
       WHERE v.id = $1 AND e.login = $2`,
      [vacation.id, data.colleagueLogin],
    );
    expect(parseInt(notifyAlsoRow.cnt)).toBeGreaterThanOrEqual(1);

    // Cleanup: hard-delete the vacation
    await setup.deleteVacation(vacation.id);
  } finally {
    await db.close();
  }
});
