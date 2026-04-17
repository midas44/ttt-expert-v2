import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc034Data } from "../../data/vacation/VacationTc034Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-034: Start date in past — rejected.
 * The calendar widget uses readonly inputs and disables past date cells.
 * This test verifies that past date cells are disabled/unclickable in the calendar,
 * and that clicking a past date does NOT set the start date.
 */
test("TC-VAC-034: Start date in past — rejected @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc034Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1-2: Login, switch to English
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 3: Navigate to My Vacations
  await page.goto(`${tttConfig.appUrl}/vacation/my`, {
    waitUntil: "domcontentloaded",
  });
  const vacationsPage = new MyVacationsPage(page);
  await vacationsPage.waitForReady();

  // Step 4: Open create dialog
  const dialog = await vacationsPage.openCreateRequest();
  const dialogLocator = dialog.root();

  // Step 5: Open the start date calendar
  const dateInputs = dialogLocator.locator("input.date-picker__input");
  const startInput = dateInputs.nth(0);
  await startInput.click();

  // Find the calendar table
  const calendarTable = startInput.locator("..").locator("table").first();
  await calendarTable.waitFor({ state: "visible", timeout: 5000 });

  // Step 6: Verify past dates have disabled CSS class (rdtDisabled)
  // Yesterday's day number
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDay = yesterday.getDate();

  // Check that yesterday's cell in the current month has the disabled class
  const pastDayCells = await calendarTable
    .locator("tbody td")
    .filter({ hasText: new RegExp(`^${yesterdayDay}$`) })
    .all();

  let foundDisabledPastDate = false;
  for (const cell of pastDayCells) {
    const classList = await cell.getAttribute("class");
    if (!classList) continue;
    // Skip cells from adjacent months (rdtOld/rdtNew)
    if (classList.includes("rdtOld") || classList.includes("rdtNew")) continue;
    // Check for disabled class — react-datetime uses rdtDisabled
    if (classList.includes("rdtDisabled")) {
      foundDisabledPastDate = true;
      break;
    }
    // Alternative: check if the cell has reduced opacity (another way to indicate disabled)
    const isDisabled = await cell.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return (
        parseFloat(s.opacity) < 0.5 ||
        s.pointerEvents === "none" ||
        el.classList.contains("rdtDisabled")
      );
    });
    if (isDisabled) {
      foundDisabledPastDate = true;
      break;
    }
  }

  await verification.captureStep(testInfo, "calendar-past-dates-check");

  // Step 7: Try to click yesterday — verify the input value doesn't change to yesterday
  const inputValueBefore = await startInput.inputValue();
  // Click yesterday's cell (if present and in current month)
  for (const cell of pastDayCells) {
    const classList = await cell.getAttribute("class");
    if (classList?.includes("rdtOld") || classList?.includes("rdtNew")) continue;
    await cell.click({ force: true }); // force click on disabled element
    break;
  }
  await page.waitForTimeout(500);

  const inputValueAfter = await startInput.inputValue();

  // Verify: either disabled class found, or clicking had no effect
  const pastDateBlocked =
    foundDisabledPastDate || inputValueAfter === inputValueBefore;

  expect(
    pastDateBlocked,
    `Expected past date (${yesterdayDay}) to be blocked. ` +
      `Disabled class found: ${foundDisabledPastDate}. ` +
      `Input before: "${inputValueBefore}", after: "${inputValueAfter}"`,
  ).toBe(true);

  await verification.captureStep(testInfo, "past-date-blocked-verified");

  // Step 8: Also verify a 7-day-old date is disabled (not just yesterday)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoDay = weekAgo.getDate();

  // If week ago is in the same month, check it too
  if (weekAgo.getMonth() === new Date().getMonth()) {
    const weekAgoCells = await calendarTable
      .locator("tbody td:not(.rdtOld):not(.rdtNew)")
      .filter({ hasText: new RegExp(`^${weekAgoDay}$`) })
      .all();
    for (const cell of weekAgoCells) {
      const classList = await cell.getAttribute("class");
      expect(
        classList,
        `Day ${weekAgoDay} (7 days ago) should have rdtDisabled class`,
      ).toContain("rdtDisabled");
      break;
    }
  }

  // Close dialog
  await dialog.cancel();

  await logout.runViaDirectUrl();
  await page.close();
});
