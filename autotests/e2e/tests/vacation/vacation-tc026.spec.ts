import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc026Data } from "../../data/vacation/VacationTc026Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage } from "../../pages/MainPage";
import { VacationPaymentPage } from "../../pages/VacationPaymentPage";

/**
 * TC-VAC-026: Pay ADMINISTRATIVE vacation.
 * SETUP: Creates and approves ADMINISTRATIVE vacation for pvaynmaster via API.
 * Test: login as accountant → Vacation Payment page → check + pay → verify PAID.
 * WARNING: PAID+EXACT vacations are terminal and undeletable — permanent test data.
 */
test("TC-VAC-026: Pay ADMINISTRATIVE vacation @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc026Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);

  // SETUP: Create + approve ADMINISTRATIVE vacation via API
  const vacation = await setup.createAndApprove(
    data.startDateIso,
    data.endDateIso,
    "ADMINISTRATIVE",
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

    // Step 2: Navigate to Vacation Payment page and select month
    await page.goto(`${tttConfig.appUrl}/vacation/payment`, {
      waitUntil: "domcontentloaded",
    });
    const paymentPage = new VacationPaymentPage(page);
    await paymentPage.waitForReady();
    await paymentPage.selectMonth(data.paymentMonthLabel);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "payment-page-loaded");

    // Step 3: Find the APPROVED ADMINISTRATIVE vacation
    const row = await paymentPage.waitForVacationRow(
      data.vacationOwnerLastName,
      data.periodPattern,
    );
    await expect(row.first()).toBeVisible();
    await verification.captureStep(testInfo, "admin-vacation-found");

    // Step 4: Check the checkbox to select for payment
    await paymentPage.checkRow(data.vacationOwnerLastName, data.periodPattern);
    await globalConfig.delay();

    // Step 5: Click "Pay all the checked requests"
    await paymentPage.clickPayAll();
    await globalConfig.delay();

    // Step 6: Verify vacation status changed to "Paid"
    await globalConfig.delay();
    const paidRow = paymentPage.vacationRow(
      data.vacationOwnerLastName,
      data.periodPattern,
    );
    await expect(paidRow.first()).toContainText(/Paid/i);
    await verification.captureStep(testInfo, "admin-vacation-paid");

    // DB-CHECK: Verify status is PAID and type is ADMINISTRATIVE
    const getUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/${vacation.id}`,
    );
    const resp = await request.get(getUrl, {
      headers: { API_SECRET_TOKEN: tttConfig.apiToken },
    });
    const body = await resp.json();
    const vacData = body.vacation ?? body;
    expect(vacData.status).toBe("PAID");
    expect(vacData.paymentType).toBe("ADMINISTRATIVE");

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
      /* PAID+EXACT is undeletable */
    }
    throw err;
  }
  // NOTE: Successfully PAID+EXACT vacations are permanent — no cleanup possible
});
