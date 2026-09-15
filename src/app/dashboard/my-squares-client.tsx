"use client";

import Link from "next/link";
import { MySquaresList } from "@/components/board/MySquaresList";

export default function MySquaresClient() {
  return (
    <main
      className="min-h-[100dvh] bg-[#f6f7f9] px-4 py-8"
      style={{
        paddingTop: "max(2rem, var(--safe-top))",
        paddingBottom: "max(2rem, var(--safe-bottom))",
      }}
    >
      <div className="mx-auto w-full max-w-lg space-y-4">
        <header className="rounded-2xl bg-white p-6 shadow-sm border border-black/5">
          <Link
            href="/"
            className="text-sm text-neutral-500 active:text-neutral-800 min-h-11 inline-flex items-center"
          >
            ← Board
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-neutral-900">
            My squares
          </h1>
        </header>

        <section className="rounded-2xl bg-white shadow-sm border border-black/5 overflow-hidden">
          <MySquaresList />
        </section>
      </div>
    </main>
  );
}
