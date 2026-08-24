# 🧪 Test File Upload Flow

## ✅ Changes Made:
1. Simplified QuickIngest to only show "📤 Upload File" button
2. Added better success feedback showing uploaded + flagged counts
3. Auto-closes modal after 1.5 seconds on success
4. Triggers `onSuccess()` callback to refresh App stats + LogList

---

## 🔍 How to Test:

### Step 1: Make sure both servers are running
**Terminal 1 - Backend:**
```bash
cd C:\Users\Akshat\OneDrive\Documents\smart-log-analyzer\backend
npm run dev
```
Expected output: `🚀 Server running on port 3000`

**Terminal 2 - Frontend:**
```bash
cd C:\Users\Akshat\OneDrive\Documents\smart-log-analyzer\frontend
npm run dev
```
Expected output: `Local: http://localhost:5173/`

---

### Step 2: Open browser
```
http://localhost:5173
```

You should see:
- Stats panel on left
- Log list in center
- 🟢 Live indicator (green = WebSocket connected)

---

### Step 3: Test Upload
1. Click **"📤 Upload File"** button (top right)
2. Modal opens with file selector
3. Choose a file from `C:\Users\Akshat\OneDrive\Documents\smart-log-analyzer\sample-data\`
4. Click **"Upload & Process Logs"**
5. Watch for:
   - ✅ "Uploaded! Ingested X logs, Flagged Y anomalies" message
   - Modal auto-closes after 1.5 seconds
   - **Log list updates automatically** (new logs appear)
   - **Stats panel updates** (counts increase)

---

## 🐛 If Logs Don't Appear:

### Check 1: Backend Logs
Look at your backend terminal for:
```
📁 Processing file upload: critical-surge.csv
📊 Parsed 10 logs from critical-surge.csv
✅ Batch ingestion complete: 10/10 succeeded
🔴 Detection complete: 8/10 flagged
```

### Check 2: Browser Console (F12)
Look for:
```
→ POST /api/upload
← 201 /api/upload
WebSocket: stats:update
WebSocket: log:new
```

### Check 3: Network Tab (F12)
Check the `/api/upload` response:
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

### Check 4: WebSocket Connected?
Look for **🟢 Live** indicator (green circle) in top right.
- 🟢 Green = Connected (auto-refresh works)
- 🔴 Red = Disconnected (manual refresh needed)

---

## 🎯 Expected Behavior After Upload:

1. **Success message shows** → "Uploaded! Ingested 10 logs, Flagged 8 anomalies"
2. **Modal closes** → After 1.5 seconds
3. **Stats update** → Total logs count increases
4. **Log list refreshes** → New logs appear at top (sorted by timestamp DESC)
5. **Anomalies highlighted** → Red background for flagged entries

---

## 🔧 Quick Fix If Still Not Working:

### Option A: Hard Refresh Frontend
```bash
# In frontend terminal, stop (Ctrl+C) and restart:
npm run dev
```
Then refresh browser with **Ctrl+Shift+R** (hard refresh)

### Option B: Manual Refresh
After upload, click the **"🔄 Refresh"** button in stats panel

### Option C: Check WebSocket
If 🔴 Red indicator, restart backend:
```bash
# Stop backend (Ctrl+C)
npm run dev
```

---

## ✅ Working Example Flow:

1. **Before Upload:**
   - Stats: 552 logs, 166 anomalies
   
2. **Upload:** `critical-surge.csv` (10 logs, 8 flagged)

3. **After Upload:**
   - Stats: 562 logs, 174 anomalies ✅
   - Log list shows new entries ✅
   - Scroll to top to see latest uploads ✅

---

## 📁 Sample Files to Test:

Located in: `sample-data/`

1. **critical-surge.csv** → 10 logs, 8 CRITICAL (triggers severity_spike)
2. **midnight-anomaly.json** → 5 logs at 3 AM (triggers timestamp_anomaly)
3. **rare-shutdown.txt** → Rare SYSTEM_SHUTDOWN events
4. **ddos-simulation.csv** → 20 requests from one IP (triggers source_burst)
5. **escalation-pattern.json** → WARNING→ERROR→CRITICAL chain

Try uploading each one and watch the counts increase!

---

## 🎤 Demo Tip:

**Narrate while uploading:**
> "I'll upload this critical-surge file which simulates a database crisis... 
> *[click upload]* 
> See how it detected 8 out of 10 logs as anomalous using our deterministic algorithms. 
> The red highlighting shows flagged entries, and I can click any one to get an AI-powered root cause analysis from Groq."

---

## ✅ Success Criteria:

- [ ] Modal opens when clicking "📤 Upload File"
- [ ] File selection works
- [ ] Upload button shows "Uploading & Analyzing..." state
- [ ] Success message displays with counts
- [ ] Modal auto-closes after success
- [ ] Stats panel updates (counts increase)
- [ ] Log list refreshes (new logs visible)
- [ ] Anomalies are red-highlighted
- [ ] No browser console errors

If all checked, **you're ready for demo!** 🚀
