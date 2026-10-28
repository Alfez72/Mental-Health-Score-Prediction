/* ============ PeaceHealth · script.js ============ */

/* ---------- Config ---------- */
const API_URL = 'https://mental-health-score-prediction-3ngj.onrender.com';
const MODEL_SCORE_MAX = 10;     // range of predicted_mental_health_score returned by the model (assumed 0-10)
const HIGHER_IS_BETTER = true;  // set to false if a higher model score means more distress
const TICK_COUNT = 60;

const $ = (s, r = document) => r.querySelector(s);
const form = $('#form'), btn = $('#submit'), bar = $('#bar'), knob = $('#knob');
const C = 2 * Math.PI * +bar.getAttribute('r');

/* ---------- Gauge setup ---------- */
bar.style.setProperty('--c', C);
bar.style.strokeDashoffset = C;

const ticksG = $('#ticks');
const NS = 'http://www.w3.org/2000/svg';
for (let i = 0; i < TICK_COUNT; i++) {
  const a = (i / TICK_COUNT) * 2 * Math.PI, long = i % 5 === 0;
  const r1 = 127, r2 = long ? 137 : 133;
  const l = document.createElementNS(NS, 'line');
  l.setAttribute('x1', 150 + r1 * Math.sin(a)); l.setAttribute('y1', 150 - r1 * Math.cos(a));
  l.setAttribute('x2', 150 + r2 * Math.sin(a)); l.setAttribute('y2', 150 - r2 * Math.cos(a));
  l.setAttribute('class', 'tick' + (long ? ' long' : ''));
  ticksG.appendChild(l);
}
const ticks = [...ticksG.children];

function lightTicks(idx) {
  const n = Math.round((idx / 100) * TICK_COUNT);
  ticks.forEach((t, i) => {
    t.style.transitionDelay = i < n ? (i * 24) + 'ms' : '0ms';
    t.classList.toggle('on', i < n);
  });
}

/* ---------- Theme toggle ---------- */
$('#theme').addEventListener('click', () => {
  const r = document.documentElement;
  r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
});

/* ---------- Card spotlight ---------- */
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('pointermove', e => {
    const b = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - b.left) + 'px');
    card.style.setProperty('--my', (e.clientY - b.top) + 'px');
  });
});

/* ---------- Sliders ---------- */
function syncSlider(el) {
  const p = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.setProperty('--p', p + '%');
  const dec = +(el.dataset.dec || 0);
  el.parentElement.querySelector('output').textContent = (+el.value).toFixed(dec) + (el.dataset.unit || '');
}
document.querySelectorAll('input[type=range]').forEach(el => {
  syncSlider(el);
  el.addEventListener('input', () => syncSlider(el));
});

/* ---------- Payload (matches the StudentData pydantic model) ---------- */
function collect() {
  const num = id => +$('#' + id).value;
  const radio = n => form.querySelector(`input[name="${n}"]:checked`).value;
  return {
    age: num('age'),
    gender: radio('gender'),
    country: $('#country').value.trim(),
    academic_level: radio('academic_level'),
    most_used_platform: $('#most_used_platform').value,
    purpose_of_use: radio('purpose_of_use'),
    avg_daily_usage_hours: num('avg_daily_usage_hours'),
    daily_unlocks: Math.round(num('daily_unlocks')),
    study_hours: num('study_hours'),
    physical_activity_hours: num('physical_activity_hours'),
    sleep_hours_per_night: num('sleep_hours_per_night'),
    stress_level: radio('stress_level'),
  };
}

/* ---------- Wellness zones ---------- */
function zoneFor(i) {
  if (i >= 70) return {
    name: 'Optimal Balance', c: 'var(--sage)', a: '#72A98F', b: '#A3C9A8',
    text: 'Your routine looks well balanced. Keep protecting the habits that support you.'
  };
  if (i >= 50) return {
    name: 'Mild Stress', c: 'var(--sky)', a: '#8ECAE6', b: '#72A98F',
    text: 'A few patterns may be adding pressure. Small, steady changes can help.'
  };
  return {
    name: 'Elevated Strain', c: 'var(--amber)', a: '#E29578', b: '#F2BFA8',
    text: 'Several habits may be weighing on you. Gentle changes and support can make a real difference.'
  };
}

