export default function ResizeHandle({ edge, onMouseDown, scaledW, scaledH }) {
  if (edge === 'right') {
    return (
      <div
        className="absolute top-0 cursor-ew-resize group/handle"
        style={{ right: -5, width: 10, height: scaledH }}
        onMouseDown={onMouseDown('right')}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-slate-300 group-hover/handle:bg-indigo-400 transition-colors" />
      </div>
    );
  }

  if (edge === 'bottom') {
    return (
      <div
        className="absolute left-0 cursor-ns-resize group/handle"
        style={{ bottom: -5, width: scaledW, height: 10 }}
        onMouseDown={onMouseDown('bottom')}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1 rounded-full bg-slate-300 group-hover/handle:bg-indigo-400 transition-colors" />
      </div>
    );
  }

  if (edge === 'corner') {
    return (
      <div
        className="absolute cursor-nwse-resize group/handle"
        style={{ right: -8, bottom: -8, width: 16, height: 16 }}
        onMouseDown={onMouseDown('corner')}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-sm bg-slate-300 group-hover/handle:bg-indigo-400 transition-colors border border-white" />
      </div>
    );
  }

  return null;
}
