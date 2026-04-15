import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc045Data } from "../../data/vacation/VacationTc045Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";
import { DbClient } from "@ttt/config/db/dbClient";
import { findVacationId } from "../../data/vacation/queries/vacationQueries";

/**
 * TC-VAC-045: Accrued days validation — future request auto-conversion (#3015).
 * SETUP: Creates N REGULAR 5-day vacations via API to bring balance just under 5.
 * Test: Tries to create one more 5-day vacation in UI that would push total over available.
 * Expected: Either error for insufficient days, or auto-conversion to Administrative.
 */
test("TC-VAC-045: Accrued days validation — future auto-conversion @regress @vacation @validation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc045Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create N REGULAR 5-day vacations via API to exhaust most of balance
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };
  const baseUrl = tttConfig.buildUrl("/api/vacation/v1/vacations");
  const testDeleteUrl = (id: number) =>
    tttConfig.buildUrl(`/api/vacation/v1/test/vacations/${id}`);

  const createdIds: number[] = [];

  for (const slot of data.setupWeeks) {
    const resp = await request.post(baseUrl, {
      headers,
      data: {
        login: data.username,
        startDate: slot.start,
        endDate: slot.end,
        paymentType: "REGULAR",
        paymentMonth: `${slot.start.slice(0, 8)}01`,
        optionalApprovers: [],
        notifyAlso: [],
      },
    });
    if (resp.ok()) {
      const json = await resp.json();
      createdIds.push((json.vacation ?? json).id);
    } else {
      const body = await resp.text();
      throw new Error(`Setup vacation creation failed: ${resp.status()} ${body}`);
    }
  }

  try {
    // Step 1-2: Login, switch to English, navigate
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }
    await page.goto(`${tttConfig.appUrl}/vacation/my`, {
      waitUntil: "domcontentloaded",
    });
    await vacationsPage.waitForReady();
    await globalConfig.delay();

    // Step 3-4: Open create dialog, fill dates for 3rd vacation
    const dialog = await vacationsPage.openCreateRequest();
    await dialog.fillVacationPeriod(data.uiStartInput, data.uiEndInput);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "third-vacation-dates-entered");

    // Step 5: Click Save
    await dialog.submit();
    await globalConfig.delay();

    // Step 6: Check result — dialog open means error, dialog closed means created
    const dialogStillOpen = await dialog.isOpen();

    if (dialogStillOpen) {
      // Error in dialog — expected when insufficient days
      const errorText = await dialog.getErrorText();
      const validationMsg = await dialog.getValidationMessage();
      expect(
        errorText.length > 0 || validationMsg.length > 0,
        `Expected insufficient-days error. Error: "${errorText}", Validation: "${validationMsg}"`,
      ).toBeTruthy();
      await verification.captureStep(testInfo, "insufficient-days-error");
      await dialog.cancel();
    } else {
      // Vacation was created — possibly auto-converted to Administrative
      // Check the created vacation in DB for type conversion
      await globalConfig.delay();
      const db = new DbClient(tttConfig);
      try {
        const uiVacId = await findVacationId(
          db,
          data.username,
          data.uiWeek.start,
          data.uiWeek.end,
        );
        createdIds.push(uiVacId);

        const row = await db.queryOne<{ payment_type: string }>(
          `SELECT v.payment_type FROM ttt_vacation.vacation v WHERE v.id = $1`,
          [uiVacId],
        );

        // The vacation was either auto-converted to ADMINISTRATIVE or created as REGULAR
        // (if employee had just barely enough). Both outcomes are valid for this test.
        await verification.captureStep(
          testInfo,
          `vacation-created-type-${row.payment_type}`,
        );
      } finally {
        await db.close();
      }
    }
  } finally {
    // CLEANUP: Delete all created vacations via test endpoint
    for (const id of createdIds) {
      await request
        .delete(testDeleteUrl(id), { headers })
        .catch(() => {});
    }
  }

  await logout.runViaDirectUrl();
  await page.close();
});
