import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc065Data } from "../../data/vacation/VacationTc065Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { DbClient } from "../../config/db/dbClient";
import {
  findNotificationEmails,
  getDbTimestamp,
} from "../../data/vacation/queries/vacationNotificationQueries";

/**
 * TC-VAC-065: Approve vacation → notification to employee.
 * Creates a vacation, approves it via API, and verifies that a
 * status-change notification email is generated for the employee.
 * Template: NOTIFY_VACATION_STATUS_CHANGE_TO_EMPLOYEE ("[TTT] Изменение статуса заявки")
 */
test("TC-VAC-065: Approve vacation — notification to employee @regress @vacation @col-absences", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc065Data.create(
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

    // Record timestamp AFTER creation (before approval)
    const beforeApproveTs = await getDbTimestamp(db);

    // Approve the vacation — triggers status change notification
    await setup.approveVacation(vacation.id);

    // Trigger email batch send
    await request.post(
      tttConfig.buildUrl("/api/email/v1/test/emails/send"),
      { headers: { API_SECRET_TOKEN: tttConfig.apiToken } },
    );

    // Wait for async email processing
    await new Promise((r) => setTimeout(r, 3000));

    // Check DB for status-change notification to the employee
    // Template: NOTIFY_VACATION_STATUS_CHANGE_TO_EMPLOYEE → subject "Изменение статуса заявки"
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

    // Cleanup: cancel then hard-delete
    await setup.cancelVacation(vacation.id);
    await setup.deleteVacation(vacation.id);
  } finally {
    await db.close();
  }
});
