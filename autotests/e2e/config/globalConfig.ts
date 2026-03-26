import * as path from "path";
import type { Page } from "@playwright/test";
import { readYaml, readNumber, readTestDataMode, type TestDataMode } from "./configUtils";
import { TttConfig } from "./tttConfig";

const GLOBAL_YML = path.resolve(__dirname, "global.yml");

export class GlobalConfig {
  readonly globalTimeout: number;
  /** Per-action timeout (click, fill, waitFor, etc.) in milliseconds. */
  readonly stepTimeoutMs: number;
  readonly windowPositionX: number;
  readonly windowPositionY: number;
  readonly fixtureDelayMs: number;
  readonly windowWidth: number;
  readonly windowHeight: number;
  readonly testDataMode: TestDataMode;
  readonly appUrl: string;

  private readonly tttConfig: TttConfig;

  constructor(tttConfig: TttConfig = new TttConfig()) {
    this.tttConfig = tttConfig;
    this.appUrl = tttConfig.appUrl;

    const data = readYaml(GLOBAL_YML);

    this.globalTimeout = readNumber(data["globalTimeout"], 15000, "globalTimeout");
    this.stepTimeoutMs = readNumber(data["stepTimeoutMs"], 30000, "stepTimeoutMs");
    this.windowPositionX = readNumber(data["windowPositionX"], 300, "windowPositionX");
    this.windowPositionY = readNumber(data["windowPositionY"], 80, "windowPositionY");
    this.fixtureDelayMs = readNumber(data["fixtureDelayMs"], 500, "fixtureDelayMs");
    this.windowWidth = readNumber(data["windowWidth"], 2560, "windowWidth");
    this.windowHeight = readNumber(data["windowHeight"], 1440, "windowHeight");
    this.testDataMode = readTestDataMode(data["testDataMode"]);
  }

  /** Returns a promise that resolves after `fixtureDelayMs` milliseconds. */
  delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.fixtureDelayMs));
  }

  /** Sets viewport size and positions the browser window (browser-specific). */
  async applyViewport(page: Page): Promise<void> {
    await page.setViewportSize({
      width: this.windowWidth,
      height: this.windowHeight,
    });
    await this.positionWindow(page);
  }

  private async positionWindow(page: Page): Promise<void> {
    const x = this.windowPositionX;
    const y = this.windowPositionY;

    try {
      // CDP works only on Chromium — use it for position only
      const cdp = await page.context().newCDPSession(page);
      const { windowId } = await cdp.send("Browser.getWindowForTarget");
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { left: x, top: y },
      });
    } catch {
      // CDP unavailable (Firefox) — fall back to window.moveTo
      try {
        await page.evaluate(
          ([px, py]) => window.moveTo(px, py),
          [x, y] as const,
        );
      } catch {
        // Silently ignore
      }
    }
  }
}
