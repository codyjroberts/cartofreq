initMap();

function initMap() {
  let smap         = L.map('map').setView([42.009105, -87.667902], 18),
    markerWidth    = 250,
    markerHeight   = 250,
    chicagoCoords  = [42, -87],
    myIcon         = L.divIcon({className: 'svg-marker', html: '<svg id="sensor"></svg>', iconSize: [markerWidth, markerHeight]}),
    marker         = L.marker(chicagoCoords, {icon: myIcon}).addTo(smap),
    maxZoomLevel   = 18,
    radius         = (Math.min(markerWidth, markerHeight) / 2) - 10,
    x              = d3.scaleLinear().range([0, 2 * Math.PI]),
    y              = d3.scaleSqrt().range([0, radius]),
    color          = d3.scaleOrdinal(d3.schemeCategory10),
    maxDbm         = 115,
    formatNumber   = d3.format(",d"),
    partition      = d3.partition(),
    websocketURI   = 'ws://localhost:8080',
    socket         = io.connect(websocketURI),
    signalsTracked = 1,
    panOffset      = 0.0005,
    sensorNames    = [],
    markerSvg      = d3.select("#sensor")
                       .attr("width", markerWidth)
                       .attr("height", markerHeight)
                       .append("g")
                       .attr("transform", "translate(" + markerWidth / 2 + "," + (markerHeight / 2) + ")");

  // Defines dynamic arc based on signalsTracked and zoom level
  function arc() {
    let innerRadius = 2,
        outerRadius = d => {
          return Math.min(Math.max(2 * (d.value + maxDbm), 0), 100) * (smap.getZoom() / maxZoomLevel);
        };

    return d3.arc()
      .startAngle(  (d, i) => { return (2 * Math.PI / signalsTracked) * i; })
      .endAngle(    (d, i) => { return (2 * Math.PI / signalsTracked) * i + (2 * Math.PI / signalsTracked); })
      .innerRadius(      d => { return sensorNames.includes(d.data.name) ? 0 : innerRadius; })
      .outerRadius(      d => { return sensorNames.includes(d.data.name) ? 0 : outerRadius(d); })
      .cornerRadius(5)
      .padAngle(.35);
  }

  function updateMarker(data) {
    // Add sensor name if new
    if (!sensorNames.includes(data.name)) sensorNames.push(data.name);

    // Set # tracked signals
    signalsTracked = data.children.length;

    // Pan map (for offset) & move marker
    marker.setLatLng([parseFloat(data.lat), parseFloat(data.lng)]);
    smap.panTo([parseFloat(data.lat) - panOffset, parseFloat(data.lng)]);

    // Parse data in heirarchy structure for d3 sunburst
    root = d3.hierarchy(data);
    root.sum(d => { return d.size; });

    // JOIN new data with old
    let sensor = markerSvg.selectAll("path")
      .data(partition(root).descendants(), d => { return d; });

    // EXIT old data
    sensor.exit().remove();

    // ENTER & UPDATE
    sensor.enter().append("path")
      .merge(sensor)
      .attr("class", "sensor-marker")
      .attr("d", arc())
      .style("fill", d => { return color(d.data.name); })
      .append("title")
      .text(d => { return d.data.name + "\n" + formatNumber(d.value); });
  }

  // Configuration
  let configIcon = L.Control.extend({
    options: {
      position: 'topright'
    },

    onAdd: function (map) {
      var container = L.DomUtil.get("config");

      function onClick(e) {
        let h = document.getElementById('settings');
        (h.style.visibility === 'hidden') ? h.style.visibility = 'visible' : h.style.visibility = 'hidden';
      }

      L.DomEvent.addListener(container, 'click', onClick);

      return container;
    }
  });

  let configBox = L.Control.extend({
    options: {
      position: 'bottomleft'
    },

    onAdd: function (map) {
      var container = L.DomUtil.get("settings");
      return container;
    }
  });

  let cIcon = new configIcon();
  let cBox = new configBox();

  smap.addControl(cIcon);
  smap.addControl(cBox);

  // Set TileLayer to B/W
  L.tileLayer('http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
    maxZoom: maxZoomLevel,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(smap);

  ////////////////
  //   Events   //
  ////////////////
  socket.on('t', data => {
    if (data != null) updateMarker(data);
 });
}
