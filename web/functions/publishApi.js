/**
 * 게시 API — 사용자의 AI 가 만든 HTML·슬라이드를 URL 로 올린다.
 *
 *   GET    /api/design-systems       디자인 규칙 (AI 가 읽고 이 스타일로 만든다)
 *   POST   /api/design-systems       내 디자인 시스템을 만들어 저장 (이후 id 로 재사용)
 *   DELETE /api/design-systems/{id}  내 디자인 시스템 삭제
 *   POST   /api/pages                HTML   → https://docs.prototypebench.org/share/{id}
 *   POST   /api/presentations        슬라이드 → .../p/{id}
 *   DELETE /api/pages/{id}           내린다
 *
 * 생성(창작)은 호출자의 AI 가 하고 우리는 게시·호스팅만 맡는다. 그래서 LLM 을 부르지 않고,
 * 대신 디자인 시스템을 내려줘 결과물의 품질을 유지한다.
 *
 * 저장 위치는 웹 UI 의 공유 기능과 같다(shared / presentations-shared). 따라서 API 로 올린
 * 문서도 기존 뷰어와 OG 메타 SSR 을 그대로 탄다.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

const { getGcsBucket, TECH_BLOG_SECRETS } = require('./publishToTechBlog');
const { resolveApiKey } = require('./apiKeys');

const BLOG_AGENT_API_KEY = defineSecret('BLOG_AGENT_API_KEY');

const SITE = 'https://docs.prototypebench.org';
const PAGES = 'shared';
const DECKS = 'presentations-shared';
const DESIGNS = 'designSystems';
// Firestore 문서 한도(1MiB)에서 메타데이터 여유를 뺀 값.
const MAX_DOC_BYTES = 900 * 1024;

const db = () => admin.firestore();

/** 웹 UI 의 공유 ID 와 같은 형식 — 8자 영숫자. */
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) id += chars[bytes[i] % chars.length];
  return id;
}

function extractKey(req) {
  const h = req.get('x-api-key');
  const a = req.get('authorization') || '';
  return (h || (a.match(/^Bearer\s+(.+)$/i) || [])[1] || '').trim();
}

