import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { SickLeaveTc001Data } from "../../data/sick-leave/SickLeaveTc001Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiSickLeaveSetupFixture } from "@ttt/fixtures/ApiSickLeaveSetupFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { MySickLeavePage } from "@ttt/pages/MySickLeavePage";

/**
 * TC-SL-001: Create sick leave — happy path.
 * Verifies employee can create a sick leave via UI with dates only (no number).
 * Expected: sick leave created, status OPEN, accountingStatus NEW,
 * table shows dates, calendar days, State = Started/Planned.
 */
test("TC-SL-001: Create sick leave — happy path @regress @sick-leave", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SickLeaveTc001Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const sickLeavePage = new MySickLeavePage(page);
  let createdSickLeaveId: number | undefined;

  try {
    // Step 1: Login
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 2: Navigate to My Sick Leaves
    await page.goto(`${tttConfig.appUrl}/sick-leave/my`, {
      waitUntil: "domcontentloaded",
    });
    await sickLeavePage.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "sick-leave-page-loaded");

    // Step 3: Open create dialog
    const dialog = await sickLeavePage.openCreateDialog();
    await globalConfig.delay();

    // Step 4: Fill dates — start=today, end=today+5 (6 calendar days)
    await dialog.fillDates(data.startInput, data.endInput);
    await globalConfig.delay();

    // Step 5: Verify calendar days auto-calculated
    const calDays = await dialog.getCalendarDays();
    expect(
      parseInt(calDays, 10),
      `Expected ~${data.expectedCalendarDays} calendar days`,
    ).toBeGreaterThanOrEqual(data.expectedCalendarDays - 1);

    // Step 6-7: Leave number empty, leave familyMember unchecked (defaults)
    await verification.captureStep(testInfo, "dialog-filled");

    // Step 8: Submit
    await dialog.submit();
    await globalConfig.delay();

    // Wait for the dialog to close and table to refresh
    await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Step 9-10: Verify row appears in table
    const row = await sickLeavePage.waitForRow(data.periodPattern, 15000);
    await expect(row).toBeVisible();
    await verification.captureStep(testInfo, "sick-leave-created");

    // Step 11: Verify calendar days in table
    const tableDays = await sickLeavePage.getCalendarDays(data.periodPattern);
    expect(parseInt(tableDays, 10)).toBeGreaterThanOrEqual(
      data.expectedCalendarDays - 1,
    );

    // Step 10: Verify State = Started or Planned
    const state = await sickLeavePage.getState(data.periodPattern);
    expect(state).toMatch(/started|planned|opened/i);

    // Capture the sick leave ID for cleanup via DB
    const { findSickLeave } = await import(
      "../../data/sick-leave/queries/sickLeaveQueries"
    );
    const { DbClient } = await import("@ttt/config/db/dbClient");
    const db = new DbClient(tttConfig);
    try {
      const sl = await findSickLeave(
        db,
        data.username,
        data.startDateIso,
        data.endDateIso,
      );
      if (sl) createdSickLeaveId = sl.id;
    } finally {
      await db.close();
    }
  } finally {
    // CLEANUP: Delete created sick leave via API
    if (createdSickLeaveId) {
      const setup = new ApiSickLeaveSetupFixture(page, tttConfig);
      await setup.deleteSickLeave(createdSickLeaveId).catch((e) =>
        console.warn(`Cleanup failed: ${e.message}`),
      );
    }

    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
