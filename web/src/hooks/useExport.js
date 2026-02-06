import { useCallback, useRef } from 'react';
import { toBlob } from 'html-to-image';
import { saveImage } from '../store/imageDb';
import useAppStore from '../store/useAppStore';
import { inlineExternalResources } from '../utils/fontInliner';
import { downloadBlob } from '../utils/downloadBlob';

export function useExport(previewIframeRef) {
  const hiddenIframeRef = useRef(null);

  const exportPng = useCallback(async () => {
    const { activeFileId, activeFileContent, viewportWidth, viewportHeight } =
      useAppStore.getState();
    if (!activeFileId) return;

    useAppStore.getState().setIsExporting(true);

    try {
      // Get the preview iframe's document for rendered DOM
      const iframeDoc = previewIframeRef.current?.contentDocument;

      // Inline all external resources
      const inlinedHtml = await inlineExternalResources(
        activeFileContent,
        iframeDoc
      );

      // Create hidden iframe at exact viewport dimensions
      const hidden = document.createElement('iframe');
      hidden.style.cssText = `
        position: fixed; top: 0; left: 0;
        width: ${viewportWidth}px; height: ${viewportHeight}px;
        visibility: hidden; z-index: -9999;
        border: none;
      `;
      hidden.sandbox = 'allow-same-origin';
      document.body.appendChild(hidden);
      hiddenIframeRef.current = hidden;

      // Write inlined HTML
      hidden.srcdoc = inlinedHtml;

      // Wait for load
      await new Promise((resolve) => {
        hidden.addEventListener('load', resolve, { once: true });
      });

      // Extra wait for rendering
      await new Promise((r) => setTimeout(r, 500));

      const targetNode = hidden.contentDocument.body;
      if (!targetNode) throw new Error('Hidden iframe body not accessible');

      // Capture with html-to-image
      const blob = await toBlob(targetNode, {
        width: viewportWidth,
        height: viewportHeight,
        pixelRatio: 1,
        cacheBust: true,
        skipAutoScale: true,
        backgroundColor: '#ffffff',
      });

      if (!blob) throw new Error('Failed to generate PNG blob');

      // Save to IndexedDB
      const imageId = Date.now().toString(36);
      const key = `images/${activeFileId}/${imageId}`;
      const metadata = {
        filename: `export_${viewportWidth}x${viewportHeight}.png`,
        width: viewportWidth,
        height: viewportHeight,
        createdAt: Date.now(),
      };

      await saveImage(activeFileId, imageId, blob, metadata);
      useAppStore.getState().addImage(key, blob, metadata);

      // Trigger download
      const file = useAppStore.getState().files.find((f) => f.id === activeFileId);
      const downloadName = file
        ? `${file.name}_${viewportWidth}x${viewportHeight}.png`
        : `export_${viewportWidth}x${viewportHeight}.png`;
      downloadBlob(blob, downloadName);

      // Open image panel
      useAppStore.getState().setIsImagePanelOpen(true);
    } catch (err) {
      console.error('Export failed:', err);
      alert('PNG 내보내기에 실패했습니다: ' + err.message);
    } finally {
      // Cleanup
      if (hiddenIframeRef.current) {
        document.body.removeChild(hiddenIframeRef.current);
        hiddenIframeRef.current = null;
      }
      useAppStore.getState().setIsExporting(false);
    }
  }, [previewIframeRef]);

  return { exportPng };
}
