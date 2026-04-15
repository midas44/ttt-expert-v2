import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc010Data } from "../../data/planner/PlannerTc010Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-010: Task view toggle — TASK vs TICKET.
 * Verifies that clicking "Ticket" link in the table header switches the display
 * mode, and clicking "Task" switches it back.
 */
test("TC-PLN-010: Task view toggle — TASK vs TICKET @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc010Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Step 0: Login, ensure EN, go to planner Tasks tab (stay on today's date)
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_TASK`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Step 1: Verify the Task/Ticket header cell is visible
  const headerCell = plannerPage.taskTicketHeaderCell();
  await expect(headerCell).toBeVisible({ timeout: 10_000 });
  await verification.captureStep(testInfo, "task-ticket-header-visible");

  // Step 2: In default TASK view, "Ticket" should be a clickable link (role=button)
  const ticketLink = headerCell.getByRole("button", { name: /Ticket/i });
  await expect(ticketLink).toBeVisible();

  // Step 3: Switch to TICKET view
  await plannerPage.switchToTicketView();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "ticket-view-active");

  // Step 4: Verify "Task" is now a clickable link (role=button) — TICKET view active
  const taskLink = headerCell.getByRole("button", { name: /Task/i });
  await expect(taskLink).toBeVisible();

  // Step 5: Switch back to TASK view
  await plannerPage.switchToTaskView();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "task-view-restored");

  // Step 6: Verify "Ticket" is again a clickable link (TASK view restored)
  await expect(ticketLink).toBeVisible();

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
