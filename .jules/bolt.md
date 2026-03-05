# Bolt's Journal - Critical Learnings

## 2026-03-05 - Intl Object and Date Bottlenecks
**Learning:** Creating `Intl.DateTimeFormat` and `Intl.NumberFormat` objects inside loops or frequently called functions is a major performance bottleneck in this vanilla JS app. Similarly, sorting ISO dates by converting them to `Date` objects is unnecessarily slow.
**Action:** Always use pre-initialized global formatters for localized strings. Use `localeCompare` for sorting ISO date strings to avoid object instantiation overhead.

## 2026-03-05 - Date Difference Integer Math
**Learning:** Manual month difference calculation using intermediate `Date` objects is significantly slower than direct integer math using `year * 12 + month`.
**Action:** Use integer-based period calculation for all month-based logic.

## 2026-03-05 - HTML Escaping with Single-Pass Regex
**Learning:** Chained `.replace()` calls for HTML escaping are less efficient than a single-pass regex with a replacement map.
**Action:** Use the optimized regex map approach for string sanitization in hot paths.
