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
let settings = { vollverdiener: 50, geringverdiener: 25, keinverdiener: 10, pausiert: 0, reportStartDate: null };
let settingsVersion = 0;
let currentPersonId = null;
let isAuthenticated = false;
let currentUser = null;
let users = [];
let chartDataCache = null;

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

// ⚡ Bolt: Helper to normalize and pre-calculate person data for performance
function preprocessPerson(person) {
    if (!person.memberSince) person.memberSince = new Date().toISOString().split('T')[0];
    if (!person.originalMemberSince) person.originalMemberSince = person.memberSince;
    person.payments = safeList(person.payments);

    // Pre-process history for faster lookup (avoid Date creation in loops)
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
    return person;
}

// ⚡ Bolt: Helper to find status in sorted history efficiently
function findStatusInHistory(history, idx, currentTotal) {
    let newIdx = idx;
    let status = null;

    // Advance to find relevant entry
    while (newIdx < history.length) {
        const entry = history[newIdx];
        // If endTotal is set and we passed it, move to next
        if (entry.endTotal !== null && currentTotal >= entry.endTotal) {
            newIdx++;
        } else {
            // Found potential candidate (or gap before it)
            break;
        }
    }

    // Check if current candidate covers us
    if (newIdx < history.length) {
        const entry = history[newIdx];
        if (currentTotal >= entry.startTotal) {
            status = entry.status;
        }
    }

    return { status, newIdx };
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

window.switchTab = function(tabName, btn) {
    const isUserNav = !!btn.closest('#user-bottom-nav') || !!btn.closest('#user-desktop-nav');
    const scope = isUserNav ? document.getElementById('user-view') : document.getElementById('admin-view');
    if (!scope) return;

    // Hide only the tab contents inside the current scope (admin vs user)
    scope.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

    // Show the selected tab content only if it belongs to the same scope
    const targetContent = document.getElementById(tabName);
    if (targetContent && scope.contains(targetContent)) {
        targetContent.classList.add('active');
    }

    // Update buttons in the same nav container
    const container = btn.closest('.bottom-nav') || btn.closest('.desktop-nav');
    if (container) {
        container.querySelectorAll('.nav-item, .nav-btn').forEach(el => {
            el.classList.remove('active');
            el.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
    }
};

window.toggleFab = function() {
    const menu = document.getElementById('fabMenu');
    if (!menu) return;

    menu.classList.toggle('show');
    const isExpanded = menu.classList.contains('show');

    const fabs = document.querySelectorAll('.nav-fab, .desktop-fab');
    fabs.forEach(fab => {
        if (isExpanded) {
            fab.classList.add('active');
        } else {
            fab.classList.remove('active');
        }
        fab.setAttribute('aria-expanded', isExpanded);
    });
};

window.openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;

    // Store current focus on the modal instance itself to handle nesting
    modal._returnFocusTo = document.activeElement;
    modal.classList.add('show');

    // Focus management
    const focusable = modal.querySelector('input:not([type="hidden"]), select, textarea') ||
                      modal.querySelector('button, [href], [tabindex]:not([tabindex="-1"])');
    if (focusable) {
        // Small timeout to allow transition/visibility paint
        setTimeout(() => focusable.focus(), 50);
    }

    // Escape to close
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeModal(id);
        }
    };
    document.addEventListener('keydown', handleEsc);
    modal._escHandler = handleEsc;
};

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.remove('show');

    if (modal._escHandler) {
        document.removeEventListener('keydown', modal._escHandler);
        delete modal._escHandler;
    }

    const returnFocus = modal._returnFocusTo;
    if (returnFocus && document.body.contains(returnFocus)) {
        try { returnFocus.focus(); } catch(e){}
    }
    delete modal._returnFocusTo;
};

