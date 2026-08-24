# Quick Start Guide

Get the Smart Log Analyzer running in 5 minutes.

## Prerequisites Check

```bash
# Check Node.js version (need 16+)
node --version

# Check PostgreSQL is running
psql -U postgres -c "SELECT version();"
```

## Step-by-Step Setup

### 1. Configure OpenAI API Key

Edit the `.env` file and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-actual-key-here
```

### 2. Install All Dependencies

From the project root:

```bash
npm run install:all
```

This installs dependencies for backend and frontend.

### 3. Initialize Database

```bash
npm run db:init
```

Expected output:
```
✅ Database schema created successfully!
📊 Tables created: logs, anomaly_flags, flagged_logs_view
🎯 Sample data inserted for testing
```

### 4. Start Backend (Terminal 1)

```bash
npm run dev:backend
```

Expected output:
```
╔════════════════════════════════════════╗
║  Smart Log Analyzer API Server        ║
╚════════════════════════════════════════╝
🚀 Server running on http://localhost:3000
```

### 5. Start Frontend (Terminal 2)

Open a new terminal:

```bash
npm run dev:frontend
```

Expected output:
```
VITE ready in XXX ms
➜  Local:   http://localhost:5173/
```

### 6. Open in Browser

Navigate to: `http://localhost:5173`

You should see:
- Dashboard with statistics (10 sample logs)
- Log timeline with entries
- Filtering options

### 7. Test Anomaly Detection

Click on any entry with a red "Anomaly" badge to see:
- Anomaly score
- Detection algorithm used
- Detection reason

Click "Generate AI Explanation" to get AI-powered insights.

## Common Issues

**Database Connection Failed**
- Check PostgreSQL is running
- Verify connection string in `.env`

**Port Already in Use**
- Backend: Change `PORT` in `.env`
- Frontend: Change port in `vite.config.js`

**AI Explanations Not Working**
- Verify `OPENAI_API_KEY` is set correctly
- Check you have API credits
- Detection still works without AI

## What's Next?

1. **Read ARCHITECTURE.md** - Understand the system design
2. **Test API endpoints** - See README.md for curl examples
3. **Ingest custom logs** - Use the API to add your own data
4. **Explore anomaly algorithms** - See how detection works

## Production Build

```bash
# Build frontend
npm run build:frontend

# Start backend in production
cd backend
NODE_ENV=production npm start
```

The production build serves the frontend from the backend server.

## Need Help?

- Check the full README.md
- Review ARCHITECTURE.md for technical details
- Check browser console for errors
- Check backend terminal for API logs
