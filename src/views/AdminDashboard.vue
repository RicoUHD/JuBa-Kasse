<template>
  <div class="container">
    <header class="header">
        <img src="/assets/bgb-logo.svg" alt="JuBa-Kasse Logo">
        <h1>JuBa-Kasse</h1>
    </header>

    <div v-if="activeTab === 'overview'">
        <!-- Stats -->
        <StatsCard />

        <div class="overview-right">
            <!-- Requests Inline -->
            <div v-if="pendingRequests.length > 0" class="card">
                <div class="card-header">📥 Offene Anfragen ({{ pendingRequests.length }})</div>
                <div class="card-body">
                    <!-- Request Items -->
                     <div v-for="req in pendingRequests" :key="req.id" style="background: var(--surface-alt); border: 1px solid var(--border); border-radius: 14px; padding: 12px; margin: 8px 0;">
                        <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:8px; align-items:flex-start;">
                            <span style="font-weight:800;">{{ getRequestTypeLabel(req.type) }}</span>
                            <span style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap;">{{ new Date(req.timestamp).toLocaleString() }}</span>
                        </div>
                        <div style="margin-bottom:10px;">{{ req.personName }}: {{ req.data.note || req.data.description || req.data.newStatus || 'Keine Details' }}</div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button class="btn btn-primary btn-small" style="width:auto;" @click="approveRequest(req.id)">Genehmigen</button>
                            <button class="btn btn-danger btn-small" style="width:auto;" @click="rejectRequest(req.id)">Ablehnen</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Unlinked Users -->
            <div v-if="unlinkedUsers.length > 0" class="card">
                <div class="card-header">🧩 Nicht zugeordnete Benutzer ({{ unlinkedUsers.length }})</div>
                <div class="card-body">
                    <div v-for="u in unlinkedUsers" :key="u.uid" style="display:flex; gap:10px; align-items:center; margin-bottom:10px; flex-wrap:wrap;">
                        <div style="flex:1; min-width:200px;">
                            <div style="font-weight:700;">{{ u.firstName }} {{ u.lastName }}</div>
                            <div style="font-size:0.85rem; color:var(--text-secondary);">{{ u.email }}</div>
                        </div>
                        <select :value="selectedPersonForUser[u.uid] || ''" @change="e => selectedPersonForUser[u.uid] = e.target.value" class="form-select" style="flex:1; min-width:220px;">
                            <option value="">Person auswählen</option>
                            <option v-for="p in availablePeople" :key="p.id" :value="p.id">{{ p.name }}</option>
                        </select>
                        <button class="btn btn-primary btn-small" style="width:auto;" @click="assignUser(u.uid)">Zuordnen</button>
                    </div>
                </div>
            </div>

            <PersonList />
        </div>
    </div>

    <div v-else-if="activeTab === 'settings'">
        <!-- Settings Cards -->
        <div class="card card-settings">
            <div class="card-header">Design</div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Farbschema</label>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-secondary" @click="setTheme('light')">☀️ Hell</button>
                        <button class="btn btn-secondary" @click="setTheme('dark')">🌙 Dunkel</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="card card-settings">
            <div class="card-header">Monatliche Beiträge</div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Vollverdiener (€)</label>
                    <input type="number" v-model.number="settings.vollverdiener" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Geringverdiener (€)</label>
                    <input type="number" v-model.number="settings.geringverdiener" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Keinverdiener (€)</label>
                    <input type="number" v-model.number="settings.keinverdiener" class="form-input">
                </div>
            </div>
        </div>

        <div class="card card-settings">
            <div class="card-header">Berichtszeitraum</div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Startdatum für Berechnung</label>
                    <input type="date" v-model="settings.reportStartDate" class="form-input">
                </div>
            </div>
        </div>

        <div class="card card-settings">
            <div class="card-header">Registrierungscode</div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Aktueller Code</label>
                    <div style="display:flex; gap:10px;">
                        <input type="text" :value="store.inviteCode" class="form-input" readonly>
                        <button class="btn btn-secondary" @click="store.generateNewInviteCode()">Neu</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="card card-settings">
            <div class="card-header">Sicherheit</div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Passwort ändern</label>
                    <input type="password" v-model="newPassword" class="form-input" placeholder="Neues Passwort">
                </div>
                <button class="btn btn-secondary" @click="changePassword">Passwort ändern</button>
            </div>
        </div>

        <button class="btn btn-primary" @click="saveSettings" style="margin-bottom:30px;">Alle Einstellungen Speichern</button>
        <button class="btn btn-danger" @click="logout" style="margin-bottom:30px;">Abmelden</button>
    </div>

    <!-- Modals -->
    <AddPersonModal v-if="showAddPerson" @close="showAddPerson = false" />
    <AddDonationModal v-if="showAddDonation" @close="showAddDonation = false" />
    <AddExpenseModal v-if="showAddExpense" @close="showAddExpense = false" />
    <TransactionListModal v-if="showTransactions" @close="showTransactions = false" />

    <Navbar
        :activeTab="activeTab"
        @switch="activeTab = $event"
        @openAddPerson="showAddPerson = true"
        @openAddDonation="showAddDonation = true"
        @openAddExpense="showAddExpense = true"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/app';
import { useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import StatsCard from '../components/StatsCard.vue';
import PersonList from '../components/PersonList.vue';
import AddPersonModal from '../components/modals/AddPersonModal.vue';
import AddDonationModal from '../components/modals/AddDonationModal.vue';
import AddExpenseModal from '../components/modals/AddExpenseModal.vue';
import TransactionListModal from '../components/modals/TransactionListModal.vue'; // New component for transaction list modal

const store = useAppStore();
const router = useRouter();

const activeTab = ref('overview');
const newPassword = ref('');
const selectedPersonForUser = ref({});

const settings = ref({ ...store.settings });

// Modals State
const showAddPerson = ref(false);
const showAddDonation = ref(false);
const showAddExpense = ref(false);
const showTransactions = ref(false);

const pendingRequests = computed(() => store.requests.filter(r => r.status === 'pending'));
const unlinkedUsers = computed(() => store.users.filter(u => !store.people.some(p => p.uid === u.uid)));
const availablePeople = computed(() => store.people.filter(p => !p.uid));

const getRequestTypeLabel = (type) => {
    const map = { payment: '💰 Zahlung', status: '🔄 Status', expense: '💸 Ausgabe', standing_order: '🔄 Dauerauftrag' };
    return map[type] || type;
};

const approveRequest = async (id) => {
    await store.approveRequest(id);
};

const rejectRequest = async (id) => {
    const reason = prompt("Grund für Ablehnung:");
    if (reason) await store.rejectRequest(id, reason);
};

const assignUser = async (uid) => {
    const pid = selectedPersonForUser.value[uid];
    if (pid) {
        await store.assignUserToPerson(uid, pid);
        selectedPersonForUser.value[uid] = '';
    }
};

const setTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('juba-theme', t);
};

const saveSettings = async () => {
    await store.saveSettings(settings.value);
    alert('Einstellungen gespeichert.');
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

// Global event bus for modal opening (Navbar -> here)?
// Or Navbar emits events. Navbar emits events.

</script>
