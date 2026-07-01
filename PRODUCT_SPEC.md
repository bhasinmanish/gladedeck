# Glade Deck — Product Specification

A personal trading dashboard for active day traders. Automates the repetitive parts of the trading day: morning stock scanning, live alerts, and end-of-day review. Designed for one primary user but architected to support multiple users.

---

## Core Requirements

- Secure user authentication (OAuth login with Google)
- Fully cloud-hosted — no local processes or terminal required to use the live site
- Works on mobile and desktop (responsive design)
- Dark theme styled like a trading terminal
- Real-time data where applicable (alerts feed updates live)

---

## Navigation

Top navigation bar with tabs for every section. On mobile, tabs scroll horizontally so all sections are reachable by swiping — they never wrap or get cut off. Sections:

1. Dashboard
2. Scanner
3. Charts
4. Alerts
5. Daily Review
6. Trade Log
7. Strategies
8. Reports

---

## 1. Dashboard

An overview hub showing 6 widgets at a glance. The layout is user-configurable:

- Toggle between 2-column and 3-column grid
- Drag and drop widgets into any order
- Preferences are saved and persist across sessions

### Widgets

**Today's Top Setups** — shows the scanner results from today. Columns: symbol, gap%, RVOL, change%. Clicking a symbol opens the Charts tab for that symbol.

**Alerts** — recent alert feed. Shows alert type (color-coded dot), symbol, condition text, and time ago. Unread count badge. Updates in real time without refreshing the page.

**Trade Log** — all-time P&L total, win rate percentage, and a short list of recent trades (symbol, side, P&L, date).

**Daily Review** — today's P&L, number of trades, and how many have reflections written. Shows a summary if one has been written.

**Trade Ideas** — list of active trade ideas with their status (watching / active) and thesis.

**Watchlists** — all watchlist names and their symbols as clickable chips. Clicking a symbol opens the Charts tab.

---

## 2. Scanner

A stock screener that lets the user build custom filter presets and run scans.

### Filter Presets
- User can create multiple named presets (tabs across the top)
- Double-click a tab name to rename it inline
- Each preset stores a set of filter rules

### Filter Rules
Each rule is: `[field] [operator] [value]`

Available fields: Price, Change%, Gap%, RVOL (relative volume), ATR, Volume, Avg Volume, Float, Market Cap, RSI, Beta, 1W Performance, 1M Performance, EPS, P/E, ROE, Debt/Equity, Gross Margin, Net Margin, Short Ratio, Sector

Operators: `>`, `<`, `>=`, `<=`, `=`, `!=`

Multiple rules can be added per preset. Rules are combined with AND logic.

### Column Visibility
User can toggle which columns appear in the results table. Presets for common views (e.g. "Momentum", "Fundamentals").

### Results Table
Columns vary by preset but core columns include: Symbol, Price, Change%, Gap%, RVOL, ATR, Sector, Catalyst tag.

- Sortable by clicking column headers
- Filter by sector via dropdown
- Search by symbol
- Horizontal scroll on mobile

### Behavior
- Clicking "Run Scan" sends the active filters to a background scanning service and returns results
- Results are also stored per-day so they can be retrieved without re-running
- Scanner runs automatically on a schedule during market hours (pre-market, market open, every few minutes during the session)
- If no filters are set, a default filter runs (gap ≥ 3%, avg volume ≥ 500k, ATR ≥ 0.5)

---

## 3. Charts

- Embedded interactive stock chart (full-featured: candlesticks, indicators, drawing tools)
- Watchlist sidebar: list of all user watchlists and their symbols
- Clicking a symbol in the sidebar loads that symbol's chart
- Deep-linkable: `/charts?symbol=AAPL` loads AAPL directly

---

## 4. Alerts

Two tabs: **My Alerts** and **Activity**.

