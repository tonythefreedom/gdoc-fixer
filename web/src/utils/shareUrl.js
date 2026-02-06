import { doc, setDoc, getDoc, deleteDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

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
  await setDoc(doc(db, COLLECTION, id), {
    html,
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
