import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc023Data } from "../../data/day-off/DayoffTc023Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../../pages/DayOffRequestPage";

/**
 * TC-DO-023: Action buttons on APPROVED request — only info visible.
 *
 * Manager navigates to "My department" tab, finds an APPROVED request,
 * and verifies that only the info (i) button is shown — no approve,
 * reject, or redirect buttons.
 */
test("TC-DO-023: Only info button visible on APPROVED request @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc023Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const requestPage = new DayOffRequestPage(page);

  try {
    // Step 1: Login as manager
    await login.run();

    // Step 2: Navigate to My department tab
    await requestPage.gotoMyDepartment(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "my-department-loaded");

    // Step 3: Find the APPROVED request row by employee name
    const row = requestPage.requestRow(data.employeePattern);
    await expect(
      row.first(),
      `Should see APPROVED request from ${data.employeeLogin}`,
    ).toBeVisible({ timeout: 15_000 });

    // Step 4: Verify only info button is present
    const hasInfo = await requestPage.hasInfoButton(data.employeePattern);
    expect(hasInfo, "Info button should be present on APPROVED request").toBeTruthy();

    // Step 5: Verify approve, reject, redirect are NOT present
    const hasApprove = await requestPage.hasApproveButton(data.employeePattern);
    const hasReject = await requestPage.hasRejectButton(data.employeePattern);
    const hasRedirect = await requestPage.hasRedirectButton(data.employeePattern);

    expect(hasApprove, "Approve button should NOT be on APPROVED request").toBeFalsy();
    expect(hasReject, "Reject button should NOT be on APPROVED request").toBeFalsy();
    expect(hasRedirect, "Redirect button should NOT be on APPROVED request").toBeFalsy();

    await verification.captureStep(testInfo, "approved-only-info-button");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
