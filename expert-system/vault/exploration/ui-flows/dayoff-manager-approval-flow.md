---
type: exploration
tags:
  - day-off
  - manager
  - approval
  - ui-flow
  - playwright
created: '2026-03-25'
updated: '2026-03-25'
status: active
related:
  - '[[dayoff-service-deep-dive]]'
  - '[[frontend-day-off-module]]'
  - '[[day-off-pages]]'
  - '[[day-off-ticket-findings]]'
branch: release/2.1
---
# Day-Off Manager Approval Flow — UI Exploration

Explored as manager `azharkikh` (Andrey Zharkikh) on timemachine environment, session 47.

## 1. Page Structure

**URL**: `/vacation/request/daysoff-request/APPROVER`
**Title**: "Employees' requests"
**Entry points**: 
- Nav: "Calendar of absences" dropdown → "Employees' requests" → "Days off rescheduling" tab
- Overdue notification banner (pink): "You have overdue day off rescheduling requests. Please approve or reject them" (links directly to APPROVER tab)

### Main Tabs
| Tab | Content |
|-----|---------|
| Vacation requests (N) | Vacation approval queue |
| **Days off rescheduling (N)** | Day-off transfer approval queue (this exploration) |

### Sub-Tabs (within "Days off rescheduling")
| Sub-Tab | URL Suffix | Content | Actions Available |
|---------|-----------|---------|-------------------|
| **Approval (N)** | `/APPROVER` | Requests where user is **main approver**, status=NEW only | All 4 (approve, reject, redirect, info) |
| **Agreement (N)** | `/AGREEMENT` | Requests where user is **optional approver** | Vote (approve/reject) |
| **My department** | `/MY_DEPARTMENT` | ALL requests from department employees, ALL statuses | Status-dependent (see below) |
| **My projects** | `/MY_PROJECTS` | Requests from project members | TBD |
| **Redirected** | `/REDIRECTED` | Requests user redirected to someone else | TBD |

## 2. Approval Table

### Columns
Employee | Initial date (sortable ↓) | Requested date | Manager | Approved by | Agreed by | Status | Actions

- **Agreed by**: Green progress bar showing optional approver voting progress (percentage filled)
- **Status**: "New" for pending requests
- **Initial date**: Default sort column (descending)

### Sortable Columns
Employee, Initial date, Requested date, Manager, Approved by, Status — all sortable via column header click.

### Action Buttons (4 per NEW row)
| # | Test ID | Tooltip | Icon | Color |
|---|---------|---------|------|-------|
| 1 | `daysoff-request-action-approve` | "Approve the request" | Checkmark | Green |
| 2 | `daysoff-request-action-reject` | "Reject the request" | X/Cross | Red |
| 3 | `daysoff-request-action-redirect` | "Redirect the request" | Arrow | Blue |
| 4 | `daysoff-request-action-info` | "Request details" | Three dots | Gray |

**Status-dependent actions:**
- **NEW**: All 4 buttons shown
- **Approved**: Only info button (details view)
- **Rejected**: Likely only info button (not verified)

## 3. Request Details Modal (WeekendDetailsModal)

Opened via "Request details" button (info icon) or by clicking on a row.

### Modal Fields
| Field | Value Type | Notes |
|-------|-----------|-------|
| Employee | Link to CS profile (`cs.noveogroup.com/profile/{login}`) | Clickable |
| Manager | Link to CS profile | Clickable |
| Reason | Text | Holiday name (e.g., "Easter Monday (Orthodox)") |
| Initial date | Date (YYYY-MM-DD format) | The original holiday date |
| Requested date | Date (YYYY-MM-DD format) | The desired new date |
| Status | Text | "New", "Approved", "Rejected" |
| Approved by | Link to CS profile | The main approver |

### Optional Approvers Section
Table within the modal:
| Column | Content |
|--------|---------|
| Agreed by | Approver name (link to CS profile) |
| Status | "Requested", "APPROVED", "REJECTED" |

**"Edit list" button** → enters edit mode:
- **"+" button** (in table header) → adds new row with searchable combobox to select approver
- **Trash icon** (per row) → removes approver
- **Cancel / Save** buttons appear
- **Main action buttons (Reject/Approve/Redirect) become DISABLED** during editing

### Modal Action Buttons
| Button | Color | Style |
|--------|-------|-------|
| Reject | Red/coral | Filled |
| Approve | Green | Filled |
| Redirect | Blue | Filled |

## 4. Redirect Dialog

Opened via "Redirect" button (either in modal or table row).

- **Title**: "Redirect the rescheduling request"
- **Text**: "Please select the manager who should confirm the rescheduling"
- **Input**: Searchable combobox/dropdown to select the target manager
- **Buttons**: Cancel | OK (blue)

## 5. My Department Tab

**URL**: `/vacation/request/daysoff-request/MY_DEPARTMENT`

- Shows ALL requests from department employees regardless of status
- Has **status filter button** (funnel icon) in Status column header
- **Pagination**: 20 items per page (observed 9 pages for this manager)
- Same table structure as Approval tab
- Action buttons vary by status:
  - NEW: all 4 buttons (approve, reject, redirect, info)
  - Approved: only info button

## 6. Overdue Notification Banner

- **Appearance**: Pink/red background bar at page top
- **Text**: "You have overdue day off rescheduling requests. Please approve or reject them"
- **Link**: "day off rescheduling requests" → `/vacation/request/daysoff-request/APPROVER`
- **Visibility**: Shown on ALL pages when logged-in user has pending requests (observed on /report page)
- **Persistence**: Banner cannot be dismissed (no close button)

## 7. Selectors (for Phase C automation)

```typescript
// Page navigation
getByRole('button', { name: 'Calendar of absences' })
getByRole('button', { name: /Days off rescheduling/ })
getByRole('button', { name: /Approval/ })
getByRole('button', { name: /Agreement/ })
getByRole('button', { name: 'My department' })

// Table actions (per row)
getByTestId('daysoff-request-action-approve')
getByTestId('daysoff-request-action-reject')
getByTestId('daysoff-request-action-redirect')
getByTestId('daysoff-request-action-info')

// Modal elements
getByRole('dialog', { name: 'Request details' })
getByRole('button', { name: 'Close' })
getByRole('button', { name: 'Reject' })
getByRole('button', { name: 'Approve' })
getByRole('button', { name: 'Redirect', exact: true })
getByRole('button', { name: 'Edit list' })
getByRole('button', { name: 'Cancel' })
getByRole('button', { name: 'Save' })

// Redirect dialog
getByRole('dialog', { name: 'Redirect the rescheduling request' })
getByRole('button', { name: 'OK' })

// Overdue banner
getByRole('link', { name: 'day off rescheduling requests' })
```

## 8. Screenshots
- `artefacts/dayoff-manager-approval-page.png` — Approval tab with 5 pending requests
- `artefacts/dayoff-request-details-modal.png` — Request details modal with optional approver
- `artefacts/dayoff-edit-optional-approvers.png` — Edit mode for optional approvers
- `artefacts/dayoff-add-optional-approver.png` — Adding a new optional approver
- `artefacts/dayoff-redirect-dialog.png` — Redirect confirmation dialog
