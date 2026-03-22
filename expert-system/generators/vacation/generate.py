#!/usr/bin/env python3
"""
Vacation Test Documentation Generator — Phase B (UI-First)

Generates test-docs/vacation/vacation.xlsx with:
- Plan Overview tab
- Feature Matrix tab
- Risk Assessment tab
- 11 TS-Vac-* test suite tabs

All test steps describe browser actions unless the feature has no UI equivalent.
"""

import os
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
from openpyxl.utils import get_column_letter

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'test-docs', 'vacation')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'vacation.xlsx')

HEADER_FILL = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
HEADER_FONT = Font(name='Arial', size=10, bold=True, color='FFFFFF')
BODY_FONT = Font(name='Arial', size=10)
LINK_FONT = Font(name='Arial', size=10, color='0563C1', underline='single')
BOLD_FONT = Font(name='Arial', size=10, bold=True)
TITLE_FONT = Font(name='Arial', size=14, bold=True, color='1F4E79')
SUBTITLE_FONT = Font(name='Arial', size=11, bold=True, color='1F4E79')

ALT_FILL = PatternFill(start_color='F2F7FB', end_color='F2F7FB', fill_type='solid')
GREEN_TAB = '339966'
BLUE_TAB = '4472C4'

THIN_BORDER = Border(
    left=Side(style='thin', color='D9D9D9'),
    right=Side(style='thin', color='D9D9D9'),
    top=Side(style='thin', color='D9D9D9'),
    bottom=Side(style='thin', color='D9D9D9'),
)

WRAP_ALIGN = Alignment(wrap_text=True, vertical='top')
CENTER_ALIGN = Alignment(horizontal='center', vertical='top', wrap_text=True)

TC_COLUMNS = ['Test ID', 'Title', 'Preconditions', 'Steps', 'Expected Result',
              'Priority', 'Type', 'Requirement Ref', 'Module/Component', 'Notes']
TC_WIDTHS = [14, 35, 45, 55, 40, 10, 12, 18, 20, 35]

# ──────────────────────────────────────────────
# Test Suite Definitions
# ──────────────────────────────────────────────
SUITES = [
    ('TS-Vac-CRUD', 'Vacation Create, View, Edit'),
    ('TS-Vac-Lifecycle', 'Vacation Cancel, Restore, Delete'),
    ('TS-Vac-Approval', 'Approval, Rejection, Redirect Flows'),
    ('TS-Vac-Payment', 'Payment and Accounting Operations'),
    ('TS-Vac-DayCalc', 'Day Calculations and Balance'),
    ('TS-Vac-DayCorrection', 'Vacation Day Corrections'),
    ('TS-Vac-Chart', 'Availability Chart'),
    ('TS-Vac-Permissions', 'Role-Based Access Control'),
    ('TS-Vac-Validation', 'Input Validation and Error Handling'),
    ('TS-Vac-Notifications', 'Email and In-App Notifications'),
    ('TS-Vac-Integration', 'Cross-Module Integration'),
]

# ──────────────────────────────────────────────
# Test Case Data — UI-First Steps
# ──────────────────────────────────────────────

def _cases_crud():
    return [
        {
            'id': 'TC-VAC-001', 'title': 'Create regular vacation request — happy path',
            'priority': 'Critical', 'type': 'Functional',
            'preconditions': (
                'Employee with sufficient vacation days (>=5) in an office with AV=true or AV=false.\n'
                'Query: SELECT e.login FROM ttt_vacation.employee e '
                'JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee '
                'WHERE ev.available_vacation_days >= 5 AND e.enabled = true '
                'AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE) ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the selected employee\n'
                '2. Navigate to Calendar of absences → My vacations and days off\n'
                '3. Verify "My vacations and days off" page loads with Vacations tab active\n'
                '4. Note the current "Available vacation days" count\n'
                '5. Click "Create a request" button\n'
                '6. Verify "Creating vacation request" dialog opens\n'
                '7. Set start date to next Monday (DD.MM.YYYY format)\n'
                '8. Set end date to next Friday\n'
                '9. Verify "Number of days" auto-updates (should show 5 or 4 if holiday)\n'
                '10. Verify "Unpaid vacation" checkbox is unchecked (Regular type)\n'
                '11. Verify "Approved by" shows the employee\'s manager name\n'
                '12. Verify "Vacation pay to be paid with salary for" shows a valid month\n'
                '13. Click "Save" button\n'
                '14. Verify success — dialog closes, vacation appears in the table\n'
                '15. Verify new row shows Status = "New", Vacation type = "Regular"\n'
                '16. Verify Regular days column shows the correct working day count\n'
                '17. Verify Available vacation days count decreased accordingly'
            ),
            'expected': (
                'Vacation request created successfully.\n'
                'Row appears in table with Status="New", type="Regular".\n'
                'Available days decreased by the number of working days in the period.\n'
                'Approved by shows the assigned manager.'
            ),
            'req_ref': 'Qase suites 65-68',
            'module': 'Vacation / My Vacations',
            'notes': (
                'Number of days excludes weekends and office-specific public holidays.\n'
                'For AV=true offices, full year balance is available from Jan 1.\n'
                'For AV=false, monthly accrual applies.'
            ),
        },
        {
            'id': 'TC-VAC-002', 'title': 'Create administrative (unpaid) vacation request',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Any enabled employee.\n'
                'Query: SELECT login FROM ttt_vacation.employee WHERE enabled = true ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to Calendar of absences → My vacations and days off\n'
                '3. Click "Create a request" button\n'
                '4. Set start date to a future Monday\n'
                '5. Set end date to the same Monday (1-day vacation)\n'
                '6. Check the "Unpaid vacation" checkbox\n'
                '7. Verify "Number of days" shows 1\n'
                '8. Click "Save" button\n'
                '9. Verify vacation appears in table with type "Administrative"\n'
                '10. Verify Administrative days = 1, Regular days = 0\n'
                '11. Verify Available vacation days did NOT decrease'
            ),
            'expected': (
                'Administrative vacation created. Type shows "Administrative".\n'
                'No deduction from available vacation day balance.\n'
                'Administrative days column shows the day count.'
            ),
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'Administrative vacations have no balance requirement — can be created regardless of available days.',
        },
        {
            'id': 'TC-VAC-003', 'title': 'Create vacation with comment',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Enabled employee with sufficient days.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Fill in valid start and end dates\n'
                '5. Enter text in the "Comment" field: "Family trip"\n'
                '6. Click "Save"\n'
                '7. Verify vacation created successfully\n'
                '8. Click "..." on the new vacation row to open Request details\n'
                '9. Verify the comment is visible in the details dialog'
            ),
            'expected': 'Comment saved and visible in request details.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'Comment field is optional. Verify it accepts special characters and multi-line text.',
        },
        {
            'id': 'TC-VAC-004', 'title': 'Create vacation with "Also notify" colleagues',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': (
                'Employee with at least 2 colleagues in the same office.\n'
                'Query: SELECT e1.login AS creator, e2.login AS colleague FROM ttt_vacation.employee e1 '
                'JOIN ttt_vacation.employee e2 ON e1.office_id = e2.office_id AND e1.id != e2.id '
                'WHERE e1.enabled = true AND e2.enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Fill in valid start and end dates\n'
                '5. In the "Also notify" multi-select field, search for a colleague name\n'
                '6. Select 1-2 colleagues from the dropdown\n'
                '7. Click "Save"\n'
                '8. Verify vacation created successfully\n'
                'DB-CHECK: SELECT COUNT(*) FROM ttt_vacation.vacation_notify_also WHERE vacation = <new_vacation_id>'
            ),
            'expected': (
                'Vacation created with notify-also recipients stored.\n'
                'DB shows entries in vacation_notify_also table for each selected colleague.'
            ),
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': (
                'GET /vacations/{id} does NOT return notifyAlso data — must verify via DB.\n'
                'The label has a typo: "Also notifty" instead of "Also notify".'
            ),
        },
        {
            'id': 'TC-VAC-005', 'title': 'View vacation request details',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Employee with at least one existing vacation (any status).',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "..." action button on an existing vacation row\n'
                '4. Verify "Request details" dialog opens\n'
                '5. Verify the following fields are displayed:\n'
                '   - Period (start — end date)\n'
                '   - Number of days\n'
                '   - Status (e.g., New, Approved, Paid)\n'
                '   - Vacation type (Regular / Administrative)\n'
                '   - Payment month\n'
                '   - Approved by (manager name as link)\n'
                '   - Agreed by (optional approvers)\n'
                '6. Click "Close" button\n'
                '7. Verify dialog closes, table is unchanged'
            ),
            'expected': 'Request details dialog shows all vacation attributes correctly.',
            'req_ref': 'Qase suite 59', 'module': 'Vacation / My Vacations',
            'notes': '',
        },
        {
            'id': 'TC-VAC-006', 'title': 'Edit vacation dates — NEW status',
            'priority': 'Critical', 'type': 'Functional',
            'preconditions': (
                'Employee with a NEW vacation request.\n'
                'Query: SELECT e.login, v.id FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee e ON v.employee_id = e.id '
                'WHERE v.status = \'NEW\' AND e.enabled = true ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click edit (pencil icon) on the NEW vacation row\n'
                '4. Verify edit dialog opens with pre-filled dates\n'
                '5. Change start date to a different future Monday\n'
                '6. Change end date to that Friday\n'
                '7. Verify "Number of days" recalculates\n'
                '8. Click "Save"\n'
                '9. Verify vacation row updates with new dates\n'
                '10. Verify status remains "New"\n'
                '11. Verify Regular/Administrative days recalculated'
            ),
            'expected': (
                'Vacation dates updated. Status remains NEW.\n'
                'Day count recalculated based on new date range.'
            ),
            'req_ref': 'Qase suites 70-72', 'module': 'Vacation / My Vacations',
            'notes': 'Update validator does NOT check isNextVacationAvailable() — next year check is create-only.',
        },
        {
            'id': 'TC-VAC-007', 'title': 'Edit APPROVED vacation — status resets to NEW',
            'priority': 'Critical', 'type': 'Functional',
            'preconditions': (
                'Employee with an APPROVED vacation.\n'
                'Query: SELECT e.login, v.id FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee e ON v.employee_id = e.id '
                'WHERE v.status = \'APPROVED\' AND e.enabled = true '
                'AND v.start_date > CURRENT_DATE ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off\n'
                '3. Locate the APPROVED vacation in the table\n'
                '4. Click edit (pencil icon) on the row\n'
                '5. Change end date to one day later\n'
                '6. Click "Save"\n'
                '7. Verify status changed from "Approved" to "New"\n'
                '8. Verify the manager will need to re-approve'
            ),
            'expected': (
                'Editing an APPROVED vacation resets status to NEW.\n'
                'Requires re-approval from the manager.\n'
                'Optional approvals also reset to ASKED status.'
            ),
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'State transition: APPROVED → NEW on date edit. Days are recalculated.',
        },
        {
            'id': 'TC-VAC-008', 'title': 'Verify vacation table columns and sorting',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Employee with 3+ vacation records (mix of statuses).',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "All" filter tab to see all vacations\n'
                '4. Verify table columns: Vacation dates, Regular days, Administrative days, '
                'Vacation type, Approved by, Status, Payment month, Actions\n'
                '5. Click "Vacation dates" column header to sort ascending\n'
                '6. Verify rows are sorted by date ascending\n'
                '7. Click again to sort descending\n'
                '8. Verify rows reorder\n'
                '9. Repeat sort test for Regular days, Status columns'
            ),
            'expected': 'All columns present. Sorting toggles between asc/desc on each click.',
            'req_ref': 'Qase suite 61', 'module': 'Vacation / My Vacations',
            'notes': '',
        },
        {
            'id': 'TC-VAC-009', 'title': 'Verify vacation table filters — status and type',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Employee with vacations of different types and statuses.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off → "All" tab\n'
                '3. Click filter icon on "Vacation type" column\n'
                '4. Verify checkboxes: All, Regular, Administrative\n'
                '5. Uncheck "All", check only "Administrative"\n'
                '6. Verify table shows only Administrative vacations\n'
                '7. Reset filter (check "All")\n'
                '8. Click filter icon on "Status" column\n'
                '9. Verify checkboxes: All, New, Approved, Rejected, Paid, Finished, Deleted\n'
                '10. Check only "New" and "Approved"\n'
                '11. Verify table shows only vacations with those statuses'
            ),
            'expected': 'Filters correctly restrict displayed rows. Checkboxes toggle independently.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': '',
        },
        {
            'id': 'TC-VAC-010', 'title': 'Verify Open/Closed/All filter tabs',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Employee with both open (NEW/APPROVED) and closed (PAID/CANCELED) vacations.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Verify "Open" tab is active by default\n'
                '4. Verify only NEW and APPROVED vacations shown\n'
                '5. Click "Closed" tab\n'
                '6. Verify only PAID, CANCELED, REJECTED, DELETED vacations shown\n'
                '7. Click "All" tab\n'
                '8. Verify all vacations shown regardless of status'
            ),
            'expected': 'Tab filters correctly segment vacations by status category.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'Open = NEW + APPROVED. Closed = PAID + CANCELED + REJECTED + DELETED + FINISHED.',
        },
        {
            'id': 'TC-VAC-011', 'title': 'Verify available vacation days display and yearly breakdown',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Employee with vacation balance in current and past years.\n'
                'Query: SELECT e.login, ev.year, ev.available_vacation_days FROM ttt_vacation.employee_vacation ev '
                'JOIN ttt_vacation.employee e ON e.id = ev.employee WHERE e.enabled = true '
                'GROUP BY e.login, ev.year, ev.available_vacation_days HAVING COUNT(*) > 1 ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Verify "Available vacation days: N in YYYY" displayed\n'
                '4. Click the info (i) icon next to the year\n'
                '5. Verify popup shows per-year breakdown (e.g., 2025: 10, 2026: 24)\n'
                '6. Verify total matches the main display\n'
                '7. Close the popup'
            ),
            'expected': (
                'Available days shows correct total.\n'
                'Yearly breakdown popup shows remaining days per year.\n'
                'DB-CHECK: SELECT year, available_vacation_days FROM ttt_vacation.employee_vacation ev '
                'JOIN ttt_vacation.employee e ON e.id = ev.employee WHERE e.login = \'<login>\''
            ),
            'req_ref': 'Qase suite 59', 'module': 'Vacation / My Vacations',
            'notes': 'AV=true: full year balance available. AV=false: monthly accrual.',
        },
        {
            'id': 'TC-VAC-012', 'title': 'Verify total row in vacation table',
            'priority': 'Low', 'type': 'UI',
            'preconditions': 'Employee with 2+ vacations visible.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off → "All" tab\n'
                '3. Scroll to table footer\n'
                '4. Verify "Total" row exists\n'
                '5. Verify it sums Regular days column\n'
                '6. Verify it sums Administrative days column\n'
                '7. Compare with manual sum of visible rows'
            ),
            'expected': 'Total row accurately sums Regular and Administrative days columns.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': '',
        },
        {
            'id': 'TC-VAC-013', 'title': 'Create vacation starting today',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Employee with sufficient days. Today must be a weekday.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Set start date to today\'s date\n'
                '5. Set end date to today\n'
                '6. Verify "Number of days" shows 1 (if today is a working day)\n'
                '7. Click "Save"\n'
                '8. Verify vacation created with status "New"'
            ),
            'expected': 'Vacation with start date = today is accepted (boundary: today is valid, yesterday is not).',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'Backend validation: isBefore(today) — today itself passes. Past dates fail.',
        },
        {
            'id': 'TC-VAC-014', 'title': 'Create cross-year vacation (December to January)',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Employee with sufficient days in current and next year.\n'
                'SETUP: If current month is Jan-Oct, set server clock to late November via test API:\n'
                'PATCH /api/ttt/test/v1/clock with offset to reach Nov 15'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Set start date to Dec 22 of current year\n'
                '5. Set end date to Jan 9 of next year\n'
                '6. Verify "Number of days" calculates (excludes weekends and holidays in both years)\n'
                '7. Click "Save"\n'
                '8. Verify vacation created successfully\n'
                '9. Verify the day split between current and next year in Available days popup'
            ),
            'expected': (
                'Cross-year vacation created. Days split between Dec and Jan.\n'
                'FIFO distribution: Dec days from current year balance, Jan days from next year.'
            ),
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'Cross-year vacations consume days from both year buckets. Uses FIFO distribution.',
        },
        {
            'id': 'TC-VAC-015', 'title': 'Verify payment month auto-calculation',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Employee with sufficient days.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Set start date to a future date (e.g., 2 weeks from now)\n'
                '5. Set end date to start + 4 days\n'
                '6. Observe "Vacation pay to be paid with salary for" field\n'
                '7. Verify it auto-populates with the month containing the start date\n'
                '8. Try changing to a different month\n'
                '9. Verify the system accepts or adjusts the payment month'
            ),
            'expected': 'Payment month auto-calculated based on vacation start date. Can be adjusted by user.',
            'req_ref': 'Qase suite 68', 'module': 'Vacation / My Vacations',
            'notes': 'Backend: correctPaymentMonth() adjusts if needed. isPaymentDateCorrect() validates.',
        },
        {
            'id': 'TC-VAC-016', 'title': 'Verify "Number of days" auto-calculation in dialog',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Employee. Know the office production calendar for target dates.',
            'steps': (
                '1. Login as the employee\n'
                '2. Click "Create a request"\n'
                '3. Set start date to a Monday\n'
                '4. Set end date to Friday of the same week\n'
                '5. Verify "Number of days" shows 5 (or 4 if a public holiday falls in the range)\n'
                '6. Change end date to Saturday\n'
                '7. Verify day count still shows 5 (Saturday excluded)\n'
                '8. Change start date to Saturday, end date to Sunday\n'
                '9. Verify day count shows 0'
            ),
            'expected': (
                'Day count dynamically updates as dates change.\n'
                'Excludes weekends and office-specific public holidays.\n'
                'Sat-Sun only range shows 0 days.'
            ),
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'Uses VacationDaysCalculatorImpl with office production calendar.',
        },
        {
            'id': 'TC-VAC-017', 'title': 'Create vacation with optional approvers',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': (
                'Employee who is NOT a CPO/DM. Has a manager.\n'
                'Query: SELECT e.login FROM ttt_vacation.employee e '
                'WHERE e.enabled = true AND e.manager_id IS NOT NULL '
                'AND NOT EXISTS (SELECT 1 FROM ttt_backend.employee_role er WHERE er.employee_id = e.cs_id '
                'AND er.role = \'ROLE_DEPARTMENT_MANAGER\') ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Fill in valid dates\n'
                '5. Verify "Approved by" shows the direct manager\n'
                '6. Note whether "Agreed by" section is empty or pre-filled\n'
                '7. Click "Save"\n'
                '8. Verify vacation created\n'
                'DB-CHECK: SELECT va.status FROM ttt_vacation.vacation_approval va WHERE va.vacation = <id>'
            ),
            'expected': 'Vacation created with manager as primary approver. Optional approval entries in DB if applicable.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'CPO path: self-approval + manager as optional approver (ASKED). Regular: manager approves.',
        },
        {
            'id': 'TC-VAC-018', 'title': 'CPO creates vacation — self-approval',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Employee with ROLE_DEPARTMENT_MANAGER (CPO) who has a manager.\n'
                'Query: SELECT e.login FROM ttt_vacation.employee e '
                'JOIN ttt_backend.employee_role er ON e.cs_id = er.employee_id '
                'WHERE er.role = \'ROLE_DEPARTMENT_MANAGER\' AND e.manager_id IS NOT NULL AND e.enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the CPO employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Fill in valid dates\n'
                '5. Verify "Approved by" shows the CPO themselves (self-approval)\n'
                '6. Verify "Agreed by" shows the CPO\'s manager (as optional approver)\n'
                '7. Click "Save"\n'
                '8. Verify vacation created with status "New"\n'
                'DB-CHECK: SELECT v.approver_id, e.login FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee e ON v.approver_id = e.id WHERE v.id = <id>\n'
                'DB-CHECK: SELECT va.employee, va.status FROM ttt_vacation.vacation_approval va WHERE va.vacation = <id>'
            ),
            'expected': (
                'CPO is self-approver. Manager appears as optional approver with ASKED status.\n'
                'Approver ID in vacation table = CPO\'s own employee ID.'
            ),
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'VacationServiceImpl: if isCPO → setApproverId(employee.getId()), manager added as optional.',
        },
        {
            'id': 'TC-VAC-019', 'title': 'Verify pagination on vacation table',
            'priority': 'Low', 'type': 'UI',
            'preconditions': 'Employee with >10 vacation records.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off → "All" tab\n'
                '3. Verify pagination controls at bottom of table\n'
                '4. Click page 2 button\n'
                '5. Verify table shows next page of results\n'
                '6. Click "Previous" button\n'
                '7. Verify returns to page 1\n'
                '8. Click "Next" button\n'
                '9. Verify moves to page 2 again'
            ),
            'expected': 'Pagination works correctly. Page numbers and prev/next buttons navigate between pages.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': '',
        },
        {
            'id': 'TC-VAC-020', 'title': 'Verify vacation events feed',
            'priority': 'Low', 'type': 'Functional',
            'preconditions': 'Employee with vacation history (create, approve, cancel events).',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Vacation events feed" button (calendar icon)\n'
                '4. Verify events feed opens/displays\n'
                '5. Verify events show vacation lifecycle actions (created, approved, etc.)\n'
                '6. Verify events are ordered chronologically'
            ),
            'expected': 'Events feed displays vacation lifecycle events in chronological order.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'Timeline events: VACATION_CREATED, VACATION_APPROVED, VACATION_REJECTED, etc.',
        },
    ]


