import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getDatabase, ref, set, get, child, onValue, update, query, orderByChild, equalTo, runTransaction, remove } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD5z2-ND8Ukx46wDhYJlUQhiUqHITrLxy0",
    authDomain: "juba-kasse.firebaseapp.com",
    databaseURL: "https://juba-kasse-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "juba-kasse",
    storageBucket: "juba-kasse.firebasestorage.app",
    messagingSenderId: "522007065248",
    appId: "1:522007065248:web:1c2490e03cd40c25e58fc5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let people = [];
let donations = [];
let expenses = [];
let settings = { vollverdiener: 50, geringverdiener: 25, keinverdiener: 10, reportStartDate: null };
let currentPersonId = null;
let isAuthenticated = false;
let currentUser = null;
let users = [];

window.showLogin = () => {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('auth-title').innerText = 'Anmelden';
    document.getElementById('btn-show-login').classList.add('btn-primary');
    document.getElementById('btn-show-login').classList.remove('btn-secondary');
    document.getElementById('btn-show-register').classList.add('btn-secondary');
    document.getElementById('btn-show-register').classList.remove('btn-primary');
    document.getElementById('auth-error').style.display = 'none';
};

window.showRegister = () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('auth-title').innerText = 'Registrieren';
    document.getElementById('btn-show-register').classList.add('btn-primary');
    document.getElementById('btn-show-register').classList.remove('btn-secondary');
    document.getElementById('btn-show-login').classList.add('btn-secondary');
    document.getElementById('btn-show-login').classList.remove('btn-primary');
    document.getElementById('auth-error').style.display = 'none';
    setButtonLoading('btn-login', false, null); // Reset login button state
};

// Helper: Changes button state to loading/disabled
function setButtonLoading(btnId, isLoading, loadingText = "Laden...") {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = loadingText;
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        if(btn.dataset.originalText) btn.innerText = btn.dataset.originalText;
        btn.disabled = false;
        btn.style.opacity = '';
    }
}

// Helper: Firebase can return lists as objects {0:.., 1:..}, this fixes that.
function safeList(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return Object.values(val);
}

function formatCurrency(amount) {
    const val = parseFloat(amount);
    if (isNaN(val)) return "0,00";
    return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function validateRequired(ids) {
    let isValid = true;
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el || !el.value.trim()) {
            isValid = false;
            if(el) {
                el.classList.add('input-error');
                el.addEventListener('input', () => el.classList.remove('input-error'), {once: true});
            }
        }
    });
    return isValid;
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    checkAuth();

    const today = new Date().toISOString().split('T')[0];
    ['payment-date', 'donation-date', 'expense-date', 'change-status-date', 'new-person-start'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = today;
    });
});

function updateTabIndicator() {
    // Find the visible tab container
    const visibleContainer = Array.from(document.querySelectorAll('.tab-nav-container')).find(el => el.offsetParent !== null);

    if (visibleContainer) {
        const activeBtn = visibleContainer.querySelector('.tab-btn.active');
        const indicator = visibleContainer.querySelector('.tab-indicator');

        if (activeBtn && indicator) {
            indicator.style.width = activeBtn.offsetWidth + 'px';
            indicator.style.transform = `translateX(${activeBtn.offsetLeft - 5}px)`;
        }
    }
}

window.addEventListener('resize', updateTabIndicator);

