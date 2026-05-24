const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const TECH_BLOG_SERVICE_ACCOUNT = defineSecret('TECH_BLOG_SERVICE_ACCOUNT');
const GITHUB_DISPATCH_TOKEN = defineSecret('GITHUB_DISPATCH_TOKEN');
// 클라이언트 GCS 업로드와 같은 service account credentials.
// .env 의 VITE_GCS_* 와 동일 값을 functions:secrets:set 로 등록.
const GCS_BUCKET = defineSecret('GCS_BUCKET');
const GCS_SA_EMAIL = defineSecret('GCS_SA_EMAIL');
const GCS_PRIVATE_KEY = defineSecret('GCS_PRIVATE_KEY');

const SUPER_ADMIN_EMAIL = 'tony@banya.ai';
const TECH_BLOG_COLLECTION = 'static-wiki';
const TECH_BLOG_ROUTE = 'report';
const TECH_BLOG_SITE = 'https://tony.banya.ai';
const TECH_BLOG_GITHUB_REPO = 'kr-ai-dev-association/tech-blog';
const SEO_DISPATCH_EVENT = 'deploy-seo';
const MAX_INPUT_BYTES = 1500 * 1024;
const MAX_DOC_BYTES = 1000 * 1024;
// 큰 본문은 Firestore 대신 GCS 에 저장 (Firestore 한 doc 한도 1MiB 회피).
// gdoc-fixer 프로젝트 default bucket 사용 (service account 자동 권한).
const CONTENT_GCS_PREFIX = 'wiki-content';
// 한 lang 이라도 이 한도를 넘으면 GCS 로 분리. 그 외에는 inline.
const INLINE_CONTENT_THRESHOLD = 400 * 1024;
const GEMINI_PRO = 'gemini-2.5-pro';
const GEMINI_FLASH = 'gemini-2.5-flash';

let techBlogApp;

function getTechBlogDb() {
  if (!techBlogApp) {
    const raw = TECH_BLOG_SERVICE_ACCOUNT.value();
    if (!raw) throw new Error('TECH_BLOG_SERVICE_ACCOUNT secret is empty');
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch (err) {
      throw new Error(`TECH_BLOG_SERVICE_ACCOUNT is not valid JSON: ${err.message}`);
    }
    techBlogApp = admin.initializeApp(
      { credential: admin.credential.cert(serviceAccount) },
      'techBlogApp'
    );
  }
  return admin.firestore(techBlogApp);
}

