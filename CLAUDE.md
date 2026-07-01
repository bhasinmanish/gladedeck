# Glade Deck — Trading Dashboard

A personal trading dashboard that automates the repetitive parts of a trader's day: morning prep, scanning, and end-of-day review. Built for one user initially but multi-user-ready.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14.2.35 (App Router, TypeScript) |
| UI | Shadcn/ui + Tailwind CSS (dark trading theme) |
| Backend | Next.js API routes + Python FastAPI service |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Auth | Supabase Auth + Google OAuth (via `signInWithOAuth`) |
| Email | Resend (transactional alerts) |
| Scanner | TradingView screener (unofficial endpoint) |
| Charts | TradingView Widget (embeddable) |
| AI | Claude API (Pine Script generator, Daily Review chatbot) |
| Hosting | Vercel (Next.js) + Railway (Python service) — both live |

---

## Deployment (LIVE — fully cloud-hosted, zero local processes required)

- **Frontend**: https://gladedeck.com (custom domain) / https://gladedeck-zeta.vercel.app (Vercel alias)
- **Python service**: https://gladedeck-production.up.railway.app (Railway, auto-restarts on var changes, auto-redeploys on push to `main`)
- **GitHub repo**: https://github.com/bhasinmanish/gladedeck (public — required for Vercel Hobby plan auto-deploy; renamed from `glade`)
- **Database/Auth**: Supabase cloud project (uryrtpamvkprugnjqesn.supabase.co)

Opening https://gladedeck.com on any device works immediately — no terminal, no `npm run dev`, no `python main.py`. Login, scanner, alerts, and email all run fully in the cloud.

Project was renamed from "Glade" to "Glade Deck" (display) / `gladedeck` (repo, URLs) — see troubleshooting log item 12 below for the full rename process if doing this again.

To run locally for development only:
- Next.js: `npm run dev` from root
- Python service: `python main.py` from `python-service/` (requires `pip install -r requirements.txt`)

---

## Environment Variables

### Vercel (Production + Preview)
```
NEXT_PUBLIC_SUPABASE_URL=https://uryrtpamvkprugnjqesn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=https://gladedeck.com
SUPABASE_SERVICE_ROLE_KEY=...
PYTHON_SERVICE_URL=https://gladedeck-production.up.railway.app
PYTHON_SERVICE_SECRET=glade-secret-123
RESEND_API_KEY=re_joDAfVjm_Jk389H6kVFHS96MjFjHTzRqH
RESEND_TEST_TO=manshabhasin9@gmail.com        (remove once Resend domain is verified)
ANTHROPIC_API_KEY=sk-ant-...
SCHWAB_REDIRECT_URI=...
```

### Railway (Python service)
```
SUPABASE_URL=https://uryrtpamvkprugnjqesn.supabase.co       (no trailing slash — caused PGRST125 errors when present)
SUPABASE_SERVICE_ROLE_KEY=...                                 (must be the `service_role` key, not `anon`)
SERVICE_SECRET=glade-secret-123                               (must exactly match Vercel's PYTHON_SERVICE_SECRET)
GLADE_APP_URL=https://gladedeck.com                           (used for links inside alert/notification emails)
RESEND_API_KEY=re_joDAfVjm_Jk389H6kVFHS96MjFjHTzRqH
TWILIO_ACCOUNT_SID=...           (placeholder, SMS not active)
TWILIO_AUTH_TOKEN=...            (placeholder, SMS not active)
TWILIO_FROM_NUMBER=...           (placeholder, SMS not active)
VAPID_SUBJECT=...                (placeholder, web push not active)
```

### Local dev only — `.env.local` (Next.js, never commit)
Same keys as Vercel but with `PYTHON_SERVICE_URL=http://localhost:8000`.

### Local dev only — `python-service/.env` (Python, never commit)
Same keys as Railway but pointing at local resources where relevant.

### Supabase Dashboard config (Authentication → Providers → Google)
- Client ID: `932453965974-iqmo9qcq3k513l43v7faltcvp5uujq2h.apps.googleusercontent.com`
- Client Secret: from Google Cloud Console → APIs & Services → Credentials → OAuth client (the one ending `...VI_M`)
- This is required because the login page uses Supabase's `signInWithOAuth`, which makes Supabase the OAuth client (needs the secret), unlike the old Google Identity Services flow.

### Supabase Dashboard config (Authentication → URL Configuration)
- Site URL: `https://gladedeck.com`
- Redirect URLs: `https://gladedeck.com/**`, `https://gladedeck-zeta.vercel.app/**`, `http://localhost:3000/**`

### Google Cloud Console config (APIs & Services → Credentials → OAuth client "Glade")
- Authorized JavaScript origins: `http://localhost:3000`
- Authorized redirect URIs must include: `https://uryrtpamvkprugnjqesn.supabase.co/auth/v1/callback`

