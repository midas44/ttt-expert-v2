import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the Employee Requests page (manager view).
 * Navigation: Calendar of absences > Employees requests
 */
export class EmployeeRequestsPage {
  private readonly title = this.page
    .locator(".page-body__title")
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

  /** Waits for a request row matching all filters to disappear from the list. */
  async waitForRequestRowToDisappear(
    ...filters: Array<string | RegExp>
  ): Promise<void> {
    const row = this.requestRow(...filters);
    await row.first().waitFor({ state: "detached", timeout: 10000 });
  }
}
