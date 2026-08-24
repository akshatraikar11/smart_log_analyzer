# PostgreSQL Database Guide - Smart Log Analyzer

Complete guide to exploring and understanding your database.

## 🚀 Quick Start

### Connect to Database

```bash
# Open Command Prompt or PowerShell
psql -U postgres -d log_analyzer

# Enter password when prompted: Akshat@11
```

You should see:
```
log_analyzer=#
```

## 📚 Basic Commands

### Navigation
```sql
\l          -- List all databases
\c log_analyzer  -- Connect to log_analyzer database
\dt         -- List all tables
\d logs     -- Describe logs table structure
\q          -- Quit psql
```

### Help
```sql
\?          -- Show all psql commands
\h SELECT   -- Help for specific SQL command
```

## 🔍 Step-by-Step Exploration

### Step 1: Verify Tables Exist

```sql
\dt
```

Expected output:
```
 Schema |     Name      | Type  |  Owner   
--------+---------------+-------+----------
 public | anomaly_flags | table | postgres
 public | logs          | table | postgres
```

### Step 2: Check Sample Data

```sql
SELECT COUNT(*) FROM logs;
```

Should show: `10` (from the init script)

### Step 3: View First Few Logs

```sql
SELECT 
    timestamp,
    severity,
    source,
    event_type
FROM logs
ORDER BY timestamp DESC
LIMIT 5;
```

### Step 4: See Which Logs are Flagged

```sql
SELECT 
    l.timestamp,
    l.severity,
    l.source,
    l.event_type,
    CASE 
        WHEN af.id IS NOT NULL THEN 'FLAGGED ⚠️'
        ELSE 'Normal ✓'
    END as status
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
ORDER BY l.timestamp DESC;
```

### Step 5: View Anomaly Details

```sql
SELECT 
    anomaly_score,
    detection_algorithm,
    detection_reason
FROM anomaly_flags
ORDER BY anomaly_score DESC;
```

## 📊 Understanding the Schema

### Logs Table
```sql
\d logs
```

**Key Columns:**
- `id` (UUID): Unique identifier
- `timestamp`: When event occurred
- `event_type`: Type of event (e.g., "USER_LOGIN")
- `severity`: INFO, WARNING, ERROR, CRITICAL, DEBUG
- `source`: System that generated log (e.g., "api-service")
- `message`: Descriptive message
- `metadata`: JSON field for extra data
- `created_at`: When inserted into database

### Anomaly Flags Table
```sql
\d anomaly_flags
```

**Key Columns:**
- `id` (UUID): Unique identifier
- `log_id`: Links to logs table (foreign key)
- `anomaly_score`: 0-100 score
- `detection_reason`: Why it was flagged
- `detection_algorithm`: Which algorithm caught it
- `ai_explanation`: Plain-English explanation (from OpenAI)
- `ai_root_cause`: Suggested root cause
- `ai_next_steps`: Recommended actions
- `flagged_at`: When flagged
- `ai_processed_at`: When AI explanation was generated

## 🎯 Common Use Cases

### Find All Critical Errors

```sql
SELECT 
    timestamp,
    source,
    event_type,
    message
FROM logs
WHERE severity = 'CRITICAL'
ORDER BY timestamp DESC;
```

### Find Most Problematic Source

```sql
SELECT 
    source,
    COUNT(*) as total_logs,
    COUNT(CASE WHEN severity IN ('ERROR', 'CRITICAL') THEN 1 END) as error_count,
    ROUND(
        COUNT(CASE WHEN severity IN ('ERROR', 'CRITICAL') THEN 1 END)::numeric 
        / COUNT(*) * 100, 
        2
    ) as error_rate_percent
FROM logs
GROUP BY source
ORDER BY error_count DESC;
```

### See Logs from Specific Time Range

```sql
SELECT 
    timestamp,
    severity,
    source,
    event_type
FROM logs
WHERE timestamp >= NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

### Find Logs with Highest Anomaly Scores

```sql
SELECT 
    l.timestamp,
    l.severity,
    l.source,
    l.event_type,
    af.anomaly_score,
    af.detection_algorithm
