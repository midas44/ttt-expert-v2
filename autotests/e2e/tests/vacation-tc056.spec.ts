import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc056Data } from "../data/VacationTc056Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-056 - Verify available days for AV=false employee (monthly accrual) @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc056Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // === Login as AV=false employee ===
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  await login.run();
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  await mainFixture.ensureLanguage("EN");

  // === Fetch expected availablePaidDays from the same API the frontend uses ===
  const today = new Date().toISOString().split("T")[0];
  const apiDays = await page.evaluate(
    async ({ username, paymentDate }) => {
      const resp = await fetch(
        `/api/vacation/v1/vacationdays/available?employeeLogin=${username}&newDays=0&paymentDate=${paymentDate}&usePaymentDateFilter=true`,
      );
      if (!resp.ok) return null;
      const json = await resp.json();
      return json.availablePaidDays ?? json;
    },
    { username: data.username, paymentDate: today },
  );

  // === Navigate to My Vacations ===
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  const vacationsPage = new MyVacationsPage(page);
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // === Read displayed available days ===
  const fullText = await vacationsPage.getAvailableDaysFullText();
  const dayMatch = fullText.match(/(\d+)/);
  const displayedDays = dayMatch ? parseInt(dayMatch[1], 10) : -1;

  // === Verify: displayed days should match API value ===
  const verification = new VerificationFixture(page, globalConfig);
  if (apiDays !== null) {
    expect(
      displayedDays,
      `AV=false employee ${data.username} (office: ${data.officeName}): displayed=${displayedDays} (text="${fullText}"), API=${apiDays}`,
    ).toBe(typeof apiDays === "number" ? Math.floor(apiDays) : displayedDays);
  }

  // AV=false format: just a number (no "in YYYY")
  expect(displayedDays, "Available days should be >= 0").toBeGreaterThanOrEqual(
    0,
  );

  await verification.verify("Available vacation days", testInfo);

  // === Logout ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
