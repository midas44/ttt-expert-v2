import type { WaitUntilValue } from "./configUtils";

/**
 * Shared contract every project-level config class implements
 * (TttConfig, CsConfig, and future per-project configs).
 *
 * Project-unique fields (TTT's apiToken/dbHost/dashboardPath,
 * CS's employeesPath/salaryOfficesPath, etc.) live on the concrete class.
 */
export interface AppConfig {
  readonly appName: string;
  readonly appUrl: string;
  readonly env: string;
  readonly lang: string;
  readonly logoutUrl: string;
  readonly logoutSuccessText: string;
  readonly waitUntil: WaitUntilValue;

  buildUrl(pathname: string): string;
}
