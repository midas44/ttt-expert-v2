import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc025Data } from "../data/VacationTc025Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-025 - Cannot delete PAID vacation @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc025Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // 3. Fixtures
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login as the vacation owner
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to My vacations and days off -> "Closed" tab
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();

  // Step 3: Locate the PAID vacation
  const row = vacationsPage.vacationRow(data.periodPattern).first();
  await row.waitFor({ state: "visible" });

  // Step 4: Verify no delete/cancel action buttons are available
  // PAID vacations should have only 1 action button (view details)
  const actionsCell = row.locator("td").last();
  const actionButtons = actionsCell.locator("button");
  const buttonCount = await actionButtons.count();
  expect(buttonCount).toBe(1);

  // Step 5: Verify only "Request details" (view) action is available
  // Open details dialog via the single available button
  await actionButtons.first().click();
  const dialog = page.getByRole("dialog", { name: /Request details/i });
  await dialog.waitFor({ state: "visible" });

  // Verify no Delete button in the details dialog
  const deleteBtn = dialog.getByRole("button", { name: /delete/i });
  await expect(deleteBtn).toHaveCount(0);

  // Verify status is shown as Paid
  await expect(dialog.locator("text=/Paid/i")).toBeVisible();

  // Close dialog
  const closeBtn = dialog.getByRole("button", { name: /close/i });
  if ((await closeBtn.count()) > 0) {
    await closeBtn.click();
  } else {
    await page.keyboard.press("Escape");
  }

  // Logout
  await logout.runViaDirectUrl();
  await page.close();
});
