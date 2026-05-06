# 给 Codex 的完整启动提示词

请你作为资深前端工程师和 WebGIS 工程师，基于当前项目文件夹中的 README、AGENTS.md、.codex/SKILL.md 和 docs 目录，帮我实现一个课程项目：

> 基于 OpenLayers 的南宁城市健康宜居环境评估 WebGIS 系统

## 一、项目目标

实现一个纯前端 WebGIS 应用，最终可以部署到 GitHub Pages，不使用后端、不使用数据库、不使用真实 LLM API、不写死任何私密 API Key。

用户可以在南宁地图上点击任意位置，系统会调用 Open-Meteo 获取天气和空气质量数据，并结合本地 OSM/POI/道路 GeoJSON、夜间噪音风险模型和用户画像，输出该位置的健康宜居评分与解释。

## 二、技术栈

优先使用：

- Vue 3
- Vite
- OpenLayers 8.x 或 10.x
- Turf.js
- ECharts
- html2canvas

## 三、核心页面结构

三栏布局：

1. 左侧面板：
   - 用户画像选择
   - 图层开关
   - 透明度调节
   - 绘制/测量/查询工具

2. 中间：
   - OpenLayers 地图
   - 定位南宁市
   - 至少 3 种底图切换
   - POI、道路、热力图、综合评分等图层

3. 右侧面板：
   - 当前点击点坐标
   - 天气指标
   - 空气质量指标
   - 紫外线风险
   - 夜间噪音风险
   - 综合评分
   - 规则式 AI 解释
   - 未来 24 小时趋势图

## 四、必须实现的课程功能

请尽可能完整实现：

1. 多源地图加载，至少 3 种底图。
2. 基本地图控制：缩放、平移、复位、全屏。
3. 图层管理：显示/隐藏、透明度调整。
4. 比例尺、鼠标坐标显示、鹰眼图。
5. 绘制工具：点、线、面、圆、矩形。
6. 要素编辑与删除。
7. 测距、测面积。
8. 地图标注与信息弹窗。
9. 地图截图/导出。
10. 空间查询：点选、框选、圆选。
11. 属性查询：按评分、AQI、噪音风险筛选。
12. 空间分析：缓冲区分析、范围统计、POI 密度统计。
13. 热力图：综合评分或噪音风险热力图。
14. 动态数据可视化：未来 24 小时温湿度/AQI 趋势图。

## 五、API

### Open-Meteo Weather API

南宁测试坐标：

```text
latitude=22.8170
longitude=108.3669
```

示例：

```text
https://api.open-meteo.com/v1/forecast?latitude=22.8170&longitude=108.3669&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=Asia%2FShanghai
```

### Open-Meteo Air Quality API

示例：

```text
https://air-quality-api.open-meteo.com/v1/air-quality?latitude=22.8170&longitude=108.3669&hourly=pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,uv_index,us_aqi&current=pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,uv_index,us_aqi&timezone=Asia%2FShanghai
```

## 六、数据文件

请从 public/data 加载：

```text
score-config.json
demo-candidate-points.geojson
nanning_poi.geojson       如果不存在，请用 demo 数据降级
nanning_roads.geojson     如果不存在，请用 demo 数据降级
```

如果没有 nanning_poi.geojson 和 nanning_roads.geojson，可以先用 demo-candidate-points.geojson 和内置模拟数据跑通功能。

## 七、评分模型

读取 score-config.json。

用户画像：

- respiratory：呼吸道敏感
- skin：皮肤敏感
- sleep：睡眠浅怕吵
- general：普通宜居

各指标归一化到 0-100：

- airQuality
- humidityComfort
- uvSafety
- noiseComfort
- greenSpace
- medical
- lifeConvenience
- roadDistance
- nightPoiDensity

综合评分：

```text
score = Σ normalizedMetric * profileWeight
```

## 八、夜间噪音风险模型

不要依赖真实噪音 API。

根据以下因素估算：

- 距主干道越近，噪音风险越高。
- 距铁路/高架越近，风险越高。
- 周边 500m 内酒吧、KTV、餐饮、夜宵类 POI 越多，夜间噪音风险越高。
- 距公园、校园、住宅内部越近，安静程度加分。
- 如果没有道路数据，使用 demo 数据和用户点击点周围 POI 密度估算。

输出：

- noiseRisk：0-100，越高越吵
- noiseComfort：100 - noiseRisk

## 九、规则式 AI 解释

不要调用真实 LLM。

根据评分和指标生成自然语言解释，例如：

```text
该位置对“皮肤敏感”用户的适宜度为 76 分。
优势：空气质量较好，紫外线风险处于中等水平，附近有医疗设施。
风险：湿度偏高，夏季可能有闷热潮湿感；距离主干道较近，夜间可能存在一定噪音。
建议：可以作为候选区域，但建议优先选择不临街、通风较好的楼栋。
```

## 十、实现顺序

请按阶段实现，并确保每个阶段都能运行：

### 阶段 1：MVP

- 初始化 Vue + Vite 项目
- OpenLayers 显示南宁地图
- 三底图切换
- 点击地图调用 Open-Meteo
- 右侧面板显示当前指标
- 根据画像输出评分和解释

### 阶段 2：GIS 课程功能

- 图层管理
- POI 图层
- 道路图层
- 绘制、编辑、删除
- 测距、测面积
- 空间查询
- 属性查询
- 热力图
- 截图导出
- 鹰眼、比例尺、鼠标坐标

### 阶段 3：参赛包装

- 美化 UI
- 趋势图
- 候选居住点对比
- README 和项目说明
- 报告素材

## 十一、不要做

- 不要做登录注册。
- 不要做真实租房平台爬虫。
- 不要做犯罪率。
- 不要做交通事故数据。
- 不要做后端数据库。
- 不要在前端写任何需要保密的 Key。
- 不要让项目依赖无法稳定访问的数据才能运行。

## 十二、交付结果

请最终保证：

- `npm install` 成功
- `npm run dev` 成功
- `npm run build` 成功
- 页面可以用
- README 写清楚使用方法
- 功能覆盖课程要求
- 代码结构清晰
