import { createHash } from 'node:crypto';
import { config, hasMysqlConfig } from './config.mjs';

let poolPromise;

export function hashPayload(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function getPool() {
  if (!hasMysqlConfig()) return null;
  if (!poolPromise) {
    poolPromise = import('mysql2/promise')
      .then((mysql) =>
        mysql.createPool({
          ...config.mysql,
          waitForConnections: true,
          connectionLimit: 4,
          enableKeepAlive: true,
        }),
      )
      .catch((error) => {
        console.warn('MySQL 不可用，已降级为不落库模式：', error.message);
        return null;
      });
  }
  return poolPromise;
}

export async function readExplanationCache(cacheKey) {
  const pool = await getPool();
  if (!pool) return null;
  const [rows] = await pool.execute(
    'SELECT explanation_json FROM ai_explanation_cache WHERE cache_key = ? LIMIT 1',
    [cacheKey],
  );
  return rows[0]?.explanation_json ?? null;
}

export async function writeExplanationCache({ cacheKey, provider, model, explanation }) {
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `INSERT INTO ai_explanation_cache (cache_key, provider, model, explanation_json)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       provider = VALUES(provider),
       model = VALUES(model),
       explanation_json = VALUES(explanation_json)`,
    [cacheKey, provider, model, JSON.stringify(explanation)],
  );
}

export async function writeEvaluationRecord({ profileKey, location, environment, assessment, locationContext }) {
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `INSERT INTO evaluation_records
      (profile_key, lon, lat, score, level_label, environment_json, assessment_json, location_context_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profileKey,
      location?.lon ?? null,
      location?.lat ?? null,
      assessment?.score ?? null,
      assessment?.level ?? null,
      JSON.stringify(environment ?? {}),
      JSON.stringify(assessment ?? {}),
      JSON.stringify(locationContext ?? {}),
    ],
  );
}

export async function writeReportExport({ title, profileKey, location, html }) {
  const pool = await getPool();
  if (!pool) return null;
  const [result] = await pool.execute(
    `INSERT INTO report_exports (title, profile_key, lon, lat, html)
     VALUES (?, ?, ?, ?, ?)`,
    [title, profileKey, location?.lon ?? null, location?.lat ?? null, html],
  );
  return result.insertId;
}
