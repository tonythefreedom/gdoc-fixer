/**
 * 커스텀 블로그 작성 에이전트 — 외부에서 Markdown 을 받아 tech-blog 에 자동 게시한다.
 *
 * 흐름:
 *   POST /api/blog/publish  (x-api-key)
 *     → blogAgentJobs/{jobId} 문서 생성 → 즉시 202 반환
 *   onDocumentCreated 트리거(blogAgentWorker)
 *     → 기획안 생성 → 이미지 생성 → HTML 조립   (프론트와 같은 프롬프트: shared/planningPrompts.mjs)
 *     → 생성 이미지 GCS 업로드
 *     → Tailwind 인라인화                      (프론트 normalizeForPublish 의 서버 대응)
 *     → tech-blog 게시 → 커뮤니티 → LinkedIn    (기존 연쇄 게시 코어 재사용)
 *   GET /api/blog/jobs/{jobId} 로 상태 조회, callbackUrl 이 있으면 완료 시 POST 통지.
 *
 * 왜 비동기인가: 전체 파이프라인은 5~20분이 걸리는데 Firebase Hosting 을 경유한
 * 함수 호출은 60초에서 끊긴다. 그래서 접수(빠름)와 처리(느림)를 분리한다.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

const {
  runTechBlogPublish,
  getGcsBucket,
  TECH_BLOG_SECRETS,
} = require('./publishToTechBlog');
const { postToCommunity, COMMUNITY_SECRETS } = require('./publishToCommunity');
const { postToLinkedIn, LINKEDIN_SECRETS } = require('./publishToLinkedIn');

// 외부 클라이언트 인증용. 여러 개를 쉼표로 넣으면 모두 허용된다
// (예: "prod-key,staging-key") — 키 교체 시 무중단 전환용.
const BLOG_AGENT_API_KEY = defineSecret('BLOG_AGENT_API_KEY');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const JOBS_COLLECTION = 'blogAgentJobs';
// Firestore 문서 1MiB 한도 안에서 원고 + 메타데이터가 모두 들어가야 한다.
const MAX_MARKDOWN_BYTES = 400 * 1024;
const VALID_MODES = ['custom', 'research'];
const VALID_TEMPLATES = ['custom', 'business_plan', 'company_intro', 'product_intro'];

const db = () => admin.firestore();

// ─────────────────────────────── 인증 ───────────────────────────────

/** 길이 노출 없이 상수시간 비교. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function extractApiKey(req) {
  const header = req.get('x-api-key');
  if (header) return header.trim();
  const auth = req.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function isAuthorized(req) {
  const provided = extractApiKey(req);
  if (!provided) return false;
  const configured = (BLOG_AGENT_API_KEY.value() || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k && k !== 'UNSET');
  if (configured.length === 0) return false;
  return configured.some((k) => safeEqual(k, provided));
}

// ─────────────────────────────── 요청 파싱 ───────────────────────────────

/**
 * 본문에서 게시 요청을 뽑아낸다.
 *   · application/json  → { markdown, title, mode, ... }
 *   · text/markdown | text/plain → 본문 전체가 원고, 옵션은 쿼리스트링
 */
