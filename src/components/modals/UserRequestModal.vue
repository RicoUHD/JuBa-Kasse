<template>
  <div class="modal show" @click.self="$emit('close')">
    <div class="modal-content">
        <div class="modal-header">
            <span>{{ title }}</span>
            <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>

        <div v-if="type === 'payment'">
             <div class="form-group" style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" v-model="isStandingOrder" style="width:20px; height:20px;" id="req-is-standing-order">
                <label for="req-is-standing-order" style="margin:0; font-weight:600; cursor:pointer">Dauerauftrag</label>
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
                <label class="form-label">Notiz (Optional)</label>
                <input type="text" v-model="note" class="form-input">
            </div>
        </div>

        <div v-if="type === 'status'">
            <div class="form-group">
                <label class="form-label">Neuer Status</label>
                <select v-model="status" class="form-select">
                    <option value="vollverdiener">💼 Vollverdiener</option>
                    <option value="geringverdiener">📉 Geringverdiener</option>
                    <option value="keinverdiener">🎓 Keinverdiener</option>
                    <option value="pausiert">⏸️ Pausiert</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Gültig ab</label>
                <input type="date" v-model="date" class="form-input">
            </div>
        </div>

        <div v-if="type === 'expense'">
            <div class="form-group">
                <label class="form-label">Betrag (€)</label>
                <input type="text" inputmode="decimal" v-model="amount" class="form-input">
            </div>
            <div class="form-group">
                <label class="form-label">Beschreibung</label>
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
        </div>

        <button class="btn btn-primary" :disabled="isLoading" @click="submit">{{ isLoading ? 'Sende...' : 'Absenden' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '../../stores/app';
import { uploadReceipt } from '../../utils/webdav';

const props = defineProps(['type']);
const emit = defineEmits(['close']);
const store = useAppStore();

const amount = ref('');
const date = ref(new Date().toISOString().split('T')[0]);
const note = ref('');
const status = ref('vollverdiener');
const desc = ref('');
const isStandingOrder = ref(false);
const fileInput = ref(null);
const isLoading = ref(false);

const title = computed(() => {
    if (props.type === 'payment') return 'Zahlung melden';
    if (props.type === 'status') return 'Statusänderung beantragen';
    if (props.type === 'expense') return 'Ausgabe melden';
    return 'Anfrage';
});

const submit = async () => {
    isLoading.value = true;
    try {
        let reqData = {};
        let finalType = props.type;

        if (props.type === 'payment') {
            const amt = parseFloat(amount.value.replace(',', '.'));
            if (isNaN(amt)) return;
            reqData = { amount: amt, date: date.value, note: note.value };
            if (isStandingOrder.value) finalType = 'standing_order';
        } else if (props.type === 'status') {
            reqData = { newStatus: status.value, date: date.value };
        } else if (props.type === 'expense') {
             const amt = parseFloat(amount.value.replace(',', '.'));
             if (isNaN(amt)) return;
             reqData = { amount: amt, description: desc.value, date: date.value };
             if (fileInput.value && fileInput.value.files.length > 0) {
                 reqData.receipt = await uploadReceipt(fileInput.value.files[0]);
             }
        }

        await store.submitRequest(finalType, reqData);
        emit('close');
        alert("Anfrage gesendet!");
    } catch (e) {
        alert(e.message);
    } finally {
        isLoading.value = false;
    }
};
</script>
