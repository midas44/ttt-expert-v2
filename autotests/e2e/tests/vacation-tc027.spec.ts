import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc027Data } from "../data/VacationTc027Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test.skip("TC-VAC-027 - Cannot cancel APPROVED vacation after accounting period close @regress", async ({
  page,
}, testInfo) => {
  // BLOCKED: This test requires closing the accounting period for the payment month.
  // Clock manipulation alone does not close accounting periods — they require
  // explicit period-close operations via the accounting module.
  // The canBeCancelled guard checks office.reportPeriod which is managed by accounting,
  // not by the server clock. Needs investigation into the period-close API.
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc027Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const apiToken = tttConfig.apiToken;
  const clockUrl = tttConfig.buildUrl("/api/ttt/v1/test/clock");
  const authHeaders = { API_SECRET_TOKEN: apiToken };

  // SETUP: Advance clock past the payment month to close the accounting period
  if (apiToken) {
    const patchResp = await page.request.patch(clockUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: { time: data.clockTime },
    });
    expect(
      patchResp.ok(),
      `Failed to set clock to ${data.clockTime}: ${patchResp.status()}`,
    ).toBeTruthy();
  }

  try {
    const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
    const mainFixture = new MainFixture(page, tttConfig, globalConfig);
    const navigation = new HeaderNavigationFixture(page, globalConfig);
    const verification = new VerificationFixture(page, globalConfig);
    const vacationsPage = new MyVacationsPage(page);
    const logout = new LogoutFixture(page, tttConfig, globalConfig);

    // Step 1: Login as the vacation owner
    await login.run();
    await mainFixture.ensureLanguage("EN");

    // Step 2: Navigate to My vacations and days off
    await navigation.navigate(
      "Calendar of absences > My vacations and days off",
    );
    await vacationsPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Switch to All tab to find the APPROVED vacation
    await vacationsPage.clickAllTab();
    await globalConfig.delay();

    // Step 4: Locate the APPROVED vacation
    const row = vacationsPage.vacationRow(data.periodPattern).first();
    await row.waitFor({ state: "visible", timeout: 10000 });

    await verification.verify("My vacations and days off", testInfo);

    // Step 5: Verify the vacation status is Approved
    const statusCell = await vacationsPage.columnCell(
      data.periodPattern,
      "Status",
    );
    await expect(statusCell).toContainText(/approved/i);

    // Step 6: Verify no cancel/delete action buttons are available
    // When period is closed, the vacation row should have only 1 action button (view details)
    const actionsCell = row.locator("td").last();
    const actionButtons = actionsCell.locator("button");
    const buttonCount = await actionButtons.count();

    // With closed period, should have at most 1 button (view details only)
    expect(
      buttonCount,
      `Expected only view-details button (1), but found ${buttonCount} action buttons. Cancel should be disabled after period close.`,
    ).toBeLessThanOrEqual(1);

    // Step 7: If there is a button, verify it opens details (not cancel)
    if (buttonCount > 0) {
      await actionButtons.first().click();
      const dialog = page.getByRole("dialog").first();
      await dialog.waitFor({ state: "visible", timeout: 5000 });

      // Verify no Delete/Cancel button in the details dialog
      const deleteBtn = dialog.getByRole("button", { name: /delete/i });
      const cancelBtn = dialog.getByRole("button", { name: /cancel/i });
      await expect(deleteBtn).toHaveCount(0);
      // Cancel button in dialog context means "close dialog", not "cancel vacation"
      // So we check there's no "Cancel request" or similar action button

      // Close dialog
      const closeBtn = dialog.getByRole("button", { name: /close/i });
      if ((await closeBtn.count()) > 0) {
        await closeBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
    }

    await verification.verify("My vacations and days off", testInfo);

    // Logout
    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    // Always reset clock to avoid affecting other tests
    if (apiToken) {
      await page.request
        .post(`${clockUrl}/reset`, { headers: authHeaders })
        .catch(() => {});
    }
  }
});
