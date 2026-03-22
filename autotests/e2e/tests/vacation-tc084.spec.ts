import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc084Data } from "../data/VacationTc084Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-084 - End date before start date — error message @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc084Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Step 3: Open create dialog
  const dialog = await vacationsPage.openCreateRequest();

  // Step 4: Set start date AFTER end date (start = +14d, end = +7d)
  await dialog.fillVacationPeriod(data.startDate, data.endDate);
  await globalConfig.delay();

  // Step 5-6: Verify frontend validation prevents submission.
  // Formik disables Save when end < start, and/or shows red text.
  const saveButton = dialog.root().getByRole("button", { name: /save/i });
  const isDisabled = await saveButton.isDisabled();

  // Check for red validation text in the dialog
  const hasRedText = await dialog.root().evaluate((el) => {
    for (const node of el.querySelectorAll("*")) {
      const style = window.getComputedStyle(node);
      const r = parseInt(style.color.match(/\d+/)?.[0] ?? "0");
      const g = parseInt(style.color.match(/\d+/g)?.[1] ?? "255");
      const text = node.textContent?.trim() ?? "";
      if (r > 180 && g < 100 && text.length > 0 && text.length < 200) {
        return true;
      }
    }
    return false;
  });

  await verification.verifyLocatorVisible(
    dialog.root(),
    testInfo,
    "dialog-open-with-validation-error",
  );

  // Verify: either Save is disabled or red text is shown
  expect(
    isDisabled || hasRedText,
    `Expected validation error for end < start. Save disabled: ${isDisabled}, red text: ${hasRedText}`,
  ).toBe(true);

  // Step 7: Verify dialog is still open — vacation was NOT created
  expect(await dialog.isOpen()).toBe(true);

  // Cleanup
  await dialog.cancel();
  await logout.runViaDirectUrl();
  await page.close();
});
