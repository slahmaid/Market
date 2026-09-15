"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

export function MessageStoreButton({ squareId }: { squareId: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    if (status === "unauthenticated" || !session?.user) {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(`/store/${squareId}`)}`,
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/stores/${squareId}/conversations`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as
        | { conversation?: { id: string }; error?: string }
        | null;
      if (!res.ok || !body?.conversation?.id) {
        throw new Error(body?.error ?? "Could not start chat");
      }
      router.push(`/messages/${body.conversation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start chat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy || status === "loading"}
        onClick={() => void onClick()}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 disabled:opacity-50"
      >
        {busy ? "Opening…" : "Message store"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