def _cases_lifecycle():
    return [
        {
            'id': 'TC-VAC-021', 'title': 'Cancel NEW vacation request',
            'priority': 'Critical', 'type': 'Functional',
            'preconditions': (
                'Employee with a NEW vacation.\n'
                'Query: SELECT e.login, v.id FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee e ON v.employee_id = e.id '
                'WHERE v.status = \'NEW\' AND e.enabled = true ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off\n'
                '3. Locate the NEW vacation in the table\n'
                '4. Click action menu (three-dot or action icon) on the row\n'
                '5. Click "Cancel" option\n'
                '6. Verify confirmation dialog (if any)\n'
                '7. Confirm the cancellation\n'
                '8. Verify vacation status changes to "Canceled"\n'
                '9. Verify vacation moves to "Closed" tab\n'
                '10. Verify available days restored to previous value'
            ),
            'expected': (
                'Vacation status = Canceled. Days returned to balance.\n'
                'Vacation visible under "Closed" tab.'
            ),
            'req_ref': 'Qase suites 74-76', 'module': 'Vacation / My Vacations',
            'notes': 'State transition: NEW → CANCELED (ROLE_EMPLOYEE).',
        },
        {
            'id': 'TC-VAC-022', 'title': 'Cancel APPROVED vacation',
            'priority': 'Critical', 'type': 'Functional',
            'preconditions': (
                'Employee with an APPROVED future vacation (payment date after current report period).\n'
                'Query: SELECT e.login, v.id FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee e ON v.employee_id = e.id '
                'WHERE v.status = \'APPROVED\' AND v.start_date > CURRENT_DATE AND e.enabled = true '
                'ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off\n'
                '3. Locate the APPROVED vacation\n'
                '4. Click cancel action on the row\n'
                '5. Confirm the cancellation\n'
                '6. Verify status changes to "Canceled"\n'
                '7. Verify available vacation days increase back\n'
                '8. Verify the row moves to "Closed" tab'
            ),
            'expected': (
                'APPROVED vacation canceled. Status = Canceled.\n'
                'Days returned to balance. FIFO redistribution triggered.'
            ),
            'req_ref': 'Qase suite 76', 'module': 'Vacation / My Vacations',
            'notes': 'Guarded by canBeCancelled: REGULAR + APPROVED + reportPeriod after paymentDate → blocked.',
        },
        {
            'id': 'TC-VAC-023', 'title': 'Restore CANCELED vacation (re-open)',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Employee with a CANCELED vacation.\n'
                'Query: SELECT e.login, v.id FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee e ON v.employee_id = e.id '
                'WHERE v.status = \'CANCELED\' AND v.start_date > CURRENT_DATE AND e.enabled = true '
                'ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off → "Closed" tab\n'
                '3. Locate the CANCELED vacation\n'
                '4. Click edit (pencil icon) or restore action\n'
                '5. Verify edit dialog opens with the original dates\n'
                '6. Click "Save" without changes (or adjust dates)\n'
                '7. Verify status changes back to "New"\n'
                '8. Verify vacation moves to "Open" tab\n'
                '9. Verify available days decrease again'
            ),
            'expected': (
                'CANCELED → NEW transition works. Vacation re-opened.\n'
                'Days recalculated and deducted from balance.'
            ),
            'req_ref': 'Qase suite 77', 'module': 'Vacation / My Vacations',
            'notes': 'Explicit transition in VacationStatusManager: CANCELED → NEW (ROLE_EMPLOYEE). Despite CANCELED being in FINAL_STATUSES.',
        },
        {
            'id': 'TC-VAC-024', 'title': 'Delete NEW vacation',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Employee with a NEW vacation.',
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off\n'
                '3. Locate the NEW vacation\n'
                '4. Click delete action (trash icon or menu option)\n'
                '5. Confirm deletion\n'
                '6. Verify vacation disappears from "Open" tab\n'
                '7. Switch to "All" tab\n'
                '8. Verify vacation shows with status "Deleted"\n'
                '9. Verify available days restored'
            ),
            'expected': 'Vacation soft-deleted. Status = Deleted. Days returned to balance.',
            'req_ref': 'Qase suite 78', 'module': 'Vacation / My Vacations',
            'notes': 'Soft delete — record persists with status=DELETED. DELETED records create ghost conflicts for future vacations at same dates.',
        },
        {
            'id': 'TC-VAC-025', 'title': 'Cannot delete PAID vacation',
            'priority': 'Critical', 'type': 'Negative',
            'preconditions': (
                'Employee with a PAID+EXACT vacation.\n'
                'Query: SELECT e.login, v.id FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee e ON v.employee_id = e.id '
                'WHERE v.status = \'PAID\' AND v.period_type = \'EXACT\' AND e.enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off → "Closed" tab\n'
                '3. Locate the PAID vacation\n'
                '4. Verify no delete/cancel action buttons are available\n'
                '5. Verify only "Request details" (view) action is available'
            ),
            'expected': 'No delete/cancel actions for PAID vacations. Permission service returns empty set.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'Guard: PAID+EXACT → ServiceException("exception.vacation.delete.notAllowed"). VacationPermissionService returns no permissions for PAID status.',
        },
        {
            'id': 'TC-VAC-026', 'title': 'Cannot cancel PAID vacation',
            'priority': 'Critical', 'type': 'Negative',
            'preconditions': 'Employee with a PAID vacation.',
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off → "Closed" tab\n'
                '3. Locate the PAID vacation\n'
                '4. Verify no cancel action is available\n'
                '5. Verify the row shows only a view details button'
            ),
            'expected': 'PAID is a terminal state. No status-changing actions available in UI.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'PAID status: VacationPermissionService.calculate() returns empty set → no action buttons rendered.',
        },
        {
            'id': 'TC-VAC-027', 'title': 'Cannot cancel APPROVED vacation after accounting period close',
            'priority': 'High', 'type': 'Negative',
            'preconditions': (
                'APPROVED REGULAR vacation with payment date before current office report period.\n'
                'SETUP: Use test API to advance clock so reportPeriod is after the vacation paymentDate.\n'
                'PATCH /api/ttt/test/v1/clock to set date past the payment month.'
            ),
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off\n'
                '3. Locate the APPROVED vacation whose payment month has passed\n'
                '4. Verify no cancel/delete action buttons are available for this vacation\n'
                '5. Verify only view details is available'
            ),
            'expected': 'canBeCancelled returns false: REGULAR + APPROVED + reportPeriod after paymentDate → actions disabled.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'The canBeCancelled guard protects closed accounting periods from cancellation.',
        },
        {
            'id': 'TC-VAC-028', 'title': 'Verify days returned to balance after cancel',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Employee with known available days and a NEW REGULAR 5-day vacation.\n'
                'Note the available days before and after creating the vacation.'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Note the "Available vacation days" count (call it X)\n'
                '4. Cancel the 5-day NEW vacation\n'
                '5. Verify "Available vacation days" increases back to X\n'
                '6. Verify the days were returned correctly\n'
                'DB-CHECK: SELECT SUM(available_vacation_days) FROM ttt_vacation.employee_vacation ev '
                'JOIN ttt_vacation.employee e ON e.id = ev.employee WHERE e.login = \'<login>\''
            ),
            'expected': 'Available days fully restored after cancellation. FIFO redistribution may adjust other vacations.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'VacationRecalculationService.recalculate() triggered on cancel. FIFO redistribution runs.',
        },
        {
            'id': 'TC-VAC-029', 'title': 'Delete REJECTED vacation',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': (
                'Employee with a REJECTED vacation.\n'
                'Query: SELECT e.login, v.id FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee e ON v.employee_id = e.id '
                'WHERE v.status = \'REJECTED\' AND e.enabled = true ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off → "Closed" tab\n'
                '3. Locate the REJECTED vacation\n'
                '4. Click delete action\n'
                '5. Confirm deletion\n'
                '6. Verify status changes to "Deleted"'
            ),
            'expected': 'REJECTED vacation can be deleted. Status = Deleted.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'REJECTED is deletable because it is not PAID.',
        },
        {
            'id': 'TC-VAC-030', 'title': 'Delete CANCELED vacation',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Employee with a CANCELED vacation.',
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations and days off → "Closed" tab\n'
                '3. Locate the CANCELED vacation\n'
                '4. Click delete action\n'
                '5. Confirm deletion\n'
                '6. Verify status changes to "Deleted"\n'
                '7. Verify vacation remains visible under "All" tab with status "Deleted"'
            ),
            'expected': 'CANCELED vacation deleted (soft delete). Status = Deleted.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': '',
        },
    ]


