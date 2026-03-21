declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-006: Create REGULAR vacation with 0 working days (min duration violation)
 *
 * Preconditions:
 * - Active employee
 * - Dates span only weekend days (Sat-Sun) → 0 working days
 * - paymentType = REGULAR
 * Expected: HTTP 400, error code: validation.vacation.duration
 *
 * NOTE: The test documentation says "< 5 days" but the actual
 * minimalVacationDuration config is 1 (not 5). Only vacations with
 * 0 working days trigger this validation. Sat-Sun span = 0 working days.
 */
export class VacationTc006Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly expectedErrorCode: string;
  readonly expectedHttpStatus: number;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc006Data> {
    if (mode === "static") return new VacationTc006Data();
    if (mode === "saved") {
      const cached = loadSaved<{ login: string }>("VacationTc006Data");
      if (cached) return new VacationTc006Data(cached.login);
    }

    const login = process.env.VACATION_TC006_LOGIN ?? "pvaynmaster";
    const instance = new VacationTc006Data(login);
    if (mode === "saved") saveToDisk("VacationTc006Data", { login });
    return instance;
  }

  constructor(login = process.env.VACATION_TC006_LOGIN ?? "slebedev") {
    this.login = login;

    // Find next Saturday at least 14 days ahead
    const now = new Date();
    const base = new Date(now);
    base.setDate(now.getDate() + 14);
    const dayOfWeek = base.getDay(); // 0=Sun, 6=Sat
    const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
    base.setDate(base.getDate() + daysUntilSat);

    const sunday = new Date(base);
    sunday.setDate(base.getDate() + 1);

    this.startDate = toIso(base); // Saturday
    this.endDate = toIso(sunday); // Sunday
    this.paymentType = "REGULAR";
    this.paymentMonth = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-01`;
    this.expectedErrorCode = "validation.vacation.duration";
    this.expectedHttpStatus = 400;
    this.authHeaderName = "API_SECRET_TOKEN";
    this.vacationEndpoint = "/api/vacation/v1/vacations";
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
