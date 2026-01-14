from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 375, 'height': 812})

        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PageError: {exc}"))

        page.goto("http://localhost:8080/index.html?debug=true")

        try:
            page.wait_for_selector(".welcome-card", timeout=5000)
            print("Content loaded")
            page.screenshot(path="verification.png")
        except Exception as e:
            print(f"Error waiting for selector: {e}")
            page.screenshot(path="error_screenshot.png")

        browser.close()

if __name__ == "__main__":
    run()
