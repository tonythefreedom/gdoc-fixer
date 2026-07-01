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

// uid 별 localStorage 키. 같은 디바이스를 여러 계정이 사용해도 프리셋이
// 섞이지 않게 한다.
function presetsKey(uid) {
  return uid ? `gdoc-fixer-presets:${uid}` : null;
}

function loadSavedPresets(uid) {
  const key = presetsKey(uid);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSavedPresets(uid, presets) {
  const key = presetsKey(uid);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(presets));
}

const useAppStore = create((set, get) => ({
  // View routing ('editor' | 'contents')
  currentView: 'contents',
  setCurrentView: (view) => set({ currentView: view }),

  // File management
  files: [],
  activeFileId: null,
  activeFileContent: '',
  uid: null,
  filesLoading: true,

  // Viewport
  viewportWidth: DEFAULT_VIEWPORT_WIDTH,
  viewportHeight: DEFAULT_VIEWPORT_HEIGHT,

  // Saved presets — uid 가 결정된 후 loadUserFiles 시점에 채움.
  savedPresets: [],

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

  // 기획안 생성 직후 PlanningEditor → EditorView 전환 동안 fullscreen overlay 로
  // 전체 화면 reconciliation + iframe paint 깜빡임을 덮는다.
  isTransitioningToEditor: false,
  // overlay 안에 표시할 메시지. PlanningEditor 가 generation 각 step 에 따라
  // 업데이트. null 이면 default 메시지 사용.
  editorTransitionMessage: null,

  // Admin mode
  isAdminMode: false,

  // UI state
  isExporting: false,
  modalImageKey: null,
  isImagePanelOpen: false,

  // Load user files from Firestore (with localStorage migration)
  loadUserFiles: async (uid) => {
    set({
      uid,
      filesLoading: true,
      activeFileId: null,
      activeFileContent: '',
      files: [],
      savedPresets: loadSavedPresets(uid), // 계정별 프리셋
    });

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

  // 로그아웃 / 사용자 전환 시 호출 — 메모리에 남은 이전 사용자 데이터 비움
  reset: () => {
    set({
      currentView: 'contents',
      files: [],
      activeFileId: null,
      activeFileContent: '',
      uid: null,
      filesLoading: false,
      savedPresets: [],
      images: [],
      imageUrls: {},
      attachments: [],
      isPlanningMode: false,
      isAdminMode: false,
      isExporting: false,
      modalImageKey: null,
      isImagePanelOpen: false,
    });
  },

  // Actions
  createFile: async (name) => {
    const { uid } = get();
    if (!uid) return;
    const { chargeCoin } = await import('../utils/coin');
    try {
      await chargeCoin(uid, 'createDoc');
    } catch (err) {
      alert(err.message);
      throw err;
    }
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

  /**
   * HWP 바이너리를 GCS 에 그대로 업로드하고 type:'hwp' 파일로 등록.
   * MainPanel 이 type:'hwp' 일 때 rhwp 에디터를 임베드해서 직접 보여준다.
   */
  createHwpFileForRhwpEditor: async (file) => {
    const { uid } = get();
    if (!uid) return;
    set({ hwpImporting: true });
    try {
      const { uploadBlobToGcs } = await import('./storage');
      const name = file.name.replace(/\.(hwp|hwpx)$/i, '') || `hwp_${Date.now().toString(36)}`;
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const ext = /\.hwpx$/i.test(file.name) ? 'hwpx' : 'hwp';
      const path = `wiki-images/hwp/${uid}/${id}_${Date.now()}.${ext}`;
      const hwpUrl = await uploadBlobToGcs(path, file);

      const fileDoc = {
        id,
        name,
        type: 'hwp',
        hwpUrl,
        ext,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      // createFileDoc 은 type/hwpUrl 같은 추가 필드를 그대로 메타에 저장한다.
      await createFileDoc(uid, fileDoc, '');
      set({ files: [...get().files, fileDoc], currentView: 'editor' });
      get().setActiveFile(id);
    } catch (err) {
      console.error('HWP(rhwp) import failed:', err);
      alert(`HWP 파일 가져오기 실패: ${err.message || err}`);
    } finally {
      set({ hwpImporting: false });
    }
  },

  /**
   * AI 로 수정한 HWPX 바이트를 새 type:'hwp' 파일로 사이드 메뉴에 저장한다.
   * (수정본을 GCS+Firestore 에 영속화 — 세션이 끝나도 유실되지 않도록.)
   * @param {Uint8Array} bytes 수정된 HWPX 바이너리
   * @param {string} baseName 원본 파일명(확장자 무시)
   * @returns {Promise<object|null>} 생성된 fileDoc (실패 시 null)
   */
  saveHwpxBytesAsFile: async (bytes, baseName = 'document') => {
    const { uid } = get();
    if (!uid || !bytes?.length) return null;
    try {
      const { uploadBlobToGcs } = await import('./storage');
      const cleanBase = String(baseName).replace(/\.(hwp|hwpx)$/i, '') || 'document';
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const path = `wiki-images/hwp/${uid}/${id}_${Date.now()}.hwpx`;
      const blob = new Blob([bytes], { type: 'application/vnd.hancom.hwpx' });
      const hwpUrl = await uploadBlobToGcs(path, blob);

      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const fileDoc = {
        id,
        name: `${cleanBase} (AI수정 ${hh}:${mm})`,
        type: 'hwp',
        hwpUrl,
        ext: 'hwpx',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await createFileDoc(uid, fileDoc, '');
      set({ files: [...get().files, fileDoc] });
      return fileDoc;
    } catch (err) {
      console.error('HWPX 자동 저장 실패:', err);
      return null;
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

      // Helper: Resize image to max dimension for API token savings
      const MAX_IMAGE_DIM = 1536;
      const resizeImage = (file, mimeType) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            let { width: w, height: h } = img;
            // Skip resize if already small enough
            if (w <= MAX_IMAGE_DIM && h <= MAX_IMAGE_DIM) {
              const reader = new FileReader();
              reader.onload = () => resolve({ base64: reader.result.split(',')[1], mimeType });
              reader.readAsDataURL(file);
              return;
            }
            const ratio = Math.min(MAX_IMAGE_DIM / w, MAX_IMAGE_DIM / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            // Use JPEG for smaller size (except PNG with transparency needs)
            const outMime = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
            const dataUrl = canvas.toDataURL(outMime, 0.85);
            resolve({ base64: dataUrl.split(',')[1], mimeType: outMime });
          };
          img.onerror = () => {
            // Fallback: use original
            const reader = new FileReader();
            reader.onload = () => resolve({ base64: reader.result.split(',')[1], mimeType });
            reader.readAsDataURL(file);
          };
          img.src = URL.createObjectURL(file);
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
    const { uid, imageUrls } = get();
    if (!uid) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const file = { id, name, createdAt: Date.now(), updatedAt: Date.now() };
    await createFileDoc(uid, file, content);

    // 기존 이미지 URL revoke (setActiveFile 의 cleanup 부분과 동일)
    Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));

    // planning mode 종료 + 새 파일 활성화 + content 주입을 단일 commit 으로 묶어
    // 깜빡임 (PlanningEditor 닫힘 → 빈 화면 → await loadFileContent → 갑자기 나타남) 제거.
    // 이미 메모리에 content 가 있으므로 Firestore 재로드 불필요.
    // fullscreen overlay 도 함께 켜서 EditorView 의 큰 reconciliation +
    // iframe srcDoc paint 가 끝나는 동안 사용자 시각에 빈 화면이 노출되지 않게 한다.
    set({
      files: [...get().files, file],
      isPlanningMode: false,
      isTransitioningToEditor: true,
      activeFileId: id,
      activeFileContent: content,
      images: [],
      imageUrls: {},
      isImagePanelOpen: false,
      isAdminMode: false,
      currentView: 'editor',
    });

    // 이미지 메타는 백그라운드 로드 (await 하면 다시 깜빡임 유발)
    get().loadImagesForFile(id);

    // 큰 HTML (수백KB) + tailwindcss CDN JIT 컴파일 등 무거운 iframe paint
    // 도 커버하도록 보수적인 fallback. 보통은 PreviewIframe.onLoad 가 먼저
    // dismiss (~ paint 완료 시점) 하므로 이건 안전망일 뿐.
    setTimeout(() => {
      if (get().isTransitioningToEditor) {
        set({ isTransitioningToEditor: false });
      }
    }, 4000);
  },

  dismissEditorTransition: () => {
    if (get().isTransitioningToEditor) {
      set({ isTransitioningToEditor: false, editorTransitionMessage: null });
    }
  },

  startEditorTransition: (message) => {
    set({ isTransitioningToEditor: true, editorTransitionMessage: message || null });
  },

  setEditorTransitionMessage: (message) => {
    set({ editorTransitionMessage: message || null });
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
      currentView: 'editor',
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
    const { viewportWidth, viewportHeight, savedPresets, uid } = get();
    const preset = { label, w: viewportWidth, h: viewportHeight };
    const updated = [...savedPresets, preset];
    saveSavedPresets(uid, updated);
    set({ savedPresets: updated });
  },

  deletePreset: (index) => {
    const { uid } = get();
    const updated = get().savedPresets.filter((_, i) => i !== index);
    saveSavedPresets(uid, updated);
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
