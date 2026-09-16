"use client";

import { AppChrome } from "@/components/board/AppChrome";
import { MySquaresList } from "@/components/board/MySquaresList";

export default function MySquaresClient() {
  return (
    <main
      className="min-h-[100dvh] bg-[#f6f7f9]"
      style={{
        paddingBottom: "max(2rem, var(--safe-bottom))",
      }}
    >
      <AppChrome active="dashboard" />
      <div
        className="mx-auto w-full max-w-lg space-y-4 px-4 py-8"
        style={{
          paddingTop: "max(2rem, var(--safe-top))",
        }}
      >
        <header className="rounded-2xl bg-white p-6 shadow-sm border border-black/5">
          <h1 className="text-2xl font-semibold text-neutral-900">
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
