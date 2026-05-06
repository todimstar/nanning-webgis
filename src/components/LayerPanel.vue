<script setup>
import { BASE_LAYER_OPTIONS } from '../gis/baseLayers.js';

defineProps({
  baseLayerKey: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['update:baseLayerKey']);
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
</template>
