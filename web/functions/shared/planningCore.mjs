/**
 * 기획안 작성 파이프라인의 Node(Cloud Functions) 실행 코어.
 *
 * 프론트엔드 web/src/utils/geminiApi.js 의 기획 흐름
 *   planUserContentForFormatting | researchAndPlan
 *     → generateImages → processGeneratedImages
 *     → composeCustomDocument | composeDocument
 * 을 서버에서 동일한 순서·동일한 모델·동일한 생성 파라미터로 재현한다.
 *
 * 프롬프트는 ./planningPrompts.mjs 를 프론트와 **공유**한다(사본 없음).
 * 그래서 어느 경로로 만들어도 같은 디자인 규칙의 HTML 이 나온다.
 *
 * 프론트와 유일하게 다른 점은 전송 방식이다: 서버는 generateContent 대신
 * streamGenerateContent(SSE)를 쓴다. Cloud Run 의 outbound idle timeout(300s)
 * 때문에 대형 HTML 을 한 번에 기다리면 응답 도착 전에 연결이 끊긴다.
 * 프롬프트와 generationConfig 가 같으므로 결과물은 동일하다.
 */
import {
  withCurrentDate,
  TEMPLATE_PROMPTS,
  PLANNING_RESEARCH_PROMPT,
  PLANNING_CUSTOM_EXTRACT_PROMPT,
  PLANNING_COMPOSE_PROMPT,
  PLANNING_COMPOSE_CUSTOM_PROMPT,
} from './planningPrompts.mjs';
import { patchYoutubeThumbnails } from './youtubeThumbnail.mjs';

const PRO_MODEL = 'gemini-2.5-pro';
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─────────────────────────── 응답 파싱 유틸 (프론트와 동일 로직) ───────────────────────────

