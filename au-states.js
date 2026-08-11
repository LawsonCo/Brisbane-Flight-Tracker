/**
 * Best-effort ICAO airport code -> Australian state/territory lookup.
 *
 * adsbdb's airport data has no state/region field, only country + municipality
 * + coordinates - so state can't be read directly from the API. Deriving it
 * properly would need a lat/lon -> state boundary polygon lookup, which is
 * overkill for a lightweight app. Instead this is a small static map covering
 * Australian airports that commonly appear on BNE routes (state capitals,
 * major regional airports, and common FIFO/charter destinations).
 *
 * Not exhaustive: airports not in this table simply won't get a state label.
 */

const AU_AIRPORT_STATE = {
  // Queensland
  YBBN: 'QLD', // Brisbane
  YBCG: 'QLD', // Gold Coast
  YBSU: 'QLD', // Sunshine Coast
  YBCS: 'QLD', // Cairns
  YBTL: 'QLD', // Townsville
  YBRK: 'QLD', // Rockhampton
  YBMK: 'QLD', // Mackay
  YBHM: 'QLD', // Hamilton Island
  YBWP: 'QLD', // Weipa
  YEML: 'QLD', // Emerald
  YBGT: 'QLD', // Gladstone
  YBUD: 'QLD', // Bundaberg
  YBCV: 'QLD', // Charleville
  YBLR: 'QLD', // Longreach

  // New South Wales / ACT
  YSSY: 'NSW', // Sydney
  YSCB: 'ACT', // Canberra
  YSNW: 'NSW', // Nowra
  YSRI: 'NSW', // Richmond
  YSWG: 'NSW', // Wagga Wagga
  YSDU: 'NSW', // Dubbo
  YSCN: 'NSW', // Camden

  // Victoria
  YMML: 'VIC', // Melbourne
  YMAV: 'VIC', // Avalon
  YMES: 'VIC', // East Sale

  // South Australia
  YPAD: 'SA', // Adelaide
  YMTG: 'SA', // Mount Gambier

  // Western Australia
  YPPH: 'WA', // Perth
  YBRM: 'WA', // Broome

  // Tasmania
  YMHB: 'TAS', // Hobart
  YMLT: 'TAS', // Launceston

  // Northern Territory
  YPDN: 'NT', // Darwin
  YBAS: 'NT', // Alice Springs
};

/**
 * Return the Australian state/territory abbreviation for an airport, or
 * null if the airport isn't in Australia or isn't in the lookup table.
 *
 * @param {object|null} airport - adsbdb airport object (origin or destination)
 * @returns {string|null}
 */
function getAuState(airport) {
  if (!airport || airport.country_iso_name !== 'AU') return null;
  return AU_AIRPORT_STATE[airport.icao_code] || null;
}

module.exports = { getAuState, AU_AIRPORT_STATE };
