# Deployment Guide: Smart Log Analyzer

This guide details the best deployment strategies for **Smart Log Analyzer** (React + Express + Socket.IO + PostgreSQL + Groq AI).

---

## 🏆 Recommended Option: Render (All-in-One Free Tier / Blueprint)

Render is the most suitable platform for this application because:
- ✅ Supports **persistent WebSocket connections** (`Socket.IO` works seamlessly out of the box).
- ✅ Built-in managed **PostgreSQL** database.
- ✅ Native **Static Site** hosting for the Vite React frontend with CDN.
- ✅ Includes a `render.yaml` Blueprint for **1-click automated deployment**.

### Step-by-Step Deployment on Render

#### Step 1: Sign Up / Log In
1. Go to [render.com](https://render.com) and create an account or sign in with your GitHub account.

#### Step 2: Deploy using Render Blueprint (Recommended)
1. Click **New +** → **Blueprint**.
2. Select your repository: `https://github.com/akshatraikar11/smart_log_analyzer`.
3. Render will detect [`render.yaml`](file:///c:/Users/Akshat/OneDrive/Documents/smart-log-analyzer/render.yaml) and automatically configure:
   - **smart-log-db**: Managed PostgreSQL instance.
   - **smart-log-analyzer-backend**: Express API service.
   - **smart-log-analyzer-frontend**: Vite React static site.
4. Add your **`GROQ_API_KEY`** in the environment variables prompt.
5. Click **Apply**.

#### Step 3: Initialize Database Tables
Once the database and backend are deployed:
1. In your Render Dashboard, go to your **smart-log-analyzer-backend** service.
2. Open the **Shell** tab and run:
   ```bash
   node ../database/init.js
   ```
   *Alternatively, run `npx prisma db push`.*

---

## 🚂 Option 2: Railway (Zero-Config Monorepo)

Railway is another great option with seamless WebSocket and PostgreSQL support.

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo** → select `akshatraikar11/smart_log_analyzer`.
3. Add a **PostgreSQL** plugin (`+ New` → `Database` → `Add PostgreSQL`).
4. In the Backend service settings:
   - Root Directory: `backend`
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `npm start`
   - Variables:
     - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
     - `GROQ_API_KEY`: `<your_groq_api_key>`
     - `GROQ_MODEL`: `llama-3.3-70b-versatile`
5. In the Frontend service settings:
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
   - Variables:
     - `VITE_API_URL`: `https://<your-backend-railway-url>/api`

---

## ⚡ Option 3: Vercel (Frontend) + Supabase (Database) + Render (Backend)

If you prefer Vercel for the frontend UI:
1. **Database**: Create a free PostgreSQL database on [Supabase](https://supabase.com) or [Neon](https://neon.tech).
2. **Backend**: Deploy the `backend/` folder on [Render](https://render.com) or [Railway](https://railway.app) as a Web Service (required for WebSockets).
3. **Frontend**: Import the repository on [Vercel](https://vercel.com):
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Environment Variable: `VITE_API_URL` = `https://<your-backend-service>/api`

---

## 🔑 Environment Variables Reference

| Variable | Description | Where to set |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://...`) | Backend |
| `GROQ_API_KEY` | Groq API Key for AI explanation generation | Backend |
| `GROQ_MODEL` | AI model name (`llama-3.3-70b-versatile`) | Backend |
| `PORT` | Port number (Render/Railway assign this automatically) | Backend |
| `NODE_ENV` | Set to `production` | Backend |
| `VITE_API_URL` | Full backend API URL (e.g. `https://your-backend.onrender.com/api`) | Frontend |
