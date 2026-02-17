<template>
  <div class="modal show" @click.self="$emit('close')">
    <div class="modal-content">
        <div class="modal-header">
            <span>Dauerauftrag verwalten</span>
            <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
        <p style="margin-bottom:15px; color:var(--text-secondary); font-size:0.9rem;">Wann soll dieser Dauerauftrag enden?</p>

        <div class="form-group">
            <label class="form-label">Enddatum</label>
            <input type="date" v-model="date" class="form-input">
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:6px;">
                Zahlungen werden nur bis zu diesem Datum erstellt.
            </div>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:20px;">
            <button class="btn btn-primary" :disabled="isLoading" @click="save" style="flex:1;">Beenden / Speichern</button>
        </div>
        <button class="btn btn-danger" @click="deleteSO" style="width:100%; margin-top:15px; background:none; border:1px solid var(--danger); color:var(--danger);">🗑️ Eintrag ganz löschen</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAppStore } from '../../stores/app';

const props = defineProps(['personId', 'soId']);
const emit = defineEmits(['close']);
const store = useAppStore();

const date = ref(new Date().toISOString().split('T')[0]);
const isLoading = ref(false);

const save = async () => {
    isLoading.value = true;
    try {
        await store.endStandingOrder(props.personId, props.soId, date.value);
        emit('close');
    } catch (e) {
        alert(e.message);
    } finally {
        isLoading.value = false;
    }
};

const deleteSO = async () => {
    if (!confirm("Dauerauftrag wirklich komplett entfernen? Historie geht verloren.")) return;
    try {
        await store.deleteStandingOrder(props.personId, props.soId);
        emit('close');
    } catch (e) {
        alert(e.message);
    }
};
</script>
