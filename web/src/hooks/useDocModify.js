import { useState, useCallback, useRef, useEffect } from 'react';
import useAppStore from '../store/useAppStore';

export function useDocModify() {
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [queue, setQueue] = useState([]); // { instruction, attachments }[]
  const [currentTask, setCurrentTask] = useState(null); // currently executing instruction
  const processingRef = useRef(false);

  const isModifying = currentTask !== null;
  const queueCount = queue.length;

  // Process the queue sequentially
  useEffect(() => {
    if (processingRef.current || queue.length === 0) return;

    const processNext = async () => {
      processingRef.current = true;
      const [task, ...rest] = queue;
      setQueue(rest);
      setCurrentTask(task.instruction);

      try {
        const { activeFileContent, activeFileId } = useAppStore.getState();
        if (!activeFileContent || !activeFileId) throw new Error('활성 파일 없음');

        const { modifyDocumentHtml } = await import('../utils/geminiApi');
        const modifiedHtml = await modifyDocumentHtml(activeFileContent, task.instruction, task.attachments);
        await useAppStore.getState().updateFileContent(modifiedHtml);
      } catch (err) {
        console.error('Document modify failed:', err);
        alert(`문서 수정 실패: ${err.message || err}`);
      } finally {
        setCurrentTask(null);
        processingRef.current = false;
      }
    };

    processNext();
  }, [queue, currentTask]);

  const enqueueModify = useCallback((instruction) => {
    if (!instruction?.trim()) return;
    const { attachments, detachAllFiles } = useAppStore.getState();
    // 큐에 첨부 snapshot 을 보존한 뒤 store 의 첨부 상태는 즉시 비운다.
    // → 챗 입력창 / 미리보기의 썸네일이 enqueue 직후 사라짐.
    setQueue((prev) => [...prev, { instruction: instruction.trim(), attachments: [...attachments] }]);
    detachAllFiles();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!modifyPrompt.trim()) return;
    enqueueModify(modifyPrompt.trim());
    setModifyPrompt('');
  }, [modifyPrompt, enqueueModify]);

  const removeFromQueue = useCallback((index) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    isModifying,
    currentTask,
    queue,
    queueCount,
    modifyPrompt,
    setModifyPrompt,
    handleSubmit,
    modifyDocument: enqueueModify,
    removeFromQueue,
  };
}
