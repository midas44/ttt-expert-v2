import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc080Data } from "../data/VacationTc080Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";

test("TC-VAC-080 - Verify permissions for NEW vacation (owner) @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc080Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // === Login as the vacation owner ===
  const login = new LoginFixture(page, tttConfig, data.ownerLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // === Navigate to My vacations ===
  await navigation.navigate("Calendar of absences > My vacations and days off");
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // === Find the NEW vacation row ===
  const row = page
    .locator("table tbody tr")
    .filter({ hasText: data.vacationPeriodPattern })
    .filter({ hasText: /New/i })
    .first();
  await row.waitFor({ state: "visible", timeout: 10000 });

  // === Verify action buttons on the NEW row ===
  const actionsCell = row.locator("td").last();
  const actionButtons = actionsCell.locator("button");
  const buttonCount = await actionButtons.count();

  // Owner of NEW vacation should have at least edit button (pencil icon)
  expect(buttonCount, "Owner should have action buttons on NEW vacation").toBeGreaterThanOrEqual(1);

  // Verify edit button (first button = pencil icon) exists
  const editBtn = actionButtons.first();
  await expect(editBtn).toBeVisible();

  // === Verify owner can open request details (second button = "...") ===
  if (buttonCount >= 2) {
    const detailsBtn = actionButtons.nth(1);
    await detailsBtn.click();
    await globalConfig.delay();

    // In the details dialog, check for Cancel and Delete actions
    const dialog = page.getByRole("dialog");
    if (await dialog.count() > 0) {
      // Look for Cancel and Delete buttons in the dialog
      const cancelBtn = dialog.getByRole("button", { name: /Cancel/i });
      const deleteBtn = dialog.getByRole("button", { name: /Delete/i });

      // At least one of cancel/delete should be available for NEW status owner
      const cancelVisible = await cancelBtn.count() > 0;
      const deleteVisible = await deleteBtn.count() > 0;
      expect(
        cancelVisible || deleteVisible,
        "Owner should have Cancel or Delete action for NEW vacation",
      ).toBe(true);

      // Close the dialog
      const closeBtn = dialog.getByRole("button", { name: /Close|×/i });
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await globalConfig.delay();
      }
    }
  }

  // === Verify no approve/pay buttons visible (owner cannot self-approve) ===
  const approveBtn = row.locator('[data-testid="vacation-request-action-approve"]');
  expect(await approveBtn.count(), "No approve button for owner").toBe(0);

  const payBtn = row.locator('button:has-text("Pay")');
  expect(await payBtn.count(), "No pay button for owner").toBe(0);

  await verification.verify("My vacations", testInfo);

  // === Logout ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
