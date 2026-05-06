<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import View from 'ol/View';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import { OverviewMap, ScaleLine, FullScreen, defaults as defaultControls } from 'ol/control';
import { createStringXY } from 'ol/coordinate';
import MousePosition from 'ol/control/MousePosition';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { fromLonLat, toLonLat } from 'ol/proj';
import { createBaseLayers, createOverviewLayer } from '../gis/baseLayers.js';
import { gcj02ToWgs84, wgs84ToGcj02 } from '../utils/coordTransform.js';

const props = defineProps({
  baseLayerKey: {
    type: String,
    required: true,
  },
  selectedLocation: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['location-selected']);

const mapEl = ref(null);
const map = shallowRef(null);
const baseLayers = shallowRef({});
const markerSource = new VectorSource();

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

function setBaseLayer(key) {
  Object.entries(baseLayers.value).forEach(([layerKey, layer]) => {
    layer.setVisible(layerKey === key);
  });
}

function updateMarker(location) {
  const displayLonLat =
    props.baseLayerKey === 'amap'
      ? wgs84ToGcj02(location.lon, location.lat)
      : [location.lon, location.lat];

  markerSource.clear();
  markerSource.addFeature(
    new Feature({
      geometry: new Point(fromLonLat(displayLonLat)),
    }),
  );
}

function resetView() {
  map.value?.getView().animate({
    center: fromLonLat([108.3669, 22.817]),
    zoom: 11,
    duration: 300,
  });
}

onMounted(() => {
  baseLayers.value = createBaseLayers();
  const overviewLayer = createOverviewLayer();

  map.value = new Map({
    target: mapEl.value,
    layers: [...Object.values(baseLayers.value), markerLayer],
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
      center: fromLonLat([108.3669, 22.817]),
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
    }),
  });

  map.value.on('click', (event) => {
    const [lon, lat] = toLonLat(event.coordinate);
    const dataLonLat = props.baseLayerKey === 'amap' ? gcj02ToWgs84(lon, lat) : [lon, lat];
    const location = {
      lon: Number(dataLonLat[0].toFixed(6)),
      lat: Number(dataLonLat[1].toFixed(6)),
    };
    updateMarker(location);
    emit('location-selected', location);
  });

  setBaseLayer(props.baseLayerKey);
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
