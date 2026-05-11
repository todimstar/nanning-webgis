function addStrength(list, condition, text) {
  if (condition) list.push(text);
}

function addRisk(list, condition, text) {
  if (condition) list.push(text);
}

export function buildExplanation({ assessment, profile, environment }) {
  const { metrics, score, level, noise } = assessment;
  const strengths = [];
  const risks = [];

  addStrength(strengths, metrics.airQuality >= 70, '空气质量较好，PM2.5 和 AQI 对敏感人群压力较小');
  addStrength(strengths, metrics.humidityComfort >= 80, '湿度处于较舒适区间');
  addStrength(strengths, metrics.uvSafety >= 80, '紫外线风险较低');
  addStrength(strengths, metrics.noiseComfort >= 70, '夜间噪音舒适度较高');
  addStrength(strengths, metrics.medical >= 70, '周边医疗便利性较好');
  addStrength(strengths, metrics.greenSpace >= 70, '附近绿地环境条件较好');
  addStrength(strengths, metrics.cultureAccess >= 70, '周边具有可用于日常休闲和绿城文化表达的生态文化点');

  addRisk(risks, metrics.airQuality < 60, '空气质量分偏低，呼吸道敏感人群需要谨慎');
  addRisk(risks, environment.weather.humidity > 70, '当前湿度偏高，夏季可能有闷热潮湿感');
  addRisk(risks, metrics.uvSafety < 70, '紫外线风险偏高，户外活动需要防晒');
  addRisk(risks, metrics.noiseComfort < 60, `距示例主干道约 ${noise.nearestRoadMeters} 米，夜间可能存在交通或商圈噪音`);
  addRisk(risks, metrics.nightPoiDensity < 70, '附近夜间活跃 POI 密度较高，睡眠浅用户需要避开临街楼栋');
  addRisk(risks, metrics.cultureAccess < 60, '周边生态文化点较少，绿城生活体验需要依赖更远距离的公园或水系空间');

  const summary = `该位置对“${profile.label}”用户的适宜度为 ${score} 分，属于${level}区域。`;
  const advice =
    score >= 70
      ? '适合作为绿城生活体验候选区域，建议结合步行到绿地、水系和医疗点的实际路线继续筛选。'
      : '建议作为备选点观察，优先比较空气质量更稳定、离主干道更远且生态文化资源更集中的区域。';

  return {
    summary,
    strengths: strengths.length ? strengths.join('；') + '。' : '暂无明显单项优势，需要结合更多周边数据判断。',
    risks: risks.length ? risks.join('；') + '。' : '当前未发现明显环境短板。',
    advice,
  };
}
