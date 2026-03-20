## TC-VAC-125: ServiceException vs ValidationException — format difference

Compare the two distinct error response formats returned by the vacation API.

### Steps
1. POST create with past startDate → triggers ServiceException
2. POST create with missing @NotNull fields → triggers MethodArgumentNotValidException
3. Compare: ServiceException has specific errorCode + no errors[]; ValidationException has generic errorCode + errors[] with field-level details

### Data
- ServiceException body: valid structure but startDate in 2020 (past)
- ValidationException body: empty object (all @NotNull fields missing)
