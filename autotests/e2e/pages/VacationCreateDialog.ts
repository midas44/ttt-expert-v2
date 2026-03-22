import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  collectColoredText,
  isRedDominant,
  type ColoredTextEntry,
} from "../utils/colorAnalysis";
import { resolveFirstVisible, pollForMatch } from "../utils/locatorResolver";

/** Month name → zero-based index lookup for calendar navigation. */
const MONTH_MAP: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3,
  May: 4, June: 5, July: 6, August: 7,
  September: 8, October: 9, November: 10, December: 11,
};

export class VacationCreateDialog {
  private readonly dialog = this.page.getByRole("dialog", {
    name: /(Creating|Editing) vacation request/i,
  });
  private readonly unpaidCheckbox = this.dialog.locator(
    "input[type='checkbox']",
  );
  private readonly datePickerInputs = this.dialog.locator(
    "input.date-picker__input",
  );
  private readonly saveButton = this.dialog.getByRole("button", {
    name: /save/i,
  });

  // Lazily cached locators
  private cachedCommentInput: Locator | null = null;
  private cachedNotifyInput: Locator | null = null;

  constructor(private readonly page: Page) {}

  /** Waits for the dialog to become visible. */
  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: "visible" });
  }

  /** Returns the root dialog locator. */
  root(): Locator {
    return this.dialog;
  }

  /** Returns the unpaid vacation checkbox locator. */
  unpaidCheckboxLocator(): Locator {
    return this.unpaidCheckbox;
  }

  /**
   * Fills the vacation period by selecting start and end dates via the calendar widget.
   * Dates must be in "dd.mm.yyyy" format.
   */
  async fillVacationPeriod(start: string, end: string): Promise<void> {
    await this.selectDate(0, start);
    await this.selectDate(1, end);
  }

  /** Ensures the "unpaid vacation" checkbox is checked. */
  async ensureUnpaidVacationChecked(): Promise<void> {
    const isChecked = await this.unpaidCheckbox.isChecked();
    if (!isChecked) {
      await this.unpaidCheckbox.check();
    }
  }

  /**
   * Fills the "Also notify" autocomplete input and selects a suggestion.
   * Uses multi-strategy fallback for the input field and suggestion container.
   */
  async fillAlsoNotify(
    username: string,
    displayName: string,
  ): Promise<void> {
    const input = await this.ensureNotifyInput();
    await input.fill(username);

    // Wait for suggestions to appear
    const suggestionCandidates = [
      this.page.locator(".react-autosuggest__suggestions-container li"),
      this.page.locator("[class*='suggestion'] li"),
      this.page.locator("[role='listbox'] [role='option']"),
      this.page.locator("[class*='Select'] [class*='option']"),
    ];

    const suggestion = await pollForMatch(
      suggestionCandidates.map((loc) =>
        loc.filter({ hasText: displayName }),
      ),
      { timeout: 7000 },
    );
    await suggestion.click();
  }

  /** Asserts that the given display name appears in the notify selection. */
  async assertNotifySelected(displayName: string): Promise<void> {
    await expect(this.dialog.locator(`text=${displayName}`)).toBeVisible();
  }

  /** Fills the comment field. */
  async fillComment(comment: string): Promise<void> {
    const input = await this.ensureCommentInput();
    await input.fill(comment);
  }

  /** Asserts that no red-colored text is present in the dialog. */
  async assertNoRedText(): Promise<void> {
    const entries = await this.getRedTextEntries();
    expect(
      entries,
      `Expected no red text in dialog, found: ${entries.map((e) => e.text).join(", ")}`,
    ).toHaveLength(0);
  }

  /** Asserts that red text does not dominate the dialog (allows minor red elements). */
  async assertNoDominantRedText(): Promise<void> {
    const allEntries = await collectColoredText(this.dialog);
    const redEntries = allEntries.filter(isRedDominant);
    const ratio =
      allEntries.length > 0 ? redEntries.length / allEntries.length : 0;
    expect(
      ratio,
      `Red text ratio ${ratio.toFixed(2)} exceeds threshold`,
    ).toBeLessThan(0.3);
  }

  /** Clicks the Save button to submit the form. */
  async submit(): Promise<void> {
    await this.saveButton.click();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Sets a date via the calendar table adjacent to the date picker input.
   * Clicks the input to open the calendar, navigates to the target month,
   * then clicks the correct day cell.
   */
  private async selectDate(
    pickerIndex: number,
    dateStr: string,
  ): Promise<void> {
    const [dayStr, monthStr, yearStr] = dateStr.split(".");
    const targetDay = parseInt(dayStr, 10);
    const targetMonth = parseInt(monthStr, 10) - 1;
    const targetYear = parseInt(yearStr, 10);

    const input = this.datePickerInputs.nth(pickerIndex);
    await input.click();

    // The calendar table is rendered as a sibling of the input inside the
    // same parent wrapper. Find it via the input's grandparent container.
    const calendarTable = input.locator("..").locator("table").first();
    await calendarTable.waitFor({ state: "visible", timeout: 5000 });

    // Navigate to the target month/year using ‹/› header buttons
    const prevButton = calendarTable.locator("th").filter({ hasText: "‹" });
    const nextButton = calendarTable.locator("th").filter({ hasText: "›" });

    for (let attempts = 0; attempts < 24; attempts++) {
      const headerText = await calendarTable
        .locator("thead tr")
        .first()
        .locator("th")
        .nth(1)
        .textContent();
      if (!headerText) break;

      const { month, year } = this.parseCalendarHeader(headerText.trim());
      if (month === targetMonth && year === targetYear) break;

      const target = targetYear * 12 + targetMonth;
      const current = year * 12 + month;

      if (target > current) {
        await nextButton.click();
      } else {
        await prevButton.click();
      }
    }

    // Click the target day. Adjacent-month cells (grayed-out) use a CSS class
    // like rdtOld/rdtNew or reduced opacity. Try the class-based filter first,
    // then fall back to clicking the first cell that isn't obviously from
    // another month.
    const currentMonthDay = calendarTable.locator(
      "tbody td:not(.rdtOld):not(.rdtNew)",
    ).filter({ hasText: new RegExp(`^${targetDay}$`) });

    if ((await currentMonthDay.count()) > 0) {
      await currentMonthDay.first().click();
      return;
    }

    // Fallback: if no rdtOld/rdtNew classes, select by matching day text
    // and skipping grayed-out cells (opacity < 1 or lighter text color).
    const allDayCells = await calendarTable.locator("tbody td").all();
    for (const cell of allDayCells) {
      const text = (await cell.textContent())?.trim();
      if (text !== String(targetDay)) continue;

      const isGrayed = await cell.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return (
          parseFloat(s.opacity) < 0.5 ||
          el.classList.contains("rdtOld") ||
          el.classList.contains("rdtNew")
        );
      });

      if (!isGrayed) {
        await cell.click();
        return;
      }
    }

    // Last resort: click any cell with the target day number
    const anyDay = calendarTable
      .locator("tbody td")
      .filter({ hasText: new RegExp(`^${targetDay}$`) });
    await anyDay.first().click();
  }

  /** Parses a calendar header like "December 2025" into month index and year. */
  private parseCalendarHeader(header: string): {
    month: number;
    year: number;
  } {
    const parts = header.split(/\s+/);
    const monthName = parts[0];
    const year = parseInt(parts[parts.length - 1], 10);
    const month = MONTH_MAP[monthName] ?? 0;
    return { month, year };
  }

  /** Lazily resolves and caches the comment input locator. */
  private async ensureCommentInput(): Promise<Locator> {
    if (this.cachedCommentInput) return this.cachedCommentInput;

    const candidates = [
      this.dialog.getByRole("textbox", { name: /comment/i }),
      this.dialog.locator("textarea"),
      this.dialog.locator("input[name*='comment' i]"),
      this.dialog.locator("input[placeholder*='comment' i]"),
    ];
    this.cachedCommentInput = await resolveFirstVisible(candidates);
    return this.cachedCommentInput;
  }

  /** Lazily resolves and caches the "Also notify" input locator (8 fallback strategies). */
  private async ensureNotifyInput(): Promise<Locator> {
    if (this.cachedNotifyInput) return this.cachedNotifyInput;

    const candidates = [
      this.dialog.getByRole("combobox"),
      this.dialog.getByRole("textbox", { name: /notify/i }),
      this.dialog.locator(
        "//label[contains(text(),'notify')]/following::input[1]",
      ),
      this.dialog.locator("input[name*='notify' i]"),
      this.dialog.locator("input[placeholder*='notify' i]"),
      this.dialog.locator("input[data-qa*='notify']"),
      this.dialog.locator("input.react-autosuggest__input"),
      this.dialog.locator("[class*='Select'] input"),
    ];
    this.cachedNotifyInput = await resolveFirstVisible(candidates);
    return this.cachedNotifyInput;
  }

  /** Reads the payment month field value from the dialog. */
  async getPaymentMonthText(): Promise<string> {
    // Wait for payment dates API response
    await this.page.waitForResponse(
      (resp) => resp.url().includes("/paymentdates") && resp.status() === 200,
      { timeout: 5000 },
    ).catch(() => {});

    // The payment month is the 3rd date-picker input (after start and end)
    const count = await this.datePickerInputs.count();
    if (count >= 3) {
      return (await this.datePickerInputs.nth(2).inputValue())?.trim() ?? "";
    }

    // Fallback: read text from the payment month label area
    const label = this.dialog.locator("text=/salary for/i").first();
    if ((await label.count()) > 0) {
      const parent = label.locator("..");
      const text = (await parent.textContent()) ?? "";
      const match = text.match(
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}/i,
      );
      return match ? match[0].trim() : "";
    }
    return "";
  }

  /** Closes the dialog without saving (Escape key). */
  async cancel(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.dialog.waitFor({ state: "detached" }).catch(() => {});
  }

  /** Returns all text entries in the dialog that have red-dominant color. */
  private async getRedTextEntries(): Promise<ColoredTextEntry[]> {
    const entries = await collectColoredText(this.dialog);
    return entries.filter(isRedDominant);
  }
}
