---
type: exploration
tags:
  - vacation
  - notifications
  - email
  - templates
  - catalog
created: '2026-03-26'
updated: '2026-03-26'
status: active
related:
  - '[[modules/vacation-service-deep-dive]]'
  - '[[exploration/tickets/vacation-ticket-findings]]'
---
# Vacation Email Notification Templates — Complete Catalog

Comprehensive catalog of all vacation-related email notification templates from `ttt_email.email_template` table on qa-1. The system uses two naming conventions: modern `NOTIFY_VACATION_*` and legacy direct names.

## Template Categories

### 1. Vacation Create Events (5 templates)
| Code | Subject | Recipient |
|------|---------|-----------|
| `NOTIFY_VACATION_CREATE_TO_EMPLOYEE` | Новая заявка на отпуск | Vacation owner |
| `NOTIFY_VACATION_CREATE_TO_ALSO` | Уведомление об отпуске сотрудника | Notify-also list |
| `NOTIFY_VACATION_CREATE_TO_MANAGER` | Отпуск сотрудника с вашего проекта | Project manager |
| `NOTIFY_VACATION_CREATE_TO_SENIOR_MANAGER` | Новая заявка на отпуск | Department manager / approver |
| `ASK_MANAGER_FOR_VACATION_APPROVAL` | Отпуск сотрудника с вашего проекта | Manager (legacy create notification) |

### 2. Status Change Events (4 templates)
| Code | Subject | Recipient |
|------|---------|-----------|
| `NOTIFY_VACATION_STATUS_CHANGE_TO_EMPLOYEE` | Изменение статуса заявки | Owner |
| `NOTIFY_VACATION_STATUS_CHANGE_TO_ALSO` | Изменение статуса заявки | Notify-also |
| `NOTIFY_VACATION_STATUS_CHANGE_TO_MANAGER` | Изменение статуса заявки | PM |
| `NOTIFY_VACATION_STATUS_CHANGE_TO_SENIOR_MANAGER` | Изменение статуса заявки | DM |

### 3. Vacation Change (Edit) Events (5 templates)
| Code | Subject | Recipient |
|------|---------|-----------|
| `NOTIFY_VACATION_CHANGE_TO_EMPLOYEE` | Изменение заявки | Owner |
| `NOTIFY_VACATION_CHANGE_TO_ALSO` | Уведомление об отпуске сотрудника | Notify-also |
| `NOTIFY_VACATION_CHANGE_TO_APPROVER` | Изменение заявки | Approver |
| `NOTIFY_VACATION_CHANGE_TO_MANAGER` | Изменение заявки | PM |
| `NOTIFY_VACATION_CHANGE_TO_SENIOR_MANAGER` | Изменение заявки | DM |

### 4. Delete/Cancel Events (5 templates)
| Code | Subject | Recipient |
|------|---------|-----------|
| `NOTIFY_VACATION_DELETE_CANCEL_TO_EMPLOYEE` | Изменение статуса заявки | Owner |
| `NOTIFY_VACATION_DELETE_CANCEL_TO_ALSO` | Уведомление об отпуске сотрудника | Notify-also |
| `NOTIFY_VACATION_DELETE_CANCEL_TO_APPROVER` | Изменение статуса заявки | Approver |
| `NOTIFY_VACATION_DELETE_CANCEL_TO_MANAGER` | Изменение статуса заявки | PM |
| `NOTIFY_VACATION_DELETE_CANCEL_TO_SENIOR_MANAGER` | Изменение статуса заявки | DM |

### 5. Change Approver Events (3 templates)
| Code | Subject | Recipient |
|------|---------|-----------|
| `NOTIFY_VACATION_CHANGE_APPROVER_TO_EMPLOYEE` | Изменение статуса заявки | Owner |
| `NOTIFY_VACATION_CHANGE_APPROVER_TO_APPROVER` | Новая заявка на отпуск | New approver |
| `NOTIFY_VACATION_CHANGE_APPROVER_TO_SENIOR_MANAGER` | Изменение заявки | DM |

### 6. Recovered (Re-open from Canceled) Events (5 templates)
| Code | Subject | Recipient |
|------|---------|-----------|
| `NOTIFY_VACATION_RECOVERED_TO_EMPLOYEE` | Восстановление заявки | Owner |
| `NOTIFY_VACATION_RECOVERED_TO_ALSO` | Уведомление об отпуске сотрудника | Notify-also |
| `NOTIFY_VACATION_RECOVERED_TO_APPROVER` | Восстановление заявки | Approver |
| `NOTIFY_VACATION_RECOVERED_TO_MANAGER` | Восстановление заявки | PM |
| `NOTIFY_VACATION_RECOVERED_TO_SENIOR_MANAGER` | Восстановление заявки | DM |

### 7. Auto-Delete Events (6 templates)
| Code | Subject | Recipient |
|------|---------|-----------|
| `NOTIFY_VACATION_AUTODELETE_TO_EMPLOYEE` | Изменение статуса заявки | Owner |
| `NOTIFY_VACATION_AUTODELETE_TO_ALSO` | Изменение статуса заявки | Notify-also |
| `NOTIFY_VACATION_AUTODELETE_TO_APPROVER` | Изменение статуса заявки | Approver |
| `NOTIFY_VACATION_AUTODELETE_TO_MANAGER` | Изменение статуса заявки | PM |
| `NOTIFY_VACATION_AUTODELETE_TO_SENIOR_MANAGER` | Изменение статуса заявки | DM |
| `NOTIFY_VACATION_SOON_AUTODELETE` | Приближается дата начала отпуска | Owner (warning) |

