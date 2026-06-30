import { create } from 'zustand';
import { collection, getDocs, doc, updateDoc, orderBy, query, increment, serverTimestamp } from 'firebase/firestore';
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

  /**
   * 슈퍼관리자가 사용자에게 코인 부여. amount 가 음수면 차감.
   * firestore.rules: super_admin 은 userProfiles 전체 필드 update 가능.
   */
  grantCoins: async (uid, amount) => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) return;
    try {
      const updates = {
        coinBalance: increment(n),
        lastChargedAt: serverTimestamp(),
      };
      if (n > 0) updates.coinEarned = increment(n);
      else updates.coinSpent = increment(-n);
      await updateDoc(doc(db, 'userProfiles', uid), updates);
      set((state) => ({
        users: state.users.map((u) =>
          u.id === uid
            ? {
                ...u,
                coinBalance: (u.coinBalance || 0) + n,
                coinEarned: n > 0 ? (u.coinEarned || 0) + n : u.coinEarned,
                coinSpent: n < 0 ? (u.coinSpent || 0) + -n : u.coinSpent,
              }
            : u
        ),
      }));
    } catch (err) {
      console.error('Failed to grant coins:', err);
      alert(`코인 충전 실패: ${err.message}`);
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
