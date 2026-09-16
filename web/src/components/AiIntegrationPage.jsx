import { useState } from 'react';
import { Bot, Copy, Check, Key, ExternalLink, Terminal } from 'lucide-react';
import useAppStore from '../store/useAppStore';

const BASE = 'https://docs.prototypebench.org';

function Code({ children }) {
  const [copied, setCopied] = useState(false);
  const text = String(children).trim();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* 클립보드 차단 환경 — 직접 선택해 복사 */ }
  };
  return (
    <div className="relative group">
      <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">
        {text}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-slate-100 opacity-0 group-hover:opacity-100 transition"
        title="복사"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function Platform({ id, name, tint, children }) {
  return (
    <section id={id} className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-5">
      <h3 className={`text-base font-semibold mb-3 ${tint}`}>{name}</h3>
      <div className="space-y-3 text-sm text-slate-300">{children}</div>
    </section>
  );
}

/**
 * AI 연동 안내. 사람이 읽는 화면이고, AI 는 /api/guide 를 직접 읽는다.
 * 그래서 여기서는 "어디에 무엇을 붙여넣는지"만 짧게 다룬다.
 */
export default function AiIntegrationPage() {
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-5 h-5 text-indigo-400" />
          <h1 className="text-2xl font-bold text-slate-100">AI 연동</h1>
        </div>
        <p className="text-sm text-slate-400 mb-8">
          Claude · ChatGPT · Gemini · Grok 이 내 계정으로 한글 양식을 채우고, 문서와 슬라이드를 웹에 게시하게 합니다.
        </p>

        {/* 1. 키 */}
        <section className="bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border border-indigo-500/30 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-semibold text-slate-100">먼저 API 키를 발급하세요</h2>
          </div>
          <p className="text-sm text-slate-300 mb-4">
            모든 연동은 이 키 하나로 됩니다. 발급 직후 한 번만 보이니 안전한 곳에 복사해 두세요.
          </p>
          <button
            onClick={() => setCurrentView('profile')}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
          >
            프로필에서 키 발급하기
          </button>
        </section>

        {/* 2. 가장 빠른 길 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-100 mb-3">가장 빠른 방법</h2>
          <p className="text-sm text-slate-400 mb-3">
            어떤 AI 든, 아래 한 줄을 그대로 주면 나머지는 알아서 합니다. 사용법 전문이 그 주소에 있습니다.
          </p>
          <Code>{`${BASE}/api/guide 를 읽고, 내 API 키 gdk_... 로 이 양식을 채워줘`}</Code>
        </section>

        {/* 3. 플랫폼별 */}
        <h2 className="text-lg font-semibold text-slate-100 mb-4">플랫폼별 설정</h2>

        <Platform id="claude" name="Claude · Claude Code" tint="text-orange-300">
          <p>대화창에 그대로 붙여넣으면 됩니다. 파일을 다루므로 Claude Code 가 가장 잘 맞습니다.</p>
          <Code>{`# 터미널에서 (Claude Code)
export GDOC_KEY=gdk_...

curl -s ${BASE}/api/guide   # 사용법 확인

curl -X POST "${BASE}/api/hwpx/inspect" \\
  -H "x-api-key: $GDOC_KEY" -F "template=@양식.hwpx"`}</Code>
          <p className="text-xs text-slate-500">
            Claude 웹/앱에서는 위 가이드 주소와 키를 알려주면 됩니다.
          </p>
        </Platform>

        <Platform id="chatgpt" name="ChatGPT · GPTs Actions" tint="text-emerald-300">
          <p>
            나만의 GPT 를 만들 때 <strong className="text-slate-200">Actions</strong> 에 아래 스키마 주소를 넣고,
            인증은 <strong className="text-slate-200">API Key (Custom header: x-api-key)</strong> 로 설정합니다.
          </p>
          <Code>{`${BASE}/api/tools?format=openai`}</Code>
          <p className="text-xs text-slate-500">
            일반 대화에서는 가이드 주소를 붙여넣어도 동작합니다.
          </p>
        </Platform>

        <Platform id="gemini" name="Gemini" tint="text-sky-300">
          <p>
            function calling 을 쓴다면 같은 스키마를 그대로 등록할 수 있습니다.
            Gemini CLI 나 대화에서는 가이드 주소를 주는 편이 간단합니다.
          </p>
          <Code>{`${BASE}/api/tools?format=openai   # function declarations 로 사용`}</Code>
        </Platform>

        <Platform id="grok" name="Grok" tint="text-slate-200">
          <p>tool use 형식을 지원합니다. 아래 주소의 tools 배열을 그대로 넘기면 됩니다.</p>
          <Code>{`${BASE}/api/tools`}</Code>
        </Platform>

        {/* 4. 할 수 있는 일 */}
        <h2 className="text-lg font-semibold text-slate-100 mb-4 mt-10">할 수 있는 일</h2>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-5">
          <h3 className="text-sm font-semibold text-slate-100 mb-2 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" /> 한글 양식 채우기
          </h3>
          <p className="text-sm text-slate-400 mb-3">
            양식 .hwpx 의 서식을 그대로 둔 채 내용만 채웁니다. 표 행이 모자라면 복제해 늘릴 수 있습니다.
          </p>
          <Code>{`curl -X POST "${BASE}/api/hwpx/inspect" -H "x-api-key: $GDOC_KEY" -F "template=@양식.hwpx"
# → 단락 구조를 보고 AI 가 내용을 정한 뒤
curl -X POST "${BASE}/api/hwpx/apply" -H "x-api-key: $GDOC_KEY" \\
  -F "template=@양식.hwpx" -F "paragraphs=@내용.json" -o 완성.hwpx`}</Code>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-5">
          <h3 className="text-sm font-semibold text-slate-100 mb-2">문서 · 슬라이드를 웹에 게시</h3>
          <p className="text-sm text-slate-400 mb-3">
            AI 가 만든 HTML 을 URL 로 올립니다. 링크를 아는 사람만 볼 수 있습니다.
          </p>
          <Code>{`curl -X POST "${BASE}/api/pages" -H "x-api-key: $GDOC_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"제목","html":"<!DOCTYPE html>..."}'
# → { "url": "${BASE}/share/AbC12xYz" }`}</Code>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-5">
          <h3 className="text-sm font-semibold text-slate-100 mb-2">디자인 시스템</h3>
          <p className="text-sm text-slate-400 mb-3">
            24종 프리셋의 규칙을 AI 프롬프트에 그대로 넣을 수 있는 형태로 내려줍니다.
            내 브랜드 색으로 직접 만들 수도 있습니다.
          </p>
          <Code>{`curl "${BASE}/api/design-systems"            # 목록
curl "${BASE}/api/design-systems?id=banya-ai"  # 규칙 블록

# 내 디자인 시스템 만들기 (팔레트 7색만 주면 나머지는 기본값)
curl -X POST "${BASE}/api/design-systems" -H "x-api-key: $GDOC_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"우리 브랜드","palette":{"background":"#0f1720","surface":"#16212b",
       "primary":"#3ddc97","accent":"#ffd166","text":"#e8f1f5","muted":"#8aa0ad","divider":"#24323d"}}'`}</Code>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <p className="text-sm text-slate-400">
            전체 사용법은 <a href={`${BASE}/api/guide`} target="_blank" rel="noopener"
            className="text-indigo-400 hover:underline inline-flex items-center gap-1">
              /api/guide <ExternalLink className="w-3 h-3" /></a> 에 있습니다.
            AI 에게 이 주소를 알려주면 스스로 읽고 사용합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
