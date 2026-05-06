# 03 Overpass 抓取说明与查询模板

## 目标

抓取南宁市的 OSM 数据，导出为 GeoJSON，供前端静态加载。

## 推荐方式 A：让 Codex 运行脚本

本启动包提供：

```text
scripts/fetch-overpass-nanning.mjs
```

使用方式：

```bash
node scripts/fetch-overpass-nanning.mjs
```

成功后生成：

```text
public/data/nanning_poi.geojson
public/data/nanning_roads.geojson
```

如果项目还没建立，Codex 应该把输出路径调整到当前项目的 `public/data/` 目录。

## 推荐方式 B：手动 Overpass Turbo

网址：

```text
https://overpass-turbo.eu/
```

操作：

1. 打开 Overpass Turbo。
2. 把下面查询复制进去。
3. 点击 Run。
4. 点击 Export。
5. 选择 GeoJSON。
6. 保存为对应文件。

## 南宁近似 bbox

```text
south=22.55
west=107.85
north=23.15
east=109.05
```

也就是：

```text
(22.55,107.85,23.15,109.05)
```

## POI 查询模板

```ql
[out:json][timeout:60];
(
  node["amenity"~"hospital|clinic|pharmacy|school|university|restaurant|fast_food|bar|pub|cafe|cinema"](22.55,107.85,23.15,109.05);
  way["amenity"~"hospital|clinic|pharmacy|school|university|restaurant|fast_food|bar|pub|cafe|cinema"](22.55,107.85,23.15,109.05);
  relation["amenity"~"hospital|clinic|pharmacy|school|university|restaurant|fast_food|bar|pub|cafe|cinema"](22.55,107.85,23.15,109.05);

  node["leisure"~"park|garden|sports_centre|fitness_centre"](22.55,107.85,23.15,109.05);
  way["leisure"~"park|garden|sports_centre|fitness_centre"](22.55,107.85,23.15,109.05);
  relation["leisure"~"park|garden|sports_centre|fitness_centre"](22.55,107.85,23.15,109.05);

  node["shop"~"mall|supermarket|convenience"](22.55,107.85,23.15,109.05);
  way["shop"~"mall|supermarket|convenience"](22.55,107.85,23.15,109.05);
  relation["shop"~"mall|supermarket|convenience"](22.55,107.85,23.15,109.05);

  node["tourism"~"hotel|hostel|guest_house"](22.55,107.85,23.15,109.05);
  way["tourism"~"hotel|hostel|guest_house"](22.55,107.85,23.15,109.05);
  relation["tourism"~"hotel|hostel|guest_house"](22.55,107.85,23.15,109.05);
);
out center tags;
```

## 道路查询模板

```ql
[out:json][timeout:60];
(
  way["highway"~"motorway|trunk|primary|secondary|tertiary"](22.55,107.85,23.15,109.05);
  way["railway"~"rail|subway|light_rail"](22.55,107.85,23.15,109.05);
);
out geom tags;
```

## 注意

- Overpass 公共服务不适合高频请求。
- 开发阶段抓一次，保存为静态 GeoJSON。
- 前端不要每次加载页面都实时请求 Overpass。
- 如果数据量太大，可以缩小 bbox 到学校/主城区附近。
- 如果 KTV 标签抓不到，不要纠结，用 bar、pub、restaurant、fast_food、cafe、cinema 等作为夜间活跃 POI 近似替代。
