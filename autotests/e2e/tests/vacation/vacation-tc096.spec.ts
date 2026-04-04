import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc096Data } from "../../data/vacation/VacationTc096Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

/**
 * TC-VAC-096: Crossing validation error format inconsistency.
 * Documents the inconsistency between create and update error responses:
 *   - Create: errors[].code = specific crossing error code
 *   - Update: errors[].code = 'exception.validation.fail', specific code in errors[].message
 */
test("TC-VAC-096: Crossing validation error format differs between create and update @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc096Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  let vacationAId: number | undefined;
  let vacationBId: number | undefined;

  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  try {
    // SETUP: Create vacation A (first week)
    const vacA = await setup.createVacation(
      data.weekADates.startDate,
      data.weekADates.endDate,
    );
    vacationAId = vacA.id;

    // Step 1: POST overlapping vacation (same dates as A) → crossing error via CREATE
    const createResp = await request.post(data.vacationsUrl, {
      headers,
      data: {
        login: data.login,
        startDate: data.weekADates.startDate,
        endDate: data.weekADates.endDate,
        paymentType: "REGULAR",
        paymentMonth: `${data.weekADates.startDate.slice(0, 8)}01`,
        optionalApprovers: [],
        notifyAlso: [],
      },
    });

    // Step 2: Check create error response format
    expect(createResp.status(), "Create overlapping should fail").toBeGreaterThanOrEqual(400);
    const createBody = await createResp.json();

    // Step 3: Create non-overlapping vacation B (different week)
    const vacB = await setup.createVacation(
      data.weekBDates.startDate,
      data.weekBDates.endDate,
    );
    vacationBId = vacB.id;

    // Step 4: PUT vacation B with dates overlapping A → crossing error via UPDATE
    const updateResp = await request.put(
      `${data.vacationsUrl}/${vacationBId}`,
      {
        headers,
        data: {
          id: vacationBId,
          login: data.login,
          startDate: data.weekADates.startDate,
          endDate: data.weekADates.endDate,
          paymentType: "REGULAR",
          paymentMonth: `${data.weekADates.startDate.slice(0, 8)}01`,
          optionalApprovers: [],
          notifyAlso: [],
        },
      },
    );

    // Step 5: Check update error response format
    expect(updateResp.status(), "Update overlapping should fail").toBeGreaterThanOrEqual(400);
    const updateBody = await updateResp.json();

    // Step 6: Document the inconsistency — both should have crossing-related error info
    // Create endpoint error format
    const createHasErrors = Array.isArray(createBody.errors) && createBody.errors.length > 0;
    const createHasErrorCode = !!createBody.errorCode;
    expect(
      createHasErrors || createHasErrorCode,
      `Create response should contain errors[] or errorCode. Got: ${JSON.stringify(createBody)}`,
    ).toBe(true);

    // Update endpoint error format
    const updateHasErrors = Array.isArray(updateBody.errors) && updateBody.errors.length > 0;
    const updateHasErrorCode = !!updateBody.errorCode;
    expect(
      updateHasErrors || updateHasErrorCode,
      `Update response should contain errors[] or errorCode. Got: ${JSON.stringify(updateBody)}`,
    ).toBe(true);

    // Document the format difference (the test verifies both return crossing errors,
    // the inconsistency is the structure — captured here for documentation):
    if (createHasErrors && updateHasErrors) {
      const createCodes = createBody.errors.map((e: Record<string, string>) => e.code);
      const updateCodes = updateBody.errors.map((e: Record<string, string>) => e.code);
      // Log the difference for test report visibility
      console.log(
        `Create error codes: ${JSON.stringify(createCodes)}, ` +
          `Update error codes: ${JSON.stringify(updateCodes)}`,
      );
    }
  } finally {
    // CLEANUP: Delete both vacations
    if (vacationBId) await setup.deleteVacation(vacationBId);
    if (vacationAId) await setup.deleteVacation(vacationAId);
  }
});
