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

function buildAiChatCompletionsUrl() {
  const baseUrl = config.ai.baseUrl.replace(/\/$/, '');
  if (baseUrl.endsWith('/chat/completions')) return baseUrl;
  if (baseUrl.endsWith('/v1')) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

function buildMapContextSummary(payload) {
  const location = payload.location ?? {};
  const profile = payload.profile ?? {};
  const environment = payload.environment ?? {};
  const assessment = payload.assessment ?? {};
  const locationContext = payload.locationContext ?? {};
  const mapState = payload.mapState ?? {};
  const visibleLayerInfo = Array.isArray(mapState.visibleLayers) ? mapState.visibleLayers : [];
  const activeHeatmapInfo = Array.isArray(mapState.activeHeatmaps) ? mapState.activeHeatmaps : [];
  const visibleLayers = Object.entries(mapState.overlayState ?? {})
    .filter(([, state]) => state?.visible)
    .map(([key, state]) => {
      const layer = visibleLayerInfo.find((item) => item?.key === key) ?? {};
      const label = layer.label || key;
      return `${label}${state?.opacity != null ? `(${Math.round(Number(state.opacity) * 100)}%)` : ''}`;
    });
  const visibleHeatmaps = Object.entries(mapState.heatmapState ?? {})
    .filter(([, state]) => state?.visible)
    .map(([key]) => {
      const heatmap = activeHeatmapInfo.find((item) => item?.key === key) ?? {};
      return heatmap.label || key;
    });
  const nearby = assessment.nearby ?? {};

  return [
    `位置：${locationContext.formattedAddress || `${location.lon ?? '--'}, ${location.lat ?? '--'}`}`,
    `画像：${profile.label || profile.key || '未指定'}`,
    `底图：${mapState.baseLayerLabel || mapState.baseLayerKey || 'amap'}；半径：${mapState.queryRadiusMeters ?? '--'}m`,
    `可见专题图层：${visibleLayers.length ? visibleLayers.join('、') : '无'}`,
    `可见热力：${visibleHeatmaps.length ? visibleHeatmaps.join('、') : '无'}`,
    `天气：温度 ${environment.weather?.temperature2m ?? '--'}℃，湿度 ${environment.weather?.relativeHumidity2m ?? '--'}%，风速 ${environment.weather?.windSpeed10m ?? '--'} km/h，降水 ${environment.weather?.precipitation ?? '--'}mm`,
    `空气：PM2.5 ${environment.air?.pm25 ?? '--'}，PM10 ${environment.air?.pm10 ?? '--'}，AQI ${environment.air?.aqi ?? '--'}，UV ${environment.air?.uvIndex ?? '--'}`,
    `评分：${assessment.score ?? '--'} 分，${assessment.level ?? '--'}；空气 ${assessment.metrics?.airQuality ?? '--'}，湿度 ${assessment.metrics?.humidityComfort ?? '--'}，噪音 ${assessment.metrics?.noiseComfort ?? '--'}，绿地 ${assessment.metrics?.greenSpace ?? '--'}，医疗 ${assessment.metrics?.medical ?? '--'}，生态文化 ${assessment.metrics?.cultureAccess ?? '--'}`,
    `周边：绿地 ${nearby.greenStats?.count ?? 0}，医疗 ${nearby.medicalStats?.count ?? 0}，文化点 ${nearby.cultureStats?.count ?? 0}，噪音点 ${nearby.noiseStats?.count ?? 0}`,
    payload.selectedFeature?.name ? `点选要素：${payload.selectedFeature.name} · ${payload.selectedFeature.category || '专题要素'}${payload.selectedFeature.detail ? ` · ${payload.selectedFeature.detail}` : ''}` : '',
    payload.toolResult?.message ? `工具结果：${payload.toolResult.message}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function sanitizeConversation(messages) {
  return Array.isArray(messages)
    ? messages
        .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
        .map((message) => ({
          role: message.role,
          content: String(message.content ?? '').trim(),
        }))
        .filter((message) => message.content.length > 0)
    : [];
}

function buildAiMessages(payload) {
  const initialPrompt = String(payload.prompt ?? '').trim();
  const systemPrompt = [
    '你是“绿城知境 WebGIS”的现场讲解员，不是规则模板生成器。',
    '请用自然中文回答，像在给参赛同学做现场讲解。',
    '不要输出 JSON，不要复述固定四栏模板，不要机械罗列指标名。',
    '不要用“优势 / 风险 / 建议”当成固定标题；可以直接给判断、证据和下一步建议。',
    '要结合当前地图上下文，优先引用图层、热力、天气、空气和评分证据。',
    '如果是首次分析，请给出一段简明但有判断力的讲解，结尾留 1 个最有价值的追问方向。',
    '如果是追问，请直接回答问题，必要时结合当前上下文补充证据。',
    '回答长度控制在 140 到 320 个汉字之间，除非用户明确要详细展开。',
  ].join('\n');

  const contextPrompt = `当前地图上下文：\n${buildMapContextSummary(payload)}`;
  const conversation = sanitizeConversation(payload.messages);

  return [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: contextPrompt },
    ...(conversation.length
      ? conversation
      : [
          {
            role: 'user',
            content:
              initialPrompt ||
              '请基于当前地图上下文，给出这片区域对当前画像的 AI 讲解。请先说结论，再说明证据，最后留一个可继续追问的问题。',
          },
        ]),
  ];
}

async function callAiConversation(payload) {
  if (!config.ai.key) throw new Error('AI_API_KEY 未配置');

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
        temperature: 0.35,
        max_tokens: 800,
        messages: buildAiMessages(payload),
      }),
      signal: timeout.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`AI API ${response.status}${text ? `: ${text.slice(0, 240)}` : ''}`);
    }

    const data = await response.json();
    const content = String(data.choices?.[0]?.message?.content ?? '').trim();
    if (!content) {
      throw new Error('AI API 未返回有效内容');
    }
    return {
      provider: 'ai',
      mode: 'ai',
      content,
    };
  } finally {
    timeout.done();
  }
}

async function handleExplain(request, response) {
  const payload = await readBody(request);
  if (payload.mode === 'ai') {
    const conversation = sanitizeConversation(payload.messages);
    const cacheable = conversation.length === 0;
    const cacheKey = hashPayload({
      mode: 'ai',
      profile: payload.profile?.key ?? payload.profileKey,
      location: payload.location,
      assessment: payload.assessment,
      environment: payload.environment,
      locationContext: payload.locationContext,
      mapState: payload.mapState,
      model: config.ai.key ? config.ai.model : 'rule',
    });

    if (cacheable && config.ai.key) {
      const cached = await readExplanationCache(cacheKey);
      if (cached && cached.provider === 'ai' && cached.mode === 'ai') {
        sendJson(response, 200, {
          ok: true,
          cached: true,
          explanation: cached,
        });
        return;
      }
    }

    const explanation = await callAiConversation(payload);

    if (explanation.provider === 'ai' && cacheable) {
      await writeExplanationCache({
        cacheKey,
        provider: explanation.provider,
        model: config.ai.model,
        explanation,
      });
    }

    sendJson(response, 200, {
      ok: true,
      cached: false,
      explanation,
    });
    return;
  }

  const fallback = buildRuleExplanation(payload);
  const cacheKey = hashPayload({
    mode: 'rule',
    profile: payload.profile?.key ?? payload.profileKey,
    location: payload.location,
    assessment: payload.assessment,
    environment: payload.environment,
    locationContext: payload.locationContext,
  });

  const cached = await readExplanationCache(cacheKey);
  if (cached) {
    sendJson(response, 200, {
      ok: true,
      cached: true,
      explanation: cached,
    });
    return;
  }

  const explanation = fallback;
  await writeExplanationCache({
    cacheKey,
    provider: 'rule',
    model: null,
    explanation,
  });

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
