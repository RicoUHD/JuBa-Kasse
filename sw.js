// JuBa-Kasse Service Worker
const CACHE_NAME = 'juba-kasse-v1.0.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-512.png'
];

// Install event - Cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache opened');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('Service Worker: Cache failed', err))
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - Serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // Fallback for offline scenario
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Push event - Handle push notifications
self.addEventListener('push', event => {
  console.log('Service Worker: Push event received', event);
  
  let notificationData = {};
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData = {
        title: 'JuBa-Kasse',
        body: event.data.text() || 'Neue Transaktion'
      };
    }
  } else {
    notificationData = {
      title: 'JuBa-Kasse',
      body: 'Neue Transaktion'
    };
  }

  const options = {
    body: notificationData.body || 'Eine neue Transaktion wurde hinzugefügt',
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    tag: 'juba-transaction',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      timestamp: Date.now(),
      ...notificationData.data
    },
    actions: [
      {
        action: 'view',
        title: 'Anzeigen',
        icon: '/icon-512.png'
      },
      {
        action: 'dismiss',
        title: 'Schließen'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'JuBa-Kasse',
      options
    )
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification click received', event);
  
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    // Open or focus the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          // Check if app is already open
          for (let client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window if app is not open
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
  // 'dismiss' action or other actions just close the notification (handled above)
});

// Background sync (for offline functionality)
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Here you could implement offline transaction sync
      console.log('Service Worker: Performing background sync')
    );
  }
});

// Message event - Communication with main thread
self.addEventListener('message', event => {
  console.log('=== SERVICE WORKER MESSAGE DEBUG ===');
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, type, amount, person } = event.data;
    
    console.log('Processing notification request:', { title, body, type, amount, person });
    
    let notificationBody = body;
    let icon = '/icon-512.png';
    
    // Customize notification based on transaction type
    if (type === 'payment') {
      notificationBody = `💰 Zahlung: ${person} hat ${amount} gezahlt`;
    } else if (type === 'donation') {
      notificationBody = `💝 Spende: ${amount} erhalten`;
      if (person) notificationBody += ` von ${person}`;
    } else if (type === 'expense') {
      notificationBody = `💸 Ausgabe: ${amount} für ${body}`;
    }
    
    console.log('Final notification body:', notificationBody);
    
    const options = {
      body: notificationBody,
      icon: icon,
      badge: '/icon-512.png',
      tag: 'juba-transaction',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: {
        url: '/',
        timestamp: Date.now(),
        type: type,
        amount: amount,
        person: person
      }
    };
    
    console.log('Attempting to show notification with options:', options);
    
    // Show notification and handle success/error
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('✅ Service Worker: Notification shown successfully');
      })
      .catch((error) => {
        console.error('❌ Service Worker: Error showing notification:', error);
      });
  } else {
    console.log('Service Worker: Unhandled message type or invalid data');
  }
  console.log('=== END SERVICE WORKER MESSAGE DEBUG ===');
});
