declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findAccountantForEmployee } from "./queries/vacationQueries";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";

interface Tc025Args {
  accountantLogin: string;
  vacationOwner: string;
  startDateIso: string;
  endDateIso: string;
  paymentMonth: string;
  paymentMonthLabel: string;
}

/**
 * TC-VAC-025: Pay APPROVED REGULAR vacation — happy path.
 * SETUP: API creates + approves a vacation for pvaynmaster.
 * Test: login as accountant → Vacation Payment page → pay the vacation.
 * NOTE: PAID+EXACT vacations are terminal and undeletable.
 */
export class VacationTc025Data {
  readonly accountantLogin: string;
  readonly vacationOwner: string;
  readonly vacationOwnerName: string;
  /** Last name only — payment page uses "Last First" format */
  readonly vacationOwnerLastName: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly paymentMonth: string;
  readonly paymentMonthLabel: string;
  readonly periodPattern: RegExp;

  constructor(args: Tc025Args, ownerName = "Pavel Weinmeister") {
    this.accountantLogin = args.accountantLogin;
    this.vacationOwner = args.vacationOwner;
    this.vacationOwnerName = ownerName;
    this.vacationOwnerLastName = ownerName.split(" ").pop() ?? ownerName;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.paymentMonth = args.paymentMonth;
    this.paymentMonthLabel = args.paymentMonthLabel;
    this.periodPattern = toPeriodPattern(args.startDateIso, args.endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc025Data> {
    const vacationOwner = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc025Data({
        accountantLogin: process.env.VAC_TC025_ACCOUNTANT ?? "iromanenko",
        vacationOwner,
        startDateIso: "2026-10-05",
        endDateIso: "2026-10-09",
        paymentMonth: "2026-10-01",
        paymentMonthLabel: "Oct 2026",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc025Args>("VacationTc025Data");
      if (cached) return new VacationTc025Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find an accountant assigned to pvaynmaster's salary office
      const accountant = await findAccountantForEmployee(db, vacationOwner);

      // Find an available week for pvaynmaster (2 weeks ahead — stays within visible month tabs)
      const { startDate, endDate } =
        await ApiVacationSetupFixture.findAvailableWeek(
          tttConfig,
          vacationOwner,
          2,
          20,
        );

      const paymentMonth = `${startDate.slice(0, 8)}01`;
      const paymentMonthLabel = toMonthLabel(startDate);

      // Get vacation owner's display name
      const ownerRow = await db.queryOne<{ display_name: string }>(
        `SELECT COALESCE(be.latin_first_name || ' ' || be.latin_last_name, e.login) AS display_name
         FROM ttt_vacation.employee e
         JOIN ttt_backend.employee be ON be.login = e.login
         WHERE e.login = $1`,
        [vacationOwner],
      );

      const args: Tc025Args = {
        accountantLogin: accountant.login,
        vacationOwner,
        startDateIso: startDate,
        endDateIso: endDate,
        paymentMonth,
        paymentMonthLabel,
      };

      saveToDisk("VacationTc025Data", args);
      return new VacationTc025Data(args, ownerRow.display_name);
    } finally {
      await db.close();
    }
  }
}

function toMonthLabel(iso: string): string {
  const MONTHS = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const [y, m] = iso.split("-");
  return `${MONTHS[parseInt(m, 10)]} ${y}`;
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
