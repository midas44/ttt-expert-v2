declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface SlotDates {
  start: string;
  end: string;
}

interface Tc058Args {
  username: string;
  setupSlots: SlotDates[];
  uiSlot: SlotDates;
  uiStartInput: string;
  uiEndInput: string;
}

/**
 * TC-VAC-058: AV=true — negative balance allowed for current year.
 *
 * Uses pvaynmaster (AV=true, CPO, ~82 days balance).
 * Creates 4 × 4-week vacations via API (80 biz days) to nearly exhaust balance,
 * then the test creates 1 more via UI (5 biz days) to push balance negative.
 */
export class VacationTc058Data {
  readonly username: string;
  readonly setupSlots: SlotDates[];
  readonly uiSlot: SlotDates;
  readonly uiStartInput: string;
  readonly uiEndInput: string;

  constructor(
    username = process.env.VAC_TC058_USER ?? "pvaynmaster",
    setupSlots: SlotDates[] = [],
    uiSlot: SlotDates = { start: "", end: "" },
    uiStartInput = "",
    uiEndInput = "",
  ) {
    this.username = username;
    this.setupSlots = setupSlots;
    this.uiSlot = uiSlot;
    this.uiStartInput = uiStartInput;
    this.uiEndInput = uiEndInput;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc058Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc058Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc058Args>("VacationTc058Data");
      if (cached) {
        return new VacationTc058Data(
          cached.username,
          cached.setupSlots,
          cached.uiSlot,
          cached.uiStartInput,
          cached.uiEndInput,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      // Get current balance to know how many setup vacations we need
      const balRow = await db.queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(ev.available_vacation_days), 0)::text AS total
         FROM ttt_vacation.employee ve
         JOIN ttt_vacation.employee_vacation ev ON ve.id = ev.employee
         WHERE ve.login = $1`,
        [username],
      );
      const totalBalance = Math.round(parseFloat(balRow.total));

      // Use 1-week (5 biz day) slots — system max vacation duration is < 2 weeks
      // We want remaining balance < 5 so one more 5-day vacation pushes negative
      const slotsNeeded = Math.ceil((totalBalance - 4) / 5);
      const cappedSlots = Math.min(slotsNeeded, 18); // Cap at 18 to keep practical

      // Find non-overlapping 1-week slots staying in 2026 (production calendar)
      const slots: SlotDates[] = [];
      let weekOffset = 12;

      for (let i = 0; i < cappedSlots; i++) {
        const slot = await findSlot(db, username, weekOffset, 1);
        slots.push(slot);
        // Jump past this slot — each 1-week slot advances by ~1 week
        weekOffset = nextWeekOffset(slot.end) + 1;
      }

      // Find one more 1-week slot for the UI creation
      const uiSlot = await findSlot(db, username, weekOffset, 1);

      const args: Tc058Args = {
        username,
        setupSlots: slots,
        uiSlot,
        uiStartInput: isoToInput(uiSlot.start),
        uiEndInput: isoToInput(uiSlot.end),
      };

      saveToDisk("VacationTc058Data", args);
      return new VacationTc058Data(
        username,
        slots,
        uiSlot,
        args.uiStartInput,
        args.uiEndInput,
      );
    } finally {
      await db.close();
    }
  }
}

/** Find a conflict-free N-week Mon-Fri slot. */
async function findSlot(
  db: DbClient,
  login: string,
  weeksAhead: number,
  weekCount: number,
  maxAttempts = 15,
): Promise<SlotDates> {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;

  for (let i = 0; i < maxAttempts; i++) {
    const start = new Date(now);
    start.setDate(now.getDate() + daysToMon + (weeksAhead + i) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + weekCount * 7 - 3); // Friday of last week

    const startIso = toIso(start);
    const endIso = toIso(end);

    if (!(await hasVacationConflict(db, login, startIso, endIso))) {
      return { start: startIso, end: endIso };
    }
  }
  throw new Error(`No conflict-free ${weekCount}-week slot for ${login}`);
}

/** Compute the week offset from now for a given ISO date. */
function nextWeekOffset(endIso: string): number {
  const now = new Date();
  const end = new Date(endIso);
  const diffDays = Math.ceil(
    (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.ceil(diffDays / 7);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoToInput(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
