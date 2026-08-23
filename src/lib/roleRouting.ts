"use client";

import { createClient } from "@/lib/supabase/client";

// Route each role to its own home after sign-in.
export async function routeByRole(fallback = "/dashboard") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fallback;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  switch (profile?.role) {
    case "FIELD_TEAM":
      return "/team";
    case "SHELTER_MANAGER":
      return "/shelter-manage";
    case "CITIZEN":
      return "/citizen";
    default:
      return fallback;
  }
}
