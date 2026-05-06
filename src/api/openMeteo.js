const TIMEZONE = 'Asia/Shanghai';

const WEATHER_CURRENT = [
  'temperature_2m',
  'relative_humidity_2m',
  'wind_speed_10m',
];

const AIR_CURRENT = [
  'pm2_5',
  'pm10',
  'nitrogen_dioxide',
  'ozone',
  'sulphur_dioxide',
  'carbon_monoxide',
  'uv_index',
  'us_aqi',
];

function buildUrl(baseUrl, params) {
  const query = new URLSearchParams(params);
  return `${baseUrl}?${query.toString()}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

function first24(hourly, key) {
  return Array.isArray(hourly?.[key]) ? hourly[key].slice(0, 24) : [];
}

function mergeHourly(weather, airQuality) {
  const times = first24(weather.hourly, 'time');
  return times.map((time, index) => ({
    time,
    temperature: first24(weather.hourly, 'temperature_2m')[index] ?? null,
    humidity: first24(weather.hourly, 'relative_humidity_2m')[index] ?? null,
    windSpeed: first24(weather.hourly, 'wind_speed_10m')[index] ?? null,
    aqi: first24(airQuality.hourly, 'us_aqi')[index] ?? null,
    pm25: first24(airQuality.hourly, 'pm2_5')[index] ?? null,
  }));
}

export async function fetchEnvironment({ lon, lat }) {
  const weatherUrl = buildUrl('https://api.open-meteo.com/v1/forecast', {
    latitude: lat.toFixed(5),
    longitude: lon.toFixed(5),
    current: WEATHER_CURRENT.join(','),
    hourly: WEATHER_CURRENT.join(','),
    timezone: TIMEZONE,
  });

  const airUrl = buildUrl('https://air-quality-api.open-meteo.com/v1/air-quality', {
    latitude: lat.toFixed(5),
    longitude: lon.toFixed(5),
    current: AIR_CURRENT.join(','),
    hourly: AIR_CURRENT.join(','),
    timezone: TIMEZONE,
  });

  const [weather, airQuality] = await Promise.all([
    fetchJson(weatherUrl),
    fetchJson(airUrl),
  ]);

  return {
    weather: {
      temperature: weather.current?.temperature_2m ?? null,
      humidity: weather.current?.relative_humidity_2m ?? null,
      windSpeed: weather.current?.wind_speed_10m ?? null,
    },
    air: {
      pm25: airQuality.current?.pm2_5 ?? null,
      pm10: airQuality.current?.pm10 ?? null,
      no2: airQuality.current?.nitrogen_dioxide ?? null,
      ozone: airQuality.current?.ozone ?? null,
      so2: airQuality.current?.sulphur_dioxide ?? null,
      co: airQuality.current?.carbon_monoxide ?? null,
      uvIndex: airQuality.current?.uv_index ?? null,
      aqi: airQuality.current?.us_aqi ?? null,
    },
    hourly: mergeHourly(weather, airQuality),
    source: 'Open-Meteo',
  };
}

export function getFallbackEnvironment() {
  const now = new Date();
  const hourly = Array.from({ length: 24 }, (_, index) => {
    const time = new Date(now.getTime() + index * 60 * 60 * 1000);
    return {
      time: time.toISOString(),
      temperature: 27 + Math.round(Math.sin(index / 4) * 2),
      humidity: 68 + Math.round(Math.cos(index / 5) * 6),
      windSpeed: 8,
      aqi: 42 + (index % 5),
      pm25: 18 + (index % 4),
    };
  });

  return {
    weather: {
      temperature: 28,
      humidity: 70,
      windSpeed: 8,
    },
    air: {
      pm25: 19,
      pm10: 35,
      no2: 18,
      ozone: 72,
      so2: 6,
      co: 420,
      uvIndex: 4.2,
      aqi: 45,
    },
    hourly,
    source: '本地示例数据',
  };
}
