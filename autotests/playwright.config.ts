import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";
import { GlobalConfig } from "./e2e/config/globalConfig";
import type { BrowserName } from "./e2e/config/configUtils";

const globalConfig = new GlobalConfig();

const BROWSERS: BrowserName[] = ["chrome", "firefox"];

const TAG_CONFIG: Record<string, RegExp> = {
  debug: /@debug/,
  smoke: /@smoke/,
  regress: /@regress/,
};

function resolveBrowserSettings(
  browser: BrowserName,
): PlaywrightTestConfig["use"] {
  switch (browser) {
    case "chrome":
      return {
        browserName: "chromium",
        launchOptions: {
          args: [
            `--window-position=${globalConfig.windowPositionX},${globalConfig.windowPositionY}`,
            `--window-size=${globalConfig.windowWidth},${globalConfig.windowHeight}`,
            "--no-proxy-server",
          ],
          env: {
            ...process.env,
            HTTP_PROXY: "",
            HTTPS_PROXY: "",
            http_proxy: "",
            https_proxy: "",
          },
        },
      };
    case "edge":
      return { browserName: "chromium", channel: "msedge" };
    case "firefox":
      return {
        browserName: "firefox",
        launchOptions: {
          firefoxUserPrefs: {
            "ui.systemUsesDarkTheme": 1,
            "dom.disable_window_move_resize": false,
            "network.proxy.type": 0,
          },
        },
      };
  }
}

function buildSharedUse(
  browser: BrowserName,
  headless: boolean,
): PlaywrightTestConfig["use"] {
  return {
    baseURL: globalConfig.appUrl,
    headless,
    actionTimeout: globalConfig.stepTimeoutMs,
    navigationTimeout: globalConfig.stepTimeoutMs,
    viewport: {
      width: globalConfig.windowWidth,
      height: globalConfig.windowHeight,
    },
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
    ...resolveBrowserSettings(browser),
  };
}

// Headed projects (for manual debugging and interactive runs)
const headedProjects = BROWSERS.flatMap((browser) =>
  Object.entries(TAG_CONFIG).map(([tag, grep]) => ({
    name: `${browser}-${tag}`,
    grep,
    use: buildSharedUse(browser, false),
  })),
);

// Headless projects (for autonomous Phase C verification)
const headlessProjects = (["chrome"] as BrowserName[]).map((browser) => ({
  name: `${browser}-headless`,
  grep: /@regress|@smoke/,
  use: buildSharedUse(browser, true),
}));

export default defineConfig({
  globalSetup: "./globalSetup.ts",
  globalTeardown: "./globalTeardown.ts",
  reporter: [
    ["line"],
    ["html", { open: "never" }],
    ["./e2e/reporters/jsonResultsReporter.ts"],
  ],
  testDir: "./e2e/tests",
  timeout: 180_000,
  expect: { timeout: 10_000 },
  projects: [...headedProjects, ...headlessProjects],
});
