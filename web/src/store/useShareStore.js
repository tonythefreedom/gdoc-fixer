import { create } from 'zustand';
import { loadUserShares, deleteShare } from '../utils/shareUrl';

const useShareStore = create((set) => ({
  shares: [],
  uid: null,

  loadShares: async (uid) => {
    set({ uid });
    try {
      const shares = await loadUserShares(uid);
      set({ shares });
    } catch (err) {
      console.error('Failed to load shares:', err);
    }
  },

  addShare: (share) => {
    set((state) => ({
      shares: [share, ...state.shares],
    }));
  },

  removeShare: async (shareId) => {
    try {
      await deleteShare(shareId);
      set((state) => ({
        shares: state.shares.filter((s) => s.id !== shareId),
      }));
    } catch (err) {
      console.error('Failed to delete share:', err);
    }
  },

  // 로그아웃 / 사용자 전환 시 호출
  reset: () => set({ shares: [], uid: null }),
}));

export default useShareStore;
