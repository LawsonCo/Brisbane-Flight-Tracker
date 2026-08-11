const REFRESH_INTERVAL_MS = 15000;

const incomingList = document.getElementById('incoming-list');
const outgoingList = document.getElementById('outgoing-list');
const incomingCount = document.getElementById('incoming-count');
const outgoingCount = document.getElementById('outgoing-count');
const updatedEl = document.getElementById('updated');

function fmtAlt(ft) {
  if (ft === null || ft === undefined) return '—';
  if (ft === 'ground') return 'ground';
  return `${Math.round(ft).toLocaleString()} ft`;
}

function fmtDist(nm) {
  if (nm === null || nm === undefined) return '—';
  return `${nm.toFixed(1)} nm`;
}

function locationLabel(airport) {
  if (!airport) return '?';
  const name = airport.municipality || airport.name || '?';
  if (airport.country_iso_name === 'AU') {
    return airport.state ? `${name}, ${airport.state}` : name;
  }
  return airport.country_name ? `${name}, ${airport.country_name}` : name;
}

function flightCard(flight) {
  const li = document.createElement('li');
  li.className = 'flight-card';

  const isIncoming = flight.direction === 'incoming';
  const originLabel = locationLabel(flight.origin);
  const destLabel = locationLabel(flight.destination);
  const routeText = isIncoming ? `${originLabel} → BNE` : `BNE → ${destLabel}`;

  li.innerHTML = `
    <div>
      <div class="route">${flight.callsign || flight.icao24 || 'Unknown'} · ${routeText}</div>
      <div class="meta">${flight.airline || 'Unknown airline'} · ${fmtAlt(flight.altitudeFt)} · ${fmtDist(flight.distanceNm)} away</div>
    </div>
    <span class="badge ${isIncoming ? 'incoming' : 'outgoing'}">${isIncoming ? 'Landing' : 'Departing'}</span>
  `;
  return li;
}

function renderList(listEl, countEl, flights) {
  listEl.innerHTML = '';
  countEl.textContent = flights.length ? `(${flights.length})` : '';

  if (!flights.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Nothing right now';
    listEl.appendChild(empty);
    return;
  }

  flights.forEach((f) => listEl.appendChild(flightCard(f)));
}

async function refresh() {
  try {
    const res = await fetch('/api/flights');
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();

    renderList(incomingList, incomingCount, data.incoming);
    renderList(outgoingList, outgoingCount, data.outgoing);

    const time = new Date(data.fetchedAt).toLocaleTimeString();
    updatedEl.textContent = `Updated ${time}`;
  } catch (err) {
    updatedEl.textContent = `Couldn't refresh: ${err.message}`;
  }
}

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
