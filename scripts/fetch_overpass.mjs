#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const queryDir = path.join(__dirname, 'overpass_queries');
const outputDir = path.join(rootDir, 'public', 'data', 'osm_cache');

const DEFAULT_BBOX = '22.72,108.20,22.93,108.55';
const DEFAULT_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const DATASETS = [
  {
    key: 'green_spaces',
    queryFile: 'green_spaces.overpassql',
    description: 'OSM/Overpass parks, gardens, woods and water features in Nanning',
  },
  {
    key: 'medical_services',
    queryFile: 'medical_services.overpassql',
    description: 'OSM/Overpass hospitals, clinics and pharmacies in Nanning',
  },
  {
    key: 'noise_risk_poi',
    queryFile: 'noise_risk_poi.overpassql',
    description: 'OSM/Overpass roads and night activity POIs used by the noise-risk model',
  },
  {
    key: 'culture_green_points',
    queryFile: 'culture_green_points.overpassql',
    description: 'OSM/Overpass ecological and cultural city places in Nanning',
  },
];

const args = parseArgs(process.argv.slice(2));
const bbox = args.bbox ?? DEFAULT_BBOX;
const endpoints = args.endpoint ? [args.endpoint] : DEFAULT_ENDPOINTS;

await mkdir(outputDir, { recursive: true });

const manifest = {
  generatedAt: new Date().toISOString(),
  bbox,
  source: 'OpenStreetMap via Overpass API',
  datasets: [],
};

for (const dataset of DATASETS) {
  const queryTemplate = await readFile(path.join(queryDir, dataset.queryFile), 'utf8');
  const query = queryTemplate.replaceAll('{{bbox}}', bbox);
  const overpassJson = await fetchWithFallback(query, endpoints);
  const geojson = overpassToGeoJson(overpassJson, dataset);
  const fileName = `${dataset.key}.geojson`;
  const filePath = path.join(outputDir, fileName);

  await writeFile(filePath, `${JSON.stringify(geojson, null, 2)}\n`, 'utf8');
  manifest.datasets.push({
    key: dataset.key,
    file: `osm_cache/${fileName}`,
    featureCount: geojson.features.length,
    description: dataset.description,
  });

  console.log(`${dataset.key}: ${geojson.features.length} features -> ${filePath}`);
}

await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`manifest -> ${path.join(outputDir, 'manifest.json')}`);

function parseArgs(rawArgs) {
  return rawArgs.reduce((parsed, item) => {
    const [rawKey, ...rest] = item.replace(/^--/, '').split('=');
    if (!rawKey || rest.length === 0) return parsed;
    parsed[rawKey] = rest.join('=');
    return parsed;
  }, {});
}

