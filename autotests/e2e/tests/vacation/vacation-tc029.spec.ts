import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc029Data } from "../../data/vacation/VacationTc029Data";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";

/**
 * TC-VAC-029: PAID vacation — terminal state, no further transitions.
 * SETUP: Creates → approves → pays a vacation via API.
 * Verifies: cancel, reject, update, and delete all return error codes.
 * PAID+EXACT vacation is a permanent, immutable record.
 */
test("TC-VAC-029: PAID vacation — terminal state, no further transitions @regress @vacation", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc029Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);

  // SETUP: Create → Approve → Pay
  const vacation = await setup.createApproveAndPay(
    data.startDateIso,
    data.endDateIso,
  );

  try {
    // Step 1: Attempt cancel → expect 400 or 403 (permission denied for PAID)
    const cancelResp = await setup.rawPut(
      `/api/vacation/v1/vacations/cancel/${vacation.id}`,
    );
    expect([400, 403]).toContain(cancelResp.status);

    // Step 2: Attempt reject → expect 400 or 403
    const rejectResp = await setup.rawPut(
      `/api/vacation/v1/vacations/reject/${vacation.id}`,
    );
    expect([400, 403]).toContain(rejectResp.status);

    // Step 3: Attempt update with new dates → expect non-200 (blocked)
    const updateResp = await setup.rawPut(
      `/api/vacation/v1/vacations`,
      {
        id: vacation.id,
        login: data.username,
        startDate: data.startDateIso,
        endDate: data.endDateIso,
        paymentType: "REGULAR",
        paymentMonth: `${data.startDateIso.slice(0, 8)}01`,
        optionalApprovers: [],
        notifyAlso: [],
      },
    );
    // PAID vacation should not be editable — expect 400, 403, or 405
    expect([400, 403, 405]).toContain(updateResp.status);

    // Step 4: Attempt delete via public API → expect 400 or 403 (PAID+EXACT blocked)
    const deleteResp = await setup.rawDelete(
      `/api/vacation/v1/vacations/${vacation.id}`,
    );
    expect([400, 403]).toContain(deleteResp.status);
  } finally {
    // CLEANUP: Hard-delete via test endpoint (bypasses status checks)
    await setup.deleteVacation(vacation.id);
  }
});
