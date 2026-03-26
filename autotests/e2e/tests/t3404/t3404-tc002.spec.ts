import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T3404Tc001Data } from "../../data/t3404/T3404Tc001Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";
import { RescheduleDialog } from "../../pages/RescheduleDialog";

/**
 * TC-T3404-002: EN dialog title — "Reschedule event" (not "Reschedule an event").
 * Same i18n key as the tooltip; verifying it appears correctly in the dialog header.
 */
test("TC-T3404-002: EN dialog title Reschedule event @regress @t3404", async ({
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

  // Step 1: Login and ensure EN
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await globalConfig.delay();

  // Step 2: Navigate to Days off tab
  await dayOffPage.goto(tttConfig.appUrl);
  await dayOffPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Click edit icon to open reschedule dialog
  await dayOffPage.clickEditButton(data.dateDisplay);
  await rescheduleDialog.waitForOpen();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "reschedule-dialog-open");

  // Step 4: Verify dialog title text
  const dialog = page.getByRole("dialog");
  const heading = dialog.locator("h2, h3, [class*='title'], [class*='header']").first();
  const titleText = await heading.textContent();
  expect(titleText).toContain("Reschedule event");
  await verification.captureStep(testInfo, "dialog-title-verified");

  // Cleanup
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();
  await logout.runViaDirectUrl();
  await page.close();
});
