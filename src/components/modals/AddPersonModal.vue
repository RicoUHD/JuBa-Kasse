<template>
  <div class="modal show" @click.self="$emit('close')">
    <div class="modal-content">
        <div class="modal-header">
            <span>Person hinzufügen</span>
            <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
        <div class="form-group">
            <label class="form-label">Name</label>
            <input type="text" v-model="name" class="form-input">
        </div>
        <div class="form-group">
            <label class="form-label">Mitglied Seit</label>
            <input type="date" v-model="start" class="form-input">
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:6px;">
                Ab diesem Datum werden Beiträge berechnet.
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Status</label>
            <select v-model="status" class="form-select">
                <option value="vollverdiener">💼 Vollverdiener</option>
                <option value="geringverdiener">📉 Geringverdiener</option>
                <option value="keinverdiener">🎓 Keinverdiener</option>
                <option value="pausiert">⏸️ Pausiert</option>
            </select>
        </div>
        <button class="btn btn-primary" :disabled="isLoading" @click="addPerson">{{ isLoading ? 'Speichert...' : 'Hinzufügen' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAppStore } from '../../stores/app';

const emit = defineEmits(['close']);
const store = useAppStore();

const name = ref('');
const start = ref(new Date().toISOString().split('T')[0]);
const status = ref('vollverdiener');
const isLoading = ref(false);

const addPerson = async () => {
    if (!name.value || !start.value) return;
    isLoading.value = true;
    try {
        await store.addPerson({
            id: Date.now().toString(),
            name: name.value,
            status: status.value,
            memberSince: start.value,
            originalMemberSince: start.value,
            totalPaid: 0,
            statusHistory: [],
            payments: []
        });
        emit('close');
    } catch (e) {
        alert(e.message);
    } finally {
        isLoading.value = false;
    }
};
</script>
