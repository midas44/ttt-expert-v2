declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc072Args {
  username: string;
  initialStartIso: string;
  initialEndIso: string;
  newStartIso: string;
  newEndIso: string;
  initialPaymentMonth: string;
  expectedPaymentMonth: string;
}

/**
 * TC-VAC-072: Regression — Payment month not updated in edit modal (#2705).
 * Finds two conflict-free Mon–Fri weeks in DIFFERENT months for pvaynmaster.
 * The test creates a vacation in month A, edits to month B, and verifies
 * the payment month auto-updates to month B (and persists after save).
 */
export class VacationTc072Data {
  readonly username: string;
  readonly initialStartIso: string;
  readonly initialEndIso: string;
  readonly newStartIso: string;
  readonly newEndIso: string;
  readonly initialStartInput: string;
  readonly initialEndInput: string;
  readonly newStartInput: string;
  readonly newEndInput: string;
  readonly periodPattern: RegExp;
  readonly newPeriodPattern: RegExp;
  /** Expected payment month after edit, e.g. "01.08.2026" (1st of the new month). */
  readonly expectedPaymentMonth: string;
  /** Initial payment month, e.g. "01.07.2026". */
  readonly initialPaymentMonth: string;

  constructor(args: Tc072Args) {
    this.username = args.username;
    this.initialStartIso = args.initialStartIso;
    this.initialEndIso = args.initialEndIso;
    this.newStartIso = args.newStartIso;
    this.newEndIso = args.newEndIso;
    this.initialStartInput = toCalendarFormat(args.initialStartIso);
    this.initialEndInput = toCalendarFormat(args.initialEndIso);
    this.newStartInput = toCalendarFormat(args.newStartIso);
    this.newEndInput = toCalendarFormat(args.newEndIso);
    this.periodPattern = toPeriodPattern(
      args.initialStartIso,
      args.initialEndIso,
    );
    this.newPeriodPattern = toPeriodPattern(args.newStartIso, args.newEndIso);
    this.expectedPaymentMonth = args.expectedPaymentMonth;
    this.initialPaymentMonth = args.initialPaymentMonth;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc072Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc072Data({
        username,
        initialStartIso: "2026-09-14",
        initialEndIso: "2026-09-18",
        newStartIso: "2026-10-12",
        newEndIso: "2026-10-16",
        initialPaymentMonth: "01.09.2026",
        expectedPaymentMonth: "01.10.2026",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc072Args>("VacationTc072Data");
      if (cached) return new VacationTc072Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find two conflict-free weeks in different months
      const now = new Date();
      const day = now.getDay();
      const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
      const base = new Date(now);
      base.setDate(now.getDate() + daysToMon + 10 * 7);

      let firstWeek: { start: string; end: string; month: number } | null =
        null;

      for (let i = 0; i < 40; i++) {
        const start = new Date(base);
        start.setDate(base.getDate() + i * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4);

        const startIso = toIso(start);
        const endIso = toIso(end);
        const month = start.getMonth();

        if (await hasVacationConflict(db, username, startIso, endIso)) continue;

        if (!firstWeek) {
          firstWeek = { start: startIso, end: endIso, month };
        } else if (month !== firstWeek.month) {
          // Second week in a different month — we have our pair
          const args: Tc072Args = {
            username,
            initialStartIso: firstWeek.start,
            initialEndIso: firstWeek.end,
            newStartIso: startIso,
            newEndIso: endIso,
            initialPaymentMonth: toPaymentMonth(firstWeek.start),
            expectedPaymentMonth: toPaymentMonth(startIso),
          };
          if (mode === "saved") saveToDisk("VacationTc072Data", args);
          return new VacationTc072Data(args);
        }
      }
      throw new Error(
        "Could not find two conflict-free weeks in different months for TC-VAC-072",
      );
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

/** Returns "01.MM.YYYY" for a given ISO date — the first day of that month. */
function toPaymentMonth(iso: string): string {
  const [y, m] = iso.split("-");
  return `01.${m}.${y}`;
}

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}
