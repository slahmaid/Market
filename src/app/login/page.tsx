"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

const fieldClass =
  "w-full min-h-12 rounded-xl border border-neutral-200 bg-white px-3.5 text-base text-neutral-900 outline-none focus:border-neutral-400";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setPending(false);
    if (login?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main
      className="min-h-[100dvh] flex items-center justify-center bg-[#f6f7f9] px-4 py-8"
      style={{
        paddingTop: "max(2rem, var(--safe-top))",
        paddingBottom: "max(2rem, var(--safe-bottom))",
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-black/5"
      >
        <div>
          <Link
            href="/"
            className="text-sm text-neutral-500 active:text-neutral-800"
          >
            ← Board
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-neutral-900">
            Log in
          </h1>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="sm-press w-full min-h-12 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-900 active:bg-neutral-50 touch-manipulation"
        >
          Continue with Google
        </button>
        <p className="text-xs text-neutral-500 text-center">
          Prefer Google? Use the button above.
        </p>
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-neutral-500">or</span>
          </div>
        </div>
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button
          disabled={pending}
          className="w-full min-h-12 rounded-xl bg-neutral-900 text-white font-semibold active:bg-neutral-800 disabled:opacity-60 touch-manipulation"
        >
          {pending ? "…" : "Log in"}
        </button>
        <p className="text-sm text-neutral-600 text-center">
          No account?{" "}
          <Link href="/register" className="font-medium text-neutral-900 underline">
            Create one
          </Link>
        </p>
      </form>
    </main>
  );
}
