[out:json][timeout:60];
(
  node["amenity"~"bar|pub|nightclub|restaurant|fast_food|food_court|marketplace"]({{bbox}});
  way["amenity"~"bar|pub|nightclub|restaurant|fast_food|food_court|marketplace"]({{bbox}});
  node["shop"~"convenience|mall|supermarket"]({{bbox}});
  way["shop"~"convenience|mall|supermarket"]({{bbox}});
  node["leisure"~"stadium|sports_centre"]({{bbox}});
  way["leisure"~"stadium|sports_centre"]({{bbox}});
  node["tourism"="hotel"]({{bbox}});
  way["tourism"="hotel"]({{bbox}});
);
out body;
>;
out skel qt;
