import Link from "next/link";
import { getSafeUser } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/layout/SignOutButton";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getSafeUser();
  const signedIn = !!user;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-3xl">
        🛟
      </div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        RakshaSetu
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted">
        Report an emergency. Get help fast. See shelters and warnings near you.
      </p>

      {error === "unauthorized" && (
        <div className="mt-6 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This account doesn&apos;t have control-room access. Sign out below,
          then log in with an operator account.
        </div>
      )}

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/report"
          className="inline-flex h-14 items-center justify-center rounded-xl bg-[var(--color-primary)] text-lg font-semibold text-white hover:bg-[var(--color-primary-dark)]"
        >
          Report an Emergency
        </Link>
        {!signedIn ? (
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-sm font-medium text-muted hover:bg-gray-50"
          >
            Authority Login →
          </Link>
        ) : (
          <SignOutButton className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-sm font-medium text-muted hover:bg-gray-50 disabled:opacity-60" />
        )}
      </div>
    </main>
  );
}