function parseRequest(req) {
  const contentType = (req.get('content-type') || '').toLowerCase();
  let payload;

  if (contentType.includes('application/json')) {
    payload = typeof req.body === 'object' && req.body ? req.body : {};
  } else {
    // onRequest 는 text/* 를 문자열로 준다. 그 외 타입은 rawBody 로 폴백.
    const raw =
      typeof req.body === 'string' ? req.body : (req.rawBody ? req.rawBody.toString('utf-8') : '');
    payload = { ...req.query, markdown: raw };
  }

  const asBool = (v, dflt) => {
    if (v === undefined || v === null || v === '') return dflt;
    if (typeof v === 'boolean') return v;
    return !['false', '0', 'no', 'off'].includes(String(v).toLowerCase());
  };

  const markdown = String(payload.markdown ?? payload.content ?? payload.md ?? '');
  const mode = VALID_MODES.includes(payload.mode) ? payload.mode : 'custom';
  const template = VALID_TEMPLATES.includes(payload.template) ? payload.template : 'custom';

  let tags;
  if (Array.isArray(payload.tags)) tags = payload.tags.map(String).slice(0, 10);
  else if (typeof payload.tags === 'string' && payload.tags.trim()) {
    tags = payload.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10);
  }

  return {
    markdown,
    title: payload.title ? String(payload.title).slice(0, 200) : '',
    mode,
    template,
    withImages: asBool(payload.generateImages ?? payload.images, true),
    chain: asBool(payload.chain, true),
    tags,
    callbackUrl:
      typeof payload.callbackUrl === 'string' && /^https:\/\//i.test(payload.callbackUrl)
        ? payload.callbackUrl
        : null,
    client: payload.client ? String(payload.client).slice(0, 80) : 'api',
  };
}

function validate(job) {
  if (!job.markdown.trim()) return 'markdown(원고 본문)이 비어 있습니다.';
  const bytes = Buffer.byteLength(job.markdown, 'utf-8');
  if (bytes > MAX_MARKDOWN_BYTES) {
    return `원고가 너무 깁니다 (현재 ${(bytes / 1024).toFixed(0)}KB, 한도 ${MAX_MARKDOWN_BYTES / 1024}KB).`;
  }
  return null;
}

