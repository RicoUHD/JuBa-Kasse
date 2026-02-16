from playwright.sync_api import sync_playwright
import time

def verify_topics(page):
    page.goto("http://localhost:8080/index.html")

    # Force Admin View UI state and hide modal aggressively
    page.evaluate("""
        var modal = document.getElementById('login-modal');
        if(modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('admin-view').style.display = 'block';
        document.getElementById('admin-bottom-nav').style.display = 'flex';
        document.getElementById('user-view').style.display = 'none';
    """)

    page.set_viewport_size({"width": 375, "height": 812})

    # Click on "Community" tab in bottom nav
    page.click("#admin-bottom-nav button:has-text('Community')")

    # Check for "Beiträge" and "Themen" buttons.
    page.wait_for_selector("#admin-tab-posts", state="visible")
    page.wait_for_selector("#admin-tab-topics", state="visible")

    # Take screenshot of Posts view
    page.screenshot(path="verification/step1_posts_view.png")

    # Click "Themen"
    page.click("#admin-tab-topics")

    # Check if search input is visible
    page.wait_for_selector("#admin-topics-search", state="visible")

    # Check if grid is visible
    page.wait_for_selector("#admin-topics-grid", state="visible")

    # Take screenshot of Topics view
    page.screenshot(path="verification/step2_topics_view.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_topics(page)
        finally:
            browser.close()
