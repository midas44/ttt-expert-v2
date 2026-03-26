# Knowledge Coverage

## Phase C — Autotest Generation Progress

### Ticket #3404: Days Off Earlier Date Transfer
- **XLSX:** 24 test cases generated (test-docs/t3404/t3404.xlsx)
- **Manifest:** Parsed, 24 cases in autotests/manifest/test-cases.json
- **Autotest coverage:** 10/24 (42%)
- **Target:** All 24 UI test cases automated

### Coverage by Feature
| Feature | Cases | Automated | Status |
|---------|-------|-----------|--------|
| Tooltip fix | 3 | 1 | In Progress |
| Edit icon visibility | 6 | 4 | In Progress |
| Datepicker constraints | 6 | 4 | In Progress |
| Earlier date selection | 4 | 2 | In Progress |
| Regression/E2E | 5 | 0 | Pending |

### Session History
| Session | Tests | Cumulative | Notes |
|---------|-------|------------|-------|
| 59 | 5 (TC-004,005,006,007,016) | 5/24 (21%) | First batch — core P0/P1 |
| 60 | 5 (TC-010,011,012,015,017) | 10/24 (42%) | Datepicker suite + maintenance |

### Phase B Summary
- 24 test cases across 5 suites
- 3 P0 (core), 9 P1 (boundary/flow), 8 P2 (secondary), 2 P3 (low), 2 hybrid
- Risk areas: ST-1, ST-4, ST-5, REG-1, REG-2