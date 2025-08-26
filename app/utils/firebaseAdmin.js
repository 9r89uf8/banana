// utils/firebaseAdmin.js
import admin from 'firebase-admin';

const adminConfig = {
    project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(adminConfig),
        databaseURL: `https://${adminConfig.project_id}.firebaseio.com`,
    });
}

const adminDb = admin;
const adminAuth = admin.auth();

export { adminDb, adminAuth };
