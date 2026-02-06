import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ShareView from './components/ShareView';
import LoginPage from './components/LoginPage';
import { isShareUrl } from './utils/shareUrl';
import useAuthStore from './store/useAuthStore';
import useAppStore from './store/useAppStore';
import useSlideStore from './store/useSlideStore';
import useShareStore from './store/useShareStore';
import { Loader2 } from 'lucide-react';

function App() {
  const [isShare, setIsShare] = useState(() => isShareUrl());
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initAuth = useAuthStore((s) => s.initAuth);
  const loadUserFiles = useAppStore((s) => s.loadUserFiles);
  const filesLoading = useAppStore((s) => s.filesLoading);
  const loadPresentations = useSlideStore((s) => s.loadPresentations);
  const loadShares = useShareStore((s) => s.loadShares);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Load user files, presentations, and shares when user logs in
  useEffect(() => {
    if (user) {
      loadUserFiles(user.uid);
      loadPresentations(user.uid);
      loadShares(user.uid);
    }
  }, [user, loadUserFiles, loadPresentations, loadShares]);

  useEffect(() => {
    const handleHashChange = () => {
      setIsShare(isShareUrl());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Share view is publicly accessible
  if (isShare) {
    return <ShareView />;
  }

  // Show loading spinner while checking auth state or loading files
  if (loading || (user && filesLoading)) {
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

  return <Layout />;
}

export default App;
