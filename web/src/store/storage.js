import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';

function filesCol(uid) {
  return collection(db, 'users', uid, 'files');
}

function fileDoc(uid, fileId) {
  return doc(db, 'users', uid, 'files', fileId);
}

// Firestore operations

export async function loadFileList(uid) {
  const q = query(filesCol(uid), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createFileDoc(uid, file, content) {
  await setDoc(fileDoc(uid, file.id), {
    name: file.name,
    content,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  });
}

export async function loadFileContent(uid, fileId) {
  const snap = await getDoc(fileDoc(uid, fileId));
  return snap.exists() ? snap.data().content || '' : '';
}

export async function updateFileContentDoc(uid, fileId, content) {
  await updateDoc(fileDoc(uid, fileId), { content, updatedAt: Date.now() });
}

export async function deleteFileDoc(uid, fileId) {
  await deleteDoc(fileDoc(uid, fileId));
}

export async function renameFileDoc(uid, fileId, newName) {
  await updateDoc(fileDoc(uid, fileId), { name: newName, updatedAt: Date.now() });
}

// ─── GCS image upload via service account JWT ───

const GCS_BUCKET = import.meta.env.VITE_GCS_BUCKET;
const GCS_SA_EMAIL = import.meta.env.VITE_GCS_SA_EMAIL;
const GCS_PRIVATE_KEY = (import.meta.env.VITE_GCS_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function base64url(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function importPrivateKey(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', binary, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

let _cachedToken = null;
let _tokenExpiry = 0;

async function getGcsAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: GCS_SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(GCS_PRIVATE_KEY);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });

  if (!res.ok) throw new Error(`GCS token exchange failed: ${res.status}`);
  const data = await res.json();
  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _cachedToken;
}

async function uploadBlobToGcs(path, blob) {
  const token = await getGcsAccessToken();
  const res = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': blob.type },
      body: blob,
    }
  );
  if (!res.ok) throw new Error(`GCS upload failed: ${res.status}`);
  return `https://storage.googleapis.com/${GCS_BUCKET}/${path}`;
}

function dataUriToBlob(dataUri) {
  const [header, b64] = dataUri.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function uploadSlideImages(uid, presId, slideIndex, html) {
  const dataUriRegex = /data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g;
  const matches = [...new Set(html.match(dataUriRegex) || [])];

  if (matches.length === 0) return html;

  let result = html;
  const uploads = matches.map(async (dataUri, i) => {
    const blob = dataUriToBlob(dataUri);
    const ext = blob.type.split('/')[1].replace('+xml', '');
    const path = `wiki-images/slides/${uid}/${presId}/s${slideIndex}_${i}_${Date.now()}.${ext}`;
    const url = await uploadBlobToGcs(path, blob);
    result = result.replaceAll(dataUri, url);
  });

  await Promise.all(uploads);
  return result;
}

// Presentation Firestore operations

function presCol(uid) {
  return collection(db, 'users', uid, 'presentations');
}

function presDoc(uid, presId) {
  return doc(db, 'users', uid, 'presentations', presId);
}

// Firestore does not support nested arrays, so we serialize each slide's
// history array as a JSON string: slideHistories = ["[...]", "[...]", ...]
function serializeHistories(histories) {
  return (histories || []).map((h) => JSON.stringify(h));
}

function deserializeHistories(raw) {
  return (raw || []).map((s) => {
    try { return JSON.parse(s); } catch { return []; }
  });
}

export async function loadPresentationList(uid) {
  const q = query(presCol(uid), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, slideHistories: deserializeHistories(data.slideHistories) };
  });
}

export async function createPresentationDoc(uid, pres) {
  await setDoc(presDoc(uid, pres.id), {
    name: pres.name,
    sourceFileId: pres.sourceFileId,
    slides: pres.slides,
    slideHistories: serializeHistories(pres.slideHistories),
    createdAt: pres.createdAt,
    updatedAt: pres.updatedAt,
  });
}

export async function updatePresentationSlides(uid, presId, slides, slideHistories) {
  const data = { slides, updatedAt: Date.now() };
  if (slideHistories) data.slideHistories = serializeHistories(slideHistories);
  await updateDoc(presDoc(uid, presId), data);
}

export async function deletePresentationDoc(uid, presId) {
  await deleteDoc(presDoc(uid, presId));
}

export async function renamePresentationDoc(uid, presId, newName) {
  await updateDoc(presDoc(uid, presId), { name: newName, updatedAt: Date.now() });
}

// localStorage helpers for migration

const FILES_KEY = 'gdoc-fixer-files';
const FILE_CONTENT_PREFIX = 'gdoc-fixer-file-';

export function loadLocalFiles() {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadLocalContent(fileId) {
  return localStorage.getItem(FILE_CONTENT_PREFIX + fileId) || '';
}

export function clearLocalStorage() {
  const localFiles = loadLocalFiles();
  localFiles.forEach((f) => localStorage.removeItem(FILE_CONTENT_PREFIX + f.id));
  localStorage.removeItem(FILES_KEY);
}
