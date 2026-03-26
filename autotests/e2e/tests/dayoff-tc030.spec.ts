import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { DayoffTc030Data } from "../data/DayoffTc030Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../pages/DayOffRequestPage";

/**
 * TC-DO-030: CPO self-approval (PROJECT role).
 *
 * CPO/department managers are auto-assigned as their own approver.
 * They can see their own request on the Approval tab and self-approve it.
 */
test("TC-DO-030: CPO self-approval @regress", async ({ page }, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc030Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.cpoLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const requestPage = new DayOffRequestPage(page);

  // Use personalDate to identify the request row (unique working day).
  const [y, m, d] = data.personalDate.split("-");
  const datePattern = new RegExp(`${d}\\.${m}\\.${y}`);

  try {
    // Step 1: Login as CPO employee
    await login.run();

    // Step 2: Navigate to the approval page (CPO should see own request)
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Find own request in the approval queue by personalDate
    const row = requestPage.requestRow(datePattern);
    await expect(
      row.first(),
      "CPO should see own request in Approval tab",
    ).toBeVisible({ timeout: 15_000 });
    await verification.captureStep(testInfo, "own-request-in-approval");

    // Step 4: Approve own request
    const approveResponse = page.waitForResponse(
      (resp) => resp.url().includes("dayOff") && resp.status() < 400,
      { timeout: 15_000 },
    );
    await requestPage.clickApprove(datePattern);
    await approveResponse;
    await globalConfig.delay();

    // Step 5: Verify request disappeared from Approval tab (now APPROVED)
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    await expect(
      requestPage.requestRow(datePattern).first(),
    ).not.toBeVisible({ timeout: 10_000 });
    await verification.captureStep(testInfo, "self-approved");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
