import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc019Data } from "../../data/vacation/VacationTc019Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";
import { VacationCreateDialog } from "../../pages/VacationCreateDialog";
import { DbClient } from "../../config/db/dbClient";
import { findVacationId } from "../../data/vacation/queries/vacationQueries";

/**
 * TC-VAC-019: CPO self-approval on create.
 * When a CPO (ROLE_DEPARTMENT_MANAGER) creates a vacation, the "Approved by" field
 * shows themselves and "Agreed by" shows their manager.
 */
test("TC-VAC-019: CPO self-approval on create @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc019Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  let vacationId = 0;

  try {
    // Step 1-2: Login, switch to English
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 3: Navigate to My Vacations
    await page.goto(`${tttConfig.appUrl}/vacation/my`, {
      waitUntil: "domcontentloaded",
    });
    const vacationsPage = new MyVacationsPage(page);
    await vacationsPage.waitForReady();

    // Step 4: Open create dialog and fill dates
    const dialog = await vacationsPage.openCreateRequest();
    await dialog.fillVacationPeriod(data.startInput, data.endInput);
    await globalConfig.delay();

    // Step 5: Verify "Approved by" shows the CPO themselves
    const approvedBy = await dialog.getApprovedByText();
    expect(
      approvedBy.toLowerCase(),
      `Expected "Approved by" to contain CPO name "${data.employeeName}"`,
    ).toContain(data.employeeName.split(" ")[0].toLowerCase());
    await verification.captureStep(testInfo, "cpo-approved-by-self");

    // Step 6: Verify "Agreed by" shows the manager
    const agreedBy = await dialog.getAgreedByText();
    expect(
      agreedBy.toLowerCase(),
      `Expected "Agreed by" to contain manager name "${data.managerName}"`,
    ).toContain(data.managerName.split(" ")[0].toLowerCase());
    await verification.captureStep(testInfo, "cpo-agreed-by-manager");

    // Step 7: Submit the vacation
    await dialog.submit();
    await dialog
      .root()
      .waitFor({ state: "detached", timeout: 15_000 })
      .catch(() => {});
    await globalConfig.delay();

    // Step 8: Verify vacation row appeared
    const row = await vacationsPage.waitForVacationRow(data.periodPattern);
    await expect(row.first()).toBeVisible();
    await verification.captureStep(testInfo, "cpo-vacation-created");

    // DB-CHECK: verify approver_id = employee_id (self-approval)
    const db = new DbClient(tttConfig);
    try {
      vacationId = await findVacationId(
        db,
        data.username,
        data.startDateIso,
        data.endDateIso,
      );
      const dbRow = await db.queryOne<{
        approver_id: string;
        employee_id: string;
      }>(
        `SELECT v.approver::text AS approver_id, v.employee::text AS employee_id
         FROM ttt_vacation.vacation v
         WHERE v.id = $1`,
        [vacationId],
      );
      expect(dbRow.approver_id).toBe(dbRow.employee_id);
    } finally {
      await db.close();
    }

    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    // CLEANUP: Delete the created vacation via API
    if (vacationId > 0) {
      try {
        const delUrl = tttConfig.buildUrl(
          `/api/vacation/v1/vacations/${vacationId}`,
        );
        await request.delete(delUrl, {
          headers: {
            API_SECRET_TOKEN: tttConfig.apiToken,
            "Content-Type": "application/json",
          },
        });
      } catch {
        /* cleanup best-effort */
      }
    }
  }
});
