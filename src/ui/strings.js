// User-facing wording (owner: ux-designer-apple-hig, Wren). IDs match
// knowledge/ux-designer-apple-hig/examples/flow-pick-city-outlook.md and ios-install-sheet.md.
// Plain language, grade <= 8, calm and specific. Risk is never conveyed by colour alone.
export const S = {
  APP: 'Flood Watch',
  PICK_TITLE: 'Choose your city',
  PICK_HELP: 'Pick the place you want flood and beach news for. You can change it any time.',
  PICK_LOC: 'Use My Location',
  PICK_LOC_HELP: 'Finds the closest city in our list. Your location stays on this phone.',
  PICK_LOC_DENIED: 'Location is off for this site. Pick a city from the list instead.',
  PICK_SEARCH: 'Search cities',
  PICK_EMPTY: (q) => `No city matches "${q}". We cover 12 cities in Miami-Dade, Broward, Palm Beach and Monroe counties.`,
  CHANGE_CITY: 'Change City',
  LOAD: (city) => `Getting the latest forecast for ${city}…`,
  UPDATING: 'Updating…',
  ERR_TITLE: "Can't load the forecast",
  ERR_BODY: 'Check your connection, then try again. For official alerts, go to weather.gov.',
  ERR_BTN: 'Try Again',
  STALE_BANNER: (age) => `Offline. This forecast is from ${age} ago. Check NWS for current alerts.`,
  OLD_BANNER: (age) => `This forecast is from ${age} ago. Pull to refresh or tap Try Again.`,
  ALERT_UNKNOWN: 'Alert status unknown — check weather.gov.',
  ALERT_UNKNOWN_DETAIL: "We couldn't reach the National Weather Service.",
  ALERT_LAST_KNOWN: (age) => `Last known alerts, from ${age} ago:`,
  ALERT_NONE: (time) => `No active NWS alerts for this place as of ${time}.`,
  UPDATED: (time) => `Updated ${time} · Open-Meteo, NOAA, NWS`,
  NWS_HEAD: (event, end) => `NWS: ${event} until ${end}`,
  NWS_SUB: 'This alert is from the National Weather Service.',
  NWS_LINK: 'Read the full alert',
  FLOOD_TITLE: 'Flood risk',
  LEVEL_LEAD: (level, when) => `Flood risk ${when}: ${level}.`,
  RAISED_BY_NWS: (event) => `Raised because the National Weather Service issued a ${event}.`,
  HINT: {
    Low: '',
    Elevated: 'Some low streets may get water. Check again before you drive.',
    High: 'Street flooding is likely in low areas. Never drive through flood water.',
    Severe: "Follow the National Weather Service and local officials now. Turn Around Don't Drown.",
  },
  NO_SIGNAL: 'No heavy rain, high tide or wet ground expected.',
  UNCERTAIN: "Street flooding depends on local drainage we can't see.",
  PARTIAL: 'Partial data:',
  NEXT_DAYS: 'Next days',
  TIDES_TITLE: 'Next high tides',
  TIDES_NONE_STATION: 'No confirmed NOAA tide station for this city yet, so tides are not in its flood level.',
  TIDES_MISSING: 'Tide times are missing right now. The flood level uses rain and alerts only.',
  TIDES_NOTE: 'Height above normal high water (MHHW), NOAA prediction.',
  BEACH_TITLE: 'Beach day',
  BEACH_LINK: 'See beach details',
  BEACH_INLAND: (city) => `${city} is inland, so there is no beach score. Pick a coastal city to see one.`,
  BEACH_WINDOW: 'Score for 10 a.m. to 4 p.m. today.',
  NOTICE: 'Flood Watch is not an official warning service. Follow the National Weather Service and local emergency officials.',
  CREDIT: 'Weather data by Open-Meteo.com',
  SETTINGS_TITLE: 'Settings',
  UNITS_LABEL: 'Units',
  UNITS_US: 'US (°F, in, mph)',
  UNITS_METRIC: 'Metric (°C, mm, km/h)',
  INSTALL_BTN: 'Install App',
  INSTALL_DONE: 'Installed on this device',
  INST_TITLE: 'Add Flood Watch to your Home Screen',
  INST_WHY: 'Open it in one tap, even during a storm. It works like an app.',
  INST_STEP1: "Tap the Share button in Safari. If you don't see it, tap the menu button first, then Share.",
  INST_STEP2: 'Scroll down and tap Add to Home Screen.',
  INST_STEP3: 'Turn on Open as Web App, then tap Add.',
  INST_MISSING: "Don't see Add to Home Screen? Tap Edit Actions at the bottom of the list and add it.",
  INST_NOTNOW: 'Not Now',
  INST_SETTINGS: 'You can find these steps later in Settings.',
  INST_SETTINGS_ROW: 'Add to Home Screen',
  UPDATE_READY: 'A new version of Flood Watch is ready.',
  UPDATE_BTN: 'Reload',
  TAB_OUTLOOK: 'Outlook', TAB_BEACH: 'Beach', TAB_CITIES: 'Cities', TAB_SETTINGS: 'Settings',
};

