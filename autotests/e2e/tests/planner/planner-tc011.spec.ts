import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc011Data } from "../../data/planner/PlannerTc011Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-011: Notification banners display correctly.
 * Verifies that notification banners (exceeded hours norm, overdue day-off,
 * overdue vacation requests) display on the Planner page.
 */
test("TC-PLN-011: Notification banners display correctly @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc011Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Login, ensure EN, navigate to planner
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_TASK`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Step 1: Check for the overdue day-off rescheduling banner
  const dayOffBanner = page.locator("text=overdue day off rescheduling requests").first();
  const hasDayOffBanner = await dayOffBanner
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (hasDayOffBanner) {
    await verification.captureStep(testInfo, "dayoff-banner-visible");
  }

  // Step 2: Check for the exceeded hours norm banner
  const normBanner = page.locator("text=exceeded the hours norm").first();
  const hasNormBanner = await normBanner
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (hasNormBanner) {
    await verification.captureStep(testInfo, "norm-banner-visible");
  }

  // Step 3: Check for overdue vacation requests banner
  const vacationBanner = page.locator("text=overdue").locator("xpath=ancestor::*[contains(., 'requests')]").first();
  const hasVacationBanner = await vacationBanner
    .isVisible({ timeout: 3_000 })
    .catch(() => false);
  if (hasVacationBanner) {
    await verification.captureStep(testInfo, "vacation-banner-visible");
  }

  // Step 4: Check for non-working days reminder
  const nonWorkingBanner = page.locator("text=non-working days").first();
  const hasNonWorkingBanner = await nonWorkingBanner
    .isVisible({ timeout: 3_000 })
    .catch(() => false);
  if (hasNonWorkingBanner) {
    await verification.captureStep(testInfo, "nonworking-banner-visible");
  }

  // Step 5: Verify at least one notification banner is displayed
  expect(
    hasDayOffBanner || hasNormBanner || hasVacationBanner || hasNonWorkingBanner,
    "Expected at least one notification banner to be visible on the Planner page",
  ).toBeTruthy();
  await verification.captureStep(testInfo, "banners-verified");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
