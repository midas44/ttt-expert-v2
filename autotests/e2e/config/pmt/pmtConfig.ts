import * as path from "path";
import {
  readYaml,
  readString,
  readWaitUntil,
  type WaitUntilValue,
} from "@common/config/configUtils";
import type { AppConfig } from "@common/config/appConfig";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const PMT_YAML = path.resolve(PROJECT_ROOT, "config/pmt/pmt.yaml");
const ENV_DIR = path.resolve(PROJECT_ROOT, "config/pmt/envs");

export class PmtConfig implements AppConfig {
  readonly appName: string;
  readonly appUrl: string;
  readonly env: string;
  readonly lang: string;
  readonly logoutUrl: string;
  readonly logoutSuccessText: string;
  readonly waitUntil: WaitUntilValue;

  readonly projectsPath: string;

  readonly username: string;
  readonly password: string;

  constructor() {
    const data = readYaml(PMT_YAML);

    this.appName = readString(data["appName"], "PMT (PM Tool)", "appName");
    this.env = readString(data["env"], "preprod", "env");
    this.lang = readString(data["lang"], "en", "lang");

    this.projectsPath = readString(data["projectsPath"], "/projects", "projectsPath");

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
      readString(data["appUrl"], "https://pm-***.noveogroup.com", "appUrl"),
    );

    const envData = readYaml(path.resolve(ENV_DIR, `${this.env}.yaml`));
    this.username = readString(envData["username"], "pvaynmaster", "username");
    this.password = readString(envData["password"], "pvaynmaster", "password");
  }

  private resolveAppUrl(template: string): string {
    const resolved = template.replace("***", this.env);
    try {
      new URL(resolved);
    } catch {
      throw new Error(
        `Invalid resolved PMT appUrl: "${resolved}" (template: "${template}", env: "${this.env}")`,
      );
    }
    return resolved;
  }

  buildUrl(pathname: string): string {
    return new URL(pathname, this.appUrl).toString();
  }
}
