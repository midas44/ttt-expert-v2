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

  /** Navigates to a specific payment month using the date picker or tab. */
  async selectMonth(monthLabel: string): Promise<void> {
    // Try clicking the month tab first (fastest)
    const tab = this.page
      .locator("button")
      .filter({ hasText: new RegExp(`^${monthLabel}$`, "i") });
    if (await tab.first().isVisible().catch(() => false)) {
      await tab.first().click();
      await this.page.waitForLoadState("networkidle");
      return;
    }

    // Fallback: use the date picker textbox to navigate to the month
    const pickerInput = this.page.getByRole("textbox").first();
    await pickerInput.click();
    // react-datetime opens a calendar picker — navigate forward to the target month
    // The picker shows months; click the "next" arrow to advance
    const [targetMonthAbbr, targetYear] = monthLabel.split(" "); // e.g., "Jun", "2026"
    for (let i = 0; i < 24; i++) {
      // Check if we're on the right year/month
      const pickerHeader = this.page.locator("th.rdtSwitch, [class*='rdtSwitch']");
      const headerText = await pickerHeader.textContent().catch(() => "");
      if (headerText && headerText.includes(targetYear)) {
        // We're on the right year — look for the target month cell
        const monthCell = this.page
          .locator("td[data-value], .rdtMonth")
          .filter({ hasText: new RegExp(`^${targetMonthAbbr}`, "i") });
        if (await monthCell.first().isVisible().catch(() => false)) {
          await monthCell.first().click();
          await this.page.waitForLoadState("networkidle");
          return;
        }
      }
      // Click next arrow
      const nextBtn = this.page.locator("th.rdtNext, [class*='rdtNext']").first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await this.page.waitForTimeout(300);
      } else {
        break;
      }
    }
    // If nothing worked, try reloading the page
    await this.page.reload({ waitUntil: "networkidle" });
  }

  /** Returns a table row matching ALL provided text filters. */
  vacationRow(...filters: Array<string | RegExp>): Locator {
    let locator: Locator = this.tableRows;
    for (const filter of filters) {
      locator = locator.filter({ hasText: filter });
    }
    return locator;
  }

  /** Waits for a row matching all filters, searching across pagination pages. */
  async waitForVacationRow(...filters: Array<string | RegExp>): Promise<Locator> {
    const row = this.vacationRow(...filters);
    // Try current page first
    const visible = await row.first().isVisible().catch(() => false);
    if (visible) return row;

    // Iterate through pagination pages
    const pagination = this.page.locator('nav[aria-label="Pagination"]');
    if (await pagination.count() > 0) {
      const pageButtons = pagination.locator("button").filter({ hasNotText: /Previous|Next/i });
      const pageCount = await pageButtons.count();
      for (let i = 0; i < pageCount; i++) {
        const btn = pageButtons.nth(i);
        const text = (await btn.textContent()) ?? "";
        if (!/^\d+$/.test(text.trim())) continue;
        // Skip current page (already checked)
        const ariaLabel = await btn.getAttribute("aria-label");
        if (ariaLabel && ariaLabel.includes("current")) continue;
        await btn.click();
        await this.page.waitForLoadState("networkidle");
        if (await row.first().isVisible().catch(() => false)) return row;
      }
    }
    // Last resort: wait on current page (will throw on timeout)
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

  /** Clicks the "Pay all the checked requests" button and confirms all payment dialogs. */
  async clickPayAll(): Promise<void> {
    await this.payAllButton.click();
    // Confirm "Payment of requests" dialog
    const paymentDialog = this.page.getByRole("dialog").filter({
      hasText: /Payment of requests/i,
    });
    await paymentDialog.waitFor({ state: "visible", timeout: 5000 });
    await paymentDialog.getByRole("button", { name: /Pay/i }).click();

    // Handle "Attention!" dialog about unclosed period (if it appears)
    try {
      const attentionDialog = this.page.getByRole("dialog").filter({
        hasText: /Attention/i,
      });
      await attentionDialog.waitFor({ state: "visible", timeout: 5000 });
      await attentionDialog.getByRole("button", { name: /Pay/i }).click();
    } catch {
      // No attention dialog — payment went through directly
    }
    await this.page.waitForLoadState("networkidle");
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
