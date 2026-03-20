import type { Page } from "@playwright/test";

export class PlannerPage {
  private readonly title = this.page.locator(
    ".page-body__title:has-text('Planner')",
  );

  constructor(private readonly page: Page) {}

  /** Waits for the planner page to be ready. */
  async waitForReady(): Promise<void> {
    await this.title.waitFor({ state: "visible" });
  }
}
