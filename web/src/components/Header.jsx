import { useEffect, useRef, useState } from 'react';
import {
  Coins,
  Users,
  UserCircle2,
  LogOut,
  ChevronDown,
  UserCog,
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useAppStore from '../store/useAppStore';

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const signOut = useAuthStore((s) => s.signOut);

  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [profileMenuOpen]);

  const goProfile = () => {
    setProfileMenuOpen(false);
    setCurrentView('profile');
  };
  const goAdmin = () => setCurrentView('admin');

  const balance = typeof userProfile?.coinBalance === 'number' ? userProfile.coinBalance : 0;
  const isSuperAdmin = userProfile?.role === 'super_admin';

  return (
    <header className="h-12 bg-white border-b border-slate-200 flex items-center px-4 shrink-0">
      {/* 좌측 — 로고 */}
      <button
        onClick={() => setCurrentView('contents')}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        title="홈"
      >
        <img src="/logo.svg" alt="GDoc Fixer" className="w-6 h-6" />
        <span className="text-sm font-bold text-slate-800">GDoc Fixer</span>
      </button>

      {/* 우측 액션 영역 */}
      <div className="ml-auto flex items-center gap-2">
        {/* 코인 칩 */}
        {user && (
          <button
            onClick={goProfile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
            title="프로필 / 사용량"
          >
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">
              {balance.toLocaleString()}
            </span>
          </button>
        )}

        {/* 슈퍼관리자 — 회원 관리 */}
        {isSuperAdmin && (
          <button
            onClick={goAdmin}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'admin'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
            }`}
            title="회원 관리"
          >
            <Users className="w-3.5 h-3.5" />
            회원 관리
          </button>
        )}

        {/* 프로필 드롭다운 */}
        {user && (
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setProfileMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              title="프로필 메뉴"
            >
              {userProfile?.photoURL || user.photoURL ? (
                <img
                  src={userProfile?.photoURL || user.photoURL}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserCircle2 className="w-7 h-7 text-slate-400" />
              )}
              <span className="text-xs text-slate-700 max-w-[140px] truncate hidden sm:block">
                {userProfile?.displayName || user.displayName || user.email}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                <div className="px-3 pb-2 mb-1 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {userProfile?.displayName || user.displayName || '사용자'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{user.email}</div>
                </div>
                <button
                  onClick={goProfile}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <UserCog className="w-4 h-4 text-slate-500" />
                  프로필 / 사용량
                </button>
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
