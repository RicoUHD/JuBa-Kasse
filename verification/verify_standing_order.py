from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:8080")

    # Inject script to simulate user view state
    page.evaluate("""
        () => {
            // Remove login modal completely
            const modal = document.getElementById('login-modal');
            if(modal) modal.style.display = 'none';

            const loader = document.getElementById('loading-overlay');
            if(loader) loader.style.display = 'none';

            // Show user view
            document.getElementById('admin-view').style.display = 'none';
            document.getElementById('user-view').style.display = 'block';

            // Populate user view with dummy data
            document.getElementById('user-name-display').innerText = 'Test User';
            document.getElementById('user-email-display').innerText = 'test@example.com';
        }
    """)

    # Click the specific button
    page.locator("button.user-action-btn:has-text('Dauerauftrag')").click()

    # Wait for modal animation
    page.wait_for_timeout(500)

    # Take screenshot
    page.screenshot(path="verification/standing_order_modal.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
