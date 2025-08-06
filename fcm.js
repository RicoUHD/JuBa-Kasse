// Firebase Cloud Messaging Konfiguration und Hilfsfunktionen

// VAPID Key für Web Push (müssen Sie in der Firebase Console generieren)
const VAPID_KEY = "BHm6h4NKQ8k2DZ1HzVJ7X8F9YxW3GqE2RtB5Kp7Mn4Vw9UrL0SoC6ZdR1fY3Eh8Qv2PcA7I9bNwO5KtJzXrG8m";

class FCMManager {
    constructor() {
        this.messaging = null;
        this.isSupported = false;
        this.token = null;
        this.isInitialized = false;
    }

    // FCM initialisieren
    async initialize() {
        try {
            // Prüfen ob Firebase Messaging unterstützt wird
            if (!('serviceWorker' in navigator) || !('Notification' in window)) {
                console.warn('FCM: Browser unterstützt keine Service Worker oder Notifications');
                return false;
            }

            // Dynamischen Import für Firebase Messaging
            const { getMessaging, getToken, onMessage, isSupported } = await import('https://www.gstatic.com/firebasejs/11.9.0/firebase-messaging.js');
            
            // Prüfen ob FCM unterstützt wird
            this.isSupported = await isSupported();
            if (!this.isSupported) {
                console.warn('FCM: Firebase Messaging wird in diesem Browser nicht unterstützt');
                return false;
            }

            // Firebase App Instance holen (aus der Haupt-App)
            const { getApp } = await import('https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js');
            const app = getApp();
            
            // Messaging initialisieren
            this.messaging = getMessaging(app);
            
            // Service Worker registrieren
            await this.registerServiceWorker();
            
            // Berechtigung anfragen
            const permission = await this.requestPermission();
            if (permission !== 'granted') {
                console.warn('FCM: Notification-Berechtigung nicht erteilt');
                return false;
            }

            // FCM Token holen
            this.token = await this.getRegistrationToken();
            if (!this.token) {
                console.warn('FCM: Kein Registration Token erhalten');
                return false;
            }

            // Message Listener einrichten
            this.setupMessageListener();
            
            this.isInitialized = true;
            console.log('FCM erfolgreich initialisiert. Token:', this.token);
            
            return true;
        } catch (error) {
            console.error('FCM Initialisierungsfehler:', error);
            return false;
        }
    }

