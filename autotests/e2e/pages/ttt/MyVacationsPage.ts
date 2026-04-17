import type { Page } from "@playwright/test";

/**
 * Standalone lightweight MyVacationsPage.
 * For the full implementation with table operations, use the MyVacationsPage
 * exported from MainPage.ts.
 */
export class MyVacationsPage {
  private readonly title = this.page.locator(
    ".page-body__title:has-text('My vacations and days off')",
  );

  constructor(private readonly page: Page) {}

  /** Waits for the vacations page to be ready. */
  async waitForReady(): Promise<void> {
    await this.title.waitFor({ state: "visible" });
  }
}
