# Smart Log Analyzer & Anomaly Detector - Architecture Specification

## Overview
A full-stack application that ingests log entries, detects anomalies using deterministic algorithms, and provides AI-powered explanations for flagged entries.

## Technology Stack
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with `pg` client
- **Frontend**: React + Vite
- **AI**: OpenAI API for natural language explanations

## Architecture Components

### 1. Database Layer (PostgreSQL)
**Tables:**
- `logs` - Main log entries table
  - `id` (UUID, primary key)
  - `timestamp` (TIMESTAMPTZ, required)
  - `event_type` (VARCHAR, required)
  - `severity` (VARCHAR, required) - e.g., INFO, WARNING, ERROR, CRITICAL
  - `source` (VARCHAR, required)
  - `message` (TEXT, optional)
  - `metadata` (JSONB, optional) - for additional flexible data
  - `created_at` (TIMESTAMPTZ, auto)

- `anomaly_flags` - Flagged entries with detection metadata
  - `id` (UUID, primary key)
  - `log_id` (UUID, foreign key to logs)
  - `anomaly_score` (DECIMAL) - 0-100 score
  - `detection_reason` (TEXT) - Detailed explanation of why flagged
  - `detection_algorithm` (VARCHAR) - Which algorithm detected it
  - `ai_explanation` (TEXT, nullable) - LLM-generated plain English
  - `ai_root_cause` (TEXT, nullable) - LLM-suggested root cause
  - `ai_next_steps` (TEXT, nullable) - LLM-suggested actions
  - `flagged_at` (TIMESTAMPTZ, auto)
  - `ai_processed_at` (TIMESTAMPTZ, nullable)

### 2. Backend Services

#### A. Ingestion Service (`/backend/services/ingestion.js`)
- Validates log entries (required fields, timestamp format)
- Handles malformed data gracefully
- Persists valid entries to database
- Returns validation errors with clear feedback

#### B. Anomaly Detection Service (`/backend/services/detection.js`)
**Deterministic Algorithms (NOT LLM-based):**
1. **Severity Spike Detection**: Flags ERROR/CRITICAL events that exceed baseline frequency
2. **Timestamp Anomaly**: Detects out-of-sequence or future timestamps
3. **Rare Event Detection**: Flags event_types that appear < 1% of the time
4. **Source Burst Detection**: Single source generating > 20% of logs in short window
5. **Severity Escalation**: Same source going from INFO → WARNING → ERROR rapidly

Each algorithm produces:
- `anomaly_score` (0-100)
- `detection_reason` (technical explanation)
- `detection_algorithm` (algorithm name)

#### C. AI Explanation Service (`/backend/services/ai-explainer.js`)
- Takes a flagged log entry + detection reason
- Calls OpenAI API (GPT-4 or GPT-3.5-turbo)
- Generates:
  - Plain-English explanation for non-technical users
  - Likely root cause analysis
  - Recommended next steps
- Updates `anomaly_flags` table with AI results

#### D. Database Service (`/backend/services/database.js`)
- PostgreSQL connection pool management
- Query helpers for logs and anomaly_flags
- Transaction support for atomic operations

### 3. API Layer (`/backend/routes/`)

**Endpoints:**
- `POST /api/logs/ingest` - Ingest single or batch log entries
- `GET /api/logs` - List logs with pagination, filtering by severity/source/flagged
- `GET /api/logs/:id` - Get single log with anomaly details if flagged
- `GET /api/anomalies` - List all flagged entries with AI explanations
- `GET /api/anomalies/:id` - Get detailed anomaly info
- `POST /api/anomalies/:id/explain` - Trigger AI explanation for a flagged entry
- `GET /api/stats` - Dashboard statistics (total logs, flagged count, severity breakdown)

### 4. Frontend (React + Vite)

#### Components Structure:
```
/frontend/src/
  ├── components/
  │   ├── LogList.jsx           # Timeline view with flagged highlights
  │   ├── LogDetail.jsx         # Detailed view per entry
  │   ├── AnomalyBadge.jsx      # Visual indicator for flagged entries
  │   ├── SeverityIndicator.jsx # Color-coded severity
  │   └── StatsPanel.jsx        # Dashboard stats
  ├── services/
  │   └── api.js                # API client
  ├── App.jsx
  └── main.jsx
```

#### Views:
1. **Timeline View**: Chronological list of logs, flagged entries highlighted with severity colors
2. **Detail View**: Shows full log entry, anomaly score, detection reason, AI explanation (if available)
3. **Dashboard**: Stats panel with counts and severity breakdown

### 5. Data Flow

```
Log Entry → Validation → Persist to DB → Anomaly Detection
                                              ↓
                                         Flagged?
                                              ↓ Yes
                                    Create anomaly_flags entry
                                              ↓
                                    Async: Request AI Explanation
                                              ↓
                                    Update with AI results
```

### 6. Error Handling

**Validation Errors:**
- Missing required fields → 400 with field-specific messages
- Invalid timestamp format → 400 with example format
- Empty dataset → 200 with empty array, not error

**Runtime Errors:**
- Database connection failure → 503 Service Unavailable
- AI API failure → Log error, continue without AI explanation (graceful degradation)
- Malformed entries in batch → Partial success with error report per entry

### 7. Environment Configuration

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - For AI explanations
- `PORT` - Backend server port (default: 3000)
- `NODE_ENV` - development/production

### 8. Deployment Considerations

- Database migrations via init script
- Connection pooling for PostgreSQL (max 20 connections)
- AI explanation runs async to avoid blocking ingestion
- Frontend build serves static assets from Express in production

## Anomaly Detection Algorithm Details

### 1. Severity Spike Detection
- Tracks ERROR/CRITICAL count per 5-minute window
- Baseline: rolling average of previous 6 windows (30 min)
- Flags if current window > 2x baseline
- Score: `(current - baseline) / baseline * 50` (capped at 100)

### 2. Timestamp Anomaly
- Flags future timestamps (> 1 minute ahead of server time)
- Flags out-of-sequence entries (timestamp < most recent in batch)
- Score: 90 for future, 70 for out-of-sequence

### 3. Rare Event Detection
- Calculate event_type frequency across all logs
- Flag if event_type appears in < 1% of logs AND severity >= WARNING
- Score: `100 - (frequency_percentage * 100)`

### 4. Source Burst Detection
- Track logs per source in 10-minute window
- Flag if single source > 20% of all logs in window
- Score: `(source_percentage - 20) * 2` (capped at 100)

### 5. Severity Escalation
- For each source, track severity changes over 15-minute window
- Flag if pattern matches: INFO → WARNING → ERROR (at least 1 of each)
- Score: 85

## Success Criteria
- ✅ All log entries persisted with validation
- ✅ Anomaly detection runs deterministically (reproducible results)
- ✅ AI explanations generated via real API calls
- ✅ UI displays flagged entries with visual distinction
- ✅ Detail view shows detection reason + AI analysis
- ✅ Graceful error handling (no crashes on bad input)
- ✅ Clear user feedback for validation errors
