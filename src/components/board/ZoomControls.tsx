"use client";

type ZoomControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
};

const btnClass =
  "min-w-9 h-9 px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors";

export function ZoomControls({ onZoomIn, onZoomOut, onFit }: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-white/90 border border-black/10 shadow-sm p-1 backdrop-blur-sm">
      <button type="button" onClick={onZoomOut} className={btnClass} aria-label="Zoom out">
        −
      </button>
      <button type="button" onClick={onFit} className={btnClass} aria-label="Fit to view">
        Fit
      </button>
      <button type="button" onClick={onZoomIn} className={btnClass} aria-label="Zoom in">
        +
      </button>
    </div>
  );
}
