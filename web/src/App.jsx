import { useState, useEffect, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import ShareView from './components/ShareView';
import LoginPage from './components/LoginPage';
import PendingApprovalPage from './components/PendingApprovalPage';
import { isShareUrl } from './utils/shareUrl';

// PresentationShareView 와 그 의존성(presentationShareUrl/storage 등) 을 main
// bundle 의 init 사이클에서 제외하기 위해 lazy 로드. /p/ 경로일 때만 평가됨.
const PresentationShareView = lazy(() => import('./components/PresentationShareView'));
const isPresentationShareUrl = () => window.location.pathname.startsWith('/p/');
import useAuthStore from './store/useAuthStore';
import useAppStore from './store/useAppStore';
import useSlideStore from './store/useSlideStore';
import useShareStore from './store/useShareStore';
import { Loader2 } from 'lucide-react';

function App() {
  const [isShare, setIsShare] = useState(() => isShareUrl());
  const [isPresShare] = useState(() => isPresentationShareUrl());
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const loading = useAuthStore((s) => s.loading);
  const profileLoading = useAuthStore((s) => s.profileLoading);
  const initAuth = useAuthStore((s) => s.initAuth);
  const loadUserFiles = useAppStore((s) => s.loadUserFiles);
  const filesLoading = useAppStore((s) => s.filesLoading);
  const loadPresentations = useSlideStore((s) => s.loadPresentations);
  const loadShares = useShareStore((s) => s.loadShares);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Load user files, presentations, and shares when user is approved.
  // 주의: dep 에 userProfile 전체를 두면 subscribeProfile 의 onSnapshot 으로
  // coinBalance 가 바뀔 때마다 (예: chargeCoin 후) loadUserFiles 가 재호출되며
  // files 가 새 array 로 set → activeFile selector 가 새 reference →
  // RhwpEditorView 의 useEffect cleanup 이 editor.destroy() 호출 → 작업 중인
  // handleChatSubmit 이 worker null 로 깨짐. status 만 의존하면 충분.
  const profileStatus = userProfile?.status;
  useEffect(() => {
    if (user && profileStatus === 'approved') {
      loadUserFiles(user.uid);
      loadPresentations(user.uid);
      loadShares(user.uid);
    }
  }, [user, profileStatus, loadUserFiles, loadPresentations, loadShares]);

  useEffect(() => {
    const handleHashChange = () => {
      setIsShare(isShareUrl());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 공유 뷰는 인증 없이 접근 가능
  if (isPresShare) {
    return (
      <Suspense
        fallback={
          <div className="w-full h-screen flex items-center justify-center bg-slate-900 text-slate-300">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        }
      >
        <PresentationShareView />
      </Suspense>
    );
  }
  if (isShare) {
    return <ShareView />;
  }

  // Auth loading
  if (loading) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Not authenticated → login page
  if (!user) {
    return <LoginPage />;
  }

  // Profile loading
  if (profileLoading) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // User not approved → pending/rejected page
  if (!userProfile || userProfile.status !== 'approved') {
    return <PendingApprovalPage />;
  }

  // Files loading (only after profile confirmed approved)
  if (filesLoading) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
      <Layout />
      <EditorTransitionOverlay />
    </>
  );
}

function EditorTransitionOverlay() {
  const visible = useAppStore((s) => s.isTransitioningToEditor);
  const message = useAppStore((s) => s.editorTransitionMessage);
  if (!visible) return null;
  const title = message || '기획안이 완성되었습니다';
  const subtitle = message ? '잠시만 기다려 주세요...' : '에디터로 이동 중...';
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '28px 36px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          minWidth: 320,
          maxWidth: 480,
        }}
      >
        <Loader2 className="w-7 h-7 animate-spin shrink-0" style={{ color: '#10b981' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', lineHeight: 1.4 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
