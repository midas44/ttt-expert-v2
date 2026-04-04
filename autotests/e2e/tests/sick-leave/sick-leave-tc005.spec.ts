import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { SickLeaveSetupData } from "../../data/sick-leave/SickLeaveSetupData";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiSickLeaveSetupFixture } from "../../fixtures/ApiSickLeaveSetupFixture";
import { MainPage } from "../../pages/MainPage";
import { MySickLeavePage } from "../../pages/MySickLeavePage";

const MONTHS = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * TC-SL-005: Create single-day sick leave (startDate == endDate).
 * Verifies that the validator allows startDate.isEqual(endDate)
 * and that calendar days = 1.
 */
test("TC-SL-005: Create single-day sick leave @regress @sick-leave @col-absences", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SickLeaveSetupData.create(
    globalConfig.testDataMode,
    tttConfig,
    "SickLeaveTc005Data",
    58,
    0, // duration=0 → startDate == endDate (single day)
  );
  await globalConfig.applyViewport(page);

  // Build a flexible period pattern for single-day display
  // Table may show "15 Apr 2026" or "15 – 15 Apr 2026"
  const day = parseInt(data.startDateIso.split("-")[2], 10);
  const month = MONTHS[parseInt(data.startDateIso.split("-")[1], 10)];
  const periodPattern = new RegExp(`${day}.*${month}`);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const sickLeavePage = new MySickLeavePage(page);
  let createdSickLeaveId: number | undefined;

  try {
    // Login and set language
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Navigate to My Sick Leaves
    await page.goto(`${tttConfig.appUrl}/sick-leave/my`, {
      waitUntil: "domcontentloaded",
    });
    await sickLeavePage.waitForReady();
    await globalConfig.delay();

    // Step 3: Open create dialog
    const dialog = await sickLeavePage.openCreateDialog();
    await globalConfig.delay();

    // Step 4: Set Start date and End date to the SAME day
    await dialog.fillDates(data.startInput, data.endInput);
    await globalConfig.delay();

    // Step 5: Verify Calendar days shows 1
    const calDays = await dialog.getCalendarDays();
    expect(parseInt(calDays, 10)).toBe(1);
    await verification.captureStep(testInfo, "dialog-single-day-filled");

    // Step 6: Submit
    await dialog.submit();
    await page
      .getByRole("dialog")
      .waitFor({ state: "detached", timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Step 7: Verify row created with 1 calendar day
    const row = await sickLeavePage.waitForRow(periodPattern, 15000);
    await expect(row).toBeVisible();

    const tableDays = await sickLeavePage.getCalendarDays(periodPattern);
    expect(parseInt(tableDays, 10)).toBe(1);

    const state = await sickLeavePage.getState(periodPattern);
    expect(state).toMatch(/started|planned|opened/i);
    await verification.captureStep(testInfo, "single-day-sick-leave-created");

    // Get ID for cleanup
    const { findSickLeave } = await import(
      "../../data/sick-leave/queries/sickLeaveQueries"
    );
    const { DbClient } = await import("../../config/db/dbClient");
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
    if (createdSickLeaveId) {
      const setup = new ApiSickLeaveSetupFixture(page, tttConfig);
      await setup
        .deleteSickLeave(createdSickLeaveId)
        .catch((e) => console.warn(`Cleanup failed: ${e.message}`));
    }
    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