window.switchTab = function(tabName, btn) {
    const isUserTabs = !!btn.closest('#user-view');
    const scope = isUserTabs ? document.getElementById('user-view') : document.getElementById('admin-view');
    if (!scope) return;

    // Hide only the tab contents inside the current scope (admin vs user)
    scope.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

    // Show the selected tab content only if it belongs to the same scope
    const targetContent = document.getElementById(tabName);
    if (targetContent && scope.contains(targetContent)) {
        targetContent.classList.add('active');
    }

    // Update buttons in the same tab nav container
    const container = btn.closest('.tab-nav-container');
    if (container) {
        container.querySelectorAll('.tab-btn').forEach(el => {
            el.classList.remove('active');
            el.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        // Update indicator in this container
        const indicator = container.querySelector('.tab-indicator');
        if (indicator) {
            indicator.style.width = btn.offsetWidth + 'px';
            indicator.style.transform = `translateX(${btn.offsetLeft - 5}px)`;
        }
    }
};

// Initial indicator sync (avoid switching tabs globally)
setTimeout(updateTabIndicator, 200);

window.toggleFab = function() {
    const menu = document.getElementById('fabMenu');
    const fab = document.querySelector('.fab');
    menu.classList.toggle('show');
    fab.classList.toggle('active');

    const isExpanded = menu.classList.contains('show');
    fab.setAttribute('aria-expanded', isExpanded);
};

window.openModal = (id) => { document.getElementById(id).classList.add('show'); };
window.closeModal = (id) => { document.getElementById(id).classList.remove('show'); };

// Improved Toggle Details
window.toggleDetails = function(id) {
    const drawer = document.getElementById(`drawer-${id}`);
    const header = document.getElementById(`person-item-${id}`);

    const isOpen = drawer.style.maxHeight;

    document.querySelectorAll('.person-details').forEach(el => {
        el.style.maxHeight = null;
        el.classList.remove('active');
    });
    document.querySelectorAll('.person-item').forEach(el => {
        el.classList.remove('active');
        el.setAttribute('aria-expanded', 'false');
    });

    if (!isOpen) {
        header.classList.add('active');
        header.setAttribute('aria-expanded', 'true');
        drawer.classList.add('active');
        drawer.style.maxHeight = drawer.scrollHeight + "px";
    }
};

// --- MATHEMATIK & LOGIK (VEREINFACHT & STABIL) ---

/**
 * Gibt den aktuell gültigen Status einer Person zurück (für heute).
 * @param {Object} person - Die Person
 * @returns {string} - Der aktuell gültige Status
 */
function getCurrentStatus(person) {
    const today = new Date();
    return getStatusForMonth(person, today.getFullYear(), today.getMonth());
}

/**
 * Gibt den Status einer Person für einen bestimmten Monat zurück.
 * Berücksichtigt die komplette Statushistorie inkl. rückwirkender/zukünftiger Änderungen.
 * @param {Object} person - Die Person
 * @param {number} year - Das Jahr
 * @param {number} month - Der Monat (0-11)
 * @returns {string|null} - Der Status oder null wenn vor Mitgliedschaft
 */
function getStatusForMonth(person, year, month, sortedHistory = null) {
    // ⚡ Bolt: Fast integer comparison using pre-calculated values
    const currentTotal = year * 12 + month;

    // Check if before membership
    const memberSince = person.memberSinceObj || new Date(person.originalMemberSince || person.memberSince);
    const memberStartTotal = memberSince.getFullYear() * 12 + memberSince.getMonth();

    if (currentTotal < memberStartTotal) {
        return null;
    }

    // Use passed sortedHistory or person.statusHistory (which is now pre-sorted in loadData)
    const history = sortedHistory || person.statusHistory;

    // Fast path: loop through pre-processed history
    if (history && history.length > 0 && history[0].startTotal !== undefined) {
        for (const entry of history) {
            if (currentTotal >= entry.startTotal && (!entry.endTotal || currentTotal < entry.endTotal)) {
                return entry.status;
            }
        }
    } else {
        // Fallback for safety (e.g. if data not normalized)
        const targetDate = new Date(year, month, 15);
        const startOfMemberMonth = new Date(memberSince.getFullYear(), memberSince.getMonth(), 1);

        if (targetDate < startOfMemberMonth) return null;

        const fallbackHistory = safeList(person.statusHistory).slice().sort(
            (a, b) => new Date(a.startDate) - new Date(b.startDate)
        );

        for (const entry of fallbackHistory) {
            const start = new Date(entry.startDate);
            const end = entry.endDate ? new Date(entry.endDate) : null;
            const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);

            if (targetDate >= startMonth && (!end || targetDate < new Date(end.getFullYear(), end.getMonth(), 1))) {
                return entry.status;
            }
        }
    }

    // Kein Treffer in Historie? Aktueller Status gilt
    return person.status;
}

/**
 * Berechnet die Gesamtkosten für alle Monate seit Mitgliedschaft bis zu einem Zieldatum.
 * @param {Object} person - Die Person
 * @param {Date} untilDate - Bis zu welchem Datum berechnen
 * @returns {number} - Gesamtkosten in Euro
 */
function calculateTotalCostUntil(person, untilDate) {
    const memberSince = person.memberSinceObj || new Date(person.originalMemberSince || person.memberSince);
    let totalCost = 0;

    let year = memberSince.getFullYear();
    let month = memberSince.getMonth();

    // History is already sorted in loadData
    const sortedHistory = person.statusHistory;

    while (new Date(year, month, 1) <= untilDate) {
        const status = getStatusForMonth(person, year, month, sortedHistory);
        if (status && settings[status]) {
            totalCost += settings[status];
        }

        // Nächster Monat
        month++;
        if (month > 11) {
            month = 0;
            year++;
        }
    }

    return totalCost;
}

/**
 * Berechnet das "Bezahlt bis" Datum basierend auf einfacher Logik:
 * Geht Monat für Monat durch und zieht den jeweiligen Beitrag ab,
 * bis das Guthaben aufgebraucht ist.
 * @param {Object} person - Die Person
 * @returns {Date|null} - Das Datum bis zu dem bezahlt wurde
 */
function calculatePaidUntil(person) {
    const totalPaid = person.totalPaid || 0;

    // Fall 1: Keine Zahlungen
    if (totalPaid === 0) {
        const start = person.memberSinceObj || new Date(person.originalMemberSince || person.memberSince);
        // Letzter Tag des Vormonats
        return new Date(start.getFullYear(), start.getMonth(), 0);
    }

    const memberSince = person.memberSinceObj || new Date(person.originalMemberSince || person.memberSince);
    let remainingCredit = totalPaid;

    let year = memberSince.getFullYear();
    let month = memberSince.getMonth();

    // History is already sorted in loadData
    const sortedHistory = person.statusHistory;

    // Maximal 120 Monate (10 Jahre) in die Zukunft prüfen
    const maxIterations = 120;
    let iterations = 0;

    while (remainingCredit > 0 && iterations < maxIterations) {
        const status = getStatusForMonth(person, year, month, sortedHistory);
        const monthlyRate = status ? (settings[status] || 0) : 0;

        if (monthlyRate > 0) {
            if (remainingCredit >= monthlyRate) {
                remainingCredit -= monthlyRate;
            } else {
                // Nicht genug für den vollen Monat - Vormonat ist bezahlt
                break;
            }
        }

        // Nächster Monat
        month++;
        if (month > 11) {
            month = 0;
            year++;
        }
        iterations++;
    }

    // Der letzte vollständig bezahlte Monat ist der Vormonat
    month--;
    if (month < 0) {
        month = 11;
        year--;
    }

    // Letzter Tag dieses Monats
    return new Date(year, month + 1, 0);
}

/**
 * Berechnet den verbleibenden Zeitraum und Status für eine Person.
 * @param {Object} person - Die Person
 * @returns {Object} - { text, isOverdue, isSoonDue }
 */
function calculateTimeRemaining(person) {
    const paidUntil = calculatePaidUntil(person);
    if (!paidUntil) {
        return { text: 'Keine Zahlungen', isOverdue: true, isSoonDue: false };
    }

    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const paidMonth = new Date(paidUntil.getFullYear(), paidUntil.getMonth(), 1);

    // Differenz in Monaten berechnen
    const monthsDiff = (paidMonth.getFullYear() - currentMonth.getFullYear()) * 12
                     + (paidMonth.getMonth() - currentMonth.getMonth());

    if (monthsDiff < 0) {
        const overdueMonths = Math.abs(monthsDiff);
        return {
            text: `${overdueMonths} Monat${overdueMonths !== 1 ? 'e' : ''} überfällig`,
            isOverdue: true,
            isSoonDue: false
        };
    }

    if (monthsDiff === 0) {
        return { text: 'läuft diesen Monat ab', isOverdue: false, isSoonDue: true };
    } else if (monthsDiff === 1) {
        return { text: 'läuft nächsten Monat ab', isOverdue: false, isSoonDue: true };
    } else {
        return { text: `noch ${monthsDiff} Monat${monthsDiff !== 1 ? 'e' : ''}`, isOverdue: false, isSoonDue: false };
    }
}

/**
 * Berechnet den fehlenden Betrag in Euro bis zum Ende des aktuellen Monats.
 * @param {Object} person - Die Person
 * @returns {number} - Fehlender Betrag (0 wenn ausgeglichen oder Guthaben)
 */
function calculateOverdueAmount(person) {
    const today = new Date();
    // Ziel: Ende des aktuellen Monats
    const targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const totalCost = calculateTotalCostUntil(person, targetDate);
    const totalPaid = person.totalPaid || 0;

    const missing = totalCost - totalPaid;
    return missing > 0 ? missing : 0;
}

/**
 * Generiert HTML für die Statushistorie einer Person.
 * @param {Object} person - Die Person
 * @returns {string} - HTML String
 */
function generateStatusHistoryHTML(person) {
    const history = safeList(person.statusHistory).slice().sort(
        (a, b) => new Date(b.startDate) - new Date(a.startDate)
    );

    // Aktueller Status hinzufügen (offen)
    const currentStatusStart = history.length > 0
        ? history[0].endDate
        : (person.originalMemberSince || person.memberSince);

    const statusLabels = {
        'vollverdiener': '💼 Vollverdiener',
        'geringverdiener': '📉 Geringverdiener',
        'keinverdiener': '🎓 Keinverdiener'
    };

    let html = `
        <div class="trans-item" style="background: rgba(6, 182, 212, 0.05); margin: -5px; padding: 12px; border-radius: 8px;">
            <div class="trans-left">
                <span style="font-weight:600;">${statusLabels[person.status] || person.status}</span>
                <div class="trans-meta">Seit ${new Date(currentStatusStart).toLocaleDateString('de-DE')} • Aktuell</div>
            </div>
            <div style="font-size:0.75rem; color:var(--success); font-weight:600;">AKTIV</div>
        </div>
    `;

    if (history.length === 0) {
        return html;
    }

    html += history.map(entry => {
        const start = new Date(entry.startDate).toLocaleDateString('de-DE');
        const end = entry.endDate ? new Date(entry.endDate).toLocaleDateString('de-DE') : 'Offen';
        const rate = settings[entry.status] || 0;

        return `
            <div class="trans-item">
                <div class="trans-left">
                    <span>${statusLabels[entry.status] || entry.status}</span>
                    <div class="trans-meta">${start} – ${end}</div>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">${formatCurrency(rate)}€/Monat</div>
            </div>
        `;
    }).join('');

    return html;
}

// --- ENDE MATHEMATIK & LOGIK ---

let requests = [];

async function loadData() {
    // Ladebildschirm anzeigen
    const loader = document.getElementById('loading-overlay');
    if(loader) loader.style.display = 'flex';

    const dbRef = ref(db);

    try {
        // Non-admin: fetch only what is needed for their view (people + settings + their requests)
    if (currentUser && !currentUser.admin) {
        // 1. Fetch Settings
        const sSnap = await get(child(dbRef, 'settings'));
        if (sSnap.exists()) settings = sSnap.val();

        // 2. Fetch User's Person Entry (Securely with Fallback)
        const peopleRef = child(dbRef, 'people');
        let peopleList = [];

        try {
            // Try by UID first (Requires Index)
            let q = query(peopleRef, orderByChild('uid'), equalTo(currentUser.uid));
            let pSnap = await get(q);

            if (pSnap.exists()) {
                peopleList = safeList(pSnap.val());
            } else {
                // Fallback: Try by Name (Requires Index)
                const fullName = `${currentUser.firstName} ${currentUser.lastName}`;
                q = query(peopleRef, orderByChild('name'), equalTo(fullName));
                pSnap = await get(q);

                if (pSnap.exists()) {
                    const val = pSnap.val();
                    // Link the first match to this UID
                    const key = Object.keys(val)[0];
                    if (key) {
                        await update(child(peopleRef, key), { uid: currentUser.uid });
                        const p = val[key];
                        p.uid = currentUser.uid;
                        peopleList = [p];
                    }
                }
            }
        } catch (queryErr) {
            console.warn("Index missing, falling back to client-side filtering:", queryErr);
            // Fallback: Fetch all and filter client-side (slower but works without index)
            const pSnap = await get(peopleRef);
            const allPeople = safeList(pSnap.val());
            const fullName = `${currentUser.firstName} ${currentUser.lastName}`.toLowerCase();

            // Find by UID or Name
            peopleList = allPeople.filter(p => p.uid === currentUser.uid || p.name.toLowerCase() === fullName);

            // Auto-link if found by name but no UID
            if (peopleList.length > 0) {
                const p = peopleList[0];
                if (!p.uid && p.name.toLowerCase() === fullName) {
                    p.uid = currentUser.uid;
                    // We need the key to update. Assuming 'id' is the key or we need to find it.
                    // In this app structure, people is an array or object.
                    // If it's an object from Firebase, we need the key.
                    // safeList loses keys if not careful, but here we just need to update the object in memory for now.
                    // To persist the link, we would need to know the key.
                    // Let's try to find the key from the snapshot if possible.
                    if(pSnap.exists()) {
                        const val = pSnap.val();
                        const key = Object.keys(val).find(k => val[k].id === p.id);
                        if(key) {
                            update(child(peopleRef, key), { uid: currentUser.uid });
                        }
                    }
                }
            }
        }
        people = peopleList;

        // 3. Fetch User's Requests
        const requestsRef = child(dbRef, 'requests');
        let rSnap;
        try {
            const reqQuery = query(requestsRef, orderByChild('userId'), equalTo(currentUser.uid));
            rSnap = await get(reqQuery);
        } catch (reqErr) {
            console.warn("Request index missing, fetching all requests:", reqErr);
            rSnap = await get(requestsRef);
        }

        const allRequests = safeList(rSnap.val());
        // If we fell back to all requests, filter them now
        requests = allRequests.filter(r => r.userId === currentUser.uid);

        // UI toggles
        document.getElementById('admin-view').style.display = 'none';
        document.getElementById('user-view').style.display = 'block';
        const adminNav = document.querySelector('.container > .tab-nav');
        if(adminNav) adminNav.style.display = 'none';
        document.getElementById('settings').style.display = 'none';
        const fab = document.querySelector('.fab');
        if(fab) fab.style.display = 'none';

        // Populate User View basic info
        // document.getElementById('user-name-display').innerText = `${currentUser.firstName} ${currentUser.lastName}`;
        // document.getElementById('user-email-display').innerText = currentUser.email;

        // Initialize User Tabs Indicator
        setTimeout(updateTabIndicator, 50);

    } else {
        // Admin: fetch full dataset
        const [pSnap, dSnap, eSnap, sSnap, cSnap, rSnap, uSnap] = await Promise.all([
            get(child(dbRef, 'people')),
            get(child(dbRef, 'donations')),
            get(child(dbRef, 'expenses')),
            get(child(dbRef, 'settings')),
            get(child(dbRef, 'system/inviteCode')),
            get(child(dbRef, 'requests')),
            get(child(dbRef, 'users'))
        ]);

        people = safeList(pSnap.val());
        donations = safeList(dSnap.val());
        expenses = safeList(eSnap.val());
        requests = safeList(rSnap.val());
        if (sSnap.exists()) settings = sSnap.val();
        users = uSnap.exists()
            ? Object.entries(uSnap.val()).map(([uid, data]) => ({...data, uid}))
            : [];

        // Show Invite Code
        const code = cSnap.exists() ? cSnap.val() : '123456';
        const codeInput = document.getElementById('admin-invite-code');
        if(codeInput) codeInput.value = code;

        // UI toggles
        document.getElementById('admin-view').style.display = 'block';
        document.getElementById('user-view').style.display = 'none';
        const adminNav = document.querySelector('.container > .tab-nav');
        if(adminNav) adminNav.style.display = 'flex';
        document.getElementById('settings').style.display = '';
        const fab = document.querySelector('.fab');
        if(fab) fab.style.display = 'flex';

        // Initialize Admin Tabs Indicator
        setTimeout(updateTabIndicator, 50);
    }

    // Normalize people data
    people.forEach(person => {
        if (!person.memberSince) person.memberSince = new Date().toISOString().split('T')[0];
        if (!person.originalMemberSince) person.originalMemberSince = person.memberSince;
        person.payments = safeList(person.payments);

        // ⚡ Bolt: Pre-process history for faster lookup (avoid Date creation in loops)
        person.statusHistory = safeList(person.statusHistory).sort(
            (a, b) => new Date(a.startDate) - new Date(b.startDate)
        );
        person.statusHistory.forEach(entry => {
            const s = new Date(entry.startDate);
            entry.startTotal = s.getFullYear() * 12 + s.getMonth();
            if (entry.endDate) {
                const e = new Date(entry.endDate);
                entry.endTotal = e.getFullYear() * 12 + e.getMonth();
            } else {
                entry.endTotal = null;
            }
        });

        // Cache memberSince date object
        person.memberSinceObj = new Date(person.originalMemberSince || person.memberSince);
    });

    renderAll();
    } catch (err) {
        console.error("Ladefehler:", err);
        alert("Fehler beim Laden der Daten. Bitte Seite neu laden.");
    } finally {
        // Ladebildschirm ausblenden
        if(loader) loader.style.display = 'none';
    }
}

function renderAll() {
    if (currentUser && !currentUser.admin) {
        renderUserView();
    } else {
        renderPeople();
        renderStats();
        renderAdminRequests();
        renderUnlinkedUsers();
        document.getElementById('rate-vollverdiener').value = settings.vollverdiener;
        document.getElementById('rate-geringverdiener').value = settings.geringverdiener;
        document.getElementById('rate-keinverdiener').value = settings.keinverdiener;
        document.getElementById('report-start-date').value = settings.reportStartDate || '';
    }
}

function renderAdminRequests() {
    const pending = requests.filter(r => r.status === 'pending');
    const target = document.getElementById('admin-requests-inline');
    if (!target) return;

    if (pending.length === 0) {
        target.innerHTML = '';
        return;
    }

    const grouped = pending.reduce((acc, req) => {
        const key = req.personName || 'Unbekannt';
        if (!acc[key]) acc[key] = [];
        acc[key].push(req);
        return acc;
    }, {});

    const renderReq = (req) => {
        let typeLabel = '';
        let details = '';

        if (req.type === 'payment') {
            typeLabel = '💰 Zahlung';
            details = `${formatCurrency(req.data.amount)} € am ${new Date(req.data.date).toLocaleDateString('de-DE')}`;
            if (req.data.note) details += `<br><small>"${req.data.note}"</small>`;
        } else if (req.type === 'status') {
            typeLabel = '🔄 Statusänderung';
            details = `Neu: <strong>${req.data.newStatus}</strong> ab ${new Date(req.data.date).toLocaleDateString('de-DE')}`;
        } else if (req.type === 'expense') {
            typeLabel = '💸 Ausgabe';
            details = `${formatCurrency(req.data.amount)} € für "${req.data.description}" am ${new Date(req.data.date).toLocaleDateString('de-DE')}`;
        }

        return `
            <div style="background: var(--surface-alt); border: 1px solid var(--border); border-radius: 14px; padding: 12px; margin: 8px 0;">
                <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:8px; align-items:flex-start;">
                    <span style="font-weight:800;">${typeLabel}</span>
                    <span style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap;">${new Date(req.timestamp).toLocaleString()}</span>
                </div>
                <div style="margin-bottom:10px;">${details}</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn btn-primary btn-small" style="width:auto;" onclick="approveRequest('${req.id}')">Genehmigen</button>
                    <button class="btn btn-danger btn-small" style="width:auto;" onclick="rejectRequest('${req.id}')">Ablehnen</button>
                </div>
            </div>
        `;
    };

    const groupBlocks = Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([personName, items]) => {
            const sorted = items.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            return `
                <div style="margin-top: 12px;">
                    <div style="font-weight: 900; margin-bottom: 6px;">${personName}</div>
                    ${sorted.map(renderReq).join('')}
                </div>
            `;
        })
        .join('');

    target.innerHTML = `
        <div class="card" style="margin-bottom: 20px;">
            <div class="card-header">📥 Offene Anfragen (${pending.length})</div>
            <div class="card-body">${groupBlocks}</div>
        </div>
    `;
}

