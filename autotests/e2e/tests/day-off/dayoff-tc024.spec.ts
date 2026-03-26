import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { DayoffTc024Data } from "../data/DayoffTc024Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../pages/DayOffRequestPage";
import { WeekendDetailsModal } from "../pages/WeekendDetailsModal";

/**
 * TC-DO-024: View request details in WeekendDetailsModal.
 *
 * Manager opens the info modal for a NEW dayoff transfer request
 * and verifies all fields are displayed: employee name, transfer date,
 * status, and optional approvers section.
 */
test("TC-DO-024: View request details in WeekendDetailsModal @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc024Data.create(
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
  const modal = new WeekendDetailsModal(page);

  try {
    // Step 1: Login as manager
    await login.run();

    // Step 2: Navigate to the dayoff approval page
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Click the info button on the employee's request row
    await requestPage.clickInfo(data.employeePattern);
    await modal.waitForOpen();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "modal-opened");

    // Step 4: Verify modal displays employee name (last name match)
    const dialogText = await modal.getDialogText();
    const lastName = data.employeeName.split(" ")[0];
    expect(
      dialogText,
      `Modal should contain employee last name "${lastName}"`,
    ).toContain(lastName);

    // Step 5: Verify modal displays the transfer date (YYYY-MM-DD format)
    expect(
      dialogText,
      "Modal should show personal/transfer date",
    ).toContain(data.personalDate);

    // Step 6: Verify status is shown (New / На подтверждении)
    expect(dialogText.toLowerCase(), "Modal should show status").toMatch(
      /new|на подтверждении/,
    );

    // Step 7: Verify action buttons are present (Approve/Reject/Redirect)
    expect(
      await modal.isApproveVisible(),
      "Approve button should be visible",
    ).toBeTruthy();
    expect(
      await modal.isRejectVisible(),
      "Reject button should be visible",
    ).toBeTruthy();
    expect(
      await modal.isRedirectVisible(),
      "Redirect button should be visible",
    ).toBeTruthy();

    // Step 8: Verify optional approvers section is present
    const hasEditList = await modal.isEditListVisible();
    expect(
      hasEditList,
      "Edit list button should be visible for NEW requests",
    ).toBeTruthy();
    await verification.captureStep(testInfo, "modal-fields-verified");

    // Step 9: Close modal
    await modal.clickClose();
    await modal.waitForClose();
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
