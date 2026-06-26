import { useState, useRef, useEffect } from 'react';
import {
  Coins,
  UserCircle2,
  Camera,
  Loader2,
  Check,
  X,
  Pencil,
  CreditCard,
  Plus,
} from 'lucide-react';
import { auth } from '../firebase';
import useAuthStore from '../store/useAuthStore';
import { ACTION_COSTS, ACTION_LABELS, INITIAL_COIN_GRANT } from '../utils/coin';
import { uploadBlobToGcs, dataUriToBlob } from '../store/storage';

// 가격 정책: 100 coin = $1. (functions/coinCheckout.js 의 COIN_PACKAGES 와 동기화)
const COIN_PACKAGES = [
  { key: 500, coins: 500, usd: 5, label: '체험', highlight: false },
  { key: 1000, coins: 1000, usd: 10, label: '스타터', highlight: true },
  { key: 5000, coins: 5000, usd: 50, label: '프로', highlight: false },
  { key: 10000, coins: 10000, usd: 100, label: '비즈니스', highlight: false },
];

function readFileAsDataUri(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.userProfile);
  const updateProfilePhoto = useAuthStore((s) => s.updateProfilePhoto);
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile?.displayName || '');
  const [chargingPkg, setChargingPkg] = useState(null);
  const [chargeBanner, setChargeBanner] = useState(null);

  // Stripe Checkout 에서 돌아온 후 ?charge=success / cancel 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const charge = params.get('charge');
    if (!charge) return;
    if (charge === 'success') {
      const coins = params.get('coins') || '';
      setChargeBanner({ type: 'success', msg: `${coins} 코인 충전이 완료됐어요. 잔액 반영까지 몇 초 걸릴 수 있습니다.` });
    } else if (charge === 'cancel') {
      setChargeBanner({ type: 'cancel', msg: '결제가 취소됐어요.' });
    }
    // URL 정리 (?charge 등 제거)
    params.delete('charge');
    params.delete('coins');
    const cleaned = params.toString();
    const newUrl = window.location.pathname + (cleaned ? `?${cleaned}` : '');
    window.history.replaceState({}, '', newUrl);
  }, []);

  const handleCharge = async (pkg) => {
    if (chargingPkg) return;
    setChargingPkg(pkg.key);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('로그인이 필요합니다.');
      const res = await fetch('/api/coin-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          packageKey: pkg.key,
          returnUrl: `${window.location.origin}${window.location.pathname}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `결제 세션 생성 실패 (${res.status})`);
      window.location.href = data.url; // Stripe Checkout 으로 이동
    } catch (err) {
      console.error('charge failed:', err);
      alert(`충전 시작 실패: ${err.message}`);
      setChargingPkg(null);
    }
  };

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const balance = typeof profile.coinBalance === 'number' ? profile.coinBalance : 0;
  const spent = typeof profile.coinSpent === 'number' ? profile.coinSpent : 0;
  const earned = typeof profile.coinEarned === 'number' ? profile.coinEarned : INITIAL_COIN_GRANT;
  const spendByAction = profile.spendByAction || {};

  const handleSelectPhoto = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const dataUri = await readFileAsDataUri(file);
      const blob = dataUriToBlob(dataUri);
      const ext = blob.type.split('/')[1].replace('+xml', '') || 'png';
      const path = `wiki-images/avatars/${user.uid}/avatar_${Date.now()}.${ext}`;
      const url = await uploadBlobToGcs(path, blob);
      await updateProfilePhoto(url);
    } catch (err) {
      console.error('avatar upload failed:', err);
      alert(`프로필 사진 업로드 실패: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const startEditName = () => {
    setNameDraft(profile.displayName || '');
    setEditingName(true);
  };
  const cancelEditName = () => setEditingName(false);
  const confirmEditName = async () => {
    if (!nameDraft.trim()) return cancelEditName();
    await updateDisplayName(nameDraft.trim());
    setEditingName(false);
  };

  return (
    <main className="flex-1 h-full overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">프로필</h1>
          <p className="text-sm text-slate-500 mt-1">계정 정보와 사용량을 관리합니다.</p>
        </header>

        {/* 프로필 카드 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start gap-6">
            {/* 사진 */}
            <div className="relative shrink-0">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName || profile.email}
                  className="w-24 h-24 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
                  <UserCircle2 className="w-16 h-16 text-slate-300" />
                </div>
              )}
              <button
                onClick={handleSelectPhoto}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md disabled:opacity-50"
                title="사진 변경"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* 이름 / 이메일 / 역할 */}
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmEditName();
                      if (e.key === 'Escape') cancelEditName();
                    }}
                    autoFocus
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md text-base font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <button onClick={confirmEditName} className="p-1 text-emerald-600 hover:text-emerald-700" title="확인">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={cancelEditName} className="p-1 text-slate-400 hover:text-slate-600" title="취소">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-800 truncate">
                    {profile.displayName || profile.email}
                  </h2>
                  <button onClick={startEditName} className="p-1 text-slate-400 hover:text-slate-600" title="이름 변경">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-sm text-slate-500 mt-1">{profile.email}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.role === 'super_admin'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : 'bg-slate-50 text-slate-600 border border-slate-200'
                }`}>
                  {profile.role === 'super_admin' ? '슈퍼관리자' : '일반 사용자'}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {profile.status === 'approved' ? '승인됨' : profile.status === 'pending' ? '승인 대기' : '거부됨'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 충전 결과 배너 */}
        {chargeBanner && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3 ${
              chargeBanner.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <span>{chargeBanner.msg}</span>
            <button
              onClick={() => setChargeBanner(null)}
              className="p-1 rounded hover:bg-black/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 코인 잔액 카드 */}
        <section className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-6 shadow-lg">
          <div className="flex items-center gap-3 text-white/90 text-sm mb-2">
            <Coins className="w-5 h-5" />
            보유 코인
          </div>
          <div className="text-5xl font-bold">{balance.toLocaleString()}</div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-white/70 text-xs">누적 적립</div>
              <div className="font-semibold text-lg">{earned.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-white/70 text-xs">누적 사용</div>
              <div className="font-semibold text-lg">{spent.toLocaleString()}</div>
            </div>
          </div>
        </section>

        {/* 코인 충전 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-semibold text-slate-800">코인 충전</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            100 코인 = $1. Lemon Squeezy 안전 결제 — 카드 / Apple Pay / Google Pay 지원,
            세금/영수증 자동 처리.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {COIN_PACKAGES.map((pkg) => {
              const isLoading = chargingPkg === pkg.key;
              return (
                <button
                  key={pkg.key}
                  onClick={() => handleCharge(pkg)}
                  disabled={!!chargingPkg}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all disabled:opacity-50 disabled:cursor-wait ${
                    pkg.highlight
                      ? 'border-indigo-500 bg-indigo-50 hover:bg-indigo-100'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
                  }`}
                >
                  {pkg.highlight && (
                    <span className="absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                      추천
                    </span>
                  )}
                  <div className="text-xs text-slate-500 mb-1">{pkg.label}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-800">
                      {pkg.coins.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500">coin</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-indigo-600">
                      ${pkg.usd}
                    </span>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    ) : (
                      <Plus className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 액션별 비용 + 사용량 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">액션별 코인 비용 / 사용량</h3>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left py-2 font-medium">액션</th>
                <th className="text-right py-2 font-medium w-24">1회 비용</th>
                <th className="text-right py-2 font-medium w-32">누적 사용</th>
                <th className="text-right py-2 font-medium w-24">횟수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(ACTION_COSTS).map(([key, cost]) => {
                const total = spendByAction[key] || 0;
                const count = cost > 0 ? Math.floor(total / cost) : 0;
                return (
                  <tr key={key} className="text-slate-700">
                    <td className="py-2.5">{ACTION_LABELS[key]}</td>
                    <td className="py-2.5 text-right text-indigo-600 font-medium">{cost}</td>
                    <td className="py-2.5 text-right text-slate-600">{total.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-slate-500 text-xs">{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-slate-500">
            신규 가입 시 자동으로 {INITIAL_COIN_GRANT} 코인이 지급됩니다.
          </p>
        </section>
      </div>
    </main>
  );
}
