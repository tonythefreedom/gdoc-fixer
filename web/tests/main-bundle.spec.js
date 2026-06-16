import { test, expect } from '@playwright/test';

/**
 * main bundle 초기화 시점의 런타임 에러(TDZ 등) 검출.
 * 루트(/) 로 접근하면 LoginPage 가 표시되어야 한다 (인증 안 됐을 때).
 * 콘솔에 pageerror 또는 console.error 가 찍히면 FAIL.
 */
test('루트(/) 로딩 시 main bundle 에 런타임 에러가 없다', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
    console.log('[pageerror]', err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Firebase / Google 의 알려진 무해한 경고는 제외
      if (text.includes('Cross-Origin-Opener-Policy')) return;
      errors.push(`console.error: ${text}`);
      console.log('[console.error]', text);
    }
  });

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const body = await page.locator('body').innerText();
  console.log('[body text preview]', body.slice(0, 300));

  expect(errors, `런타임 에러:\n${errors.join('\n')}`).toHaveLength(0);
});
