import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc009Data } from "../../data/planner/PlannerTc009Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-009: WebSocket connection indicator.
 * Verifies that after selecting a project on the Projects tab,
 * the socket manager LED is visible and shows connection status.
 */
test("TC-PLN-009: WebSocket connection indicator @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc009Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Step 0: Login, ensure EN, go to planner Projects tab
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Step 1: Switch role filter to PM (like TC-PLN-004)
  await plannerPage.selectRoleFilter("PM");
  await globalConfig.delay();

  // Step 2: Select the PM's project
  await plannerPage.selectProject(data.projectName);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "project-selected");

  // Step 3: Verify the socket manager position wrapper is visible
  await expect(plannerPage.socketManagerWrapper()).toBeVisible({
    timeout: 10_000,
  });

  // Step 4: Verify the inner socket manager container has a connection status class.
  // SocketManagerWrapper adds: --connected, --connecting, or --disconnected.
  // The socket may take a moment to connect, so poll the class attribute.
  const container = plannerPage.socketManagerContainer();
  await expect(container).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(
      async () => {
        const cls = (await container.getAttribute("class")) ?? "";
        return (
          cls.includes("connected") ||
          cls.includes("connecting") ||
          cls.includes("disconnected")
        );
      },
      { timeout: 15_000, message: "Socket status class not found on container" },
    )
    .toBe(true);
  await verification.captureStep(testInfo, "socket-status-verified");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
