# JuBa-Kasse

Ein Open-Source-Projekt zur Verwaltung einer gemeinsamen Kasse.

## Features

- Verwaltung von Mitgliedern und deren Beitragsstatus
- Übersicht über Einnahmen, Ausgaben und Spenden
- Daueraufträge und Zahlungsverlauf
- Dark Mode / Light Mode
- Progressive Web App (PWA) – Installierbar auf mobilen Geräten und Desktops
- (Optional) Backend für Beleg-Uploads und Status-E-Mails

## Voraussetzungen

Um JuBa-Kasse zu nutzen, benötigen Sie ein **Firebase-Projekt** (kostenloser Spark-Plan ist ausreichend). Das Projekt nutzt Firebase Authentication zur Anmeldung und die Realtime Database zur Datenspeicherung.

1. Gehen Sie auf [Firebase Console](https://console.firebase.google.com/) und erstellen Sie ein neues Projekt.
2. Aktivieren Sie **Authentication** und fügen Sie den Anmeldeanbieter **E-Mail-Adresse/Passwort** hinzu.
3. Aktivieren Sie die **Realtime Database** (Testmodus oder Produktionsmodus).

### Realtime Database Regeln

Kopieren Sie folgende Regeln in den Reiter "Regeln" Ihrer Realtime Database. Diese stellen sicher, dass nur authentifizierte Nutzer lesen und schreiben können, und dass normale Nutzer nur bestimmte Teile der Datenbank sehen können:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('admin').val() === true",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('admin').val() === true"
      }
    },
    "settings": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('admin').val() === true"
    },
    "people": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('admin').val() === true"
    },
    "donations": {
      ".read": "root.child('users').child(auth.uid).child('admin').val() === true",
      ".write": "root.child('users').child(auth.uid).child('admin').val() === true"
    },
    "expenses": {
      ".read": "root.child('users').child(auth.uid).child('admin').val() === true",
      ".write": "root.child('users').child(auth.uid).child('admin').val() === true"
    },
    "system": {
       ".read": "true",
       ".write": "root.child('users').child(auth.uid).child('admin').val() === true"
    },
    "requests": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

## Setup (Frontend)

Die Anwendung ist als reine statische Webseite konzipiert und kann auf jedem Webserver, GitHub Pages, Vercel oder Netlify gehostet werden.

1. Starten Sie die App in Ihrem Browser.
2. Beim ersten Aufruf erscheint der **Setup Wizard**.
3. Gehen Sie in Ihrer Firebase Console zu den Projekteinstellungen. Dort finden Sie die Konfiguration für Ihre Web-App.
4. Tragen Sie die Werte (`apiKey`, `authDomain`, `databaseURL` usw.) in das Formular ein und speichern Sie.
5. Registrieren Sie sich mit einem neuen Account. *Hinweis: Der erste Benutzer muss manuell in der Firebase Realtime Database im Pfad `/users/{Ihre-UID}` das Feld `admin: true` gesetzt bekommen, um administrative Rechte zu erhalten.*

Die Konfiguration wird in Ihrem Browser (`localStorage`) gespeichert. Sie können die Konfiguration jederzeit in den Einstellungen zurücksetzen.

## Optionales Node.js Backend

JuBa-Kasse kann komplett **ohne Backend** genutzt werden (Client-Only).
Wenn Sie jedoch Belege (Bilder) hochladen oder Status-E-Mails an Mitglieder senden möchten, benötigen Sie das mitgelieferte Node.js-Backend.

### Einrichtung des Backends

1. Navigieren Sie in den Ordner `backend`:
   ```bash
   cd backend
   npm install
   ```
2. Sie benötigen eine `firebase-service-account.json`. Generieren Sie in der Firebase Console unter "Projekteinstellungen" -> "Dienstkonten" einen neuen privaten Schlüssel und speichern Sie diesen als `backend/firebase-service-account.json`.
3. Erstellen Sie eine `.env` Datei im `backend`-Ordner mit folgendem Inhalt:
   ```env
   FIREBASE_DATABASE_URL=https://<IHR-PROJEKT-ID>.europe-west1.firebasedatabase.app
   EMAIL_USER=ihre.email@gmail.com
   EMAIL_PASS=ihr_app_passwort
   ```
   *(Ersetzen Sie die Werte entsprechend. Für Google Mail benötigen Sie ein [App-Passwort](https://myaccount.google.com/apppasswords))*
4. Starten Sie den Server:
   ```bash
   npm start
   ```

Wenn das Backend läuft (z.B. auf `http://localhost:3000/api`), können Sie diese URL im Setup Wizard des Frontends eintragen. Die Buttons für Uploads und E-Mails werden dann automatisch sichtbar.
