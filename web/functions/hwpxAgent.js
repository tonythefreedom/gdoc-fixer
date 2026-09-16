/**
 * 양식 채우기 API — 양식 .hwpx 와 내용 .md 를 함께 받아 채워진 .hwpx 를 돌려준다.
 *
 *   POST /api/hwpx/fill   (multipart/form-data, 동기)
 *     template: 양식 .hwpx 파일   (필수)
 *     markdown: 내용 .md 파일 또는 텍스트 필드 (필수)
 *     filename: 받을 파일 이름 (선택)
 *   → 채워진 HWPX 바이너리
 *
 * 게시 API 와 달리 동기다. LLM 호출이 한 번뿐이라 보통 3~10초에 끝난다.
 * 다만 Hosting 을 경유하면 60초에서 끊기므로, 단락이 아주 많은 양식은
 * 함수 직접 URL 로 호출하는 편이 안전하다.
 *
 * 위 /fill 은 "알아서 채워주는" 편의 경로다. 호출하는 쪽이 이미 LLM(예: Claude)이라면
 * 안에서 Gemini 를 한 번 더 부를 이유가 없으므로, 직접 제어용 저수준 경로를 함께 연다:
 *
 *   POST /api/hwpx/inspect      양식 구조(단락·표·안내문)를 JSON 으로 본다
 *   POST /api/hwpx/expand-rows  표 행이 모자랄 때 복제해 늘린다
 *   POST /api/hwpx/apply        내가 만든 단락 배열을 그대로 적용해 HWPX 를 받는다
 *
 * inspect → (호출자가 판단) → apply 순서로 쓰면 채울 내용을 전적으로 호출자가 정한다.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Busboy = require('busboy');

const BLOG_AGENT_API_KEY = defineSecret('BLOG_AGENT_API_KEY');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const MAX_TEMPLATE_BYTES = 8 * 1024 * 1024;
const MAX_MARKDOWN_BYTES = 400 * 1024;

const { safeEqual } = (() => {
  const crypto = require('crypto');
  return {
    safeEqual(a, b) {
      const ab = Buffer.from(String(a));
      const bb = Buffer.from(String(b));
      if (ab.length !== bb.length) return false;
      return crypto.timingSafeEqual(ab, bb);
    },
  };
})();

function isAuthorized(req) {
  const header = req.get('x-api-key');
  const auth = req.get('authorization') || '';
  const provided = (header || (auth.match(/^Bearer\s+(.+)$/i) || [])[1] || '').trim();
  if (!provided) return false;
  const configured = (BLOG_AGENT_API_KEY.value() || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k && k !== 'UNSET');
  return configured.some((k) => safeEqual(k, provided));
}

/**
 * multipart/form-data 를 파싱한다.
 * Cloud Functions 는 본문을 이미 읽어 req.rawBody 에 담아 주므로 스트림 대신 그것을 넘긴다.
 */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      reject(new Error('multipart/form-data 로 보내주세요.'));
      return;
    }

    const bb = Busboy({
      headers: req.headers,
      limits: { files: 2, fileSize: MAX_TEMPLATE_BYTES },
    });
    const files = {};
    const fields = {};
    let truncated = false;

    bb.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('limit', () => {
        truncated = true;
        stream.resume();
      });
      stream.on('end', () => {
        files[name] = { buffer: Buffer.concat(chunks), filename: info?.filename || '' };
      });
    });
    bb.on('field', (name, val) => {
      fields[name] = val;
    });
    bb.on('error', reject);
    bb.on('close', () => {
      if (truncated) {
        reject(new Error(`파일이 너무 큽니다 (한도 ${MAX_TEMPLATE_BYTES / 1024 / 1024}MB).`));
        return;
      }
      resolve({ files, fields });
    });

    bb.end(req.rawBody);
  });
}

