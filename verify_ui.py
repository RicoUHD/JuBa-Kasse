import os
import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Navigate to the app
        page.goto("http://localhost:8080")

        # Inject our debug helper if not present (it should be in app.js now)
        # But we need to wait for it.
        # Check if window.debug exists
        try:
            page.wait_for_function("() => window.debug", timeout=5000)
        except:
            print("Debug object not found, injecting fallback...")
            # If app.js failed to load or similar, we might need to retry or manually inject
            # But we modified app.js, so it should be there.
            pass

        # Mock Data Setup
        page.evaluate("""
            const mockPeople = [
                {
                    id: '1', name: 'Max Mustermann', status: 'vollverdiener',
                    memberSince: '2023-01-01', payments: [],
                    statusHistory: [], standingOrders: [], uid: 'user1'
                },
                {
                    id: '2', name: 'Erika Musterfrau', status: 'geringverdiener',
                    memberSince: '2023-01-01', payments: [],
                    statusHistory: [], standingOrders: []
                }
            ];
            const mockSettings = { vollverdiener: 50, geringverdiener: 25, keinverdiener: 10, pausiert: 0 };

            if(window.debug) {
                window.debug.setCurrentUser({ admin: true, firstName: 'Test', lastName: 'Admin', uid: 'admin' });
                window.debug.setData(mockPeople, [], [], mockSettings, [], []);

                // Manually trigger render
                window.debug.renderAll();
            }

            // UI Cleanup
            const loader = document.getElementById('loading-overlay');
            if(loader) loader.style.display = 'none';
            document.getElementById('login-modal').classList.remove('show');
            document.getElementById('admin-view').style.display = 'block';
            document.getElementById('user-view').style.display = 'none';
        """)

        time.sleep(1)

        # 1. Admin Dashboard Desktop
        os.makedirs("verification", exist_ok=True)
        page.screenshot(path="verification/admin_dashboard_desktop.png")
        print("Captured verification/admin_dashboard_desktop.png")

        # 2. Admin Settings Desktop
        # Click Settings Tab
        # The tab button logic: switchTab('settings', this)
        # We can just simulate the click
        page.click("#admin-desktop-nav button:has-text('Einstellungen')")
        time.sleep(0.5)
        page.screenshot(path="verification/admin_settings_desktop.png")
        print("Captured verification/admin_settings_desktop.png")

        # 3. Admin Dashboard Mobile
        page.set_viewport_size({"width": 375, "height": 812})
        # Switch back to Overview
        page.evaluate("switchTab('overview', document.createElement('button'))")
        time.sleep(0.5)
        page.screenshot(path="verification/admin_dashboard_mobile.png")
        print("Captured verification/admin_dashboard_mobile.png")

        # 4. User View Desktop
        page.set_viewport_size({"width": 1280, "height": 800})
        page.evaluate("""
            if(window.debug) {
                // Switch user
                window.debug.setCurrentUser({ admin: false, firstName: 'Max', lastName: 'Mustermann', uid: 'user1' });

                // Force UI switch manually as loadData logic is bypassed
                document.getElementById('admin-view').style.display = 'none';
                document.getElementById('user-view').style.display = 'block';

                // Render User View
                // Since renderAll checks !currentUser.admin, calling it should work
                window.debug.renderAll();
            }
        """)
        time.sleep(0.5)
        page.screenshot(path="verification/user_view_desktop.png")
        print("Captured verification/user_view_desktop.png")

        browser.close()

if __name__ == "__main__":
    run()
