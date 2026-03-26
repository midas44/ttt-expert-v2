import type { Page, Locator } from "@playwright/test";
import { resolveFirstVisible } from "../utils/locatorResolver";

/**
 * Page object for the "Reschedule event" / "Перенести событие" modal.
 * Opens when clicking the edit pencil on a day-off row.
 * Supports both English and Russian UI languages.
 */
export class RescheduleDialog {
  /** Dialog container. */
  private readonly dialog = this.page.getByRole("dialog");

  /** OK / Submit button — matches Latin "OK" and Cyrillic "ОК". */
  private readonly okButton = this.dialog.getByRole("button", {
    name: /^(OK|ОК)$/i,
  });

  /** Cancel button — matches English and Russian labels. */
  private readonly cancelButton = this.dialog.getByRole("button", {
    name: /^(Cancel|Отменить|Отмена)$/i,
  });

  /** Calendar picker table inside the dialog. */
  private readonly calendarTable = this.dialog.locator("table");

  constructor(private readonly page: Page) {}

  /** Wait for the dialog to be visible. */
  async waitForOpen(): Promise<void> {
    const candidates = [
      this.dialog,
      this.page.locator("[class*='modal'][class*='visible']"),
      this.page.locator("[class*='Modal']"),
    ];
    await resolveFirstVisible(candidates, { timeout: 10000 });
  }

  /** Returns whether the OK button is enabled. */
  async isOkEnabled(): Promise<boolean> {
    return this.okButton.isEnabled({ timeout: 5000 });
  }

  /** Clicks the OK button to confirm. */
  async clickOk(): Promise<void> {
    await this.okButton.click();
  }

  /** Clicks Cancel to close without saving. */
  async clickCancel(): Promise<void> {
    await this.cancelButton.click();
  }

  /** Wait for the dialog to close. */
  async waitForClose(): Promise<void> {
    await this.dialog.waitFor({ state: "hidden", timeout: 10000 });
  }

  /**
   * Selects a date in the calendar picker.
   * Navigates months if needed to find the target date.
   *
   * @param day - day of month (1-31)
   * @param month - 0-indexed month (0=Jan, 11=Dec)
   * @param year - full year
   */
  async selectDate(day: number, month: number, year: number): Promise<void> {
    await this.navigateToMonth(month, year);

    // Click the day cell — match exact day number within current month cells
    // Exclude old/new month overflow cells using class filters or row context
    const dayCells = this.calendarTable.locator(
      "td:not(.rdtOld):not(.rdtNew)",
    );
    const dayCell = dayCells.filter({
      hasText: new RegExp(`^${day}$`),
    });
    await dayCell.first().click();
  }

  /** Returns whether a specific day is disabled in the calendar. */
  async isDayDisabled(day: number): Promise<boolean> {
    const dayCells = this.calendarTable
      .locator("td:not(.rdtOld):not(.rdtNew)")
      .filter({ hasText: new RegExp(`^\\s*${day}\\s*$`) });
    const count = await dayCells.count();
    if (count === 0) return true; // Day cell not found — treat as disabled
    const cls = await dayCells.first().getAttribute("class");
    return cls?.includes("rdtDisabled") ?? false;
  }

  /** Returns true if the current calendar month has at least one non-disabled day. */
  async hasAvailableDays(): Promise<boolean> {
    const available = this.calendarTable.locator(
      "td:not(.rdtOld):not(.rdtNew):not(.rdtDisabled)",
    );
    const count = await available.count();
    return count > 0;
  }

  /**
   * Selects the first available (non-disabled, non-old, non-new) day
   * in the currently displayed calendar month.
   * Returns the day number selected, or null if no available day found.
   */
  async selectFirstAvailableDate(): Promise<number | null> {
    const activeCells = this.calendarTable.locator(
      "td:not(.rdtOld):not(.rdtNew):not(.rdtDisabled):not(.rdtActive)",
    );
    const count = await activeCells.count();
    for (let i = 0; i < count; i++) {
      const cell = activeCells.nth(i);
      const text = (await cell.textContent())?.trim();
      if (text && /^\d{1,2}$/.test(text)) {
        await cell.click();
        return parseInt(text, 10);
      }
    }
    return null;
  }

