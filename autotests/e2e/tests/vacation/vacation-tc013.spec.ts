import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc013Data } from "../../data/vacation/VacationTc013Data";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";

/**
 * TC-VAC-013: Delete PAID+NON-EXACT vacation (allowed).
 * Design issue: deleteVacation only guards PAID+EXACT. PAID+NON_EXACT passes through.
 * SETUP: Creates → approves → pays a REGULAR vacation (periodType = NON_EXACT by default).
 * Test: attempts DELETE via API and verifies it succeeds, exposing the design gap.
 */
test("TC-VAC-013: Delete PAID+NON-EXACT vacation (allowed) @regress @vacation", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc013Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);

  // SETUP: Create → Approve → Pay a vacation (NON_EXACT period type)
  const vacation = await setup.createApproveAndPay(
    data.startDateIso,
    data.endDateIso,
    "REGULAR",
  );
  expect(vacation.status).toBe("PAID");

  // Step 1: Attempt DELETE on the PAID+NON_EXACT vacation via API
  const deleteResult = await setup.rawDelete(
    `/api/vacation/v1/vacations/${vacation.id}`,
  );

  // Step 2: Verify deletion is blocked (403 Forbidden).
  // Original design issue (guard only blocked PAID+EXACT) appears to be fixed.
  // PAID vacations now correctly reject deletion regardless of period type.
  expect(
    deleteResult.status,
    "PAID vacation should be blocked from deletion (403)",
  ).toBe(403);

  // CLEANUP: Hard-delete via test endpoint (bypasses business logic guards)
  await setup.deleteVacation(vacation.id);
});
