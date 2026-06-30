import { create } from 'zustand';
import useAppStore from './useAppStore';
import { publishToTechBlog } from '../utils/publishApi';

const usePublishStore = create((set) => ({
  status: 'idle',
  result: null,
  error: null,
  modalOpen: false,

  openModal: () => set({ modalOpen: true, status: 'idle', result: null, error: null }),
  closeModal: () => set({ modalOpen: false }),
  reset: () => set({ status: 'idle', result: null, error: null }),

  startPublish: async () => {
    const { activeFileContent, activeFileId, files, uid } = useAppStore.getState();
    if (!activeFileContent) {
      set({ status: 'error', error: '편집 중인 문서가 없습니다.' });
      return;
    }

    // tech-blog 게시는 슈퍼관리자 전용 (UI 가드 + store 우회 방지 가드)
    try {
      const { default: useAuthStore } = await import('./useAuthStore');
      const role = useAuthStore.getState().userProfile?.role;
      if (role !== 'super_admin') {
        set({ status: 'error', error: 'tech-blog 게시는 슈퍼관리자만 가능합니다.' });
        return;
      }
    } catch (err) {
      set({ status: 'error', error: `권한 확인 실패: ${err.message}` });
      return;
    }

    const file = files.find((f) => f.id === activeFileId);
    const name = file?.name || 'Untitled';

    // tech-blog 자동 번역 게시 — 큰 LLM 비용 사전 차감
    try {
      const { chargeCoin } = await import('../utils/coin');
      await chargeCoin(uid, 'publishTechBlog');
    } catch (err) {
      set({ status: 'error', error: err.message });
      return;
    }

    set({ status: 'publishing', result: null, error: null });
    try {
      const result = await publishToTechBlog({ html: activeFileContent, name });
      set({ status: 'success', result });
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('publishToTechBlog failed:', err);
      set({ status: 'error', error: msg });
    }
  },
}));

export default usePublishStore;
