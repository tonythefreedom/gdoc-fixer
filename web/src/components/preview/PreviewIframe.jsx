import { forwardRef } from 'react';

const PreviewIframe = forwardRef(function PreviewIframe(
  { htmlContent, viewportWidth, viewportHeight },
  ref
) {
  return (
    <iframe
      ref={ref}
      srcDoc={htmlContent}
      sandbox="allow-scripts allow-same-origin"
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
