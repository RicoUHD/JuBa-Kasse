<template>
  <div class="person-wrapper" :class="{ active: isOpen }">
    <div class="person-item" :class="{ active: isOpen }" role="button" tabindex="0" @click="toggleDetails" @keydown.enter.prevent="toggleDetails">
        <div class="person-pill">
            <div class="person-left">
                <div class="person-name">
                    {{ person.name }}
                    <span class="chevron">›</span>
                </div>
                <span class="person-status">{{ currentStatus }}</span>
            </div>
            <div class="person-right">
                <span v-if="!statusMeta.isActiveStandingOrder" class="payment-pill" :class="pillClass">{{ dateText }}</span>
                <span class="time-remaining">{{ statusMeta.text }}</span>
            </div>
        </div>
    </div>
    <div class="person-details" :class="{ active: isOpen }" :style="{ maxHeight: isOpen ? '1000px' : '0' }">
        <div class="details-content">
            <div class="details-status-card" :class="cardClass">
                <div v-if="!statusMeta.isActiveStandingOrder" class="details-row">
                    <span class="details-label">Bezahlt bis</span>
                    <span class="details-value">{{ dateText }}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Status</span>
                    <span class="details-value" style="text-transform:capitalize">{{ person.status }}</span>
                </div>
                <div v-if="statusMeta.isOverdue" class="details-row" style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(0,0,0,0.05)">
                    <span class="details-label text-danger">Offener Betrag</span>
                    <span class="details-value text-danger">{{ formatCurrency(overdueAmount) }} €</span>
                </div>
            </div>

            <div v-if="person.standingOrders && person.standingOrders.length > 0" class="card" style="margin-top:15px; margin-bottom:15px; background:var(--surface-alt);">
                <div class="card-header" style="font-size:0.9rem; padding:10px 15px;">🔄 Aktive Daueraufträge</div>
                <div class="card-body" style="padding:10px 15px;">
                    <div v-for="so in person.standingOrders" :key="so.id" :style="isEnded(so) ? 'opacity:0.6;' : ''" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">
                        <div>
                            <div style="font-size:0.9rem; font-weight:600;">{{ formatCurrency(so.amount) }} € / Monat</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">{{ so.note || 'Ohne Notiz' }}</div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
                                Start: {{ new Date(so.startDate).toLocaleDateString('de-DE') }}
                                <span v-if="so.endDate"><br>Ende: {{ new Date(so.endDate).toLocaleDateString('de-DE') }}</span>
                            </div>
                        </div>
                        <button class="btn-icon text-danger" @click="openEndStandingOrderModal(so.id)" title="Bearbeiten/Beenden" style="background:none; border:none; padding:4px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                </div>
            </div>

            <div class="details-actions">
                <button class="btn btn-primary" @click="showPayment = true">💰 Zahlung</button>
                <button class="btn btn-secondary" @click="showStatus = true">🔄 Status</button>
            </div>

            <button class="btn btn-danger btn-small" style="width:100%; margin-bottom: 20px;" @click="deletePerson">🗑️ Person Löschen</button>

            <div class="history-header">Verlauf</div>
            <TransactionList :person="person" />
        </div>
    </div>

    <!-- Modals -->
    <AddPaymentModal v-if="showPayment" :personId="person.id" @close="showPayment = false" />
    <ChangeStatusModal v-if="showStatus" :personId="person.id" @close="showStatus = false" />
    <EndStandingOrderModal v-if="showEndSO" :personId="person.id" :soId="editingSoId" @close="showEndSO = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/app';
import { formatCurrency } from '../utils/helpers';
import { getCurrentStatus } from '../utils/calculations';
import TransactionList from './TransactionList.vue';
import AddPaymentModal from './modals/AddPaymentModal.vue';
import ChangeStatusModal from './modals/ChangeStatusModal.vue';
import EndStandingOrderModal from './modals/EndStandingOrderModal.vue';

const props = defineProps(['person', 'preCalc']);
const store = useAppStore();

const isOpen = ref(false);
const showPayment = ref(false);
const showStatus = ref(false);
const showEndSO = ref(false);
const editingSoId = ref(null);

const toggleDetails = () => {
    isOpen.value = !isOpen.value;
};

const statusMeta = computed(() => props.preCalc.statusMeta);
const overdueAmount = computed(() => props.preCalc.overdueAmount);
const paidUntil = computed(() => props.preCalc.paidUntil);
const currentStatus = computed(() => getCurrentStatus(props.person, store.settings));
const dateText = computed(() => paidUntil.value ? paidUntil.value.toLocaleDateString('de-DE', {month:'long', year:'numeric'}) : 'Nie');

const pillClass = computed(() => {
    if(statusMeta.value.isOverdue) return 'status-err';
    if(statusMeta.value.isSoonDue) return 'status-warn';
    return 'status-ok';
});

const cardClass = computed(() => {
    if(statusMeta.value.isOverdue) return 'danger';
    return 'success';
});

const isEnded = (so) => so.endDate && new Date(so.endDate) < new Date();

const openEndStandingOrderModal = (soId) => {
    editingSoId.value = soId;
    showEndSO.value = true;
};

const deletePerson = async () => {
    if(confirm("Wirklich löschen?")) {
        await store.deletePerson(props.person.id);
    }
};
</script>
