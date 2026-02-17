<template>
  <div>
    <div class="hero-card" role="button" tabindex="0" @click="showTransactions = true">
        <span class="hero-label">Aktueller Kassenstand</span>
        <div class="hero-amount">{{ formatCurrency(totalBalance) }} €</div>
        <div class="hero-subtitle">Tippen für Details</div>
    </div>

    <div class="stats-grid">
        <div class="stat-box">
            <div class="stat-label">Einnahmen</div>
            <div class="stat-value text-success">{{ formatCurrency(periodInc) }} €</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Ausgaben</div>
            <div class="stat-value text-danger">{{ formatCurrency(periodExp) }} €</div>
        </div>
    </div>

    <TransactionListModal v-if="showTransactions" @close="showTransactions = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/app';
import { safeList, formatCurrency } from '../utils/helpers';
import TransactionListModal from './modals/TransactionListModal.vue';

const store = useAppStore();
const showTransactions = ref(false);

const stats = computed(() => {
    let periodInc = 0, periodExp = 0;
    let totalInc = 0, totalExp = 0;

    const startDate = store.settings.reportStartDate ? new Date(store.settings.reportStartDate) : null;

    store.people.forEach(p => {
        safeList(p.payments).forEach(pay => {
            const amount = parseFloat(pay.amount);
            totalInc += amount;
            if(!startDate || new Date(pay.date) >= startDate) periodInc += amount;
        });
    });
    store.donations.forEach(d => {
        const amount = parseFloat(d.amount);
        totalInc += amount;
        if(!startDate || new Date(d.date) >= startDate) periodInc += amount;
    });
    store.expenses.forEach(e => {
        const amount = parseFloat(e.amount);
        totalExp += amount;
        if(!startDate || new Date(e.date) >= startDate) periodExp += amount;
    });

    const totalBalance = totalInc - totalExp;
    return { totalBalance, periodInc, periodExp };
});

const totalBalance = computed(() => stats.value.totalBalance);
const periodInc = computed(() => stats.value.periodInc);
const periodExp = computed(() => stats.value.periodExp);
</script>