  /** Returns the currently displayed month (0-indexed) and year from the calendar header. */
  async getCurrentMonthYear(): Promise<{ month: number; year: number }> {
    const headerCell = this.calendarTable.locator("th").nth(1);
    const headerText = (await headerCell.textContent())?.trim() ?? "";
    return this.parseCalendarHeader(headerText);
  }

  /** Clicks the next month (›) button in the calendar header row. */
  async clickNextMonth(): Promise<void> {
    await this.calendarTable
      .locator("thead tr")
      .first()
      .locator("th")
      .last()
      .click();
    await this.page.waitForTimeout(200);
  }

  /** Clicks the previous month (‹) button in the calendar header row. */
  async clickPrevMonth(): Promise<void> {
    await this.calendarTable
      .locator("thead tr")
      .first()
      .locator("th")
      .first()
      .click();
    await this.page.waitForTimeout(200);
  }

  /** Returns whether ALL current-month day cells are disabled (or none exist). */
  async areAllCurrentMonthDaysDisabled(): Promise<boolean> {
    return this.calendarTable
      .locator("td:not(.rdtOld):not(.rdtNew)")
      .evaluateAll((cells: Element[]) =>
        cells.length === 0 ||
        cells.every((c) => c.classList.contains("rdtDisabled")),
      );
  }

  /** Returns arrays of enabled and disabled day numbers for the currently displayed month. */
  async getDayStates(): Promise<{ enabled: number[]; disabled: number[] }> {
    return this.calendarTable
      .locator("td:not(.rdtOld):not(.rdtNew)")
      .evaluateAll((cells: Element[]) => {
        const enabled: number[] = [];
        const disabled: number[] = [];
        for (const c of cells) {
          const text = c.textContent?.trim();
          if (!text || !/^\d{1,2}$/.test(text)) continue;
          const day = parseInt(text, 10);
          if (c.classList.contains("rdtDisabled")) {
            disabled.push(day);
          } else {
            enabled.push(day);
          }
        }
        return { enabled, disabled };
      });
  }

  /** Navigate to a specific month/year in the calendar (public wrapper). */
  async navigateToTargetMonth(
    targetMonth: number,
    targetYear: number,
  ): Promise<void> {
    return this.navigateToMonth(targetMonth, targetYear);
  }

  /** Navigate to a specific month/year in the calendar. */
  private async navigateToMonth(
    targetMonth: number,
    targetYear: number,
  ): Promise<void> {
    for (let i = 0; i < 24; i++) {
      // The month/year header cell in the calendar
      const headerCell = this.calendarTable.locator("th").nth(1);
      const headerText = await headerCell.textContent();
      if (!headerText) break;

      const { month: currentMonth, year: currentYear } =
        this.parseCalendarHeader(headerText.trim());

      if (currentMonth === targetMonth && currentYear === targetYear) return;

      const currentTotal = currentYear * 12 + currentMonth;
      const targetTotal = targetYear * 12 + targetMonth;

      const headerRow = this.calendarTable
        .locator("thead tr")
        .first();
      if (targetTotal > currentTotal) {
        // Click next (›) — last th in first header row
        await headerRow.locator("th").last().click();
      } else {
        // Click prev (‹) — first th in first header row
        await headerRow.locator("th").first().click();
      }
      await this.page.waitForTimeout(200);
    }
  }

  private parseCalendarHeader(text: string): {
    month: number;
    year: number;
  } {
    // Strip commas and split: "June 2026" or "Июнь, 2026"
    const cleaned = text.replace(/,/g, "").trim();
    const parts = cleaned.split(/\s+/);
    const monthName = parts[0];
    const year = parseInt(parts[parts.length - 1], 10);

    const monthsEn = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december",
    ];
    const monthsRu = [
      "январь", "февраль", "март", "апрель", "май", "июнь",
      "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
    ];

    const lower = monthName.toLowerCase();
    let month = monthsEn.indexOf(lower);
    if (month < 0) month = monthsRu.indexOf(lower);

    return { month: month >= 0 ? month : 0, year: isNaN(year) ? 2026 : year };
  }
}
