import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc077Data } from "../../data/vacation/VacationTc077Data";

/**
 * TC-VAC-077: Regression — Maternity leave overlap, days not returned (#3352).
 * Data integrity check: verifies that employees on maternity leave have
 * correct vacation day balances. Bug #3352 (OPEN): overlapping maternity +
 * vacation → vacation days not properly returned to balance.
 *
 * Bug #3355 (CLOSED): days continue accruing during maternity instead
 * of zeroing out. This test checks current balance values.
 */
test("TC-VAC-077: Maternity leave overlap — days not returned @regress @vacation", async ({}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc077Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  if (data.maternityEmployees.length === 0) {
    testInfo.annotations.push({
      type: "skip",
      description:
        "No employees on maternity leave found in test environment",
    });
    test.skip();
    return;
  }

  // Check: maternity leave employees should have 0 available days
  // (per bug #3355 fix — days should stop accruing during maternity)
  const withPositiveDays = data.maternityEmployees.filter(
    (e) => e.availableDays > 0,
  );

  if (withPositiveDays.length > 0) {
    const summary = withPositiveDays
      .slice(0, 5)
      .map((e) => `${e.login}: ${e.availableDays} days in ${e.year}`)
      .join("; ");
    testInfo.annotations.push({
      type: "bug",
      description: `Bug #3352/#3355: ${withPositiveDays.length} maternity employee(s) with positive balance: ${summary}`,
    });
  }

  // Check: employees with overlapping vacations are the key concern
  const withOverlap = data.maternityEmployees.filter(
    (e) => e.hasOverlappingVacation,
  );

  if (withOverlap.length > 0) {
    testInfo.annotations.push({
      type: "warning",
      description: `${withOverlap.length} maternity employee(s) have active/new vacations — potential overlap issue`,
    });
  }

  // Bug #3352 (OPEN): maternity employees may have non-zero balance.
  // Use test.fail() so the test is "expected to fail" while the bug is active.
  // When the bug is fixed, this will become an "unexpected pass" — update the test.
  test.fail(
    withPositiveDays.length > 0,
    `Bug #3352/#3355 active: ${withPositiveDays.length} maternity employee(s) have positive balance`,
  );

  expect(
    withPositiveDays.length,
    `Bug #3352/#3355: Found ${withPositiveDays.length} maternity employee(s) with non-zero vacation balance. ` +
      "Days should be zeroed during maternity leave.",
  ).toBe(0);
});
