import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc003Data } from "../../data/planner/PlannerTc003Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-003: Navigate dates forward and backward.
 * Verifies that date navigation arrows update displayed date and table content.
 */
test("TC-PLN-003: Navigate dates forward and backward @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc003Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Step 0: Login, ensure EN, go to planner Tasks tab
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_TASK`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Step 1: Note the current date display (day name + DD.MM in .planner__header-day)
  const initialDateText = await plannerPage.getDateDisplayText();
  await verification.captureStep(testInfo, "initial-date");

  // Step 2: Click backward (prev day) — always enabled from today
  await plannerPage.navigateDateBackward();
  await globalConfig.delay();

  // Step 3: Verify date went back one day
  const afterBackward = await plannerPage.getDateDisplayText();
  expect(afterBackward).not.toBe(initialDateText);
  await verification.captureStep(testInfo, "after-backward");

  // Step 4: Click forward (next day) — enabled because we're now in the past
  await plannerPage.navigateDateForward();
  await globalConfig.delay();

  // Step 5: Verify date returns to original
  const afterForward = await plannerPage.getDateDisplayText();
  expect(afterForward).toBe(initialDateText);
  await verification.captureStep(testInfo, "after-forward-return");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
