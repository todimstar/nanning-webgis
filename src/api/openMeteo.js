import { getCache, roundedCoordKey, setCache } from '../data/cache.js';

const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
const AIR_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const TIMEZONE = 'Asia/Shanghai';

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function first24(hourly, key) {
  return Array.isArray(hourly?.[key]) ? hourly[key].slice(0, 24) : [];
}

function mergeHourly(weatherData, airData) {
  const times = first24(weatherData.hourly, 'time');
  return times.map((time, index) => ({
    time,
    temperature: first24(weatherData.hourly, 'temperature_2m')[index] ?? null,
    humidity: first24(weatherData.hourly, 'relative_humidity_2m')[index] ?? null,
    precipitationProbability: first24(weatherData.hourly, 'precipitation_probability')[index] ?? null,
    windSpeed: first24(weatherData.hourly, 'wind_speed_10m')[index] ?? null,
    pm10: first24(airData.hourly, 'pm10')[index] ?? null,
    pm25: first24(airData.hourly, 'pm2_5')[index] ?? null,
    uvIndex: first24(airData.hourly, 'uv_index')[index] ?? null,
  }));
}

function buildWeatherUrl(lat, lon) {
  const url = new URL(WEATHER_BASE);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set(
    'current',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
    ].join(','),
  );
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation_probability',
      'wind_speed_10m',
    ].join(','),
  );
  url.searchParams.set('timezone', TIMEZONE);
  return url.toString();
}

function buildAirUrl(lat, lon) {
  const url = new URL(AIR_BASE);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set(
    'current',
    ['european_aqi', 'pm10', 'pm2_5', 'nitrogen_dioxide', 'ozone', 'uv_index'].join(','),
  );
  url.searchParams.set('hourly', ['pm10', 'pm2_5', 'uv_index'].join(','));
  url.searchParams.set('timezone', TIMEZONE);
  return url.toString();
}

export async function fetchEnvironmentSnapshot(lat, lon, signal) {
  const key = `open-meteo:${roundedCoordKey(lat, lon, 2)}`;
  const cached = getCache(key);
  if (cached) return cached;

  try {
    const [weatherData, airData] = await Promise.all([
      fetchJson(buildWeatherUrl(lat, lon), signal),
      fetchJson(buildAirUrl(lat, lon), signal),
    ]);

    const snapshot = {
      coordinates: { lat, lon },
      fetchedAt: new Date().toISOString(),
      source: 'Open-Meteo',
      weather: {
        temperature2m: num(weatherData?.current?.temperature_2m),
        relativeHumidity2m: num(weatherData?.current?.relative_humidity_2m),
        precipitation: num(weatherData?.current?.precipitation),
        weatherCode: num(weatherData?.current?.weather_code),
        windSpeed10m: num(weatherData?.current?.wind_speed_10m),
      },
      air: {
        aqi: num(airData?.current?.european_aqi),
        pm10: num(airData?.current?.pm10),
        pm25: num(airData?.current?.pm2_5),
        nitrogenDioxide: num(airData?.current?.nitrogen_dioxide),
        ozone: num(airData?.current?.ozone),
        uvIndex: num(airData?.current?.uv_index),
      },
      hourly: mergeHourly(weatherData, airData),
      unavailable: false,
    };

    setCache(key, snapshot, 10 * 60 * 1000);
    return snapshot;
  } catch (error) {
    return {
      coordinates: { lat, lon },
      fetchedAt: new Date().toISOString(),
      source: 'Open-Meteo',
      unavailable: true,
      errorMessage: error instanceof Error ? error.message : 'unknown error',
      hourly: [],
    };
  }
}

export function fetchEnvironment({ lon, lat }, signal) {
  return fetchEnvironmentSnapshot(lat, lon, signal);
}