function isSharedKey(provided) {
  if (!provided) return false;
  return (BLOG_AGENT_API_KEY.value() || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k && k !== 'UNSET')
    .some((k) => {
      const a = Buffer.from(k);
      const b = Buffer.from(provided);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
}

/** 게시물에는 소유자를 남겨야 하므로 사용자 키를 우선한다. */
async function authenticate(req) {
  const provided = extractKey(req);
  if (!provided) return null;
  const found = await resolveApiKey(provided);
  if (found) return { uid: found.uid, via: 'user' };
  if (isSharedKey(provided)) return { uid: null, via: 'shared' };
  return null;
}

function unauthorized(res) {
  res.status(401).json({ ok: false, error: 'x-api-key 인증에 실패했습니다. 프로필 페이지에서 키를 발급하세요.' });
}

/**
 * 본문의 data URI 이미지를 GCS 로 옮긴다.
 * Firestore 문서에 base64 를 그대로 담으면 한도를 금방 넘는다.
 */
async function hostInlineImages(html, idHint) {
  const re = /data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g;
  const matches = [...new Set(html.match(re) || [])];
  if (matches.length === 0) return html;

  const bucket = getGcsBucket();
  let out = html;
  await Promise.all(
    matches.map(async (uri, i) => {
      try {
        const [header, b64] = uri.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
        const ext = mime.split('/')[1].replace('+xml', '');
        const path = `wiki-images/pages/${idHint}_${i}.${ext}`;
        const file = bucket.file(path);
        await file.save(Buffer.from(b64, 'base64'), {
          contentType: mime,
          metadata: { cacheControl: 'public, max-age=31536000' },
          resumable: false,
        });
        try { await file.makePublic(); } catch { /* uniform access bucket */ }
        out = out.replaceAll(uri, `https://storage.googleapis.com/${bucket.name}/${path}`);
      } catch (err) {
        console.warn(`[publishApi] 이미지 ${i} 업로드 실패: ${err.message}`);
      }
    })
  );
  return out;
}

function tooLarge(res, bytes) {
  res.status(413).json({
    ok: false,
    error: `내용이 너무 큽니다 (${(bytes / 1024).toFixed(0)}KB, 한도 ${MAX_DOC_BYTES / 1024}KB). 이미지는 data URI 대신 URL 을 쓰거나 크기를 줄이세요.`,
  });
}

// ─────────────────────────── 디자인 시스템 ───────────────────────────

/**
 * GET /api/design-systems           목록
 * GET /api/design-systems?id=<id>   그 디자인의 프롬프트 블록 (AI 프롬프트에 그대로 넣는다)
 */
exports.designSystems = onRequest(
  { secrets: [BLOG_AGENT_API_KEY], timeoutSeconds: 60, memory: '256MiB', cors: true },
  async (req, res) => {
    const mod = await import('./shared/slideDesignSystems.mjs');
    const { listDesignSystems, buildDesignSystemPromptBlock, getDesignSystem,
            buildLayoutCatalogBlock, validateDesignSystem, SLIDE_DESIGN_SYSTEMS } = mod;

    // ── 내 디자인 시스템 만들기 ──
    if (req.method === 'POST') {
      const caller = await authenticate(req);
      if (!caller) return unauthorized(res);

      const verdict = validateDesignSystem(req.body || {});
      if (!verdict.ok) {
        res.status(400).json({ ok: false, error: verdict.error });
        return;
      }
      // 내장 프리셋 id 와 겹치지 않도록 접두사를 붙인다.
      const id = `ds_${generateId()}`;
      await db().collection(DESIGNS).doc(id).set({
        ...verdict.value,
        id,
        uid: caller.uid,
        createdAt: Date.now(),
        source: 'api',
      });
      console.log(`[publishApi] 디자인 시스템 생성 ${id} (${verdict.value.name})`);
      res.status(200).json({
        ok: true,
        id,
        name: verdict.value.name,
        promptBlock: buildDesignSystemPromptBlock({ id, ...verdict.value }),
        usage: `이후 ?id=${id} 로 조회하거나, 슬라이드를 만들 때 이 promptBlock 을 프롬프트에 넣으세요.`,
      });
      return;
    }

    if (req.method === 'DELETE') {
      const caller = await authenticate(req);
      if (!caller) return unauthorized(res);
      const id = (req.path.match(/\/(ds_[A-Za-z0-9]{8})\/?$/) || [])[1] || String(req.query.id || '');
      if (!id.startsWith('ds_')) {
        res.status(400).json({ ok: false, error: '내장 프리셋은 삭제할 수 없습니다. 커스텀(ds_…) id 를 주세요.' });
        return;
      }
      const ref = db().collection(DESIGNS).doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ ok: false, error: '디자인 시스템을 찾을 수 없습니다.' });
        return;
      }
      if (caller.uid && snap.data().uid !== caller.uid) {
        res.status(403).json({ ok: false, error: '본인이 만든 것만 삭제할 수 있습니다.' });
        return;
      }
      await ref.delete();
      res.status(200).json({ ok: true, id, deleted: true });
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ ok: false, error: 'GET / POST / DELETE 만 허용됩니다.' });
      return;
    }

    const id = req.query.id ? String(req.query.id) : null;

    // ── 목록 ──
    if (!id) {
      // 내 커스텀도 함께 보여준다(키를 준 경우에만).
      let custom = [];
      const caller = await authenticate(req);
      if (caller?.uid) {
        const snap = await db().collection(DESIGNS).where('uid', '==', caller.uid).get();
        custom = snap.docs.map((d) => {
          const v = d.data();
          return { id: d.id, name: v.name, description: v.description, custom: true };
        });
      }
      res.set('Cache-Control', 'no-store');
      res.status(200).json({
        ok: true,
        usage: '?id=<id> 로 호출하면 AI 프롬프트에 그대로 넣을 디자인 규칙 블록을 돌려줍니다. POST 로 나만의 디자인 시스템을 만들 수도 있습니다.',
        builtin: listDesignSystems(),
        custom,
      });
      return;
    }

    // ── 단건 (내장 또는 커스텀) ──
    let ds = null;
    if (id.startsWith('ds_')) {
      const snap = await db().collection(DESIGNS).doc(id).get();
      if (!snap.exists) {
        res.status(404).json({ ok: false, error: '디자인 시스템을 찾을 수 없습니다.' });
        return;
      }
      ds = snap.data();
    } else {
      const found = SLIDE_DESIGN_SYSTEMS.find((d) => d.id === id);
      if (!found) {
        res.status(404).json({
          ok: false,
          error: `'${id}' 프리셋이 없습니다. 목록은 인자 없이 GET 하세요.`,
        });
        return;
      }
      ds = found;
      res.set('Cache-Control', 'public, max-age=600');
    }

    res.status(200).json({
      ok: true,
      id: ds.id,
      name: ds.name,
      description: ds.description,
      palette: ds.palette,
      custom: id.startsWith('ds_'),
      // 이 문자열을 프롬프트에 그대로 붙이면 우리 UI 와 같은 스타일이 나온다.
      promptBlock: buildDesignSystemPromptBlock(ds),
      layoutCatalog: buildLayoutCatalogBlock(),
    });
  }
);

