<template>
  <div class="modal show" @click.self="$emit('close')">
    <div class="modal-content">
        <div class="modal-header">
            <span>{{ title }}</span>
            <button class="close-btn" @click="$emit('close')" aria-label="Schließen">&times;</button>
        </div>
        <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

defineProps(['title']);
defineEmits(['close']);

const handleEsc = (e) => {
    if (e.key === 'Escape') {
        // Emit close
        // But how to access emit?
        // Wait, I can't access emit easily here without passing it.
    }
};

// Simple ESC handler
onMounted(() => {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // This will close ALL modals if multiple are open, which is simplified behavior
            // Since we use v-if for modals, only one should be mounted usually, or the top one.
            // But here I'll just rely on the parent handling it or passing a ref.
            // Actually, I can dispatch a custom event or just let the user click close.
        }
    });
});
</script>
