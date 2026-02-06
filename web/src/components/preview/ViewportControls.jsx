import { useState } from 'react';
import { Minus, Plus, Save, X } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import {
  SIZE_STEP_SMALL,
  SIZE_STEP_LARGE,
  VIEWPORT_PRESETS,
} from '../../utils/constants';

export default function ViewportControls() {
  const viewportWidth = useAppStore((s) => s.viewportWidth);
  const viewportHeight = useAppStore((s) => s.viewportHeight);
  const setViewportSize = useAppStore((s) => s.setViewportSize);
  const savedPresets = useAppStore((s) => s.savedPresets);
  const savePreset = useAppStore((s) => s.savePreset);
  const deletePreset = useAppStore((s) => s.deletePreset);

  const [showSaveInput, setShowSaveInput] = useState(false);
  const [presetLabel, setPresetLabel] = useState('');

  const adjust = (dim, delta, e) => {
    const step = e.shiftKey ? SIZE_STEP_LARGE : SIZE_STEP_SMALL;
    if (dim === 'w') {
      setViewportSize(viewportWidth + delta * step, viewportHeight);
    } else {
      setViewportSize(viewportWidth, viewportHeight + delta * step);
    }
  };

  const handleWidthChange = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) setViewportSize(v, viewportHeight);
  };

  const handleHeightChange = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) setViewportSize(viewportWidth, v);
  };

  const handleSave = () => {
    const label = presetLabel.trim() || `${viewportWidth}x${viewportHeight}`;
    savePreset(label);
    setPresetLabel('');
    setShowSaveInput(false);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Width */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-400 font-medium w-4">W</span>
        <button
          onClick={(e) => adjust('w', -1, e)}
          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Shift+클릭: -100px"
        >
          <Minus className="w-3 h-3" />
        </button>
        <input
          type="number"
          value={viewportWidth}
          onChange={handleWidthChange}
          className="w-16 text-center text-xs font-mono bg-white border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-indigo-400"
        />
        <button
          onClick={(e) => adjust('w', 1, e)}
          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Shift+클릭: +100px"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <span className="text-slate-300 text-xs">x</span>

      {/* Height */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-400 font-medium w-4">H</span>
        <button
          onClick={(e) => adjust('h', -1, e)}
          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Shift+클릭: -100px"
        >
          <Minus className="w-3 h-3" />
        </button>
        <input
          type="number"
          value={viewportHeight}
          onChange={handleHeightChange}
          className="w-16 text-center text-xs font-mono bg-white border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-indigo-400"
        />
        <button
          onClick={(e) => adjust('h', 1, e)}
          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Shift+클릭: +100px"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <span className="text-[10px] text-slate-400">px</span>

      {/* Default Presets */}
      <div className="flex items-center gap-1 ml-2">
        {VIEWPORT_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setViewportSize(p.w, p.h)}
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
              viewportWidth === p.w && viewportHeight === p.h
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}

        {/* Saved Presets */}
        {savedPresets.map((p, i) => (
          <div key={i} className="group relative inline-flex">
            <button
              onClick={() => setViewportSize(p.w, p.h)}
              className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                viewportWidth === p.w && viewportHeight === p.h
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              }`}
            >
              {p.label}
            </button>
            <button
              onClick={() => deletePreset(i)}
              className="hidden group-hover:flex absolute -top-1.5 -right-1.5 w-3.5 h-3.5 items-center justify-center bg-red-500 text-white rounded-full"
              title="삭제"
            >
              <X className="w-2 h-2" />
            </button>
          </div>
        ))}

        {/* Save button */}
        {showSaveInput ? (
          <div className="flex items-center gap-1">
            <input
              value={presetLabel}
              onChange={(e) => setPresetLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setShowSaveInput(false);
              }}
              placeholder={`${viewportWidth}x${viewportHeight}`}
              className="w-20 text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-indigo-400"
              autoFocus
            />
            <button
              onClick={handleSave}
              className="p-0.5 rounded bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
            >
              <Save className="w-3 h-3" />
            </button>
            <button
              onClick={() => setShowSaveInput(false)}
              className="p-0.5 rounded bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveInput(true)}
            className="p-1 rounded bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            title="현재 사이즈를 프리셋으로 저장"
          >
            <Save className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
