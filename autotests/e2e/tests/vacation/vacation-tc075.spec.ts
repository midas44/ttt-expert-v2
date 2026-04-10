import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc075Data } from "../../data/vacation/VacationTc075Data";

/**
 * TC-VAC-075: Regression — Double accrual on salary office change (#2789).
 * Data integrity check: verifies no employee has duplicate employee_vacation
 * entries for the same year. Bug #2789 (OPEN): salary office change
 * creates duplicate year entries, doubling accrued vacation days.
 *
 * This test queries the DB directly — no UI interaction needed.
 * If duplicates are found, the bug is active.
 */
test("TC-VAC-075: Double accrual on salary office change @regress @vacation", async ({}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc075Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  if (data.duplicates.length > 0) {
    // Bug #2789 is active — document the affected employees
    const summary = data.duplicates
      .slice(0, 5)
      .map((d) => `${d.login} year=${d.year} count=${d.count}`)
      .join("; ");
    testInfo.annotations.push({
      type: "bug",
      description: `Bug #2789 active: ${data.duplicates.length} employee(s) with duplicate year entries. Examples: ${summary}`,
    });
  }

  // Assert: no duplicate year entries should exist
  // Bug #2789 (OPEN): this assertion will fail if duplicates exist,
  // confirming the bug is still present in the environment.
  expect(
    data.duplicates.length,
    `Bug #2789: Found ${data.duplicates.length} employee(s) with duplicate employee_vacation year entries. ` +
      "This indicates double accrual on salary office change.",
  ).toBe(0);
});