---

## What's Been Built

### Navigation tabs (all implemented, no phase badges)
- **Dashboard** — hub with 6 draggable widgets, user-customizable layout (2 or 3 columns)
- **Scanner** — TradingView-powered stock screener with custom filter presets
- **Charts** — TradingView chart with watchlist sidebar
- **Alerts** — dedicated alerts page (My Alerts + Activity tabs)
- **Daily Review** — AI chatbot trade journal (UI built, Schwab sync pending)
- **Trade Log** — trade history + P&L tracking (UI built, Schwab sync pending)
- **Strategies** — strategy management (UI built)
- **Reports** — reporting templates (UI built)

Nav tabs scroll horizontally on mobile (overflow-x-auto + .scrollbar-hide CSS utility) so all 8 tabs are always reachable by swiping right.

### Responsive design (fully implemented)
All screens adapt to phone/tablet/desktop:
- Nav tabs are horizontally scrollable on mobile (hidden scrollbar, `min-w-max` inner div prevents wrapping)
- Dashboard grid: `grid-cols-1` on phone → `sm:grid-cols-2` on tablet → `md:grid-cols-2` or `md:grid-cols-3` (per user pref) on desktop
- All data tables (scanner, trade log) have `overflow-x-auto` wrappers so they scroll horizontally instead of squashing
- Page padding: `p-4 md:p-6` on scanner, daily review, trade log, alerts
- Page headings: `text-xl md:text-2xl`
- CSS utility `.scrollbar-hide` in `app/globals.css` hides scrollbar track visually while keeping scroll functional

### Dashboard widgets (6 total, drag-to-reorder via Dashboard Preferences)
- `TopSetupsWidget` — today's scanner results
- `AlertsWidget` — recent alerts with real-time Supabase subscription
- `TradeLogWidget` — all-time P&L + win rate + recent trades
- `DailyReviewWidget` — today's P&L and reflection summary
- `IdeasWidget` — active trade ideas
- `WatchlistsWidget` — watchlist symbols

### Dashboard Preferences (navbar slider icon)
- Column count toggle (2 or 3 columns)
- Drag-and-drop widget reorder with live preview
- Email notification settings (per-category toggles)
- "Send test email" button — sends via Resend, shows real success/failure state

