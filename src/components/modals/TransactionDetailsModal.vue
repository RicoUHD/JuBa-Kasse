<template>
  <div class="modal show" @click.self="$emit('close')">
    <div class="modal-content">
        <div class="modal-header">
            <span>Details</span>
            <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>

        <div style="text-align:center; margin-bottom:20px;">
            <div style="font-size:2rem; font-weight:800;">{{ formatCurrency(transaction.amount) }} €</div>
            <div style="color:var(--text-secondary);">{{ transaction.typeName }}</div>
        </div>

        <div class="details-status-card" style="background:var(--surface-alt); border:1px solid var(--border);">
            <div class="details-row">
                <span class="details-label">Datum</span>
                <span class="details-value">{{ transaction.dateStr }}</span>
            </div>
            <div v-if="transaction.who" class="details-row">
                <span class="details-label">Person</span>
                <span class="details-value">{{ transaction.who }}</span>
            </div>
            <div v-if="transaction.issuer" class="details-row">
                <span class="details-label">Ausgestellt von</span>
                <span class="details-value">{{ transaction.issuer }}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Beschreibung</span>
                <span class="details-value">{{ transaction.description || transaction.note || '-' }}</span>
            </div>
        </div>

        <div v-if="receiptUrl" style="margin-top:20px;">
            <div style="font-weight:600; margin-bottom:10px;">Beleg</div>
            <img :src="receiptUrl" style="width:100%; border-radius:12px; border:1px solid var(--border);" alt="Beleg">
        </div>
        <div v-if="loadingReceipt" class="spinner" style="margin:20px auto;"></div>
        <div v-if="receiptError" style="color:var(--danger); margin-top:20px; text-align:center;">Beleg konnte nicht geladen werden.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { fetchReceiptImage } from '../../utils/webdav';
import { formatCurrency } from '../../utils/helpers';

const props = defineProps(['transaction']);
const emit = defineEmits(['close']);

const receiptUrl = ref(null);
const loadingReceipt = ref(false);
const receiptError = ref(false);

onMounted(async () => {
    if (props.transaction.receipt) {
        loadingReceipt.value = true;
        try {
            receiptUrl.value = await fetchReceiptImage(props.transaction.receipt);
        } catch (e) {
            receiptError.value = true;
        } finally {
            loadingReceipt.value = false;
        }
    }
});
</script>
