# Bolt's Journal

## 2024-05-23 - Linear Scan for Time-Series History
**Learning:** When calculating costs or status over a timeline (month by month), avoid repeated lookups in the history array ($O(N \times M)$). Instead, use a linear scan ($O(N + M)$) by maintaining a pointer to the current history entry, as both the timeline and history are sorted.
**Action:** Always check if nested loops over sorted data can be flattened to a single pass using pointers.

## 2024-05-23 - Persistent Optimization State
**Learning:** Optimizations applied during initial load (like pre-calculated fields) must be re-applied when data is updated in memory (e.g., after a transaction). Otherwise, the app degrades to a slower path or breaks.
**Action:** Encapsulate normalization logic in a shared function (e.g., `preprocessPerson`) and call it both in `loadData` and state update handlers (`replacePersonInMemory`).
