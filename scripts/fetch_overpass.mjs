#!/usr/bin/env node
/**
 * Fetch OSM data from Overpass API and convert to GeoJSON.
 *
 * Usage:
 *   npm i -D osmtogeojson
 *   node scripts/fetch_overpass.mjs green_spaces
 *   node scripts/fetch_overpass.mjs medical_services
 *   node scripts/fetch_overpass.mjs roads_major
 *   node scripts/fetch_overpass.mjs noise_risk_poi
 *
 * Default bbox: Nanning core area.
 * Override:
 *   BBOX="22.65,108.15,22.95,108.55" node scripts/fetch_overpass.mjs green_spaces
 *
 * BBOX order for Overpass: south,west,north,east
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import osmtogeojson from "osmtogeojson";

const DATASET = process.argv[2];
if (!DATASET) {
  console.error("Missing dataset name. Example: node scripts/fetch_overpass.mjs green_spaces");
  process.exit(1);
}

const ROOT = process.cwd();
const queryPath = path.join(ROOT, "scripts", "overpass_queries", `${DATASET}.overpassql`);
const outDir = path.join(ROOT, "public", "data");
const rawDir = path.join(ROOT, "public", "data", "_raw_overpass");
const outPath = path.join(outDir, `${DATASET}.geojson`);
const sourcePath = path.join(outDir, "DATA_SOURCES.md");

const bbox = process.env.BBOX || "22.65,108.15,22.95,108.55";
const endpoint = process.env.OVERPASS_ENDPOINT || "https://overpass-api.de/api/interpreter";

function classifyFeature(feature, dataset) {
  const p = feature.properties || {};
  const tags = p.tags || p || {};
  let category = dataset;

  if (tags.leisure) category = tags.leisure;
  if (tags.landuse) category = tags.landuse;
  if (tags.natural) category = tags.natural;
  if (tags.waterway) category = tags.waterway;
  if (tags.amenity) category = tags.amenity;
  if (tags.healthcare) category = tags.healthcare;
  if (tags.highway) category = tags.highway;
  if (tags.railway) category = tags.railway;
  if (tags.shop) category = tags.shop;
  if (tags.tourism) category = tags.tourism;

  feature.properties = {
    name: tags.name || tags["name:zh"] || tags["name:en"] || "未命名",
    category,
    source: "OpenStreetMap / Overpass API",
    dataset,
    osm_id: p.id || p["@id"] || tags.id || "",
    tags
  };
  return feature;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(rawDir, { recursive: true });

  let query = await fs.readFile(queryPath, "utf-8");
  query = query.replaceAll("{{bbox}}", bbox);

  console.log(`[overpass] dataset=${DATASET}`);
  console.log(`[overpass] bbox=${bbox}`);
  console.log(`[overpass] endpoint=${endpoint}`);

  const body = new URLSearchParams({ data: query });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "green-city-webgis-course-demo/1.0"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Overpass request failed: ${res.status} ${res.statusText}\n${text.slice(0, 500)}`);
  }

  const osmJson = await res.json();
  const rawPath = path.join(rawDir, `${DATASET}.overpass.json`);
  await fs.writeFile(rawPath, JSON.stringify(osmJson, null, 2), "utf-8");

  const geojson = osmtogeojson(osmJson);
  geojson.features = geojson.features
    .filter(f => f.geometry)
    .map(f => classifyFeature(f, DATASET));

  await fs.writeFile(outPath, JSON.stringify(geojson, null, 2), "utf-8");

  const now = new Date().toISOString();
  const log = [
    `\n## ${DATASET}`,
    `- generated_at: ${now}`,
    `- bbox: ${bbox}`,
    `- endpoint: ${endpoint}`,
    `- query: scripts/overpass_queries/${DATASET}.overpassql`,
    `- raw: public/data/_raw_overpass/${DATASET}.overpass.json`,
    `- output: public/data/${DATASET}.geojson`,
    `- features: ${geojson.features.length}`,
    `- source: OpenStreetMap contributors via Overpass API`,
    ""
  ].join("\n");
  await fs.appendFile(sourcePath, log, "utf-8");

  console.log(`[done] ${outPath}`);
  console.log(`[done] features=${geojson.features.length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
