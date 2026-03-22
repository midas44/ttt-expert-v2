import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc014Data } from "../data/VacationTc014Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-014 - Create cross-year vacation (December to January) @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc014Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const apiToken = tttConfig.apiToken;
  const clockUrl = tttConfig.buildUrl("/api/ttt/v1/test/clock");
  const authHeaders = { API_SECRET_TOKEN: apiToken };

  // SETUP: Set server clock to November 15 if needed (real month is Jan-Oct)
  if (data.needsClockChange && apiToken) {
    const patchResp = await page.request.patch(clockUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: { time: data.clockTime },
    });
    expect(
      patchResp.ok(),
      `Failed to set clock to ${data.clockTime}: ${patchResp.status()}`,
    ).toBeTruthy();
  }

  try {
    const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
    const mainFixture = new MainFixture(page, tttConfig, globalConfig);
    const navigation = new HeaderNavigationFixture(page, globalConfig);
    const verification = new VerificationFixture(page, globalConfig);
    const vacationsPage = new MyVacationsPage(page);
    const deletion = new VacationDeletionFixture(page, globalConfig);
    const logout = new LogoutFixture(page, tttConfig, globalConfig);

    // Step 1: Login
    await login.run();
    await mainFixture.ensureLanguage("EN");

    // Step 2: Navigate to My vacations and days off
    await navigation.navigate(
      "Calendar of absences > My vacations and days off",
    );
    await vacationsPage.waitForReady();

    // Step 3: Open create dialog
    const dialog = await vacationsPage.openCreateRequest();

    // Step 4-5: Set Dec→Jan dates
    await dialog.fillVacationPeriod(data.startDate, data.endDate);
    await globalConfig.delay();

    // Step 6: Verify "Number of days" auto-calculates
    const numberOfDays = await dialog.getNumberOfDays();
    expect(
      parseInt(numberOfDays, 10),
      `Cross-year vacation should have >0 working days, got: "${numberOfDays}"`,
    ).toBeGreaterThan(0);

    // Screenshot: dialog filled with cross-year dates
    await verification.verifyLocatorVisible(
      dialog.root(),
      testInfo,
      "dialog-cross-year-filled",
    );

    // Step 7: Submit
    await dialog.submit();

    // Wait for dialog to close (indicates success)
    await dialog.root().waitFor({ state: "detached", timeout: 10000 });
    await globalConfig.delay();

    // Step 8: Verify vacation created — find the row by period pattern
    const row = await vacationsPage.waitForVacationRow(data.periodPattern);
    await expect(row).toHaveCount(1);

    // Verify row shows Status = "New"
    const statusCell = await vacationsPage.columnCell(
      data.periodPattern,
      "Status",
    );
    await expect(statusCell).toContainText(/new/i);

    // Step 9: Verify cross-year span — the vacation dates column references both years
    const datesCell = await vacationsPage.columnCell(
      data.periodPattern,
      "Vacation dates",
    );
    const datesText = (await datesCell.textContent()) ?? "";
    expect(
      datesText,
      `Expected cross-year dates spanning ${data.startYear} and ${data.endYear}`,
    ).toMatch(new RegExp(`${data.startYear}.*${data.endYear}`));

    // Verify the "Regular days" column shows the day count
    const regularCell = await vacationsPage.columnCell(
      data.periodPattern,
      "Regular",
    );
    const regularText = (await regularCell.textContent()) ?? "0";
    const totalDays = parseInt(regularText.trim(), 10);
    expect(
      totalDays,
      `Cross-year vacation should span multiple working days, got: ${regularText}`,
    ).toBeGreaterThan(0);

    // Screenshot: vacation row in table
    await verification.verifyLocatorVisible(
      row.first(),
      testInfo,
      "vacation-row-cross-year",
    );

    // Cleanup: delete the created vacation
    await deletion.deleteVacation({
      startInput: data.startDate,
      endInput: data.endDate,
      periodPattern: data.periodPattern,
    });

    // Logout
    await logout.runViaDirectUrl();
  } finally {
    // Always reset clock to avoid affecting other tests
    if (data.needsClockChange && apiToken) {
      await page.request
        .post(`${clockUrl}/reset`, { headers: authHeaders })
        .catch(() => {});
    }
  }

  await page.close();
});