/** 한글 파일명을 Content-Disposition 에 안전하게 싣는다 (RFC 5987). */
function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function deriveFilename(markdown, explicit) {
  if (explicit) return explicit.endsWith('.hwpx') ? explicit : `${explicit}.hwpx`;
  const h1 = markdown.match(/^\s*#\s+(.+)$/m);
  const base = (h1 ? h1[1].trim() : '문서').replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
  return `${base || '문서'}.hwpx`;
}

exports.hwpxFill = onRequest(
  {
    secrets: [BLOG_AGENT_API_KEY, GEMINI_API_KEY],
    timeoutSeconds: 540,
    memory: '1GiB',
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'POST 만 허용됩니다.' });
      return;
    }
    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'x-api-key 인증에 실패했습니다.' });
      return;
    }

    let parsed;
    try {
      parsed = await parseMultipart(req);
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }

    const { files, fields } = parsed;
    const template = files.template;
    if (!template || template.buffer.length === 0) {
      res.status(400).json({ ok: false, error: '양식 파일(template)이 필요합니다.' });
      return;
    }

    // markdown 은 파일로 와도 되고 텍스트 필드로 와도 된다.
    const markdown = files.markdown
      ? files.markdown.buffer.toString('utf-8')
      : String(fields.markdown || '');
    if (!markdown.trim()) {
      res.status(400).json({ ok: false, error: '내용(markdown)이 비어 있습니다.' });
      return;
    }
    if (Buffer.byteLength(markdown, 'utf-8') > MAX_MARKDOWN_BYTES) {
      res.status(400).json({
        ok: false,
        error: `원고가 너무 깁니다 (한도 ${MAX_MARKDOWN_BYTES / 1024}KB).`,
      });
      return;
    }

    try {
      const { fillHwpxTemplate } = await import('./shared/hwpxFill.mjs');
      const { callProModel } = await import('./shared/planningCore.mjs');
      const apiKey = GEMINI_API_KEY.value();

      const started = Date.now();
      const { bytes, stats } = await fillHwpxTemplate({
        templateBytes: template.buffer,
        markdown,
        callModel: (sys, user, opts) => callProModel(sys, user, opts, apiKey),
        onStep: (step, detail) => console.log(`[hwpxFill] ${step}`, detail || ''),
      });

      const filename = deriveFilename(markdown, fields.filename);
      console.log(
        `[hwpxFill] 완료 ${((Date.now() - started) / 1000).toFixed(1)}s ` +
          `단락 ${stats.paragraphs}개 중 ${stats.changed}개 교체 → ${filename}`
      );

      res.set('Content-Type', 'application/haansofthwpx');
      res.set('Content-Disposition', contentDisposition(filename));
      // 호출자가 본문을 읽지 않고도 결과를 알 수 있게 통계를 헤더로도 싣는다.
      res.set('X-Hwpx-Paragraphs', String(stats.paragraphs));
      res.set('X-Hwpx-Changed', String(stats.changed));
      res.status(200).send(Buffer.from(bytes));
    } catch (err) {
      console.error('[hwpxFill] 실패:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);


// ─────────────────── 저수준 API: 직접 제어용 ───────────────────

const PAGE_WIDTH = 48000;

/** 단락 하나를 외부에 노출할 형태로 만든다. */
function describeForApi(text, index, paras) {
  const cell = paras.cells?.[index];
  const width = paras.widths?.[index];
  // 표 안의 빈 칸은 '채워야 할 자리'이고, 표 밖의 빈 단락은 '건드리면 안 되는 구조'다.
  // 둘을 같은 empty 로 묶으면 빈 셀을 채울 수 없게 된다.
  const kind = cell ? 'cell' : !text ? 'empty' : 'text';
  return {
    index,
    text,
    kind,
    guide: !!paras.isGuide?.[index],
    ...(width != null && { width }),
    ...(cell && { table: cell.table, row: cell.row, col: cell.col }),
    ...(kind === 'empty' && {
      note: '표 밖의 구조용 단락입니다. apply 할 때 반드시 빈 문자열("")로 두세요.',
    }),
    ...(kind === 'cell' && !text && { note: '비어 있는 표 칸입니다. 여기에 값을 채우면 됩니다.' }),
    ...(paras.isGuide?.[index] && {
      note: '양식 작성자가 쓴 안내문입니다. 안내가 요구하는 내용으로 바꾸세요.',
    }),
  };
}

/** POST /api/hwpx/inspect — 양식의 단락·표 구조를 JSON 으로 반환. */
exports.hwpxInspect = onRequest(
  { secrets: [BLOG_AGENT_API_KEY], timeoutSeconds: 120, memory: '512MiB', cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'POST 만 허용됩니다.' });
      return;
    }
    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'x-api-key 인증에 실패했습니다.' });
      return;
    }

    let parsed;
    try {
      parsed = await parseMultipart(req);
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }

    const file = parsed.files.template || parsed.files.hwpx || parsed.files.file;
    if (!file || file.buffer.length === 0) {
      res.status(400).json({ ok: false, error: '양식 파일(template)이 필요합니다.' });
      return;
    }

    try {
      const { extractParagraphsFromHwpx } = await import('./shared/hwpxText.mjs');
      const paras = await extractParagraphsFromHwpx(file.buffer);
      const paragraphs = Array.from(paras).map((t, i) => describeForApi(t, i, paras));
      const emptyIdx = paragraphs.filter((p) => p.kind === 'empty').map((p) => p.index);
      const emptyCellIdx = paragraphs.filter((p) => p.kind === 'cell' && !p.text).map((p) => p.index);

      res.status(200).json({
        ok: true,
        filename: file.filename || null,
        paragraphCount: paragraphs.length,
        // 호출자가 규칙을 따로 문서에서 찾지 않아도 되도록 응답에 계약을 같이 싣는다.
        contract: {
          exactCount: `apply 의 paragraphs 배열은 정확히 ${paragraphs.length}개여야 합니다. 많아도 적어도 거부됩니다.`,
          keepEmpty:
            emptyIdx.length > 0
              ? `인덱스 [${emptyIdx.join(', ')}] 는 표 밖의 구조용 빈 단락입니다. 빈 문자열로 두세요.`
              : '구조용 빈 단락은 없습니다.',
          fillableCells:
            emptyCellIdx.length > 0
              ? `인덱스 [${emptyCellIdx.join(', ')}] 는 비어 있는 표 칸입니다. 여기에 값을 채우세요.`
              : '비어 있는 표 칸은 없습니다.',
          plainText:
            'HWP 단락은 평문입니다. 마크다운(**, ##, -, |)이나 HTML 태그를 넣으면 글자 그대로 보입니다. 굵기·크기는 양식의 서식이 결정합니다.',
          noNewParagraphs:
            '본문 단락은 늘리거나 줄일 수 없습니다. 항목이 많으면 한 단락 안에서 이어 쓰세요. 표 행이 모자라면 /api/hwpx/expand-rows 로 먼저 늘린 뒤 다시 inspect 하세요.',
        },
        paragraphs,
        tables: paras.tables || [],
        pageWidth: PAGE_WIDTH,
      });
    } catch (err) {
      console.error('[hwpxInspect] 실패:', err.message);
      res.status(500).json({ ok: false, error: `양식을 읽지 못했습니다: ${err.message}` });
    }
  }
);

