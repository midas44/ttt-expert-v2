import type { Page, Locator } from "@playwright/test";
import { SickLeaveCreateDialog } from "./SickLeaveCreateDialog";

/**
 * Page object for the employee "My sick leaves" page at /sick-leave/my.
 *
 * Table columns (EN):
 *   0: Sick leave dates  |  1: Calendar days  |  2: Number
 *   3: Accountant        |  4: State          |  5: Actions
 */
export class MySickLeavePage {
  private readonly heading = this.page.locator("text=/My sick leaves|Мои больничные/i");
  private readonly addButton = this.page.getByRole("button", {
    name: "Add a sick note",
  });
  /** Data rows live in the first tbody (second tbody is the "Total" footer). */
  private readonly dataBody = this.page.locator("table tbody").first();

  constructor(private readonly page: Page) {}

  /** Waits for the page heading and table to be visible. */
  async waitForReady(): Promise<void> {
    await this.heading.waitFor({ state: "visible" });
    await this.page.locator("table").waitFor({ state: "visible" });
  }

  /** Opens the "Add a sick note" dialog. */
  async openCreateDialog(): Promise<SickLeaveCreateDialog> {
    await this.addButton.click();
    const dialog = new SickLeaveCreateDialog(this.page);
    await dialog.waitForOpen();
    return dialog;
  }

  /** Returns a row locator matching the given date text pattern. */
  findRow(datePattern: RegExp): Locator {
    return this.dataBody.locator("tr").filter({ hasText: datePattern });
  }

  /** Waits for a row matching the date pattern to appear. */
  async waitForRow(datePattern: RegExp, timeout = 10000): Promise<Locator> {
    const row = this.findRow(datePattern);
    await row.waitFor({ state: "visible", timeout });
    return row;
  }

  /** Returns the text content of a cell at the given column index. */
  async cellText(datePattern: RegExp, colIndex: number): Promise<string> {
    const row = this.findRow(datePattern);
    return (await row.locator("td").nth(colIndex).textContent())?.trim() ?? "";
  }

  /** Returns the "Sick leave dates" column text (col 0). */
  async getDates(datePattern: RegExp): Promise<string> {
    return this.cellText(datePattern, 0);
  }

  /** Returns the "Calendar days" column text (col 1). */
  async getCalendarDays(datePattern: RegExp): Promise<string> {
    return this.cellText(datePattern, 1);
  }

  /** Returns the "Number" column text (col 2). */
  async getNumber(datePattern: RegExp): Promise<string> {
    return this.cellText(datePattern, 2);
  }

  /** Returns the "State" column text (col 4). */
  async getState(datePattern: RegExp): Promise<string> {
    return this.cellText(datePattern, 4);
  }

  /** Returns the number of data rows (0 if "No data"). */
  async rowCount(): Promise<number> {
    const noData = this.dataBody.locator("td").filter({ hasText: "No data" });
    if (await noData.isVisible().catch(() => false)) return 0;
    return this.dataBody.locator("tr").count();
  }

  /** Whether a row matching the date pattern is visible. */
  async hasRow(datePattern: RegExp): Promise<boolean> {
    return (await this.findRow(datePattern).count()) > 0;
  }

  // --- Action buttons within a row ---
  // Action icons visible in the row: close (checkmark), edit (pencil), more (...)
  // Buttons use data-testid="sickleave-action-*"

  private row(datePattern: RegExp): Locator {
    return this.findRow(datePattern);
  }

  /** Clicks the edit (pencil) action. Returns the create/edit dialog. */
  async clickEdit(datePattern: RegExp): Promise<SickLeaveCreateDialog> {
    const r = this.row(datePattern);
    const btn = r.locator('[data-testid="sickleave-action-edit"]');
    await btn.click();
    const dialog = new SickLeaveCreateDialog(this.page);
    await dialog.waitForOpen();
    return dialog;
  }

  /** Clicks the close/end action (checkmark icon). */
  async clickClose(datePattern: RegExp): Promise<void> {
    const r = this.row(datePattern);
    const btn = r.locator('[data-testid="sickleave-action-close"]');
    if (await btn.count() > 0) {
      await btn.click();
    } else {
      // Fallback: try "end" testid
      await r.locator('[data-testid="sickleave-action-end"]').click();
    }
  }

  /**
   * Clicks delete via the "more" (...) menu.
   * Opens the dropdown, then clicks the Delete option.
   */
  async clickDelete(datePattern: RegExp): Promise<void> {
    const r = this.row(datePattern);
    // Click the three-dots "more" button to open the dropdown
    const moreBtn = r.locator('[data-testid*="more"], [data-testid*="menu"]');
    if (await moreBtn.count() > 0) {
      await moreBtn.first().click();
    } else {
      // Fallback: click the last action button in the row
      await r.locator("td").last().locator("button").last().click();
    }
    // Wait for dropdown/menu to appear, then click Delete
    const deleteOption = this.page.getByRole("menuitem", { name: /delete/i })
      .or(this.page.locator("[class*='menu'] [class*='item']").filter({ hasText: /delete/i }))
      .or(this.page.getByText(/delete/i).filter({ has: this.page.locator("button, [role='menuitem'], li") }));
    await deleteOption.first().waitFor({ state: "visible", timeout: 5000 });
    await deleteOption.first().click();
  }

  /** Opens details dialog via the detail action button (three-dots icon). */
  async clickDetails(datePattern: RegExp): Promise<void> {
    const r = this.row(datePattern);
    const detailBtn = r.locator('[data-testid="sickleave-action-detail"]');
    if (await detailBtn.count() > 0) {
      await detailBtn.click();
    } else {
      // Fallback: click the dates cell
      await r.locator("td").first().click();
    }
  }

  /** Opens the "more" (...) dropdown and clicks a specific option. */
  async clickMoreOption(datePattern: RegExp, optionText: RegExp): Promise<void> {
    const r = this.row(datePattern);
    const moreBtn = r.locator('[data-testid*="more"], [data-testid*="menu"]');
    if (await moreBtn.count() > 0) {
      await moreBtn.first().click();
    } else {
      await r.locator("td").last().locator("button").last().click();
    }
    // Wait for menu and click option
    const option = this.page.locator("text=" + optionText.source);
    await option.waitFor({ state: "visible", timeout: 5000 });
    await option.click();
  }
}