/** 원고 첫 h1 을 제목 힌트로 쓴다 (기획안이 뽑은 title 이 최종 우선). */
function titleFromMarkdown(markdown) {
  const m = markdown.match(/^\s*#\s+(.+)$/m);
  return m ? m[1].trim().slice(0, 200) : '';
}

// ─────────────────────────────── 생성 이미지 업로드 ───────────────────────────────

/**
 * 조립된 HTML 안의 data URI 이미지를 GCS 로 옮기고 URL 로 치환한다.
 * 프론트 store/storage.js 의 uploadDocumentImages 서버 버전 — data URI 를 그대로 두면
 * Firestore 문서 한도를 즉시 넘긴다.
 */
async function uploadInlineImages(html, jobId) {
  const dataUriRegex = /data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g;
  const matches = [...new Set(html.match(dataUriRegex) || [])];
  if (matches.length === 0) return html;

  const bucket = getGcsBucket();
  let result = html;

  await Promise.all(
    matches.map(async (dataUri, i) => {
      try {
        const [header, b64] = dataUri.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
        const ext = mime.split('/')[1].replace('+xml', '');
        const path = `wiki-images/docs/blog-agent/${jobId}_${i}.${ext}`;
        const file = bucket.file(path);
        await file.save(Buffer.from(b64, 'base64'), {
          contentType: mime,
          metadata: { cacheControl: 'public, max-age=31536000' },
          resumable: false,
        });
        try {
          await file.makePublic();
        } catch {
          // uniform bucket-level access 면 이미 public — 그대로 진행
        }
        result = result.replaceAll(
          dataUri,
          `https://storage.googleapis.com/${bucket.name}/${path}`
        );
      } catch (err) {
        // 업로드 실패분은 data URI 로 남겨두고 계속 — 게시 자체를 막지 않는다.
        console.warn(`[blogAgent] 이미지 ${i} 업로드 실패: ${err.message}`);
      }
    })
  );

  return result;
}

// ─────────────────────────────── 파이프라인 ───────────────────────────────

/**
 * 원고 한 편을 처리한다. 각 단계마다 job 문서의 step 을 갱신해 진행 상황을 노출한다.
 * @param {string} jobId
 * @param {object} job  parseRequest 결과
 * @param {(patch:object)=>Promise<void>} update  job 문서 갱신 콜백
 */
async function runBlogAgentJob(jobId, job, update) {
  const apiKey = GEMINI_API_KEY.value();
  const { runPlanningPipeline } = await import('./shared/planningCore.mjs');
  const { inlineTailwind } = await import('./shared/tailwindInline.mjs');

  // 1) 기획안 → 이미지 → HTML 조립 (프론트 PlanningEditor 와 같은 순서/프롬프트)
  const { plan, html: composedHtml, imageCount } = await runPlanningPipeline({
    brief: job.markdown,
    mode: job.mode,
    template: job.template,
    withImages: job.withImages,
    apiKey,
    onStep: (step, detail) => {
      console.log(`[blogAgent:${jobId}] step=${step}`, detail || '');
      update({ step }).catch(() => {});
    },
  });

  const name = job.title || plan?.title || titleFromMarkdown(job.markdown) || '제목 없음';

  // 2) 생성 이미지를 GCS 로 (data URI 그대로면 Firestore 한도 초과)
  await update({ step: 'uploading-images', imageCount });
  const hostedHtml = await uploadInlineImages(composedHtml, jobId);

  // 3) 게시-경계 정규화 — 클래스로 준 스타일을 인라인으로 굽는다.
  //    이 단계가 빠지면 tech-blog/커뮤니티가 class 를 스트립할 때 스타일이 전부 사라진다.
  await update({ step: 'inlining-styles' });
  const publishHtml = await inlineTailwind(hostedHtml);

  // 4) tech-blog
  await update({ step: 'publishing-techblog' });
  const techBlog = await runTechBlogPublish({
    html: publishHtml,
    name,
    publishedBy: `blog-agent:${job.client}`,
    sourceApp: 'gdoc-fixer-blog-agent',
  });

  const result = {
    techBlogId: techBlog.id,
    techBlogUrl: techBlog.url,
    titles: techBlog.titles,
    seoDispatched: techBlog.seoDispatched,
    communityUrl: null,
    linkedInUrl: null,
    linkedInSkipped: false,
  };

  if (!job.chain) return result;

  // 5) 커뮤니티 (출처 = tech-blog 글) — 실패해도 tech-blog 게시는 되돌리지 않는다.
  await update({ step: 'publishing-community', result });
  try {
    const community = await postToCommunity({
      html: publishHtml,
      name,
      sourceUrl: result.techBlogUrl,
      tags: job.tags,
    });
    result.communityUrl = community?.url || null;
  } catch (err) {
    console.error(`[blogAgent:${jobId}] 커뮤니티 게시 실패:`, err.message);
    result.communityError = err.message;
    return result; // LinkedIn 은 커뮤니티 링크를 출처로 쓰므로 여기서 종료
  }

  // 6) LinkedIn (출처 = 커뮤니티 글) — 자격증명 없으면 skipped
  await update({ step: 'publishing-linkedin', result });
  try {
    const linkedIn = await postToLinkedIn({ title: name, url: result.communityUrl });
    if (linkedIn?.skipped) {
      result.linkedInSkipped = true;
      result.linkedInSkipReason = linkedIn.reason || null;
    } else {
      result.linkedInUrl = linkedIn?.url || null;
    }
  } catch (err) {
    console.error(`[blogAgent:${jobId}] LinkedIn 게시 실패:`, err.message);
    result.linkedInError = err.message;
  }

  return result;
}

/** 완료 통지 — 실패해도 job 결과에는 영향을 주지 않는다. */
async function notifyCallback(job, body) {
  if (!job.callbackUrl) return;
  try {
    const res = await fetch(job.callbackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) console.warn(`[blogAgent] callback HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[blogAgent] callback 실패: ${err.message}`);
  }
}

// ─────────────────────────────── 엔드포인트 ───────────────────────────────

const ALL_SECRETS = [
  BLOG_AGENT_API_KEY,
  GEMINI_API_KEY,
  ...TECH_BLOG_SECRETS,
  ...COMMUNITY_SECRETS,
  ...LINKEDIN_SECRETS,
];

/** POST /api/blog/publish — 원고 접수 (빠르게 반환). */
exports.blogAgentPublish = onRequest(
  { secrets: [BLOG_AGENT_API_KEY], timeoutSeconds: 60, memory: '256MiB', cors: false },
  async (req, res) => {
    // 서버-투-서버 전용이다. API 키를 헤더로 받으므로 브라우저에서 직접 부르면
    // 키가 노출된다 — CORS 를 열지 않는 것이 의도된 동작.
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'POST 만 허용됩니다.' });
      return;
    }
    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'x-api-key 인증에 실패했습니다.' });
      return;
    }

    let job;
    try {
      job = parseRequest(req);
    } catch (err) {
      res.status(400).json({ ok: false, error: `요청 파싱 실패: ${err.message}` });
      return;
    }

    const invalid = validate(job);
    if (invalid) {
      res.status(400).json({ ok: false, error: invalid });
      return;
    }

    const now = new Date().toISOString();
    const ref = db().collection(JOBS_COLLECTION).doc();
    await ref.set({
      ...job,
      titleHint: job.title || titleFromMarkdown(job.markdown),
      status: 'queued',
      step: 'queued',
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
    });

    console.log(`[blogAgent] job ${ref.id} 접수 (client=${job.client}, mode=${job.mode}, chain=${job.chain})`);
    res.status(202).json({
      ok: true,
      jobId: ref.id,
      status: 'queued',
      statusUrl: `https://gdoc-fixer.web.app/api/blog/jobs/${ref.id}`,
      message: '접수되었습니다. 게시까지 보통 5~20분 걸립니다.',
    });
  }
);