### Login (`app/(auth)/login/page.tsx`)
- Uses Supabase `signInWithOAuth({ provider: "google" })` — redirects through Supabase, not Google Identity Services directly
- No `NEXT_PUBLIC_GOOGLE_CLIENT_ID` needed client-side (only Supabase's server-side Google provider config matters)
- Simple Google-branded button, redirects to `/auth/callback` on success

### Alerts system
- In-app feed with real-time Supabase subscriptions
- `price_alerts` table: user-defined conditions checked every 2 min during market hours
- Market monitor: news alerts for top 50 active stocks + watchlist stocks (every 15 min)
- Email notifications via Resend (toggle in Dashboard Preferences)
- Alert categories: `news_earnings`, `news_fda`, `news_ma`, `news_analyst`, `news_regulatory`, `scanner_entry`, `high_rvol`, `big_gap`, `price_alert`

### Python service (FastAPI, runs on Railway, port via `PORT` env var)
- `scanner.py` — TradingView screener, falls back to Polygon.io. 0 filters → `DEFAULT_FILTERS` (gap ≥ 3%, avg vol ≥ 500k, ATR ≥ 0.5). Frontend sends `filters: null` (not `[]`) when no custom filters are set.
- `scheduler.py` — APScheduler: 7:30 ET pre-market, 9:30 ET open, 9:35–4PM every 5 min
- `market_monitor.py` — news monitor every 15 min during extended hours
- `price_alert_checker.py` — checks user price alerts every 2 min
- `alert_triggers.py` — fires in-app alerts when scanner conditions met
- `email_sender.py` — sends dark-themed HTML emails via Resend REST API; FROM_ADDRESS currently `"Glade Deck Alerts <onboarding@resend.dev>"` — change to `alerts@gladedeck.com` once Resend domain verification completes
- `news.py` — fetches news for symbols
- Secret: `X-Service-Secret` header required on all endpoints (must match `SERVICE_SECRET`)
- `main.py` entry point: `if __name__ == "__main__": uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))`
- `Dockerfile` used by Railway: `CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`

---

## Key Files

```
app/
  (auth)/login/page.tsx          — Google OAuth login page (Supabase signInWithOAuth)
  (dashboard)/
    dashboard/page.tsx           — Dashboard hub (6 parallel Supabase queries)
    scanner/page.tsx             — Scanner tab (p-4 md:p-6 responsive padding)
    charts/page.tsx              — Charts + watchlist sidebar
    alerts/page.tsx              — Alerts management
    daily-review/page.tsx        — Daily review chatbot (p-4 md:p-6 responsive padding)
    trade-log/page.tsx           — Trade history (p-4 md:p-6 responsive padding)
    strategies/page.tsx          — Strategy management
    reports/page.tsx             — Reports
  layout.tsx                     — Root layout: title "Glade Deck — Trading Dashboard"
  globals.css                    — CSS variables + .scrollbar-hide utility class
  api/
    scanner/route.ts             — POST: runs scan via Python; GET: today's results
    notification-prefs/route.ts  — GET/POST email preferences
    notification-prefs/test/route.ts — POST: sends test email via Resend (RESEND_TEST_TO override)
    price-alerts/route.ts        — CRUD for price alert rules
    alerts/route.ts              — Mark alerts read, delete
    trades/route.ts              — Trade CRUD

components/
  nav/Navbar.tsx                 — Top nav: tabs scroll horizontally on mobile (overflow-x-auto scrollbar-hide)
  dashboard/
    DashboardHub.tsx             — Responsive widget grid (1/2/3 cols by breakpoint + user pref)
    DashboardPreferences.tsx     — Dialog: layout + widget order + email settings + test email
  alerts/AlertsPage.tsx          — My Alerts + Activity tabs (p-4 md:p-6)
  scanner/
    ScannerWorkspace.tsx         — Full scanner UI with filter presets + results table (overflow-x-auto)
    ScannerTable.tsx             — Simpler scanner results table (overflow-x-auto)
  trades/TradeTable.tsx          — Trade history table (overflow-x-auto)

lib/
  dashboard-widgets.ts           — WidgetKey types, loadPrefs/savePrefs, PREFS_EVENT
  types/index.ts                 — All shared TypeScript types
  scanner-config.ts              — Filter fields, operators, column presets

python-service/
  main.py                        — FastAPI app entry point
  scheduler.py                   — APScheduler configuration
  scanner.py                     — TradingView scan logic
  email_sender.py                — Resend email integration (update FROM_ADDRESS when domain verified)
  Dockerfile                     — Used by Railway for build/deploy

next.config.mjs                  — ignoreBuildErrors/ignoreDuringBuilds, allowedOrigins for server actions
public/sw.js                     — Service worker for Web Push (VAPID not configured yet)
.gitignore                       — excludes .env*, node_modules, .next, __pycache__, .vercel
```

---

## Database Tables (Supabase)

All tables have RLS enabled with `auth.uid() = user_id` policies.

- `watchlists` — id, user_id, name, symbols[]
- `scan_results` — id, user_id, date, symbol, gap_pct, rvol, atr, price, change_pct, catalyst_tag, sector, raw_json
- `alerts` — id, user_id, type, symbol, condition, triggered_at, delivered_via, is_read
- `price_alerts` — id, user_id, name, symbol, watchlist_id, field, condition, value, trigger_mode, is_active, symbol_states, last_triggered_at
- `strategies` — id, user_id, name, description, time_horizon, catalyst_type, setup_pattern, entry_rules, exit_rules, risk_params
- `trades` — id, user_id, strategy_id, symbol, entry_date, exit_date, entry_price, exit_price, qty, side, pnl, account, trade_type, setup_notes, what_went_well, what_went_wrong, what_to_change, source
- `trade_ideas` — id, user_id, strategy_id, symbol, thesis, time_horizon, catalyst, status
- `daily_summaries` — id, user_id, date, pnl, trades_count, summary_text, raw_chat_json
- `notification_prefs` — user_id (PK), email_enabled, email_news, email_scanner, email_price_alerts

---

## Dashboard Preferences (localStorage)

Key: `glade:dashboard_prefs`
Event: `glade:prefs_updated` (CustomEvent dispatched on save, listened by DashboardHub)

```typescript
interface DashboardPrefs {
  cols: 2 | 3;
  widgetOrder: WidgetKey[];
}
```

---

## Known Issues / Pre-existing Errors

- 10 TypeScript errors in `lib/supabase/server.ts` (4) and `middleware.ts` (6) — implicit `any` parameter types (TS7006/TS7031). Pre-existing, not introduced by any feature work. Build ignores them via `ignoreBuildErrors: true` in `next.config.mjs`.
- Scanner shows "Configure your filters and click Run Scan" until a scan is explicitly run.
- Resend currently uses `onboarding@resend.dev` sender (can only deliver to the Resend account owner's email, or to `RESEND_TEST_TO` override). Once Resend domain verification for `gladedeck.com` completes, update `FROM_ADDRESS` in `python-service/email_sender.py` to `"Glade Deck Alerts <alerts@gladedeck.com>"` and remove `RESEND_TEST_TO` from Vercel env vars.

---

## Deployment Troubleshooting Log (for future reference)

Problems hit and fixed while standing up Vercel + Railway, in case similar errors recur:

1. **Vercel build failed on pre-existing TS errors** → fixed via `ignoreBuildErrors: true`.
2. **Vercel auto-deploys blocked ("Hobby Plan does not support collaboration for private repositories")** → fixed by making the GitHub repo public.
3. **Google login "Missing required parameter: client_id"** → old login used Google Identity Services requiring `NEXT_PUBLIC_GOOGLE_CLIENT_ID` baked in at build time; rewrote login to use Supabase `signInWithOAuth` instead.
4. **Supabase "Unsupported provider: missing OAuth secret"** → Supabase's Google provider needed Client ID + Secret configured in Authentication → Providers → Google (the new OAuth flow makes Supabase the OAuth client).
5. **Railway build failed — security vulnerabilities (CVE-2025-55184, CVE-2025-67779 in next@14.2.29)** → Railway scans the whole repo even with Root Directory set; fixed by upgrading to `next@14.2.35`.
6. **Railway build using wrong files (found Next.js package-lock.json)** → Root Directory wasn't set; fixed by setting Settings → Root Directory → `python-service`.
7. **Scan failed: "Python service is not running"** → `PYTHON_SERVICE_URL` not set in Vercel for Production, or set without `https://` prefix.
8. **Scan failed: 403 Forbidden** → secret mismatch between Vercel's `PYTHON_SERVICE_SECRET` and Railway's `SERVICE_SECRET` — both must be identical (`glade-secret-123`).
9. **"Name or service not known" / Invalid API key in Railway logs** → `SUPABASE_SERVICE_ROLE_KEY` in Railway was wrong/truncated; re-copied the full `service_role` key (not `anon`) from Supabase → Settings → API.
10. **postgrest.exceptions.APIError PGRST125 "Invalid path specified in request URL"** → `SUPABASE_URL` in Railway had a trailing slash or stray whitespace from copy-paste; fixed by retyping the exact URL with no trailing slash.
11. **Email links would point to localhost in production** → added `NEXT_PUBLIC_APP_URL` (Vercel) and `GLADE_APP_URL` (Railway) pointing to the live Vercel URL.
12. **Full rebrand "Glade" → "Glade Deck" / `gladedeck`** → order that worked: (1) update all display-text strings in code and push, (2) rename GitHub repo (Settings → repository name) — old git remotes auto-redirect but should be updated with `git remote set-url`, (3) rename Vercel project (Settings → General) which changes the `.vercel.app` URL, (4) add new URL to Supabase → Authentication → URL Configuration (Site URL + Redirect URLs), (5) update `NEXT_PUBLIC_APP_URL` in Vercel, (6) update `next.config.mjs` allowedOrigins with new domain, (7) rename Railway service/project (Settings) and reconnect the GitHub source if it shows "GitHub Repo not found" (happens because Railway's source link breaks on repo rename — fix via the edit/pencil icon next to Source Repo), (8) update `PYTHON_SERVICE_URL` in Vercel to new Railway domain, (9) update `GLADE_APP_URL` in Railway to new Vercel domain, (10) redeploy Vercel — must be the latest deployment, not an older one from the list, (11) verify login + scan end-to-end.
13. **Custom domain setup (gladedeck.com via Squarespace DNS)** → In Vercel → Domains: add `gladedeck.com` and `www.gladedeck.com`. Squarespace already pre-configures Vercel DNS for domains registered there; records showed up as "Vercel" in Squarespace DNS manager and Vercel marked them valid (blue checkmark). Resend domain verification (for sending email from `alerts@gladedeck.com`) requires 3 manual DNS records in Squarespace: DKIM TXT (`resend._domainkey`), MX record, and SPF TXT — the "Go to Squarespace" button in Resend does NOT add them automatically, must be added manually. DNS propagation takes 2–6 hours. Until verified, Resend can only send to `RESEND_TEST_TO` override address.

---

## Pending / Not Yet Done

- **Schwab API** OAuth + position sync — user needs to register at developer.schwab.com first; Trade Log and Daily Review show manual trades only for now
- **Resend domain verification** — DNS records added for `gladedeck.com`; waiting for propagation. Once verified: update `FROM_ADDRESS` in `python-service/email_sender.py` to `"Glade Deck Alerts <alerts@gladedeck.com>"` and remove `RESEND_TEST_TO` env var from Vercel
- **Twilio SMS** alerts (credentials not configured — keys are placeholder in Railway env vars)
- **Web Push** notifications (VAPID keys not configured)
