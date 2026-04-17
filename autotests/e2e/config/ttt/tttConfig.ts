import * as path from "path";
import {
  readYaml,
  readString,
  readWaitUntil,
  type WaitUntilValue,
} from "@common/config/configUtils";
import type { AppConfig } from "@common/config/appConfig";

// Resolve paths relative to project root (autotests/), pointing to shared config/ttt/
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const TTT_YML = path.resolve(PROJECT_ROOT, "config/ttt/ttt.yml");
const ENV_DIR = path.resolve(PROJECT_ROOT, "config/ttt/envs");

export class TttConfig implements AppConfig {
  readonly appName: string;
  readonly appUrl: string;
  readonly env: string;
  readonly lang: string;
  readonly dashboardPath: string;
  readonly logoutUrl: string;
  readonly waitUntil: WaitUntilValue;
  readonly logoutSuccessText: string;
  readonly apiToken: string;
  readonly dbHost: string;
  readonly dbPort: number;
  readonly dbName: string;
  readonly dbUsername: string;
  readonly dbPassword: string;

  constructor() {
    const data = readYaml(TTT_YML);

    this.appName = readString(
      data["appName"],
      "TTT (TimeTrackingTool aka TimeReportingTool)",
      "appName",
    );
    this.env = readString(data["env"], "qa-1", "env");
    this.lang = readString(data["lang"], "en", "lang");

    // Load env-specific YAML (empty string is valid — means env has no value)
    const envData = readYaml(path.resolve(ENV_DIR, `${this.env}.yml`));
    this.apiToken = String(envData["apiToken"] ?? "");
    this.dbHost = String(envData["dbHost"] ?? "");
    this.dbPort = Number(envData["dbPort"] ?? 5433);
    this.dbName = String(envData["initialDatabase"] ?? "ttt");
    this.dbUsername = String(envData["dbUsername"] ?? "");
    this.dbPassword = String(envData["dbPassword"] ?? "");
    this.dashboardPath = readString(
      data["dashboardPath"],
      "/report",
      "dashboardPath",
    );
    this.logoutUrl = readString(
      data["logoutUrl"],
      "https://cas-demo.noveogroup.com/logout",
      "logoutUrl",
    );
    this.waitUntil = readWaitUntil(data["waitUntil"]);
    this.logoutSuccessText = readString(
      data["logoutSuccessText"],
      "Logout successful",
      "logoutSuccessText",
    );

    this.appUrl = this.resolveAppUrl(
      readString(
        data["appUrl"],
        "https://ttt-***.noveogroup.com",
        "appUrl",
      ),
    );
  }

  /** Replaces `***` in the URL template with the env name and validates the result. */
  private resolveAppUrl(template: string): string {
    const resolved = template.replace("***", this.env);
    try {
      new URL(resolved);
    } catch {
      throw new Error(
        `Invalid resolved appUrl: "${resolved}" (template: "${template}", env: "${this.env}")`,
      );
    }
    return resolved;
  }

  /** Constructs a full URL by joining `appUrl` with the given pathname. */
  buildUrl(pathname: string): string {
    return new URL(pathname, this.appUrl).toString();
  }
}
