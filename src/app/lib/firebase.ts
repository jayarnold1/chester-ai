import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBxtiQynWQugRJz3M1XgCxs220QsYlL81A",
  authDomain: "chester-ai-5ee4d.firebaseapp.com",
  projectId: "chester-ai-5ee4d",
  storageBucket: "chester-ai-5ee4d.firebasestorage.app",
  messagingSenderId: "591412018728",
  appId: "1:591412018728:web:d1fec45e44492b9072ff1d",
  measurementId: "G-8KJNRMS0K2",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export async function loginGoogle() {
  return signInWithPopup(auth, provider);
}
export async function loginEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}
export async function registerEmail(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred;
}
export async function logout() {
  return fbSignOut(auth);
}
export function watchAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
export type { User };
