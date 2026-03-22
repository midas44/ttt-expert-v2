import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the Vacation Payment page (accountant view).
 * URL: /vacation/payment (redirects to /vacation/payment/YYYY-MM-01)
 */
export class VacationPaymentPage {
  private readonly pageTitle = this.page.locator(".page-body__title, .page-body").filter({ hasText: /Vacation\s*payment/i });
  private readonly tableRows = this.page.locator("table tbody tr");
  private readonly payAllButton = this.page.getByRole("button", { name: /Pay all the checked requests/i });

  constructor(private readonly page: Page) {}

  /** Waits for the payment page to be ready. */
  async waitForReady(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    await this.page.locator("text=Vacation payment").first().waitFor({ state: "visible" });
  }

  /** Returns a table row matching ALL provided text filters. */
  vacationRow(...filters: Array<string | RegExp>): Locator {
    let locator: Locator = this.tableRows;
    for (const filter of filters) {
      locator = locator.filter({ hasText: filter });
    }
    return locator;
  }

  /** Waits for a row matching all filters to appear. */
  async waitForVacationRow(...filters: Array<string | RegExp>): Promise<Locator> {
    const row = this.vacationRow(...filters);
    await row.first().waitFor({ state: "visible" });
    return row;
  }

  /** Checks the checkbox on a matching row to select it for payment. */
  async checkRow(...filters: Array<string | RegExp>): Promise<void> {
    const row = this.vacationRow(...filters).first();
    await row.waitFor({ state: "visible" });
    const checkbox = row.locator("input[type='checkbox']");
    await checkbox.check();
  }

  /** Clicks the "Pay all the checked requests" button. */
  async clickPayAll(): Promise<void> {
    await this.payAllButton.click();
  }

  /** Waits for a row matching all filters to disappear. */
  async waitForVacationRowToDisappear(...filters: Array<string | RegExp>): Promise<void> {
    const row = this.vacationRow(...filters);
    await row.first().waitFor({ state: "detached", timeout: 15000 });
  }

  /** Returns the text content of a specific column cell for a row. */
  async columnValue(columnLabel: string, ...rowFilters: Array<string | RegExp>): Promise<string> {
    const row = this.vacationRow(...rowFilters).first();
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
      throw new Error(`Column "${columnLabel}" not found in payment table`);
    }
    const cell = row.locator("td").nth(colIndex);
    return (await cell.textContent()) ?? "";
  }

  /** Returns the count of visible table rows. */
  async getRowCount(): Promise<number> {
    return this.tableRows.count();
  }
}
