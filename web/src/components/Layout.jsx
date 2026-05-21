import Sidebar from './Sidebar';
import MainPanel from './MainPanel';
import ImagePanel from './ImagePanel';
import ImageModal from './gallery/ImageModal';
import ContentListPage from './ContentListPage';
import useAppStore from '../store/useAppStore';

export default function Layout() {
  const currentView = useAppStore((s) => s.currentView);
  return (
    <>
      <div className="flex w-full h-full">
        <Sidebar />
        {currentView === 'contents' ? (
          <ContentListPage />
        ) : (
          <>
            <MainPanel />
            <ImagePanel />
          </>
        )}
      </div>
      <ImageModal />
    </>
  );
}
