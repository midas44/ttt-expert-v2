# Reference Files

These are **prototype test files** copied from the `ttt-autom-v2` automation framework. They serve as **pattern examples** for understanding the framework's conventions — they are NOT executable from this directory.

## Why imports are broken

The spec files and data classes were originally in separate directories (`e2e/tests/` and `e2e/data/`) with relative imports between them. When copied flat into `reference/`, those import paths no longer resolve. This is expected and intentional — these files are for reading, not running.

## Contents

- `vacation-tc1.spec.ts` — UI test: create unpaid vacation, verify, delete
- `api-tc1.spec.ts` — API test: get/change/reset server clock
- `admin-tc1.spec.ts` — UI test: CRUD API key in admin panel
- `report-tc1.spec.ts` — UI test: add task, fill report, verify
- `VacationTc1Data.ts` — Data class with static/dynamic factory, DB queries, period pattern builder
- `AdminTc1Data.ts` — Data class with admin employee lookup
- `ApiTc1Data.ts` — Data class for API endpoints and patterns
- `ReportTc1Data.ts` — Data class for report values and search terms

## How to use

Read these files to understand the patterns, then generate new tests in `e2e/tests/` following the same conventions. See `autotest-generator` skill references for the full specification.
