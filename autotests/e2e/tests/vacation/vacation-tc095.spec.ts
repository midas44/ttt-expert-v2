import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc095Data } from "../../data/vacation/VacationTc095Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

/**
 * TC-VAC-095: Update without id in body → IllegalArgumentException.
 * PUT /api/vacation/v1/vacations/{id} with body missing the 'id' field.
 * The backend calls JPA findById(null) because it reads id from DTO body,
 * not the URL path — resulting in IllegalArgumentException.
 */
test("TC-VAC-095: PUT without id in body returns IllegalArgumentException @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc095Data.create(
    globalConfig.testDataMode,
    tttConfig,
    request,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  let vacationId: number | undefined;

  try {
    // SETUP: Create a vacation to get a valid ID
    const vacation = await setup.createVacation(
      data.startDate,
      data.endDate,
    );
    vacationId = vacation.id;

    const headers = {
      API_SECRET_TOKEN: tttConfig.apiToken,
      "Content-Type": "application/json",
    };

    // Step 1: PUT to /vacations/{id} with body MISSING the 'id' field
    const putUrl = `${data.vacationsUrl}/${vacationId}`;
    const resp = await request.put(putUrl, {
      headers,
      data: {
        // Deliberately omitting 'id' — backend reads id from body, not URL
        login: setup.tokenOwner,
        startDate: data.startDate,
        endDate: data.endDate,
        paymentType: "REGULAR",
        paymentMonth: `${data.startDate.slice(0, 8)}01`,
        optionalApprovers: [],
        notifyAlso: [],
      },
    });

    // Step 2: Verify HTTP 400 or 500 (IllegalArgumentException)
    const status = resp.status();
    expect(
      status >= 400,
      `Expected error status (4xx/5xx), got ${status}`,
    ).toBe(true);

    // Step 3: Verify error mentions IllegalArgumentException or null id
    const body = await resp.json();
    const errorText = JSON.stringify(body).toLowerCase();
    expect(
      errorText.includes("illegalargument") ||
        errorText.includes("must not be null") ||
        errorText.includes("id"),
      `Error should mention IllegalArgumentException or null id. Got: ${JSON.stringify(body)}`,
    ).toBe(true);
  } finally {
    // CLEANUP: Delete the created vacation
    if (vacationId) {
      await setup.deleteVacation(vacationId);
    }
  }
});
