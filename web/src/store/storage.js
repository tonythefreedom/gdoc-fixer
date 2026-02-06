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
