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

// Icons (Simple SVG strings)
const icons = {
    payment: `<svg class="icon" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    status: `<svg class="icon" viewBox="0 0 24 24"><path d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.342a2 2 0 0 0-.602-1.43l-4.44-4.342A2 2 0 0 0 13.56 2H6a2 2 0 0 0-2 2z"/><path d="M9 13h6"/><path d="M9 17h3"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`,
    expense: `<svg class="icon" viewBox="0 0 24 24"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    user: `<svg class="icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    chevronRight: `<svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`,
    check: `<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
    alert: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    time: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
};

// --- GLOBAL EXPORTS FOR HTML ---
window.showLogin = () => {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('auth-title').innerText = 'Anmelden';

    // Toggle active state on buttons if they exist
    const btnLogin = document.getElementById('btn-show-login');
    const btnReg = document.getElementById('btn-show-register');
    if(btnLogin) { btnLogin.classList.add('btn-primary'); btnLogin.classList.remove('btn-secondary'); }
    if(btnReg) { btnReg.classList.add('btn-secondary'); btnReg.classList.remove('btn-primary'); }

    document.getElementById('auth-error').style.display = 'none';
};

window.showRegister = () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('auth-title').innerText = 'Registrieren';

    const btnLogin = document.getElementById('btn-show-login');
    const btnReg = document.getElementById('btn-show-register');
    if(btnLogin) { btnLogin.classList.add('btn-secondary'); btnLogin.classList.remove('btn-primary'); }
    if(btnReg) { btnReg.classList.add('btn-primary'); btnReg.classList.remove('btn-secondary'); }

    document.getElementById('auth-error').style.display = 'none';
};

// Helper: Firebase can return lists as objects {0:.., 1:..}, this fixes that.
function safeList(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return Object.values(val);
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    checkAuth();

    const today = new Date().toISOString().split('T')[0];
    ['payment-date', 'donation-date', 'expense-date', 'change-status-date', 'new-person-start'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = today;
    });

    // Mobile Navigation Handling
    setupNavigation();
});

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item, .sidebar-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.target;
            if(!target) return;

            // Switch View
            switchView(target);

            // Update Active State
            navItems.forEach(nav => {
                if(nav.dataset.target === target) nav.classList.add('active');
                else nav.classList.remove('active');
            });
        });
    });
}

function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('d-none'));

    // Show target view
    const target = document.getElementById(viewId);
    if(target) target.classList.remove('d-none');

    // Admin vs User logic separation is handled by what nav items are visible/generated
}

window.toggleFab = function() {
    document.getElementById('fabMenu').classList.toggle('show');
    document.querySelector('.fab').classList.toggle('active');
};

window.openModal = (id) => {
    const el = document.getElementById(id);
    if(el) el.classList.add('show');
};
window.closeModal = (id) => {
    const el = document.getElementById(id);
    if(el) el.classList.remove('show');
};

// --- MATHEMATIK & LOGIK ---

function getCurrentStatus(person) {
    const today = new Date();
    return getStatusForMonth(person, today.getFullYear(), today.getMonth());
}

function getStatusForMonth(person, year, month) {
    const targetDate = new Date(year, month, 15);
    const memberSince = new Date(person.originalMemberSince || person.memberSince);

    if (targetDate < new Date(memberSince.getFullYear(), memberSince.getMonth(), 1)) {
        return null;
    }

    const history = safeList(person.statusHistory).slice().sort(
        (a, b) => new Date(a.startDate) - new Date(b.startDate)
    );

    for (const entry of history) {
        const start = new Date(entry.startDate);
        const end = entry.endDate ? new Date(entry.endDate) : null;

        const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = end ? new Date(end.getFullYear(), end.getMonth() + 1, 0) : null;

        if (targetDate >= startMonth && (!endMonth || targetDate < new Date(end.getFullYear(), end.getMonth(), 1))) {
            return entry.status;
        }
    }

    return person.status;
}

function calculateTotalCostUntil(person, untilDate) {
    const memberSince = new Date(person.originalMemberSince || person.memberSince);
    let totalCost = 0;

    let year = memberSince.getFullYear();
    let month = memberSince.getMonth();

    while (new Date(year, month, 1) <= untilDate) {
        const status = getStatusForMonth(person, year, month);
        if (status && settings[status]) {
            totalCost += settings[status];
        }
        month++;
        if (month > 11) { month = 0; year++; }
    }
    return totalCost;
}

function calculatePaidUntil(person) {
    const totalPaid = person.totalPaid || 0;
    if (totalPaid === 0) {
        const start = new Date(person.originalMemberSince || person.memberSince);
        return new Date(start.getFullYear(), start.getMonth(), 0);
    }

    const memberSince = new Date(person.originalMemberSince || person.memberSince);
    let remainingCredit = totalPaid;

    let year = memberSince.getFullYear();
    let month = memberSince.getMonth();
    const maxIterations = 120;
    let iterations = 0;

    while (remainingCredit > 0 && iterations < maxIterations) {
        const status = getStatusForMonth(person, year, month);
        const monthlyRate = status ? (settings[status] || 0) : 0;

        if (monthlyRate > 0) {
            if (remainingCredit >= monthlyRate) {
                remainingCredit -= monthlyRate;
            } else {
                break;
            }
        }
        month++;
        if (month > 11) { month = 0; year++; }
        iterations++;
    }

    month--;
    if (month < 0) { month = 11; year--; }

    return new Date(year, month + 1, 0);
}

function calculateTimeRemaining(person) {
    const paidUntil = calculatePaidUntil(person);
    if (!paidUntil) {
        return { text: 'Keine Zahlungen', isOverdue: true, isSoonDue: false };
    }

    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const paidMonth = new Date(paidUntil.getFullYear(), paidUntil.getMonth(), 1);

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

function calculateOverdueAmount(person) {
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const totalCost = calculateTotalCostUntil(person, targetDate);
    const totalPaid = person.totalPaid || 0;
    const missing = totalCost - totalPaid;
    return missing > 0 ? missing : 0;
}

function generateStatusHistoryHTML(person) {
    const history = safeList(person.statusHistory).slice().sort(
        (a, b) => new Date(b.startDate) - new Date(a.startDate)
    );

    const currentStatusStart = history.length > 0
        ? history[0].endDate
        : (person.originalMemberSince || person.memberSince);

    const statusLabels = {
        'vollverdiener': 'Vollverdiener',
        'geringverdiener': 'Geringverdiener',
        'keinverdiener': 'Keinverdiener'
    };

    let html = `
        <div class="list-item">
            <div class="list-item-content">
                <span class="list-item-title">${statusLabels[person.status] || person.status}</span>
                <span class="list-item-subtitle">Seit ${new Date(currentStatusStart).toLocaleDateString('de-DE')} • Aktuell</span>
            </div>
            <span class="badge success">AKTIV</span>
        </div>
    `;

    if (history.length === 0) return html;

    html += history.map(entry => {
        const start = new Date(entry.startDate).toLocaleDateString('de-DE');
        const end = entry.endDate ? new Date(entry.endDate).toLocaleDateString('de-DE') : 'Offen';
        const rate = settings[entry.status] || 0;

        return `
            <div class="list-item">
                <div class="list-item-content">
                    <span class="list-item-title">${statusLabels[entry.status] || entry.status}</span>
                    <span class="list-item-subtitle">${start} – ${end}</span>
                </div>
                <span class="badge neutral">${rate}€</span>
            </div>
        `;
    }).join('');

    return html;
}

// --- DATA LOADING & RENDERING ---

let requests = [];

async function loadData() {
    const loader = document.getElementById('loading-overlay');
    if(loader) loader.style.display = 'flex';

    const dbRef = ref(db);

    try {
        if (currentUser && !currentUser.admin) {
            // Fetch User Data
            const sSnap = await get(child(dbRef, 'settings'));
            if (sSnap.exists()) settings = sSnap.val();

            const peopleRef = child(dbRef, 'people');
            let peopleList = [];

            try {
                // Try by UID
                let q = query(peopleRef, orderByChild('uid'), equalTo(currentUser.uid));
                let pSnap = await get(q);

                if (pSnap.exists()) {
                    peopleList = safeList(pSnap.val());
                } else {
                    // Fallback Name
                    const fullName = `${currentUser.firstName} ${currentUser.lastName}`;
                    q = query(peopleRef, orderByChild('name'), equalTo(fullName));
                    pSnap = await get(q);

                    if (pSnap.exists()) {
                        const val = pSnap.val();
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
                // Fallback Client Side
                const pSnap = await get(peopleRef);
                const allPeople = safeList(pSnap.val());
                const fullName = `${currentUser.firstName} ${currentUser.lastName}`.toLowerCase();
                peopleList = allPeople.filter(p => p.uid === currentUser.uid || p.name.toLowerCase() === fullName);
            }
            people = peopleList;

            // Fetch Requests
            const requestsRef = child(dbRef, 'requests');
            let rSnap;
            try {
                const reqQuery = query(requestsRef, orderByChild('userId'), equalTo(currentUser.uid));
                rSnap = await get(reqQuery);
            } catch (e) {
                rSnap = await get(requestsRef);
            }

            const allRequests = safeList(rSnap.val());
            requests = allRequests.filter(r => r.userId === currentUser.uid);

            // Update UI for User
            setupUserUI();

        } else {
            // Fetch Admin Data
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

            const code = cSnap.exists() ? cSnap.val() : '123456';
            const codeInput = document.getElementById('admin-invite-code');
            if(codeInput) codeInput.value = code;

            setupAdminUI();
        }

        // Normalize
        people.forEach(person => {
            if (!person.memberSince) person.memberSince = new Date().toISOString().split('T')[0];
            if (!person.originalMemberSince) person.originalMemberSince = person.memberSince;
            person.payments = safeList(person.payments);
            person.statusHistory = safeList(person.statusHistory);
        });

        renderAll();
    } catch (err) {
        console.error("Ladefehler:", err);
        alert("Fehler beim Laden der Daten.");
    } finally {
        if(loader) loader.style.display = 'none';
    }
}

function setupUserUI() {
    // Hide Admin Elements
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('d-none'));
    document.querySelectorAll('.user-only').forEach(el => el.classList.remove('d-none'));

    // Set Navigation for User
    document.querySelector('.bottom-nav').innerHTML = `
        <button class="nav-item active" data-target="user-overview">
            ${icons.payment}
            <span>Übersicht</span>
        </button>
        <button class="nav-item" data-target="user-settings">
            ${icons.user}
            <span>Konto</span>
        </button>
    `;

    // Desktop Sidebar for User
    document.querySelector('.sidebar-nav').innerHTML = `
        <div class="sidebar-item active" data-target="user-overview">
            ${icons.payment} Übersicht
        </div>
        <div class="sidebar-item" data-target="user-settings">
            ${icons.user} Einstellungen
        </div>
    `;

    setupNavigation(); // Re-attach listeners
    switchView('user-overview');

    document.getElementById('user-name-display').innerText = `${currentUser.firstName} ${currentUser.lastName}`;
}

function setupAdminUI() {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('d-none'));
    document.querySelectorAll('.user-only').forEach(el => el.classList.add('d-none'));

    // Admin Navigation
    document.querySelector('.bottom-nav').innerHTML = `
        <button class="nav-item active" data-target="admin-overview">
            ${icons.payment}
            <span>Kasse</span>
        </button>
        <button class="nav-item" data-target="admin-people">
            ${icons.user}
            <span>Mitglieder</span>
        </button>
        <button class="nav-item" data-target="admin-settings">
            <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>Einstellungen</span>
        </button>
    `;

    document.querySelector('.sidebar-nav').innerHTML = `
        <div class="sidebar-item active" data-target="admin-overview">
            ${icons.payment} Kasse & Übersicht
        </div>
        <div class="sidebar-item" data-target="admin-people">
            ${icons.user} Mitgliederverwaltung
        </div>
        <div class="sidebar-item" data-target="admin-settings">
            <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Einstellungen
        </div>
    `;

    setupNavigation(); // Re-attach listeners
    switchView('admin-overview');
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

// ... (Rendering logic mostly adapted from original but with new classes)

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
        let typeLabel = '', details = '';
        if (req.type === 'payment') {
            typeLabel = 'Zahlung';
            details = `${parseFloat(req.data.amount).toFixed(2)} € am ${new Date(req.data.date).toLocaleDateString('de-DE')}`;
            if (req.data.note) details += `<br><small class="text-muted">"${req.data.note}"</small>`;
        } else if (req.type === 'status') {
            typeLabel = 'Statusänderung';
            details = `Neu: <strong>${req.data.newStatus}</strong> ab ${new Date(req.data.date).toLocaleDateString('de-DE')}`;
        } else if (req.type === 'expense') {
            typeLabel = 'Ausgabe';
            details = `${parseFloat(req.data.amount).toFixed(2)} € für "${req.data.description}"`;
        }

        return `
            <div class="list-item" style="flex-wrap: wrap;">
                <div class="list-item-content" style="flex: 1;">
                    <span class="list-item-title">${typeLabel}</span>
                    <span class="list-item-subtitle">${details}</span>
                </div>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <button class="btn btn-sm btn-primary" onclick="approveRequest('${req.id}')">Genehmigen</button>
                    <button class="btn btn-sm btn-danger" onclick="rejectRequest('${req.id}')">Ablehnen</button>
                </div>
            </div>
        `;
    };

    const groupBlocks = Object.entries(grouped)
        .map(([personName, items]) => `
            <div style="margin-top: 12px;">
                <h4 style="margin-bottom:8px; font-size:0.9rem;">${personName}</h4>
                <div class="list-group">${items.map(renderReq).join('')}</div>
            </div>
        `).join('');

    target.innerHTML = `
        <div class="card">
            <div class="card-header">📥 Offene Anfragen (${pending.length})</div>
            <div class="card-body">${groupBlocks}</div>
        </div>
    `;
}

function renderUserView() {
    if (people.length === 0) {
        document.getElementById('user-status-card').innerHTML = `<div class="card"><div class="card-body">Kein Mitgliedseintrag gefunden.</div></div>`;
        return;
    }
    const p = people[0];
    const paidUntil = calculatePaidUntil(p);
    const statusMeta = calculateTimeRemaining(p);
    const overdueAmount = calculateOverdueAmount(p);
    const currentStatus = getCurrentStatus(p);
    let dateText = paidUntil ? paidUntil.toLocaleDateString('de-DE', {month:'long', year:'numeric'}) : 'Nie';

    let heroClass = 'hero-card';
    if(statusMeta.isOverdue) heroClass += ' bg-danger'; // Assuming I add this utility or logic

    document.getElementById('user-status-card').innerHTML = `
        <div class="${heroClass}">
            <span class="hero-label">${statusMeta.isOverdue ? 'Überfällig' : (statusMeta.isSoonDue ? 'Bald fällig' : 'Alles OK')}</span>
            <div class="hero-value">${statusMeta.text}</div>
            <div style="opacity:0.9">Bezahlt bis ${dateText}</div>
            ${statusMeta.isOverdue ? `<div style="margin-top:10px; font-weight:700;">Offen: ${overdueAmount.toFixed(2)} €</div>` : ''}
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Status</div>
                <div class="stat-value" style="text-transform:capitalize; font-size:1rem;">${currentStatus}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Beitrag</div>
                <div class="stat-value">${settings[currentStatus] || 0}€</div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">Statushistorie</div>
            <div class="card-body list-group">
                ${generateStatusHistoryHTML(p)}
            </div>
        </div>
    `;

    // Payment History
    const paymentsList = safeList(p.payments);
    const paymentRows = paymentsList.slice().reverse().map(pay => `
        <div class="list-item">
            <div class="list-item-content">
                <span class="list-item-title">${pay.description || 'Zahlung'}</span>
                <span class="list-item-subtitle">${new Date(pay.date).toLocaleDateString('de-DE')}</span>
            </div>
            <span class="badge success">+${parseFloat(pay.amount).toFixed(2)}€</span>
        </div>
    `).join('') || '<div style="padding:10px; color:var(--text-muted)">Keine Zahlungen.</div>';

    document.getElementById('user-payment-history').innerHTML = `
        <div class="card">
            <div class="card-header">Zahlungsverlauf</div>
            <div class="card-body list-group">${paymentRows}</div>
        </div>
    `;

    // Requests
    const myRequests = requests.filter(r => r.userId === currentUser.uid && r.status !== 'approved').sort((a,b) => b.timestamp - a.timestamp);
    const reqList = document.getElementById('user-requests-list');

    if(myRequests.length > 0) {
        reqList.innerHTML = myRequests.map(req => {
            let statusBadge = 'warning', statusText = 'In Prüfung';
            if(req.status === 'rejected') { statusBadge = 'danger'; statusText = 'Abgelehnt'; }

            return `
                <div class="list-item">
                    <div class="list-item-content">
                        <span class="list-item-title">${req.type.toUpperCase()}</span>
                        <span class="list-item-subtitle">${new Date(req.timestamp).toLocaleDateString()}</span>
                        ${req.rejectionReason ? `<div class="text-danger" style="font-size:0.8rem">${req.rejectionReason}</div>` : ''}
                    </div>
                    <span class="badge ${statusBadge}">${statusText}</span>
                </div>
            `;
        }).join('');
    } else {
        reqList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Keine offenen Anfragen</div>';
    }
}

function renderPeople() {
    const list = document.getElementById('peopleList');
    if(!list) return; // if in user mode

    if(people.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:40px;">Noch keine Mitglieder.</div>';
        return;
    }

    const overduePeople = [], currentPeople = [];
    people.forEach(person => {
        const status = calculateTimeRemaining(person);
        if(status.isOverdue) overduePeople.push(person);
        else currentPeople.push(person);
    });

    const sortFn = (a,b) => a.name.localeCompare(b.name);
    overduePeople.sort(sortFn);
    currentPeople.sort(sortFn);

    let html = '';

    const renderGroup = (title, group, isDanger) => {
        if(group.length === 0) return '';
        return `
            <h3 style="margin: 20px 0 10px 0; font-size: 0.9rem; text-transform: uppercase; color: var(--${isDanger?'danger':'success'})">${title} (${group.length})</h3>
            <div class="list-group">
                ${group.map(p => generatePersonHTML(p)).join('')}
            </div>
        `;
    };

    html += renderGroup('⚠️ Überfällige Zahlungen', overduePeople, true);
    html += renderGroup('✅ Aktuelle Mitglieder', currentPeople, false);

    list.innerHTML = html;
}

function generatePersonHTML(p) {
    const paidUntil = calculatePaidUntil(p);
    const statusMeta = calculateTimeRemaining(p);
    const dateText = paidUntil ? paidUntil.toLocaleDateString('de-DE', {month:'long', year:'numeric'}) : 'Nie';

    let badgeClass = 'success';
    if(statusMeta.isOverdue) badgeClass = 'danger';
    else if(statusMeta.isSoonDue) badgeClass = 'warning';

    return `
        <div class="list-item" onclick="openPersonDetails('${p.id}')">
            <div class="list-item-content">
                <span class="list-item-title">${p.name}</span>
                <span class="list-item-subtitle" style="text-transform:capitalize">${p.status} • ${statusMeta.text}</span>
            </div>
            <div class="list-item-end">
                <span class="badge ${badgeClass}">${dateText}</span>
            </div>
        </div>
    `;
}

window.openPersonDetails = (id) => {
    const p = people.find(item => String(item.id) === String(id));
    if(!p) return;

    const modalContent = document.getElementById('person-details-content');
    if(!modalContent) return; // Setup modal first

    const paidUntil = calculatePaidUntil(p);
    const statusMeta = calculateTimeRemaining(p);
    const overdueAmount = calculateOverdueAmount(p);
    const dateText = paidUntil ? paidUntil.toLocaleDateString('de-DE', {month:'long', year:'numeric'}) : 'Nie';

    modalContent.innerHTML = `
        <div class="stat-card" style="margin-bottom:20px; background:var(--bg-surface-alt)">
            <h2 style="margin-bottom:10px">${p.name}</h2>
            <div class="badge ${statusMeta.isOverdue ? 'danger' : 'success'}">${statusMeta.text}</div>
            <div style="margin-top:10px">Bezahlt bis: <strong>${dateText}</strong></div>
            ${statusMeta.isOverdue ? `<div class="text-danger font-bold">Offen: ${overdueAmount.toFixed(2)} €</div>` : ''}
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:20px;">
            <button class="btn btn-primary" onclick="openPaymentModal('${p.id}'); closeModal('person-details-modal')">
                ${icons.payment} Zahlung
            </button>
            <button class="btn btn-secondary" onclick="openChangeStatusModal('${p.id}'); closeModal('person-details-modal')">
                ${icons.status} Status
            </button>
            <button class="btn btn-danger" onclick="deletePerson('${p.id}'); closeModal('person-details-modal')">
                Löschen
            </button>
        </div>

        <h4>Statushistorie</h4>
        <div class="list-group" style="margin-bottom:20px">
            ${generateStatusHistoryHTML(p)}
        </div>

        <h4>Zahlungshistorie</h4>
        <div class="list-group">
            ${safeList(p.payments).slice().reverse().map(pay => `
                <div class="list-item">
                    <div class="list-item-content">
                        <span class="list-item-title">${pay.description || 'Zahlung'}</span>
                        <span class="list-item-subtitle">${new Date(pay.date).toLocaleDateString('de-DE')}</span>
                    </div>
                    <span class="badge success">+${parseFloat(pay.amount).toFixed(2)}€</span>
                </div>
            `).join('')}
        </div>
    `;

    openModal('person-details-modal');
};

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

// ... Unlinked Users ...
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

    const rows = unlinked.map(u => `
        <div class="list-item" style="flex-direction:column; align-items:stretch; gap:10px;">
            <div class="list-item-content">
                <span class="list-item-title">${(u.firstName || '?')} ${(u.lastName || '')}</span>
                <span class="list-item-subtitle">${u.email || ''}</span>
            </div>
            <div style="display:flex; gap:10px;">
                <select id="link-select-${u.uid}" class="form-select">
                    <option value="">Person zuweisen...</option>
                    ${options}
                </select>
                <button class="btn btn-primary btn-sm" onclick="assignUserToPerson('${u.uid}')">OK</button>
            </div>
        </div>
    `).join('');

    target.innerHTML = `
        <div class="card">
            <div class="card-header">Nicht zugeordnete Benutzer (${unlinked.length})</div>
            <div class="card-body list-group">${rows}</div>
        </div>
    `;
}

// --- ACTIONS & DATA MODIFICATION ---

window.addPerson = async () => {
    const name = document.getElementById('new-person-name').value;
    const status = document.getElementById('new-person-status').value;
    const start = document.getElementById('new-person-start').value;

    if(!name || !start) return;

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
        await set(ref(db, 'people/' + newP.id), newP);
        loadData(); // Reload all
        closeModal('add-person-modal');
    } catch (err) { alert('Fehler: ' + err.message); }
};

window.openPaymentModal = (id) => {
    currentPersonId = id;
    openModal('add-payment-modal');
};

window.addPayment = async () => {
    const amt = parseFloat(document.getElementById('payment-amount').value);
    const date = document.getElementById('payment-date').value;
    const desc = document.getElementById('payment-desc').value;

    if(!currentPersonId || isNaN(amt)) return;

    try {
        await mutatePerson(currentPersonId, (person) => {
            const payments = safeList(person.payments);
            payments.push({ amount: amt, date, description: desc, id: Date.now() });
            const totalPaid = (person.totalPaid || 0) + amt;
            return { ...person, payments, totalPaid };
        });
        closeModal('add-payment-modal');
        if(document.getElementById('person-details-modal').classList.contains('show')) {
            openPersonDetails(currentPersonId); // refresh modal if open
        }
    } catch (err) { console.error(err); }
};

window.addDonation = async () => {
    const amt = parseFloat(document.getElementById('donation-amount').value);
    if(isNaN(amt)) return;
    const newDonation = { amount: amt, name: document.getElementById('donation-name').value, date: document.getElementById('donation-date').value, id: Date.now() };
    const nextDonations = [...donations, newDonation];
    try {
        await set(ref(db, 'donations'), { ...nextDonations });
        loadData();
        closeModal('add-donation-modal');
    } catch (err) { alert('Fehler: ' + err.message); }
};

window.addExpense = async () => {
    const amt = parseFloat(document.getElementById('expense-amount').value);
    if(isNaN(amt)) return;
    const newExpense = { amount: amt, issuer: document.getElementById('expense-issuer').value, description: document.getElementById('expense-desc').value, date: document.getElementById('expense-date').value, id: Date.now() };
    const nextExpenses = [...expenses, newExpense];
    try {
        await set(ref(db, 'expenses'), { ...nextExpenses });
        loadData();
        closeModal('add-expense-modal');
    } catch (err) { alert('Fehler: ' + err.message); }
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

    if (!changeDate) { alert("Bitte ein Datum angeben."); return; }

    try {
        await mutatePerson(currentPersonId, (person) => {
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
        closeModal('change-status-modal');
        if(document.getElementById('person-details-modal').classList.contains('show')) {
            openPersonDetails(currentPersonId);
        }
    } catch (err) { alert("Fehler: " + err.message); }
};

window.assignUserToPerson = async (uid) => {
    const select = document.getElementById(`link-select-${uid}`);
    if (!select || !select.value) return;
    try {
        await update(ref(db, 'people/' + select.value), { uid });
        loadData();
    } catch(e) { console.error(e); }
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
                return { ...person, payments, totalPaid: (person.totalPaid || 0) + parseFloat(req.data.amount) };
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
        }

        await update(ref(db, 'requests/' + reqId), { status: 'approved' });
        loadData();
    } catch(e) { alert(e.message); }
};

window.rejectRequest = async (reqId) => {
    const reason = prompt("Grund:");
    if(!reason) return;
    await update(ref(db, 'requests/' + reqId), { status: 'rejected', rejectionReason: reason });
    loadData();
};

window.saveSettings = async () => {
    settings.vollverdiener = parseFloat(document.getElementById('rate-vollverdiener').value);
    settings.geringverdiener = parseFloat(document.getElementById('rate-geringverdiener').value);
    settings.keinverdiener = parseFloat(document.getElementById('rate-keinverdiener').value);
    settings.reportStartDate = document.getElementById('report-start-date').value || null;
    await set(ref(db, 'settings'), settings);
    alert("Gespeichert");
    renderAll();
};

window.changePassword = async (isUser) => {
    const id = isUser ? 'user-new-password' : 'new-password';
    const pw = document.getElementById(id).value;
    if(pw && pw.length >= 6) {
        try {
            await updatePassword(auth.currentUser, pw);
            alert("Passwort geändert");
            document.getElementById(id).value = '';
        } catch(e) { alert(e.message); }
    } else { alert("Zu kurz"); }
};

async function mutatePerson(personId, mutator) {
    const personRef = ref(db, 'people/' + personId);
    await runTransaction(personRef, (current) => {
        if (!current) return current;
        const draft = { ...current };
        draft.payments = safeList(draft.payments);
        draft.statusHistory = safeList(draft.statusHistory);
        return mutator(draft);
    });
    loadData(); // Refresh UI
}

// Auth Logic
window.attemptLogin = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch(e) {
        document.getElementById('auth-error').innerText = e.message;
        document.getElementById('auth-error').style.display = 'block';
    }
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
    if(user) {
        isAuthenticated = true;
        closeModal('login-modal');
        // Get profile
        const snap = await get(ref(db, 'users/' + user.uid));
        if(snap.exists()) currentUser = { ...snap.val(), uid: user.uid };
        else currentUser = { uid: user.uid, role: 'user', email: user.email };
        loadData();
    } else {
        isAuthenticated = false;
        currentUser = null;
        openModal('login-modal');
        showLogin();
    }
});

function initTheme() {
    const t = localStorage.getItem('juba-theme') || 'light';
    window.setTheme(t);
}
window.setTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('juba-theme', t);
};

// ... User Requests ...
window.openUserRequestModal = (type) => {
    const container = document.getElementById('req-form-content');
    const title = document.getElementById('req-modal-title');
    currentRequestType = type;

    // Simple HTML generation for form
    let content = '';
    const today = new Date().toISOString().split('T')[0];

    if(type === 'payment') {
        title.innerText = "Zahlung melden";
        content = `
            <div class="form-group"><label class="form-label">Betrag</label><input type="number" id="req-amount" class="form-input"></div>
            <div class="form-group"><label class="form-label">Datum</label><input type="date" id="req-date" class="form-input" value="${today}"></div>
            <div class="form-group"><label class="form-label">Notiz</label><input type="text" id="req-note" class="form-input"></div>
        `;
    } else if (type === 'status') {
        title.innerText = "Status ändern";
        content = `
            <div class="form-group"><label class="form-label">Neuer Status</label>
            <select id="req-status" class="form-select">
                <option value="vollverdiener">Vollverdiener</option>
                <option value="geringverdiener">Geringverdiener</option>
                <option value="keinverdiener">Keinverdiener</option>
            </select></div>
            <div class="form-group"><label class="form-label">Datum</label><input type="date" id="req-date" class="form-input" value="${today}"></div>
        `;
    }
    // ... expense
    container.innerHTML = content;
    openModal('user-request-modal');
}

window.submitUserRequest = async () => {
    // simplified logic
    if(!currentUser) return;
    const person = people.find(p => p.uid === currentUser.uid);
    if(!person) return;

    const reqData = {};
    const date = document.getElementById('req-date').value;

    if(currentRequestType === 'payment') {
        reqData.amount = document.getElementById('req-amount').value;
        reqData.date = date;
        reqData.note = document.getElementById('req-note').value;
    } else if (currentRequestType === 'status') {
        reqData.newStatus = document.getElementById('req-status').value;
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

    await set(ref(db, 'requests/' + newReq.id), newReq);
    closeModal('user-request-modal');
    loadData();
};
