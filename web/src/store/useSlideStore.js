import { create } from 'zustand';
import { convertHtmlToSlides, modifySlideHtml } from '../utils/geminiApi';

const useSlideStore = create((set, get) => ({
  slides: [],
  currentSlideIndex: 0,
  isGenerating: false,
  modifyingSlideIndex: null,
  isViewerOpen: false,

  generateSlides: async (html) => {
    set({ isGenerating: true });
    try {
      const slides = await convertHtmlToSlides(html);
      set({ slides, currentSlideIndex: 0, isViewerOpen: true });
    } catch (err) {
      console.error('Slide generation failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`슬라이드 생성 실패: ${msg}`);
    } finally {
      set({ isGenerating: false });
    }
  },

  setCurrentSlideIndex: (index) => {
    const { slides } = get();
    if (index >= 0 && index < slides.length) {
      set({ currentSlideIndex: index });
    }
  },

  modifySlide: async (index, instruction) => {
    const { slides } = get();
    if (!instruction.trim() || index < 0 || index >= slides.length) return;

    set({ modifyingSlideIndex: index });
    try {
      const modified = await modifySlideHtml(slides[index], instruction);
      const newSlides = [...slides];
      newSlides[index] = modified;
      set({ slides: newSlides });
    } catch (err) {
      console.error('Slide modification failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`슬라이드 수정 실패: ${msg}`);
    } finally {
      set({ modifyingSlideIndex: null });
    }
  },

  closeViewer: () =>
    set({ isViewerOpen: false, slides: [], currentSlideIndex: 0, modifyingSlideIndex: null }),
}));

export default useSlideStore;
