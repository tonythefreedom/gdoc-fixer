import { test, expect } from '@playwright/test';

/**
 * 사이드바 / 컨텐츠 페이지에서 프리젠테이션을 열면 SlideEditor 가 정상적으로
 * 렌더링되는지 검증. 로그인 + 클릭을 같은 컨텍스트에서 진행 (Firebase 세션이
 * indexedDB 에 저장되어 storageState 만으로는 재사용이 어려움).
 */
test('로그인 → 사이드바 프리젠테이션 클릭 → SlideEditor 렌더링', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}\n${err.stack || ''}`);
    console.log('\n=== PAGE ERROR ===\n', err.message);
    console.log(err.stack || '');
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('Cross-Origin-Opener-Policy')) return;
      errors.push(`console.error: ${text}`);
      console.log('[console.error]', text);
    }
  });

  await page.goto('/', { waitUntil: 'load' });

  console.log('\n========================================');
  console.log('  👉 브라우저에서 Google 로그인 진행 (최대 4분 대기)');
  console.log('========================================\n');

  // 로그인 완료 신호: 사이드바의 Presentations 헤더 등장
  await page.getByText(/Presentations \(/i).first().waitFor({ timeout: 240_000 });
  console.log('[로그인 OK] 사이드바 Presentations 발견.');

  await page.waitForTimeout(1500);

  // 시나리오 A — 컨텐츠 페이지에서 사이드바의 프리젠테이션 클릭 → SlideEditor 진입
  // (가장 흔한 진입 경로. 직전 버그: setCurrentView('editor') 누락으로 컨텐츠 페이지가 유지됐었음)
  await page.getByRole('button', { name: '컨텐츠' }).click();
  await page.waitForTimeout(500);
  console.log('[컨텐츠 페이지 진입]');

  const firstPres = page
    .locator('div.cursor-pointer')
    .filter({ has: page.locator('svg.lucide-presentation') })
    .first();

  const count = await firstPres.count();
  if (count === 0) {
    console.log('[프리젠테이션 없음] 스킵.');
    expect(errors, `에러:\n${errors.join('\n')}`).toHaveLength(0);
    return;
  }

  console.log('[클릭] 사이드바 첫 프리젠테이션');
  await firstPres.click({ timeout: 5000 });

  // SlideEditor 진입 신호: "슬라이드쇼" 버튼
  await expect(page.getByRole('button', { name: /슬라이드쇼/ })).toBeVisible({
    timeout: 20_000,
  });
  console.log('[✓] SlideEditor 진입 성공');

  await page.waitForTimeout(2000);

  // 시나리오 B — SlideEditor 안에서 "공유 링크" 버튼 클릭 → 모달에 URL 표시
  console.log('[클릭] 공유 링크 버튼');
  await page.getByRole('button', { name: /공유 링크/ }).click();
  await page.waitForTimeout(500);

  // 모달이 떴음
  await expect(page.getByText(/프리젠테이션 공유 링크/)).toBeVisible({ timeout: 10_000 });

  // URL 생성 대기 (이미지 업로드 → Firestore 저장)
  await expect(page.getByText(/URL 복사/)).toBeVisible({ timeout: 60_000 });

  // 생성된 URL 추출
  const urlText = await page.locator('.font-mono').first().innerText();
  console.log('[생성된 share URL]', urlText);
  expect(urlText).toMatch(/\/p\/[A-Za-z0-9]{8}$/);

  // 시나리오 C — 새 페이지(=새 컨텍스트) 에서 공유 URL 접근 → PresentationShareView 렌더링
  const ctx2 = await page.context().browser().newContext();
  const page2 = await ctx2.newPage();
  const errors2 = [];
  page2.on('pageerror', (err) => {
    errors2.push(`page2 pageerror: ${err.message}`);
    console.log('[page2 pageerror]', err.message);
  });
  page2.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('Cross-Origin-Opener-Policy')) return;
      errors2.push(`page2 console.error: ${text}`);
      console.log('[page2 console.error]', text);
    }
  });
  await page2.goto(urlText, { waitUntil: 'load' });
  await page2.waitForTimeout(4000);
  // 슬라이드 카운트 형식 "1 / N" 이 보이면 성공
  const counterVisible = await page2.locator('text=/1 \\/ \\d+/').first().isVisible().catch(() => false);
  console.log('[공유 페이지 슬라이드 카운터 가시성]', counterVisible);

  await ctx2.close();

  expect(errors, `로그인 페이지 런타임 에러:\n${errors.join('\n\n')}`).toHaveLength(0);
  expect(errors2, `공유 페이지 런타임 에러:\n${errors2.join('\n\n')}`).toHaveLength(0);
  expect(counterVisible).toBe(true);
});
