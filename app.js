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
    color          = d3.scaleOrdinal().range(["#FF2D00","#2E0927", "#FF8C00", "#04756F", "#D90000"]),
    colorSignal    = d3.scaleLinear().domain([0, 100]).range(["#F00","#0F0"]),
    maxDbm         = 115,
    formatNumber   = d3.format(",d"),
    partition      = d3.partition(),
    websocketURI   = 'ws://localhost:8080',
    socket         = io.connect(websocketURI),
    signalsTracked = 1,
    panOffset      = 0.0005,
    historyMarkers = [],
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

  function addCircleMarker(coords, signalStrength) {
    let mark = L.circleMarker(coords, {
        radius: 5,
        fillColor: colorSignal(signalStrength),
        color: "#000",
        weight: 0,
        opacity: 1,
        fillOpacity: 0.5
    });

    historyMarkers.push(mark);
    mark.addTo(smap);
    if (historyMarkers.length > 20) {
      let oldMark = historyMarkers.shift();
      smap.removeLayer(oldMark);
    }
  }

  function updateMarker(data) {
    // Add sensor name if new
    if (!sensorNames.includes(data.name)) sensorNames.push(data.name);

    let temp = 0;
    let signalStrength = data.children.forEach(i => {
      temp += Math.min(Math.max(2 * (parseFloat(i.size) + maxDbm), 0), 100);
    });
    temp = temp / data.children.length;
    addCircleMarker([parseFloat(data.lat), parseFloat(data.lng)], temp);

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
      let container = L.DomUtil.get("config");

      function onClick(e) {
        let h = document.getElementById('settings');
        let s = document.getElementById('stream');
        if (h.style.display === 'none') {
          h.style.display = 'block';
          s.style.display = 'none';
        } else {
          h.style.display = 'none';
          s.style.display = 'block';
        }
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
      let container = L.DomUtil.get("settings");
      return container;
    }
  });

  let streamGraph = L.Control.extend({
    options: {
      position: 'bottomleft'
    },

    onAdd: function (map) {
      let container = L.DomUtil.get("stream");
      return container;
    }
  });

  let cIcon = new configIcon();
  let cBox = new configBox();
  let streamOverlay = new streamGraph();

  smap.addControl(cIcon);
  smap.addControl(cBox);
  smap.addControl(streamOverlay);

  // Set TileLayer to B/W
  L.tileLayer('http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
    maxZoom: maxZoomLevel,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(smap);

  let queue = [];					// value array, initially set to zero

  //TODO: Fix keys
  let stack = d3.stack()
    .keys(["RF2449.188MHZ","RF2401.938MHZ","RF101.719MHZ","RF105MHZ","RF93.625MHZ"])
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  let series = stack(queue);
  series.reverse();		// reverse for layering purposes

  let width = 1650,
    height = 150,
    yScale = 2500,		// available for easy adjusting
    history = 10;		// number of entries in graph at once
  // (if adjusting, also need to change d3.area)
  let xStream = d3.scaleLinear()
    .domain([0, (history - 1)])
    .range([0, width]);

  let yStream = d3.scaleLinear()
    .domain([0, yScale])		// adjustable
    .range([0, height]);

  let area = d3.area()
    .curve(d3.curveCatmullRom.alpha(0.5))
    .x(function(d, i) { return (i*(window.innerWidth + 150) / 10); })	 // TODO: Fix width, 10 entries (history not accessible here)
    .y0(function(d) { return yStream(yScale/2 - d[1]); })
    .y1(function(d) { return yStream(yScale/2 + d[1]); });

  let svg = d3.select("#stream").append("svg").attr("width", "100vw").attr("height", height);

  svg.selectAll("path")
    .data(series)
    .enter().append("path")
    .attr("d", area);

  function updateStreamGraph(data) {
    let keys = data.map(i => { return i.name });

    data = data.reduce((acc, x) => {
      acc[x.name] = Math.floor(Math.min(Math.max(2 * (parseFloat(x.size) + 115), 0), 100));
      return acc;
    }, {});

    if (queue.length < 10) {
      queue.push(data);
      return;
    } else {
      queue.shift();
      queue.push(data);
    }

    let newSeries = stack(queue);
    newSeries.reverse();

    svg.selectAll("path")
      .data(newSeries)
      .transition().attr("d", area).duration(250)
      .style("fill", d => { return color(d.key); });
  }

  ////////////////
  //   Events   //
  ////////////////
  socket.on('t', data => {
    if (data != null) {
      updateMarker(data);
      updateStreamGraph(data.children);
    }
  });
}
