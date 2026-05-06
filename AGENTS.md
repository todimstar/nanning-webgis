# AGENTS.md：南宁健康宜居环境 WebGIS 项目代理说明

你是本项目的代码代理。请严格按照以下边界实现项目。

## 项目目标

实现一个纯前端 WebGIS 应用：

> 基于 OpenLayers 的南宁城市健康宜居环境评估 WebGIS 系统

用于课程作业和人工智能创新赛道包装。项目要能部署到 GitHub Pages，不依赖后端、不依赖数据库、不暴露任何私密 API Key。

## 核心要求

1. 使用 Vue 3 + Vite + OpenLayers。
2. 使用现代 JavaScript / TypeScript 均可，优先代码清晰。
3. 最终项目必须能 `npm install`、`npm run dev`、`npm run build`。
4. 不要引入后端。
5. 不要使用 MySQL、PostGIS、Express、FastAPI 等服务端依赖。
6. 不要把任何 API Key 写死在代码里。
7. Open-Meteo API 不需要 key，可以直接前端调用。
8. OSM/Overpass 数据优先通过脚本抓取后保存成本地 GeoJSON，前端加载静态文件。
9. 如果 Overpass 抓取失败，允许使用 demo-candidate-points.geojson 和手写示例数据保证功能可演示。
10. 不要实现登录注册。
11. 不要实现真实房源平台爬虫。
12. 不要实现犯罪率、交通事故等敏感或难获取数据。
13. 噪音使用“夜间噪音风险模型”，不要依赖真实噪音 API。
14. LLM 解释使用规则式解释，不调用真实大模型 API。

## 建议项目目录

```text
src/
  api/
    openMeteo.js
  components/
    MapView.vue
    LayerPanel.vue
    ToolPanel.vue
    AnalysisPanel.vue
    ProfileSelector.vue
  gis/
    baseLayers.js
    vectorLayers.js
    drawTools.js
    measureTools.js
    spatialQuery.js
    heatmap.js
  model/
    scoreModel.js
    noiseModel.js
    explainModel.js
  utils/
    geoUtils.js
    normalize.js
  App.vue
  main.js
public/
  data/
    score-config.json
    demo-candidate-points.geojson
    nanning_poi.geojson
    nanning_roads.geojson
```

## 课程功能覆盖

必须尽量覆盖：

- 多源地图加载：至少 3 种底图
- 缩放、平移、复位、全屏
- 图层管理：显示/隐藏、透明度
- 比例尺、鼠标坐标、鹰眼
- 绘制工具：点、线、面、圆、矩形
- 要素编辑与删除
- 测距、测面积
- 标注和信息弹窗
- 地图截图/导出
- 空间查询：点选、框选、圆选
- 属性查询：按评分、AQI、噪音风险筛选
- 空间分析：缓冲区、叠加/范围统计
- 热力图
- 动态数据可视化：未来 24 小时空气/湿度趋势

## 用户画像

必须包含 4 种：

1. 呼吸道敏感
2. 皮肤敏感
3. 睡眠浅怕吵
4. 普通宜居

每种画像读取 `score-config.json` 里的权重。

## 评分逻辑

每个指标归一化到 0-100：

- airQuality：空气质量分
- humidityComfort：湿度舒适分
- uvSafety：紫外线安全分
- noiseComfort：噪音舒适分
- greenSpace：绿地便利分
- medical：医疗便利分
- lifeConvenience：生活便利分
- roadDistance：道路噪音距离分
- nightPoiDensity：夜间娱乐密度分

综合评分：

```text
综合评分 = Σ 指标分 × 用户画像权重
```

## 解释逻辑

不要只输出分数。必须输出类似：

```text
该位置对“呼吸道敏感”用户的适宜度为 82 分。
优势：PM2.5 较低，周边有公园，医疗设施距离较近。
风险：湿度偏高，夏季可能存在闷热潮湿感。
建议：适合作为候选居住区域，但建议避开临近主干道的楼栋。
```

## UI 结构

推荐三栏：

- 左侧：工具栏、图层控制、用户画像选择
- 中间：OpenLayers 地图
- 右侧：环境指标、综合评分、AI解释、趋势图

## 实现顺序

第一步：MVP  
第二步：课程功能补齐  
第三步：视觉美化  
第四步：报告和演示友好化

不要一次性生成超大代码。每一步生成后都要保证可运行。
