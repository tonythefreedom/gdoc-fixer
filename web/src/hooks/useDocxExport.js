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
      const { htmlToDocxBlob } = await import('../utils/docxExporter');

      const file = files.find((f) => f.id === activeFileId);
      const rawName = file?.name || 'document';
      const safeTitle = rawName.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s_\-]/g, ' ').trim() || 'document';

      const blob = await htmlToDocxBlob(activeFileContent, safeTitle);

      const name = rawName.replace(/\.hwp$/i, '');
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
