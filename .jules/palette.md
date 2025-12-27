## 2025-12-23 - [Accessible Modal Close Buttons]
**Learning:** Using `<button>` instead of `<span>` for close icons is critical for keyboard accessibility. However, it requires careful CSS resets (background, border, padding) to match the previous visual style of a simple text character.
**Action:** Always verify that interactive elements are focusable and have appropriate ARIA labels, especially when they rely on iconography.
## 2024-05-22 - [Form Validation Feedback]
**Learning:** Silent failures in forms (clicking submit with no effect) are confusing and frustrating for users. Adding immediate visual feedback (like a shake animation and red border) significantly improves usability.
**Action:** Always provide clear feedback when an action cannot be completed, preferably guiding the user to the missing information.

## 2024-05-22 - [Icon-Only Buttons]
**Learning:** Icon-only buttons (like a trash can for delete) are invisible to screen readers without an `aria-label`.
**Action:** Always check icon-only buttons for `aria-label` or `aria-labelledby`.