function renderUnlinkedUsers() {
    const target = document.getElementById('unlinkedUsers');
    if (!target) return;

    const unlinked = users.filter(u => !people.some(p => p.uid === u.uid));
    const availablePeople = people.filter(p => !p.uid);

    if (unlinked.length === 0) {
        target.innerHTML = '';
        return;
    }

    const options = availablePeople.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    const rows = unlinked.map(u => {
        return `
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px; flex-wrap:wrap;">
                <div style="flex:1; min-width:200px;">
                    <div style="font-weight:700;">${(u.firstName || '?')} ${(u.lastName || '')}</div>
                    <div style="font-size:0.85rem; color:var(--text-secondary);">${u.email || ''}</div>
                </div>
                <select id="link-select-${u.uid}" class="form-select" style="flex:1; min-width:220px;">
                    <option value="">Person auswählen</option>
                    ${options}
                </select>
                <button class="btn btn-primary btn-small" style="width:auto;" onclick="assignUserToPerson('${u.uid}')">Zuordnen</button>
            </div>
        `;
    }).join('');

    target.innerHTML = `
        <div class="card" style="margin-bottom:20px;">
            <div class="card-header">🧩 Nicht zugeordnete Benutzer (${unlinked.length})</div>
            <div class="card-body">
                ${availablePeople.length === 0 ? '<div style="color:var(--text-secondary);">Keine freien Personen ohne Zuordnung vorhanden.</div>' : rows}
            </div>
        </div>
    `;
}

