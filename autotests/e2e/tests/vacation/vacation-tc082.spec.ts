import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc082Data } from "../../data/vacation/VacationTc082Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-082: Russian messages in English events feed (#3344).
 * Bug: events feed shows Russian text even when UI language is English.
 * Marked as closed — this regression test verifies the fix.
 */
test("TC-VAC-082: Events feed shows English text when UI is English @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc082Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login
  await login.run();

  // Step 2: Ensure English UI
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
  await globalConfig.delay();

  // Step 4: Click "Vacation events feed" button
  const eventsFeedButton = page.getByRole("button", {
    name: /vacation events feed/i,
  });
  await expect(eventsFeedButton).toBeVisible();
  await eventsFeedButton.click();
  await globalConfig.delay();

  // Step 5: Wait for events feed content to load
  // The events feed may render as a panel, dialog, or inline content.
  // Wait for event entries to appear.
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();
  await verification.captureStep(testInfo, "events-feed-opened");

  // Step 6: Collect all visible text from the events feed area
  // Look for the events feed container — it could be a dialog, panel, or expanded section
  const feedContainer = page.locator(
    "[class*='event'], [class*='feed'], [class*='EventFeed'], [class*='eventFeed'], [role='dialog']",
  ).first();

  let feedText: string;
  if (await feedContainer.isVisible().catch(() => false)) {
    feedText = (await feedContainer.textContent()) ?? "";
  } else {
    // Fallback: check the entire page for event-like content below the button
    feedText = (await page.locator("main, [class*='page-body'], [class*='content']").first().textContent()) ?? "";
  }

  await verification.captureStep(testInfo, "events-feed-content");

  // Step 7: Check for Russian characters (Cyrillic Unicode range)
  // Russian chars: \u0400-\u04FF
  // Exclude common Russian names that may appear (employee names are often Russian)
  // Focus on event DESCRIPTION text — filter out employee name areas
  const cyrillicPattern = /[\u0400-\u04FF]{3,}/g;
  const cyrillicMatches = feedText.match(cyrillicPattern) ?? [];

  // Filter out likely employee names (short Cyrillic words near link/name patterns)
  // Event descriptions are longer phrases — if we see multi-word Cyrillic, it's likely a bug
  const longCyrillicPhrases = cyrillicMatches.filter(
    (match) => match.length >= 6,
  );

  if (longCyrillicPhrases.length > 0) {
    testInfo.annotations.push({
      type: "warning",
      description: `Bug #3344 may still be present: found Russian text in events feed: "${longCyrillicPhrases.slice(0, 3).join('", "')}"`,
    });
  }

  // The test passes if no long Cyrillic phrases are found in the events feed
  // (short Cyrillic words may be employee names which is acceptable)
  expect(
    longCyrillicPhrases.length,
    `Bug #3344: Found ${longCyrillicPhrases.length} Russian phrases in English events feed: ${longCyrillicPhrases.slice(0, 5).join(", ")}`,
  ).toBe(0);

  await logout.runViaDirectUrl();
  await page.close();
});
