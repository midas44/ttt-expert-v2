## TC-VAC-065: Notify-also with required=true acts as mandatory approver

Verify the notify-also mechanism and the required flag behavior in vacation_notify_also table.

### Steps
1. POST create with notifyAlso: ["mpotter", "zmustafina"]
2. Query DB: vacation_notify_also records for the created vacation
3. Verify required flag — all should be false (EmployeeWatcherServiceImpl.listRequired() is a no-op)
4. Verify record count matches user-submitted logins (no extra from listRequired)

### Data
- Dynamic: conflict-free Mon-Fri week at offset 224, same-office colleagues for notifyAlso
- notifyAlso is List<String> in DTO — just login strings, no required flag in request

### Finding
EmployeeWatcherServiceImpl.listRequired() is a no-op stub — always returns empty list.
Therefore required=true is NEVER set. The "mandatory approver via notifyAlso" feature is dead code.
