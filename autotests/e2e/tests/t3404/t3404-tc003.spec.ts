import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T3404Tc001Data } from "../../data/t3404/T3404Tc001Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { RescheduleDialog } from "@ttt/pages/RescheduleDialog";

/**
 * TC-T3404-003: RU tooltip text — "Перенести событие" (unchanged).
 * Regression check — the RU translation should not be affected by #3404.
 */
test("TC-T3404-003: RU tooltip text Перенести событие @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc001Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);
  const rescheduleDialog = new RescheduleDialog(page);

  // Step 1: Login
  await login.run();

  // Step 2: Switch to Russian
  await mainFixture.ensureLanguage("RU");
  await globalConfig.delay();

  // Step 3: Navigate to Days off tab
  await dayOffPage.goto(tttConfig.appUrl);
  await dayOffPage.waitForReady();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "dayoff-tab-ru");

  // Step 4: Click edit icon to open the reschedule dialog
  await dayOffPage.clickEditButton(data.dateDisplay);
  await rescheduleDialog.waitForOpen();
  await globalConfig.delay();

  // Step 5: Verify dialog title contains "Перенести событие"
  const dialog = page.getByRole("dialog");
  const dialogText = await dialog.textContent();
  expect(dialogText).toContain("Перенести событие");
  await verification.captureStep(testInfo, "dialog-title-ru");

  // Close dialog
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();

  // Restore EN and cleanup
  await mainFixture.ensureLanguage("EN");
  await logout.runViaDirectUrl();
  await page.close();
});