window.assignUserToPerson = async (uid) => {
    const select = document.getElementById(`link-select-${uid}`);
    if (!select) return;
    const personId = select.value;
    if (!personId) { alert('Bitte eine Person auswählen.'); return; }

    const person = people.find(p => String(p.id) === String(personId));
    if (!person) { alert('Person nicht gefunden.'); return; }

    try {
        await update(ref(db, 'people/' + personId), { uid });
        person.uid = uid;
        alert('Zuordnung gespeichert.');
        renderUnlinkedUsers();
        renderPeople();
    } catch (err) {
        console.error('Fehler beim Zuordnen:', err);
        alert('Zuordnung fehlgeschlagen. Bitte erneut versuchen.');
    }
};

window.approveRequest = async (reqId) => {
    const req = requests.find(r => r.id === reqId);
    if(!req) return;

    try {
        if(req.type === 'payment') {
            await mutatePerson(req.personId, (person) => {
                const payments = safeList(person.payments);
                payments.push({
                    id: Date.now().toString(),
                    amount: parseFloat(req.data.amount),
                    date: req.data.date,
                    description: req.data.note || 'Zahlung (Genehmigt)'
                });
                const totalPaid = (person.totalPaid || 0) + parseFloat(req.data.amount);
                return { ...person, payments, totalPaid };
            });
        } else if(req.type === 'status') {
            await mutatePerson(req.personId, (person) => {
                const changeDate = req.data.date;
                const newStatus = req.data.newStatus;
                const changeDateObj = new Date(changeDate);

                let currentStatusStartDate = person.originalMemberSince || person.memberSince;
                const sortedHistory = safeList(person.statusHistory).slice().sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
                if (sortedHistory.length > 0 && sortedHistory[0].endDate) {
                    currentStatusStartDate = sortedHistory[0].endDate;
                }

                const updatedHistory = safeList(person.statusHistory).filter(entry => new Date(entry.startDate) < changeDateObj);
                if (new Date(currentStatusStartDate) < changeDateObj) {
                    updatedHistory.push({
                        status: person.status,
                        startDate: currentStatusStartDate,
                        endDate: changeDate
                    });
                }

                return { ...person, status: newStatus, statusHistory: updatedHistory };
            });
        } else if(req.type === 'expense') {
            const newExpense = {
                id: Date.now().toString(),
                amount: parseFloat(req.data.amount),
                description: req.data.description + ` (Von: ${req.personName})`,
                date: req.data.date
            };
            const nextExpenses = [...expenses, newExpense];
            await set(ref(db, 'expenses'), nextExpenses);
            expenses = nextExpenses;
        }

        await update(ref(db, 'requests/' + reqId), { status: 'approved' });
        loadData();
    } catch (err) {
        console.error('Fehler beim Genehmigen der Anfrage:', err);
        alert('Anfrage konnte nicht genehmigt werden. Bitte erneut versuchen.');
    }
};

window.rejectRequest = async (reqId) => {
    const reason = prompt("Grund für Ablehnung:");
    if(reason === null) return; // Cancelled

    try {
        await update(ref(db, 'requests/' + reqId), {
            status: 'rejected',
            rejectionReason: reason || 'Kein Grund angegeben'
        });
        loadData();
    } catch (err) {
        console.error('Fehler beim Ablehnen der Anfrage:', err);
        alert('Anfrage konnte nicht abgelehnt werden. Bitte erneut versuchen.');
    }
};

let currentUserTab = 'overview';

