require('dotenv').config(); // <-- NEW: Load environment variables from a .env file
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer'); // <-- NEW: Import Nodemailer

// Initialize Firebase Admin safely using your Service Account JSON
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, 'firebase-service-account.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  throw new Error(`Failed to load Firebase service account from ${serviceAccountPath}: ${error.message}`);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const app = express();
app.use(cors());
app.use(express.json());

// Set up Local Storage using Multer
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
} catch (error) {
  throw new Error(`Failed to create upload directory at ${uploadDir}: ${error.message}`);
}
const frontendDir = path.join(__dirname, '..');
let indexHtml;
let manifestJson;
let serviceWorkerJs;
try {
  indexHtml = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');
  manifestJson = fs.readFileSync(path.join(frontendDir, 'manifest.json'), 'utf8');
  serviceWorkerJs = fs.readFileSync(path.join(frontendDir, 'sw.js'), 'utf8');
} catch (error) {
  throw new Error(`Failed to load frontend files: ${error.message}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // 1. Get the data sent from the frontend
    const rawName = req.body.name || 'Unbekannt';
    const rawDate = req.body.date || new Date().toISOString().split('T')[0];

    // 2. Sanitize to prevent invalid filename characters
    const safeName = rawName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeDate = rawDate.replace(/[^0-9-]/g, ''); 
    const ext = path.extname(file.originalname); // Keep the original extension (.jpg, .png)

    const prefix = `${safeName}-${safeDate}-`;

    // 3. Find existing files with the same prefix to determine the counter
    fs.readdir(uploadDir, (err, files) => {
      let counter = 1;
      
      if (!err && files) {
        // Filter files that match the prefix and the extension
        const matchingFiles = files.filter(f => f.startsWith(prefix) && f.endsWith(ext));
        
        if (matchingFiles.length > 0) {
          // Extract counters from existing files and find the max
          const counters = matchingFiles.map(f => {
            const parts = f.replace(ext, '').split('-');
            const lastPart = parts[parts.length - 1];
            return parseInt(lastPart) || 0;
          });
          counter = Math.max(...counters) + 1;
        }
      }
      
      // 4. Finalize the filename
      const finalFilename = `${prefix}${counter}${ext}`;
      cb(null, finalFilename);
    });
  }
});
const upload = multer({ storage });

// Security Middleware: Verify Firebase ID Token
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).send('Unauthorized');
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).send('Invalid token');
  }
};

// --- NEW: Nodemailer Transporter Setup ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});
// -----------------------------------------

// Route: Upload a receipt
app.post('/api/upload', verifyToken, upload.single('receipt'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  res.json({ filename: req.file.filename });
});

// Route: Fetch a receipt
app.get('/api/receipts/:filename', verifyToken, (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

// --- NEW: Route to Send Neutral Emails ---
app.post('/api/send-email', verifyToken, async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;

        if (!to || !subject) {
            return res.status(400).json({ error: 'Missing required fields: to, subject' });
        }

        const mailOptions = {
            from: `"JuBa-Kasse" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            text: text,
            html: html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        
        res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// Route to Notify Admins of a New Request
app.post('/api/notify-admins', verifyToken, async (req, res) => {
    try {
        const { reqType, personName } = req.body;

        if (!reqType || !personName) {
            return res.status(400).json({ error: 'Missing required fields: reqType, personName' });
        }

        // Map request types to German labels
        const typeLabels = { payment: 'Zahlung', status: 'Status', expense: 'Ausgabe', standing_order: 'Dauerauftrag' };
        const reqTypeLabel = typeLabels[reqType] || reqType;

        // Fetch ALL users securely from the backend using the Admin SDK
        const usersSnap = await admin.database().ref('users').once('value');
        if (!usersSnap.exists()) {
            return res.status(404).json({ error: 'No users found in database' });
        }

        const allUsers = usersSnap.val();
        
        // Filter out only the admins who have an email address
        const adminEmails = Object.values(allUsers)
            .filter(u => u.admin === true && u.email && u.emailNotifications === true)
            .map(u => u.email);

        if (adminEmails.length === 0) {
            return res.status(200).json({ message: 'No admins found to notify' });
        }

        // Send the email to all admins at once using an array
        const mailOptions = {
            from: `"JuBa-Kasse" <${process.env.EMAIL_USER}>`,
            to: adminEmails, 
            subject: 'Neue Anfrage bei JuBa-Kasse',
            text: `Eine neue Anfrage (${reqTypeLabel}) von ${personName} wurde eingereicht.\n\nBitte prüfe die Anfrage in der App.`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Admin notification sent successfully: %s', info.messageId);
        
        res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Error notifying admins:', error);
        res.status(500).json({ error: 'Failed to notify admins' });
    }
});
// -----------------------------------------

// Serve frontend files when running as an all-in-one deployment
app.use('/assets', express.static(path.join(frontendDir, 'assets')));
app.get('/manifest.json', (req, res) => res.type('application/manifest+json').send(manifestJson));
app.get('/sw.js', (req, res) => res.type('application/javascript').send(serviceWorkerJs));
app.get('*', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/assets/')) return next();
  if (req.path === '/sw.js' || req.path === '/manifest.json') return next();
  return res.type('text/html').send(indexHtml);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
