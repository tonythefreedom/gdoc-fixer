/**
 * 양식 HWPX + 내용 MD → 채워진 HWPX.
 *
 * 동작 원리:
 *   양식의 단락을 그대로 두고 **텍스트만 제자리 교체**한다(applyParagraphsToHwpx).
 *   서식·표 구조·페이지 설정은 양식 것이 100% 유지되고, 우리가 정하는 것은
 *   각 단락에 들어갈 문자열뿐이다.
 *
 * 그래서 지켜야 하는 계약이 둘 있다:
 *   1) 단락 개수를 양식과 **정확히** 같게 맞춘다. 어긋나면 apply 가 거부한다.
 *   2) 원본이 빈 문자열인 단락은 빈 채로 둔다. 표를 감싸는 컨테이너 단락이나
 *      빈 줄이 여기 해당하며, 여기에 글자를 넣으면 레이아웃이 깨진다.
 *
 * LLM 이 개수를 못 맞추는 경우를 대비해 호출 측에서 보정한다(fitToLength).
 */
import { extractParagraphsFromHwpx, applyParagraphsToHwpx } from './hwpxText.mjs';

// 표 밖 단락에 쓰이는 페이지 폭(HWPUNIT). 이보다 작으면 표 안 셀이다.
const PAGE_WIDTH = 48000;

const FILL_SYSTEM_PROMPT = `You fill in a Korean HWP (한글) form. You are NOT a writer — you place the user's content into the form's existing slots.

You receive:
  1. The form's paragraphs, in order, as a numbered list. Each line is tagged:
     [GUIDE]  — an instruction written by the form's author (italic, coloured).
                Replace it with the actual content it is asking for.
     [EMPTY]  — the paragraph has no text. It is structural (a table container,
                a blank line). It MUST stay empty.
     [CELL:n] — the paragraph sits inside a table cell that is n HWPUNIT wide.
                Narrow cells are labels; wide cells are values.
     [TEXT]   — ordinary paragraph with existing text.
  2. The user's source document in Markdown.

Rules — these are absolute:
- Output EXACTLY as many strings as there are input paragraphs, in the same order.
- [EMPTY] paragraphs MUST be returned as "" (empty string). Never put text in them.
- [GUIDE] paragraphs: write the content the guide asks for, drawn from the Markdown.
  Do not repeat the guide text itself. If the Markdown has nothing for it, return "".
- Decide for each [TEXT] paragraph whether it is a PLACEHOLDER or a FIXED LABEL:
    PLACEHOLDER (replace with real content) — it reads as a blank waiting to be filled:
      "제목을 여기에", "본문 자리", "○○○", "(내용을 입력하세요)", "해당 없음",
      rows of dots/underscores, or lorem-style filler.
    FIXED LABEL (keep EXACTLY as-is) — it names a field or section rather than holding
      content: table header cells ("항목", "구분", "금액"), field names ("작성일자:", "부서"),
      numbered section headings ("1. 사업 개요"), and the form author's own captions.
  When a label and its value sit in adjacent table cells, keep the label and fill the value.
- Table cells: keep the label cell, fill the value cell from the Markdown.
- Plain text only. No Markdown syntax (**, ##, -, |), no HTML tags. This is a HWP
  paragraph — bold/heading styling comes from the form, not from characters you type.
- Preserve the user's facts, numbers and wording. Do not invent data that is not in the
  Markdown. Do not summarise away specifics.
- Korean output (한국어), matching the form's tone.
- A paragraph's text may be long; the form will wrap it. But do not merge what the form
  separates into different paragraphs.

Return JSON: an array of strings, nothing else.`;

/** 단락 하나를 LLM 에게 보여줄 한 줄로 만든다. */
function describeParagraph(text, index, isGuide, width) {
  const tags = [];
  if (!text) tags.push('EMPTY');
  else if (isGuide) tags.push('GUIDE');
  else tags.push('TEXT');
  if (width != null && width < PAGE_WIDTH) tags.push(`CELL:${width}`);
  return `${index}. [${tags.join('][')}] ${text || ''}`;
}

/**
 * LLM 응답을 양식의 단락 수에 억지로 맞춘다.
 * 모자라면 원본을 그대로 두고, 넘치면 버린다 — 개수가 어긋나면 apply 가 실패하므로
 * 게시 자체를 못 하게 두는 것보다 원본 유지가 낫다.
 */
function fitToLength(filled, original) {
  const out = original.map((orig, i) => {
    const v = filled[i];
    if (typeof v !== 'string') return orig; // 누락 → 원본 유지
    // 구조용 빈 단락에 글자가 들어오면 되돌린다 (레이아웃 보호)
    if (orig === '' && v !== '') return '';
    return v;
  });
  return out;
}

/**
 * @param {Uint8Array|Buffer} templateBytes 양식 .hwpx
 * @param {string} markdown 채워 넣을 내용
 * @param {(systemPrompt: string, userText: string, options: object) => Promise<string>} callModel
 *        Gemini 호출부 주입 (서버는 planningCore 의 스트리밍 호출을 넘긴다)
 * @param {(step: string, detail?: object) => void} [onStep]
 */
export async function fillHwpxTemplate({ templateBytes, markdown, callModel, onStep = () => {} }) {
  onStep('reading-template');
  const paragraphs = await extractParagraphsFromHwpx(templateBytes);
  if (paragraphs.length === 0) {
    throw new Error('양식에서 단락을 찾지 못했습니다. HWPX 파일이 맞는지 확인해주세요.');
  }

  const { isGuide = [], widths = [] } = paragraphs;
  const listing = paragraphs
    .map((t, i) => describeParagraph(t, i, isGuide[i], widths[i]))
    .join('\n');

  const guideCount = isGuide.filter(Boolean).length;
  const emptyCount = paragraphs.filter((t) => !t).length;
  onStep('filling', { paragraphs: paragraphs.length, guides: guideCount, empty: emptyCount });

  const userText = `Form paragraphs (${paragraphs.length} total — return exactly ${paragraphs.length} strings):

${listing}

--- User's source document (Markdown) ---

${markdown}`;

  const raw = await callModel(FILL_SYSTEM_PROMPT, userText, {
    maxOutputTokens: 65536,
    temperature: 0.2,
    thinkingBudget: 128,
    responseMimeType: 'application/json',
    responseSchema: { type: 'array', items: { type: 'string' } },
  });

  let filled;
  try {
    filled = JSON.parse(raw);
  } catch (err) {
    throw new Error(`양식 채우기 응답을 해석하지 못했습니다: ${err.message}`);
  }
  if (!Array.isArray(filled)) {
    throw new Error('양식 채우기 응답이 배열이 아닙니다.');
  }

  const adjusted = fitToLength(filled, Array.from(paragraphs));
  const mismatch = filled.length !== paragraphs.length;
  if (mismatch) {
    console.warn(
      `[hwpxFill] 단락 수 불일치 — LLM ${filled.length}개, 양식 ${paragraphs.length}개. 원본 유지로 보정.`
    );
  }

  onStep('writing-hwpx');
  const bytes = await applyParagraphsToHwpx(templateBytes, adjusted);

  return {
    bytes,
    stats: {
      paragraphs: paragraphs.length,
      guides: guideCount,
      empty: emptyCount,
      changed: adjusted.filter((v, i) => v !== paragraphs[i]).length,
      mismatchCorrected: mismatch,
    },
  };
}