def _cases_approval():
    return [
        {
            'id': 'TC-VAC-031', 'title': 'Approve NEW vacation request (manager view)',
            'priority': 'Critical', 'type': 'Functional',
            'preconditions': (
                'Manager with pending approval requests.\n'
                'Query: SELECT m.login AS manager, e.login AS employee, v.id FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee e ON v.employee_id = e.id '
                'JOIN ttt_vacation.employee m ON v.approver_id = m.id '
                'WHERE v.status = \'NEW\' AND m.enabled = true ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Calendar of absences → Employees requests\n'
                '3. Verify "Vacation requests" tab is active\n'
                '4. Click "Approval" sub-tab\n'
                '5. Locate the employee\'s NEW vacation request in the table\n'
                '6. Click approve button (checkmark icon, data-testid="vacation-request-action-approve")\n'
                '7. Verify confirmation prompt (if any)\n'
                '8. Confirm approval\n'
                '9. Verify vacation disappears from Approval list (or status updates)\n'
                '10. Login as the employee to verify status = "Approved" in My Vacations'
            ),
            'expected': (
                'Vacation status changes to APPROVED.\n'
                'Request removed from manager\'s pending approval list.\n'
                'Employee sees status "Approved" in their vacation table.'
            ),
            'req_ref': 'Qase suites 89, 92', 'module': 'Vacation / Employee Requests',
            'notes': 'State: NEW → APPROVED. Days deducted at approval. Payment date may be adjusted to approvePeriodStartDate.',
        },
        {
            'id': 'TC-VAC-032', 'title': 'Reject NEW vacation request (manager view)',
            'priority': 'Critical', 'type': 'Functional',
            'preconditions': 'Manager with pending NEW vacation requests.',
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Employees requests → Vacation requests → Approval\n'
                '3. Locate a NEW vacation request\n'
                '4. Click reject button (X icon, data-testid="vacation-request-action-reject")\n'
                '5. Verify rejection dialog opens (may ask for reason)\n'
                '6. Confirm rejection\n'
                '7. Verify vacation disappears from pending list\n'
                '8. Login as the employee\n'
                '9. Verify vacation status = "Rejected" in My Vacations → Closed tab'
            ),
            'expected': 'Vacation rejected. Status = REJECTED. Employee sees it under Closed tab.',
            'req_ref': 'Qase suites 94, 97', 'module': 'Vacation / Employee Requests',
            'notes': 'State: NEW → REJECTED (PM, DM, ADMIN). Days returned.',
        },
        {
            'id': 'TC-VAC-033', 'title': 'Re-approve REJECTED vacation without edit',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Manager with a REJECTED vacation they can approve.\n'
                'Note: No REJECTED→NEW transition exists — direct REJECTED→APPROVED is the only re-approval path.'
            ),
            'steps': (
                '1. Login as the manager/approver\n'
                '2. Navigate to Employees requests\n'
                '3. Find the REJECTED vacation (may need to check "All" or specific filter)\n'
                '4. Click approve button\n'
                '5. Confirm approval\n'
                '6. Verify status changes directly from REJECTED to APPROVED\n'
                '7. Login as the employee to verify'
            ),
            'expected': 'Direct REJECTED → APPROVED transition. No edit required.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': 'VacationStatusManager has explicit REJECTED→APPROVED entry. No REJECTED→NEW exists.',
        },
        {
            'id': 'TC-VAC-034', 'title': 'Reject APPROVED vacation',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Manager with an APPROVED vacation they approved (canBeCancelled = true).\n'
                'Query: SELECT m.login AS manager, v.id FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee m ON v.approver_id = m.id '
                'WHERE v.status = \'APPROVED\' AND v.start_date > CURRENT_DATE AND m.enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Employees requests\n'
                '3. Find the APPROVED vacation\n'
                '4. Click reject button\n'
                '5. Confirm rejection\n'
                '6. Verify status changes to REJECTED\n'
                '7. Verify days returned to employee\'s balance'
            ),
            'expected': 'APPROVED → REJECTED. Days returned to pool. FIFO redistribution triggered.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': 'REJECTABLE_STATUSES = {NEW, APPROVED}. canBeCancelled guard applies.',
        },
        {
            'id': 'TC-VAC-035', 'title': 'Redirect vacation request to another manager',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Manager with a pending vacation request.\n'
                'Another manager exists to redirect to.'
            ),
            'steps': (
                '1. Login as the current approver\n'
                '2. Navigate to Employees requests → Approval\n'
                '3. Find a NEW vacation request\n'
                '4. Click redirect button (arrow icon, data-testid="vacation-request-action-redirect")\n'
                '5. Verify redirect dialog opens\n'
                '6. Search for and select another manager\n'
                '7. Confirm redirect\n'
                '8. Verify vacation disappears from current manager\'s list\n'
                '9. Login as the new approver\n'
                '10. Verify vacation appears in their Approval list'
            ),
            'expected': (
                'Vacation request redirected to new approver.\n'
                'Old approver no longer sees it. New approver sees it in their queue.'
            ),
            'req_ref': 'Qase suites 99-100', 'module': 'Vacation / Employee Requests',
            'notes': 'Uses PUT /change-approver endpoint. Known bug: pass endpoint NPE on qa-1 (Caffeine cache).',
        },
        {
            'id': 'TC-VAC-036', 'title': 'Verify Employee Requests page — Approval tab',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Manager with pending approval requests.',
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Calendar of absences → Employees requests\n'
                '3. Verify "Vacation requests" tab with count badge\n'
                '4. Verify "Approval (N)" sub-tab is active\n'
                '5. Verify table columns: Employee, Vacation dates, Vacation type, Manager, '
                'Approved by, Agreed by, Payment month, Status, Actions\n'
                '6. Verify action buttons for each row: Approve, Reject, Redirect, Details\n'
                '7. Verify "Agreed by" column shows progress bar'
            ),
            'expected': 'Approval tab shows all pending requests needing this manager\'s approval with correct columns and actions.',
            'req_ref': 'Qase suite 89', 'module': 'Vacation / Employee Requests',
            'notes': '',
        },
        {
            'id': 'TC-VAC-037', 'title': 'Verify Employee Requests page — Agreement tab',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Manager who is an optional approver on some vacations.',
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Employees requests\n'
                '3. Click "Agreement (N)" sub-tab\n'
                '4. Verify table shows vacations where this manager is an optional approver\n'
                '5. Verify different action buttons compared to Approval tab (agree/disagree)'
            ),
            'expected': 'Agreement tab shows vacations pending this manager\'s optional agreement.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': 'Optional approvers have ASKED/APPROVED/REJECTED status in vacation_approval table.',
        },
        {
            'id': 'TC-VAC-038', 'title': 'Verify Employee Requests — My Department filter',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Department manager with department members.',
            'steps': (
                '1. Login as department manager\n'
                '2. Navigate to Employees requests\n'
                '3. Click "My department" sub-tab\n'
                '4. Verify table shows vacations from department members only\n'
                '5. Verify employees from other departments are not shown'
            ),
            'expected': 'My department filter shows only vacations from department members.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': '',
        },
        {
            'id': 'TC-VAC-039', 'title': 'Verify Employee Requests — My Projects filter',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Project manager with project team members.',
            'steps': (
                '1. Login as project manager\n'
                '2. Navigate to Employees requests\n'
                '3. Click "My projects" sub-tab\n'
                '4. Verify table shows vacations from project team members\n'
                '5. Verify employees from other projects are not shown'
            ),
            'expected': 'My projects filter shows only vacations from team members of managed projects.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': '',
        },
        {
            'id': 'TC-VAC-040', 'title': 'Verify Employee Requests — Redirected filter',
            'priority': 'Low', 'type': 'UI',
            'preconditions': 'Manager who previously redirected a vacation request.',
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Employees requests\n'
                '3. Click "Redirected" sub-tab\n'
                '4. Verify table shows vacations that were redirected from this manager'
            ),
            'expected': 'Redirected tab shows vacations this manager forwarded to another approver.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': '',
        },
        {
            'id': 'TC-VAC-041', 'title': 'Verify request details from manager view',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Manager with pending requests.',
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Employees requests → Approval\n'
                '3. Click details button (eye icon, data-testid="vacation-request-action-info")\n'
                '4. Verify request details dialog shows: Period, Number of days, Status, '
                'Vacation type, Payment month, Approved by, Agreed by\n'
                '5. Close the dialog'
            ),
            'expected': 'Manager can view full vacation details before approving/rejecting.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': '',
        },
        {
            'id': 'TC-VAC-042', 'title': 'Verify sorting on Employee Requests table',
            'priority': 'Low', 'type': 'UI',
            'preconditions': 'Manager with multiple pending requests.',
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Employees requests → Approval\n'
                '3. Verify default sort is by Vacation dates descending\n'
                '4. Click "Employee" column header\n'
                '5. Verify rows sort alphabetically by employee name\n'
                '6. Click "Payment month" column header\n'
                '7. Verify rows sort by payment month'
            ),
            'expected': 'All sortable columns toggle between ascending and descending.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': '',
        },
        {
            'id': 'TC-VAC-043', 'title': 'No-manager employee — self-approval on create',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': (
                'Employee without a manager (manager_id IS NULL).\n'
                'Query: SELECT login FROM ttt_vacation.employee WHERE manager_id IS NULL AND enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the employee without manager\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Fill valid dates\n'
                '5. Verify "Approved by" shows the employee themselves\n'
                '6. Click "Save"\n'
                '7. Verify vacation created with self as approver'
            ),
            'expected': 'No-manager employee auto-approves. Approver = self.',
            'req_ref': '', 'module': 'Vacation / My Vacations',
            'notes': 'VacationServiceImpl: if manager == null → setApproverId(employee.getId())',
        },
        {
            'id': 'TC-VAC-044', 'title': 'Verify agreement progress bar',
            'priority': 'Low', 'type': 'UI',
            'preconditions': 'Vacation with multiple optional approvers (some ASKED, some APPROVED).',
            'steps': (
                '1. Login as the primary approver\n'
                '2. Navigate to Employees requests\n'
                '3. Find vacation with optional approvers\n'
                '4. Verify "Agreed by" column shows a progress bar\n'
                '5. Verify bar color/fill indicates approval progress\n'
                '6. Hover over or click the bar to see individual approver statuses'
            ),
            'expected': 'Progress bar reflects optional approver agreement status (ASKED vs APPROVED).',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': 'vacation_approval table: status = ASKED (initial), APPROVED, REJECTED.',
        },
        {
            'id': 'TC-VAC-045', 'title': 'Approve vacation — verify days deducted',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Manager + employee pair. Know employee available days before approval.\n'
                'Employee has a 5-day NEW vacation pending approval.'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and note "Available vacation days" (call it X)\n'
                '3. Logout\n'
                '4. Login as the manager\n'
                '5. Navigate to Employees requests → Approval\n'
                '6. Approve the employee\'s vacation\n'
                '7. Logout\n'
                '8. Login as the employee again\n'
                '9. Navigate to My vacations\n'
                '10. Verify "Available vacation days" is approximately X (days consumed at create, confirmed at approve)\n'
                '11. Verify vacation status = "Approved"'
            ),
            'expected': 'Days are deducted at creation, confirmed at approval. Balance reflects approved vacation.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': 'Days consumed at creation via FIFO. Approval confirms the deduction.',
        },
        {
            'id': 'TC-VAC-046', 'title': 'Reject vacation — verify days returned',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Manager + employee pair. Employee has a NEW vacation pending approval.',
            'steps': (
                '1. Login as the employee, note available days (call it X)\n'
                '2. Logout and login as the manager\n'
                '3. Reject the employee\'s vacation\n'
                '4. Logout and login as the employee\n'
                '5. Verify available days returned to X + vacation days\n'
                '6. Verify vacation status = "Rejected" under Closed tab'
            ),
            'expected': 'Rejection returns days to pool. Available days increase back.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': 'FIFO redistribution triggered: days returned may be redistributed to remaining vacations.',
        },
        {
            'id': 'TC-VAC-047', 'title': 'Vacation type filter on Employee Requests',
            'priority': 'Low', 'type': 'UI',
            'preconditions': 'Manager with both Regular and Administrative vacation requests.',
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Employees requests → Approval\n'
                '3. Click filter icon on "Vacation type" column\n'
                '4. Verify checkboxes: All, Regular, Administrative\n'
                '5. Select only "Administrative"\n'
                '6. Verify table shows only Administrative vacation requests\n'
                '7. Reset filter'
            ),
            'expected': 'Vacation type filter works correctly on Employee Requests table.',
            'req_ref': '', 'module': 'Vacation / Employee Requests',
            'notes': '',
        },
    ]


