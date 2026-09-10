"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

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
    <main className="min-h-screen flex items-center justify-center bg-[#f6f7f9] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 bg-white p-6 shadow-sm border border-black/5"
      >
        <h1 className="text-xl font-semibold text-neutral-900">Log in</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          className="w-full border px-3 py-2"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          className="w-full border px-3 py-2"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button
          disabled={pending}
          className="w-full bg-neutral-900 text-white py-2"
        >
          {pending ? "…" : "Log in"}
        </button>
        <p className="text-sm text-neutral-600">
          No account? <Link href="/register">Create one</Link>
        </p>
      </form>
    </main>
  );
}
