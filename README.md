# 绿城知境 WebGIS

面向敏感人群的南宁生态文化与健康环境 WebGIS 平台。项目使用 Vue 3 + Vite + OpenLayers 实现，保持纯前端架构，适合课程作业展示、GitHub Pages 部署和后续逐步补齐 WebGIS 工具链。

## 当前方向

本分支以“绿城知境”为主方向，不再沿用仓库旧的居住候选点选题叙事。旧代码和文档仅作为历史参考，本分支优先实现：

- 南宁三种公开底图：OSM 标准、Esri 影像、CARTO 深色。
- 绿地与水系、医疗与药店、噪音风险点、绿城生态文化点、评估网格 5 类专题图层。
- 图层显示/隐藏、透明度调整、空间查询半径调整。
- 点击地图获取 Open-Meteo 天气和空气质量数据。
- 按呼吸道敏感、皮肤敏感、睡眠浅、普通宜居 4 种画像计算综合适宜度。
- 结合周边生态文化、绿地、医疗和噪音风险生成规则式解释。

## 本地运行

```bash
npm install
npm run dev
npm run build
```

开发服务器启动后访问终端提示的本地地址，例如 `http://127.0.0.1:5173/`。

## 数据来源

初版使用 `public/data/` 下的演示 GeoJSON 保证可演示：

- `green_spaces.geojson`
- `medical_services.geojson`
- `culture_green_points.geojson`
- `noise_risk_poi.geojson`
- `demo_grid.geojson`

后续可以用 `scripts/fetch-overpass-nanning.mjs` 或 Overpass 查询结果替换为更完整的南宁 OSM 静态数据。

## 下一阶段

- 绘制、编辑、删除、测距、测面积。
- 框选、圆选、属性过滤和缓冲区统计。
- 热力图和更完整的动态趋势图。
- 地图截图导出和课程报告展示材料。
