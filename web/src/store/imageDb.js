import { createStore, set, get, del, keys } from 'idb-keyval';

const imageStore = createStore('gdoc-fixer-images', 'png-blobs');

export async function saveImage(fileId, imageId, blob, metadata) {
  await set(`images/${fileId}/${imageId}`, { blob, ...metadata }, imageStore);
}

export async function getImage(key) {
  return get(key, imageStore);
}

export async function getImagesForFile(fileId) {
  const allKeys = await keys(imageStore);
  const fileKeys = allKeys
    .filter((k) => k.startsWith(`images/${fileId}/`))
    .sort();
  return Promise.all(
    fileKeys.map(async (k) => {
      const data = await get(k, imageStore);
      return { key: k, ...data };
    })
  );
}

export async function deleteImage(key) {
  await del(key, imageStore);
}

export async function deleteAllImagesForFile(fileId) {
  const allKeys = await keys(imageStore);
  const fileKeys = allKeys.filter((k) => k.startsWith(`images/${fileId}/`));
  await Promise.all(fileKeys.map((k) => del(k, imageStore)));
}
