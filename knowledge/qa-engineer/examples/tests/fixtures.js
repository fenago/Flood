// Shared mock data and helpers. Open-Meteo returns parallel hourly arrays; values may be null.
const FORECAST = {
  latitude: 25.76, longitude: -80.19, timezone: 'America/New_York',
  hourly_units: { time: 'iso8601', precipitation: 'mm' },
  hourly: {
    time: ['2026-11-26T00:00', '2026-11-26T01:00', '2026-11-26T02:00'],
    precipitation: [2.5, null, 10.0],
  },
};
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast?**';
module.exports = { FORECAST, OPEN_METEO };