### My Alerts tab
User-created price alert rules. Each rule has:
- Name
- Symbol or watchlist to watch
- Field to monitor (price, gap%, RVOL, etc.)
- Condition (`above` / `below`)
- Threshold value
- Trigger mode: `once` (fires once then deactivates) or `every time` (fires each time condition is met)
- Active/inactive toggle

User can create, edit, delete, and toggle rules.

### Activity tab
All alert events that have fired, newest first. Each entry shows:
- Alert type (colored badge): Earnings, FDA, M&A, Analyst, Regulatory, Corporate, News, Scanner Entry, High RVOL, Big Gap, Price Alert
- Symbol
- Condition description
- Timestamp (relative: "3 minutes ago")
- Read/unread state

Alert types fire from:
- Price alert rules the user created
- Automatic news monitoring (earnings announcements, FDA decisions, M&A deals, analyst upgrades/downgrades, regulatory news — checked automatically every 15 min for top active stocks and the user's watchlist symbols)
- Scanner entries (when a new stock appears in the scan results)
- High RVOL / big gap automatic detection

### Delivery
- In-app (real-time feed)
- Email notification (user can toggle per category in Dashboard Preferences)
- Email is a dark-themed HTML email with the alert details and a link back to the app

---

## 5. Daily Review

An AI chatbot for end-of-day trade journaling.

- Shows today's date, total P&L, number of trades
- Chat interface: user types messages, AI responds
- AI has context about today's trades (symbols, P&L, side, notes)
- Purpose: help the trader reflect on what went well, what went wrong, what to change
- Conversation is saved per day so it can be resumed

---

## 6. Trade Log

Manual trade entry and history.

### Trade fields
- Symbol
- Side (long / short)
- Trade type (day trade / swing / options)
- Entry date, exit date
- Entry price, exit price
- Quantity (shares)
- P&L (auto-calculated or manual)
- Strategy (linked to a saved strategy)
- Account
- Notes: setup notes, what went well, what went wrong, what to change

### Trade table
All trades, sortable by date. Horizontal scroll on mobile. Columns: symbol, side, type, date, entry, exit, shares, P&L, actions (edit/delete).

---

## 7. Strategies

Save and organize named trading strategies.

Each strategy has:
- Name
- Description
- Time horizon (day trade / swing / long-term)
- Catalyst type (earnings, FDA, technical breakout, etc.)
- Setup pattern
- Entry rules
- Exit rules
- Risk parameters

Strategies can be linked to trades in the Trade Log.

---

## 8. Reports

A section for viewing trading performance reports and summaries. (Placeholder — detailed requirements TBD.)

---

## Dashboard Preferences Panel

Accessible via a settings icon in the nav bar. Contains:

- **Layout**: toggle between 2 and 3 column dashboard grid
- **Widget order**: drag and drop list to reorder the 6 widgets
- **Email notifications**: per-category toggles for which alert types send emails
  - Categories: News (Earnings, FDA, M&A, Analyst, Regulatory), Scanner alerts, Price alerts
- **Send test email** button — sends a test email to verify delivery is working

---

## Background Service

A separate background process (separate from the web app) handles:

- Running the stock scanner on a schedule (pre-market 7:30am ET, market open 9:30am ET, then every 5 minutes from 9:35am–4pm ET)
- Monitoring news for top 50 active stocks + user watchlist stocks every 15 minutes
- Checking user price alert rules every 2 minutes during extended hours
- Sending emails when alerts fire
- Writing scan results and alert events to the database

This service must run continuously in the cloud — it should not require the user to have anything open.

---

## General UX Requirements

- All data tables support horizontal scrolling on mobile (never squash columns)
- Page padding shrinks on mobile (more content visible)
- Headings scale down slightly on mobile
- Empty states: every widget/table should show a clear message when there's no data yet
- Loading states: buttons that trigger async actions show a spinner/disabled state
- Error states: if a scan or API call fails, show the actual error message (not a generic "something went wrong")
- Real-time: the alerts feed should update without refreshing the page
