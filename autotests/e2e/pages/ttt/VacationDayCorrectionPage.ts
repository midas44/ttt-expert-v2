import type { Page, Locator } from "@playwright/test";
import { resolveFirstVisible } from "@utils/locatorResolver";

/**
 * Page object for the Vacation Day Correction page (/vacation/days-correction).
 * Accountants use this page to adjust employee vacation day balances.
 *
 * UI: table with inline-editable "Vacation Days" column, filter by employee login,
 * confirmation modal with required comment field.
 */
export class VacationDayCorrectionPage {
  private readonly table: Locator;

  constructor(private readonly page: Page) {
    this.table = page.locator("table").first();
  }

  /** Waits for the page table to load. */
  async waitForReady(): Promise<void> {
    await this.table.waitFor({ state: "visible", timeout: 15000 });
  }

  /**
   * Filters the table by employee name using the search textbox.
   * Types the name, waits for autocomplete suggestions, clicks the match.
   * @param employeeName - "First Last" format (e.g. "Fedor Agafonov") as shown in dropdown.
   */
  async filterByEmployee(employeeName: string): Promise<void> {
    // The search textbox accepts "First name, last name of the employee or of the department manager"
    const textbox = this.page.getByRole("textbox", {
      name: /first name.*last name/i,
    });
    await textbox.click();
    const firstName = employeeName.split(" ")[0];
    await textbox.pressSequentially(firstName, { delay: 50 });
    await this.page.waitForTimeout(1000);

    // Click the matching option from the autocomplete dropdown.
    // The dropdown renders as a list of buttons or list items.
    const optionCandidates = [
      this.page.getByRole("option", { name: new RegExp(employeeName, "i") }),
      this.page.getByRole("button", { name: new RegExp(employeeName, "i") }),
      this.page.locator("li").filter({ hasText: employeeName }),
    ];
    for (const candidate of optionCandidates) {
      if ((await candidate.count()) > 0) {
        await candidate.first().click({ timeout: 5000 });
        break;
      }
    }

    // Wait for table to re-render with filtered data
    await this.page.waitForLoadState("networkidle");
    await this.page.waitForTimeout(1000);
  }

  /**
   * Finds the table row containing the given employee display text.
   * Returns the row locator.
   */
  employeeRow(employeeText: string): Locator {
    return this.table
      .locator("tbody tr")
      .filter({ hasText: employeeText });
  }

  /**
   * Reads the current vacation days value from the inline cell for the given employee row.
   * The cell contains a button or span showing the current value.
   */
  async getCurrentDays(row: Locator): Promise<string> {
    // The vacation days column is typically the 3rd column (index 2)
    // Look for clickable element in vacation days cells
    const candidates = [
      row.locator("td").nth(2),
      row.locator("td").filter({ hasText: /^\d+(\.\d+)?$/ }).first(),
    ];
    const cell = await resolveFirstVisible(candidates);
    return (await cell.textContent())?.trim() ?? "";
  }

  /**
   * Clicks the vacation days cell to open inline editing, then types a new value.
   * The cell contains a button that transforms into an input on click.
   */
  async editVacationDays(row: Locator, newValue: string): Promise<void> {
    // Find the editable cell — it contains a button with the current value
    const editableBtn = row.locator("td").nth(2).locator("button");
    await editableBtn.click();

    // Input appears with autoFocus and selects all text on focus.
    // IMPORTANT: Do NOT call fill()/clear() — they trigger blur which closes the EditBox.
    // The onFocus handler already selects all text, so typing replaces it.
    const input = row.locator("td input").first();
    await input.waitFor({ state: "visible", timeout: 3000 });

    // Select all text and type replacement (avoids blur from fill/clear)
    await this.page.keyboard.press("Control+A");
    await this.page.keyboard.type(newValue);

    // Submit via Enter (triggers submitAndClose which opens confirmation modal)
    await this.page.keyboard.press("Enter");
  }

  /**
   * Fills the comment in the confirmation modal and approves the correction.
   * The modal asks "Do you want to change vacation days..." with a required comment field.
   */
  async confirmCorrection(comment: string): Promise<void> {
    // Wait for the modal to appear
    const modal = this.page.getByRole("dialog").first();
    await modal.waitFor({ state: "visible", timeout: 5000 });

    // Fill comment field (required)
    const commentCandidates = [
      modal.locator("textarea"),
      modal.getByRole("textbox"),
      modal.locator("input[type='text']"),
    ];
    const commentInput = await resolveFirstVisible(commentCandidates);
    await commentInput.fill(comment);

    // Click Approve button
    const approveCandidates = [
      modal.getByRole("button", { name: /approve/i }),
      modal.getByRole("button", { name: /confirm/i }),
      modal.getByRole("button", { name: /save/i }),
      modal.getByRole("button", { name: /ok/i }),
    ];
    const approveBtn = await resolveFirstVisible(approveCandidates);
    await approveBtn.click();

    // Wait for modal to close
    await modal.waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  }

  /** Returns the title locator for verification screenshots. */
  titleLocator(): Locator {
    return this.page.locator("h1, h2, h3, [class*='title']").first();
  }
}
