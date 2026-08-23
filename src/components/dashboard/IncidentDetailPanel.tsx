"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type {
  Assignment,
  Incident,
  ResourceTeam,
} from "@/types/database";

interface Recommendation {
  resourceId: string;
  incidentId: string;
  totalScore: number;
  distanceKm: number;
  etaMinutes: number;
  severityScore: number;
  etaScore: number;
  capabilityScore: number;
  availabilityScore: number;
  capacityScore: number;
  explanation: string;
}

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "text-[var(--color-critical)]",
  HIGH: "text-[var(--color-high)]",
  MEDIUM: "text-[var(--color-medium)]",
  LOW: "text-[var(--color-low)]",
};

export function IncidentDetailPanel({
  incident,
  teams,
  assignments,
  onClose,
  onAssigned,
}: {
  incident: Incident | null;
  teams: ResourceTeam[];
  assignments: Assignment[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPick, setManualPick] = useState("");

  const activeAssignment = incident
    ? assignments.find((a) => a.incident_id === incident.id)
    : undefined;

  const allocate = useCallback(async (incidentId: string) => {
    setLoading(true);
    setError(null);
    setShowAll(false);
    try {
      const res = await fetch("/api/assignments/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Allocation failed");
      setRecs(json.recommendations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Allocation failed");
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset per-incident state during render (React's recommended pattern)
  const [prevIncidentId, setPrevIncidentId] = useState<string | null>(null);
  if ((incident?.id ?? null) !== prevIncidentId) {
    setPrevIncidentId(incident?.id ?? null);
    setRecs([]);
    setManualPick("");
    setError(null);
  }

  useEffect(() => {
    // Defer allocation fetch so setState never runs synchronously
    if (incident && !activeAssignment && recs.length === 0)
      void (async () => {
        await allocate(incident.id);
      })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident?.id]);

  async function assign(resourceId: string, rec?: Recommendation) {
    if (!incident) return;
    setAssigning(resourceId);
    setError(null);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: incident.id,
          resourceId,
          score: rec?.totalScore,
          breakdown: rec
            ? {
                severityScore: rec.severityScore,
                etaScore: rec.etaScore,
                capabilityScore: rec.capabilityScore,
                availabilityScore: rec.availabilityScore,
                capacityScore: rec.capacityScore,
              }
            : undefined,
          explanation: rec?.explanation,
          distanceKm: rec?.distanceKm,
          etaMinutes: rec?.etaMinutes,
          manual: !rec,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Assignment failed");
      onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setAssigning(null);
    }
  }

  if (!incident) return null;

  const shown = showAll ? recs : recs.slice(0, 3);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className="font-mono text-xs text-muted">{incident.incident_number}</span>
          <h2 className={`text-lg font-bold ${SEV_COLORS[incident.severity]}`}>
            {incident.severity} · {incident.type.replace(/_/g, " ")}
          </h2>
        </div>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:bg-gray-100">✕</button>
      </div>

      <p className="mb-2 text-sm">{incident.description}</p>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-muted">
        <div>📍 {incident.location_text ?? `${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`}</div>
        <div>👥 {incident.people_affected} people affected</div>
        <div>🎯 Needs: {incident.required_capabilities.join(", ") || "general"}</div>
        <div>🔒 Confidence: {Math.round(incident.confidence_score * 100)}%</div>
      </div>

      {activeAssignment && (
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-blue-700">
            Current assignment · {activeAssignment.status.replace("_", " ")}
          </div>
          {(() => {
            const team = teams.find((t) => t.id === activeAssignment.resource_id);
            return (
              <div className="mt-1 text-sm">
                🚤 <b>{team?.team_code}</b>{" "}
                {activeAssignment.eta_minutes != null && `· ETA ${activeAssignment.eta_minutes} min`}
                {team && activeAssignment.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-2"
                    disabled={assigning !== null}
                    onClick={() =>
                      fetch(`/api/assignments/${activeAssignment.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "ACKNOWLEDGED" }),
                      }).then(onAssigned)
                    }
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {!activeAssignment && (
        <div className="flex-1">
          <h3 className="mb-2 text-sm font-semibold">Recommended Resources</h3>

          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-24 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          )}

          {error && (
            <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-[var(--color-primary)]">
              {error}
            </p>
          )}

          {!loading &&
            shown.map((r, idx) => {
              const team = teams.find((t) => t.id === r.resourceId);
              return (
                <div
                  key={r.resourceId}
                  className="mb-2 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {idx === 0 && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          BEST
                        </span>
                      )}
                      <b>{team?.team_code}</b>
                      {team && <Badge label={team.status} color={team.status} />}
                    </div>
                    <span className="text-lg font-bold text-[var(--color-accent)]">
                      {r.totalScore}
                    </span>
                  </div>

                  <div className="mt-1.5 text-xs text-muted">
                    🚤 {r.distanceKm} km · ~{r.etaMinutes} min ETA
                  </div>

                  {/* score breakdown bars */}
                  <div className="mt-2 space-y-1">
                    {(
                      [
                        ["Capability", r.capabilityScore],
                        ["ETA", r.etaScore],
                        ["Availability", r.availabilityScore],
                        ["Capacity", r.capacityScore],
                      ] as [string, number][]
                    ).map(([label, v]) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-[11px] text-muted">{label}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${v >= 75 ? "bg-green-500" : v >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                            style={{ width: `${v}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[11px] text-muted">{v}</span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs italic text-muted">{r.explanation}</p>

                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    disabled={assigning !== null}
                    onClick={() => assign(r.resourceId, r)}
                  >
                    {assigning === r.resourceId ? "Assigning..." : "ASSIGN"}
                  </Button>
                </div>
              );
            })}

          {!loading && recs.length > 3 && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="mb-2 w-full text-sm font-medium text-[var(--color-accent)]"
            >
              {showAll ? "Show top 3 only" : `See all alternatives (${recs.length - 3})`}
            </button>
          )}

          {/* manual override */}
          <div className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] p-3">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Manual Override
            </div>
            <div className="flex gap-2">
              <select
                value={manualPick}
                onChange={(e) => setManualPick(e.target.value)}
                className="h-8 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-2 text-xs"
              >
                <option value="">Select a team...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_code} ({t.status})
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="secondary"
                disabled={!manualPick || assigning !== null || Boolean(activeAssignment)}
                onClick={() => assign(manualPick)}
              >
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
