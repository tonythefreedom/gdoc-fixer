import { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { downloadBlob } from '../utils/downloadBlob';

export function useDocxExport() {
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  const exportDocx = async () => {
    const { activeFileContent, activeFileId, files } = useAppStore.getState();
    if (!activeFileContent || isExportingDocx) return;

    setIsExportingDocx(true);
    try {
      const HTMLtoDOCX = (await import('html-to-docx')).default;
      const blob = await HTMLtoDOCX(activeFileContent, null, {
        title: files.find((f) => f.id === activeFileId)?.name || 'document',
      });

      const file = files.find((f) => f.id === activeFileId);
      const name = (file?.name || 'document').replace(/\.hwp$/i, '');
      downloadBlob(blob, `${name}.docx`);
    } catch (err) {
      console.error('DOCX export failed:', err);
      alert(`DOCX 내보내기 실패: ${err.message || err}`);
    } finally {
      setIsExportingDocx(false);
    }
  };

  return { exportDocx, isExportingDocx };
}