function renderUserView() {
    const container = document.getElementById('user-content-area');
    const navContainer = document.getElementById('user-bottom-nav');

    if (people.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; color: var(--text-secondary);">
                Kein Profil gefunden. Bitte Admin kontaktieren.
            </div>
        `;
        // Ensure nav is rendered even if no profile, but might be empty
        renderUserBottomNav(navContainer);
        return;
    }

    const p = people[0];

    // Render Bottom Nav
    renderUserBottomNav(navContainer);

    // Render Content based on tab
    if (currentUserTab === 'overview') {
        renderUserOverview(container, p);
    } else if (currentUserTab === 'membership') {
        // Reuse generatePersonHTML logic but wrap nicely
        container.innerHTML = `<div style="padding:20px 0;">${generatePersonHTML(p)}</div>`;
        // Auto-expand details
        setTimeout(() => {
            const el = document.getElementById(`person-item-${p.id}`);
            if(el) toggleDetails(p.id);
        }, 100);
    } else if (currentUserTab === 'history') {
         renderUserHistoryTab(container, p);
    } else if (currentUserTab === 'settings') {
        renderUserSettingsTab(container);
    }
}

function renderUserBottomNav(container) {
    const icons = {
        home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
        user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
        settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'
    };

    const tabs = [
        { id: 'overview', icon: icons.home, label: 'Übersicht' },
        { id: 'membership', icon: icons.user, label: 'Mitgliedschaft' },
        { id: 'history', icon: icons.clock, label: 'Verlauf' },
        { id: 'settings', icon: icons.settings, label: 'Einstellung' }
    ];

    container.innerHTML = tabs.map(t => `
        <button class="nav-item ${currentUserTab === t.id ? 'active' : ''}" onclick="switchUserTab('${t.id}')">
            ${t.icon}
            <span class="nav-label">${t.label}</span>
        </button>
    `).join('');
}

window.switchUserTab = (tab) => {
    currentUserTab = tab;
    renderUserView(); // Re-render content
}

window.toggleTimelineItem = function(el) {
    el.classList.toggle('expanded');
};

function renderUserOverview(container, p) {
    if (!currentUser) {
        console.warn("renderUserOverview: currentUser is null");
        return;
    }

    const paidUntil = calculatePaidUntil(p);
    const statusMeta = calculateTimeRemaining(p);
    const currentStatus = getCurrentStatus(p);
    let dateText = paidUntil ? paidUntil.toLocaleDateString('de-DE', {month:'long', year:'numeric'}) : 'Nie';

    // Welcome Card
    const firstName = currentUser.firstName || 'Mitglied';
    const lastName = currentUser.lastName || '';
    const welcomeHtml = `
        <div class="welcome-card">
            <div class="welcome-text">
                <div class="welcome-label">WILLKOMMEN</div>
                <div class="welcome-name">${firstName} ${lastName}</div>
                <div class="welcome-email">${currentUser.email}</div>
            </div>
            <div class="profile-pic">
                 ${firstName.charAt(0)}${lastName.charAt(0)}
            </div>
        </div>
    `;

    // Status Card Logic
    // Progress logic: Max 12 months buffer
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const paidMonth = paidUntil ? new Date(paidUntil.getFullYear(), paidUntil.getMonth(), 1) : new Date(0);
    const monthsDiff = (paidMonth.getFullYear() - currentMonth.getFullYear()) * 12 + (paidMonth.getMonth() - currentMonth.getMonth());

    // Clamp to 0-12 for ring
    let progress = 0;
    let ringColor = '#34C759'; // Green

    if (monthsDiff < 0) {
        progress = 100; // Full ring
        ringColor = '#FF3B30'; // Red
    } else {
        progress = Math.min(Math.max(monthsDiff, 0) * (100/12), 100);
        if (monthsDiff <= 1) ringColor = '#FF9500'; // Orange
    }

    const radius = 26;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    const hourglassIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`; // Clock icon as hourglass placeholder

    const statusHtml = `
        <div class="status-card">
            <div class="status-left">
                <div class="status-icon-box">
                    ${hourglassIcon}
                </div>
                <div class="status-info">
                    <h2>${statusMeta.isOverdue ? 'Zahlung überfällig' : (statusMeta.isSoonDue ? 'Bald fällig' : 'Alles aktuell')}</h2>
                    <p>Bezahlt bis ${dateText}</p>
                    <div class="sub-text">${statusMeta.text}</div>
                </div>
            </div>
            <div class="progress-ring-container">
                <svg width="60" height="60">
                    <circle stroke="#f1f5f9" stroke-width="6" fill="transparent" r="${radius}" cx="30" cy="30" />
                    <circle class="progress-ring-circle" stroke="${ringColor}" stroke-width="6" stroke-linecap="round" fill="transparent" r="${radius}" cx="30" cy="30"
                        style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}" />
                </svg>
            </div>
        </div>
    `;

    // Info Grid
    const rate = settings[currentStatus] || 0;
    const gridHtml = `
        <div class="info-grid">
            <div class="info-tile">
                <div class="tile-header">
                    <span>Status</span>
                    <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="tile-value" style="text-transform:capitalize;">${currentStatus}</div>
            </div>
            <div class="info-tile">
                <div class="tile-header">
                    <span>Beitrag</span>
                    <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V8H6a2 2 0 0 1-2-2 2 2 0 0 1 2-2h12v4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 12a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v-8z" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="tile-value">${formatCurrency(rate)}€<br><span style="font-size:0.8rem; font-weight:500; color:#86868b">pro Monat</span></div>
            </div>
        </div>
    `;

    // Timeline
    let timelineHtml = `<div class="timeline-section-title">Status-Verlauf</div><div class="timeline">`;
    const history = safeList(p.statusHistory).slice().sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    // Add current open status
    const currentStart = history.length > 0 ? history[0].endDate : (p.originalMemberSince || p.memberSince);

    // Helper to render timeline items with accordion capability
    const renderTimelineItem = (title, date, isActive, detailsHtml = '') => `
        <div class="timeline-item ${isActive ? 'active' : ''}" onclick="toggleTimelineItem(this)">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-main">
                    <div class="timeline-title">${title}</div>
                    <div class="timeline-date">${date}</div>
                </div>
                <div class="timeline-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
            </div>
            <div class="timeline-details">
                ${detailsHtml || '<div class="timeline-detail-row" style="justify-content:center; color:#94a3b8; font-style:italic;">Keine weiteren Details verfügbar</div>'}
            </div>
        </div>
    `;

    // Generate detail content for Current Status
    const currentDetails = `
        <div class="timeline-detail-row">
            <span>Beitrag</span>
            <span style="font-weight:600">${formatCurrency(rate)} €</span>
        </div>
        <div class="timeline-detail-row">
            <span>Status</span>
            <span style="font-weight:600">Aktiv</span>
        </div>
    `;

    timelineHtml += renderTimelineItem(currentStatus.toUpperCase(), `Seit ${new Date(currentStart).toLocaleDateString('de-DE')}`, true, currentDetails);

    history.forEach(h => {
        const hRate = settings[h.status] || 0;
        const hDetails = `
            <div class="timeline-detail-row">
                <span>Beitrag</span>
                <span style="font-weight:600">${formatCurrency(hRate)} €</span>
            </div>
             <div class="timeline-detail-row">
                <span>Ende</span>
                <span style="font-weight:600">${h.endDate ? new Date(h.endDate).toLocaleDateString('de-DE') : '-'}</span>
            </div>
        `;
        timelineHtml += renderTimelineItem(h.status.toUpperCase(), `${new Date(h.startDate).toLocaleDateString('de-DE')} - ${h.endDate ? new Date(h.endDate).toLocaleDateString('de-DE') : '...'}`, false, hDetails);
    });

    timelineHtml += `</div>`;

    container.innerHTML = welcomeHtml + statusHtml + gridHtml + timelineHtml + `<div style="height: 100px;"></div>`;
}

function renderUserHistoryTab(container, p) {
    const payments = safeList(p.payments).reverse();
    const html = `
        <div style="padding: 20px;">
            <h2 style="margin-bottom: 20px; font-weight:800; font-size:1.5rem;">Verlauf</h2>
            <div class="timeline">
                ${payments.map(pay => `
                    <div class="timeline-item">
                        <div class="timeline-dot" style="background:#34C759"></div>
                        <div class="timeline-content">
                            <div class="timeline-main">
                                <div class="timeline-title">${pay.description || 'Zahlung'}</div>
                                <div class="timeline-date">${new Date(pay.date).toLocaleDateString('de-DE')}</div>
                            </div>
                            <div style="font-weight:700; color:#34C759">+${formatCurrency(pay.amount)}€</div>
                        </div>
                    </div>
                `).join('')}
                ${payments.length === 0 ? '<div style="color:#86868b">Keine Zahlungen.</div>' : ''}
            </div>

            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight:700;">Anfragen</h3>
             <div class="user-quick-actions-grid">
                <button class="btn btn-secondary user-action-btn" onclick="openUserRequestModal('payment')">
                    <div class="user-action-icon">💰</div>
                    <div class="user-action-label">Zahlung</div>
                </button>
                <button class="btn btn-secondary user-action-btn" onclick="openUserRequestModal('status')">
                    <div class="user-action-icon">🔄</div>
                    <div class="user-action-label">Status</div>
                </button>
            </div>
            <div id="user-requests-list" style="margin-top:20px;"></div>
            <div style="height: 100px;"></div>
        </div>
    `;
    container.innerHTML = html;

    const myRequests = requests.filter(r => r.userId === currentUser.uid && r.status !== 'approved').sort((a,b) => b.timestamp - a.timestamp);
    const reqList = document.getElementById('user-requests-list');
    if(myRequests.length > 0 && reqList) {
        reqList.innerHTML = myRequests.map(req => {
            let statusBadge = '⏳', statusBg = '#f59e0b15', statusText = 'In Prüfung';
            if(req.status === 'rejected') { statusBadge = '❌'; statusBg='#ef444415'; statusText = 'Abgelehnt'; }

            return `
                <div class="user-request-item" style="background:var(--surface); border:1px solid var(--border); padding:10px; border-radius:12px; margin-bottom:10px;">
                    <div style="display: flex; justify-content: space-between; align-items:center;">
                        <span style="font-weight:700;">${req.type}</span>
                        <span style="background:${statusBg}; padding:4px 8px; border-radius:12px; font-size:0.8rem;">${statusBadge} ${statusText}</span>
                    </div>
                    <div style="font-size:0.8rem; color: #666; margin-top:4px;">${new Date(req.timestamp).toLocaleDateString('de-DE')}</div>
                </div>
            `;
        }).join('');
    }
}

function renderUserSettingsTab(container) {
    container.innerHTML = `
        <div style="padding: 20px;">
            <h2 style="margin-bottom: 20px; font-weight:800; font-size:1.5rem;">Einstellungen</h2>
            <div class="card">
                <div class="card-body">
                    <div class="form-group">
                        <label class="form-label">Farbschema</label>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-secondary" onclick="setTheme('light')">☀️ Hell</button>
                            <button class="btn btn-secondary" onclick="setTheme('dark')">🌙 Dunkel</button>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:20px;">
                        <label class="form-label">Passwort ändern</label>
                        <input type="password" id="user-new-password" class="form-input" placeholder="Neues Passwort">
                    </div>
                    <button class="btn btn-secondary" onclick="changePassword(true)">Passwort ändern</button>
                </div>
            </div>
            <button class="btn btn-danger" onclick="logout()" style="width:100%; margin-top: 20px;">🚪 Abmelden</button>
            <div style="height: 100px;"></div>
        </div>
    `;
}

function renderPeople() {
    const list = document.getElementById('peopleList');
    const empty = document.getElementById('emptyState');

    if(people.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    const overduePeople = [];
    const currentPeople = [];

    people.forEach(person => {
        const status = calculateTimeRemaining(person);
        if(status.isOverdue) overduePeople.push(person);
        else currentPeople.push(person);
    });

    overduePeople.sort((a,b) => a.name.localeCompare(b.name));
    currentPeople.sort((a,b) => a.name.localeCompare(b.name));

    let html = '';

    if(overduePeople.length > 0) {
        html += `<div class="list-section-title" style="color:var(--danger)">⚠️ Überfällige Zahlungen (${overduePeople.length})</div>`;
        html += overduePeople.map(p => generatePersonHTML(p)).join('');
    }

    if(currentPeople.length > 0) {
        html += `<div class="list-section-title" style="color:var(--success)">✅ Aktuelle Mitglieder (${currentPeople.length})</div>`;
        html += currentPeople.map(p => generatePersonHTML(p)).join('');
    }

    list.innerHTML = html;
}

function generatePersonHTML(p) {
    const paidUntil = calculatePaidUntil(p);
    const statusMeta = calculateTimeRemaining(p);
    const overdueAmount = calculateOverdueAmount(p);

    // Get current status (not future status)
    const currentStatus = getCurrentStatus(p);

    let dateText = paidUntil ? paidUntil.toLocaleDateString('de-DE', {month:'long', year:'numeric'}) : 'Nie';
    let pillClass = 'status-ok';
    let cardClass = 'success';

    if(statusMeta.isOverdue) {
        pillClass = 'status-err';
        cardClass = 'danger';
    } else if(statusMeta.isSoonDue) {
        pillClass = 'status-warn';
    }

    const paymentsList = safeList(p.payments);

    return `
        <div class="person-wrapper">
            <div id="person-item-${p.id}" class="person-item" role="button" tabindex="0" aria-expanded="false" onclick="toggleDetails('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); toggleDetails('${p.id}');}">
                <div class="person-pill">
                    <div class="person-left">
                        <div class="person-name">
                            ${p.name}
                            <span class="chevron">›</span>
                        </div>
                        <span class="person-status">${currentStatus}</span>
                    </div>
                    <div class="person-right">
                        <span class="payment-pill ${pillClass}">${dateText}</span>
                        <span class="time-remaining">${statusMeta.text}</span>
                    </div>
                </div>
            </div>
            <div id="drawer-${p.id}" class="person-details">
                <div class="details-content">

                    <div class="details-status-card ${cardClass}">
                        <div class="details-row">
                            <span class="details-label">Bezahlt bis</span>
                            <span class="details-value">${dateText}</span>
                        </div>
                        <div class="details-row">
                            <span class="details-label">Status</span>
                            <span class="details-value" style="text-transform:capitalize">${p.status}</span>
                        </div>
                        ${statusMeta.isOverdue ? `
                        <div class="details-row" style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(0,0,0,0.05)">
                            <span class="details-label text-danger">Offener Betrag</span>
                            <span class="details-value text-danger">${formatCurrency(overdueAmount)} €</span>
                        </div>
                        ` : ''}
                    </div>

                    <div class="details-actions" style="${(currentUser && !currentUser.admin) ? 'display:none' : ''}">
                        <button class="btn btn-primary" onclick="openPaymentModal('${p.id}')">💰 Zahlung</button>
                        <button class="btn btn-secondary" onclick="openChangeStatusModal('${p.id}')">🔄 Status</button>
                        <button class="btn btn-danger" onclick="deletePerson('${p.id}')" aria-label="Person löschen">🗑️</button>
                    </div>

                    <div class="history-header">📋 Statushistorie</div>
                    ${generateStatusHistoryHTML(p)}

                    <div class="history-header">💳 Zahlungshistorie</div>
                    ${paymentsList.length > 0 ? paymentsList.slice().reverse().map(pay => `
                        <div class="trans-item">
                            <div class="trans-left">
                                <span>${pay.description || 'Zahlung'}</span>
                                <div class="trans-meta">${new Date(pay.date).toLocaleDateString('de-DE')}</div>
                            </div>
                            <div class="trans-amount text-success">+${formatCurrency(pay.amount)}€</div>
                        </div>
                    `).join('') : '<div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">Keine Zahlungen vorhanden.</div>'}
                </div>
            </div>
        </div>
    `;
}

function renderStats() {
    let periodInc = 0, periodExp = 0;
    let totalInc = 0, totalExp = 0;

    const startDate = settings.reportStartDate ? new Date(settings.reportStartDate) : null;

    people.forEach(p => {
        safeList(p.payments).forEach(pay => {
            const amount = parseFloat(pay.amount);
            totalInc += amount;
            if(!startDate || new Date(pay.date) >= startDate) periodInc += amount;
        });
    });
    donations.forEach(d => {
        const amount = parseFloat(d.amount);
        totalInc += amount;
        if(!startDate || new Date(d.date) >= startDate) periodInc += amount;
    });
    expenses.forEach(e => {
        const amount = parseFloat(e.amount);
        totalExp += amount;
        if(!startDate || new Date(e.date) >= startDate) periodExp += amount;
    });

    const totalBalance = totalInc - totalExp;

    document.getElementById('heroAmount').textContent = totalBalance.toLocaleString('de-DE', {style:'currency', currency:'EUR'});
    document.getElementById('totalIncome').textContent = periodInc.toLocaleString('de-DE', {style:'currency', currency:'EUR'});
    document.getElementById('totalExpenses').textContent = periodExp.toLocaleString('de-DE', {style:'currency', currency:'EUR'});
}

window.showTransactionModal = function() {
    const container = document.getElementById('full-transaction-list');
    let all = [];

    const safePeople = safeList(people);
    const safeDonations = safeList(donations);
    const safeExpenses = safeList(expenses);

    safePeople.forEach(p => {
        safeList(p.payments).forEach(pay => {
            const d = pay.date ? new Date(pay.date) : new Date(0);
            all.push({...pay, who: p.name, type: 'pay', dateObj: d});
        });
    });
    safeDonations.forEach(d => {
        const date = d.date ? new Date(d.date) : new Date(0);
        all.push({...d, who: d.name || 'Spende', type: 'don', dateObj: date});
    });
    safeExpenses.forEach(e => {
        const date = e.date ? new Date(e.date) : new Date(0);
        all.push({...e, who: e.issuer, type: 'exp', dateObj: date});
    });

    all.sort((a,b) => b.dateObj - a.dateObj);

    if (all.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">Keine Buchungen vorhanden.</div>';
    } else {
        container.innerHTML = all.map(t => {
            const isExp = t.type === 'exp';
            const color = isExp ? 'text-danger' : 'text-success';
            const sign = isExp ? '-' : '+';
            const icon = t.type === 'pay' ? '👤' : (t.type === 'don' ? '💝' : '💸');
            return `
                <div class="trans-item">
                    <div class="trans-left">
                        <span style="font-weight:600;">${icon} ${t.who}</span>
                        <div class="trans-meta">${t.description || '-'} • ${t.date ? new Date(t.date).toLocaleDateString('de-DE') : 'Kein Datum'}</div>
                    </div>
                    <div class="trans-amount ${color}">${sign}${formatCurrency(t.amount)}€</div>
                </div>
            `;
        }).join('');
    }
    openModal('transaction-modal');
};

window.addPerson = async () => {
    if (!validateRequired(['new-person-name', 'new-person-start'])) return;

    setButtonLoading('btn-add-person', true, "Speichert...");
    const name = document.getElementById('new-person-name').value;
    const status = document.getElementById('new-person-status').value;
    const start = document.getElementById('new-person-start').value;

    const newP = {
        id: Date.now().toString(),
        name,
        status,
        memberSince: start,
        originalMemberSince: start,
        totalPaid: 0,
        statusHistory: [],
        payments: []
    };

    try {
        await saveNewPerson(newP);
        renderAll();
        closeModal('add-person-modal');
        document.getElementById('new-person-name').value = ''; // Clear input on success
    } catch (err) {
        console.error('Fehler beim Anlegen der Person:', err);
        alert('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
        setButtonLoading('btn-add-person', false);
    }
};

window.addPayment = async () => {
    if (!validateRequired(['payment-amount', 'payment-date'])) return;

    setButtonLoading('btn-add-payment', true, "Buche...");

    const amt = parseFloat(document.getElementById('payment-amount').value.replace(',', '.'));
    const date = document.getElementById('payment-date').value;
    const desc = document.getElementById('payment-desc').value;

    if(!currentPersonId || isNaN(amt)) {
        setButtonLoading('btn-add-payment', false);
        return;
    }

    try {
        const updated = await mutatePerson(currentPersonId, (person) => {
            const payments = safeList(person.payments);
            payments.push({ amount: amt, date, description: desc, id: Date.now() });
            const totalPaid = (person.totalPaid || 0) + amt;
            return { ...person, payments, totalPaid };
        });

        if (!updated) {
            alert('Person nicht gefunden.');
            return;
        }

        renderAll();
        closeModal('add-payment-modal');
    } catch (err) {
        console.error('Fehler beim Speichern der Zahlung:', err);
        alert('Zahlung konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
        setButtonLoading('btn-add-payment', false);
    }
};

window.addDonation = async () => {
    if (!validateRequired(['donation-amount', 'donation-date', 'donation-name'])) return;

    setButtonLoading('btn-add-donation', true, "Speichert...");

    const amt = parseFloat(document.getElementById('donation-amount').value.replace(',', '.'));
    if(isNaN(amt)) {
        setButtonLoading('btn-add-donation', false);
        return;
    }
    const newDonation = { amount: amt, name: document.getElementById('donation-name').value, date: document.getElementById('donation-date').value, id: Date.now() };
    const nextDonations = [...donations, newDonation];
    try {
        await set(ref(db, 'donations'), { ...nextDonations });
        donations = nextDonations;
        renderAll();
        closeModal('add-donation-modal');
    } catch (err) {
        console.error('Fehler beim Speichern der Spende:', err);
        alert('Spende konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
        setButtonLoading('btn-add-donation', false);
    }
};

window.addExpense = async () => {
    if (!validateRequired(['expense-amount', 'expense-date', 'expense-issuer', 'expense-desc'])) return;

    setButtonLoading('btn-add-expense', true, "Speichert...");

    const amt = parseFloat(document.getElementById('expense-amount').value.replace(',', '.'));
    if(isNaN(amt)) {
        setButtonLoading('btn-add-expense', false);
        return;
    }
    const newExpense = { amount: amt, issuer: document.getElementById('expense-issuer').value, description: document.getElementById('expense-desc').value, date: document.getElementById('expense-date').value, id: Date.now() };
    const nextExpenses = [...expenses, newExpense];
    try {
        await set(ref(db, 'expenses'), { ...nextExpenses });
        expenses = nextExpenses;
        renderAll();
        closeModal('add-expense-modal');
    } catch (err) {
        console.error('Fehler beim Speichern der Ausgabe:', err);
        alert('Ausgabe konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
        setButtonLoading('btn-add-expense', false);
    }
};

window.deletePerson = async (id) => {
    if(confirm("Wirklich löschen?")) {
        try {
            await remove(ref(db, 'people/' + id));
            people = people.filter(p => String(p.id) !== String(id));
            renderAll();
        } catch (err) {
            console.error('Fehler beim Löschen der Person:', err);
            alert('Löschen fehlgeschlagen. Bitte erneut versuchen.');
        }
    }
};

// --- STATUS CHANGE HANDLERS ---

window.openPaymentModal = (id) => {
    currentPersonId = id;
    openModal('add-payment-modal');
};

window.openChangeStatusModal = (id) => {
    currentPersonId = id;
    document.getElementById('change-status-date').value = new Date().toISOString().split('T')[0];
    openModal('change-status-modal');
};

window.saveStatusChange = async () => {
    if(!currentPersonId) return;

    const newStatus = document.getElementById('change-status-select').value;
    const changeDate = document.getElementById('change-status-date').value;

    if (!changeDate) {
        alert("Bitte ein Datum angeben.");
        return;
    }

    try {
        const updated = await mutatePerson(currentPersonId, (person) => {
            const changeDateObj = new Date(changeDate);
            const memberSinceDate = new Date(person.originalMemberSince || person.memberSince);

            if (changeDateObj < memberSinceDate) {
                throw new Error('Änderungsdatum liegt vor Mitgliedschaft.');
            }

            let history = safeList(person.statusHistory)
                .filter(entry => new Date(entry.startDate) < changeDateObj)
                .map(entry => {
                    if (entry.endDate) {
                        const entryEnd = new Date(entry.endDate);
                        if (entryEnd > changeDateObj) {
                            return { ...entry, endDate: changeDate };
                        }
                    }
                    return entry;
                });

            let currentStatusStartDate = person.originalMemberSince || person.memberSince;
            const sortedHistory = history.slice().sort((a, b) => new Date(b.endDate || 0) - new Date(a.endDate || 0));
            if (sortedHistory.length > 0 && sortedHistory[0].endDate) {
                currentStatusStartDate = sortedHistory[0].endDate;
            }

            if (new Date(currentStatusStartDate) < changeDateObj) {
                history.push({
                    status: person.status,
                    startDate: currentStatusStartDate,
                    endDate: changeDate
                });
            }

            return { ...person, status: newStatus, statusHistory: history };
        });

        if (!updated) {
            alert('Person nicht gefunden.');
            return;
        }

        renderAll();
        closeModal('change-status-modal');
    } catch (err) {
        console.error('Fehler bei der Statusänderung:', err);
        alert('Statusänderung fehlgeschlagen: ' + err.message);
    }
};

window.saveSettings = async () => {
    settings.vollverdiener = parseFloat(document.getElementById('rate-vollverdiener').value.replace(',', '.'));
    settings.geringverdiener = parseFloat(document.getElementById('rate-geringverdiener').value.replace(',', '.'));
    settings.keinverdiener = parseFloat(document.getElementById('rate-keinverdiener').value.replace(',', '.'));
    settings.reportStartDate = document.getElementById('report-start-date').value || null;
    try {
        await set(ref(db, 'settings'), settings);
        renderAll();
        alert("Gespeichert");
    } catch (err) {
        console.error('Fehler beim Speichern der Einstellungen:', err);
        alert('Einstellungen konnten nicht gespeichert werden.');
    }
};

window.changePassword = async (isUser = false) => {
    const inputId = isUser ? 'user-new-password' : 'new-password';
    const pw = document.getElementById(inputId).value;

    if(!pw || pw.length < 6) {
        alert("Passwort muss mindestens 6 Zeichen lang sein.");
        return;
    }

    try {
        const user = auth.currentUser;
        if(user) {
            await updatePassword(user, pw);
            alert("Passwort erfolgreich geändert.");
            document.getElementById(inputId).value = '';
        } else {
            alert("Kein Benutzer angemeldet.");
        }
    } catch (error) {
        console.error(error);
        alert("Fehler beim Ändern des Passworts: " + error.message);
    }
};

function replacePersonInMemory(person) {
    const idx = people.findIndex(p => String(p.id) === String(person.id));
    if (idx >= 0) {
        people[idx] = person;
    } else {
        people.push(person);
    }
}

async function mutatePerson(personId, mutator) {
    const personRef = ref(db, 'people/' + personId);
    const result = await runTransaction(personRef, (current) => {
        if (!current) return current;
        const draft = { ...current };
        draft.payments = safeList(draft.payments);
        draft.statusHistory = safeList(draft.statusHistory);
        return mutator(draft);
    });
    const updated = result.snapshot.val();
    if (updated) replacePersonInMemory(updated);
    return updated;
}

async function saveNewPerson(person) {
    if (!person || !person.id) throw new Error('Person ohne ID kann nicht gespeichert werden');
    await set(ref(db, 'people/' + person.id), person);
    replacePersonInMemory(person);
}

function initTheme() {
    const t = localStorage.getItem('juba-theme') || 'light';
    window.setTheme(t);
}
window.setTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('juba-theme', t);
    document.querySelector('meta[name="theme-color"]').content = t==='dark' ? '#0f172a' : '#06b6d4';
};

function setLoadingMessage(msg) {
    const el = document.getElementById('loading-message');
    if (el) el.textContent = msg;
}

async function fetchUserProfile(uid, retries = 2) {
    const snap = await get(ref(db, 'users/' + uid));
    if (snap.exists()) return { ...snap.val(), uid };
    if (retries > 0) {
        await new Promise(res => setTimeout(res, 400));
        return fetchUserProfile(uid, retries - 1);
    }
    return null;
}

// Auth Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Ensure spinner is visible while fetching user profile
        const loader = document.getElementById('loading-overlay');
        if(loader) loader.style.display = 'flex';
        setLoadingMessage('Profil wird geladen...');

        localStorage.setItem('juba-is-logged-in', 'true');
        const profile = await fetchUserProfile(user.uid, 2);
        if(profile) {
            currentUser = profile;
        } else {
            setLoadingMessage('Profil nicht gefunden, bitte Admin kontaktieren.');
            currentUser = { role: 'user', email: user.email, uid: user.uid };
        }

        document.getElementById('login-modal').classList.remove('show');
        isAuthenticated = true;
        loadData();
    } else {
        // Hide spinner if we are not logged in (e.g. session expired)
        const loader = document.getElementById('loading-overlay');
        if(loader) loader.style.display = 'none';

        localStorage.removeItem('juba-is-logged-in');
        isAuthenticated = false;
        currentUser = null;
        document.getElementById('login-modal').classList.add('show');
        showLogin();
    }
});

function checkAuth() {
    // Initial check handled by onAuthStateChanged
}

window.logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error);
    }
};

