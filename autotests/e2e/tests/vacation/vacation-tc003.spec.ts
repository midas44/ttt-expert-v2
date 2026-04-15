import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc003Data } from "../../data/vacation/VacationTc003Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-003: Create vacation with comment.
 * Verifies that a comment typed during vacation creation is persisted
 * and visible in the Request Details dialog.
 */
test("TC-VAC-003: Create vacation with comment @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc003Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

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

  // Step 3-5: Open creation dialog, fill dates, add comment
  const dialog = await vacationsPage.openCreateRequest();
  await dialog.fillVacationPeriod(data.startInput, data.endInput);
  await globalConfig.delay();
  await dialog.fillComment(data.comment);
  await dialog.assertNoRedText();
  await verification.captureStep(testInfo, "dialog-with-comment");

  // Step 6: Submit
  await dialog.submit();
  await globalConfig.delay();

  // Step 7: Verify vacation created with status New
  const row = await vacationsPage.waitForVacationRow(data.periodPattern);
  await expect(row).toHaveCount(1);
  const status = await vacationsPage.columnValue(data.periodPattern, "Status");
  expect(status.toLowerCase()).toContain("new");
  await verification.captureStep(testInfo, "vacation-created");

  // Step 8-9: Open Request Details and verify comment is displayed
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await expect(detailsDialog.root()).toContainText(data.comment);
  await verification.captureStep(testInfo, "details-with-comment");

  // CLEANUP: Delete the created vacation via UI
  await detailsDialog.deleteRequest();
  await globalConfig.delay();

  await logout.runViaDirectUrl();
  await page.close();
});
