# JuBa-Kasse

JuBa-Kasse is a web-based financial management application for small groups, clubs, or flatshares. It provides features to track income, expenses, donations, and individual members' contributions. The app consists of a frontend written in HTML/JS and a Node.js backend for handling file uploads and email notifications.

## Running the Application Locally

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Serve the Frontend:**
    You can use any simple HTTP server to serve the static frontend files. For example, using Python:
    ```bash
    # Python 3
    python3 -m http.server 8000
    ```
    Then, open `http://localhost:8000` in your web browser.

3.  **Firebase Setup:**
    The application relies on Firebase for authentication and database services. You need to create a Firebase project and configure it in the `assets/config.js` file:
    ```javascript
    export const config = {
        firebaseConfig: {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
            databaseURL: "https://YOUR_PROJECT_ID.firebasedatabase.app",
            projectId: "YOUR_PROJECT_ID",
            storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
            messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
            appId: "YOUR_APP_ID"
        },
        apiBaseUrl: "http://localhost:3000/api" // Point this to your backend or skip if using without backend
    };
    ```

## Using the App Without the Backend

You can run JuBa-Kasse purely as a frontend application if you do not need features like receipt image uploads or automated email notifications.

To do so, simply skip starting the Node.js server located in the `backend/` directory. The core functionality, such as managing people, recording transactions, and viewing statistics, will still work entirely via Firebase.

## First User Setup (Admin)

For the first user to access the administrative dashboard and manage other users, they must manually be set as an administrator in the database.

1.  Register a new account via the JuBa-Kasse web interface.
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

## Optional: Backend Installation

If you wish to use features like receipt image uploads or automated email notifications, you need to set up the Node.js backend.

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the `backend/` directory:
    ```bash
    touch .env
    ```
    Add the following variables to the `.env` file, replacing the placeholder values with your actual credentials:
    ```env
    # Your Firebase Database URL
    FIREBASE_DATABASE_URL="https://YOUR_PROJECT_ID.firebasedatabase.app"

    # Gmail credentials for sending notifications
    EMAIL_USER="your-email@gmail.com"
    EMAIL_PASS="your-app-password"
    ```
    *Note: If using Gmail, it is highly recommended to use an [App Password](https://support.google.com/accounts/answer/185833).*

4.  **Add Firebase Service Account JSON:**
    To allow the backend to communicate securely with Firebase, you must provide a service account key.
    - Go to your [Firebase Console](https://console.firebase.google.com/).
    - Navigate to **Project Settings** (the gear icon) > **Service Accounts**.
    - Click on **Generate new private key**.
    - Save the downloaded JSON file as `firebase-service-account.json` and place it directly inside the `backend/` directory.

5.  **Start the Server:**
    ```bash
    npm start
    ```
    The backend server will start running on `http://localhost:3000`. Ensure that your frontend's `apiBaseUrl` in `assets/config.js` is set to point to this URL.
