declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEmployeeWithVacationDays } from "./queries/vacationQueries";

interface Tc034Args {
  username: string;
  pastDateIso: string;
  pastDateInput: string;
}

/**
 * TC-VAC-034: Start date in past — rejected.
 * Any employee tries to create vacation with yesterday's date.
 * Expected: error shown (validation.vacation.start.date.in.past).
 */
export class VacationTc034Data {
  readonly username: string;
  readonly pastDateIso: string;
  readonly pastDateInput: string;
  readonly endDateIso: string;
  readonly endDateInput: string;

  constructor(args: Tc034Args) {
    this.username = args.username;
    this.pastDateIso = args.pastDateIso;
    this.pastDateInput = args.pastDateInput;
    // End date: same as past start (single day) or one day later
    const endDate = new Date(args.pastDateIso);
    endDate.setDate(endDate.getDate() + 1);
    this.endDateIso = toIso(endDate);
    this.endDateInput = toCalendarFormat(this.endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc034Data> {
    // Yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastIso = toIso(yesterday);
    const pastInput = toCalendarFormat(pastIso);

    if (mode === "static") {
      return new VacationTc034Data({
        username: process.env.VAC_TC034_USER ?? "pvaynmaster",
        pastDateIso: pastIso,
        pastDateInput: pastInput,
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc034Args>("VacationTc034Data");
      if (cached) return new VacationTc034Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const login = await findEmployeeWithVacationDays(db, 5);
      const args: Tc034Args = {
        username: login,
        pastDateIso: pastIso,
        pastDateInput: pastInput,
      };

      saveToDisk("VacationTc034Data", args);
      return new VacationTc034Data(args);
    } finally {
      await db.close();
    }
  }
}

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
