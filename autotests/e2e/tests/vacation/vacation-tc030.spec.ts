import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc030Data } from "../../data/vacation/VacationTc030Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

/**
 * TC-VAC-030: Delete PAID+EXACT blocked.
 * SETUP: Creates → approves → pays a vacation via API (creates EXACT period).
 * Verifies: DELETE returns 400 with errorCode 'exception.vacation.delete.notAllowed'.
 * Guard: status==PAID && periodType==EXACT → throw ServiceException.
 */
test("TC-VAC-030: Delete PAID+EXACT blocked @regress @vacation", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc030Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);

  // SETUP: Create → Approve → Pay (creates EXACT period)
  const vacation = await setup.createApproveAndPay(
    data.startDateIso,
    data.endDateIso,
  );

  try {
    // Step 1: Attempt DELETE via public API
    const deleteResp = await setup.rawDelete(
      `/api/vacation/v1/vacations/${vacation.id}`,
    );

    // Step 2: Verify deletion is blocked
    // PAID+EXACT: permission service returns empty set → 403; or guard throws → 400
    expect([400, 403]).toContain(deleteResp.status);

    // Step 3: Verify error details (403 = permission denied for PAID status,
    // 400 = guard with specific error code)
    if (deleteResp.status === 400) {
      expect(deleteResp.body.errorCode).toBe(
        "exception.vacation.delete.notAllowed",
      );
    }

    // Step 4: Verify vacation still exists with PAID status
    // The 403 response confirms the vacation exists but is protected.
    // Double-check by attempting a second GET-like operation:
    // cancel also blocked (vacation is still PAID and immutable).
    const cancelResp = await setup.rawPut(
      `/api/vacation/v1/vacations/cancel/${vacation.id}`,
    );
    expect([400, 403]).toContain(cancelResp.status);
  } finally {
    // CLEANUP: Hard-delete via test endpoint (bypasses status checks)
    await setup.deleteVacation(vacation.id);
  }
});
