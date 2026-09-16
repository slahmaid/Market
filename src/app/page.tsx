"use client";

import { Suspense, useEffect, useState } from "react";
import { AppChrome } from "@/components/board/AppChrome";
import { BoardDashboardRail } from "@/components/board/BoardDashboardRail";
import { BoardNotificationsRail } from "@/components/board/BoardNotificationsRail";
import { BoardSphere } from "@/components/board/BoardSphere";
import { listPreviewSquares } from "@/lib/previewBoard";
import type { BoardSquare } from "@/components/board/BoardCanvas";

async function loadSquares(): Promise<BoardSquare[]> {
  try {
    const response = await fetch("/api/squares");
    const text = await response.text();
    if (!response.ok || !text.trim()) {
      return listPreviewSquares();
    }
    const data = JSON.parse(text) as { squares?: BoardSquare[] };
    if (!Array.isArray(data.squares) || data.squares.length === 0) {
      return listPreviewSquares();
    }
    return data.squares;
  } catch {
    return listPreviewSquares();
  }
}

function HomePageContent() {
  const [squares, setSquares] = useState<BoardSquare[]>([]);
  const [focusedSquareId, setFocusedSquareId] = useState<string | null>(null);
  const [mySquaresOpen, setMySquaresOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadSquares().then((next) => {
      if (!cancelled) setSquares(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function applySquareUpdate(updated: {
    id: string;
    imageUrl: string | null;
    linkUrl: string | null;
    status: string;
    listPriceCents: number | null;
  }) {
    setSquares((prev) =>
      prev.map((s) => {
        if (s.id !== updated.id) return s;
        const base = updated.imageUrl;
        const imageUrl = base
          ? `${base}${base.includes("?") ? "&" : "?"}v=${Date.now()}`
          : null;
        return {
          ...s,
          imageUrl,
          status: updated.status,
          listPriceCents: updated.listPriceCents,
        };
      }),
    );
  }

  return (
    <main
      data-board-shell
      className="flex h-[100dvh] w-screen flex-col overflow-hidden overscroll-none"
      style={{
        background:
          "radial-gradient(120% 80% at 50% -10%, #ffffff 0%, #e8ecf4 45%, #eef1f6 100%)",
      }}
    >
      <AppChrome active="board" />
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <BoardDashboardRail
          open={mySquaresOpen}
          onToggle={() => setMySquaresOpen((v) => !v)}
          onSquareUpdated={applySquareUpdate}
        />
        <div className="relative min-h-[30vh] min-w-0 flex-1 overflow-hidden md:min-h-0 md:flex-[1.4]">
          {squares.length > 0 ? (
            <BoardSphere
              squares={squares}
              focusedSquareId={focusedSquareId}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              Loading squares…
            </div>
          )}
        </div>
        <BoardNotificationsRail
          open={notificationsOpen}
          onToggle={() => setNotificationsOpen((v) => !v)}
          focusedSquareId={focusedSquareId}
          onFocusSquare={setFocusedSquareId}
        />
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main
          data-board-shell
          className="flex h-[100dvh] w-screen flex-col overflow-hidden overscroll-none"
          style={{
            background:
              "radial-gradient(120% 80% at 50% -10%, #ffffff 0%, #e8ecf4 45%, #eef1f6 100%)",
          }}
        />
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
