import http from 'node:http';
import { URL } from 'node:url';
import { config } from './config.mjs';
import {
  hashPayload,
  readExplanationCache,
  writeEvaluationRecord,
  writeExplanationCache,
  writeReportExport,
} from './db.mjs';
import { buildRuleExplanation } from './ruleExplanation.mjs';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, jsonHeaders);
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).byteLength > 1024 * 1024) {
      throw new Error('request body too large');
    }
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function withTimeout(ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

async function handleAmapRegeocode(url, response) {
  if (!config.amapKey) {
    sendJson(response, 503, {
      ok: false,
      message: 'AMAP_WEB_SERVICE_KEY 未配置',
    });
    return;
  }

  const lon = Number(url.searchParams.get('lon'));
  const lat = Number(url.searchParams.get('lat'));
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    sendJson(response, 400, {
      ok: false,
      message: 'lon 和 lat 必须是有效数字',
    });
    return;
  }

  const requestUrl = new URL('https://restapi.amap.com/v3/geocode/regeo');
  requestUrl.searchParams.set('key', config.amapKey);
  requestUrl.searchParams.set('location', `${lon},${lat}`);
  requestUrl.searchParams.set('extensions', 'base');
  requestUrl.searchParams.set('radius', '1000');
  requestUrl.searchParams.set('output', 'json');

  const timeout = withTimeout();
  try {
    const upstream = await fetch(requestUrl, { signal: timeout.signal });
    const data = await upstream.json();
    if (data.status !== '1') {
      sendJson(response, 502, {
        ok: false,
        message: data.info || '高德逆地理编码失败',
      });
      return;
    }

    const regeocode = data.regeocode ?? {};
    sendJson(response, 200, {
      ok: true,
      provider: 'amap',
      formattedAddress: regeocode.formatted_address || '',
      addressComponent: regeocode.addressComponent || {},
    });
  } catch (error) {
    sendJson(response, 502, {
      ok: false,
      message: error instanceof Error ? error.message : '高德逆地理编码请求失败',
    });
  } finally {
    timeout.done();
  }
}

function normalizeAiExplanation(text, fallback) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    const parsed = JSON.parse(match[0]);
    return {
      provider: 'ai',
      summary: String(parsed.summary || fallback.summary),
      strengths: String(parsed.strengths || fallback.strengths),
      risks: String(parsed.risks || fallback.risks),
      advice: String(parsed.advice || fallback.advice),
    };
  }

  const cleanText = String(text || '').trim();
  return {
    provider: 'ai',
    summary: cleanText || fallback.summary,
    strengths: fallback.strengths,
    risks: fallback.risks,
    advice: fallback.advice,
  };
}

function buildAiChatCompletionsUrl() {
  const baseUrl = config.ai.baseUrl.replace(/\/$/, '');
  if (baseUrl.endsWith('/chat/completions')) return baseUrl;
  if (baseUrl.endsWith('/v1')) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

async function callAiExplanation(payload, fallback) {
  if (!config.ai.key) return fallback;

  const timeout = withTimeout(config.ai.timeoutMs);
  try {
    const response = await fetch(buildAiChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.ai.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.ai.model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content:
              '你是南宁绿城知境 WebGIS 的环境评估解释器。请只输出 JSON，字段为 summary、strengths、risks、advice。解释必须基于输入的真实 API 数据和空间评分，不得编造监测来源。',
          },
          {
            role: 'user',
            content: JSON.stringify(payload),
          },
        ],
      }),
      signal: timeout.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`AI API ${response.status}${text ? `: ${text.slice(0, 240)}` : ''}`);
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    return normalizeAiExplanation(text, fallback);
  } finally {
    timeout.done();
  }
}

async function handleExplain(request, response) {
  const payload = await readBody(request);
  const fallback = buildRuleExplanation(payload);
  const cacheKey = hashPayload({
    profile: payload.profile?.key ?? payload.profileKey,
    location: payload.location,
    assessment: payload.assessment,
    environment: payload.environment,
    locationContext: payload.locationContext,
    model: config.ai.key ? config.ai.model : 'rule',
  });

  const cached = await readExplanationCache(cacheKey);
  const cachedIsFailedAiFallback =
    config.ai.key && cached?.provider === 'rule' && String(cached?.note ?? '').includes('AI API 暂不可用');
  if (cached && !cachedIsFailedAiFallback) {
    sendJson(response, 200, {
      ok: true,
      cached: true,
      explanation: cached,
    });
    return;
  }

  let explanation = fallback;
  try {
    explanation = await callAiExplanation(payload, fallback);
  } catch (error) {
    explanation = {
      ...fallback,
      provider: 'rule',
      note: `AI API 暂不可用，已使用规则式解释：${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }

  if (explanation.provider === 'ai' || !config.ai.key) {
    await writeExplanationCache({
      cacheKey,
      provider: explanation.provider ?? 'rule',
      model: explanation.provider === 'ai' ? config.ai.model : null,
      explanation,
    });
  }

  await writeEvaluationRecord({
    profileKey: payload.profile?.key ?? payload.profileKey ?? 'unknown',
    location: payload.location,
    environment: payload.environment,
    assessment: payload.assessment,
    locationContext: payload.locationContext,
  });

  sendJson(response, 200, {
    ok: true,
    cached: false,
    explanation,
  });
}

async function handleReport(request, response) {
  const body = await readBody(request);
  if (!body.html || !body.location || !body.profileKey) {
    sendJson(response, 400, {
      ok: false,
      message: 'html、location、profileKey 为必填字段',
    });
    return;
  }

  const id = await writeReportExport({
    title: body.title || '绿城知境评估摘要',
    profileKey: body.profileKey,
    location: body.location,
    html: body.html,
  });

  sendJson(response, 200, {
    ok: true,
    stored: Boolean(id),
    id,
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, jsonHeaders);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, service: 'green-city-zhijing-server' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/amap/regeocode') {
      await handleAmapRegeocode(url, response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/explain') {
      await handleExplain(request, response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/reports') {
      await handleReport(request, response);
      return;
    }

    sendJson(response, 404, { ok: false, message: 'not found' });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: error instanceof Error ? error.message : 'server error',
    });
  }
});

server.listen(config.port, () => {
  console.log(`Green City Zhijing server listening on http://127.0.0.1:${config.port}`);
});
