import { useCallback } from 'react';
import html2canvas from 'html2canvas';
import { saveImage } from '../store/imageDb';
import useAppStore from '../store/useAppStore';
import { downloadBlob } from '../utils/downloadBlob';

/**
 * iframe의 외부 CSS/폰트를 메인 문서에 로드하고, 폰트 파일 다운로드 완료까지 대기.
 * html2canvas가 메인 윈도우 Canvas에서 텍스트를 그리므로,
 * Font Awesome 등 아이콘 폰트가 메인 윈도우에서도 사용 가능해야 함.
 */
async function injectIframeFontsToMain(iframeDoc) {
  const cleanup = [];

  // 1. <link rel="stylesheet"> 복사 + 로드 완료 대기
  const links = Array.from(iframeDoc.querySelectorAll('link[rel="stylesheet"]'));
  const linkPromises = [];
  for (const link of links) {
    const tempLink = document.createElement('link');
    tempLink.rel = 'stylesheet';
    tempLink.href = link.href;
    tempLink.crossOrigin = 'anonymous';
    document.head.appendChild(tempLink);
    cleanup.push(tempLink);

    linkPromises.push(
      new Promise((resolve) => {
        tempLink.onload = resolve;
        tempLink.onerror = resolve;
        setTimeout(resolve, 5000); // 5초 타임아웃
      })
    );
  }
  await Promise.all(linkPromises);

  // 2. iframe CSSOM에서 @font-face 규칙 추출 → 메인 문서에 주입
  const fontFaceRules = [];
  try {
    for (const sheet of iframeDoc.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.type === CSSRule.FONT_FACE_RULE) {
            fontFaceRules.push(rule.cssText);
          }
        }
      } catch (e) {
        // cross-origin stylesheet
      }
    }
  } catch (e) {}

  if (fontFaceRules.length > 0) {
    const fontStyle = document.createElement('style');
    fontStyle.textContent = fontFaceRules.join('\n');
    document.head.appendChild(fontStyle);
    cleanup.push(fontStyle);
  }

  // 3. iframe에서 로드된 모든 폰트를 메인 윈도우에서도 강제 로드
  try {
    const loadPromises = [];
    for (const font of iframeDoc.fonts) {
      if (font.status === 'loaded') {
        loadPromises.push(
          document.fonts
            .load(`${font.weight} 16px "${font.family}"`)
            .catch(() => {})
        );
      }
    }
    await Promise.all(loadPromises);
  } catch (e) {}

  await document.fonts.ready;

  return cleanup;
}

/**
 * html2canvas는 ::before 가상 요소의 수직 위치를 정확히 렌더링하지 못함.
 * Font Awesome 아이콘을 Canvas에 사전 렌더링한 이미지로 대체하여 위치 정확도 향상.
 * iframe DOM을 직접 수정 후 캡처, 완료 후 복원.
 */
function prepareFaIconsForCapture(iframeDoc, iframeWin) {
  const restoreFns = [];

  const hideStyle = iframeDoc.createElement('style');
  hideStyle.textContent = '.fa-capture-fix::before { content: none !important; }';
  iframeDoc.head.appendChild(hideStyle);
  restoreFns.push(() => iframeDoc.head.removeChild(hideStyle));

  const icons = Array.from(iframeDoc.querySelectorAll('[class*="fa-"]'));
  for (const icon of icons) {
    try {
      const before = iframeWin.getComputedStyle(icon, '::before');
      const content = before.getPropertyValue('content');
      if (!content || content === 'none' || content === 'normal') continue;

      const char = content.replace(/^["']|["']$/g, '');
      if (!char) continue;

      const computedStyle = iframeWin.getComputedStyle(icon);
      const fontSize = parseFloat(computedStyle.fontSize) || 16;
      const color = computedStyle.color || '#000';
      const fontFamily =
        before.getPropertyValue('font-family') || computedStyle.fontFamily;
      const fontWeight =
        before.getPropertyValue('font-weight') || computedStyle.fontWeight;

      // 메인 윈도우 Canvas에 아이콘 렌더링 (2x 해상도)
      const scale = 2;
      const canvasSize = Math.ceil(fontSize * scale * 1.5);
      const cv = document.createElement('canvas');
      cv.width = canvasSize;
      cv.height = canvasSize;
      const ctx = cv.getContext('2d');
      ctx.font = `${fontWeight} ${fontSize * scale}px ${fontFamily}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, canvasSize / 2, canvasSize / 2);

      const img = iframeDoc.createElement('img');
      img.src = cv.toDataURL('image/png');
      img.style.cssText = `width:${fontSize}px;height:${fontSize}px;vertical-align:middle;`;

      const origHTML = icon.innerHTML;
      icon.classList.add('fa-capture-fix');
      icon.appendChild(img);

      restoreFns.push(() => {
        icon.classList.remove('fa-capture-fix');
        icon.innerHTML = origHTML;
      });
    } catch (e) {}
  }

  return () => restoreFns.forEach((fn) => fn());
}

export function useExport(previewIframeRef) {
  const exportPng = useCallback(async () => {
    const { activeFileId, viewportWidth, viewportHeight } =
      useAppStore.getState();
    if (!activeFileId) return;

    useAppStore.getState().setIsExporting(true);

    let cssCleanup = [];
    let restoreIcons = () => {};

    try {
      const iframeDoc = previewIframeRef.current?.contentDocument;
      const iframeWin = previewIframeRef.current?.contentWindow;
      if (!iframeDoc?.body || !iframeWin)
        throw new Error('Preview iframe not accessible');

      // Step 1: iframe의 CSS/폰트를 메인 문서에 로드 (Font Awesome 등)
      cssCleanup = await injectIframeFontsToMain(iframeDoc);

      // Step 2: FA 아이콘을 사전 렌더링 이미지로 대체 (수직 위치 보정)
      restoreIcons = prepareFaIconsForCapture(iframeDoc, iframeWin);

      // Step 3: html2canvas로 캡처
      const canvas = await html2canvas(iframeDoc.documentElement, {
        width: viewportWidth,
        height: viewportHeight,
        windowWidth: viewportWidth,
        windowHeight: viewportHeight,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        foreignObjectRendering: false,
      });

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png');
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

      useAppStore.getState().setIsImagePanelOpen(true);
    } catch (err) {
      console.error('Export failed:', err);
      alert('PNG 내보내기에 실패했습니다: ' + err.message);
    } finally {
      restoreIcons();
      for (const el of cssCleanup) {
        try {
          document.head.removeChild(el);
        } catch (e) {
          /* skip */
        }
      }
      useAppStore.getState().setIsExporting(false);
    }
  }, [previewIframeRef]);

  return { exportPng };
}
