# Log Ingestion Guide

## 3 Ways to Ingest Logs

### 1. Via API (Recommended for Demo)

**Single Log:**
```bash
curl -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2024-08-24T10:30:00Z",
    "event_type": "DATABASE_ERROR",
    "severity": "CRITICAL",
    "source": "api-service",
    "message": "Connection pool exhausted - 0/20 connections available"
  }'
```

**Batch Logs:**
```bash
curl -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      {
        "timestamp": "2024-08-24T10:30:00Z",
        "event_type": "USER_LOGIN",
        "severity": "INFO",
        "source": "auth-service",
        "message": "User john@example.com logged in"
      },
      {
        "timestamp": "2024-08-24T10:31:00Z",
        "event_type": "DATABASE_ERROR",
        "severity": "ERROR",
        "source": "api-service",
        "message": "Query timeout after 30s"
      },
      {
        "timestamp": "2024-08-24T10:32:00Z",
        "event_type": "DATABASE_ERROR",
        "severity": "CRITICAL",
        "source": "api-service",
        "message": "Database connection lost"
      }
    ]
  }'
```

### 2. Via UI (QuickIngest Component)

I've created a `QuickIngest` component with preset buttons:
- 🔴 Critical DB Error
- 🟡 Memory Warning  
- 🟢 Normal Login
- ➕ Custom Log (opens form)

**To add to your UI**, open `frontend/src/components/StatsPanel.jsx` and add at the bottom:

```jsx
import QuickIngest from './QuickIngest'

// In your render, before closing the component:
<div style={{ marginTop: '1rem', padding: '1rem', background: '#f7fafc', borderRadius: '4px' }}>
  <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: '#4a5568' }}>
    QUICK INGEST
  </h4>
  <QuickIngest onSuccess={onRefresh} />
</div>
```

### 3. Via pgAdmin/psql (Direct Database)

```sql
INSERT INTO logs (timestamp, event_type, severity, source, message)
VALUES 
  (NOW(), 'API_TIMEOUT', 'ERROR', 'payment-service', 'Payment processing timed out after 30s'),
  (NOW(), 'DISK_FULL', 'CRITICAL', 'worker-service', 'Disk usage at 98% - only 2GB free'),
  (NOW(), 'USER_LOGOUT', 'INFO', 'auth-service', 'User successfully logged out');
```

## Quick Test Scenarios

### Scenario 1: Severity Spike
Ingest 5+ ERROR/CRITICAL logs rapidly:

```bash
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/logs/ingest \
    -H "Content-Type: application/json" \
    -d "{
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"event_type\": \"DATABASE_ERROR\",
      \"severity\": \"CRITICAL\",
      \"source\": \"api-service\",
      \"message\": \"Database error $i\"
    }"
  sleep 1
done
```

### Scenario 2: Rare Event
```bash
curl -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2024-08-24T10:30:00Z",
    "event_type": "NUCLEAR_REACTOR_MELTDOWN",
    "severity": "CRITICAL",
    "source": "reactor-core",
    "message": "This will definitely be flagged as rare!"
  }'
```

### Scenario 3: Source Burst
Ingest 20+ logs from same source rapidly:

```bash
for i in {1..25}; do
  curl -X POST http://localhost:3000/api/logs/ingest \
    -H "Content-Type: application/json" \
    -d "{
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"event_type\": \"API_REQUEST\",
      \"severity\": \"INFO\",
      \"source\": \"spammy-service\",
      \"message\": \"Request $i\"
    }" &
done
wait
```

## PowerShell Versions (For Windows)

**Single log:**
```powershell
$body = @{
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    event_type = "DATABASE_ERROR"
    severity = "CRITICAL"
    source = "api-service"
    message = "Connection pool exhausted"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/logs/ingest" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

**Batch logs:**
```powershell
$body = @{
    logs = @(
        @{
            timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            event_type = "USER_LOGIN"
            severity = "INFO"
            source = "auth-service"
            message = "User logged in"
        },
        @{
            timestamp = (Get-Date).AddSeconds(1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            event_type = "DATABASE_ERROR"
            severity = "ERROR"
            source = "api-service"
            message = "Query timeout"
        }
    )
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:3000/api/logs/ingest" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

## Sample Dataset

I've created 50+ diverse logs. Run:

```bash
cd backend
node scripts/ingest-dataset.js
```

This will:
- Clear existing logs
- Ingest 50 realistic logs
- Mix of severities (INFO, WARNING, ERROR, CRITICAL)
- Various sources (api-service, auth-service, worker-service, etc.)
- Multiple event types
- Some patterns to trigger anomaly detection

## For Your Demo

**Best approach:**
1. Start with existing sample data (10 logs from init)
2. Show the UI and explain detection
3. Ingest a CRITICAL log via curl/Postman
4. Watch it appear in UI with anomaly flag
5. Generate AI explanation
6. Show the explanation to judges

**Live demo command:**
```bash
curl -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"event_type\": \"DEMO_CRITICAL_ERROR\",
    \"severity\": \"CRITICAL\",
    \"source\": \"demo-service\",
    \"message\": \"This is a live demo of anomaly detection!\"
  }"
```

Then in UI:
1. Refresh (or auto-refresh if you added it)
2. Find the new log (should be flagged)
3. Click it
4. Click "Generate AI Explanation"
5. Show the Groq-powered explanation

## Validation Examples

**Missing timestamp (400 error):**
```bash
curl -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "TEST",
    "severity": "INFO",
    "source": "test"
  }'
```

**Invalid severity (400 error):**
```bash
curl -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2024-08-24T10:30:00Z",
    "event_type": "TEST",
    "severity": "SUPER_DUPER_CRITICAL",
    "source": "test"
  }'
```

**Malformed timestamp (400 error):**
```bash
curl -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "not-a-date",
    "event_type": "TEST",
    "severity": "INFO",
    "source": "test"
  }'
```

All should return clear error messages explaining what's wrong!
