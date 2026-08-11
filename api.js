/**
 * Real-time BNE (Brisbane Airport) flight API layer.
 *
 * Data sources (both free, keyless):
 * - adsb.lol: live ADS-B aircraft positions near a lat/lon point (~1s-ish freshness).
 * - adsbdb.com: callsign -> scheduled route (origin/destination airport) lookup,
 *   backed by static standing-data (not live flight-plan broadcast), so it's the
 *   airline's scheduled route for that callsign, not built from BNE-specific batch data.
 *
 * Aircraft are classified as "incoming" (destination = BNE) or "outgoing"
 * (origin = BNE) using the adsbdb route lookup. Aircraft with no resolvable
 * route, or whose route doesn't touch BNE, are treated as overflights and
 * excluded from the incoming/outgoing lists.
 */

const https = require('https');
const { getAuState } = require('./au-states');

const ADSB_LOL_BASE_URL = 'https://api.adsb.lol/v2';
const ADSBDB_BASE_URL = 'https://api.adsbdb.com/v0';

/**
 * Minimal GET-JSON helper built on Node's built-in `https` module instead of
 * global fetch/undici.
 *
 * Why: undici (which backs global fetch in Node 18/20) ignores both
 * `dns.setDefaultResultOrder('ipv4first')` and the `--dns-result-order` CLI
 * flag - it does its own Happy-Eyeballs resolution and will still attempt
 * (and fail on) IPv6 addresses on networks where IPv6 routing is broken but
 * DNS still returns AAAA records. `https.get`/`request` honor the `family`
 * socket option directly, so forcing `family: 4` reliably avoids the broken
 * IPv6 path. See README "Troubleshooting" for the diagnostic behind this.
 *
 * @param {string} url
 * @returns {Promise<{status: number, json: any}>}
 */
function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { family: 4, timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (!body) {
          resolve({ status: res.statusCode, json: null });
          return;
        }
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch (err) {
          reject(new Error(`Failed to parse JSON from ${url}: ${err.message}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`Request timed out: ${url}`)));
    req.on('error', reject);
  });
}

const BNE_IATA = 'BNE';
const BNE_ICAO = 'YBBN';
const BNE_LAT = -27.3842;
const BNE_LON = 153.1175;

// In-memory cache for callsign -> route lookups. Routes are effectively
// static (scheduled airline routes), so we cache for the process lifetime
// to avoid hammering adsbdb with repeat lookups on every poll.
const routeCache = new Map(); // callsign -> { route: {...} | null, fetchedAt: number }
const ROUTE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch live aircraft near BNE from adsb.lol.
 *
 * @param {number} [radiusNm=50] - search radius in nautical miles (max 250)
 * @returns {Promise<Array<object>>} raw aircraft objects from adsb.lol
 */
async function fetchLiveAircraft(radiusNm = 50) {
  const url = `${ADSB_LOL_BASE_URL}/point/${BNE_LAT}/${BNE_LON}/${radiusNm}`;
  const { status, json } = await getJson(url);
  if (status !== 200) {
    throw new Error(`adsb.lol request failed: HTTP ${status}`);
  }
  return json?.ac || [];
}

/**
 * Look up the scheduled route for a callsign via adsbdb, with in-memory caching.
 *
 * @param {string} callsign - trimmed flight callsign, e.g. "SIA236"
 * @returns {Promise<object|null>} route object with origin/destination, or null if unresolvable
 */
async function lookupRoute(callsign) {
  if (!callsign) return null;

  const cached = routeCache.get(callsign);
  if (cached && Date.now() - cached.fetchedAt < ROUTE_CACHE_TTL_MS) {
    return cached.route;
  }

  let route = null;
  try {
    const { status, json } = await getJson(`${ADSBDB_BASE_URL}/callsign/${encodeURIComponent(callsign)}`);
    if (status === 200) {
      route = json?.response?.flightroute ?? null;
    }
    // 404 / no route found -> leave route as null, still cache the negative result.
  } catch (err) {
    // Network error on a single lookup shouldn't fail the whole batch;
    // just leave this callsign unresolved for this poll (don't cache errors).
    return null;
  }

  routeCache.set(callsign, { route, fetchedAt: Date.now() });
  return route;
}

/**
 * Classify a resolved route relative to BNE.
 *
 * @param {object|null} route - adsbdb flightroute object
 * @returns {'incoming'|'outgoing'|'overflight'}
 */
function classify(route) {
  if (!route) return 'overflight';
  const originIsBne = route.origin?.iata_code === BNE_IATA || route.origin?.icao_code === BNE_ICAO;
  const destIsBne = route.destination?.iata_code === BNE_IATA || route.destination?.icao_code === BNE_ICAO;

  if (destIsBne && !originIsBne) return 'incoming';
  if (originIsBne && !destIsBne) return 'outgoing';
  return 'overflight'; // neither touches BNE, or a BNE-BNE oddity
}

/**
 * Attach a best-effort Australian state/territory to an adsbdb airport
 * object. Returns null unchanged (no airport resolved).
 *
 * @param {object|null} airport
 * @returns {object|null} airport with an added `state` field
 */
function withState(airport) {
  if (!airport) return null;
  return { ...airport, state: getAuState(airport) };
}

/**
 * Get current incoming/outgoing flights near BNE.
 *
 * @param {number} [radiusNm=50]
 * @returns {Promise<{ incoming: object[], outgoing: object[], overflights: object[] }>}
 */
async function getBneFlights(radiusNm = 50) {
  const aircraft = await fetchLiveAircraft(radiusNm);

  const results = await Promise.all(
    aircraft.map(async (ac) => {
      const callsign = ac.flight ? ac.flight.trim() : null;
      const route = await lookupRoute(callsign);
      const direction = classify(route);

      return {
        direction,
        callsign,
        icao24: ac.hex,
        registration: ac.r ?? null,
        aircraftType: ac.t ?? null,
        altitudeFt: ac.alt_baro ?? ac.alt_geom ?? null,
        groundSpeedKt: ac.gs ?? null,
        verticalRateFtMin: ac.baro_rate ?? ac.geom_rate ?? null,
        distanceNm: ac.dst ?? null,
        bearingDeg: ac.dir ?? null,
        lat: ac.lat ?? null,
        lon: ac.lon ?? null,
        airline: route?.airline?.name ?? null,
        origin: withState(route?.origin ?? null),
        destination: withState(route?.destination ?? null),
      };
    })
  );

  const incoming = results.filter((f) => f.direction === 'incoming').sort((a, b) => (a.distanceNm ?? Infinity) - (b.distanceNm ?? Infinity));
  const outgoing = results.filter((f) => f.direction === 'outgoing').sort((a, b) => (a.distanceNm ?? Infinity) - (b.distanceNm ?? Infinity));
  const overflights = results.filter((f) => f.direction === 'overflight');

  return { incoming, outgoing, overflights };
}

module.exports = {
  BNE_IATA,
  BNE_ICAO,
  fetchLiveAircraft,
  lookupRoute,
  classify,
  getBneFlights,
};
