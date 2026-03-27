declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithVacationDays } from "./queries/vacationQueries";

interface Tc035Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-035: Start date > end date — rejected.
 * Computes two future dates where start (Friday) is AFTER end (Monday of same week).
 */
export class VacationTc035Data {
  readonly username: string;
  /** The later date (Friday) — set as start */
  readonly startDateIso: string;
  /** The earlier date (Monday) — set as end */
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;

  constructor(args: Tc035Args) {
    this.username = args.username;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.startInput = toCalendarFormat(args.startDateIso);
    this.endInput = toCalendarFormat(args.endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc035Data> {
    const { startIso, endIso } = computeReversedDates();

    if (mode === "static") {
      return new VacationTc035Data({
        username: process.env.VAC_TC035_USER ?? "pvaynmaster",
        startDateIso: startIso,
        endDateIso: endIso,
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc035Args>("VacationTc035Data");
      if (cached) return new VacationTc035Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const login = await findEmployeeWithVacationDays(db, 5);
      const args: Tc035Args = {
        username: login,
        startDateIso: startIso,
        endDateIso: endIso,
      };
      if (mode === "saved") saveToDisk("VacationTc035Data", args);
      return new VacationTc035Data(args);
    } finally {
      await db.close();
    }
  }
}

/** Returns two future dates where start (Friday) > end (Monday of the same week). */
function computeReversedDates(): { startIso: string; endIso: string } {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMon + 3 * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  // start = Friday (later), end = Monday (earlier) → start > end
  return { startIso: toIso(friday), endIso: toIso(monday) };
}

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
