<script setup>
import { computed } from 'vue';
import { saveReport } from '../api/backend.js';
import { buildReportHtml, downloadHtml } from '../utils/reportExport.js';

const props = defineProps({
  location: {
    type: Object,
    required: true,
  },
  locationContext: {
    type: Object,
    default: null,
  },
  profile: {
    type: Object,
    default: null,
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
  explanationLoading: {
    type: Boolean,
    default: false,
  },
  explanationNotice: {
    type: String,
    default: '',
  },
  selectedFeature: {
    type: Object,
    default: null,
  },
  queryRadiusMeters: {
    type: Number,
    required: true,
  },
  toolResult: {
    type: Object,
    default: null,
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
  return hourly.slice(0, 24).map((item) => ({
    label: item.time ? new Date(item.time).getHours().toString().padStart(2, '0') : '--',
    temperature: item.temperature ?? 0,
    pm25: item.pm25 ?? 0,
  }));
});

const trendMax = computed(() => {
  const values = trendSamples.value.flatMap((item) => [item.temperature, item.pm25]);
  return Math.max(1, ...values);
});

async function exportHtmlReport() {
  if (!props.assessment || !props.environment || !props.explanation) return;

  const html = buildReportHtml({
    location: props.location,
    profile: props.profile,
    environment: props.environment,
    assessment: props.assessment,
    explanation: props.explanation,
    locationContext: props.locationContext,
  });
  downloadHtml(`green-city-report-${Date.now()}.html`, html);

  try {
    await saveReport({
      title: '绿城知境评估摘要',
      profileKey: props.profile?.key ?? 'unknown',
      location: props.location,
      html,
    });
  } catch (error) {
    console.warn('报告后端保存不可用，已完成本地 HTML 导出：', error);
  }
}
</script>

<template>
  <section class="analysis">
    <div class="analysis-header">
      <div>
        <p class="eyebrow">当前评估点</p>
        <h2>{{ location.lon.toFixed(5) }}, {{ location.lat.toFixed(5) }}</h2>
        <p v-if="locationContext?.formattedAddress" class="address-text">
          {{ locationContext.formattedAddress }}
        </p>
      </div>
      <span class="source-pill">{{ environment?.unavailable ? '实时暂不可用' : environment?.source || '等待数据' }}</span>
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

      <button class="export-report-button" type="button" @click="exportHtmlReport">
        导出 HTML 评估摘要
      </button>

      <div class="metric-grid">
        <article>
          <span>温度</span>
          <strong>{{ valueOrDash(environment.weather?.temperature2m, '°C') }}</strong>
        </article>
        <article>
          <span>湿度</span>
          <strong>{{ valueOrDash(environment.weather?.relativeHumidity2m, '%') }}</strong>
        </article>
        <article>
          <span>风速</span>
          <strong>{{ valueOrDash(environment.weather?.windSpeed10m, ' km/h') }}</strong>
        </article>
        <article>
          <span>PM2.5</span>
          <strong>{{ valueOrDash(environment.air?.pm25, ' μg/m³') }}</strong>
        </article>
        <article>
          <span>PM10</span>
          <strong>{{ valueOrDash(environment.air?.pm10, ' μg/m³') }}</strong>
        </article>
        <article>
          <span>AQI</span>
          <strong>{{ valueOrDash(environment.air?.aqi) }}</strong>
        </article>
        <article>
          <span>NO2</span>
          <strong>{{ valueOrDash(environment.air?.nitrogenDioxide, ' μg/m³') }}</strong>
        </article>
        <article>
          <span>O3</span>
          <strong>{{ valueOrDash(environment.air?.ozone, ' μg/m³') }}</strong>
        </article>
        <article>
          <span>UV</span>
          <strong>{{ valueOrDash(environment.air?.uvIndex) }}</strong>
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
        <p v-if="selectedFeature.score !== null">参考评分：{{ selectedFeature.score }}</p>
      </section>

      <section v-if="toolResult" class="data-block tool-result-block">
        <h2>工具结果</h2>
        <p>{{ toolResult.message }}</p>
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

      <section class="data-block explanation-block">
        <h2>规则式 AI 解释</h2>
        <div v-if="explanationNotice" class="explanation-notice">
          {{ explanationLoading ? '生成中：' : '' }}{{ explanationNotice }}
        </div>
        <p class="explain-summary">{{ explanation.summary }}</p>
        <p><strong>优势：</strong>{{ explanation.strengths }}</p>
        <p><strong>风险：</strong>{{ explanation.risks }}</p>
        <p><strong>建议：</strong>{{ explanation.advice }}</p>
      </section>

      <section class="data-block trend-block">
        <h2>南宁区域未来 24 小时环境趋势参考</h2>
        <p class="trend-note">
          数据来源：Open-Meteo hourly forecast。该趋势用于展示区域环境背景，不代表街道级实测值，也不直接参与当前点位评分。
        </p>
        <div class="mini-trend" aria-label="未来 24 小时温度和 PM2.5 趋势参考">
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
              :style="{ height: `${Math.max(12, (point.pm25 / trendMax) * 88)}px` }"
              :title="`${point.label}:00 PM2.5 ${point.pm25}`"
            ></span>
            <small>{{ point.label }}</small>
          </div>
        </div>
        <div class="trend-legend">
          <span><i class="legend-temp"></i>温度</span>
          <span><i class="legend-aqi"></i>PM2.5</span>
        </div>
      </section>
    </template>
  </section>
</template>
