# Nova

JuBa-Kasse (Nova) is a web-based financial management application for small groups, clubs, or flatshares. It provides features to track income, expenses, donations, and individual members' contributions. The app consists of a frontend written in HTML/JS and a Node.js backend for handling file uploads, email notifications, and configuration.

## Running the Application

Nova is distributed as an all-in-one Docker image. It includes both the frontend and the backend server.

### Quick Start (Docker)

To run Nova, pull the latest image and start a container. It is highly recommended to map the `/app/data` path to a persistent storage pool or volume, as this is where your configuration and uploaded receipts will be saved.

```bash
docker pull ghcr.io/<owner>/<repo>:latest

docker run -d \
  -p 3000:3000 \
  -v /path/to/your/storage:/app/data \
  --name nova-app \
  --restart unless-stopped \
  ghcr.io/<owner>/<repo>:latest
```

*Replace `/path/to/your/storage` with a directory on your host machine to ensure your data survives container restarts.*

## Setup Wizard

When you first access the application at `http://localhost:3000` (or your mapped port), you will be greeted by the built-in Setup Wizard. You will need to provide:

1. **App Name:** The name of your instance (e.g., Nova).
2. **Firebase Frontend Config:** The JSON object from your Firebase Project Settings.
3. **Firebase Service Account:** A newly generated private key JSON from Firebase > Project Settings > Service Accounts.
4. **SMTP Details (Optional):** Credentials for a mail server to send automated status and request notifications.

Once configured, the app will save this data to `/app/data/config.json` and start the main application seamlessly.

## First User Setup (Admin)

For the first user to access the administrative dashboard and manage other users, they must manually be set as an administrator in the database.

1.  Register a new account via the Nova web interface (requires the default invite code: `123456` if not changed).
2.  Open your [Firebase Console](https://console.firebase.google.com/).
3.  Navigate to **Realtime Database**.
4.  Find the `users` node and locate your newly created user ID (`uid`).
5.  Add or modify the `admin` key under your `uid` and set its value to boolean `true`.

    Example:
    ```json
    "users": {
      "your_uid_here": {
        "admin": true,
        "email": "you@example.com",
        "firstName": "John",
        "lastName": "Doe"
      }
    }
    ```

## Firebase Database Rules

To secure your application, apply the following rules in your Firebase Realtime Database settings. These rules ensure that only administrators can access all data, while regular users can only access their specific information.

```json
{
  "rules": {
    "people": {
      ".indexOn": ["uid", "name"],
      // FIX 1: Allow Admin to read the whole list.
      // FIX 2: Allow Users to read ONLY if they use the specific query "uid == auth.uid".
      ".read": "root.child('users').child(auth.uid).child('admin').val() === true || (query.orderByChild === 'uid' && query.equalTo === auth.uid)",
      ".write": "root.child('users').child(auth.uid).child('admin').val() === true",
      "$person_id": {
        // Fallback for reading a single ID directly if needed
        ".read": "data.child('uid').val() === auth.uid || root.child('users').child(auth.uid).child('admin').val() === true"
      }
    },
    "donations": {
      // Only Admin can read/write the list
      ".read": "root.child('users').child(auth.uid).child('admin').val() === true",
      ".write": "root.child('users').child(auth.uid).child('admin').val() === true"
    },
    "expenses": {
      // Only Admin can read/write the list
      ".read": "root.child('users').child(auth.uid).child('admin').val() === true",
      ".write": "root.child('users').child(auth.uid).child('admin').val() === true"
    },
    "requests": {
      ".indexOn": ["userId", "status"],
      // Allow Admin read all OR User query their own
      ".read": "root.child('users').child(auth.uid).child('admin').val() === true || (query.orderByChild === 'userId' && query.equalTo === auth.uid)",
      "$req_id": {
        ".write": "(newData.exists() && newData.child('userId').val() === auth.uid) || root.child('users').child(auth.uid).child('admin').val() === true",
        ".read": "data.child('userId').val() === auth.uid || root.child('users').child(auth.uid).child('admin').val() === true"
      }
    },
    "settings": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('admin').val() === true"
    },
    "system": {
      "inviteCode": {
        // Necessary for your app.js registration check
        ".read": true,
        ".write": "root.child('users').child(auth.uid).child('admin').val() === true"
      }
    },
    "users": {
      // Admin needs to read the list of users to find 'Unlinked Users'
      ".read": "root.child('users').child(auth.uid).child('admin').val() === true",
      "$uid": {
        // Users can read their own profile, Admins can read any profile
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('admin').val() === true",
        // Admins can write to any profile (including their own).
        // Standard users can write to their own profile, but cannot give themselves admin rights.
        ".write": "root.child('users').child(auth.uid).child('admin').val() === true || ($uid === auth.uid && newData.child('admin').val() !== true)"
      }
    }
  }
}
```

## License

This project is licensed under the newest GNU General Public License (GPLv3). See the `LICENSE` file for more details.
