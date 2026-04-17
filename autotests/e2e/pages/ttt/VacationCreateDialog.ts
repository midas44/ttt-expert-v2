import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  collectColoredText,
  isRedDominant,
  type ColoredTextEntry,
} from "@utils/colorAnalysis";
import { resolveFirstVisible, pollForMatch } from "@utils/locatorResolver";

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

  /** Returns true if the Save button is enabled (not disabled). */
  async isSaveEnabled(): Promise<boolean> {
    return this.saveButton.isEnabled();
  }

  /**
   * Returns validation paragraph text shown in the dialog form area.
   * These are `<p>` elements near the date pickers that display messages like
   * "Vacation cannot be shorter than 1 day" or "You already have a vacation request...".
   */
  async getValidationMessage(): Promise<string> {
    const paragraphs = this.dialog.locator("p");
    const count = await paragraphs.count();
    const messages: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await paragraphs.nth(i).textContent())?.trim() ?? "";
      if (text.length > 0 && text.length < 200) {
        messages.push(text);
      }
    }
    return messages.join(" | ");
  }

  /**
   * Fills a date picker input directly by typing (bypasses calendar widget).
   * Useful for testing invalid date combinations that the calendar auto-corrects.
   */
  async fillDateDirect(pickerIndex: number, dateStr: string): Promise<void> {
    const input = this.datePickerInputs.nth(pickerIndex);
    await input.click();
    await input.fill(dateStr);
    await this.page.keyboard.press("Tab");
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

  /** Reads the "Number of days" value from the dialog.
   *  DOM structure: `<div><strong>Number of days:</strong> 5</div>` — value is a text node. */
  async getNumberOfDays(): Promise<string> {
    return this.dialog.evaluate((el) => {
      // Strategy 1: find the container with "Number of days:" label and extract trailing number
      for (const node of el.querySelectorAll("strong, b, label, span")) {
        if (/number of days/i.test(node.textContent ?? "")) {
          const parent = node.parentElement;
          if (parent) {
            // The number is a text node after the <strong> — get full textContent and extract
            const full = parent.textContent?.trim() ?? "";
            const match = full.match(/number of days[:\s]*(\d+)/i);
            if (match) return match[1];
          }
        }
      }
      // Strategy 2: look for the pattern in the entire dialog text
      const allText = el.textContent ?? "";
      const match = allText.match(/number of days[:\s]*(\d+)/i);
      if (match) return match[1];
      return "";
    });
  }

  /** Reads the "Approved by" field text from the dialog.
   *  DOM structure: `<dt>Approved by</dt><dd><a>Name</a></dd>` */
  async getApprovedByText(): Promise<string> {
    return this.dialog.evaluate((el) => {
      // Strategy 1: find <dt> with "Approved by" and read its sibling <dd>
      for (const dt of el.querySelectorAll("dt")) {
        if (/approved by/i.test(dt.textContent ?? "")) {
          const dd = dt.nextElementSibling;
          if (dd) return dd.textContent?.trim() ?? "";
        }
      }
      // Strategy 2: find any element with "approved by" label and look for a link in parent
      for (const node of el.querySelectorAll("*")) {
        const text = node.textContent?.trim() ?? "";
        if (/approved by/i.test(text) && text.length < 200) {
          const parent = node.parentElement;
          if (parent) {
            const links = parent.querySelectorAll("a");
            if (links.length > 0) return links[0].textContent?.trim() ?? "";
          }
        }
      }
      return "";
    });
  }

  /** Reads the "Agreed by" / optional approver field text from the dialog.
   *  DOM structure: `<dt>Agreed by</dt><dd><a>Name</a></dd>` */
  async getAgreedByText(): Promise<string> {
    return this.dialog.evaluate((el) => {
      // Strategy 1: find <dt> with "Agreed by" and read its sibling <dd>
      for (const dt of el.querySelectorAll("dt")) {
        if (/agreed by/i.test(dt.textContent ?? "")) {
          const dd = dt.nextElementSibling;
          if (dd) return dd.textContent?.trim() ?? "";
        }
      }
      // Strategy 2: fallback
      for (const node of el.querySelectorAll("*")) {
        const text = node.textContent?.trim() ?? "";
        if (/agreed by/i.test(text) && text.length < 200) {
          const parent = node.parentElement;
          if (parent) {
            const links = parent.querySelectorAll("a");
            if (links.length > 0) return links[0].textContent?.trim() ?? "";
          }
        }
      }
      return "";
    });
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

  /** Sets the start date (first date picker). Date format: dd.mm.yyyy */
  async selectStartDate(date: string): Promise<void> {
    await this.selectDate(0, date);
  }

  /** Sets the end date (second date picker). Date format: dd.mm.yyyy */
  async selectEndDate(date: string): Promise<void> {
    await this.selectDate(1, date);
  }

  /** Closes the dialog without saving (Escape key). */
  async cancel(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.dialog.waitFor({ state: "detached" }).catch(() => {});
  }

  /** Checks if the dialog is still open. */
  async isOpen(): Promise<boolean> {
    return this.dialog.isVisible();
  }

  /**
   * Returns visible error/validation text from the dialog or page notifications.
   * Matches red-colored text in the dialog and toast notifications containing
   * "error", "validation", "exception", or raw i18n keys.
   */
  async getErrorText(): Promise<string> {
    // Strategy 1: red text inside dialog
    const redEntries = await this.getRedTextEntries();
    if (redEntries.length > 0) {
      return redEntries.map((e) => e.text).join(" | ");
    }
    // Strategy 2: notification/alert/toast with error-like content
    const errorNotification = this.page.locator(
      '[role="alert"], [class*="notification"], [class*="toast"], [class*="error"]',
    ).filter({ hasText: /error|validation|exception|crossing|past/i });
    if ((await errorNotification.count()) > 0) {
      return (await errorNotification.first().textContent())?.trim() ?? "";
    }
    // Strategy 3: raw i18n keys displayed as text (known bug)
    const rawKey = this.page.locator('text=/validation\\.|exception\\./');
    if ((await rawKey.count()) > 0) {
      return (await rawKey.first().textContent())?.trim() ?? "";
    }
    return "";
  }

  /** Returns all text entries in the dialog that have red-dominant color. */
  private async getRedTextEntries(): Promise<ColoredTextEntry[]> {
    const entries = await collectColoredText(this.dialog);
    return entries.filter(isRedDominant);
  }
}
