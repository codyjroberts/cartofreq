initMap();

function initMap() {
  let smap         = L.map('map').setView([41.8781, -87.6298], 18),
    markerWidth    = 250,
    markerHeight   = 250,
    chicagoCoords  = [42, -87],
    myIcon         = L.divIcon({className: 'svg-marker', html: '<svg id="sensor"></svg>', iconSize: [markerWidth, markerHeight]}),
    marker         = L.marker(chicagoCoords, {icon: myIcon}).addTo(smap),
    maxZoomLevel   = 18,
    radius         = (Math.min(markerWidth, markerHeight) / 2) - 10,
    x              = d3.scaleLinear().range([0, 2 * Math.PI]),
    y              = d3.scaleSqrt().range([0, radius]),
    color          = d3.scaleOrdinal().range(["#FF2D00","#2E0927", "#FF8C00", "#04756F", "#D90000", "#FF6138", "#FFFF9D", "#BEEB9F", "#798D8F", "#00A388"]),
    maxDbm         = 115,
    cornerRadius   = 5,
    padAngle       = .15,
    formatNumber   = d3.format(",d"),
    partition      = d3.partition(),
    websocketURI   = 'ws://localhost:8088',
    socket         = io.connect(websocketURI),
    signalsTracked = 1,
    panOffset      = 0.0005,
    historyMarkers = [],
    sensorNames    = [],
    paused         = false,
    recording      = false,
    live           = true,
    stream         = 0,
    locked         = true,
    markerSvg      = d3.select("#sensor")
                       .attr("width", markerWidth)
                       .attr("height", markerHeight)
                       .append("g")
                       .attr("transform", "translate(" + markerWidth / 2 + "," + (markerHeight / 2) + ")");


  /////////////////////
  //      Sensor     //
  /////////////////////

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
      .cornerRadius(cornerRadius)
      .padAngle(padAngle);
  }

  function updateMarker(data) {
    // Add sensor name if new
    if (!sensorNames.includes(data.name)) sensorNames.push(data.name);

    addCircleMarker(data);

    // Set # tracked signals
    signalsTracked = data.children.length;

    // move marker
    marker.setLatLng([parseFloat(data.lat), parseFloat(data.lng)]);

    // pan map unless unlocked
    if (locked) smap.panTo([parseFloat(data.lat) - panOffset, parseFloat(data.lng)]);

    // Parse data in heirarchy structure for d3 sunburst
    let root = d3.hierarchy(data);
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

  function addCircleMarker(data) {
    let coords = [parseFloat(data.lat), parseFloat(data.lng)];

    let colorSignal = d3.scaleLinear().domain([0, 100]).range(["#F00","#0F0"]);

    let temp = 0;
    let signalStrength = data.children.forEach(i => {
      temp += Math.min(Math.max(2 * (parseFloat(i.size) + maxDbm), 0), 100);
    });

    temp = temp / data.children.length;

    let mark = L.circleMarker(coords, {
        radius: 5,
        fillColor: colorSignal(temp),
        color: "#000",
        weight: 0,
        opacity: 1,
        fillOpacity: 0.5
    });

    let tooltip = data.children.map(i => `${i.name}: ${i.size}`).join('<br>');

    mark.bindTooltip(tooltip).openTooltip();
    historyMarkers.push(mark);
    mark.addTo(smap);
    if (historyMarkers.length > 30) {
      let oldMark = historyMarkers.shift();
      smap.removeLayer(oldMark);
    }
  }

  L.tileLayer('http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
    maxZoom: maxZoomLevel,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(smap);

  /////////////////////
  //   StreamGraph   //
  /////////////////////

  let queue     = [],
    height      = 150,
    yScale      = 500,
    history     = 20,
    xStream     = d3.scaleLinear().domain([0, (history - 1)]).range([0, window.innerWidth]),
    yStream     = d3.scaleLinear().domain([0, yScale]).range([0, height]),
    streamGraph = d3.select("#stream").append("svg"),
    area        = d3.area()
                       .curve(d3.curveCatmullRom.alpha(0.5))
                       .x((d, i) => { return xStream(i); })
                       .y0((d) => { return yStream(yScale - d[1]); })
                       .y1((d) => { return yStream(yScale); });

  let legend = d3.select("#legend")

  legend.append("g")
    .attr("class", "legendOrdinal")
    .attr("transform", "translate(20,20)");

  function resize() {
    xStream = d3.scaleLinear().domain([0, (history - 1)]).range([0, window.innerWidth]);
  }

  window.onresize = resize;

  function updateStreamGraph(data) {
    let keys = data.map(i => { return i.name });

    let legendOrdinal = d3.legendColor()
      .shape("path", d3.symbol().type(d3.symbolCircle).size(150)())
      .shapePadding(5)
      .scale(color.domain(keys));

    legend.select(".legendOrdinal")
      .call(legendOrdinal);

    data = data.reduce((acc, x) => {
      acc[x.name] = Math.floor(Math.min(Math.max(2 * (parseFloat(x.size) + 115), 0), 100));
      return acc;
    }, {});

    if (queue.length < history) {
      queue.push(data);
      return;
    } else {
      queue.shift();
      queue.push(data);
    }

    let stack = d3.stack()
      .keys(keys)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    let newSeries = stack(queue).reverse();

    streamGraph.selectAll("path")
      .data(newSeries)
      .enter().append("path")
      .attr("d", area);

    streamGraph.selectAll("path")
      .data(newSeries)
      .transition().attr("d", area).duration(100)
      .style("fill", d => { return color(d.key); });
  }

  ////////////////
  //   Events   //
  ////////////////
  socket.on('t', data => {
    if (data != null && !paused && live) {
      updateMarker(data);
      updateStreamGraph(data.children);
    }
  });

  socket.on('update_recordings', data => {
    console.log(data["recordings"]);
    updateRecordingList(data["recordings"]);
  });

  function updateRecordingList(data) {
    let select = document.getElementById("data-source");

    select.innerHTML = '';

    let live = document.createElement('option');
    live.text = "live";
    select.add(live);

    let campus3 = document.createElement('option');
    campus3.text = "campus3.json";
    select.add(campus3);

    data.forEach(r => {
      let option = document.createElement('option');
      option.text = r["name"];
      select.add(option);
    })
  }

  document.getElementById("data-source").onchange = function() {
    clearInterval(stream);
    if (this.value == "live") {
      live = true;
    } else if (this.value.indexOf(".json") != -1) {
      live = false;
      startStream(this.value);
    } else {
      socket.emit('playback', this.value);
    }
  };

  function startStream(filename) {
    fetch(filename).then(function(response) {
      let contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") != -1) {
        return response.json().then(data => {
          let i = 0;
          stream = setInterval(() => {
            if (!paused) {
              updateMarker(data[i]);
              updateStreamGraph(data[i].children);
              console.log(data[i].children);
              i += 1;
            }
            if (i == data.length)
              clearInterval(stream);
          }, 100);
        });
      } else {
        console.log("Oops, we haven't got JSON!");
      }
    });
  }

  ////////////////////
  //   Map Config   //
  ////////////////////
  //let configIcon = L.Control.extend({
  //  options: {
  //    position: 'topright'
  //  },

  //  onAdd: (map) => {
  //    let container = L.DomUtil.get("config");

  //    function onClick(e) {
  //      let settings = document.getElementById('settings');
  //      let stream = document.getElementById('stream');

  //      if (settings.style.display === 'none') {
  //        settings.style.display = 'block';
  //        stream.style.display = 'none';
  //      } else {
  //        settings.style.display = 'none';
  //        stream.style.display = 'block';
  //      }
  //    }

  //    L.DomEvent.addListener(container, 'click', onClick);

  //    return container;
  //  }
  //});

  //let configBox = L.Control.extend({
  //  options: {
  //    position: 'bottomleft'
  //  },

  //  onAdd: (map) => {
  //    let container = L.DomUtil.get("settings");
  //    container.style.display = 'none';
  //    return container;
  //  }
  //});

  let streamGraphControl = L.Control.extend({
    options: {
      position: 'bottomleft'
    },

    onAdd: (map) => {
      let container = L.DomUtil.get("stream");
      return container;
    }
  });

  let pauseButton = L.Control.extend({
    options: {
      position: 'topright'
    },

    onAdd: (map) => {
      let container = L.DomUtil.get('pause');

      container.style.width = '30px';
      container.style.height = '30px';

      L.DomEvent.addListener(container, 'click', e => {
        if (paused) {
          paused = false;
          container.innerHTML = "<i class='material-icons'>pause</i>"
        } else {
          paused = true;
          container.innerHTML = "<i class='material-icons'>play_arrow</i>"
        }
      });

      return container;
    }
  });

  let lockButton = L.Control.extend({
    options: {
      position: 'topright'
    },

    onAdd: (map) => {
      let container = L.DomUtil.get('locked');

      container.style.width = '30px';
      container.style.height = '30px';

      L.DomEvent.addListener(container, 'click', e => {
        if (locked) {
          locked = false;
          container.innerHTML = "<i class='material-icons'>lock_outline</i>"
        } else {
          locked = true;
          container.innerHTML = "<i class='material-icons'>lock_open</i>"
        }
      });

      return container;
    }
  });

  let legendButton = L.Control.extend({
    options: {
      position: 'topright'
    },

    onAdd: (map) => {
      let container = L.DomUtil.get('legend-icon');

      container.style.width = '30px';
      container.style.height = '30px';

      L.DomEvent.addListener(container, 'click', e => {
        let legend = document.getElementById('legend');

        if (legend.style.display === 'none') {
          legend.style.display = 'block';
        } else {
          legend.style.display = 'none';
        }
      });

      return container;
    }
  });

  let legendCtrl = L.Control.extend({
    options: {
      position: 'bottomleft'
    },

    onAdd: (map) => {
      let container = L.DomUtil.get('legend');

      container.style.width = '150px';
      container.style.height = '125px';
      return container;
    }
  });

  let recordButton = L.Control.extend({
    options: {
      position: 'topright'
    },

    onAdd: (map) => {
      let container = L.DomUtil.get('record');

      container.style.width = '30px';
      container.style.height = '30px';

      L.DomEvent.addListener(container, 'click', e => {
        if (recording) {
          socket.emit('stop');
          recording = false;
          container.innerHTML = "<i class='material-icons' style='color:black'>fiber_manual_record</i>"
        } else {
          socket.emit('record');
          recording = true;
          container.innerHTML = "<i class='material-icons' style='color:red'>fiber_manual_record</i>"
        }
      });

      return container;
    }
  });

  let dataSource = L.Control.extend({
    options: {
      position: 'bottomleft'
    },

    onAdd: (map) => {
      let container = L.DomUtil.get('source');

      container.style.width = '150px';
      container.style.height = '30px';
      return container;
    }
  });

  //let cIcon = new configIcon();
  //let cBox = new configBox();
  let cStream = new streamGraphControl();
  let cPause = new pauseButton();
  let cLock = new lockButton();
  let cLegend = new legendCtrl();
  let cLegendButton = new legendButton();
  let cRecordButton = new recordButton();
  let cDataSource = new dataSource();

  //smap.addControl(cIcon);
  //smap.addControl(cBox);
  smap.addControl(cStream);
  smap.addControl(cPause);
  smap.addControl(cLock);
  smap.addControl(cLegend);
  smap.addControl(cLegendButton);
  smap.addControl(cRecordButton);
  smap.addControl(cDataSource);
}
