export function describeFeature(feature) {
  const category = String(feature.get('category') ?? feature.get('riskType') ?? feature.get('serviceType') ?? '专题要素');
  const layerKey = String(feature.get('layerKey') ?? '');
  const rawName = String(feature.get('name') ?? '').trim();
  const title = normalizeTitle(rawName, category, feature);
  const tags = normalizeTags(feature.get('tags'));
  const osmId = feature.get('osmId') ?? feature.get('osm_id');
  const osmType = feature.get('osmType') ?? inferOsmType(osmId);

  if (layerKey === 'noiseRiskPoi') {
    const riskType = String(feature.get('riskType') ?? 'noise');
    const riskWeight = feature.get('riskWeight');
    return {
      title,
      category,
      detail: [
        `${riskTypeLabel(riskType)}噪音风险要素`,
        tags.length ? `OSM 标签：${tags.join('，')}` : '',
        riskWeight != null ? `模型风险权重：${riskWeight}` : '',
        osmId != null ? `来源：OpenStreetMap ${osmType || ''}/${osmId}`.replace('//', '/') : '',
      ].filter(Boolean).join('；'),
    };
  }

  if (layerKey === 'medicalServices') {
    const supportScore = feature.get('supportScore');
    return {
      title,
      category,
      detail: [
        `${category}类医疗支持点`,
        tags.length ? `OSM 标签：${tags.join('，')}` : '',
        supportScore != null ? `医疗支持评分：${supportScore}` : '',
        osmId != null ? `来源：OpenStreetMap ${osmType || ''}/${osmId}`.replace('//', '/') : '',
      ].filter(Boolean).join('；'),
    };
  }

  if (layerKey === 'greenSpaces' || layerKey === 'cultureGreenPoints') {
    const cultureText = feature.get('cultureText');
    const score = feature.get('greenScore') ?? feature.get('score');
    return {
      title,
      category,
      detail: [
        cultureText ? String(cultureText) : `${category}类生态文化空间`,
        tags.length ? `OSM 标签：${tags.join('，')}` : '',
        score != null ? `绿地友好度参考分：${score}` : '',
        osmId != null ? `来源：OpenStreetMap ${osmType || ''}/${osmId}`.replace('//', '/') : '',
      ].filter(Boolean).join('；'),
    };
  }

  return {
    title,
    category,
    detail: tags.length ? `OSM 标签：${tags.join('，')}` : '地图专题要素',
  };
}

function normalizeTitle(rawName, category, feature) {
  if (!rawName || rawName === category || rawName.startsWith(`${category} `)) {
    const osmId = feature.get('osmId') ?? feature.get('osm_id');
    const osmType = feature.get('osmType') ?? inferOsmType(osmId);
    return osmId != null ? `未命名${category}（${osmType || 'osm'}/${osmId}）` : category;
  }

  return rawName.replace(/\s+(pharmacy|hospital|clinic|primary|secondary|trunk|motorway|switch|stop)$/i, '');
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => ['amenity', 'leisure', 'natural', 'tourism', 'highway', 'railway', 'waterway'].includes(key))
      .map(([key, item]) => `${key}:${item}`);
  }
  return [];
}

function inferOsmType(osmId) {
  if (typeof osmId !== 'string') return '';
  return osmId.includes('/') ? osmId.split('/')[0] : '';
}

function riskTypeLabel(riskType) {
  if (riskType === 'traffic') return '交通';
  if (riskType === 'railway') return '轨道';
  if (riskType === 'nightlife') return '夜间活动';
  if (riskType === 'dining') return '餐饮活动';
  if (riskType === 'night_noise_risk') return '夜间活动';
  return '环境';
}
