import { Trash2, Download } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { downloadBlob } from '../../utils/downloadBlob';

export default function ThumbnailGrid() {
  const images = useAppStore((s) => s.images);
  const imageUrls = useAppStore((s) => s.imageUrls);
  const setModalImageKey = useAppStore((s) => s.setModalImageKey);
  const deleteImageEntry = useAppStore((s) => s.deleteImageEntry);

  if (images.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs p-4 text-center">
        아직 내보낸 이미지가 없습니다.
        <br />
        PNG 내보내기를 실행하세요.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {images.map((img) => {
        const url = imageUrls[img.key];
        if (!url) return null;
        return (
          <div key={img.key} className="group relative bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div
              className="cursor-pointer"
              onClick={() => setModalImageKey(img.key)}
            >
              <img
                src={url}
                alt={img.filename}
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>
            <div className="px-2 py-1.5 flex items-center justify-between bg-slate-50 border-t border-slate-100">
              <div className="text-[10px] text-slate-500 truncate">
                {img.width}x{img.height}
                <span className="text-slate-400 ml-1">
                  {img.createdAt
                    ? new Date(img.createdAt).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (img.blob) downloadBlob(img.blob, img.filename || 'export.png');
                  }}
                  className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="다운로드"
                >
                  <Download className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('이 이미지를 삭제하시겠습니까?')) {
                      deleteImageEntry(img.key);
                    }
                  }}
                  className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