def _cases_payment():
    return [
        {
            'id': 'TC-VAC-048', 'title': 'Pay APPROVED vacation (accountant view)',
            'priority': 'Critical', 'type': 'Functional',
            'preconditions': (
                'User with accountant role (ROLE_ACCOUNTANT or ROLE_CHIEF_ACCOUNTANT).\n'
                'An APPROVED vacation exists for an employee.\n'
                'Query: SELECT v.id, e.login FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.employee e ON v.employee_id = e.id '
                'WHERE v.status = \'APPROVED\' AND v.period_type = \'EXACT\' AND e.enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the accountant\n'
                '2. Navigate to Accounting → Vacation payment (or similar menu)\n'
                '3. Verify payment table loads with pending vacations\n'
                '4. Locate the APPROVED vacation\n'
                '5. Click pay action / payment button\n'
                '6. Verify payment dialog opens\n'
                '7. Verify regular days and administrative days fields show correct values\n'
                '8. Confirm payment\n'
                '9. Verify vacation status changes to "Paid"\n'
                '10. Verify vacation disappears from pending payment list'
            ),
            'expected': (
                'APPROVED → PAID transition. Payment record created.\n'
                'Vacation_payment record stored in DB.'
            ),
            'req_ref': 'Qase suites 215-221', 'module': 'Vacation / Payment',
            'notes': (
                'PayVacationServiceImpl validates: status must be APPROVED, periodType must be EXACT.\n'
                'regularDaysPayed + administrativeDaysPayed must equal vacation.days.'
            ),
        },
        {
            'id': 'TC-VAC-049', 'title': 'Pay administrative vacation',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Accountant. An APPROVED administrative vacation exists.',
            'steps': (
                '1. Login as the accountant\n'
                '2. Navigate to Vacation payment page\n'
                '3. Locate the APPROVED administrative vacation\n'
                '4. Click pay action\n'
                '5. Verify regularDaysPayed = 0, administrativeDaysPayed = N\n'
                '6. Confirm payment\n'
                '7. Verify status = "Paid"\n'
                'DB-CHECK: SELECT vp.regular_days, vp.administrative_days FROM ttt_vacation.vacation v '
                'JOIN ttt_vacation.vacation_payment vp ON v.vacation_payment_id = vp.id WHERE v.id = <id>'
            ),
            'expected': 'Administrative vacation paid. No balance impact. DB shows regular_days=0.',
            'req_ref': '', 'module': 'Vacation / Payment',
            'notes': 'ADMINISTRATIVE pay: regularDaysPayed=0, administrativeDaysPayed=N.',
        },
        {
            'id': 'TC-VAC-050', 'title': 'Cannot pay non-APPROVED vacation',
            'priority': 'High', 'type': 'Negative',
            'preconditions': 'Accountant. A NEW vacation exists.',
            'steps': (
                '1. Login as the accountant\n'
                '2. Navigate to Vacation payment page\n'
                '3. Verify NEW vacations are NOT listed in the payment queue\n'
                '4. (If API test) Attempt PUT /pay/{id} for a NEW vacation\n'
                '5. Verify HTTP 400 error'
            ),
            'expected': 'Payment blocked for non-APPROVED vacations. Only APPROVED + EXACT can be paid.',
            'req_ref': '', 'module': 'Vacation / Payment',
            'notes': 'PayVacationServiceImpl.checkForPayment validates APPROVED + EXACT.',
        },
        {
            'id': 'TC-VAC-051', 'title': 'Verify payment page table and columns',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Accountant with access to payment page.',
            'steps': (
                '1. Login as the accountant\n'
                '2. Navigate to Accounting → Vacation payment\n'
                '3. Verify page title and layout\n'
                '4. Verify table columns are present and correctly labeled\n'
                '5. Verify sorting works on relevant columns\n'
                '6. Verify pagination if many records'
            ),
            'expected': 'Payment page displays correctly with proper columns, sorting, and pagination.',
            'req_ref': 'Qase suites 215-216', 'module': 'Vacation / Payment',
            'notes': '',
        },
        {
            'id': 'TC-VAC-052', 'title': 'Verify PAID status is terminal — no actions available',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Employee with a PAID vacation.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations → "Closed" tab\n'
                '3. Find the PAID vacation\n'
                '4. Verify no edit, cancel, or delete actions available\n'
                '5. Verify only "Request details" view action exists\n'
                '6. Login as the accountant\n'
                '7. Verify PAID vacation is not in the payment queue\n'
                '8. Login as the manager\n'
                '9. Verify no approve/reject actions for PAID vacations'
            ),
            'expected': 'PAID is terminal. No role can modify, cancel, or re-process a PAID vacation.',
            'req_ref': '', 'module': 'Vacation / Payment',
            'notes': 'All permission checks return empty set for PAID status.',
        },
        {
            'id': 'TC-VAC-053', 'title': 'Auto-pay expired approved vacations',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': (
                'An APPROVED vacation with start_date > 2 months in the past.\n'
                'SETUP: Advance clock via test API to make the vacation old enough.'
            ),
            'steps': (
                '1. SETUP: Create and approve a vacation for past dates via UI or API\n'
                '2. SETUP: Advance server clock by 2+ months: PATCH /api/ttt/test/v1/clock\n'
                '3. SETUP: Trigger auto-pay job: POST /api/vacation/v1/test/vacations/pay-expired-approved\n'
                '4. Login as the employee\n'
                '5. Navigate to My vacations → "Closed" tab\n'
                '6. Verify the vacation status is now "Paid"\n'
                'DB-CHECK: SELECT v.status, vp.payed_at FROM ttt_vacation.vacation v '
                'LEFT JOIN ttt_vacation.vacation_payment vp ON v.vacation_payment_id = vp.id WHERE v.id = <id>'
            ),
            'expected': (
                'VacationStatusUpdateJob auto-pays expired approved vacations.\n'
                'Payment distributed: regular days + administrative days.'
            ),
            'req_ref': '', 'module': 'Vacation / Payment',
            'notes': 'payExpiredApproved() runs daily. Finds APPROVED >2 months old. Auto-distributes payment by type.',
        },
        {
            'id': 'TC-VAC-054', 'title': 'Verify payment record in DB after payment',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Just-paid vacation.',
            'steps': (
                '1. After paying a vacation (via TC-VAC-048), note the vacation ID\n'
                'DB-CHECK: SELECT vp.id, vp.regular_days, vp.administrative_days, vp.payed_at '
                'FROM ttt_vacation.vacation v JOIN ttt_vacation.vacation_payment vp '
                'ON v.vacation_payment_id = vp.id WHERE v.id = <vacation_id>\n'
                '2. Verify regular_days matches the vacation\'s regular working days\n'
                '3. Verify administrative_days matches the vacation\'s admin days\n'
                '4. Verify payed_at is today (or the specified date)'
            ),
            'expected': 'vacation_payment record created with correct day split and payment date.',
            'req_ref': '', 'module': 'Vacation / Payment',
            'notes': 'FK: vacation.vacation_payment_id → vacation_payment.id. NOT a shared PK.',
        },
        {
            'id': 'TC-VAC-055', 'title': 'Bulk payment popup',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Accountant with multiple APPROVED vacations pending payment.',
            'steps': (
                '1. Login as the accountant\n'
                '2. Navigate to Vacation payment page\n'
                '3. Select multiple vacations (if checkbox available)\n'
                '4. Click bulk payment button\n'
                '5. Verify bulk payment popup with vacation list\n'
                '6. Confirm bulk payment\n'
                '7. Verify all selected vacations change to PAID'
            ),
            'expected': 'Bulk payment processes multiple vacations at once.',
            'req_ref': 'Qase suite 220', 'module': 'Vacation / Payment',
            'notes': '',
        },
    ]


