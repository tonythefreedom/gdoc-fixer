import { create } from 'zustand';
import { convertHtmlToSlides, modifySlideHtml, modifyAllSlidesHtml, fixSingleSlideViewport, renderSlideToBase64 } from '../utils/geminiApi';
import {
  loadPresentationList,
  createPresentationDoc,
  updatePresentationSlides,
  updatePresentationGenerationProgress,
  deletePresentationDoc,
  renamePresentationDoc,
  uploadSlideImages,
} from './storage';

const useSlideStore = create((set, get) => ({
  presentations: [],
  activePresentationId: null,
  slides: [],
  slideHistories: [],
  currentSlideIndex: 0,
  isGenerating: false,
  modifyingSlideIndices: [],
  isModifyingAll: false,
  presentationSnapshots: [],
  uid: null,

  // 생성 진행률: { phase, current, total, message } | null
  generationProgress: null,

  loadPresentations: async (uid) => {
    set({ uid });
    try {
      const list = await loadPresentationList(uid);
      set({ presentations: list });

      // 미완료 생성 작업 자동 재개
      const generating = list.find((p) => p.generationStatus === 'generating');
      if (generating) {
        get().resumeGeneration(generating.id);
      }
    } catch (err) {
      console.error('Failed to load presentations:', err);
    }
  },

  generateSlides: async (html, sourceFileId, fileName) => {
    const { uid } = get();
    if (!uid) return;

    set({ isGenerating: true, generationProgress: { phase: 'converting', current: 0, total: 0, message: 'Gemini AI로 슬라이드 생성 중...' } });

    try {
      // Phase 1: HTML → 슬라이드 변환
      let slides = await convertHtmlToSlides(html);
      const slideHistories = slides.map(() => []);

      // Phase 2: Firestore에 초안 저장 (페이지 갱신 시 재개 가능)
      const now = Date.now();
      const presId = now.toString(36) + Math.random().toString(36).slice(2, 6);
      const pres = {
        id: presId,
        name: `${fileName} 프레젠테이션`,
        sourceFileId,
        slides,
        slideHistories,
        generationStatus: 'generating',
        viewportFixedCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      await createPresentationDoc(uid, pres);
      set((state) => ({
        presentations: [...state.presentations, pres],
        activePresentationId: presId,
        slides,
        slideHistories,
        currentSlideIndex: 0,
        generationProgress: { phase: 'fixing', current: 0, total: slides.length, message: '뷰포트 수정 준비 중...' },
      }));

      // Phase 3: 뷰포트 수정 (슬라이드별, 진행률 업데이트)
      for (let i = 0; i < slides.length; i++) {
        set({ generationProgress: { phase: 'fixing', current: i, total: slides.length, message: `뷰포트 수정: 슬라이드 ${i + 1}/${slides.length}` } });
        try {
          slides[i] = await fixSingleSlideViewport(slides[i]);
        } catch (err) {
          console.warn(`슬라이드 ${i + 1} 뷰포트 수정 실패:`, err);
        }
        // 진행 저장
        await updatePresentationSlides(uid, presId, slides, slideHistories);
        await updatePresentationGenerationProgress(uid, presId, { viewportFixedCount: i + 1 });
        set({ slides: [...slides] });
      }

      // Phase 4: 이미지 업로드
      set({ generationProgress: { phase: 'uploading', current: 0, total: slides.length, message: '이미지 업로드 준비 중...' } });
      for (let i = 0; i < slides.length; i++) {
        set({ generationProgress: { phase: 'uploading', current: i, total: slides.length, message: `이미지 업로드: 슬라이드 ${i + 1}/${slides.length}` } });
        slides[i] = await uploadSlideImages(uid, presId, i, slides[i]);
      }

      // Phase 5: 완료 저장
      set({ generationProgress: { phase: 'saving', current: 0, total: 0, message: '저장 중...' } });
      await updatePresentationSlides(uid, presId, slides, slideHistories);
      await updatePresentationGenerationProgress(uid, presId, { generationStatus: 'complete' });

      set((state) => ({
        slides,
        presentations: state.presentations.map((p) =>
          p.id === presId ? { ...p, slides, slideHistories, generationStatus: 'complete', updatedAt: Date.now() } : p
        ),
        generationProgress: { phase: 'complete', current: 0, total: 0, message: '완료!' },
      }));

      setTimeout(() => set({ generationProgress: null }), 2000);
    } catch (err) {
      console.error('Slide generation failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      set({ generationProgress: { phase: 'error', current: 0, total: 0, message: `생성 실패: ${msg}` } });
      alert(`슬라이드 생성 실패: ${msg}`);
    } finally {
      set({ isGenerating: false });
    }
  },

  /** 페이지 갱신 후 미완료 생성 작업 재개 */
  resumeGeneration: async (presId) => {
    const { uid, presentations } = get();
    if (!uid) return;
    const pres = presentations.find((p) => p.id === presId);
    if (!pres || pres.generationStatus !== 'generating') return;

    const slides = [...(pres.slides || [])];
    const slideHistories = pres.slideHistories || slides.map(() => []);
    const startFrom = pres.viewportFixedCount || 0;

    set({
      isGenerating: true,
      activePresentationId: presId,
      slides,
      slideHistories,
      currentSlideIndex: 0,
      generationProgress: { phase: 'fixing', current: startFrom, total: slides.length, message: `뷰포트 수정 재개: 슬라이드 ${startFrom + 1}/${slides.length}` },
    });

    try {
      // 뷰포트 수정 재개
      for (let i = startFrom; i < slides.length; i++) {
        set({ generationProgress: { phase: 'fixing', current: i, total: slides.length, message: `뷰포트 수정: 슬라이드 ${i + 1}/${slides.length}` } });
        try {
          slides[i] = await fixSingleSlideViewport(slides[i]);
        } catch (err) {
          console.warn(`슬라이드 ${i + 1} 뷰포트 수정 실패:`, err);
        }
        await updatePresentationSlides(uid, presId, slides, slideHistories);
        await updatePresentationGenerationProgress(uid, presId, { viewportFixedCount: i + 1 });
        set({ slides: [...slides] });
      }

      // 이미지 업로드
      set({ generationProgress: { phase: 'uploading', current: 0, total: slides.length, message: '이미지 업로드 준비 중...' } });
      for (let i = 0; i < slides.length; i++) {
        set({ generationProgress: { phase: 'uploading', current: i, total: slides.length, message: `이미지 업로드: 슬라이드 ${i + 1}/${slides.length}` } });
        slides[i] = await uploadSlideImages(uid, presId, i, slides[i]);
      }

      // 완료
      set({ generationProgress: { phase: 'saving', current: 0, total: 0, message: '저장 중...' } });
      await updatePresentationSlides(uid, presId, slides, slideHistories);
      await updatePresentationGenerationProgress(uid, presId, { generationStatus: 'complete' });

      set((state) => ({
        slides,
        presentations: state.presentations.map((p) =>
          p.id === presId ? { ...p, slides, slideHistories, generationStatus: 'complete', updatedAt: Date.now() } : p
        ),
        generationProgress: { phase: 'complete', current: 0, total: 0, message: '완료!' },
      }));

      setTimeout(() => set({ generationProgress: null }), 2000);
    } catch (err) {
      console.error('Resume generation failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      set({ generationProgress: { phase: 'error', current: 0, total: 0, message: `재개 실패: ${msg}` } });
    } finally {
      set({ isGenerating: false });
    }
  },

  setActivePresentation: (presId) => {
    const { presentations } = get();
    const pres = presentations.find((p) => p.id === presId);
    if (pres) {
      const slides = pres.slides || [];
      set({
        activePresentationId: presId,
        slides,
        slideHistories: pres.slideHistories || slides.map(() => []),
        currentSlideIndex: 0,
        modifyingSlideIndices: [],
        presentationSnapshots: [],
      });
    }
  },

  clearActivePresentation: () => {
    set({ activePresentationId: null, slides: [], slideHistories: [], currentSlideIndex: 0, modifyingSlideIndices: [], presentationSnapshots: [] });
  },

  setCurrentSlideIndex: (index) => {
    const { slides } = get();
    if (index >= 0 && index < slides.length) {
      set({ currentSlideIndex: index });
    }
  },

  modifySlide: async (index, instruction) => {
    const { slides, uid, activePresentationId } = get();
    if (!instruction.trim() || index < 0 || index >= slides.length) return;

    set((state) => ({
      modifyingSlideIndices: [...state.modifyingSlideIndices, { index, instruction }],
    }));

    try {
      const currentHtml = get().slides[index];
      // 현재 슬라이드를 스크린샷으로 캡처하여 LLM에 전달
      let screenshotBase64 = null;
      try {
        screenshotBase64 = await renderSlideToBase64(currentHtml);
      } catch (err) {
        console.warn('슬라이드 스크린샷 캡처 실패:', err);
      }
      let modified = await modifySlideHtml(currentHtml, instruction, screenshotBase64);

      if (uid && activePresentationId) {
        modified = await uploadSlideImages(uid, activePresentationId, index, modified);
      }

      set((state) => {
        const newSlides = [...state.slides];
        newSlides[index] = modified;
        const newHistories = newSlides.map((_, i) => state.slideHistories[i] || []);
        newHistories[index] = [
          ...newHistories[index],
          { instruction, html: modified, timestamp: Date.now() },
        ];
        return { slides: newSlides, slideHistories: newHistories };
      });

      if (uid && activePresentationId) {
        const { slides: latestSlides, slideHistories: latestHistories } = get();
        await updatePresentationSlides(uid, activePresentationId, latestSlides, latestHistories);
        set((state) => ({
          presentations: state.presentations.map((p) =>
            p.id === activePresentationId
              ? { ...p, slides: latestSlides, slideHistories: latestHistories, updatedAt: Date.now() }
              : p
          ),
        }));
      }
    } catch (err) {
      console.error('Slide modification failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`슬라이드 ${index + 1} 수정 실패: ${msg}`);
    } finally {
      set((state) => ({
        modifyingSlideIndices: state.modifyingSlideIndices.filter((m) => !(m.index === index && m.instruction === instruction)),
      }));
    }
  },

  modifyAllSlides: async (instruction) => {
    const { slides, slideHistories, uid, activePresentationId } = get();
    if (!instruction.trim() || slides.length === 0) return;

    set((state) => ({
      isModifyingAll: true,
      presentationSnapshots: [
        ...state.presentationSnapshots,
        { instruction, slides: [...slides], slideHistories: slideHistories.map((h) => [...(h || [])]), timestamp: Date.now() },
      ],
    }));
    try {
      let newSlides = await modifyAllSlidesHtml(slides, instruction);

      if (uid && activePresentationId) {
        newSlides = await Promise.all(
          newSlides.map((slideHtml, i) => uploadSlideImages(uid, activePresentationId, i, slideHtml))
        );
      }

      set((state) => {
        const newHistories = state.slideHistories.map((h, i) => [
          ...(h || []),
          { instruction: `[전체] ${instruction}`, html: newSlides[i] || state.slides[i], timestamp: Date.now() },
        ]);
        return { slides: newSlides, slideHistories: newHistories };
      });

      if (uid && activePresentationId) {
        const { slides: latestSlides, slideHistories: latestHistories } = get();
        await updatePresentationSlides(uid, activePresentationId, latestSlides, latestHistories);
        set((state) => ({
          presentations: state.presentations.map((p) =>
            p.id === activePresentationId
              ? { ...p, slides: latestSlides, slideHistories: latestHistories, updatedAt: Date.now() }
              : p
          ),
        }));
      }
    } catch (err) {
      console.error('All slides modification failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`전체 슬라이드 수정 실패: ${msg}`);
    } finally {
      set({ isModifyingAll: false });
    }
  },

  revertSlide: async (slideIndex, historyIndex) => {
    const { slides, slideHistories, uid, activePresentationId } = get();
    if (!slideHistories[slideIndex] || !slideHistories[slideIndex][historyIndex]) return;

    const entry = slideHistories[slideIndex][historyIndex];
    const newSlides = [...slides];
    newSlides[slideIndex] = entry.html;
    const newHistories = [...slideHistories];
    newHistories[slideIndex] = slideHistories[slideIndex].slice(0, historyIndex + 1);

    set({ slides: newSlides, slideHistories: newHistories });

    if (uid && activePresentationId) {
      await updatePresentationSlides(uid, activePresentationId, newSlides, newHistories);
      set((state) => ({
        presentations: state.presentations.map((p) =>
          p.id === activePresentationId
            ? { ...p, slides: newSlides, slideHistories: newHistories, updatedAt: Date.now() }
            : p
        ),
      }));
    }
  },

  deleteHistoryEntry: async (slideIndex, historyIndex) => {
    const { slideHistories, uid, activePresentationId, slides } = get();
    if (!slideHistories[slideIndex] || !slideHistories[slideIndex][historyIndex]) return;

    const newHistories = [...slideHistories];
    newHistories[slideIndex] = slideHistories[slideIndex].filter((_, i) => i !== historyIndex);

    set({ slideHistories: newHistories });

    if (uid && activePresentationId) {
      await updatePresentationSlides(uid, activePresentationId, slides, newHistories);
      set((state) => ({
        presentations: state.presentations.map((p) =>
          p.id === activePresentationId
            ? { ...p, slideHistories: newHistories, updatedAt: Date.now() }
            : p
        ),
      }));
    }
  },

  revertToSnapshot: async (snapshotIndex) => {
    const { presentationSnapshots, uid, activePresentationId } = get();
    if (!presentationSnapshots[snapshotIndex]) return;

    const snapshot = presentationSnapshots[snapshotIndex];
    const newSnapshots = presentationSnapshots.slice(0, snapshotIndex);

    set({
      slides: snapshot.slides,
      slideHistories: snapshot.slideHistories,
      presentationSnapshots: newSnapshots,
    });

    if (uid && activePresentationId) {
      await updatePresentationSlides(uid, activePresentationId, snapshot.slides, snapshot.slideHistories);
      set((state) => ({
        presentations: state.presentations.map((p) =>
          p.id === activePresentationId
            ? { ...p, slides: snapshot.slides, slideHistories: snapshot.slideHistories, updatedAt: Date.now() }
            : p
        ),
      }));
    }
  },

  deletePresentation: async (presId) => {
    const { uid, activePresentationId } = get();
    if (!uid) return;

    try {
      await deletePresentationDoc(uid, presId);
      set((state) => ({
        presentations: state.presentations.filter((p) => p.id !== presId),
        ...(activePresentationId === presId
          ? { activePresentationId: null, slides: [], currentSlideIndex: 0, modifyingSlideIndices: [] }
          : {}),
      }));
    } catch (err) {
      console.error('Failed to delete presentation:', err);
    }
  },

  renamePresentation: async (presId, newName) => {
    const { uid } = get();
    if (!uid) return;

    try {
      await renamePresentationDoc(uid, presId, newName);
      set((state) => ({
        presentations: state.presentations.map((p) =>
          p.id === presId ? { ...p, name: newName, updatedAt: Date.now() } : p
        ),
      }));
    } catch (err) {
      console.error('Failed to rename presentation:', err);
    }
  },
}));

export default useSlideStore;
