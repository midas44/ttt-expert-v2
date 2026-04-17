import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc058Data } from "../../data/vacation/VacationTc058Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { VacationCreationFixture } from "@ttt/fixtures/VacationCreationFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-058: AV=true — negative balance allowed for current year.
 *
 * SETUP: Creates N × 4-week vacations via API as pvaynmaster (AV=true, CPO)
 * to consume most of the ~82-day balance, leaving < 5 days.
 * TEST: Creates one more 1-week vacation via UI → verifies system allows it
 * (AV=true permits negative balance for current year).
 */
test("TC-VAC-058: AV=true — negative balance allowed for current year @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(240_000); // Extended timeout for multi-vacation setup

  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc058Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const createdIds: number[] = [];

  try {
    // SETUP: Create+approve N × 4-week vacations via API to consume balance
    // Must approve to avoid "overdue vacation" block on new creation
    for (const slot of data.setupSlots) {
      const vac = await setup.createAndApprove(slot.start, slot.end, "REGULAR");
      createdIds.push(vac.id);
    }

    // Step 1: Login as pvaynmaster (AV=true employee)
    const login = new LoginFixture(
      page,
      tttConfig,
      data.username,
      globalConfig,
    );
    const verification = new VerificationFixture(page, globalConfig);

    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 2: Navigate to /vacation/my
    await page.goto(`${tttConfig.appUrl}/vacation/my`, {
      waitUntil: "domcontentloaded",
    });
    const vacationsPage = new MyVacationsPage(page);
    await vacationsPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Check available days — should be low after setup vacations consumed balance
    const daysBeforeUi = await vacationsPage.getAvailableDaysSigned();
    await verification.captureStep(testInfo, "balance-after-setup");

    // Step 4-5: Create one more vacation via UI (would push balance negative)
    const creationFixture = new VacationCreationFixture(
      page,
      tttConfig,
      globalConfig,
    );
    await creationFixture.ensureOnPage();
    const periodPattern = toPeriodPattern(data.uiSlot.start, data.uiSlot.end);
    await creationFixture.createVacation({
      startInput: data.uiStartInput,
      endInput: data.uiEndInput,
      periodPattern,
    });
    await globalConfig.delay();

    // Step 6: Verify creation succeeded (AV=true permits negative balance)
    const row = vacationsPage.vacationRow(periodPattern);
    await expect(row.first()).toBeVisible({ timeout: 10_000 });
    await verification.captureStep(testInfo, "vacation-created-negative");

    // Step 7: Verify available days counter decreased
    const daysAfterUi = await vacationsPage.getAvailableDaysSigned();
    expect(daysAfterUi).toBeLessThan(daysBeforeUi);
    await verification.captureStep(testInfo, "final-balance");

    // Logout
    const logout = new LogoutFixture(page, tttConfig, globalConfig);
    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    // CLEANUP: Delete all created vacations (setup + UI-created)
    // Find the UI-created vacation by dates
    try {
      const { DbClient } = await import("@ttt/config/db/dbClient");
      const db = new DbClient(tttConfig);
      try {
        const vacRow = await db
          .queryOne<{ id: number }>(
            `SELECT v.id
             FROM ttt_vacation.vacation v
             JOIN ttt_vacation.employee e ON v.employee = e.id
             WHERE e.login = $1
               AND v.start_date = $2::date
               AND v.end_date = $3::date
               AND v.status NOT IN ('DELETED')
             ORDER BY v.id DESC
             LIMIT 1`,
            [data.username, data.uiSlot.start, data.uiSlot.end],
          )
          .catch(() => null);
        if (vacRow) createdIds.push(vacRow.id);
      } finally {
        await db.close();
      }
    } catch {
      /* best-effort */
    }

    for (const id of createdIds) {
      try {
        await setup.deleteVacation(id);
      } catch {
        /* best-effort */
      }
    }
  }
});

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}
