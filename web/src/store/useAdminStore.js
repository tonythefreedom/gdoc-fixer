import { create } from 'zustand';
import { collection, getDocs, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

const useAdminStore = create((set) => ({
  users: [],
  usersLoading: false,

  loadAllUsers: async () => {
    set({ usersLoading: true });
    try {
      const q = query(collection(db, 'userProfiles'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      set({ users, usersLoading: false });
    } catch (err) {
      console.error('Failed to load users:', err);
      set({ usersLoading: false });
    }
  },

  approveUser: async (uid) => {
    try {
      await updateDoc(doc(db, 'userProfiles', uid), {
        status: 'approved',
        updatedAt: Date.now(),
      });
      set((state) => ({
        users: state.users.map((u) =>
          u.id === uid ? { ...u, status: 'approved', updatedAt: Date.now() } : u
        ),
      }));
    } catch (err) {
      console.error('Failed to approve user:', err);
    }
  },

  rejectUser: async (uid) => {
    try {
      await updateDoc(doc(db, 'userProfiles', uid), {
        status: 'rejected',
        updatedAt: Date.now(),
      });
      set((state) => ({
        users: state.users.map((u) =>
          u.id === uid ? { ...u, status: 'rejected', updatedAt: Date.now() } : u
        ),
      }));
    } catch (err) {
      console.error('Failed to reject user:', err);
    }
  },
}));

export default useAdminStore;
