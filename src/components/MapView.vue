<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import Map from 'ol/Map';
import View from 'ol/View';
import Circle from 'ol/geom/Circle';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import Draw, { createBox } from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import { OverviewMap, ScaleLine, FullScreen, defaults as defaultControls } from 'ol/control';
import { createStringXY } from 'ol/coordinate';
import MousePosition from 'ol/control/MousePosition';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getArea, getLength } from 'ol/sphere';
import { unByKey } from 'ol/Observable';
import { createBaseLayers, createOverviewLayer } from '../gis/baseLayers.js';
import { NANNING_CENTER, OVERLAY_LAYER_DEFS, safeLoadGeoJson } from '../data/greenCityData.js';
import { gcj02ToWgs84, wgs84ToGcj02 } from '../utils/coordTransform.js';

const props = defineProps({
  baseLayerKey: {
    type: String,
    required: true,
  },
  overlayState: {
    type: Object,
    required: true,
  },
  selectedLocation: {
    type: Object,
    required: true,
  },
  queryRadiusMeters: {
    type: Number,
    required: true,
  },
  activeTool: {
    type: String,
    default: 'inspect',
  },
  toolCommand: {
    type: Object,
    default: () => ({ id: 0, type: '' }),
  },
});

const emit = defineEmits(['location-selected', 'feature-selected', 'tool-result']);

const mapEl = ref(null);
const popupState = ref({
  visible: false,
  left: 0,
  top: 0,
  title: '',
  category: '',
  description: '',
});
const map = shallowRef(null);
const baseLayers = shallowRef({});
const overlayLayers = shallowRef({});
const baseLayerLoadState = ref({
  pending: 0,
  errors: 0,
  slow: false,
});
const markerSource = new VectorSource();
const querySource = new VectorSource();
const drawingSource = new VectorSource();
const geoJsonFormat = new GeoJSON();
const activeInteraction = shallowRef(null);
const overlayDataCache = new Map();

const markerLayer = new VectorLayer({
  source: markerSource,
  style: new Style({
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color: '#ef4444' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
    }),
  }),
});

const queryLayer = new VectorLayer({
  source: querySource,
  style: new Style({
    fill: new Fill({ color: 'rgba(15, 118, 110, 0.08)' }),
    stroke: new Stroke({ color: '#0f766e', width: 2, lineDash: [8, 8] }),
  }),
});

const drawingLayer = new VectorLayer({
  source: drawingSource,
  style: (feature) => {
    const label = feature.get('label') ?? '';
    return new Style({
      fill: new Fill({ color: 'rgba(30, 64, 175, 0.12)' }),
      stroke: new Stroke({ color: '#1e40af', width: 3 }),
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: '#1e40af' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new Text({
        text: label,
        offsetY: -16,
        font: '12px "Microsoft YaHei", sans-serif',
        fill: new Fill({ color: '#172033' }),
        stroke: new Stroke({ color: '#ffffff', width: 3 }),
      }),
    });
  },
});

const DRAW_TOOL_CONFIG = {
  drawPoint: { type: 'Point', label: '点要素' },
  drawLine: { type: 'LineString', label: '线要素' },
  drawPolygon: { type: 'Polygon', label: '面要素' },
  drawCircle: { type: 'Circle', label: '圆要素' },
  drawRectangle: { type: 'Circle', label: '矩形要素', geometryFunction: createBox() },
  measureLine: { type: 'LineString', label: '距离测量', measure: 'length' },
  measureArea: { type: 'Polygon', label: '面积测量', measure: 'area' },
  boxQuery: { type: 'Circle', label: '框选查询', geometryFunction: createBox(), query: 'box' },
  circleQuery: { type: 'Circle', label: '圆选查询', query: 'circle' },
};

const SLOW_BASE_LAYER_LABELS = {
  osm: 'OSM 标准底图来自境外公开瓦片源，课堂网络下可能加载较慢；演示时建议切回高德标准底图。',
  esriImagery: 'Esri 影像来自境外公开瓦片源，课堂网络下可能加载较慢；影像未显示完整时可先使用高德标准底图讲解。',
};

let baseLayerLoadTimer = null;
let baseLayerListenerCleanups = [];

