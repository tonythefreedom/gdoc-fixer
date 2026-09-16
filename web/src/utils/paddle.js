/**
 * Paddle 오버레이 체크아웃.
 *
 * Paddle.js 를 필요할 때 한 번만 불러와 초기화하고, 결제창을 연다.
 * customData 로 uid/coins 를 넘기면 결제 완료 후 webhook(transaction.completed)의
 * data.custom_data 로 그대로 도착해 서버가 코인을 충전한다.
 *
 * 이전 방식(결제 URL 쿼리 파라미터)은 share URL 에서 값이 유실돼 결제는 되고 코인은
 * 안 들어가는 일이 있었다. 오버레이는 JS 객체로 넘기므로 그 경로가 사라진다.
 */
const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';

const ENV = import.meta.env.VITE_PADDLE_ENV || 'sandbox';
const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

let loading = null;

function loadScript() {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = PADDLE_JS;
    el.async = true;
    el.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error('Paddle.js 로드 실패')));
    el.onerror = () => reject(new Error('Paddle.js 를 불러오지 못했습니다.'));
    document.head.appendChild(el);
  });
  return loading;
}

/** Paddle.js 를 준비한다. 토큰이 없으면 명확한 오류를 던진다. */
export async function initPaddle() {
  if (!CLIENT_TOKEN) {
    throw new Error('VITE_PADDLE_CLIENT_TOKEN 이 설정되지 않았습니다.');
  }
  const Paddle = await loadScript();
  if (Paddle.__gdocInitialized) return Paddle;
  // sandbox 는 명시적으로 지정해야 한다. production 은 기본값이라 호출하지 않는다.
  if (ENV === 'sandbox') Paddle.Environment.set('sandbox');
  Paddle.Initialize({ token: CLIENT_TOKEN });
  Paddle.__gdocInitialized = true;
  return Paddle;
}

/**
 * 코인 패키지 결제창을 연다.
 * @param {{priceId: string, coins: number, key: string|number}} pkg
 * @param {{uid: string, email?: string}} user
 * @param {() => void} [onClose] 결제창이 닫힐 때(성공·취소 모두)
 */
export async function openCoinCheckout(pkg, user, onClose) {
  if (!pkg.priceId) {
    throw new Error(`${pkg.label || pkg.key} 패키지의 Price ID 가 없습니다.`);
  }
  const Paddle = await initPaddle();
  Paddle.Checkout.open({
    items: [{ priceId: pkg.priceId, quantity: 1 }],
    customer: user.email ? { email: user.email } : undefined,
    // 서버가 누구에게 몇 코인을 줄지 판단하는 유일한 근거다.
    customData: {
      uid: user.uid,
      coins: String(pkg.coins),
      packageKey: String(pkg.key),
    },
    settings: {
      displayMode: 'overlay',
      theme: 'dark',
      locale: 'ko',
      // 결제 후 페이지 이동 없이 오버레이 안에서 완료 표시
      successUrl: undefined,
    },
    eventCallback: (ev) => {
      if (ev?.name === 'checkout.closed' || ev?.name === 'checkout.completed') {
        onClose?.(ev.name);
      }
    },
  });
}