### 8. Calendar Update Events (5 templates)
| Code | Subject | Recipient |
|------|---------|-----------|
| `NOTIFY_VACATION_CALENDAR_UPDATE_0H_DAY_MOVED` | Изменения в производственном календаре | Affected employees |
| `NOTIFY_VACATION_CALENDAR_UPDATE_7H_DAY_MOVED` | Изменения в производственном календаре | Affected employees |
| `NOTIFY_VACATION_CALENDAR_UPDATE_LESS_MIN` | Изменение статуса заявки | Employee (min duration violation) |
| `NOTIFY_VACATION_CALENDAR_UPDATE_NOT_ENOUGH` | Изменения в заявке на отпуск | Employee (insufficient days) |
| `NOTIFY_VACATION_CALENDAR_NEXT_YEAR_FIRST` | Производственный календарь | All employees |
| `NOTIFY_VACATION_CALENDAR_NEXT_YEAR_LAST` | Производственный календарь | All employees |

### 9. Timing/Reminder Events (5 templates)
| Code | Subject | Recipient |
|------|---------|-----------|
| `NOTIFY_VACATION_ABSENCE_LAST_DAY_TO_EMPLOYEE` | Последний день перед отсутствием | Employee |
| `NOTIFY_VACATION_ABSENCE_LAST_DAY_TO_MANAGER` | Последний день перед отсутствием | Manager |
| `NOTIFY_VACATION_ALERT_SOON_VACATION` | Приближение отпуска сотрудника | Manager |
| `NOTIFY_VACATION_PUSH_APPROVER` | Приближение отпуска сотрудника | Approver |
| `NOTIFY_VACATION_GREETINGS_AFTER_VACATION` | С возвращением! | Employee |

### 10. Accrual Events (2 templates)
| Code | Subject | Recipient |
|------|---------|-----------|
| `NOTIFY_VACATION_ACCRUALS_BY_HIRE` | {{name}} - начисление отпускных дней | Manager |
| `NOTIFY_ABOUT_ACCRUALS_BY_HIRE_TEMPLATE_NAME` | {{name}} - начисление отпускных дней | Manager (duplicate?) |

### 11. Legacy Templates (still in DB)
| Code | Subject |
|------|---------|
| `NEW_VACATION` | Уведомление об отпуске |
| `NEW_VACATION_ALSO` | Уведомление об отпуске |
| `NEW_VACATION_DM` | Уведомление об отпуске |
| `NEW_VACATION_PM` | Уведомление об отпуске |
| `CANCEL_VACATION_DM` | Уведомление об отпуске |
| `CANCEL_VACATION_EMPLOYEE` | Уведомление об отпуске |
| `CANCEL_VACATION_PM` | Уведомление об отпуске |
| `DELETE_VACATION_AUTO` | Уведомление об отпуске |
| `DELETE_VACATION_BY_MANAGER` | Уведомление об отпуске |
| `DELETE_VACATION_DM` | Уведомление об отпуске |
| `DELETE_VACATION_EMPLOYEE` | Уведомление об отпуске |
| `DELETE_VACATION_PM` | Уведомление об отпуске |
| `UPDATE_VACATION_ALSO` | Уведомление об отпуске |
| `UPDATE_VACATION_DM` | Уведомление об отпуске |
| `VACATION_CONFIRMED_PM` | Уведомление об отпуске |
| `VACATION_STATUS_CHANGED_EMPLOYEE` | Уведомление об отпуске |
| `VACATION_IS_COMING` | Уведомление об отпуске |
| `VACATION_IS_COMING_TO_PM` | Уведомление об отпуске |
| `VACATION_LAST_DAY_BEFORE_VACATION` | Уведомление об отпуске |
| `VACATION_FIRST_DAY_AFTER_VACATION` | Уведомление об отпуске |
| `VACATION_UPDATE_REGULAR_DAYS` | Уведомление об отпуске |
| `PRELIMINARY_IS_COMING_EMPLOYEE` | Уведомление об отпуске |
| `NOTIFY_APPROVER_ABOUT_MANAGERS_APPROVE` | Решение по заявке сотрудника на отпуск |
| `DIGEST` | ТТТ Дайджест отсутствий |

## Notification Recipient Matrix

| Event | Employee | Approver | PM | DM | Notify-Also |
|-------|----------|----------|----|----|-------------|
| Create | ✅ | — | ✅ | ✅ | ✅ |
| Status Change | ✅ | — | ✅ | ✅ | ✅ |
| Edit | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete/Cancel | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change Approver | ✅ | ✅ (new) | — | ✅ | — |
| Recovered | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auto-delete | ✅ | ✅ | ✅ | ✅ | ✅ |
| Calendar Update | ✅ | — | — | — | — |
| Reminders | ✅ | ✅ | ✅ | — | — |

## Known Bug
- **#2925**: Status change email notification shows incorrect payment month (e.g., shows "июн"/June incorrectly). Template `NOTIFY_VACATION_STATUS_CHANGE_TO_EMPLOYEE` likely affected. Template body uses Mustache variables — the `paymentMonth` variable may be formatted incorrectly.

## Test Implications
- **50+ notification templates** need testing: correct recipient, correct content, correct trigger
- Both modern and legacy templates exist — unclear which are active vs deprecated
- Notification triggers are event-driven (via Spring `EventPublisher`)
- The `DIGEST` template aggregates multiple absence events — complex formatting
- Calendar update notifications are triggered by production calendar changes — cross-module dependency

## Related
- [[modules/vacation-service-deep-dive]] — event publishing in create/approve/cancel flows
- [[exploration/tickets/vacation-ticket-findings]] — #2925 wrong payment month
- [[analysis/vacation-business-rules-reference]] — notification rules
