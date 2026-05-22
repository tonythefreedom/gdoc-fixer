import { forwardRef } from 'react';
import { patchYoutubeThumbnails } from '../../utils/youtubeThumbnail.js';

const PreviewIframe = forwardRef(function PreviewIframe(
  { htmlContent, viewportWidth, viewportHeight },
  ref
) {
  // 모든 미리보기 경로(LLM 응답·Firestore 로드·기존 저장본·사용자 편집)의 HTML 이
  // 이 iframe 을 통과하므로, srcDoc 직전에 maxresdefault → hqdefault fallback 을 주입한다.
  const patchedHtml = patchYoutubeThumbnails(htmlContent);
  return (
    <iframe
      ref={ref}
      srcDoc={patchedHtml}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{
        width: `${viewportWidth}px`,
        height: `${viewportHeight}px`,
        border: 'none',
        display: 'block',
        background: '#ffffff',
      }}
      title="HTML Preview"
    />
  );
});

export default PreviewIframe;
