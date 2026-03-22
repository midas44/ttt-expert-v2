import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc052Data } from "../data/VacationTc052Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { VacationPaymentPage } from "../pages/VacationPaymentPage";
import { EmployeeRequestsPage } from "../pages/EmployeeRequestsPage";

test("TC-VAC-052 - Verify PAID status is terminal — no actions available @regress", async ({
  page,
  browser,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc052Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // === 1. Employee view: PAID vacation on Closed tab ===
  const login = new LoginFixture(page, tttConfig, data.employeeLogin, globalConfig);
  await login.run();
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  await mainFixture.ensureLanguage("EN");

  await page.goto(tttConfig.buildUrl("/vacation/my"));
  const myVacPage = new MyVacationsPage(page);
  await myVacPage.waitForReady();
  await myVacPage.clickClosedTab();
  await globalConfig.delay();

  // Find the PAID vacation row
  const row = await myVacPage.waitForVacationRow(data.periodPattern);
  const statusText = await myVacPage.columnValue(data.periodPattern, "Status");
  expect(statusText.trim().toLowerCase()).toContain("paid");

  // Verify PAID vacation has only 1 action button (view details)
  // Open/NEW vacations have 2+ buttons (edit + view + sometimes cancel)
  const actionsCell = row.first().locator("td").last();
  const buttons = actionsCell.locator("button");
  const buttonCount = await buttons.count();
  expect(buttonCount, "PAID vacation should have only view-details button").toBe(1);

  const verification = new VerificationFixture(page, globalConfig);
  await verification.verify("My vacations", testInfo);

  const logoutEmp = new LogoutFixture(page, tttConfig, globalConfig);
  await logoutEmp.runViaDirectUrl();
  await page.close();

  // === 2. Accountant view: PAID vacation NOT in payment queue ===
  const acctContext = await browser.newContext();
  const acctPage = await acctContext.newPage();
  await globalConfig.applyViewport(acctPage);

  const loginAcct = new LoginFixture(acctPage, tttConfig, data.accountantLogin, globalConfig);
  await loginAcct.run();
  const mainAcct = new MainFixture(acctPage, tttConfig, globalConfig);
  await mainAcct.ensureLanguage("EN");

  await acctPage.goto(tttConfig.buildUrl("/vacation/payment"));
  const paymentPage = new VacationPaymentPage(acctPage);
  await paymentPage.waitForReady();
  await globalConfig.delay();

  // PAID vacation should NOT appear in the payment queue
  const paidRow = paymentPage.vacationRow(data.periodPattern, data.employeeName);
  const paidRowVisible = await paidRow.first().isVisible().catch(() => false);
  expect(paidRowVisible, "PAID vacation should not appear in payment queue").toBe(false);

  const verificationAcct = new VerificationFixture(acctPage, globalConfig);
  await verificationAcct.verify("Vacation payment", testInfo);

  await acctPage.close();
  await acctContext.close();

  // === 3. Manager view: no approve/reject for PAID vacation ===
  const mgrContext = await browser.newContext();
  const mgrPage = await mgrContext.newPage();
  await globalConfig.applyViewport(mgrPage);

  const loginMgr = new LoginFixture(mgrPage, tttConfig, data.managerLogin, globalConfig);
  await loginMgr.run();
  const mainMgr = new MainFixture(mgrPage, tttConfig, globalConfig);
  await mainMgr.ensureLanguage("EN");

  await mgrPage.goto(tttConfig.buildUrl("/vacation/request"));
  const requestsPage = new EmployeeRequestsPage(mgrPage);
  await requestsPage.waitForReady();
  await requestsPage.clickApprovalTab();
  await globalConfig.delay();

  // PAID vacations should not appear in the Approval tab
  const mgrPaidRow = requestsPage.requestRow(data.periodPattern, data.employeeName);
  const mgrRowVisible = await mgrPaidRow.first().isVisible().catch(() => false);
  expect(mgrRowVisible, "PAID vacation should not appear in approval queue").toBe(false);

  const verificationMgr = new VerificationFixture(mgrPage, globalConfig);
  await verificationMgr.verify("Employees' requests", testInfo);

  await mgrPage.close();
  await mgrContext.close();
});
