## 2026-02-22 - Password Visibility Toggle Pattern
**Learning:** Implemented a lightweight, reusable pattern for password visibility toggles without external dependencies.
**Action:** Use the following structure for future password fields:
1. Wrap `input` in `<div class="password-wrapper">`.
2. Add `.has-toggle` class to the `input`.
3. Insert `<button class="password-toggle" onclick="togglePassword('INPUT_ID', this)">` inside the wrapper.
4. Ensure `assets/app.js` has the `togglePassword` helper.
