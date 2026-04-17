declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc079Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-079: Ghost conflicts from soft-deleted vacations.
 * Finds a conflict-free Mon–Fri week for pvaynmaster so the test can
 * create a vacation, cancel it (CANCELED status), then attempt to
 * create again at the same dates. The crossing validation should block
 * the second create because it includes CANCELED/DELETED records.
 */
export class VacationTc079Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;

  constructor(args: Tc079Args) {
    this.username = args.username;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.startInput = toCalendarFormat(args.startDateIso);
    this.endInput = toCalendarFormat(args.endDateIso);
    this.periodPattern = toPeriodPattern(args.startDateIso, args.endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc079Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc079Data({
        username,
        startDateIso: "2026-09-07",
        endDateIso: "2026-09-11",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc079Args>("VacationTc079Data");
      if (cached) return new VacationTc079Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const now = new Date();
      const day = now.getDay();
      const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
      const base = new Date(now);
      base.setDate(now.getDate() + daysToMon + 12 * 7);

      for (let i = 0; i < 30; i++) {
        const start = new Date(base);
        start.setDate(base.getDate() + i * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4);

        const startIso = toIso(start);
        const endIso = toIso(end);

        if (!(await hasVacationConflict(db, username, startIso, endIso))) {
          const args: Tc079Args = {
            username,
            startDateIso: startIso,
            endDateIso: endIso,
          };
          saveToDisk("VacationTc079Data", args);
          return new VacationTc079Data(args);
        }
      }
      throw new Error("No conflict-free week found for TC-VAC-079");
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
