import { expect, type Page } from "@playwright/test";
import type { TttConfig } from "../config/tttConfig";
import type { GlobalConfig } from "../config/globalConfig";
import { MainPage } from "../pages/MainPage";
import { LogoutPage } from "../pages/LogoutPage";

export class LogoutFixture {
  private readonly mainPage: MainPage;
  private readonly logoutPage: LogoutPage;

  constructor(
    private readonly page: Page,
    private readonly tttConfig: TttConfig,
    private readonly globalConfig: GlobalConfig,
  ) {
    this.mainPage = new MainPage(page);
    this.logoutPage = new LogoutPage(page, tttConfig);
  }

  /**
   * Full logout workflow via UI:
   * 1. Waits for networkidle
   * 2. Opens user menu
   * 3. Clicks logout
   * 4. Handles optional confirmation dialog
   * 5. Waits for navigation to logout URL
   * 6. Verifies success message
   */
  async run(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    await this.mainPage.openUserMenu();

    // Handle optional "Are you sure?" dialog
    this.page.once("dialog", async (dialog) => {
      await dialog.accept();
    });

    await this.mainPage.logoutButton().click();
    await this.logoutPage.waitForNavigation();
    await expect(this.logoutPage.successMessage()).toBeVisible();
    await this.globalConfig.delay();
  }

  /** Logout via direct URL navigation, then verify success message. */
  async runViaDirectUrl(): Promise<void> {
    await this.page.goto(`${this.tttConfig.appUrl}/logout`);
    await this.logoutPage.waitForNavigation();
    await expect(this.logoutPage.successMessage()).toBeVisible();
    await this.globalConfig.delay();
  }
}
