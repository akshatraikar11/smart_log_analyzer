# 🔍 Verify File Upload is Working

## ✅ Changes Made:
1. LogList now resets to page 1 on refresh (so you see new logs)
2. Added console log to show loaded logs count
3. Fixed useEffect dependencies to trigger proper refresh

---

## 🧪 Step-by-Step Test:

### Step 1: Check Current Data
1. Open browser: `http://localhost:5173`
2. Look at stats panel - note the current total (e.g., "552 logs")
3. Open browser console (F12)

### Step 2: Upload a File
1. Click **"📤 Upload File"** button
2. Select `sample-data/critical-surge.csv` (10 logs, 8 anomalies)
3. Click **"Upload & Process Logs"**
4. Watch for success message: "Uploaded! Ingested 10 logs, Flagged 8 anomalies"

### Step 3: Verify Upload Worked

**Check 1: Stats Updated**
- Stats should show: **562 logs** (552 + 10) ✅
- Anomalies should increase too

**Check 2: Console Shows Refresh**
Open browser console (F12), you should see:
```
→ POST /api/upload
← 201 /api/upload
→ GET /api/stats
← 200 /api/stats
→ GET /api/logs?page=1&pageSize=50&flaggedOnly=false
← 200 /api/logs
✅ Loaded 50 logs (page 1, total 562)
```

**Check 3: New Logs Visible**
- Log list should show **50/562** at top
- New uploaded logs appear at the TOP of the list (newest first)
- Red-highlighted rows = anomalies

---

## 🐛 If You Don't See New Logs:

### Debug Step 1: Check Backend Response
In browser console, expand the `/api/upload` response:
```json
{
  "success": true,
  "ingestion": {
    "successful": 10
  },
  "detection": {
    "flagged": 8
  }
}
```
If you see this ✅ = Upload worked on backend

### Debug Step 2: Check Stats API
Look for `/api/stats` response:
```json
{
  "totalLogs": 562,  // Should be increased!
  "totalAnomalies": 174
}
```
If total increased ✅ = Data is in database

### Debug Step 3: Manual Refresh
Click the **"🔄 Refresh"** button in Stats Panel

---

## 🎯 What You Should See After Upload:

### Timeline View (Main Area):
```
MM-DD HH:MM:SS  [🔴 CRIT]  payment-gateway   DATABASE_DEADLOCK   Transaction deadlock... [⚠ SPIKE]
MM-DD HH:MM:SS  [🔴 CRIT]  order-processor   MEMORY_EXCEEDED     Heap out of memory...   [⚠ SPIKE]
MM-DD HH:MM:SS  [🟠 ERROR]  auth-service      AUTH_BURST_FAILURE  Multiple failed...      [⚠ BURST]
...
```

- **Red rows** = Anomalies (flagged)
- **White rows** = Normal logs
- **Latest uploads** = At the top

---

## 🎬 Quick Visual Test:

**Before:**
```
Stats: 552 logs, 166 anomalies
List shows: 50/552
```

**Upload critical-surge.csv (10 logs)**

**After:**
```
Stats: 562 logs, 174 anomalies  ← Numbers increased!
List shows: 50/562               ← Total increased!
Top rows are NEW logs            ← Visible in list!
```

---

## 💡 Pro Tip - See Upload in Action:

1. **Open TWO browser tabs** to `http://localhost:5173`
2. In Tab 1: Upload a file
3. Watch Tab 2: It updates in REAL-TIME (WebSocket magic!) 🟢

---

## 🔧 Still Not Working? Run This Test:

### Terminal Test (Direct API):
```powershell
# Test file upload directly
curl -X POST http://localhost:3000/api/upload `
  -F "file=@sample-data\critical-surge.csv"
```

Expected response:
```json
{
  "success": true,
  "ingestion": {
    "successful": 10
  }
}
```

Then refresh browser - logs should appear!

---

## ✅ Success Checklist:

- [ ] Upload shows success message
- [ ] Stats panel numbers increase
- [ ] Console shows "✅ Loaded X logs"
- [ ] Log list shows increased total (e.g., 50/**562**)
- [ ] New logs visible at top of list
- [ ] Anomalies are red-highlighted
- [ ] WebSocket shows 🟢 Live indicator

**If all checked = Working perfectly!** 🎉

---

## 🎤 For Your Demo:

**Script:**
> "Let me demonstrate real-time log ingestion. I'll upload this critical-surge file...
> *[Click upload, select file, upload]*
> Watch the stats update in real-time - we ingested 10 logs and our deterministic algorithms flagged 8 as anomalous.
> *[Point to red rows]*
> These red entries are the detected anomalies. Now if I click any one...
> *[Click anomaly]*
> We can generate an AI-powered explanation using Groq's LLaMA model to understand the root cause."

Make sure to **scroll to the top of the log list** to show the new uploads!
