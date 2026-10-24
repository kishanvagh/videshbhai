# Deployment Guide — Vercel (Frontend) + Render (Backend)

This project is a monorepo:

- `frontend/` — React + Vite SPA → **deploy to Vercel**
- `backend/` — Node.js + Express + Mongoose API → **deploy to Render**
- MongoDB stays on **MongoDB Atlas** (already in use — see `MONGODB_URI`)

> ⚠️ **Never commit `backend/.env` or `frontend/.env`** — they contain secrets.
> A `.gitignore` is already in place so Git skips them automatically.

---

## 0. Prerequisites

1. A **GitHub** account
2. A **Vercel** account
3. A **Render** account
4. Your MongoDB Atlas cluster (already set up)

You will also need two values from your local `backend/.env`:

- `MONGODB_URI` — your Atlas connection string
- `JWT_SECRET` — your token signing secret (or generate a new strong one)

You can open it with Notepad to copy them — they will be pasted into Render below.

---

## Part A — Put the code on GitHub

Open a terminal in the project folder and run:

```bash
cd C:\Users\Hp\Desktop\videshbhai

git init
git add .
git commit -m "Initial commit"
git branch -M main
```

Create a new **empty** repository on GitHub (do NOT add a README), then:

```bash
git remote add origin https://github.com/<your-username>/videshbhai.git
git push -u origin main
```

Make sure `backend/.env` and `frontend/.env` are **not** in the repository
(the `.gitignore` prevents them).

---

## Part B — Deploy the backend to Render

### Option 1 — Render dashboard (recommended, easiest)

1. Go to [render.com](https://render.com) → **New** → **Web Service**.
2. Connect your GitHub repo and select it.
3. Fill in:
   - **Name:** `videshbhai-api`
   - **Region:** pick nearest to you
   - **Branch:** `main`
   - **Root Directory:** `backend`  ← important
   - **Runtime / Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. Under **Environment** add these variables:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | paste from `backend/.env` |
   | `JWT_SECRET` | paste from `backend/.env` (or a new strong secret) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `ALLOW_REGISTRATION` | `false` — keeps signups closed (private system). Set `true` only if you want public registration |
   | `CORS_ORIGIN` | `https://<your-frontend>.vercel.app` *(you'll set the real URL after Part C — this can be updated later)* |

5. Click **Create Web Service** and wait for it to build & deploy.
6. Test it: open `https://<service-name>.onrender.com/health`
   You should see:
   ```json
   {"success":true,"message":"Jewelry Accounting API is running","database":"connected"}
   ```

### Option 2 — Render Blueprint (optional)

A `backend/render.yaml` blueprint is included. In Render:
**New → Blueprint → Repo → `videshbhai`**, then set `MONGODB_URI`, `JWT_SECRET`,
and `CORS_ORIGIN` in the service's **Environment** tab (they're marked `sync: false`).

> If you get `database: "disconnected"` on `/health`, use **Part E → step 2**

---

## Part C — Deploy the frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. Import the GitHub repo (`videshbhai`).
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Vite` (auto-detected)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add one **Environment Variable**:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://<service-name>.onrender.com/api` |

   > Must be `http(s)://…/api` — no trailing slash.
5. Click **Deploy**.
6. Note your production URL: `https://<project>.vercel.app`
   (Vercel already handles SPA routing via `frontend/vercel.json`, so
   `/payments`, `/parties/:id`, etc. work on refresh.)

---

## Part D — Wire the two together

1. Go back to Render → your service → **Environment**.
   Set `CORS_ORIGIN = https://<project>.vercel.app`
   (add extra origins comma-separated if you have preview domains).
   Save — Render restarts automatically.
2. Hard-refresh your Vercel site (Ctrl+F5) and test the full flow:
   - Log in
   - Record a payment for a party → received/due update immediately
   - Dashboard "Total Received" and "Foreign Currency Holdings" reflect it
   - Currency Exchange uses the available balance

---

## Part E — Production checklist

1. **JWT_SECRET** — use a long random string
   (e.g. `openssl rand -hex 32` or a generator) and keep it stable across deploys.
2. **Atlas network access** (required!) — Render's egress IPs are dynamic:
   - MongoDB Atlas → **Network Access** → **Add IP Address**
   - Add `0.0.0.0/0` (allow from anywhere).
     > This is required for Render's dynamic IPs. Access is still protected by
     > your database username/password. Tighten it later if you prefer.
3. **Health check** — Render shows deployment healthy when
   `GET /health` returns 200.
4. **HTTPS** — both Vercel and Render provide HTTPS automatically.
5. **Auto deploys** — both platforms redeploy when you push to `main`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `CORS` error in browser console | `CORS_ORIGIN` on Render doesn't match the exact Vercel URL (no trailing slash). |
| `No authentication token provided` | You're logged out — refresh / log in again. Token lives in browser localStorage. |
| Blank page after deploy | Hard refresh (Ctrl+F5); check `VITE_API_BASE_URL` was set at build time. |
| `/payments` 404 on refresh | Vercel rewrite handles this — make sure `frontend/vercel.json` was included in the repo. |
| Backend shows `MongoDB disconnected` | Atlas IP allowlist (Part E step 2). |
| Login works, but actions fail | Check the backend logs in Render → service → **Logs**. |
| 500 on `/health` | Database connection — verify `MONGODB_URI` and Atlas allowlist. |

---

## Redeploying after changes

Both platforms auto-deploy on `git push origin main`.

- Backend change → pushes to `backend/**` redeploy the Render service.
- Frontend change → pushes to `frontend/**` redeploy the Vercel project.
- Changing `CORS_ORIGIN` or env vars → update in the platform dashboard (Render restarts; Vercel re-builds).

> (Atlas IP allowlist) below.