// Improved Toggle Details
window.toggleDetails = function(id) {
    const drawer = document.getElementById(`drawer-${id}`);
    const header = document.getElementById(`person-item-${id}`);
    const wrapper = header.closest('.person-wrapper');

    const isOpen = drawer.style.maxHeight;

    document.querySelectorAll('.person-details').forEach(el => {
        el.style.maxHeight = null;
        el.classList.remove('active');
    });
    document.querySelectorAll('.person-item').forEach(el => {
        el.classList.remove('active');
        el.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.person-wrapper').forEach(el => {
        el.classList.remove('active');
    });

    if (!isOpen) {
        header.classList.add('active');
        header.setAttribute('aria-expanded', 'true');
        drawer.classList.add('active');
        drawer.style.maxHeight = drawer.scrollHeight + "px";
        if(wrapper) wrapper.classList.add('active');
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

    // ⚡ Bolt: Optimized linear scan
    let historyIdx = 0;

    // ⚡ Bolt: Pre-calculate target months for faster integer comparison
    const targetTotal = untilDate.getFullYear() * 12 + untilDate.getMonth();

    while ((year * 12 + month) <= targetTotal) {
        const currentTotal = year * 12 + month;

        const { status: historyStatus, newIdx } = findStatusInHistory(sortedHistory, historyIdx, currentTotal);
        historyIdx = newIdx;

        const status = historyStatus || person.status;

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
    return calculatePaymentStatus(person).paidUntil;
}

/**
 * ⚡ Bolt: New function returning detailed payment status including remaining credit.
 * Used to optimize overdue calculation.
 */
function calculatePaymentStatus(person) {
    // ⚡ Bolt: Memoization to avoid costly re-calculation on every render
    if (person._cache_paymentStatus &&
        person._cache_version === settingsVersion &&
        person._cache_totalPaid === person.totalPaid) {
        return person._cache_paymentStatus;
    }

    const totalPaid = person.totalPaid || 0;
    const start = person.memberSinceObj || new Date(person.originalMemberSince || person.memberSince);
    let result;

    // Fall 1: Keine Zahlungen
    if (totalPaid === 0) {
        // Letzter Tag des Vormonats
        result = {
            paidUntil: new Date(start.getFullYear(), start.getMonth(), 0),
            remainingCredit: 0
        };
    } else {
        let remainingCredit = totalPaid;

        let year = start.getFullYear();
        let month = start.getMonth();

        // History is already sorted in loadData
        const sortedHistory = person.statusHistory;

        // Maximal 120 Monate (10 Jahre) in die Zukunft prüfen
        const maxIterations = 120;
        let iterations = 0;

        // ⚡ Bolt: Optimized linear scan through history
        let historyIdx = 0;

        while (remainingCredit >= 0 && iterations < maxIterations) {
            // Fast status lookup using pre-calculated total months
            const currentTotal = year * 12 + month;

            const { status: historyStatus, newIdx } = findStatusInHistory(sortedHistory, historyIdx, currentTotal);
            historyIdx = newIdx;

            const status = historyStatus || person.status; // Default/Fallback
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
        result = {
            paidUntil: new Date(year, month + 1, 0),
            remainingCredit: remainingCredit
        };
    }

    // Cache the result
    person._cache_paymentStatus = result;
    person._cache_version = settingsVersion;
    person._cache_totalPaid = totalPaid;

    return result;
}

/**
 * ⚡ Bolt: Helper to calculate cost for a range. Used by optimized overdue calculation.
 */
function calculateCostRange(person, startDate, endDate) {
    let totalCost = 0;
    let year = startDate.getFullYear();
    let month = startDate.getMonth();
    const sortedHistory = person.statusHistory;

    // Safety break
    let limit = 0;

    // ⚡ Bolt: Optimized linear scan
    let historyIdx = 0;

    // ⚡ Bolt: Pre-calculate target months for faster integer comparison
    const targetTotal = endDate.getFullYear() * 12 + endDate.getMonth();

    while ((year * 12 + month) <= targetTotal && limit < 120) {
        const currentTotal = year * 12 + month;

        const { status: historyStatus, newIdx } = findStatusInHistory(sortedHistory, historyIdx, currentTotal);
        historyIdx = newIdx;

        const status = historyStatus || person.status;

        if (status && settings[status]) {
            totalCost += settings[status];
        }
        month++;
        if (month > 11) { month = 0; year++; }
        limit++;
    }
    return totalCost;
}

/**
 * Berechnet den verbleibenden Zeitraum und Status für eine Person.
 * @param {Object} person - Die Person
 * @returns {Object} - { text, isOverdue, isSoonDue }
 */
function calculateTimeRemaining(person, preCalculatedPaidUntil) {
    // START CHECK
    const standingOrders = safeList(person.standingOrders);
    const now = new Date();
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const hasActiveSO = standingOrders.some(so => {
         if (so.startDate > todayStr) return false;
         if (so.endDate && so.endDate < todayStr) return false;
         return true;
    });

    const paidUntil = preCalculatedPaidUntil !== undefined ? preCalculatedPaidUntil : calculatePaidUntil(person);
    if (!paidUntil) {
        if (hasActiveSO) {
             return { text: 'Keine Zahlungen', isOverdue: true, isSoonDue: false, isActiveStandingOrder: true };
        }
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

        if (hasActiveSO) {
            // Check if standing order covers the current missing month
            if (overdueMonths === 1) {
                const hasCoverage = standingOrders.some(so => {
                    const targetMonth = currentMonth.getMonth();
                    const targetYear = currentMonth.getFullYear();

                    if (so.endDate) {
                        const endDay = new Date(so.endDate);
                        endDay.setHours(23, 59, 59, 999);

                        const start = new Date(so.startDate);
                        const dayOfMonth = start.getDate();
                        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
                        const paymentDateInTargetMonth = new Date(targetYear, targetMonth, Math.min(dayOfMonth, lastDay));

                        if (paymentDateInTargetMonth > endDay) return false;
                    }
                    return true;
                });

                if (hasCoverage) {
                    return {
                        text: 'Dauerauftrag aktiv',
                        isOverdue: false,
                        isSoonDue: false,
                        isActiveStandingOrder: true
                    };
                }
            }

            return {
                text: 'Dauerauftrag aktiv',
                isOverdue: true,
                isSoonDue: false,
                isActiveStandingOrder: true
            };
        }

        return {
            text: `${overdueMonths} Monat${overdueMonths !== 1 ? 'e' : ''} überfällig`,
            isOverdue: true,
            isSoonDue: false
        };
    }

    if (hasActiveSO) {
        return {
            text: 'Dauerauftrag aktiv',
            isOverdue: false,
            isSoonDue: false,
            isActiveStandingOrder: true
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
 * @param {Date} [preCalcPaidUntil] - Optional: Vorberechnetes "Bezahlt bis" Datum
 * @param {number} [preCalcCredit] - Optional: Vorberechnetes Restguthaben
 * @returns {number} - Fehlender Betrag (0 wenn ausgeglichen oder Guthaben)
 */
function calculateOverdueAmount(person, preCalcPaidUntil, preCalcCredit) {
    const today = new Date();
    // Ziel: Ende des aktuellen Monats
    const targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // ⚡ Bolt: Optimized path avoiding full history iteration
    if (preCalcPaidUntil) {
        // Start calculation from the month AFTER paidUntil
        const startCalc = new Date(preCalcPaidUntil);
        startCalc.setDate(1);
        startCalc.setMonth(startCalc.getMonth() + 1);

        // If startCalc > targetDate, we are ahead of payment (not overdue), return 0
        if (startCalc > targetDate) return 0;

        const missingCost = calculateCostRange(person, startCalc, targetDate);
        const credit = preCalcCredit || 0;
        const finalMissing = missingCost - credit;

        return finalMissing > 0 ? finalMissing : 0;
    }

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
        'keinverdiener': '🎓 Keinverdiener',
        'pausiert': '⏸️ Pausiert'
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

function checkAndExecuteStandingOrders(person) {
    if (!person.standingOrders || !Array.isArray(person.standingOrders) || person.standingOrders.length === 0) return null;

    let modified = false;
    const payments = safeList(person.payments);
    const standingOrders = safeList(person.standingOrders);
    const today = new Date();
    today.setHours(23,59,59,999); // Use end of day to avoid timezone lag (UTC vs Local)

    const updatedStandingOrders = [];

    for (const so of standingOrders) {
        let soModified = false;
        let currentSO = { ...so };
        const startDate = new Date(currentSO.startDate);
        const dayOfMonth = startDate.getDate();
        let lastAuto = currentSO.lastAutoPayment ? new Date(currentSO.lastAutoPayment) : null;

        // Determine limit date: min(end of month, endDate)
        let limitDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        let isExpired = false;

        if (currentSO.endDate) {
            const end = new Date(currentSO.endDate);
            end.setHours(23, 59, 59, 999);

            // Constraint 1: Still respect currentSO.endDate.
            if (end < limitDate) {
                limitDate = end;
            }

            if (end < today) {
                isExpired = true;
            }
        }

        // Determine where to start checking
        let nextDueDate;
        if (!lastAuto) {
            nextDueDate = new Date(startDate);
        } else {
            nextDueDate = new Date(lastAuto);
            nextDueDate.setDate(1);
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            const maxDays = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
            nextDueDate.setDate(Math.min(dayOfMonth, maxDays));
        }

        // Loop until limitDate
        // Safety break to prevent infinite loops if dates are messed up
        let safety = 0;
        while (nextDueDate <= limitDate && safety < 120) {
            const dateStr = nextDueDate.toISOString().split('T')[0];
            const paymentId = `auto_${currentSO.id}_${dateStr}`;

            const exists = payments.some(p => p.id === paymentId);

            if (!exists) {
                payments.push({
                    id: paymentId,
                    amount: parseFloat(currentSO.amount),
                    date: dateStr,
                    description: (currentSO.note || 'Dauerauftrag') + ' (Auto)',
                    isAuto: true
                });
                modified = true;
                soModified = true;
            }

            // Move pointer forward
            lastAuto = new Date(nextDueDate);

            nextDueDate.setDate(1);
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            const maxDays = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
            nextDueDate.setDate(Math.min(dayOfMonth, maxDays));
            safety++;
        }

        if (soModified && lastAuto) {
            currentSO.lastAutoPayment = lastAuto.toISOString().split('T')[0];
        }

        if (isExpired) {
            // Remove from list if expired
            modified = true;
        } else {
            updatedStandingOrders.push(currentSO);
            if (soModified) modified = true;
        }
    }

    if (modified) {
        return { ...person, payments, standingOrders: updatedStandingOrders };
    }
    return null;
}

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
        if (sSnap.exists()) {
            settings = sSnap.val();
            settingsVersion++;
        }

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

        // Hide desktop FAB for non-admins
        const desktopFab = document.getElementById('desktop-fab');
        if(desktopFab) desktopFab.style.display = 'none';

        const adminBottomNav = document.getElementById('admin-bottom-nav');
        if(adminBottomNav) adminBottomNav.style.display = 'none';
        const userBottomNav = document.getElementById('user-bottom-nav');
        if(userBottomNav) userBottomNav.style.display = 'flex';

        document.getElementById('settings').style.display = 'none';

        // Populate User View basic info
        document.getElementById('user-name-display').innerText = `${currentUser.firstName} ${currentUser.lastName}`;
        document.getElementById('user-email-display').innerText = currentUser.email;

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
        if (sSnap.exists()) {
            settings = sSnap.val();
            settingsVersion++;
        }
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

        // Show desktop FAB for admins (CSS handles layout)
        const desktopFab = document.getElementById('desktop-fab');
        if(desktopFab) desktopFab.style.display = '';

        const adminBottomNav = document.getElementById('admin-bottom-nav');
        if(adminBottomNav) adminBottomNav.style.display = 'flex';
        const userBottomNav = document.getElementById('user-bottom-nav');
        if(userBottomNav) userBottomNav.style.display = 'none';

        document.getElementById('settings').style.display = '';
    }

    // Normalize people data
    people.forEach(person => preprocessPerson(person));

    // Check standing orders (Admin only to prevent conflicts)
    if (currentUser && currentUser.admin) {
        const updates = [];
        people.forEach(person => {
            const result = checkAndExecuteStandingOrders(person);
            if (result) {
                const newTotal = safeList(result.payments).reduce((acc, p) => acc + parseFloat(p.amount), 0);
                // Update in DB
                updates.push(update(ref(db, 'people/' + person.id), {
                    payments: result.payments,
                    standingOrders: result.standingOrders,
                    totalPaid: newTotal
                }));
                // Update in memory
                Object.assign(person, result, { totalPaid: newTotal });
            }
        });
        if (updates.length > 0) await Promise.all(updates);
    }

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
            if (req.data.receipt) {
                const safeReceipt = escapeHtml(req.data.receipt.replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
                const safeId = escapeHtml(req.id);
                details += `<div id="receipt-container-${safeId}" style="margin-top:10px;">
                    <button class="btn btn-secondary btn-small" onclick="viewRequestReceipt('${safeReceipt}', 'receipt-container-${safeId}')">📷 Beleg anzeigen</button>
                </div>`;
            }
        } else if (req.type === 'standing_order') {
            typeLabel = '🔄 Dauerauftrag';
            details = `${formatCurrency(req.data.amount)} € / Monat<br>Start: ${new Date(req.data.date).toLocaleDateString('de-DE')}`;
            if (req.data.note) details += `<br><small>"${escapeHtml(req.data.note)}"</small>`;
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
        showToast('Zuordnung gespeichert');
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
                date: req.data.date,
                receipt: req.data.receipt
            };
            const nextExpenses = [...expenses, newExpense];
            await set(ref(db, 'expenses'), nextExpenses);
            expenses = nextExpenses;
        } else if(req.type === 'standing_order') {
            await mutatePerson(req.personId, (person) => {
                const standingOrders = safeList(person.standingOrders);
                const newSO = {
                    id: Date.now().toString(),
                    amount: parseFloat(req.data.amount),
                    startDate: req.data.date,
                    note: req.data.note || 'Dauerauftrag (Genehmigt)',
                    lastAutoPayment: null
                };
                standingOrders.push(newSO);
                // Also trigger execution logic immediately
                const draftPerson = { ...person, standingOrders };
                const execResult = checkAndExecuteStandingOrders(draftPerson);
                // Calculate totalPaid from payments if updated
                if (execResult) {
                    const newTotal = safeList(execResult.payments).reduce((acc, p) => acc + parseFloat(p.amount), 0);
                    return { ...execResult, totalPaid: newTotal };
                }
                return draftPerson;
            });
        }

        await update(ref(db, 'requests/' + reqId), { status: 'approved' });
        loadData();
        showToast('Anfrage genehmigt');
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
        showToast('Anfrage abgelehnt');
    } catch (err) {
        console.error('Fehler beim Ablehnen der Anfrage:', err);
        alert('Anfrage konnte nicht abgelehnt werden. Bitte erneut versuchen.');
    }
};

function renderUserView() {
    if (people.length === 0) {
        document.getElementById('user-status-card').innerHTML = `
            <div style="text-align:center; padding: 20px; color: var(--text-secondary);">
                Kein Mitgliedseintrag gefunden.<br>Bitte kontaktieren Sie einen Administrator.
            </div>
        `;
        return;
    }

    const p = people[0]; // User has only one person (themselves)
    const { paidUntil, remainingCredit } = calculatePaymentStatus(p);
    const statusMeta = calculateTimeRemaining(p, paidUntil);
    const overdueAmount = statusMeta.isOverdue ? calculateOverdueAmount(p, paidUntil, remainingCredit) : 0;

    // Get current status (not future status)
    const currentStatus = getCurrentStatus(p);

    // Format date to show only month and year
    let dateText = paidUntil ? paidUntil.toLocaleDateString('de-DE', {month:'long', year:'numeric'}) : 'Nie';

    const statusLabels = {
        'vollverdiener': '💼 Vollverdiener',
        'geringverdiener': '📉 Geringverdiener',
        'keinverdiener': '🎓 Keinverdiener',
        'pausiert': '⏸️ Pausiert'
    };

    let statusClass = 'user-status-ok';
    let statusColor = 'var(--success)';
    let statusIcon = '✅';

    if (statusMeta.isOverdue) {
        statusClass = 'user-status-overdue';
        statusColor = 'var(--danger)';
        statusIcon = '⚠️';
    } else if (statusMeta.isSoonDue) {
        statusClass = 'user-status-soon';
        statusColor = 'var(--warning)';
        statusIcon = '⏳';
    }

    document.getElementById('user-status-card').innerHTML = `
        <!-- Status Hero Card -->
        <div class="user-hero-status ${statusClass}">
            <div style="font-size: 4rem; margin-bottom: 15px; line-height: 1;">${statusIcon}</div>
            <h2 style="color: ${statusColor}; font-size: 1.5rem; font-weight: 800; margin-bottom: 10px;">
                ${statusMeta.isOverdue ? 'Zahlung überfällig' : (statusMeta.isSoonDue ? 'Bald fällig' : 'Alles in Ordnung')}
            </h2>
            ${(statusMeta.isActiveStandingOrder && !statusMeta.isOverdue) ? '' : `<div style="font-size: 1.15rem; font-weight: 600; color: var(--text); margin-bottom: 8px;">Bezahlt bis <strong>${dateText}</strong></div>`}
            <div style="font-size: 0.95rem; opacity: 0.75; color: var(--text);">${statusMeta.text}</div>
            ${statusMeta.isOverdue ? `
                <div style="margin-top: 20px; padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <div style="font-size: 0.85rem; opacity: 0.8; margin-bottom: 5px; color: var(--danger);">Offener Betrag</div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: var(--danger);">${formatCurrency(overdueAmount)} €</div>
                </div>
            ` : ''}
        </div>
    `;

    // Combined History (Timeline)
    const timeline = generateTimelineHTML(p);
    document.getElementById('user-payment-history').innerHTML = `
        <div class="history-header">Verlauf</div>
        ${timeline}
    `;

    // User Requests List
    const myRequests = requests.filter(r => r.userId === currentUser.uid && r.status !== 'approved').sort((a,b) => b.timestamp - a.timestamp);
    const reqList = document.getElementById('user-requests-list');

    if(myRequests.length > 0) {
        reqList.innerHTML = myRequests.map(req => {
            let statusBadge, statusBg, statusText;
            if(req.status === 'rejected') {
                statusBadge = '❌';
                statusBg = '#ef444415';
                statusText = 'Abgelehnt';
            } else {
                statusBadge = '⏳';
                statusBg = '#f59e0b15';
                statusText = 'In Prüfung';
            }

            const typeIcons = { payment: '💰', status: '🔄', expense: '💸', standing_order: '🔁' };
            const typeLabels = { payment: 'Zahlung', status: 'Status', expense: 'Ausgabe', standing_order: 'Dauerauftrag' };

            let details = '';
            if(req.status === 'rejected') {
                details = `<div style="color:var(--danger); font-size:0.85rem; margin-top:8px; padding:10px; background:var(--danger)10; border-radius:8px;">⚠️ ${req.rejectionReason || 'Keine Begründung'}</div>`;
            }

            return `
                <div class="user-request-item">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 4px;">${typeIcons[req.type]} ${typeLabels[req.type] || req.type}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">${new Date(req.timestamp).toLocaleDateString('de-DE', {day:'numeric', month:'short', year:'numeric'})}</div>
                        </div>
                        <div style="background: ${statusBg}; padding: 8px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">
                            ${statusBadge} ${statusText}
                        </div>
                    </div>
                    ${details}
                </div>
            `;
        }).join('');
    } else {
        reqList.innerHTML = `
            <div style="text-align:center; padding: 30px 20px; color: var(--text-secondary); background: var(--surface); border-radius: 12px;">
                Keine offenen Anfragen
            </div>
        `;
    }
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

    // ⚡ Bolt: Calculate costly status/dates ONCE per person here
    const processed = people.map(p => {
        const { paidUntil, remainingCredit } = calculatePaymentStatus(p);
        const statusMeta = calculateTimeRemaining(p, paidUntil);
        // Only calculate overdue amount if actually overdue
        const overdueAmount = statusMeta.isOverdue ? calculateOverdueAmount(p, paidUntil, remainingCredit) : 0;
        return { p, paidUntil, statusMeta, overdueAmount };
    });

    const overdueItems = processed.filter(x => x.statusMeta.isOverdue);
    const currentItems = processed.filter(x => !x.statusMeta.isOverdue);

    overdueItems.sort((a,b) => a.p.name.localeCompare(b.p.name));
    currentItems.sort((a,b) => a.p.name.localeCompare(b.p.name));

    let overdueHtml = '';
    if(overdueItems.length > 0) {
        overdueHtml += `<h3 class="list-section-title" style="color:var(--danger)">Überfällig (${overdueItems.length})</h3>`;
        overdueHtml += overdueItems.map(item => generatePersonHTML(item.p, item)).join('');
    }

    let validHtml = '';
    if(currentItems.length > 0) {
        validHtml += `<h3 class="list-section-title" style="color:var(--success)">Aktuelle Mitglieder (${currentItems.length})</h3>`;
        validHtml += currentItems.map(item => generatePersonHTML(item.p, item)).join('');
    }

    list.innerHTML = `
        <div class="people-grid-container">
            <div class="people-column overdue-column">${overdueHtml}</div>
            <div class="people-column valid-column">${validHtml}</div>
        </div>
    `;
}

function generateTimelineHTML(person) {
    const historyList = safeList(person.statusHistory);
    const history = historyList.map(h => ({
        type: 'status',
        date: new Date(h.startDate),
        status: h.status,
        endDate: h.endDate ? new Date(h.endDate) : null
    }));

    // Find start date of current status
    let currentStatusStart;
    if (historyList.length > 0) {
        currentStatusStart = historyList[historyList.length - 1].endDate;
    } else {
        currentStatusStart = person.originalMemberSince || person.memberSince;
    }

    if (currentStatusStart) {
        history.push({
            type: 'status',
            date: new Date(currentStatusStart),
            status: person.status,
            endDate: null
        });
    }

    const payments = safeList(person.payments).map(p => ({
        type: 'payment',
        date: new Date(p.date),
        amount: p.amount,
        description: p.description
    }));

    const allEvents = [...history, ...payments].sort((a, b) => b.date - a.date);

    if (allEvents.length === 0) {
        return '<div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">Keine Einträge vorhanden.</div>';
    }

    const statusLabels = {
        'vollverdiener': '💼 Vollverdiener',
        'geringverdiener': '📉 Geringverdiener',
        'keinverdiener': '🎓 Keinverdiener',
        'pausiert': '⏸️ Pausiert'
    };

    const timelineItems = allEvents.map(event => {
        const dateStr = event.date.toLocaleDateString('de-DE');
        let content = '';
        let dotClass = 'timeline-dot';

        if (event.type === 'status') {
            const label = statusLabels[event.status] || event.status;
            content = `
                <div style="font-weight: 600;">Statusänderung: ${label}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">Gültig ab ${dateStr}</div>
            `;
        } else {
            content = `
                <div style="font-weight: 600;">Zahlung: ${formatCurrency(event.amount)}€</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(event.description) || 'Keine Notiz'} • ${dateStr}</div>
            `;
        }

        return `
            <div class="timeline-item">
                <div class="${dotClass}"></div>
                <div class="timeline-content">${content}</div>
            </div>
        `;
    }).join('');

    return `<div class="timeline">${timelineItems}</div>`;
}

function generatePersonHTML(p, preCalcData = null) {
    const paidUntil = preCalcData ? preCalcData.paidUntil : calculatePaidUntil(p);
    // Note: statusMeta in preCalcData already utilized paidUntil internally
    const statusMeta = preCalcData ? preCalcData.statusMeta : calculateTimeRemaining(p, paidUntil);
    const overdueAmount = preCalcData ? preCalcData.overdueAmount : calculateOverdueAmount(p);

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
    const standingOrders = safeList(p.standingOrders);
    const hasStandingOrder = standingOrders.length > 0;
    const soListHtml = hasStandingOrder ? `
        <div class="card" style="margin-top:15px; margin-bottom:15px; background:var(--surface-alt);">
            <div class="card-header" style="font-size:0.9rem; padding:10px 15px;">🔄 Aktive Daueraufträge</div>
            <div class="card-body" style="padding:10px 15px;">
                ${standingOrders.map(so => {
                    const isEnded = so.endDate && new Date(so.endDate) < new Date();
                    const style = isEnded ? 'opacity:0.6;' : '';
                    return `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px; ${style}">
                        <div>
                            <div style="font-size:0.9rem; font-weight:600;">${formatCurrency(so.amount)} € / Monat</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">${escapeHtml(so.note || 'Ohne Notiz')}</div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
                                Start: ${new Date(so.startDate).toLocaleDateString('de-DE')}
                                ${so.endDate ? `<br>Ende: ${new Date(so.endDate).toLocaleDateString('de-DE')}` : ''}
                            </div>
                        </div>
                        ${(true) ? `
                        <button class="btn-icon text-danger" onclick="openEndStandingOrderModal('${p.id}', '${so.id}')" title="Bearbeiten/Beenden" style="background:none; border:none; padding:4px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        ` : ''}
                    </div>
                    `;
                }).join('<hr style="margin:8px 0; border:0; border-top:1px solid var(--border);">')}
            </div>
        </div>
    ` : '';

    return `
        <div class="person-wrapper">
            <div id="person-item-${p.id}" class="person-item" role="button" tabindex="0" aria-expanded="false" onclick="toggleDetails('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); toggleDetails('${p.id}');}">
                <div class="person-pill">
                    <div class="person-left">
                        <div class="person-name">
                            ${escapeHtml(p.name)}
                            <span class="chevron">›</span>
                        </div>
                        <span class="person-status">${currentStatus}</span>
                    </div>
                    <div class="person-right">
                        ${(statusMeta.isActiveStandingOrder && !statusMeta.isOverdue) ? '' : `<span class="payment-pill ${pillClass}">${dateText}</span>`}
                        <span class="time-remaining">${statusMeta.text}</span>
                    </div>
                </div>
            </div>
            <div id="drawer-${p.id}" class="person-details">
                <div class="details-content">

                    <div class="details-status-card ${cardClass}">
                        ${(statusMeta.isActiveStandingOrder && !statusMeta.isOverdue) ? '' : `
                        <div class="details-row">
                            <span class="details-label">Bezahlt bis</span>
                            <span class="details-value">${dateText}</span>
                        </div>`}
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

                    ${soListHtml}

                    <div class="details-actions" style="${(currentUser && !currentUser.admin) ? 'display:none' : ''}">
                        <button class="btn btn-primary" onclick="openPaymentModal('${p.id}')">💰 Zahlung</button>
                        <button class="btn btn-secondary" onclick="openChangeStatusModal('${p.id}')">🔄 Status</button>
                    </div>

                    <div class="history-header">Verlauf</div>
                    ${generateTimelineHTML(p)}
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

    chartDataCache = null;
    renderBalanceChart();
}

function renderBalanceChart() {
    const canvas = document.getElementById('balanceChart');
    if (!canvas || canvas.offsetParent === null) return; // Don't render if hidden

    // Responsive Canvas
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!chartDataCache) {
        // ⚡ Bolt: Optimized Data Collection (O(N) vs O(N log N))
        // Avoids creating Date objects for every transaction and sorting them.

        // 1. Determine Cutoff Date
        const today = new Date();
        today.setHours(0,0,0,0);

        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(today.getDate() - 90);

        // Create comparable string (YYYY-MM-DD) from ninetyDaysAgo
        // Note: We use local year/month/day to match the input date strings
        const cutoffY = ninetyDaysAgo.getFullYear();
        const cutoffM = String(ninetyDaysAgo.getMonth() + 1).padStart(2, '0');
        const cutoffD = String(ninetyDaysAgo.getDate()).padStart(2, '0');
        const cutoffStr = `${cutoffY}-${cutoffM}-${cutoffD}`;

        let currentBalance = 0;
        const eventsByDay = {};

        // 2. Single Pass Aggregation
        // Helper to process amount/date pairs
        const processEvent = (amount, dateStr) => {
            if (!dateStr) return; // Skip if no date

            // String comparison works for ISO dates (YYYY-MM-DD)
            if (dateStr < cutoffStr) {
                currentBalance += amount;
            } else {
                // Aggregate for chart
                eventsByDay[dateStr] = (eventsByDay[dateStr] || 0) + amount;
            }
        };

        people.forEach(p => {
            safeList(p.payments).forEach(pay => {
                processEvent(parseFloat(pay.amount), pay.date);
            });
        });
        donations.forEach(d => {
            processEvent(parseFloat(d.amount), d.date);
        });
        expenses.forEach(e => {
            processEvent(-parseFloat(e.amount), e.date);
        });

        // 3. Generate Data Points
        const dataPoints = [];
        let minVal = currentBalance;
        let maxVal = currentBalance;

        for (let i = 0; i <= 90; i++) {
            const d = new Date(ninetyDaysAgo);
            d.setDate(d.getDate() + i);

            // Generate lookup key (Local YYYY-MM-DD)
            const dY = d.getFullYear();
            const dM = String(d.getMonth() + 1).padStart(2, '0');
            const dD = String(d.getDate()).padStart(2, '0');
            const dayStr = `${dY}-${dM}-${dD}`;

            if (eventsByDay[dayStr]) {
                currentBalance += eventsByDay[dayStr];
            }

            dataPoints.push({ x: i, y: currentBalance, date: d });

            if (currentBalance < minVal) minVal = currentBalance;
            if (currentBalance > maxVal) maxVal = currentBalance;
        }

        chartDataCache = { dataPoints, minVal, maxVal };
    }

    const { dataPoints, minVal, maxVal } = chartDataCache;

    // Palette: Accessible Chart Description
    if (dataPoints && dataPoints.length > 0) {
        const startBalance = formatCurrency(dataPoints[0].y);
        const endBalance = formatCurrency(dataPoints[dataPoints.length - 1].y);
        canvas.setAttribute('aria-label', `Kontostandsverlauf über 90 Tage. Start: ${startBalance} Euro. Aktuell: ${endBalance} Euro.`);
    }

    // 3. Drawing
    // Margins
    const padTop = 20;
    const padBottom = 20;
    const padLeft = 10;
    const padRight = 10;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    // Scale
    const range = maxVal - minVal;
    // Avoid division by zero
    const safeRange = range === 0 ? 1 : range;

    const getX = (i) => padLeft + (i / 90) * plotWidth;
    const getY = (val) => padTop + plotHeight - ((val - minVal) / safeRange) * plotHeight;

    // Draw Gradient Area
    const grad = ctx.createLinearGradient(0, padTop, 0, height - padBottom);
    grad.addColorStop(0, "rgba(6, 182, 212, 0.2)");
    grad.addColorStop(1, "rgba(6, 182, 212, 0.0)");

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(dataPoints[0].y));

    for (let i = 1; i < dataPoints.length; i++) {
        ctx.lineTo(getX(i), getY(dataPoints[i].y));
    }

    ctx.lineTo(getX(90), height - padBottom);
    ctx.lineTo(getX(0), height - padBottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw Line
    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#06b6d4';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(getX(0), getY(dataPoints[0].y));
    for (let i = 1; i < dataPoints.length; i++) {
        ctx.lineTo(getX(i), getY(dataPoints[i].y));
    }
    ctx.stroke();

    // Draw Start/End labels (Dates)
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dataPoints[0].date.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'}), padLeft, height - 5);

    ctx.textAlign = 'right';
    ctx.fillText(dataPoints[90].date.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'}), width - padRight, height - 5);
}

// Re-render chart on resize
window.addEventListener('resize', () => {
    requestAnimationFrame(renderBalanceChart);
});

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
            const hasReceipt = t.receipt ? '<span style="margin-left:5px" title="Beleg vorhanden">📷</span>' : '';
            return `
                <div class="trans-item" role="button" tabindex="0" onclick="showTransactionDetails('${t.id}', '${t.type}')" onkeydown="if(event.key==='Enter'||event.key===' '){showTransactionDetails('${t.id}', '${t.type}')}" style="cursor:pointer;">
                    <div class="trans-left">
                        <span style="font-weight:600;">${icon} ${t.who}</span>
                        <div class="trans-meta">${t.description || '-'} ${hasReceipt} • ${t.date ? new Date(t.date).toLocaleDateString('de-DE') : 'Kein Datum'}</div>
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
        showToast('Person hinzugefügt');
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
    const isStandingOrder = document.getElementById('payment-is-standing-order').checked;

    if(!currentPersonId || isNaN(amt)) {
        setButtonLoading('btn-add-payment', false);
        return;
    }

    try {
        const updated = await mutatePerson(currentPersonId, (person) => {
            if (isStandingOrder) {
                const standingOrders = safeList(person.standingOrders);
                const newSO = {
                    id: Date.now().toString(),
                    amount: amt,
                    startDate: date,
                    note: desc,
                    lastAutoPayment: null
                };
                standingOrders.push(newSO);
                // Also trigger execution logic immediately
                const draftPerson = { ...person, standingOrders };
                const execResult = checkAndExecuteStandingOrders(draftPerson);
                // Calculate totalPaid from payments if updated
                if (execResult) {
                    const newTotal = safeList(execResult.payments).reduce((acc, p) => acc + parseFloat(p.amount), 0);
                    return { ...execResult, totalPaid: newTotal };
                }
                return draftPerson;
            } else {
                const payments = safeList(person.payments);
                payments.push({ amount: amt, date, description: desc, id: Date.now() });
                const totalPaid = (person.totalPaid || 0) + amt;
                return { ...person, payments, totalPaid };
            }
        });

        if (!updated) {
            alert('Person nicht gefunden.');
            return;
        }

        renderAll();
        closeModal('add-payment-modal');
        document.getElementById('payment-is-standing-order').checked = false;
        const lbl = document.getElementById('payment-date-label');
        if(lbl) lbl.innerText = 'Datum';
        showToast('Zahlung gebucht');
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
        showToast('Spende gespeichert');
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

    const issuer = document.getElementById('expense-issuer').value;
    const date = document.getElementById('expense-date').value;
    const desc = document.getElementById('expense-desc').value;

    let receiptFilename = null;
    const fileInput = document.getElementById('expense-receipt');
    if (fileInput && fileInput.files.length > 0) {
        try {
            setButtonLoading('btn-add-expense', true, "Lade hoch...");
            receiptFilename = await uploadReceipt(fileInput.files[0], issuer, date);
        } catch (err) {
            console.error(err);
            alert("Fehler beim Hochladen des Belegs: " + err.message);
            setButtonLoading('btn-add-expense', false);
            return;
        }
    }

    const newExpense = {
        amount: amt,
        issuer: issuer,
        description: desc,
        date: date,
        id: Date.now(),
        receipt: receiptFilename
    };
    const nextExpenses = [...expenses, newExpense];
    try {
        await set(ref(db, 'expenses'), { ...nextExpenses });
        expenses = nextExpenses;
        renderAll();
        closeModal('add-expense-modal');
        document.getElementById('expense-amount').value = '';
        document.getElementById('expense-issuer').value = '';
        document.getElementById('expense-desc').value = '';
        if(fileInput) fileInput.value = '';
        showToast('Ausgabe gespeichert');
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
            showToast('Person gelöscht');
        } catch (err) {
            console.error('Fehler beim Löschen der Person:', err);
            alert('Löschen fehlgeschlagen. Bitte erneut versuchen.');
        }
    }
};

let editingSoId = null;
let editingPersonId = null;

window.openEndStandingOrderModal = (personId, soId) => {
    editingPersonId = personId;
    editingSoId = soId;

    // Find SO to set default date?
    const person = people.find(p => String(p.id) === String(personId));
    if (person) {
        const so = safeList(person.standingOrders).find(s => String(s.id) === String(soId));
        if (so && so.endDate) {
            document.getElementById('end-so-date').value = so.endDate;
        } else {
            document.getElementById('end-so-date').value = new Date().toISOString().split('T')[0];
        }
    }

    openModal('end-standing-order-modal');
};

window.saveStandingOrderEnd = async () => {
    if (!editingPersonId || !editingSoId) return;

    const endDate = document.getElementById('end-so-date').value;
    if (!endDate) { alert("Bitte Datum wählen"); return; }

    try {
        const updated = await mutatePerson(editingPersonId, (person) => {
            const endDateObj = new Date(endDate);
            endDateObj.setHours(23, 59, 59, 999);
            const today = new Date();

            // 1. Update SO end date
            let standingOrders = safeList(person.standingOrders).map(so => {
                if (String(so.id) === String(editingSoId)) {
                    return { ...so, endDate };
                }
                return so;
            });

            // 2. Remove future auto-payments related to this SO
            const payments = safeList(person.payments).filter(p => {
                if (p.isAuto && p.id.startsWith(`auto_${editingSoId}_`)) {
                    const pDate = new Date(p.date);
                    if (pDate > endDateObj) {
                        return false;
                    }
                }
                return true;
            });

            // 3. Remove SO if expired (delete itself after end date)
            if (endDateObj < today) {
                 standingOrders = standingOrders.filter(so => String(so.id) !== String(editingSoId));
            }

            const totalPaid = payments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
            return { ...person, standingOrders, payments, totalPaid };
        });

        renderAll();
        closeModal('end-standing-order-modal');
        showToast('Dauerauftrag aktualisiert');
    } catch (err) {
        console.error('Fehler beim Beenden:', err);
        alert('Fehler beim Speichern.');
    }
};

window.deleteStandingOrderCompletely = async () => {
    if (!confirm("Dauerauftrag wirklich komplett entfernen? Historie geht verloren.")) return;

    try {
        await mutatePerson(editingPersonId, (person) => {
            const standingOrders = safeList(person.standingOrders).filter(so => String(so.id) !== String(editingSoId));
            return { ...person, standingOrders };
        });
        renderAll();
        closeModal('end-standing-order-modal');
        showToast('Dauerauftrag gelöscht');
    } catch (err) {
        console.error('Fehler beim Löschen:', err);
        alert('Fehler beim Löschen.');
    }
};

window.deleteStandingOrder = async (personId, soId) => {
    // Legacy mapping or just redirect
    openEndStandingOrderModal(personId, soId);
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
        showToast('Status geändert');
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
    settingsVersion++;
    try {
        await set(ref(db, 'settings'), settings);
        renderAll();
        showToast("Einstellungen gespeichert");
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
            showToast("Passwort erfolgreich geändert");
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
    // ⚡ Bolt: Ensure data is optimized before storing
    preprocessPerson(person);
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
            <div class="form-group" style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" id="req-is-standing-order" style="width:20px; height:20px;" onchange="document.getElementById('req-date-label').innerText = this.checked ? 'Startdatum' : 'Datum'">
                <label for="req-is-standing-order" style="margin:0; font-weight:600; cursor:pointer">Dauerauftrag</label>
            </div>
            <div class="form-group">
                <label class="form-label" for="req-amount">Betrag (€)</label>
                <input type="text" inputmode="decimal" id="req-amount" class="form-input">
            </div>
            <div class="form-group">
                <label class="form-label" id="req-date-label" for="req-date">Datum</label>
                <input type="date" id="req-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
                <label class="form-label" for="req-note">Notiz (Optional)</label>
                <input type="text" id="req-note" class="form-input">
            </div>
        `;
    } else if(type === 'status') {
        title.innerText = "Statusänderung beantragen";
        container.innerHTML = `
            <div class="form-group">
                <label class="form-label" for="req-status">Neuer Status</label>
                <select id="req-status" class="form-select">
                    <option value="vollverdiener">💼 Vollverdiener</option>
                    <option value="geringverdiener">📉 Geringverdiener</option>
                    <option value="keinverdiener">🎓 Keinverdiener</option>
                    <option value="pausiert">⏸️ Pausiert</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="req-date">Gültig ab</label>
                <input type="date" id="req-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
        `;
    } else if(type === 'expense') {
        title.innerText = "Ausgabe melden";
        container.innerHTML = `
            <div class="form-group">
                <label class="form-label" for="req-amount">Betrag (€)</label>
                <input type="text" inputmode="decimal" id="req-amount" class="form-input">
            </div>
            <div class="form-group">
                <label class="form-label" for="req-desc">Beschreibung</label>
                <input type="text" id="req-desc" class="form-input">
            </div>
            <div class="form-group">
                <label class="form-label" for="req-date">Datum</label>
                <input type="date" id="req-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
                <label class="form-label" for="req-receipt">Beleg (Optional)</label>
                <input type="file" id="req-receipt" accept="image/*" class="form-input">
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
        const isStandingOrder = document.getElementById('req-is-standing-order') && document.getElementById('req-is-standing-order').checked;

        if(!amount || !date) { alert("Bitte alle Felder ausfüllen"); return; }
        if(isNaN(parseFloat(amount))) { alert("Ungültiger Betrag"); return; }

        reqData.amount = amount;
        reqData.date = date;
        reqData.note = note;

        if (isStandingOrder) {
            currentRequestType = 'standing_order';
        }
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

        const fileInput = document.getElementById('req-receipt');
        if (fileInput && fileInput.files.length > 0) {
             setButtonLoading('btn-submit-request', true, "Lade hoch...");
             try {
                reqData.receipt = await uploadReceipt(fileInput.files[0], person.name, date);
             } catch(err) {
                 alert("Fehler beim Hochladen: " + err.message);
                 setButtonLoading('btn-submit-request', false);
                 return;
             }
        }
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
        showToast("Anfrage erfolgreich gesendet");
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

// --- Node.js Backend Receipt Handling ---

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

window.uploadReceipt = async function(file, transactionName, transactionDate) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    // Grab the active user's Firebase token to prove their identity
    const token = await user.getIdToken();
    const formData = new FormData();

    // 1. Append text fields FIRST
    if (transactionName) formData.append('name', transactionName);
    if (transactionDate) formData.append('date', transactionDate);

    // 2. Append the file LAST
    formData.append('receipt', file);

    // Replace with your UNRAID server's IP address
    const url = `https://api.lehn.site/api/upload`;

    try {
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed: ' + response.statusText);
        }

        const data = await response.json();
        return data.filename;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
};


window.fetchReceiptImage = async function(filename) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const token = await user.getIdToken();
    // Replace with your UNRAID server's IP address
    const url = `https://api.lehn.site/api/receipts/${encodeURIComponent(filename)}`;

    try {
        const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Fetch failed: ' + response.statusText);
        }

        // Convert the returned file into an object URL for the <img> tag
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('Fetch image error:', error);
        throw error;
    }
};

window.viewRequestReceipt = async function(filename, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Revoke previous URL if any
    if (container.dataset.blobUrl) {
        URL.revokeObjectURL(container.dataset.blobUrl);
        delete container.dataset.blobUrl;
    }

    container.innerHTML = '<div class="spinner" style="margin:10px auto;"></div><div style="text-align:center; font-size:0.8rem; color:var(--text-secondary);">Lade Beleg...</div>';

    try {
        const imgUrl = await fetchReceiptImage(filename);
        container.dataset.blobUrl = imgUrl;
        container.innerHTML = `
            <img src="${imgUrl}" style="width:100%; max-width:100%; border-radius:8px; border:1px solid var(--border); margin-top:10px;" alt="Beleg">
        `;
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="color:var(--danger); font-size:0.8rem; margin-top:10px;">Fehler beim Laden des Belegs.</div>`;
    }
};

window.findTransaction = function(id, type) {
    if (type === 'exp') {
        const e = expenses.find(x => String(x.id) === String(id));
        return e ? { ...e, typeName: 'Ausgabe' } : null;
    } else if (type === 'don') {
        const d = donations.find(x => String(x.id) === String(id));
        return d ? { ...d, typeName: 'Spende', who: d.name } : null;
    } else if (type === 'pay') {
        for (const p of people) {
            const pay = safeList(p.payments).find(x => String(x.id) === String(id));
            if (pay) return { ...pay, typeName: 'Zahlung', who: p.name };
        }
    }
    return null;
};

window.showTransactionDetails = async function(id, type) {
    const item = window.findTransaction(id, type);
    if (!item) return;

    closeModal('transaction-modal'); // Hide the list
    openModal('transaction-details-modal');
    const content = document.getElementById('transaction-details-content');

    // Revoke previous URL if any
    if (content.dataset.blobUrl) {
         URL.revokeObjectURL(content.dataset.blobUrl);
         delete content.dataset.blobUrl;
    }

    content.innerHTML = '<div class="spinner" style="margin:20px auto;"></div><div style="text-align:center">Lade Details...</div>';

    let html = `
        <div style="text-align:center; margin-bottom:20px;">
            <div style="font-size:2rem; font-weight:800;">${formatCurrency(item.amount)} €</div>
            <div style="color:var(--text-secondary);">${item.typeName}</div>
        </div>
        <div class="details-status-card" style="background:var(--surface-alt); border:1px solid var(--border);">
            <div class="details-row">
                <span class="details-label">Datum</span>
                <span class="details-value">${item.date ? new Date(item.date).toLocaleDateString('de-DE') : '-'}</span>
            </div>
            ${item.who ? `
            <div class="details-row">
                <span class="details-label">Person</span>
                <span class="details-value">${escapeHtml(item.who)}</span>
            </div>` : ''}
             ${item.issuer ? `
            <div class="details-row">
                <span class="details-label">Ausgestellt von</span>
                <span class="details-value">${escapeHtml(item.issuer)}</span>
            </div>` : ''}
            <div class="details-row">
                <span class="details-label">Beschreibung</span>
                <span class="details-value">${escapeHtml(item.description || item.note || '-')}</span>
            </div>
        </div>
    `;

    if (item.receipt) {
        try {
            const imgUrl = await fetchReceiptImage(item.receipt);
            content.dataset.blobUrl = imgUrl;

            html += `
                <div style="margin-top:20px;">
                    <div style="font-weight:600; margin-bottom:10px;">Beleg</div>
                    <img src="${imgUrl}" style="width:100%; border-radius:12px; border:1px solid var(--border);" alt="Beleg">
                </div>
            `;
        } catch (err) {
            html += `<div style="color:var(--danger); margin-top:20px; text-align:center;">Beleg konnte nicht geladen werden.</div>`;
        }
    } else {
        html += `<div style="margin-top:20px; color:var(--text-secondary); text-align:center; font-size:0.9rem;">Kein Beleg vorhanden.</div>`;
    }

    content.innerHTML = html;
};

// --- PWA Install Logic ---
let deferredPrompt;
const installBtn = document.getElementById('install-pwa-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    if (installBtn) {
        installBtn.style.display = 'inline-flex';
    }
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        // Hide the app provided install promotion
        installBtn.style.display = 'none';
        // Show the install prompt
        if (deferredPrompt) {
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // We've used the prompt, and can't use it again, throw it away
            deferredPrompt = null;
        }
    });
}

window.addEventListener('appinstalled', () => {
    // Hide the app-provided install promotion
    if (installBtn) installBtn.style.display = 'none';
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    console.log('PWA was installed');
});

let toastTimeout;
window.showToast = (msg, type='success') => {
    let t = document.getElementById('toast');
    if(!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.setAttribute('role', 'status');
        t.setAttribute('aria-live', 'polite');
        document.body.appendChild(t);
    }
    t.className = `toast toast-${type} show`;
    t.innerHTML = `${type==='success'?'✅':'⚠️'} ${msg}`;

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => t.classList.remove('show'), 3000);
};

window.copyInviteCode = async () => {
    const codeInput = document.getElementById('admin-invite-code');
    if (!codeInput || !codeInput.value) return;

    try {
        await navigator.clipboard.writeText(codeInput.value);
        showToast("Code kopiert!");
    } catch (err) {
        console.error("Copy failed", err);
        showToast("Kopieren fehlgeschlagen", "error");
    }
};

// Password Toggle
window.togglePassword = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const eyeOff = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    const eye = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    btn.innerHTML = isPassword ? eyeOff : eye;
    btn.setAttribute('aria-label', isPassword ? 'Passwort verbergen' : 'Passwort anzeigen');
};
