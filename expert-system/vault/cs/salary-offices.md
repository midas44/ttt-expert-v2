---
title: CS Salary Offices — Settings Page
type: ui-reference
tags: [cs, salary-office, settings, archive, vacation-policy]
updated: 2026-04-15
---

# CS Salary Offices — Settings Page

URL: `/settings/salary-office?tab=list`

The salary office (R/C — "расчётный центр") is the fundamental unit of payroll/contract grouping in CS. Each employee belongs to exactly one salary office at any moment; transfers move them between offices (see [[cs/employee-transfer]]). **Salary office changes are the primary CS→TTT sync trigger** (see [[ttt-cs-sync]]).

## Page structure

Top-level tabs:
- **Current** (`?tab=list`) — active offices (32 on preprod)
- **Archive** (`?tab=archive`) — deactivated offices (2 on preprod: `Luna (Serbiia)` was there until session 2026-04-15 when it was restored, + `Test`)

Sub-tabs (shared by Current and Archive):
- **General information** — name, description, contacts
- **Responsible employees** — managers/accountants/HR assigned to the office (no year selector)
- **Vacations and sick leaves** — vacation policy per year (**year selector** present)

There is also an **"Add a new salary office"** button on Current tab.

## Salary offices inventory (preprod, 2026-04-15)

32 active offices. Names in Latin + Russian + description:

| EN | RU | Description |
|---|---|---|
| Altair | Альтаир | B2B subcontractor contracts |
| Andromeda | Андромеда | Remote employment in western RF (incl. SPb remote) |
| Feniks | Феникс | Special cash-register payments in Moscow |
| GoldenStar | ГолденСтар | Employees in Vietnam |
| Iupiter | Юпитер | Employment contracts in St. Petersburg |
| Kallisto (Armeniia) | Каллисто (Армения) | Employees in Noveo legal entity in Armenia |
| Kassiopeia (udalenshchiki Noveo-NSK) | Кассиопея (удаленщики Новео-НСК) | Remote employment in eastern RF (incl. NSK remote) |
| Luna (Serbiia) | Луна (Сербия) | Employees in Noveo legal entity in Serbia |
| Mars (Nsk) | Марс (Нск) | Moscow hybrid/office employment |
| Mars (SPb) | Марс (СПб) | SPb employment with payment from Moscow |
| Meh | — | (test/placeholder) |
| Ne ukazano | Не указано | (placeholder for unassigned) |
| Neptun | Нептун | Employees in Cyprus |
| Pegas | Пегас | Special cash-register payments in SPb |
| Persei | Персей | Employees in Germany |
| Pluton | Плутон | Individual contractors (outside RF) |
| Pluton RF | Плутон (РФ) | Individual contractors inside RF |
| Protei (Gruziia) | Протей (Грузия) | Employees in Noveo legal entity in Georgia |
| Saturn | Сатурн | Employment contracts in Novosibirsk |
| Sirius (Parizh) | Сириус (Париж) | Employees in Noveo legal entity in France |
| Skorpion | Скорпион | Special cash-register payments in NSK |
| TestMeh, test_t, Test test | — | (test/placeholder) |
| Titan (Chernogoriia) | Титан (Черногория) | Employees in Noveo legal entity in Montenegro |
| Ulugbek | Улугбек | Employment in Uzbekistan legal entity |
| Uran | Уран | IP-managers outside RF |
| Uran RF | Уран (РФ) | IP-managers inside RF |
| Venera | Венера | IP/self-employed outside RF (except project managers → Uran) |
| Venera France | Венера Франция | — |
| Venera RF | Венера (РФ) | IP/self-employed inside RF (except project managers → Uran) |
| Venera (Uz) | Венера (Уз) | Self-employed in Uzbekistan |

## General information tab — fields

| Column | Field |
|---|---|
| Name in English | e.g. `Venera RF` |
| Name in native language | e.g. `Венера (РФ)` |
| Description in English | free text |
| Description in native language | free text |
| Contacts | block with "Payments questions and notifications" + email, optionally "Documents request" + email |

