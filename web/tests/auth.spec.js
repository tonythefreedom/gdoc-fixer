import { test } from '@playwright/test';
import fs from 'node:fs';

/**
 * 사용자가 직접 Google 로그인. 완료되면 storageState 를 storage-state.json 에 저장.
 * 이후 spec 들은 이 state 를 재사용해 자동 인증된다.
 *
 * 실행:
 *   npx playwright test tests/auth.setup.js --headed
 */
test('Google 수동 로그인 + storageState 저장', async ({ page, context }) => {
  await page.goto('/');

  console.log('\n========================================');
  console.log('  👉 브라우저에서 Google 로그인을 진행하세요.');
  console.log('  로그인 후 메인 화면(사이드바 Presentations 섹션) 이 뜨면');
  console.log('  storageState 가 자동 저장됩니다. 최대 5분 대기.');
  console.log('========================================\n');

  await page
    .getByText(/Presentations \(/i)
    .first()
    .waitFor({ timeout: 280_000 });

  // 약간의 안정화 시간
  await page.waitForTimeout(2000);
  await context.storageState({ path: 'storage-state.json' });
  console.log('[✓] storage-state.json 저장됨');
  if (!fs.existsSync('storage-state.json')) {
    throw new Error('storage-state.json 저장 실패');
  }
});
