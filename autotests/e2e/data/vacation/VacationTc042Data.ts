declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc042Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
  startDateInput: string;
  endDateInput: string;
  /** The earliest valid payment month (2 months before end month), ISO format (YYYY-MM-01). */
  earliestPaymentIso: string;
  /** The latest valid payment month (the end date month), ISO format (YYYY-MM-01). */
  latestPaymentIso: string;
  /** An invalid payment month (3 months before end month — outside allowed range). */
  invalidPaymentIso: string;
}

/**
 * TC-VAC-042: Payment month range — 2 months before to end month.
 * Uses pvaynmaster (token owner) for both UI login and API validation test.
 * Finds a conflict-free week 3+ months ahead so the payment month range
 * spans enough months to test boundaries.
 */
export class VacationTc042Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startDateInput: string;
  readonly endDateInput: string;
  readonly earliestPaymentIso: string;
  readonly latestPaymentIso: string;
  readonly invalidPaymentIso: string;

  constructor(args: Tc042Args) {
    this.username = args.username;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.startDateInput = args.startDateInput;
    this.endDateInput = args.endDateInput;
    this.earliestPaymentIso = args.earliestPaymentIso;
    this.latestPaymentIso = args.latestPaymentIso;
    this.invalidPaymentIso = args.invalidPaymentIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc042Data> {
    if (mode === "static") {
      return new VacationTc042Data({
        username: "pvaynmaster",
        startDateIso: "2026-10-05",
        endDateIso: "2026-10-09",
        startDateInput: "05.10.2026",
        endDateInput: "09.10.2026",
        earliestPaymentIso: "2026-08-01",
        latestPaymentIso: "2026-10-01",
        invalidPaymentIso: "2026-07-01",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc042Args>("VacationTc042Data");
      if (cached) return new VacationTc042Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const login = "pvaynmaster";
      const now = new Date();
      const day = now.getDay();
      const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;

      // Start searching 12+ weeks ahead to ensure enough room for payment range
      for (let w = 12; w < 50; w++) {
        const start = new Date(now);
        start.setDate(now.getDate() + daysToMon + w * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4);
        const startIso = start.toISOString().slice(0, 10);
        const endIso = end.toISOString().slice(0, 10);

        if (await hasVacationConflict(db, login, startIso, endIso)) continue;

        // Payment month range: [endMonth - 2, endMonth]
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        const earliest = new Date(endMonth);
        earliest.setMonth(earliest.getMonth() - 2);
        const invalid = new Date(endMonth);
        invalid.setMonth(invalid.getMonth() - 3);

        const args: Tc042Args = {
          username: login,
          startDateIso: startIso,
          endDateIso: endIso,
          startDateInput: toCalendarFormat(startIso),
          endDateInput: toCalendarFormat(endIso),
          earliestPaymentIso: toIso(earliest),
          latestPaymentIso: toIso(endMonth),
          invalidPaymentIso: toIso(invalid),
        };
        if (mode === "saved") saveToDisk("VacationTc042Data", args);
        return new VacationTc042Data(args);
      }
      throw new Error("No conflict-free week found for pvaynmaster");
    } finally {
      await db.close();
    }
  }
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
