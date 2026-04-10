import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { ReportsTc007Data } from "../../data/reports/ReportsTc007Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainPage, MyTasksPage } from "../../pages/MainPage";

/**
 * TC-RPT-007: Rename task on My Tasks page.
 * Verifies that clicking a task name opens a rename modal,
 * entering a new name and saving updates the grid.
 * Reverts the name after verification.
 */
test("TC-RPT-007: Rename task on My Tasks page @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc007Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const tasksPage = new MyTasksPage(page);

  // Step 1-2: Login → lands on My Tasks (/report)
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }
  await tasksPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Find the task row and click its name to open rename modal
  const taskRow = await tasksPage.waitForTask(data.taskPattern);
  await verification.captureStep(testInfo, "task-found");
  await tasksPage.clickTaskName(taskRow);
  await globalConfig.delay();

  // Step 4: In the rename modal — fill new name
  const modal = page.getByRole("dialog");
  await modal.waitFor({ state: "visible", timeout: 10000 });
  await verification.captureStep(testInfo, "rename-modal-open");

  // The name field is an rc-select combobox — fill() opens a dropdown.
  // Use pressSequentially for proper React event dispatching, then close dropdown.
  const nameInput = modal.locator("input[role='combobox'], input[type='search']").first();
  await nameInput.click();
  await page.keyboard.press("Control+a");
  await nameInput.pressSequentially(data.renamedName, { delay: 5 });
  await globalConfig.delay();

  // Step 5: Close the combobox dropdown by clicking the dialog title
  await modal.locator(".rc-dialog-title").click();
  await globalConfig.delay();

  // Step 6: Click the Rename button
  const renameBtn = modal.getByRole("button", { name: /^rename$|^переименовать$/i });
  await renameBtn.click();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Step 7: Verify task name updated in the grid
  const renamedPattern = new RegExp(
    data.renamedName
      .substring(0, 40)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const renamedRow = await tasksPage.waitForTask(renamedPattern);
  await expect(renamedRow).toBeVisible();
  await verification.captureStep(testInfo, "task-renamed");

  // CLEANUP: Rename back to original
  await tasksPage.clickTaskName(renamedRow);
  await globalConfig.delay();
  const modal2 = page.getByRole("dialog");
  await modal2.waitFor({ state: "visible", timeout: 10000 });
  const nameInput2 = modal2.locator("input[role='combobox'], input[type='search']").first();
  await nameInput2.click();
  await page.keyboard.press("Control+a");
  await nameInput2.pressSequentially(data.taskName, { delay: 5 });
  await globalConfig.delay();
  await modal2.locator(".rc-dialog-title").click();
  await globalConfig.delay();
  await modal2.getByRole("button", { name: /^rename$|^переименовать$/i }).click();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Verify original name is back
  const restoredRow = await tasksPage.waitForTask(data.taskPattern);
  await expect(restoredRow).toBeVisible();
  await verification.captureStep(testInfo, "task-name-restored");

  await logout.runViaDirectUrl();
  await page.close();
});
