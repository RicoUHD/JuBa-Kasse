<template>
  <div class="modal show" @click.self="$emit('close')">
    <div class="modal-content">
        <div class="modal-header">
            <span>Ausgabe</span>
            <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
        <div class="form-group">
            <label class="form-label">Betrag (€)</label>
            <input type="text" inputmode="decimal" v-model="amount" class="form-input">
        </div>
        <div class="form-group">
            <label class="form-label">Wer?</label>
            <input type="text" v-model="issuer" class="form-input">
        </div>
        <div class="form-group">
            <label class="form-label">Wofür?</label>
            <input type="text" v-model="desc" class="form-input">
        </div>
        <div class="form-group">
            <label class="form-label">Datum</label>
            <input type="date" v-model="date" class="form-input">
        </div>
        <div class="form-group">
            <label class="form-label">Beleg (Optional)</label>
            <input type="file" ref="fileInput" accept="image/*" class="form-input">
        </div>
        <button class="btn btn-primary" :disabled="isLoading" @click="addExpense">{{ isLoading ? 'Speichert...' : 'Speichern' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAppStore } from '../../stores/app';
import { uploadReceipt } from '../../utils/webdav';

const emit = defineEmits(['close']);
const store = useAppStore();

const amount = ref('');
const issuer = ref('');
const desc = ref('');
const date = ref(new Date().toISOString().split('T')[0]);
const fileInput = ref(null);
const isLoading = ref(false);

const addExpense = async () => {
    const amt = parseFloat(amount.value.replace(',', '.'));
    if (isNaN(amt) || !issuer.value || !desc.value || !date.value) return;

    isLoading.value = true;
    try {
        let receiptFilename = null;
        if (fileInput.value && fileInput.value.files.length > 0) {
            receiptFilename = await uploadReceipt(fileInput.value.files[0]);
        }

        await store.addExpense({
            id: Date.now().toString(),
            amount: amt,
            issuer: issuer.value,
            description: desc.value,
            date: date.value,
            receipt: receiptFilename
        });
        emit('close');
    } catch (e) {
        alert(e.message);
    } finally {
        isLoading.value = false;
    }
};
</script>
