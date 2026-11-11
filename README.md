# QRTrack

QRTrack generates editable, trackable QR codes. A printed code keeps working when you update its destination. The dashboard shows total and daily unique scans, a timeline, and device, browser, and OS breakdowns. Batch generation exports PNG, SVG, and CSV files.

## Run the demo

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open [the local dashboard](http://localhost:5173). The demo starts with an empty embedded Postgres database. It needs no service accounts or credentials.

1. Create a code labeled **Sample café menu** that points to `https://example.com/menu`.
2. Copy the tracking URL and open it in a browser tab. Return to the dashboard to see the scan.
3. Edit the destination to `https://example.com/specials`. Reopen the original tracking URL and check the updated destination.
4. Try bulk mode with `https://example.com/menu` and `https://example.com/events`.

## Implementation

React and Vite serve the dashboard. Express handles QR generation, redirects, and analytics. Postgres records scans and updates counters atomically. The redirect handler filters known preview bots and stores a keyed daily visitor fingerprint for deduplication. Local development listens on loopback.

`npm test` runs the backend tests and builds the frontend. The tests use isolated in-memory databases and exercise redirects, analytics, edits, authentication, and validation. For a production instance, supply your own Postgres connection and sign-in settings using `backend/.env.example`.
