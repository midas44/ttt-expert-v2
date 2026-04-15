---
title: CS (Company Staff) — Overview
type: overview
tags: [cs, company-staff, secondary-sut]
updated: 2026-04-15
---

# CS (Company Staff) — Overview

Company Staff is the internal corporate HR/operations tool that is the **source of truth for employees, salary offices, contracts, and employment events**. It syncs one-way to TTT (see [[ttt-cs-sync]]).

## Access

| Aspect | Value |
|---|---|
| URL | `https://cs-preprod.noveogroup.com` (only env available) |
| Auth | CAS SSO at `cas-demo.noveogroup.com` — same as TTT |
| Admin account | `slebedev` / `slebedev` — full access to all cards, all employees |
| Manager account | `pvaynmaster` / `pvaynmaster` (Pavel Weinmeister) — manager role, sees Manager cards for direct reports |
| Employee URL | `/profile/<login>` (read-only), `/profile/edit/<employee_id>` (admin edit) |
| Config | `config/cs/cs.yaml` + `config/cs/envs/preprod.yaml` |
| Backend | Symfony 6.4.7 + Vue.js (vue-multiselect for dropdowns, mx-datepicker for dates) |

## Main navigation

| Section | URL | Contents |
|---|---|---|
| **Employees → List** | `/employee/active/list` | 419 active employees, search, filter, 6 columns |
| **Employees → Employment** | `/employee/hire/list` | In-progress hires with statuses |
| **Employees → Employment termination** | — | Dismissal workflow |
| **Employees → Transfer** | `/employee/transfer/list` | Salary-office transfers (Current / Completed) |
| **Employees → Newbies** | — | New hires recently joined |
| **Employees → Birthdays / Anniversaries** | — | Celebrations |
| **Employees → Former employees** | — | Fired/left |
| **Contractors** | `/contractors` | B2B contractor list |
| **News** | `/news/feed` | Company news feed |
| **Mailing groups** | `/mail-group/list/all` | Distribution lists |
| **Review** | `/review/performance` | Performance review flow |
| **Settings → Salary offices** | `/settings/salary-office?tab=list` | Salary office CRUD (Current / Archive tabs) |
| **API** | `/token` | API token mgmt |
| **Profile preferences** | `/preferences` | **Interface language**, theme, notifications |

## Language

CS UI is available in **Russian (Русский)** and **English**. Setting is per-user, persisted at `/preferences`. Most shared accounts default to Russian. See [[cs/ui-automation-notes]] for the switch procedure.

## Role model (observed)

| Role | Example account | Scope |
|---|---|---|
| Administrator | slebedev | Full access — all employees, all cards (HR / Administrator / Accountant / Manager / Personnel officer), settings |
| Manager | pvaynmaster | Manager card for own direct reports, read-only on others |
| HR / Accountant / Personnel officer | (role-specific accounts) | Respective cards on employees assigned to them |
| Employee | any login | Own profile (`/profile/<login>`), read-only directory |

Full role matrix not fully mapped — add to this note as new roles are discovered.

## UI framework fingerprints

- Symfony web profiler visible on every page (toolbar at the bottom) — useful for debugging route names (`@employee`, `@employment_edit`, `@transfer_edit`, `@preferences_index`, `@salary_office_list`)
- Vue multiselect dropdowns — `.multiselect__tags` for the trigger, `.multiselect__input` for search, `.multiselect__option` for choices
- `mx-datepicker` date fields — plain `<input>` with `class="mx-input" name="date"`
- `#phoneInput` — masked phone input (use digits only when filling)
- InnovationLab popup — **intercepts clicks site-wide**, see [[cs/ui-automation-notes]]

## Related notes

- [[ttt-cs-sync]] — CS→TTT sync mechanism, 7 known bugs
- [[cs/employee-profile]] — Employee page structure, 5 cards, timeline
- [[cs/salary-offices]] — Salary offices page, tabs, year selector
- [[cs/employee-transfer]] — Transfer workflow
- [[cs/employee-hiring]] — Add-new-employee workflow
- [[cs/ui-automation-notes]] — Automation quirks, selectors, session mgmt
