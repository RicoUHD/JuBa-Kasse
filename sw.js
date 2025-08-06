// Service Worker für JuBa-Kasse PWA mit Firebase Cloud Messaging

// Import Firebase messaging in service worker
importScripts('https://www.gstatic.com/firebasejs/11.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.0/firebase-messaging-compat.js');

// Firebase configuration (same as in main app)
const firebaseConfig = {
    apiKey: "AIzaSyD5z2-ND8Ukx46wDhYJlUQhiUqHITrLxy0",
    authDomain: "juba-kasse.firebaseapp.com",
    databaseURL: "https://juba-kasse-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "juba-kasse",
    storageBucket: "juba-kasse.firebasestorage.app",
    messagingSenderId: "522007065248",
    appId: "1:522007065248:web:1c2490e03cd40c25e58fc5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
const messaging = firebase.messaging();

// Cache-Name für die PWA
const CACHE_NAME = 'juba-kasse-v1.0.0';
const urlsToCache = [
    '/JuBa-Kasse/',
    '/JuBa-Kasse/index.html',
    '/JuBa-Kasse/manifest.json',
    '/JuBa-Kasse/icon-512.png',
    'https://www.ev-bg.de/wp-content/uploads/2021/03/Logo_blau_Serifen.svg'
];

// Install Event - Cache-Ressourcen
self.addEventListener('install', event => {
    console.log('[SW] Service Worker wird installiert');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Cache wird geöffnet');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('[SW] Fehler beim Caching:', error);
                // Cache-Fehler nicht blockieren lassen
                return Promise.resolve();
            })
    );
    
    // Service Worker sofort aktivieren
    self.skipWaiting();
});

// Activate Event - Alte Caches löschen
self.addEventListener('activate', event => {
    console.log('[SW] Service Worker wird aktiviert');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Alter Cache wird gelöscht:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Sofort die Kontrolle über alle Clients übernehmen
    self.clients.claim();
});

// Fetch Event - Cache-First-Strategie für statische Ressourcen
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Nur GET-Requests cachen
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Firebase-APIs nicht cachen
    if (url.hostname.includes('firebase') || url.hostname.includes('google')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache-Hit - Resource aus Cache zurückgeben
                if (response) {
                    return response;
                }
                
                // Cache-Miss - Resource vom Netzwerk holen
                return fetch(event.request)
                    .then(response => {
                        // Ungültige Antworten nicht cachen
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Response klonen für Cache
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(error => {
                        console.log('[SW] Fetch-Fehler:', error);
                        // Fallback für offline
                        if (event.request.destination === 'document') {
                            return caches.match('/JuBa-Kasse/index.html');
                        }
                    });
            })
    );
});

// Firebase Cloud Messaging - Background Message Handler
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background Message empfangen:', payload);
    
    const notificationTitle = payload.notification?.title || payload.data?.title || 'JuBa-Kasse';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Neue Benachrichtigung',
        icon: '/JuBa-Kasse/icon-512.png',
        badge: '/JuBa-Kasse/icon-512.png',
        tag: 'juba-kasse-notification',
        renotify: true,
        requireInteraction: false,
        actions: [
            {
                action: 'open',
                title: 'Öffnen',
                icon: '/JuBa-Kasse/icon-512.png'
            },
            {
                action: 'dismiss',
                title: 'Schließen'
            }
        ],
        data: {
            url: payload.data?.url || '/JuBa-Kasse/',
            ...payload.data
        },
        timestamp: Date.now(),
        silent: false
    };
    
    // System-Benachrichtigung anzeigen
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification Click Handler
self.addEventListener('notificationclick', event => {
    console.log('[SW] Benachrichtigung geklickt:', event);
    
    // Benachrichtigung schließen
    event.notification.close();
    
    // Action-spezifische Behandlung
    if (event.action === 'dismiss') {
        return;
    }
    
    // URL aus Notification-Data oder Standard
    const urlToOpen = event.notification.data?.url || '/JuBa-Kasse/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // Prüfen ob JuBa-Kasse bereits geöffnet ist
                for (const client of clientList) {
                    if (client.url.includes('JuBa-Kasse') && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Neue Instanz öffnen wenn nicht bereits geöffnet
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Notification Close Handler
self.addEventListener('notificationclose', event => {
    console.log('[SW] Benachrichtigung geschlossen:', event.notification.data);
    
    // Optional: Analytics oder Tracking für geschlossene Benachrichtigungen
    if (event.notification.data?.trackClose) {
        // Hier könnte man Analytics-Events senden
    }
});

// Sync Event für Background Sync (falls implementiert)
self.addEventListener('sync', event => {
    console.log('[SW] Background Sync:', event.tag);
    
    if (event.tag === 'juba-kasse-sync') {
        event.waitUntil(
            // Hier könnte man Daten synchronisieren
            Promise.resolve()
        );
    }
});

// Message Handler für Kommunikation mit der Main App
self.addEventListener('message', event => {
    console.log('[SW] Message empfangen:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// Push Event Handler (als Backup für FCM)
self.addEventListener('push', event => {
    console.log('[SW] Push Event empfangen:', event);
    
    if (event.data) {
        const data = event.data.json();
        
        const title = data.title || 'JuBa-Kasse';
        const options = {
            body: data.body || 'Neue Benachrichtigung',
            icon: '/JuBa-Kasse/icon-512.png',
            badge: '/JuBa-Kasse/icon-512.png',
            tag: 'juba-kasse-push',
            data: data.data || {}
        };
        
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    }
});

// Error Handler
self.addEventListener('error', event => {
    console.error('[SW] Service Worker Fehler:', event.error);
});

// Unhandled Rejection Handler
self.addEventListener('unhandledrejection', event => {
    console.error('[SW] Unhandled Promise Rejection:', event.reason);
});

console.log('[SW] Service Worker geladen und bereit');
