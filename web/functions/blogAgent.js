/**
 * 커스텀 블로그 작성 에이전트 — 외부에서 Markdown 을 받아 tech-blog 에 자동 게시한다.
 *
 * 흐름:
 *   POST /api/blog/publish  (x-api-key)
 *     → blogAgentJobs/{jobId} 문서 생성 → 워커를 깨우고(응답은 안 기다림) 즉시 202 반환
 *   워커(blogAgentWorker, HTTP)
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

const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

const {
  runTechBlogPublish,
  getGcsBucket,
  getTechBlogDb,
  TECH_BLOG_COLLECTION,
  TECH_BLOG_SECRETS,
} = require('./publishToTechBlog');
const { postToCommunity, COMMUNITY_SECRETS } = require('./publishToCommunity');
const { postToLinkedIn, LINKEDIN_SECRETS } = require('./publishToLinkedIn');

// 외부 클라이언트 인증용. 여러 개를 쉼표로 넣으면 모두 허용된다
// (예: "prod-key,staging-key") — 키 교체 시 무중단 전환용.
const BLOG_AGENT_API_KEY = defineSecret('BLOG_AGENT_API_KEY');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const JOBS_COLLECTION = 'blogAgentJobs';
// 접수 함수가 워커를 깨울 때 쓰는 주소. 리전은 두 함수 모두 us-central1 고정.
const WORKER_URL = `https://us-central1-${process.env.GCLOUD_PROJECT || 'gdoc-fixer'}.cloudfunctions.net/blogAgentWorker`;
// 워커를 깨우고 응답을 기다리는 최대 시간. 파이프라인은 이보다 훨씬 오래 걸리므로
// 이 시간 안에 오는 응답은 사실상 오류뿐이다. 타임아웃은 "정상 착수"로 해석한다.
const WORKER_HANDSHAKE_MS = 10000;
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

  // Firestore 는 undefined 를 값으로 받지 않는다 — 없으면 null 로 둔다.
  let tags = null;
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
    // 주면 새 글을 만들지 않고 그 글을 덮어쓴다 (URL 유지). 게시 후 오류 수정용.
    replaceId:
      typeof payload.replaceId === 'string' && /^[a-zA-Z0-9._-]{1,200}$/.test(payload.replaceId)
        ? payload.replaceId
        : null,
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
    replaceId: job.replaceId || null,
  });

  const result = {
    techBlogId: techBlog.id,
    techBlogUrl: techBlog.url,
    titles: techBlog.titles,
    seoDispatched: techBlog.seoDispatched,
    replaced: !!techBlog.replaced,
    communityUrl: null,
    linkedInUrl: null,
    linkedInSkipped: false,
  };

  // 교체 게시는 이미 퍼진 글을 고치는 것이므로 커뮤니티/LinkedIn 에 다시 뿌리지 않는다.
  if (!job.chain || job.replaceId) return result;

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

/**
 * 워커를 깨운다. 성공하면 null, 실패하면 사유 문자열을 돌려준다.
 * 타임아웃(AbortError)은 "워커가 요청을 받아 처리 중" 이라는 뜻이므로 성공으로 본다.
 */