window.attemptLogin = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const errDiv = document.getElementById('auth-error');

    setButtonLoading('btn-login', true, "Anmelden...");

    if(!email || !pass) {
        errDiv.innerText = "Bitte E-Mail und Passwort eingeben.";
        errDiv.style.display = 'block';
        setButtonLoading('btn-login', false);
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // Reset button state on success so it's ready for next login after logout
        setButtonLoading('btn-login', false);
    } catch (error) {
        console.error(error);
        errDiv.innerText = "Login fehlgeschlagen: " + error.message;
        errDiv.style.display = 'block';
        setButtonLoading('btn-login', false);
    }
};

window.attemptRegister = async () => {
    const code = document.getElementById('reg-code').value;
    const email = document.getElementById('reg-email').value;
    const first = document.getElementById('reg-firstname').value;
    const last = document.getElementById('reg-lastname').value;
    const p1 = document.getElementById('reg-pass1').value;
    const p2 = document.getElementById('reg-pass2').value;
    const errDiv = document.getElementById('auth-error');

    if(!code || !email || !first || !last || !p1 || !p2) {
        errDiv.innerText = "Bitte alle Felder ausfüllen.";
        errDiv.style.display = 'block';
        return;
    }
    if(p1.length < 6) {
        errDiv.innerText = "Passwort muss mindestens 6 Zeichen lang sein.";
        errDiv.style.display = 'block';
        return;
    }
    if(p1 !== p2) {
        errDiv.innerText = "Passwörter stimmen nicht überein.";
        errDiv.style.display = 'block';
        return;
    }

    try {
        const codeSnap = await get(ref(db, 'system/inviteCode'));
        const validCode = codeSnap.exists() ? codeSnap.val() : '123456';

        if(code !== String(validCode)) {
            errDiv.innerText = "Ungültiger Registrierungscode.";
            errDiv.style.display = 'block';
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, p1);
        const user = userCredential.user;
        // Persist basic user profile
        await set(ref(db, 'users/' + user.uid), {
            firstName: first,
            lastName: last,
            email,
            admin: false
        });

        errDiv.style.display = 'none';
        const loader = document.getElementById('loading-overlay');
        if(loader) loader.style.display = 'flex';
        setLoadingMessage('Profil wird initialisiert...');
        document.getElementById('login-modal').classList.remove('show');
    } catch (error) {
        console.error(error);
        errDiv.innerText = "Registrierung fehlgeschlagen: " + error.message;
        errDiv.style.display = 'block';
    }
};