def _cases_daycalc():
    return [
        {
            'id': 'TC-VAC-056', 'title': 'Verify available days for AV=false employee (monthly accrual)',
            'priority': 'Critical', 'type': 'Functional',
            'preconditions': (
                'Employee in AV=false office.\n'
                'Query: SELECT e.login, o.name FROM ttt_vacation.employee e '
                'JOIN ttt_vacation.office o ON e.office_id = o.id '
                'WHERE o.advance_vacation = false AND e.enabled = true ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the AV=false employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Read "Available vacation days" count\n'
                '4. Calculate expected: (current_month * annual_norm / 12) + adjustments\n'
                '5. Click info icon for yearly breakdown\n'
                '6. Verify the balance matches monthly accrual model\n'
                'DB-CHECK: SELECT ev.year, ev.available_vacation_days FROM ttt_vacation.employee_vacation ev '
                'JOIN ttt_vacation.employee e ON e.id = ev.employee WHERE e.login = \'<login>\''
            ),
            'expected': 'AV=false: days accrue monthly. Balance = (month * norm/12) + past + edited - consumed.',
            'req_ref': 'Qase suites 116-126', 'module': 'Vacation / Day Calculation',
            'notes': 'AV=false offices (Russia): monthly accrual. Never goes negative.',
        },
        {
            'id': 'TC-VAC-057', 'title': 'Verify available days for AV=true employee (full year)',
            'priority': 'Critical', 'type': 'Functional',
            'preconditions': (
                'Employee in AV=true office.\n'
                'Query: SELECT e.login, o.name FROM ttt_vacation.employee e '
                'JOIN ttt_vacation.office o ON e.office_id = o.id '
                'WHERE o.advance_vacation = true AND e.enabled = true ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the AV=true employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Read "Available vacation days" count\n'
                '4. Verify full annual norm is available from January 1\n'
                '5. Click info icon to verify yearly breakdown\n'
                '6. Verify balance can be fractional (e.g., 20.193)\n'
                'DB-CHECK: Same as TC-VAC-056'
            ),
            'expected': 'AV=true: full year balance available from Jan 1. Can go negative. Fractional display.',
            'req_ref': '', 'module': 'Vacation / Day Calculation',
            'notes': 'AV=true offices (Cyprus, Germany): advance vacation. Negative balance allowed.',
        },
        {
            'id': 'TC-VAC-058', 'title': 'Verify FIFO day consumption (earliest year first)',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Employee with remaining days in both past year and current year.\n'
                'Query: SELECT e.login, ev.year, ev.available_vacation_days FROM ttt_vacation.employee_vacation ev '
                'JOIN ttt_vacation.employee e ON e.id = ev.employee '
                'WHERE e.enabled = true AND ev.available_vacation_days > 0 '
                'GROUP BY e.login, ev.year, ev.available_vacation_days '
                'HAVING COUNT(*) >= 2 ORDER BY random() LIMIT 1'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Note per-year breakdown (click info icon)\n'
                '3. Create a vacation that consumes days (e.g., 3 days)\n'
                '4. After creation, check per-year breakdown again\n'
                '5. Verify days were consumed from the earliest year first\n'
                'DB-CHECK: SELECT year, available_vacation_days FROM ttt_vacation.employee_vacation ev '
                'JOIN ttt_vacation.employee e ON e.id = ev.employee WHERE e.login = \'<login>\' ORDER BY year'
            ),
            'expected': 'FIFO: days consumed from earliest year bucket first. Only when exhausted, next year used.',
            'req_ref': '', 'module': 'Vacation / Day Calculation',
            'notes': 'vacation_days_distribution tracks per-vacation year split.',
        },
        {
            'id': 'TC-VAC-059', 'title': 'Verify working days exclude holidays',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Employee. Know the office production calendar — identify a week with a public holiday.\n'
                'Query: SELECT cd.date, cd.day_type FROM ttt_calendar.calendar_day cd '
                'JOIN ttt_calendar.calendar c ON cd.calendar_id = c.id '
                'WHERE c.office_id = <office_id> AND cd.day_type != \'WORKING\' AND cd.date > CURRENT_DATE LIMIT 5'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Set start date to the Monday of the week with a public holiday\n'
                '5. Set end date to the Friday of that week\n'
                '6. Verify "Number of days" shows 4 (not 5) because of the holiday\n'
                '7. Cancel the dialog'
            ),
            'expected': 'Working day count excludes office-specific public holidays. Mon-Fri with 1 holiday = 4 days.',
            'req_ref': '', 'module': 'Vacation / Day Calculation',
            'notes': 'VacationDaysCalculatorImpl uses office production calendar.',
        },
        {
            'id': 'TC-VAC-060', 'title': 'Verify administrative vacation does not deduct days',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Employee with known available days.',
            'steps': (
                '1. Login as the employee\n'
                '2. Note "Available vacation days" (call it X)\n'
                '3. Click "Create a request"\n'
                '4. Set valid dates for 3 working days\n'
                '5. Check "Unpaid vacation" checkbox\n'
                '6. Click "Save"\n'
                '7. Verify "Available vacation days" is still X (unchanged)\n'
                '8. Verify Administrative days = 3 in the table'
            ),
            'expected': 'Administrative vacation: no balance deduction. Available days unchanged.',
            'req_ref': '', 'module': 'Vacation / Day Calculation',
            'notes': 'ADMINISTRATIVE vacations have no available days validation.',
        },
        {
            'id': 'TC-VAC-061', 'title': 'Verify day recalculation after cancel',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Employee with a 5-day REGULAR vacation (NEW or APPROVED).',
            'steps': (
                '1. Login as the employee\n'
                '2. Note available days before cancellation (X)\n'
                '3. Cancel the 5-day vacation\n'
                '4. Verify available days increased by ~5\n'
                '5. Check per-year breakdown to verify correct year bucket restored'
            ),
            'expected': 'Days returned to correct year bucket(s). FIFO redistribution recalculates remaining vacations.',
            'req_ref': '', 'module': 'Vacation / Day Calculation',
            'notes': 'VacationRecalculationService.recalculate() called on cancel.',
        },
        {
            'id': 'TC-VAC-062', 'title': 'Verify Employees Vacation Days page (DM view)',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': (
                'User with ROLE_DEPARTMENT_MANAGER or ROLE_ADMIN.\n'
                'Query: SELECT e.login FROM ttt_vacation.employee e '
                'JOIN ttt_backend.employee_role er ON e.cs_id = er.employee_id '
                'WHERE er.role = \'ROLE_DEPARTMENT_MANAGER\' AND e.enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the department manager\n'
                '2. Navigate to Calendar of absences → Employees vacation days\n'
                '3. Verify page title: "Employees vacation days"\n'
                '4. Verify table columns: Employee, Vacation days, Pending approval\n'
                '5. Verify employee names are clickable links\n'
                '6. Search for an employee by name\n'
                '7. Verify search filters the table\n'
                '8. Toggle "Show dismissed employees" checkbox\n'
                '9. Verify dismissed employees appear/disappear'
            ),
            'expected': 'DM can view all employees\' vacation days. Search and dismiss filter work.',
            'req_ref': '', 'module': 'Vacation / Vacation Days',
            'notes': 'Access restricted to DM and ADMIN roles.',
        },
        {
            'id': 'TC-VAC-063', 'title': 'Verify insufficient days warning on create (AV=false)',
            'priority': 'High', 'type': 'Negative',
            'preconditions': (
                'AV=false employee with very few available days (e.g., 1-2 days remaining).\n'
                'Query: SELECT e.login, SUM(ev.available_vacation_days) as total FROM ttt_vacation.employee_vacation ev '
                'JOIN ttt_vacation.employee e ON e.id = ev.employee '
                'JOIN ttt_vacation.office o ON e.office_id = o.id '
                'WHERE o.advance_vacation = false AND e.enabled = true '
                'GROUP BY e.login HAVING SUM(ev.available_vacation_days) BETWEEN 1 AND 3 LIMIT 1'
            ),
            'steps': (
                '1. Login as the employee with low balance\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Set dates for a vacation longer than available days (e.g., 5 days with 2 available)\n'
                '5. Click "Save"\n'
                '6. Verify error message about insufficient days\n'
                '7. Verify vacation is NOT created'
            ),
            'expected': (
                'Error: validation.vacation.duration — insufficient available paid days.\n'
                'AV=false: cannot create vacation exceeding available balance.'
            ),
            'req_ref': '', 'module': 'Vacation / Day Calculation',
            'notes': 'VacationCreateValidator checks availablePaidDays < total for REGULAR type. AV=true can go negative.',
        },
    ]


def _cases_daycorrection():
    return [
        {
            'id': 'TC-VAC-064', 'title': 'Add positive vacation day correction (accountant)',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Accountant or chief accountant user.\n'
                'Target employee with known vacation day balance.'
            ),
            'steps': (
                '1. Login as the accountant\n'
                '2. Navigate to Accounting → Vacation day correction (or similar)\n'
                '3. Search for the target employee\n'
                '4. Click to add correction\n'
                '5. Enter positive correction amount (e.g., +3 days)\n'
                '6. Select the target year\n'
                '7. Enter a reason/comment\n'
                '8. Confirm the correction\n'
                '9. Verify the employee\'s balance increased by 3\n'
                '10. Login as the employee and verify updated available days'
            ),
            'expected': 'Positive correction adds days. Employee balance updated immediately.',
            'req_ref': 'Qase suites 223-224', 'module': 'Vacation / Day Correction',
            'notes': 'Corrections modify employee_vacation.available_vacation_days for the specified year.',
        },
        {
            'id': 'TC-VAC-065', 'title': 'Add negative vacation day correction (AV=true only)',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Accountant. Target employee in AV=true office with positive balance.\n'
                'Query: SELECT e.login FROM ttt_vacation.employee e '
                'JOIN ttt_vacation.office o ON e.office_id = o.id '
                'JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee '
                'WHERE o.advance_vacation = true AND ev.available_vacation_days > 5 AND e.enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the accountant\n'
                '2. Navigate to Day correction page\n'
                '3. Search for AV=true employee\n'
                '4. Enter negative correction (e.g., -2 days)\n'
                '5. Select year and enter reason\n'
                '6. Confirm\n'
                '7. Verify balance decreased by 2\n'
                '8. Login as employee, verify updated balance'
            ),
            'expected': 'Negative correction accepted for AV=true. Balance decreased.',
            'req_ref': '', 'module': 'Vacation / Day Correction',
            'notes': 'AV=true allows negative balance. AV=false rejects negative corrections.',
        },
        {
            'id': 'TC-VAC-066', 'title': 'Cannot add negative correction for AV=false employee',
            'priority': 'High', 'type': 'Negative',
            'preconditions': (
                'Accountant. Target employee in AV=false office.\n'
                'Query: SELECT e.login FROM ttt_vacation.employee e '
                'JOIN ttt_vacation.office o ON e.office_id = o.id '
                'WHERE o.advance_vacation = false AND e.enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the accountant\n'
                '2. Navigate to Day correction page\n'
                '3. Search for AV=false employee\n'
                '4. Attempt negative correction (e.g., -3 days)\n'
                '5. Submit the correction\n'
                '6. Verify error: InvalidVacationDaysCorrectionException (HTTP 400)\n'
                '7. Verify balance unchanged'
            ),
            'expected': 'Negative correction blocked for AV=false offices. Error displayed.',
            'req_ref': '', 'module': 'Vacation / Day Correction',
            'notes': 'Design: AV=false cannot go negative → negative corrections rejected.',
        },
        {
            'id': 'TC-VAC-067', 'title': 'Verify day correction page table and sorting',
            'priority': 'Low', 'type': 'UI',
            'preconditions': 'Accountant with access to day correction page.',
            'steps': (
                '1. Login as the accountant\n'
                '2. Navigate to Day correction page\n'
                '3. Verify table columns and layout\n'
                '4. Test sorting on each sortable column\n'
                '5. Verify search by employee name works'
            ),
            'expected': 'Day correction page displays correctly with proper columns, sorting, and search.',
            'req_ref': 'Qase suite 227', 'module': 'Vacation / Day Correction',
            'notes': '',
        },
        {
            'id': 'TC-VAC-068', 'title': 'Correction reflects in employee balance immediately',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Accountant and a target employee.',
            'steps': (
                '1. Login as the employee, note available days (X)\n'
                '2. Logout and login as accountant\n'
                '3. Add +5 day correction for the employee\n'
                '4. Logout and login as employee\n'
                '5. Verify available days = X + 5\n'
                '6. Click info icon and verify the corrected year shows increase'
            ),
            'expected': 'Correction immediately reflected in employee\'s available days display.',
            'req_ref': '', 'module': 'Vacation / Day Correction',
            'notes': '',
        },
    ]


def _cases_chart():
    return [
        {
            'id': 'TC-VAC-069', 'title': 'Verify availability chart — Days view',
            'priority': 'High', 'type': 'UI',
            'preconditions': 'Any logged-in employee.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to Calendar of absences → Availability chart\n'
                '3. Verify page title: "Availability chart"\n'
                '4. Verify "Days" toggle is active by default\n'
                '5. Verify left column shows employee names\n'
                '6. Verify right area shows day columns with date and day-of-week\n'
                '7. Verify weekend columns (Sa, Su) have yellow background\n'
                '8. Verify today column has distinct highlighting\n'
                '9. Verify colored bars indicate vacation/absence periods'
            ),
            'expected': 'Days view shows day-by-day timeline with employee rows and colored absence bars.',
            'req_ref': 'Qase suites 39, 43', 'module': 'Vacation / Chart',
            'notes': 'Green bars = approved vacations. Blue = day-off/holidays.',
        },
        {
            'id': 'TC-VAC-070', 'title': 'Verify availability chart — Months view',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Any logged-in employee.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to Availability chart\n'
                '3. Click "Months" toggle button\n'
                '4. Verify view switches to monthly summary\n'
                '5. Verify month headers displayed\n'
                '6. Verify vacation periods shown as colored blocks spanning months'
            ),
            'expected': 'Months view shows monthly aggregated availability.',
            'req_ref': '', 'module': 'Vacation / Chart',
            'notes': '',
        },
        {
            'id': 'TC-VAC-071', 'title': 'Verify chart search by employee',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Any logged-in user.',
            'steps': (
                '1. Navigate to Availability chart\n'
                '2. Type an employee\'s name in the search box\n'
                '3. Verify chart filters to show only that employee\n'
                '4. Clear search\n'
                '5. Verify all employees are shown again'
            ),
            'expected': 'Search filters chart to matching employees.',
            'req_ref': '', 'module': 'Vacation / Chart',
            'notes': 'Search supports: employee name, project, manager, salary office.',
        },
        {
            'id': 'TC-VAC-072', 'title': 'Verify chart timeline navigation',
            'priority': 'Medium', 'type': 'UI',
            'preconditions': 'Any logged-in user.',
            'steps': (
                '1. Navigate to Availability chart\n'
                '2. Click right arrow to scroll timeline forward\n'
                '3. Verify the date columns advance\n'
                '4. Click left arrow to scroll backward\n'
                '5. Verify dates go back to earlier period\n'
                '6. Verify month labels update accordingly'
            ),
            'expected': 'Timeline navigation scrolls the chart left/right through dates.',
            'req_ref': '', 'module': 'Vacation / Chart',
            'notes': '',
        },
        {
            'id': 'TC-VAC-073', 'title': 'Verify vacation bars on chart match vacation records',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Employee with a known APPROVED vacation in current/next month.',
            'steps': (
                '1. Login as any user\n'
                '2. Navigate to Availability chart\n'
                '3. Search for the employee with the APPROVED vacation\n'
                '4. Navigate timeline to the vacation dates\n'
                '5. Verify a green bar spans the exact vacation date range\n'
                '6. Verify bar starts and ends on correct days\n'
                '7. Verify weekends within the range are marked differently'
            ),
            'expected': 'Green vacation bar correctly spans the vacation start-to-end dates on the chart.',
            'req_ref': '', 'module': 'Vacation / Chart',
            'notes': 'Only APPROVED and PAID vacations shown on chart (not NEW or REJECTED).',
        },
    ]


