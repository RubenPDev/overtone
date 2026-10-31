/* The page at stats.overtone.games. It only reads the public /stats JSON, and every
   label goes in through textContent. Colours are the validated default chart palette. */

export const DASHBOARD_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Overtone Stats</title>
<style>
:root {
  color-scheme: light;
  --surface: #fcfcfb; --panel: #f4f3ef;
  --text: #0b0b0b; --text-2: #52514e; --text-3: #6f6e69;
  --rule: rgba(11, 11, 11, 0.10);
  --s1: #2a78d6; --s2: #eb6834;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --surface: #1a1a19; --panel: #232322;
    --text: #f0efec; --text-2: #c3c2b7; --text-3: #9a9990;
    --rule: rgba(240, 239, 236, 0.13);
    --s1: #3987e5; --s2: #d95926;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--surface); color: var(--text); font: 15px/1.5 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
main { max-width: 1040px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { margin: 0; font-size: 26px; letter-spacing: -0.02em; }
h2 { margin: 0 0 2px; font-size: 16px; font-weight: 600; }
.sub { margin: 0 0 14px; font-size: 13px; color: var(--text-2); }
.top { margin-bottom: 22px; }
.top p { margin: 2px 0 0; font-size: 13px; color: var(--text-3); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 26px; }
.tile { padding: 14px 16px; background: var(--panel); border-radius: 10px; }
.tile b { display: block; font-size: 28px; font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; }
.tile span { font-size: 13px; color: var(--text-2); }
.tile small { display: block; font-size: 12px; color: var(--text-3); }
section { margin-bottom: 30px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px 34px; margin-bottom: 30px; }
.grid section { margin: 0; min-width: 0; }
.legend { display: flex; gap: 14px; margin-bottom: 6px; font-size: 12px; color: var(--text-2); }
.legend i { display: inline-block; width: 10px; height: 10px; margin-right: 5px; border-radius: 2px; }
.chart { position: relative; }
.chart svg { display: block; width: 100%; }
.chart text { font-size: 11px; fill: var(--text-3); }
.chart .grid-line { stroke: var(--rule); }
.chart .mark:hover path, .chart .mark:focus path { opacity: 0.8; }
.chart .mark:focus { outline: none; }
.tip { position: absolute; z-index: 2; pointer-events: none; min-width: 120px; padding: 7px 10px; font-size: 12px; background: var(--surface); border: 1px solid var(--rule); border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,.14); }
.tip div { display: flex; justify-content: space-between; gap: 14px; color: var(--text-2); }
.tip strong { color: var(--text); font-weight: 600; }
.tip .when { color: var(--text-3); margin-bottom: 2px; }
.bars { margin: 0; padding: 0; list-style: none; }
.bars li { display: grid; grid-template-columns: minmax(90px, 34%) 1fr; gap: 10px; align-items: center; padding: 3px 0; font-size: 13px; }
.bars .label { color: var(--text-2); overflow-wrap: anywhere; }
.bars .track { display: flex; align-items: center; gap: 7px; min-width: 0; }
.bars .bar { height: 14px; min-width: 2px; background: var(--s1); border-radius: 0 4px 4px 0; }
.bars .val { flex: none; color: var(--text); font-variant-numeric: tabular-nums; }
.bars .val small { color: var(--text-3); font-size: 12px; }
.none { font-size: 13px; color: var(--text-3); }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
th, td { padding: 7px 10px; text-align: right; border-bottom: 1px solid var(--rule); white-space: nowrap; }
th { font-weight: 500; color: var(--text-2); }
th:nth-child(1), td:nth-child(1), th:nth-child(2), td:nth-child(2), th:nth-child(3), td:nth-child(3) { text-align: left; }
td:nth-child(3) { white-space: normal; min-width: 150px; }
tr.is-today td { background: var(--panel); }
details { margin-top: 8px; font-size: 13px; color: var(--text-2); }
summary { cursor: pointer; }
footer { font-size: 12px; color: var(--text-3); }
footer a { color: inherit; }
</style>
</head>
<body>
<main>
  <div class="top">
    <h1>Overtone stats</h1>
    <p id="updated">Loading…</p>
  </div>
  <div class="tiles" id="tiles"></div>

  <section>
    <h2>Players per day</h2>
    <p class="sub">Browsers that finished at least one attempt, last 30 days (UTC). Is it growing, and is that new people or the same people?</p>
    <div id="players"></div>
  </section>

  <section>
    <h2>Visitors per day</h2>
    <p class="sub">Browsers that opened the site, last 30 days (UTC).</p>
    <div id="visitors"></div>
  </section>

  <div class="grid">
    <section>
      <h2>First-time funnel</h2>
      <p class="sub">Each browser's first time at each step, all time. A big drop shows where people give up.</p>
      <div id="funnel"></div>
    </section>
    <section>
      <h2>How long players have been around</h2>
      <p class="sub">Each day's players, by how long ago they first finished a puzzle. The more in the lower rows, the more people are sticking around.</p>
      <div id="tenure"></div>
    </section>
  </div>

  <section>
    <h2>Puzzles</h2>
    <p class="sub">One count per browser, per puzzle. Today's tune stays hidden until tomorrow. Tries are counted up to the first solve.</p>
    <div class="scroll"><table id="puzzles"></table></div>
  </section>

  <div class="grid">
    <section><h2>Countries</h2><p class="sub">Players, all time.</p><div id="countries"></div></section>
    <section><h2>Where new visitors came from</h2><p class="sub">"Direct" includes apps that hide the link they came from.</p><div id="sources"></div></section>
    <section><h2>Devices</h2><p class="sub">New visitors.</p><div id="devices"></div></section>
    <section><h2>Streaks</h2><p class="sub">Streak length each time someone finished that day's puzzle.</p><div id="streaks"></div></section>
    <section><h2>Today vs archive</h2><p class="sub">First finishes of a puzzle, by whether it was that day's.</p><div id="plays"></div></section>
    <section><h2>Lesson</h2><p class="sub">Browsers that closed How to play, by whether they'd solved it.</p><div id="lesson"></div></section>
    <section><h2>Shares</h2><p class="sub">Times the Share button worked.</p><div id="shares"></div></section>
  </div>

  <footer>Anonymous totals only. <a href="/stats">Raw JSON</a></footer>
</main>
<script>
var S1 = 'var(--s1)', S2 = 'var(--s2)';

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function svgEl(tag, attrs) {
  var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (var k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function byId(id) { return document.getElementById(id); }
function fmt(n) { return Number(n).toLocaleString(); }
function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '–'; }
function shortDay(day) {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function sum(obj) { var t = 0; for (var k in obj) t += obj[k]; return t; }

/* Adds up one metric across every day, or across the days given. */
function totals(days, metric) {
  var out = {};
  days.forEach(function (d) {
    var m = d[metric] || {};
    for (var k in m) out[k] = (out[k] || 0) + m[k];
  });
  return out;
}

function renderBars(target, rows, base) {
  target.textContent = '';
  var max = 0, all = 0;
  rows.forEach(function (r) { max = Math.max(max, r[1]); all += r[1]; });
  if (!all) { target.appendChild(el('p', 'none', 'Nothing yet')); return; }
  var ul = el('ul', 'bars');
  rows.forEach(function (r) {
    var li = el('li');
    li.appendChild(el('span', 'label', r[0]));
    var track = el('span', 'track');
    var bar = el('span', 'bar');
    bar.style.width = 'calc((100% - 74px) * ' + (r[1] / max) + ')';
    track.appendChild(bar);
    var val = el('span', 'val', fmt(r[1]) + ' ');
    val.appendChild(el('small', '', pct(r[1], base === undefined ? all : base)));
    track.appendChild(val);
    li.appendChild(track);
    ul.appendChild(li);
  });
  target.appendChild(ul);
}

function niceMax(v) {
  if (v <= 4) return 4;
  var mag = Math.pow(10, Math.floor(Math.log10(v))), n = v / mag;
  var step = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find(function (s) { return n <= s; });
  return step * mag;
}

/* Stacked columns. A rounded top on whichever segment ends the stack, 2px gaps between. */
function renderColumns(target, days, series) {
  target.textContent = '';
  var totalAll = 0;
  days.forEach(function (d) { series.forEach(function (s) { totalAll += s.get(d); }); });
  if (!totalAll) { target.appendChild(el('p', 'none', 'Nothing yet')); return; }

  var legend = el('div', 'legend');
  series.forEach(function (s) {
    var item = el('span');
    var swatch = el('i'); swatch.style.background = s.color;
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(s.name));
    legend.appendChild(item);
  });
  target.appendChild(legend);

  var wrap = el('div', 'chart');
  target.appendChild(wrap);
  var W = Math.max(280, target.clientWidth), H = 190, L = 30, B = 22, T = 8;
  var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': target.id + ' per day, see the table below' });
  var top = 0;
  days.forEach(function (d) { var t = 0; series.forEach(function (s) { t += s.get(d); }); top = Math.max(top, t); });
  top = niceMax(top);
  var plot = H - B - T, y = function (v) { return T + plot - (v / top) * plot; };

  [0, 0.5, 1].forEach(function (f) {
    var v = top * f;
    svg.appendChild(svgEl('line', { class: 'grid-line', x1: L, x2: W, y1: y(v), y2: y(v) }));
    var label = svgEl('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' });
    label.textContent = v >= 1000 ? (v / 1000) + 'K' : v;
    svg.appendChild(label);
  });

  var band = (W - L) / days.length, barW = Math.min(24, Math.max(3, band - 2));
  var tip = el('div', 'tip'); tip.hidden = true;

  days.forEach(function (d, i) {
    var x = L + band * i + (band - barW) / 2;
    var g = svgEl('g', { class: 'mark', tabindex: 0 });
    var parts = series.filter(function (s) { return s.get(d) > 0; });
    var base = 0;
    parts.forEach(function (s, j) {
      var v = s.get(d), y0 = y(base), y1 = y(base + v);
      if (j > 0) y0 -= 2;
      y1 = Math.min(y1, y0 - 1);
      var r = j === parts.length - 1 ? Math.min(4, barW / 2, y0 - y1) : 0;
      g.appendChild(svgEl('path', {
        fill: s.color,
        d: 'M' + x + ' ' + y0 + 'V' + (y1 + r) + 'Q' + x + ' ' + y1 + ' ' + (x + r) + ' ' + y1 +
           'H' + (x + barW - r) + 'Q' + (x + barW) + ' ' + y1 + ' ' + (x + barW) + ' ' + (y1 + r) + 'V' + y0 + 'Z',
      }));
      base += v;
    });
    g.appendChild(svgEl('rect', { x: L + band * i, y: T, width: band, height: plot, fill: 'transparent' }));

    var show = function () {
      tip.textContent = '';
      tip.appendChild(el('div', 'when', shortDay(d.day)));
      series.forEach(function (s) {
        var row = el('div');
        row.appendChild(el('span', '', s.name));
        row.appendChild(el('strong', '', fmt(s.get(d))));
        tip.appendChild(row);
      });
      tip.hidden = false;
      var left = L + band * i + band / 2 + 8;
      if (left + 150 > W) left = Math.max(0, left - 166);
      tip.style.left = left + 'px';
      tip.style.top = '6px';
    };
    g.addEventListener('pointerenter', show);
    g.addEventListener('focus', show);
    g.addEventListener('pointerleave', function () { tip.hidden = true; });
    g.addEventListener('blur', function () { tip.hidden = true; });
    svg.appendChild(g);
  });

  var every = Math.ceil(days.length / Math.max(2, Math.floor((W - L) / 70)));
  days.forEach(function (d, i) {
    if ((days.length - 1 - i) % every) return;
    var label = svgEl('text', { x: L + band * i + band / 2, y: H - 6, 'text-anchor': 'middle' });
    label.textContent = shortDay(d.day);
    svg.appendChild(label);
  });

  wrap.appendChild(svg);
  wrap.appendChild(tip);

  var details = el('details');
  details.appendChild(el('summary', '', 'Show as a table'));
  var scroll = el('div', 'scroll'), table = el('table'), head = el('tr');
  head.appendChild(el('th', '', 'Day'));
  series.forEach(function (s) { head.appendChild(el('th', '', s.name)); });
  table.appendChild(head);
  days.slice().reverse().forEach(function (d) {
    var tr = el('tr');
    tr.appendChild(el('td', '', shortDay(d.day)));
    series.forEach(function (s) { tr.appendChild(el('td', '', fmt(s.get(d)))); });
    table.appendChild(tr);
  });
  scroll.appendChild(table);
  details.appendChild(scroll);
  target.appendChild(details);
}

/* The last 30 days ending today, with quiet days filled in as empty. */
function recentDays(daily) {
  var known = {}, out = [];
  daily.forEach(function (d) { known[d.day] = d; });
  for (var i = 29; i >= 0; i--) {
    var day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push(known[day] || { day: day });
  }
  var first = out.findIndex(function (d) { return known[d.day]; });
  return first > 0 ? out.slice(Math.min(first, out.length - 7)) : out.slice(-7);
}

function countryName(code) {
  if (code === 'XX') return 'Unknown';
  if (code === 'T1') return 'Tor';
  try { return new Intl.DisplayNames(undefined, { type: 'region' }).of(code); } catch (e) { return code; }
}

function pick(map, labels) {
  return Object.keys(labels).map(function (k) { return [labels[k], map[k] || 0]; });
}

function render(data) {
  var days = recentDays(data.daily);
  var today = days[days.length - 1];
  var week = days.slice(-7);
  var activeWeek = totals(week, 'active');
  var returning = sum(activeWeek) - (activeWeek['new'] || 0);
  var shares = sum(totals(data.daily, 'share'));

  byId('updated').textContent = 'Updated ' + new Date(data.generated).toLocaleString() + ' · refreshes when you reload';

  var tiles = byId('tiles');
  tiles.textContent = '';
  [
    [fmt(data.players.total), 'Players, all time', 'finished at least once'],
    [fmt(sum(today.visitor || {})), 'Visitors today', 'since midnight UTC'],
    [fmt(sum(today.active || {})), 'Players today', 'since midnight UTC'],
    [pct(returning, sum(activeWeek)), 'Returning, last 7 days', fmt(returning) + ' of ' + fmt(sum(activeWeek)) + ' daily players'],
    [fmt(shares), 'Shares, all time', 'Share button used'],
  ].forEach(function (t) {
    var tile = el('div', 'tile');
    tile.appendChild(el('b', '', t[0]));
    tile.appendChild(el('span', '', t[1]));
    tile.appendChild(el('small', '', t[2]));
    tiles.appendChild(tile);
  });

  renderColumns(byId('players'), days, [
    { name: 'Returning', color: S1, get: function (d) { var a = d.active || {}; return sum(a) - (a['new'] || 0); } },
    { name: 'New', color: S2, get: function (d) { return (d.active || {})['new'] || 0; } },
  ]);
  renderColumns(byId('visitors'), days, [
    { name: 'Returning', color: S1, get: function (d) { return (d.visitor || {}).returning || 0; } },
    { name: 'New', color: S2, get: function (d) { return (d.visitor || {})['new'] || 0; } },
  ]);

  var visitors = totals(data.daily, 'visitor');
  var funnel = totals(data.daily, 'funnel');
  var active = totals(data.daily, 'active');
  renderBars(byId('funnel'), [
    ['Visited', visitors['new'] || 0],
    ['First tap', funnel.started || 0],
    ['First finish', active['new'] || 0],
    ['First solve', funnel.solved || 0],
  ], visitors['new'] || 0);
  renderBars(byId('tenure'), pick(active, {
    'new': 'First day', d1: 'Next day', 'd2-6': '2–6 days', 'd7-29': '7–29 days', 'd30+': '30+ days',
  }));

  var table = byId('puzzles');
  table.textContent = '';
  var head = el('tr');
  ['#', 'Date', 'Tune', 'Started', 'Finished', 'Solved', 'By ear', 'With help', 'First try', 'Solve rate'].forEach(function (h) {
    head.appendChild(el('th', '', h));
  });
  table.appendChild(head);
  Object.keys(data.cadence).map(Number).sort(function (a, b) { return b - a; }).forEach(function (n) {
    var p = data.cadence[n];
    var solved = p.solved + p.assisted;
    var tr = el('tr', n === data.today ? 'is-today' : '');
    [
      n, shortDay(p.date), p.title || 'Today’s tune',
      fmt(p.started), fmt(p.played), fmt(solved), fmt(p.solved), fmt(p.assisted),
      pct(p.tries1, p.tries1 + p.tries2 + p.tries3 + p['tries4-5'] + p['tries6+']),
      pct(solved, p.played),
    ].forEach(function (c) { tr.appendChild(el('td', '', c)); });
    table.appendChild(tr);
  });

  renderBars(byId('countries'), Object.keys(data.players.countries).slice(0, 15).map(function (c) {
    return [countryName(c), data.players.countries[c]];
  }), data.players.total);

  var sources = totals(data.daily, 'source');
  var names = {
    direct: 'Direct', shared: 'Shared link', google: 'Google', reddit: 'Reddit', x: 'X / Twitter', facebook: 'Facebook',
    instagram: 'Instagram', tiktok: 'TikTok', discord: 'Discord', youtube: 'YouTube', hackernews: 'Hacker News', other: 'Other',
  };
  renderBars(byId('sources'), Object.keys(sources).sort(function (a, b) { return sources[b] - sources[a]; }).map(function (k) {
    return [names[k] || k, sources[k]];
  }));
  renderBars(byId('devices'), pick(totals(data.daily, 'device'), { mobile: 'Phone or tablet', desktop: 'Desktop' }));
  renderBars(byId('streaks'), pick(totals(data.daily, 'streak'), {
    1: '1 day', '2-3': '2–3 days', '4-6': '4–6 days', '7-13': '7–13 days', '14-29': '14–29 days', '30+': '30+ days',
  }));
  renderBars(byId('plays'), pick(totals(data.daily, 'plays'), { today: 'That day’s puzzle', archive: 'From the archive' }));
  renderBars(byId('lesson'), pick(totals(data.daily, 'lesson'), { solved: 'Solved it', skipped: 'Closed without solving' }));
  renderBars(byId('shares'), pick(totals(data.daily, 'share'), { sheet: 'Share sheet', copy: 'Copied' }));
}

var latest = null, resizeTimer = 0;
fetch('/stats').then(function (r) { return r.json(); }).then(function (data) {
  latest = data;
  render(data);
}).catch(function () {
  byId('updated').textContent = 'Couldn’t load the stats. Try reloading.';
});
window.addEventListener('resize', function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () { if (latest) render(latest); }, 150);
});
</script>
</body>
</html>`;
