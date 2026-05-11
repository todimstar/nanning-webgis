import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

export const BASE_LAYER_OPTIONS = [
  { key: 'osm', label: 'OSM 标准' },
  { key: 'esriImagery', label: 'Esri 影像' },
  { key: 'cartoDark', label: 'CARTO 深色' },
];

export function createBaseLayers() {
  return {
    osm: new TileLayer({
      visible: true,
      source: new OSM(),
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
