## 2025-05-19 - Optimizing Date Comparisons in Loops
**Learning:** Creating `new Date()` objects inside hot loops (e.g., cost calculation over months) is significantly slower than integer comparison.
**Action:** Pre-calculate target dates as total months (year * 12 + month) outside the loop and use integer comparison for loop conditions.
