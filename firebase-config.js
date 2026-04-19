// ============================================
// FIREBASE KONFIGURACE
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyCRQUi7n-663fGB6F0hjsiOiXPHpvmnFOY",
    authDomain: "katareceptystranka.firebaseapp.com",
    projectId: "katareceptystranka",
    storageBucket: "katareceptystranka.firebasestorage.app",
    messagingSenderId: "469889683004",
    appId: "1:469889683004:web:2575103d11ae7657e47d39",
    measurementId: "G-SJDQHYE49C"
};

// Inicializace Firebase
firebase.initializeApp(firebaseConfig);

// Reference na služby
const db = firebase.firestore();
const auth = firebase.auth();

console.log('✓ Firebase inicializován');
