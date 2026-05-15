import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

const AMAP_VECTOR_URLS = [1, 2, 3, 4].map(
  (index) =>
    `https://webrd0${index}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}`,
);

export const BASE_LAYER_OPTIONS = [
  { key: 'osm', label: 'OSM 标准' },
  { key: 'amap', label: '高德标准' },
  { key: 'esriImagery', label: 'Esri 影像' },
];

export function createBaseLayers() {
  return {
    osm: new TileLayer({
      visible: true,
      source: new OSM(),
    }),
    amap: new TileLayer({
      visible: false,
      source: new XYZ({
        urls: AMAP_VECTOR_URLS,
        attributions: '© 高德地图',
      }),
    }),
    esriImagery: new TileLayer({
      visible: false,
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles © Esri',
      }),
    }),
    cartoDark: new TileLayer({
      visible: false,
      source: new XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        attributions: '© CARTO © OpenStreetMap contributors',
      }),
    }),
  };
}

export function createOverviewLayer() {
  return new TileLayer({
    source: new OSM(),
  });
}
