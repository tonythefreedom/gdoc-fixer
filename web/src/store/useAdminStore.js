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

  /**
   * 승인 / 언블록 — status 를 'approved' 로. 이전이 'pending' 또는
   * 'blocked' 면 가입 축하/환영 이메일 발송. 'approved' → 'approved' 는 noop.
   */
  approveUser: async (uid) => {
    try {
      const prev = (await import('zustand').then(() => null), null);
      const before = (typeof window !== 'undefined' ? (window.__lastUsersSnapshot__ || null) : null);
      void prev; void before;
      // 현재 status 확인 위해 store 상태 사용
      const current = (typeof window !== 'undefined') ? null : null;
      void current;

      // 간단히 — 현재 행의 status 가 'pending' 또는 'blocked' 일 때만 이메일.
      let needEmail = false;
      let userEmail = null;
      let userName = null;
      // store 내부 접근 (set/get) 패턴이 아닌 외부 모듈에서 — 한 번 dynamic import
      const { default: store } = await import('./useAdminStore');
      const u = store.getState().users.find((x) => x.id === uid);
      if (u && (u.status === 'pending' || u.status === 'blocked')) {
        needEmail = true;
        userEmail = u.email;
        userName = u.displayName || '';
      }

      await updateDoc(doc(db, 'userProfiles', uid), {
        status: 'approved',
        updatedAt: Date.now(),
      });
      set((state) => ({
        users: state.users.map((u) =>
          u.id === uid ? { ...u, status: 'approved', updatedAt: Date.now() } : u
        ),
      }));

      if (needEmail && userEmail) {
        try {
          const { auth } = await import('../firebase');
          const idToken = await auth.currentUser?.getIdToken();
          if (idToken) {
            await fetch('/api/welcome-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
              body: JSON.stringify({ kind: 'admin-approve', targetUid: uid, targetEmail: userEmail, targetName: userName }),
            });
          }
        } catch (e) {
          console.warn('admin approve welcome email failed:', e);
        }
      }
    } catch (err) {
      console.error('Failed to approve user:', err);
    }
  },

  /**
   * 블록 — status 를 'blocked' 로. 이미 'blocked' 면 noop.
   */
  blockUser: async (uid) => {
    try {
      await updateDoc(doc(db, 'userProfiles', uid), {
        status: 'blocked',
        updatedAt: Date.now(),
      });
      set((state) => ({
        users: state.users.map((u) =>
          u.id === uid ? { ...u, status: 'blocked', updatedAt: Date.now() } : u
        ),
      }));
    } catch (err) {
      console.error('Failed to block user:', err);
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
