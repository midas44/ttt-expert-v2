import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc022Data } from "../../data/vacation/VacationTc022Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";
import { EmployeeRequestsPage } from "../../pages/EmployeeRequestsPage";
import { DbClient } from "../../config/db/dbClient";

/**
 * TC-VAC-022: Approval resets on date edit.
 * SETUP: Creates vacation with optional approver via API.
 * Phase 1: OA logs in → Agreement tab → approves.
 * Phase 2: Vacation owner logs in → edits dates.
 * DB-CHECK: vacation_approval.status resets from APPROVED to ASKED.
 */
test("TC-VAC-022: Approval resets on date edit @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc022Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);

  // SETUP: Create vacation with optional approver via direct API call
  const paymentMonth = `${data.startDateIso.slice(0, 8)}01`;
  const createUrl = tttConfig.buildUrl("/api/vacation/v1/vacations");
  const createResp = await request.post(createUrl, {
    headers: {
      API_SECRET_TOKEN: tttConfig.apiToken,
      "Content-Type": "application/json",
    },
    data: {
      login: data.vacationOwner,
      startDate: data.startDateIso,
      endDate: data.endDateIso,
      paymentType: "REGULAR",
      paymentMonth,
      optionalApprovers: [data.optionalApproverLogin],
      notifyAlso: [],
    },
  });

  expect(
    createResp.ok(),
    `Failed to create vacation: ${createResp.status()}`,
  ).toBe(true);
  const createJson = await createResp.json();
  const vacation = createJson.vacation ?? createJson;
  const vacationId = vacation.id;

  try {
    // ── Phase 1: OA logs in and approves on Agreement tab ──
    const oaLogin = new LoginFixture(
      page,
      tttConfig,
      data.optionalApproverLogin,
      globalConfig,
    );
    const oaLogout = new LogoutFixture(page, tttConfig, globalConfig);

    await oaLogin.run();
    const mainPageOa = new MainPage(page);
    if ((await mainPageOa.getCurrentLanguage()) !== "EN") {
      await mainPageOa.setLanguage("EN");
      await globalConfig.delay();
    }

    await page.goto(`${tttConfig.appUrl}/vacation/request`, {
      waitUntil: "domcontentloaded",
    });
    const requestsPage = new EmployeeRequestsPage(page);
    await requestsPage.waitForReady();
    await requestsPage.clickAgreementTab();
    await globalConfig.delay();

    // Find and approve the vacation request
    await requestsPage.agreeRequest(
      new RegExp(data.vacationOwnerLastName, "i"),
      data.periodPattern,
    );
    await globalConfig.delay();
    await verification.captureStep(testInfo, "oa-approved");

    // Verify OA approval is APPROVED in DB
    const db1 = new DbClient(tttConfig);
    try {
      const approvalRow = await db1.queryOne<{ status: string }>(
        `SELECT va.status
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee oa ON va.employee = oa.id
         WHERE va.vacation = $1
           AND oa.login = $2`,
        [vacationId, data.optionalApproverLogin],
      );
      expect(approvalRow.status).toBe("APPROVED");
    } finally {
      await db1.close();
    }

    await oaLogout.runViaDirectUrl();
    await globalConfig.delay();

    // ── Phase 2: Owner logs in using a NEW browser context ──
    // CAS SSO session persists in the same context, so we need isolation.
    const ownerContext = await page.context().browser()!.newContext();
    const ownerPage = await ownerContext.newPage();
    await globalConfig.applyViewport(ownerPage);

    try {
      const ownerLogin = new LoginFixture(
        ownerPage,
        tttConfig,
        data.vacationOwner,
        globalConfig,
      );
      const ownerVerification = new VerificationFixture(
        ownerPage,
        globalConfig,
      );
      const ownerLogout = new LogoutFixture(ownerPage, tttConfig, globalConfig);

      await ownerLogin.run();
      const mainPageOwner = new MainPage(ownerPage);
      if ((await mainPageOwner.getCurrentLanguage()) !== "EN") {
        await mainPageOwner.setLanguage("EN");
        await globalConfig.delay();
      }

      await ownerPage.goto(`${tttConfig.appUrl}/vacation/my`, {
        waitUntil: "domcontentloaded",
      });
      const vacationsPage = new MyVacationsPage(ownerPage);
      await vacationsPage.waitForReady();

      // Find and edit the vacation
      await vacationsPage.waitForVacationRow(data.periodPattern);
      const dialog = await vacationsPage.openEditDialog(data.periodPattern);
      await dialog.fillVacationPeriod(data.startInput, data.newEndInput);
      await globalConfig.delay();
      await ownerVerification.captureStep(testInfo, "edit-dialog-new-dates");

      await dialog.submit();
      await dialog
        .root()
        .waitFor({ state: "detached", timeout: 15_000 })
        .catch(() => {});
      await globalConfig.delay();

      // Verify updated row appears
      const updatedRow = await vacationsPage.waitForVacationRow(
        data.newPeriodPattern,
      );
      await expect(updatedRow.first()).toBeVisible();
      await ownerVerification.captureStep(testInfo, "vacation-dates-edited");

      // DB-CHECK: vacation_approval.status should reset to ASKED
      const db2 = new DbClient(tttConfig);
      try {
        const resetRow = await db2.queryOne<{ status: string }>(
          `SELECT va.status
           FROM ttt_vacation.vacation_approval va
           JOIN ttt_vacation.employee oa ON va.employee = oa.id
           WHERE va.vacation = $1
             AND oa.login = $2`,
          [vacationId, data.optionalApproverLogin],
        );
        expect(resetRow.status).toBe("ASKED");
      } finally {
        await db2.close();
      }

      await ownerLogout.runViaDirectUrl();
    } finally {
      await ownerPage.close();
      await ownerContext.close();
    }
    await page.close();
  } finally {
    // CLEANUP: Delete the vacation
    try {
      await setup.deleteVacation(vacationId);
    } catch {
      /* best-effort */
    }
  }
});
