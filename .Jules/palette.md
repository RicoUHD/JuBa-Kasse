## 2024-05-23 - Widespread Missing Form Labels
**Learning:** The app consistently uses `<label>` elements without `for` attributes, relying on visual proximity. This breaks accessibility for screen readers and touch targets.
**Action:** When adding new forms, always ensure `<label>` has a `for` attribute matching the input's `id`. Use `<span>` for non-input labels (like button groups) to maintain valid HTML.
