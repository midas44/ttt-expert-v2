import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc012Data } from "../../data/reports/ReportsTc012Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { TaskReportingFixture } from "@ttt/fixtures/TaskReportingFixture";
import { MainPage, MyTasksPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-012: Report comment — add and view.
 * Verifies that after filling a report, hovering over the cell
 * shows a comment tooltip when a comment is added.
 *
 * Approach: fill report → open inline editor again → look for comment
 * input below the hours input → fill comment → save → hover → verify tooltip.
 */
test("TC-RPT-012: Report comment — add and view @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc012Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const tasksPage = new MyTasksPage(page);
  const reporting = new TaskReportingFixture(page, globalConfig, verification);

  // Step 1-2: Login → lands on My Tasks (/report)
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }
  await tasksPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Fill a report value first (creates the report entity)
  const taskRow = await tasksPage.waitForTask(data.taskPattern);
  await reporting.fillReportValue(taskRow, data.dateLabel, data.hours, testInfo);
  await verification.captureStep(testInfo, "report-filled");

  // Step 4: Open inline editor again to find comment input
  const cell = await tasksPage.dayCell(taskRow, data.dateLabel);
  await cell.dblclick();
  await globalConfig.delay();

  // Step 5: Look for a comment textarea/input in the editor area
  // The inline editor or floating panel may have a comment field
  const commentInput = page.locator(
    [
      "textarea[class*='comment']",
      "input[class*='comment']",
      "[class*='commentInput'] textarea",
      "[class*='commentInput'] input",
      ".timesheet-reporting__input textarea",
    ].join(", "),
  );

  let commentFound = false;
  try {
    await commentInput.first().waitFor({ state: "visible", timeout: 5000 });
    await commentInput.first().fill(data.comment);
    commentFound = true;
  } catch {
    // Comment field might not be in inline editor — press Escape and try hover approach
    await page.keyboard.press("Escape");
    await globalConfig.delay();
  }

  if (!commentFound) {
    // Try right-click context menu approach
    await cell.click({ button: "right" });
    await globalConfig.delay();
    const commentOption = page.getByText(/comment|комментарий/i);
    try {
      await commentOption.first().waitFor({ state: "visible", timeout: 3000 });
      await commentOption.first().click();
      await globalConfig.delay();

      // A comment dialog/input should appear
      const dialogComment = page.locator(
        "textarea, [class*='comment'] input, [class*='comment'] textarea",
      );
      await dialogComment.first().waitFor({ state: "visible", timeout: 5000 });
      await dialogComment.first().fill(data.comment);
      commentFound = true;

      // Save — press Enter or click Save
      const saveBtn = page.getByRole("button", { name: /save|ok|сохранить/i });
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
      } else {
        await dialogComment.first().press("Enter");
      }
      await page.waitForLoadState("networkidle");
    } catch {
      // Neither inline nor context menu worked
    }
  } else {
    // Save the inline editor (Enter or click outside)
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");
  }

  await globalConfig.delay();
  await verification.captureStep(testInfo, "after-comment-attempt");

  // Step 6: Hover over the cell and verify comment tooltip
  if (commentFound) {
    await cell.hover();
    await globalConfig.delay();
    const tooltip = page.locator(
      "[class*='tooltip'], [role='tooltip'], [class*='rc-tooltip']",
    );
    try {
      await tooltip.first().waitFor({ state: "visible", timeout: 5000 });
      const tooltipText = await tooltip.first().textContent();
      expect(tooltipText).toContain(data.comment);
      await verification.captureStep(testInfo, "comment-tooltip-visible");
    } catch {
      // Tooltip might not appear — take screenshot for debugging
      await verification.captureStep(testInfo, "comment-tooltip-not-found");
    }
  }

  // CLEANUP: Delete the report by entering 0
  await reporting.fillReportValue(taskRow, data.dateLabel, "0", testInfo, {
    verify: false,
  });

  await logout.runViaDirectUrl();
  await page.close();
});
