import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Key, Plus, Copy, Check, Trash2, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import useAppStore from '../store/useAppStore';

/**
 * API 키 발급·관리.
 *
 * 발급된 원본 키는 서버에 저장되지 않으므로(해시만 보관) 발급 직후 한 번만 보여준다.
 * 그래서 "다시 볼 수 없다"는 점을 화면에서 분명히 알리고 복사 버튼을 크게 둔다.
 */
export default function ApiKeySection() {
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [issued, setIssued] = useState(null); // 방금 발급된 원본 키
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await httpsCallable(functions, 'listApiKeys')();
      setKeys(res.data.keys || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await httpsCallable(functions, 'createApiKey')({ name: newName.trim() });
      setIssued(res.data);
      setNewName('');
      setCopied(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (keyId, name) => {
    if (!confirm(`「${name}」 키를 폐기할까요?\n이 키를 쓰는 연동은 즉시 동작을 멈춥니다. 되돌릴 수 없습니다.`)) return;
    try {
      await httpsCallable(functions, 'revokeApiKey')({ keyId });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('클립보드 복사에 실패했습니다. 키를 직접 선택해 복사해주세요.');
    }
  };

  const fmt = (ms) => (ms ? new Date(ms).toLocaleDateString('ko-KR') : '—');
  const active = keys.filter((k) => !k.revoked);

  return (
    <section className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-amber-400" />
          <h3 className="text-base font-semibold text-slate-100">API 키</h3>
        </div>
        <button
          onClick={() => setCurrentView('ai')}
          className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
        >
          연동 방법 <ExternalLink className="w-3 h-3" />
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Claude · ChatGPT · Gemini · Grok 같은 AI 가 내 계정으로 문서를 만들고 게시할 수 있게 하는 키입니다.
      </p>

      {/* 방금 발급된 키 — 다시 볼 수 없다 */}
      {issued && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200">
              지금 한 번만 보입니다. 서버에는 저장되지 않으니 안전한 곳에 복사해 두세요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-slate-950 text-emerald-300 rounded-lg px-3 py-2 font-mono break-all">
              {issued.key}
            </code>
            <button
              onClick={copy}
              className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-semibold flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          <button
            onClick={() => setIssued(null)}
            className="mt-3 text-xs text-slate-400 hover:text-slate-200"
          >
            복사했습니다 — 닫기
          </button>
        </div>
      )}

      {/* 발급 */}
      <div className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="키 이름 (예: Claude Code, 내 노트북)"
          maxLength={60}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={create}
          disabled={creating}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-1.5"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          발급
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
        </div>
      ) : active.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">
          발급된 키가 없습니다. 위에서 만들어보세요.
        </p>
      ) : (
        <div className="space-y-2">
          {active.map((k) => (
            <div
              key={k.keyId}
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{k.name}</p>
                <p className="text-xs text-slate-500 font-mono">{k.mask}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-slate-500">만든 날 {fmt(k.createdAt)}</p>
                <p className="text-[11px] text-slate-600">
                  {k.lastUsedAt ? `마지막 사용 ${fmt(k.lastUsedAt)}` : '사용 이력 없음'}
                </p>
              </div>
              <button
                onClick={() => revoke(k.keyId, k.name)}
                title="폐기"
                className="shrink-0 p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
