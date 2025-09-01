const Razorpay = require('razorpay');
const admin = require('firebase-admin');

// --- Service Initialization ---
let db;
let razorpay;

try {
    // Check for essential environment variables before proceeding. A crash here causes a 502 error.
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        throw new Error("Missing one or more required environment variables (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, FIREBASE_SERVICE_ACCOUNT_KEY). Please check your Netlify site settings.");
    }

    // Initialize Razorpay
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Initialize Firebase Admin
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    db = admin.firestore();

} catch (e) {
    console.error('FATAL_ERROR: Service initialization failed.', e.message);
    // If initialization fails, the function is not operational.
    // This log will appear in your Netlify function logs to help debug.
}

exports.handler = async function(event) {
    // If services failed to initialize due to errors above, return a clear error message.
    if (!db || !razorpay) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Server configuration error. Please check the function logs on Netlify for details.'
            })
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const data = JSON.parse(event.body);
        const userEmail = data.email.toLowerCase();

        console.log("create-subscription: Received data for user:", userEmail);

        let firebaseUid = '';
        try {
            const usersRef = db.collection('free_trial_users');
            const snapshot = await usersRef.where('email', '==', userEmail).limit(1).get();
            if (!snapshot.empty) {
                firebaseUid = snapshot.docs[0].id;
                console.log(`Found matching Firebase UID: ${firebaseUid} for email: ${userEmail}`);
            }
        } catch (dbError) {
            console.warn('Firestore lookup failed, but proceeding with payment creation. Error:', dbError);
        }

        const subscriptionOptions = {
            plan_id: data.plan_id, // This is the Razorpay Plan ID for "monthly"
            customer_notify: 1,
            total_count: 12,
            notes: {
                firebase_uid: firebaseUid || "N/A",
                user_email: userEmail,
                user_name: data.name,
                user_phone: data.phone,
                plan_description: data.description, // e.g., "Monthly Subscription"
                // =================================================================
                // FINAL FIX: Corrected the typo from `affiliate_id` to `data.affiliate_id`
                // =================================================================
                affiliate_id: data.affiliate_id || "direct"
            }
        };

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);

        return {
            statusCode: 200,
            body: JSON.stringify(subscription)
        };

    } catch (error) {
        console.error('Create Subscription Error:', error.error || error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Could not create subscription.',
                details: error.message
            })
        };
    }
};

