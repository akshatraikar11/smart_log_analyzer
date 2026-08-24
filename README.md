# Smart Log Analyzer & Anomaly Detector

A full-stack application that ingests log entries, detects anomalies using deterministic rules, and generates AI-powered explanations via the Groq API (LLaMA models). Built with Node.js/Express, PostgreSQL (Prisma ORM), and React/Vite.

---

## Setup Instructions

### Prerequisites

| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime for backend and frontend tooling |
| PostgreSQL | 12+ | Persistent storage for logs and anomaly flags |
| Groq API key | Free tier | AI-powered anomaly explanations (optional — app degrades gracefully) |

### 1. Clone and install

```bash
git clone <repo-url>
cd smart-log-analyzer

# Install all dependencies (root, backend, frontend)
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` in the project root and fill in your values:

```env
# Database — PostgreSQL connection string
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/log_analyzer

# Groq API — get a free key at https://console.groq.com
GROQ_API_KEY=gsk_...
# Intended: llama-3.3-70b-versatile. This Groq key 404s that model.
# Use a model your key can actually list at GET /openai/v1/models
GROQ_MODEL=openai/gpt-oss-20b

# Server
PORT=3000
NODE_ENV=development
```

### 3. Initialize the database

The project uses Prisma for schema management. You need to create the database first, enable the `uuid-ossp` extension, then push the schema:

```bash
# Create the database (if it doesn't exist)
psql -U postgres -c "CREATE DATABASE log_analyzer;"

# Enable uuid extension (required for UUID primary keys)
cd backend
node scripts/setup-uuid.js

# Push the Prisma schema to create tables
npx prisma db push
```

### 4. Generate sample data and run the pipeline

```bash
# From project root — generates ~400 synthetic log entries with injected anomalies
node scripts/generate-dataset.js

# Start the backend server
cd backend && npm run dev

# In a separate terminal — start the frontend dev server
cd frontend && npm run dev
```

### 5. Ingest data through the API (triggers detection + AI explanation)

The dataset generator creates a JSON file at `data/synthetic-logs.json`. To run the full pipeline (ingest → detect → explain), POST this data to the API:

```powershell
# PowerShell
$body = Get-Content "data/synthetic-logs.json" -Raw | ConvertFrom-Json
$payload = @{ logs = $body.logs } | ConvertTo-Json -Depth 10 -Compress
Invoke-RestMethod -Uri "http://localhost:3000/api/logs/ingest" `
  -Method POST -ContentType "application/json" -Body $payload
```

```bash
# bash/curl
curl -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d @- <<< "$(jq '{logs: .logs}' data/synthetic-logs.json)"
```

The ingest endpoint validates each entry, persists valid ones, runs anomaly detection, and queues AI explanations in the background.

### 6. Open the UI

Navigate to **http://localhost:5173**. The Vite dev server proxies `/api` requests to the Express backend at `localhost:3000`.

### Verified run (this machine)

`POST /api/ingest` completed end-to-end:

| Step | Result |
|------|--------|
| Ingest | 400 valid rows inserted, 3 malformed rows skipped (did not crash) |
| Detect | 14 entries flagged |
| AI-explain | 14/14 persisted; **5 real Groq responses**, **9 fallbacks** (timeouts / parse errors after one retry) |
| Display | Backend `http://localhost:3000`, UI `http://localhost:5173` — open a flagged row to see score, reason, and explanation |

---

## AI Configuration

### Provider and Model

