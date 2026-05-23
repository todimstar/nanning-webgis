<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import MapView from './components/MapView.vue';
import ProfileSelector from './components/ProfileSelector.vue';
import LayerPanel from './components/LayerPanel.vue';
import ToolPanel from './components/ToolPanel.vue';
import AnalysisPanel from './components/AnalysisPanel.vue';
import { fetchAmapRegeocode, requestAssistantReply } from './api/backend.js';
import { fetchEnvironment } from './api/openMeteo.js';
import { DEFAULT_SCORE_CONFIG, computeAssessment } from './model/scoreModel.js';
import { buildExplanation } from './model/explainModel.js';
import {
  NANNING_CENTER,
  OVERLAY_LAYER_DEFS,
  createDefaultOverlayState,
  loadGreenCityCollections,
} from './data/greenCityData.js';
import { BASE_LAYER_OPTIONS } from './gis/baseLayers.js';

const scoreConfig = ref(DEFAULT_SCORE_CONFIG);
const selectedProfile = ref('green');
const selectedLocation = ref(NANNING_CENTER);
const environment = ref(null);
const greenCityData = ref({});
const selectedFeature = ref(null);
const locationContext = ref(null);
const explanationLoading = ref(false);
const explanationNotice = ref('');
const explanationMode = ref('rule');
const aiConversation = ref(loadAiConversation());
const aiDraft = ref('');
const aiNotice = ref('');
const aiError = ref('');
const loading = ref(false);
const apiError = ref('');
const baseLayerKey = ref('amap');
const overlayState = ref(createDefaultOverlayState());
const heatmapState = ref({
  greenHeatmap: { visible: false },
  noiseHeatmap: { visible: false },
});
const queryRadiusMeters = ref(900);
const activeTool = ref('inspect');
const toolCommand = ref({ id: 0, type: '' });
const toolResult = ref(null);
const aiOpeningPrompt =
  '请基于当前地图上下文给出第一次 AI 讲解，结合图层、热力、天气和评分给出判断，并在结尾留一个最有价值的追问方向。';

const overlayLabelByKey = Object.fromEntries(OVERLAY_LAYER_DEFS.map((layer) => [layer.key, layer.label]));
const heatmapLabelByKey = {
  greenHeatmap: '绿城友好度热力',
  noiseHeatmap: '噪音风险热力',
};
const baseLayerLabelByKey = Object.fromEntries(
  BASE_LAYER_OPTIONS.map((layer) => [layer.key, layer.label]),
);

const assessment = computed(() => {
  if (!environment.value) return null;
  return computeAssessment({
    environment: environment.value,
    location: selectedLocation.value,
    profileKey: selectedProfile.value,
    config: scoreConfig.value,
    greenCityData: greenCityData.value,
    radiusMeters: queryRadiusMeters.value,
  });
});

const activeProfile = computed(() => ({
  key: selectedProfile.value,
  ...scoreConfig.value.profiles[selectedProfile.value],
}));

const ruleExplanation = computed(() => {
  if (!assessment.value) return null;
  return buildExplanation({
    assessment: assessment.value,
    profile: activeProfile.value,
    environment: environment.value,
  });
});

const aiContextSnapshot = computed(() => {
  if (!assessment.value || !environment.value) return null;
  return buildAiContextSnapshot();
});

