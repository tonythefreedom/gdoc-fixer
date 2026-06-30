import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, Clock, XCircle, Shield, UserCheck, UserX, Coins, Plus } from 'lucide-react';
import useAdminStore from '../store/useAdminStore';

function StatusBadge({ status }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/40 text-emerald-300">
        <CheckCircle className="w-3 h-3" /> 승인됨
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/40 text-red-300">
        <XCircle className="w-3 h-3" /> 거절됨
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/40 text-amber-300">
      <Clock className="w-3 h-3" /> 대기 중
    </span>
  );
}

function RoleBadge({ role }) {
  if (role === 'super_admin') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-900/40 text-purple-300">
        <Shield className="w-3 h-3" /> 수퍼관리자
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
      일반 사용자
    </span>
  );
}

function formatDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminUserManagement() {
  const users = useAdminStore((s) => s.users);
  const usersLoading = useAdminStore((s) => s.usersLoading);
  const loadAllUsers = useAdminStore((s) => s.loadAllUsers);
  const approveUser = useAdminStore((s) => s.approveUser);
  const rejectUser = useAdminStore((s) => s.rejectUser);
  const grantCoins = useAdminStore((s) => s.grantCoins);
  const [granting, setGranting] = useState(null);

  const handleGrant = async (u) => {
    const input = window.prompt(
      `${u.displayName || u.email} 에게 부여할 코인 (음수면 차감). 현재 잔액: ${u.coinBalance ?? 0}`,
      '10000'
    );
    if (input === null) return;
    const n = Number(input);
    if (!Number.isFinite(n) || n === 0) return;
    setGranting(u.id);
    try {
      await grantCoins(u.id, n);
    } finally {
      setGranting(null);
    }
  };

  useEffect(() => {
    loadAllUsers();
  }, [loadAllUsers]);

  if (usersLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  return (
    <main className="flex-1 h-full overflow-y-auto bg-slate-950">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">회원 관리</h1>
          <p className="text-sm text-slate-400 mt-1">
            전체 {users.length}명{pendingCount > 0 && ` · 승인 대기 ${pendingCount}명`}
          </p>
        </header>

        <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">사용자</th>
                <th className="text-left px-4 py-2.5 font-medium">역할</th>
                <th className="text-left px-4 py-2.5 font-medium">상태</th>
                <th className="text-right px-4 py-2.5 font-medium">코인</th>
                <th className="text-left px-4 py-2.5 font-medium">가입일</th>
                <th className="text-right px-4 py-2.5 font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-950">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.photoURL ? (
                        <img
                          src={u.photoURL}
                          alt=""
                          className="w-8 h-8 rounded-full shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">
                          {u.displayName || '(이름 없음)'}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                      <Coins className="w-3 h-3" />
                      {(u.coinBalance ?? 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleGrant(u)}
                        disabled={granting === u.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-900/30 text-amber-300 hover:bg-amber-900/40 disabled:opacity-40 disabled:cursor-wait transition-colors"
                        title="코인 부여 / 차감"
                      >
                        {granting === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        코인
                      </button>
                      {u.role !== 'super_admin' && (
                        <>
                          <button
                            onClick={() => approveUser(u.id)}
                            disabled={u.status === 'approved'}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              u.status === 'approved'
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/40'
                            }`}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            승인
                          </button>
                          <button
                            onClick={() => rejectUser(u.id)}
                            disabled={u.status === 'rejected'}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              u.status === 'rejected'
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-red-900/30 text-red-300 hover:bg-red-900/40'
                            }`}
                          >
                            <UserX className="w-3.5 h-3.5" />
                            거절
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    등록된 사용자가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
