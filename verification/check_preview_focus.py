from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8080/verification/test_preview.html")

    # Locate hero card
    hero_card = page.locator(".hero-card")
    hero_card.click() # Focus it

    # Take screenshot of focused state
    page.screenshot(path="verification/preview_focus.png")
    browser.close()
