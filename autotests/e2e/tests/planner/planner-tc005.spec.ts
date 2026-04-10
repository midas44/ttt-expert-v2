import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc005Data } from "../../data/planner/PlannerTc005Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-005: Filter by role — "Show projects where I am a ..."
 * Verifies that the role filter restricts the project dropdown.
 */
test("TC-PLN-005: Filter by role — Show projects where I am a @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc005Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Step 0: Login, ensure EN, go to Projects tab
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Step 1: Select "PM" role filter
  await plannerPage.selectRoleFilter("PM");
  await globalConfig.delay();
  await verification.captureStep(testInfo, "pm-filter-selected");

  // Step 2: Open project dropdown and verify PM project is listed
  const combobox = plannerPage.projectSelectCombobox();
  await combobox.click();
  await globalConfig.delay();

  const pmOption = page.getByRole("option", {
    name: data.pmProjectName,
    exact: true,
  });
  await expect(pmOption).toBeVisible();
  await verification.captureStep(testInfo, "pm-project-visible");

  // Close dropdown by pressing Escape
  await combobox.press("Escape");
  await globalConfig.delay();

  // Step 3: Switch to "Member" role filter
  await plannerPage.selectRoleFilter("Member");
  await globalConfig.delay();
  await verification.captureStep(testInfo, "member-filter-selected");

  // Step 4: Open project dropdown and verify member project is listed
  await combobox.click();
  await globalConfig.delay();

  const memberOption = page.getByRole("option", {
    name: data.memberProjectName,
    exact: true,
  });
  await expect(memberOption).toBeVisible();
  await verification.captureStep(testInfo, "member-project-visible");

  // Close dropdown
  await combobox.press("Escape");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
