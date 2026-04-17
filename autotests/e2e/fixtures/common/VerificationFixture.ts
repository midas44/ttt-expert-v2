import { expect, type Page, type TestInfo, type Locator } from "@playwright/test";
import type { GlobalConfig } from "@common/config/globalConfig";
import { collectCandidateColors, isGreenDominant } from "@utils/colorAnalysis";
import { slugify } from "@utils/stringUtils";

export class VerificationFixture {
  constructor(
    private readonly page: Page,
    private readonly globalConfig: GlobalConfig,
  ) {}

  /** Asserts that the given text is visible on the page. */
  async verify(text: string, testInfo: TestInfo): Promise<string> {
    await this.globalConfig.delay();
    await expect(this.page.locator(`text=${text}`)).toBeVisible();
    return this.captureScreenshot(testInfo, `verify-text-${text}`);
  }

  /** Asserts that the given locator is visible. */
  async verifyLocatorVisible(
    locator: Locator,
    testInfo: TestInfo,
    description: string,
  ): Promise<string> {
    await this.globalConfig.delay();
    await expect(locator).toBeVisible();
    return this.captureScreenshot(testInfo, description);
  }

  /** Asserts that the given locator contains the expected text. */
  async verifyLocatorText(
    locator: Locator,
    expectedText: string,
    testInfo: TestInfo,
    description: string,
  ): Promise<string> {
    await this.globalConfig.delay();
    await expect(locator).toContainText(expectedText);
    return this.captureScreenshot(testInfo, description);
  }

  /** Asserts that the given locator's text content is empty or whitespace-only. */
  async verifyLocatorEmpty(
    locator: Locator,
    testInfo: TestInfo,
    description: string,
  ): Promise<string> {
    await this.globalConfig.delay();
    await expect(locator).toHaveText(/^\s*$/);
    return this.captureScreenshot(testInfo, description);
  }

  /** Asserts that the given locator's input/textarea value matches the expected value. */
  async verifyLocatorValue(
    locator: Locator,
    expectedValue: string,
    testInfo: TestInfo,
    description: string,
  ): Promise<string> {
    await this.globalConfig.delay();
    await expect(locator).toHaveValue(expectedValue);
    return this.captureScreenshot(testInfo, description);
  }

  /**
   * Asserts that the locator's element has a dominant green color
   * (G > R and G > B in at least one color property).
   */
  async verifyLocatorDominantGreen(
    locator: Locator,
    testInfo: TestInfo,
    description: string,
  ): Promise<string> {
    await this.globalConfig.delay();
    const colors = await collectCandidateColors(locator);
    const hasGreen = colors.some(isGreenDominant);
    expect(
      hasGreen,
      `Expected dominant green color in element, found colors: ${JSON.stringify(colors)}`,
    ).toBeTruthy();
    return this.captureScreenshot(testInfo, description);
  }

  /**
   * Captures a full-page screenshot at a named checkpoint and attaches it to the report.
   * Use for explicit verification steps where no assertion is needed — just visual evidence.
   */
  async captureStep(
    testInfo: TestInfo,
    description: string,
  ): Promise<string> {
    await this.globalConfig.delay();
    return this.captureScreenshot(testInfo, description);
  }

  /**
   * Captures a full-page screenshot and attaches it to the Playwright report.
   * Returns the screenshot file path.
   */
  private async captureScreenshot(
    testInfo: TestInfo,
    description: string,
  ): Promise<string> {
    const slug = slugify(description);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `verification-${slug}-${timestamp}.png`;

    const filePath = testInfo.outputPath(name);
    await this.page.screenshot({ fullPage: true, path: filePath });
    await testInfo.attach(name, {
      path: filePath,
      contentType: "image/png",
    });

    return name;
  }
}
