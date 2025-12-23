## 2025-12-23 - [Accessible Modal Close Buttons]
**Learning:** Using `<button>` instead of `<span>` for close icons is critical for keyboard accessibility. However, it requires careful CSS resets (background, border, padding) to match the previous visual style of a simple text character.
**Action:** Always verify that interactive elements are focusable and have appropriate ARIA labels, especially when they rely on iconography.