FROM logs l
INNER JOIN anomaly_flags af ON l.id = af.log_id
ORDER BY af.anomaly_score DESC
LIMIT 10;
```

### Check AI Explanation Status

```sql
SELECT 
    COUNT(*) as total_flagged,
    COUNT(CASE WHEN ai_processed_at IS NOT NULL THEN 1 END) as has_ai_explanation,
    COUNT(CASE WHEN ai_processed_at IS NULL THEN 1 END) as needs_ai_explanation
FROM anomaly_flags;
```

### View a Complete Anomaly Report

```sql
SELECT 
    l.timestamp,
    l.severity,
    l.source,
    l.event_type,
    l.message,
    af.anomaly_score,
    af.detection_algorithm,
    af.detection_reason,
    af.ai_explanation,
    af.ai_root_cause
FROM logs l
INNER JOIN anomaly_flags af ON l.id = af.log_id
ORDER BY af.anomaly_score DESC
LIMIT 3;
```

## 🎨 Pretty Output for Demos

### Dashboard-Style Summary

```sql
SELECT 
    '📊 LOGS SUMMARY' as "=== SECTION ===" 
UNION ALL
SELECT '─────────────────────'
UNION ALL
SELECT 'Total Logs: ' || COUNT(*)::text FROM logs
UNION ALL
SELECT 'Total Flagged: ' || COUNT(*)::text FROM anomaly_flags
UNION ALL
SELECT '─────────────────────'
UNION ALL
SELECT '📈 BY SEVERITY'
UNION ALL
SELECT '─────────────────────'
UNION ALL
SELECT severity || ': ' || COUNT(*)::text 
FROM logs 
GROUP BY severity
ORDER BY 
    CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'ERROR' THEN 2
        WHEN 'WARNING' THEN 3
        WHEN 'INFO' THEN 4
        WHEN 'DEBUG' THEN 5
    END;
```

### Timeline View (Like the UI)

```sql
SELECT 
    to_char(timestamp, 'Mon DD HH24:MI:SS') as "Time",
    RPAD(severity, 10) as "Severity",
    RPAD(source, 15) as "Source",
    RPAD(event_type, 20) as "Event Type",
    CASE 
        WHEN af.anomaly_score IS NOT NULL 
        THEN '⚠️ ' || af.anomaly_score::text 
        ELSE '✓' 
    END as "Status"
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
ORDER BY timestamp DESC
LIMIT 10;
```

## 🔧 Maintenance Queries

### Delete All Data (Keep Tables)

```sql
-- WARNING: This deletes all data!
TRUNCATE TABLE anomaly_flags CASCADE;
TRUNCATE TABLE logs CASCADE;
```

### Delete Specific Log

```sql
-- Replace LOG_ID with actual ID
DELETE FROM logs WHERE id = 'LOG_ID';
-- anomaly_flags will auto-delete due to CASCADE
```

### Delete Old Logs (Older than 30 days)

```sql
DELETE FROM logs 
WHERE timestamp < NOW() - INTERVAL '30 days';
```

### Vacuum Database (Optimize)

```sql
VACUUM ANALYZE logs;
VACUUM ANALYZE anomaly_flags;
```

## 📈 Analytics Queries

### Hourly Log Volume

```sql
SELECT 
    date_trunc('hour', timestamp) as hour,
    COUNT(*) as log_count,
    COUNT(af.id) as flagged_count
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
GROUP BY hour
ORDER BY hour DESC
LIMIT 24;
```

### Algorithm Effectiveness

```sql
SELECT 
    detection_algorithm,
    COUNT(*) as times_triggered,
    ROUND(AVG(anomaly_score), 2) as avg_score,
    MAX(anomaly_score) as max_score