// Gemini streamGenerateContent 를 사용한다. Cloud Run 의 outbound idle
// timeout (300s) 을 피하려면 응답이 chunk 로 흘러와야 한다.
// streamGenerateContent + alt=sse 응답은 "data: {json}\n\n" 형식의 SSE.
async function callGemini(model, prompt, apiKey, opts = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 32768,
      ...(opts.thinkingBudget !== undefined && {
        thinkingConfig: { thinkingBudget: opts.thinkingBudget },
      }),
      ...(opts.responseMimeType && { responseMimeType: opts.responseMimeType }),
      ...(opts.responseSchema && { responseSchema: opts.responseSchema }),
    },
  };
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
    if (!res.body) {
      throw new Error(`Gemini ${model} returned no response body`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let lastFinishReason = null;
    let chunkCount = 0;
    let rawSample = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;
      chunkCount++;
      if (rawSample.length < 2000) rawSample += decoded;
      // SSE 이벤트 구분자는 LF/CRLF 모두 허용해야 한다 (Google SSE 는 \r\n\r\n).
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      for (const evt of events) {
        // 한 이벤트 안에 여러 라인이 있을 수 있으니 data: 로 시작하는 라인들만 모음.
        const dataLines = evt
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.replace(/^data:\s*/, ''));
        const line = dataLines.join('').trim();
        if (!line || line === '[DONE]') continue;
        try {
          const data = JSON.parse(line);
          const parts = data?.candidates?.[0]?.content?.parts || [];
          for (const p of parts) {
            if (typeof p?.text === 'string' && !p?.thought) {
              fullText += p.text;
            }
          }
          const fr = data?.candidates?.[0]?.finishReason;
          if (fr) lastFinishReason = fr;
        } catch (_) {
          // incomplete chunk
        }
      }
    }
    if (!fullText) {
      console.error(
        `[callGemini] ${model} no text. chunks=${chunkCount}, finishReason=${lastFinishReason}, raw(0..2000):\n${rawSample}`
      );
      throw new Error(
        `Gemini ${model} returned no text (chunks=${chunkCount}, finishReason=${lastFinishReason})`
      );
    }
    console.log(
      `[callGemini] ${model} OK in ${((Date.now() - startedAt) / 1000).toFixed(1)}s, ${fullText.length}chars, chunks=${chunkCount}, finishReason=${lastFinishReason}`
    );
    return fullText;
  } catch (err) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.warn(`[callGemini] ${model} 실패 (${elapsed}s, ${err?.message})`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function stripCodeFence(text) {
  return text
    .trim()
    .replace(/^```(?:html|json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

function ensureArticleWrap(html) {
  const trimmed = html.trim();
  if (/^<article\b/i.test(trimmed)) return trimmed;
  return `<article>${trimmed}</article>`;
}

function extractFirstImageUrl(html) {
  const match = html.match(/<img\s+[^>]*src=["']([^"']+)["']/i);
  return match ? match[1] : '';
}

// gdoc-fixer 가 만드는 자기완결 HTML(<!DOCTYPE>+Tailwind CDN+inline style 가득)
// 을 tech-blog 의 정상 패턴(article.wiki-content > h1 + wiki-html-content prose)
// 으로 변환한다. Gemini 호출이 maxOutputTokens 한계에 막혀 본문이 잘리는 문제를
// 회피하기 위해 결정적(정규식) 변환으로 처리.
function normalizeHtmlDeterministic(rawHtml) {
  let body = rawHtml;
  const bodyMatch = rawHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];

  // 1) 문서 수준 / 무관한 태그 제거 (script, style, link, meta, title)
  body = body
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<link\b[^>]*\/?>/gi, '')
    .replace(/<meta\b[^>]*\/?>/gi, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '');

  // 2) 모든 class 와 inline style 제거 — prose 가 typography 책임짐.
  //    이미지의 src, a 의 href, img 의 alt 등 의미 있는 속성은 유지.
  body = body
    .replace(/\s+class="[^"]*"/gi, '')
    .replace(/\s+class='[^']*'/gi, '')
    .replace(/\s+style="[^"]*"/gi, '')
    .replace(/\s+style='[^']*'/gi, '');

  // 3) 첫 <h1> 을 헤더 영역으로 분리
  let titleText = '';
  const h1Match = body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    titleText = h1Match[1].trim();
    body = body.replace(h1Match[0], '');
  }

  // 4) <header> 안에 있던 부제/날짜 등은 그대로 본문 앞에 남기되, 검은 배경
  //    hero 블록 자체는 의미 없는 wrapper 라 풀어버린다. (header → 그대로 div)
  body = body.replace(/<header\b[^>]*>([\s\S]*?)<\/header>/gi, '$1');
  // footer 도 동일
  body = body.replace(/<footer\b[^>]*>([\s\S]*?)<\/footer>/gi, '$1');

  // 5) 연속 공백 정리 (가독성)
  body = body.replace(/(\s*\n){3,}/g, '\n\n').trim();

  const titleHtml = titleText || name || '제목 없음';
  return `<article class="wiki-content"><div class="flex justify-between items-start border-b border-[#a2a9b1] pb-2 mb-6"><h1 class="text-3xl font-sans font-bold text-[#000] leading-tight">${titleHtml}</h1></div><div class="wiki-html-content prose prose-slate max-w-none text-[#202122] leading-relaxed">${body}</div></article>`;
}

// Gemini 가 번역 중 src 를 가끔 hallucinate 한다 (data:image/jpeg;base64,...
// 같은 거대한 가짜 URI 로 바꿔버림). 한국어 원본의 <img src> 순서를 그대로
// 영문 HTML 에 강제 복원해 src 누출/오염을 방지한다.
function preserveImageSrcsAndHrefs(koHtml, enHtml) {
  const imgRe = /<img\b([^>]*?)\bsrc\s*=\s*(["'])([^"']*)\2/gi;
  const koSrcs = [...koHtml.matchAll(imgRe)].map((m) => m[3]);
  let i = 0;
  return enHtml.replace(imgRe, (match, before, q, _src) => {
    const original = koSrcs[i++];
    if (!original) return match;
    return `<img${before}src=${q}${original}${q}`;
  });
}

// 정규화된 한국어 HTML 을 본문 블록 단위로 잘라 각각 번역 후 합친다.
// 큰 본문이 한 번의 Gemini 호출에서 토큰 한도/타임아웃에 걸리는 문제 회피.
async function translateInChunks(normalizedKoHtml, apiKey, opts = {}) {
  const maxCharsPerChunk = opts.maxCharsPerChunk ?? 18000;

  // article 안에서 header 영역과 본문 영역 분리
  const m = normalizedKoHtml.match(
    /^([\s\S]*?<div class="wiki-html-content[^"]*">)([\s\S]*?)(<\/div>\s*<\/article>\s*)$/
  );
  if (!m) {
    // 구조가 예상과 다르면 통째로 번역
    return await translateFragment(normalizedKoHtml, apiKey, 0, 1);
  }
  const [, header, body, footer] = m;

  // 헤더(제목)는 별도로 한 번 번역
  const translatedHeader = await translateFragment(header, apiKey, 0, 1);

  // 본문이 작으면 한 번에
  if (body.length <= maxCharsPerChunk) {
    const translatedBody = await translateFragment(body, apiKey, 0, 1);
    const enHeader = preserveImageSrcsAndHrefs(header, translatedHeader);
    const enBody = preserveImageSrcsAndHrefs(body, translatedBody);
    return enHeader + enBody + footer;
  }

  // 본문을 top-level 블록 단위로 분할
  const blockRegex = /(?=<(?:section|article|div|h[1-6]|table|ul|ol|blockquote|pre|figure|hr)\b)/i;
  const blocks = body.split(blockRegex);
  const chunks = [];
  let current = '';
  for (const b of blocks) {
    if (current.length + b.length > maxCharsPerChunk && current) {
      chunks.push(current);
      current = b;
    } else {
      current += b;
    }
  }
  if (current) chunks.push(current);

  console.log(
    `[translateInChunks] body ${body.length} chars → ${chunks.length} chunks (max ${maxCharsPerChunk} per chunk)`
  );

  // 동일 분할로 ko chunks 보유 (en chunk 와 1:1 매칭, src 복원에 사용)
  const koChunks = chunks;
  // 병렬 처리 — 큰 본문은 순차로는 함수 20분 timeout 초과. Gemini Flash 의
  // 동시 호출 한도(분당 1000+ RPM) 안에 들어가므로 전체 chunk 를 동시에 발사.
  const t0 = Date.now();
  const translatedChunks = await Promise.all(
    koChunks.map((chunk, i) => translateFragment(chunk, apiKey, i, koChunks.length))
  );
  console.log(
    `[translateInChunks] ${koChunks.length} chunks translated in parallel in ${((Date.now() - t0) / 1000).toFixed(1)}s`
  );

  // chunk 단위로 src 복원
  const srcRestored = translatedChunks.map((t, i) =>
    preserveImageSrcsAndHrefs(koChunks[i], t)
  );

  const enHeader = preserveImageSrcsAndHrefs(header, translatedHeader);
  return enHeader + srcRestored.join('') + footer;
}

async function translateFragment(htmlFragment, apiKey, idx, total) {
  // <img>, <picture>, <source>, <iframe> 같이 src 가 큰 base64 가 될 수 있는
  // 태그를 placeholder 로 치환 → Gemini 가 절대 변경 못 하게 한다.
  // 번역 후 원본 그대로 복원.
  const placeholders = [];
  const maskTag = (match) => {
    const id = placeholders.length;
    placeholders.push(match);
    return `__PLACEHOLDER_${id}__`;
  };
  const maskedFragment = htmlFragment
    .replace(/<img\b[^>]*\/?>(?:<\/img>)?/gi, maskTag)
    .replace(/<picture\b[\s\S]*?<\/picture>/gi, maskTag)
    .replace(/<source\b[^>]*\/?>(?:<\/source>)?/gi, maskTag)
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, maskTag);

  const prompt = `You are a precise HTML translator. Translate the following Korean HTML fragment to natural, fluent English.

Strict rules:
- Preserve every HTML tag, attribute, class name, inline style, href, and id EXACTLY.
- Tokens like __PLACEHOLDER_NN__ are sentinel markers — keep them in the output VERBATIM, in the SAME positions, do NOT translate, modify, expand, or remove them.
- Translate ONLY user-visible Korean text (text nodes, and meaningful attribute values like alt/title).
- Keep brand names, code blocks, programming identifiers, URLs, and numeric data as-is.
- Maintain heading hierarchy, list structure, table layout, and overall semantics.
- This is fragment ${idx + 1} of ${total}. Do NOT add or remove outer wrapper tags. Output the fragment in the same structure, just with Korean text replaced by English.
- Do not add commentary, preamble, or markdown code fences. Output the translated HTML fragment only.

Korean HTML fragment:
${maskedFragment}

Translated English HTML fragment:`;

  // chunk 단위 번역은 transient 실패가 잦으니 자동 1회 재시도.
  let raw;
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      raw = await callGemini(GEMINI_FLASH, prompt, apiKey, {
        maxOutputTokens: 65536,
        temperature: 0.2,
        timeoutMs: 5 * 60 * 1000,
        thinkingBudget: 0,
      });
      // placeholder 복원 (이미지/iframe/source/picture 등 원본 태그 그대로)
      raw = stripCodeFence(raw).replace(/__PLACEHOLDER_(\d+)__/g, (m, id) => {
        const i = parseInt(id, 10);
        return placeholders[i] !== undefined ? placeholders[i] : m;
      });
      return raw;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const transient = err?.name === 'AbortError' ||
        /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|aborted/i.test(msg);
      if (attempt < 2 && transient) {
        console.warn(`[translateFragment] chunk ${idx + 1}/${total} attempt ${attempt} 실패 (${msg}), 재시도`);
        continue;
      }
      throw err;
    }
  }
  return stripCodeFence(raw);
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'untitled'
  );
}

function shortId() {
  return Math.random().toString(36).slice(2, 8);
}

function approxByteSize(obj) {
  return Buffer.byteLength(JSON.stringify(obj), 'utf-8');
}

async function isAuthorizedAdmin(authCtx) {
  if (!authCtx) return false;
  if (authCtx.token?.email === SUPER_ADMIN_EMAIL) return true;
  try {
    const snap = await admin
      .firestore()
      .collection('userProfiles')
      .doc(authCtx.uid)
      .get();
    const profile = snap.data();
    return !!profile && profile.role === 'super_admin' && profile.status === 'approved';
  } catch (err) {
    console.error('userProfiles lookup failed:', err);
    return false;
  }
}

let _gcsClient;
function getGcsBucket() {
  if (!_gcsClient) {
    _gcsClient = new Storage({
      credentials: {
        client_email: GCS_SA_EMAIL.value(),
        private_key: GCS_PRIVATE_KEY.value().replace(/\\n/g, '\n'),
      },
    });
  }
  return _gcsClient.bucket(GCS_BUCKET.value());
}

async function uploadContentToGcs(docId, ko, en) {
  const bucket = getGcsBucket();
  const bucketName = bucket.name;
  const path = `${CONTENT_GCS_PREFIX}/${docId}.json`;
  const file = bucket.file(path);
  const payload = JSON.stringify({ ko: ko || '', en: en || '' });
  await file.save(payload, {
    contentType: 'application/json; charset=utf-8',
    metadata: { cacheControl: 'public, max-age=300' },
    resumable: false,
  });
  // banya_public2 는 public read 이미 설정된 bucket. makePublic 시도 후 실패해도
  // public URL 그대로 사용.
  try {
    await file.makePublic();
  } catch (err) {
    console.warn(`[uploadContentToGcs] makePublic 실패: ${err.message} (uniform-access bucket 가능)`);
  }
  return `https://storage.googleapis.com/${bucketName}/${path}`;
}

async function triggerSeoBuild(token, docId) {
  if (!token) return false;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${TECH_BLOG_GITHUB_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'gdoc-fixer-publishToTechBlog',
        },
        body: JSON.stringify({
          event_type: SEO_DISPATCH_EVENT,
          client_payload: { id: docId, source: 'gdoc-fixer-publish' },
        }),
      }
    );
    if (res.status === 204) return true;
    const text = await res.text();
    console.error(`SEO dispatch HTTP ${res.status}: ${text.slice(0, 300)}`);
    return false;
  } catch (err) {
    console.error('SEO dispatch error:', err);
    return false;
  }
}

