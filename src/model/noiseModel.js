import { clamp, distanceMeters } from '../utils/geoUtils.js';

const ROAD_ANCHORS = [
  { name: '民族大道', lon: 108.3669, lat: 22.817 },
  { name: '朝阳路商圈', lon: 108.3205, lat: 22.8192 },
  { name: '南宁东站片区', lon: 108.4155, lat: 22.8404 },
  { name: '星光大道', lon: 108.3132, lat: 22.7811 },
];

const NIGHT_POI_ANCHORS = [
  { name: '朝阳夜间活跃区', lon: 108.3205, lat: 22.8192 },
  { name: '航洋商圈', lon: 108.3938, lat: 22.8125 },
  { name: '江南夜市片区', lon: 108.3128, lat: 22.7812 },
];

const QUIET_ANCHORS = [
  { name: '青秀山绿地', lon: 108.3874, lat: 22.7927 },
  { name: '南湖公园', lon: 108.3569, lat: 22.8061 },
  { name: '五象湖公园', lon: 108.395, lat: 22.7395 },
];

function nearestDistance(location, anchors) {
  return Math.min(...anchors.map((anchor) => distanceMeters(location, anchor)));
}

function roadDistanceScore(distance) {
  if (distance >= 800) return 100;
  if (distance >= 500) return 80;
  if (distance >= 300) return 60;
  if (distance >= 100) return 40;
  return 20;
}

function nightPoiScore(count) {
  if (count <= 1) return 100;
  if (count <= 4) return 80;
  if (count <= 8) return 60;
  if (count <= 15) return 40;
  return 20;
}

export function estimateNoise(location) {
  const nearestRoadMeters = nearestDistance(location, ROAD_ANCHORS);
  const nearestQuietMeters = nearestDistance(location, QUIET_ANCHORS);
  const nightPoiCount = NIGHT_POI_ANCHORS.reduce((sum, anchor) => {
    return sum + (distanceMeters(location, anchor) <= 1200 ? 5 : 0);
  }, 0);

  const roadRisk = clamp(100 - nearestRoadMeters / 8, 0, 70);
  const nightRisk = clamp(nightPoiCount * 4, 0, 45);
  const quietBonus = nearestQuietMeters <= 800 ? 18 : nearestQuietMeters <= 1800 ? 8 : 0;
  const noiseRisk = Math.round(clamp(30 + roadRisk + nightRisk - quietBonus, 5, 95));

  return {
    noiseRisk,
    noiseComfort: 100 - noiseRisk,
    roadDistance: roadDistanceScore(nearestRoadMeters),
    nightPoiDensity: nightPoiScore(nightPoiCount),
    nearestRoadMeters: Math.round(nearestRoadMeters),
    nightPoiCount,
    quietBonus,
  };
}
