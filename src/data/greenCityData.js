export const NANNING_CENTER = { lon: 108.3669, lat: 22.817 };
export const NANNING_BBOX = [108.2, 22.72, 108.55, 22.93];

export const OVERLAY_LAYER_DEFS = [
  {
    key: 'nanningDemoBoundary',
    label: '南宁演示范围',
    path: './data/nanning_demo_boundary.geojson',
    color: '#475569',
    fill: 'rgba(71, 85, 105, 0.08)',
    defaultVisible: true,
  },
  {
    key: 'demoGrid',
    label: '评估网格',
    color: '#0f766e',
    fill: 'rgba(15, 118, 110, 0.12)',
    defaultVisible: false,
    runtime: true,
  },
  {
    key: 'greenSpaces',
    label: '绿地与水系（OSM缓存）',
    path: './data/osm_cache/green_spaces.geojson',
    fallbackPaths: ['./data/green_spaces.geojson'],
    color: '#17803d',
    fill: 'rgba(23, 128, 61, 0.18)',
    defaultVisible: true,
  },
  {
    key: 'medicalServices',
    label: '医疗与药店（OSM缓存）',
    path: './data/osm_cache/medical_services.geojson',
    fallbackPaths: ['./data/medical_services.geojson'],
    color: '#2563eb',
    fill: 'rgba(37, 99, 235, 0.16)',
    defaultVisible: true,
  },
  {
    key: 'cultureGreenPoints',
    label: '绿城生态文化点（OSM缓存）',
    path: './data/osm_cache/culture_green_points.geojson',
    fallbackPaths: ['./data/culture_green_points.geojson'],
    color: '#b7791f',
    fill: 'rgba(183, 121, 31, 0.18)',
    defaultVisible: true,
  },
  {
    key: 'noiseRiskPoi',
    label: '噪音风险点（OSM缓存）',
    path: './data/osm_cache/noise_risk_poi.geojson',
    fallbackPaths: ['./data/noise_risk_poi.geojson'],
    color: '#dc2626',
    fill: 'rgba(220, 38, 38, 0.16)',
    defaultVisible: true,
  },
];

export function createDefaultOverlayState() {
  return Object.fromEntries(
    OVERLAY_LAYER_DEFS.map((layer) => [
      layer.key,
      {
        visible: layer.defaultVisible,
        opacity: ['demoGrid', 'nanningDemoBoundary'].includes(layer.key) ? 0.45 : 0.9,
      },
    ]),
  );
}

export function createEvaluationGridGeoJson() {
  const [minLon, minLat, maxLon, maxLat] = NANNING_BBOX;
  const lonStep = 0.025;
  const latStep = 0.02;
  const features = [];
  let index = 1;

  for (let lon = minLon; lon < maxLon; lon += lonStep) {
    for (let lat = minLat; lat < maxLat; lat += latStep) {
      const right = Math.min(lon + lonStep, maxLon);
      const top = Math.min(lat + latStep, maxLat);
      features.push({
        type: 'Feature',
        properties: {
          name: `评估网格 ${index}`,
          category: '评估网格',
          layerKey: 'demoGrid',
          source: 'runtime-generated',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [lon, lat],
              [right, lat],
              [right, top],
              [lon, top],
              [lon, lat],
            ],
          ],
        },
      });
      index += 1;
    }
  }

  return {
    type: 'FeatureCollection',
    name: 'runtime_evaluation_grid',
    features,
  };
}

async function fetchGeoJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

export async function safeLoadGeoJson(path, fallbackPaths = []) {
  const paths = [path, ...fallbackPaths].filter(Boolean);
  for (const candidate of paths) {
    try {
      return await fetchGeoJson(candidate);
    } catch (error) {
      console.warn(`静态 GeoJSON 加载失败：${candidate}`, error);
    }
  }

  return {
    type: 'FeatureCollection',
    features: [],
  };
}

export async function loadLayerGeoJson(layer) {
  if (layer.runtime && layer.key === 'demoGrid') return createEvaluationGridGeoJson();
  return safeLoadGeoJson(layer.path, layer.fallbackPaths);
}

export async function loadGreenCityCollections() {
  const entries = await Promise.all(
    OVERLAY_LAYER_DEFS.map(async (layer) => {
      return [layer.key, await loadLayerGeoJson(layer)];
    }),
  );

  return Object.fromEntries(entries);
}
