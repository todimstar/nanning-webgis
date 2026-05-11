<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import Map from 'ol/Map';
import View from 'ol/View';
import Circle from 'ol/geom/Circle';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import { OverviewMap, ScaleLine, FullScreen, defaults as defaultControls } from 'ol/control';
import { createStringXY } from 'ol/coordinate';
import MousePosition from 'ol/control/MousePosition';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import { fromLonLat, toLonLat } from 'ol/proj';
import { createBaseLayers, createOverviewLayer } from '../gis/baseLayers.js';
import { NANNING_CENTER, OVERLAY_LAYER_DEFS } from '../data/greenCityData.js';

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
});

const emit = defineEmits(['location-selected', 'feature-selected']);

const mapEl = ref(null);
const map = shallowRef(null);
const baseLayers = shallowRef({});
const overlayLayers = shallowRef({});
const markerSource = new VectorSource();
const querySource = new VectorSource();
const geoJsonFormat = new GeoJSON();

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

async function createOverlayLayers() {
  const entries = await Promise.all(
    OVERLAY_LAYER_DEFS.map(async (definition) => {
      const source = new VectorSource();

      try {
        const response = await fetch(definition.path);
        if (!response.ok) throw new Error(`${definition.path} ${response.status}`);
        const data = await response.json();
        source.addFeatures(
          geoJsonFormat.readFeatures(data, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          }),
        );
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

function syncOverlayState(state) {
  Object.entries(overlayLayers.value).forEach(([key, layer]) => {
    layer.setVisible(state[key]?.visible ?? true);
    layer.setOpacity(state[key]?.opacity ?? 0.8);
  });
}

function updateMarker(location) {
  markerSource.clear();
  markerSource.addFeature(
    new Feature({
      geometry: new Point(fromLonLat([location.lon, location.lat])),
    }),
  );
  updateQueryCircle(location);
}

function updateQueryCircle(location) {
  querySource.clear();
  querySource.addFeature(
    new Feature({
      geometry: new Circle(fromLonLat([location.lon, location.lat]), props.queryRadiusMeters),
    }),
  );
}

function resetView() {
  map.value?.getView().animate({
    center: fromLonLat([NANNING_CENTER.lon, NANNING_CENTER.lat]),
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
      center: fromLonLat([NANNING_CENTER.lon, NANNING_CENTER.lat]),
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
    }),
  });

  map.value.on('click', (event) => {
    const feature = map.value.forEachFeatureAtPixel(event.pixel, (hit) => hit, {
      layerFilter: (layer) => layer !== markerLayer && layer !== queryLayer,
    });

    if (feature) {
      emit('feature-selected', {
        name: feature.get('name') ?? '未命名要素',
        category: feature.get('category') ?? '专题要素',
        tags: feature.get('tags') ?? [],
        cultureText: feature.get('cultureText') ?? '',
        score: feature.get('score') ?? feature.get('greenScore') ?? feature.get('supportScore') ?? null,
      });
    }

    const [lon, lat] = toLonLat(event.coordinate);
    const location = {
      lon: Number(lon.toFixed(6)),
      lat: Number(lat.toFixed(6)),
    };
    updateMarker(location);
    emit('location-selected', location);
  });

  setBaseLayer(props.baseLayerKey);
  syncOverlayState(props.overlayState);
  updateMarker(props.selectedLocation);
});

watch(
  () => props.baseLayerKey,
  (key) => {
    setBaseLayer(key);
    updateMarker(props.selectedLocation);
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

onBeforeUnmount(() => {
  map.value?.setTarget(undefined);
});
</script>

<template>
  <div class="map-wrap">
    <div ref="mapEl" class="map-canvas"></div>
    <button class="reset-button" type="button" @click="resetView">复位南宁</button>
  </div>
</template>
