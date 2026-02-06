import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import useAppStore from '../../store/useAppStore';

const FONT_STYLE = {
  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '12px',
  lineHeight: '20px',
  tabSize: 2,
};

export default function HtmlEditor() {
  const activeFileContent = useAppStore((s) => s.activeFileContent);
  const activeFileId = useAppStore((s) => s.activeFileId);
  const updateFileContent = useAppStore((s) => s.updateFileContent);

  const [localContent, setLocalContent] = useState('');
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);

  useEffect(() => {
    setLocalContent(activeFileContent);
  }, [activeFileId, activeFileContent]);

  const debouncedUpdate = useDebounce((content) => {
    updateFileContent(content);
  }, 300);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalContent(val);
    debouncedUpdate(val);
  };

  const handlePaste = (e) => {
    setTimeout(() => {
      updateFileContent(e.target.value);
    }, 0);
  };

  const handleScroll = useCallback(() => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const lineCount = useMemo(() => {
    const count = localContent.split('\n').length;
    return Math.max(count, 1);
  }, [localContent]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1);
  }, [lineCount]);

  if (!activeFileId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
        좌측에서 파일을 선택하거나 새 파일을 만드세요
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-500 font-medium">
        HTML / CSS Editor
      </div>
      <div className="flex-1 flex min-h-0 relative">
        {/* Line number gutter */}
        <div
          ref={gutterRef}
          className="bg-slate-50 border-r border-slate-200 text-right select-none overflow-hidden shrink-0"
          style={{ ...FONT_STYLE, width: '48px', padding: '12px 8px 12px 4px' }}
          aria-hidden="true"
        >
          {lineNumbers.map((num) => (
            <div key={num} className="text-slate-400" style={{ height: '20px' }}>
              {num}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={handleChange}
          onPaste={handlePaste}
          onScroll={handleScroll}
          className="flex-1 resize-none bg-white text-slate-800 outline-none border-none"
          style={{ ...FONT_STYLE, padding: '12px', whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto' }}
          spellCheck={false}
          placeholder="HTML/CSS를 붙여넣으세요..."
        />
      </div>
    </div>
  );
}