/** blogAgentJobs 문서 생성 트리거 — 실제 파이프라인을 돌린다. */
exports.blogAgentWorker = onDocumentCreated(
  {
    document: `${JOBS_COLLECTION}/{jobId}`,
    secrets: ALL_SECRETS,
    timeoutSeconds: 3600,
    memory: '2GiB',
    retry: false,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const jobId = event.params.jobId;
    const job = snap.data();

    // 재시도/중복 트리거 가드
    if (job.status && job.status !== 'queued') {
      console.log(`[blogAgent:${jobId}] status=${job.status} — 건너뜀`);
      return;
    }

    const ref = snap.ref;
    const update = (patch) => ref.update(patch);

    await update({ status: 'running', step: 'starting', startedAt: new Date().toISOString() });

    try {
      const result = await runBlogAgentJob(jobId, job, update);
      await update({
        status: 'succeeded',
        step: 'done',
        result,
        finishedAt: new Date().toISOString(),
      });
      console.log(`[blogAgent:${jobId}] 완료 → ${result.techBlogUrl}`);
      await notifyCallback(job, { ok: true, jobId, status: 'succeeded', result });
    } catch (err) {
      const message = err?.message || String(err);
      console.error(`[blogAgent:${jobId}] 실패:`, message);
      await update({
        status: 'failed',
        error: message,
        finishedAt: new Date().toISOString(),
      });
      await notifyCallback(job, { ok: false, jobId, status: 'failed', error: message });
    }
  }
);

/** GET /api/blog/jobs/{jobId} — 진행 상황 조회. */
exports.blogAgentStatus = onRequest(
  { secrets: [BLOG_AGENT_API_KEY], timeoutSeconds: 60, memory: '256MiB', cors: false },
  async (req, res) => {
    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'x-api-key 인증에 실패했습니다.' });
      return;
    }
    const jobId = (req.path.match(/\/jobs\/([A-Za-z0-9_-]+)\/?$/) || [])[1];
    if (!jobId) {
      res.status(400).json({ ok: false, error: 'jobId 가 필요합니다 (/api/blog/jobs/{jobId}).' });
      return;
    }

    const snap = await db().collection(JOBS_COLLECTION).doc(jobId).get();
    if (!snap.exists) {
      res.status(404).json({ ok: false, error: '해당 job 을 찾을 수 없습니다.' });
      return;
    }

    const d = snap.data();
    res.status(200).json({
      ok: true,
      jobId,
      status: d.status,
      step: d.step,
      title: d.titleHint || null,
      mode: d.mode,
      chain: d.chain,
      createdAt: d.createdAt,
      startedAt: d.startedAt,
      finishedAt: d.finishedAt,
      result: d.result || null,
      error: d.error || null,
    });
  }
);
