import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export async function publishToTechBlog({ html, name }) {
  const callable = httpsCallable(functions, 'publishToTechBlog', {
    timeout: 1200000,
  });
  const result = await callable({ html, name });
  return result.data;
}

// 한국인공지능개발자 협동조합 커뮤니티 게시판에 게시
export async function publishToCommunity({ html, name, sourceUrl, tags }) {
  const callable = httpsCallable(functions, 'publishToCommunity', {
    timeout: 120000,
  });
  const result = await callable({ html, name, sourceUrl, tags });
  return result.data;
}

// LinkedIn(조직 페이지)에 연쇄 게시 — 미설정 시 { skipped: true } 반환
export async function publishToLinkedIn({ title, url }) {
  const callable = httpsCallable(functions, 'publishToLinkedIn', {
    timeout: 60000,
  });
  const result = await callable({ title, url });
  return result.data;
}