**Inline edit**: clicking a cell opens a textbox-style editor for that specific field. No explicit Save button — commits on blur/Enter.

## Responsible employees tab — columns

| Column | Type | Typical values |
|---|---|---|
| Managers | multi-select employees | Usually empty on regular offices; extensive on "bucket" offices like Venera RF |
| Responsible accountant | single employee | e.g. Olga Gribanova, Polina Litvin |
| Accountants | multi-select employees | e.g. Anna Ritter, Polina Litvin, Olga Gribanova |
| Personnel officers | multi-select employees | e.g. Galina Prikhodko |
| Teachers | multi-select employees | e.g. Galina Prikhodko |
| Inform about vacation | multi-select (employees or groups) | Often empty or group like `Legal` |
| Inform about sick leave | multi-select (employees or groups) | e.g. `Legal` group, `spb-financial-department`, `nsk-financial-department` |
| Voluntary Medical Insurance (VMI) | enum: Available / Not available | Drives whether employees hired into this office get VMI by default |

## Vacations and sick leaves tab — fields

This tab carries the office's **vacation policy per calendar year**. A year selector at the top (with left/right arrows + "Current year" button) ranges from a historical year up to **2027** (next-year arrow disables past 2027).

| Column | Type | Notes |
|---|---|---|
| Number of vacation days | integer | Default 24 for most staff offices; edit via inline spinbutton |
| First vacation can be taken after (months) | integer | 3 for standard; 0 for some foreign-legal-entity offices (Protei, Sirius, Neptun, Titan) |
| Vacation can be taken in advance | Yes / No | |
| Overtime or undertime on account of vacation | Not include / Include both / Include only undertime | |
| Vacation days expire after (months) | integer (optional) | Some offices set 6/12/24; most leave empty |
| Include sick leaves | Yes / No | Whether sick leaves reduce vacation accrual |

### Editing policy

1. Navigate to the desired year (left/right arrow)
2. Click the cell on the desired row — cell turns into an input/dropdown
3. Enter new value → **Enter** (or click elsewhere) to commit
4. Value persists immediately via XHR; no explicit Save button

Confirmed in session 2026-04-15: changing Venera RF's 2027 vacation days 24→28 kept 2025/2026 unchanged — **the year selector is the source of truth for the scope of the change**.

### Baseline (what's uniform across most offices, as of 2026-04-15)

For the "boring" production offices (Andromeda, Feniks, Iupiter, Kassiopeia, Mars *, Pegas, Saturn, Skorpion, Uran, Uran RF, Venera, Venera France, Venera RF, Venera (Uz)):
- 24 days / 3 months / No / Not include / (empty) / Yes

Exceptions:
- Kallisto (Armeniia): 24 / 1 / No / Not include / **24** / Yes
- Neptun: **21** / 0 / Yes / **Include both** / 6 / Yes
- Persei (Germany): 24 / 3 / **Yes** / **Include both** / — / Yes
- Protei (Gruziia): 24 / **0** / No / Not include / **12** / Yes
- Sirius (Parizh): **25** / 0 / No / Not include / 0 / Yes
- Titan (Chernogoriia): 24 / 1 / No / Not include / **6** / Yes
- GoldenStar: **15** / 2 / No / Not include / — / Yes

Offices with 0 vacation days (contractor/placeholder): Altair, Pluton, Pluton RF, TestMeh, Ulugbek (0 days, Yes on sick leaves for Ulugbek only)

## Archive / unarchive

On **Archive** tab, each row has two action buttons on the right:
- Pencil (`icon-pencil`, class `contacts__edit-button`) — edits the contacts row
- **Circular restore arrow** (`icon-restore`, parent `.contacts__archive-button-wrapper`) — moves the office back to Current. No confirmation dialog; instantaneous.

Programmatic selector: `row.querySelector('.contacts__archive-button-wrapper button')`.

Verified 2026-04-15: clicking restore on `Luna (Serbiia)` moved it from Archive (2→1 rows) to Current (32→33 rows, alphabetically between Kassiopeia and Mars).
