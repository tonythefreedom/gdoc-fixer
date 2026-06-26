const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// 가격 정책: 100 coin = 1 USD. 패키지를 1 곳에서만 정의.
// USD 는 cents 단위 정수 (Stripe 요구사항).
const COIN_PACKAGES = {
  500: { coins: 500, amountCents: 500, label: '500 코인' }, // $5
  1000: { coins: 1000, amountCents: 1000, label: '1,000 코인' }, // $10
  5000: { coins: 5000, amountCents: 5000, label: '5,000 코인' }, // $50
  10000: { coins: 10000, amountCents: 10000, label: '10,000 코인' }, // $100
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

// ── 1) Checkout Session 생성 ─────────────────────────────────
exports.createCoinCheckout = onRequest(
  {
    secrets: [STRIPE_SECRET_KEY],
    cors: false, // 직접 처리 (Authorization 헤더 + custom origin 허용 위해)
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
      const email = decoded.email || null;
      const { packageKey, returnUrl } = req.body || {};
      const pkg = COIN_PACKAGES[String(packageKey)];
      if (!pkg) {
        res.status(400).json({ error: 'Unknown package' });
        return;
      }
      const safeReturnUrl =
        typeof returnUrl === 'string' && returnUrl.startsWith('https://')
          ? returnUrl
          : 'https://gdoc-fixer.web.app/?view=profile';

      const stripe = new Stripe(STRIPE_SECRET_KEY.value());
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: email || undefined,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `GDoc Fixer ${pkg.label}`,
                description: `${pkg.coins.toLocaleString()} 코인 충전`,
              },
              unit_amount: pkg.amountCents,
            },
            quantity: 1,
          },
        ],
        // webhook 에서 코인 지급 시 사용
        metadata: {
          uid,
          coins: String(pkg.coins),
          packageKey: String(packageKey),
        },
        success_url: `${safeReturnUrl}${safeReturnUrl.includes('?') ? '&' : '?'}charge=success&coins=${pkg.coins}`,
        cancel_url: `${safeReturnUrl}${safeReturnUrl.includes('?') ? '&' : '?'}charge=cancel`,
      });

      res.status(200).json({ url: session.url, id: session.id });
    } catch (err) {
      console.error('createCoinCheckout error:', err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
);

// ── 2) Stripe Webhook — 결제 완료 시 코인 지급 ────────────────
exports.stripeWebhook = onRequest(
  {
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
    cors: false,
  },
  async (req, res) => {
    const sig = req.get('stripe-signature');
    if (!sig) {
      res.status(400).send('Missing stripe-signature header');
      return;
    }
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    let event;
    try {
      // Stripe 서명 검증 — rawBody 필수
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid = session.metadata?.uid;
      const coins = parseInt(session.metadata?.coins || '0', 10);
      const sessionId = session.id;
      if (!uid || !coins) {
        console.warn('webhook missing metadata:', session.metadata);
        res.status(200).send('OK (no metadata)');
        return;
      }
      try {
        const db = admin.firestore();
        // 멱등성: 같은 session.id 가 두 번 처리되지 않도록 트랜잭션 + 마커 doc
        const markerRef = db.collection('coinChargeProcessed').doc(sessionId);
        const profileRef = db.collection('userProfiles').doc(uid);
        const historyRef = db
          .collection('userProfiles').doc(uid)
          .collection('coinCharges').doc(sessionId);

        await db.runTransaction(async (tx) => {
          const markerSnap = await tx.get(markerRef);
          if (markerSnap.exists) {
            return; // 이미 처리됨
          }
          tx.set(markerRef, {
            uid, coins, sessionId,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          tx.update(profileRef, {
            coinBalance: admin.firestore.FieldValue.increment(coins),
            coinEarned: admin.firestore.FieldValue.increment(coins),
            lastChargedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          tx.set(historyRef, {
            coins,
            amountCents: session.amount_total || null,
            currency: session.currency || 'usd',
            stripeSessionId: sessionId,
            stripePaymentIntent: session.payment_intent || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        console.log(`[webhook] +${coins} coins to ${uid} via ${sessionId}`);
      } catch (err) {
        console.error('webhook firestore update failed:', err);
        res.status(500).send('Firestore error');
        return;
      }
    }

    res.status(200).send('OK');
  }
);

exports.COIN_PACKAGES = COIN_PACKAGES;
