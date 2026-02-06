import { create } from 'zustand';
import { convertHtmlToSlides, modifySlideHtml, modifyAllSlidesHtml, fixAllSlideViewports } from '../utils/geminiApi';
import {
  loadPresentationList,
  createPresentationDoc,
  updatePresentationSlides,
  deletePresentationDoc,
  renamePresentationDoc,
  uploadSlideImages,
} from './storage';

const useSlideStore = create((set, get) => ({
  presentations: [],
  activePresentationId: null,
  slides: [],
  slideHistories: [], // Array of arrays: slideHistories[slideIndex] = [{instruction, html, timestamp}, ...]
  currentSlideIndex: 0,
  isGenerating: false,
  modifyingSlideIndices: [], // Array of indices currently being modified
  isModifyingAll: false,
  presentationSnapshots: [], // [{instruction, slides, slideHistories, timestamp}]
  uid: null,

  loadPresentations: async (uid) => {
    set({ uid });
    try {
      const list = await loadPresentationList(uid);
      set({ presentations: list });
    } catch (err) {
      console.error('Failed to load presentations:', err);
    }
  },

  generateSlides: async (html, sourceFileId, fileName) => {
    const { uid } = get();
    if (!uid) return;

    set({ isGenerating: true });
    try {
      let slides = await convertHtmlToSlides(html);

      // Viewport fix: render each slide → screenshot → Gemini Flash multimodal fix
      slides = await fixAllSlideViewports(slides);

      const slideHistories = slides.map(() => []);
      const now = Date.now();
      const presId = now.toString(36) + Math.random().toString(36).slice(2, 6);

      // Upload any base64 images in slides to GCS
      slides = await Promise.all(
        slides.map((slideHtml, i) => uploadSlideImages(uid, presId, i, slideHtml))
      );

      const pres = {
        id: presId,
        name: `${fileName} 프레젠테이션`,
        sourceFileId,
        slides,
        slideHistories,
        createdAt: now,
        updatedAt: now,
      };

      await createPresentationDoc(uid, pres);
      set((state) => ({
        presentations: [...state.presentations, pres],
        activePresentationId: pres.id,
        slides,
        slideHistories,
        currentSlideIndex: 0,
      }));
    } catch (err) {
      console.error('Slide generation failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`슬라이드 생성 실패: ${msg}`);
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

    // Add index + instruction to modifying set
    set((state) => ({
      modifyingSlideIndices: [...state.modifyingSlideIndices, { index, instruction }],
    }));

    try {
      // Capture the current slide HTML at start
      const currentHtml = get().slides[index];
      let modified = await modifySlideHtml(currentHtml, instruction);

      // Upload base64 images to GCS and replace with URLs
      if (uid && activePresentationId) {
        modified = await uploadSlideImages(uid, activePresentationId, index, modified);
      }

      // Read fresh state to avoid overwriting concurrent modifications
      set((state) => {
        const newSlides = [...state.slides];
        newSlides[index] = modified;

        // Ensure histories array matches slides length (fill gaps with [])
        const newHistories = newSlides.map((_, i) => state.slideHistories[i] || []);
        newHistories[index] = [
          ...newHistories[index],
          { instruction, html: modified, timestamp: Date.now() },
        ];

        return { slides: newSlides, slideHistories: newHistories };
      });

      // Persist to Firestore with fresh state
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
      // Remove index from modifying set
      set((state) => ({
        modifyingSlideIndices: state.modifyingSlideIndices.filter((m) => !(m.index === index && m.instruction === instruction)),
      }));
    }
  },

  modifyAllSlides: async (instruction) => {
    const { slides, slideHistories, uid, activePresentationId } = get();
    if (!instruction.trim() || slides.length === 0) return;

    // Save snapshot before modification
    set((state) => ({
      isModifyingAll: true,
      presentationSnapshots: [
        ...state.presentationSnapshots,
        { instruction, slides: [...slides], slideHistories: slideHistories.map((h) => [...(h || [])]), timestamp: Date.now() },
      ],
    }));
    try {
      let newSlides = await modifyAllSlidesHtml(slides, instruction);

      // Upload base64 images for each slide
      if (uid && activePresentationId) {
        newSlides = await Promise.all(
          newSlides.map((slideHtml, i) => uploadSlideImages(uid, activePresentationId, i, slideHtml))
        );
      }

      // Read fresh histories to avoid overwriting concurrent changes
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

    // Trim history to only include entries up to and including the reverted one
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
    // Remove snapshots after this one (they're no longer valid)
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
