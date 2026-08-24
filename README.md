# 🛟 RakshaSetu — Real-Time Disaster Response Coordination & Resource Optimization Platform

> **"We convert fragmented disaster reports into prioritized, actionable rescue assignments in real time."**

RakshaSetu is a district-level **decision-support system** for disaster response. It fuses citizen reports, official weather warnings, and live resource inventory into a single geospatial situation picture — then uses a transparent multi-factor **allocation engine** to recommend *which* rescue team should respond to *which* incident first.

**SIH Problem Statement:** PS-05 — Real-Time Disaster Early-Warning & Resource Coordination Platform

> 🗺️ **Demo district:** Rourkela, Odisha (Koel river flood scenario). District-specific data lives in `src/config/city.ts` + `supabase/seed.sql` — edit both to redeploy for any other district.

---

## ⚠️ The One-Line Positioning (read this first)

RakshaSetu is **not another alert app**. India already has SACHET/NDMA for warning dissemination. We are the **operational coordination layer that comes after the warning**: incoming incident → AI-assisted triage → confidence scoring → optimal resource assignment → live reassignment when conditions change.

---

## 🆚 How RakshaSetu Is Different From Existing Platforms

| Capability | SACHET / NDMA | IMD Portals | Ushahidi | GDACS | **RakshaSetu** |
|---|:---:|:---:|:---:|:---:|:---:|
| Official geo-targeted alerts | ✅ | ✅ | ❌ | ✅ | ✅ (consumes IMD feed) |
| Citizen report submission | Limited | ❌ | ✅ | ❌ | ✅ App + PWA + **SMS fallback** |
| Live operational map | ✅ | ✅ | ✅ | ✅ | ✅ Realtime (<1s) |
| **Resource inventory (teams/shelters/stock)** | ❌ | ❌ | Partial | ❌ | ✅ |
| **Multi-factor allocation engine** | ❌ | ❌ | ❌ | ❌ | ✅ Core feature |
| **Dynamic reassignment on failure** | ❌ | ❌ | ❌ | ❌ | ✅ |
| Report confidence / duplicate clustering | ❌ | ❌ | ❌ | ❌ | ✅ |
| Connectivity fallback (SMS channel) | ✅ SMS out | ❌ | ✅ | ❌ | ✅ SMS in → same pipeline |

### What makes our approach defensible in a Q&A

1. **We don't compete with SACHET.** They answer *"what is going to happen?"* We answer *"it's happening — which team goes where, right now?"*
2. **Citizen reporting alone isn't innovation** (Ushahidi does it). Our innovation starts *after* the report arrives: AI classification → confidence scoring → duplicate clustering → scored allocation.
3. **Nearest-team-only dispatch is naive.** A boat 2 km away without medical capability loses to an ambulance boat 5 km away when 3 elderly people are trapped. Our engine weighs severity, ETA, capability match, availability and capacity with configurable weights — and shows its reasoning for every recommendation.
4. **The system is a decision-support tool, not autonomous dispatch.** Operators confirm every assignment; the engine explains itself ("RT-002 is 2.8 km away (~6 min ETA); has all required capabilities (BOAT, MEDICAL)").

### The three technical differentiators

- **Allocation Engine** — transparent weighted scoring:
  `Score = 40% Severity + 20% ETA + 20% Capability + 10% Availability + 10% Capacity`
  (weights stored in DB, switchable between Balanced / Severity-First / Speed-First profiles)
- **Confidence-aware incidents** — official alerts ≈ 0.95 trust, a single unverified app report ≈ 0.50, but 5 citizens reporting the same spot within 30 min auto-cluster into one ≥0.80-confidence incident
- **Live reassignment** — flip any team to UNAVAILABLE mid-mission and the system interrupts the assignment and immediately recommends the best replacement

---

## 🏗️ Architecture

```
Citizen PWA (/report)      Field Team (/team)      Shelter Mgr (/shelter-manage)
        │                        │                        │
        └────────────┬───────────┴────────────────────────┘
                     ▼
        Next.js API routes (allocation, assignments,
        simulation, SMS webhook, classify, alert sync)
                     ▼
┌─────────────────────────────────────────────┐
│              Supabase (Postgres)            │
│  RLS policies · triggers · PostGIS ·        │
│  Auth · Realtime (postgres_changes)         │
└─────────────────────────────────────────────┘
                     ▼
        Operator Dashboard (/dashboard/map)
   Leaflet live map · allocation UI · heatmap ·
   IMD banner · simulation controls · stats bar
                     ▲
   External: Gemini API (classification, optional)
             IMD API (warnings, optional w/ fallback)
             OSRM    (road routing, free, no key)
```

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind 4 | One deployable, server components + client realtime |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) | Managed, free tier, zero WebSocket infra needed |
| Maps | Leaflet + React-Leaflet + OSM tiles | Free, no API key, plugin ecosystem |
| Routing | OSRM public server | Free road routing, graceful straight-line fallback |
| AI | Google Gemini 2.0 Flash | Free tier; deterministic rule-based fallback if unavailable |
| Tests | Node built-in test runner (`node:test`) | Zero dependencies |

