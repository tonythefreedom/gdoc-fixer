import { useState, useEffect } from 'react';
import { Code, AlertTriangle } from 'lucide-react';
import { parseShareId, fetchSharedHtml } from '../utils/shareUrl';
import useAppStore from '../store/useAppStore';

export default function ShareView() {
  const [html, setHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const createFile = useAppStore((s) => s.createFile);

  useEffect(() => {
    const id = parseShareId();
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }

    fetchSharedHtml(id)
      .then((data) => {
        if (data) {
          setHtml(data);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleOpenInEditor = () => {
    window.location.hash = '';
    const name = `shared_${Date.now().toString(36)}`;
    setTimeout(() => {
      createFile(name);
      setTimeout(() => {
        useAppStore.getState().updateFileContent(html);
      }, 50);
    }, 50);
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-400 text-sm">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-600 text-sm">공유 링크가 유효하지 않습니다.</p>
          <a
            href={window.location.origin + window.location.pathname}
            className="mt-4 inline-block text-indigo-600 text-sm hover:underline"
          >
            에디터로 이동
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="bg-slate-900/90 backdrop-blur-sm px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-white/70 text-xs">공유된 HTML 문서</span>
        <button
          onClick={handleOpenInEditor}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Code className="w-3.5 h-3.5" />
          에디터로 열기
        </button>
      </div>
      <iframe
        srcDoc={html}
        sandbox="allow-scripts allow-same-origin"
        className="flex-1 w-full border-none"
        title="Shared HTML"
      />
    </div>
  );
}
