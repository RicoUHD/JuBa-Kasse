<template>
  <div class="modal show" @click.self="$emit('close')">
    <div class="modal-content">
        <div class="modal-header">
            <span>Verlauf</span>
            <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
        <div class="full-transaction-list">
             <div v-if="allTransactions.length === 0" style="text-align:center; padding:20px; color:var(--text-secondary);">Keine Buchungen vorhanden.</div>

             <div v-else v-for="t in allTransactions" :key="t.uniqueId"
                  class="trans-item"
                  role="button"
                  tabindex="0"
                  @click="openDetails(t)"
                  style="cursor:pointer;">
                <div class="trans-left">
                    <span style="font-weight:600;">{{ t.icon }} {{ t.who }}</span>
                    <div class="trans-meta">
                        {{ t.description || '-' }} <span v-if="t.receipt" style="margin-left:5px" title="Beleg vorhanden">📷</span> • {{ t.dateStr }}
                    </div>
                </div>
                <div class="trans-amount" :class="t.color">{{ t.sign }}{{ formatCurrency(t.amount) }}€</div>
            </div>
        </div>
    </div>

    <TransactionDetailsModal v-if="selectedTransaction" :transaction="selectedTransaction" @close="selectedTransaction = null" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '../../stores/app';
import { safeList, formatCurrency } from '../../utils/helpers';
import TransactionDetailsModal from './TransactionDetailsModal.vue';

const emit = defineEmits(['close']);
const store = useAppStore();
const selectedTransaction = ref(null);

const allTransactions = computed(() => {
    let all = [];

    store.people.forEach(p => {
        safeList(p.payments).forEach(pay => {
            const d = pay.date ? new Date(pay.date) : new Date(0);
            all.push({...pay, who: p.name, type: 'pay', dateObj: d, uniqueId: 'pay_' + pay.id});
        });
    });
    store.donations.forEach(d => {
        const date = d.date ? new Date(d.date) : new Date(0);
        all.push({...d, who: d.name || 'Spende', type: 'don', dateObj: date, uniqueId: 'don_' + d.id});
    });
    store.expenses.forEach(e => {
        const date = e.date ? new Date(e.date) : new Date(0);
        all.push({...e, who: e.issuer, type: 'exp', dateObj: date, uniqueId: 'exp_' + e.id});
    });

    all.sort((a,b) => b.dateObj - a.dateObj);

    return all.map(t => {
        const isExp = t.type === 'exp';
        return {
            ...t,
            color: isExp ? 'text-danger' : 'text-success',
            sign: isExp ? '-' : '+',
            icon: t.type === 'pay' ? '👤' : (t.type === 'don' ? '💝' : '💸'),
            dateStr: t.dateObj ? t.dateObj.toLocaleDateString('de-DE') : 'Kein Datum',
            typeName: t.type === 'pay' ? 'Zahlung' : (t.type === 'don' ? 'Spende' : 'Ausgabe')
        };
    });
});

const openDetails = (t) => {
    selectedTransaction.value = t;
};
</script>
