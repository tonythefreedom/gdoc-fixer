import {
  FileCode,
  Presentation,
  FileType,
  Share2,
  Sparkles,
  Wand2,
  AlignLeft,
  FilePlus2,
  Image as ImageIcon,
  Play,
  Languages,
  Globe,
  Coins,
  UserCog,
  Download,
  Send,
  Layers,
  Pencil,
} from 'lucide-react';
import { ACTION_COSTS, ACTION_LABELS, INITIAL_COIN_GRANT } from '../utils/coin';

// ─── 인포그래픽 SVG ─────────────────────────────────────────────

function FlowInfographic() {
  return (
    <svg viewBox="0 0 760 240" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="g-flow" x1="0" y1="0" x2="760" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {/* 입력 */}
      <g transform="translate(20, 80)">
        <rect x="0" y="0" width="120" height="80" rx="8" fill="#1e293b" stroke="#475569" />
        <text x="60" y="32" textAnchor="middle" fontSize="13" fontWeight="600" fill="#f1f5f9">자료 입력</text>
        <text x="60" y="54" textAnchor="middle" fontSize="10" fill="#94a3b8">텍스트 · HTML</text>
        <text x="60" y="68" textAnchor="middle" fontSize="10" fill="#94a3b8">HWP · DOCX · PDF</text>
      </g>
      {/* 화살표 */}
      <path d="M 145 120 L 195 120 M 188 114 L 195 120 L 188 126" stroke="url(#g-flow)" strokeWidth="2" fill="none" />
      {/* AI 분석 */}
      <g transform="translate(200, 80)">
        <rect x="0" y="0" width="160" height="80" rx="8" fill="url(#g-flow)" />
        <text x="80" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff">AI 분석/생성</text>
        <text x="80" y="56" textAnchor="middle" fontSize="10" fill="#e0e7ff">분할 · 디자인 적용</text>
        <text x="80" y="70" textAnchor="middle" fontSize="10" fill="#e0e7ff">번역 · 이미지 생성</text>
      </g>
      <path d="M 365 120 L 415 120 M 408 114 L 415 120 L 408 126" stroke="url(#g-flow)" strokeWidth="2" fill="none" />
      {/* 편집/공유 */}
      <g transform="translate(420, 80)">
        <rect x="0" y="0" width="160" height="80" rx="8" fill="#1e293b" stroke="#475569" />
        <text x="80" y="34" textAnchor="middle" fontSize="13" fontWeight="600" fill="#f1f5f9">편집 · 미세조정</text>
        <text x="80" y="56" textAnchor="middle" fontSize="10" fill="#94a3b8">자연어 / 단락 수정</text>
        <text x="80" y="70" textAnchor="middle" fontSize="10" fill="#94a3b8">슬라이드 삽입 · 정렬</text>
      </g>
      <path d="M 585 120 L 635 120 M 628 114 L 635 120 L 628 126" stroke="url(#g-flow)" strokeWidth="2" fill="none" />
      {/* 출력 */}
      <g transform="translate(640, 80)">
        <rect x="0" y="0" width="100" height="80" rx="8" fill="#0f172a" stroke="#475569" />
        <text x="50" y="32" textAnchor="middle" fontSize="13" fontWeight="600" fill="#f1f5f9">내보내기</text>
        <text x="50" y="54" textAnchor="middle" fontSize="9" fill="#94a3b8">PDF · PPTX</text>
        <text x="50" y="66" textAnchor="middle" fontSize="9" fill="#94a3b8">DOCX · HTML · HWP</text>
      </g>
      {/* 상하 컨텍스트 텍스트 */}
      <text x="380" y="30" textAnchor="middle" fontSize="11" fontWeight="600" fill="#94a3b8">
        엔드-투-엔드 콘텐츠 파이프라인
      </text>
      <text x="380" y="200" textAnchor="middle" fontSize="10" fill="#64748b">
        자료 → AI 가 deck/문서로 가공 → 사용자가 미세조정 → 원하는 형식으로 즉시 출력
      </text>
    </svg>
  );
}