async function wakeWorker(jobId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_HANDSHAKE_MS);
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': BLOG_AGENT_API_KEY.value(),
      },
      body: JSON.stringify({ jobId }),
      signal: controller.signal,
    });
    // 이 시간 안에 응답이 왔다면 파이프라인을 돈 것이 아니라 거부당한 것이다.
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return `워커 HTTP ${res.status}: ${body.slice(0, 200)}`;
    }
    return null; // 드물게 아주 짧은 원고가 제시간에 끝난 경우
  } catch (err) {
    if (err?.name === 'AbortError') return null; // 정상 착수
    return err?.message || String(err);
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────── 엔드포인트 ───────────────────────────────

// GEMINI_API_KEY 는 여기서도 쓰고 TECH_BLOG_SECRETS 에도 들어 있다. defineSecret 은
// 같은 이름이라도 호출할 때마다 다른 객체를 주므로, 이름 기준으로 중복을 걷어내지 않으면
// Cloud Run 이 "Duplicate secret environment variable" 로 배포를 거부한다.
const ALL_SECRETS = [
  ...new Map(
    [
      BLOG_AGENT_API_KEY,
      GEMINI_API_KEY,
      ...TECH_BLOG_SECRETS,
      ...COMMUNITY_SECRETS,
      ...LINKEDIN_SECRETS,
    ].map((secret) => [secret.name, secret])
  ).values(),
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
    // 필드가 하나라도 undefined 면 Firestore 쓰기 전체가 거부된다. 접수 단계에서
    // 막히면 원인이 원고 내용처럼 보여 진단이 어려우니 여기서 한 번 걸러 둔다.
    const dropUndefined = (obj) =>
      Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
    await ref.set(dropUndefined({
      ...job,
      titleHint: job.title || titleFromMarkdown(job.markdown),
      status: 'queued',
      step: 'queued',
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
    }));

    // 워커를 깨운다. 파이프라인은 수 분~수십 분이므로 응답은 기다리지 않고,
    // 연결이 수립된 것만 확인하고 끊는다(Cloud Run 은 클라이언트가 끊어도 처리를 계속한다).
    // 깨우기에 실패하면 job 이 영영 queued 로 남으므로 접수 자체를 실패로 돌린다.
    const dispatchError = await wakeWorker(ref.id);
    if (dispatchError) {
      console.error(`[blogAgent] job ${ref.id} 워커 호출 실패:`, dispatchError);
      await ref.update({ status: 'failed', error: `워커 호출 실패: ${dispatchError}` });
      res.status(500).json({ ok: false, error: `작업 시작에 실패했습니다: ${dispatchError}` });
      return;
    }

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

/**
 * 실제 파이프라인을 돌리는 워커.
 *
 * Firestore 문서 생성 트리거가 아니라 Cloud Tasks 를 쓰는 이유: 이벤트 트리거 함수는
 * 실행 시간이 540초로 묶이는데, 큰 원고는 기획·이미지·조립·번역을 합쳐 그보다 오래 걸린다.
 * Cloud Tasks 워커는 30분까지 쓸 수 있고 재시도 정책도 명시할 수 있다.
 */
exports.blogAgentWorker = onRequest(
  {
    secrets: ALL_SECRETS,
    // HTTP 함수는 60분까지 쓸 수 있다. 접수 함수가 응답을 기다리지 않으므로
    // Hosting 의 60초 제한과는 무관하다 (이 함수는 rewrite 에 걸지 않는다).
    timeoutSeconds: 3600,
    memory: '2GiB',
    maxInstances: 3,
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'POST' || !isAuthorized(req)) {
      res.status(req.method === 'POST' ? 401 : 405).json({ ok: false });
      return;
    }

    const jobId = req.body?.jobId;
    if (!jobId) {
      res.status(400).json({ ok: false, error: 'jobId 가 필요합니다.' });
      return;
    }

    const ref = db().collection(JOBS_COLLECTION).doc(jobId);

    // queued → running 전환을 트랜잭션으로 선점한다. 같은 job 에 대한 호출이
    // 겹쳐도 한 번만 실행되며, 이미 처리된 job 의 재실행(= 중복 게시)도 막는다.
    let job;
    try {
      job = await db().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        const data = snap.data();
        if (data.status !== 'queued') return null;
        tx.update(ref, {
          status: 'running',
          step: 'starting',
          startedAt: new Date().toISOString(),
        });
        return data;
      });
    } catch (err) {
      console.error(`[blogAgent:${jobId}] 선점 실패:`, err.message);
      res.status(500).json({ ok: false, error: err.message });
      return;
    }

    if (!job) {
      console.log(`[blogAgent:${jobId}] 이미 처리됐거나 존재하지 않음 — 건너뜀`);
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    // 여기서부터가 긴 작업. 접수 함수는 이미 연결을 끊었지만 Cloud Run 은
    // 처리를 계속하므로 그대로 끝까지 진행한다.
    const update = (patch) => ref.update(patch);

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
      res.status(200).json({ ok: true, jobId, result });
    } catch (err) {
      const message = err?.message || String(err);
      console.error(`[blogAgent:${jobId}] 실패:`, message);
      await update({
        status: 'failed',
        error: message,
        finishedAt: new Date().toISOString(),
      });
      await notifyCallback(job, { ok: false, jobId, status: 'failed', error: message });
      res.status(500).json({ ok: false, jobId, error: message });
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


/**
 * DELETE /api/blog/posts/{techBlogId} — 게시된 글을 tech-blog 에서 내린다.
 *
 * tech-blog/scripts/delete-report.js 와 같은 동작(static-wiki 문서 삭제)을 API 로 노출한 것.
 * 본문이 GCS 로 분리된 글이면 그 JSON 도 함께 지운다.
 * 정적 SEO 페이지(dist/report/{id})는 다음 SEO 빌드에서 정리된다.
 */
exports.blogAgentDelete = onRequest(
  {
    secrets: [BLOG_AGENT_API_KEY, ...TECH_BLOG_SECRETS],
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'DELETE' && req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'DELETE 또는 POST 만 허용됩니다.' });
      return;
    }
    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'x-api-key 인증에 실패했습니다.' });
      return;
    }

    const fromPath = (req.path.match(/\/posts\/([A-Za-z0-9._-]+)\/?$/) || [])[1];
    const id = fromPath || (typeof req.body?.id === 'string' ? req.body.id : '');
    if (!id) {
      res.status(400).json({ ok: false, error: '글 id 가 필요합니다 (/api/blog/posts/{id}).' });
      return;
    }

    try {
      const ref = getTechBlogDb().collection(TECH_BLOG_COLLECTION).doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ ok: false, error: `글을 찾을 수 없습니다: ${id}` });
        return;
      }

      const data = snap.data();
      await ref.delete();

      // 본문이 GCS 에 분리 저장된 글이면 그 파일도 정리한다(남겨두면 고아 객체가 된다).
      let contentDeleted = false;
      if (data?.contentUrl) {
        try {
          const bucket = getGcsBucket();
          const path = decodeURIComponent(
            new URL(data.contentUrl).pathname.replace(`/${bucket.name}/`, '')
          );
          await bucket.file(path).delete();
          contentDeleted = true;
        } catch (err) {
          console.warn(`[blogAgent] GCS 본문 삭제 실패(문서는 삭제됨): ${err.message}`);
        }
      }

      console.log(`[blogAgent] 글 삭제: ${id} (title=${data?.titles?.ko || '?'})`);
      res.status(200).json({
        ok: true,
        id,
        deleted: true,
        title: data?.titles?.ko || null,
        contentDeleted,
      });
    } catch (err) {
      console.error(`[blogAgent] 삭제 실패 ${id}:`, err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);
