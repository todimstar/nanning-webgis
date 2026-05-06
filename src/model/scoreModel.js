import { clamp } from '../utils/geoUtils.js';
import { estimateNoise } from './noiseModel.js';

export const DEFAULT_SCORE_CONFIG = {
  profiles: {
    respiratory: {
      label: '呼吸道敏感',
      description: '更关注空气质量、绿地与医疗便利。',
      weights: {
        airQuality: 0.45,
        humidityComfort: 0.15,
        noiseComfort: 0.1,
        greenSpace: 0.15,
        medical: 0.1,
        lifeConvenience: 0.05,
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
      label: '睡眠浅怕吵',
      description: '更关注噪音风险、主干道距离和夜间 POI 密度。',
      weights: {
        noiseComfort: 0.45,
        roadDistance: 0.2,
        nightPoiDensity: 0.15,
        airQuality: 0.1,
        greenSpace: 0.05,
        medical: 0.05,
      },
    },
    general: {
      label: '普通宜居',
      description: '综合考虑空气、湿度、噪音、医疗、绿地和生活便利。',
      weights: {
        airQuality: 0.25,
        humidityComfort: 0.2,
        noiseComfort: 0.2,
        greenSpace: 0.15,
        medical: 0.1,
        lifeConvenience: 0.1,
      },
    },
  },
  thresholds: {
    excellent: 85,
    good: 70,
    normal: 55,
    caution: 40,
  },
};

const METRIC_LABELS = {
  airQuality: '空气质量',
  humidityComfort: '湿度舒适',
  uvSafety: '紫外线安全',
  noiseComfort: '噪音舒适',
  greenSpace: '绿地便利',
  medical: '医疗便利',
  lifeConvenience: '生活便利',
  roadDistance: '主干道距离',
  nightPoiDensity: '夜间安静度',
};

function scoreAirQuality(air) {
  if (air.aqi !== null && air.aqi !== undefined) return clamp(100 - air.aqi, 0, 100);
  if (air.pm25 !== null && air.pm25 !== undefined) return clamp(100 - air.pm25 * 2, 0, 100);
  return 65;
}

function scoreHumidity(humidity) {
  if (humidity === null || humidity === undefined) return 65;
  if (humidity >= 40 && humidity <= 60) return 100;
  if ((humidity >= 30 && humidity < 40) || (humidity > 60 && humidity <= 70)) return 80;
  if ((humidity >= 20 && humidity < 30) || (humidity > 70 && humidity <= 80)) return 60;
  return 40;
}

function scoreUv(uv) {
  if (uv === null || uv === undefined) return 75;
  if (uv <= 2) return 100;
  if (uv <= 5) return 80;
  if (uv <= 7) return 60;
  if (uv <= 10) return 40;
  return 20;
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
  if (score >= thresholds.excellent) return '非常推荐';
  if (score >= thresholds.good) return '推荐';
  if (score >= thresholds.normal) return '一般';
  if (score >= thresholds.caution) return '谨慎';
  return '不推荐';
}

export function computeAssessment({ environment, location, profileKey, config }) {
  const profile = config.profiles[profileKey] ?? config.profiles.general;
  const noise = estimateNoise(location);
  const convenience = locationConvenience(location);

  const metrics = {
    airQuality: Math.round(scoreAirQuality(environment.air)),
    humidityComfort: scoreHumidity(environment.weather.humidity),
    uvSafety: scoreUv(environment.air.uvIndex),
    noiseComfort: noise.noiseComfort,
    greenSpace: Math.round(convenience.greenSpace),
    medical: Math.round(convenience.medical),
    lifeConvenience: Math.round(convenience.lifeConvenience),
    roadDistance: noise.roadDistance,
    nightPoiDensity: noise.nightPoiDensity,
  };

  const weightedScore = Object.entries(profile.weights).reduce((sum, [key, weight]) => {
    return sum + (metrics[key] ?? 0) * weight;
  }, 0);

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
  };
}
