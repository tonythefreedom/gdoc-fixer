import { doc, setDoc, getDoc, deleteDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadDocumentImages } from '../store/storage';

const SHARE_PATH = '/share/';
const SHARE_HASH = '#/share/'; // backward compat for old URLs
const COLLECTION = 'shared';

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export async function generateShareUrl(html, uid, name) {
  const id = generateId();
  // base64 이미지를 GCS에 업로드하여 URL로 교체 (Firestore 1MB 제한 우회)
  let processedHtml = html;
  if (uid) {
    try {
      processedHtml = await uploadDocumentImages(uid, html);
    } catch (err) {
      console.warn('공유 이미지 업로드 실패, 원본 사용:', err.message);
    }
  }
  await setDoc(doc(db, COLLECTION, id), {
    html: processedHtml,
    createdAt: Date.now(),
    uid,
    name,
  });
  return `${window.location.origin}${SHARE_PATH}${id}`;
}

export async function fetchSharedHtml(id) {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return snap.data().html;
}

export async function loadUserShares(uid) {
  const q = query(
    collection(db, COLLECTION),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const { html, ...rest } = d.data();
    return { id: d.id, ...rest };
  });
}

export async function deleteShare(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export function getShareUrl(id) {
  return `${window.location.origin}${SHARE_PATH}${id}`;
}

export function parseShareId() {
  // New path-based format: /share/ID
  const path = window.location.pathname;
  if (path.startsWith(SHARE_PATH)) return path.slice(SHARE_PATH.length) || null;
  // Backward compat: #/share/ID
  const hash = window.location.hash;
  if (hash.startsWith(SHARE_HASH)) return hash.slice(SHARE_HASH.length) || null;
  return null;
}

export function isShareUrl() {
  return window.location.pathname.startsWith(SHARE_PATH) || window.location.hash.startsWith(SHARE_HASH);
}
