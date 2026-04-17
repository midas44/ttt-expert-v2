import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { SickLeaveSetupData } from "../../data/sick-leave/SickLeaveSetupData";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { MySickLeavePage } from "@ttt/pages/MySickLeavePage";

/**
 * TC-SL-006: Edit sick leave dates (OPEN status).
 * Setup: create a sick leave via UI (5 days).
 * Then edit to extend end date by 3 days, verify calendar days recalculates.
 * Expected: dates updated, calendar days and working days recalculated, state unchanged.
 */
test("TC-SL-006: Edit sick leave dates @regress @sick-leave", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SickLeaveSetupData.create(
    globalConfig.testDataMode,
    tttConfig,
    "SickLeaveTc006Data",
    20,
    4,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const sickLeavePage = new MySickLeavePage(page);

  // Calculate the extended end date (3 more days)
  const extendedEnd = new Date(data.endDateIso);
  extendedEnd.setDate(extendedEnd.getDate() + 3);
  const extEndIso = extendedEnd.toISOString().slice(0, 10);
  const [ey, em, ed] = extEndIso.split("-");
  const extEndInput = `${ed}.${em}.${ey}`;
  const MONTHS = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const startDay = parseInt(data.startDateIso.split("-")[2], 10);
  const extEndDay = parseInt(ed, 10);
  const extEndMonth = MONTHS[parseInt(em, 10)];
  const newPeriodPattern = new RegExp(`${startDay}.*${extEndDay}.*${extEndMonth}`);

  try {
    // Login and set language
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Navigate to sick leave page
    await page.goto(`${tttConfig.appUrl}/sick-leave/my`, {
      waitUntil: "domcontentloaded",
    });
    await sickLeavePage.waitForReady();
    await globalConfig.delay();

    // SETUP: Create a sick leave via UI (5 calendar days)
    const createDialog = await sickLeavePage.openCreateDialog();
    await createDialog.fillDates(data.startInput, data.endInput);
    await globalConfig.delay();
    await createDialog.submit();
    await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Verify row exists
    await sickLeavePage.waitForRow(data.periodPattern, 15000);
    const daysBefore = await sickLeavePage.getCalendarDays(data.periodPattern);
    await verification.captureStep(testInfo, "sick-leave-before-edit");

    // Step 4: Click edit (pencil) action
    const editDialog = await sickLeavePage.clickEdit(data.periodPattern);
    await globalConfig.delay();

    // Step 5: Verify edit dialog opens with current dates
    const title = await editDialog.getTitle();
    expect(title.toLowerCase()).toMatch(/edit|изменени/i);
    await verification.captureStep(testInfo, "edit-dialog-open");

    // Step 6: Extend end date by 3 days
    await editDialog.fillEndDate(extEndInput);
    await globalConfig.delay();

    // Step 7: Verify calendar days recalculates
    const newCalDays = await editDialog.getCalendarDays();
    const originalDays = parseInt(daysBefore, 10);
    const updatedDays = parseInt(newCalDays, 10);
    expect(updatedDays).toBeGreaterThan(originalDays);

    // Step 8: Save
    await editDialog.submit();
    await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Step 9: Verify table row updates with new dates and day count
    const updatedRow = await sickLeavePage.waitForRow(newPeriodPattern, 15000);
    await expect(updatedRow).toBeVisible();
    const tableDays = await sickLeavePage.getCalendarDays(newPeriodPattern);
    expect(parseInt(tableDays, 10)).toBeGreaterThan(originalDays);
    await verification.captureStep(testInfo, "sick-leave-edited");
  } finally {
    // Cleanup: delete via UI
    try {
      const patternToDelete = newPeriodPattern;
      if (await sickLeavePage.hasRow(patternToDelete)) {
        await sickLeavePage.clickDelete(patternToDelete);
        const confirmDialog = page.getByRole("dialog");
        await confirmDialog.waitFor({ state: "visible", timeout: 3000 });
        await confirmDialog.getByRole("button", { name: /delete|confirm|yes|ok/i }).click();
        await confirmDialog.waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
      }
    } catch (e) {
      console.warn(`Cleanup failed: ${(e as Error).message}`);
    }
    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
