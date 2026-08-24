-- Smart Log Analyzer - Common Database Queries
-- Run these in psql or pgAdmin after connecting to log_analyzer database

-- =====================================================
-- TABLE EXPLORATION
-- =====================================================

-- List all tables
\dt

-- View table structures
\d logs
\d anomaly_flags

-- View indexes
\di

-- =====================================================
-- VIEW ALL DATA
-- =====================================================

-- All logs (basic)
SELECT * FROM logs ORDER BY timestamp DESC;

-- All logs (formatted)
SELECT 
    id,
    timestamp,
    severity,
    source,
    event_type,
    message
FROM logs
ORDER BY timestamp DESC;

-- All anomaly flags
SELECT * FROM anomaly_flags ORDER BY anomaly_score DESC;

-- Use the convenience view
SELECT * FROM flagged_logs_view;

-- =====================================================
-- STATISTICS & COUNTS
-- =====================================================

-- Total counts
SELECT 
    COUNT(*) as total_logs,
    COUNT(DISTINCT source) as unique_sources,
    COUNT(DISTINCT event_type) as unique_event_types
FROM logs;

-- Logs by severity
SELECT 
    severity,
    COUNT(*) as count,
    ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM logs
GROUP BY severity
ORDER BY count DESC;

-- Flagged vs Normal
SELECT 
    CASE 
        WHEN af.id IS NOT NULL THEN 'Flagged'
        ELSE 'Normal'
    END as status,
    COUNT(*) as count
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
GROUP BY status;

-- =====================================================
-- ANOMALY ANALYSIS
-- =====================================================

-- Top anomalies by score
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

-- Detection algorithm usage
SELECT 
    detection_algorithm,
    COUNT(*) as times_used,
    AVG(anomaly_score) as avg_score,
    MAX(anomaly_score) as max_score,
    MIN(anomaly_score) as min_score
FROM anomaly_flags
GROUP BY detection_algorithm
ORDER BY times_used DESC;

-- Anomaly rate by source
SELECT 
    l.source,
    COUNT(DISTINCT l.id) as total_logs,
    COUNT(DISTINCT af.id) as flagged_logs,
    ROUND(COUNT(DISTINCT af.id)::numeric / COUNT(DISTINCT l.id) * 100, 2) as flag_rate_percent
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
GROUP BY l.source
ORDER BY flag_rate_percent DESC;

-- =====================================================
-- AI EXPLANATION STATUS
-- =====================================================

-- AI processing status
SELECT 
    COUNT(*) as total_flags,
    COUNT(CASE WHEN ai_processed_at IS NOT NULL THEN 1 END) as processed,
    COUNT(CASE WHEN ai_processed_at IS NULL THEN 1 END) as pending
FROM anomaly_flags;

-- View AI explanations
SELECT 
    l.id,
    l.timestamp,
    l.source,
    l.event_type,
    af.anomaly_score,
    af.ai_explanation,
    af.ai_root_cause,
    af.ai_processed_at
FROM logs l
INNER JOIN anomaly_flags af ON l.id = af.log_id
WHERE af.ai_processed_at IS NOT NULL
ORDER BY af.anomaly_score DESC;

-- =====================================================
-- TIME-BASED ANALYSIS
-- =====================================================

-- Recent logs (last 10)
SELECT 
    timestamp,
    severity,
    source,
    event_type,
    LEFT(message, 50) as message_preview
FROM logs
ORDER BY timestamp DESC
LIMIT 10;

-- Logs per hour (last 24 hours)
SELECT 
    date_trunc('hour', timestamp) as hour,
    COUNT(*) as log_count,
    COUNT(CASE WHEN severity IN ('ERROR', 'CRITICAL') THEN 1 END) as error_count
FROM logs
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Activity timeline
SELECT 
    date_trunc('hour', l.timestamp) as hour,
    COUNT(DISTINCT l.id) as total_logs,
    COUNT(DISTINCT af.id) as flagged_logs
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
WHERE l.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour ASC;

-- =====================================================
-- DETAILED VIEWS FOR DEMO
-- =====================================================

-- Show a specific log with full anomaly details
-- Replace 'LOG_ID_HERE' with actual log ID from logs table
SELECT 
    '=== LOG ENTRY ===' as section,
    l.id,
    l.timestamp,
    l.severity,
    l.source,
    l.event_type,
    l.message,
    l.metadata,
    '=== ANOMALY DETECTION ===' as section2,
    af.anomaly_score,
    af.detection_algorithm,
    af.detection_reason,
    af.flagged_at,
    '=== AI ANALYSIS ===' as section3,
    af.ai_explanation,
    af.ai_root_cause,
    af.ai_next_steps,
    af.ai_processed_at
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
WHERE l.id = 'LOG_ID_HERE';  -- Replace this!

-- Pretty display for presentation
SELECT 
    timestamp::timestamp(0) as time,
    severity,
    source,
    event_type,
    CASE 
        WHEN af.id IS NOT NULL THEN '🚨 ' || af.anomaly_score::text || ' pts'
        ELSE '✅ Normal'
    END as status,
    LEFT(message, 40) as message
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
ORDER BY timestamp DESC
LIMIT 10;

-- =====================================================
-- DATA QUALITY CHECKS
-- =====================================================

-- Check for NULL required fields (should be 0)
SELECT 
    COUNT(*) as logs_with_nulls
FROM logs
WHERE timestamp IS NULL 
   OR event_type IS NULL 
   OR severity IS NULL 
   OR source IS NULL;

-- Check for invalid severities (should be 0)
SELECT 
    severity,
    COUNT(*) as count
FROM logs
WHERE severity NOT IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL', 'DEBUG')
GROUP BY severity;

-- Verify foreign key integrity (should be 0)
SELECT COUNT(*) as orphaned_flags
FROM anomaly_flags af
LEFT JOIN logs l ON af.log_id = l.id
WHERE l.id IS NULL;

-- =====================================================
-- DATABASE HEALTH
-- =====================================================

-- Database size
SELECT pg_size_pretty(pg_database_size('log_analyzer')) as database_size;

-- Table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || tablename) DESC;

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- =====================================================
-- QUICK DEMO QUERIES
-- =====================================================

-- Dashboard stats (like the API returns)
SELECT 
    COUNT(DISTINCT l.id) as total_logs,
    COUNT(DISTINCT af.id) as total_flags,
    ROUND(COUNT(DISTINCT af.id)::numeric / NULLIF(COUNT(DISTINCT l.id), 0) * 100, 2) as flag_rate,
    COUNT(DISTINCT l.source) as unique_sources,
    COUNT(DISTINCT l.event_type) as unique_event_types
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id;

-- Top 5 sources by activity
SELECT 
    source,
    COUNT(*) as log_count,
    COUNT(CASE WHEN af.id IS NOT NULL THEN 1 END) as flagged_count
FROM logs l
LEFT JOIN anomaly_flags af ON l.id = af.log_id
GROUP BY source
ORDER BY log_count DESC
LIMIT 5;

-- Recent critical issues
SELECT 
    l.timestamp,
    l.source,
    l.event_type,
    af.anomaly_score,
    LEFT(af.detection_reason, 60) as reason_preview
FROM logs l
INNER JOIN anomaly_flags af ON l.id = af.log_id
WHERE l.severity IN ('ERROR', 'CRITICAL')
ORDER BY l.timestamp DESC
LIMIT 5;
