import { useState } from 'react';
import {
  Loader2,
  Sparkles,
  Code2,
  Presentation,
  Share2,
  Layers,
  Wand2,
  FileType,
  FileDown,
  FileCode,
  AlignLeft,
  FilePlus2,
  Languages,
  Globe,
  Image as ImageIcon,
  Play,
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { listDesignSystems } from '../utils/slideDesignSystems';

// ─── 인라인 SVG 비주얼 ───────────────────────────────────────────

function HeroVisual() {
  return (
    <svg viewBox="0 0 520 360" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="hv-bg" x1="0" y1="0" x2="520" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eef2ff" />
          <stop offset="1" stopColor="#faf5ff" />
        </linearGradient>
        <linearGradient id="hv-acc" x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <filter id="hv-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodOpacity="0.12" />
        </filter>
      </defs>
      <rect x="0" y="0" width="520" height="360" rx="20" fill="url(#hv-bg)" />
      {/* 좌측 — HTML 에디터 mockup */}
      <g filter="url(#hv-shadow)">
        <rect x="32" y="44" width="210" height="280" rx="10" fill="#0f172a" />
        <circle cx="48" cy="60" r="4" fill="#ef4444" />
        <circle cx="60" cy="60" r="4" fill="#f59e0b" />
        <circle cx="72" cy="60" r="4" fill="#22c55e" />
        <rect x="44" y="80" width="80" height="6" rx="3" fill="#a78bfa" />
        <rect x="44" y="94" width="140" height="4" rx="2" fill="#475569" />
        <rect x="56" y="106" width="120" height="4" rx="2" fill="#475569" />
        <rect x="56" y="118" width="100" height="4" rx="2" fill="#475569" />
        <rect x="44" y="132" width="90" height="6" rx="3" fill="#67e8f9" />
        <rect x="44" y="146" width="150" height="4" rx="2" fill="#475569" />
        <rect x="56" y="158" width="130" height="4" rx="2" fill="#475569" />
        <rect x="56" y="170" width="110" height="4" rx="2" fill="#475569" />
        <rect x="44" y="184" width="70" height="6" rx="3" fill="#fbbf24" />
        <rect x="44" y="198" width="140" height="4" rx="2" fill="#475569" />
        <rect x="56" y="210" width="120" height="4" rx="2" fill="#475569" />
        <rect x="44" y="246" width="180" height="60" rx="6" fill="#1e293b" />
        <rect x="52" y="256" width="120" height="3" rx="1.5" fill="#64748b" />
        <rect x="52" y="266" width="140" height="3" rx="1.5" fill="#64748b" />
        <rect x="52" y="276" width="110" height="3" rx="1.5" fill="#64748b" />
        <rect x="200" y="293" width="18" height="9" rx="3" fill="url(#hv-acc)" />
      </g>
      {/* 화살표 — AI 변환 */}
      <g transform="translate(252, 168)">
        <circle cx="14" cy="14" r="22" fill="#ffffff" />
        <circle cx="14" cy="14" r="22" fill="url(#hv-acc)" opacity="0.18" />
        <path d="M4 14 L24 14 M18 8 L24 14 L18 20" stroke="url(#hv-acc)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
      <text x="265" y="218" textAnchor="middle" fontSize="11" fill="#6366f1" fontWeight="600" fontFamily="ui-sans-serif, system-ui">AI 변환</text>
      {/* 우측 — 슬라이드 stack */}
      <g filter="url(#hv-shadow)">
        <rect x="310" y="60" width="180" height="100" rx="6" fill="#ffffff" />
        <rect x="320" y="72" width="60" height="6" rx="3" fill="url(#hv-acc)" />
        <rect x="320" y="86" width="120" height="3" rx="1.5" fill="#cbd5e1" />
        <rect x="320" y="94" width="100" height="3" rx="1.5" fill="#cbd5e1" />
        <rect x="320" y="118" width="36" height="24" rx="3" fill="#eef2ff" />
        <rect x="362" y="118" width="36" height="24" rx="3" fill="#eef2ff" />
        <rect x="404" y="118" width="36" height="24" rx="3" fill="#eef2ff" />
      </g>
      <g filter="url(#hv-shadow)">
        <rect x="320" y="180" width="180" height="100" rx="6" fill="#ffffff" />
        <rect x="330" y="192" width="80" height="6" rx="3" fill="url(#hv-acc)" />
        <rect x="330" y="206" width="130" height="3" rx="1.5" fill="#cbd5e1" />
        <rect x="330" y="214" width="110" height="3" rx="1.5" fill="#cbd5e1" />
        <g transform="translate(335, 230)">
          <circle cx="3" cy="3" r="2" fill="#6366f1" />
          <rect x="10" y="1.5" width="120" height="3" rx="1.5" fill="#94a3b8" />
        </g>
        <g transform="translate(335, 244)">
          <circle cx="3" cy="3" r="2" fill="#6366f1" />
          <rect x="10" y="1.5" width="100" height="3" rx="1.5" fill="#94a3b8" />
        </g>
        <g transform="translate(335, 258)">
          <circle cx="3" cy="3" r="2" fill="#6366f1" />
          <rect x="10" y="1.5" width="110" height="3" rx="1.5" fill="#94a3b8" />
        </g>
      </g>
      {/* AI 스파클 */}
      <g transform="translate(478, 32)">
        <path d="M9 0 L11.4 6.6 L18 9 L11.4 11.4 L9 18 L6.6 11.4 L0 9 L6.6 6.6 Z" fill="#fbbf24" />
      </g>
      <g transform="translate(298, 92)">
        <path d="M5 0 L6.4 3.6 L10 5 L6.4 6.4 L5 10 L3.6 6.4 L0 5 L3.6 3.6 Z" fill="#a855f7" />
      </g>
    </svg>
  );
}

function FeatureIconBox({ children, gradient = 'from-indigo-500 to-violet-500' }) {
  return (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} text-white shrink-0`}>
      {children}
    </div>
  );
}

// 디자인 시스템 카드 (작은 미니 슬라이드 미리보기)
function DesignSwatchCard({ ds }) {
  const [bg, primary, accent] = ds.swatch;
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
      <div className="aspect-[16/9] relative" style={{ background: bg }}>
        <div className="absolute inset-3 rounded" style={{ background: `linear-gradient(135deg, ${bg}, ${bg})` }}>
          <div className="px-3 pt-3">
            <div className="h-1.5 rounded-full" style={{ background: primary, width: '40%' }} />
            <div className="mt-2 space-y-1">
              <div className="h-1 rounded-full" style={{ background: primary, opacity: 0.4, width: '70%' }} />
              <div className="h-1 rounded-full" style={{ background: primary, opacity: 0.4, width: '55%' }} />
              <div className="h-1 rounded-full" style={{ background: primary, opacity: 0.4, width: '60%' }} />
            </div>
            <div className="mt-2 flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
              <div className="h-1 rounded-full grow" style={{ background: primary, opacity: 0.5 }} />
            </div>
          </div>
        </div>
      </div>
      <div className="px-3 py-2.5 border-t border-slate-100">
        <div className="text-xs font-semibold text-slate-800 truncate">{ds.name}</div>
        <div className="text-[10px] text-slate-500 truncate mt-0.5">{ds.description}</div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─── LoginPage (사실은 풀 랜딩 페이지) ────────────────────────────

export default function LoginPage() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const designSystems = listDesignSystems();

  const LoginBtn = ({ size = 'md' }) => (
    <button
      onClick={handleGoogleLogin}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-wait shadow-sm ${
        size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'
      }`}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <GoogleIcon />}
      <span className="font-medium text-slate-700">{loading ? '로그인 중...' : 'Google로 시작하기'}</span>
    </button>
  );

  return (
    <div className="w-full h-full overflow-y-auto bg-white">
      {/* ── Sticky Header ─────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="GDoc Fixer" className="w-7 h-7" />
            <span className="text-sm font-bold text-slate-800">GDoc Fixer</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#features" className="hover:text-indigo-600">기능</a>
            <a href="#design" className="hover:text-indigo-600">디자인 시스템</a>
            <a href="#workflow" className="hover:text-indigo-600">워크플로우</a>
            <a href="#export" className="hover:text-indigo-600">내보내기</a>
          </nav>
          <LoginBtn />
        </div>
      </header>

      {/* ── Hero ─────────────────────────────── */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/60 via-white to-white pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
              <Sparkles className="w-3.5 h-3.5" />
              AI 기반 HTML & 슬라이드 워크벤치
            </div>
            <h1 className="mt-5 text-4xl md:text-5xl font-bold leading-tight text-slate-900">
              HTML 문서를<br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                전문가급 프리젠테이션
              </span>
              으로
            </h1>
            <p className="mt-5 text-base md:text-lg text-slate-600 leading-relaxed">
              Gemini 가 HTML 문서를 분석해 16:9 슬라이드 deck 으로 변환합니다.
              IR · 컨설팅 · 분기 실적 톤의 디자인 시스템 10 종 중 하나를 골라 한 번에 적용하고,
              자연어 한 마디로 전체 슬라이드를 수정·정렬할 수 있습니다.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <LoginBtn size="lg" />
              <a href="#features" className="text-sm text-slate-600 hover:text-indigo-600 underline-offset-4 hover:underline">
                기능 둘러보기 →
              </a>
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />무료 시작</span>
              <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />가입 즉시 사용</span>
              <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />링크 공유 지원</span>
            </div>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
          </div>
          <div className="md:pl-6">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* ── Features — 3 column ──────────────── */}
      <section id="features" className="py-20 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">하나의 워크스페이스, 세 가지 출력</h2>
            <p className="mt-3 text-slate-600">한 번 작성한 문서를 편집 · 발표 · 게시 형태로 자유롭게 전환합니다.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition-shadow">
              <FeatureIconBox><Code2 className="w-6 h-6" /></FeatureIconBox>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">HTML 문서 편집</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                CodeMirror 기반 HTML 에디터 + 실시간 미리보기. 자연어 한 마디로 Gemini 가 문서 전체를 수정합니다.
              </p>
              <ul className="mt-4 text-xs text-slate-600 space-y-1.5">
                <li className="flex gap-2"><span className="text-indigo-500">▸</span> Excel · 이미지 · PDF 첨부 기반 수정</li>
                <li className="flex gap-2"><span className="text-indigo-500">▸</span> MathJax · LaTeX 자동 렌더링</li>
                <li className="flex gap-2"><span className="text-indigo-500">▸</span> AI 이미지 자동 생성 (Gemini Flash-Image)</li>
              </ul>
            </div>
            <div className="p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition-shadow">
              <FeatureIconBox gradient="from-purple-500 to-pink-500"><Presentation className="w-6 h-6" /></FeatureIconBox>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">AI 슬라이드 생성</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                HTML 콘텐츠를 분석해 1280×720 슬라이드 deck 으로 자동 분할 · 배치.
                디자인 시스템 10 종 중 하나를 골라 일관된 톤으로 한 번에 생성합니다.
              </p>
              <ul className="mt-4 text-xs text-slate-600 space-y-1.5">
                <li className="flex gap-2"><span className="text-purple-500">▸</span> 슬라이드 단위 / deck 전체 일괄 수정</li>
                <li className="flex gap-2"><span className="text-purple-500">▸</span> 앞/뒤 슬라이드 삽입 · 디자인 자동 승계</li>
                <li className="flex gap-2"><span className="text-purple-500">▸</span> 블릿 정렬 일괄 통일 + 슬라이드쇼 (F5)</li>
              </ul>
            </div>
            <div className="p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition-shadow">
              <FeatureIconBox gradient="from-emerald-500 to-teal-500"><Share2 className="w-6 h-6" /></FeatureIconBox>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">공유 & 게시</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                인증 없이 접근 가능한 공유 링크를 한 번에 발급.
                카카오톡 · 슬랙 unfurl 용 OG 메타가 자동으로 들어갑니다.
              </p>
              <ul className="mt-4 text-xs text-slate-600 space-y-1.5">
                <li className="flex gap-2"><span className="text-emerald-500">▸</span> /share/:id — HTML 문서 공유 뷰</li>
                <li className="flex gap-2"><span className="text-emerald-500">▸</span> /p/:id — 슬라이드 뷰어 + 키보드 네비</li>
                <li className="flex gap-2"><span className="text-emerald-500">▸</span> tech-blog 자동 게시 (번역 · SEO)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 디자인 시스템 갤러리 ─────────────── */}
      <section id="design" className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-100">
              <Layers className="w-3.5 h-3.5" />
              디자인 시스템 10 종
            </div>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">IR · 컨설팅 · 분기 실적 톤으로 통일</h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              팔레트 · 타이포그래피 · 레이아웃 · 블릿 스타일까지 deck 전체에 일관되게 적용됩니다.
              청중과 용도에 맞는 톤을 골라 한 번에 변환하세요.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {designSystems.map((ds) => (
              <DesignSwatchCard key={ds.id} ds={ds} />
            ))}
          </div>
        </div>
      </section>

      {/* ── AI 워크플로우 ────────────────────── */}
      <section id="workflow" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">자연어 한 마디로 deck 전체 수정</h2>
            <p className="mt-3 text-slate-600">반복 작업은 AI 에 맡기고 의사결정에 집중하세요.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-white flex gap-4">
              <FeatureIconBox gradient="from-amber-500 to-orange-500"><Wand2 className="w-6 h-6" /></FeatureIconBox>
              <div>
                <h3 className="text-base font-semibold text-slate-900">자연어 수정</h3>
                <p className="mt-1.5 text-sm text-slate-600">현재 슬라이드 · deck 전체 모드 전환. 첨부 이미지 / 스크린샷 기반 정밀 수정 지원.</p>
              </div>
            </div>
            <div className="p-6 rounded-2xl border border-slate-200 bg-white flex gap-4">
              <FeatureIconBox gradient="from-cyan-500 to-blue-500"><FilePlus2 className="w-6 h-6" /></FeatureIconBox>
              <div>
                <h3 className="text-base font-semibold text-slate-900">슬라이드 앞/뒤 삽입</h3>
                <p className="mt-1.5 text-sm text-slate-600">현재 deck 의 디자인 시스템과 인접 슬라이드 톤을 그대로 승계해 새 슬라이드 생성.</p>
              </div>
            </div>
            <div className="p-6 rounded-2xl border border-slate-200 bg-white flex gap-4">
              <FeatureIconBox gradient="from-amber-500 to-yellow-500"><AlignLeft className="w-6 h-6" /></FeatureIconBox>
              <div>
                <h3 className="text-base font-semibold text-slate-900">블릿 일괄 정렬</h3>
                <p className="mt-1.5 text-sm text-slate-600">deck 전체의 bullet 들여쓰기 · 마커 · 간격 · hanging indent 를 한 번에 통일.</p>
              </div>
            </div>
            <div className="p-6 rounded-2xl border border-slate-200 bg-white flex gap-4">
              <FeatureIconBox gradient="from-pink-500 to-rose-500"><ImageIcon className="w-6 h-6" /></FeatureIconBox>
              <div>
                <h3 className="text-base font-semibold text-slate-900">AI 이미지 자동 생성</h3>
                <p className="mt-1.5 text-sm text-slate-600">슬라이드 콘텐츠에 맞춰 placeholder 이미지를 Gemini Flash-Image 로 생성 · 배치.</p>
              </div>
            </div>
            <div className="p-6 rounded-2xl border border-slate-200 bg-white flex gap-4">
              <FeatureIconBox gradient="from-slate-600 to-slate-800"><Play className="w-6 h-6" /></FeatureIconBox>
              <div>
                <h3 className="text-base font-semibold text-slate-900">슬라이드쇼 모드</h3>
                <p className="mt-1.5 text-sm text-slate-600">F5 키 한 번으로 전체 화면 슬라이드쇼. ←/→/Space/F 키보드 네비.</p>
              </div>
            </div>
            <div className="p-6 rounded-2xl border border-slate-200 bg-white flex gap-4">
              <FeatureIconBox gradient="from-emerald-500 to-green-500"><Languages className="w-6 h-6" /></FeatureIconBox>
              <div>
                <h3 className="text-base font-semibold text-slate-900">tech-blog 자동 번역 게시</h3>
                <p className="mt-1.5 text-sm text-slate-600">한국어 → 영어 본문 자동 번역 + SEO 메타 생성 + GitHub Actions 트리거.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 내보내기 ────────────────────────── */}
      <section id="export" className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
              <FileDown className="w-3.5 h-3.5" />
              4 가지 내보내기 형식
            </div>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">원하는 형식으로 즉시 내려받기</h2>
            <p className="mt-3 text-slate-600">
              PDF — fit-to-width 자동 페이지 분할, 텍스트 경계 잘림 회피.<br />
              PPTX — 편집 가능한 슬라이드.<br />
              DOCX · HTML — 후속 편집 / 임베드 용도.
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ExportChip icon={<FileType className="w-4 h-4 text-red-500" />} label="PDF" />
              <ExportChip icon={<Presentation className="w-4 h-4 text-orange-500" />} label="PPTX" />
              <ExportChip icon={<FileDown className="w-4 h-4 text-blue-500" />} label="DOCX" />
              <ExportChip icon={<FileCode className="w-4 h-4 text-emerald-500" />} label="HTML" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
              <Globe className="w-3.5 h-3.5" />
              공유 링크 미리보기
            </div>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 px-3 py-2 flex items-center gap-2 text-[10px] text-slate-300 font-mono">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="ml-3 text-slate-400">gdoc-fixer.web.app/p/Ab12CdEf</span>
              </div>
              <div className="aspect-[16/9] bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                  <Presentation className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
                  <div className="text-xs text-slate-500">슬라이드 뷰어 — 키보드 / 마우스 네비</div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">링크 한 번이면 카카오톡 · 슬랙 unfurl 자동, 인증 없이 누구나 열람.</p>
          </div>
        </div>
      </section>

      {/* ── 최종 CTA ────────────────────────── */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
            지금 첫 deck 을 만들어 보세요
          </h2>
          <p className="mt-4 text-slate-600">
            Google 계정으로 1 분 만에 시작. 무료로 모든 기능을 사용할 수 있습니다.
          </p>
          <div className="mt-7 flex justify-center">
            <LoginBtn size="lg" />
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────── */}
      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="" className="w-5 h-5" />
            <span>GDoc Fixer — HTML 문서 + AI 슬라이드 에디터</span>
          </div>
          <div>© {new Date().getFullYear()} Banya AI</div>
        </div>
      </footer>
    </div>
  );
}

function ExportChip({ icon, label }) {
  return (
    <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg flex items-center gap-2 text-sm font-medium text-slate-700">
      {icon}
      {label}
    </div>
  );
}
