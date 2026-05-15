/* 绿城生态文化相关点：广场、公园、景观、博物馆等。不是旅游推荐，只作为城市生态文化点。 */
[out:json][timeout:60];
(
  node["tourism"~"museum|attraction"]({{bbox}});
  way["tourism"~"museum|attraction"]({{bbox}});
  node["leisure"~"park|garden"]({{bbox}});
  way["leisure"~"park|garden"]({{bbox}});
  node["amenity"~"community_centre|theatre|arts_centre"]({{bbox}});
  way["amenity"~"community_centre|theatre|arts_centre"]({{bbox}});
);
out center tags geom;
