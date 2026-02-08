import { useEffect } from 'react';
import { Loader2, CheckCircle, Clock, XCircle, Shield, UserCheck, UserX } from 'lucide-react';
import useAdminStore from '../store/useAdminStore';

function StatusBadge({ status }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <CheckCircle className="w-3 h-3" /> 승인됨
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" /> 거절됨
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <Clock className="w-3 h-3" /> 대기 중
    </span>
  );
}

function RoleBadge({ role }) {
  if (role === 'super_admin') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
        <Shield className="w-3 h-3" /> 수퍼관리자
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
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

  useEffect(() => {
    loadAllUsers();
  }, [loadAllUsers]);

  if (usersLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-0">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">회원 관리</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          전체 {users.length}명{pendingCount > 0 && ` · 승인 대기 ${pendingCount}명`}
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">사용자</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">역할</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">상태</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">가입일</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">최종 로그인</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">관리</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
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
                        <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {u.displayName || '(이름 없음)'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(u.lastLoginAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {u.role !== 'super_admin' && (
                        <>
                          <button
                            onClick={() => approveUser(u.id)}
                            disabled={u.status === 'approved'}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              u.status === 'approved'
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
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
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-red-50 text-red-700 hover:bg-red-100'
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
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    등록된 사용자가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
