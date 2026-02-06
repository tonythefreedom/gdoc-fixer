import Sidebar from './Sidebar';
import MainPanel from './MainPanel';
import ImagePanel from './ImagePanel';
import ImageModal from './gallery/ImageModal';

export default function Layout() {
  return (
    <>
      <div className="flex w-full h-full">
        <Sidebar />
        <MainPanel />
        <ImagePanel />
      </div>
      <ImageModal />
    </>
  );
}
