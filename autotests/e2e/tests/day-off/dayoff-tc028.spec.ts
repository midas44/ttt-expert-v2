import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc028Data } from "../../data/day-off/DayoffTc028Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../../pages/DayOffRequestPage";
import { WeekendDetailsModal } from "../../pages/WeekendDetailsModal";

/**
 * TC-DO-028: Reject then re-approve flow.
 *
 * A REJECTED request can be re-approved by the manager via the
 * WeekendDetailsModal on the My department tab.
 * Approvable statuses: NEW, REJECTED.
 */
test("TC-DO-028: Reject then re-approve flow @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc028Data.create(
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

  // Match by BOTH employee name AND personalDate to uniquely identify our request.
  const employeeLastName = data.employeeName.split(" ")[0];
  const employeePattern = new RegExp(employeeLastName, "i");
  const [y, m, d] = data.personalDate.split("-");
  const datePattern = new RegExp(`${d}\\.${m}\\.${y}`);

  try {
    // Step 1: Login as manager
    await login.run();

    // Step 2: Navigate to My department tab (shows all statuses)
    await requestPage.gotoMyDepartment(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Find the REJECTED request by employee + personalDate
    const row = requestPage.requestRowMulti(employeePattern, datePattern).first();
    await expect(
      row,
      `Should see REJECTED request for ${employeeLastName} on ${data.personalDate}`,
    ).toBeVisible({ timeout: 15_000 });
    await verification.captureStep(testInfo, "rejected-request-visible");

    // Step 4: Open modal via info button
    await requestPage.clickInfoOnRow(row);
    await modal.waitForOpen();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "modal-opened-rejected");

    // Step 5: Verify Approve button is visible (REJECTED is re-approvable)
    expect(
      await modal.isApproveVisible(),
      "Approve button should be visible for REJECTED request",
    ).toBeTruthy();

    // Step 6: Click Approve inside the modal
    const approveResponse = page.waitForResponse(
      (resp) => resp.url().includes("dayOff") && resp.status() < 400,
      { timeout: 15_000 },
    );
    await modal.clickApprove();
    await approveResponse;

    // Step 7: Modal should close after approval
    await modal.waitForClose();
    await globalConfig.delay();

    // Step 8: Reload and verify status changed to APPROVED
    await requestPage.gotoMyDepartment(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    const updatedRow = requestPage.requestRowMulti(employeePattern, datePattern).first();
    await updatedRow
      .locator("td", { hasText: /approved|подтвержден/i })
      .waitFor({ state: "visible", timeout: 15_000 });
    await verification.captureStep(testInfo, "request-re-approved");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