export function stripCodeFences(text) {
  return String(text ?? '')
    .trim()
    .replace(/^```(?:html|json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

/**
 * LLM 응답의 단일 백슬래시(LaTeX \frac, \mu …)로 깨진 JSON 을 단계적으로 보정하며 파싱.
 * 프론트 geminiApi.js 의 safeParseLlmJson 과 동일한 4단계 전략.
 */
export function safeParseLlmJson(text) {
  const tryParse = (s) => {
    try {
      return [true, JSON.parse(s)];
    } catch (e) {
      return [false, e];
    }
  };

  let [ok, result] = tryParse(text);
  if (ok) return result;

  const first = Math.min(
    ...['{', '['].map((c) => {
      const i = text.indexOf(c);
      return i === -1 ? Infinity : i;
    })
  );
  const last = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (Number.isFinite(first) && last > first) {
    const trimmed = text.slice(first, last + 1);
    [ok, result] = tryParse(trimmed);
    if (ok) return result;
    const fixed = trimmed.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
    [ok, result] = tryParse(fixed);
    if (ok) return result;
  }

  const fixedOnly = text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
  [ok, result] = tryParse(fixedOnly);
  if (ok) return result;

  throw result instanceof Error ? result : new Error('JSON parse failed');
}

// ─────────────────────────── Gemini 호출 (SSE 스트리밍) ───────────────────────────

/**
 * streamGenerateContent(alt=sse)로 호출하고 텍스트 파트를 이어붙여 반환한다.
 * thought 파트(사고 과정)는 본문에서 제외한다.
 */
async function callGeminiStream({ model, parts, generationConfig, tools, apiKey, timeoutMs }) {
  const url = `${API_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig,
    ...(tools && { tools }),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? 15 * 60 * 1000);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini ${model} HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
    if (!res.body) throw new Error(`Gemini ${model} returned no response body`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let finishReason = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Google SSE 는 이벤트 구분자로 \r\n\r\n 을 쓰기도 한다.
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      for (const evt of events) {
        const line = evt
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.replace(/^data:\s*/, ''))
          .join('')
          .trim();
        if (!line || line === '[DONE]') continue;
        try {
          const data = JSON.parse(line);
          for (const p of data?.candidates?.[0]?.content?.parts || []) {
            if (typeof p?.text === 'string' && !p?.thought) fullText += p.text;
          }
          const fr = data?.candidates?.[0]?.finishReason;
          if (fr) finishReason = fr;
        } catch {
          // 잘린 chunk — 다음 루프에서 이어붙는다
        }
      }
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (finishReason === 'MAX_TOKENS') {
      throw new Error(
        `LLM 응답이 출력 토큰 한도(MAX_TOKENS)에 잘렸습니다. 원문을 줄여 다시 시도하세요. (${elapsed}s, ${fullText.length}chars)`
      );
    }
    if (!fullText) {
      throw new Error(`Gemini ${model} 응답에 텍스트가 없습니다 (finishReason=${finishReason}).`);
    }
    console.log(`[planningCore] ${model} OK ${elapsed}s, ${fullText.length}chars, finish=${finishReason}`);
    return fullText;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 프론트 callProModel 과 같은 역할. 기본 generationConfig 도 프론트와 일치시킨다.
 * 일시적 네트워크 오류는 1s/2s backoff 로 최대 3회 시도.
 */
async function callProModel(systemPrompt, userText, options = {}, apiKey) {
  const {
    maxOutputTokens = 32768,
    temperature = 0.7,
    thinkingBudget,
    responseMimeType,
    timeoutMs,
  } = options;

  const generationConfig = { temperature, maxOutputTokens };
  if (typeof thinkingBudget === 'number') generationConfig.thinkingConfig = { thinkingBudget };
  if (responseMimeType) generationConfig.responseMimeType = responseMimeType;

  const parts = [{ text: withCurrentDate(systemPrompt) }, { text: userText }];

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const text = await callGeminiStream({
        model: PRO_MODEL,
        parts,
        generationConfig,
        apiKey,
        timeoutMs,
      });
      return stripCodeFences(text);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const transient =
        err?.name === 'AbortError' ||
        /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|aborted|HTTP 5\d\d/i.test(msg);
      if (attempt < 3 && transient) {
        console.warn(`[planningCore] transient 실패 (${msg}), ${attempt}/2 재시도`);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─────────────────────────── Step 1. 기획안 생성 ───────────────────────────

/**
 * custom 모드 — 사용자 원문을 한 글자도 바꾸지 않고 섹션으로만 정리한다.
 * 프론트 planUserContentForFormatting 과 동일한 프롬프트/파라미터.
 */
export async function planUserContentForFormatting(brief, apiKey) {
  const text = await callProModel(
    PLANNING_CUSTOM_EXTRACT_PROMPT,
    `User original text:\n\n${brief}`,
    {
      maxOutputTokens: 65536,
      temperature: 0.2,
      thinkingBudget: 128,
      responseMimeType: 'application/json',
    },
    apiKey
  );

  const plan = safeParseLlmJson(text);
  if (!plan.title || !Array.isArray(plan.sections) || !Array.isArray(plan.imageDescriptions)) {
    throw new Error('기획안 구조가 올바르지 않습니다.');
  }
  return plan;
}

/**
 * research 모드 — Google 검색으로 주제를 조사해 구조를 설계한다.
 * 프론트 researchAndPlan 과 동일하게 google_search tool 을 켠다.
 */
export async function researchAndPlan(brief, templateType = 'custom', apiKey) {
  const systemPrompt = TEMPLATE_PROMPTS[templateType] || PLANNING_RESEARCH_PROMPT;

  const text = await callGeminiStream({
    model: PRO_MODEL,
    parts: [{ text: withCurrentDate(systemPrompt) }, { text: `Planning brief:\n\n${brief}` }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 32768 },
    tools: [{ google_search: {} }],
    apiKey,
  });

  const plan = safeParseLlmJson(stripCodeFences(text));
  if (!plan.title || !plan.sections || !plan.imageDescriptions) {
    throw new Error('기획안 구조가 올바르지 않습니다.');
  }
  return plan;
}

// ─────────────────────────── Step 2. 이미지 생성 ───────────────────────────

async function generateImage(prompt, apiKey) {
  const res = await fetch(`${API_BASE}/${IMAGE_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Generate a high-quality professional image for a presentation slide.\n\n${prompt}`,
            },
          ],
        },
      ],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `이미지 생성 API 오류: ${res.status}`);
  }

  const data = await res.json();
  for (const part of data.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error('이미지가 생성되지 않았습니다.');
}

/** 프론트 generateImages 와 동일 — 병렬 생성 후 성공분만 반환. */
export async function generateImages(imageDescriptions, apiKey) {
  if (!Array.isArray(imageDescriptions) || imageDescriptions.length === 0) return [];
  const results = await Promise.allSettled(
    imageDescriptions.map(async (desc) => ({
      label: desc.label,
      dataUri: await generateImage(desc.prompt, apiKey),
    }))
  );
  const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.length - ok.length;
  if (failed) console.warn(`[planningCore] 이미지 ${failed}/${results.length}장 생성 실패 — 나머지로 진행`);
  return ok;
}

