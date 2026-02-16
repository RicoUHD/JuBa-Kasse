from playwright.sync_api import sync_playwright, expect
import time

def test_app(page):
    page.goto("http://localhost:8000")

    # Remove Login Modal
    page.evaluate("if(document.getElementById('login-modal')) document.getElementById('login-modal').remove()")

    # 1. Verify File Input Attribute
    file_input = page.locator("#post-files")
    expect_accept = "image/*,video/*,application/pdf,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
    actual_accept = file_input.get_attribute("accept")

    print(f"File input accept: {actual_accept}")
    assert actual_accept == expect_accept, f"Expected {expect_accept}, got {actual_accept}"

    # 2. Inject Dummy Post and Render
    page.evaluate("""() => {
        const dummyPosts = [
            {
                id: 'test_1',
                title: 'Test Post Title',
                description: 'Test Description',
                authorName: 'Test Author',
                timestamp: Date.now(),
                topic: 'News',
                media: [
                    { type: 'image/jpeg', filename: 'test.jpg', originalName: 'image.jpg' },
                    { type: 'application/pdf', filename: 'doc.pdf', originalName: 'document.pdf' }
                ]
            }
        ];

        if (window._debug_setPosts) {
            window._debug_setPosts(dummyPosts);
        }

        window.currentUser = { uid: 'other', admin: true };
        window.fetchPostMedia = async () => 'assets/bgb-logo.svg';

        // Manually show admin UI
        document.getElementById('admin-view').style.display = 'block';
        document.getElementById('user-view').style.display = 'none';
        document.getElementById('admin-bottom-nav').style.display = 'flex';

        window.renderAll();
    }""")

    # Click Community Tab
    nav = page.locator("#admin-bottom-nav")
    expect(nav).to_be_visible()
    nav.locator("button").nth(2).click()

    time.sleep(1)

    # Check if post card is visible
    post_card = page.locator(".post-card").first
    expect(post_card).to_be_visible()

    # Screenshot of Post List
    page.screenshot(path="verification/1_post_list.png")

    # Click Post to Open Details
    post_card.click()

    # Wait for Modal
    modal = page.locator("#view-post-modal")
    expect(modal).to_be_visible()
    time.sleep(0.5)

    # Screenshot of Modal
    page.screenshot(path="verification/2_post_details.png")
    print("Verification screenshots created.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use mobile viewport
        page = browser.new_page(viewport={"width": 375, "height": 667})
        try:
            test_app(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
