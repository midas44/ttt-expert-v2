import type { Page } from "@playwright/test";

/**
 * Page object for the "Redirect the rescheduling request" dialog.
 * Appears when clicking the redirect action button on a dayoff request row.
 */
export class RedirectDialog {
  private readonly dialog = this.page.getByRole("dialog");

  /** Manager search input inside the dialog. */
  private readonly managerInput = this.dialog.locator(
    "input[type='text'], input[role='combobox']",
  );

  /** OK/Submit button. */
  private readonly okButton = this.dialog.getByRole("button", {
    name: /^(OK|Ок)$/i,
  });

  /** Cancel button. */
  private readonly cancelButton = this.dialog.getByRole("button", {
    name: /^(Cancel|Отмена)$/i,
  });

  constructor(private readonly page: Page) {}

  /** Wait for the redirect dialog to appear. */
  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: "visible" });
  }

  /** Wait for the redirect dialog to close. */
  async waitForClose(): Promise<void> {
    await this.dialog.waitFor({ state: "hidden" });
  }

  /** Type a manager name into the search input and select from dropdown. */
  async selectManager(managerName: string): Promise<void> {
    // Click the react-select control to open it, then type to filter
    const selectControl = this.dialog.locator("[class*='control']").first();
    await selectControl.click();
    // Type the last name (second word) to search — more unique than first name
    const parts = managerName.split(" ");
    const searchTerm = parts.length > 1 ? parts[1] : parts[0];
    await this.page.keyboard.type(searchTerm);
    // Wait for dropdown options to appear and click the matching one
    const option = this.page.locator("[class*='option']", {
      hasText: new RegExp(searchTerm, "i"),
    });
    await option.first().click({ timeout: 10_000 });
  }

  /** Click the OK button to confirm redirect. */
  async clickOk(): Promise<void> {
    await this.okButton.click();
  }

  /** Click Cancel to dismiss. */
  async clickCancel(): Promise<void> {
    await this.cancelButton.click();
  }

  /** Check if the OK button is enabled. */
  async isOkEnabled(): Promise<boolean> {
    return this.okButton.isEnabled();
  }
}
