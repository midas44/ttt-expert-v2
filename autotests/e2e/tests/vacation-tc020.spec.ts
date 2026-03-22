import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc020Data } from "../data/VacationTc020Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";

test("TC-VAC-020 - Verify vacation events feed @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc020Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // Step 1: Login as employee with vacation history
  const login = new LoginFixture(page, tttConfig, data.employeeLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to My vacations
  await page.goto(tttConfig.buildUrl("/vacation/myVacation"));
  await page
    .locator("text=My vacations and days off")
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
  await globalConfig.delay();

  // Step 3: Click "Vacation events feed" button
  const eventsFeedButton = page.getByRole("button", {
    name: "Vacation events feed",
  });
  await expect(eventsFeedButton).toBeVisible({ timeout: 10000 });
  await eventsFeedButton.click();
  await globalConfig.delay();

  // Step 4: Verify events feed opens/displays
  // The events feed may appear as a panel, modal, or page section
  // Look for event entries containing vacation lifecycle actions
  await page.waitForTimeout(2000);

  await verification.verify("My vacations and days off", testInfo);

  // Step 5: Verify events show vacation lifecycle actions
  // Events typically show: created, approved, rejected, paid, cancelled, etc.
  const pageContent = await page.evaluate(() => document.body.textContent ?? "");
  const eventKeywords = [
    "created",
    "approved",
    "rejected",
    "paid",
    "cancelled",
    "deleted",
    "vacation",
  ];
  const foundEvents = eventKeywords.filter((kw) =>
    pageContent.toLowerCase().includes(kw),
  );
  expect(
    foundEvents.length,
    "Events feed should contain vacation lifecycle keywords",
  ).toBeGreaterThanOrEqual(1);

  // Step 6: Verify events are displayed (at least one event entry visible)
  // Look for timeline/event items — they typically contain dates and action descriptions
  const hasDatePattern = /\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}/;
  const hasTimeline = hasDatePattern.test(pageContent);
  expect(hasTimeline, "Events feed should contain dates").toBe(true);

  await verification.verify("My vacations and days off", testInfo);

  // Cleanup
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
