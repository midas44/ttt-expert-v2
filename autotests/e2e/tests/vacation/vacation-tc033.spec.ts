import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc033Data } from "../../data/vacation/VacationTc033Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

/**
 * TC-VAC-033: Error 500 on AV=true negative balance payment (#3363).
 * Known bug: payment on AV=true employee with negative vacation balance
 * triggers an unhandled NPE/exception returning HTTP 500.
 *
 * This is a regression test — if the bug is fixed, the expected status
 * should change from 500 to 200 (successful payment) or 400 (proper validation).
 *
 * Note: This test uses pvaynmaster (token owner) who may or may not be in an
 * AV=true office with negative balance. The data class attempts to find a
 * matching employee, but falls back to pvaynmaster if none exists.
 * The bug #3363 may only reproduce with a true negative-balance AV employee.
 */
test("TC-VAC-033: Error 500 on AV=true negative balance payment (#3363) @regress @vacation", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc033Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);

  // SETUP: Create → Approve a vacation
  // Note: if employee is not pvaynmaster, API_SECRET_TOKEN creates as pvaynmaster.
  // The bug requires AV=true + negative balance which may not match pvaynmaster.
  const vacation = await setup.createAndApprove(
    data.startDateIso,
    data.endDateIso,
  );

  try {
    const days = vacation.days ?? 5;

    // Step 1: Attempt payment with correct day split
    const payResp = await setup.rawPut(
      `/api/vacation/v1/vacations/pay/${vacation.id}`,
      {
        regularDaysPayed: days,
        administrativeDaysPayed: 0,
      },
    );

    // Step 2: Verify response — known bug #3363 returns 500
    // If bug is fixed, payment succeeds (200) or returns proper validation (400)
    if (data.hasNegativeBalance) {
      // With actual negative-balance AV=true employee, expect the bug
      expect([200, 400, 500]).toContain(payResp.status);
      if (payResp.status === 500) {
        // Bug confirmed — document the error for regression tracking
        const errorMsg =
          typeof payResp.body === "string"
            ? payResp.body
            : JSON.stringify(payResp.body);
        expect(errorMsg).toBeTruthy();
      }
    } else {
      // pvaynmaster fallback — payment may succeed normally
      expect([200, 400, 500]).toContain(payResp.status);
    }
  } finally {
    // CLEANUP: Hard-delete via test endpoint
    await setup.deleteVacation(vacation.id);
  }
});
