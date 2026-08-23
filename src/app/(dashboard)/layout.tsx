import { redirect } from "next/navigation";
import { getUserRole, getSafeUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSafeUser();

  if (!user) redirect("/login");

  const role = (await getUserRole()) ?? "CITIZEN";

  // Phase 3+ will add dedicated views for other roles; for now the
  // control-room dashboard requires authority access.
  if (!["OPERATOR", "ADMIN"].includes(role)) {
    redirect("/?error=unauthorized");
  }

  const name =
    user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Operator";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={name} userRole={role} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