function CoinEconomyInfographic() {
  const items = Object.entries(ACTION_COSTS).map(([key, cost]) => ({
    key,
    cost,
    label: ACTION_LABELS[key] || key,
  }));
  const max = Math.max(...items.map((i) => i.cost));
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {items.map((it) => {
        const w = Math.max(8, (it.cost / max) * 100);
        return (
          <div key={it.key} className="flex items-center gap-3">
            <div className="w-44 shrink-0 text-xs text-slate-300 truncate">{it.label}</div>
            <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${w}%` }} />
            </div>
            <div className="w-14 text-right text-xs font-semibold text-amber-300">{it.cost.toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}

function StepCard({ n, title, children, icon }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {icon}
          <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
        </div>
        <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Section({ id, title, subtitle, children }) {
  return (
    <section id={id} className="scroll-mt-20 mb-12">
      <header className="mb-5">
        <h2 className="text-xl font-bold text-slate-100">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function KeyHint({ children }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-[10px] font-mono text-slate-300">
      {children}
    </kbd>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────

export default function GuidePage() {
  return (
    <main className="flex-1 h-full overflow-y-auto bg-slate-950">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">사용 가이드</h1>
          <p className="text-sm text-slate-400 mt-1">
            서비스의 전체 워크플로우와 각 기능의 세부 사용법을 한 곳에서 확인하세요.
          </p>
        </header>

        {/* 목차 */}
        <nav className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
          <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">목차</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
            <a href="#overview" className="text-indigo-400 hover:underline">1. 전체 워크플로우</a>
            <a href="#html" className="text-indigo-400 hover:underline">2. HTML 문서 편집</a>
            <a href="#hwp" className="text-indigo-400 hover:underline">3. 한글(HWP) 작성</a>
            <a href="#slides" className="text-indigo-400 hover:underline">4. AI 슬라이드 생성</a>
            <a href="#slide-edit" className="text-indigo-400 hover:underline">5. 슬라이드 편집</a>
            <a href="#share" className="text-indigo-400 hover:underline">6. 공유 링크 & 게시</a>
            <a href="#export" className="text-indigo-400 hover:underline">7. 내보내기</a>
            <a href="#coin" className="text-indigo-400 hover:underline">8. 코인 시스템</a>
            <a href="#profile" className="text-indigo-400 hover:underline">9. 프로필 관리</a>
          </div>
        </nav>

        {/* 1. 전체 워크플로우 */}
        <Section
          id="overview"
          title="1. 전체 워크플로우"
          subtitle="자료를 넣으면 AI 가 문서/슬라이드로 가공하고, 미세조정 후 원하는 형식으로 출력됩니다."
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">
            <FlowInfographic />
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="font-semibold text-slate-100 mb-1">입력 가능한 자료</h4>
              <ul className="text-slate-300 space-y-1 list-disc list-inside">
                <li>HTML 문서 (신규 작성 또는 import)</li>
                <li>한글(.hwp / .hwpx) 파일 업로드</li>
                <li>DOCX 파일 import (HTML 로 변환)</li>
                <li>채팅 입력에 첨부: 이미지 · PDF · 스프레드시트 · 텍스트</li>
              </ul>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="font-semibold text-slate-100 mb-1">출력 가능한 형식</h4>
              <ul className="text-slate-300 space-y-1 list-disc list-inside">
                <li>PDF · PPTX · DOCX · HTML</li>
                <li>한글(HWP / HWPX) — 한컴오피스 네이티브</li>
                <li>공유 링크 (인증 없이 누구나 열람)</li>
                <li>기술 블로그 자동 게시 (영문 자동 번역)</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* 2. HTML 문서 편집 */}
        <Section id="html" title="2. HTML 문서 편집" subtitle="좌측 코드 에디터 + 우측 실시간 미리보기. 자연어 한 마디로 AI 가 문서 전체를 수정합니다.">
          <div className="space-y-5">
            <StepCard n={1} title="새 문서 만들기" icon={<FileCode className="w-4 h-4 text-indigo-400" />}>
              사이드바의 「새 파일」 버튼으로 빈 HTML 문서를 생성합니다. 또는 「HWP 가져오기」/「DOCX 가져오기」 로 기존 파일을 import.
            </StepCard>
            <StepCard n={2} title="자연어로 AI 수정" icon={<Wand2 className="w-4 h-4 text-amber-400" />}>
              하단 입력창에 수정 지시를 적어 보내세요. 예: <span className="text-slate-400">"표를 더 깔끔하게"</span>, <span className="text-slate-400">"결론 단락 추가"</span>. AI 가 문서 전체를 다시 작성해 우측 미리보기에 즉시 반영합니다.
            </StepCard>
            <StepCard n={3} title="파일 첨부 기반 수정" icon={<ImageIcon className="w-4 h-4 text-pink-400" />}>
              입력창의 첨부 버튼으로 스프레드시트 · 이미지 · PDF · 텍스트 파일을 첨부 → AI 가 그 내용을 참조해 문서를 수정합니다.
            </StepCard>
            <StepCard n={4} title="수식 자동 렌더링" icon={<Sparkles className="w-4 h-4 text-emerald-400" />}>
              LaTeX 표기(<code className="text-emerald-300">$E=mc^2$</code> 등) 를 사용하면 미리보기에서 자동으로 수식이 렌더링됩니다. 별도 설정 불필요.
            </StepCard>
            <StepCard n={5} title="AI 이미지 자동 생성" icon={<ImageIcon className="w-4 h-4 text-purple-400" />}>
              수정 지시에서 "이미지 생성 요청"이 감지되면 생성 AI 로 이미지를 만들어 문서에 자동 삽입합니다. 별도 사이트 이동 불필요.
            </StepCard>
          </div>
        </Section>

        {/* 3. 한글(HWP) 작성 */}
        <Section id="hwp" title="3. 한글(HWP) 작성" subtitle="한글 파일을 가져와 웹 에디터로 바로 편집. AI 가 본문 단락을 자연어로 수정합니다.">
          <div className="space-y-5">
            <StepCard n={1} title="HWP 가져오기" icon={<FileType className="w-4 h-4 text-amber-400" />}>
              사이드바의 「HWP 가져오기」 버튼 → .hwp / .hwpx 파일 선택. 파일이 클라우드에 안전하게 업로드되고 한글 에디터가 자동으로 열립니다.
            </StepCard>
            <StepCard n={2} title="좌측 채팅으로 단락 수정" icon={<Wand2 className="w-4 h-4 text-indigo-400" />}>
              화면이 좌(채팅) / 우(에디터) 로 분할됩니다. 좌측 채팅창에 자연어 지시를 입력하세요. 예: <span className="text-slate-400">"표현을 정중한 비즈니스 톤으로"</span>, <span className="text-slate-400">"전체를 영어로 번역"</span>. AI 가 본문 단락을 일괄 수정해 에디터에 즉시 반영됩니다.
            </StepCard>
            <StepCard n={3} title="단축키" icon={<Sparkles className="w-4 h-4 text-emerald-400" />}>
              채팅 입력에서 <KeyHint>Cmd</KeyHint> + <KeyHint>Enter</KeyHint> (또는 <KeyHint>Ctrl</KeyHint> + <KeyHint>Enter</KeyHint>) 로 즉시 전송.
            </StepCard>
            <StepCard n={4} title="원본 서식 보존" icon={<FileType className="w-4 h-4 text-purple-400" />}>
              표 · 이미지 · 헤더/푸터 · 페이지 설정 등 비-단락 콘텐츠는 그대로 유지됩니다. AI 는 본문 단락 텍스트만 교체.
            </StepCard>
            <StepCard n={5} title="HWP / HWPX 로 내보내기" icon={<Download className="w-4 h-4 text-amber-400" />}>
              우측 상단의 「HWP」 또는 「HWPX」 버튼 → 한컴오피스 / 한글 2020+ 에서 그대로 열 수 있는 파일로 다운로드.
            </StepCard>
          </div>
        </Section>

        {/* 4. AI 슬라이드 생성 */}
        <Section id="slides" title="4. AI 슬라이드 생성" subtitle="HTML 문서를 16:9 슬라이드 deck 으로 자동 변환 · 디자인 시스템 10 종 중 선택.">
          <div className="space-y-5">
            <StepCard n={1} title="디자인 시스템 선택" icon={<Layers className="w-4 h-4 text-purple-400" />}>
              HTML 에디터 헤더의 「슬라이드 생성」 옆 디자인 시스템 picker 에서 10 종(IR / 컨설팅 / 분기 실적 / 로드쇼 등) 중 선택. 미니 미리보기 모달로 시각 확인 가능.
            </StepCard>
            <StepCard n={2} title="슬라이드 생성" icon={<Presentation className="w-4 h-4 text-purple-400" />}>
              「슬라이드 생성」 버튼 → AI 가 문서를 분석해 논리 단위로 분할 · 16:9 슬라이드 deck 생성. 디자인 시스템의 팔레트 / 타이포 / 레이아웃이 모든 슬라이드에 일관 적용.
            </StepCard>
            <StepCard n={3} title="진행 상황 모니터링" icon={<Sparkles className="w-4 h-4 text-amber-400" />}>
              생성 중에는 단계별 진행률(분석 → 이미지 생성 → 슬라이드 구성)이 표시됩니다. 페이지를 닫아도 자동으로 재개됩니다.
            </StepCard>
          </div>
        </Section>

        {/* 5. 슬라이드 편집 */}
        <Section id="slide-edit" title="5. 슬라이드 편집" subtitle="단일 슬라이드 / deck 전체 수정 · 슬라이드 삽입 · 블릿 정렬 · 슬라이드쇼.">
          <div className="space-y-5">
            <StepCard n={1} title="모드 전환" icon={<Wand2 className="w-4 h-4 text-indigo-400" />}>
              하단의 「현재 슬라이드」 / 「전체 슬라이드」 토글로 수정 범위를 선택. 현재 슬라이드 모드는 1 장만, 전체 모드는 deck 전부를 한 번에 수정.
            </StepCard>
            <StepCard n={2} title="앞/뒤 슬라이드 삽입" icon={<FilePlus2 className="w-4 h-4 text-cyan-400" />}>
              모드 토글 옆 「앞 삽입」 / 「뒤 삽입」 버튼 → 모달에서 새 슬라이드의 콘텐츠 지시 입력 → AI 가 디자인 시스템 + 인접 슬라이드 톤을 그대로 승계해 새 슬라이드 생성 · 삽입.
            </StepCard>
            <StepCard n={3} title="블릿 일괄 정렬" icon={<AlignLeft className="w-4 h-4 text-amber-400" />}>
              「블릿 정렬」 버튼 → deck 전체의 bullet 들여쓰기 · 마커 · 간격 · hanging indent 를 한 번에 통일.
            </StepCard>
            <StepCard n={4} title="슬라이드쇼 모드" icon={<Play className="w-4 h-4 text-slate-300" />}>
              헤더의 「슬라이드쇼」 버튼 또는 <KeyHint>F5</KeyHint> → 전체 화면 슬라이드뷰. <KeyHint>←</KeyHint> / <KeyHint>→</KeyHint> / <KeyHint>Space</KeyHint> 네비, <KeyHint>F</KeyHint> 로 브라우저 fullscreen 토글, <KeyHint>Esc</KeyHint> 종료.
            </StepCard>
            <StepCard n={5} title="버전 이력 / 복원" icon={<Sparkles className="w-4 h-4 text-emerald-400" />}>
              슬라이드 헤더의 「이력」 아이콘 → 각 수정 스냅샷으로 원클릭 복원.
            </StepCard>
          </div>
        </Section>

        {/* 6. 공유 링크 & 게시 */}
        <Section id="share" title="6. 공유 링크 & 게시" subtitle="인증 없이 누구나 열람 가능한 공유 URL 발급. 메신저/협업 도구 미리보기 자동.">
          <div className="space-y-5">
            <StepCard n={1} title="HTML 문서 공유" icon={<Share2 className="w-4 h-4 text-emerald-400" />}>
              HTML 에디터 헤더의 「공유 링크」 버튼 → 인증 없이 열람 가능한 URL 발급. 메신저 / 협업 도구에 붙여넣으면 제목 · 요약 · 썸네일 미리보기 자동.
            </StepCard>
            <StepCard n={2} title="슬라이드 공유" icon={<Presentation className="w-4 h-4 text-emerald-400" />}>
              슬라이드 에디터 헤더의 「공유 링크」 → 슬라이드 뷰어 URL 발급. 외부 사용자도 키보드 / 마우스로 슬라이드 네비 가능.
            </StepCard>
            <StepCard n={3} title="컨텐츠 페이지에서 일괄 관리" icon={<UserCog className="w-4 h-4 text-slate-300" />}>
              사이드바의 「컨텐츠」 메뉴 → Shared / Presentations / Files 섹션에서 모든 공유 링크와 파일을 검색 / 정렬 / 일괄 관리.
            </StepCard>
            <StepCard n={4} title="기술 블로그 자동 번역 게시" icon={<Languages className="w-4 h-4 text-emerald-400" />}>
              슈퍼관리자 전용. HTML 에디터 헤더의 「기술 블로그 게시」 → 한국어 → 영어 자동 번역 + SEO 메타 생성 + 자동 배포 파이프라인 트리거.
            </StepCard>
          </div>
        </Section>

        {/* 7. 내보내기 */}
        <Section id="export" title="7. 내보내기" subtitle="HTML / 슬라이드 → 6 가지 형식으로 즉시 다운로드.">
          <div className="grid md:grid-cols-2 gap-4 text-sm mb-5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" /> HTML 문서 내보내기
              </h4>
              <p className="text-slate-300">에디터 헤더의 「내보내기」 메뉴 → PDF / DOCX / HTML 선택.</p>
              <p className="text-slate-400 text-xs mt-2">
                PDF 는 A4 자동 페이지 분할 + 텍스트 경계 잘림 방지. DOCX 는 후속 편집 / 임베드 용도.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
                <Presentation className="w-4 h-4 text-purple-400" /> 슬라이드 내보내기
              </h4>
              <p className="text-slate-300">슬라이드 에디터 헤더의 「내보내기」 메뉴 → PDF / PPTX 선택.</p>
              <p className="text-slate-400 text-xs mt-2">
                PDF 는 1280×720 16:9 페이지로 출력. PPTX 는 편집 가능한 슬라이드.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
                <FileType className="w-4 h-4 text-amber-400" /> 한글 파일 내보내기
              </h4>
              <p className="text-slate-300">한글 에디터 헤더의 「HWP」 / 「HWPX」 버튼 → 한컴오피스 네이티브 형식으로 다운로드.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> 코인 차감 정책
              </h4>
              <p className="text-slate-300">내보내기는 다운로드 <span className="text-emerald-300">완료 후</span> 차감됩니다. 실패하면 차감 없음.</p>
            </div>
          </div>
        </Section>

        {/* 8. 코인 시스템 */}
        <Section id="coin" title="8. 코인 시스템" subtitle={`100 coin = $1 환율. 신규 가입 시 자동 ${INITIAL_COIN_GRANT.toLocaleString()} 코인 지급.`}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-slate-100">액션별 코인 비용 (단위: coin)</span>
            </div>
            <CoinEconomyInfographic />
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              <span className="text-slate-100 font-semibold">차감 시점:</span> AI 호출이 들어가는 액션은 <span className="text-amber-300">사전 차감</span>(잔액 부족 시 작업 차단). 단순 다운로드 / 공유 링크는 <span className="text-amber-300">사후 차감</span>(실패 시 차감 없음).
            </p>
            <p>
              <span className="text-slate-100 font-semibold">충전:</span> 프로필 페이지의 「코인 충전」 섹션에서 패키지 선택 → 결제. 결제 완료 즉시 잔액 자동 반영 (실시간 동기화).
            </p>
            <p>
              <span className="text-slate-100 font-semibold">잔액 확인:</span> 헤더 우상단의 코인 칩에 항상 표시됨. 클릭하면 프로필 페이지로 이동해 사용 내역 확인.
            </p>
          </div>
        </Section>

        {/* 9. 프로필 관리 */}
        <Section id="profile" title="9. 프로필 관리" subtitle="사진 변경 · 이름 수정 · 사용량 통계 · 코인 충전.">
          <div className="space-y-5">
            <StepCard n={1} title="프로필 진입" icon={<UserCog className="w-4 h-4 text-indigo-400" />}>
              헤더 우상단의 프로필 사진 → 「프로필 / 사용량」 또는 코인 칩 클릭.
            </StepCard>
            <StepCard n={2} title="사진 변경" icon={<ImageIcon className="w-4 h-4 text-pink-400" />}>
              프로필 카드의 카메라 아이콘 → 이미지 선택 → 자동 업로드. Google 계정 사진 대신 직접 업로드 가능.
            </StepCard>
            <StepCard n={3} title="이름 수정" icon={<Pencil className="w-4 h-4 text-slate-300" />}>
              이름 옆 연필 아이콘 → 인라인 편집 → <KeyHint>Enter</KeyHint> 로 저장. Google 계정 표시 이름과 별개.
            </StepCard>
            <StepCard n={4} title="사용량 내역" icon={<Sparkles className="w-4 h-4 text-amber-400" />}>
              「액션별 코인 비용 / 사용량」 표에서 각 기능을 몇 번 썼는지 누적 통계 확인.
            </StepCard>
            <StepCard n={5} title="코인 충전" icon={<Send className="w-4 h-4 text-emerald-400" />}>
              「코인 충전」 섹션 → 4 패키지 (체험 / 스타터 / 프로 / 비즈니스) 중 선택 → 안전 결제 페이지로 이동.
            </StepCard>
          </div>
        </Section>

        {/* 푸터 안내 */}
        <div className="mt-12 p-5 bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-800 rounded-2xl text-sm text-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-indigo-300" />
            <span className="font-semibold">더 궁금한 점</span>
          </div>
          <p className="text-slate-300">
            문의는 한국인공지능개발자 협동조합{' '}
            <a href="mailto:tonymustbegreat@gmail.com" className="text-indigo-300 hover:underline">
              tonymustbegreat@gmail.com
            </a>
            {' '}으로 주세요.
          </p>
        </div>
      </div>
    </main>
  );
}
