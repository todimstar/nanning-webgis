<script setup>
import { computed, onMounted, ref } from 'vue';
import MapView from './components/MapView.vue';
import ProfileSelector from './components/ProfileSelector.vue';
import LayerPanel from './components/LayerPanel.vue';
import AnalysisPanel from './components/AnalysisPanel.vue';
import { fetchEnvironment, getFallbackEnvironment } from './api/openMeteo.js';
import { DEFAULT_SCORE_CONFIG, computeAssessment } from './model/scoreModel.js';
import { buildExplanation } from './model/explainModel.js';

const NANNING_CENTER = { lon: 108.3669, lat: 22.817 };

const scoreConfig = ref(DEFAULT_SCORE_CONFIG);
const selectedProfile = ref('respiratory');
const selectedLocation = ref(NANNING_CENTER);
const environment = ref(null);
const loading = ref(false);
const apiError = ref('');
const baseLayerKey = ref('osm');

const assessment = computed(() => {
  if (!environment.value) return null;
  return computeAssessment({
    environment: environment.value,
    location: selectedLocation.value,
    profileKey: selectedProfile.value,
    config: scoreConfig.value,
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

async function evaluateLocation(location) {
  selectedLocation.value = location;
  loading.value = true;
  apiError.value = '';

  try {
    environment.value = await fetchEnvironment(location);
  } catch (error) {
    console.warn('Open-Meteo 请求失败，使用示例环境数据降级：', error);
    apiError.value = 'Open-Meteo 暂时不可用，当前显示的是本地示例环境数据。';
    environment.value = getFallbackEnvironment(location);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadScoreConfig();
  await evaluateLocation(NANNING_CENTER);
});
</script>

<template>
  <div class="app-shell">
    <aside class="side-panel left-panel">
      <div class="brand">
        <p class="eyebrow">南宁 WebGIS MVP</p>
        <h1>健康宜居环境评估</h1>
      </div>

      <ProfileSelector
        v-model="selectedProfile"
        :profiles="scoreConfig.profiles"
      />

      <LayerPanel v-model:base-layer-key="baseLayerKey" />

      <section class="panel-block">
        <h2>阶段范围</h2>
        <ul class="scope-list">
          <li>OpenLayers 定位南宁</li>
          <li>三种公开底图切换</li>
          <li>点击地图获取 Open-Meteo 数据</li>
          <li>按画像计算评分并解释</li>
        </ul>
      </section>
    </aside>

    <main class="map-region">
      <MapView
        :base-layer-key="baseLayerKey"
        :selected-location="selectedLocation"
        @location-selected="evaluateLocation"
      />
    </main>

    <aside class="side-panel right-panel">
      <AnalysisPanel
        :location="selectedLocation"
        :environment="environment"
        :assessment="assessment"
        :explanation="explanation"
        :loading="loading"
        :api-error="apiError"
      />
    </aside>
  </div>
</template>
