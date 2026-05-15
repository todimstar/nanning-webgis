import { clamp, distanceMeters } from '../utils/geoUtils.js';
import { estimateNoise } from './noiseModel.js';

export const DEFAULT_SCORE_CONFIG = {
  profiles: {
    respiratory: {
      label: '呼吸道敏感',
      description: '更关注空气质量、绿地与医疗便利。',
      weights: {
        airQuality: 0.5,
        humidityComfort: 0.1,
        noiseComfort: 0.1,
        greenSpace: 0.15,
        medical: 0.1,
        cultureAccess: 0.05,
      },
    },
    skin: {
      label: '皮肤敏感',
      description: '更关注湿度舒适、紫外线和空气质量。',
      weights: {
        humidityComfort: 0.35,
        uvSafety: 0.25,
        airQuality: 0.2,
        medical: 0.1,
        noiseComfort: 0.05,
        greenSpace: 0.05,
      },
    },
    sleep: {
      label: '睡眠浅',
      description: '更关注噪音风险、主干道距离和夜间 POI 密度。',
      weights: {
        noiseComfort: 0.55,
        airQuality: 0.1,
        humidityComfort: 0.1,
        greenSpace: 0.15,
        medical: 0.1,
      },
    },
    green: {
      label: '综合绿城生活',
      description: '综合考虑绿地、水系、空气、湿度、噪音、医疗与生态文化体验。',
      weights: {
        greenSpace: 0.3,
        cultureAccess: 0.15,
        airQuality: 0.2,
        humidityComfort: 0.15,
        noiseComfort: 0.15,
        uvSafety: 0.05,
      },
    },
  },
  thresholds: {
    excellent: 82,
    good: 68,
    normal: 50,
  },
};

const METRIC_LABELS = {
  airQuality: '空气质量',
  humidityComfort: '湿度舒适',
  uvSafety: '紫外线安全',
  noiseComfort: '噪音舒适',
  greenSpace: '绿地便利',
  medical: '医疗便利',
  cultureAccess: '生态文化',
  lifeConvenience: '生活便利',
  roadDistance: '主干道距离',
  nightPoiDensity: '夜间安静度',
};

function scoreAirQuality(air) {
  const pm25 = air?.pm25;
  const pm10 = air?.pm10;
  const aqi = air?.aqi;
  if (aqi !== null && aqi !== undefined) return clamp(100 - aqi, 0, 100);
  const pm25Score = pm25 === null || pm25 === undefined ? 70 : 100 - pm25 * 2.2;
  const pm10Score = pm10 === null || pm10 === undefined ? 70 : 100 - pm10 * 1.1;
  return clamp((pm25Score + pm10Score) / 2, 0, 100);
}

function scoreHumidity(humidity) {
  if (humidity === null || humidity === undefined) return 65;
  return clamp(100 - Math.abs(humidity - 55) * 2.2, 0, 100);
}

function scoreUv(uv) {
  if (uv === null || uv === undefined) return 70;
  return clamp(100 - uv * 10, 0, 100);
}

function pointFromFeature(feature) {
  const geometry = feature?.geometry;
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;

  if (geometry.type === 'Point' && typeof coordinates[0] === 'number') {
    return { lon: coordinates[0], lat: coordinates[1] };
  }

  if (geometry.type === 'Polygon' && Array.isArray(coordinates[0])) {
    const ring = coordinates[0].filter((point) => Array.isArray(point) && point.length >= 2);
    if (!ring.length) return null;
    const totals = ring.reduce(
      (sum, point) => ({ lon: sum.lon + point[0], lat: sum.lat + point[1] }),
      { lon: 0, lat: 0 },
    );
    return { lon: totals.lon / ring.length, lat: totals.lat / ring.length };
  }

  return null;
}

function featuresFor(collection) {
  return Array.isArray(collection?.features) ? collection.features : [];
}

