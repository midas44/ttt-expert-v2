---
title: CS UI Automation — Selectors, Session, Quirks
type: automation-reference
tags: [cs, automation, playwright, selectors, cas, session]
updated: 2026-04-15
---

# CS UI Automation — Selectors, Session, Quirks

Automation patterns, selector library, and session-management quirks specific to CS (Company Staff). Use alongside the `playwright-browser` skill.

## Language preference (ALWAYS FIRST)

Per-user preference at `/preferences`. Most shared accounts default to Russian; the first thing any automation should do after login is switch to English, otherwise every snapshot and screenshot comes back in Cyrillic.

### Switching to English — reliable recipe

```javascript
// 1. Navigate
await page.goto('https://cs-preprod.noveogroup.com/preferences');

// 2. Click the English radio directly (labels can be ambiguous — a later
//    page section also contains an "English" language-column header)
await page.evaluate(() => {
  const radios = document.querySelectorAll('input[type="radio"]');
  for (const r of radios) {
    const label = r.closest('label') || r.parentElement;
    if (label && label.textContent.trim() === 'English') { r.click(); break; }
  }
});

// 3. Click Save — but first remove the InnovationLab popup (see below)
await page.evaluate(() => {
  document.querySelectorAll('div').forEach(el => {
    if (el.textContent?.includes('InnovationLab') && el.textContent.length < 300) el.remove();
  });
  const btns = document.querySelectorAll('button');
  for (const b of btns) {
    if ((b.textContent.trim() === 'Сохранить' || b.textContent.trim() === 'Save') && !b.disabled) { b.click(); break; }
  }
});
```

After save, Save goes disabled (persisted). UI flips language on the next page load.

## InnovationLab popup — global interaction blocker

**CS injects a promotional popup in the bottom-right corner on nearly every page.** It overlaps save buttons, timeline controls, and other critical UI. Two failure modes have been observed:

1. Playwright click-via-ref silently succeeds but the intended button is never actually clicked because the popup is over it
2. `browser_snapshot` times out after 5s when the popup is animating

### Remedy

Before any click on an enabled action button, remove or close the popup:

```javascript
await page.evaluate(() => {
  // Option A: remove the popup outright
  document.querySelectorAll('div').forEach(el => {
    if (el.textContent?.includes('InnovationLab') && el.textContent.length < 300) el.remove();
  });
  // Option B: click its Close button (safer if you want to keep DOM intact)
  const btns = document.querySelectorAll('button');
  for (const b of btns) { if (b.textContent.trim() === 'Close') b.click(); }
});
```

Popup contents vary by language: RU — "Повышай продуктивность и качество работы с помощью AI-ассистента", EN — "Choose a corporate AI tool for your project".

## CAS SSO + session mgmt

### Authentication flow

- CS + TTT share CAS at `https://cas-demo.noveogroup.com`
- Navigating to a CS URL while logged out → redirects to `/login?service=...&...`
- Filling the CAS login form with `slebedev`/`slebedev` (or any username=password) and clicking Login → CAS issues a ticket → redirects back to CS → creates a Symfony session cookie

### Known issue: form button click doesn't submit

On the CAS login page, `page.click('button[type="submit"]')` and `browser_click` via ref can fail to submit the form — the button renders but appears to be a decorative `<button>` without a default `type="submit"`. **Reliable workaround:**

```javascript
await page.evaluate(() => {
  const form = document.querySelector('form');
  HTMLFormElement.prototype.submit.call(form); // form.submit is shadowed by a named input
});
await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
```

Why `.call()`: the CAS form has an input/element named `submit`, which in HTML5 shadows the form's built-in `submit()` method. The call-via-prototype sidesteps the shadow.

### Switching users (e.g., slebedev → pvaynmaster)

CAS `/logout` **clears the CAS ticket but not the Symfony session cookie** on the CS side — so navigating back to CS re-auths the previous user silently. To switch fully:

```javascript
// Via playwright-vpn MCP's browser_run_code tool:
async (page) => {
  const ctx = page.context();
  await ctx.clearCookies();   // drops the HttpOnly Symfony cookie too
}
```

Then navigate to CS; CAS will prompt for new credentials.

### Account inventory (preprod, confirmed 2026-04-15)

| Username | Role | Password (preprod dev convention: user=pass) |
|---|---|---|
| `slebedev` | Admin — full access | `slebedev` |
| `pvaynmaster` | Manager (Pavel Weinmeister) — manager cards for direct reports | `pvaynmaster` |

**Login naming convention**: CS uses `firstletter + lastname` pattern, but **transliteration is idiosyncratic**. Pavel Weinmeister is `pvaynmaster` (not `pweinmeister` or `pwaynmaster`). The reliable way to discover a user's login is to search the employee list and inspect failed thumbnail network requests: the URL `/api/thumbnail/<login>/400` reveals the login (e.g. visible as a console error).

## Selector library

### Vue multiselect dropdowns

