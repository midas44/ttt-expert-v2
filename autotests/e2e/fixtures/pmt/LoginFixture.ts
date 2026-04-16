import type { Page } from "@playwright/test";
import type { PmtConfig } from "@pmt/config/pmtConfig";
import type { GlobalConfig } from "@common/config/globalConfig";
import { LoginPage } from "@pmt/pages/LoginPage";

declare const process: { env: Record<string, string | undefined> };

/**
 * Logs into PMT via CAS SSO. Tolerates the SSO short-circuit case where
 * a prior login (TTT, CS, or PMT) in the same BrowserContext already
 * provided the CAS cookie — in that case the PMT login form is skipped
 * and we navigate straight to the PMT dashboard.
 *
 * For cross-project tests, prefer creating a separate BrowserContext
 * for PMT so each app's session stays clean.
 */
export class LoginFixture {
  private readonly loginPage: LoginPage;
  private readonly username: string;
  private readonly password: string;

  constructor(
    private readonly page: Page,
    private readonly pmtConfig: PmtConfig,
    username?: string,
    password?: string,
    private readonly globalConfig?: GlobalConfig,
  ) {
    this.username = username ?? process.env.PMT_USERNAME ?? pmtConfig.username;
    this.password = password ?? process.env.PMT_PASSWORD ?? pmtConfig.password;
    this.loginPage = new LoginPage(page, pmtConfig);
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
