[out:json][timeout:60];
(
  node["amenity"~"hospital|clinic|doctors|pharmacy"]({{bbox}});
  way["amenity"~"hospital|clinic|doctors|pharmacy"]({{bbox}});
  relation["amenity"~"hospital|clinic|doctors|pharmacy"]({{bbox}});
  node["healthcare"]({{bbox}});
  way["healthcare"]({{bbox}});
  relation["healthcare"]({{bbox}});
);
out body;
>;
out skel qt;