/** POST /api/hwpx/apply — 호출자가 만든 단락 배열을 그대로 적용. */
exports.hwpxApply = onRequest(
  { secrets: [BLOG_AGENT_API_KEY], timeoutSeconds: 120, memory: '1GiB', cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'POST 만 허용됩니다.' });
      return;
    }
    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'x-api-key 인증에 실패했습니다.' });
      return;
    }

    let parsed;
    try {
      parsed = await parseMultipart(req);
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }

    const { files, fields } = parsed;
    const template = files.template;
    if (!template || template.buffer.length === 0) {
      res.status(400).json({ ok: false, error: '양식 파일(template)이 필요합니다.' });
      return;
    }

    // paragraphs 는 JSON 문자열 필드로도, 파일로도 받는다(긴 배열은 파일이 편하다).
    const rawParagraphs = files.paragraphs
      ? files.paragraphs.buffer.toString('utf-8')
      : String(fields.paragraphs || '');
    if (!rawParagraphs.trim()) {
      res.status(400).json({ ok: false, error: 'paragraphs(JSON 문자열 배열)가 필요합니다.' });
      return;
    }

    let paragraphs;
    try {
      paragraphs = JSON.parse(rawParagraphs);
    } catch (err) {
      res.status(400).json({ ok: false, error: `paragraphs JSON 파싱 실패: ${err.message}` });
      return;
    }
    if (!Array.isArray(paragraphs) || paragraphs.some((v) => typeof v !== 'string')) {
      res.status(400).json({ ok: false, error: 'paragraphs 는 문자열 배열이어야 합니다.' });
      return;
    }

    try {
      const { extractParagraphsFromHwpx, applyParagraphsToHwpx } = await import('./shared/hwpxText.mjs');
      const original = await extractParagraphsFromHwpx(template.buffer);

      // 개수가 어긋나면 고쳐서 다시 보낼 수 있도록 기대값을 알려준다.
      if (paragraphs.length !== original.length) {
        res.status(400).json({
          ok: false,
          error: `단락 개수가 맞지 않습니다. 양식은 ${original.length}개인데 ${paragraphs.length}개를 보냈습니다.`,
          expected: original.length,
          received: paragraphs.length,
        });
        return;
      }

      // 구조용 빈 단락에 글자가 들어오면 되돌린다. 레이아웃이 깨지는 것을 막기 위한 보호이며,
      // allowFillEmpty=true 로 끌 수 있다.
      const allowFillEmpty = String(fields.allowFillEmpty || '').toLowerCase() === 'true';
      const protectedIdx = [];
      // 표 안의 빈 칸은 채우라고 있는 자리이므로 보호 대상이 아니다.
      // 표 밖의 빈 단락(표를 감싸는 컨테이너, 빈 줄)만 되돌린다.
      const isStructuralEmpty = (i) => original[i] === '' && !original.cells?.[i];
      const finalParagraphs = paragraphs.map((v, i) => {
        if (!allowFillEmpty && isStructuralEmpty(i) && v !== '') {
          protectedIdx.push(i);
          return '';
        }
        return v;
      });

      const bytes = await applyParagraphsToHwpx(template.buffer, finalParagraphs);
      const filename = deriveFilename('', fields.filename || template.filename?.replace(/\.hwpx$/i, ''));
      const changed = finalParagraphs.filter((v, i) => v !== original[i]).length;

      if (protectedIdx.length) {
        console.warn(`[hwpxApply] 구조용 빈 단락 ${protectedIdx.length}개 보호: [${protectedIdx.join(', ')}]`);
      }
      console.log(`[hwpxApply] 단락 ${original.length}개 중 ${changed}개 교체 → ${filename}`);

      res.set('Content-Type', 'application/haansofthwpx');
      res.set('Content-Disposition', contentDisposition(filename));
      res.set('X-Hwpx-Paragraphs', String(original.length));
      res.set('X-Hwpx-Changed', String(changed));
      if (protectedIdx.length) res.set('X-Hwpx-Protected-Empty', protectedIdx.join(','));
      res.status(200).send(Buffer.from(bytes));
    } catch (err) {
      console.error('[hwpxApply] 실패:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);


/**
 * POST /api/hwpx/expand-rows — 표 행을 복제해 늘린다.
 *
 * 양식의 데이터 행은 2~3개로 고정인데 채울 항목이 그보다 많을 때 쓴다.
 * 행이 늘면 단락 인덱스가 전부 바뀌므로, 응답을 받은 뒤 inspect 를 다시 호출해
 * 새 구조로 paragraphs 배열을 만들어야 한다.
 */
exports.hwpxExpandRows = onRequest(
  { secrets: [BLOG_AGENT_API_KEY], timeoutSeconds: 120, memory: '1GiB', cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'POST 만 허용됩니다.' });
      return;
    }
    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'x-api-key 인증에 실패했습니다.' });
      return;
    }

    let parsed;
    try {
      parsed = await parseMultipart(req);
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }

    const { files, fields } = parsed;
    const template = files.template;
    if (!template || template.buffer.length === 0) {
      res.status(400).json({ ok: false, error: '양식 파일(template)이 필요합니다.' });
      return;
    }

    const rawExp = files.expansions
      ? files.expansions.buffer.toString('utf-8')
      : String(fields.expansions || '');
    if (!rawExp.trim()) {
      res.status(400).json({
        ok: false,
        error: 'expansions 가 필요합니다. 예: [{"table":0,"row":2,"count":5}]',
      });
      return;
    }

    let expansions;
    try {
      expansions = JSON.parse(rawExp);
    } catch (err) {
      res.status(400).json({ ok: false, error: `expansions JSON 파싱 실패: ${err.message}` });
      return;
    }
    if (!Array.isArray(expansions) || expansions.length === 0) {
      res.status(400).json({ ok: false, error: 'expansions 는 비어 있지 않은 배열이어야 합니다.' });
      return;
    }

    try {
      const { duplicateTableRows, extractParagraphsFromHwpx } = await import('./shared/hwpxText.mjs');
      const before = await extractParagraphsFromHwpx(template.buffer);
      const bytes = await duplicateTableRows(template.buffer, expansions);
      const after = await extractParagraphsFromHwpx(bytes);

      const filename = deriveFilename('', fields.filename || template.filename?.replace(/\.hwpx$/i, ''));
      console.log(
        `[hwpxExpandRows] 단락 ${before.length} → ${after.length}, ` +
          `표 ${JSON.stringify(after.tables.map((t) => t.rows))}`
      );

      res.set('Content-Type', 'application/haansofthwpx');
      res.set('Content-Disposition', contentDisposition(filename));
      res.set('X-Hwpx-Paragraphs-Before', String(before.length));
      res.set('X-Hwpx-Paragraphs', String(after.length));
      res.set('X-Hwpx-Table-Rows', after.tables.map((t) => t.rows).join(','));
      res.status(200).send(Buffer.from(bytes));
    } catch (err) {
      console.error('[hwpxExpandRows] 실패:', err.message);
      res.status(400).json({ ok: false, error: err.message });
    }
  }
);
