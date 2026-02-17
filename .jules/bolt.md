## 2024-05-24 - Expensive Date Objects in Hot Loops
**Learning:** The application relies heavily on client-side date calculations for status determination (e.g. `calculatePaidUntil` iterating up to 120 times per person). Creating `new Date()` objects inside these loops caused significant performance degradation (over 1s for 500 users).
**Action:** Pre-calculate integer representations of dates (e.g. `year * 12 + month`) during data loading and hoist `new Date()` creation out of loops.
