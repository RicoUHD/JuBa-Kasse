<template>
  <div id="login-modal" class="modal show">
    <div class="modal-content" style="max-width: 400px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin-bottom: 15px;">{{ isRegister ? 'Registrieren' : 'Anmelden' }}</h2>
            <div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 20px;">
                <button class="btn btn-sm" :class="!isRegister ? 'btn-primary' : 'btn-secondary'" @click="isRegister = false">Login</button>
                <button class="btn btn-sm" :class="isRegister ? 'btn-primary' : 'btn-secondary'" @click="isRegister = true">Registrieren</button>
            </div>
        </div>

        <!-- Login Form -->
        <div v-if="!isRegister">
            <label class="sr-only">E-Mail</label>
            <input type="email" v-model="email" class="form-input" placeholder="E-Mail" style="margin-bottom:10px;">
            <label class="sr-only">Passwort</label>
            <input type="password" v-model="password" class="form-input" placeholder="Passwort" style="margin-bottom:15px;">
            <button class="btn btn-primary" :disabled="isLoading" @click="handleLogin">{{ isLoading ? 'Anmelden...' : 'Anmelden' }}</button>
        </div>

        <!-- Register Form -->
        <div v-else>
            <div style="background: var(--surface-alt); padding: 10px; border-radius: 10px; margin-bottom: 15px; font-size: 0.9rem;">
                <p>Bitte geben Sie den aktuellen 6-stelligen Registrierungscode ein.</p>
            </div>
            <label class="sr-only">Registrierungscode</label>
            <input type="text" v-model="regCode" class="form-input" placeholder="6-stelliger Code" style="margin-bottom:10px;" maxlength="6">
            <label class="sr-only">E-Mail</label>
            <input type="email" v-model="email" class="form-input" placeholder="E-Mail" style="margin-bottom:10px;">
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <label class="sr-only">Vorname</label>
                <input type="text" v-model="firstName" class="form-input" placeholder="Vorname">
                <label class="sr-only">Nachname</label>
                <input type="text" v-model="lastName" class="form-input" placeholder="Nachname">
            </div>
            <label class="sr-only">Passwort (min 6 Zeichen)</label>
            <input type="password" v-model="password" class="form-input" placeholder="Passwort (min 6)" style="margin-bottom:10px;">
            <label class="sr-only">Passwort wiederholen</label>
            <input type="password" v-model="confirmPassword" class="form-input" placeholder="Passwort wiederholen" style="margin-bottom:15px;">
            <button class="btn btn-primary" :disabled="isLoading" @click="handleRegister">{{ isLoading ? 'Registrieren...' : 'Registrieren' }}</button>
        </div>

        <div v-if="error" style="color: var(--danger); text-align: center; margin-top: 15px; font-weight: bold;">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAppStore } from '../stores/app';
import { useRouter } from 'vue-router';

const store = useAppStore();
const router = useRouter();

const isRegister = ref(false);
const email = ref('');
const password = ref('');
const firstName = ref('');
const lastName = ref('');
const confirmPassword = ref('');
const regCode = ref('');
const isLoading = ref(false);
const error = ref('');

const handleLogin = async () => {
    isLoading.value = true;
    error.value = '';
    try {
        await store.login(email.value, password.value);
        router.push(store.isAdmin ? '/admin' : '/user');
    } catch (e) {
        error.value = "Login fehlgeschlagen: " + e.message;
    } finally {
        isLoading.value = false;
    }
};

const handleRegister = async () => {
    isLoading.value = true;
    error.value = '';
    if (password.value !== confirmPassword.value) {
        error.value = "Passwörter stimmen nicht überein.";
        isLoading.value = false;
        return;
    }
    if (password.value.length < 6) {
        error.value = "Passwort muss mindestens 6 Zeichen lang sein.";
        isLoading.value = false;
        return;
    }

    try {
        await store.register(email.value, password.value, firstName.value, lastName.value, regCode.value);
        router.push(store.isAdmin ? '/admin' : '/user');
    } catch (e) {
        error.value = "Registrierung fehlgeschlagen: " + e.message;
    } finally {
        isLoading.value = false;
    }
};
</script>
