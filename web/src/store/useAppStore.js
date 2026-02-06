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
