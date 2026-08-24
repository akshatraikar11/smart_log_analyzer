# Rate Limiting Implementation

## Overview
Rate limiting protects the API from abuse, ensures fair usage, and prevents accidental DDoS scenarios.

## Rate Limits

### General API (`/api/*`)
- **Limit**: 100 requests per 15 minutes per IP
- **Purpose**: General protection against abuse
- **Response**: 429 Too Many Requests with retry-after header

### Log Ingestion (`POST /api/logs/ingest`)
- **Limit**: 50 requests per minute per IP
- **Purpose**: Prevent log spam, protect database
- **Why**: High-volume ingestion could overwhelm detection algorithms

### AI Explanations (`POST /api/anomalies/:id/explain`)
- **Limit**: 10 requests per minute per IP
- **Purpose**: Protect Groq API quota (free tier: 30/min)
- **Why**: AI processing is expensive and rate-limited by provider

### Read Operations (`GET /api/logs`, `/api/anomalies`, etc.)
- **Limit**: 200 requests per minute per IP
- **Purpose**: Allow frequent dashboard refreshes
- **Why**: Read operations are cheap, but still need limits

## Headers Returned

All rate-limited endpoints return:
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1640000000
```

## Error Response

When rate limit exceeded:
```json
{
  "error": "Too many requests",
  "message": "You have exceeded the 100 requests in 15 minutes limit!",
  "retryAfter": "15 minutes"
}
```

## Production Considerations

### Current Implementation (In-Memory)
- Stores counters in Node.js memory
- Resets on server restart
- Works per-instance (not distributed)

### Scaling Considerations
For production with multiple servers:
1. Use Redis for distributed rate limiting
2. Implement per-user limits (not just per-IP)
3. Add API key authentication
4. Tiered limits based on subscription level

## Testing Rate Limits

### Test General API Limit
```bash
# Send 101 requests rapidly
for i in {1..101}; do
  curl http://localhost:3000/api/stats
done
# 101st request should return 429
```

### Test Ingestion Limit
```bash
# Send 51 ingestion requests
for i in {1..51}; do
  curl -X POST http://localhost:3000/api/logs/ingest \
    -H "Content-Type: application/json" \
    -d '{"timestamp":"2024-01-01T00:00:00Z","event_type":"TEST","severity":"INFO","source":"test"}'
done
# 51st should fail
```

### Test AI Limit
```bash
# Get a flagged log ID first
LOG_ID=$(curl http://localhost:3000/api/anomalies | jq -r '.anomalies[0].id')

# Try 11 AI explanation requests
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/anomalies/$LOG_ID/explain
done
# 11th should return 429
```

## Why This Matters

### Security
- Prevents brute force attacks
- Protects against DDoS
- Prevents resource exhaustion

### Cost Control
- Groq API has usage limits
- Database connections are finite
- CPU/memory have limits

### Fair Usage
- Ensures all users get access
- Prevents one client monopolizing resources
- Maintains service availability

## Viva Talking Points

**Q: Why rate limiting?**
> "Rate limiting is essential for three reasons: First, it protects against abuse - someone could spam ingestion and overwhelm the database. Second, it controls costs - Groq's free tier has limits, and I want to stay within them. Third, it ensures fair usage - one user can't monopolize all resources. I've implemented tiered limits: strict for expensive operations like AI processing (10/min), moderate for ingestion (50/min), and lenient for reads (200/min)."

**Q: Why different limits for different endpoints?**
> "Each endpoint has different resource costs. AI explanations hit an external API and are expensive, so I limit them to 10/min to protect our Groq quota. Log ingestion writes to the database and triggers detection algorithms, so 50/min prevents spam while allowing normal usage. Read operations are cheap, so I'm generous with 200/min to enable responsive dashboards."

**Q: How would you scale this in production?**
> "Current implementation uses in-memory counters, which works for a single server but doesn't scale. In production, I'd use Redis for distributed rate limiting across multiple instances. I'd also add API key authentication so limits are per-user, not per-IP, and implement tiered limits based on subscription levels."

## Demo Notes

During demo, if you hit rate limits:
1. **Show the error response** - demonstrates it's working
2. **Show the headers** - point out RateLimit-Remaining
3. **Explain the limit** - "This is the AI limit - 10/min to protect Groq quota"
4. **Wait 60 seconds** or restart server to reset

## Configuration

Rate limits can be adjusted in `backend/middleware/rateLimiter.js`:

```javascript
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // Time window
    max: 100,                   // Max requests in window
    // ... other options
});
```

Adjust based on:
- Server capacity
- Database performance
- API provider limits
- Expected traffic
