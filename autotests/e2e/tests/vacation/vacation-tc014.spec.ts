import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc014Data } from "../../data/vacation/VacationTc014Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";
import { DbClient } from "@ttt/config/db/dbClient";

/**
 * TC-VAC-014: Soft delete — record persists in DB.
 * SETUP: Creates a vacation via API.
 * Test: deletes via Request Details dialog, verifies it appears in "Closed" tab,
 * and checks DB status = DELETED (not physically removed).
 */
test("TC-VAC-014: Soft delete — record persists in DB @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc014Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create a NEW vacation via API
  const vacation = await setup.createVacation(
    data.startDateIso,
    data.endDateIso,
  );

  try {
    // Step 1-2: Login, ensure English, navigate
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }
    await page.goto(`${tttConfig.appUrl}/vacation/my`, {
      waitUntil: "domcontentloaded",
    });
    const vacationsPage = new MyVacationsPage(page);
    await vacationsPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Open Request Details dialog and delete the vacation
    const detailsDialog = await vacationsPage.openRequestDetails(
      data.periodPattern,
    );
    await verification.captureStep(testInfo, "details-before-delete");
    await detailsDialog.deleteRequest();
    await globalConfig.delay();

    // Step 4: Verify vacation disappears from Open tab
    await vacationsPage.clickOpenTab();
    await globalConfig.delay();
    const openRowCount = await vacationsPage
      .vacationRow(data.periodPattern)
      .count();
    expect(openRowCount, "Vacation should not appear in Open tab").toBe(0);
    await verification.captureStep(testInfo, "open-tab-no-vacation");

    // Step 5: Click Closed tab — verify vacation appears with status "Deleted"
    await vacationsPage.clickClosedTab();
    await globalConfig.delay();
    const closedRow = vacationsPage.vacationRow(data.periodPattern).first();
    await expect(closedRow).toBeVisible();
    const statusText = await vacationsPage.columnValue(
      data.periodPattern,
      "Status",
    );
    expect(statusText.toLowerCase()).toContain("deleted");
    await verification.captureStep(testInfo, "closed-tab-deleted-status");

    // DB-CHECK: Verify status = DELETED in DB (soft delete, not physical removal)
    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ status: string }>(
        `SELECT status FROM ttt_vacation.vacation WHERE id = $1`,
        [vacation.id],
      );
      expect(row.status).toBe("DELETED");
    } finally {
      await db.close();
    }
  } finally {
    // CLEANUP: Hard-delete via test endpoint
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
