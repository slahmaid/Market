"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AppChrome } from "@/components/board/AppChrome";

const fieldClass =
  "w-full min-h-12 rounded-xl border border-neutral-200 bg-white px-3.5 text-base text-neutral-900 outline-none focus:border-neutral-400";

export default function RegisterForm({
  googleEnabled,
}: {
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registration failed");
      setPending(false);
      return;
    }
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setPending(false);
    if (login?.error) {
      setError("Registered but login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#f6f7f9]">
      <AppChrome />
      <div className="flex flex-1 items-center justify-center px-4 py-8 pb-[calc(5.5rem+var(--safe-bottom))] md:pb-8">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
        >
          <div>
            <Link
              href="/"
              className="text-sm text-neutral-500 active:text-neutral-800"
            >
              ← Board
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-neutral-900">
              Create account
            </h1>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {googleEnabled && (
            <>
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/" })}
                className="sm-press w-full min-h-12 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-900 active:bg-neutral-50 touch-manipulation"
              >
                Continue with Google
              </button>
              <p className="text-center text-xs text-neutral-500">
                New here? Google creates your account.
              </p>
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-neutral-500">or</span>
                </div>
              </div>
            </>
          )}
          <input
            className={fieldClass}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <input
            className={fieldClass}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8)"
          />
          <button
            disabled={pending}
            className="sm-press w-full min-h-12 rounded-xl bg-neutral-900 font-semibold text-white active:bg-neutral-800 disabled:opacity-60 touch-manipulation"
          >
            {pending ? "…" : "Register"}
          </button>
          <p className="text-center text-sm text-neutral-600">
            Have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-neutral-900 underline"
            >
              Log in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
