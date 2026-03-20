declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
/**
 * Test data for TC-VAC-015: Create with null optionalApprovers — NPE bug (CPO path).
 *
 * API test: POST /api/vacation/v1/vacations as CPO (ROLE_DEPARTMENT_MANAGER) user.
 * Omits optionalApprovers field (null), triggering NPE at getOptionalApprovers().add().
 * KNOWN BUG: HTTP 500 NullPointerException at VacationServiceImpl:155.
 * CPO path: employee.getManager() != null && isCPO → setApproverId(self) + add manager to optionalApprovers.
 *
 * Uses pvaynmaster who has ROLE_DEPARTMENT_MANAGER + manager (ilnitsky) — triggers CPO path.
 * Must use pvaynmaster because API_SECRET_TOKEN authenticates as this user (@CurrentUser check).
 */
export class VacationTc015Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc015Data> {
    if (mode === "static") return new VacationTc015Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    // pvaynmaster is CPO (ROLE_DEPARTMENT_MANAGER) with manager ilnitsky
    // Must use pvaynmaster — API_SECRET_TOKEN authenticates as this user
    return new VacationTc015Data("pvaynmaster", "2028-09-04", "2028-09-08");
  }

  constructor(
    login = process.env.VACATION_TC015_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC015_START ?? "2028-09-04",
    endDate = process.env.VACATION_TC015_END ?? "2028-09-08",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
  }

  /** Build create body WITHOUT optionalApprovers — triggers NPE on CPO path */
  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      // optionalApprovers intentionally omitted — triggers NPE on CPO path
      // CPO code: request.getOptionalApprovers().add(manager) → NPE on null list
      notifyAlso: [],
    };
  }
}