    // Service Worker registrieren
    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/JuBa-Kasse/sw.js', {
                scope: '/JuBa-Kasse/'
            });
            
            console.log('Service Worker registriert:', registration);
            
            // Warten bis Service Worker aktiv ist
            if (registration.installing) {
                await this.waitForServiceWorker(registration.installing);
            } else if (registration.waiting) {
                await this.waitForServiceWorker(registration.waiting);
            }
            
            return registration;
        } catch (error) {
            console.error('Service Worker Registrierungsfehler:', error);
            throw error;
        }
    }

    // Warten bis Service Worker aktiv ist
    waitForServiceWorker(sw) {
        return new Promise((resolve) => {
            sw.addEventListener('statechange', () => {
                if (sw.state === 'activated') {
                    resolve();
                }
            });
        });
    }

    // Notification-Berechtigung anfragen
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('Notifications werden nicht unterstützt');
            return 'denied';
        }

        if (Notification.permission === 'granted') {
            return 'granted';
        }

        if (Notification.permission === 'denied') {
            console.warn('Notification-Berechtigung wurde verweigert');
            return 'denied';
        }

        // Berechtigung anfragen
        const permission = await Notification.requestPermission();
        console.log('Notification-Berechtigung:', permission);
        
        return permission;
    }

    // FCM Registration Token holen
    async getRegistrationToken() {
        try {
            const { getToken } = await import('https://www.gstatic.com/firebasejs/11.9.0/firebase-messaging.js');
            
            const token = await getToken(this.messaging, {
                vapidKey: VAPID_KEY
            });
            
            if (token) {
                console.log('FCM Token:', token);
                // Token in Firebase Realtime Database speichern
                await this.saveTokenToDatabase(token);
                return token;
            } else {
                console.warn('Kein FCM Token verfügbar');
                return null;
            }
        } catch (error) {
            console.error('Fehler beim Holen des FCM Tokens:', error);
            return null;
        }
    }

    // Token in Firebase Database speichern
    async saveTokenToDatabase(token) {
        try {
            const { getDatabase, ref, set } = await import('https://www.gstatic.com/firebasejs/11.9.0/firebase-database.js');
            const database = getDatabase();
            
            // Eindeutige Geräte-ID generieren
            const deviceId = this.getDeviceId();
            
            await set(ref(database, `fcm-tokens/${deviceId}`), {
                token: token,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
            
            console.log('FCM Token in Database gespeichert');
        } catch (error) {
            console.error('Fehler beim Speichern des FCM Tokens:', error);
        }
    }

    // Eindeutige Geräte-ID generieren
    getDeviceId() {
        let deviceId = localStorage.getItem('juba-device-id');
        if (!deviceId) {
            deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('juba-device-id', deviceId);
        }
        return deviceId;
    }

    // Message Listener für Foreground Messages
    setupMessageListener() {
        const { onMessage } = import('https://www.gstatic.com/firebasejs/11.9.0/firebase-messaging.js').then(module => {
            module.onMessage(this.messaging, (payload) => {
                console.log('Foreground Message empfangen:', payload);
                
                // Custom Notification im Foreground anzeigen
                this.showForegroundNotification(payload);
            });
        });
    }

    // Notification im Foreground anzeigen
    showForegroundNotification(payload) {
        const title = payload.notification?.title || payload.data?.title || 'JuBa-Kasse';
        const body = payload.notification?.body || payload.data?.body || 'Neue Benachrichtigung';
        
        // System-Notification erstellen
        if (Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: body,
                icon: '/JuBa-Kasse/icon-512.png',
                badge: '/JuBa-Kasse/icon-512.png',
                tag: 'juba-kasse-foreground',
                renotify: true,
                data: payload.data
            });
            
            // Click Handler
            notification.onclick = () => {
                window.focus();
                notification.close();
                
                // Optional: Spezifische Aktion basierend auf payload
                if (payload.data?.action) {
                    this.handleNotificationAction(payload.data.action, payload.data);
                }
            };
            
            // Auto-close nach 5 Sekunden
            setTimeout(() => {
                notification.close();
            }, 5000);
        }
        
        // Zusätzlich: In-App Notification anzeigen
        this.showInAppNotification(title, body, payload.data);
    }

    // In-App Notification anzeigen
    showInAppNotification(title, body, data) {
        // Prüfen ob ein In-App Notification Container existiert
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                max-width: 300px;
            `;
            document.body.appendChild(container);
        }
        
        // Notification Element erstellen
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            animation: slideInRight 0.3s ease;
            cursor: pointer;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <img src="/JuBa-Kasse/icon-512.png" alt="Icon" style="width: 32px; height: 32px; border-radius: 6px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${title}</div>
                    <div style="font-size: 14px; color: #64748b;">${body}</div>
                </div>
                <button style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 18px; line-height: 1;" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Click Handler
        notification.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                if (data?.action) {
                    this.handleNotificationAction(data.action, data);
                }
                notification.remove();
            }
        };
        
        container.appendChild(notification);
        
        // Auto-remove nach 5 Sekunden
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        // CSS Animation hinzufügen falls nicht vorhanden
        if (!document.getElementById('notification-animations')) {
            const style = document.createElement('style');
            style.id = 'notification-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Notification Action Handler
    handleNotificationAction(action, data) {
        console.log('Notification Action:', action, data);
        
        switch (action) {
            case 'new_payment':
                // Zur Übersicht wechseln und ggf. Person öffnen
                if (window.showTab) {
                    window.showTab('overview');
                }
                break;
            case 'payment_reminder':
                // Zur entsprechenden Person navigieren
                if (data.personId && window.showPersonDetails) {
                    window.showPersonDetails(data.personId);
                }
                break;
            case 'low_balance':
                // Kassenstand anzeigen
                if (window.toggleKassenstandDetails) {
                    window.toggleKassenstandDetails();
                }
                break;
            default:
                // Standard: Zur Übersicht
                if (window.showTab) {
                    window.showTab('overview');
                }
        }
    }

    // Test-Benachrichtigung senden
    async sendTestNotification() {
        if (!this.isInitialized) {
            console.warn('FCM ist nicht initialisiert');
            return;
        }
        
        // Test mit lokaler Notification
        if (Notification.permission === 'granted') {
            const notification = new Notification('JuBa-Kasse Test', {
                body: 'Dies ist eine Test-Benachrichtigung!',
                icon: '/JuBa-Kasse/icon-512.png',
                badge: '/JuBa-Kasse/icon-512.png',
                tag: 'test-notification'
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            setTimeout(() => notification.close(), 3000);
        }
    }

    // FCM Token erneuern
    async refreshToken() {
        try {
            const newToken = await this.getRegistrationToken();
            if (newToken && newToken !== this.token) {
                this.token = newToken;
                console.log('FCM Token erneuert:', newToken);
                return newToken;
            }
            return this.token;
        } catch (error) {
            console.error('Fehler beim Erneuern des FCM Tokens:', error);
            return null;
        }
    }

    // FCM Status abfragen
    getStatus() {
        return {
            isSupported: this.isSupported,
            isInitialized: this.isInitialized,
            hasToken: !!this.token,
            permission: Notification.permission,
            token: this.token
        };
    }
}

// FCM Manager Instanz erstellen
window.fcmManager = new FCMManager();

export default FCMManager;
