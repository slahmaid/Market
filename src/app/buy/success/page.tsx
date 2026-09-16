import Link from "next/link";
import { AppChrome } from "@/components/board/AppChrome";

export default function BuySuccessPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#f6f7f9]">
      <AppChrome />
      <div className="flex flex-1 items-center justify-center px-4 py-8 pb-[calc(5.5rem+var(--safe-bottom))] md:pb-8">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <Link
            href="/"
            className="text-sm text-neutral-500 active:text-neutral-800"
          >
            ← Board
          </Link>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Purchase complete
          </h1>
          <p className="text-sm leading-relaxed text-neutral-600">
            Payment received. Your square will show as owned once Stripe confirms
            the webhook — refresh the board if it is not updated yet.
          </p>
          <Link
            href="/"
            className="sm-press flex w-full min-h-12 items-center justify-center rounded-xl bg-neutral-900 text-sm font-semibold text-white active:bg-neutral-800 touch-manipulation"
          >
            Back to board
          </Link>
        </div>
      </div>
    </main>
  );
}
