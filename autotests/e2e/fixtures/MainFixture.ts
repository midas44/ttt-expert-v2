import { expect, type Page } from "@playwright/test";
import type { TttConfig } from "../config/tttConfig";
import type { GlobalConfig } from "../config/globalConfig";
import { MainPage, type LanguageCode } from "../pages/MainPage";

export class MainFixture {
  private readonly mainPage: MainPage;

  constructor(
    private readonly page: Page,
    private readonly tttConfig: TttConfig,
    private readonly globalConfig: GlobalConfig,
  ) {
    this.mainPage = new MainPage(page);
  }

  /**
   * Ensures the UI is set to the target language.
   * Checks current language, switches if needed, soft-asserts the result, delays.
   * Returns the resulting language code.
   */
  async ensureLanguage(target: LanguageCode): Promise<LanguageCode> {
    const current = await this.mainPage.getCurrentLanguage();
    if (current !== target) {
      await this.mainPage.setLanguage(target);
    }
    const result = await this.mainPage.getCurrentLanguage();
    expect.soft(result).toBe(target);
    await this.globalConfig.delay();
    return result;
  }
}
