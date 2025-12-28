## 2025-10-27 - [Hidden Interactive Elements]
**Learning:** Elements with `opacity: 0` and `pointer-events: none` are still reachable via keyboard navigation (Tab), which is confusing for users as they are navigating "invisible" elements.
**Action:** Always use `visibility: hidden` (or `display: none`) in combination with opacity transitions to ensure hidden elements are removed from the accessibility tree and tab order.
