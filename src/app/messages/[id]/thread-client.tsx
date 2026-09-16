"use client";

import { useCallback, useEffect, useState } from "react";

type Msg = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};

type Props = {
  conversationId: string;
  role: "buyer" | "owner";
  status: "open" | "archived";
  currentUserId: string;
  initialMessages: Msg[];
};

export default function ThreadClient({
  conversationId,
  role,
  status: initialStatus,
  currentUserId,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const lastCreatedAt = messages[messages.length - 1]?.createdAt;

  const poll = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    const qs = lastCreatedAt
      ? `?after=${encodeURIComponent(lastCreatedAt)}`
      : "";
    const res = await fetch(
      `/api/conversations/${conversationId}/messages${qs}`,
    );
    if (!res.ok) return;
    const body = (await res.json()) as {
      messages: Msg[];
      conversation?: { status: "open" | "archived" };
    };
    if (body.conversation?.status) setStatus(body.conversation.status);
    if (body.messages.length) {
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const next = body.messages.filter((m) => !ids.has(m.id));
        return next.length ? [...prev, ...next] : prev;
      });
    }
  }, [conversationId, lastCreatedAt]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void poll();
    }, 5000);
    return () => window.clearInterval(id);
  }, [poll]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: draft }),
        },
      );
      const body = (await res.json().catch(() => null)) as
        | { message?: Msg; error?: string }
        | null;
      if (!res.ok || !body?.message) {
        throw new Error(body?.error ?? "Send failed");
      }
      setMessages((prev) => [...prev, body.message!]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function setArchived(next: "open" | "archived") {
    setError(null);
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Update failed");
      return;
    }
    setStatus(next);
  }

  const canCompose = status === "open" || role === "owner";

  return (
    <div className="mt-4 flex flex-1 flex-col gap-3">
      {role === "owner" ? (
        <div className="flex gap-2 text-sm">
          {status === "open" ? (
            <button
              type="button"
              onClick={() => void setArchived("archived")}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5"
            >
              Archive
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void setArchived("open")}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5"
            >
              Reopen
            </button>
          )}
        </div>
      ) : null}

      {status === "archived" && role === "buyer" ? (
        <p className="text-sm text-zinc-600">
          This conversation is archived. You can still read messages.
        </p>
      ) : null}

      <ul className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3">
        {messages.length === 0 ? (
          <li className="text-sm text-zinc-500">Say hello…</li>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "ml-auto bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-900"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </li>
            );
          })
        )}
      </ul>

      {canCompose ? (
        <form onSubmit={send} className="flex gap-2 pr-14 md:pr-0">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder="Write a message…"
            className="min-h-11 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-base sm:text-sm"
            disabled={status === "archived" && role === "buyer"}
          />
          <button
            type="submit"
            disabled={
              sending ||
              !draft.trim() ||
              (status === "archived" && role === "buyer")
            }
            className="sm-press min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 touch-manipulation"
          >
            Send
          </button>
        </form>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
