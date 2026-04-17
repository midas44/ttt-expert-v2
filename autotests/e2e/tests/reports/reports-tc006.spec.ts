import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc006Data } from "../../data/reports/ReportsTc006Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyTasksPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-006: Pin/unpin task.
 * Verifies that clicking the pin icon unpins a task (moves it down)
 * and re-pinning restores its position.
 */
test("TC-RPT-006: Pin/unpin task @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc006Data.create(
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

  // Step 3: Note the initial task order
  const initialOrder = await tasksPage.getTaskNamesInOrder();
  await verification.captureStep(testInfo, "initial-task-order");

  // Step 4: Find the first task and unpin it
  const taskRow = await tasksPage.waitForTask(data.task1Pattern);
  await tasksPage.toggleTaskPin(taskRow);
  await globalConfig.delay();

  // Step 5: Verify task order changed (unpinned task should move down)
  const orderAfterUnpin = await tasksPage.getTaskNamesInOrder();
  await verification.captureStep(testInfo, "after-unpin");

  // The first task should no longer be at its original position
  // (it moved to the unpinned section, alphabetically sorted)
  expect(orderAfterUnpin).not.toEqual(initialOrder);

  // Step 6: Re-pin the task
  const unpinnedRow = await tasksPage.waitForTask(data.task1Pattern);
  await tasksPage.toggleTaskPin(unpinnedRow);
  await globalConfig.delay();

  // Step 7: Verify task order is restored
  const orderAfterRepin = await tasksPage.getTaskNamesInOrder();
  expect(orderAfterRepin).toEqual(initialOrder);
  await verification.captureStep(testInfo, "after-repin-restored");

  await logout.runViaDirectUrl();
  await page.close();
});
