# 02 API 与数据方案

## 一、实时 API

### 1. Open-Meteo Weather API

用途：

- 温度
- 相对湿度
- 风速
- 未来 24 小时天气趋势

特点：

- 不需要 API Key。
- 可以直接在前端 fetch。
- 适合 GitHub Pages 静态部署。

南宁测试坐标：

```text
latitude=22.8170
longitude=108.3669
```

示例 URL：

```text
https://api.open-meteo.com/v1/forecast?latitude=22.8170&longitude=108.3669&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=Asia%2FShanghai
```

### 2. Open-Meteo Air Quality API

用途：

- PM2.5
- PM10
- NO2
- O3
- SO2
- CO
- UV
- AQI
- 未来 24 小时空气质量趋势

示例 URL：

```text
https://air-quality-api.open-meteo.com/v1/air-quality?latitude=22.8170&longitude=108.3669&hourly=pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,uv_index,us_aqi&current=pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,uv_index,us_aqi&timezone=Asia%2FShanghai
```

## 二、静态数据

### 1. score-config.json

用户画像权重配置。

路径：

```text
public/data/score-config.json
```

### 2. demo-candidate-points.geojson

示例候选居住点，保证没有 Overpass 数据时项目仍可演示。

路径：

```text
public/data/demo-candidate-points.geojson
```

### 3. nanning_poi.geojson

建议由 Overpass API 抓取后保存。

包含：

- 医院
- 药店
- 公园
- 学校
- 大学
- 餐饮
- 酒吧
- 商场
- 公交/地铁点，若有

路径：

```text
public/data/nanning_poi.geojson
```

### 4. nanning_roads.geojson

建议由 Overpass API 抓取后保存。

包含：

- motorway
- trunk
- primary
- secondary
- tertiary
- railway

路径：

```text
public/data/nanning_roads.geojson
```

## 三、噪音数据策略

不要依赖真实噪音 API。

采用模型估算：

```text
夜间噪音风险 =
主干道距离风险
+ 铁路距离风险
+ 夜间娱乐 POI 密度风险
+ 餐饮/商圈密度风险
- 公园/校园安静加分
```

## 四、降级策略

如果外部 API 失败：

- 显示错误提示。
- 使用最近一次结果缓存，若有。
- 使用 demo 默认值。
- 不让页面崩溃。

如果 nanning_poi.geojson 缺失：

- 加载 demo-candidate-points.geojson。
- 显示“当前使用示例数据”。

如果 nanning_roads.geojson 缺失：

- 噪音风险只使用 POI 密度和默认道路假设。
