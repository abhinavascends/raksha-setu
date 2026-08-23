import { redirect } from "next/navigation";
import { getUserRole, getSafeUser } from "@/lib/supabase/server";

// Gate for the citizen area: any logged-in user may look, but each role
// belongs to its own workspace - send them there instead.
export default async function CitizenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSafeUser();

  if (!user) redirect("/login");

  const role = await getUserRole();

  switch (role) {
    case "OPERATOR":
    case "ADMIN":
      redirect("/dashboard");
    case "FIELD_TEAM":
      redirect("/team");
    case "SHELTER_MANAGER":
      redirect("/shelter-manage");
    default:
      break;
  }

  return <>{children}</>;
}
