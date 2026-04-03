import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the "Employees Vacation Days" page (/vacation/vacation-days).
 * Shows employee vacation day balances with search/filter capabilities.
 * Requires manager or accountant role to access.
 */
export class VacationDaysPage {
  private readonly searchInput = this.page.getByRole("textbox", {
    name: /first name.*last name/i,
  });
  private readonly tableRows = this.page.locator("table tbody tr");

  constructor(private readonly page: Page) {}

  /** Waits for the page to be ready (search input visible). */
  async waitForReady(): Promise<void> {
    await this.searchInput.waitFor({ state: "visible", timeout: 15000 });
  }

  /** Types a search term into the search input and waits for results. */
  async search(text: string): Promise<void> {
    await this.searchInput.click();
    await this.searchInput.fill("");
    await this.searchInput.pressSequentially(text, { delay: 50 });
    await this.page.waitForTimeout(1500);
    await this.page.waitForLoadState("networkidle");
  }

  /** Clears the search input and waits for table refresh. */
  async clearSearch(): Promise<void> {
    await this.searchInput.fill("");
    await this.page.waitForLoadState("networkidle");
  }

  /** Returns the count of visible table rows. */
  async getVisibleRowCount(): Promise<number> {
    await this.page.waitForTimeout(500);
    return this.tableRows.count();
  }

  /** Checks whether any table row contains the given text. */
  async hasEmployeeRow(text: string): Promise<boolean> {
    const row = this.tableRows.filter({ hasText: text });
    return (await row.count()) > 0;
  }

  /** Returns employee link texts from the first column of all visible rows (up to limit). */
  async getEmployeeNames(limit = 20): Promise<string[]> {
    const count = await this.tableRows.count();
    const names: string[] = [];
    for (let i = 0; i < Math.min(count, limit); i++) {
      const firstCell = this.tableRows.nth(i).locator("td").first();
      const text = await firstCell.textContent();
      if (text?.trim()) names.push(text.trim());
    }
    return names;
  }

  /** Returns the search input locator (for assertions). */
  searchField(): Locator {
    return this.searchInput;
  }
}
