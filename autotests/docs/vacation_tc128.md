## TC-VAC-128: Very large vacation — 365 day boundary

Test system behavior when creating a vacation spanning nearly an entire year.

### Steps
1. POST REGULAR type with 365-day range (Jan–Dec 2032) → expected: rejected (insufficient days)
2. Verify error response contains available days or crossing info
3. POST ADMINISTRATIVE type with 365-day range (Jan–Dec 2033) → may succeed (no day limit check)
4. Document boundary behavior for both types

### Data
- REGULAR: 2032-01-05 to 2032-12-31, paymentMonth 2032-01-01
- ADMINISTRATIVE: 2033-01-03 to 2033-12-30, paymentMonth 2033-01-01
