import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc080Data } from "../../data/vacation/VacationTc080Data";

/**
 * TC-VAC-080: Approver field missing from API (#3329).
 * Hotfix applied: approver was intermittently null in API responses.
 * Regression test: GET /api/vacation/v1/vacations and verify all
 * non-terminal vacations have an approver field populated.
 */
test("TC-VAC-080: Approver field present in all API vacation responses @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc080Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  // Step 1: GET vacation list (paginated: { content: [...] })
  const resp = await request.get(data.vacationsUrl, { headers });
  expect(resp.status(), "GET /vacations should return 200").toBe(200);

  const body = await resp.json();
  const vacations: Record<string, unknown>[] = body.content ?? body;
  expect(Array.isArray(vacations), "Response content should be an array").toBe(true);
  expect(vacations.length, "Should have at least one vacation").toBeGreaterThan(0);

  // Step 2: Check each vacation for approver field
  // Only check non-terminal statuses: NEW, APPROVED, PAID (DELETED/CANCELED may lose approver)
  const activeStatuses = ["NEW", "APPROVED", "PAID"];
  const activeVacations = vacations.filter((v) =>
    activeStatuses.includes(v.status as string),
  );

  const missingApprover = activeVacations.filter(
    (v) => v.approver === null || v.approver === undefined,
  );

  // Step 3: Assert no vacations have missing approver
  expect(
    missingApprover.length,
    `Bug #3329: ${missingApprover.length} of ${activeVacations.length} active vacations have null/missing approver. ` +
    `IDs: ${missingApprover.map((v) => v.id).join(", ")}`,
  ).toBe(0);
});
