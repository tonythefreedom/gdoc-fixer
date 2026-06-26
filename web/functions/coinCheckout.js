const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

// ─── Secrets ────────────────────────────────────────────────
// LEMONSQUEEZY_API_KEY:   https://app.lemonsqueezy.com/settings/api → API key
// LEMONSQUEEZY_STORE_ID:  대시보드 URL 의 store id (예: 12345)
// LEMONSQUEEZY_VARIANTS:  JSON 문자열 — { "500": 111, "1000": 222, "5000": 333, "10000": 444 }
//                         각 패키지에 매칭되는 Lemon Squeezy variant id.
// LEMONSQUEEZY_WEBHOOK_SECRET: Lemon Squeezy webhook 생성 시 입력한 signing secret.
const LEMONSQUEEZY_API_KEY = defineSecret('LEMONSQUEEZY_API_KEY');
const LEMONSQUEEZY_STORE_ID = defineSecret('LEMONSQUEEZY_STORE_ID');
const LEMONSQUEEZY_VARIANTS = defineSecret('LEMONSQUEEZY_VARIANTS');
const LEMONSQUEEZY_WEBHOOK_SECRET = defineSecret('LEMONSQUEEZY_WEBHOOK_SECRET');

// 가격 정책: 100 coin = $1.
const COIN_PACKAGES = {
  500: { coins: 500, amountUsd: 5, label: '500 코인' },
  1000: { coins: 1000, amountUsd: 10, label: '1,000 코인' },
  5000: { coins: 5000, amountUsd: 50, label: '5,000 코인' },
  10000: { coins: 10000, amountUsd: 100, label: '10,000 코인' },
};

const ALLOWED_ORIGINS = [
  'https://gdoc-fixer.web.app',
  'https://gdoc-fixer.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
];

function setCors(req, res) {
  const origin = req.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
}

async function verifyUser(req) {
  const authHeader = req.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Authorization header missing');
  const decoded = await admin.auth().verifyIdToken(match[1]);
  return decoded;
}

function parseVariantMap() {
  try {
    return JSON.parse(LEMONSQUEEZY_VARIANTS.value());
  } catch {
    return {};
  }
}

// ── 1) Checkout 생성 ────────────────────────────────────────
exports.createCoinCheckout = onRequest(
  {
    secrets: [LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANTS],
    cors: false,
  },
  async (req, res) => {
    setCors(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const decoded = await verifyUser(req);
      const uid = decoded.uid;
      const email = decoded.email || '';
      const { packageKey, returnUrl } = req.body || {};
      const pkg = COIN_PACKAGES[String(packageKey)];
      if (!pkg) {
        res.status(400).json({ error: 'Unknown package' });
        return;
      }
      const variantMap = parseVariantMap();
      const variantId = variantMap[String(packageKey)];
      if (!variantId) {
        res.status(500).json({
          error: `Lemon Squeezy variant id for package ${packageKey} not configured`,
        });
        return;
      }
      const safeReturnUrl =
        typeof returnUrl === 'string' && returnUrl.startsWith('https://')
          ? returnUrl
          : 'https://gdoc-fixer.web.app/?view=profile';

      const redirect = `${safeReturnUrl}${safeReturnUrl.includes('?') ? '&' : '?'}charge=success&coins=${pkg.coins}`;

      const lsRes = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          Authorization: `Bearer ${LEMONSQUEEZY_API_KEY.value()}`,
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              checkout_data: {
                email: email || undefined,
                custom: {
                  uid,
                  coins: String(pkg.coins),
                  packageKey: String(packageKey),
                },
              },
              product_options: {
                name: `GDoc Fixer ${pkg.label}`,
                description: `${pkg.coins.toLocaleString()} 코인 충전`,
                redirect_url: redirect,
                receipt_thank_you_note: '결제가 완료되었습니다. 코인이 곧 반영됩니다.',
                enabled_variants: [Number(variantId)],
              },
              checkout_options: {
                embed: false,
                dark: false,
              },
            },
            relationships: {
              store: { data: { type: 'stores', id: String(LEMONSQUEEZY_STORE_ID.value()) } },
              variant: { data: { type: 'variants', id: String(variantId) } },
            },
          },
        }),
      });

      if (!lsRes.ok) {
        const text = await lsRes.text();
        console.error('Lemon Squeezy checkout create failed:', lsRes.status, text);
        res.status(500).json({ error: `Checkout create failed (${lsRes.status})` });
        return;
      }
      const json = await lsRes.json();
      const url = json?.data?.attributes?.url;
      if (!url) {
        res.status(500).json({ error: 'Lemon Squeezy response missing url' });
        return;
      }
      res.status(200).json({ url, id: json?.data?.id });
    } catch (err) {
      console.error('createCoinCheckout error:', err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
);

// ── 2) Webhook — order_created 시 코인 지급 ──────────────────
exports.lemonsqueezyWebhook = onRequest(
  {
    secrets: [LEMONSQUEEZY_WEBHOOK_SECRET],
    cors: false,
  },
  async (req, res) => {
    const signature = req.get('X-Signature') || '';
    const secret = LEMONSQUEEZY_WEBHOOK_SECRET.value();
    // 서명 검증 — HMAC SHA256 of raw body
    const computed = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex');
    if (
      !signature ||
      !crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computed, 'hex'))
    ) {
      console.error('Webhook signature mismatch');
      res.status(401).send('invalid signature');
      return;
    }

    let event;
    try {
      event = JSON.parse(req.rawBody.toString('utf8'));
    } catch (e) {
      res.status(400).send('bad json');
      return;
    }

    const eventName = event?.meta?.event_name;
    if (eventName !== 'order_created') {
      // 다른 이벤트는 무시 (refund 등은 v2 에서 처리)
      res.status(200).send('ignored');
      return;
    }

    const custom = event?.meta?.custom_data || {};
    const uid = custom.uid;
    const coins = parseInt(custom.coins || '0', 10);
    const orderId = String(event?.data?.id || '');
    if (!uid || !coins || !orderId) {
      console.warn('webhook missing fields:', { uid, coins, orderId });
      res.status(200).send('OK (no metadata)');
      return;
    }

    try {
      const db = admin.firestore();
      const markerRef = db.collection('coinChargeProcessed').doc(orderId);
      const profileRef = db.collection('userProfiles').doc(uid);
      const historyRef = db
        .collection('userProfiles').doc(uid)
        .collection('coinCharges').doc(orderId);

      await db.runTransaction(async (tx) => {
        const markerSnap = await tx.get(markerRef);
        if (markerSnap.exists) return; // 멱등성

        const attrs = event?.data?.attributes || {};
        tx.set(markerRef, {
          uid, coins, orderId,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(profileRef, {
          coinBalance: admin.firestore.FieldValue.increment(coins),
          coinEarned: admin.firestore.FieldValue.increment(coins),
          lastChargedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(historyRef, {
          coins,
          totalUsdCents: attrs.total ?? null,
          currency: attrs.currency || 'usd',
          provider: 'lemonsqueezy',
          providerOrderId: orderId,
          customerEmail: attrs.user_email || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      console.log(`[ls webhook] +${coins} coins to ${uid} via order ${orderId}`);
      res.status(200).send('OK');
    } catch (err) {
      console.error('webhook firestore update failed:', err);
      res.status(500).send('Firestore error');
    }
  }
);

exports.COIN_PACKAGES = COIN_PACKAGES;
