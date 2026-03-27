import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the Employee Requests page (manager view).
 * Navigation: Calendar of absences > Employees requests
 */
export class EmployeeRequestsPage {
  private readonly title = this.page
    .locator("[class*='title'], h1, h2")
    .filter({ hasText: /Employees.?\s*requests/i });
  private readonly tableRows = this.page.locator("table tbody tr");

  constructor(private readonly page: Page) {}

  /** Waits for the Employee Requests page to be ready. */
  async waitForReady(): Promise<void> {
    await this.title.waitFor({ state: "visible" });
  }

  /** Clicks the "Approval" sub-tab filter. */
  async clickApprovalTab(): Promise<void> {
    await this.page.getByRole("button", { name: /^Approval/i }).click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Clicks the "My department" sub-tab filter. */
  async clickMyDepartmentTab(): Promise<void> {
    await this.page.getByRole("button", { name: /^My department/i }).click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Returns a row matching ALL provided text filters (compound matching). */
  requestRow(...filters: Array<string | RegExp>): Locator {
    let locator: Locator = this.tableRows;
    for (const filter of filters) {
      locator = locator.filter({ hasText: filter });
    }
    return locator;
  }

  /** Waits for a request row matching all filters to appear. */
  async waitForRequestRow(
    ...filters: Array<string | RegExp>
  ): Promise<Locator> {
    const row = this.requestRow(...filters);
    await row.first().waitFor({ state: "visible" });
    return row;
  }

  /** Clicks the approve button (checkmark) on a matching row. */
  async approveRequest(...filters: Array<string | RegExp>): Promise<void> {
    const row = this.requestRow(...filters).first();
    await row.waitFor({ state: "visible" });
    const btn = row.locator(
      '[data-testid="vacation-request-action-approve"]',
    );
    await btn.click();
  }

  /** Clicks the reject button (X icon) on a matching row. */
  async rejectRequest(...filters: Array<string | RegExp>): Promise<void> {
    const row = this.requestRow(...filters).first();
    await row.waitFor({ state: "visible" });
    const btn = row.locator(
      '[data-testid="vacation-request-action-reject"]',
    );
    await btn.click();
  }

  /** Returns the text content of a specific column cell for a request row. */
  async columnValue(
    columnLabel: string,
    ...rowFilters: Array<string | RegExp>
  ): Promise<string> {
    const row = this.requestRow(...rowFilters).first();
    const headerCells = this.page.locator("table thead th");
    const colIndex = await headerCells.evaluateAll(
      (headers: Element[], label: string) => {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].textContent?.trim().toLowerCase().includes(label.toLowerCase())) {
            return i;
          }
        }
        return -1;
      },
      columnLabel,
    );
    if (colIndex === -1) {
      throw new Error(`Column "${columnLabel}" not found in requests table`);
    }
    const cell = row.locator("td").nth(colIndex);
    return (await cell.textContent()) ?? "";
  }

  /** Clicks the redirect button (arrow icon) on a matching row. */
  async redirectRequest(...filters: Array<string | RegExp>): Promise<void> {
    const row = this.requestRow(...filters).first();
    await row.waitFor({ state: "visible" });
    const btn = row.locator(
      '[data-testid="vacation-request-action-redirect"]',
    );
    await btn.click();
  }

  /** Selects a manager in the redirect dialog by typing their name and clicking the option. */
  async selectRedirectTarget(managerName: string): Promise<void> {
    const dialog = this.page.getByRole("dialog").filter({ hasText: /Redirect the request/i });
    await dialog.waitFor({ state: "visible", timeout: 10000 });

    // The dialog uses a react-select combobox — click the control area to open
    const selectControl = dialog.locator("[class*='control']").first();
    await selectControl.click();
    // Type last name (more unique) to filter the dropdown
    const parts = managerName.split(" ");
    const searchTerm = parts.length > 1 ? parts[1] : parts[0];
    await this.page.keyboard.type(searchTerm, { delay: 50 });
    await this.page.waitForTimeout(1500);

    // react-select uses div[class*='option'] instead of native <option> elements
    const option = this.page.locator("[class*='option']").filter({
      hasText: new RegExp(searchTerm, "i"),
    });
    await option.first().click({ timeout: 10_000 });
  }

  /** Confirms the redirect action (clicks OK button in redirect dialog). */
  async confirmRedirect(): Promise<void> {
    const dialog = this.page.getByRole("dialog").filter({ hasText: /Redirect the request/i });
    await dialog.getByRole("button", { name: "OK" }).click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Returns the count number from the "Vacation requests (N)" tab text, or 0. */
  async getVacationRequestsCount(): Promise<number> {
    const tab = this.page.getByRole("button", {
      name: /Vacation requests/i,
    });
    const text = (await tab.textContent()) ?? "";
    const match = text.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /** Returns the count number from the "Approval (N)" sub-tab text, or 0. */
  async getApprovalCount(): Promise<number> {
    const tab = this.page.getByRole("button", { name: /^Approval/i });
    const text = (await tab.textContent()) ?? "";
    const match = text.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /** Checks whether the approve button exists on a matching row. */
  async hasApproveButton(...filters: Array<string | RegExp>): Promise<boolean> {
    const row = this.requestRow(...filters).first();
    return row
      .locator('[data-testid="vacation-request-action-approve"]')
      .isVisible();
  }

  /** Checks whether the reject button exists on a matching row. */
  async hasRejectButton(...filters: Array<string | RegExp>): Promise<boolean> {
    const row = this.requestRow(...filters).first();
    return row
      .locator('[data-testid="vacation-request-action-reject"]')
      .isVisible();
  }

  /** Checks whether the redirect button exists on a matching row. */
  async hasRedirectButton(
    ...filters: Array<string | RegExp>
  ): Promise<boolean> {
    const row = this.requestRow(...filters).first();
    return row
      .locator('[data-testid="vacation-request-action-redirect"]')
      .isVisible();
  }

  /** Checks whether the details/info button exists on a matching row. */
  async hasDetailsButton(
    ...filters: Array<string | RegExp>
  ): Promise<boolean> {
    const row = this.requestRow(...filters).first();
    // Details button is typically the 4th action or has an info icon
    const actions = row.locator("td").last().locator("button");
    return (await actions.count()) > 0;
  }

  /** Waits for a request row matching all filters to disappear from the list. */
  async waitForRequestRowToDisappear(
    ...filters: Array<string | RegExp>
  ): Promise<void> {
    const row = this.requestRow(...filters);
    await row.first().waitFor({ state: "detached", timeout: 10000 });
  }
}
