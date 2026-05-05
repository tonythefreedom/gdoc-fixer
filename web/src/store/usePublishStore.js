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
    const { activeFileContent, activeFileId, files } = useAppStore.getState();
    if (!activeFileContent) {
      set({ status: 'error', error: '편집 중인 문서가 없습니다.' });
      return;
    }
    const file = files.find((f) => f.id === activeFileId);
    const name = file?.name || 'Untitled';

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
