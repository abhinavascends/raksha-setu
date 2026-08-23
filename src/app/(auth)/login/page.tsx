"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { routeByRole } from "@/lib/roleRouting";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const dest = await routeByRole();
    router.push(dest);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 text-3xl">🛟</div>
          <h1 className="text-2xl font-bold">RakshaSetu</h1>
          <p className="mt-1 text-sm text-muted">Authority control room login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-[var(--color-primary)]">{error}</p>}

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          <p className="text-center text-sm text-muted">
            No account?{" "}
            <Link href="/register" className="font-medium text-[var(--color-accent)]">
              Register
            </Link>
          </p>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/" className="hover:text-foreground">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
