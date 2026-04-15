import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { SickLeaveSetupData } from "../../data/sick-leave/SickLeaveSetupData";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiSickLeaveSetupFixture } from "@ttt/fixtures/ApiSickLeaveSetupFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { MySickLeavePage } from "@ttt/pages/MySickLeavePage";

/**
 * TC-SL-040: Overlapping sick leave — rejected.
 * Setup: create first sick leave via UI.
 * Test: try to create second sick leave with overlapping dates.
 * Expected: error (exception.validation.sickLeave.dates.crossing), second SL NOT created.
 * Overlap check excludes DELETED and REJECTED sick leaves.
 */
test("TC-SL-040: Overlapping sick leave — rejected @regress @sick-leave @col-absences", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SickLeaveSetupData.create(
    globalConfig.testDataMode,
    tttConfig,
    "SickLeaveTc040Data",
    42,
    6,
  );
  await globalConfig.applyViewport(page);

  // Compute overlapping dates: start 2 days into the first SL, end 3 days after it
  const overlapStart = new Date(data.startDateIso);
  overlapStart.setDate(overlapStart.getDate() + 2);
  const overlapEnd = new Date(data.endDateIso);
  overlapEnd.setDate(overlapEnd.getDate() + 3);
  const toCalFmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  };
  const overlapStartInput = toCalFmt(overlapStart.toISOString().slice(0, 10));
  const overlapEndInput = toCalFmt(overlapEnd.toISOString().slice(0, 10));

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

    // Navigate
    await page.goto(`${tttConfig.appUrl}/sick-leave/my`, {
      waitUntil: "domcontentloaded",
    });
    await sickLeavePage.waitForReady();
    await globalConfig.delay();

    // SETUP: Create first sick leave
    const createDialog1 = await sickLeavePage.openCreateDialog();
    await createDialog1.fillDates(data.startInput, data.endInput);
    await globalConfig.delay();
    await createDialog1.submit();
    await page
      .getByRole("dialog")
      .waitFor({ state: "detached", timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    await sickLeavePage.waitForRow(data.periodPattern, 15000);
    const rowCountBefore = await sickLeavePage.rowCount();
    await verification.captureStep(testInfo, "first-sick-leave-created");

    // Capture ID for cleanup
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

    // Step 3-4: Open create dialog with OVERLAPPING dates
    const createDialog2 = await sickLeavePage.openCreateDialog();
    await createDialog2.fillDates(overlapStartInput, overlapEndInput);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "overlap-dialog-filled");

    // Step 5: Submit overlapping sick leave
    await createDialog2.submit();
    await globalConfig.delay();
    await page.waitForTimeout(2000);

    // Step 6: Verify rejection — dialog stays open or error notification appears
    const dialogStillOpen = await createDialog2.isOpen();
    if (dialogStillOpen) {
      await verification.captureStep(testInfo, "overlap-rejected-dialog-open");
      await createDialog2.cancel();
      await globalConfig.delay();
    } else {
      // Dialog closed — check for error notification
      await verification.captureStep(testInfo, "overlap-rejected-notification");
    }

    // Step 7: Verify row count unchanged — second sick leave NOT created
    await page.waitForTimeout(1000);
    const rowCountAfter = await sickLeavePage.rowCount();
    expect(rowCountAfter).toBe(rowCountBefore);
    await verification.captureStep(testInfo, "no-duplicate-created");
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
