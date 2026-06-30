import { create } from 'zustand';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { INITIAL_COIN_GRANT } from '../utils/coin';

const SUPER_ADMIN_EMAIL = 'tony@banya.ai';

const useAuthStore = create((set, get) => ({
  user: null,
  userProfile: null,
  loading: true,
  profileLoading: true,

  initAuth: () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        set({ user, loading: false, profileLoading: true });
        await get().loadOrCreateProfile(user);
      } else {
        set({ user: null, userProfile: null, loading: false, profileLoading: false });
        // 비-명시적 로그아웃(세션 만료 / 다른 탭에서 로그아웃 / Firebase
        // 자동 토큰 무효화) 케이스에도 메모리 데이터 비움.
        await resetAllStores();
      }
    });
  },

  loadOrCreateProfile: async (user) => {
    try {
      const profileRef = doc(db, 'userProfiles', user.uid);
      const snap = await getDoc(profileRef);

      if (snap.exists()) {
        const profile = { id: snap.id, ...snap.data() };

        // 수퍼관리자 자동 승격
        if (user.email === SUPER_ADMIN_EMAIL && (profile.role !== 'super_admin' || profile.status !== 'approved')) {
          await updateDoc(profileRef, {
            role: 'super_admin',
            status: 'approved',
            updatedAt: Date.now(),
            lastLoginAt: Date.now(),
          });
          profile.role = 'super_admin';
          profile.status = 'approved';
        } else {
          await updateDoc(profileRef, { lastLoginAt: Date.now() });
        }

        // 기존 사용자라도 coinBalance 가 없으면 한 번 100 코인 grant (마이그레이션)
        if (typeof profile.coinBalance !== 'number') {
          await updateDoc(profileRef, {
            coinBalance: INITIAL_COIN_GRANT,
            coinEarned: INITIAL_COIN_GRANT,
            coinSpent: 0,
          });
          profile.coinBalance = INITIAL_COIN_GRANT;
          profile.coinEarned = INITIAL_COIN_GRANT;
          profile.coinSpent = 0;
        }

        set({ userProfile: profile, profileLoading: false });
        // 프로필 실시간 구독 — 코인 차감/충전이 UI 에 즉시 반영
        get().subscribeProfile?.(user.uid);
      } else {
        // 최초 로그인: 프로필 생성
        const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
        const newProfile = {
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          role: isSuperAdmin ? 'super_admin' : 'user',
          status: isSuperAdmin ? 'approved' : 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastLoginAt: Date.now(),
          // 신규 회원에게 100 코인 지급
          coinBalance: INITIAL_COIN_GRANT,
          coinEarned: INITIAL_COIN_GRANT,
          coinSpent: 0,
        };
        await setDoc(profileRef, newProfile);
        set({ userProfile: { id: user.uid, ...newProfile }, profileLoading: false });
        get().subscribeProfile?.(user.uid);
      }
    } catch (err) {
      console.error('Failed to load/create user profile:', err);
      // Firestore 실패 시에도 수퍼관리자는 로컬에서 승인 처리
      if (user.email === SUPER_ADMIN_EMAIL) {
        set({
          userProfile: {
            id: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            role: 'super_admin',
            status: 'approved',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastLoginAt: Date.now(),
          },
          profileLoading: false,
        });
      } else {
        set({ profileLoading: false });
      }
    }
  },

  signInWithGoogle: async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google sign-in failed:', err);
      throw err;
    }
  },

  // 프로필 실시간 구독 — 코인 차감 등이 UI 에 즉시 반영
  _profileUnsub: null,
  subscribeProfile: async (uid) => {
    const prev = get()._profileUnsub;
    if (prev) prev();
    const { subscribeProfile } = await import('../utils/coin');
    const unsub = subscribeProfile(uid, (profile) => {
      set({ userProfile: profile });
    });
    set({ _profileUnsub: unsub });
  },

  // 프로필 사진 업데이트
  updateProfilePhoto: async (photoURL) => {
    const { user } = get();
    if (!user) return;
    const profileRef = doc(db, 'userProfiles', user.uid);
    await updateDoc(profileRef, { photoURL });
    // subscribeProfile 이 자동 반영
  },

  // 표시 이름 업데이트
  updateDisplayName: async (displayName) => {
    const { user } = get();
    if (!user) return;
    const profileRef = doc(db, 'userProfiles', user.uid);
    await updateDoc(profileRef, { displayName });
  },

  signOut: async () => {
    try {
      const prev = get()._profileUnsub;
      if (prev) prev();
      await firebaseSignOut(auth);
      set({ userProfile: null, _profileUnsub: null });
      // 이전 사용자 데이터 메모리에서 비움 — 같은 디바이스에서 계정 전환 시
      // 다른 사용자의 파일 / 슬라이드 / 공유 목록이 잠시 노출되는 것을 방지.
      await resetAllStores();
    } catch (err) {
      console.error('Sign-out failed:', err);
      throw err;
    }
  },
}));

// 다른 store 모듈과 cycle 회피를 위해 동적 import.
async function resetAllStores() {
  try {
    const [{ default: useAppStore }, { default: useSlideStore }, { default: useShareStore }] =
      await Promise.all([
        import('./useAppStore'),
        import('./useSlideStore'),
        import('./useShareStore'),
      ]);
    useAppStore.getState().reset?.();
    useSlideStore.getState().reset?.();
    useShareStore.getState().reset?.();
  } catch (err) {
    console.warn('resetAllStores failed:', err);
  }
}

export default useAuthStore;