def _cases_permissions():
    return [
        {
            'id': 'TC-VAC-074', 'title': 'Employee can view own vacations only',
            'priority': 'High', 'type': 'Security',
            'preconditions': (
                'Regular employee (ROLE_EMPLOYEE only, no manager roles).\n'
                'Query: SELECT e.login FROM ttt_vacation.employee e '
                'JOIN ttt_backend.employee_role er ON e.cs_id = er.employee_id '
                'WHERE er.role = \'ROLE_EMPLOYEE\' AND e.enabled = true '
                'AND NOT EXISTS (SELECT 1 FROM ttt_backend.employee_role er2 WHERE er2.employee_id = e.cs_id '
                'AND er2.role IN (\'ROLE_PROJECT_MANAGER\',\'ROLE_DEPARTMENT_MANAGER\',\'ROLE_ADMIN\')) LIMIT 1'
            ),
            'steps': (
                '1. Login as a regular employee\n'
                '2. Verify "My vacations and days off" page accessible\n'
                '3. Verify the table shows ONLY own vacations\n'
                '4. Navigate to Calendar of absences menu\n'
                '5. Verify "Employees requests" menu item is NOT visible\n'
                '6. Attempt direct navigation to /vacation/request\n'
                '7. Verify access denied or redirect'
            ),
            'expected': 'Regular employee sees only own vacations. No access to Employee Requests page.',
            'req_ref': '', 'module': 'Vacation / Permissions',
            'notes': 'VACATIONS:VIEW_APPROVES required for /vacation/request. Only PM, DM, TL, ADMIN, VALL have it.',
        },
        {
            'id': 'TC-VAC-075', 'title': 'Manager can view and act on Employee Requests',
            'priority': 'High', 'type': 'Security',
            'preconditions': 'User with ROLE_PROJECT_MANAGER.',
            'steps': (
                '1. Login as the project manager\n'
                '2. Navigate to Calendar of absences → Employees requests\n'
                '3. Verify page loads with pending requests\n'
                '4. Verify approve/reject/redirect buttons visible for subordinate requests\n'
                '5. Verify requests from non-subordinates are NOT shown in Approval tab'
            ),
            'expected': 'Manager sees only requests they are approver for. Actions available for those requests.',
            'req_ref': '', 'module': 'Vacation / Permissions',
            'notes': '',
        },
        {
            'id': 'TC-VAC-076', 'title': 'Accountant can access Payment page',
            'priority': 'High', 'type': 'Security',
            'preconditions': (
                'User with ROLE_ACCOUNTANT.\n'
                'Query: SELECT e.login FROM ttt_vacation.employee e '
                'JOIN ttt_backend.employee_role er ON e.cs_id = er.employee_id '
                'WHERE er.role = \'ROLE_ACCOUNTANT\' AND e.enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the accountant\n'
                '2. Verify "Accounting" menu visible in navigation\n'
                '3. Navigate to Accounting → Vacation payment\n'
                '4. Verify payment table loads\n'
                '5. Verify pay action buttons visible for APPROVED vacations'
            ),
            'expected': 'Accountant has full access to vacation payment page and actions.',
            'req_ref': '', 'module': 'Vacation / Permissions',
            'notes': 'VACATIONS:VIEW_PAYMENTS required. ACC, CACC, ADMIN, VALL have it.',
        },
        {
            'id': 'TC-VAC-077', 'title': 'Regular employee cannot access Payment page',
            'priority': 'High', 'type': 'Security',
            'preconditions': 'Regular employee without accountant role.',
            'steps': (
                '1. Login as regular employee\n'
                '2. Verify "Accounting" menu is NOT visible in navigation\n'
                '3. Attempt direct navigation to /vacation/payment\n'
                '4. Verify access denied or redirect'
            ),
            'expected': 'Payment page inaccessible to non-accountant users.',
            'req_ref': '', 'module': 'Vacation / Permissions',
            'notes': '',
        },
        {
            'id': 'TC-VAC-078', 'title': 'ReadOnly user cannot create vacation',
            'priority': 'High', 'type': 'Security',
            'preconditions': (
                'Employee with readOnly = true.\n'
                'Query: SELECT login FROM ttt_vacation.employee WHERE read_only = true AND enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the readOnly employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Verify "Create a request" button is disabled or hidden\n'
                '4. If button visible, click it and verify creation is blocked\n'
                '5. Verify no edit/cancel/delete actions on existing vacations'
            ),
            'expected': 'ReadOnly users cannot create, edit, cancel, or delete vacations.',
            'req_ref': '', 'module': 'Vacation / Permissions',
            'notes': 'VacationPermissionService: readOnly → returns empty permissions set.',
        },
        {
            'id': 'TC-VAC-079', 'title': 'Non-approver cannot approve/reject vacation',
            'priority': 'Critical', 'type': 'Security',
            'preconditions': (
                'Two managers: Manager A is the approver, Manager B is not.\n'
                'A NEW vacation request assigned to Manager A.'
            ),
            'steps': (
                '1. Login as Manager B (who is NOT the approver)\n'
                '2. Navigate to Employees requests\n'
                '3. Verify the vacation request does NOT appear in Manager B\'s Approval list\n'
                '4. (If visible in another tab) Verify no approve/reject buttons for this vacation'
            ),
            'expected': 'Only the assigned approver can approve/reject. Other managers cannot act on it.',
            'req_ref': '', 'module': 'Vacation / Permissions',
            'notes': 'hasAccess() checks approverId matches currentEmployee.id for manager roles.',
        },
        {
            'id': 'TC-VAC-080', 'title': 'Verify permissions for NEW vacation (owner)',
            'priority': 'Medium', 'type': 'Security',
            'preconditions': 'Employee with a NEW vacation.',
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations\n'
                '3. Verify action buttons on the NEW vacation row:\n'
                '   - Edit (pencil icon) — available\n'
                '   - Cancel — available\n'
                '   - Delete — available\n'
                '4. Verify no approve/pay buttons visible (owner cannot self-approve unless CPO)'
            ),
            'expected': 'Owner of NEW vacation: EDIT, CANCEL, DELETE available. No APPROVE/PAY.',
            'req_ref': '', 'module': 'Vacation / Permissions',
            'notes': 'VacationPermissionService: owner gets EDIT, DELETE, CANCEL for non-PAID status.',
        },
        {
            'id': 'TC-VAC-081', 'title': 'Verify permissions for APPROVED vacation (owner)',
            'priority': 'Medium', 'type': 'Security',
            'preconditions': 'Employee with an APPROVED vacation.',
            'steps': (
                '1. Login as the vacation owner\n'
                '2. Navigate to My vacations\n'
                '3. Verify action buttons on the APPROVED vacation row:\n'
                '   - Edit — available (will reset to NEW)\n'
                '   - Cancel — available (if canBeCancelled)\n'
                '   - Delete — available (if canBeCancelled)\n'
                '4. Verify no approve/pay buttons visible'
            ),
            'expected': 'Owner of APPROVED: EDIT, CANCEL (conditional), DELETE (conditional) available.',
            'req_ref': '', 'module': 'Vacation / Permissions',
            'notes': 'canBeCancelled guard: REGULAR + APPROVED + reportPeriod after paymentDate → cancel/delete blocked.',
        },
        {
            'id': 'TC-VAC-082', 'title': 'Admin role — full access across pages',
            'priority': 'Medium', 'type': 'Security',
            'preconditions': (
                'User with ROLE_ADMIN.\n'
                'Query: SELECT e.login FROM ttt_vacation.employee e '
                'JOIN ttt_backend.employee_role er ON e.cs_id = er.employee_id '
                'WHERE er.role = \'ROLE_ADMIN\' AND e.enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as admin\n'
                '2. Verify all menu items visible: My vacations, Employee Requests, '
                'Availability chart, Vacation days, Payment, Day correction\n'
                '3. Navigate to each page and verify access\n'
                '4. Verify admin can see all employees\' data\n'
                '5. Note: admin transition map entry exists but hasAccess() bug may block some operations'
            ),
            'expected': 'Admin has access to all vacation-related pages.',
            'req_ref': '', 'module': 'Vacation / Permissions',
            'notes': 'Known bug: ROLE_ADMIN in transition map but NOT in MANAGER_ROLES → hasAccess() returns false for admin-as-approver.',
        },
    ]


def _cases_validation():
    return [
        {
            'id': 'TC-VAC-083', 'title': 'Start date in the past — error message',
            'priority': 'Critical', 'type': 'Negative',
            'preconditions': 'Any employee with vacation days.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My vacations and days off\n'
                '3. Click "Create a request"\n'
                '4. Set start date to yesterday\n'
                '5. Set end date to tomorrow\n'
                '6. Click "Save"\n'
                '7. Verify error message about start date in the past\n'
                '8. Verify vacation is NOT created'
            ),
            'expected': (
                'Error: validation.vacation.start.date.in.past\n'
                'Note: i18n key may display as raw string (known bug — missing translation).'
            ),
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'Backend: isBefore(today). Today is valid, yesterday is not. Frontend check may also catch this.',
        },
        {
            'id': 'TC-VAC-084', 'title': 'End date before start date — error message',
            'priority': 'Critical', 'type': 'Negative',
            'preconditions': 'Any employee.',
            'steps': (
                '1. Login as the employee\n'
                '2. Click "Create a request"\n'
                '3. Set start date to next Friday\n'
                '4. Set end date to next Monday (before start)\n'
                '5. Click "Save"\n'
                '6. Verify error message about dates order\n'
                '7. Verify vacation is NOT created'
            ),
            'expected': 'Error: validation.vacation.dates.order. May show as raw i18n key.',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'Frontend Formik validation may also block before reaching backend.',
        },
        {
            'id': 'TC-VAC-085', 'title': 'Next year vacation before Feb 1 — error',
            'priority': 'High', 'type': 'Negative',
            'preconditions': (
                'Current date is before February 1 of the current year.\n'
                'SETUP: Set server clock to January 15: PATCH /api/ttt/test/v1/clock'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Click "Create a request"\n'
                '3. Set start date to January of NEXT year\n'
                '4. Set end date to next year as well\n'
                '5. Click "Save"\n'
                '6. Verify error: validation.vacation.next.year.not.available'
            ),
            'expected': 'Cannot create vacation in next year before Feb 1 of current year.',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'VacationCreateValidator: startDate.year > today.year AND today < Feb 1.',
        },
        {
            'id': 'TC-VAC-086', 'title': 'Vacation with 0 working days (Sat-Sun only) — duration error',
            'priority': 'High', 'type': 'Negative',
            'preconditions': 'Any employee.',
            'steps': (
                '1. Login as the employee\n'
                '2. Click "Create a request"\n'
                '3. Set start date to a Saturday\n'
                '4. Set end date to the next Sunday\n'
                '5. Verify "Number of days" shows 0\n'
                '6. Click "Save"\n'
                '7. Verify error about minimum vacation duration'
            ),
            'expected': 'Error: validation.vacation.duration — 0 working days below minimum (1).',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'minimalVacationDuration = 1 (not 5 as Javadoc says). Only 0-day ranges trigger this.',
        },
        {
            'id': 'TC-VAC-087', 'title': 'Overlapping vacation dates — crossing error',
            'priority': 'Critical', 'type': 'Negative',
            'preconditions': (
                'Employee with an existing vacation (any status including DELETED).\n'
                'Know the date range of the existing vacation.'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Click "Create a request"\n'
                '3. Set dates that overlap with an existing vacation\n'
                '4. Click "Save"\n'
                '5. Verify error message about crossing/overlapping vacations\n'
                '6. Verify vacation is NOT created'
            ),
            'expected': (
                'Error: exception.validation.vacation.dates.crossing\n'
                'Note: crossing check includes DELETED records (ghost conflicts).'
            ),
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'Known issue: soft-deleted vacations create permanent ghost conflicts blocking those dates.',
        },
        {
            'id': 'TC-VAC-088', 'title': 'Multiple validation errors displayed simultaneously',
            'priority': 'Medium', 'type': 'Negative',
            'preconditions': 'Any employee.',
            'steps': (
                '1. Login as the employee\n'
                '2. Click "Create a request"\n'
                '3. Set start date to yesterday (past date)\n'
                '4. Set end date to the day before yesterday (end < start AND in past)\n'
                '5. Click "Save"\n'
                '6. Verify BOTH error messages displayed:\n'
                '   - Start date in the past\n'
                '   - End date before start date'
            ),
            'expected': 'Multiple validation errors shown simultaneously (non-short-circuiting).',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'Past-date and dates-order checks run independently. Both errors returned together.',
        },
        {
            'id': 'TC-VAC-089', 'title': 'Null payment month — server error (known bug)',
            'priority': 'Medium', 'type': 'Negative',
            'preconditions': 'Any employee. Test requires bypassing frontend validation.',
            'steps': (
                '1. Login as the employee\n'
                '2. Click "Create a request"\n'
                '3. Fill valid dates\n'
                '4. Clear the payment month field (if possible via UI)\n'
                '5. Click "Save"\n'
                '6. If frontend prevents empty payment month, test via API:\n'
                '   POST /api/vacation/v1/vacations with paymentMonth: null\n'
                '7. Verify HTTP 500 (NPE)'
            ),
            'expected': 'Known bug: null paymentMonth causes NPE (HTTP 500). No @NotNull on DTO field.',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'Bug: paymentMonth has no @NotNull annotation. REGULAR type → correctPaymentMonth() NPEs.',
        },
        {
            'id': 'TC-VAC-090', 'title': 'Same-day vacation (start = end, weekday)',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Employee with sufficient days.',
            'steps': (
                '1. Login as the employee\n'
                '2. Click "Create a request"\n'
                '3. Set start date = end date = a future weekday\n'
                '4. Verify "Number of days" = 1\n'
                '5. Click "Save"\n'
                '6. Verify vacation created with Regular days = 1'
            ),
            'expected': 'Single-day vacation accepted. 1 working day counted.',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'Minimum working days = 1. Single weekday passes validation.',
        },
        {
            'id': 'TC-VAC-091', 'title': 'Long vacation (30+ calendar days)',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Employee with 20+ available days.',
            'steps': (
                '1. Login as the employee\n'
                '2. Click "Create a request"\n'
                '3. Set start date to a future Monday\n'
                '4. Set end date 30+ calendar days later\n'
                '5. Verify "Number of days" shows working days (approximately 22)\n'
                '6. Click "Save"\n'
                '7. Verify vacation created if sufficient balance'
            ),
            'expected': 'Long vacations accepted if employee has sufficient available days.',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'No maximum duration limit exists. Only minimum (1 working day) enforced.',
        },
        {
            'id': 'TC-VAC-092', 'title': 'Vacation before 3-month employment check',
            'priority': 'Medium', 'type': 'Negative',
            'preconditions': (
                'New employee hired less than 3 months ago.\n'
                'Query: SELECT login, first_date FROM ttt_vacation.employee '
                'WHERE first_date > CURRENT_DATE - INTERVAL \'3 months\' AND enabled = true LIMIT 1'
            ),
            'steps': (
                '1. Login as the new employee\n'
                '2. Click "Create a request"\n'
                '3. Set dates within 3 months of employment start\n'
                '4. Click "Save"\n'
                '5. Verify error: exception.validation.vacation.too.early'
            ),
            'expected': 'Error: vacation days under limitation date exceed limit for recent hires.',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'DaysLimitationService uses employee.first_date for 3-month restriction.',
        },
        {
            'id': 'TC-VAC-093', 'title': 'Special characters in comment field',
            'priority': 'Low', 'type': 'Security',
            'preconditions': 'Any employee.',
            'steps': (
                '1. Login as the employee\n'
                '2. Click "Create a request"\n'
                '3. Fill valid dates\n'
                '4. In Comment field, enter: <script>alert("XSS")</script> & "quotes" \'single\'\n'
                '5. Click "Save"\n'
                '6. Verify vacation created (or safely rejected)\n'
                '7. View the vacation details\n'
                '8. Verify no script execution — text displayed as-is or sanitized'
            ),
            'expected': 'Special characters handled safely. No XSS execution. Text escaped or sanitized.',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': '',
        },
        {
            'id': 'TC-VAC-094', 'title': 'Insufficient days for REGULAR vacation (AV=false)',
            'priority': 'High', 'type': 'Negative',
            'preconditions': (
                'AV=false employee with 0 or very few available days.\n'
                'Query: SELECT e.login FROM ttt_vacation.employee e '
                'JOIN ttt_vacation.office o ON e.office_id = o.id '
                'JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee '
                'WHERE o.advance_vacation = false AND e.enabled = true '
                'AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE) '
                'GROUP BY e.login HAVING SUM(ev.available_vacation_days) < 3 LIMIT 1'
            ),
            'steps': (
                '1. Login as the AV=false employee\n'
                '2. Click "Create a request"\n'
                '3. Set dates for 5 working days (exceeding available balance)\n'
                '4. Click "Save"\n'
                '5. Verify error about insufficient vacation days'
            ),
            'expected': 'Error: validation.vacation.duration — availablePaidDays < total.',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'AV=false cannot go negative. AV=true CAN create vacation exceeding balance.',
        },
        {
            'id': 'TC-VAC-095', 'title': 'Verify i18n missing keys displayed as raw strings (known bug)',
            'priority': 'Low', 'type': 'UI',
            'preconditions': 'Any employee. English language selected.',
            'steps': (
                '1. Login as the employee\n'
                '2. Ensure language is set to English (EN)\n'
                '3. Trigger a validation error (e.g., past date)\n'
                '4. Verify error message displays as raw i18n key:\n'
                '   "validation.vacation.start.date.in.past" instead of human-readable text'
            ),
            'expected': 'Known bug: 3 validation keys have no i18n translations — displayed as raw key strings.',
            'req_ref': '', 'module': 'Vacation / Validation',
            'notes': 'Missing translations: validation.vacation.start.date.in.past, validation.vacation.dates.order, validation.vacation.next.year.not.available.',
        },
    ]


