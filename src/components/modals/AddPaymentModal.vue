<template>
  <div class="modal show" @click.self="$emit('close')">
    <div class="modal-content">
        <div class="modal-header">
            <span>Zahlung buchen</span>
            <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
        <div class="form-group" style="display:flex; align-items:center; gap:10px;">
            <input type="checkbox" v-model="isStandingOrder" style="width:20px; height:20px;" id="payment-is-standing-order">
            <label for="payment-is-standing-order" style="margin:0; font-weight:600; cursor:pointer">Dauerauftrag</label>
        </div>
        <div class="form-group">
            <label class="form-label">Betrag (€)</label>
            <input type="text" inputmode="decimal" v-model="amount" class="form-input">
        </div>
        <div class="form-group">
            <label class="form-label">{{ isStandingOrder ? 'Startdatum' : 'Datum' }}</label>
            <input type="date" v-model="date" class="form-input">
        </div>
        <div class="form-group">
            <label class="form-label">Notiz</label>
            <input type="text" v-model="desc" class="form-input" placeholder="z.B. Beitrag Mai">
        </div>
        <button class="btn btn-primary" :disabled="isLoading" @click="addPayment">{{ isLoading ? 'Buchen...' : 'Buchen' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAppStore } from '../../stores/app';

const props = defineProps(['personId']);
const emit = defineEmits(['close']);
const store = useAppStore();

const isStandingOrder = ref(false);
const amount = ref('');
const date = ref(new Date().toISOString().split('T')[0]);
const desc = ref('');
const isLoading = ref(false);

const addPayment = async () => {
    if (!amount.value || !date.value) return;
    const amt = parseFloat(amount.value.replace(',', '.'));
    if (isNaN(amt)) return;

    isLoading.value = true;
    try {
        if (isStandingOrder.value) {
            await store.addPayment(props.personId, {
                id: Date.now().toString(),
                amount: amt,
                startDate: date.value,
                note: desc.value,
                lastAutoPayment: null
            }, true);
        } else {
            await store.addPayment(props.personId, {
                id: Date.now().toString(),
                amount: amt,
                date: date.value,
                description: desc.value
            }, false);
        }
        emit('close');
    } catch (e) {
        alert(e.message);
    } finally {
        isLoading.value = false;
    }
};
</script>