function clearBaseLayerLoadListeners() {
  baseLayerListenerCleanups.forEach((cleanup) => cleanup());
  baseLayerListenerCleanups = [];
  if (baseLayerLoadTimer) {
    window.clearTimeout(baseLayerLoadTimer);
    baseLayerLoadTimer = null;
  }
}

function watchBaseLayerLoading(key) {
  clearBaseLayerLoadListeners();
  baseLayerLoadState.value = {
    pending: 0,
    errors: 0,
    slow: false,
  };

  const source = baseLayers.value[key]?.getSource?.();
  if (!source?.on) return;

  const startKey = source.on('tileloadstart', () => {
    baseLayerLoadState.value.pending += 1;
    if (!baseLayerLoadTimer) {
      baseLayerLoadTimer = window.setTimeout(() => {
        if (baseLayerLoadState.value.pending > 0) {
          baseLayerLoadState.value.slow = true;
        }
      }, 7000);
    }
  });

  const finish = () => {
    baseLayerLoadState.value.pending = Math.max(0, baseLayerLoadState.value.pending - 1);
    if (baseLayerLoadState.value.pending === 0 && baseLayerLoadTimer) {
      window.clearTimeout(baseLayerLoadTimer);
      baseLayerLoadTimer = null;
    }
  };

  const endKey = source.on('tileloadend', finish);
  const errorKey = source.on('tileloaderror', () => {
    baseLayerLoadState.value.errors += 1;
    baseLayerLoadState.value.slow = true;
    finish();
  });

  baseLayerListenerCleanups = [startKey, endKey, errorKey].map((eventKey) => () => unByKey(eventKey));
}

function baseLayerNotice() {
  if (SLOW_BASE_LAYER_LABELS[props.baseLayerKey]) return SLOW_BASE_LAYER_LABELS[props.baseLayerKey];
  if (baseLayerLoadState.value.slow) return '当前底图加载较慢，请稍候，或切换到高德标准底图继续演示。';
  return '';
}

function setBaseLayer(key) {
  Object.entries(baseLayers.value).forEach(([layerKey, layer]) => {
    layer.setVisible(layerKey === key);
  });
}

