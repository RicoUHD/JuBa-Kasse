## 2025-02-19 - Manual DOM Manipulation Bottleneck
**Learning:** This codebase uses `innerHTML` replacement for large lists (e.g., in `renderPeople`). This forces the browser to re-parse and re-layout the entire list on every update.
**Action:** When working on this codebase, prefer CSS optimizations like `content-visibility` to mitigate the cost of these heavy DOM updates, rather than trying to optimize the JS logic alone. Virtualization would be a larger architectural change.
