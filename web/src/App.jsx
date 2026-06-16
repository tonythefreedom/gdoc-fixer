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

  // Load user files, presentations, and shares when user is approved
  useEffect(() => {
    if (user && userProfile?.status === 'approved') {
      loadUserFiles(user.uid);
      loadPresentations(user.uid);
      loadShares(user.uid);
    }
  }, [user, userProfile, loadUserFiles, loadPresentations, loadShares]);

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

  return <Layout />;
}

export default App;
