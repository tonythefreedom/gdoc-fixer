import Sidebar from './Sidebar';
import Header from './Header';
import MainPanel from './MainPanel';
import ImagePanel from './ImagePanel';
import ImageModal from './gallery/ImageModal';
import ContentListPage from './ContentListPage';
import ProfilePage from './ProfilePage';
import AdminUserManagement from './AdminUserManagement';
import useAppStore from '../store/useAppStore';

export default function Layout() {
  const currentView = useAppStore((s) => s.currentView);
  return (
    <>
      <div className="flex flex-col w-full h-full">
        <Header />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          {currentView === 'admin' ? (
            <AdminUserManagement />
          ) : currentView === 'profile' ? (
            <ProfilePage />
          ) : currentView === 'contents' ? (
            <ContentListPage />
          ) : (
            <>
              <MainPanel />
              <ImagePanel />
            </>
          )}
        </div>
      </div>
      <ImageModal />
    </>
  );
}
