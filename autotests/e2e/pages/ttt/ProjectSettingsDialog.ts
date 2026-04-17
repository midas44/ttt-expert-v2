import type { Locator, Page } from "@playwright/test";

/**
 * Page object for the Project Settings modal in the Planner.
 * Accessed via the settings icon (.planner__project-group-add .uikit-button).
 * Contains two tabs: "Project members" and "Tasks closing".
 */
export class ProjectSettingsDialog {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog", { name: "Project settings" });
  }

  /** Waits for the Project Settings dialog to be visible. */
  async waitForReady(): Promise<void> {
    await this.dialog.waitFor({ state: "visible" });
  }

  /** Returns the dialog locator for scoped queries. */
  root(): Locator {
    return this.dialog;
  }

  /** Clicks the "Project members" tab. */
  async clickProjectMembersTab(): Promise<void> {
    await this.dialog
      .getByRole("button", { name: "Project members" })
      .click();
  }

  /** Clicks the "Tasks closing" tab. */
  async clickTasksClosingTab(): Promise<void> {
    await this.dialog
      .getByRole("button", { name: "Tasks closing" })
      .click();
  }

  /** Returns the tag input field in the Tasks closing tab. */
  tagInput(): Locator {
    return this.dialog.getByRole("textbox", { name: "Add a tag" });
  }

  /** Clicks the add tag button (submit button with class add-employee-button). */
  async clickAddTagButton(): Promise<void> {
    await this.dialog.locator("button.add-employee-button").click();
  }

  /** Types a tag value and clicks the add button. */
  async addTag(tag: string): Promise<void> {
    await this.tagInput().fill(tag);
    await this.clickAddTagButton();
  }

  /** Returns the tags table locator. */
  tagsTable(): Locator {
    return this.dialog.getByRole("table");
  }

  /** Returns all tag text values from the tags table body rows. */
  async getTagTexts(): Promise<string[]> {
    const rows = this.tagsTable().locator("tbody tr");
    const count = await rows.count();
    const tags: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).locator("td").first().textContent();
      if (text && text.trim() !== "No data") {
        tags.push(text.trim());
      }
    }
    return tags;
  }

  /** Returns the "No data" cell if visible. */
  noDataMessage(): Locator {
    return this.dialog.getByText("No data");
  }

  /** Clicks a tag text in the table to enter inline edit mode. */
  async clickTagToEdit(tagText: string): Promise<void> {
    // Click the span trigger text directly (not the td) to activate inline edit
    await this.tagsTable()
      .locator("tbody")
      .getByText(tagText, { exact: true })
      .click();
  }

  /** Returns the inline edit input that appears after clicking a tag. */
  tagEditInput(): Locator {
    return this.tagsTable().locator("tbody input[class*='change-role-input']");
  }

  /** Deletes a tag by clicking the trash icon in its row. */
  async deleteTag(tagText: string): Promise<void> {
    const row = this.tagsTable()
      .locator("tbody tr")
      .filter({ hasText: tagText });
    await row.locator("button").click();
  }

  /** Returns the text of the first column header in the tags table. */
  async getTagColumnHeaderText(): Promise<string> {
    return (
      (await this.tagsTable().locator("thead th").first().textContent())?.trim() ?? ""
    );
  }

  /** Returns the OK button locator. */
  okButton(): Locator {
    return this.dialog.getByRole("button", { name: "OK" });
  }

  /** Clicks the OK button to close the dialog. */
  async clickOk(): Promise<void> {
    await this.okButton().click();
  }

  /** Returns the informational text element on the Tasks closing tab (.tags_text div). */
  infoText(): Locator {
    return this.dialog.locator(".tags_text");
  }

  /** Returns the maxlength attribute of the tag input (null if absent). */
  async getTagInputMaxLength(): Promise<string | null> {
    return this.tagInput().getAttribute("maxlength");
  }

  /** Checks if the dialog is visible. */
  async isVisible(): Promise<boolean> {
    return this.dialog.isVisible();
  }
}
