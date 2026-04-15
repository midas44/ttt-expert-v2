declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEmployeeWithVacationDays } from "./queries/vacationQueries";

interface Tc038Args {
  username: string;
  saturdayIso: string;
  sundayIso: string;
}

/**
 * TC-VAC-038: Weekend-only vacation (0 working days) — rejected.
 * Selects Saturday-Sunday range — 0 working days.
 * Expected: minimum duration validation error.
 */
export class VacationTc038Data {
  readonly username: string;
  readonly saturdayIso: string;
  readonly sundayIso: string;
  readonly startInput: string;
  readonly endInput: string;

  constructor(args: Tc038Args) {
    this.username = args.username;
    this.saturdayIso = args.saturdayIso;
    this.sundayIso = args.sundayIso;
    this.startInput = toCalendarFormat(args.saturdayIso);
    this.endInput = toCalendarFormat(args.sundayIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc038Data> {
    const { satIso, sunIso } = computeWeekendDates();

    if (mode === "static") {
      return new VacationTc038Data({
        username: process.env.VAC_TC038_USER ?? "pvaynmaster",
        saturdayIso: satIso,
        sundayIso: sunIso,
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc038Args>("VacationTc038Data");
      if (cached) return new VacationTc038Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const login = await findEmployeeWithVacationDays(db, 5);
      const args: Tc038Args = {
        username: login,
        saturdayIso: satIso,
        sundayIso: sunIso,
      };
      saveToDisk("VacationTc038Data", args);
      return new VacationTc038Data(args);
    } finally {
      await db.close();
    }
  }
}

/** Returns Saturday and Sunday dates ~3 weeks ahead. */
function computeWeekendDates(): { satIso: string; sunIso: string } {
  const now = new Date();
  const day = now.getDay();
  const daysToSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(now);
  sat.setDate(now.getDate() + daysToSat + 2 * 7);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  return { satIso: toIso(sat), sunIso: toIso(sun) };
}

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
