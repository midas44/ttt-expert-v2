import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc072Data } from "../../data/vacation/VacationTc072Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-072: Regression — Payment month not updated in edit modal (#2705).
 * SETUP: Create vacation in Month A via API.
 * Test: Edit dates to Month B, verify payment month auto-updates,
 * save, re-open edit dialog, verify payment month persisted correctly.
 * Bug #2705 (fixed): previously payment month didn't update after save.
 */
test("TC-VAC-072: Payment month not updated in edit modal @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc072Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create vacation in Month A via API
  const vacation = await setup.createVacation(
    data.initialStartIso,
    data.initialEndIso,
  );

  try {
    // Step 1: Login and navigate
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }
    await page.goto(`${tttConfig.appUrl}/vacation/my`, {
      waitUntil: "domcontentloaded",
    });
    await vacationsPage.waitForReady();
    await globalConfig.delay();

    // Step 2: Open edit dialog for the created vacation
    const dialog = await vacationsPage.openEditDialog(data.periodPattern);
    await globalConfig.delay();

    // Step 3: Read initial payment month (should be Month A)
    const initialPayment = await dialog.getPaymentMonthText();
    await verification.captureStep(testInfo, "initial-payment-month");

    // Step 4: Change dates to Month B
    await dialog.fillVacationPeriod(data.newStartInput, data.newEndInput);
    await globalConfig.delay();

    // Step 5: Verify payment month auto-updates to Month B
    const updatedPayment = await dialog.getPaymentMonthText();
    expect(
      updatedPayment,
      "Payment month should auto-update when dates change to different month",
    ).not.toBe(initialPayment);
    await verification.captureStep(testInfo, "payment-month-auto-updated");

    // Step 6: Save the changes — wait for dialog to close
    await dialog.submit();
    await dialog
      .root()
      .waitFor({ state: "detached", timeout: 15_000 })
      .catch(async () => {
        // Dialog might not have closed — retry submit
        if (await dialog.isOpen()) {
          await dialog.submit();
          await dialog
            .root()
            .waitFor({ state: "detached", timeout: 10_000 })
            .catch(() => {});
        }
      });
    await globalConfig.delay();

    // Step 7: Wait for the vacation row to update with new dates
    await vacationsPage.waitForVacationRow(data.newPeriodPattern);
    await globalConfig.delay();

    // Step 8: Re-open edit dialog to verify payment month persisted
    const dialog2 = await vacationsPage.openEditDialog(data.newPeriodPattern);
    await globalConfig.delay();

    const persistedPayment = await dialog2.getPaymentMonthText();
    expect(
      persistedPayment,
      "Payment month should persist after save (regression #2705)",
    ).toBe(updatedPayment);
    await verification.captureStep(testInfo, "payment-month-persisted");

    // Close dialog
    await dialog2.cancel();
  } finally {
    // CLEANUP: Hard-delete the vacation
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