FROM anomaly_flags
GROUP BY detection_algorithm
ORDER BY times_triggered DESC;
```

### Event Type Distribution

```sql
SELECT 
    event_type,
    COUNT(*) as occurrences,
    COUNT(af.id) as flagged,
    ROUND(COUNT(af.id)::numeric / COUNT(*) * 100, 2) as flag_rate
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
GROUP BY event_type
ORDER BY occurrences DESC;
```

## 🎓 For Your Hackathon Demo

### Show Live Data Flow

1. **Before ingesting new log:**
```sql
SELECT COUNT(*) as current_count FROM logs;
```

2. **Ingest via API** (use curl in another terminal)

3. **Show new count:**
```sql
SELECT COUNT(*) as new_count FROM logs;
```

4. **Show the new log:**
```sql
SELECT * FROM logs ORDER BY created_at DESC LIMIT 1;
```

5. **Check if it was flagged:**
```sql
SELECT 
    l.*,
    af.anomaly_score,
    af.detection_reason
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
ORDER BY l.created_at DESC
LIMIT 1;
```

### Impressive Stats for Judges

```sql
-- Show comprehensive stats
SELECT 
    'Total Logs' as metric,
    COUNT(*)::text as value
FROM logs
UNION ALL
SELECT 
    'Anomalies Detected',
    COUNT(*)::text
FROM anomaly_flags
UNION ALL
SELECT 
    'Detection Algorithms',
    COUNT(DISTINCT detection_algorithm)::text
FROM anomaly_flags
UNION ALL
SELECT 
    'AI Explanations Generated',
    COUNT(*)::text
FROM anomaly_flags
WHERE ai_processed_at IS NOT NULL
UNION ALL
SELECT 
    'Unique Sources Monitored',
    COUNT(DISTINCT source)::text
FROM logs
UNION ALL
SELECT 
    'Event Types Tracked',
    COUNT(DISTINCT event_type)::text
FROM logs;
```

## 🐛 Troubleshooting

### Can't Connect?
```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Check if database exists
psql -U postgres -c "\l" | findstr log_analyzer
```

### No Data?
```bash
# Re-run initialization
cd backend
npm run db:init
```

### Permission Denied?
```sql
-- Grant permissions if needed
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
```

### Slow Queries?
```sql
-- Check if indexes exist
\di

-- Rebuild indexes if needed
REINDEX TABLE logs;
REINDEX TABLE anomaly_flags;
```

## 💡 Tips & Tricks

### Save Query Results to File
```bash
# In psql
\o output.txt
SELECT * FROM logs;
\o  -- Stop output to file
```

### Copy Table Data to CSV
```bash
# In psql
\copy (SELECT * FROM logs) TO 'logs_export.csv' CSV HEADER;
```

### Pretty Print JSON Metadata
```sql
SELECT 
    id,
    jsonb_pretty(metadata) as formatted_metadata
FROM logs
WHERE metadata != '{}'::jsonb
LIMIT 5;
```

### Time-based Filtering (Human Readable)
```sql
-- Logs from last hour
WHERE timestamp > NOW() - INTERVAL '1 hour'

-- Logs from today
WHERE timestamp >= CURRENT_DATE

-- Logs from specific date
WHERE DATE(timestamp) = '2024-08-24'
```

## 📝 Quick Reference File

All these queries are saved in: `database/queries.sql`

You can run them all at once:
```bash
psql -U postgres -d log_analyzer -f database/queries.sql
```

## 🎤 For Viva Questions

**Q: Show me the database structure**
```sql
\dt
\d logs
\d anomaly_flags
```

**Q: How do you track anomalies?**
```sql
SELECT * FROM anomaly_flags LIMIT 1;
```

**Q: Show me a real anomaly**
```sql
SELECT 
    l.event_type,
    l.severity,
    l.message,
    af.anomaly_score,
    af.detection_reason
FROM logs l
INNER JOIN anomaly_flags af ON l.id = af.log_id
ORDER BY af.anomaly_score DESC
LIMIT 1;
```

Good luck with your demo! 🚀