function layerStyle(definition) {
  return (feature) => {
    const name = feature.get('name') ?? '';
    const geometryType = feature.getGeometry()?.getType();
    const isPolygon = geometryType?.includes('Polygon');

    return new Style({
      fill: new Fill({ color: definition.fill }),
      stroke: new Stroke({ color: definition.color, width: isPolygon ? 2 : 1.5 }),
      image: new CircleStyle({
        radius: definition.key === 'noiseRiskPoi' ? 7 : 6,
        fill: new Fill({ color: definition.color }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new Text({
        text: name,
        offsetY: -15,
        font: '12px "Microsoft YaHei", sans-serif',
        fill: new Fill({ color: '#172033' }),
        stroke: new Stroke({ color: '#ffffff', width: 3 }),
      }),
    });
  };
}

function toDisplayLonLat(lon, lat, baseLayerKey = props.baseLayerKey) {
  return baseLayerKey === 'amap' ? wgs84ToGcj02(lon, lat) : [lon, lat];
}

function transformWgs84FeatureToDisplay(feature, baseLayerKey) {
  const geometry = feature.getGeometry();
  if (!geometry) return feature;

  if (baseLayerKey === 'amap') {
    geometry.applyTransform((flatCoordinates, flatCoordinates2, stride) => {
      const output = flatCoordinates2 || flatCoordinates;
      for (let index = 0; index < flatCoordinates.length; index += stride) {
        const [lon, lat] = wgs84ToGcj02(flatCoordinates[index], flatCoordinates[index + 1]);
        output[index] = lon;
        output[index + 1] = lat;
        for (let offset = 2; offset < stride; offset += 1) {
          output[index + offset] = flatCoordinates[index + offset];
        }
      }
      return output;
    });
  }

  geometry.transform('EPSG:4326', 'EPSG:3857');
  return feature;
}

function readDisplayFeatures(data, baseLayerKey) {
  return geoJsonFormat
    .readFeatures(data, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:4326',
    })
    .map((feature) => transformWgs84FeatureToDisplay(feature, baseLayerKey));
}

async function loadOverlayData(definition) {
  if (!overlayDataCache.has(definition.key)) {
    overlayDataCache.set(definition.key, safeLoadGeoJson(definition.path));
  }
  return overlayDataCache.get(definition.key);
}

async function createOverlayLayers() {
  const entries = await Promise.all(
    OVERLAY_LAYER_DEFS.map(async (definition) => {
      const source = new VectorSource();

      try {
        const data = await loadOverlayData(definition);
        source.addFeatures(readDisplayFeatures(data, props.baseLayerKey));
      } catch (error) {
        console.warn(`图层加载失败：${definition.label}`, error);
      }

      const layer = new VectorLayer({
        source,
        visible: props.overlayState[definition.key]?.visible ?? definition.defaultVisible,
        opacity: props.overlayState[definition.key]?.opacity ?? 0.8,
        style: layerStyle(definition),
      });

      return [definition.key, layer];
    }),
  );

  overlayLayers.value = Object.fromEntries(entries);
}

async function refreshOverlayCoordinates(baseLayerKey) {
  await Promise.all(
    OVERLAY_LAYER_DEFS.map(async (definition) => {
      const layer = overlayLayers.value[definition.key];
      if (!layer) return;

      try {
        const data = await loadOverlayData(definition);
        const source = layer.getSource();
        source.clear();
        source.addFeatures(readDisplayFeatures(data, baseLayerKey));
      } catch (error) {
        console.warn(`图层坐标刷新失败：${definition.label}`, error);
      }
    }),
  );
}

function syncOverlayState(state) {
  Object.entries(overlayLayers.value).forEach(([key, layer]) => {
    layer.setVisible(state[key]?.visible ?? true);
    layer.setOpacity(state[key]?.opacity ?? 0.8);
  });
}

function formatLength(geometry) {
  const length = getLength(geometry);
  if (length >= 1000) return `${(length / 1000).toFixed(2)} km`;
  return `${length.toFixed(1)} m`;
}

function formatArea(geometry) {
  const area = getArea(geometry);
  if (area >= 1000000) return `${(area / 1000000).toFixed(2)} km²`;
  return `${area.toFixed(1)} m²`;
}

function queryOverlayFeatures(geometry) {
  const extent = geometry.getExtent();
  const ignoredLayers = new Set(['nanningDemoBoundary', 'demoGrid']);
  const counts = {};
  let total = 0;

  OVERLAY_LAYER_DEFS.forEach((definition) => {
    if (ignoredLayers.has(definition.key)) return;
    const layer = overlayLayers.value[definition.key];
    if (!layer?.getVisible()) return;

    const count = layer
      .getSource()
      .getFeatures()
      .filter((feature) => feature.getGeometry()?.intersectsExtent(extent)).length;

    if (count > 0) {
      counts[definition.label] = count;
      total += count;
    }
  });

  const detail = Object.entries(counts)
    .map(([label, count]) => `${label} ${count}`)
    .join('，');
  return {
    total,
    detail: detail || '未命中专题要素',
  };
}

function clearActiveInteraction() {
  if (activeInteraction.value && map.value) {
    map.value.removeInteraction(activeInteraction.value);
  }
  activeInteraction.value = null;
}

function activateTool(toolKey) {
  if (!map.value) return;
  clearActiveInteraction();

  if (toolKey === 'edit') {
    const modify = new Modify({ source: drawingSource });
    modify.on('modifyend', () => {
      emit('tool-result', { type: 'edit', message: '已编辑绘制要素。' });
    });
    map.value.addInteraction(modify);
    activeInteraction.value = modify;
    return;
  }

  const config = DRAW_TOOL_CONFIG[toolKey];
  if (!config) return;

  const draw = new Draw({
    source: drawingSource,
    type: config.type,
    geometryFunction: config.geometryFunction,
  });

  draw.on('drawend', (event) => {
    const geometry = event.feature.getGeometry();
    let message = `已添加${config.label}。`;
    let label = config.label;

    if (config.measure === 'length') {
      label = formatLength(geometry);
      message = `距离测量：${label}`;
    }

    if (config.measure === 'area') {
      label = formatArea(geometry);
      message = `面积测量：${label}`;
    }

    if (config.query) {
      const result = queryOverlayFeatures(geometry);
      label = config.label;
      message = `${config.label}：共命中 ${result.total} 个专题要素，${result.detail}。`;
    }

    event.feature.setProperties({
      tool: toolKey,
      label,
      createdAt: new Date().toISOString(),
    });
    emit('tool-result', { type: toolKey, message });
  });

  map.value.addInteraction(draw);
  activeInteraction.value = draw;
}

function deleteDrawnFeature(pixel) {
  const feature = map.value?.forEachFeatureAtPixel(pixel, (hit) => hit, {
    layerFilter: (layer) => layer === drawingLayer,
  });
  if (!feature) {
    emit('tool-result', { type: 'delete', message: '未点中可删除的绘制要素。' });
    return true;
  }

  drawingSource.removeFeature(feature);
  emit('tool-result', { type: 'delete', message: '已删除绘制要素。' });
  return true;
}

function clearDrawings() {
  drawingSource.clear();
  emit('tool-result', { type: 'clearDrawings', message: '已清空所有绘制和测量要素。' });
}

function exportMap() {
  if (!map.value) return;
  map.value.once('rendercomplete', () => {
    const mapCanvas = document.createElement('canvas');
    const size = map.value.getSize();
    mapCanvas.width = size[0];
    mapCanvas.height = size[1];
    const mapContext = mapCanvas.getContext('2d');

    document.querySelectorAll('.ol-layer canvas, canvas.ol-layer').forEach((canvas) => {
      if (canvas.width <= 0 || canvas.height <= 0) return;

      const opacity = canvas.parentNode?.style?.opacity || canvas.style.opacity;
      mapContext.globalAlpha = opacity === '' ? 1 : Number(opacity);

      const transform = canvas.style.transform;
      const matrix = transform
        .match(/^matrix\(([^(]*)\)$/)?.[1]
        ?.split(',')
        .map(Number);

      if (matrix) {
        mapContext.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
      } else {
        mapContext.setTransform(1, 0, 0, 1, 0, 0);
      }
      mapContext.drawImage(canvas, 0, 0);
    });

    mapContext.setTransform(1, 0, 0, 1, 0, 0);
    const link = document.createElement('a');
    link.download = `green-city-map-${Date.now()}.png`;
    link.href = mapCanvas.toDataURL('image/png');
    link.click();
    emit('tool-result', { type: 'exportMap', message: '已导出当前地图 PNG。' });
  });

  map.value.renderSync();
}

function handleToolCommand(command) {
  if (!command?.type) return;
  if (command.type === 'clearDrawings') clearDrawings();
  if (command.type === 'exportMap') exportMap();
}

function showFeaturePopup(feature, pixel) {
  popupState.value = {
    visible: true,
    left: pixel[0] + 14,
    top: pixel[1] + 14,
    title: feature.get('name') ?? '未命名要素',
    category: feature.get('category') ?? '专题要素',
    description:
      feature.get('cultureText') ??
      feature.get('note') ??
      feature.get('riskType') ??
      feature.get('serviceType') ??
      '静态 GeoJSON 演示数据',
  };
}

function hidePopup() {
  popupState.value.visible = false;
}

function updateMarker(location) {
  const displayLonLat = toDisplayLonLat(location.lon, location.lat);

  markerSource.clear();
  markerSource.addFeature(
    new Feature({
      geometry: new Point(fromLonLat(displayLonLat)),
    }),
  );
  updateQueryCircle(location);
}

function updateQueryCircle(location) {
  const displayLonLat = toDisplayLonLat(location.lon, location.lat);

  querySource.clear();
  querySource.addFeature(
    new Feature({
      geometry: new Circle(fromLonLat(displayLonLat), props.queryRadiusMeters),
    }),
  );
}

function resetView() {
  const center = toDisplayLonLat(NANNING_CENTER.lon, NANNING_CENTER.lat);

  map.value?.getView().animate({
    center: fromLonLat(center),
    zoom: 11,
    duration: 300,
  });
}

onMounted(async () => {
  baseLayers.value = createBaseLayers();
  const overviewLayer = createOverviewLayer();
  await createOverlayLayers();

  map.value = new Map({
    target: mapEl.value,
    layers: [
      ...Object.values(baseLayers.value),
      ...Object.values(overlayLayers.value),
      drawingLayer,
      queryLayer,
      markerLayer,
    ],
    controls: defaultControls().extend([
      new FullScreen(),
      new ScaleLine(),
      new MousePosition({
        coordinateFormat: createStringXY(5),
        projection: 'EPSG:4326',
        className: 'mouse-position',
        placeholder: '经纬度',
      }),
      new OverviewMap({
        collapsed: true,
        layers: [overviewLayer],
      }),
    ]),
    view: new View({
      center: fromLonLat(toDisplayLonLat(NANNING_CENTER.lon, NANNING_CENTER.lat)),
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
    }),
  });

  map.value.on('click', (event) => {
    if (props.activeTool === 'delete') {
      deleteDrawnFeature(event.pixel);
      return;
    }

    if (props.activeTool !== 'inspect') return;

    const feature = map.value.forEachFeatureAtPixel(event.pixel, (hit) => hit, {
      layerFilter: (layer) => layer !== markerLayer && layer !== queryLayer,
    });

    if (feature) {
      showFeaturePopup(feature, event.pixel);
      emit('feature-selected', {
        name: feature.get('name') ?? '未命名要素',
        category: feature.get('category') ?? '专题要素',
        tags: feature.get('tags') ?? [],
        cultureText: feature.get('cultureText') ?? '',
        score: feature.get('score') ?? feature.get('greenScore') ?? feature.get('supportScore') ?? null,
      });
    } else {
      hidePopup();
      emit('feature-selected', null);
    }

    const [displayLon, displayLat] = toLonLat(event.coordinate);
    const [lon, lat] =
      props.baseLayerKey === 'amap'
        ? gcj02ToWgs84(displayLon, displayLat)
        : [displayLon, displayLat];
    const location = {
      lon: Number(lon.toFixed(6)),
      lat: Number(lat.toFixed(6)),
    };
    updateMarker(location);
    emit('location-selected', location);
  });

  setBaseLayer(props.baseLayerKey);
  watchBaseLayerLoading(props.baseLayerKey);
  syncOverlayState(props.overlayState);
  updateMarker(props.selectedLocation);
  activateTool(props.activeTool);
});

watch(
  () => props.baseLayerKey,
  async (key) => {
    setBaseLayer(key);
    watchBaseLayerLoading(key);
    await refreshOverlayCoordinates(key);
    updateMarker(props.selectedLocation);
    map.value?.getView().setCenter(fromLonLat(toDisplayLonLat(props.selectedLocation.lon, props.selectedLocation.lat, key)));
  },
);

watch(
  () => props.selectedLocation,
  (location) => updateMarker(location),
  { deep: true },
);

watch(
  () => props.overlayState,
  (state) => syncOverlayState(state),
  { deep: true },
);

watch(
  () => props.queryRadiusMeters,
  () => updateQueryCircle(props.selectedLocation),
);

watch(
  () => props.activeTool,
  (toolKey) => activateTool(toolKey),
);

watch(
  () => props.toolCommand?.id,
  () => handleToolCommand(props.toolCommand),
);

onBeforeUnmount(() => {
  clearActiveInteraction();
  clearBaseLayerLoadListeners();
  map.value?.setTarget(undefined);
});
</script>

<template>
  <div class="map-wrap">
    <div ref="mapEl" class="map-canvas"></div>
    <button class="reset-button" type="button" @click="resetView">复位南宁</button>
    <div v-if="baseLayerNotice()" class="map-load-notice">
      {{ baseLayerNotice() }}
    </div>
    <div
      v-if="popupState.visible"
      class="feature-popup"
      :style="{ left: `${popupState.left}px`, top: `${popupState.top}px` }"
    >
      <button type="button" aria-label="关闭弹窗" @click="hidePopup">×</button>
      <strong>{{ popupState.title }}</strong>
      <span>{{ popupState.category }}</span>
      <p>{{ popupState.description }}</p>
    </div>
  </div>
</template>
