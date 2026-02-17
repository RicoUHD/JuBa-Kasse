<script setup>
import { onMounted } from 'vue';
import { useAppStore } from './stores/app';

const store = useAppStore();

onMounted(async () => {
  await store.initAuth();
});
</script>

<template>
  <div v-if="store.authLoading" class="loading-overlay">
    <div class="spinner"></div>
    <div class="loading-message">Lade Daten...</div>
  </div>
  <RouterView />
</template>

<style scoped>
.loading-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(5px);
    z-index: 9999; display: flex; align-items: center; justify-content: center; flex-direction: column;
}
.loading-message {
    font-weight: 600; color: var(--text);
}
</style>
