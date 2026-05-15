# 绿城知境 WebGIS

面向敏感人群的南宁生态文化与健康环境 WebGIS 平台。当前实现以 Vue 3 + Vite + OpenLayers 为前端主体，并加入轻量 Node 后端，用于保护高德 Web 服务 Key、AI API Key，以及提供可选 MySQL 留痕。

## 当前方向

本分支以“绿城知境”为主方向，不再沿用仓库旧的居住候选点选题叙事。旧提交保留为项目来时路，当前演示优先覆盖：

- 三种底图：高德标准（默认）、OSM 标准、Esri 影像。
- 绿地与水系、医疗与药店、噪音风险点、绿城生态文化点、评估网格专题图层。
- 点击地图任意位置后读取 Open-Meteo 天气与空气质量数据。
- 通过高德 Web 服务后端接口获取逆地理位置，避免前端暴露 key。
- 按呼吸道敏感、皮肤敏感、睡眠浅、综合绿城生活 4 种画像计算综合适宜度。
- 后端 AI 解释接口优先调用真实 AI API，未配置或失败时降级为规则式解释。
- 导出直观 HTML 评估摘要，可选写入 MySQL。

## 本地运行

前端：

```bash
npm install
npm run dev
npm run build
```

后端：

```bash
cd server
npm install
copy .env.example .env
npm run start
```

前端默认请求 `http://127.0.0.1:8787`。如需改后端地址，在前端 `.env.local` 中设置：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787
```

后端环境变量见 `server/.env.example`。真实的 `高德key.txt`、`.env` 和 `.env.local` 不应提交。

## 数据来源

初版使用 `public/data/` 下的静态 GeoJSON 保证可演示：

- `green_spaces.geojson`
- `medical_services.geojson`
- `culture_green_points.geojson`
- `noise_risk_poi.geojson`
- `demo_grid.geojson`
- `nanning_demo_boundary.geojson`

后续可用 `scripts/fetch-overpass-nanning.mjs` 或 Overpass 查询结果替换为更完整的南宁 OSM 静态数据。底图慢加载主要来自境外瓦片源，因此默认改为高德标准底图；OSM 和 Esri 仍保留用于对比。

## MySQL

MySQL 是轻量增强，不是前端运行硬依赖。需要落库时：

```bash
cd server
mysql -u root -p < db/schema.sql
```

再配置 `server/.env` 中的 `MYSQL_*`。未配置 MySQL 时，后端仍提供高德逆地理编码、AI 解释降级和本地 HTML 导出。

## 阶段状态

- 阶段 1：底图与地图控件已完成。
- 阶段 2：静态 GeoJSON 图层、样式、图层显隐、透明度、点选弹窗和右侧要素详情已完成。
- 超前实现：Open-Meteo、四模式评分、后端 AI 解释降级、绘制/编辑/测量/框选/圆选、地图 PNG 导出、HTML 摘要导出已接入。

## 后续阶段

- 属性过滤、缓冲区分析、叠加分析。
- 评分模型科学依据整理与毕业设计化论证。
- 真实 OSM/Overpass 数据定期抓取与缓存更新。
- 更完整的动态趋势图与展示材料。
