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
    // The redirect dialog has a combobox/search field for selecting the new approver
    const dialog = this.page.locator(".modal, [role='dialog'], .popup").filter({ hasText: /redirect|change.*approver/i });
    await dialog.waitFor({ state: "visible", timeout: 5000 }).catch(() => {
      // Fallback: the redirect may use an inline dropdown instead of a modal
    });

    // Try combobox input first
    const input = this.page.locator("input[type='text'], input[type='search']").last();
    await input.fill(managerName.split(" ")[0]); // Type first name to search
    await this.page.waitForLoadState("networkidle");

    // Click the matching option
    const option = this.page.locator(".dropdown-menu, .suggestions, [role='listbox'], [role='option']")
      .filter({ hasText: managerName });
    if (await option.count() > 0) {
      await option.first().click();
    } else {
      // Fallback: click text match anywhere
      await this.page.locator(`text=${managerName}`).first().click();
    }
  }

  /** Confirms the redirect action (clicks confirm/save button in redirect dialog). */
  async confirmRedirect(): Promise<void> {
    // Look for confirm/save button in the redirect context
    const confirmBtn = this.page.getByRole("button", { name: /confirm|save|ok|redirect/i });
    if (await confirmBtn.count() > 0) {
      await confirmBtn.first().click();
    }
    await this.page.waitForLoadState("networkidle");
  }

  /** Waits for a request row matching all filters to disappear from the list. */
  async waitForRequestRowToDisappear(
    ...filters: Array<string | RegExp>
  ): Promise<void> {
    const row = this.requestRow(...filters);
    await row.first().waitFor({ state: "detached", timeout: 10000 });
  }
}