function createEmptyAiConversation() {
  return {
    id: crypto.randomUUID?.() ?? `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    context: null,
    messages: [],
  };
}

function loadAiConversation() {
  if (typeof window === 'undefined') return createEmptyAiConversation();
  try {
    const raw = window.localStorage.getItem('green-city-ai-conversation-v1');
    if (!raw) return createEmptyAiConversation();
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !Array.isArray(parsed.messages)) return createEmptyAiConversation();
    return parsed;
  } catch (error) {
    console.warn('AI 会话读取失败：', error);
    return createEmptyAiConversation();
  }
}

function saveAiConversation() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('green-city-ai-conversation-v1', JSON.stringify(aiConversation.value));
  } catch (error) {
    console.warn('AI 会话保存失败：', error);
  }
}

function buildAiContextSnapshot() {
  const visibleLayers = Object.entries(overlayState.value)
    .filter(([, state]) => state?.visible)
    .map(([key, state]) => ({
      key,
      label: overlayLabelByKey[key] ?? key,
      opacity: Number(state?.opacity ?? 1),
    }));
  const activeHeatmaps = Object.entries(heatmapState.value)
    .filter(([, state]) => state?.visible)
    .map(([key]) => ({
      key,
      label: heatmapLabelByKey[key] ?? key,
    }));
  const baseLayerLabel = baseLayerLabelByKey[baseLayerKey.value] ?? baseLayerKey.value;
  return {
    location: { ...selectedLocation.value },
    locationContext: locationContext.value ? { ...locationContext.value } : null,
    profile: { ...activeProfile.value },
    environment: environment.value ? JSON.parse(JSON.stringify(environment.value)) : null,
    assessment: assessment.value ? JSON.parse(JSON.stringify(assessment.value)) : null,
    mapState: {
      baseLayerKey: baseLayerKey.value,
      baseLayerLabel,
      queryRadiusMeters: queryRadiusMeters.value,
      overlayState: JSON.parse(JSON.stringify(overlayState.value)),
      heatmapState: JSON.parse(JSON.stringify(heatmapState.value)),
      visibleLayers,
      activeHeatmaps,
    },
    selectedFeature: selectedFeature.value ? JSON.parse(JSON.stringify(selectedFeature.value)) : null,
    toolResult: toolResult.value ? JSON.parse(JSON.stringify(toolResult.value)) : null,
  };
}

function replaceAiSystemContext(contextSnapshot) {
  aiConversation.value.context = contextSnapshot;
  aiConversation.value.updatedAt = new Date().toISOString();
  saveAiConversation();
}

function stripSystemMessages(messages) {
  return (messages ?? []).filter((message) => message?.role === 'user' || message?.role === 'assistant');
}

function appendAiMessage(role, content) {
  aiConversation.value.messages = [
    ...stripSystemMessages(aiConversation.value.messages),
    {
      id: crypto.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      content,
      createdAt: new Date().toISOString(),
    },
  ];
  aiConversation.value.updatedAt = new Date().toISOString();
  saveAiConversation();
}

function resetAiConversation() {
  aiConversation.value = createEmptyAiConversation();
  aiDraft.value = '';
  aiNotice.value = '已开启新的 AI 对话。';
  aiError.value = '';
  saveAiConversation();
}

function hasAiTranscript() {
  return stripSystemMessages(aiConversation.value.messages).length > 0;
}

function ensureAiContext() {
  const snapshot = aiContextSnapshot.value;
  if (!snapshot) return;
  replaceAiSystemContext(snapshot);
}

async function requestAiAnalysis(prompt, overrideMessages = null) {
  const context = aiConversation.value.context ?? aiContextSnapshot.value;
  if (!context) {
    aiError.value = 'AI 上下文尚未准备好';
    return;
  }

  explanationLoading.value = true;
  aiError.value = '';
  explanationNotice.value = 'AI 正在结合图层、热力、天气和评分回答。';

  const messages = overrideMessages ?? stripSystemMessages(aiConversation.value.messages);
  try {
    const result = await requestAssistantReply({
      mode: 'ai',
      location: context.location,
      profile: context.profile,
      environment: context.environment,
      assessment: context.assessment,
      locationContext: context.locationContext,
      mapState: context.mapState,
      selectedFeature: context.selectedFeature,
      toolResult: context.toolResult,
      messages,
      prompt,
    });
    const content = result.explanation?.content || result.explanation?.summary || 'AI 暂未返回内容。';
    if (!messages.length || !hasAiTranscript()) {
      aiConversation.value.messages = [
        {
          id: crypto.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: 'assistant',
          content,
          createdAt: new Date().toISOString(),
        },
      ];
    } else {
      appendAiMessage('assistant', content);
    }
    aiNotice.value = result.explanation?.note || '已获取 AI 讲解。';
    saveAiConversation();
  } catch (error) {
    console.warn('AI 追问失败：', error);
    aiError.value = error instanceof Error ? error.message : 'AI 请求失败';
    aiNotice.value = 'AI 请求暂不可用，当前保持浏览器内对话。';
  } finally {
    explanationLoading.value = false;
  }
}

async function startAiConversation() {
  ensureAiContext();
  if (!aiConversation.value.context && !aiContextSnapshot.value) {
    aiNotice.value = '地图数据仍在加载，请稍后再试。';
    return;
  }
  await requestAiAnalysis(aiOpeningPrompt, []);
}

async function beginNewAiConversation() {
  resetAiConversation();
  ensureAiContext();
  if (explanationMode.value === 'ai') {
    await startAiConversation();
  }
}

async function sendAiQuestion() {
  const question = aiDraft.value.trim();
  if (!question) return;
  ensureAiContext();
  appendAiMessage('user', question);
  aiDraft.value = '';
  await requestAiAnalysis(question);
}

async function loadScoreConfig() {
  try {
    const response = await fetch('./data/score-config.json');
    if (!response.ok) throw new Error(`score-config ${response.status}`);
    scoreConfig.value = await response.json();
  } catch (error) {
    console.warn('使用内置评分配置降级：', error);
    scoreConfig.value = DEFAULT_SCORE_CONFIG;
  }
}

function runToolCommand(command) {
  const payload = typeof command === 'string' ? { type: command } : command;
  toolCommand.value = {
    id: Date.now(),
    ...payload,
  };
}

async function evaluateLocation(location) {
  selectedLocation.value = location;
  loading.value = true;
  apiError.value = '';
  locationContext.value = null;

  try {
    const [environmentResult, geocodeResult] = await Promise.all([
      fetchEnvironment(location),
      fetchAmapRegeocode(location).catch((error) => {
        console.warn('高德逆地理编码不可用：', error);
        return null;
      }),
    ]);

    environment.value = environmentResult;
    locationContext.value = geocodeResult?.ok ? geocodeResult : null;
    if (environment.value.unavailable) {
      apiError.value = '实时环境数据暂不可用';
    }
  } catch (error) {
    console.warn('Open-Meteo 请求失败：', error);
    apiError.value = '实时环境数据暂不可用';
    environment.value = {
      coordinates: { lat: location.lat, lon: location.lon },
      fetchedAt: new Date().toISOString(),
      source: 'Open-Meteo',
      unavailable: true,
      errorMessage: error instanceof Error ? error.message : 'unknown error',
      hourly: [],
    };
  } finally {
    loading.value = false;
  }
}

async function loadLayerData() {
  try {
    greenCityData.value = await loadGreenCityCollections();
  } catch (error) {
    console.warn('静态图层数据加载失败：', error);
    greenCityData.value = {};
  }
}

watch(
  [aiContextSnapshot, loading],
  ([snapshot, isLoading]) => {
    if (!snapshot) return;
    replaceAiSystemContext(snapshot);
    if (explanationMode.value === 'ai' && !hasAiTranscript() && !explanationLoading.value && !isLoading) {
      void startAiConversation();
    }
  },
  { immediate: true, deep: true },
);

watch(explanationMode, (mode) => {
  if (mode === 'rule') {
    aiNotice.value = '';
    aiError.value = '';
    explanationLoading.value = false;
    return;
  }

  ensureAiContext();
  if (!hasAiTranscript() && aiContextSnapshot.value && !loading.value && !explanationLoading.value) {
    void startAiConversation();
    return;
  }

  aiNotice.value = loading.value ? '地图数据仍在加载，完成后会自动开始 AI 讲解。' : 'AI 解释已开启，可继续追问。';
});

onMounted(async () => {
  await Promise.all([loadScoreConfig(), loadLayerData()]);
  await evaluateLocation(NANNING_CENTER);
});
</script>

<template>
  <div class="app-shell">
    <aside class="side-panel left-panel">
      <div class="brand">
        <p class="eyebrow">绿城知境 WebGIS</p>
        <h1>南宁生态文化与健康环境评估</h1>
      </div>

      <ProfileSelector
        v-model="selectedProfile"
        :profiles="scoreConfig.profiles"
      />

      <LayerPanel
        v-model:base-layer-key="baseLayerKey"
        v-model:overlay-state="overlayState"
        v-model:heatmap-state="heatmapState"
        v-model:query-radius-meters="queryRadiusMeters"
      />

      <ToolPanel
        v-model:active-tool="activeTool"
        :tool-result="toolResult"
        @command="runToolCommand"
      />

      <section class="panel-block">
        <h2>初版能力</h2>
        <ul class="scope-list">
          <li>南宁三底图切换与复位、比例尺、坐标、鹰眼</li>
          <li>绿地、水系、医疗、噪音风险、生态文化点图层</li>
          <li>点击地图后读取 Open-Meteo 并统计周边要素</li>
          <li>按敏感人群模式输出评分、风险和绿城解释</li>
        </ul>
      </section>
    </aside>

    <main class="map-region">
      <MapView
        :base-layer-key="baseLayerKey"
        :overlay-state="overlayState"
        :heatmap-state="heatmapState"
        :selected-location="selectedLocation"
        :query-radius-meters="queryRadiusMeters"
        :active-tool="activeTool"
        :tool-command="toolCommand"
        @location-selected="evaluateLocation"
        @feature-selected="selectedFeature = $event"
        @tool-result="toolResult = $event"
      />
    </main>

    <aside class="side-panel right-panel">
      <AnalysisPanel
        v-model:explanation-mode="explanationMode"
        v-model:ai-draft="aiDraft"
        :location="selectedLocation"
        :location-context="locationContext"
        :profile="activeProfile"
        :environment="environment"
        :assessment="assessment"
        :explanation="ruleExplanation"
        :explanation-loading="explanationLoading"
        :explanation-notice="explanationNotice"
        :ai-conversation="aiConversation"
        :ai-error="aiError"
        :ai-notice="aiNotice"
        :selected-feature="selectedFeature"
        :query-radius-meters="queryRadiusMeters"
        :tool-result="toolResult"
        :loading="loading"
        :api-error="apiError"
        @send-ai-question="sendAiQuestion"
        @new-ai-conversation="beginNewAiConversation"
        @start-ai-conversation="startAiConversation"
      />
    </aside>
  </div>
</template>
