<template>
  <div>
    <!-- FAB Menu -->
    <div class="fab-menu" :class="{ show: showFab }">
        <button type="button" class="fab-item" @click="emit('openAddPerson'); toggleFab()">👤 Person</button>
        <button type="button" class="fab-item" @click="emit('openAddDonation'); toggleFab()">💝 Spende</button>
        <button type="button" class="fab-item" @click="emit('openAddExpense'); toggleFab()">💸 Ausgabe</button>
    </div>

    <!-- Desktop Nav -->
    <nav class="desktop-nav">
        <button class="nav-btn" :class="{active: activeTab === 'overview'}" @click="emit('switch', 'overview')">Startseite</button>
        <button class="nav-btn" :class="{active: activeTab === 'settings'}" @click="emit('switch', 'settings')">Einstellungen</button>
    </nav>

    <!-- Bottom Nav -->
    <nav class="bottom-nav" id="admin-bottom-nav">
        <button class="nav-item" :class="{active: activeTab === 'overview'}" @click="emit('switch', 'overview')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>Übersicht</span>
        </button>
        <div class="nav-center">
            <button class="nav-fab" :class="{active: showFab}" @click="toggleFab" aria-label="Aktionsmenü öffnen">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
        </div>
        <button class="nav-item" :class="{active: activeTab === 'settings'}" @click="emit('switch', 'settings')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>Einstellungen</span>
        </button>
    </nav>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps(['activeTab']);
const emit = defineEmits(['switch', 'openAddPerson', 'openAddDonation', 'openAddExpense']);

const showFab = ref(false);
const toggleFab = () => showFab.value = !showFab.value;
</script>
