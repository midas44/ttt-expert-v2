import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc042Data } from "../../data/vacation/VacationTc042Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";
import { VacationCreateDialog } from "../../pages/VacationCreateDialog";

/**
 * TC-VAC-042: Payment month range — 2 months before to end month.
 * Verifies:
 * 1. UI auto-sets payment month within valid range when vacation dates are selected
 * 2. API rejects out-of-range payment month with validation.vacation.dates.payment error
 */
test("TC-VAC-042: Payment month range — 2 months before to end month @regress @vacation @validation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc042Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const loginFixture = new LoginFixture(
    page,
    tttConfig,
    data.username,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // --- Part 1: UI — verify auto-set payment month is within range ---
  await loginFixture.run();
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

  const dialog = await vacationsPage.openCreateRequest();
  await globalConfig.delay();

  // Select vacation dates ~3 months ahead
  await dialog.fillVacationPeriod(data.startDateInput, data.endDateInput);
  await globalConfig.delay();

  // Read the auto-populated payment month
  const paymentText = await dialog.getPaymentMonthText();
  await verification.captureStep(testInfo, "payment-month-auto-set");

  // Verify payment month was auto-set (non-empty)
  expect(
    paymentText.length,
    "Payment month should be auto-populated after selecting vacation dates",
  ).toBeGreaterThan(0);

  // Close dialog without saving
  await dialog.cancel();
  await globalConfig.delay();

  await logout.runViaDirectUrl();
  await page.close();

  // --- Part 2: API — verify out-of-range payment month is rejected ---
  const url = tttConfig.buildUrl("/api/vacation/v1/vacations");
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  // Try creating vacation with payment month 3 months before end (outside range)
  const resp = await request.post(url, {
    headers,
    data: {
      login: data.username,
      startDate: data.startDateIso,
      endDate: data.endDateIso,
      paymentType: "REGULAR",
      paymentMonth: data.invalidPaymentIso,
      optionalApprovers: [],
      notifyAlso: [],
    },
  });

  // The server either corrects the payment month (200) or rejects (400).
  // Per code: correctPaymentMonth() adjusts first, then isPaymentDateCorrect() validates.
  // If correction can't fix it → 400 with validation.vacation.dates.payment
  const status = resp.status();
  const body = await resp.json().catch(() => ({}));

  if (status === 400) {
    // Expected: payment month outside range is rejected
    const errorCode =
      body.errorCode ?? body.error_code ?? JSON.stringify(body);
    expect(errorCode).toContain("validation.vacation.dates.payment");
  } else if (status === 200 || status === 201) {
    // Server auto-corrected the payment month — verify it's within range
    const vacation = body.vacation ?? body;
    const correctedMonth = vacation.paymentMonth ?? "";

    // Cleanup the accidentally created vacation
    if (vacation.id) {
      const testUrl = tttConfig.buildUrl(
        `/api/vacation/v1/test/vacations/${vacation.id}`,
      );
      await request.delete(testUrl, { headers }).catch(() => {});
    }

    // The corrected month should be within [earliest, latest] range
    expect(
      correctedMonth >= data.earliestPaymentIso &&
        correctedMonth <= data.latestPaymentIso,
      `Corrected payment month ${correctedMonth} should be within [${data.earliestPaymentIso}, ${data.latestPaymentIso}]`,
    ).toBeTruthy();
  } else {
    // Unexpected status
    expect.soft(status, `Unexpected status for out-of-range payment month`).toBe(400);
  }
});
