let storedConfig = null;
try {
    const raw = localStorage.getItem('juba-config');
    if (raw) {
        storedConfig = JSON.parse(raw);
    }
} catch (e) {
    console.warn("Failed to read config from localStorage", e);
}

export const config = storedConfig || {
    firebaseConfig: {
        apiKey: "",
        authDomain: "",
        databaseURL: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: ""
    },
    apiBaseUrl: ""
};
