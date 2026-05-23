<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import MapView from './components/MapView.vue';
import ProfileSelector from './components/ProfileSelector.vue';
import LayerPanel from './components/LayerPanel.vue';
import ToolPanel from './components/ToolPanel.vue';
import AnalysisPanel from './components/AnalysisPanel.vue';
import { fetchAmapRegeocode, requestAiExplanation } from './api/backend.js';
import { fetchEnvironment } from './api/openMeteo.js';
import { DEFAULT_SCORE_CONFIG, computeAssessment } from './model/scoreModel.js';
import { buildExplanation } from './model/explainModel.js';
import {
  NANNING_CENTER,
  createDefaultOverlayState,
  loadGreenCityCollections,
} from './data/greenCityData.js';

const scoreConfig = ref(DEFAULT_SCORE_CONFIG);
const selectedProfile = ref('green');
const selectedLocation = ref(NANNING_CENTER);
const environment = ref(null);
const greenCityData = ref({});
const selectedFeature = ref(null);
const locationContext = ref(null);
const explanation = ref(null);
const explanationLoading = ref(false);
const explanationNotice = ref('');
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

let explanationRequestId = 0;

async function refreshExplanation() {
  const fallback = ruleExplanation.value;
  if (!fallback || !assessment.value) {
    explanation.value = null;
    return;
  }

  const requestId = ++explanationRequestId;
  explanation.value = fallback;
  explanationLoading.value = true;
  explanationNotice.value = '正在请求后端 AI 解释；不可用时自动保留规则式解释。';

  try {
    const result = await requestAiExplanation({
      location: selectedLocation.value,
      profile: activeProfile.value,
      environment: environment.value,
      assessment: assessment.value,
      locationContext: locationContext.value,
    });
    if (requestId !== explanationRequestId) return;
    explanation.value = result.explanation ?? fallback;
    explanationNotice.value =
      result.explanation?.provider === 'ai'
        ? '已接入后端 AI API 生成解释。'
        : result.explanation?.note || 'AI API 未配置或暂不可用，当前使用后端规则式解释。';
  } catch (error) {
    if (requestId !== explanationRequestId) return;
    console.warn('后端解释接口不可用，使用前端规则式解释：', error);
    explanation.value = fallback;
    explanationNotice.value = '后端解释接口不可用，当前使用前端规则式解释。';
  } finally {
    if (requestId === explanationRequestId) explanationLoading.value = false;
  }
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

watch([ruleExplanation, locationContext], () => {
  refreshExplanation();
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
        :location="selectedLocation"
        :location-context="locationContext"
        :profile="activeProfile"
        :environment="environment"
        :assessment="assessment"
        :explanation="explanation"
        :explanation-loading="explanationLoading"
        :explanation-notice="explanationNotice"
        :selected-feature="selectedFeature"
        :query-radius-meters="queryRadiusMeters"
        :tool-result="toolResult"
        :loading="loading"
        :api-error="apiError"
      />
    </aside>
  </div>
</template>
