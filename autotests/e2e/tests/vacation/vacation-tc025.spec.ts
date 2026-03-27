import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc025Data } from "../../data/vacation/VacationTc025Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage } from "../../pages/MainPage";
import { VacationPaymentPage } from "../../pages/VacationPaymentPage";

/**
 * TC-VAC-025: Pay APPROVED REGULAR vacation — happy path.
 * SETUP: Creates and approves a vacation for pvaynmaster via API.
 * Test: login as accountant → Vacation Payment page → check + pay → verify PAID.
 * WARNING: PAID+EXACT vacations are terminal and undeletable — permanent test data.
 */
test("TC-VAC-025: Pay APPROVED REGULAR vacation @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc025Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);

  // SETUP: Create + approve a REGULAR vacation via API
  const vacation = await setup.createAndApprove(
    data.startDateIso,
    data.endDateIso,
  );

  try {
    // Step 1: Login as accountant
    const login = new LoginFixture(
      page,
      tttConfig,
      data.accountantLogin,
      globalConfig,
    );
    const logout = new LogoutFixture(page, tttConfig, globalConfig);

    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 2: Navigate to Vacation Payment page, then click correct month tab
    await page.goto(`${tttConfig.appUrl}/vacation/payment`, {
      waitUntil: "domcontentloaded",
    });
    const paymentPage = new VacationPaymentPage(page);
    await paymentPage.waitForReady();
    await paymentPage.selectMonth(data.paymentMonthLabel);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "payment-page-loaded");

    // Step 3: Find the APPROVED vacation in the payment table
    const row = await paymentPage.waitForVacationRow(
      data.vacationOwnerLastName,
      data.periodPattern,
    );
    await expect(row.first()).toBeVisible();
    await verification.captureStep(testInfo, "vacation-found-in-payment");

    // Step 4: Check the checkbox to select for payment
    await paymentPage.checkRow(data.vacationOwnerLastName, data.periodPattern);
    await globalConfig.delay();

    // Step 5: Click "Pay all the checked requests"
    await paymentPage.clickPayAll();
    await globalConfig.delay();

    // Step 6: Verify vacation status changed to "Paid" on the page
    await globalConfig.delay();
    // After payment, re-find the row and check it contains "Paid"
    const paidRow = paymentPage.vacationRow(
      data.vacationOwnerLastName,
      data.periodPattern,
    );
    await expect(paidRow.first()).toContainText(/Paid/i);
    await verification.captureStep(testInfo, "vacation-paid-status");

    // DB-CHECK: Verify status is PAID
    const getUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/${vacation.id}`,
    );
    const resp = await request.get(getUrl, {
      headers: { API_SECRET_TOKEN: tttConfig.apiToken },
    });
    const body = await resp.json();
    const vacationData = body.vacation ?? body;
    expect(vacationData.status).toBe("PAID");

    await logout.runViaDirectUrl();
    await page.close();
  } catch (err) {
    // CLEANUP attempt: cancel + delete if payment didn't go through
    try {
      await setup.cancelVacation(vacation.id);
    } catch {
      /* may already be paid */
    }
    try {
      await setup.deleteVacation(vacation.id);
    } catch {
      /* PAID+EXACT is undeletable — expected */
    }
    throw err;
  }
  // NOTE: Successfully PAID+EXACT vacations are permanent — no cleanup possible
});
