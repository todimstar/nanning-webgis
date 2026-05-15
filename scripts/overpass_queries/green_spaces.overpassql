[out:json][timeout:60];
(
  node["leisure"~"park|garden|nature_reserve"]({{bbox}});
  way["leisure"~"park|garden|nature_reserve"]({{bbox}});
  relation["leisure"~"park|garden|nature_reserve"]({{bbox}});
  way["landuse"~"grass|forest|recreation_ground|meadow"]({{bbox}});
  relation["landuse"~"grass|forest|recreation_ground|meadow"]({{bbox}});
  way["natural"~"wood|water|wetland"]({{bbox}});
  relation["natural"~"wood|water|wetland"]({{bbox}});
  way["waterway"~"river|stream|canal"]({{bbox}});
);
out body;
>;
out skel qt;
