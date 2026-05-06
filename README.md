# 南宁健康宜居环境 WebGIS：Codex 项目启动包

这个启动包用于投喂给 Codex / Cursor / Claude Code 等 vibecoding 工具，目标是让它们基于明确的产品边界和数据方案，生成一个可静态部署的 WebGIS 课程项目。

## 项目定位

课程项目名称：

> 基于 OpenLayers 的南宁城市健康宜居环境评估 WebGIS 系统

参赛包装名称：

> 宜居知境：面向敏感体质人群的 AI 城市微环境评估平台

核心场景：

> 用户点击南宁地图上的某个位置，系统结合天气、空气质量、紫外线、周边道路/POI、噪音风险模型和用户画像，输出该位置对“呼吸道敏感、皮肤敏感、睡眠浅怕吵、普通宜居”等人群的适宜度评分和解释。

## 推荐开发技术栈

- Vue 3 + Vite
- OpenLayers 8.x 或 10.x
- Turf.js
- ECharts
- html2canvas
- 纯前端，无后端
- 可部署到 GitHub Pages

## 这个包里有什么

```text
.codex/SKILL.md                         给 Codex 的项目技能说明
AGENTS.md                               给 Codex/代码代理的最高优先级项目说明
prompts/CODEX_MASTER_PROMPT.md          一键投喂 Codex 的完整提示词
docs/01_PROJECT_BRIEF.md                项目需求说明
docs/02_API_AND_DATA_PLAN.md            API 与数据方案
docs/03_OVERPASS_GUIDE.md               Overpass 抓取说明与查询模板
docs/04_SCORING_MODEL.md                综合评分模型说明
docs/05_FEATURES_TO_REQUIREMENTS.md     课程要求对应表
docs/06_ACCEPTANCE_CHECKLIST.md         验收清单
docs/07_REPORT_OUTLINE.md               课设报告大纲
data/score-config.json                  用户画像权重配置
data/demo-candidate-points.geojson      示例候选居住点
scripts/fetch-overpass-nanning.mjs      可选：Node.js 抓取南宁 OSM 数据脚本
```

## 给你的操作方式

最省事方式：

1. 把整个文件夹扔进新项目根目录。
2. 打开 `prompts/CODEX_MASTER_PROMPT.md`。
3. 把里面的内容复制给 Codex。
4. 让 Codex 先生成项目目录和 MVP。
5. 再让 Codex 逐步完成验收清单。

## 开发策略

先做 MVP，不要一开始追求大而全。

第一阶段只要求：

- 地图能显示南宁
- 至少 3 个底图
- 点击地图能调用 Open-Meteo 天气和空气质量 API
- 右侧面板显示指标
- 能按用户画像生成综合评分和解释

第二阶段再加：

- POI 图层
- 道路/噪音风险模型
- 绘制、测量、查询、热力图、截图导出

第三阶段再包装成：

- AI 城市微环境评估平台
- 支持敏感体质/睡眠浅/普通宜居等场景
- 演示视频和课设报告

## 当前已实现：阶段 1 MVP

本仓库现在已经补齐 Vue 3 + Vite + OpenLayers 的第一阶段可运行版本：

- 地图默认定位南宁市中心，经纬度 `108.3669, 22.8170`。
- 支持 OSM 标准、高德标准、Esri 影像 3 种底图切换；高德底图使用 GCJ-02 显示校正，避免标点偏移。
- 页面采用三栏结构：左侧画像和底图，中间地图，右侧环境评估结果。
- 点击地图会请求 Open-Meteo 天气 API 和空气质量 API。
- 右侧显示温度、湿度、风速、PM2.5、PM10、AQI、UV、噪音风险。
- 从 `public/data/score-config.json` 读取 4 类用户画像权重。
- 使用规则式评分模型生成综合适宜度和自然语言解释。
- Open-Meteo 请求失败时会降级到本地示例环境数据，页面不会崩溃。

## 本地运行

```bash
npm install
npm run dev
npm run build
```

开发服务器启动后，浏览器访问终端提示的本地地址，例如：

```text
http://127.0.0.1:5173/
```

## 第一阶段边界

当前阶段只保证核心演示链路跑通：地图、底图切换、点击评估、评分、解释。POI 图层、道路图层、绘制、测量、查询、热力图、截图导出等课程工具留到第二阶段继续补齐。
