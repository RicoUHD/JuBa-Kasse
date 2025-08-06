# Firebase Cloud Messaging (FCM) Setup für JuBa-Kasse

## ✅ **VAPID Key bereits konfiguriert!**

Der öffentliche VAPID-Schlüssel ist bereits in `fcm.js` eingesetzt:
```
BJRqvPbTlLX5lTeCG6v8aCr-GJ9wvV2_r9VqJPbEFOCMgR_ecCzKMt15zVkQ0Aiq5Ick61g5GZXXw-kT2rUoew4
```

## 2. Firebase-Regeln aktualisieren

Fügen Sie in der Firebase Realtime Database diese Regeln hinzu:

```json
{
  "rules": {
    "fcm-tokens": {
      ".read": true,
      ".write": true
    },
    "notification-settings": {
      ".read": true,
      ".write": true
    },
    // ... andere bestehende Regeln
  }
}
```

## 3. Server-seitige Push-Benachrichtigungen (Optional)

Erstellen Sie eine Server-Funktion um Benachrichtigungen zu versenden:

### Cloud Function Beispiel (Node.js):
```javascript
const admin = require('firebase-admin');
const functions = require('firebase-functions');

exports.sendNotification = functions.database
  .ref('/people/{personId}/payments/{paymentId}')
  .onCreate(async (snapshot, context) => {
    const payment = snapshot.val();
    const personId = context.params.personId;
    
    // Alle FCM Tokens holen
    const tokensSnapshot = await admin.database()
      .ref('/fcm-tokens').once('value');
    const tokens = [];
    
    tokensSnapshot.forEach(child => {
      if (child.val().token) {
        tokens.push(child.val().token);
      }
    });
    
    if (tokens.length === 0) {
      console.log('Keine FCM Tokens verfügbar');
      return;
    }
    
    // Person-Daten holen
    const personSnapshot = await admin.database()
      .ref(`/people/${personId}`).once('value');
    const person = personSnapshot.val();
    
    const message = {
      notification: {
        title: 'Neue Zahlung eingegangen',
        body: `${person.name} hat ${payment.amount}€ bezahlt`
      },
      data: {
        action: 'new_payment',
        personId: personId,
        amount: payment.amount.toString()
      },
      tokens: tokens
    };
    
    try {
      const response = await admin.messaging().sendMulticast(message);
      console.log('Notifications gesendet:', response);
    } catch (error) {
      console.error('Fehler beim Senden:', error);
    }
  });
```

## 4. Test der Implementierung

### 4.1 Lokaler Test:
1. Öffnen Sie die App im Browser
2. Gehen Sie zu **Einstellungen**
3. Klicken Sie auf "Aktivieren" bei Push-Benachrichtigungen
4. Erlauben Sie Benachrichtigungen wenn gefragt
5. Klicken Sie auf "Test senden"

### 4.2 Manual Test via Firebase Console:
1. Gehen Sie zur Firebase Console > Cloud Messaging
2. Klicken Sie "Send your first message"
3. Titel: "Test Notification"
4. Text: "Dies ist ein Test"
5. Als Ziel wählen Sie "Single device" und fügen ein FCM Token ein
6. Senden Sie die Nachricht

## 5. PWA Installation

### Für lokale Entwicklung:
1. Stellen Sie sicher, dass die App über HTTPS läuft (für Service Worker)
2. Öffnen Sie Chrome DevTools > Application > Service Workers
3. Prüfen Sie ob der Service Worker registriert ist
4. Gehen Sie zu Application > Manifest
5. Klicken Sie "Add to homescreen" um die PWA zu installieren

### Für Produktion:
1. Hosten Sie die App auf einem HTTPS-Server
2. Stellen Sie sicher, dass alle Pfade korrekt sind
3. Testen Sie die Installation auf verschiedenen Geräten

## 6. Debugging

### Browser Developer Tools:
- **Application > Service Workers**: Status des Service Workers
- **Application > Storage > Local Storage**: Gespeicherte FCM Tokens
- **Console**: FCM Logs und Fehler
- **Network**: Firebase API Calls

### Häufige Probleme:
1. **"Notifications not supported"**: Browser unterstützt keine Notifications
2. **"Permission denied"**: Benutzer hat Berechtigung verweigert
3. **"Service Worker registration failed"**: HTTPS oder Pfad-Problem
4. **"No FCM token"**: VAPID Key falsch oder Firebase-Projekt nicht konfiguriert

## 7. Produktive Nutzung

### Wichtige Einstellungen:
1. Ersetzen Sie den VAPID Key durch Ihren eigenen
2. Passen Sie die Notification-Texte an Ihre Bedürfnisse an
3. Konfigurieren Sie die automatischen Erinnerungen
4. Stellen Sie sicher, dass Firebase-Regeln sicher sind

### Monitoring:
- Überwachen Sie FCM Token in der Firebase Console
- Prüfen Sie regelmäßig die Delivery-Raten
- Implementieren Sie Analytics für Notification-Interaktionen

## 8. Erweiterte Features

### Push-to-Refresh:
```javascript
// In sw.js hinzufügen
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(syncData());
  }
});
```

### Rich Notifications:
```javascript
// Erweiterte Notification-Optionen
const options = {
  body: 'Notification text',
  icon: '/icon-192.png',
  badge: '/badge-72.png',
  image: '/notification-image.png',
  actions: [
    { action: 'view', title: 'Anzeigen' },
    { action: 'dismiss', title: 'Schließen' }
  ],
  data: { url: '/specific-page' }
};
```

Diese Implementierung macht Ihre JuBa-Kasse PWA vollständig notification-fähig mit Firebase Cloud Messaging Integration!