/**
 * 프론트 processGeneratedImages 와 동일 — 현재는 pass-through.
 * (flood-fill 배경 제거는 모서리 잔상 문제로 프론트에서도 비활성 상태)
 */
export async function processGeneratedImages(images) {
  return images;
}

// ─────────────────────────── Step 3. HTML 조립 ───────────────────────────

function buildImageInfo(processedImages, emptyLabel) {
  return processedImages.length > 0
    ? processedImages.map((img, i) => `- {{IMAGE_${i + 1}}}: ${img.label}`).join('\n')
    : emptyLabel;
}

function replacePlaceholders(html, processedImages) {
  let out = html;
  processedImages.forEach((img, i) => {
    out = out.replaceAll(`{{IMAGE_${i + 1}}}`, img.dataUri);
  });
  return out;
}

/** research 모드 조립 — 프론트 composeDocument 와 동일. */
export async function composeDocument(plan, processedImages, apiKey) {
  const userText = `Proposal structure:\n\n${JSON.stringify(plan, null, 2)}\n\nAvailable image placeholders:\n${buildImageInfo(processedImages, '')}\n\nBased on the structure above, compose a professional HTML proposal document.`;

  const html = replacePlaceholders(
    await callProModel(PLANNING_COMPOSE_PROMPT, userText, {}, apiKey),
    processedImages
  );
  if (!html.includes('<')) throw new Error('유효한 HTML이 생성되지 않았습니다.');
  return patchYoutubeThumbnails(html);
}

/** custom 모드 조립 — 프론트 composeCustomDocument 와 동일(원문 보존, 디자인만). */
export async function composeCustomDocument(plan, processedImages, apiKey) {
  const userText = `Original plan data (sections[*].content IS the user's original text):\n\n${JSON.stringify(plan, null, 2)}\n\nAvailable image placeholders:\n${buildImageInfo(processedImages, '(no images)')}\n\nPlace title, sections[*].heading, and sections[*].content into the HTML without changing a single character of their text. You are only responsible for design and image placement.`;

  const html = replacePlaceholders(
    await callProModel(
      PLANNING_COMPOSE_CUSTOM_PROMPT,
      userText,
      { maxOutputTokens: 65536, temperature: 0.2, thinkingBudget: 128 },
      apiKey
    ),
    processedImages
  );
  if (!html.includes('<')) throw new Error('유효한 HTML이 생성되지 않았습니다.');
  return patchYoutubeThumbnails(html);
}

// ─────────────────────────── 전체 파이프라인 ───────────────────────────

/**
 * MD(또는 평문) 원고 → 기획안 → 이미지 → 디자인된 HTML.
 * 프론트 PlanningEditor.handleGenerate 의 서버 버전.
 *
 * @param {object}   opts
 * @param {string}   opts.brief            원고 본문(마크다운 허용)
 * @param {'custom'|'research'} opts.mode  기본 custom (원문 보존)
 * @param {string}   opts.template         research 모드의 템플릿 키
 * @param {boolean}  opts.withImages       이미지 자동 생성 여부
 * @param {string}   opts.apiKey           Gemini API key
 * @param {(step:string, detail?:object)=>void} [opts.onStep] 진행 상황 콜백
 */
export async function runPlanningPipeline({
  brief,
  mode = 'custom',
  template = 'custom',
  withImages = true,
  apiKey,
  onStep = () => {},
}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY 가 없습니다.');
  const isCustom = mode !== 'research';

  onStep('planning');
  const plan = isCustom
    ? await planUserContentForFormatting(brief, apiKey)
    : await researchAndPlan(brief, template, apiKey);

  let processedImages = [];
  if (withImages) {
    onStep('generating-images', { count: plan.imageDescriptions?.length || 0 });
    const generated = await generateImages(plan.imageDescriptions, apiKey);
    processedImages = await processGeneratedImages(generated);
  }

  onStep('composing');
  const html = isCustom
    ? await composeCustomDocument(plan, processedImages, apiKey)
    : await composeDocument(plan, processedImages, apiKey);

  return { plan, html, imageCount: processedImages.length };
}