def _cases_notifications():
    return [
        {
            'id': 'TC-VAC-096', 'title': 'Email notification on vacation create (to approver)',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Employee with a manager. Email service configured.\n'
                'SETUP: Clear email queue: POST /api/email/test/v1/del-emails'
            ),
            'steps': (
                '1. SETUP: Clear email queue via test API\n'
                '2. Login as the employee\n'
                '3. Create a new vacation request\n'
                '4. SETUP: Trigger email sending: POST /api/email/test/v1/send-emails\n'
                '5. Verify email sent to the approver (manager)\n'
                '6. Check email content includes: employee name, vacation dates, type\n'
                'API-CHECK: GET /api/email/v1/emails?to=<manager_email>'
            ),
            'expected': 'Email notification sent to approver when vacation created.',
            'req_ref': 'Qase suites 245, 248', 'module': 'Vacation / Notifications',
            'notes': 'VacationCreatedEvent triggers notification. Use email test API to verify.',
        },
        {
            'id': 'TC-VAC-097', 'title': 'Email notification on vacation approve (to employee)',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Manager with a pending NEW vacation to approve. Email queue cleared.',
            'steps': (
                '1. SETUP: Clear email queue\n'
                '2. Login as the manager and approve the vacation\n'
                '3. SETUP: Trigger email sending\n'
                '4. Verify email sent to the employee\n'
                '5. Check email content: vacation dates, new status "Approved"\n'
                'API-CHECK: GET /api/email/v1/emails?to=<employee_email>'
            ),
            'expected': 'Employee receives email notification when vacation is approved.',
            'req_ref': 'Qase suite 99', 'module': 'Vacation / Notifications',
            'notes': 'VacationStatusChangedEvent triggers notification on approve.',
        },
        {
            'id': 'TC-VAC-098', 'title': 'Email notification on vacation reject (to employee)',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Manager with a pending NEW vacation. Email queue cleared.',
            'steps': (
                '1. SETUP: Clear email queue\n'
                '2. Login as the manager and reject the vacation\n'
                '3. SETUP: Trigger email sending\n'
                '4. Verify email sent to the employee with rejection notice\n'
                'API-CHECK: GET /api/email/v1/emails?to=<employee_email>'
            ),
            'expected': 'Employee receives email notification when vacation is rejected.',
            'req_ref': 'Qase suites 100, 106', 'module': 'Vacation / Notifications',
            'notes': '',
        },
        {
            'id': 'TC-VAC-099', 'title': 'Email notification on vacation cancel (to approver)',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Employee cancels a NEW or APPROVED vacation. Email queue cleared.',
            'steps': (
                '1. SETUP: Clear email queue\n'
                '2. Login as the employee\n'
                '3. Cancel a vacation\n'
                '4. SETUP: Trigger email sending\n'
                '5. Verify email sent to the approver about cancellation\n'
                'API-CHECK: GET /api/email/v1/emails?to=<manager_email>'
            ),
            'expected': 'Approver notified when employee cancels a vacation.',
            'req_ref': 'Qase suite 80', 'module': 'Vacation / Notifications',
            'notes': '',
        },
        {
            'id': 'TC-VAC-100', 'title': 'Pre-vacation reminder notification',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': (
                'APPROVED vacation starting in ~3 days.\n'
                'SETUP: Set clock to 3 days before an approved vacation via test API.'
            ),
            'steps': (
                '1. SETUP: Advance clock to 3 days before the vacation start\n'
                '2. SETUP: Trigger notification job: POST /api/vacation/v1/test/vacations/notify-about-vacation\n'
                '3. Verify pre-vacation email sent to the employee\n'
                '4. Check email content: upcoming vacation dates, reminder'
            ),
            'expected': 'Pre-vacation reminder email sent N days before vacation start.',
            'req_ref': 'Qase suite 52', 'module': 'Vacation / Notifications',
            'notes': 'Cron job checks upcoming vacations and sends reminders.',
        },
        {
            'id': 'TC-VAC-101', 'title': '"Also notify" recipients get email notification',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Vacation created with "Also notify" colleagues.',
            'steps': (
                '1. SETUP: Clear email queue\n'
                '2. Login as the employee\n'
                '3. Create vacation with 1-2 colleagues in "Also notify"\n'
                '4. SETUP: Trigger email sending\n'
                '5. Verify emails sent to each notified colleague\n'
                'API-CHECK: GET /api/email/v1/emails?to=<colleague_email>'
            ),
            'expected': 'Each "Also notify" colleague receives email about the vacation.',
            'req_ref': '', 'module': 'Vacation / Notifications',
            'notes': 'Notification sent on create. vacation_notify_also table stores recipients.',
        },
        {
            'id': 'TC-VAC-102', 'title': 'In-app notification badge update',
            'priority': 'Low', 'type': 'UI',
            'preconditions': 'Manager with a new pending vacation request.',
            'steps': (
                '1. Login as the manager\n'
                '2. Observe the navigation bar\n'
                '3. Verify "Calendar of absences" badge shows count (e.g., "(28)")\n'
                '4. Verify "Employees requests" sub-item shows the same or related count\n'
                '5. Approve one vacation\n'
                '6. Verify badge count decreases'
            ),
            'expected': 'Badge count reflects pending requests. Decreases after action.',
            'req_ref': '', 'module': 'Vacation / Notifications',
            'notes': '',
        },
    ]


def _cases_integration():
    return [
        {
            'id': 'TC-VAC-103', 'title': 'Sick leave created during vacation — conflict detection',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Employee with an APPROVED vacation.\n'
                'Sick leave capability available.'
            ),
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My sick leaves\n'
                '3. Click "Add a sick note"\n'
                '4. Set dates overlapping with the existing vacation\n'
                '5. Submit the sick leave\n'
                '6. Verify system handles the overlap (409 CONFLICT or auto-adjustment)\n'
                '7. Check vacation status/dates for any modifications'
            ),
            'expected': 'Sick leave overlapping vacation triggers SickLeaveCrossingVacationException (409).',
            'req_ref': '', 'module': 'Vacation / Integration',
            'notes': 'SickLeaveCrossingVacationException → HTTP 409 CONFLICT. Sick leave endpoint blocked with API_SECRET_TOKEN (403).',
        },
        {
            'id': 'TC-VAC-104', 'title': 'Vacation display in availability chart for team view',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Employee with APPROVED vacation. Manager who can see chart.',
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Availability chart\n'
                '3. Search for the team/project\n'
                '4. Verify APPROVED vacation shows as green bar for the employee\n'
                '5. Verify NEW/REJECTED vacations do NOT appear on chart'
            ),
            'expected': 'Only APPROVED and PAID vacations visible on availability chart. NEW/REJECTED excluded.',
            'req_ref': '', 'module': 'Vacation / Integration',
            'notes': '',
        },
        {
            'id': 'TC-VAC-105', 'title': 'Vacation impact on time report norm calculation',
            'priority': 'High', 'type': 'Functional',
            'preconditions': 'Employee with an APPROVED vacation in current report period.',
            'steps': (
                '1. Login as the employee\n'
                '2. Navigate to My tasks (report page)\n'
                '3. Verify the reporting period norm accounts for vacation days\n'
                '4. Verify the expected work hours are reduced by vacation days\n'
                '5. Check that vacation days appear in the report period summary'
            ),
            'expected': 'Vacation days reduce the expected work hours norm in the report period.',
            'req_ref': 'Qase suites 19, 35', 'module': 'Vacation / Integration',
            'notes': 'Vacation days are subtracted from monthly norm calculation.',
        },
        {
            'id': 'TC-VAC-106', 'title': 'Vacation display in confirmation period',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'Employee with vacation in a confirmation period. Manager with confirmation access.',
            'steps': (
                '1. Login as the manager\n'
                '2. Navigate to Confirmation page\n'
                '3. Find the period containing the employee\'s vacation\n'
                '4. Verify vacation days are shown in the confirmation view\n'
                '5. Verify vacation reduces the expected hours'
            ),
            'expected': 'Confirmation page reflects vacation days in the period.',
            'req_ref': 'Qase suites 138, 152', 'module': 'Vacation / Integration',
            'notes': '',
        },
        {
            'id': 'TC-VAC-107', 'title': 'Maternity leave impact — rejects NEW vacations',
            'priority': 'High', 'type': 'Functional',
            'preconditions': (
                'Employee going on maternity leave.\n'
                'SETUP: Trigger maternity begin event for the employee.'
            ),
            'steps': (
                '1. SETUP: Ensure employee has a NEW vacation\n'
                '2. SETUP: Trigger maternity leave begin event\n'
                '3. Login as the employee\n'
                '4. Navigate to My vacations\n'
                '5. Verify the NEW vacation status changed to REJECTED\n'
                '6. Verify current year vacation days reduced proportionally\n'
                '7. Verify next-year days zeroed'
            ),
            'expected': (
                'Maternity begin: all NEW vacations auto-rejected.\n'
                'Current year days reduced proportionally. Next year days = 0.\n'
                'Already-APPROVED vacations NOT rejected.'
            ),
            'req_ref': 'Qase suites 50, 53', 'module': 'Vacation / Integration',
            'notes': 'MaternityLeaveBeginEvent handler. Proportional day reduction based on remaining months.',
        },
        {
            'id': 'TC-VAC-108', 'title': 'Employee sync updates vacation data',
            'priority': 'Medium', 'type': 'Functional',
            'preconditions': 'SETUP: Employee data changed in Company Staff system.',
            'steps': (
                '1. SETUP: Trigger employee sync: POST /api/vacation/v1/test/vacations/sync\n'
                '2. Verify employee office, manager, and role updates reflected\n'
                '3. Check if vacation day norms updated for office changes\n'
                '4. Login as the employee\n'
                '5. Verify updated manager in vacation approver field'
            ),
            'expected': 'Employee sync updates office, manager, roles. Vacation norms recalculated if office changed.',
            'req_ref': '', 'module': 'Vacation / Integration',
            'notes': 'CS sync runs on cron. Can be triggered via test API.',
        },
        {
            'id': 'TC-VAC-109', 'title': 'Vacation display in planner',
            'priority': 'Low', 'type': 'Functional',
            'preconditions': 'Employee with APPROVED vacation. User with planner access.',
            'steps': (
                '1. Login as a manager with planner access\n'
                '2. Navigate to Planner page\n'
                '3. Find the employee in the planner grid\n'
                '4. Verify vacation period is indicated in the planner\n'
                '5. Verify vacation dates are visually distinct from working days'
            ),
            'expected': 'Planner shows vacation periods for team members.',
            'req_ref': 'Qase suites 163, 177', 'module': 'Vacation / Integration',
            'notes': '',
        },
    ]