### Key source map

```
src/
├── lib/
│   ├── allocation.ts        # ⭐ Allocation engine (pure functions, unit-tested)
│   ├── classifier.ts        # Gemini classification + rule-based fallback
│   ├── confidence.ts        # Confidence scoring model
│   ├── sms.ts               # "SOS FLOOD ward 12 bridge 5 people" parser
│   ├── imd.ts               # IMD sync w/ labelled fallback data
│   ├── simulation.ts        # Scripted disaster scenario engine
│   ├── auth.ts              # API-route session guards (incl. optional/guest auth)
│   ├── roleRouting.ts       # post-login routing per role
│   └── supabase/            # browser/server clients
├── app/
│   ├── api/
│   │   ├── incidents/       # CRUD + intelligence pipeline
│   │   ├── assignments/     # allocate (top-3) / create / status flow
│   │   ├── resources/[id]   # status flips + AUTO-REALLOCATION
│   │   ├── sms/incoming     # connectivity-fallback webhook
│   │   ├── classify/        # AI preview endpoint
│   │   ├── alerts/sync      # IMD pull (15-min cadence)
│   │   └── simulation       # start / stop / reset
│   ├── (dashboard)/dashboard/
│   │   ├── map/             # ⭐ Ops console (golden demo)
│   │   ├── incidents/       # incident triage table
│   │   ├── assignments/     # assignment board + status flow
│   │   ├── resources/       # fleet & team status management
│   │   ├── shelters/        # shelter occupancy & stock
│   │   └── simulation/      # scripted disaster scenario controls
│   ├── report/              # citizen 3-step PWA wizard (+ anonymous reports)
│   ├── team/                # field team mission view
│   └── shelter-manage/      # shelter occupancy view
supabase/migrations/         # 0001 schema … 0008 policies (full list in setup)
supabase/seed.sql            # Rourkela flood demo dataset (idempotent)
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- A free [Supabase](https://supabase.com) project

### 1. Install & configure

```bash
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # Project Settings → API → anon public

# Optional (app degrades gracefully without these):
GEMINI_API_KEY=                                # aistudio.google.com — AI classification
IMD_API_KEY=                                   # api.imd.gov.in — real weather warnings
SMS_WEBHOOK_SECRET=                            # protect SMS webhook in production
```

> ⚠️ Use the **anon key**, never the service-role key or database URI — `NEXT_PUBLIC_*` values ship to browsers.

### 2. Database setup

In Supabase Dashboard → **SQL Editor**, run in order:

1. `supabase/migrations/0001_init.sql` — schema, enums, triggers, RLS, realtime
2. `supabase/migrations/0002_storage_and_claims.sql` — photo bucket + field-team policies
3. `supabase/migrations/0003_clustering.sql` — duplicate-report clustering
4. `supabase/migrations/0004_shelter_claims.sql` — shelter managers claim unmanaged shelters
5. `supabase/migrations/0005_sync_trigger_security.sql` — trigger security hardening
6. `supabase/migrations/0006_anonymous_reports.sql` — guest (no-account) emergency reports
7. `supabase/migrations/0007_official_email_domain.sql` — official roles require a `.gov.in` email
8. `supabase/migrations/0008_team_self_status.sql` — field teams manage their own duty status
9. `supabase/seed.sql` — Rourkela demo dataset (6 teams, 3 shelters, 4 incidents, IMD alert)

Then in **Authentication → Providers → Email**: disable **Confirm email** (fastest demo path).

### 3. Create accounts

| Role | Register as | Lands on |
|---|---|---|
| Control room operator | "Control Room Operator" (`.gov.in` email required) | `/dashboard` |
| Rescue team member | "Field Rescue Team" (`.gov.in` email required) | `/team` → claim a team |
| Shelter staff | "Shelter Manager" (`.gov.in` email required) | `/shelter-manage` |
| Citizen | "Citizen" (any email, or report anonymously) | `/report` |

Promote the first operator via SQL Editor:

```sql
update profiles set role = 'OPERATOR' where role = 'CITIZEN';
```

> Manage users only through **Authentication → Users**, never Table Editor.

### 4. Run

```bash
npm run dev        # http://localhost:3000
npm run test       # 21 unit tests (allocation engine + SMS parser)
npm run lint
npm run build
```

---

## 🧪 How to Test Everything

### Automated tests

```bash
npm run test
```

Covers the two pure-logic cores: **allocation scoring** (13 tests — capability gaps, availability states, capacity saturation, ranking order) and the **SMS parser** (8 tests — type detection, severity escalation, count extraction, malformed input rejection).

### Manual end-to-end flows (each takes ~2 min)

Open two browser windows side-by-side: **Operator dashboard** + second window (incognito) as Citizen/Field Team.

**Flow A — Citizen report → live map**
1. Incognito window: register as Citizen → lands on `/report`
2. Complete the 3-step wizard (category → description → GPS). Allow location access.
3. Watch the operator map: a new severity-colored pin appears **within ~1 second** — no refresh.

**Flow B — The golden demo (allocation)**
1. On `/dashboard/map`, click red pin `INC-1001` (critical, needs BOAT+MEDICAL)
2. Panel shows top-3 ranked teams with score bars and plain-English explanations
3. Click **ASSIGN** on the best → route line draws team→incident (OSRM roads), team status flips to ASSIGNED, stats update everywhere instantly

**Flow C — Judge's live-change test (reassignment)** ⭐
1. With an active assignment from Flow B, go to the **Teams** tab
2. Click **Mark Unavailable** on the assigned team
3. Assignment becomes INTERRUPTED and the amber ⚡ banner instantly recommends the replacement team with new ETA/score

**Flow D — Duplicate clustering + confidence**
1. Submit two citizen reports of the same type near each other (pick nearby points / same landmark text)
2. Incident cards show rising 🔒 confidence % and a `👥 N reports` cluster badge

**Flow E — Field team loop**
1. Second window: register as Field Team → `/team` → claim RT-001
2. Assign an incident to RT-001 from the dashboard
3. Field window: Acknowledge → En Route → On Scene → Resolved — each click updates the dashboard live

**Flow F — Simulation (fully scripted, no manual input)**
1. Open `/dashboard/simulation` → **▶ Start**
2. Over 75s: floods appear, a critical rescue spawns, RT-002 breaks down, the Chhend Colony shelter fills to ~97%, a pregnant-woman evacuation request lands — all streaming to the map
3. Finish your pitch, click **♻ Reset**, repeat forever

**Flow G — SMS fallback (no internet scenario)**
```powershell
curl.exe -X POST http://localhost:3000/api/sms/incoming ^
  -H "Content-Type: application/json" ^
  -d "{\"from\":\"+919800000000\",\"text\":\"SOS FLOOD near ward 12 bridge 8 people trapped\"}"
