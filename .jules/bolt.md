## 2025-05-15 - Vanilla JS Startup Optimization
**Learning:** In vanilla JS apps using ES modules from CDNs (like Firebase), the waterfall effect of `index.html -> app.js -> CDN dependencies` significantly delays startup.
**Action:** Use `<link rel="preconnect">` and `<link rel="modulepreload">` in `index.html` to parallelize fetching of the main script and its known critical dependencies.

## 2025-05-15 - Firebase Versioning
**Learning:** This project uses Firebase v11.9.0 via `gstatic.com` CDN. Reviewers might flag this as "hallucinated" if they are only aware of older versions, but it is valid in this codebase.
**Action:** Verify specific versions in `app.js` imports before making assumptions about "standard" versions.
