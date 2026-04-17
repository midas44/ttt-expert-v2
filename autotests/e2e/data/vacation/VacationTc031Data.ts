declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";

interface Tc031Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
  startInput: string;
  endInput: string;
}

/**
 * TC-VAC-031: Payment month validation — closed period blocked.
 * Verifies the payment month picker restricts selection to open accounting periods.
 * SETUP: finds available week for pvaynmaster.
 * Test: login → create vacation → verify payment month is within valid range.
 */
export class VacationTc031Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;

  constructor(
    username = process.env.VAC_TC031_USER ?? "pvaynmaster",
    startDateIso = "",
    endDateIso = "",
    startInput = "",
    endInput = "",
  ) {
    this.username = username;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.startInput = startInput;
    this.endInput = endInput;
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc031Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc031Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc031Args>("VacationTc031Data");
      if (cached) {
        return new VacationTc031Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
          cached.startInput,
          cached.endInput,
        );
      }
    }

    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, username, 28);

    const startInput = isoToInput(startDate);
    const endInput = isoToInput(endDate);

    const args: Tc031Args = {
      username,
      startDateIso: startDate,
      endDateIso: endDate,
      startInput,
      endInput,
    };

    saveToDisk("VacationTc031Data", args);
    return new VacationTc031Data(
      args.username,
      args.startDateIso,
      args.endDateIso,
      args.startInput,
      args.endInput,
    );
  }
}

/** Converts ISO date "YYYY-MM-DD" to input format "dd.mm.yyyy". */
function isoToInput(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}
