## 2026-02-22 - Password Visibility Toggle Pattern
**Learning:** Implemented a lightweight, reusable pattern for password visibility toggles without external dependencies.
**Action:** Use the following structure for future password fields:
1. Wrap `input` in `<div class="password-wrapper">`.
2. Add `.has-toggle` class to the `input`.
3. Insert `<button class="password-toggle" onclick="togglePassword('INPUT_ID', this)">` inside the wrapper.
4. Ensure `assets/app.js` has the `togglePassword` helper.

## 2026-02-23 - Dynamic ARIA Labels for Canvas Charts
**Learning:** Canvas elements are invisible to screen readers by default. Adding a static role="img" and aria-label helps, but dynamically updating the label with chart data (start/end values) provides real value.
**Action:** When using <canvas> for data visualization, always implement a logic to update its aria-label with a textual summary of the data being displayed.
