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
      // html-to-docx 라이브러리의 console.warning 버그 패치
      if (!console.warning) {
        console.warning = console.warn;
      }

      const [{ default: HTMLtoDOCX }, { preprocessHtmlForDocx }] = await Promise.all([
        import('html-to-docx'),
        import('../utils/docxPreprocess'),
      ]);

      // HTML 전처리: Tailwind → 인라인 스타일, 이미지 → base64
      const processedHtml = await preprocessHtmlForDocx(activeFileContent);

      const file = files.find((f) => f.id === activeFileId);
      const rawName = file?.name || 'document';
      // XML 유효 문자만 남김 (html-to-docx가 title을 XML 속성으로 사용)
      const safeTitle = rawName.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s_\-]/g, ' ').trim() || 'document';

      const blob = await HTMLtoDOCX(processedHtml, null, {
        title: safeTitle,
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        font: 'Malgun Gothic',
        fontSize: 22,
      });

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
