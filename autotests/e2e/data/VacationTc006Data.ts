declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-006: Create REGULAR vacation with 0 working days.
 *
 * API test: POST /api/vacation/v1/vacations with Sat-Sun REGULAR vacation.
 * Expects: HTTP 400, errorCode: validation.vacation.duration
 *
 * Discovery: minimalVacationDuration is configured as 1 (not 5 as Javadoc claims).
 * The check compares working days (not calendar days) against the minimum.
 * A Sat-Sun vacation has 0 working days < 1 minimum, triggering the validation.
 */
export class VacationTc006Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly expectedStatus = 400;
  readonly expectedErrorCode = "validation.vacation.duration";

  static async create(
    _mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc006Data> {
    // Compute a future Sat-Sun range (0 working days) dynamically
    return new VacationTc006Data("pvaynmaster");
  }

  constructor(
    login = process.env.VACATION_TC006_LOGIN ?? "pvaynmaster",
  ) {
    this.login = login;
    // Find next Saturday far enough in the future, then set Sat-Sun (0 working days)
    const today = new Date();
    const day = today.getDay();
    // daysUntilSaturday: 0=Sun→6, 1=Mon→5, 2=Tue→4, 3=Wed→3, 4=Thu→2, 5=Fri→1, 6=Sat→7
    const daysUntilSaturday = day === 6 ? 7 : 6 - day;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysUntilSaturday + 20 * 7);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    this.startDate = toIso(saturday);
    this.endDate = toIso(sunday);
    this.paymentMonth = this.startDate.slice(0, 7) + "-01";
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
