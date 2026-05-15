<script setup>
const DRAW_TOOLS = [
  { key: 'inspect', label: '点选查询' },
  { key: 'drawPoint', label: '绘点' },
  { key: 'drawLine', label: '绘线' },
  { key: 'drawPolygon', label: '绘面' },
  { key: 'drawCircle', label: '绘圆' },
  { key: 'drawRectangle', label: '绘矩形' },
  { key: 'measureLine', label: '测距' },
  { key: 'measureArea', label: '测面积' },
  { key: 'boxQuery', label: '框选查询' },
  { key: 'circleQuery', label: '圆选查询' },
  { key: 'edit', label: '编辑' },
  { key: 'delete', label: '删除' },
];

defineProps({
  activeTool: {
    type: String,
    required: true,
  },
  toolResult: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:activeTool', 'command']);
</script>

<template>
  <section class="panel-block">
    <h2>WebGIS 工具</h2>
    <div class="tool-grid">
      <button
        v-for="tool in DRAW_TOOLS"
        :key="tool.key"
        type="button"
        :class="{ active: activeTool === tool.key }"
        @click="emit('update:activeTool', tool.key)"
      >
        {{ tool.label }}
      </button>
    </div>

    <div class="tool-actions">
      <button type="button" @click="emit('command', 'clearDrawings')">清空绘制</button>
      <button type="button" @click="emit('command', 'exportMap')">导出地图</button>
    </div>

    <p class="tool-hint">
      当前：{{ DRAW_TOOLS.find((tool) => tool.key === activeTool)?.label || '点选查询' }}
    </p>
    <p v-if="toolResult" class="tool-result">{{ toolResult.message }}</p>
  </section>
</template>
