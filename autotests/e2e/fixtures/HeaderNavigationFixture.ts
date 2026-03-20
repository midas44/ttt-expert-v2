import type { Page } from "@playwright/test";
import type { GlobalConfig } from "../config/globalConfig";

export class HeaderNavigationFixture {
  constructor(
    private readonly page: Page,
    private readonly globalConfig: GlobalConfig,
  ) {}

  /**
   * Navigates using the header menu.
   * Accepts "Menu" for top-level or "Menu > Submenu" for dropdown items.
   */
  async navigate(path: string): Promise<void> {
    const segments = path.split(">").map((s) => s.trim());

    if (segments.length === 1) {
      await this.clickTopLevel(segments[0]);
    } else if (segments.length === 2) {
      await this.clickDropdown(segments[0], segments[1]);
    } else {
      throw new Error(
        `Invalid navigation path "${path}": expected 1-2 segments separated by ">"`,
      );
    }

    await this.page.waitForLoadState("networkidle");
    await this.globalConfig.delay();
  }

  private async clickTopLevel(label: string): Promise<void> {
    const menuItem = this.page
      .locator(".page-header .navbar__list-item")
      .filter({ hasText: label });

    // Try clicking a link first, then a button
    const link = menuItem.locator(".navbar__link");
    const button = menuItem.locator(".navbar__item");

    try {
      await link.first().click({ timeout: 3000 });
    } catch {
      await button.first().click();
    }
  }

  private async clickDropdown(
    menuLabel: string,
    submenuLabel: string,
  ): Promise<void> {
    // Open the dropdown
    const menuItem = this.page
      .locator(".page-header .navbar__list-item")
      .filter({ hasText: menuLabel });

    const trigger = menuItem.locator(".navbar__item, .navbar__link");
    await trigger.first().click();

    // Click the submenu item
    const submenuItem = this.page.locator(
      ".navbar__list-drop-item, .drop-down-menu__option",
    ).filter({ hasText: submenuLabel });

    await submenuItem.first().click();
  }
}
