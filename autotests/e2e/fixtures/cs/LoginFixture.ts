import type { Page } from "@playwright/test";
import type { CsConfig } from "@cs/config/csConfig";
import type { GlobalConfig } from "@common/config/globalConfig";
import { LoginPage } from "@cs/pages/LoginPage";

declare const process: { env: Record<string, string | undefined> };

/**
 * Logs into CS via CAS SSO. Tolerates the SSO short-circuit case where
 * a prior login (TTT or CS) in the same BrowserContext already provided
 * the CAS cookie — in that case the CS login form is skipped and we
 * navigate straight to the CS dashboard.
 *
 * For cross-project tests, prefer creating a separate BrowserContext
 * for CS so each app's session stays clean.
 */
export class LoginFixture {
  private readonly loginPage: LoginPage;
  private readonly username: string;
  private readonly password: string;

  constructor(
    private readonly page: Page,
    private readonly csConfig: CsConfig,
    username?: string,
    password?: string,
    private readonly globalConfig?: GlobalConfig,
  ) {
    this.username = username ?? process.env.CS_USERNAME ?? csConfig.username;
    this.password = password ?? process.env.CS_PASSWORD ?? csConfig.password;
    this.loginPage = new LoginPage(page, csConfig);
  }

  /** Navigate -> (submit if login form shown) -> delay. */
  async run(): Promise<void> {
    await this.loginPage.goto();
    if (await this.loginPage.isLoginFormVisible()) {
      await this.loginPage.submitCredentials(this.username, this.password);
    }
    await this.globalConfig?.delay();
  }
}
