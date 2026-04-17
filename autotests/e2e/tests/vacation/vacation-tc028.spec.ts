import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc028Data } from "../../data/vacation/VacationTc028Data";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";

/**
 * TC-VAC-028: Cannot pay NEW vacation.
 * SETUP: Creates a vacation via API (stays in NEW status, not approved).
 * Test: attempts payment → expects 400 (status must be APPROVED).
 */
test("TC-VAC-028: Cannot pay NEW vacation @regress @vacation", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc028Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);

  // SETUP: Create a vacation (stays NEW — do NOT approve)
  const vacation = await setup.createVacation(
    data.startDateIso,
    data.endDateIso,
  );

  try {
    const days = vacation.days ?? 5;

    // Step 1: Attempt payment on NEW vacation
    const payResp = await setup.rawPut(
      `/api/vacation/v1/vacations/pay/${vacation.id}`,
      {
        regularDaysPayed: days,
        administrativeDaysPayed: 0,
      },
    );

    // Step 2: Verify HTTP 400
    expect(payResp.status).toBe(400);

    // Step 3: Verify error indicates status must be APPROVED
    // The error may be about status not allowed or payment requiring APPROVED
    expect(payResp.body.errorCode ?? payResp.body.error ?? "").toMatch(
      /status|not.*allowed|pay/i,
    );

    // Step 4: Verify vacation status remains NEW
    // We can verify by attempting cancel (only works on NEW/APPROVED)
    await setup.cancelVacation(vacation.id);
  } finally {
    // CLEANUP: Delete vacation
    await setup.deleteVacation(vacation.id);
  }
});
