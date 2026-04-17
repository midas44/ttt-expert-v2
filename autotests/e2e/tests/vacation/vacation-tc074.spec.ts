import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc074Data } from "../../data/vacation/VacationTc074Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { EmployeeRequestsPage } from "@ttt/pages/EmployeeRequestsPage";
import { DbClient } from "@ttt/config/db/dbClient";

/**
 * TC-VAC-074: Regression — Redirected request status not reset (#2718).
 * SETUP: API creates a NEW vacation for a subordinate of pvaynmaster.
 * Test: Login as pvaynmaster, navigate to Employee Requests, find the request,
 * redirect to an alternative manager, verify approver change and DB status.
 * Bug #2718 (OPEN): After redirect, status should reset to NEW but may stay unchanged.
 */
test("TC-VAC-074: Redirected request status not reset (#2718) @regress @vacation @regression", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc074Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(
    page,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const requestsPage = new EmployeeRequestsPage(page);

  // SETUP: Create a NEW vacation for the subordinate via API
  const paymentMonth = `${data.startDateIso.slice(0, 8)}01`;
  const createResp = await request.post(
    tttConfig.buildUrl("/api/vacation/v1/vacations"),
    {
      headers: {
        API_SECRET_TOKEN: tttConfig.apiToken,
        "Content-Type": "application/json",
      },
      data: {
        login: data.employeeLogin,
        startDate: data.startDateIso,
        endDate: data.endDateIso,
        paymentType: "REGULAR",
        paymentMonth,
        optionalApprovers: [],
        notifyAlso: [],
      },
    },
  );

  let vacationId: number;
  let vacationCreatedFor: string;
  if (createResp.ok()) {
    const json = await createResp.json();
    const vac = json.vacation ?? json;
    vacationId = vac.id;
    vacationCreatedFor = vac.login ?? data.employeeLogin;
  } else {
    // Fallback: create as pvaynmaster (token owner)
    const vacation = await setup.createVacation(
      data.startDateIso,
      data.endDateIso,
    );
    vacationId = vacation.id;
    vacationCreatedFor = setup.tokenOwner;
  }

  try {
    // Step 1: Login as pvaynmaster (the approver)
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 2: Navigate to Employee Requests page
    await page.goto(`${tttConfig.appUrl}/vacation/request`, {
      waitUntil: "domcontentloaded",
    });
    await requestsPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Click Approval tab to see pending requests
    await requestsPage.clickApprovalTab();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "approval-tab-loaded");

    // Step 4: Find the vacation row — try period pattern only (more reliable with pagination)
    // Search across pages if needed
    let foundOnPage = false;
    for (let pageNum = 0; pageNum < 3 && !foundOnPage; pageNum++) {
      if (pageNum > 0) {
        // Navigate to next page
        const nextBtn = page
          .getByRole("navigation")
          .getByRole("button", { name: /next|›/i });
        if (
          (await nextBtn.count()) > 0 &&
          (await nextBtn.isEnabled().catch(() => false))
        ) {
          await nextBtn.click();
          await page.waitForLoadState("networkidle");
          await globalConfig.delay();
        } else {
          break;
        }
      }

      const row = requestsPage.requestRow(data.periodPattern);
      if ((await row.count()) > 0) {
        foundOnPage = true;
      }
    }

    expect(
      foundOnPage,
      `Vacation row with period ${data.periodPattern} not found in Approval tab (checked up to 3 pages)`,
    ).toBeTruthy();

    // Step 5: Verify redirect button is available
    const hasRedirect = await requestsPage.hasRedirectButton(
      data.periodPattern,
    );
    expect(
      hasRedirect,
      "Redirect button should be available on NEW vacation",
    ).toBeTruthy();
    await verification.captureStep(testInfo, "redirect-button-visible");

    // Step 6: Click redirect and select alternative manager
    await requestsPage.redirectRequest(data.periodPattern);
    await globalConfig.delay();
    await requestsPage.selectRedirectTarget(data.altManagerName);
    await globalConfig.delay();
    await requestsPage.confirmRedirect();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "redirect-confirmed");

    // Step 7: DB-CHECK — verify the vacation's approver changed and status
    const db = new DbClient(tttConfig);
    try {
      const dbRow = await db.queryOne<{
        status: string;
        approver_login: string;
      }>(
        `SELECT v.status,
                approver_emp.login AS approver_login
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee approver_emp ON v.approver = approver_emp.id
         WHERE v.id = $1`,
        [vacationId],
      );

      // Approver should have changed to the alternative manager
      expect(
        dbRow.approver_login,
        `Approver should be changed to ${data.altManagerLogin}`,
      ).toBe(data.altManagerLogin);

      // Status should be NEW — redirect of a NEW vacation keeps it NEW
      expect(dbRow.status, "Status should remain NEW after redirect").toBe(
        "NEW",
      );

      await verification.captureStep(testInfo, "db-verification-passed");
    } finally {
      await db.close();
    }
  } finally {
    // CLEANUP: Delete the vacation via test endpoint
    await setup.deleteVacation(vacationId);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