# ──────────────────────────────────────────────
# All Cases Registry
# ──────────────────────────────────────────────
ALL_CASES = {
    'TS-Vac-CRUD': _cases_crud,
    'TS-Vac-Lifecycle': _cases_lifecycle,
    'TS-Vac-Approval': _cases_approval,
    'TS-Vac-Payment': _cases_payment,
    'TS-Vac-DayCalc': _cases_daycalc,
    'TS-Vac-DayCorrection': _cases_daycorrection,
    'TS-Vac-Chart': _cases_chart,
    'TS-Vac-Permissions': _cases_permissions,
    'TS-Vac-Validation': _cases_validation,
    'TS-Vac-Notifications': _cases_notifications,
    'TS-Vac-Integration': _cases_integration,
}


# ──────────────────────────────────────────────
# Workbook Generation Functions
# ──────────────────────────────────────────────

def _style_header_row(ws, row, col_count):
    for c in range(1, col_count + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = CENTER_ALIGN
        cell.border = THIN_BORDER


def _style_body_row(ws, row, col_count, is_alt=False):
    for c in range(1, col_count + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = BODY_FONT
        cell.alignment = WRAP_ALIGN
        cell.border = THIN_BORDER
        if is_alt:
            cell.fill = ALT_FILL


def create_plan_overview(wb, suite_data):
    ws = wb.active
    ws.title = 'Plan Overview'
    ws.sheet_properties.tabColor = GREEN_TAB

    # Title
    ws.merge_cells('A1:J1')
    ws['A1'] = 'Vacation Module — Test Plan'
    ws['A1'].font = TITLE_FONT
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 30

    sections = [
        ('Scope', (
            'Comprehensive testing of the Vacation module including: vacation request CRUD operations, '
            'approval/rejection/redirect workflows, payment processing, day calculations (AV=true and AV=false), '
            'day corrections, availability chart, role-based permissions, input validation, '
            'email notifications, and cross-module integration.'
        )),
        ('Objectives', (
            '• Verify all vacation lifecycle state transitions (NEW→APPROVED→PAID, cancel, reject, restore)\n'
            '• Validate business rules: FIFO day consumption, AV-specific calculations, canBeCancelled guard\n'
            '• Test role-based access: employee, manager, accountant, DM, admin\n'
            '• Verify UI behavior matches backend logic: form validation, error messages, permission-based actions\n'
            '• Cover known bugs: NPE on null paymentMonth, ghost conflicts from DELETED records, i18n missing keys'
        )),
        ('Approach', (
            '• UI-first: all test steps describe browser actions (login, navigate, click, verify)\n'
            '• API steps only for: test endpoints (clock, sync, notifications), DB verification, features without UI\n'
            '• Dynamic test data: preconditions include SQL queries for automated data selection\n'
            '• Environment: timemachine (primary), qa-1 (secondary)'
        )),
        ('Environment', (
            '• Application: TTT (Time Tracking Tool) — https://ttt-timemachine.noveogroup.com\n'
            '• Browser: Chrome (latest)\n'
            '• Test data: dynamic selection via SQL queries in preconditions\n'
            '• Test clock: manipulable via PATCH /api/ttt/test/v1/clock\n'
            '• Email verification: via email test API endpoints'
        )),
    ]

    row = 3
    for title, content in sections:
        ws.merge_cells(f'A{row}:B{row}')
        ws[f'A{row}'] = title
        ws[f'A{row}'].font = SUBTITLE_FONT
        row += 1
        ws.merge_cells(f'A{row}:J{row}')
        ws[f'A{row}'] = content
        ws[f'A{row}'].font = BODY_FONT
        ws[f'A{row}'].alignment = WRAP_ALIGN
        ws.row_dimensions[row].height = max(60, content.count('\n') * 16 + 20)
        row += 2

    # Suite links
    ws.merge_cells(f'A{row}:B{row}')
    ws[f'A{row}'] = 'Test Suites'
    ws[f'A{row}'].font = SUBTITLE_FONT
    row += 1

    for suite_id, suite_name in SUITES:
        cases = suite_data.get(suite_id, [])
        link_text = f'{suite_id}: {suite_name} — {len(cases)} cases'
        ws[f'A{row}'] = link_text
        ws[f'A{row}'].font = LINK_FONT
        ws[f'A{row}'].hyperlink = f"#'{suite_id}'!A1"
        ws.merge_cells(f'A{row}:J{row}')
        row += 1

    row += 1
    ws[f'A{row}'] = f'Total: {sum(len(v) for v in suite_data.values())} test cases across {len(SUITES)} suites'
    ws[f'A{row}'].font = BOLD_FONT

    ws.column_dimensions['A'].width = 80
    for col in range(2, 11):
        ws.column_dimensions[get_column_letter(col)].width = 12


def create_feature_matrix(wb, suite_data):
    ws = wb.create_sheet('Feature Matrix')
    ws.sheet_properties.tabColor = GREEN_TAB

    ws.merge_cells('A1:E1')
    ws['A1'] = 'Feature × Test Type Coverage Matrix'
    ws['A1'].font = TITLE_FONT
    ws.row_dimensions[1].height = 25

    headers = ['Feature Area', 'Functional', 'Negative', 'UI', 'Security']
    for c, h in enumerate(headers, 1):
        ws.cell(row=3, column=c, value=h)
    _style_header_row(ws, 3, len(headers))

    row = 4
    for suite_id, suite_name in SUITES:
        cases = suite_data.get(suite_id, [])
        type_counts = {}
        for case in cases:
            t = case.get('type', 'Functional')
            type_counts[t] = type_counts.get(t, 0) + 1

        ws.cell(row=row, column=1, value=f'{suite_name} ({len(cases)} cases)')
        ws.cell(row=row, column=1).font = LINK_FONT
        ws.cell(row=row, column=1).hyperlink = f"#'{suite_id}'!A1"
        ws.cell(row=row, column=2, value=type_counts.get('Functional', 0))
        ws.cell(row=row, column=3, value=type_counts.get('Negative', 0))
        ws.cell(row=row, column=4, value=type_counts.get('UI', 0))
        ws.cell(row=row, column=5, value=type_counts.get('Security', 0))
        _style_body_row(ws, row, len(headers), is_alt=(row % 2 == 0))
        row += 1

    # Total row
    total = sum(len(v) for v in suite_data.values())
    ws.cell(row=row, column=1, value=f'TOTAL: {total} cases')
    ws.cell(row=row, column=1).font = BOLD_FONT
    for c in range(2, 6):
        col_sum = sum(
            1 for cases in suite_data.values() for case in cases
            if case.get('type', 'Functional') == headers[c - 1]
        )
        ws.cell(row=row, column=c, value=col_sum)
        ws.cell(row=row, column=c).font = BOLD_FONT

    ws.column_dimensions['A'].width = 45
    for c in range(2, 6):
        ws.column_dimensions[get_column_letter(c)].width = 14


def create_risk_assessment(wb):
    ws = wb.create_sheet('Risk Assessment')
    ws.sheet_properties.tabColor = GREEN_TAB

    ws.merge_cells('A1:G1')
    ws['A1'] = 'Risk Assessment'
    ws['A1'].font = TITLE_FONT

    headers = ['Feature', 'Risk', 'Likelihood', 'Impact', 'Severity', 'Mitigation / Test Focus']
    for c, h in enumerate(headers, 1):
        ws.cell(row=3, column=c, value=h)
    _style_header_row(ws, 3, len(headers))

    risks = [
        ('State Transitions', 'Invalid transition allows forbidden status change', 'Medium', 'Critical',
         'High', 'Full state machine coverage in TS-Vac-Lifecycle + TS-Vac-Approval'),
        ('Day Calculation (AV)', 'AV=true/false logic error causes wrong balance', 'High', 'Critical',
         'Critical', 'Dedicated AV=true and AV=false tests in TS-Vac-DayCalc'),
        ('FIFO Distribution', 'Days consumed from wrong year bucket', 'Medium', 'High',
         'High', 'Cross-year tests + yearly breakdown verification'),
        ('Payment Flow', 'Vacation paid with wrong day split', 'Low', 'Critical',
         'High', 'DB verification of vacation_payment record in TS-Vac-Payment'),
        ('Permission Model', 'Non-approver can approve/reject vacation', 'Low', 'Critical',
         'High', 'Role-based tests in TS-Vac-Permissions'),
        ('Ghost Conflicts', 'DELETED vacations block future creates at same dates', 'High', 'Medium',
         'Medium', 'Crossing validation tests noting DELETED inclusion'),
        ('NPE on null paymentMonth', 'Server crash on missing field', 'Medium', 'High',
         'High', 'Negative test TC-VAC-089 (known bug)'),
        ('canBeCancelled Guard', 'Vacation cancelable after accounting period close', 'Low', 'Critical',
         'High', 'TC-VAC-027 tests the guard condition'),
        ('Email Notifications', 'Approver not notified of new request', 'Medium', 'Medium',
         'Medium', 'Notification tests in TS-Vac-Notifications'),
        ('Cross-module', 'Sick leave + vacation conflict undetected', 'Low', 'High',
         'Medium', 'TC-VAC-103 tests 409 CONFLICT'),
        ('i18n Missing Keys', 'Raw error codes shown to users', 'High', 'Low',
         'Low', 'TC-VAC-095 documents known missing translations'),
        ('Admin hasAccess Bug', 'Admin blocked from approver actions', 'Medium', 'Medium',
         'Medium', 'TC-VAC-082 notes the MANAGER_ROLES bug'),
    ]

    for i, (feat, risk, like, impact, sev, mitigation) in enumerate(risks, start=4):
        ws.cell(row=i, column=1, value=feat)
        ws.cell(row=i, column=2, value=risk)
        ws.cell(row=i, column=3, value=like)
        ws.cell(row=i, column=4, value=impact)
        ws.cell(row=i, column=5, value=sev)
        ws.cell(row=i, column=6, value=mitigation)
        _style_body_row(ws, i, len(headers), is_alt=(i % 2 == 0))

    ws.column_dimensions['A'].width = 25
    ws.column_dimensions['B'].width = 45
    ws.column_dimensions['C'].width = 12
    ws.column_dimensions['D'].width = 12
    ws.column_dimensions['E'].width = 12
    ws.column_dimensions['F'].width = 50


def create_test_suite_tab(wb, suite_id, suite_name, cases):
    ws = wb.create_sheet(suite_id)
    ws.sheet_properties.tabColor = BLUE_TAB

    # Back link
    ws['A1'] = '← Back to Plan'
    ws['A1'].font = LINK_FONT
    ws['A1'].hyperlink = "#'Plan Overview'!A1"

    ws.merge_cells('B1:J1')
    ws['B1'] = f'{suite_id}: {suite_name} — {len(cases)} cases'
    ws['B1'].font = SUBTITLE_FONT

    # Headers
    for c, h in enumerate(TC_COLUMNS, 1):
        ws.cell(row=3, column=c, value=h)
    _style_header_row(ws, 3, len(TC_COLUMNS))

    # Data rows
    for i, case in enumerate(cases):
        row = 4 + i
        ws.cell(row=row, column=1, value=case['id'])
        ws.cell(row=row, column=2, value=case['title'])
        ws.cell(row=row, column=3, value=case.get('preconditions', ''))
        ws.cell(row=row, column=4, value=case.get('steps', ''))
        ws.cell(row=row, column=5, value=case.get('expected', ''))
        ws.cell(row=row, column=6, value=case.get('priority', 'Medium'))
        ws.cell(row=row, column=7, value=case.get('type', 'Functional'))
        ws.cell(row=row, column=8, value=case.get('req_ref', ''))
        ws.cell(row=row, column=9, value=case.get('module', ''))
        ws.cell(row=row, column=10, value=case.get('notes', ''))
        _style_body_row(ws, row, len(TC_COLUMNS), is_alt=(i % 2 == 1))

    # Column widths
    for c, w in enumerate(TC_WIDTHS, 1):
        ws.column_dimensions[get_column_letter(c)].width = w

    # Auto-filter
    ws.auto_filter.ref = f'A3:J{3 + len(cases)}'

    # Row heights for wrapped content
    for row in range(4, 4 + len(cases)):
        ws.row_dimensions[row].height = 80


def generate():
    wb = Workbook()

    # Collect all cases
    suite_data = {}
    for suite_id, _ in SUITES:
        factory = ALL_CASES[suite_id]
        suite_data[suite_id] = factory()

    total = sum(len(v) for v in suite_data.values())
    print(f'Generating {total} test cases across {len(SUITES)} suites...')

    # Create tabs
    create_plan_overview(wb, suite_data)
    create_feature_matrix(wb, suite_data)
    create_risk_assessment(wb)

    for suite_id, suite_name in SUITES:
        cases = suite_data[suite_id]
        create_test_suite_tab(wb, suite_id, suite_name, cases)
        print(f'  {suite_id}: {len(cases)} cases')

    # Save
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    wb.save(OUTPUT_FILE)
    print(f'\nSaved to {OUTPUT_FILE}')
    print(f'Total: {total} test cases, {len(SUITES)} suites, {3 + len(SUITES)} tabs')

    return suite_data


if __name__ == '__main__':
    generate()
