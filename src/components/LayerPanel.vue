<script setup>
import { BASE_LAYER_OPTIONS } from '../gis/baseLayers.js';
import { OVERLAY_LAYER_DEFS } from '../data/greenCityData.js';

const props = defineProps({
  baseLayerKey: {
    type: String,
    required: true,
  },
  overlayState: {
    type: Object,
    required: true,
  },
  heatmapState: {
    type: Object,
    required: true,
  },
  queryRadiusMeters: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits([
  'update:baseLayerKey',
  'update:overlayState',
  'update:heatmapState',
  'update:queryRadiusMeters',
]);

function updateOverlay(key, patch) {
  emit('update:overlayState', {
    ...props.overlayState,
    [key]: {
      ...props.overlayState[key],
      ...patch,
    },
  });
}

function updateHeatmap(key, patch) {
  emit('update:heatmapState', {
    ...props.heatmapState,
    [key]: {
      ...props.heatmapState[key],
      ...patch,
    },
  });
}
</script>

<template>
  <section class="panel-block">
    <h2>底图切换</h2>
    <div class="segmented">
      <button
        v-for="layer in BASE_LAYER_OPTIONS"
        :key="layer.key"
        type="button"
        :class="{ active: baseLayerKey === layer.key }"
        @click="emit('update:baseLayerKey', layer.key)"
      >
        {{ layer.label }}
      </button>
    </div>
  </section>

  <section class="panel-block">
    <h2>专题图层</h2>
    <div class="overlay-list">
      <label
        v-for="layer in OVERLAY_LAYER_DEFS"
        :key="layer.key"
        class="overlay-row"
      >
        <span class="overlay-main">
          <input
            type="checkbox"
            :checked="overlayState[layer.key]?.visible"
            @change="updateOverlay(layer.key, { visible: $event.target.checked })"
          />
          <i :style="{ background: layer.color }"></i>
          <strong>{{ layer.label }}</strong>
        </span>
        <input
          type="range"
          min="0.2"
          max="1"
          step="0.05"
          :value="overlayState[layer.key]?.opacity ?? 0.8"
          @input="updateOverlay(layer.key, { opacity: Number($event.target.value) })"
        />
      </label>
    </div>
  </section>

  <section class="panel-block">
    <h2>空间查询半径</h2>
    <div class="range-row">
      <input
        type="range"
        min="300"
        max="1800"
        step="100"
        :value="queryRadiusMeters"
        @input="emit('update:queryRadiusMeters', Number($event.target.value))"
      />
      <strong>{{ queryRadiusMeters }} m</strong>
    </div>
  </section>

  <section class="panel-block">
    <h2>热力图</h2>
    <div class="overlay-list">
      <label class="overlay-row">
        <span class="overlay-main">
          <input
            type="checkbox"
            :checked="heatmapState.greenHeatmap?.visible"
            @change="updateHeatmap('greenHeatmap', { visible: $event.target.checked })"
          />
          <i style="background: #17803d"></i>
          <strong>绿城友好度热力</strong>
        </span>
        <small class="layer-note">放大到街区级别后显示，避免缩小时覆盖全图。</small>
      </label>
      <label class="overlay-row">
        <span class="overlay-main">
          <input
            type="checkbox"
            :checked="heatmapState.noiseHeatmap?.visible"
            @change="updateHeatmap('noiseHeatmap', { visible: $event.target.checked })"
          />
          <i style="background: #dc2626"></i>
          <strong>噪音风险热力</strong>
        </span>
        <small class="layer-note">放大到街区级别后显示，基于 OSM 道路和夜间活动点。</small>
      </label>
    </div>
  </section>
</template>
