import { test, expect } from '@playwright/test';

/**
 * 공유 프리젠테이션 뷰어 (/p/:id) 인증 없이 렌더링 자체가 되는지 검증.
 * - 잘못된 ID 로 접근해도 PresentationShareView 가 mount 되어 "찾을 수 없습니다"
 *   안내가 나오면 OK.
 * - JS 런타임 에러(TDZ 등) 가 콘솔에 나오면 FAIL.
 */
test.describe('PresentationShareView (/p/:id)', () => {
  test('잘못된 ID 로 접근 시 안내 페이지가 정상 렌더링된다', async ({ page }) => {
    const errors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => {
      errors.push(err.message);
      console.log('[pageerror]', err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('[console.error]', msg.text());
      }
    });

    await page.goto('/p/INVALIDXX', { waitUntil: 'load' });

    // 렌더링 / Firestore 조회 끝까지 대기
    await page.waitForTimeout(3000);

    // 페이지 자체가 멈추거나 흰 화면이 아니라 안내 문구 / 또는 슬라이드뷰 컨테이너 표시
    const body = await page.locator('body').innerText();
    console.log('[body text preview]', body.slice(0, 200));

    // TDZ 등 런타임 에러 없어야 함
    expect(errors, `pageerror: ${errors.join('\n')}`).toHaveLength(0);

    // "찾을 수 없습니다" 메시지가 등장하거나, 슬라이드뷰 컨테이너(검정 배경)가 등장
    // 둘 중 하나는 반드시 나와야 PresentationShareView 가 렌더링된 것
    const notFoundVisible = await page
      .getByText('공유된 프리젠테이션을 찾을 수 없습니다.')
      .isVisible()
      .catch(() => false);

    expect(notFoundVisible).toBe(true);
  });
});
