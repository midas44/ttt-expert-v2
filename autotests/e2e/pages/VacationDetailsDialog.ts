import type { Page, Locator } from "@playwright/test";

export class VacationDetailsDialog {
  private readonly dialog = this.page.getByRole("dialog", {
    name: /Request details/i,
  });
  private readonly deleteButton = this.dialog.getByRole("button", {
    name: /delete/i,
  });

  constructor(private readonly page: Page) {}

  /** Waits for the details dialog to become visible. */
  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: "visible" });
  }

  /** Returns the root dialog locator. */
  root(): Locator {
    return this.dialog;
  }

  /** Closes the details dialog. Tries Close button, then Escape key. */
  async close(): Promise<void> {
    const closeBtn = this.dialog.getByRole("button", { name: /close/i });
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click();
    } else {
      await this.page.keyboard.press("Escape");
    }
    await this.dialog.waitFor({ state: "detached" });
  }

  /**
   * Deletes the vacation request:
   * 1. Clicks Delete button in the details dialog
   * 2. Waits for confirmation dialog
   * 3. Clicks the confirmation Delete button
   * 4. Waits for dialogs to detach
   */
  async deleteRequest(): Promise<void> {
    await this.deleteButton.click();

    // Handle "Delete the request?" confirmation dialog
    const confirmDialog = this.page.getByRole("dialog", {
      name: /Delete the request/i,
    });
    await confirmDialog.waitFor({ state: "visible" });
    await confirmDialog.getByRole("button", { name: /delete/i }).click();

    // Wait for both dialogs to close
    await confirmDialog.waitFor({ state: "detached" });
    await this.dialog.waitFor({ state: "detached" });
  }
}
