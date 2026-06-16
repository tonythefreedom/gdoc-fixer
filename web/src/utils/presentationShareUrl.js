import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { uploadDocumentImages } from '../store/storage';

const SHARE_PATH = '/p/';
const COLLECTION = 'presentations-shared';

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * 슬라이드 HTML 안의 base64 이미지를 GCS 로 사전 업로드해 URL 로 치환.
 * Firestore 1 MiB 한도를 피하기 위함. uid 없으면 원본 유지.
 */
async function offloadImages(slides, uid) {
  if (!uid) return slides;
  return Promise.all(
    slides.map(async (s) => {
      try {
        return await uploadDocumentImages(uid, s);
      } catch (err) {
        console.warn('슬라이드 이미지 업로드 실패, 원본 사용:', err.message);
        return s;
      }
    })
  );
}

export async function generatePresentationShareUrl(slides, uid, name) {
  const id = generateId();
  const processed = await offloadImages(slides, uid);

  await setDoc(doc(db, COLLECTION, id), {
    slides: processed,
    name: name || '',
    createdAt: Date.now(),
    uid,
  });
  return `${window.location.origin}${SHARE_PATH}${id}`;
}

export async function fetchSharedPresentation(id) {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function loadUserPresentationShares(uid) {
  const q = query(
    collection(db, COLLECTION),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    // slides 는 목록 표시에서 불필요 — 크기 절약을 위해 제거
    const { slides, ...rest } = d.data();
    return { id: d.id, slideCount: Array.isArray(slides) ? slides.length : 0, ...rest };
  });
}

export async function deletePresentationShare(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export function getPresentationShareUrl(id) {
  return `${window.location.origin}${SHARE_PATH}${id}`;
}

export function parsePresentationShareId() {
  const path = window.location.pathname;
  if (path.startsWith(SHARE_PATH)) return path.slice(SHARE_PATH.length) || null;
  return null;
}

export function isPresentationShareUrl() {
  return window.location.pathname.startsWith(SHARE_PATH);
}
