# Glade — Trading Dashboard

A personal trading dashboard that automates the repetitive parts of a trader's day: morning prep, scanning, and end-of-day review. Built for one user initially but multi-user-ready.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) |
| UI | Shadcn/ui + Tailwind CSS (dark trading theme) |
| Backend | Next.js API routes + Python FastAPI service |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Auth | Supabase Auth + Google OAuth |
| Email | Resend (transactional alerts) |
| Scanner | TradingView screener (unofficial endpoint) |
| Charts | TradingView Widget (embeddable) |
| AI | Claude API (Pine Script generator, Daily Review chatbot) |
| Hosting | Vercel (Next.js) + Railway (Python service — pending) |

---

## Deployment

- **Frontend**: https://glade-zeta.vercel.app (live on Vercel)
- **Python service**: Not yet deployed — currently runs locally with `python main.py` from `python-service/`
- **GitHub repo**: https://github.com/bhasinmanish/glade

To run locally:
- Next.js: `npm run dev` from root
- Python service: `python main.py` from `python-service/` (requires uvicorn installed)

---

## Environment Variables

### `.env.local` (Next.js — never commit)
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=932453965974-iqmo9qcq3k513l43v7faltcvp5uujq2h.apps.googleusercontent.com
NEXT_PUBLIC_SUPABASE_URL=https://uryrtpamvkprugnjqesn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=re_joDAfVjm_Jk389H6kVFHS96MjFjHTzRqH
RESEND_TEST_TO=manshabhasin9@gmail.com
PYTHON_SERVICE_URL=http://localhost:8000
PYTHON_SERVICE_SECRET=glade-secret-123
ANTHROPIC_API_KEY=sk-ant-...
```

### `python-service/.env` (Python — never commit)
```
SUPABASE_URL=https://uryrtpamvkprugnjqesn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SERVICE_SECRET=glade-secret-123
RESEND_API_KEY=re_joDAfVjm_Jk389H6kVFHS96MjFjHTzRqH
```

---

## What's Been Built

### Navigation tabs (all implemented)
- **Dashboard** — hub with 6 draggable widgets, user-customizable layout (2 or 3 columns)
- **Scanner** — TradingView-powered stock screener with custom filter presets
- **Charts** — TradingView chart with watchlist sidebar
- **Alerts** — dedicated alerts page (My Alerts + Activity tabs)
- **Daily Review** — AI chatbot trade journal (P2 badge — UI built, Schwab sync pending)
- **Trade Log** — trade history + P&L tracking (P2 badge — UI built, Schwab sync pending)
- **Strategies** — strategy management (P3 badge)
- **Reports** — reporting templates (P3 badge)

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
- "Send test email" button

### Alerts system
- In-app feed with real-time Supabase subscriptions
- `price_alerts` table: user-defined conditions checked every 2 min during market hours
- Market monitor: news alerts for top 50 active stocks + watchlist stocks (every 15 min)
- Email notifications via Resend (toggle in Dashboard Preferences)
- Alert categories: `news_earnings`, `news_fda`, `news_ma`, `news_analyst`, `news_regulatory`, `scanner_entry`, `high_rvol`, `big_gap`, `price_alert`

### Python service (FastAPI, port 8000)
- `scanner.py` — TradingView screener, falls back to Polygon.io
- `scheduler.py` — APScheduler: 7:30 ET pre-market, 9:30 ET open, 9:35–4PM every 5 min
- `market_monitor.py` — news monitor every 15 min during extended hours
- `price_alert_checker.py` — checks user price alerts every 2 min
- `alert_triggers.py` — fires in-app alerts when scanner conditions met
- `email_sender.py` — sends dark-themed HTML emails via Resend REST API
- `news.py` — fetches news for symbols
- Secret: `X-Service-Secret` header required on all endpoints

---

## Key Files

```
app/
  (auth)/login/page.tsx          — Google OAuth login page
  (dashboard)/
    dashboard/page.tsx           — Dashboard hub (6 parallel Supabase queries)
    scanner/page.tsx             — Scanner tab
    charts/page.tsx              — Charts + watchlist sidebar
    alerts/page.tsx              — Alerts management
    daily-review/page.tsx        — Daily review chatbot
    trade-log/page.tsx           — Trade history
    strategies/page.tsx          — Strategy management
    reports/page.tsx             — Reports
  api/
    scanner/route.ts             — POST: runs scan via Python; GET: today's results
    notification-prefs/route.ts  — GET/POST email preferences
    notification-prefs/test/route.ts — POST: sends test email via Resend
    price-alerts/route.ts        — CRUD for price alert rules
    alerts/route.ts              — Mark alerts read, delete
    trades/route.ts              — Trade CRUD

components/
  nav/Navbar.tsx                 — Top nav + Dashboard Preferences trigger
  dashboard/
    DashboardHub.tsx             — 6-widget grid, reads prefs from localStorage
    DashboardPreferences.tsx     — Dialog: layout + widget order + email settings
  alerts/AlertsPage.tsx          — My Alerts + Activity tabs
  scanner/ScannerWorkspace.tsx   — Filter presets + results table

lib/
  dashboard-widgets.ts           — WidgetKey types, loadPrefs/savePrefs, PREFS_EVENT
  types/index.ts                 — All shared TypeScript types

python-service/
  main.py                        — FastAPI app entry point (run with python main.py)
  scheduler.py                   — APScheduler configuration
  scanner.py                     — TradingView scan logic
  email_sender.py                — Resend email integration
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
- Python service must be running for scanner to work. Without it, the Next.js API returns a 503 with a helpful error message.
- Scanner shows "Configure your filters and click Run Scan" until a scan is explicitly run — 0 filters defaults to TradingView defaults (gap ≥ 3%, avg vol ≥ 500k, ATR ≥ 0.5).

---

## Pending / Not Yet Done

- **Railway deployment** for Python service (so scanner + alerts run 24/7 without a terminal)
- **Schwab API** OAuth + position sync (Trade Log shows manual trades only for now)
- **Twilio SMS** alerts (credentials not configured — keys are placeholder in python-service/.env)
- **Web Push** notifications (VAPID keys not configured)
- **P2/P3 badges** on Daily Review, Trade Log, Strategies, Reports nav items (nav items exist, badges can be removed when features are complete)
- **Resend domain verification** — currently using `onboarding@resend.dev` sender which can only deliver to the Resend account email. Need to verify a domain at resend.com/domains to send to any recipient.