```
.multiselect                       -- component root
.multiselect__tags                 -- clickable trigger (opens dropdown)
input.multiselect__input           -- search input inside opened dropdown
.multiselect__option               -- option element (text contains label)
.multiselect__option--disabled     -- disabled option
.multiselect__single               -- single-select display of chosen value
.multiselect__tag                  -- chip in a multi-select
```

Reliable pick pattern (handles paragraph label not being a direct parent):

```javascript
const pickMs = async (labelText, searchText, preferExact) => {
  const paragraphs = document.querySelectorAll('p');
  let ms = null;
  for (const p of paragraphs) {
    if (p.textContent.trim() === labelText || p.textContent.trim().startsWith(labelText)) {
      // walk up to find the multiselect (sometimes the ms is a cousin, not a child)
      let node = p.parentElement;
      for (let i = 0; i < 6 && node; i++) {
        const cand = node.querySelector(':scope .multiselect');
        if (cand) { ms = cand; break; }
        node = node.parentElement;
      }
      break;
    }
  }
  if (!ms) return null;
  ms.querySelector('.multiselect__tags').click();
  await new Promise(r => setTimeout(r, 300));
  const input = ms.querySelector('input.multiselect__input');
  if (input && searchText) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, searchText);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
  }
  for (const opt of ms.querySelectorAll('.multiselect__option')) {
    if (opt.textContent.trim().startsWith(preferExact || searchText)
        && !opt.classList.contains('multiselect__option--disabled')) {
      opt.click();
      return opt.textContent.trim();
    }
  }
  return null;
};
```

**Gotcha**: the label `<p>` is often **not** a direct parent of the multiselect — walk 2-6 ancestors up before giving up. Salary office label's MS was 2 levels up; most others are 1 level up.

### Date fields (mx-datepicker)

```
input.mx-input[name="date"]        -- each date field
```

Set via native setter + dispatch events (direct `.value = ` doesn't trigger Vue's reactivity):

```javascript
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
const dates = document.querySelectorAll('input.mx-input[name="date"]');
setter.call(dates[0], '01.05.2026');
dates[0].dispatchEvent(new Event('input', { bubbles: true }));
dates[0].dispatchEvent(new Event('change', { bubbles: true }));
dates[0].dispatchEvent(new Event('blur', { bubbles: true }));
```

Format is DD.MM.YYYY in RU interface, identical mask in EN.

### Masked phone input

```
#phoneInput                        -- the masked input element
```

**Cannot be set via JS value injection** — the mask component ignores programmatic value changes. Use Playwright's `.fill()` or `browser_type` with digits only:

```javascript
await page.getByRole('textbox', { name: 'Phone number' }).fill('79991234567');
// Mask formats to: +7(999)123-__-__
```

### Table cells (employees, salary offices)

Tables use plain `<tr>/<td>`. Employee rows have `id="row-<employee_id>"` when contextually relevant (e.g. row-499 for Pavel Nikonorov, row-27 for Venera RF).

### Edit / restore icons

```
.contacts__edit-button-wrapper button     -- pencil (edit contacts/entity)
.contacts__archive-button-wrapper button  -- restore/unarchive (circular arrow)
use[href*="icon-pencil"]                  -- pencil SVG use
use[href*="icon-restore"]                 -- restore SVG use
```

Row-level pencil on employee list opens `/profile/edit/<id>?tab=hr` in a **new tab** — plan for tab-switch logic (`browser_tabs action=select index=N`).

## Confirmation dialogs

Modal dialogs (e.g. Change salary office confirmation, "Submit for registration" confirmation) contain buttons with Russian OR English labels depending on current language setting:

- RU: "Отмена" / "Подтвердить" / "Отправить на оформление"
- EN: "Cancel" / "Confirm" / "Submit for registration"

Safer to filter by button text starting with known prefix than exact match.

## Symfony web profiler

Every page has a toolbar at the bottom showing:
- HTTP status + route name (e.g. `@employment_edit`)
- Timing, memory, DB query count
- **Security panel** shows the current logged-in user's login name — useful to verify the session is correct after re-auth

Route names useful for navigation:
- `employee` — `/employee/active/list`
- `employment_create` — `/employment/create`
- `employment_edit` — `/employment/edit/<id>/<tab>`
- `transfer_edit` — `/transfer/<id>/<tab>`
- `salary_office_list` — `/settings/salary-office?tab=list`
- `preferences_index` — `/preferences`
- `profile_edit` — `/profile/edit/<id>?tab=<tab>`

## Summary of reliable patterns

1. **Login**: CAS page → fill fields → use `HTMLFormElement.prototype.submit.call(form)` (not button click)
2. **Switch language first** (always, per-session)
3. **Kill InnovationLab popup** before any action-button click
4. **Cookie-clear for role switches** (MCP `browser_run_code` → `context.clearCookies()`)
5. **Use native value setters + `input`/`change`/`blur` events** for mx-datepicker, not string assignment
6. **Walk ancestors** to bind `<p>` labels to their multiselects — direct-parent assumption fails
7. **Use `.fill()` for masked inputs** (#phoneInput), not JS value injection
