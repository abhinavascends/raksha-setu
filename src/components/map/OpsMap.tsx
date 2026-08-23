"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type {
  Alert,
  Assignment,
  Incident,
  ResourceTeam,
  Shelter,
} from "@/types/database";

import { CITY_CENTER } from "@/config/city";

const CENTER: [number, number] = CITY_CENTER;

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#d97706",
  LOW: "#16a34a",
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#16a34a",
  ASSIGNED: "#2563eb",
  EN_ROUTE: "#2563eb",
  ON_SCENE: "#7c3aed",
  RETURNING: "#0891b2",
  UNAVAILABLE: "#9ca3af",
};

function incidentIcon(severity: string, pulse: boolean) {
  const color = SEVERITY_COLORS[severity] ?? "#6b7280";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${pulse ? 22: 18}px;height:${pulse ? 22: 18}px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);background:${color};border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -18],
  });
}

function teamIcon(status: string) {
  const color = STATUS_COLORS[status] ?? "#6b7280";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;transform:rotate(45deg);
      background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export interface OpsMapProps {
  incidents: Incident[];
  teams: ResourceTeam[];
  shelters: Shelter[];
  assignments: Assignment[];
  alerts: Alert[];
  selectedIncidentId: string | null;
  showHeatmap: boolean;
  layers: { incidents: boolean; resources: boolean; shelters: boolean };
  onSelectIncident: (id: string) => void;
  onSelectTeam: (id: string) => void;
}

export default function OpsMap(props: OpsMapProps) {
  const { incidents, teams, shelters, assignments } = props;

  const activeIncidents = incidents.filter(
    (i) => !["RESOLVED", "CANCELLED"].includes(i.status)
  );

  const routes = useMemo(() => {
    return assignments
.filter((a) => ["EN_ROUTE", "ON_SCENE", "ACKNOWLEDGED", "PENDING"].includes(a.status))
.map((a) => {
        const team = teams.find((t) => t.id === a.resource_id);
        const incident = incidents.find((i) => i.id === a.incident_id);
        if (!team || !incident) return null;
        return {
          id: a.id,
          status: a.status,
          from: [team.latitude, team.longitude] as [number, number],
          to: [incident.latitude, incident.longitude] as [number, number],
        };
      })
.filter(Boolean) as {
      id: string;
      status: string;
      from: [number, number];
      to: [number, number];
    }[];
  }, [assignments, teams, incidents]);

  // OSRM road geometry (falls back to straight lines while loading/on error)
  const roadGeometries = useRoadRoutes(routes);

  const heatPoints = useMemo(
    () =>
      activeIncidents.map((i) => [
        i.latitude,
        i.longitude,
        { CRITICAL: 1.0, HIGH: 0.75, MEDIUM: 0.5, LOW: 0.25 }[i.severity] ?? 0.5,
      ]) as [number, number, number][],
    [activeIncidents]
  );

  return (
    <MapContainer center={CENTER} zoom={12} className="h-full w-full" zoomControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Heat approximation: translucent circles weighted by severity */}
      {props.showHeatmap &&
        heatPoints.map(([lat, lng, w], idx) => (
          <CircleMarker
            key={`heat-${idx}`}
            center={[lat, lng]}
            radius={30 * w + 15}
            pathOptions={{
              color: "transparent",
              fillColor: w >= 0.75 ? "#dc2626": "#f59e0b",
              fillOpacity: 0.18 * w + 0.05,
            }}
          />
        ))}

      {/* Weather warning zones */}
      {props.alerts
.filter((a) => a.affected_area && typeof a.affected_area === "object")
.map((a) => {
          const area = a.affected_area as { lat: number; lng: number; radius_km: number };
          const color =
            a.severity === "EXTREME"
              ? "#dc2626"
: a.severity === "SEVERE"
                ? "#ea580c"
: "#d97706";
          return (
            <CircleMarker
              key={a.id}
              center={[area.lat, area.lng]}
              radius={Math.min((area.radius_km ?? 10) * 2, 80)}
              pathOptions={{
                color,
                weight: 1.5,
                dashArray: "4 4",
                fillColor: color,
                fillOpacity: 0.08,
              }}
            >
              <Popup>
                <b> {a.title}</b>
                <br />
                <span style={{ fontSize: 11 }}>{a.description}</span>
              </Popup>
            </CircleMarker>
          );
        })}

      {/* Assignment routes */}
      {routes.map((r) => {
        const geometry = roadGeometries[r.id];
        return (
          <Polyline
            key={r.id}
            positions={geometry ?? [r.from, r.to]}
            pathOptions={{
              color: r.status === "EN_ROUTE" || r.status === "ON_SCENE" ? "#dc2626" : "#f87171",
              weight: 3.5,
              dashArray: ["PENDING", "ACKNOWLEDGED"].includes(r.status) ? "6 8" : undefined,
              opacity: 0.95,
            }}
          />
        );
      })}

      {props.layers.incidents &&
        activeIncidents.map((i) => (
          <Marker
            key={i.id}
            position={[i.latitude, i.longitude]}
            icon={incidentIcon(i.severity, i.severity === "CRITICAL")}
            eventHandlers={{ click: () => props.onSelectIncident(i.id) }}
          >
            <Popup>
              <b>{i.incident_number}</b>
              <br />
              {i.type.replace(/_/g, " ")} · {i.severity}
              <br />
              {i.people_affected} people affected
              {i.location_text && (
                <>
                  <br />
                  {i.location_text}
                </>
              )}
            </Popup>
          </Marker>
        ))}

      {props.layers.resources &&
        teams.map((t) => (
          <Marker
            key={t.id}
            position={[t.latitude, t.longitude]}
            icon={teamIcon(t.status)}
            eventHandlers={{ click: () => props.onSelectTeam(t.id) }}
          >
            <Popup>
              <b>{t.team_code}</b> · {t.name}
              <br />
              Status: {t.status}
              <br />
              Capabilities: {t.capabilities.join(", ") || "none"}
            </Popup>
          </Marker>
        ))}

      {props.layers.shelters &&
        shelters.map((s) => {
          const pct = Math.round((s.current_occupancy / s.total_capacity) * 100);
          return (
            <CircleMarker
              key={s.id}
              center={[s.latitude, s.longitude]}
              radius={9}
              pathOptions={{
                color: "white",
                weight: 2,
                fillColor: pct >= 90 ? "#dc2626": pct >= 50 ? "#d97706": "#16a34a",
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <b>{s.name}</b>
                <br />
                Occupancy: {s.current_occupancy}/{s.total_capacity} ({pct}%)
                <br />
                {s.address}
              </Popup>
            </CircleMarker>
          );
        })}

      {props.selectedIncidentId && <FlyTo selected={props.selectedIncidentId} incidents={incidents} />}
    </MapContainer>
  );
}

function FlyTo({
  selected,
  incidents,
}: {
  selected: string;
  incidents: Incident[];
}) {
  const map = useMap();
  const incident = incidents.find((i) => i.id === selected);
  if (incident) map.flyTo([incident.latitude, incident.longitude], 14, { duration: 0.6 });
  return null;
}

// ------------------------------------------------------------
// OSRM road routing with graceful degradation:
// while loading or if OSRM is unreachable we draw straight lines.
// ------------------------------------------------------------
function useRoadRoutes(
  routes: { id: string; from: [number, number]; to: [number, number] }[]
): Record<string, [number, number][]> {
  const [geometries, setGeometries] = useState<Record<string, [number, number][]>>({});
  const cacheRef = useRef<Map<string, [number, number][]>>(new Map());
  const cache = cacheRef.current;

  const routeKey = routes.map((r) => r.id).join(",");

  useEffect(() => {
    routes.forEach((r) => {
      if (cache.has(r.id)) {
        setGeometries((prev) =>
          prev[r.id] ? prev: {...prev, [r.id]: cache.get(r.id)! }
        );
        return;
      }
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${r.from[1]},${r.from[0]};${r.to[1]},${r.to[0]}?overview=full&geometries=geojson`;
      fetch(url)
.then((res) => res.json())
.then((json) => {
          const coords: [number, number][] | undefined =
            json?.routes?.[0]?.geometry?.coordinates?.map(
              (c: [number, number]) => [c[1], c[0]]
            );
          if (coords && coords.length > 1) {
            cache.set(r.id, coords);
            setGeometries((prev) => ({...prev, [r.id]: coords }));
          }
        })
.catch(() => {
          /* straight-line fallback already rendered */
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  return geometries;
}

