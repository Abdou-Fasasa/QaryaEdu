import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, push, child, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCeqIW5wOy2HTwGABE1m8lYmnbeJufCLIE",
  authDomain: "qaryaedu.firebaseapp.com",
  projectId: "qaryaedu",
  storageBucket: "qaryaedu.firebasestorage.app",
  messagingSenderId: "780311452202",
  appId: "1:780311452202:web:13dff1bb3dd3d9ea18c153",
  databaseURL: "https://qaryaedu-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
auth.languageCode = 'ar';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// get() does not populate the cache used by runTransaction(). Keep a value
// subscription alive until the transaction finishes so its first callback has
// the complete node instead of null, which would abort validation immediately.
async function runTransactionWithServerState(reference, updater, options) {
  let unsubscribe;
  try {
    await new Promise((resolve, reject) => {
      unsubscribe = onValue(reference, () => resolve(), reject);
    });
    return await runTransaction(reference, updater, options);
  } finally {
    unsubscribe?.();
  }
}

window.QaryaFirebase = {
  app,
  db,
  auth,
  ref,
  set,
  get,
  onValue,
  update,
  push,
  child,
  runTransaction: runTransactionWithServerState,
  GoogleAuthProvider,
  googleProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  onAuthStateChanged,
  signOut
};

window.QaryaFirebaseAuthReady = setPersistence(auth, browserLocalPersistence)
  .then(() => auth)
  .catch((error) => {
    console.error('Firebase auth bootstrap error:', error);
    return auth;
  });

window.dispatchEvent(new CustomEvent('qarya:firebase-ready', {
  detail: {
    databaseURL: firebaseConfig.databaseURL,
    projectId: firebaseConfig.projectId
  }
}));
