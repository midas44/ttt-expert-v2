import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * TC-VAC-016: Create with non-existent employee login
 *
 * Preconditions: Invalid login string
 * Expected: HTTP 400, validation error from @EmployeeLoginExists annotation
 *   errors[].field = "login"
 *
 * No DB query needed — deliberately uses a login that does not exist.
 */
export class VacationTc016Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly expectedHttpStatus: number;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    _mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc016Data> {
    // All modes return the same static data — invalid login by design
    return new VacationTc016Data();
  }

  constructor(
    login = "nonexistent_user_xyz_tc016",
    startDate = "2026-07-06",
    endDate = "2026-07-10",
    paymentMonth = "2026-07-01",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentType = "REGULAR";
    this.paymentMonth = paymentMonth;
    this.expectedHttpStatus = 400;
    this.authHeaderName = "API_SECRET_TOKEN";
    this.vacationEndpoint = "/api/vacation/v1/vacations";
  }
}
