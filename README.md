# 绿城知境 WebGIS

面向敏感人群的南宁生态文化与健康环境 WebGIS 平台。当前实现以 Vue 3 + Vite + OpenLayers 为前端主体，并加入轻量 Node 后端，用于保护高德 Web 服务 Key、AI API Key，以及提供可选 MySQL 留痕。

## 当前方向

本分支以“绿城知境”为主方向，不再沿用仓库旧的居住候选点选题叙事。旧提交保留为项目来时路，当前演示优先覆盖：

- 三种底图：高德标准（默认）、OSM 标准、Esri 影像。
- 绿地与水系、医疗与药店、噪音风险点、绿城生态文化点、评估网格专题图层，优先读取 OSM/Overpass 缓存。
- 缩放分级显示专题要素和标签，避免小比例尺文字扎堆；绿城友好度和噪音风险热力图只在街区级别显示。
- 点击地图任意位置后读取 Open-Meteo 天气与空气质量数据。
- 通过高德 Web 服务后端接口获取逆地理位置，避免前端暴露 key。
- 按呼吸道敏感、皮肤敏感、睡眠浅、综合绿城生活 4 种画像计算综合适宜度。
- 后端 AI 解释接口优先调用真实 AI API，未配置或失败时降级为规则式解释。
- 缓冲区、框选、圆选、属性查询、地图 PNG、直观 HTML 评估摘要导出，可选写入 MySQL。

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

为了方便本机演示，后端在未配置 `server/.env` 时会自动尝试读取仓库旁边的 `高德key.txt`；队友分发时建议给他们单独的 `server/.env`，不要把 key 放进 Git。

## 数据来源

项目优先使用 `public/data/osm_cache/` 下的 OSM/Overpass 缓存，保证课堂演示时不需要实时请求 Overpass：

- `osm_cache/green_spaces.geojson`
- `osm_cache/medical_services.geojson`
- `osm_cache/culture_green_points.geojson`
- `osm_cache/noise_risk_poi.geojson`
- `osm_cache/manifest.json`

如果缓存缺失，会回退到 `public/data/` 下的轻量演示 GeoJSON：

- `green_spaces.geojson`
- `medical_services.geojson`
- `culture_green_points.geojson`
- `noise_risk_poi.geojson`
- `demo_grid.geojson`
- `nanning_demo_boundary.geojson`

需要刷新缓存时运行：

```bash
npm run data:fetch
```

可以指定 bbox：

```bash
node scripts/fetch_overpass.mjs --bbox=22.72,108.20,22.93,108.55
```

底图慢加载主要来自境外瓦片源，因此默认改为高德标准底图；OSM 和 Esri 仍保留用于对比。

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
- 超前实现：Open-Meteo、四模式评分、后端 AI 解释降级、绘制/编辑/测量/框选/圆选、缓冲区、属性查询、热力图、地图 PNG 导出、HTML 摘要导出已接入。

## 后续阶段

- 叠加分析和更完整的专题统计。
- 评分模型科学依据整理与毕业设计化论证。
- 真实 OSM/Overpass 数据定期抓取与缓存更新。
- 更完整的动态趋势图与展示材料。
