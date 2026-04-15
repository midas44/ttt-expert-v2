import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the "Request details" modal (WeekendDetailsModal).
 * Opens when clicking the info (i) button on a dayoff request row.
 *
 * Contains: request fields, main action buttons (Approve/Reject/Redirect),
 * optional approvers table, and Edit list mode.
 *
 * Bilingual: supports EN and RU app locale.
 */
export class WeekendDetailsModal {
  private readonly dialog = this.page.getByRole("dialog");

  /** Main action buttons inside the modal (bilingual). */
  private readonly approveBtn = this.dialog.getByRole("button", {
    name: /^(Approve|Подтвердить)$/i,
  });
  private readonly rejectBtn = this.dialog.getByRole("button", {
    name: /^(Reject|Отклонить)$/i,
  });
  private readonly redirectBtn = this.dialog.getByRole("button", {
    name: /^(Redirect|Перенаправить)$/i,
  });

  /** Optional approvers section (bilingual). */
  private readonly editListBtn = this.dialog.getByRole("button", {
    name: /Edit list|Редактировать список/i,
  });
  private readonly saveBtn = this.dialog.getByRole("button", {
    name: /^(Save|Сохранить)$/i,
  });
  private readonly cancelEditBtn = this.dialog.getByRole("button", {
    name: /^(Cancel|Отмена|Отменить)$/i,
  });

  /** Optional approvers table within the modal. */
  private readonly approversTable = this.dialog.locator("table");

  /** "+" button in the table header 3rd column (edit mode only). */
  private readonly addApproverBtn = this.approversTable
    .locator("th")
    .nth(2)
    .getByRole("button");

  /** React-select combobox for selecting a new approver (edit mode only). */
  private readonly approverCombobox = this.dialog.getByRole("combobox");

  constructor(private readonly page: Page) {}

  /** Wait for the modal to appear. */
  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: "visible" });
  }

  /** Wait for the modal to close. */
  async waitForClose(): Promise<void> {
    await this.dialog.waitFor({ state: "hidden" });
  }

  /** Returns the dialog locator for external assertions. */
  get locator(): Locator {
    return this.dialog;
  }

  /** Returns the full text content of the dialog. */
  async getDialogText(): Promise<string> {
    return (await this.dialog.textContent()) ?? "";
  }

  /** Check if the dialog contains the given text. */
  async containsText(text: string): Promise<boolean> {
    const content = await this.getDialogText();
    return content.includes(text);
  }

  // ── Main action buttons ──────────────────────────────────────

  async clickApprove(): Promise<void> {
    await this.approveBtn.click();
  }

  async clickReject(): Promise<void> {
    await this.rejectBtn.click();
  }

  async clickRedirect(): Promise<void> {
    await this.redirectBtn.click();
  }

  /** Close the modal via Escape key (reliable across locales). */
  async clickClose(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }

  async isApproveEnabled(): Promise<boolean> {
    return this.approveBtn.isEnabled();
  }

  async isRejectEnabled(): Promise<boolean> {
    return this.rejectBtn.isEnabled();
  }

  async isRedirectEnabled(): Promise<boolean> {
    return this.redirectBtn.isEnabled();
  }

  async isApproveVisible(): Promise<boolean> {
    return (await this.approveBtn.count()) > 0;
  }

  async isRejectVisible(): Promise<boolean> {
    return (await this.rejectBtn.count()) > 0;
  }

  async isRedirectVisible(): Promise<boolean> {
    return (await this.redirectBtn.count()) > 0;
  }

  // ── Optional approvers edit mode ─────────────────────────────

  async clickEditList(): Promise<void> {
    await this.editListBtn.click();
  }

  async clickSave(): Promise<void> {
    await this.saveBtn.click();
  }

  async clickCancelEdit(): Promise<void> {
    await this.cancelEditBtn.click();
  }

  async isEditListVisible(): Promise<boolean> {
    return (
      (await this.editListBtn.count()) > 0 &&
      (await this.editListBtn.isVisible())
    );
  }

  async isApproversTableVisible(): Promise<boolean> {
    return (await this.approversTable.count()) > 0;
  }

  // ── Edit mode: add/remove approvers ────────────────────────

  /** Click the "+" button to add a new approver row. */
  async clickAddApprover(): Promise<void> {
    await this.addApproverBtn.click();
  }

  /** Type into the approver search combobox and select a matching option. */
  async selectApprover(name: string): Promise<void> {
    await this.approverCombobox.click();
    await this.approverCombobox.fill(name);
    await this.dialog.getByRole("option", { name }).click();
  }

  /** Click the delete (trash) button on an approver row by name or index. */
  async deleteApprover(namePattern: string | RegExp): Promise<void> {
    const row = this.approversTable
      .locator("tbody tr")
      .filter({ hasText: namePattern });
    await row.locator("td").last().getByRole("button").click();
  }

  /** Click the delete button on the Nth approver row (0-based). */
  async deleteApproverByIndex(index: number): Promise<void> {
    // Search within the approvers area (class-scoped to avoid matching outer table)
    const approversArea = this.dialog.locator("[class*='optional-approvers']");
    const rows = approversArea.locator("tbody tr");
    const row = rows.nth(index);
    // ButtonIcon renders as button.uikit-button.uikit-button__icon — unique to uikit, not react-select
    await row.locator("button.uikit-button").click();
  }

  /** Returns the count of approver data rows (excludes the "no data" placeholder). */
  async getApproverCount(): Promise<number> {
    // The "no data" row uses colspan; real data rows have individual td cells
    return this.approversTable.locator("tbody tr:not(:has(td[colspan]))").count();
  }

  /** Returns the names of all approvers listed in the table. */
  async getApproverNames(): Promise<string[]> {
    const rows = this.approversTable.locator("tbody tr");
    const count = await rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).locator("td").first().textContent();
      if (text?.trim()) names.push(text.trim());
    }
    return names;
  }

  /** Returns the status text of an approver row by name. */
  async getApproverStatus(namePattern: string | RegExp): Promise<string> {
    const row = this.approversTable
      .locator("tbody tr")
      .filter({ hasText: namePattern });
    return (await row.locator("td").nth(1).textContent())?.trim() ?? "";
  }

  // ── Request field getters ──────────────────────────────────

  /** Returns the value of a definition-list field by its term label. */
  private async getFieldValue(termText: string): Promise<string> {
    const term = this.dialog.locator("dt", { hasText: termText });
    const dd = term.locator("+ dd");
    return (await dd.textContent())?.trim() ?? "";
  }

  async getEmployee(): Promise<string> {
    return this.getFieldValue("Employee");
  }

  async getManager(): Promise<string> {
    return this.getFieldValue("Manager");
  }

  async getReason(): Promise<string> {
    return this.getFieldValue("Reason");
  }

  async getInitialDate(): Promise<string> {
    return this.getFieldValue("Initial date");
  }

  async getRequestedDate(): Promise<string> {
    return this.getFieldValue("Requested date");
  }

  async getStatus(): Promise<string> {
    return this.getFieldValue("Status");
  }

  async getApprovedBy(): Promise<string> {
    return this.getFieldValue("Approved by");
  }
}
