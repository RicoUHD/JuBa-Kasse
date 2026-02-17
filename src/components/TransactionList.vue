<template>
  <div class="timeline">
    <div v-for="event in timelineItems" :key="event.id" class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
            <div v-if="event.type === 'status'">
                <div style="font-weight: 600;">Statusänderung: {{ statusLabels[event.status] || event.status }}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">Gültig ab {{ event.dateStr }}</div>
            </div>
            <div v-else>
                <div style="font-weight: 600;">Zahlung: {{ formatCurrency(event.amount) }}€</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">{{ event.description || 'Keine Notiz' }} • {{ event.dateStr }}</div>
            </div>
        </div>
    </div>
    <div v-if="timelineItems.length === 0" style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">Keine Einträge vorhanden.</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { safeList, formatCurrency } from '../utils/helpers';

const props = defineProps(['person']);

const timelineItems = computed(() => {
    if (!props.person) return [];

    const historyList = safeList(props.person.statusHistory);
    const history = historyList.map((h, i) => ({
        id: `status-${i}`,
        type: 'status',
        date: new Date(h.startDate),
        status: h.status,
        endDate: h.endDate ? new Date(h.endDate) : null
    }));

    let currentStatusStart;
    if (historyList.length > 0) {
        currentStatusStart = historyList[historyList.length - 1].endDate;
    } else {
        currentStatusStart = props.person.originalMemberSince || props.person.memberSince;
    }

    if (currentStatusStart) {
        history.push({
            id: `status-current`,
            type: 'status',
            date: new Date(currentStatusStart),
            status: props.person.status,
            endDate: null
        });
    }

    const payments = safeList(props.person.payments).map(p => ({
        id: p.id,
        type: 'payment',
        date: new Date(p.date),
        amount: p.amount,
        description: p.description
    }));

    const allEvents = [...history, ...payments].sort((a, b) => b.date - a.date);

    return allEvents.map(e => ({
        ...e,
        dateStr: e.date.toLocaleDateString('de-DE')
    }));
});

const statusLabels = {
    'vollverdiener': '💼 Vollverdiener',
    'geringverdiener': '📉 Geringverdiener',
    'keinverdiener': '🎓 Keinverdiener',
    'pausiert': '⏸️ Pausiert'
};
</script>
