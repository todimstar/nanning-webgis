function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function metricRows(metrics = []) {
  return metrics
    .map(
      (metric) => `
        <tr>
          <td>${escapeHtml(metric.label)}</td>
          <td>${escapeHtml(metric.value)}</td>
        </tr>`,
    )
    .join('');
}

function valueOrDash(value, unit = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return `${Number(value).toFixed(1)}${unit}`;
}

export function buildReportHtml({ location, profile, environment, assessment, explanation, locationContext }) {
  const title = '绿城知境评估摘要';
  const address = locationContext?.formattedAddress || '未获取到高德逆地理位置';
  const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false });

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: "Microsoft YaHei", Arial, sans-serif; color: #172033; background: #f8fafc; }
    main { max-width: 920px; margin: 0 auto; padding: 28px; }
    header, section { margin-bottom: 16px; padding: 18px; border: 1px solid #dbeafe; border-radius: 8px; background: #fff; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 0 0 12px; font-size: 18px; color: #1e40af; }
    .score { display: flex; align-items: end; gap: 14px; }
    .score strong { color: #0f766e; font-size: 54px; line-height: 1; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .metric { padding: 12px; border-radius: 8px; background: #eff6ff; }
    .metric span { display: block; color: #5b677a; font-size: 12px; }
    .metric strong { display: block; margin-top: 6px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 9px 8px; border-bottom: 1px solid #e5edf8; }
    p { line-height: 1.7; }
    @media print { body { background: #fff; } main { padding: 0; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${title}</h1>
      <p>生成时间：${escapeHtml(generatedAt)}</p>
      <p>评估位置：${escapeHtml(location?.lon?.toFixed?.(5) ?? location?.lon)}, ${escapeHtml(location?.lat?.toFixed?.(5) ?? location?.lat)}</p>
      <p>高德逆地理位置：${escapeHtml(address)}</p>
      <p>画像模式：${escapeHtml(profile?.label ?? profile?.key ?? '--')}</p>
    </header>

    <section>
      <h2>综合评分</h2>
      <div class="score">
        <strong>${escapeHtml(assessment?.score ?? '--')}</strong>
        <p>${escapeHtml(assessment?.level ?? '--')}</p>
      </div>
    </section>

    <section>
      <h2>实时环境数据</h2>
      <div class="grid">
        <div class="metric"><span>温度</span><strong>${valueOrDash(environment?.weather?.temperature2m, '°C')}</strong></div>
        <div class="metric"><span>湿度</span><strong>${valueOrDash(environment?.weather?.relativeHumidity2m, '%')}</strong></div>
        <div class="metric"><span>PM2.5</span><strong>${valueOrDash(environment?.air?.pm25, ' μg/m³')}</strong></div>
        <div class="metric"><span>PM10</span><strong>${valueOrDash(environment?.air?.pm10, ' μg/m³')}</strong></div>
        <div class="metric"><span>AQI</span><strong>${valueOrDash(environment?.air?.aqi)}</strong></div>
        <div class="metric"><span>UV</span><strong>${valueOrDash(environment?.air?.uvIndex)}</strong></div>
      </div>
    </section>

    <section>
      <h2>评分指标</h2>
      <table>
        <tbody>${metricRows(assessment?.metricList)}</tbody>
      </table>
    </section>

    <section>
      <h2>AI / 规则解释</h2>
      <p><strong>概述：</strong>${escapeHtml(explanation?.summary)}</p>
      <p><strong>优势：</strong>${escapeHtml(explanation?.strengths)}</p>
      <p><strong>风险：</strong>${escapeHtml(explanation?.risks)}</p>
      <p><strong>建议：</strong>${escapeHtml(explanation?.advice)}</p>
    </section>
  </main>
</body>
</html>`;
}

export function downloadHtml(filename, html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
