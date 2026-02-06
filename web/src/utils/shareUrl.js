import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const SHARE_PREFIX = '#/share/';
const COLLECTION = 'shared';

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export async function generateShareUrl(html) {
  const id = generateId();
  await setDoc(doc(db, COLLECTION, id), {
    html,
    createdAt: Date.now(),
  });
  const base = window.location.origin + window.location.pathname;
  return `${base}${SHARE_PREFIX}${id}`;
}

export async function fetchSharedHtml(id) {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return snap.data().html;
}

export function parseShareId() {
  const hash = window.location.hash;
  if (!hash.startsWith(SHARE_PREFIX)) return null;
  return hash.slice(SHARE_PREFIX.length) || null;
}

export function isShareUrl() {
  return window.location.hash.startsWith(SHARE_PREFIX);
}
