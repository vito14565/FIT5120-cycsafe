# CycSafe — Melbourne Cycling Safety (React + AWS Lambda)

CycSafe is a lightweight web app that surfaces live cycling risk, lets riders report incidents, and (soon) plans safer routes. The frontend is React + Vite; the backend is a single AWS Lambda that calculates risk, optionally reverse‑geocodes, and proxies public feeds with proper CORS.

---

## Features

- **Live risk at your location**
  - Risk score (0–100) + bucket: **Low (<20)**, **Medium (20–60)**, **High (>60)**
  - Weather + crash density contribute to risk (see Lambda)
  - **Skeleton loading** while the first fetch runs (no “0% flicker”)
  - Optional **haptic buzz** on Medium/High (Android Chrome)
- **LocationBus** (single source of truth)
  - Refreshes coordinates every **5s**
  - Reverse‑geocodes via your Lambda
  - Provides **coords for backend** and **address for UI**
- **Incident reporting**
  - Full form with severity, description, photos (S3 pre-signed PUT)
  - **Quick report** helper for one‑tap submissions
- **Alerts tray** with incidents/weather
- **Placeholder pages**
  - **Safe Routing** and **Data Insights** show “Feature coming soon” cards

---

## Quick start

### 1) Prereqs
- **Node 18+** (or 20+)
- An AWS Lambda Function URL running the included Python handler
  - CORS must allow your dev origin (e.g., `http://localhost:5173`)

### 2) Frontend setup

```bash
# install deps
npm i

# add your env file
cp .env.example .env
# then edit .env
```

`.env` (Vite requires the `VITE_` prefix):
```env
VITE_LAMBDA_URL=https://<your-lambda-id>.lambda-url.ap-southeast-2.on.aws/
```

> After changing `.env`, **restart** the dev server so Vite picks it up.

Run dev:
```bash
npm run dev
```

Build & preview:
```bash
npm run build
npm run preview
```

### 3) Backend (Lambda)

Deploy the provided Python Lambda (`index.py`).  
Recommended env vars:

- `ALLOWED_ORIGINS`: `https://www.cycsafe.me,http://localhost:5173`
- `GOOGLE_MAPS_API_KEY`: _(optional)_ enables reverse‑geocoding
- `GEOCODE_LANG`: default `en-AU`

Endpoints (Function URL query params):
- **Full risk**: `?lat=<..>&lon=<..>&r=500&limit=6000&geocode=1`
- **Geocode only**: `?mode=geocode&lat=<..>&lon=<..>`
- **Crash only**: `?mode=crash&lat=<..>&lon=<..>`
- **VIC feeds proxy**: `?mode=vic&feed=events|impact`

---

## Project structure (key parts)

```
src/
  components/
    Header.tsx           # uses LocationBus for address, Alerts tray
    RiskHeaderCard.tsx   # header with skeleton loading + haptics
    RiskHeaderCard.css
    RiskBodyCard.tsx
    QuickReportButton.tsx
    QuickReportModal.tsx
    FlatCard.tsx
    AlertTray.tsx
    GeoPrompt.tsx
  pages/
    Home.tsx             # calls Lambda for risk; shows cards
    ReportIncident.tsx   # uses LocationBus: address (UI), coords (backend)
    PlanRoutePage.tsx    # "Feature coming soon" card
    DataInsights.tsx     # "Feature coming soon" card
  services/
    LocationBus.ts       # central location service
  lib/
    api.ts               # createIncident, getUploadUrl (S3 presigned)
  assets/
    *.svg
```

---

## LocationBus (central location service)

`src/services/LocationBus.ts` is a tiny singleton that:

- Polls `navigator.geolocation.getCurrentPosition` every **5s**
- Reverse‑geocodes via `VITE_LAMBDA_URL?mode=geocode&lat&lon`
- **Throttles geocoding**: only when entering a new ~110 m cell (0.001°)
- Keeps state in memory and mirrors to localStorage for compatibility

**Public API:**
```ts
LocationBus.start();                // begin polling (idempotent)
LocationBus.stop();

LocationBus.subscribe((snap) => {   // live updates
  // snap: { coords, address, geocoding, lastUpdated, permission }
  // address is for UI; coords are for backend
});

LocationBus.getSnapshot();          // current value
LocationBus.getCoords();            // { lat, lon } | null
LocationBus.getAddress();           // string | null
LocationBus.waitForFirstFix(10_000) // Promise<coords|null>
```

> **Use it everywhere:**  
> - **UI** renders `LocationBus.getSnapshot().address` (or subscribe)  
> - **Backend calls** use `LocationBus.getCoords()`  
> Don’t call geolocation or geocode directly in components.

---

## Risk header & loading

- `RiskHeaderCard` accepts:
  - `riskLevel` (0–100), `riskText` (optional), `title`, `icon`
  - `loading` (boolean) → shows shimmering skeleton instead of `0%`
- Bucketing:
  - **Low** `< 20`, **Medium** `20–60`, **High** `> 60`
- Haptics:
  - 1 short buzz on **Medium**, 2 short buzzes on **High**
  - Toggle is in Home → “Haptic alerts”

---

## Incident reporting

- **UI shows address** (from LocationBus)
- **Submits coords** to API (`Latitude`, `Longitude`)
- Photos are normalized to JPEG ≤ 5 MB / ≤ 2000px before S3 PUT (via `getUploadUrl`)
- A **Quick Report** helper (`submitQuickReport`) maps types → severity

---

## Environment & CORS

- **Frontend**: `VITE_LAMBDA_URL` **must** be set (no fallback)
- **Lambda**: ensure `ALLOWED_ORIGINS` includes your dev/prod origins  
  The function reflects `Access-Control-Allow-Origin` only for allowed origins.
- **Reverse‑geocoding** requires `GOOGLE_MAPS_API_KEY` in Lambda; otherwise the Lambda returns coordinates as the address.

---

## Accessibility & UX

- Live regions (`aria-live="polite"`) for dynamic numbers
- Skeleton loading to avoid “0%” flashes
- Animations run once on bucket change (remount trick)

---

## Troubleshooting

- **Header shows “Locating…” forever**
  - Ensure the site is served in a **secure context** (HTTPS or `localhost`)
  - Grant location permission; check browser site permissions
  - Verify `VITE_LAMBDA_URL` is set; restart `npm run dev` after editing `.env`
  - Confirm Lambda CORS includes your origin
- **Address shows as coordinates**
  - Set `GOOGLE_MAPS_API_KEY` in Lambda env  
  - Check that `?mode=geocode&lat&lon` returns an address
- **CORS errors**
  - Add your origin to Lambda `ALLOWED_ORIGINS` (comma‑separated)
  - Disable Function URL “built‑in CORS” if you’re sending your own headers

---

## Deployment

- **Frontend**: build with `npm run build`; host the `dist/` output
- **Backend**: deploy the Python Lambda and expose a Function URL. Ensure env vars are set and IAM permissions allow DynamoDB read for the `CrashData` table.

---

## Roadmap

- Safe route recommendations (infra + risk-aware)
- Insights & trends dashboards
- More alert types and richer filtering

---

## License

MIT 
