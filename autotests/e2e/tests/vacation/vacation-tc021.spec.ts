import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc021Data } from "../../data/vacation/VacationTc021Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { EmployeeRequestsPage } from "@ttt/pages/EmployeeRequestsPage";
import { DbClient } from "@ttt/config/db/dbClient";

/**
 * TC-VAC-021: Optional approver — approve.
 * SETUP: Creates vacation for pvaynmaster with an optional approver via API.
 * TEST: Login as optional approver → Agreement tab → approve → verify DB.
 * Optional approval is informational — doesn't change vacation status.
 */
test("TC-VAC-021: Optional approver — approve @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc021Data.create(
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
    // Step 1: Login as optional approver
    const login = new LoginFixture(
      page,
      tttConfig,
      data.optionalApproverLogin,
      globalConfig,
    );
    const logout = new LogoutFixture(page, tttConfig, globalConfig);

    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 2: Navigate to Employee Requests
    await page.goto(`${tttConfig.appUrl}/vacation/request`, {
      waitUntil: "domcontentloaded",
    });
    const requestsPage = new EmployeeRequestsPage(page);
    await requestsPage.waitForReady();

    // Step 3: Click Agreement sub-tab
    await requestsPage.clickAgreementTab();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "agreement-tab");

    // Step 4: Find the vacation request (match owner last name + period)
    const row = await requestsPage.waitForRequestRow(
      new RegExp(data.vacationOwnerLastName, "i"),
      data.periodPattern,
    );
    await expect(row.first()).toBeVisible();
    await verification.captureStep(testInfo, "vacation-found");

    // Step 5: Click agree (checkmark) on Agreement tab
    await requestsPage.agreeRequest(
      new RegExp(data.vacationOwnerLastName, "i"),
      data.periodPattern,
    );
    await globalConfig.delay();
    await verification.captureStep(testInfo, "optional-approved");

    // DB-CHECK: Verify optional approval status is APPROVED
    const db = new DbClient(tttConfig);
    try {
      const approvalRow = await db.queryOne<{ status: string }>(
        `SELECT va.status
         FROM ttt_vacation.vacation_approval va
         JOIN ttt_vacation.employee oa ON va.employee = oa.id
         WHERE va.vacation = $1
           AND oa.login = $2`,
        [vacationId, data.optionalApproverLogin],
      );
      expect(approvalRow.status).toBe("APPROVED");
    } finally {
      await db.close();
    }

    await logout.runViaDirectUrl();
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
