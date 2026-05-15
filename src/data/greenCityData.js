export const NANNING_CENTER = { lon: 108.3669, lat: 22.817 };

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
    path: './data/demo_grid.geojson',
    color: '#0f766e',
    fill: 'rgba(15, 118, 110, 0.12)',
    defaultVisible: true,
  },
  {
    key: 'greenSpaces',
    label: '绿地与水系',
    path: './data/green_spaces.geojson',
    color: '#17803d',
    fill: 'rgba(23, 128, 61, 0.18)',
    defaultVisible: true,
  },
  {
    key: 'medicalServices',
    label: '医疗与药店',
    path: './data/medical_services.geojson',
    color: '#2563eb',
    fill: 'rgba(37, 99, 235, 0.16)',
    defaultVisible: true,
  },
  {
    key: 'cultureGreenPoints',
    label: '绿城生态文化点',
    path: './data/culture_green_points.geojson',
    color: '#b7791f',
    fill: 'rgba(183, 121, 31, 0.18)',
    defaultVisible: true,
  },
  {
    key: 'noiseRiskPoi',
    label: '噪音风险点',
    path: './data/noise_risk_poi.geojson',
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

export async function safeLoadGeoJson(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return response.json();
  } catch (error) {
    console.warn(`静态 GeoJSON 加载失败：${path}`, error);
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }
}

export async function loadGreenCityCollections() {
  const entries = await Promise.all(
    OVERLAY_LAYER_DEFS.map(async (layer) => {
      return [layer.key, await safeLoadGeoJson(layer.path)];
    }),
  );

  return Object.fromEntries(entries);
}
