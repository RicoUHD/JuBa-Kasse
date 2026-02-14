
import os
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the page
    page.goto("http://localhost:8080/index.html")

    # Wait for page to load
    page.wait_for_load_state("networkidle")

    # 1. Check add-expense-modal file input
    print("Checking expense-receipt input in add-expense-modal...")
    file_input = page.locator("#expense-receipt")
    if file_input.count() > 0:
        print("PASS: #expense-receipt found.")
    else:
        print("FAIL: #expense-receipt not found.")

    # 2. Check transaction-details-modal
    print("Checking transaction-details-modal...")
    details_modal = page.locator("#transaction-details-modal")
    if details_modal.count() > 0:
        print("PASS: #transaction-details-modal found.")
    else:
        print("FAIL: #transaction-details-modal not found.")

    # 3. Check user request modal dynamic content
    print("Checking expense request modal...")
    # Evaluate JS to open the modal
    page.evaluate("window.openUserRequestModal('expense')")

    # Wait for modal to be visible and content to populate
    req_receipt = page.locator("#req-receipt")
    try:
        req_receipt.wait_for(state="visible", timeout=2000)
        print("PASS: #req-receipt found and visible.")
    except:
        print("FAIL: #req-receipt not found or not visible.")

    # Take screenshot of the user request modal
    if not os.path.exists("verification"):
        os.makedirs("verification")
    page.screenshot(path="verification/frontend_check.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