let currentRequestType = null;

window.openUserRequestModal = (type) => {
    currentRequestType = type;
    const container = document.getElementById('req-form-content');
    const title = document.getElementById('req-modal-title');

    if(type === 'payment') {
        title.innerText = "Zahlung melden";
        container.innerHTML = `
            <div class="form-group">
                <label class="form-label">Betrag (€)</label>
                <input type="text" inputmode="decimal" id="req-amount" class="form-input">
            </div>
            <div class="form-group">
                <label class="form-label">Datum</label>
                <input type="date" id="req-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
                <label class="form-label">Notiz (Optional)</label>
                <input type="text" id="req-note" class="form-input">
            </div>
        `;
    } else if(type === 'status') {
        title.innerText = "Statusänderung beantragen";
        container.innerHTML = `
            <div class="form-group">
                <label class="form-label">Neuer Status</label>
                <select id="req-status" class="form-select">
                    <option value="vollverdiener">💼 Vollverdiener</option>
                    <option value="geringverdiener">📉 Geringverdiener</option>
                    <option value="keinverdiener">🎓 Keinverdiener</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Gültig ab</label>
                <input type="date" id="req-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
        `;
    } else if(type === 'expense') {
        title.innerText = "Ausgabe melden";
        container.innerHTML = `
            <div class="form-group">
                <label class="form-label">Betrag (€)</label>
                <input type="text" inputmode="decimal" id="req-amount" class="form-input">
            </div>
            <div class="form-group">
                <label class="form-label">Beschreibung</label>
                <input type="text" id="req-desc" class="form-input">
            </div>
            <div class="form-group">
                <label class="form-label">Datum</label>
                <input type="date" id="req-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
        `;
    }

    openModal('user-request-modal');
};

