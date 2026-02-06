import { create } from 'zustand';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,

  initAuth: () => {
    onAuthStateChanged(auth, (user) => {
      set({ user, loading: false });
    });
  },

  signInWithGoogle: async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google sign-in failed:', err);
      throw err;
    }
  },

  signOut: async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Sign-out failed:', err);
      throw err;
    }
  },
}));

export default useAuthStore;
