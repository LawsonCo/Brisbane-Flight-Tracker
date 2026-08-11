const { getBneFlights } = require('./api');

async function main() {
  console.log('Fetching live BNE traffic...\n');
  const { incoming, outgoing, overflights } = await getBneFlights(50);

  console.log(`Incoming (${incoming.length}):`);
  incoming.forEach((f) => {
    console.log(`  ${f.callsign ?? '?'} (${f.airline ?? 'unknown'}) from ${f.origin?.name ?? '?'} -> BNE | alt ${f.altitudeFt}ft, ${f.distanceNm}nm out`);
  });

  console.log(`\nOutgoing (${outgoing.length}):`);
  outgoing.forEach((f) => {
    console.log(`  ${f.callsign ?? '?'} (${f.airline ?? 'unknown'}) BNE -> ${f.destination?.name ?? '?'} | alt ${f.altitudeFt}ft, ${f.distanceNm}nm out`);
  });

  console.log(`\nOverflights / unresolved (${overflights.length}):`);
  overflights.slice(0, 5).forEach((f) => {
    console.log(`  ${f.callsign ?? f.icao24} | alt ${f.altitudeFt}ft`);
  });
}

main().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
