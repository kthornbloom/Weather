(function () {
  'use strict';

  var DEFAULT_LAT = 41.0793;
  var DEFAULT_LON = -85.1394;
  var DEFAULT_METRIC = 'temperature_2m';

  /** Resolved location (also used for Rain Viewer radar tiles). */
  var userLat = DEFAULT_LAT;
  var userLon = DEFAULT_LON;

  /** Initial Leaflet zoom for radar (Rain Viewer tiles support native z 0–7). */
  var RADAR_MAP_ZOOM = 6;
  var RAINVIEWER_MAPS = 'https://api.rainviewer.com/public/weather-maps.json';

  var radarLeafletMap = null;
  var radarOverlayLayer = null;
  var radarLocationMarker = null;

  /**
   * Open-Meteo hourly keys — order: common use first. Simple labels in the picker.
   * yAxisMin0: no negative axis (precip, wind amounts, etc.). yAxisMax100: % scales 0–100.
   */
  var HOURLY_OPTIONS = [
    {
      key: 'temperature_2m',
      label: 'Temperature',
      unit: '°F',
      blurbTitle: 'Temperature',
      yAxisMin0: false,
      description:
        'Air temperature about 2 m above the ground—the number you usually compare to forecasts and TV weather.'
    },
    {
      key: 'apparent_temperature',
      label: 'Feels like',
      unit: '°F',
      blurbTitle: 'Feels like',
      yAxisMin0: false,
      description:
        'Temperature adjusted for wind and humidity (and sometimes sun). Can feel warmer or colder than the actual air temperature.'
    },
    {
      key: 'precipitation',
      label: 'Total precipitation',
      unit: 'in',
      blurbTitle: 'Total precipitation',
      yAxisMin0: true,
      description:
        'All water falling in that hour: rain + showers + snow, as inches of water (Open-Meteo). The main “how wet is it” line. Steady rain and showers split the liquid part; snow is separate.'
    },
    {
      key: 'precipitation_probability',
      label: 'Chance of precipitation',
      unit: '%',
      blurbTitle: 'Chance of precipitation',
      yAxisMin0: true,
      yAxisMax100: true,
      description:
        'How likely measurable precipitation is in that hour—not how much. Different from total precipitation, which is an amount.'
    },
    {
      key: 'rain',
      label: 'Steady rain',
      unit: 'in',
      blurbTitle: 'Steady rain',
      yAxisMin0: true,
      description:
        'Liquid rain from broad, layered clouds (often steadier). The model counts this separately from showers; both add to total precipitation along with snow.'
    },
    {
      key: 'showers',
      label: 'Showers',
      unit: 'in',
      blurbTitle: 'Showers',
      yAxisMin0: true,
      description:
        'Liquid from convective “cells”—often shorter, heavier bursts. Separate from steady rain in the model; both are part of liquid precipitation.'
    },
    {
      key: 'snowfall',
      label: 'Snow',
      unit: 'in',
      blurbTitle: 'Snow',
      yAxisMin0: true,
      description:
        'Snow depth per hour in inches. Total precipitation also includes rain and showers as water equivalent.'
    },
    {
      key: 'relative_humidity_2m',
      label: 'Humidity',
      unit: '%',
      blurbTitle: 'Humidity',
      yAxisMin0: true,
      yAxisMax100: true,
      description:
        'Water vapor as a percent of what the air could hold at this temperature. For “mugginess,” dew point is often easier to read than humidity alone.'
    },
    {
      key: 'dew_point_2m',
      label: 'Dew point',
      unit: '°F',
      blurbTitle: 'Dew point',
      yAxisMin0: false,
      description:
        'Temperature at which the air would be saturated. Higher dew point usually means more moisture in the air.'
    },
    {
      key: 'cloud_cover',
      label: 'Cloud cover',
      unit: '%',
      blurbTitle: 'Cloud cover',
      yAxisMin0: true,
      yAxisMax100: true,
      description:
        'How much of the sky is covered by cloud (0–100%). Does not by itself say if rain reaches the ground.'
    },
    {
      key: 'wind_speed_10m',
      label: 'Wind',
      unit: 'mph',
      blurbTitle: 'Wind',
      yAxisMin0: true,
      description:
        'Average wind speed about 10 m up, in mph—smoother than gusts. Typical sustained wind for the hour.'
    },
    {
      key: 'wind_gusts_10m',
      label: 'Gusts',
      unit: 'mph',
      blurbTitle: 'Gusts',
      yAxisMin0: true,
      description:
        'Short peaks during the hour in mph—often higher than average wind when it is gusty.'
    },
    {
      key: 'wind_direction_10m',
      label: 'Wind direction',
      unit: '°',
      blurbTitle: 'Wind direction',
      yAxisMin0: true,
      yAxisMax360: true,
      description:
        'Direction the wind comes from, in degrees (0° = north, 90° = east), at 10 m height.'
    },
    {
      key: 'visibility',
      label: 'Visibility',
      unit: 'ft',
      blurbTitle: 'Visibility',
      yAxisMin0: true,
      description:
        'How far you can see horizontally in feet (lower in fog, heavy rain, smoke, or haze). Values align with Open-Meteo when using US-style units.'
    },
    {
      key: 'pressure_msl',
      label: 'Sea-level pressure',
      unit: 'hPa',
      blurbTitle: 'Sea-level pressure',
      yAxisMin0: false,
      description:
        'Pressure adjusted to sea level so you can compare weather systems between cities at different elevations.'
    },
    {
      key: 'surface_pressure',
      label: 'Surface pressure',
      unit: 'hPa',
      blurbTitle: 'Surface pressure',
      yAxisMin0: false,
      description:
        'Pressure at ground level at your location—lower in the mountains than at the coast. Use sea-level pressure to compare highs and lows on a map.'
    }
  ];

  var COLOR_LINE = '#ffffff';
  var COLOR_NOW = '#ebde34';

  var hourlyParamString = HOURLY_OPTIONS.map(function (o) { return o.key; }).join(',');

  var placeEl = document.getElementById('placeLabel');
  var statusEl = document.getElementById('status');
  var canvas = document.getElementById('weatherChart');
  var metricPicker = document.getElementById('metricPicker');
  var metricToggle = document.getElementById('metricToggle');
  var metricCurrent = document.getElementById('metricCurrent');
  var metricPanel = document.getElementById('metricPanel');
  var metricList = document.getElementById('metricList');
  var chartScroll = document.getElementById('chartScroll');
  var chartScrollInner = document.getElementById('chartScrollInner');
  var yRail = document.getElementById('yRail');
  var yRailCap = document.getElementById('yRailCap');
  var periodDay = document.getElementById('periodDay');
  var periodWeek = document.getElementById('periodWeek');
  var periodRadar = document.getElementById('periodRadar');
  var chartViewPanel = document.getElementById('chartViewPanel');
  var radarViewPanel = document.getElementById('radarViewPanel');
  var radarMapEl = document.getElementById('radarMap');
  var dayNav = document.getElementById('dayNav');
  var dayPrev = document.getElementById('dayPrev');
  var dayNext = document.getElementById('dayNext');
  var dayLabel = document.getElementById('dayLabel');
  var metricBlurbTitle = document.getElementById('metricBlurbTitle');
  var metricBlurbDesc = document.getElementById('metricBlurbDesc');
  var rightNowEl = document.getElementById('rightNow');
  var alertBarEl = document.getElementById('alertBar');

  var chartInstance = null;
  /** Full API response slice */
  var fullTimesIso = [];
  var fullHourlyPayload = null;
  /** Visible window for tooltips / NOW line */
  var viewTimesIso = [];

  var viewMode = 'day';
  var uniqueDayKeys = [];
  var selectedDayIndex = 0;

  /** WMO Weather interpretation codes (Open-Meteo / ECMWF style) */
  function wmoCodeToPhrase(code) {
    var c = Math.round(Number(code));
    if (c === 0) return 'Clear sky';
    if (c === 1) return 'Mainly clear';
    if (c === 2) return 'Partly cloudy';
    if (c === 3) return 'Overcast';
    if (c === 45 || c === 48) return 'Fog';
    if (c >= 51 && c <= 55) return 'Drizzle';
    if (c === 56 || c === 57) return 'Freezing drizzle';
    if (c >= 61 && c <= 65) return 'Rain';
    if (c === 66 || c === 67) return 'Freezing rain';
    if (c >= 71 && c <= 75) return 'Snow';
    if (c === 77) return 'Snow grains';
    if (c >= 80 && c <= 82) return 'Rain showers';
    if (c === 85 || c === 86) return 'Snow showers';
    if (c === 95) return 'Thunderstorm';
    if (c === 96 || c === 99) return 'Thunderstorm with hail';
    return 'Mixed conditions';
  }

  function updateRightNow(cw) {
    if (!rightNowEl) return;
    if (!cw || cw.temperature == null) {
      rightNowEl.textContent = '';
      return;
    }
    var t = Math.round(cw.temperature * 10) / 10;
    var parts = [t + '°F', wmoCodeToPhrase(cw.weathercode)];
    if (cw.windspeed != null && !isNaN(cw.windspeed)) {
      parts.push(Math.round(cw.windspeed) + ' mph wind');
    }
    rightNowEl.textContent = 'Right now: ' + parts.join(', ') + '.';
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function localDayKey(iso) {
    var d = new Date(iso);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function localDayKeyToday() {
    return localDayKey(new Date().toISOString());
  }

  function buildUniqueDayKeys(times) {
    var seen = {};
    var keys = [];
    for (var i = 0; i < times.length; i++) {
      var k = localDayKey(times[i]);
      if (!seen[k]) {
        seen[k] = true;
        keys.push(k);
      }
    }
    return keys;
  }

  function sliceHourlyPayload(indices) {
    var out = {};
    Object.keys(fullHourlyPayload).forEach(function (k) {
      var arr = fullHourlyPayload[k];
      if (k === 'time' || (Array.isArray(arr) && arr.length === fullTimesIso.length)) {
        out[k] = indices.map(function (i) { return arr[i]; });
      } else if (Array.isArray(arr)) {
        out[k] = indices.map(function (i) { return arr[i]; });
      } else {
        out[k] = arr;
      }
    });
    return out;
  }

  function sliceDataForView() {
    if (!fullTimesIso.length || !fullHourlyPayload) {
      return { times: [], payload: {} };
    }
    if (viewMode === 'week' || uniqueDayKeys.length === 0) {
      return { times: fullTimesIso.slice(), payload: clonePayloadShallow(fullHourlyPayload) };
    }
    var dayKey = uniqueDayKeys[selectedDayIndex];
    if (!dayKey) {
      return { times: fullTimesIso.slice(), payload: clonePayloadShallow(fullHourlyPayload) };
    }
    var idx = [];
    for (var i = 0; i < fullTimesIso.length; i++) {
      if (localDayKey(fullTimesIso[i]) === dayKey) idx.push(i);
    }
    if (!idx.length) {
      return { times: [], payload: {} };
    }
    return { times: idx.map(function (i) { return fullTimesIso[i]; }), payload: sliceHourlyPayload(idx) };
  }

  function clonePayloadShallow(p) {
    var out = {};
    Object.keys(p).forEach(function (k) {
      out[k] = Array.isArray(p[k]) ? p[k].slice() : p[k];
    });
    return out;
  }

  function optByKey(key) {
    for (var i = 0; i < HOURLY_OPTIONS.length; i++) {
      if (HOURLY_OPTIONS[i].key === key) return HOURLY_OPTIONS[i];
    }
    return HOURLY_OPTIONS[0];
  }

  function getSelectedKey() {
    var el = metricList.querySelector('input[name="metric"]:checked');
    return el ? el.value : DEFAULT_METRIC;
  }

  function updateMetricBlurb(key) {
    var o = optByKey(key);
    if (metricBlurbTitle) metricBlurbTitle.textContent = o.blurbTitle || o.label;
    if (metricBlurbDesc) metricBlurbDesc.textContent = o.description || '';
  }

  function setToggleLabel(key) {
    var o = optByKey(key);
    metricCurrent.textContent = o.label;
    updateMetricBlurb(key);
  }

  function buildMetricList() {
    HOURLY_OPTIONS.forEach(function (o) {
      var li = document.createElement('li');
      li.className = 'metric-picker__item';
      var label = document.createElement('label');
      label.className = 'metric-picker__label';
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'metric';
      radio.value = o.key;
      radio.className = 'metric-picker__radio';
      if (o.key === DEFAULT_METRIC) radio.checked = true;
      var span = document.createElement('span');
      span.className = 'metric-picker__text';
      span.textContent = o.label;
      label.appendChild(radio);
      label.appendChild(span);
      li.appendChild(label);
      metricList.appendChild(li);
    });
    setToggleLabel(getSelectedKey());
  }

  function setPanelOpen(open) {
    metricToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) metricPanel.removeAttribute('hidden');
    else metricPanel.setAttribute('hidden', '');
  }

  function togglePanel() {
    var isHidden = metricPanel.hasAttribute('hidden');
    setPanelOpen(isHidden);
  }

  function closePanel() {
    setPanelOpen(false);
  }

  function formatTickLabel(iso) {
    var d = new Date(iso);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var h = d.getHours();
    var ampm = h >= 12 ? 'p' : 'a';
    var hr = h % 12;
    if (hr === 0) hr = 12;
    return months[d.getMonth()] + ' ' + d.getDate() + ' ' + hr + ampm;
  }

  /** Shorter x labels in day view */
  function formatXTickShort(iso) {
    var d = new Date(iso);
    var h = d.getHours();
    var ampm = h >= 12 ? 'p' : 'a';
    var hr = h % 12;
    if (hr === 0) hr = 12;
    return hr + ampm;
  }

  function formatFullTime(iso) {
    var d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function formatDayHeading(dayKey) {
    if (!dayKey) return '—';
    var parts = dayKey.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    var d = new Date(y, m, day);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function computeScrollInnerWidth(pointCount) {
    var w = chartScroll.clientWidth || document.documentElement.clientWidth || 360;
    var zoom = viewMode === 'day' ? 1.38 : 1.22;
    var perPoint = viewMode === 'day' ? 22 : 11;
    return Math.max(Math.floor(w * zoom), Math.max(pointCount, 4) * perPoint);
  }

  function applyScrollInnerWidth(pointCount) {
    var px = computeScrollInnerWidth(pointCount);
    chartScrollInner.style.width = px + 'px';
  }

  function getYTicks(scale) {
    if (typeof scale.getTicks === 'function') return scale.getTicks();
    return scale.ticks || [];
  }

  function syncYRail(chart) {
    if (!yRail || !chart || !chart.scales.y) return;
    var y = chart.scales.y;
    var ticks = getYTicks(y);
    yRail.innerHTML = '';
    for (var i = 0; i < ticks.length; i++) {
      var t = ticks[i];
      var val = t.value !== undefined ? t.value : t;
      var py = y.getPixelForValue(val);
      if (py == null || !isFinite(py)) continue;
      var div = document.createElement('div');
      div.className = 'chart-y-tick';
      div.style.top = py + 'px';
      div.textContent = t.label != null ? String(t.label) : String(val);
      yRail.appendChild(div);
    }
  }

  var yRailPlugin = {
    id: 'yRailSync',
    afterUpdate: function (chart) {
      syncYRail(chart);
    }
  };

  Chart.register(yRailPlugin);

  function getNowXPixel(chart, times) {
    if (!times || times.length < 2) return null;
    var now = Date.now();
    var labels = chart.data.labels;
    var xScale = chart.scales.x;
    var t0 = new Date(times[0]).getTime();
    var tLast = new Date(times[times.length - 1]).getTime();
    if (now <= t0) return xScale.getPixelForValue(labels[0]);
    if (now >= tLast) return xScale.getPixelForValue(labels[labels.length - 1]);
    for (var i = 0; i < times.length - 1; i++) {
      var a = new Date(times[i]).getTime();
      var b = new Date(times[i + 1]).getTime();
      if (now >= a && now <= b) {
        var x0 = xScale.getPixelForValue(labels[i]);
        var x1 = xScale.getPixelForValue(labels[i + 1]);
        var f = (now - a) / (b - a);
        return x0 + f * (x1 - x0);
      }
    }
    return null;
  }

  function nowInView(times) {
    if (!times || !times.length) return false;
    var now = Date.now();
    return now >= new Date(times[0]).getTime() && now <= new Date(times[times.length - 1]).getTime();
  }

  var nowLinePlugin = {
    id: 'nowLine',
    afterDraw: function (chart) {
      if (!nowInView(viewTimesIso)) return;
      var x = getNowXPixel(chart, viewTimesIso);
      if (x == null || !isFinite(x)) return;
      var area = chart.chartArea;
      if (x < area.left || x > area.right) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = COLOR_NOW;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(x, area.top);
      ctx.lineTo(x, area.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLOR_NOW;
      ctx.font = '10px JetBrains Mono, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NOW', x, area.top - 6);
      ctx.restore();
    }
  };

  Chart.register(nowLinePlugin);

  function buildChart(xLabels, seriesKey, payload) {
    var meta = optByKey(seriesKey);
    var raw = payload && payload[seriesKey] ? payload[seriesKey] : [];
    var data = raw.map(function (v) { return v == null ? null : Number(v); });

    var cap = meta.unit ? meta.unit : meta.label.slice(0, 10);
    yRailCap.textContent = cap;

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    var xMaxTicks = viewMode === 'day' ? 24 : 16;
    var xFontSize = viewMode === 'day' ? 10 : 9;

    var yScale = {
      position: 'left',
      grid: {
        color: 'rgba(255,255,255,0.1)',
        lineWidth: 1
      },
      ticks: {
        display: false
      },
      border: { display: false },
      title: { display: false }
    };
    if (meta.yAxisMin0 === true) yScale.min = 0;
    if (meta.yAxisMax100 === true) yScale.max = 100;
    if (meta.yAxisMax360 === true) {
      yScale.min = 0;
      yScale.max = 360;
    }

    chartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: xLabels,
        datasets: [
          {
            label: meta.label,
            data: data,
            borderColor: COLOR_LINE,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.15,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBorderWidth: 2,
            pointHoverBackgroundColor: '#000000',
            pointHoverBorderColor: COLOR_LINE,
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { left: 2, right: 4, top: 6, bottom: 2 }
        },
        animation: {
          duration: 1100,
          easing: 'easeOutQuart'
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: '#000000',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#ffffff',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 0,
            displayColors: false,
            callbacks: {
              title: function (items) {
                if (!items.length) return '';
                var idx = items[0].dataIndex;
                return viewTimesIso[idx] ? formatFullTime(viewTimesIso[idx]) : '';
              },
              label: function (ctx) {
                var v = ctx.parsed.y;
                if (v == null || Number.isNaN(v)) return meta.label + ': —';
                var rounded = formatTooltipValue(v, seriesKey);
                return meta.label + ': ' + rounded + (meta.unit ? ' ' + meta.unit : '');
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255,255,255,0.1)',
              lineWidth: 1
            },
            ticks: {
              color: '#ffffff',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: xMaxTicks,
              font: { family: 'JetBrains Mono, Consolas, monospace', size: xFontSize }
            },
            border: { color: 'rgba(255,255,255,0.35)' }
          },
          y: yScale
        }
      }
    });
  }

  function refreshChart() {
    if (viewMode === 'radar') return;
    if (!fullHourlyPayload || !fullTimesIso.length) return;
    var slice = sliceDataForView();
    viewTimesIso = slice.times;
    if (!viewTimesIso.length) {
      statusEl.textContent = 'No data for this day.';
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      yRail.innerHTML = '';
      return;
    }
    statusEl.textContent = '';

    applyScrollInnerWidth(viewTimesIso.length);

    var xLabels = viewTimesIso.map(function (iso) {
      return viewMode === 'day' ? formatXTickShort(iso) : formatTickLabel(iso);
    });
    requestAnimationFrame(function () {
      buildChart(xLabels, getSelectedKey(), slice.payload);
    });
  }

  function updatePeriodButtons() {
    periodDay.classList.toggle('is-active', viewMode === 'day');
    periodWeek.classList.toggle('is-active', viewMode === 'week');
    periodRadar.classList.toggle('is-active', viewMode === 'radar');
  }

  function updateMainPanels() {
    var isRadar = viewMode === 'radar';
    chartViewPanel.hidden = isRadar;
    radarViewPanel.hidden = !isRadar;
  }

  function attachRadarOverlayClearStatus(layer) {
    layer.on('load', function () {
      if (viewMode === 'radar') statusEl.textContent = '';
    });
  }

  function loadRadarFrame() {
    if (!radarMapEl) return;
    if (typeof L === 'undefined') {
      statusEl.textContent = 'Map library failed to load.';
      return;
    }
    statusEl.textContent = 'Loading radar…';
    fetch(RAINVIEWER_MAPS)
      .then(function (r) {
        if (!r.ok) throw new Error('Radar map list (' + r.status + ')');
        return r.json();
      })
      .then(function (data) {
        var past = data.radar && data.radar.past;
        if (!past || !past.length) throw new Error('No radar frames');
        var frame = past[past.length - 1];
        var host = data.host || 'https://tilecache.rainviewer.com';
        var radarUrl = host + frame.path + '/512/{z}/{x}/{y}/2/1_1.png';
        var overlayOpts = {
          tileSize: 512,
          zoomOffset: -1,
          opacity: 0.82,
          maxNativeZoom: 7,
          attribution: 'Radar: <a href="https://www.rainviewer.com/" rel="noreferrer">Rain Viewer</a>'
        };

        if (!radarLeafletMap) {
          radarLeafletMap = L.map(radarMapEl, {
            center: [userLat, userLon],
            zoom: RADAR_MAP_ZOOM,
            zoomControl: true
          });
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(radarLeafletMap);
          radarOverlayLayer = L.tileLayer(radarUrl, overlayOpts).addTo(radarLeafletMap);
          attachRadarOverlayClearStatus(radarOverlayLayer);
          radarLocationMarker = L.circleMarker([userLat, userLon], {
            radius: 6,
            color: 'rgba(0,0,0,0.55)',
            weight: 2,
            fillColor: COLOR_NOW,
            fillOpacity: 1
          }).addTo(radarLeafletMap);
        } else {
          if (radarOverlayLayer) {
            radarLeafletMap.removeLayer(radarOverlayLayer);
          }
          radarOverlayLayer = L.tileLayer(radarUrl, overlayOpts).addTo(radarLeafletMap);
          attachRadarOverlayClearStatus(radarOverlayLayer);
          radarLeafletMap.setView([userLat, userLon], radarLeafletMap.getZoom());
          if (radarLocationMarker) {
            radarLocationMarker.setLatLng([userLat, userLon]);
          }
        }
        requestAnimationFrame(function () {
          if (radarLeafletMap) radarLeafletMap.invalidateSize();
        });
      })
      .catch(function (err) {
        statusEl.textContent = String(err.message || err);
      });
  }

  function updateDayNav() {
    if (viewMode !== 'day') {
      dayNav.hidden = true;
      return;
    }
    dayNav.hidden = false;
    var key = uniqueDayKeys[selectedDayIndex];
    dayLabel.textContent = formatDayHeading(key);
    var n = uniqueDayKeys.length;
    dayPrev.disabled = n === 0 || selectedDayIndex <= 0;
    dayNext.disabled = n === 0 || selectedDayIndex >= n - 1;
  }

  function setViewMode(mode) {
    viewMode = mode;
    updatePeriodButtons();
    updateMainPanels();
    if (mode === 'day') {
      var today = localDayKeyToday();
      var ix = uniqueDayKeys.indexOf(today);
      if (ix >= 0) selectedDayIndex = ix;
      else selectedDayIndex = Math.min(selectedDayIndex, Math.max(0, uniqueDayKeys.length - 1));
    }
    updateDayNav();
    if (mode === 'radar') {
      loadRadarFrame();
    } else {
      refreshChart();
    }
  }

  function fetchForecast(lat, lon) {
    var url =
      'https://api.open-meteo.com/v1/forecast?latitude=' +
      lat +
      '&longitude=' +
      lon +
      '&hourly=' +
      encodeURIComponent(hourlyParamString) +
      '&timezone=auto&forecast_days=7&current_weather=true' +
      '&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch';
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Forecast ' + r.status);
      return r.json();
    });
  }

  function zoneIdFromNwsUrl(url) {
    if (!url || typeof url !== 'string') return null;
    var parts = url.replace(/\/$/, '').split('/');
    return parts.length ? parts[parts.length - 1] : null;
  }

  function nwsAlertEndMs(p) {
    var t = Date.parse(p.ends || '') || Date.parse(p.expires || '') || 0;
    return t;
  }

  /** Same minute issuance — NWS often lists multiple hydro products with identical issue time but different end times. */
  function nwsSentMinuteKey(sent) {
    if (!sent) return '';
    var d = new Date(sent);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 16);
  }

  /**
   * Collapse duplicate-looking alerts (same event, office, and issuance minute).
   * Keeps the row with the latest end time (furthest expires/ends), or newer sent if those differ.
   * Tornado + Flood stay separate (different event).
   */
  function dedupeNwsAlerts(propsList) {
    if (!propsList || !propsList.length) return [];
    var groups = {};
    for (var i = 0; i < propsList.length; i++) {
      var p = propsList[i];
      var key =
        (p.event || '').trim() +
        '\t' +
        (p.senderName || '').trim() +
        '\t' +
        nwsSentMinuteKey(p.sent);
      if (!groups[key]) {
        groups[key] = p;
        continue;
      }
      groups[key] = pickPreferredNwsAlert(groups[key], p);
    }
    return Object.keys(groups).map(function (k) {
      return groups[k];
    });
  }

  function pickPreferredNwsAlert(a, b) {
    var sa = Date.parse(a.sent || 0);
    var sb = Date.parse(b.sent || 0);
    if (sb !== sa) return sb > sa ? b : a;
    var ea = nwsAlertEndMs(a);
    var eb = nwsAlertEndMs(b);
    return eb >= ea ? b : a;
  }

  /**
   * US National Weather Service active alerts (free, no key; US only).
   * NOTE: `alerts/active?point=lat,lon` often returns ZERO for flood/hydro alerts because
   * those products use county/zone geometry that does not always match the point query.
   * We resolve /points/{lat},{lon} and fetch by county + forecast zone IDs, then merge.
   */
  function fetchNwsAlerts(lat, lon) {
    return fetch(
      'https://api.weather.gov/points/' + encodeURIComponent(lat + ',' + lon),
      { headers: { Accept: 'application/geo+json' } }
    )
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (pointJson) {
        var zones = [];
        if (pointJson && pointJson.properties) {
          var cz = zoneIdFromNwsUrl(pointJson.properties.county);
          var fz = zoneIdFromNwsUrl(pointJson.properties.forecastZone);
          if (cz) zones.push(cz);
          if (fz && fz !== cz) zones.push(fz);
        }
        var fetches = zones.map(function (z) {
          return fetch('https://api.weather.gov/alerts/active?zone=' + encodeURIComponent(z), {
            headers: { Accept: 'application/geo+json' }
          }).then(function (res) {
            if (!res.ok) return { features: [] };
            return res.json();
          });
        });
        fetches.push(
          fetch('https://api.weather.gov/alerts/active?point=' + encodeURIComponent(lat + ',' + lon), {
            headers: { Accept: 'application/geo+json' }
          }).then(function (res) {
            if (!res.ok) return { features: [] };
            return res.json();
          })
        );
        return Promise.all(fetches);
      })
      .then(function (results) {
        if (!results) return [];
        var seen = {};
        var out = [];
        for (var i = 0; i < results.length; i++) {
          var feats = (results[i] && results[i].features) || [];
          for (var j = 0; j < feats.length; j++) {
            var f = feats[j];
            var p = f.properties || {};
            var id = p.id || p.sent + '|' + (p.event || '') + '|' + (p.headline || '');
            if (seen[id]) continue;
            seen[id] = true;
            out.push(p);
            if (out.length >= 48) break;
          }
          if (out.length >= 48) break;
        }
        return dedupeNwsAlerts(out).slice(0, 12);
      })
      .catch(function () {
        return [];
      });
  }

  function renderAlerts(propsList) {
    if (!alertBarEl) return;
    alertBarEl.innerHTML = '';
    if (!propsList || !propsList.length) {
      alertBarEl.hidden = true;
      return;
    }
    var any = false;
    for (var i = 0; i < propsList.length; i++) {
      var p = propsList[i];
      var text = (p.headline || '').trim() || (p.event || '').trim();
      if (!text) continue;
      any = true;
      var div = document.createElement('div');
      div.className = 'alert-bar__item';
      div.textContent = text;
      alertBarEl.appendChild(div);
    }
    alertBarEl.hidden = !any;
  }

  function formatTooltipValue(v, seriesKey) {
    if (v == null || Number.isNaN(v)) return null;
    var abs = Math.abs(v);
    if (
      seriesKey === 'precipitation' ||
      seriesKey === 'rain' ||
      seriesKey === 'showers' ||
      seriesKey === 'snowfall'
    ) {
      if (abs >= 10) return v.toFixed(2);
      if (abs >= 1) return v.toFixed(2);
      if (abs >= 0.01) return v.toFixed(3);
      return v.toFixed(4);
    }
    if (seriesKey === 'visibility' && abs >= 1000) return v.toFixed(0);
    if (seriesKey === 'wind_direction_10m') return v.toFixed(0);
    if (abs >= 100) return v.toFixed(0);
    if (abs >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }

  function setPlaceLabel(lat, lon, usedDefault) {
    if (usedDefault) {
      placeEl.textContent = 'Fort Wayne, IN';
      return;
    }
    placeEl.textContent = lat.toFixed(2) + ', ' + lon.toFixed(2);
    var geoUrl = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon;
    fetch(geoUrl)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var name = d.city || d.locality || d.principalSubdivision;
        if (name) placeEl.textContent = name;
      })
      .catch(function () {});
  }

  function resolveLocation() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) {
        resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON, usedDefault: true });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            usedDefault: false
          });
        },
        function () {
          resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON, usedDefault: true });
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
      );
    });
  }

  function bindMetricPicker() {
    metricToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePanel();
    });

    metricList.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'metric') {
        setToggleLabel(e.target.value);
        refreshChart();
        closePanel();
      }
    });

    document.addEventListener('click', function () {
      closePanel();
    });

    metricPicker.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });
  }

  function bindPeriodAndDayNav() {
    periodDay.addEventListener('click', function () {
      setViewMode('day');
    });
    periodWeek.addEventListener('click', function () {
      setViewMode('week');
    });
    periodRadar.addEventListener('click', function () {
      setViewMode('radar');
    });
    dayPrev.addEventListener('click', function () {
      if (selectedDayIndex > 0) {
        selectedDayIndex--;
        updateDayNav();
        refreshChart();
      }
    });
    dayNext.addEventListener('click', function () {
      if (selectedDayIndex < uniqueDayKeys.length - 1) {
        selectedDayIndex++;
        updateDayNav();
        refreshChart();
      }
    });
  }

  function main() {
    buildMetricList();
    bindMetricPicker();
    bindPeriodAndDayNav();
    setPanelOpen(false);
    updatePeriodButtons();
    updateMainPanels();
    updateDayNav();
    statusEl.textContent = '';

    resolveLocation()
      .then(function (loc) {
        userLat = loc.lat;
        userLon = loc.lon;
        setPlaceLabel(loc.lat, loc.lon, loc.usedDefault);
        return Promise.all([fetchForecast(loc.lat, loc.lon), fetchNwsAlerts(loc.lat, loc.lon)]);
      })
      .then(function (results) {
        var data = results[0];
        renderAlerts(results[1]);
        if (!data.hourly || !data.hourly.time) throw new Error('No hourly data');
        fullTimesIso = data.hourly.time;
        fullHourlyPayload = data.hourly;
        uniqueDayKeys = buildUniqueDayKeys(fullTimesIso);
        var today = localDayKeyToday();
        var ix = uniqueDayKeys.indexOf(today);
        selectedDayIndex = ix >= 0 ? ix : 0;
        updateRightNow(data.current_weather);
        updateDayNav();
        refreshChart();
      })
      .catch(function (err) {
        renderAlerts([]);
        if (rightNowEl) rightNowEl.textContent = '';
        statusEl.textContent = String(err.message || err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

  window.addEventListener('resize', function () {
    if (viewMode === 'radar') {
      if (radarLeafletMap) radarLeafletMap.invalidateSize();
      return;
    }
    if (!fullHourlyPayload) return;
    applyScrollInnerWidth(viewTimesIso.length || fullTimesIso.length);
    if (chartInstance) {
      chartInstance.resize();
      syncYRail(chartInstance);
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
