import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export async function publishToTechBlog({ html, name }) {
  const callable = httpsCallable(functions, 'publishToTechBlog', {
    timeout: 540000,
  });
  const result = await callable({ html, name });
  return result.data;
}
