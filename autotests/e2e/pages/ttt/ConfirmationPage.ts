import type { Page, Locator } from "@playwright/test";
import { resolveFirstVisible } from "@utils/locatorResolver";

/**
 * Page object for the Confirmation page (/approve).
 * Two tabs: "By employees" (/approve/employees) and "By projects" (/approve/projects).
 * Managers use this page to approve/reject employee-reported hours.
 */
export class ConfirmationPage {
  private readonly taskTable = this.page.locator("table");

  constructor(private readonly page: Page) {}

  /** Navigate to the Confirmation page, optionally to a specific tab. */
  async goto(
    baseUrl: string,
    tab: "employees" | "projects" = "employees",
  ): Promise<void> {
    const url = `${baseUrl}/approve/${tab}/0`;
    await this.page.goto(url);
    await this.page.waitForLoadState("networkidle");
  }

  /** Waits for the confirmation table to be visible. */
  async waitForReady(): Promise<void> {
    await this.taskTable.first().waitFor({ state: "visible", timeout: 30000 });
  }

  /** Click the "By employees" tab button. */
  async clickByEmployeesTab(): Promise<void> {
    await this.page
      .getByRole("button", { name: /by employees/i })
      .click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Click the "By projects" tab button. */
  async clickByProjectsTab(): Promise<void> {
    await this.page
      .getByRole("button", { name: /by projects/i })
      .click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Selects an employee or project from the primary dropdown (rc-select combobox).
   * Clears existing selection, types search text, and clicks the matching option.
   */
  async selectFromDropdown(name: string): Promise<void> {
    const combobox = this.page.getByRole("combobox").first();
    await combobox.click();
    await combobox.fill(name);
    // Wait for dropdown options to appear
    const option = this.page
      .locator(
        ".rc-select-item-option, [class*='select-item-option'], [class*='option']",
      )
      .filter({ hasText: name });
    await option.first().waitFor({ state: "visible", timeout: 10000 });
    await option.first().click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Clicks the week button that contains the given date label (dd.mm format).
   * Week buttons display ranges like "31.03 – 06.04".
   */
  async selectWeekContaining(dateLabel: string): Promise<void> {
    // Wait a moment for week buttons to stabilize after employee/project selection
    await this.page.waitForTimeout(1000);

    // Find all week-range buttons and click the one containing our date
    const weekButtons = this.page
      .getByRole("button")
      .filter({ hasText: /\d{2}\.\d{2}\s*[–—-]\s*\d{2}\.\d{2}/ });
    const count = await weekButtons.count();

    for (let i = 0; i < count; i++) {
      const text = await weekButtons.nth(i).textContent();
      if (text && text.includes(dateLabel)) {
        await weekButtons.nth(i).click();
        await this.page.waitForLoadState("networkidle");
        await this.page.waitForTimeout(500);
        return;
      }
    }

    // Fallback: try to parse date ranges and find which week contains our date
    const [dd, mm] = dateLabel.split(".");
    const targetDay = parseInt(dd, 10);
    const targetMonth = parseInt(mm, 10);

    for (let i = 0; i < count; i++) {
      const text = (await weekButtons.nth(i).textContent()) ?? "";
      const match = text.match(
        /(\d{2})\.(\d{2})\s*[–—-]\s*(\d{2})\.(\d{2})/,
      );
      if (match) {
        const startDay = parseInt(match[1], 10);
        const startMonth = parseInt(match[2], 10);
        const endDay = parseInt(match[3], 10);
        const endMonth = parseInt(match[4], 10);

        const inRange =
          (targetMonth === startMonth && targetDay >= startDay) ||
          (targetMonth === endMonth && targetDay <= endDay) ||
          (targetMonth > startMonth && targetMonth < endMonth);

        if (inRange) {
          await weekButtons.nth(i).click();
          await this.page.waitForLoadState("networkidle");
          return;
        }
      }
    }

    throw new Error(
      `No week button found containing date ${dateLabel}. Found ${count} week buttons.`,
    );
  }

  /**
   * Returns the table row locator matching the given task name.
   * The task name appears in the first column of each data row.
   */
  getTaskRow(taskName: string | RegExp): Locator {
    if (typeof taskName === "string") {
      return this.taskTable.locator("tbody tr").filter({ hasText: taskName });
    }
    return this.taskTable.locator("tbody tr").filter({ hasText: taskName });
  }

  /**
   * Clicks the approve (✓) button on a specific task row.
   * The approve button is the first icon button within the task name cell.
   */
  async clickApproveOnTask(taskName: string): Promise<void> {
    const row = this.getTaskRow(taskName).first();
    await row.waitFor({ state: "visible", timeout: 10000 });

    // Approve button is a button with an img/svg icon in the row — first button
    const approveBtn = await resolveFirstVisible(
      [
        row.locator("button").filter({ has: this.page.locator("img") }).first(),
        row.locator("button[title*='pprove'], button[title*='Подтвердить']"),
        row.locator("td").first().locator("button").first(),
      ],
      { timeout: 5000 },
    );
    await approveBtn.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Clicks the reject (✗) button on a specific task row.
   * The reject button is the second icon button within the task name cell.
   */
  async clickRejectOnTask(taskName: string): Promise<void> {
    const row = this.getTaskRow(taskName).first();
    await row.waitFor({ state: "visible", timeout: 10000 });

    // Reject button is the second button with img icon
    const rejectBtn = await resolveFirstVisible(
      [
        row.locator("button").filter({ has: this.page.locator("img") }).nth(1),
        row.locator("button[title*='eject'], button[title*='Отклонить']"),
        row.locator("td").first().locator("button").nth(1),
      ],
      { timeout: 5000 },
    );
    await rejectBtn.click();
  }

  /**
   * Fills the rejection comment in the tooltip textarea and confirms.
   * Call after clickRejectOnTask() which opens the reject tooltip.
   */
  async fillRejectCommentAndConfirm(comment: string): Promise<void> {
    // Wait for tooltip/popover with textarea
    const tooltip = await resolveFirstVisible(
      [
        this.page.locator("[class*='tooltip']").filter({
          has: this.page.locator("textarea"),
        }),
        this.page.locator("[class*='popover']").filter({
          has: this.page.locator("textarea"),
        }),
        this.page.locator("[class*='popup']").filter({
          has: this.page.locator("textarea"),
        }),
      ],
      { timeout: 5000 },
    );

    const textarea = tooltip.locator("textarea");
    await textarea.fill(comment);

    // Click the Reject/confirm button within the tooltip
    const confirmBtn = await resolveFirstVisible(
      [
        tooltip.getByRole("button", { name: /reject/i }),
        tooltip.getByRole("button", { name: /отклонить/i }),
        tooltip.locator("button").last(),
      ],
      { timeout: 3000 },
    );
    await confirmBtn.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Clicks the bulk "Approve" / "Approve all" button (green header button).
   * This approves all REPORTED tasks for the selected week.
   */
  async clickApproveAllButton(): Promise<void> {
    const btn = await resolveFirstVisible(
      [
        this.page.getByRole("button", { name: /^approve$/i }),
        this.page.getByRole("button", { name: /approve all/i }),
        this.page.getByRole("button", { name: /подтвердить$/i }),
      ],
      { timeout: 10000 },
    );
    await btn.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Checks whether a task row has any cells with a green-ish background
   * (indicating REPORTED/pending state).
   */
  async hasReportedCells(taskName: string): Promise<boolean> {
    const row = this.getTaskRow(taskName).first();
    const cells = row.locator("td");
    const count = await cells.count();

    for (let i = 1; i < Math.min(count, 8); i++) {
      // columns 1-7 are day columns
      const bg = await cells.nth(i).evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      // Green-ish: rgb(r, g, b) where g > r and g > b
      const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const [, r, g, b] = match.map(Number);
        if (g > r + 20 && g > b + 20 && g > 100) return true;
      }
    }
    return false;
  }

  /** Returns the locator for the "With approved hours" checkbox. */
  withApprovedHoursCheckbox(): Locator {
    return this.page.getByRole("checkbox", {
      name: /with approved hours/i,
    });
  }
}
