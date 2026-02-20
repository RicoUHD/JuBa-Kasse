## 2026-02-20 - [Optimizing Date Aggregation]
**Learning:** Creating thousands of Date objects in loops (e.g. for chart data) causes measurable overhead and complexity with timezones.
**Action:** Use direct string comparison for ISO dates (YYYY-MM-DD) instead of converting to Date objects. This is O(N) instead of O(N log N) (avoiding sort) and eliminates allocation overhead.
