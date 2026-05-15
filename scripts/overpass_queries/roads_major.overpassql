[out:json][timeout:60];
(
  way["highway"~"motorway|trunk|primary|secondary"]({{bbox}});
  way["railway"~"rail|subway|light_rail"]({{bbox}});
);
out body;
>;
out skel qt;
