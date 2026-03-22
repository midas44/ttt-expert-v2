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

  /** Returns a row matching the given text (employee name, dates, etc.). */
  requestRow(text: string | RegExp): Locator {
    return this.tableRows.filter({ hasText: text });
  }

  /** Waits for a request row to appear. */
  async waitForRequestRow(text: string | RegExp): Promise<Locator> {
    const row = this.requestRow(text);
    await row.first().waitFor({ state: "visible" });
    return row;
  }

  /** Clicks the approve button (checkmark) on a matching row. */
  async approveRequest(text: string | RegExp): Promise<void> {
    const row = this.requestRow(text).first();
    await row.waitFor({ state: "visible" });
    const btn = row.locator(
      '[data-testid="vacation-request-action-approve"]',
    );
    await btn.click();
  }

  /** Clicks the reject button (X icon) on a matching row. */
  async rejectRequest(text: string | RegExp): Promise<void> {
    const row = this.requestRow(text).first();
    await row.waitFor({ state: "visible" });
    const btn = row.locator(
      '[data-testid="vacation-request-action-reject"]',
    );
    await btn.click();
  }

  /** Waits for a request row to disappear from the list. */
  async waitForRequestRowToDisappear(text: string | RegExp): Promise<void> {
    const row = this.requestRow(text);
    await row.first().waitFor({ state: "detached", timeout: 10000 });
  }
}
