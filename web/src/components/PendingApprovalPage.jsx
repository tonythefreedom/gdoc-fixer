import { Clock, XCircle, LogOut } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

export default function PendingApprovalPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const isRejected = userProfile?.status === 'rejected';

  return (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8 flex flex-col items-center gap-6">
        <img src="/icon.png" alt="GDoc Fixer" className="w-16 h-16" />
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">GDoc Fixer</h1>
          <p className="text-sm text-slate-500 mt-1">HTML to PNG Converter</p>
        </div>

        {user?.photoURL && (
          <img
            src={user.photoURL}
            alt=""
            className="w-16 h-16 rounded-full"
            referrerPolicy="no-referrer"
          />
        )}
        <p className="text-sm text-slate-600">{user?.email}</p>

        <div className="flex flex-col items-center gap-2">
          {isRejected ? (
            <>
              <XCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-red-600 text-center font-medium">
                가입이 거절되었습니다
              </p>
              <p className="text-xs text-slate-500 text-center">
                관리자에게 문의해주세요.
              </p>
            </>
          ) : (
            <>
              <Clock className="w-10 h-10 text-amber-400" />
              <p className="text-sm text-amber-600 text-center font-medium">
                가입 승인 대기 중
              </p>
              <p className="text-xs text-slate-500 text-center">
                관리자가 승인하면 서비스를 이용할 수 있습니다.
              </p>
            </>
          )}
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-600"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </div>
  );
}
