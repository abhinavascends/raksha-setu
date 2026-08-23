"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { routeByRole } from "@/lib/roleRouting";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";

const ROLES = [
  { value: "CITIZEN", label: "Citizen" },
  { value: "OPERATOR", label: "Control Room Operator" },
  { value: "FIELD_TEAM", label: "Field Rescue Team" },
  { value: "SHELTER_MANAGER", label: "Shelter Manager" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("CITIZEN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, role },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const dest = await routeByRole("/dashboard");
    router.push(dest);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 text-3xl">🛟</div>
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="mt-1 text-sm text-muted">
            Report emergencies and track responses
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+91 ..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="role">I am a</Label>
            <Select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
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
            <Label htmlFor="password">Password (min 6 characters)</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-[var(--color-primary)]">{error}</p>}

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Create Account"}
          </Button>

          <p className="text-center text-sm text-muted">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-[var(--color-accent)]">
              Sign in
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
