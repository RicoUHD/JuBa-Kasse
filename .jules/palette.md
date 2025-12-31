## 2024-05-23 - Interactive Div Accessibility
**Learning:** `div` elements used as buttons (e.g., card toggles) are inaccessible to keyboard users and screen readers if they lack `role="button"`, `tabindex="0"`, and keyboard event handlers.
**Action:** When creating clickable cards or list items, always use `<button>` or add proper ARIA attributes and keydown handlers (Enter/Space) to the `div`.
