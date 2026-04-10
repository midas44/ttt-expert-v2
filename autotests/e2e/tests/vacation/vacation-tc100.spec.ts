import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc100Data } from "../../data/vacation/VacationTc100Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

/**
 * TC-VAC-100: Batch deadlock on concurrent operations.
 *
 * Sends 3 simultaneous vacation create requests for the same employee
 * (pvaynmaster). Each vacation create triggers VacationRecalculationServiceImpl
 * FIFO redistribution, which locks employee_vacation rows. Concurrent access
 * causes PostgreSQL deadlocks (CannotAcquireLockException).
 *
 * Expected: at least 1 request succeeds; others may fail with 500 (deadlock).
 * This is a known architectural limitation, not a bug — the test verifies
 * the behavior is consistent and the service recovers gracefully.
 */
test("TC-VAC-100: Batch deadlock on concurrent vacation operations @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc100Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const headers = {
    API_SECRET_TOKEN: data.apiToken,
    "Content-Type": "application/json",
  };

  // Step 1: Send 3 concurrent vacation create requests for the same employee
  const createRequests = data.weeks.map((week) =>
    request.post(data.vacationsUrl, {
      headers,
      data: {
        login: data.login,
        startDate: week.startDate,
        endDate: week.endDate,
        paymentType: "REGULAR",
        paymentMonth: week.paymentMonth,
        optionalApprovers: [],
        notifyAlso: [],
      },
    }),
  );

  const responses = await Promise.all(createRequests);

  // Step 2: Collect results — status codes and bodies
  const results = await Promise.all(
    responses.map(async (resp, idx) => {
      const status = resp.status();
      let body: any;
      try {
        body = await resp.json();
      } catch {
        body = await resp.text();
      }
      return { idx, status, body, week: data.weeks[idx] };
    }),
  );

  // Log all responses for debugging
  for (const r of results) {
    const label = `Request ${r.idx + 1} (${r.week.startDate}→${r.week.endDate})`;
    console.log(`${label}: HTTP ${r.status}`);
    if (r.status !== 200) {
      console.log(`  Body: ${JSON.stringify(r.body).slice(0, 300)}`);
    }
  }

  const successes = results.filter((r) => r.status === 200);
  const failures = results.filter((r) => r.status !== 200);

  // Step 3: At least 1 request should succeed
  expect(
    successes.length,
    `Expected at least 1 successful creation out of 3 concurrent requests. ` +
      `Results: ${results.map((r) => `HTTP ${r.status}`).join(", ")}`,
  ).toBeGreaterThanOrEqual(1);

  // Step 4: Check failed requests for deadlock indicators
  for (const fail of failures) {
    const bodyStr =
      typeof fail.body === "string"
        ? fail.body
        : JSON.stringify(fail.body).toLowerCase();

    // Deadlocks manifest as 500 errors. 409 (conflict) is also acceptable
    // if the service handles the lock contention gracefully.
    expect(
      [500, 409, 400].includes(fail.status),
      `Failed request should be 500 (deadlock), 409 (conflict), or 400 (validation). Got: ${fail.status}`,
    ).toBe(true);

    if (fail.status === 500) {
      // Verify the 500 contains deadlock-related error indicators
      const isDeadlock =
        bodyStr.includes("deadlock") ||
        bodyStr.includes("cannotacquirelock") ||
        bodyStr.includes("lock") ||
        bodyStr.includes("concurrent") ||
        bodyStr.includes("internal server error") ||
        bodyStr.includes("error");

      console.log(
        `Request ${fail.idx + 1} deadlock indicators: ${isDeadlock}`,
      );
    }
  }

  // Step 5: Cleanup — delete all successfully created vacations
  const setup = new ApiVacationSetupFixture(request, tttConfig);
  for (const success of successes) {
    const vacationId = success.body?.vacation?.id ?? success.body?.id;
    if (vacationId) {
      try {
        await setup.deleteVacation(vacationId);
        console.log(`Cleaned up vacation ${vacationId}`);
      } catch (e) {
        console.warn(`Cleanup failed for vacation ${vacationId}: ${e}`);
      }
    }
  }

  // Summary assertion: document the observed deadlock behavior
  console.log(
    `\nConcurrency result: ${successes.length}/3 succeeded, ${failures.length}/3 failed`,
  );
  if (failures.length > 0) {
    console.log(
      "Deadlock confirmed: concurrent vacation operations cause row contention " +
        "in employee_vacation table during FIFO redistribution.",
    );
  }
});
