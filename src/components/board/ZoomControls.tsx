"use client";

type ZoomControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
};

const btnClass =
  "sm-press min-w-11 min-h-11 sm:min-w-9 sm:h-9 px-3 sm:px-2 text-base sm:text-sm font-medium text-neutral-700 active:bg-white/60 hover:bg-white/45 rounded-xl touch-manipulation";

export function ZoomControls({ onZoomIn, onZoomOut, onFit }: ZoomControlsProps) {
  return (
    <div className="sm-glass flex items-center gap-0.5 rounded-2xl p-1">
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
