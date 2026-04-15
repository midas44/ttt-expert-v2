declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";

interface Tc037Args {
  username: string;
  setupStartIso: string;
  setupEndIso: string;
  overlapStartIso: string;
  overlapEndIso: string;
}

/**
 * TC-VAC-037: Overlapping vacation — crossing check.
 * SETUP: API creates vacation for Mon-Fri (range 1).
 * TEST: UI attempts to create overlapping vacation Wed-next Wed (range 2).
 * Expected: exception.validation.vacation.dates.crossing
 */
export class VacationTc037Data {
  readonly username: string;
  /** Range 1: API setup Mon-Fri */
  readonly setupStartIso: string;
  readonly setupEndIso: string;
  /** Range 2: UI overlap attempt Wed-next Wed */
  readonly overlapStartIso: string;
  readonly overlapEndIso: string;
  readonly overlapStartInput: string;
  readonly overlapEndInput: string;

  constructor(args: Tc037Args) {
    this.username = args.username;
    this.setupStartIso = args.setupStartIso;
    this.setupEndIso = args.setupEndIso;
    this.overlapStartIso = args.overlapStartIso;
    this.overlapEndIso = args.overlapEndIso;
    this.overlapStartInput = toCalendarFormat(args.overlapStartIso);
    this.overlapEndInput = toCalendarFormat(args.overlapEndIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc037Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc037Data({
        username,
        setupStartIso: "2026-10-19",
        setupEndIso: "2026-10-23",
        overlapStartIso: "2026-10-21",
        overlapEndIso: "2026-10-28",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc037Args>("VacationTc037Data");
      if (cached) return new VacationTc037Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find an available week for setup (range 1)
      const { startDate, endDate } =
        await ApiVacationSetupFixture.findAvailableWeek(
          tttConfig,
          username,
          5,
          20,
        );

      // Compute overlapping range 2: Wed of same week to Wed of next week
      const monday = new Date(startDate);
      const wednesday = new Date(monday);
      wednesday.setDate(monday.getDate() + 2);
      const nextWednesday = new Date(monday);
      nextWednesday.setDate(monday.getDate() + 9);

      const args: Tc037Args = {
        username,
        setupStartIso: startDate,
        setupEndIso: endDate,
        overlapStartIso: toIso(wednesday),
        overlapEndIso: toIso(nextWednesday),
      };

      saveToDisk("VacationTc037Data", args);
      return new VacationTc037Data(args);
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
