import { expect, type Page } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";
import type { GlobalConfig } from "@common/config/globalConfig";
import { LoginPage } from "@ttt/pages/LoginPage";

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_USERNAME = process.env.TTT_USERNAME ?? "pvaynmaster";

export class LoginFixture {
  private readonly loginPage: LoginPage;
  private readonly username: string;

  constructor(
    private readonly page: Page,
    private readonly tttConfig: TttConfig,
    username?: string,
    private readonly globalConfig?: GlobalConfig,
  ) {
    this.username = username ?? DEFAULT_USERNAME;
    this.loginPage = new LoginPage(page, tttConfig);
  }

  /** Full login workflow: navigate → submit credentials → assert dashboard → delay. */
  async run(): Promise<void> {
    await this.login();
    await this.assertOnDashboard();
    await this.globalConfig?.delay();
  }

  /** Navigates to the app and submits the username. */
  async login(): Promise<void> {
    await this.loginPage.goto();
    await this.loginPage.submitUsername(this.username);
  }

  /** Asserts the current URL matches the dashboard path. */
  async assertOnDashboard(): Promise<void> {
    expect(this.page.url()).toContain(this.tttConfig.dashboardPath);
  }
}