// ─────────────────────────── 게시 ───────────────────────────

/** POST /api/pages — HTML 문서를 게시한다. */
exports.publishPage = onRequest(
  {
    secrets: [BLOG_AGENT_API_KEY, ...TECH_BLOG_SECRETS],
    timeoutSeconds: 120,
    memory: '1GiB',
    cors: false,
  },
  async (req, res) => {
    if (req.method === 'DELETE') return handleDelete(req, res, PAGES);
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'POST 또는 DELETE 만 허용됩니다.' });
      return;
    }
    const caller = await authenticate(req);
    if (!caller) return unauthorized(res);

    const { html, name } = req.body || {};
    if (!html || typeof html !== 'string') {
      res.status(400).json({ ok: false, error: 'html 문자열이 필요합니다.' });
      return;
    }

    const id = generateId();
    let processed;
    try {
      processed = await hostInlineImages(html, id);
    } catch (err) {
      console.warn('[publishApi] 이미지 처리 실패, 원본 게시:', err.message);
      processed = html;
    }

    const bytes = Buffer.byteLength(processed, 'utf-8');
    if (bytes > MAX_DOC_BYTES) return tooLarge(res, bytes);

    await db().collection(PAGES).doc(id).set({
      html: processed,
      name: String(name || '').slice(0, 200),
      uid: caller.uid,
      createdAt: Date.now(),
      source: 'api',
    });

    console.log(`[publishApi] 페이지 게시 ${id} (uid=${caller.uid || 'shared'}, ${(bytes / 1024).toFixed(0)}KB)`);
    res.status(200).json({ ok: true, id, url: `${SITE}/share/${id}` });
  }
);

/** POST /api/presentations — 슬라이드 묶음을 게시한다. */
exports.publishPresentation = onRequest(
  {
    secrets: [BLOG_AGENT_API_KEY, ...TECH_BLOG_SECRETS],
    timeoutSeconds: 120,
    memory: '1GiB',
    cors: false,
  },
  async (req, res) => {
    if (req.method === 'DELETE') return handleDelete(req, res, DECKS);
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'POST 또는 DELETE 만 허용됩니다.' });
      return;
    }
    const caller = await authenticate(req);
    if (!caller) return unauthorized(res);

    const { slides, name } = req.body || {};
    if (!Array.isArray(slides) || slides.length === 0 || slides.some((s) => typeof s !== 'string')) {
      res.status(400).json({ ok: false, error: 'slides 는 비어 있지 않은 HTML 문자열 배열이어야 합니다.' });
      return;
    }

    const id = generateId();
    const processed = [];
    for (let i = 0; i < slides.length; i++) {
      try {
        processed.push(await hostInlineImages(slides[i], `${id}_s${i}`));
      } catch {
        processed.push(slides[i]);
      }
    }

    const bytes = Buffer.byteLength(JSON.stringify(processed), 'utf-8');
    if (bytes > MAX_DOC_BYTES) return tooLarge(res, bytes);

    await db().collection(DECKS).doc(id).set({
      slides: processed,
      name: String(name || '').slice(0, 200),
      uid: caller.uid,
      createdAt: Date.now(),
      source: 'api',
    });

    console.log(`[publishApi] 슬라이드 게시 ${id} (${processed.length}장, ${(bytes / 1024).toFixed(0)}KB)`);
    res.status(200).json({ ok: true, id, url: `${SITE}/p/${id}`, slideCount: processed.length });
  }
);

/** 내가 올린 것만 내릴 수 있다. */
async function handleDelete(req, res, collection) {
  const caller = await authenticate(req);
  if (!caller) return unauthorized(res);

  const id = (req.path.match(/\/([A-Za-z0-9]{8})\/?$/) || [])[1] || String(req.query.id || '');
  if (!id) {
    res.status(400).json({ ok: false, error: '게시 id 가 필요합니다.' });
    return;
  }

  const ref = db().collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ ok: false, error: '해당 게시물을 찾을 수 없습니다.' });
    return;
  }
  // 공유 키(운영)는 소유자 검사를 건너뛴다. 사용자 키는 본인 것만.
  if (caller.uid && snap.data().uid !== caller.uid) {
    res.status(403).json({ ok: false, error: '본인이 올린 게시물만 내릴 수 있습니다.' });
    return;
  }

  await ref.delete();
  console.log(`[publishApi] 게시물 삭제 ${collection}/${id}`);
  res.status(200).json({ ok: true, id, deleted: true });
}
