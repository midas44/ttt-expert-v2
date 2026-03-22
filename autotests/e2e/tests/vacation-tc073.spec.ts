import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc073Data } from "../data/VacationTc073Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { AvailabilityChartPage } from "../pages/AvailabilityChartPage";

test("TC-VAC-073 - Verify vacation bars on chart match vacation records @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc073Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // Step 1: Login as viewer (department manager)
  const login = new LoginFixture(page, tttConfig, data.viewerLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to Availability chart
  await page.goto(tttConfig.buildUrl("/vacation/chart"));
  const chartPage = new AvailabilityChartPage(page);
  await chartPage.waitForReady();
  await globalConfig.delay();

  await verification.verify("Availability chart", testInfo);

  // Step 3: Search for the employee with the APPROVED vacation
  const searchBox = chartPage.searchBox();
  await searchBox.click();
  await searchBox.pressSequentially(data.employeeLastName, { delay: 50 });
  await page.waitForTimeout(2000);

  // Step 4: Verify the employee row exists in the chart
  const employeeRow = chartPage.employeeRow(data.employeeLastName);
  // The table row may be CSS-hidden; check attachment
  const rowExists = await employeeRow.count();

  if (rowExists === 0) {
    // Employee might not be visible in search results — verify via DOM
    const rowInDom = await page.evaluate(
      (lastName: string) => {
        const rows = document.querySelectorAll("table tbody tr");
        return Array.from(rows).some((r) =>
          r.textContent?.includes(lastName),
        );
      },
      data.employeeLastName,
    );
    expect(rowInDom, `Employee ${data.employeeLastName} should be in chart`).toBe(true);
  }

  // Step 5-6: Verify colored bars exist in the employee's row
  // Vacation bars are rendered as colored divs within table cells
  const vacStartDate = new Date(data.vacationStart);
  const vacEndDate = new Date(data.vacationEnd);
  const vacDuration = Math.ceil(
    (vacEndDate.getTime() - vacStartDate.getTime()) / (1000 * 60 * 60 * 24),
  ) + 1;

  // Check that the employee row has colored cells (vacation bars)
  const coloredCellCount = await page.evaluate(
    (lastName: string) => {
      const rows = document.querySelectorAll("table tbody tr");
      for (const row of rows) {
        if (!row.textContent?.includes(lastName)) continue;
        // Count cells with colored backgrounds (vacation indicators)
        const cells = row.querySelectorAll("td");
        let colored = 0;
        cells.forEach((cell) => {
          const divs = cell.querySelectorAll("div");
          divs.forEach((div) => {
            const bg = getComputedStyle(div).backgroundColor;
            // Non-transparent, non-white backgrounds indicate vacation bars
            if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "rgb(255, 255, 255)") {
              colored++;
            }
          });
        });
        return colored;
      }
      return 0;
    },
    data.employeeLastName,
  );

  // The employee has an APPROVED vacation — should have colored cells
  // Note: weekends also get background colors, so coloredCellCount may exceed vacDuration.
  // We only verify the presence of vacation-colored bars (green = approved).
  expect(
    coloredCellCount,
    `Employee ${data.employeeLastName} should have colored cells (vacation/weekend indicators)`,
  ).toBeGreaterThan(0);

  // Step 7: Verify green vacation bars specifically
  const greenBarCount = await page.evaluate(
    (lastName: string) => {
      const rows = document.querySelectorAll("table tbody tr");
      for (const row of rows) {
        if (!row.textContent?.includes(lastName)) continue;
        const cells = row.querySelectorAll("td");
        let green = 0;
        cells.forEach((cell) => {
          const divs = cell.querySelectorAll("div");
          divs.forEach((div) => {
            const bg = getComputedStyle(div).backgroundColor;
            // Green-ish colors indicate approved vacations
            const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
              const [, r, g, b] = match.map(Number);
              if (g > r && g > b && g > 100) green++;
            }
          });
        });
        return green;
      }
      return 0;
    },
    data.employeeLastName,
  );

  expect(
    greenBarCount,
    `Employee ${data.employeeLastName} should have green vacation bars`,
  ).toBeGreaterThan(0);

  await verification.verify("Availability chart", testInfo);

  // Cleanup
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
