// Fixture app under test: fetches Open-Meteo hourly precipitation for the chosen city.
const city = document.getElementById('city');
async function load() {
  const [lat, lon] = city.value.split(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
              '&hourly=precipitation&timezone=America%2FNew_York&forecast_days=1';
  document.getElementById('error').textContent = '';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const mm = data.hourly.precipitation.reduce((s, v) => s + (v ?? 0), 0); // null = no data
    document.getElementById('rain').textContent = `Rain: ${mm.toFixed(1)} mm`;
    const cachedAt = res.headers.get('X-Fetched-At'); // set by sw.js only on cache fallback
    document.getElementById('status').textContent = cachedAt
      ? `Offline — forecast from ${Math.round((Date.now() - Date.parse(cachedAt)) / 60000)} min ago`
      : 'Updated just now';
  } catch {
    document.getElementById('error').textContent = 'Forecast unavailable. Check NWS for current alerts.';
  }
}
city.addEventListener('change', load);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
load();
