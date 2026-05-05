const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const TECH_BLOG_SERVICE_ACCOUNT = defineSecret('TECH_BLOG_SERVICE_ACCOUNT');

const SUPER_ADMIN_EMAIL = 'tony@banya.ai';
const TECH_BLOG_COLLECTION = 'banya-official-news';
const TECH_BLOG_SITE = 'https://tony.banya.ai';
const MAX_INPUT_BYTES = 800 * 1024;
const MAX_DOC_BYTES = 950 * 1024;
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

async function callGemini(model, prompt, apiKey, opts = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 32768,
      ...(opts.responseMimeType && { responseMimeType: opts.responseMimeType }),
      ...(opts.responseSchema && { responseSchema: opts.responseSchema }),
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${model} HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini ${model} returned no text`);
  }
  return text;
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

exports.publishToTechBlog = onCall(
  {
    secrets: [GEMINI_API_KEY, TECH_BLOG_SERVICE_ACCOUNT],
    timeoutSeconds: 540,
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
    if (Buffer.byteLength(html, 'utf-8') > MAX_INPUT_BYTES) {
      throw new HttpsError(
        'invalid-argument',
        `문서가 너무 큽니다 (${MAX_INPUT_BYTES / 1024}KB 이내).`
      );
    }

    const apiKey = GEMINI_API_KEY.value();

    // 1. Translate Ko → En
    const translationPrompt = `You are a precise HTML translator. Translate the following Korean HTML to natural, fluent English.

Strict rules:
- Preserve every HTML tag, attribute, class name, inline style, image URL (src), href, and id EXACTLY.
- Translate ONLY user-visible Korean text (text nodes, and meaningful attribute values like alt/title).
- Keep brand names, code blocks, programming identifiers, URLs, and numeric data as-is.
- Maintain heading hierarchy, list structure, table layout, and overall semantics.
- Do not add commentary, preamble, or markdown code fences. Output the translated HTML only.

Korean HTML:
${html}

Translated English HTML:`;

    let englishHtml;
    try {
      const raw = await callGemini(GEMINI_PRO, translationPrompt, apiKey, {
        maxOutputTokens: 65536,
        temperature: 0.2,
      });
      englishHtml = stripCodeFence(raw);
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
${html.slice(0, 50000)}

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
    const wrappedKo = ensureArticleWrap(html);
    const wrappedEn = ensureArticleWrap(englishHtml);

    const docId = `${slug}-${shortId()}`;
    const doc = {
      id: docId,
      titles: { ko: koTitle, en: enTitle },
      content: { ko: wrappedKo, en: wrappedEn },
      thumbnailUrl: extractFirstImageUrl(html),
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
        `문서가 Firestore 한도를 초과합니다 (${(sizeBytes / 1024).toFixed(0)}KB > 950KB).`
      );
    }

    try {
      const techBlogDb = getTechBlogDb();
      await techBlogDb.collection(TECH_BLOG_COLLECTION).doc(docId).set(doc);
    } catch (err) {
      throw new HttpsError('internal', `tech-blog Firestore 쓰기 실패: ${err.message}`);
    }

    return {
      id: docId,
      url: `${TECH_BLOG_SITE}/news/${docId}`,
      titles: doc.titles,
      sizeBytes,
    };
  }
);
