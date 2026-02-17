<template>
  <div class="people-grid-container">
    <div v-if="overdueItems.length > 0" class="people-column overdue-column">
        <h3 class="list-section-title" style="color:var(--danger)">Überfällig ({{ overdueItems.length }})</h3>
        <PersonItem v-for="item in overdueItems" :key="item.p.id" :person="item.p" :preCalc="item" />
    </div>

    <div v-if="currentItems.length > 0" class="people-column valid-column">
        <h3 class="list-section-title" style="color:var(--success)">Aktuelle Mitglieder ({{ currentItems.length }})</h3>
        <PersonItem v-for="item in currentItems" :key="item.p.id" :person="item.p" :preCalc="item" />
    </div>

    <div v-if="people.length === 0" style="text-align:center; padding:40px; color:var(--text-secondary);">
        <div style="font-size:3rem; margin-bottom:10px;">👥</div>
        <p>Noch keine Mitglieder.</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAppStore } from '../stores/app';
import PersonItem from './PersonItem.vue';
import { calculatePaymentStatus, calculateTimeRemaining, calculateOverdueAmount } from '../utils/calculations';

const store = useAppStore();
const people = computed(() => store.people);

const processed = computed(() => {
    return people.value.map(p => {
        const { paidUntil, remainingCredit } = calculatePaymentStatus(p, store.settings);
        const statusMeta = calculateTimeRemaining(p, store.settings, paidUntil);
        const overdueAmount = statusMeta.isOverdue ? calculateOverdueAmount(p, store.settings, paidUntil, remainingCredit) : 0;
        return { p, paidUntil, statusMeta, overdueAmount };
    });
});

const overdueItems = computed(() => processed.value.filter(x => x.statusMeta.isOverdue).sort((a,b) => a.p.name.localeCompare(b.p.name)));
const currentItems = computed(() => processed.value.filter(x => !x.statusMeta.isOverdue).sort((a,b) => a.p.name.localeCompare(b.p.name)));
</script>
