import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc012Data } from "../../data/vacation/VacationTc012Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-012: Vacation events feed.
 * SETUP: Creates then deletes a vacation via API to generate timeline events.
 * Test: opens the events feed dialog and verifies events are displayed.
 */
test("TC-VAC-012: Vacation events feed @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc012Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create and delete a vacation to generate timeline events
  const vacation = await setup.createVacation(
    data.startDateIso,
    data.endDateIso,
  );
  await setup.deleteVacation(vacation.id);

  // Step 1-2: Login, ensure English, navigate to My Vacations
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

  // Step 3: Click "Vacation events feed" button
  const dialog = await vacationsPage.openEventsFeed();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "events-feed-open");

  // Step 4: Verify dialog contains employee name and table
  await expect(dialog).toContainText("Pavel Weinmeister");
  await expect(dialog.locator("table")).toBeVisible();

  // Step 5: Verify events exist (at least 2 from our SETUP + prior activity)
  const events = await vacationsPage.getEventsFeedRows(dialog);
  expect(
    events.length,
    "Expected at least 2 events in the feed",
  ).toBeGreaterThanOrEqual(2);

  // Step 6: Verify event structure — each has a date and event description
  for (const evt of events) {
    expect(evt.date).toMatch(/\d{1,2}\s+\w+\s+\d{4}/); // "04 Apr 2026" format
    expect(evt.event.length).toBeGreaterThan(5);
  }

  // Step 7: Verify at least one event mentions "Vacation request"
  const hasVacationEvent = events.some((e) =>
    /vacation request|vacation days/i.test(e.event),
  );
  expect(
    hasVacationEvent,
    "Expected at least one vacation-related event",
  ).toBe(true);

  await verification.captureStep(testInfo, "events-verified");

  // Close dialog
  await vacationsPage.closeEventsFeedDialog(dialog);

  await logout.runViaDirectUrl();
  await page.close();
});
