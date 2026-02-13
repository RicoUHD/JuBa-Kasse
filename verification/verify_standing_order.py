from playwright.sync_api import sync_playwright, expect
import datetime
import json

def test_standing_order():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock Data (Same as before)
        today = datetime.date.today()
        first_of_this_month = today.replace(day=1)
        if first_of_this_month.month == 1:
            last_month = datetime.date(first_of_this_month.year - 1, 12, 1)
        else:
            last_month = datetime.date(first_of_this_month.year, first_of_this_month.month - 1, 1)

        start_date = last_month.isoformat()

        mock_db = {
            "settings": {"vollverdiener": 50, "geringverdiener": 25, "keinverdiener": 10},
            "people": [
                {
                    "id": "p1",
                    "name": "Standing Order User",
                    "status": "vollverdiener",
                    "memberSince": start_date,
                    "originalMemberSince": start_date,
                    "payments": [
                        {"amount": 50, "date": start_date, "description": "Payment for last month"}
                    ],
                    "hasStandingOrder": True,
                    "statusHistory": [],
                    "totalPaid": 50
                },
                {
                    "id": "p2",
                    "name": "Normal User Overdue",
                    "status": "vollverdiener",
                    "memberSince": start_date,
                    "originalMemberSince": start_date,
                    "payments": [
                        {"amount": 50, "date": start_date, "description": "Payment for last month"}
                    ],
                    "hasStandingOrder": False,
                    "statusHistory": [],
                    "totalPaid": 50
                }
            ],
            "users": {
                "admin-uid": {"firstName": "Admin", "lastName": "User", "admin": True}
            },
            "donations": [],
            "expenses": [],
            "requests": []
        }

        # Mock Firebase App
        page.route("**/*firebase-app.js", lambda route: route.fulfill(
            status=200,
            content_type="application/javascript",
            body="export function initializeApp(c){ console.log('Mock Init App'); return {};}"
        ))

        # Mock Firebase Auth
        page.route("**/*firebase-auth.js", lambda route: route.fulfill(
            status=200,
            content_type="application/javascript",
            body="""
            export function getAuth(app){ return {}; }
            export function onAuthStateChanged(auth, cb){
                setTimeout(() => {
                    cb({uid: 'admin-uid', email: 'admin@test.com'});
                }, 100);
                return () => {};
            }
            export function signOut(auth){}
            export function signInWithEmailAndPassword(auth,e,p){}
            export function createUserWithEmailAndPassword(auth,e,p){}
            export function updatePassword(u,p){}
            """
        ))

        # Mock Firebase Database
        db_json = json.dumps(mock_db)

        page.route("**/*firebase-database.js", lambda route: route.fulfill(
            status=200,
            content_type="application/javascript",
            body=f"""
            const db = {db_json};
            export function getDatabase(app){{ return {{}}; }}
            export function ref(db, path){{ return {{path: path||''}}; }}
            export function child(r, path){{ return {{path: (r.path ? r.path+'/' : '')+path}}; }}
            export function query(r){{ return r; }}
            export function orderByChild(k){{ return {{}}; }}
            export function equalTo(v){{ return {{}}; }}
            export function onValue(r, cb){{ cb({{val: () => null}}); return () => {{}}; }}

            export async function get(q){{
                const path = q.path;
                let val = null;

                if(path === 'people') val = db.people;
                else if(path === 'settings') val = db.settings;
                else if(path === 'users') val = db.users;
                else if(path === 'users/admin-uid') val = db.users['admin-uid'];
                else if(path === 'donations') val = db.donations;
                else if(path === 'expenses') val = db.expenses;
                else if(path === 'requests') val = db.requests;
                else if(path === 'system/inviteCode') val = '123456';

                return {{
                    exists: () => val !== undefined && val !== null,
                    val: () => val
                }};
            }}

            export async function update(r, data){{ console.log('Mock Update', r.path); return; }}
            export async function set(r, data){{ return; }}
            export async function runTransaction(r, updateFunction){{ return {{snapshot: {{val: () => {{}}}}}}; }}
            export async function remove(r){{ return; }}
            """
        ))

        # Navigate
        page.goto("http://localhost:8000")

        # Wait for loading to finish
        try:
            # More specific selector
            user_locator = page.locator("#peopleList .person-item").filter(has_text="Standing Order User")
            user_locator.wait_for()

            print("Loaded people list and found user")

            # Verify status text inside that user item
            expect(user_locator.locator("text=Dauerauftrag aktiv")).to_be_visible()
            print("Found 'Dauerauftrag aktiv'")

            # Click to open details and see the toggle
            user_locator.click()

            # Wait for details
            # drawer-p1
            drawer = page.locator("#drawer-p1")
            expect(drawer).to_be_visible()

            # Check toggle
            toggle_label = drawer.locator("text=Dauerauftrag")
            expect(toggle_label).to_be_visible()

            # Take full page screenshot
            page.screenshot(path="verification/verification.png", full_page=True)

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")

        browser.close()

if __name__ == "__main__":
    test_standing_order()
