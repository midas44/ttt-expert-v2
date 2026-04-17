import type { Page } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";

export class LoginPage {
  private readonly usernameInput = this.page.locator("input[name='username']");
  private readonly loginButton = this.page.locator(
    "button:has-text('LOGIN')",
  );

  constructor(
    private readonly page: Page,
    private readonly config: TttConfig,
  ) {}

  /** Navigates to the application URL. */
  async goto(): Promise<void> {
    await this.page.goto(this.config.appUrl, {
      waitUntil: this.config.waitUntil,
    });
  }

  /** Fills the username, clicks login, and waits for navigation to the dashboard. */
  async submitUsername(username: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.loginButton.click();
    await this.page.waitForURL(`**${this.config.dashboardPath}**`);
    const loadState = this.config.waitUntil === "commit" ? "load" : this.config.waitUntil;
    await this.page.waitForLoadState(loadState);
  }
}
