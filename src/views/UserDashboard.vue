<template>
  <div class="container">
    <header class="header">
        <img src="/assets/bgb-logo.svg" alt="JuBa-Kasse Logo">
        <h1>JuBa-Kasse</h1>
    </header>

    <div v-if="activeTab === 'user-overview'">
        <div class="hero-card" style="cursor:default;">
            <span class="hero-label">Willkommen</span>
            <div class="hero-amount">{{ store.user?.firstName }} {{ store.user?.lastName }}</div>
            <div class="hero-subtitle">{{ store.user?.email }}</div>
        </div>

        <div v-if="!store.currentUserPerson" style="text-align:center; padding: 20px; color: var(--text-secondary);">
            Kein Mitgliedseintrag gefunden.<br>Bitte kontaktieren Sie einen Administrator.
        </div>

        <div v-else>
            <!-- Status Card -->
            <div class="user-hero-status" :class="statusClass">
                <div style="font-size: 4rem; margin-bottom: 15px; line-height: 1;">{{ statusIcon }}</div>
                <h2 :style="{color: statusColor, fontSize: '1.5rem', fontWeight: 800, marginBottom: '10px'}">
                    {{ statusMeta.isOverdue ? 'Zahlung überfällig' : (statusMeta.isSoonDue ? 'Bald fällig' : 'Alles in Ordnung') }}
                </h2>
                <div v-if="!statusMeta.isActiveStandingOrder" style="font-size: 1.15rem; font-weight: 600; color: var(--text); margin-bottom: 8px;">
                    Bezahlt bis <strong>{{ dateText }}</strong>
                </div>
                <div style="font-size: 0.95rem; opacity: 0.75; color: var(--text);">{{ statusMeta.text }}</div>

                <div v-if="statusMeta.isOverdue" style="margin-top: 20px; padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <div style="font-size: 0.85rem; opacity: 0.8; margin-bottom: 5px; color: var(--danger);">Offener Betrag</div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: var(--danger);">{{ formatCurrency(overdueAmount) }} €</div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div style="margin-top: 25px;">
                <h3 class="list-section-title">⚡ Schnellaktionen</h3>
                <div class="user-quick-actions-grid">
                    <button class="btn btn-secondary user-action-btn" @click="openRequest('payment')">
                        <div class="user-action-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                        </div>
                        <div class="user-action-label">Zahlung</div>
                    </button>
                    <button class="btn btn-secondary user-action-btn" @click="openRequest('status')">
                        <div class="user-action-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        </div>
                        <div class="user-action-label">Status</div>
                    </button>
                    <button class="btn btn-secondary user-action-btn" @click="openRequest('expense')">
                        <div class="user-action-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        </div>
                        <div class="user-action-label">Ausgabe</div>
                    </button>
                </div>
            </div>

            <!-- Payment History -->
            <div style="margin-top: 25px;">
                <h3 class="list-section-title">Verlauf</h3>
                <TransactionList :person="store.currentUserPerson" />
            </div>

             <!-- Requests List -->
            <div style="margin-top: 25px;">
                <h3 class="list-section-title">📨 Meine Anfragen</h3>
                <div v-if="myRequests.length === 0" style="text-align:center; padding: 30px 20px; color: var(--text-secondary); background: var(--surface); border-radius: 12px;">
                    Keine offenen Anfragen
                </div>
                <div v-else>
                     <div v-for="req in myRequests" :key="req.id" class="user-request-item">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <div>
                                <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 4px;">{{ getRequestTypeLabel(req.type) }}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary);">{{ new Date(req.timestamp).toLocaleDateString('de-DE') }}</div>
                            </div>
                            <div :style="{background: req.status === 'rejected' ? '#ef444415' : '#f59e0b15', padding: '8px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600', whiteSpace: 'nowrap'}">
                                {{ req.status === 'rejected' ? '❌ Abgelehnt' : '⏳ In Prüfung' }}
                            </div>
                        </div>
                        <div v-if="req.status === 'rejected'" style="color:var(--danger); font-size:0.85rem; margin-top:8px; padding:10px; background:var(--danger)10; border-radius:8px;">⚠️ {{ req.rejectionReason }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div v-else-if="activeTab === 'user-settings'">
        <div class="card">
            <div class="card-header">⚙️ Einstellungen</div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Farbschema</label>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-secondary" @click="setTheme('light')">☀️ Hell</button>
                        <button class="btn btn-secondary" @click="setTheme('dark')">🌙 Dunkel</button>
                    </div>
                </div>
                <div class="form-group" style="margin-top:20px;">
                    <label class="form-label">Passwort ändern</label>
                    <input type="password" v-model="newPassword" class="form-input" placeholder="Neues Passwort">
                </div>
                <button class="btn btn-secondary" @click="changePassword">Passwort ändern</button>
            </div>
        </div>

        <button class="btn btn-danger" @click="logout" style="width:100%; margin-top: 20px;">🚪 Abmelden</button>
    </div>

    <!-- Modals -->
    <UserRequestModal v-if="showRequestModal" :type="requestType" @close="showRequestModal = false" />

    <nav class="bottom-nav">
        <button class="nav-item" :class="{active: activeTab === 'user-overview'}" @click="activeTab = 'user-overview'">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>Übersicht</span>
        </button>
        <button class="nav-item" :class="{active: activeTab === 'user-settings'}" @click="activeTab = 'user-settings'">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>Einstellungen</span>
        </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/app';
import { useRouter } from 'vue-router';
import TransactionList from '../components/TransactionList.vue';
import UserRequestModal from '../components/modals/UserRequestModal.vue';
import { calculatePaymentStatus, calculateTimeRemaining, calculateOverdueAmount, calculatePaidUntil } from '../utils/calculations';
import { formatCurrency } from '../utils/helpers';

const store = useAppStore();
const router = useRouter();
const activeTab = ref('user-overview');
const showRequestModal = ref(false);
const requestType = ref('');
const newPassword = ref('');

const myRequests = computed(() => store.requests.filter(r => r.userId === store.user.uid && r.status !== 'approved').sort((a,b) => b.timestamp - a.timestamp));

// Calculations
const paidUntil = computed(() => store.currentUserPerson ? calculatePaidUntil(store.currentUserPerson, store.settings) : null);
const statusMeta = computed(() => store.currentUserPerson ? calculateTimeRemaining(store.currentUserPerson, store.settings, paidUntil.value) : {});
const overdueAmount = computed(() => {
    if (!store.currentUserPerson || !statusMeta.value.isOverdue) return 0;
    const { remainingCredit } = calculatePaymentStatus(store.currentUserPerson, store.settings);
    return calculateOverdueAmount(store.currentUserPerson, store.settings, paidUntil.value, remainingCredit);
});

const dateText = computed(() => paidUntil.value ? paidUntil.value.toLocaleDateString('de-DE', {month:'long', year:'numeric'}) : 'Nie');

const statusClass = computed(() => {
    if (statusMeta.value.isOverdue) return 'user-status-overdue';
    if (statusMeta.value.isSoonDue) return 'user-status-soon';
    return 'user-status-ok';
});

const statusColor = computed(() => {
    if (statusMeta.value.isOverdue) return 'var(--danger)';
    if (statusMeta.value.isSoonDue) return 'var(--warning)';
    return 'var(--success)';
});

const statusIcon = computed(() => {
    if (statusMeta.value.isOverdue) return '⚠️';
    if (statusMeta.value.isSoonDue) return '⏳';
    return '✅';
});

const getRequestTypeLabel = (type) => {
    const map = { payment: '💰 Zahlung', status: '🔄 Status', expense: '💸 Ausgabe', standing_order: '🔄 Dauerauftrag' };
    return map[type] || type;
};

const openRequest = (type) => {
    requestType.value = type;
    showRequestModal.value = true;
};

const setTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('juba-theme', t);
};

const changePassword = async () => {
    if (newPassword.value.length < 6) return alert("Passwort zu kurz");
    try {
        await store.changePassword(newPassword.value);
        alert("Passwort geändert");
        newPassword.value = '';
    } catch(e) {
        alert(e.message);
    }
};

const logout = async () => {
    await store.logout();
    router.push('/login');
};
</script>
