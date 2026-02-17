<template>
  <div class="modal show" @click.self="$emit('close')">
    <div class="modal-content">
        <div class="modal-header">
            <span>Spende</span>
            <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
        <div class="form-group">
            <label class="form-label">Betrag (€)</label>
            <input type="text" inputmode="decimal" v-model="amount" class="form-input">
        </div>
        <div class="form-group">
            <label class="form-label">Spender Name</label>
            <input type="text" v-model="name" class="form-input">
        </div>
        <div class="form-group">
            <label class="form-label">Datum</label>
            <input type="date" v-model="date" class="form-input">
        </div>
        <button class="btn btn-primary" :disabled="isLoading" @click="addDonation">{{ isLoading ? 'Speichern...' : 'Speichern' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAppStore } from '../../stores/app';

const emit = defineEmits(['close']);
const store = useAppStore();

const amount = ref('');
const name = ref('');
const date = ref(new Date().toISOString().split('T')[0]);
const isLoading = ref(false);

const addDonation = async () => {
    const amt = parseFloat(amount.value.replace(',', '.'));
    if (isNaN(amt) || !name.value || !date.value) return;

    isLoading.value = true;
    try {
        await store.addDonation({
            id: Date.now().toString(),
            amount: amt,
            name: name.value,
            date: date.value
        });
        emit('close');
    } catch (e) {
        alert(e.message);
    } finally {
        isLoading.value = false;
    }
};
</script>
