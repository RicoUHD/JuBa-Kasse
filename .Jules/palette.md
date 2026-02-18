## 2026-02-18 - Accessibility Pattern: Custom Validation vs Native Attributes
**Learning:** The app relies on custom JS validation (`validateRequired`) adding visual error classes, but lacks standard HTML5 `required` attributes. This means screen readers miss critical context and browsers don't provide native feedback.
**Action:** Always pair custom validation logic with semantic HTML attributes like `required`, `minlength`, and `pattern` to ensure robustness and accessibility.