exports.publishToTechBlog = onCall(
  {
    secrets: [
      GEMINI_API_KEY,
      TECH_BLOG_SERVICE_ACCOUNT,
      GITHUB_DISPATCH_TOKEN,
      GCS_BUCKET,
      GCS_SA_EMAIL,
      GCS_PRIVATE_KEY,
    ],
    timeoutSeconds: 1200,
    memory: '1GiB',
  },
  async (request) => {
    if (!(await isAuthorizedAdmin(request.auth))) {
      throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
    }

    const { html, name } = request.data || {};
    if (!html || typeof html !== 'string') {
      throw new HttpsError('invalid-argument', 'html 문자열이 필요합니다.');
    }
    const inputBytes = Buffer.byteLength(html, 'utf-8');
    if (inputBytes > MAX_INPUT_BYTES) {
      throw new HttpsError(
        'invalid-argument',
        `문서가 너무 큽니다 (현재 ${(inputBytes / 1024).toFixed(0)}KB, 한도 ${MAX_INPUT_BYTES / 1024}KB).`
      );
    }

    const apiKey = GEMINI_API_KEY.value();

    // 0. 결정적 정규화 (Gemini 호출 X)
    // 자기완결 HTML → article.wiki-content + wiki-html-content prose 구조.
    // 큰 본문도 토큰 한도 영향 없이 안전하게 변환.
    const normalizedHtml = normalizeHtmlDeterministic(html);
    if (!/^<article\b/i.test(normalizedHtml.trim())) {
      throw new HttpsError('internal', '정규화 결과가 article 로 시작하지 않습니다.');
    }

    // 1. Translate normalized Ko → En
    // 큰 본문은 한 번의 Gemini 호출에서 65536 토큰 한도/타임아웃에 걸려 잘리거나
    // abort 된다. 본문을 의미 단위(섹션/블록) chunk 로 잘라 각각 번역한 뒤 합친다.
    let englishHtml;
    try {
      englishHtml = await translateInChunks(normalizedHtml, apiKey);
    } catch (err) {
      throw new HttpsError('internal', `번역 실패: ${err.message}`);
    }

    // 2. Extract metadata via Flash
    const metadataPrompt = `You are a metadata extractor. Given a Korean HTML document and its English translation, produce JSON metadata.

Required JSON shape:
{
  "ko_title": "<Korean main title — extract from the first heading or document context>",
  "en_title": "<English main title — extract from the first heading of the English version>",
  "slug": "<lowercase URL-safe slug derived from en_title; words separated by hyphens; ASCII letters/digits/hyphens only; max 60 chars>",
  "excerpt": "<1-2 sentence English summary, max 180 chars>"
}

Korean HTML (truncated):
${normalizedHtml.slice(0, 50000)}

English HTML (truncated):
${englishHtml.slice(0, 50000)}

Output JSON only, no preamble or code fence:`;

    let meta;
    let metaRaw = '';
    try {
      metaRaw = await callGemini(GEMINI_FLASH, metadataPrompt, apiKey, {
        maxOutputTokens: 10000,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            ko_title: { type: 'string' },
            en_title: { type: 'string' },
            slug: { type: 'string' },
            excerpt: { type: 'string' },
          },
          required: ['ko_title', 'en_title', 'slug', 'excerpt'],
        },
      });
      meta = JSON.parse(stripCodeFence(metaRaw));
    } catch (err) {
      console.error('Metadata extraction failed. Raw response:', metaRaw.slice(0, 500));
      throw new HttpsError(
        'internal',
        `메타데이터 생성 실패: ${err.message} (raw: ${metaRaw.slice(0, 200)})`
      );
    }

    const koTitle = String(meta.ko_title || name || '제목 없음').trim();
    const enTitle = String(meta.en_title || 'Untitled').trim();
    const slug =
      typeof meta.slug === 'string' && /^[a-z0-9-]+$/.test(meta.slug)
        ? meta.slug
        : slugify(enTitle);
    const excerpt = String(meta.excerpt || '').slice(0, 200);

    const now = new Date();
    const wrappedKo = ensureArticleWrap(normalizedHtml);
    const wrappedEn = ensureArticleWrap(englishHtml);

    const docId = `${slug}-${shortId()}`;
    const koBytes = Buffer.byteLength(wrappedKo, 'utf-8');
    const enBytes = Buffer.byteLength(wrappedEn, 'utf-8');
    const needsGcs =
      koBytes > INLINE_CONTENT_THRESHOLD ||
      enBytes > INLINE_CONTENT_THRESHOLD ||
      koBytes + enBytes > MAX_DOC_BYTES - 50 * 1024; // 메타데이터용 50KB 여유

    let contentField;
    let contentUrl = null;
    if (needsGcs) {
      try {
        contentUrl = await uploadContentToGcs(docId, wrappedKo, wrappedEn);
        console.log(
          `[publish] content offloaded to GCS (ko=${(koBytes / 1024).toFixed(0)}KB, en=${(enBytes / 1024).toFixed(0)}KB) → ${contentUrl}`
        );
        contentField = {}; // Firestore inline 비움
      } catch (err) {
        throw new HttpsError('internal', `GCS 업로드 실패: ${err.message}`);
      }
    } else {
      contentField = { ko: wrappedKo, en: wrappedEn };
    }

    const doc = {
      id: docId,
      titles: { ko: koTitle, en: enTitle },
      content: contentField,
      ...(contentUrl && { contentUrl }),
      thumbnailUrl: extractFirstImageUrl(normalizedHtml) || extractFirstImageUrl(html),
      excerpt,
      lastUpdated: now.toISOString().slice(0, 10),
      createdAt: now.toISOString(),
      type: 'firestore-content',
      publishedBy: request.auth.uid,
      sourceApp: 'gdoc-fixer',
    };

    const sizeBytes = approxByteSize(doc);
    if (sizeBytes > MAX_DOC_BYTES) {
      throw new HttpsError(
        'resource-exhausted',
        `문서가 Firestore 한도를 초과합니다 (현재 ${(sizeBytes / 1024).toFixed(0)}KB, 한도 ${MAX_DOC_BYTES / 1024}KB).`
      );
    }

    try {
      const techBlogDb = getTechBlogDb();
      await techBlogDb.collection(TECH_BLOG_COLLECTION).doc(docId).set(doc);
    } catch (err) {
      throw new HttpsError('internal', `tech-blog Firestore 쓰기 실패: ${err.message}`);
    }

    const seoDispatched = await triggerSeoBuild(GITHUB_DISPATCH_TOKEN.value(), docId);

    return {
      id: docId,
      url: `${TECH_BLOG_SITE}/${TECH_BLOG_ROUTE}/${docId}`,
      titles: doc.titles,
      sizeBytes,
      seoDispatched,
    };
  }
);
