## 2024-02-21 - [Oversized Icon Bottleneck]
**Learning:** Found a 1.1MB PNG (1024x1024) used as the app icon in manifest.json, which claims it is 512x512. The Service Worker caches this file on install, causing a significant delay for first-time load and offline readiness.
**Action:** Resize and optimize the icon to match the manifest declaration (512x512) and reduce file size drastically.
