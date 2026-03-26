import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the manager's "Days off rescheduling" approval page
 * at /vacation/request/daysoff-request/APPROVER.
 *
 * Requires ROLE_PROJECT_MANAGER, ROLE_DEPARTMENT_MANAGER, or ROLE_ADMIN.
 */
export class DayOffRequestPage {
  /** Main tabs at the top of the request page. */
  private readonly daysOffReschedulingTab = this.page.getByRole("button", {
    name: /Days off rescheduling|Перенос выходных/i,
  });

  /** Sub-tabs within the Days off rescheduling section. */
  private readonly approvalTab = this.page.getByRole("button", {
    name: /Approval|На подтверждении/i,
  });
  private readonly myDepartmentTab = this.page.getByRole("button", {
    name: /My department|Мой отдел/i,
  });

  /** Table structure. */
  private readonly table = this.page.locator("table").first();
  private readonly tableRows = this.table.locator("tbody tr");

  constructor(private readonly page: Page) {}

  /** Navigate to the approval page. */
  async goto(appUrl: string): Promise<void> {
    await this.page.goto(
      `${appUrl}/vacation/request/daysoff-request/APPROVER`,
      { waitUntil: "domcontentloaded" },
    );
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /** Wait for the table to be visible. */
  async waitForReady(): Promise<void> {
    await this.page.getByRole("table").first().waitFor({ state: "visible" });
  }

  /** Click the "Days off rescheduling" main tab. */
  async clickDaysOffTab(): Promise<void> {
    await this.daysOffReschedulingTab.click();
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /** Click the "Approval" sub-tab. */
  async clickApprovalTab(): Promise<void> {
    await this.approvalTab.click();
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /** Click the "My department" sub-tab. */
  async clickMyDepartmentTab(): Promise<void> {
    await this.myDepartmentTab.click();
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /** Navigate directly to the My department tab. */
  async gotoMyDepartment(appUrl: string): Promise<void> {
    await this.page.goto(
      `${appUrl}/vacation/request/daysoff-request/MY_DEPARTMENT`,
      { waitUntil: "domcontentloaded" },
    );
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /** Returns the count of visible data rows. */
  async getRowCount(): Promise<number> {
    return this.tableRows.count();
  }

  /**
   * Find a request row by employee name text.
   * The employee name appears in the first column of the table.
   */
  requestRow(employeePattern: string | RegExp): Locator {
    return this.tableRows.filter({ hasText: employeePattern });
  }

  /**
   * Find a request row matching ALL given patterns.
   * Useful for matching by employee name AND date simultaneously.
   */
  requestRowMulti(...patterns: (string | RegExp)[]): Locator {
    let loc: Locator = this.tableRows;
    for (const p of patterns) {
      loc = loc.filter({ hasText: p });
    }
    return loc;
  }

  /** Click info button on a specific row locator. */
  async clickInfoOnRow(row: Locator): Promise<void> {
    await row
      .locator("[data-testid='daysoff-request-action-info']")
      .click();
  }

  /** Click approve button on a specific row locator. */
  async clickApproveOnRow(row: Locator): Promise<void> {
    await row
      .locator("[data-testid='daysoff-request-action-approve']")
      .click();
  }

  /** Click reject button on a specific row locator. */
  async clickRejectOnRow(row: Locator): Promise<void> {
    await row
      .locator("[data-testid='daysoff-request-action-reject']")
      .click();
  }

  /** Click the approve button on a request row. */
  async clickApprove(employeePattern: string | RegExp): Promise<void> {
    const row = this.requestRow(employeePattern).first();
    await row
      .locator("[data-testid='daysoff-request-action-approve']")
      .click();
  }

  /** Click the reject button on a request row. */
  async clickReject(employeePattern: string | RegExp): Promise<void> {
    const row = this.requestRow(employeePattern).first();
    await row
      .locator("[data-testid='daysoff-request-action-reject']")
      .click();
  }

  /** Click the redirect button on a request row. */
  async clickRedirect(employeePattern: string | RegExp): Promise<void> {
    const row = this.requestRow(employeePattern).first();
    await row
      .locator("[data-testid='daysoff-request-action-redirect']")
      .click();
  }

  /** Click the info button on a request row. */
  async clickInfo(employeePattern: string | RegExp): Promise<void> {
    const row = this.requestRow(employeePattern).first();
    await row
      .locator("[data-testid='daysoff-request-action-info']")
      .click();
  }

  /** Check if the approve button exists on a row. */
  async hasApproveButton(
    employeePattern: string | RegExp,
  ): Promise<boolean> {
    const row = this.requestRow(employeePattern).first();
    return (
      (await row
        .locator("[data-testid='daysoff-request-action-approve']")
        .count()) > 0
    );
  }

  /** Check if the reject button exists on a row. */
  async hasRejectButton(
    employeePattern: string | RegExp,
  ): Promise<boolean> {
    const row = this.requestRow(employeePattern).first();
    return (
      (await row
        .locator("[data-testid='daysoff-request-action-reject']")
        .count()) > 0
    );
  }

  /** Check if the redirect button exists on a row. */
  async hasRedirectButton(
    employeePattern: string | RegExp,
  ): Promise<boolean> {
    const row = this.requestRow(employeePattern).first();
    return (
      (await row
        .locator("[data-testid='daysoff-request-action-redirect']")
        .count()) > 0
    );
  }

  /** Check if the info button exists on a row. */
  async hasInfoButton(
    employeePattern: string | RegExp,
  ): Promise<boolean> {
    const row = this.requestRow(employeePattern).first();
    return (
      (await row
        .locator("[data-testid='daysoff-request-action-info']")
        .count()) > 0
    );
  }

  /** Returns the status text from a request row. */
  async getRowStatus(employeePattern: string | RegExp): Promise<string> {
    const row = this.requestRow(employeePattern).first();
    // Status is typically the 7th column (index 6)
    const cells = row.locator("td");
    const count = await cells.count();
    // Find the cell containing status keywords
    for (let i = 0; i < count; i++) {
      const text = (await cells.nth(i).textContent())?.trim() ?? "";
      if (
        /new|approved|rejected|на подтверждении|подтверждено|отклонено/i.test(
          text,
        )
      ) {
        return text;
      }
    }
    return "";
  }

  /** Wait for a row's status to change to the expected value. */
  async waitForStatus(
    employeePattern: string | RegExp,
    expectedStatus: RegExp,
    timeout = 15_000,
  ): Promise<void> {
    const row = this.requestRow(employeePattern).first();
    await row.locator("td", { hasText: expectedStatus }).waitFor({
      state: "visible",
      timeout,
    });
  }
}
