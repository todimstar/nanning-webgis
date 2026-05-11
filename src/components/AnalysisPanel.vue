<script setup>
import { computed } from 'vue';

const props = defineProps({
  location: {
    type: Object,
    required: true,
  },
  environment: {
    type: Object,
    default: null,
  },
  assessment: {
    type: Object,
    default: null,
  },
  explanation: {
    type: Object,
    default: null,
  },
  selectedFeature: {
    type: Object,
    default: null,
  },
  queryRadiusMeters: {
    type: Number,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  apiError: {
    type: String,
    default: '',
  },
});

function valueOrDash(value, unit = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return `${Number(value).toFixed(1)}${unit}`;
}

const trendSamples = computed(() => {
  const hourly = props.environment?.hourly ?? [];
  return hourly.slice(0, 12).map((item) => ({
    label: item.time ? new Date(item.time).getHours().toString().padStart(2, '0') : '--',
    temperature: item.temperature ?? 0,
    aqi: item.aqi ?? 0,
  }));
});

const trendMax = computed(() => {
  const values = trendSamples.value.flatMap((item) => [item.temperature, item.aqi]);
  return Math.max(1, ...values);
});
</script>

<template>
  <section class="analysis">
    <div class="analysis-header">
      <div>
        <p class="eyebrow">当前评估点</p>
        <h2>{{ location.lon.toFixed(5) }}, {{ location.lat.toFixed(5) }}</h2>
      </div>
      <span class="source-pill">{{ environment?.source || '等待数据' }}</span>
    </div>

    <div v-if="apiError" class="notice">{{ apiError }}</div>
    <div v-if="loading" class="loading-card">正在获取天气与空气质量数据...</div>

    <template v-if="environment && assessment">
      <div class="score-card">
        <div>
          <span>综合适宜度</span>
          <em>{{ assessment.level }}</em>
        </div>
        <strong>{{ assessment.score }}</strong>
      </div>

      <div class="metric-grid">
        <article>
          <span>温度</span>
          <strong>{{ valueOrDash(environment.weather.temperature, '°C') }}</strong>
        </article>
        <article>
          <span>湿度</span>
          <strong>{{ valueOrDash(environment.weather.humidity, '%') }}</strong>
        </article>
        <article>
          <span>风速</span>
          <strong>{{ valueOrDash(environment.weather.windSpeed, ' km/h') }}</strong>
        </article>
        <article>
          <span>PM2.5</span>
          <strong>{{ valueOrDash(environment.air.pm25, ' μg/m³') }}</strong>
        </article>
        <article>
          <span>PM10</span>
          <strong>{{ valueOrDash(environment.air.pm10, ' μg/m³') }}</strong>
        </article>
        <article>
          <span>AQI</span>
          <strong>{{ valueOrDash(environment.air.aqi) }}</strong>
        </article>
        <article>
          <span>NO2</span>
          <strong>{{ valueOrDash(environment.air.no2, ' μg/m³') }}</strong>
        </article>
        <article>
          <span>O3</span>
          <strong>{{ valueOrDash(environment.air.ozone, ' μg/m³') }}</strong>
        </article>
        <article>
          <span>UV</span>
          <strong>{{ valueOrDash(environment.air.uvIndex) }}</strong>
        </article>
        <article>
          <span>噪音风险</span>
          <strong>{{ assessment.noise.noiseRisk }}</strong>
        </article>
      </div>

      <section class="data-block">
        <h2>{{ queryRadiusMeters }} 米空间查询</h2>
        <div class="nearby-grid">
          <article>
            <span>绿地/水系</span>
            <strong>{{ assessment.nearby.greenStats.count }}</strong>
            <small>最近 {{ assessment.nearby.greenStats.nearestName || '--' }}</small>
          </article>
          <article>
            <span>医疗服务</span>
            <strong>{{ assessment.nearby.medicalStats.count }}</strong>
            <small>最近 {{ assessment.nearby.medicalStats.nearestName || '--' }}</small>
          </article>
          <article>
            <span>生态文化点</span>
            <strong>{{ assessment.nearby.cultureStats.count }}</strong>
            <small>最近 {{ assessment.nearby.cultureStats.nearestName || '--' }}</small>
          </article>
          <article>
            <span>噪音风险点</span>
            <strong>{{ assessment.nearby.noiseStats.count }}</strong>
            <small>最近 {{ assessment.nearby.noiseStats.nearestName || '--' }}</small>
          </article>
        </div>
      </section>

      <section v-if="selectedFeature" class="data-block feature-block">
        <h2>点选要素</h2>
        <p><strong>{{ selectedFeature.name }}</strong> · {{ selectedFeature.category }}</p>
        <p v-if="selectedFeature.cultureText">{{ selectedFeature.cultureText }}</p>
        <p v-if="selectedFeature.score !== null">示例评分：{{ selectedFeature.score }}</p>
      </section>

      <section class="data-block">
        <h2>指标评分</h2>
        <div class="bars">
          <div
            v-for="metric in assessment.metricList"
            :key="metric.key"
            class="bar-row"
          >
            <span>{{ metric.label }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: `${metric.value}%` }"></div>
            </div>
            <strong>{{ metric.value }}</strong>
          </div>
        </div>
      </section>

      <section class="data-block">
        <h2>未来 12 小时快览</h2>
        <div class="mini-trend" aria-label="未来 12 小时温度和 AQI 快览">
          <div
            v-for="point in trendSamples"
            :key="point.label"
            class="trend-column"
          >
            <span
              class="trend-bar temp"
              :style="{ height: `${Math.max(12, (point.temperature / trendMax) * 88)}px` }"
              :title="`${point.label}:00 温度 ${point.temperature}`"
            ></span>
            <span
              class="trend-bar aqi"
              :style="{ height: `${Math.max(12, (point.aqi / trendMax) * 88)}px` }"
              :title="`${point.label}:00 AQI ${point.aqi}`"
            ></span>
            <small>{{ point.label }}</small>
          </div>
        </div>
        <div class="trend-legend">
          <span><i class="legend-temp"></i>温度</span>
          <span><i class="legend-aqi"></i>AQI</span>
        </div>
      </section>

      <section class="data-block explanation-block">
        <h2>规则式 AI 解释</h2>
        <p class="explain-summary">{{ explanation.summary }}</p>
        <p><strong>优势：</strong>{{ explanation.strengths }}</p>
        <p><strong>风险：</strong>{{ explanation.risks }}</p>
        <p><strong>建议：</strong>{{ explanation.advice }}</p>
      </section>
    </template>
  </section>
</template>
