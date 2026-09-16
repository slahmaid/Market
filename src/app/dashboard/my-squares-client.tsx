"use client";

import { AppChrome } from "@/components/board/AppChrome";
import { MySquaresList } from "@/components/board/MySquaresList";
import { PageShell } from "@/components/board/PageShell";

export default function MySquaresClient() {
  return (
    <main className="min-h-[100dvh] bg-[#f6f7f9]">
      <AppChrome active="dashboard" />
      <PageShell maxWidthClassName="max-w-lg" className="space-y-4">
        <header className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="text-2xl font-semibold text-neutral-900">My squares</h1>
        </header>

        <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <MySquaresList />
        </section>
      </PageShell>
    </main>
  );
}
