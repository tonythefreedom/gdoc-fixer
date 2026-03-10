import { create } from 'zustand';
import {
  loadFileList,
  createFileDoc,
  loadFileContent,
  updateFileContentDoc,
  deleteFileDoc,
  renameFileDoc,
  loadLocalFiles,
  loadLocalContent,
  clearLocalStorage,
} from './storage';
import {
  getImagesForFile,
  deleteAllImagesForFile,
  deleteImage as deleteImageFromDb,
} from './imageDb';
import {
  DEFAULT_VIEWPORT_WIDTH,
  DEFAULT_VIEWPORT_HEIGHT,
  DEFAULT_HTML,
} from '../utils/constants';

function loadSavedPresets() {
  try {
    const raw = localStorage.getItem('gdoc-fixer-presets');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSavedPresets(presets) {
  localStorage.setItem('gdoc-fixer-presets', JSON.stringify(presets));
}

const useAppStore = create((set, get) => ({
  // File management
  files: [],
  activeFileId: null,
  activeFileContent: '',
  uid: null,
  filesLoading: true,

  // Viewport
  viewportWidth: DEFAULT_VIEWPORT_WIDTH,
  viewportHeight: DEFAULT_VIEWPORT_HEIGHT,

  // Saved presets
  savedPresets: loadSavedPresets(),

  // Images
  images: [],
  imageUrls: {},

  // HWP / DOCX import
  hwpImporting: false,
  docxImporting: false,

  // File attachments for Gemini context
  attachments: [], // [{ fileName, type: 'excel'|'image'|'text'|'pdf', promptText?, mimeType?, base64? }]

  // Planning mode
  isPlanningMode: false,

  // Admin mode
  isAdminMode: false,

  // UI state
  isExporting: false,
  modalImageKey: null,
  isImagePanelOpen: false,

  // Load user files from Firestore (with localStorage migration)
  loadUserFiles: async (uid) => {
    set({ uid, filesLoading: true, activeFileId: null, activeFileContent: '', files: [] });

    // Migrate localStorage data if exists
    const localFiles = loadLocalFiles();
    if (localFiles.length > 0) {
      for (const f of localFiles) {
        const content = loadLocalContent(f.id);
        await createFileDoc(uid, f, content);
      }
      clearLocalStorage();
    }

    const files = await loadFileList(uid);
    set({ files, filesLoading: false });
  },

  // Actions
  createFile: async (name) => {
    const { uid } = get();
    if (!uid) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const file = { id, name, createdAt: Date.now(), updatedAt: Date.now() };
    await createFileDoc(uid, file, DEFAULT_HTML);
    set({ files: [...get().files, file] });
    get().setActiveFile(id);
  },

  createFileFromHwp: async (file) => {
    const { uid } = get();
    if (!uid) return;
    set({ hwpImporting: true });
    try {
      const { parseHwpToHtml } = await import('../utils/hwpParser');
      const htmlContent = await parseHwpToHtml(file);
      const name = file.name.replace(/\.hwp$/i, '') || `hwp_${Date.now().toString(36)}`;
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const fileDoc = { id, name, createdAt: Date.now(), updatedAt: Date.now() };
      await createFileDoc(uid, fileDoc, htmlContent);
      set({ files: [...get().files, fileDoc] });
      get().setActiveFile(id);
    } catch (err) {
      console.error('HWP import failed:', err);
      alert(`HWP 파일 가져오기 실패: ${err.message || err}`);
    } finally {
      set({ hwpImporting: false });
    }
  },

  createFileFromDocx: async (file) => {
    const { uid } = get();
    if (!uid) return;
    set({ docxImporting: true });
    try {
      const { parseDocxToHtml } = await import('../utils/docxParser');
      const htmlContent = await parseDocxToHtml(file);
      const name = file.name.replace(/\.docx?$/i, '') || `docx_${Date.now().toString(36)}`;
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const fileDoc = { id, name, createdAt: Date.now(), updatedAt: Date.now() };
      await createFileDoc(uid, fileDoc, htmlContent);
      set({ files: [...get().files, fileDoc] });
      get().setActiveFile(id);
    } catch (err) {
      console.error('DOCX import failed:', err);
      alert(`DOCX 파일 가져오기 실패: ${err.message || err}`);
    } finally {
      set({ docxImporting: false });
    }
  },

  attachFile: async (file) => {
    try {
      const name = file.name;
      const ext = name.split('.').pop().toLowerCase();

      // Helper: File → base64 via FileReader (no stack overflow)
      const fileToBase64 = (f) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });

      // Excel files → parse to CSV text
      if (['xlsx', 'xlsm', 'xls'].includes(ext)) {
        const { parseExcelToSheets, formatSheetsForPrompt } = await import('../utils/xlsxParser');
        const sheets = await parseExcelToSheets(file);
        if (!sheets.length) {
          alert('Excel 파일에 데이터가 있는 시트가 없습니다.');
          return;
        }
        const promptText = formatSheetsForPrompt(name, sheets);
        const entry = { fileName: name, type: 'excel', promptText, sheetCount: sheets.length };
        set({ attachments: [...get().attachments, entry] });
        return;
      }

      // Image files → base64
      const imageMimes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
      if (imageMimes[ext]) {
        const base64 = await fileToBase64(file);
        const entry = { fileName: name, type: 'image', mimeType: imageMimes[ext], base64 };
        set({ attachments: [...get().attachments, entry] });
        return;
      }

      // PDF files → base64
      if (ext === 'pdf') {
        const base64 = await fileToBase64(file);
        const entry = { fileName: name, type: 'pdf', mimeType: 'application/pdf', base64 };
        set({ attachments: [...get().attachments, entry] });
        return;
      }

      // Text-like files → read as text
      const text = await file.text();
      if (!text.trim()) {
        alert('파일에 내용이 없습니다.');
        return;
      }
      const entry = { fileName: name, type: 'text', promptText: `[첨부 파일: ${name}]\n${text}` };
      set({ attachments: [...get().attachments, entry] });
    } catch (err) {
      console.error('File attach failed:', err);
      alert(`파일 첨부 실패: ${err.message || err}`);
    }
  },

  detachFile: (index) => {
    set({ attachments: get().attachments.filter((_, i) => i !== index) });
  },

  detachAllFiles: () => {
    set({ attachments: [] });
  },

  startPlanning: () => {
    set({ activeFileId: null, activeFileContent: '', isPlanningMode: true, isAdminMode: false });
  },

  cancelPlanning: () => {
    set({ isPlanningMode: false });
  },

  setAdminMode: (v) => {
    if (v) {
      set({ isAdminMode: true, activeFileId: null, activeFileContent: '', isPlanningMode: false });
    } else {
      set({ isAdminMode: false });
    }
  },

  createFileWithContent: async (name, content) => {
    const { uid } = get();
    if (!uid) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const file = { id, name, createdAt: Date.now(), updatedAt: Date.now() };
    await createFileDoc(uid, file, content);
    set({ files: [...get().files, file], isPlanningMode: false });
    get().setActiveFile(id);
  },

  setActiveFile: async (fileId) => {
    // Revoke old image URLs
    const oldUrls = get().imageUrls;
    Object.values(oldUrls).forEach((url) => URL.revokeObjectURL(url));

    if (!fileId) {
      set({ activeFileId: null, activeFileContent: '', images: [], imageUrls: {}, isImagePanelOpen: false });
      return;
    }

    const { uid } = get();
    if (!uid) return;

    const content = await loadFileContent(uid, fileId);
    set({
      activeFileId: fileId,
      activeFileContent: content,
      images: [],
      imageUrls: {},
      isImagePanelOpen: false,
      isAdminMode: false,
    });

    // Load images for this file
    await get().loadImagesForFile(fileId);
  },

  updateFileContent: async (content) => {
    const { activeFileId, files, uid } = get();
    if (!activeFileId || !uid) return;
    const updatedFiles = files.map((f) =>
      f.id === activeFileId ? { ...f, updatedAt: Date.now() } : f
    );
    set({ activeFileContent: content, files: updatedFiles });
    await updateFileContentDoc(uid, activeFileId, content);
  },

  deleteFile: async (fileId) => {
    const { files, activeFileId, imageUrls, uid } = get();
    if (!uid) return;
    await deleteFileDoc(uid, fileId);
    await deleteAllImagesForFile(fileId);

    // Revoke URLs if this was the active file
    if (fileId === activeFileId) {
      Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
    }

    const newFiles = files.filter((f) => f.id !== fileId);
    set({
      files: newFiles,
      ...(fileId === activeFileId
        ? {
            activeFileId: null,
            activeFileContent: '',
            images: [],
            imageUrls: {},
            isImagePanelOpen: false,
          }
        : {}),
    });
  },

  renameFile: async (fileId, newName) => {
    const { uid } = get();
    if (!uid) return;
    await renameFileDoc(uid, fileId, newName);
    const files = get().files.map((f) =>
      f.id === fileId ? { ...f, name: newName, updatedAt: Date.now() } : f
    );
    set({ files });
  },

  // Viewport
  setViewportSize: (w, h) => {
    set({
      viewportWidth: Math.max(320, Math.min(4096, Math.round(w))),
      viewportHeight: Math.max(320, Math.min(4096, Math.round(h))),
    });
  },

  savePreset: (label) => {
    const { viewportWidth, viewportHeight, savedPresets } = get();
    const preset = { label, w: viewportWidth, h: viewportHeight };
    const updated = [...savedPresets, preset];
    saveSavedPresets(updated);
    set({ savedPresets: updated });
  },

  deletePreset: (index) => {
    const updated = get().savedPresets.filter((_, i) => i !== index);
    saveSavedPresets(updated);
    set({ savedPresets: updated });
  },

  // Images
  loadImagesForFile: async (fileId) => {
    const images = await getImagesForFile(fileId);
    const urls = {};
    images.forEach((img) => {
      if (img.blob) {
        urls[img.key] = URL.createObjectURL(img.blob);
      }
    });
    set({ images, imageUrls: urls });
  },

  addImage: (key, blob, metadata) => {
    const url = URL.createObjectURL(blob);
    set((state) => ({
      images: [...state.images, { key, blob, ...metadata }],
      imageUrls: { ...state.imageUrls, [key]: url },
    }));
  },

  deleteImageEntry: async (key) => {
    await deleteImageFromDb(key);
    set((state) => {
      const url = state.imageUrls[key];
      if (url) URL.revokeObjectURL(url);
      const { [key]: _, ...restUrls } = state.imageUrls;
      return {
        images: state.images.filter((img) => img.key !== key),
        imageUrls: restUrls,
      };
    });
  },

  // UI
  setIsExporting: (v) => set({ isExporting: v }),
  setModalImageKey: (key) => set({ modalImageKey: key }),
  setIsImagePanelOpen: (v) => set({ isImagePanelOpen: v }),
  toggleImagePanel: (fileId) => {
    const { isImagePanelOpen, activeFileId } = get();
    if (fileId === activeFileId && isImagePanelOpen) {
      set({ isImagePanelOpen: false });
    } else {
      if (fileId !== activeFileId) {
        get().setActiveFile(fileId);
      }
      set({ isImagePanelOpen: true });
    }
  },
}));

export default useAppStore;
