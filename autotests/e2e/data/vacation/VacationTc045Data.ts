declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface WeekSlot {
  start: string;
  end: string;
}

interface Tc045Args {
  username: string;
  availableDays: number;
  setupWeeks: WeekSlot[];
  uiWeek: WeekSlot;
  uiStartInput: string;
  uiEndInput: string;
}

/**
 * TC-VAC-045: Accrued days validation — future request auto-conversion (#3015).
 * Uses pvaynmaster. Creates N REGULAR 5-day vacations via API to bring balance
 * just under 5, then tries one more 5-day vacation in UI.
 * Expected: error for insufficient days or auto-conversion to Administrative.
 */
export class VacationTc045Data {
  readonly username: string;
  readonly availableDays: number;
  readonly setupWeeks: WeekSlot[];
  readonly uiWeek: WeekSlot;
  readonly uiStartInput: string;
  readonly uiEndInput: string;

  constructor(args: Tc045Args) {
    this.username = args.username;
    this.availableDays = args.availableDays;
    this.setupWeeks = args.setupWeeks;
    this.uiWeek = args.uiWeek;
    this.uiStartInput = args.uiStartInput;
    this.uiEndInput = args.uiEndInput;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc045Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc045Data({
        username,
        availableDays: 12,
        setupWeeks: [],
        uiWeek: { start: "", end: "" },
        uiStartInput: "",
        uiEndInput: "",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc045Args>("VacationTc045Data");
      if (cached) return new VacationTc045Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Get pvaynmaster's effective days (balance minus pending vacations)
      const balRow = await db.queryOne<{ effective_days: string }>(
        `SELECT (ev.available_vacation_days - COALESCE(
           (SELECT SUM(v.regular_days)
            FROM ttt_vacation.vacation v
            WHERE v.employee = e.id
              AND v.status IN ('NEW', 'APPROVED')
              AND v.payment_type = 'REGULAR'),
           0))::int AS effective_days
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         WHERE e.login = $1
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)`,
        [username],
      );
      const effectiveDays = parseInt(balRow.effective_days, 10);

      // Calculate how many 5-day setup vacations needed:
      // We want (effectiveDays - setupCount*5) < 5 but > 0
      // So setupCount = floor((effectiveDays - 1) / 5)
      const setupCount = Math.floor((effectiveDays - 1) / 5);
      // We need setupCount + 1 free weeks total (setup + UI)
      const totalWeeks = setupCount + 1;

      if (totalWeeks > 20) {
        throw new Error(
          `TC-VAC-045: ${username} has ${effectiveDays} effective days, ` +
            `requiring ${totalWeeks} weeks — too many for this test`,
        );
      }

      // Find enough conflict-free Mon-Fri weeks
      const allWeeks = await findNWeeks(db, username, 4, totalWeeks);

      const setupWeeks = allWeeks.slice(0, setupCount);
      const uiWeek = allWeeks[setupCount];

      const args: Tc045Args = {
        username,
        availableDays: effectiveDays,
        setupWeeks,
        uiWeek,
        uiStartInput: toCalendarFormat(uiWeek.start),
        uiEndInput: toCalendarFormat(uiWeek.end),
      };

      if (mode === "saved") saveToDisk("VacationTc045Data", args);
      return new VacationTc045Data(args);
    } finally {
      await db.close();
    }
  }
}

async function findNWeeks(
  db: DbClient,
  login: string,
  weeksAhead: number,
  count: number,
): Promise<WeekSlot[]> {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const base = new Date(now);
  base.setDate(now.getDate() + daysToMon + weeksAhead * 7);

  const weeks: WeekSlot[] = [];
  for (let i = 0; i < 80 && weeks.length < count; i++) {
    const start = new Date(base);
    start.setDate(base.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 4);

    const s = toIso(start);
    const e = toIso(end);
    if (!(await hasVacationConflict(db, login, s, e))) {
      weeks.push({ start: s, end: e });
    }
  }
  if (weeks.length < count) {
    throw new Error(
      `Could not find ${count} free weeks for ${login} (found ${weeks.length})`,
    );
  }
  return weeks;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
