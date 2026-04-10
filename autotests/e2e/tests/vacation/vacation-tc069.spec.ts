import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc069Data } from "../../data/vacation/VacationTc069Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { DbClient } from "../../config/db/dbClient";
import {
  findNotificationEmails,
  getDbTimestamp,
} from "../../data/vacation/queries/vacationNotificationQueries";

/**
 * TC-VAC-069: Wrong payment month in notification (#2925).
 * Creates a vacation with a specific paymentMonth, triggers approval notification,
 * then inspects the email body for the correct payment month.
 * Regression test for OPEN bug #2925 — payment month may be wrong in the email.
 *
 * Template variable: {{payment_date}} injected by AbstractVacationNotificationHelper.fillBaseInfo()
 * from VacationBO.paymentDate (formatted as "Month/Year" or "").
 */
test("TC-VAC-069: Wrong payment month in notification (#2925) @regress @vacation @col-absences", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc069Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const db = new DbClient(tttConfig);

  try {
    // Create vacation with explicit paymentMonth
    const vacation = await setup.createVacationWithOptions(
      data.startDate,
      data.endDate,
      { paymentType: "REGULAR", paymentMonth: data.paymentMonth },
    );

    // Flush creation emails first
    await request.post(
      tttConfig.buildUrl("/api/email/v1/test/emails/send"),
      { headers: { API_SECRET_TOKEN: tttConfig.apiToken } },
    );
    await new Promise((r) => setTimeout(r, 2000));

    // Record timestamp before approval
    const beforeApproveTs = await getDbTimestamp(db);

    // Approve the vacation — triggers status change notification with payment info
    await setup.approveVacation(vacation.id);

    // Flush approval emails
    await request.post(
      tttConfig.buildUrl("/api/email/v1/test/emails/send"),
      { headers: { API_SECRET_TOKEN: tttConfig.apiToken } },
    );
    await new Promise((r) => setTimeout(r, 3000));

    // Check DB for status-change notification to the employee
    const emails = await findNotificationEmails(
      db,
      data.employeeEmail,
      beforeApproveTs,
      "%Изменение статуса заявки%",
    );

    expect(
      emails.length,
      `Expected approval notification to employee (${data.employeeEmail})`,
    ).toBeGreaterThanOrEqual(1);

    // Read the email body to check payment month
    const emailBody = await db.queryOne<{ body: string }>(
      `SELECT body FROM ttt_email.email WHERE id = $1::uuid`,
      [emails[0].id],
    );
    expect(emailBody.body).toBeTruthy();

    // Derive expected payment month from the paymentMonth date
    // Russian month names used in email templates
    const russianMonths: Record<number, string> = {
      1: "янв", 2: "фев", 3: "мар", 4: "апр",
      5: "мая", 6: "июн", 7: "июл", 8: "авг",
      9: "сен", 10: "окт", 11: "ноя", 12: "дек",
    };
    const paymentDate = new Date(data.paymentMonth + "T12:00:00Z");
    const expectedMonth = paymentDate.getUTCMonth() + 1;
    const expectedYear = paymentDate.getUTCFullYear();
    const monthSubstring = russianMonths[expectedMonth];

    // Check if email body contains the expected payment month
    // Bug #2925: the payment month may be wrong in the email
    const bodyLower = emailBody.body.toLowerCase();
    const hasCorrectMonth =
      bodyLower.includes(monthSubstring) &&
      bodyLower.includes(String(expectedYear));

    // Log the result — if bug is still present, this assertion will fail
    // but we record the finding either way
    if (!hasCorrectMonth) {
      console.log(
        `[BUG #2925 CONFIRMED] Email body does not contain expected payment month "${monthSubstring}" / ${expectedYear}.`,
      );
      console.log(`Email body snippet: ${emailBody.body.substring(0, 500)}`);
    }

    // Assert the payment month is correct (will fail if bug #2925 is still present)
    expect(
      hasCorrectMonth,
      `Bug #2925: Payment month in email should contain "${monthSubstring}" and "${expectedYear}" but got: ${emailBody.body.substring(0, 300)}`,
    ).toBe(true);

    // Cleanup
    await setup.cancelVacation(vacation.id);
    await setup.deleteVacation(vacation.id);
  } finally {
    await db.close();
  }
});
