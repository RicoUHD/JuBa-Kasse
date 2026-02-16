from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        page.goto("http://localhost:8080/index.html")

        # Wait for potential redirects or initial load
        page.wait_for_timeout(2000)

        # Force state to visualize FAB and Modal overlap
        page.evaluate("""
            // 1. Hide Login Modal (it might be covering everything)
            const login = document.getElementById('login-modal');
            if(login) login.classList.remove('show');
            if(login) login.style.display = 'none';

            // 2. Show Admin View & Finance Tab
            document.getElementById('admin-view').style.display = 'block';
            const finance = document.getElementById('finance-view');
            if(finance) {
                finance.classList.add('active');
                finance.style.display = 'block';
            }

            // 3. Ensure FAB is visible
            const fab = document.getElementById('admin-fab');
            if(fab) {
                fab.style.display = 'flex';
                // Ensure it is not hidden by logic
            }

            // 4. Open Transaction Modal
            const modal = document.getElementById('transaction-modal');
            if(modal) {
                modal.classList.add('show');
                modal.style.opacity = '1';
                modal.style.pointerEvents = 'all';
                // Add some content to make it visible
                document.getElementById('full-transaction-list').innerHTML = '<div style="background:white; padding:20px;">Test Modal Content</div>';
            }
        """)

        page.wait_for_timeout(1000)

        # Verify .hero-card styles (Transition should be 'all 0s ease 0s' or similar default/none)
        # Actually default is 'all 0s ease 0s' in some browsers if not set, or empty string.
        # If transition was set, it would be 'transform 0.2s ...'
        hero_card = page.locator(".hero-card").first
        transition = hero_card.evaluate("el => getComputedStyle(el).transition")
        print(f"Hero Card Transition: {transition}")

        # Check Z-Index
        modal_z = page.locator("#transaction-modal").evaluate("el => getComputedStyle(el).zIndex")
        fab_z = page.locator("#admin-fab").evaluate("el => getComputedStyle(el).zIndex")
        print(f"Modal Z-Index: {modal_z}")
        print(f"FAB Z-Index: {fab_z}")

        # Screenshot
        page.screenshot(path="verification/screenshot.png")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
