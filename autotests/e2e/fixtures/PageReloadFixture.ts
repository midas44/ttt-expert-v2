import type { Page } from "@playwright/test";
import type { TttConfig } from "../config/tttConfig";
import type { GlobalConfig } from "../config/globalConfig";

export class PageReloadFixture {
  constructor(
    private readonly page: Page,
    private readonly tttConfig: TttConfig,
    private readonly globalConfig: GlobalConfig,
  ) {}

  /** Reloads the page with the configured waitUntil, waits for networkidle, then delays. */
  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: this.tttConfig.waitUntil });
    await this.page.waitForLoadState("networkidle");
    await this.globalConfig.delay();
  }
}
