declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-071: AV=true — full year available immediately.
 *
 * API test: GET /api/vacation/v1/vacationdays/available
 * Verifies that AV=true employees see full annual norm (not monthly proration).
 * pvaynmaster is in AV=true office (Персей), norm = 24 days/year.
 */
export class VacationTc071Data {
  readonly login: string;
  readonly paymentDate: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationDaysEndpoint = "/api/vacation/v1/vacationdays/available";
  /** Annual norm for pvaynmaster */
  readonly annualNorm = 24;

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc071Data> {
    if (mode === "static") return new VacationTc071Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    // Use 1st of next month as paymentDate
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const paymentDate = toIso(nextMonth);

    return new VacationTc071Data("pvaynmaster", paymentDate);
  }

  constructor(
    login = process.env.VACATION_TC071_LOGIN ?? "pvaynmaster",
    paymentDate = process.env.VACATION_TC071_PAYMENT_DATE ?? "2026-04-01",
  ) {
    this.login = login;
    this.paymentDate = paymentDate;
  }

  /** Builds the query string for GET /vacationdays/available */
  buildQueryString(): string {
    return `?employeeLogin=${this.login}&paymentDate=${this.paymentDate}&newDays=0`;
  }

  /**
   * For AV=false, monthly proration in March would give: 3 * (24/12) = 6 days.
   * For AV=true, the full year (24) is available from Jan 1.
   * If availablePaidDays > prorated amount, AV=true is confirmed.
   */
  get monthlyProratedAmount(): number {
    const month = new Date().getMonth() + 1; // 1-based
    return month * (this.annualNorm / 12);
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