```
Response includes the created incident number and an auto-reply message — the same pipeline, source-tagged `SMS` with reduced confidence (0.45).

**Flow H — AI classification preview**
```powershell
curl.exe -X POST http://localhost:3000/api/classify ^
  -H "Content-Type: application/json" ^
  -b "<your-supabase-cookies>" ^
  -d "{\"text\":\"bridge collapsed, school bus stuck, children screaming\"}"
```
Returns `{type: STRUCTURAL_COLLAPSE, severity: CRITICAL, requiredCapabilities: [HEAVY_EQUIPMENT, MEDICAL], ...}`.

### What graceful degradation looks like (test by removing keys)

| Missing dependency | Behavior |
|---|---|
| `GEMINI_API_KEY` | Rule-based keyword classifier (deterministic, offline) |
| `IMD_API_KEY` | Clearly-labelled simulated rainfall warning so demos always show the banner |
| OSRM unreachable | Routes render as straight lines |
| Supabase Realtime blocked | Green dot turns amber; data still loads on refresh |

---

## 🔐 Security Model

- **RLS everywhere**: citizens can only create reports; only OPERATOR/ADMIN mutate resources/assignments; FIELD_TEAM can only progress their own assignments and escalate incidents
- **No secrets in the browser**: only URL + anon key ship client-side; all privileged logic runs in API routes under session auth
- **SMS webhook**: optional shared-secret header (`x-sms-secret`) for production gateways
- **Decision-support, not auto-dispatch**: high-impact actions require operator confirmation

---

## 🎤 Judge Q&A Quick Answers

**"SACHET already sends alerts. Why you?"**
SACHET disseminates warnings; we're the coordination layer after the warning — turning reports + resources into assignments.

**"Why trust citizen reports?"**
We don't treat them as ground truth. Source-based confidence, corroboration clustering (500 m / 30 min), and operator confirmation before dispatch.

**"Why is your algorithm better than nearest-team?"**
Distance ≠ suitability. We score severity, ETA, capability, availability, capacity with configurable weights — and we can explain every recommendation in plain English.

**"What happens when no internet?"**
SMS channel feeds the identical incident pipeline (`source=SMS`, lower confidence); IVR-ready design.

**"National scale?"**
District-level node by design; federation across districts/states via aggregation is architectural, not a rewrite.

---

## 📄 License

Built for Smart India Hackathon 2026. Demo dataset is synthetic; IMD/Gemini integrations degrade gracefully when unconfigured.
