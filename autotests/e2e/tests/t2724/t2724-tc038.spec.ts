import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc038Data } from "../../data/t2724/T2724Tc038Data";
import { DbClient } from "@ttt/config/db/dbClient";
import { deleteTagByName } from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";
import { ProjectSettingsDialog } from "@ttt/pages/ProjectSettingsDialog";

/**
 * TC-T2724-038: Apply error handling — silent failure on backend error.
 * Known design issue: both frontend (catch→devLog) and backend (catch→log.debug)
 * silently swallow errors. When apply returns 500:
 * - Spinner appears briefly, then modal closes (finally block)
 * - NO user-facing error notification
 * - NO page reload (reload is in the success path only)
 * - Error logged to browser console only (devLog)
 *
 * This test uses page.route() to intercept the apply request and return 500,
 * so it works regardless of whether the apply endpoint is deployed.
 */
test("TC-T2724-038: Apply error handling — silent failure on backend error @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc038Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);
  const settingsDialog = new ProjectSettingsDialog(page);

  try {
    await login.run();
    await mainFixture.ensureLanguage("EN");

    await page.goto(
      `${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`,
      { waitUntil: "domcontentloaded" },
    );
    await plannerPage.waitForReady();
    await globalConfig.delay();

    await plannerPage.selectRoleFilter("PM");
    await globalConfig.delay();
    await plannerPage.selectProject(data.projectName);
    await globalConfig.delay();

    // Open Project Settings > Tasks closing tab and add a tag
    // (tags must be non-empty for apply to fire — empty-tags guard)
    await plannerPage.clickProjectSettingsIcon();
    await settingsDialog.waitForReady();
    await settingsDialog.clickTasksClosingTab();
    await globalConfig.delay();
    await settingsDialog.addTag(data.tagValue);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "tag-added-for-apply");

    // Close dialog first (to avoid triggering apply now)
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    await globalConfig.delay();

    // Collect console messages to check for devLog error output
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warn") {
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Intercept the apply API call and return 500 Internal Server Error
    let applyIntercepted = false;
    await page.route("**/close-tags/apply**", async (route) => {
      applyIntercepted = true;
      console.log(`Intercepted apply request: ${route.request().method()} ${route.request().url()}`);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Simulated backend error for TC-038" }),
      });
    });

    // Inject DOM marker to detect if page reloads
    await page.evaluate(() => {
      document.body.dataset.tc038marker = "set";
    });

    // Re-open Project Settings and click OK (triggers apply with intercepted 500)
    await plannerPage.clickProjectSettingsIcon();
    await settingsDialog.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "dialog-open-before-apply-error");

    await settingsDialog.clickOk();

    // Wait for modal to close (the finally block closes it regardless of error)
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
    await globalConfig.delay();

    // Verify: apply request was intercepted
    expect.soft(applyIntercepted, "Apply API call was intercepted and returned 500").toBe(true);

    // Verify: page did NOT reload (marker survives — reload only happens on success path)
    const markerSurvived = await page.evaluate(
      () => document.body.dataset.tc038marker === "set",
    );
    expect
      .soft(markerSurvived, "Page should NOT reload on apply error (reload is success-only)")
      .toBe(true);

    // Verify: no user-facing error notification is visible
    // The app uses notification banners for success — verify none appear for errors
    const alertCount = await page.getByRole("alert").count();
    expect
      .soft(alertCount, "No alert-role notification — design issue: errors silently swallowed")
      .toBe(0);

    await verification.captureStep(testInfo, "silent-failure-documented");

    // Log console messages for documentation
    if (consoleMessages.length > 0) {
      console.log("Console messages captured during apply error:");
      consoleMessages.forEach((msg) => console.log(`  ${msg}`));
    } else {
      console.log("No error/warn console messages captured (devLog may use console.log level)");
    }

    // Clean up route interception
    await page.unroute("**/close-tags/apply**");
  } finally {
    // CLEANUP: Remove the test tag via DB
    const cleanDb = new DbClient(tttConfig);
    try {
      await deleteTagByName(cleanDb, data.projectId, data.tagValue);
    } finally {
      await cleanDb.close();
    }

    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
