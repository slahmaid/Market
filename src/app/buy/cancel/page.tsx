import Link from "next/link";

export default function BuyCancelPage() {
  return (
    <main
      className="min-h-[100dvh] flex items-center justify-center bg-[#f6f7f9] px-4 py-8"
      style={{
        paddingTop: "max(2rem, var(--safe-top))",
        paddingBottom: "max(2rem, var(--safe-bottom))",
      }}
    >
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-black/5">
        <Link
          href="/"
          className="text-sm text-neutral-500 active:text-neutral-800"
        >
          ← Board
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Checkout canceled
        </h1>
        <p className="text-sm leading-relaxed text-neutral-600">
          No charge was made. You can pick another square or try again anytime.
        </p>
        <Link
          href="/"
          className="sm-press flex w-full min-h-12 items-center justify-center rounded-xl bg-neutral-900 text-white text-sm font-semibold active:bg-neutral-800 touch-manipulation"
        >
          Back to board
        </Link>
      </div>
    </main>
  );
}
