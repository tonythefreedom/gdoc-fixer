/**
 * Paddle 결제 webhook — 결제 완료 시 코인을 충전한다.
 *
 * 흐름:
 *   프론트에서 Paddle.js 오버레이로 결제 (customData 에 uid/coins 를 실어 보냄)
 *     → Paddle 이 transaction.completed 이벤트를 이 엔드포인트로 POST
 *     → 서명 검증 후 해당 사용자에게 코인 지급
 *
 * 이전 LemonSqueezy 방식은 결제 URL 의 쿼리 파라미터로 uid 를 실어 보냈는데,
 * share URL 에서는 그 값이 유실돼 결제는 되고 코인은 안 들어가는 일이 있었다.
 * Paddle 오버레이는 customData 를 JS 객체로 넘기므로 그 경로가 구조적으로 사라진다.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

const PADDLE_WEBHOOK_SECRET = defineSecret('PADDLE_WEBHOOK_SECRET');

// 재전송 공격 방지 — 서명 시각이 이보다 오래되면 거부한다.
const MAX_SIGNATURE_AGE_SEC = 5 * 60;

/**
 * Paddle-Signature 헤더를 검증한다.
 * 형식: `ts=1671552777;h1=eb4d0dc8853be92b...`
 * 서명 대상은 `${ts}:${rawBody}` 이고 알고리즘은 HMAC-SHA256.
 */
function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return { ok: false, reason: '서명 헤더 없음' };

  const parts = Object.fromEntries(
    signatureHeader.split(';').map((kv) => {
      const i = kv.indexOf('=');
      return i === -1 ? [kv, ''] : [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    })
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return { ok: false, reason: 'ts/h1 파싱 실패' };

  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(ts, 10));
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SEC) {
    return { ok: false, reason: `서명 시각이 너무 오래됨 (${age}s)` };
  }

  const computed = crypto
    .createHmac('sha256', secret)
    .update(`${ts}:${rawBody}`)
    .digest('hex');

  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(h1, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: '서명 불일치' };
  }
  return { ok: true };
}

/** custom_data 는 문자열로 올 수도 객체로 올 수도 있다. */
function readCustomData(data) {
  const raw = data?.custom_data;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

exports.paddleWebhook = onRequest(
  {
    secrets: [PADDLE_WEBHOOK_SECRET],
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('POST only');
      return;
    }

    const secret = PADDLE_WEBHOOK_SECRET.value();
    if (!secret || secret === 'UNSET') {
      console.error('[paddle] PADDLE_WEBHOOK_SECRET 미설정');
      res.status(500).send('not configured');
      return;
    }

    // 서명은 원본 바이트 그대로에 대해 계산된다. 파싱된 req.body 로는 검증할 수 없다.
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    const verdict = verifySignature(rawBody, req.get('Paddle-Signature'), secret);
    if (!verdict.ok) {
      console.error(`[paddle] 서명 검증 실패: ${verdict.reason}`);
      res.status(401).send('invalid signature');
      return;
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      res.status(400).send('bad json');
      return;
    }

    const eventType = event?.event_type;
    if (eventType !== 'transaction.completed') {
      // 구독하지 않은 이벤트가 와도 재전송되지 않도록 200 으로 받는다.
      res.status(200).send('ignored');
      return;
    }

    const data = event?.data || {};
    const custom = readCustomData(data);
    const uid = custom.uid;
    const coins = parseInt(custom.coins || '0', 10);
    const txId = String(data.id || '');

    if (!uid || !coins || !txId) {
      // 여기서 500 을 주면 Paddle 이 계속 재시도한다. 데이터가 없는 건 재시도해도 같다.
      console.warn('[paddle] 필수 값 누락:', { uid, coins, txId });
      res.status(200).send('OK (no metadata)');
      return;
    }

    try {
      const db = admin.firestore();
      const markerRef = db.collection('coinChargeProcessed').doc(txId);
      const profileRef = db.collection('userProfiles').doc(uid);
      const historyRef = db
        .collection('userProfiles').doc(uid)
        .collection('coinCharges').doc(txId);

      const totals = data?.details?.totals || {};
      const customerEmail = data?.customer?.email || data?.billing_details?.email || null;

      await db.runTransaction(async (tx) => {
        const markerSnap = await tx.get(markerRef);
        if (markerSnap.exists) return; // 멱등성 — 같은 트랜잭션은 한 번만 충전

        tx.set(markerRef, {
          uid, coins, orderId: txId,
          provider: 'paddle',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(profileRef, {
          coinBalance: admin.firestore.FieldValue.increment(coins),
          coinEarned: admin.firestore.FieldValue.increment(coins),
          lastChargedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(historyRef, {
          coins,
          totalUsdCents: totals.total ? parseInt(totals.total, 10) : null,
          currency: (totals.currency_code || 'USD').toLowerCase(),
          provider: 'paddle',
          providerOrderId: txId,
          customerEmail,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      console.log(`[paddle] +${coins} coins to ${uid} via ${txId}`);
      res.status(200).send('OK');
    } catch (err) {
      // Firestore 실패는 일시적일 수 있으므로 500 으로 답해 Paddle 의 재시도를 받는다.
      console.error('[paddle] firestore 충전 실패:', err);
      res.status(500).send('Firestore error');
    }
  }
);
