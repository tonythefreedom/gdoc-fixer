/**
 * 액션별 코인 비용 — 프론트 UI 와 서버 차감이 **같은 표**를 본다.
 *
 * 웹에서 쓰든 API 로 호출하든 같은 기능이면 같은 값이 빠져야 하고, 프로필의
 * "액션별 코인 비용 / 사용량" 표와 실제 차감이 어긋나서도 안 된다. 그래서 한 곳에 둔다.
 */

// 액션별 코인 비용 — 100 coin = $1. Gemini 2.5 Pro/Flash-Image API 실비
// 대비 약 2~3배 마진 (실비 변동/이미지 첨부 가변성 흡수).
export const ACTION_COSTS = Object.freeze({
  // LLM 없음 — UX 명목 비용
  createDoc: 1,             // HTML 문서 신규 생성
  shareDoc: 2,              // HTML 공유 링크 발급
  sharePresentation: 1,     // 프리젠테이션 공유 링크 발급
  exportDoc: 2,             // 내보내기 (PDF/PPTX/DOCX/HTML)

  // LLM 사용 — 실비 기반
  modifyDoc: 80,            // HTML 문서 AI 업데이트
  generateSlides: 350,      // HTML → 슬라이드 deck 변환
  modifySlide: 30,          // 슬라이드 1 장 AI 수정
  modifyAllSlides: 200,     // 슬라이드 deck 일괄 수정 (블릿 정렬 포함)
  insertSlide: 30,          // 슬라이드 앞/뒤 삽입
  fixSlideViewport: 15,     // 슬라이드 viewport 자동 수정
  modifyHwpText: 80,        // HWP 본문 AI 수정
  publishTechBlog: 600,     // tech-blog 자동 번역 게시
  researchAndPlan: 300,     // AI 기획안 생성

  // ── 외부 AI 에이전트가 API 로 호출할 때 ──
  // inspect 는 0 이다. 구조 조회는 expand-rows 전후로 여러 번 부르게 되어 있어
  // 과금하면 올바른 사용 흐름이 벌을 받는 꼴이 된다.
  hwpxInspect: 0,           // 양식 구조 조회 (LLM 없음)
  hwpxExpandRows: 1,        // 표 행 복제 (LLM 없음)
  hwpxApply: 3,             // 양식 채우기 — 파일 생성 (LLM 없음)
  hwpxFill: 80,             // 양식 자동 채우기 (LLM 1 회)
  apiPublishPage: 2,        // API 로 HTML 문서 게시
  apiPublishPresentation: 1,// API 로 슬라이드 게시
});

export const ACTION_LABELS = Object.freeze({
  createDoc: 'HTML 문서 생성',
  modifyDoc: 'HTML AI 수정',
  shareDoc: 'HTML 공유 링크',
  generateSlides: '슬라이드 deck 생성',
  sharePresentation: '슬라이드 공유 링크',
  exportDoc: '내보내기 (PDF/PPTX/DOCX/HTML)',
  modifySlide: '슬라이드 1 장 수정',
  modifyAllSlides: '슬라이드 deck 일괄 수정',
  insertSlide: '슬라이드 앞/뒤 삽입',
  fixSlideViewport: '슬라이드 viewport 자동 수정',
  modifyHwpText: 'HWP 본문 AI 수정',
  publishTechBlog: 'tech-blog 자동 번역 게시',
  researchAndPlan: 'AI 기획안 생성',
  hwpxInspect: 'API · 한글 양식 구조 조회',
  hwpxExpandRows: 'API · 표 행 복제',
  hwpxApply: 'API · 한글 양식 채우기',
  hwpxFill: 'API · 한글 양식 자동 작성',
  apiPublishPage: 'API · 문서 게시',
  apiPublishPresentation: 'API · 슬라이드 게시',
});

export const INITIAL_COIN_GRANT = 2000;