window.submitUserRequest = async () => {
    if(!currentUser) return;

    // Find person ID linked to current user
    const person = people.find(p => p.uid === currentUser.uid);
    if(!person) { alert("Kein Personenprofil gefunden."); return; }

    const reqData = {};
    const date = document.getElementById('req-date').value;

    if(currentRequestType === 'payment') {
        const amount = document.getElementById('req-amount').value.replace(',', '.');
        const note = document.getElementById('req-note').value;
        if(!amount || !date) { alert("Bitte alle Felder ausfüllen"); return; }
        reqData.amount = amount;
        reqData.date = date;
        reqData.note = note;
    } else if(currentRequestType === 'status') {
        const status = document.getElementById('req-status').value;
        if(!status || !date) { alert("Bitte alle Felder ausfüllen"); return; }
        reqData.newStatus = status;
        reqData.date = date;
    } else if(currentRequestType === 'expense') {
        const amount = document.getElementById('req-amount').value.replace(',', '.');
        const desc = document.getElementById('req-desc').value;
        if(!amount || !desc || !date) { alert("Bitte alle Felder ausfüllen"); return; }
        reqData.amount = amount;
        reqData.description = desc;
        reqData.date = date;
    }

    const newReq = {
        id: Date.now().toString(),
        type: currentRequestType,
        userId: currentUser.uid,
        personId: person.id,
        personName: person.name,
        data: reqData,
        status: 'pending',
        timestamp: Date.now()
    };

    setButtonLoading('btn-submit-request', true, "Sende...");

    try {
        await set(ref(db, 'requests/' + newReq.id), newReq);
        closeModal('user-request-modal');
        alert("Anfrage gesendet! Ein Administrator wird sie prüfen.");
        loadData();
    } catch (err) {
        console.error('Fehler beim Senden der Anfrage:', err);
        alert('Anfrage konnte nicht gesendet werden. Bitte erneut versuchen.');
    } finally {
        setButtonLoading('btn-submit-request', false);
    }
};

window.generateNewCode = async () => {
    const newCode = Math.floor(100000 + Math.random() * 900000);
    try {
        await set(ref(db, 'system/inviteCode'), newCode);
        document.getElementById('admin-invite-code').value = newCode;
    } catch (err) {
        console.error('Fehler beim Generieren des Codes:', err);
        alert('Neuer Code konnte nicht gespeichert werden.');
    }
};
