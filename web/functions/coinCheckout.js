const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Lemon Squeezy Share URL 방식: ProfilePage 가 직접 LS 결제 페이지로 redirect 하고
// uid/coins 는 checkout[custom][*] query 로 주입 → 결제 완료 시 LS 가
// order_created webhook 으로 우리에게 알림 → 이 함수가 코인 충전.
const LEMONSQUEEZY_WEBHOOK_SECRET = defineSecret('LEMONSQUEEZY_WEBHOOK_SECRET');

exports.lemonsqueezyWebhook = onRequest(
  {
    secrets: [LEMONSQUEEZY_WEBHOOK_SECRET],
    cors: false,
  },
  async (req, res) => {
    const signature = req.get('X-Signature') || '';
    const secret = LEMONSQUEEZY_WEBHOOK_SECRET.value();
    // HMAC SHA256 서명 검증
    const computed = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex');
    if (
      !signature ||
      signature.length !== computed.length ||
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
