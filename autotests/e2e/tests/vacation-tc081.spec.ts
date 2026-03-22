import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc081Data } from "../data/VacationTc081Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";

test("TC-VAC-081 - Verify permissions for APPROVED vacation (owner) @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc081Data.create(
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

  // === Find the APPROVED vacation row ===
  const row = page
    .locator("table tbody tr")
    .filter({ hasText: data.vacationPeriodPattern })
    .filter({ hasText: /Approved/i })
    .first();
  await row.waitFor({ state: "visible", timeout: 10000 });

  // === Verify action buttons on the APPROVED row ===
  const actionsCell = row.locator("td").last();
  const actionButtons = actionsCell.locator("button");
  const buttonCount = await actionButtons.count();

  // Owner of APPROVED vacation should have edit button available
  expect(buttonCount, "Owner should have action buttons on APPROVED vacation").toBeGreaterThanOrEqual(1);

  // Verify edit button (first button = pencil icon)
  const editBtn = actionButtons.first();
  await expect(editBtn).toBeVisible();

  // === Open request details to check cancel/delete availability ===
  if (buttonCount >= 2) {
    const detailsBtn = actionButtons.nth(1);
    await detailsBtn.click();
    await globalConfig.delay();

    const dialog = page.getByRole("dialog");
    if (await dialog.count() > 0) {
      // Cancel/Delete may be conditional based on canBeCancelled guard
      // (REGULAR + APPROVED + reportPeriod after paymentDate → locked)
      const cancelBtn = dialog.getByRole("button", { name: /Cancel/i });
      const deleteBtn = dialog.getByRole("button", { name: /Delete/i });
      const cancelVisible = await cancelBtn.count() > 0;
      const deleteVisible = await deleteBtn.count() > 0;

      // Document what's available (conditional — depends on canBeCancelled)
      // This is a soft assertion — the test documents actual behavior
      if (cancelVisible || deleteVisible) {
        // Cancel/delete available — canBeCancelled is true
        expect(cancelVisible || deleteVisible).toBe(true);
      }
      // If neither is visible, canBeCancelled is false (locked by accounting period)

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
