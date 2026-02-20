from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch()
    # Desktop viewport
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto("http://localhost:8080")

    # Wait for app to load
    page.wait_for_timeout(2000)

    # Inject script to show admin view and hide login
    page.evaluate("""
        () => {
            const login = document.getElementById('login-modal');
            if(login) login.classList.remove('show');
            const loader = document.getElementById('loading-overlay');
            if(loader) loader.style.display = 'none';

            const admin = document.getElementById('admin-view');
            if(admin) admin.style.display = 'block';

            const user = document.getElementById('user-view');
            if(user) user.style.display = 'none';
        }
    """)

    page.wait_for_timeout(1000)

    # Screenshot of dashboard top section
    # I want to see if the right column matches the left column height.
    # The left column has 'hero-card' and 'stats-grid'.
    # Since there is no data, the values are 0,00 €.

    page.screenshot(path="verification_full.png")

    # Locate the top section to see details
    section = page.locator(".dashboard-top-section")
    if section.is_visible():
        section.screenshot(path="verification_section.png")

    # Check for desktop fab
    fab = page.locator("#desktop-fab")
    if fab.is_visible():
        print("Desktop FAB is visible")
        # Screenshot the fab area (bottom right)
        # We can clip the screenshot or just rely on full page.
    else:
        print("Desktop FAB is NOT visible")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
