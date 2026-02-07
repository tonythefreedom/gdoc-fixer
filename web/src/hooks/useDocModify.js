import { useState, useCallback } from 'react';
import useAppStore from '../store/useAppStore';

export function useDocModify() {
  const [isModifying, setIsModifying] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState('');

  const modifyDocument = useCallback(async (instruction) => {
    const { activeFileContent, activeFileId } = useAppStore.getState();
    if (!activeFileContent || !activeFileId || isModifying) return;

    setIsModifying(true);
    try {
      const { modifyDocumentHtml } = await import('../utils/geminiApi');
      const modifiedHtml = await modifyDocumentHtml(activeFileContent, instruction);
      await useAppStore.getState().updateFileContent(modifiedHtml);
    } catch (err) {
      console.error('Document modify failed:', err);
      alert(`문서 수정 실패: ${err.message || err}`);
    } finally {
      setIsModifying(false);
    }
  }, [isModifying]);

  const handleSubmit = useCallback(() => {
    if (!modifyPrompt.trim()) return;
    const instruction = modifyPrompt.trim();
    setModifyPrompt('');
    modifyDocument(instruction);
  }, [modifyPrompt, modifyDocument]);

  return { isModifying, modifyPrompt, setModifyPrompt, handleSubmit, modifyDocument };
}
