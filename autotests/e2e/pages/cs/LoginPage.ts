import type { Page } from "@playwright/test";
import type { CsConfig } from "@cs/config/csConfig";

/**
 * CS login page. CS shares CAS SSO with TTT (cas-demo.noveogroup.com),
 * so an existing session in the same browser context redirects past the
 * login form straight to the CS dashboard. The fixture must check the
 * username input visibility before filling.
 *
 * Selector strategy: text-first / role-first per CLAUDE.md selector rules.
 * Adjust selectors when the first cross-project spec is authored against
 * the live CS UI — this is a stub seeded from the TTT login flow.
 */
export class LoginPage {
  private readonly usernameInput = this.page.locator("input[name='username']");
  private readonly passwordInput = this.page.locator("input[name='password']");
  private readonly loginButton = this.page.getByRole("button", { name: /login|войти/i });

  constructor(
    private readonly page: Page,
    private readonly config: CsConfig,
  ) {}

  /** Navigates to the CS application URL. */
  async goto(): Promise<void> {
    await this.page.goto(this.config.appUrl, {
      waitUntil: this.config.waitUntil,
    });
  }

  /** True when the CAS login form is visible (i.e., no active SSO session). */
  async isLoginFormVisible(): Promise<boolean> {
    return this.usernameInput.isVisible({ timeout: 2_000 }).catch(() => false);
  }

  /** Fills credentials and submits. Returns once navigation settles. */
  async submitCredentials(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    const loadState = this.config.waitUntil === "commit" ? "load" : this.config.waitUntil;
    await this.page.waitForLoadState(loadState);
  }
}
