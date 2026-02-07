import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, Sparkles, X, Search, Image, FileText, Save, CheckCircle2, Mic, MicOff } from 'lucide-react';
import useAppStore from '../../store/useAppStore';

const STEPS = [
  { key: 'researching', icon: Search, label: 'Google 검색으로 주제 조사 및 구조 설계 중...' },
  { key: 'generating-images', icon: Image, label: '이미지 생성 중...' },
  { key: 'processing-images', icon: Image, label: '이미지 후처리 중...' },
  { key: 'composing', icon: FileText, label: 'HTML 기획안 문서 작성 중...' },
  { key: 'saving', icon: Save, label: '파일 저장 중...' },
];

export default function PlanningEditor() {
  const [brief, setBrief] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [error, setError] = useState(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const briefRef = useRef(brief);
  briefRef.current = brief;

  const cancelPlanning = useAppStore((s) => s.cancelPlanning);
  const createFileWithContent = useAppStore((s) => s.createFileWithContent);
  const uid = useAppStore((s) => s.uid);

  // Web Speech API
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      // Append final + interim to existing brief
      const base = briefRef.current.endsWith('\n') || !briefRef.current
        ? briefRef.current
        : briefRef.current + ' ';
      setBrief(base + finalTranscript + interim);
    };

    recognition.onend = () => {
      // Commit only final transcript
      if (finalTranscript) {
        const base = briefRef.current;
        // briefRef already has the latest via onresult, just clean up interim
        setBrief((prev) => {
          // Remove any trailing interim text by using only base + final
          const cleanBase = prev.substring(0, prev.length);
          return cleanBase;
        });
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
      if (e.error !== 'no-speech') {
        setIsListening(false);
        recognitionRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, stopListening, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const markStepComplete = (stepKey) => {
    setCompletedSteps((prev) => [...prev, stepKey]);
  };

  const handleGenerate = async () => {
    if (!brief.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setCompletedSteps([]);

    try {
      const { researchAndPlan, generateImages, processGeneratedImages, composeDocument } =
        await import('../../utils/geminiApi');
      const { uploadDocumentImages } = await import('../../store/storage');

      // Step 1: Research + Plan
      setCurrentStep('researching');
      const plan = await researchAndPlan(brief);
      markStepComplete('researching');

      // Step 2: Generate images
      setCurrentStep('generating-images');
      const generatedImages = await generateImages(plan.imageDescriptions);
      markStepComplete('generating-images');

      // Step 3: Process images (background removal)
      setCurrentStep('processing-images');
      const processedImages = await processGeneratedImages(generatedImages);
      markStepComplete('processing-images');

      // Step 4: Compose HTML document
      setCurrentStep('composing');
      let finalHtml = await composeDocument(plan, processedImages);
      markStepComplete('composing');

      // Step 5: Upload images to GCS + Save file
      setCurrentStep('saving');
      if (uid) {
        finalHtml = await uploadDocumentImages(uid, finalHtml);
      }
      const fileName = plan.title || `기획안_${Date.now().toString(36)}`;
      await createFileWithContent(fileName, finalHtml);
      markStepComplete('saving');
    } catch (err) {
      console.error('Planning generation failed:', err);
      setError(err.message || '기획안 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
      setCurrentStep(null);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">새 기획안</h2>
                <p className="text-xs text-slate-500">AI가 자동으로 조사하고 기획안을 작성합니다</p>
              </div>
            </div>
            <button
              onClick={cancelPlanning}
              disabled={isGenerating}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Brief textarea + mic */}
          <div className="relative mb-4">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={'기획안 주제와 요구사항을 자세히 작성하세요...\n\n예시:\n- 2025년 국내 AI 산업 동향 분석 기획안\n- 신규 카페 브랜드 론칭 마케팅 전략 기획안\n- 사내 ESG 경영 도입 제안서'}
              className={`w-full resize-none rounded-xl bg-slate-50 text-slate-800 text-sm px-4 py-3 pr-12 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-200 ${
                isListening ? 'ring-2 ring-red-400 border-red-300' : ''
              }`}
              rows={12}
              disabled={isGenerating}
            />
            <button
              onClick={toggleListening}
              disabled={isGenerating}
              className={`absolute right-3 bottom-3 p-2 rounded-lg transition-colors ${
                isListening
                  ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
                  : 'bg-slate-200 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600'
              } disabled:opacity-50`}
              title={isListening ? '음성 인식 중지' : '음성으로 입력 (한국어)'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          {isListening && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              음성 인식 중... 말씀하세요
            </div>
          )}

          {/* Progress steps */}
          {isGenerating && (
            <div className="mb-6 space-y-2">
              {STEPS.map((step) => {
                const isActive = currentStep === step.key;
                const isComplete = completedSteps.includes(step.key);
                const Icon = step.icon;

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                      isActive
                        ? 'bg-emerald-50 border border-emerald-200'
                        : isComplete
                          ? 'bg-slate-50 border border-slate-100'
                          : 'bg-white border border-transparent opacity-40'
                    }`}
                  >
                    {isActive ? (
                      <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
                    ) : isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        isActive
                          ? 'text-emerald-700 font-medium'
                          : isComplete
                            ? 'text-slate-500'
                            : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !brief.trim()}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-xl transition-colors ${
              isGenerating
                ? 'bg-emerald-300 text-white cursor-wait'
                : !brief.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                기획안 생성 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                기획안 생성
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
