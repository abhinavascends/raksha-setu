import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ============================================================
// RakshaSetu Disaster Simulation Engine
//
// Replays a scripted flood scenario into the live system so the
// demo never depends on real disasters or external APIs.
// Events fire on a wall-clock schedule while the dashboard's
// Realtime subscription picks up every change automatically.
// ============================================================

type Db = SupabaseClient<Database>;
export type AnyDb = SupabaseClient;

export interface SimulationEvent {
  time: number; // seconds after start
  type: "CREATE_INCIDENT" | "UPDATE_RESOURCE" | "UPDATE_SHELTER";
  data: {
    // CREATE_INCIDENT
    severity?: string;
    incidentType?: string;
    lat?: number;
    lng?: number;
    people?: number;
    capabilities?: string[];
    description?: string;
    locationText?: string;
    // UPDATE_RESOURCE
    teamCode?: string;
    status?: string;
    // UPDATE_SHELTER
    shelterName?: string;
    occupancy?: number;
  };
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  durationSec: number;
  events: SimulationEvent[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "flood-rourkela",
    name: "Flood — Rourkela (Koel River)",
    description:
      "Escalating river flood: rising reports, a critical rescue, team breakdown, shelter nearing capacity.",
    durationSec: 75,
    events: [
      {
        time: 0,
        type: "CREATE_INCIDENT",
        data: {
          severity: "HIGH",
          incidentType: "FLOOD",
          lat: 22.216,
          lng: 84.831,
          people: 6,
          capabilities: ["BOAT"],
          description:
            "Street flooded near railway underpass in Jalda, two-wheelers submerged, families asking for evacuation",
          locationText: "Jalda",
        },
      },
      {
        time: 15,
        type: "CREATE_INCIDENT",
        data: {
          severity: "CRITICAL",
          incidentType: "FLOOD",
          lat: 22.233,
          lng: 84.856,
          people: 18,
          capabilities: ["BOAT", "MEDICAL"],
          description:
            "Koel river water rising fast at Panposh riverside colony, elderly couple and child trapped upstairs",
          locationText: "Panposh",
        },
      },
      {
        time: 30,
        type: "UPDATE_RESOURCE",
        data: { teamCode: "RT-002", status: "UNAVAILABLE" },
      },
      {
        time: 45,
        type: "UPDATE_SHELTER",
        data: { shelterName: "Community Hall - Chhend Colony", occupancy: 145 },
      },
      {
        time: 60,
        type: "CREATE_INCIDENT",
        data: {
          severity: "CRITICAL",
          incidentType: "MEDICAL_EMERGENCY",
          lat: 22.2455,
          lng: 84.9075,
          people: 4,
          capabilities: ["MEDICAL", "BOAT"],
          description:
            "Pregnant woman in labour needs immediate evacuation from Bondamunda, approach road underwater",
          locationText: "Bondamunda",
        },
      },
    ],
  },
];

// ---- Engine state (module singleton - fine for single-instance dev) ----
let running: {
  scenarioId: string;
  startedAt: number;
  timers: ReturnType<typeof setTimeout>[];
} | null = null;

export function getSimulationStatus() {
  if (!running) return { running: false as const };
  const scenario = SCENARIOS.find((s) => s.id === running!.scenarioId);
  return {
    running: true as const,
    scenarioId: running.scenarioId,
    scenarioName: scenario?.name ?? running.scenarioId,
    elapsedSec: Math.round((Date.now() - running.startedAt) / 1000),
    durationSec: scenario?.durationSec ?? 0,
  };
}

export function stopSimulation() {
  if (!running) return false;
  running.timers.forEach(clearTimeout);
  running = null;
  return true;
}

export function startSimulation(
  scenarioId: string,
  db: AnyDb,
  actorId?: string
): { ok: boolean; error?: string; scenario?: string } {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) return { ok: false, error: "Unknown scenario" };
  if (running) stopSimulation();

  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const event of scenario.events) {
    timers.push(
      setTimeout(() => {
        void executeEvent(event, db, actorId).catch((err) => {
          console.error("[simulation] event failed:", event.type, err);
        });
      }, event.time * 1000)
    );
  }

  // Auto-stop shortly after last event
  timers.push(
    setTimeout(
      () => {
        if (running && running.scenarioId === scenarioId) running = null;
      },
      (scenario.durationSec + 5) * 1000
    )
  );

  running = { scenarioId, startedAt: Date.now(), timers };
  return { ok: true, scenario: scenario.name };
}

async function executeEvent(
  event: SimulationEvent,
  db: AnyDb,
  actorId?: string
): Promise<void> {
  if (event.type === "CREATE_INCIDENT") {
    // RLS: incidents_insert_authenticated requires reporter_id = auth.uid()
    const { error } = await db.from("incidents").insert({
      reporter_id: actorId ?? null,
      description: event.data.description ?? "Simulated incident",
      latitude: event.data.lat ?? 13.0827,
      longitude: event.data.lng ?? 80.2707,
      location_text: event.data.locationText ?? null,
      severity: (event.data.severity ?? "MEDIUM") as never,
      type: (event.data.incidentType ?? "OTHER") as never,
      people_affected: event.data.people ?? 1,
      required_capabilities: event.data.capabilities ?? [],
      source: "APP" as never,
      confidence_score: 0.55,
    });
    if (error) throw error;
    return;
  }

  if (event.type === "UPDATE_RESOURCE") {
    await db
      .from("resource_teams")
      .update({
        status: (event.data.status ?? "UNAVAILABLE") as never,
        last_status_update: new Date().toISOString(),
      })
      .eq("team_code", event.data.teamCode ?? "");
    return;
  }

  if (event.type === "UPDATE_SHELTER") {
    await db
      .from("shelters")
      .update({ current_occupancy: event.data.occupancy ?? 0 })
      .eq("name", event.data.shelterName ?? "");
  }
}

// ---- One-click demo reset -------------------------------------
export async function resetDemoData(db: Db) {
  await db
    .from("assignments")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  await db
    .from("incidents")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  await db
    .from("resource_teams")
    .update({ status: "AVAILABLE" })
    .eq("status", "UNAVAILABLE");

  // Restore seed-like occupancies
  await db.from("shelters").update({ current_occupancy: 45 }).eq("name", "Govt High School - Sector 2");
  await db.from("shelters").update({ current_occupancy: 130 }).eq("name", "Community Hall - Chhend Colony");
  await db.from("shelters").update({ current_occupancy: 90 }).eq("name", "Saraswati Vidya Mandir - Koel Nagar");
}
