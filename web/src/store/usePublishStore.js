import { create } from 'zustand';
import useAppStore from './useAppStore';
import { publishToTechBlog, publishToCommunity, publishToLinkedIn } from '../utils/publishApi';

// 연쇄 게시 단계 정의: tech-blog → 커뮤니티 → LinkedIn
//   각 단계의 "출처"는 원문이 아니라 직전 체인 사이트로 연결된다.
const CHAIN_STEPS = [
  { key: 'techblog', label: 'tech-blog 게시', hint: '영문 자동 번역 · tony.banya.ai' },
  { key: 'community', label: '커뮤니티 게시', hint: 'AI/LLM · 출처=tech-blog 글' },
  { key: 'linkedin', label: 'LinkedIn 게시', hint: '조직 페이지 · 출처=커뮤니티 글' },
];

const initialSteps = () => CHAIN_STEPS.map((s) => ({ ...s, status: 'pending', url: null, error: null }));

const usePublishStore = create((set, get) => ({
  status: 'idle', // 'idle' | 'publishing' | 'success' | 'partial' | 'error'
  result: null,
  error: null,
  modalOpen: false,
  target: 'chain', // 'chain' (연쇄 게시)
  steps: initialSteps(),

  openModal: (target = 'chain') =>
    set({ modalOpen: true, target, status: 'idle', result: null, error: null, steps: initialSteps() }),
  closeModal: () => set({ modalOpen: false }),
  reset: () => set({ status: 'idle', result: null, error: null, steps: initialSteps() }),

  // 모달의 "게시" 버튼 → 현재 편집 중인 문서로 연쇄 게시 시작
  startPublish: async () => {
    const { activeFileContent, activeFileId, files } = useAppStore.getState();
    if (!activeFileContent) {
      set({ status: 'error', error: '편집 중인 문서가 없습니다.' });
      return;
    }
    const name = files.find((f) => f.id === activeFileId)?.name || 'Untitled';
    return get()._runChain({ html: activeFileContent, name });
  },

  // 공유(shared) 문서를 연쇄 게시 — 모달을 바로 진행 상태로 열고 처리
  publishSharedToCommunity: async ({ id, name }) => {
    if (!(await get()._ensureSuperAdmin())) {
      set({ modalOpen: true, target: 'chain', status: 'error', steps: initialSteps(), error: '연쇄 게시는 수퍼관리자만 가능합니다.' });
      return;
    }
    set({ modalOpen: true, target: 'chain', status: 'publishing', result: null, error: null, steps: initialSteps() });
    try {
      const { fetchSharedHtml } = await import('../utils/shareUrl');
      const html = await fetchSharedHtml(id);
      if (!html) throw new Error('공유 문서를 찾을 수 없습니다.');
      return get()._runChain({ html, name });
    } catch (err) {
      set({ status: 'error', error: err?.message || String(err) });
    }
  },

  _ensureSuperAdmin: async () => {
    try {
      const { default: useAuthStore } = await import('./useAuthStore');
      return useAuthStore.getState().userProfile?.role === 'super_admin';
    } catch {
      return false;
    }
  },

  _setStep: (key, patch) =>
    set((state) => ({ steps: state.steps.map((s) => (s.key === key ? { ...s, ...patch } : s)) })),

  // 연쇄 게시 본체: tech-blog → 커뮤니티 → LinkedIn
  _runChain: async ({ html, name }) => {
    if (!(await get()._ensureSuperAdmin())) {
      set({ status: 'error', error: '연쇄 게시는 수퍼관리자만 가능합니다.' });
      return;
    }
    set({ status: 'publishing', result: null, error: null, steps: initialSteps() });
    const result = { techBlogUrl: null, communityUrl: null, linkedInUrl: null, linkedInSkipped: false };

    // 0) 게시-경계 정규화: 콘텐츠를 self-contained(inline-only)로 구워
    //    프리뷰·tech-blog·커뮤니티·LinkedIn 어디서나 동일하게 렌더되도록.
    let publishHtml = html;
    try {
      const { normalizeForPublish } = await import('../utils/normalizeForPublish');
      publishHtml = await normalizeForPublish(html);
    } catch (e) {
      console.warn('[publish] 정규화 스킵 — 원본 게시:', e);
    }

    // 1) tech-blog
    get()._setStep('techblog', { status: 'running' });
    try {
      const r = await publishToTechBlog({ html: publishHtml, name });
      result.techBlogUrl = r?.url || null;
      get()._setStep('techblog', { status: 'success', url: result.techBlogUrl });
    } catch (err) {
      get()._setStep('techblog', { status: 'error', error: err?.message || String(err) });
      set({ status: 'error', result, error: `tech-blog 게시 실패: ${err?.message || err}` });
      return;
    }

    // 2) 커뮤니티 (출처 = tech-blog 글)
    get()._setStep('community', { status: 'running' });
    try {
      const r = await publishToCommunity({ html: publishHtml, name, sourceUrl: result.techBlogUrl });
      result.communityUrl = r?.url || null;
      get()._setStep('community', { status: 'success', url: result.communityUrl });
    } catch (err) {
      get()._setStep('community', { status: 'error', error: err?.message || String(err) });
      set({ status: 'error', result, error: `커뮤니티 게시 실패: ${err?.message || err}` });
      return;
    }

    // 3) LinkedIn (출처 = 커뮤니티 글) — 미설정 시 건너뜀(partial)
    get()._setStep('linkedin', { status: 'running' });
    try {
      const r = await publishToLinkedIn({ title: name, url: result.communityUrl });
      if (r?.skipped) {
        result.linkedInSkipped = true;
        get()._setStep('linkedin', { status: 'skipped', error: r.reason || 'LinkedIn 미설정' });
        set({ status: 'partial', result });
        return;
      }
      result.linkedInUrl = r?.url || null;
      get()._setStep('linkedin', { status: 'success', url: result.linkedInUrl });
      set({ status: 'success', result });
    } catch (err) {
      // LinkedIn 실패는 앞선 게시를 되돌리지 않는다(부분 성공).
      get()._setStep('linkedin', { status: 'error', error: err?.message || String(err) });
      set({ status: 'partial', result, error: `LinkedIn 게시 실패: ${err?.message || err}` });
    }
  },
}));

export default usePublishStore;
