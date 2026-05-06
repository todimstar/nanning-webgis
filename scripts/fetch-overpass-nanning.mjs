/**
 * fetch-overpass-nanning.mjs
 *
 * 用途：
 * 从 Overpass API 抓取南宁市近似范围内的 OSM POI 和道路数据，
 * 转换为简化 GeoJSON，保存到 public/data/。
 *
 * 使用：
 * node scripts/fetch-overpass-nanning.mjs
 *
 * 注意：
 * - 公共 Overpass 服务不适合高频请求，请不要反复运行。
 * - 如果请求失败，可以缩小 bbox 或稍后重试。
 * - 前端请加载生成的静态 GeoJSON，不要在页面启动时实时请求 Overpass。
 */

import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve("public/data");
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

// 南宁近似范围：south, west, north, east
const BBOX = "22.55,107.85,23.15,109.05";

function buildPoiQuery() {
  return `
[out:json][timeout:90];
(
  node["amenity"~"hospital|clinic|pharmacy|school|university|restaurant|fast_food|bar|pub|cafe|cinema"](${BBOX});
  way["amenity"~"hospital|clinic|pharmacy|school|university|restaurant|fast_food|bar|pub|cafe|cinema"](${BBOX});
  relation["amenity"~"hospital|clinic|pharmacy|school|university|restaurant|fast_food|bar|pub|cafe|cinema"](${BBOX});

  node["leisure"~"park|garden|sports_centre|fitness_centre"](${BBOX});
  way["leisure"~"park|garden|sports_centre|fitness_centre"](${BBOX});
  relation["leisure"~"park|garden|sports_centre|fitness_centre"](${BBOX});

  node["shop"~"mall|supermarket|convenience"](${BBOX});
  way["shop"~"mall|supermarket|convenience"](${BBOX});
  relation["shop"~"mall|supermarket|convenience"](${BBOX});

  node["tourism"~"hotel|hostel|guest_house"](${BBOX});
  way["tourism"~"hotel|hostel|guest_house"](${BBOX});
  relation["tourism"~"hotel|hostel|guest_house"](${BBOX});
);
out center tags;
`;
}

function buildRoadQuery() {
  return `
[out:json][timeout:90];
(
  way["highway"~"motorway|trunk|primary|secondary|tertiary"](${BBOX});
  way["railway"~"rail|subway|light_rail"](${BBOX});
);
out geom tags;
`;
}

async function fetchOverpass(query) {
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: new URLSearchParams({ data: query })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Overpass request failed: ${res.status} ${res.statusText}\n${text.slice(0, 500)}`);
  }

  return res.json();
}

function pickCategory(tags = {}) {
  if (tags.amenity) return tags.amenity;
  if (tags.leisure) return tags.leisure;
  if (tags.shop) return tags.shop;
  if (tags.tourism) return tags.tourism;
  if (tags.highway) return tags.highway;
  if (tags.railway) return tags.railway;
  return "unknown";
}

function isNightPoi(category) {
  return ["bar", "pub", "restaurant", "fast_food", "cafe", "cinema"].includes(category);
}

function isMedical(category) {
  return ["hospital", "clinic", "pharmacy"].includes(category);
}

function isGreen(category) {
  return ["park", "garden"].includes(category);
}

function poiRiskType(category) {
  if (isMedical(category)) return "medical_bonus";
  if (isGreen(category)) return "green_bonus";
  if (isNightPoi(category)) return "night_noise_risk";
  if (["school", "university"].includes(category)) return "quiet_or_student_area";
  if (["mall", "supermarket", "convenience"].includes(category)) return "life_convenience";
  return "neutral";
}

function poiToGeoJson(overpassJson) {
  const features = [];

  for (const el of overpassJson.elements ?? []) {
    const tags = el.tags ?? {};
    const category = pickCategory(tags);

    let lng = el.lon;
    let lat = el.lat;

    if ((lng == null || lat == null) && el.center) {
      lng = el.center.lon;
      lat = el.center.lat;
    }

    if (lng == null || lat == null) continue;

    features.push({
      type: "Feature",
      properties: {
        osmId: `${el.type}/${el.id}`,
        name: tags.name || tags["name:zh"] || tags["name:en"] || category,
        category,
        riskType: poiRiskType(category),
        tags
      },
      geometry: {
        type: "Point",
        coordinates: [lng, lat]
      }
    });
  }

  return {
    type: "FeatureCollection",
    name: "nanning_poi",
    features
  };
}

function roadWeight(tags = {}) {
  if (tags.railway) return 0.9;
  switch (tags.highway) {
    case "motorway": return 1.0;
    case "trunk": return 0.9;
    case "primary": return 0.8;
    case "secondary": return 0.6;
    case "tertiary": return 0.4;
    default: return 0.2;
  }
}

function roadToGeoJson(overpassJson) {
  const features = [];

  for (const el of overpassJson.elements ?? []) {
    if (el.type !== "way" || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;

    const tags = el.tags ?? {};
    const coordinates = el.geometry.map((p) => [p.lon, p.lat]);

    features.push({
      type: "Feature",
      properties: {
        osmId: `${el.type}/${el.id}`,
        name: tags.name || tags.ref || tags.highway || tags.railway || "road",
        roadType: tags.highway || tags.railway || "unknown",
        noiseWeight: roadWeight(tags),
        tags
      },
      geometry: {
        type: "LineString",
        coordinates
      }
    });
  }

  return {
    type: "FeatureCollection",
    name: "nanning_roads",
    features
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching POI data from Overpass...");
  const poiJson = await fetchOverpass(buildPoiQuery());
  const poiGeoJson = poiToGeoJson(poiJson);
  await fs.writeFile(
    path.join(OUT_DIR, "nanning_poi.geojson"),
    JSON.stringify(poiGeoJson, null, 2),
    "utf-8"
  );
  console.log(`Saved nanning_poi.geojson with ${poiGeoJson.features.length} features.`);

  // 避免连续请求太快
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("Fetching road data from Overpass...");
  const roadJson = await fetchOverpass(buildRoadQuery());
  const roadGeoJson = roadToGeoJson(roadJson);
  await fs.writeFile(
    path.join(OUT_DIR, "nanning_roads.geojson"),
    JSON.stringify(roadGeoJson, null, 2),
    "utf-8"
  );
  console.log(`Saved nanning_roads.geojson with ${roadGeoJson.features.length} features.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