/* ---------- Insights (derived from your inputs, not from the model) ---------- */
function breakdown(d) {
  const pct = (v, max) => Math.max(0, Math.min(100, (v / max) * 100));
  return [
    { k: 'Sleep', v: d.sleep_hours_per_night.toFixed(1) + ' h', bar: pct(d.sleep_hours_per_night, 9), warn: d.sleep_hours_per_night < 7 },
    { k: 'Social media', v: d.avg_daily_usage_hours.toFixed(1) + ' h/day', bar: pct(d.avg_daily_usage_hours, 10), warn: d.avg_daily_usage_hours > 5 },
    { k: 'Physical activity', v: d.physical_activity_hours.toFixed(1) + ' h', bar: pct(d.physical_activity_hours, 2), warn: d.physical_activity_hours < 0.5 },
    { k: 'Phone unlocks', v: d.daily_unlocks + '/day', bar: pct(d.daily_unlocks, 150), warn: d.daily_unlocks > 100 },
  ];
}
function tips(d) {
  const t = [];
  if (d.sleep_hours_per_night < 7) t.push(['Aim for 7 to 9 hours of sleep. A consistent bedtime helps most.', 1]);
  if (d.avg_daily_usage_hours > 5) t.push(['Try a screen-free window before bed or during meals to bring daily usage down.', 1]);
  if (d.daily_unlocks > 100) t.push(['Turning off non-essential notifications can reduce how often you reach for your phone.', 1]);
  if (d.physical_activity_hours < 0.5) t.push(['A 20-minute walk on most days can lift mood and ease stress.', 1]);
  if (['High', 'Very High'].includes(d.stress_level)) t.push(['When stress is high, short breathing breaks and talking with someone you trust can help.', 1]);
  if (!t.length) t.push(['Your habits look steady. Keep the routines that are working for you.', 0]);
  return t.slice(0, 4);
}

/* ---------- Render ---------- */
let raf;
function countTo(to) {
  cancelAnimationFrame(raf);
  const t0 = performance.now(), dur = 1800;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    $('#num').textContent = Math.round(to * e);
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

function render(raw, d) {
  let idx = (raw / MODEL_SCORE_MAX) * 100;
  if (!HIGHER_IS_BETTER) idx = 100 - idx;
  idx = Math.max(0, Math.min(100, idx));

  const z = zoneFor(idx), root = document.documentElement.style;
  root.setProperty('--zone', z.c); root.setProperty('--za', z.a); root.setProperty('--zb', z.b);

  $('#zoneName').textContent = z.name;
  $('#zoneText').textContent = z.text;
  $('#of').innerHTML = `out of 100<small>model score ${raw.toFixed(2)}</small>`;
  $('#gauge').classList.add('done');

  bar.style.strokeDashoffset = C * (1 - idx / 100);
  knob.style.setProperty('--deg', (idx * 3.6) + 'deg');
  knob.classList.add('on');
  lightTicks(idx);
  countTo(idx);

  $('#metrics').innerHTML = breakdown(d).map(m =>
    `<div class="metric ${m.warn ? 'warn' : ''}"><small>${m.k}</small><b>${m.v}</b><div class="mini"><em data-w="${m.bar}"></em></div></div>`).join('');
  $('#tips').innerHTML = tips(d).map(([s, w]) => `<li class="${w ? 'warn' : ''}">${s}</li>`).join('');
  $('#details').classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(() =>
    document.querySelectorAll('.mini em').forEach(e => e.style.width = e.dataset.w + '%')));
}

/* ---------- UI states ---------- */
function setLoading(on) {
  btn.disabled = on;
  btn.firstElementChild.textContent = on ? 'Calculating…' : 'Calculate my score';
  $('#skeleton').classList.toggle('hidden', !on);
  if (on) {
    $('#details').classList.add('hidden');
    $('#num').textContent = '…';
    bar.style.strokeDashoffset = C;
    $('#gauge').classList.remove('done');
    knob.classList.remove('on');
    ticks.forEach(t => { t.style.transitionDelay = '0ms'; t.classList.remove('on'); });
  }
}
function showError(msg) {
  const e = $('#error');
  e.textContent = msg;
  e.classList.toggle('hidden', !msg);
}

/* ---------- FastAPI call ---------- */
form.addEventListener('submit', async ev => {
  ev.preventDefault();
  showError('');
  const data = collect();
  if (!data.country) return showError('Enter your country to continue.');

  setLoading(true);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let detail = `The server returned status ${res.status}.`;
      try {
        const j = await res.json();
        if (Array.isArray(j.detail)) detail = j.detail.map(x => `${x.loc.slice(-1)}: ${x.msg}`).join('; ');
      } catch { /* keep default message */ }
      throw new Error(detail);
    }
    const out = await res.json();
    setLoading(false);
    render(out.predicted_mental_health_score, data);
  } catch (err) {
    setLoading(false);
    $('#num').textContent = '–';
    showError(err instanceof TypeError
      ? `Could not reach the API at ${API_URL}. Check that FastAPI is running and CORS is enabled.`
      : err.message);
  }
});
