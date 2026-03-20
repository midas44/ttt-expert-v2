import type { Page, Locator } from "@playwright/test";
import type { TttConfig } from "../config/tttConfig";

export class LogoutPage {
  private readonly logoutSuccessMessage: Locator;

  constructor(
    private readonly page: Page,
    private readonly config: TttConfig,
  ) {
    this.logoutSuccessMessage = this.page.locator(
      `text=${this.config.logoutSuccessText}`,
    );
  }

  /** Waits for the page URL to match the logout URL (with optional query params). */
  async waitForNavigation(): Promise<void> {
    const logoutBase = this.config.logoutUrl.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    await this.page.waitForURL(new RegExp(`^${logoutBase}(\\?.*)?$`));
  }

  /** Returns the locator for the logout success message. */
  successMessage(): Locator {
    return this.logoutSuccessMessage;
  }
}
