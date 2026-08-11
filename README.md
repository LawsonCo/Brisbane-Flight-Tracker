# BNE Skywatch ✈️

Lightweight live tracker for flights landing at / departing from Brisbane Airport (BNE), built with plain Node.js — no frameworks, no build step, no API keys.

Deployed live at: https://brisbane-flight-tracker.onrender.com/

## Data sources (both free & keyless)

- [adsb.lol](https://adsb.lol) — live ADS-B aircraft positions near a lat/lon point
- [adsbdb.com](https://www.adsbdb.com) — callsign → scheduled route (origin/destination airport) lookup

Aircraft near BNE are classified as **incoming** (destination = BNE) or **outgoing** (origin = BNE) based on the resolved route. Anything else is treated as an overflight and excluded from the lists.

## Run locally

```bash
npm start
```

Then open http://localhost:3939 (or the `PORT` you set).

## Deploy (Render)

This repo includes a `render.yaml` for one-click deploy:

1. Push this repo to GitHub.
2. On [render.com](https://render.com), create a new Web Service from the repo — Render will pick up `render.yaml` automatically.
3. Free tier: the service spins down when idle and takes ~30-60s to wake on the next request.

## Notes

- Node's built-in `https` module is used instead of global `fetch`, forcing IPv4 (`family: 4`) — see comments in `api.js` for why (some networks have broken IPv6 routing that Node's fetch/undici doesn't fall back from correctly).
- The Australia state/territory labels (`au-states.js`) are a small static ICAO→state lookup table, not exhaustive — airports outside the table just won't show a state.
- Both upstream APIs are free community projects with fair-use limits; this app polls every 15s client-side and caches route lookups per callsign for 30 minutes server-side to keep load light.
