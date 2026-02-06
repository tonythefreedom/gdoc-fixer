import { useEffect } from 'react';
import { X, Download } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { downloadBlob } from '../../utils/downloadBlob';

export default function ImageModal() {
  const modalImageKey = useAppStore((s) => s.modalImageKey);
  const setModalImageKey = useAppStore((s) => s.setModalImageKey);
  const imageUrls = useAppStore((s) => s.imageUrls);
  const images = useAppStore((s) => s.images);

  useEffect(() => {
    if (!modalImageKey) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') setModalImageKey(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [modalImageKey, setModalImageKey]);

  if (!modalImageKey) return null;

  const url = imageUrls[modalImageKey];
  const img = images.find((i) => i.key === modalImageKey);
  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setModalImageKey(null)}
    >
      <div
        className="relative max-w-[95vw] max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt="Full size preview"
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {img?.blob && (
            <button
              onClick={() =>
                downloadBlob(img.blob, img.filename || 'export.png')
              }
              className="p-2 bg-white/90 hover:bg-white rounded-full shadow-lg text-slate-700 transition-colors"
              title="다운로드"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setModalImageKey(null)}
            className="p-2 bg-white/90 hover:bg-white rounded-full shadow-lg text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {img && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 text-white text-xs rounded-full">
            {img.width} x {img.height} px
          </div>
        )}
      </div>
    </div>
  );
}
