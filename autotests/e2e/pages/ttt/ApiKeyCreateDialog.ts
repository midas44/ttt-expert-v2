import type { Page, Locator } from "@playwright/test";
import { resolveFirstVisible } from "@utils/locatorResolver";

export class ApiKeyCreateDialog {
  private readonly dialog = this.page.getByRole("dialog", {
    name: /Creating key/i,
  });
  private readonly createButton = this.dialog.getByRole("button", {
    name: /^Create$/i,
  });

  private cachedNameInput: Locator | null = null;

  constructor(private readonly page: Page) {}

  /** Waits for the dialog to become visible. */
  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: "visible" });
  }

  /** Fills the API key name field. */
  async fillName(name: string): Promise<void> {
    const input = await this.ensureNameInput();
    await input.fill(name);
  }

  /** Checks the "All" checkbox if not already checked. Uses .click() for rc-checkbox compat. */
  async checkAll(): Promise<void> {
    const checkbox = this.dialog.getByRole("checkbox", { name: "All", exact: true });
    if (!(await checkbox.isChecked())) {
      await checkbox.click();
    }
  }

  /** Clicks the Create button and waits for the dialog to close. */
  async submit(): Promise<void> {
    await this.createButton.click();
    await this.dialog.waitFor({ state: "detached" });
  }

  /** Lazily resolves and caches the name input locator. */
  private async ensureNameInput(): Promise<Locator> {
    if (this.cachedNameInput) return this.cachedNameInput;

    const candidates = [
      this.dialog.getByRole("textbox"),
      this.dialog.locator("input[type='text']"),
      this.dialog.locator("input"),
    ];
    this.cachedNameInput = await resolveFirstVisible(candidates);
    return this.cachedNameInput;
  }
}
