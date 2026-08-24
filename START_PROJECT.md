# 🚀 Quick Start Guide - Smart Log Analyzer

## ✅ Database Status: CONNECTED
- PostgreSQL 18.6 running
- Database: log_analyzer (552 logs, 166 anomalies loaded)
- All tables created and ready

---

## 🎯 Start Your Project (2 Steps)

### Step 1: Start Backend (Terminal 1)
```bash
cd C:\Users\Akshat\OneDrive\Documents\smart-log-analyzer\backend
npm run dev
```

**Expected output:**
```
🚀 Server running on port 3000
✅ Database connected
📡 WebSocket ready
```

---

### Step 2: Start Frontend (Terminal 2)
```bash
cd C:\Users\Akshat\OneDrive\Documents\smart-log-analyzer\frontend
npm run dev
```

**Expected output:**
```
VITE v5.x ready in xxx ms
➜  Local:   http://localhost:5173/
```

---

## 🌐 Open in Browser
```
http://localhost:5173
```

---

## 🎬 What You Should See

### Dashboard (Top)
- **Total Logs**: 552
- **Flagged Anomalies**: 166
- **Detection Rate**: ~30%
- **🟢 Live**: WebSocket connected

### Timeline (Main)
- Scrollable log list
- Red-highlighted anomalies
- Filters: All, CRITICAL, ERROR, WARNING, INFO
- Search by source/message

### Actions
- Click any log → See full details
- Click "Generate AI Explanation" → Groq LLM analysis
- Upload new files → CSV/JSON/TXT support
- Real-time updates via WebSocket

---

## 📁 Sample Files to Test

Located in: `C:\Users\Akshat\OneDrive\Documents\smart-log-analyzer\sample-data\`

1. **critical-surge.csv** - Multiple CRITICAL events (triggers severity_spike)
2. **midnight-anomaly.json** - Off-hours activity (triggers timestamp_anomaly)
3. **rare-shutdown.txt** - Uncommon event types (triggers rare_event)
4. **ddos-simulation.csv** - Burst from single source (triggers source_burst)
5. **escalation-pattern.json** - WARNING → ERROR → CRITICAL (triggers severity_escalation)

### Test Upload:
1. Click "📤 Upload File" button
2. Select any sample file
3. Watch real-time ingestion (WebSocket updates)
4. See new anomalies flagged instantly

---

## 🧪 Quick API Test (Optional)

```bash
# Test backend health
curl http://localhost:3000/api/health

# Get statistics
curl http://localhost:3000/api/stats

# Ingest a single log (manual)
curl -X POST http://localhost:3000/api/logs/ingest ^
  -H "Content-Type: application/json" ^
  -d "{\"timestamp\":\"2026-08-24T12:00:00Z\",\"severity\":\"CRITICAL\",\"source\":\"test-service\",\"event_type\":\"crash\",\"message\":\"Test message\"}"
```

---

## 🎤 Demo Talking Points

### Technical Highlights
1. **WebSocket** → Real-time updates (vs polling)
2. **5 Algorithms** → Comprehensive anomaly coverage
3. **Groq API** → 18x faster than OpenAI, 90% cheaper
4. **Rate Limiting** → Production-ready (tiered limits)
5. **Multi-format** → CSV/JSON/TXT upload support

### Architecture
- **Separation of Concerns**: Detection (deterministic) ≠ Explanation (AI)
- **PostgreSQL**: Structured data + JSONB flexibility + indexes
- **Modern Stack**: Node.js + React + Vite + Socket.IO

### Differentiators
- **Real-time** anomaly notifications (WebSocket)
- **Cost-efficient** AI (Groq vs OpenAI)
- **Production thinking** (rate limits, validation, error handling)
- **5 detection algorithms** (not just 1)

---

## 🔥 Key Features to Show

1. **Timeline View** → Show red anomalies vs normal logs
2. **AI Explanation** → Click anomaly, generate Groq analysis
3. **Live Upload** → Upload sample file, watch real-time ingestion
4. **Stats Dashboard** → Show detection rate
5. **WebSocket** → Demonstrate live updates (🟢 indicator)

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process if needed
taskkill /PID <PID> /F
```

### Frontend won't start
```bash
# Check if port 5173 is in use
netstat -ano | findstr :5173

# Kill process if needed
taskkill /PID <PID> /F
```

### Database connection error
```bash
# Test connection
cd backend
node test-db-connection.js
```

### WebSocket not connecting
- Check backend is running on port 3000
- Check browser console for errors
- Verify firewall isn't blocking WebSocket

---

## ✅ You're Ready!

Your database is connected, data is loaded, and everything is tested. Just start the backend and frontend, then open your browser! 🚀
