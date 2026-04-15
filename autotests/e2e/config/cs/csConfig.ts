import * as path from "path";
import {
  readYaml,
  readString,
  readWaitUntil,
  type WaitUntilValue,
} from "@common/config/configUtils";
import type { AppConfig } from "@common/config/appConfig";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const CS_YAML = path.resolve(PROJECT_ROOT, "config/cs/cs.yaml");
const ENV_DIR = path.resolve(PROJECT_ROOT, "config/cs/envs");

export class CsConfig implements AppConfig {
  readonly appName: string;
  readonly appUrl: string;
  readonly env: string;
  readonly lang: string;
  readonly logoutUrl: string;
  readonly logoutSuccessText: string;
  readonly waitUntil: WaitUntilValue;

  readonly profilePath: string;
  readonly employeesPath: string;
  readonly contractorsPath: string;
  readonly salaryOfficesPath: string;

  readonly username: string;
  readonly password: string;

  constructor() {
    const data = readYaml(CS_YAML);

    this.appName = readString(data["appName"], "CS (Company Staff)", "appName");
    this.env = readString(data["env"], "preprod", "env");
    this.lang = readString(data["lang"], "en", "lang");

    this.profilePath = readString(data["profilePath"], "/preferences", "profilePath");
    this.employeesPath = readString(
      data["employeesPath"],
      "/employee/active/list",
      "employeesPath",
    );
    this.contractorsPath = readString(
      data["contractorsPath"],
      "/contractors?tab=active",
      "contractorsPath",
    );
    this.salaryOfficesPath = readString(
      data["salaryOfficesPath"],
      "/settings/salary-office?tab=list",
      "salaryOfficesPath",
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
      readString(data["appUrl"], "https://cs-***.noveogroup.com", "appUrl"),
    );

    const envData = readYaml(path.resolve(ENV_DIR, `${this.env}.yaml`));
    this.username = readString(envData["username"], "slebedev", "username");
    this.password = readString(envData["password"], "slebedev", "password");
  }

  private resolveAppUrl(template: string): string {
    const resolved = template.replace("***", this.env);
    try {
      new URL(resolved);
    } catch {
      throw new Error(
        `Invalid resolved CS appUrl: "${resolved}" (template: "${template}", env: "${this.env}")`,
      );
    }
    return resolved;
  }

  buildUrl(pathname: string): string {
    return new URL(pathname, this.appUrl).toString();
  }
}
