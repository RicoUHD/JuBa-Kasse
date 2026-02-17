<template>
  <div class="modal show" @click.self="$emit('close')">
    <div class="modal-content">
        <div class="modal-header">
            <span>Status Ändern</span>
            <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
        <div class="form-group">
            <label class="form-label">Neuer Status</label>
            <select v-model="newStatus" class="form-select">
                <option value="vollverdiener">💼 Vollverdiener</option>
                <option value="geringverdiener">📉 Geringverdiener</option>
                <option value="keinverdiener">🎓 Keinverdiener</option>
                <option value="pausiert">⏸️ Pausiert</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Gültig ab</label>
            <input type="date" v-model="date" class="form-input">
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:6px;">
                <strong>Rückwirkend:</strong> Korrigiert die Berechnung ab dem angegebenen Datum.<br>
                <strong>Zukünftig:</strong> Der neue Status gilt ab dem Datum (bisherige Berechnung bleibt).
            </div>
        </div>
        <button class="btn btn-primary" :disabled="isLoading" @click="saveStatus">{{ isLoading ? 'Speichern...' : 'Status Ändern' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAppStore } from '../../stores/app';

const props = defineProps(['personId']);
const emit = defineEmits(['close']);
const store = useAppStore();

const newStatus = ref('vollverdiener');
const date = ref(new Date().toISOString().split('T')[0]);
const isLoading = ref(false);

const saveStatus = async () => {
    if (!newStatus.value || !date.value) return;
    isLoading.value = true;
    try {
        await store.saveStatusChange(props.personId, newStatus.value, date.value);
        emit('close');
    } catch (e) {
        alert(e.message);
    } finally {
        isLoading.value = false;
    }
};
</script>
