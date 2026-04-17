import { expect, type Page } from "@playwright/test";

export class ApiKeyEditDialog {
  private readonly dialog = this.page.getByRole("dialog", {
    name: /Editing key/i,
  });
  private readonly editButton = this.dialog.getByRole("button", {
    name: /^Edit$/i,
  });
  private readonly allCheckbox = this.dialog.getByRole("checkbox", {
    name: "All",
    exact: true,
  });

  constructor(private readonly page: Page) {}

  /** Waits for the dialog to become visible and checkboxes to settle. */
  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: "visible" });
    // Wait for the "All" checkbox to be interactive (rc-checkbox init)
    await this.allCheckbox.waitFor({ state: "visible" });
  }

  /**
   * Deselects all API methods via the "All" checkbox.
   * Uses .click() instead of .uncheck() because the rc-checkbox
   * component requires a native click to propagate state changes.
   * Waits for the "All" checkbox to be checked first to handle
   * race conditions with dialog initialization.
   */
  async uncheckAll(): Promise<void> {
    // Wait for checkbox state to reflect the loaded data
    await expect(this.allCheckbox).toBeChecked({ timeout: 5000 });
    await this.allCheckbox.click();
    // Verify the click took effect
    await expect(this.allCheckbox).not.toBeChecked({ timeout: 3000 });
  }

  /** Clicks the Edit button and waits for the dialog to close. */
  async submit(): Promise<void> {
    await this.editButton.click();
    await this.dialog.waitFor({ state: "detached" });
  }
}