export const LEVEL_ICON = { Low: '●', Elevated: '▲', High: '◆', Severe: '■' }; // shape differs per level, aria-hidden

// Reason wording. `u` is the unit formatter from format.js.
export function floodReason(r, u) {
  switch (r.code) {
    case 'rain24': return `About ${u.rain(r.inches)} of rain in 24 hours (model estimate)`;
    case 'rainBurst': return `Bursts up to ${u.rain(r.inchesPerHour)} an hour (model estimate)`;
    case 'pastRain': return `About ${u.rain(r.inches)} fell in the last 3 days (estimate)`;
    case 'soilWet': return 'The ground is already wet';
    case 'highTide': return `High tide ${u.height(r.ft)} above normal high water at ${u.clock(r.at)}`;
    case 'onshoreWind': return `Onshore wind up to ${u.speed(r.mph)} pushes water toward the coast`;
    default: return '';
  }
}
export function partialText(p) {
  switch (p.code) {
    case 'rainHours': return `rain for ${p.have} of ${p.of} hours`;
    case 'pastRainHours': return `past rain for ${p.have} of ${p.of} hours`;
    case 'soil': return 'ground wetness';
    case 'tideNoStation': return 'tides (no confirmed station)';
    case 'tideMissing': return 'tides';
    case 'wind': return 'wind';
    case 'alertsUnknown': return 'NWS alerts';
    default: return p.code;
  }
}
export function beachReason(r, u) {
  switch (r.code) {
    case 'nwsBeach': return `NWS ${r.event}: dangerous rip currents (official)`;
    case 'nwsWarning': return `NWS ${r.event} in effect (official)`;
    case 'thunder': return 'Thunderstorms expected (lightning risk)';
    case 'gusts': return `Gusts to ${u.speed(r.mph)}`;
    case 'waves': return `Waves up to ${u.waves(r.m)}`;
    case 'heavyRain': return 'Heavy rain for most of the day';
    case 'rain': return `Rain chance up to ${Math.round(r.value)}%`;
    case 'heat': return `Heat index up to ${u.temp(r.value)}`;
    case 'wind': return `Wind around ${u.speed(r.value)}`;
    case 'water': return `Water ${u.temp(r.value)}`;
    case 'sky': return `${Math.round(r.value)}% cloud cover`;
    case 'uv': return `UV index ${Math.round(r.value)}`;
    default: return '';
  }
}
// SOURCED: EPA UV Index guide wording.
export const UV_TIP = {
  extreme: (n) => `UV ${n} (Extreme): skin can burn in minutes, and white sand reflects UV. Avoid sun 11 a.m.–4 p.m.`,
  veryHigh: (n) => `UV ${n} (Very High): unprotected skin can burn quickly. Avoid sun 11 a.m.–4 p.m.; use SPF 15+.`,
  high: (n) => `UV ${n} (High): cut time in the sun 11 a.m.–4 p.m. Wear a hat, sunglasses and sunscreen.`,
  moderate: (n) => `UV ${n} (Moderate): use sunscreen and find shade near midday.`,
  low: (n) => `UV ${n} (Low): wear sunglasses; use sunscreen if you burn easily.`,
};
