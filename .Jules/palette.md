# Palette's Journal

## 2024-05-22 - Missing Focus Management
**Learning:** The application uses CSS-based modals (`.show` class) but lacks any focus management. Keyboard users cannot easily navigate into the modal or close it with Escape. This is a critical accessibility gap for dialog interactions.
**Action:** Implement `openModal` and `closeModal` overrides that handle focus trapping/restoration and Escape key support.
