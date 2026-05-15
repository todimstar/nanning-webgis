<script setup>
import { computed, onMounted, ref } from 'vue';
import MapView from './components/MapView.vue';
import ProfileSelector from './components/ProfileSelector.vue';
import LayerPanel from './components/LayerPanel.vue';
import ToolPanel from './components/ToolPanel.vue';
import AnalysisPanel from './components/AnalysisPanel.vue';
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
const loading = ref(false);
const apiError = ref('');
const baseLayerKey = ref('osm');
const overlayState = ref(createDefaultOverlayState());
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

const explanation = computed(() => {
  if (!assessment.value) return null;
  return buildExplanation({
    assessment: assessment.value,
    profile: scoreConfig.value.profiles[selectedProfile.value],
    environment: environment.value,
  });
});

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

function runToolCommand(type) {
  toolCommand.value = {
    id: Date.now(),
    type,
  };
}

async function evaluateLocation(location) {
  selectedLocation.value = location;
  loading.value = true;
  apiError.value = '';

  try {
    environment.value = await fetchEnvironment(location);
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
        :environment="environment"
        :assessment="assessment"
        :explanation="explanation"
        :selected-feature="selectedFeature"
        :query-radius-meters="queryRadiusMeters"
        :tool-result="toolResult"
        :loading="loading"
        :api-error="apiError"
      />
    </aside>
  </div>
</template>