function nearbyStats(location, features, radiusMeters) {
  const distances = features
    .map((feature) => {
      const point = pointFromFeature(feature);
      if (!point) return null;
      return {
        feature,
        meters: distanceMeters(location, point),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.meters - b.meters);

  return {
    count: distances.filter((item) => item.meters <= radiusMeters).length,
    nearestMeters: distances[0]?.meters ?? null,
    nearestName: distances[0]?.feature?.properties?.name ?? '',
  };
}

function proximityScore(stats, idealMeters, fallback) {
  if (stats.nearestMeters === null) return fallback;
  return Math.round(clamp(100 - (stats.nearestMeters / idealMeters) * 55 + stats.count * 8, 25, 100));
}

function layerDerivedScores(location, greenCityData, radiusMeters) {
  const greenStats = nearbyStats(location, featuresFor(greenCityData.greenSpaces), radiusMeters);
  const medicalStats = nearbyStats(location, featuresFor(greenCityData.medicalServices), radiusMeters);
  const cultureStats = nearbyStats(location, featuresFor(greenCityData.cultureGreenPoints), radiusMeters);
  const noiseStats = nearbyStats(location, featuresFor(greenCityData.noiseRiskPoi), radiusMeters);

  return {
    greenSpace: proximityScore(greenStats, 1400, null),
    medical: proximityScore(medicalStats, 1800, null),
    cultureAccess: proximityScore(cultureStats, 1600, 68),
    nearby: {
      greenStats,
      medicalStats,
      cultureStats,
      noiseStats,
      radiusMeters,
    },
  };
}

function locationConvenience(location) {
  const eastNewTownBonus = location.lon > 108.38 ? 8 : 0;
  const centerBonus = Math.max(0, 18 - Math.abs(location.lon - 108.3669) * 220);
  return {
    greenSpace: clamp(68 + eastNewTownBonus, 20, 100),
    medical: clamp(72 + centerBonus, 20, 100),
    lifeConvenience: clamp(70 + centerBonus / 2, 20, 100),
  };
}

function levelFor(score, thresholds) {
  if (score >= thresholds.excellent) return '推荐';
  if (score >= thresholds.good) return '较适合';
  if (score >= thresholds.normal) return '一般';
  return '谨慎';
}

export function computeAssessment({
  environment,
  location,
  profileKey,
  config,
  greenCityData = {},
  radiusMeters = 900,
}) {
  const profile = config.profiles[profileKey] ?? config.profiles.green;
  const noise = estimateNoise(location);
  const convenience = locationConvenience(location);
  const layerScores = layerDerivedScores(location, greenCityData, radiusMeters);

  const metrics = {
    airQuality: Math.round(scoreAirQuality(environment.air)),
    humidityComfort: scoreHumidity(environment.weather?.relativeHumidity2m),
    uvSafety: scoreUv(environment.air?.uvIndex),
    noiseComfort: noise.noiseComfort,
    greenSpace: layerScores.greenSpace ?? Math.round(convenience.greenSpace),
    medical: layerScores.medical ?? Math.round(convenience.medical),
    cultureAccess: layerScores.cultureAccess,
    lifeConvenience: Math.round(convenience.lifeConvenience),
    roadDistance: noise.roadDistance,
    nightPoiDensity: noise.nightPoiDensity,
  };

  const weightEntries = Object.entries(profile.weights);
  const totalWeight = weightEntries.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  const weightedScore = weightEntries.reduce((sum, [key, weight]) => {
    return sum + (metrics[key] ?? 0) * weight;
  }, 0) / totalWeight;

  const score = Math.round(weightedScore);
  const thresholds = config.thresholds ?? DEFAULT_SCORE_CONFIG.thresholds;

  return {
    score,
    level: levelFor(score, thresholds),
    metrics,
    metricList: Object.entries(metrics).map(([key, value]) => ({
      key,
      label: METRIC_LABELS[key],
      value,
    })),
    profileKey,
    weights: profile.weights,
    noise,
    nearby: layerScores.nearby,
  };
}
