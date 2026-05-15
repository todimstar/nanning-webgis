function collect(list, condition, text) {
  if (condition) list.push(text);
}

export function buildRuleExplanation({ assessment, profile, environment, locationContext }) {
  const metrics = assessment?.metrics ?? {};
  const score = assessment?.score ?? '--';
  const level = assessment?.level ?? '待评估';
  const strengths = [];
  const risks = [];
  const address = locationContext?.formattedAddress;

  collect(strengths, metrics.airQuality >= 70, '空气质量压力较小，适合日常步行与短时户外活动');
  collect(strengths, metrics.humidityComfort >= 80, '湿度处于较舒适区间');
  collect(strengths, metrics.uvSafety >= 80, '紫外线风险较低');
  collect(strengths, metrics.greenSpace >= 70, '周边绿地或水系可达性较好');
  collect(strengths, metrics.medical >= 70, '周边医疗服务便利性较好');
  collect(strengths, metrics.cultureAccess >= 70, '附近具备绿城文化与日常休闲表达空间');

  collect(risks, metrics.airQuality < 60, '空气质量分偏低，呼吸道敏感人群需要缩短暴露时间');
  collect(risks, environment?.weather?.relativeHumidity2m > 70, '相对湿度偏高，夏季体感可能闷热');
  collect(risks, metrics.uvSafety < 70, '紫外线风险偏高，皮肤敏感人群需要防晒');
  collect(risks, metrics.noiseComfort < 60, '噪音舒适度偏低，睡眠浅用户应避开临街楼栋');
  collect(risks, metrics.cultureAccess < 60, '生态文化点较少，绿城生活体验可能依赖更远距离空间');

  const realtime = environment?.unavailable
    ? '实时环境数据暂不可用，本次解释以静态空间数据和已缓存指标为主。'
    : `实时环境参考：气温 ${environment?.weather?.temperature2m ?? '--'}℃，湿度 ${environment?.weather?.relativeHumidity2m ?? '--'}%，PM2.5 ${environment?.air?.pm25 ?? '--'}，PM10 ${environment?.air?.pm10 ?? '--'}，AQI ${environment?.air?.aqi ?? '--'}，UV ${environment?.air?.uvIndex ?? '--'}。`;

  const placeText = address ? `位置参考为${address}。` : '';

  return {
    provider: 'rule',
    summary: `${placeText}该位置对“${profile?.label ?? profile?.key ?? '当前画像'}”模式的绿城友好度为 ${score} 分，属于${level}区域。${realtime}`,
    strengths: strengths.length ? `${strengths.join('；')}。` : '暂无明显单项优势，需要结合更多周边数据判断。',
    risks: risks.length ? `${risks.join('；')}。` : '当前未发现明显环境短板。',
    advice:
      Number(score) >= 70
        ? '适合作为绿城生活体验候选区域，建议结合步行路径、绿地入口和遮阴条件继续筛选。'
        : '建议作为备选点观察，优先比较空气质量更稳定、远离主干道且生态文化资源更集中的区域。',
  };
}