async function fetchWithFallback(query, endpoints) {
  let lastError;
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'user-agent': 'green-city-webgis/0.1 Overpass cache builder',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`${endpoint} returned ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      console.warn(`Overpass endpoint failed: ${endpoint} (${error.message})`);
    }
  }

  throw lastError ?? new Error('No Overpass endpoint responded');
}

function overpassToGeoJson(overpassJson, dataset) {
  const features = (overpassJson.elements ?? [])
    .map((element) => elementToFeature(element, dataset.key))
    .filter(Boolean);

  return {
    type: 'FeatureCollection',
    name: dataset.key,
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'OpenStreetMap via Overpass API',
      description: dataset.description,
    },
    features,
  };
}

function elementToFeature(element, datasetKey) {
  const tags = element.tags ?? {};
  const geometry = getGeometry(element);
  if (!geometry) return null;

  return {
    type: 'Feature',
    id: `${element.type}/${element.id}`,
    properties: normalizeProperties(tags, datasetKey, element),
    geometry,
  };
}

function getGeometry(element) {
  if (element.type === 'node' && Number.isFinite(element.lon) && Number.isFinite(element.lat)) {
    return {
      type: 'Point',
      coordinates: [element.lon, element.lat],
    };
  }

  if (Array.isArray(element.geometry) && element.geometry.length > 1) {
    const coordinates = element.geometry
      .filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat))
      .map((point) => [point.lon, point.lat]);

    if (coordinates.length > 3 && isClosed(coordinates)) {
      return {
        type: 'Polygon',
        coordinates: [coordinates],
      };
    }

    if (coordinates.length > 1) {
      return {
        type: 'LineString',
        coordinates,
      };
    }
  }

  const center = element.center;
  if (center && Number.isFinite(center.lon) && Number.isFinite(center.lat)) {
    return {
      type: 'Point',
      coordinates: [center.lon, center.lat],
    };
  }

  return null;
}

function isClosed(coordinates) {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function normalizeProperties(tags, datasetKey, element) {
  const name = tags.name ?? tags['name:zh'] ?? tags['name:en'] ?? defaultName(datasetKey, tags, element);
  const category = getCategory(datasetKey, tags);
  const base = {
    name,
    category,
    tags: Object.entries(tags)
      .filter(([key]) => ['amenity', 'leisure', 'natural', 'tourism', 'highway', 'railway', 'waterway'].includes(key))
      .map(([key, value]) => `${key}:${value}`),
    osmType: element.type,
    osmId: element.id,
    osmSource: 'overpass',
  };

  if (datasetKey === 'green_spaces') {
    return {
      ...base,
      cultureText: '来自 OSM/Overpass 的南宁绿地、水系或自然生态空间。',
      greenScore: tags.natural === 'water' ? 82 : 88,
      quietScore: 76,
    };
  }

  if (datasetKey === 'medical_services') {
    return {
      ...base,
      serviceType: tags.amenity ?? 'medical',
      supportScore: tags.amenity === 'hospital' ? 92 : tags.amenity === 'clinic' ? 84 : 76,
    };
  }

  if (datasetKey === 'noise_risk_poi') {
    return {
      ...base,
      riskType: getRiskType(tags),
      riskWeight: getRiskWeight(tags),
    };
  }

  return {
    ...base,
    cultureText: '来自 OSM/Overpass 的南宁生态文化相关公共空间。',
    greenScore: tags.leisure ? 86 : 74,
    quietScore: 70,
  };
}

function defaultName(datasetKey, tags, element) {
  const primaryTag = tags.amenity ?? tags.leisure ?? tags.natural ?? tags.tourism ?? tags.highway ?? tags.railway;
  return `${getCategory(datasetKey, tags)} ${primaryTag ?? element.id}`;
}

function getCategory(datasetKey, tags) {
  if (datasetKey === 'green_spaces') {
    if (tags.natural === 'water') return '水系';
    if (tags.natural === 'wood') return '林地';
    if (tags.leisure === 'garden') return '花园';
    return '绿地公园';
  }

  if (datasetKey === 'medical_services') {
    if (tags.amenity === 'hospital') return '医院';
    if (tags.amenity === 'clinic') return '诊所';
    if (tags.amenity === 'pharmacy') return '药店';
    return '医疗服务';
  }

  if (datasetKey === 'noise_risk_poi') {
    if (tags.highway) return '交通噪音风险';
    if (tags.railway) return '轨道噪音风险';
    return '夜间活动噪音风险';
  }

  if (tags.tourism === 'museum') return '博物馆';
  if (tags.tourism === 'attraction') return '景观点';
  if (tags.amenity === 'theatre' || tags.amenity === 'arts_centre') return '文化艺术点';
  return '绿城生态文化点';
}

function getRiskType(tags) {
  if (tags.highway) return 'traffic';
  if (tags.railway) return 'railway';
  if (tags.amenity === 'bar' || tags.amenity === 'pub' || tags.amenity === 'nightclub') return 'nightlife';
  return 'dining';
}

function getRiskWeight(tags) {
  if (tags.highway === 'motorway' || tags.highway === 'trunk') return 36;
  if (tags.highway === 'primary') return 30;
  if (tags.highway === 'secondary') return 24;
  if (tags.railway) return 28;
  if (tags.amenity === 'nightclub') return 34;
  if (tags.amenity === 'bar' || tags.amenity === 'pub') return 30;
  return 18;
}
