import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc019Data } from "../data/VacationTc019Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-019 - Verify pagination on vacation table @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc019Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // Step 1: Login as employee with many vacations
  const login = new LoginFixture(page, tttConfig, data.employeeLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to My vacations → "All" tab
  await page.goto(tttConfig.buildUrl("/vacation/myVacation"));
  const vacationsPage = new MyVacationsPage(page);
  await vacationsPage.waitForReady();
  await vacationsPage.clickAllTab();
  await globalConfig.delay();

  // Step 3: Verify pagination controls exist
  const pagination = page.getByRole("navigation", { name: "Pagination" });
  await expect(pagination).toBeVisible({ timeout: 10000 });

  // Verify page 1 is current
  const page1Button = page.getByRole("button", {
    name: /Page 1 is your current page/,
  });
  await expect(page1Button).toBeVisible({ timeout: 5000 });

  // Verify page 2 button exists
  const page2Button = page.getByRole("button", { name: "Page 2" });
  await expect(page2Button).toBeVisible({ timeout: 5000 });

  // Record row count on page 1
  const page1RowCount = await vacationsPage.getRowCount();
  expect(page1RowCount, "Page 1 should have rows").toBeGreaterThan(0);

  await verification.verify("My vacations and days off", testInfo);

  // Step 4: Click page 2
  await page2Button.click();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Step 5: Verify page 2 shows results
  const page2RowCount = await vacationsPage.getRowCount();
  expect(page2RowCount, "Page 2 should have rows").toBeGreaterThan(0);

  // Verify page 2 is now current
  const page2Current = page.getByRole("button", {
    name: /Page 2 is your current page/,
  });
  await expect(page2Current).toBeVisible({ timeout: 5000 });

  // Step 6: Click "Previous page"
  const prevButton = page.getByRole("button", { name: "Previous page" });
  await prevButton.click();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Step 7: Verify back on page 1
  await expect(page1Button).toBeVisible({ timeout: 5000 });
  const restoredRowCount = await vacationsPage.getRowCount();
  expect(restoredRowCount, "Page 1 row count should match").toBe(
    page1RowCount,
  );

  // Step 8: Click "Next page"
  const nextButton = page.getByRole("button", { name: "Next page" });
  await nextButton.click();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Step 9: Verify moved to page 2 again
  await expect(page2Current).toBeVisible({ timeout: 5000 });

  await verification.verify("My vacations and days off", testInfo);

  // Cleanup
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
