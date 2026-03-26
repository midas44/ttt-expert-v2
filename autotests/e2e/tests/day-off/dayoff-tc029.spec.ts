import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc029Data } from "../../data/day-off/DayoffTc029Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../../pages/DayOffRequestPage";
import { WeekendDetailsModal } from "../../pages/WeekendDetailsModal";

/**
 * TC-DO-029: Approve then reject an approved request.
 *
 * An APPROVED request with future personalDate can be rejected by the
 * manager via the WeekendDetailsModal on the My department tab.
 * Rejectable statuses: NEW, APPROVED (when personalDate >= report period start).
 */
test("TC-DO-029: Approve then reject an approved request @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc029Data.create(
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

    // Step 3: Find the APPROVED request by employee + personalDate
    const row = requestPage.requestRowMulti(employeePattern, datePattern).first();
    await expect(
      row,
      `Should see request for ${employeeLastName} on ${data.personalDate}`,
    ).toBeVisible({ timeout: 15_000 });
    await verification.captureStep(testInfo, "approved-request-visible");

    // Step 4: Open modal via info button
    await requestPage.clickInfoOnRow(row);
    await modal.waitForOpen();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "modal-opened-approved");

    // Step 5: Verify Reject button is visible and enabled
    expect(
      await modal.isRejectVisible(),
      "Reject button should be visible for APPROVED request",
    ).toBeTruthy();
    expect(
      await modal.isRejectEnabled(),
      "Reject button should be enabled",
    ).toBeTruthy();

    // Step 6: Click Reject — filter for non-GET to capture actual mutation
    const rejectResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("dayOff") &&
        resp.request().method() !== "GET" &&
        resp.status() < 400,
      { timeout: 15_000 },
    );
    await modal.clickReject();
    await rejectResponse;

    // Step 7: Modal should close after rejection
    await modal.waitForClose();
    await globalConfig.delay();

    // Step 8: Reopen modal and verify status changed to REJECTED
    // (My department tab uses timeline-based display which may lag behind DB)
    await requestPage.gotoMyDepartment(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    const updatedRow = requestPage.requestRowMulti(employeePattern, datePattern).first();
    await expect(updatedRow).toBeVisible({ timeout: 15_000 });
    await requestPage.clickInfoOnRow(updatedRow);
    await modal.waitForOpen();
    await globalConfig.delay();

    const dialogText = await modal.getDialogText();
    expect(
      dialogText.toLowerCase(),
    ).toMatch(/rejected|отклонен/i);
    await verification.captureStep(testInfo, "request-rejected-from-approved");

    await modal.clickClose();
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