| Setting | Value |
|---------|-------|
| **Provider** | [Groq](https://groq.com) (OpenAI-compatible REST API) |
| **SDK** | `openai` npm package pointed at `https://api.groq.com/openai/v1` |
| **Default model** | `llama-3.3-70b-versatile` (configurable via `GROQ_MODEL` env var) |
| **Temperature** | 0.4 |
| **Max tokens** | 600 |
| **Response format** | `json_object` — the model is instructed to return structured JSON |

### How it's called

1. When logs are ingested via `POST /api/logs/ingest`, any flagged entries are sent to the AI explainer **asynchronously** (via `setImmediate`), so the ingest response returns immediately.
2. The AI service (`backend/services/ai-explainer.js`) builds a structured prompt containing the log entry fields and the detection result, then calls `client.chat.completions.create()` with a system prompt ("You are an expert SRE…") and a user prompt asking for JSON with three keys: `explanation`, `rootCause`, `nextSteps`.
3. The response is parsed and persisted to the `anomaly_flags` table.
4. On failure (timeout, model not found, rate limit), the service **retries once**, then stores a **deterministic fallback** explanation so the UI is never left with an empty state.
5. Users can manually trigger (re)generation via `POST /api/anomalies/:id/explain` from the detail modal.

### Graceful degradation

If `GROQ_API_KEY` is not set or the API returns errors, the application continues to function — anomaly detection is purely deterministic and never depends on the LLM. The AI explanation section in the UI will show fallback text like *"AI explanation could not be generated…"* with a button to retry.

---

## Detection Approach

The system uses **4 deterministic rules** (no ML/LLM involvement). Each rule independently evaluates every ingested log entry and produces a `triggered: true/false`, a `score` (weight), and a `reason` string. When multiple rules trigger on the same entry, scores are summed (capped at 100) and reasons are concatenated.

### Rule 1: High Severity (`high_severity`)

**What it does:** Flags any log with `severity` of `ERROR` or `CRITICAL`, or any log whose metadata contains an HTTP status code ≥ 500.

**Why:** High-severity events are the most operationally significant signals in a log stream. A CRITICAL log almost always warrants investigation. This rule has zero false negatives for severe events — it's intentionally broad because the cost of missing a CRITICAL event is much higher than the cost of reviewing an extra flag.

**Score:** 25 (fixed weight).

### Rule 2: Failed Request Burst (`failed_request_burst`)

**What it does:** For a given log entry, queries all logs from the same `source` within a 60-second sliding window. If the count of failed requests (HTTP 4xx/5xx or `API_REQUEST` at ERROR/CRITICAL severity) exceeds 5, the entry is flagged.

**Why:** A single error is noise; a burst of errors from one source indicates a systemic problem (e.g., database down, upstream service unreachable). The sliding window approach catches cascading failures that a simple count would miss.

**Score:** Up to 30, scaled by `failedCount / threshold`.

### Rule 3: Rare Event Type (`rare_event_type`)

**What it does:** Calculates the corpus-wide frequency of the log's `event_type`. If that event type appears in < 1% of all logs (and the corpus has ≥ 50 entries), it's flagged.

**Why:** Rare event types often represent unusual system states — security scans, certificate expirations, privilege escalations — that deserve attention precisely because they're uncommon. The 1% threshold and minimum-sample-size guard prevent false positives on small datasets.

**Score:** Up to 25, inversely proportional to frequency.

### Rule 4: Off-Hours Activity (`off_hours_activity`)

**What it does:** Flags logs whose timestamp falls outside the 09:00–17:00 UTC window.

**Why:** In many production environments, activity outside business hours is unexpected and may indicate unauthorized access, runaway batch jobs, or misconfigured cron schedules. This is a simple but effective heuristic for surfacing temporal anomalies.

**Score:** 20 (fixed weight).

### What's NOT implemented (vs. the original ARCHITECTURE.md spec)

The architecture document specifies 5 algorithms. The actual implementation has 4, with these differences:

| Spec Algorithm | Status | Notes |
|----------------|--------|-------|
| Severity Spike Detection | ❌ Not implemented | Replaced by the simpler `high_severity` rule |
| Timestamp Anomaly (future/out-of-sequence) | ❌ Not implemented | — |
| Rare Event Detection | ✅ Implemented | As `rare_event_type` |
| Source Burst Detection | ❌ Not implemented | — |
| Severity Escalation (INFO→WARN→ERROR pattern) | ❌ Not implemented | — |
| **Failed Request Burst** | ✅ Implemented | Not in spec — added as a practical substitute |
| **Off-Hours Activity** | ✅ Implemented | Not in spec — added as a practical substitute |

---

## Assumptions Made

1. **PostgreSQL is running locally** on the default port 5432. The connection string is in `.env` — no Docker setup is provided.
2. **Business hours are 09:00–17:00 UTC.** The off-hours rule uses a hardcoded UTC window. For teams in other time zones, this would need configuration.
3. **The `uuid-ossp` extension is available** in your PostgreSQL installation (standard in most distributions).
4. **Groq API is used instead of OpenAI** despite the architecture doc saying "OpenAI." This was a deliberate choice — Groq's free tier provides fast inference on open-source LLaMA models without requiring a paid OpenAI subscription.
5. **The dataset generator produces deterministic anomaly patterns** — injected anomalies include: repeated DATABASE_ERROR bursts, off-hours BACKGROUND_SYNC events, rare security events (SECURITY_SCAN_FAILED, VAULT_ACCESS_DENIED, etc.), and unusual severity on benign events.
6. **Detection runs synchronously during ingestion.** For a small dataset (hundreds of entries), this is fine. For production-scale ingestion (millions), detection would need to be moved to a background worker.
7. **All logs in the synthetic dataset have business-hour timestamps** (by design in the generator), so the off-hours rule primarily catches the injected anomaly entries.
8. **The frontend proxies API calls through Vite's dev server** — no CORS issues in development. The production build would need the Express server to serve the static frontend files or a reverse proxy.

---

## Known Limitations / What's Incomplete

### Detection gaps

- **Only 4 of the 5 specified algorithms are implemented.** Severity escalation (detecting INFO→WARNING→ERROR progression from the same source) and timestamp anomaly detection (future/out-of-sequence timestamps) are missing. The implemented rules (`failed_request_burst`, `off_hours_activity`) are substitutes, not equivalents.
- **The off-hours rule is naive.** It flags *all* off-hours activity with the same score (20), regardless of severity. A CRITICAL event at 3 AM should score higher than a DEBUG log at 3 AM. No severity weighting is applied.
- **The rare-event-type threshold (1%) is static.** It doesn't adapt to dataset characteristics. On a dataset with many distinct event types, this threshold may be too aggressive; on a dataset with few types, it may miss rare events entirely.
- **Detection context is built once per batch.** If you ingest a batch of 400 logs, the `totalLogs` and `eventTypeCounts` used for rare-event detection are computed *before* the batch — not updated as each log is inserted. This means rare events within the batch itself won't be detected until re-analysis.

### AI explanation limitations

- **`llama-3.3-70b-versatile` (the assigned model) 404s on this Groq key.** Listing `/openai/v1/models` does not include it. The working override is `GROQ_MODEL=openai/gpt-oss-20b`. A verified ingest still produced **9/14 fallback explanations** (timeouts or JSON parse failures after one retry). Detection and the UI do not depend on Groq succeeding.
- **No streaming.** The explanation modal waits for the full LLM response before displaying anything. For a better UX, streaming tokens incrementally would be ideal.
- **One API call per flagged entry.** There's no batching of multiple anomalies into a single prompt. With many flags, this could hit rate limits quickly.
- **The prompt asks for JSON output**, but there's no schema validation beyond checking that the `explanation` field is non-empty. Malformed LLM responses fall back to deterministic text.

### Frontend limitations

- **No client-side routing.** The entire app is a single page — there's no URL-based navigation (e.g., `/logs/abc-123` for deep-linking to a log entry).
- **No real-time updates.** The UI doesn't poll or use WebSockets. If new logs are ingested while the page is open, you need to manually refresh or change filters.
- **No search.** You can filter by severity, source, and flagged status, but there's no free-text search across log messages.
- **Inline styles.** Several components (LogList, LogDetail, StatsPanel) use inline `style={{...}}` objects instead of CSS classes, making the styles harder to maintain and override.
- **The "Flagged only" filter uses a `flaggedOnly` query parameter** that requires the backend to JOIN with `anomaly_flags` — on very large datasets, this could be slow without proper indexing (indexes are defined in the Prisma schema, so this should be OK for moderate scale).

### Data / pipeline limitations

- **The `ingest-dataset.js` script bypasses detection.** It writes directly to the database via Prisma, so logs ingested via that script are not analyzed. You must use the API endpoint (`POST /api/logs/ingest`) to trigger the full pipeline.
- **No deduplication.** Ingesting the same dataset twice creates duplicate log entries. There's no unique constraint on `(timestamp, source, event_type)`.
- **The `database/init.js` script doesn't work standalone** because it requires the `pg` module, which is installed in `backend/node_modules`, not at the root. Use `npx prisma db push` from the `backend/` directory instead.
- **No automated tests.** The `backend/package.json` has `"test": "echo \"No tests yet\""`. There are no unit tests for the detection rules, no integration tests for the API endpoints, and no frontend tests.

### Infrastructure

- **No Docker Compose.** You need PostgreSQL installed locally — there's no containerized setup.
- **No CI/CD.** No GitHub Actions, no lint checks, no automated deployment.
- **No production deployment config.** The Express server doesn't serve the frontend build — you'd need nginx or similar to serve the Vite build output alongside the API.

---

## API Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/logs/ingest` | Ingest single or batch logs (triggers detection + AI) |
| `GET` | `/api/logs` | List logs with pagination and filtering |
| `GET` | `/api/logs/:id` | Get single log with anomaly details |
| `POST` | `/api/logs/:id/analyze` | Manually trigger anomaly detection |
| `GET` | `/api/anomalies` | List all flagged entries |
| `GET` | `/api/anomalies/:id` | Get detailed anomaly info |
| `POST` | `/api/anomalies/:id/explain` | Trigger AI explanation |
| `POST` | `/api/anomalies/explain-all` | Batch explain unprocessed flags |
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/stats/timeline` | Hourly log/flag trends |
| `GET` | `/api/stats/event-types` | Event type breakdown |

---

## Project Structure

```
smart-log-analyzer/
├── backend/
│   ├── config/
│   │   ├── database.js              # pg Pool (raw SQL queries for routes)
│   │   └── prisma.js                # Prisma client singleton
│   ├── models/
│   │   ├── logModel.js              # Prisma CRUD for logs table
│   │   └── anomalyFlagModel.js      # Prisma CRUD for anomaly_flags
│   ├── services/
│   │   ├── ingestion.js             # Validation + persistence
│   │   ├── detection.js             # Orchestrates 4 detection rules
│   │   ├── ai-explainer.js          # Groq LLM integration
│   │   └── detection/
│   │       ├── config.js            # Tunable thresholds
│   │       ├── helpers.js           # HTTP status extraction
│   │       └── rules/
│   │           ├── ruleHighSeverity.js
│   │           ├── ruleFailedRequestBurst.js
│   │           ├── ruleRareEventType.js
│   │           └── ruleOffHoursActivity.js
│   ├── routes/
│   │   ├── logs.js                  # /api/logs endpoints
│   │   ├── anomalies.js             # /api/anomalies endpoints
│   │   ├── stats.js                 # /api/stats endpoints
│   │   └── ingest.js                # /api/ingest endpoint
│   ├── prisma/
│   │   └── schema.prisma            # Database schema definition
│   └── server.js                    # Express app entry point
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LogList.jsx          # Timeline table with filters
│   │   │   ├── LogDetail.jsx        # Detail modal (all fields + AI)
│   │   │   ├── StatsPanel.jsx       # Dashboard stat cards
│   │   │   ├── AnomalyBadge.jsx     # ⚠️ Anomaly indicator
│   │   │   └── SeverityIndicator.jsx # Color-coded severity pill
│   │   ├── services/
│   │   │   └── api.js               # Axios API client
│   │   ├── App.jsx                  # Root component
│   │   ├── main.jsx                 # React entry point
│   │   └── index.css                # All styles
│   ├── index.html
│   └── vite.config.js               # Vite config with API proxy
├── database/
│   ├── schema.sql                   # Raw SQL schema (alternative to Prisma)
│   └── init.js                      # Schema migration script
├── scripts/
│   └── generate-dataset.js          # Synthetic log generator
├── data/
│   └── synthetic-logs.json          # Generated dataset
├── .env                             # Environment variables
├── .env.example
├── ARCHITECTURE.md                  # Original architecture spec
└── README.md                        # This file
```

---

## License

MIT
