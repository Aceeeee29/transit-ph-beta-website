'use strict';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* ==========================================================================
   Toasts + confetti
   ========================================================================== */
const toastRegion = $('#toasts');

function toast(message, icon = 'fa-trophy') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i><span></span>`;
    el.lastElementChild.textContent = message;
    toastRegion.appendChild(el);
    setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 400);
    }, 3200);
}

function confetti() {
    if (prefersReducedMotion) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);
    const colors = ['#ffb52e', '#2b91d1', '#ffffff', '#1769aa', '#8cdaff'];

    const pieces = Array.from({ length: 70 }, () => ({
        x: w / 2,
        y: h - 50,
        vx: (Math.random() - 0.5) * 15,
        vy: -(Math.random() * 12 + 9),
        size: Math.random() * 6 + 5,
        rot: Math.random() * 6,
        spin: (Math.random() - 0.5) * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)]
    }));

    const FRAMES = 100;
    let frame = 0;

    (function tick() {
        ctx.clearRect(0, 0, w, h);
        for (const p of pieces) {
            p.vy += 0.36;
            p.vx *= 0.99;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.spin;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = Math.max(0, 1 - frame / FRAMES);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            ctx.restore();
        }
        if (++frame < FRAMES) requestAnimationFrame(tick);
        else canvas.remove();
    })();
}

/* ==========================================================================
   Badges (demo gamification, saved in this browser only)
   ========================================================================== */
const BADGE_KEY = 'transitph.badges';
const BADGE_NAMES = {
    'first-ride': 'First Ride',
    'pin-dropper': 'Pin Dropper',
    'map-explorer': 'Map Explorer',
    'feature-hunter': 'Feature Hunter',
    'community-voice': 'Community Voice',
    'end-of-line': 'End of the Line'
};

const badgeEls = $$('.badge');
let unlocked = new Set();

try {
    const saved = JSON.parse(localStorage.getItem(BADGE_KEY) || '[]');
    if (Array.isArray(saved)) unlocked = new Set(saved.filter(id => id in BADGE_NAMES));
} catch (err) {
    /* storage unavailable - badges just won't persist */
}

function renderBadges() {
    const total = badgeEls.length;
    badgeEls.forEach(el => {
        const on = unlocked.has(el.dataset.badge);
        el.classList.toggle('is-unlocked', on);
        $('.badge-state', el).textContent = on ? 'Unlocked' : 'Locked';
    });
    $('#badgeRing').style.setProperty('--p', (unlocked.size / total) * 100);
    $('#badgeCount').textContent = `${unlocked.size}/${total}`;
    $('#badgeSummary').textContent = `${unlocked.size} of ${total} unlocked`;
}

function saveBadges() {
    try {
        localStorage.setItem(BADGE_KEY, JSON.stringify([...unlocked]));
    } catch (err) {
        /* ignore */
    }
}

function unlockBadge(id) {
    if (unlocked.has(id)) return;
    unlocked.add(id);
    saveBadges();
    renderBadges();
    const done = unlocked.size === badgeEls.length;
    toast(done ? 'All badges unlocked. Nice commute!' : `Badge unlocked: ${BADGE_NAMES[id]}`);
    confetti();
}

$('#badgeReset').addEventListener('click', () => {
    unlocked.clear();
    saveBadges();
    renderBadges();
});

renderBadges();

/* ==========================================================================
   Navigation: smooth anchors, scroll progress, rail, active links
   ========================================================================== */
const navbar = $('#navbar');

$$('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
        const target = document.querySelector(anchor.getAttribute('href'));
        if (!target) return;
        event.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - navbar.offsetHeight - 12;
        window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        history.pushState(null, '', anchor.getAttribute('href'));
    });
});

const SECTION_IDS = ['home', 'planner', 'features', 'badges', 'community', 'download', 'about'];
const sectionEls = SECTION_IDS.map(id => document.getElementById(id));
const progressBar = $('.scroll-progress span');
const railLinks = $$('.rail a');
const railFill = $('.rail-fill');
const railVehicle = $('.rail-vehicle');
const navLinks = $$('.nav-links a');
const navTargets = new Set(navLinks.map(a => a.getAttribute('href').slice(1)));

let scrollTicking = false;

function onScroll() {
    scrollTicking = false;

    const y = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.transform = `scaleX(${maxScroll > 0 ? y / maxScroll : 0})`;
    navbar.classList.toggle('is-scrolled', y > 8);

    // Which section is "current" - probe a line 35% down the viewport
    const probe = y + window.innerHeight * 0.35;
    const tops = sectionEls.map(el => el.offsetTop);
    let index = 0;
    tops.forEach((top, i) => {
        if (probe >= top) index = i;
    });

    // Rail position: station i when its section starts, interpolated towards the next one
    const last = SECTION_IDS.length - 1;
    const next = tops[index + 1];
    const frac = index < last ? clamp((probe - tops[index]) / (next - tops[index]), 0, 1) : 0;
    const position = (index + frac) / last;
    railFill.style.transform = `scaleY(${position})`;
    railVehicle.style.top = `${position * 100}%`;
    railLinks.forEach((link, i) => {
        link.classList.toggle('active', i === index);
        link.classList.toggle('passed', i < index);
    });

    // Nav highlight: nearest section at or above the current one that has a nav link
    let navId = SECTION_IDS[0];
    for (let i = index; i >= 0; i--) {
        if (navTargets.has(SECTION_IDS[i])) {
            navId = SECTION_IDS[i];
            break;
        }
    }
    navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${navId}`));

    if (maxScroll > 0 && y + window.innerHeight >= document.documentElement.scrollHeight - 6) {
        unlockBadge('end-of-line');
    }
}

window.addEventListener('scroll', () => {
    if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(onScroll);
    }
}, { passive: true });
window.addEventListener('resize', onScroll);
window.addEventListener('load', onScroll);
onScroll();

/* ==========================================================================
   Scroll reveal
   ========================================================================== */
const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('in');
        revealObserver.unobserve(el);
        // Hand the element back to its normal styles so hover effects aren't slowed by the reveal transition
        setTimeout(() => el.classList.remove('reveal', 'in'), 1200);
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

$$('.reveal').forEach(el => revealObserver.observe(el));

/* ==========================================================================
   Hero: split title, reactive dot grid, tilting phone
   ========================================================================== */
(function initHero() {
    const hero = $('#home');
    const canvas = $('#heroCanvas');
    const ctx = canvas.getContext('2d');
    const tilt = $('#phoneTilt');
    const chips = $$('.chip', tilt);
    const title = $('.hero-title .gradient-text');

    // Title: words rise in one by one
    const words = title.textContent.trim().split(/\s+/);
    title.setAttribute('aria-label', words.join(' '));
    title.innerHTML = '';
    words.forEach((word, i) => {
        const outer = document.createElement('span');
        outer.className = 'w';
        outer.setAttribute('aria-hidden', 'true');
        outer.style.setProperty('--i', i);
        const inner = document.createElement('span');
        inner.textContent = word;
        outer.appendChild(inner);
        title.appendChild(outer);
        title.appendChild(document.createTextNode(' '));
    });
    $('.hero-title').classList.add('is-split');

    // Dot grid
    const GAP = 36;
    const RADIUS = 160;
    const PULSE_LIFE = 1100;
    let width = 0;
    let height = 0;
    let dots = [];
    const pulses = [];
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, s: 0, target: 0, nx: 0, ny: 0, tnx: 0, tny: 0 };

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = hero.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dots = [];
        for (let y = GAP / 2; y < height; y += GAP) {
            for (let x = GAP / 2; x < width; x += GAP) dots.push([x, y]);
        }
    }

    function draw(now) {
        ctx.clearRect(0, 0, width, height);
        for (const [ox, oy] of dots) {
            let x = ox;
            let y = oy;
            let alpha = 0.14 + 0.05 * Math.sin(now / 1300 + (ox + oy) / 150);
            let radius = 1.3;

            if (pointer.s > 0.01) {
                const dx = ox - pointer.x;
                const dy = oy - pointer.y;
                const dist = Math.hypot(dx, dy) || 1;
                if (dist < RADIUS) {
                    const k = (1 - dist / RADIUS) * pointer.s;
                    x += (dx / dist) * k * k * 20;
                    y += (dy / dist) * k * k * 20;
                    alpha += k * 0.7;
                    radius += k * 2.2;
                }
            }

            for (const pulse of pulses) {
                const age = now - pulse.t;
                const dx = ox - pulse.x;
                const dy = oy - pulse.y;
                const dist = Math.hypot(dx, dy) || 1;
                const band = Math.abs(dist - age * 0.55);
                if (band < 48) {
                    const k = (1 - band / 48) * (1 - age / PULSE_LIFE);
                    x += (dx / dist) * k * 14;
                    y += (dy / dist) * k * 14;
                    alpha += k * 0.8;
                    radius += k * 1.8;
                }
            }

            ctx.fillStyle = `rgba(255,255,255,${clamp(alpha, 0, 1)})`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    let running = false;
    let heroVisible = true;

    function frame(now) {
        pointer.s += (pointer.target - pointer.s) * 0.08;
        pointer.x += (pointer.tx - pointer.x) * 0.2;
        pointer.y += (pointer.ty - pointer.y) * 0.2;
        pointer.nx += (pointer.tnx - pointer.nx) * 0.08;
        pointer.ny += (pointer.tny - pointer.ny) * 0.08;

        while (pulses.length && now - pulses[0].t > PULSE_LIFE) pulses.shift();
        draw(now);

        tilt.style.transform = `rotateY(${pointer.nx * 12}deg) rotateX(${-pointer.ny * 8}deg)`;
        chips.forEach(chip => {
            const depth = Number(chip.dataset.depth) || 0;
            chip.style.translate = `${pointer.nx * depth}px ${pointer.ny * depth * 0.6}px`;
        });

        if (heroVisible) requestAnimationFrame(frame);
        else running = false;
    }

    function start() {
        if (running || prefersReducedMotion) return;
        running = true;
        requestAnimationFrame(frame);
    }

    hero.addEventListener('pointermove', event => {
        const rect = hero.getBoundingClientRect();
        pointer.tx = event.clientX - rect.left;
        pointer.ty = event.clientY - rect.top;
        if (pointer.target === 0) {
            pointer.x = pointer.tx;
            pointer.y = pointer.ty;
        }
        pointer.target = 1;
        pointer.tnx = (pointer.tx / rect.width - 0.5) * 2;
        pointer.tny = (pointer.ty / rect.height - 0.5) * 2;
    });

    hero.addEventListener('pointerleave', () => {
        pointer.target = 0;
        pointer.tnx = 0;
        pointer.tny = 0;
    });

    hero.addEventListener('pointerdown', event => {
        const rect = hero.getBoundingClientRect();
        pulses.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, t: performance.now() });
    });

    new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        if (heroVisible) start();
    }).observe(hero);

    window.addEventListener('resize', () => {
        resize();
        if (prefersReducedMotion) draw(0);
    });

    resize();
    if (prefersReducedMotion) draw(0);
    else start();
})();

/* ==========================================================================
   Download: keep the QR code and version badge in sync with the APK button
   --------------------------------------------------------------------------
   To release a new version, change ONLY the href of the "Download APK" button
   in index.html. The QR code and the version badge follow it automatically.
   ========================================================================== */
(function syncDownload() {
    const apkLink = $('.btn-download');
    const qrImage = $('.qr-code img');
    const versionBadge = $('.version-badge');
    if (!apkLink) return;

    if (qrImage) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=290x290&data=${encodeURIComponent(apkLink.href)}`;
        if (qrImage.getAttribute('src') !== qrUrl) qrImage.src = qrUrl;
    }

    // GitHub release URLs look like .../releases/download/v1.0.30/file.apk
    const version = apkLink.href.match(/\/download\/(v?[\d.]+)\//);
    if (versionBadge && version) versionBadge.textContent = version[1].startsWith('v') ? version[1] : `v${version[1]}`;
})();

/* ==========================================================================
   Magnetic buttons + pointer spotlight
   ========================================================================== */
if (canHover && !prefersReducedMotion) {
    $$('.btn').forEach(btn => {
        btn.addEventListener('pointermove', event => {
            const rect = btn.getBoundingClientRect();
            const dx = (event.clientX - (rect.left + rect.width / 2)) * 0.22;
            const dy = (event.clientY - (rect.top + rect.height / 2)) * 0.3;
            btn.style.setProperty('--mx', `${dx.toFixed(1)}px`);
            btn.style.setProperty('--my', `${dy.toFixed(1)}px`);
        });
        btn.addEventListener('pointerleave', () => {
            btn.style.removeProperty('--mx');
            btn.style.removeProperty('--my');
        });
    });
}

$$('[data-spot]').forEach(el => {
    el.addEventListener('pointermove', event => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--px', `${event.clientX - rect.left}px`);
        el.style.setProperty('--py', `${event.clientY - rect.top}px`);
    });
});

/* ==========================================================================
   Route planner demo
   --------------------------------------------------------------------------
   Everything below is SAMPLE data for the website demo (a schematic map, not
   real geography). Edit STOPS / LINKS / FARE to change the demo. The x/y values
   are positions inside the 800 x 560 map drawing in index.html.
   ========================================================================== */
const STOPS = {
    malinta:     { name: 'Malinta',     city: 'Valenzuela', x: 320, y: 120 },
    karuhatan:   { name: 'Karuhatan',   city: 'Valenzuela', x: 225, y: 175 },
    bagongsilang:{ name: 'Bagong Silang', city: 'Caloocan', x: 665, y: 175 },
    monumento:   { name: 'Monumento',   city: 'Caloocan',   x: 475, y: 335 },
    potrero:     { name: 'Potrero',     city: 'Malabon',    x: 340, y: 290 },
    tonsuya:     { name: 'Tonsuya',     city: 'Malabon',    x: 220, y: 300 },
    tangos:      { name: 'Tangos',      city: 'Navotas',    x: 225, y: 410 },
    fishport:    { name: 'Fish Port',   city: 'Navotas',    x: 120, y: 480 }
};

// [from, to, minutes, km, mode]
const LINKS = [
    ['malinta', 'karuhatan', 8, 2.5, 'jeepney'],
    ['malinta', 'potrero', 14, 4.5, 'jeepney'],
    ['malinta', 'bagongsilang', 24, 9, 'jeepney'],
    ['karuhatan', 'tonsuya', 12, 3.8, 'jeepney'],
    ['potrero', 'monumento', 12, 4, 'jeepney'],
    ['potrero', 'tonsuya', 7, 2, 'tricycle'],
    ['tonsuya', 'tangos', 9, 3, 'jeepney'],
    ['tangos', 'fishport', 6, 1.8, 'tricycle'],
    ['monumento', 'bagongsilang', 25, 10, 'jeepney'],
    ['monumento', 'tangos', 18, 6, 'jeepney']
];

// Placeholder fare values - replace with real ones if you want the demo to match the app.
const FARE = { jeepneyBase: 13, jeepneyBaseKm: 4, jeepneyPerKm: 1.8, tricycle: 20 };

const MODE_INFO = {
    jeepney: { label: 'Jeepney', icon: 'fa-bus' },
    tricycle: { label: 'Tricycle', icon: 'fa-motorcycle' }
};

(function initPlanner() {
    const MAP_W = 800;
    const MAP_H = 560;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const wrap = $('#mapWrap');
    const plane = $('#mapPlane');
    const edgesGroup = $('#edges');
    const routeGroup = $('#routeGroup');
    const routePath = $('#routePath');
    const routeGlow = $('#routeGlow');
    const vehicle = $('#vehicle');
    const fromSel = $('#fromSel');
    const toSel = $('#toSel');
    const resultEl = $('#result');
    const view3dBtn = $('#view3d');

    // Graph
    const adjacency = {};
    Object.keys(STOPS).forEach(id => (adjacency[id] = []));
    LINKS.forEach(([a, b, min, km, mode]) => {
        adjacency[a].push({ to: b, min, km, mode });
        adjacency[b].push({ to: a, min, km, mode });

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', STOPS[a].x);
        line.setAttribute('y1', STOPS[a].y);
        line.setAttribute('x2', STOPS[b].x);
        line.setAttribute('y2', STOPS[b].y);
        line.setAttribute('class', `edge${mode === 'tricycle' ? ' is-tricycle' : ''}`);
        edgesGroup.appendChild(line);
    });

    // Pins
    const pins = {};
    Object.entries(STOPS).forEach(([id, stop]) => {
        const pin = document.createElement('div');
        pin.className = 'pin';
        pin.style.left = `${(stop.x / MAP_W) * 100}%`;
        pin.style.top = `${(stop.y / MAP_H) * 100}%`;
        pin.innerHTML = '<button type="button"><span class="pin-dot"></span><span class="pin-label"></span></button>';
        const button = $('button', pin);
        button.setAttribute('aria-label', `${stop.name}, ${stop.city}`);
        $('.pin-label', pin).textContent = stop.name;
        button.addEventListener('click', () => onPin(id));
        plane.appendChild(pin);
        pins[id] = pin;
    });

    // Selects
    function fillSelect(select, placeholder) {
        select.innerHTML = '';
        const empty = new Option(placeholder, '');
        select.appendChild(empty);
        const cities = [...new Set(Object.values(STOPS).map(s => s.city))].sort();
        cities.forEach(city => {
            const group = document.createElement('optgroup');
            group.label = city;
            Object.entries(STOPS)
                .filter(([, s]) => s.city === city)
                .forEach(([id, s]) => group.appendChild(new Option(s.name, id)));
            select.appendChild(group);
        });
    }
    fillSelect(fromSel, 'Choose a start');
    fillSelect(toSel, 'Choose a destination');

    // Routing (Dijkstra by travel time)
    function findRoute(from, to) {
        const dist = {};
        const prev = {};
        const todo = new Set(Object.keys(STOPS));
        todo.forEach(id => (dist[id] = Infinity));
        dist[from] = 0;

        while (todo.size) {
            let u = null;
            todo.forEach(id => {
                if (u === null || dist[id] < dist[u]) u = id;
            });
            if (dist[u] === Infinity || u === to) break;
            todo.delete(u);
            adjacency[u].forEach(link => {
                const alt = dist[u] + link.min;
                if (alt < dist[link.to]) {
                    dist[link.to] = alt;
                    prev[link.to] = { from: u, link };
                }
            });
        }

        if (!prev[to]) return null;
        const legs = [];
        for (let node = to; node !== from; node = prev[node].from) {
            legs.unshift({ from: prev[node].from, to: node, ...prev[node].link });
        }
        return legs;
    }

    function legFare(leg) {
        if (leg.mode === 'tricycle') return FARE.tricycle;
        return Math.max(FARE.jeepneyBase, FARE.jeepneyBase + FARE.jeepneyPerKm * (leg.km - FARE.jeepneyBaseKm));
    }

    // Drawing
    let animation = 0;

    function drawRoute(stopIds) {
        cancelAnimationFrame(animation);
        const d = 'M' + stopIds.map(id => `${STOPS[id].x} ${STOPS[id].y}`).join(' L');
        routePath.setAttribute('d', d);
        routeGlow.setAttribute('d', d);
        routeGroup.classList.add('visible');

        const length = routePath.getTotalLength();
        const duration = prefersReducedMotion ? 0 : 500 + length * 2.2;
        const start = performance.now();

        function step(now) {
            const t = duration ? Math.min(1, (now - start) / duration) : 1;
            const eased = 1 - Math.pow(1 - t, 3);
            [routePath, routeGlow].forEach(path => {
                path.style.strokeDasharray = length;
                path.style.strokeDashoffset = length * (1 - eased);
            });
            const point = routePath.getPointAtLength(length * eased);
            vehicle.setAttribute('transform', `translate(${point.x} ${point.y})`);
            if (t < 1) animation = requestAnimationFrame(step);
        }
        animation = requestAnimationFrame(step);
    }

    function clearRoute() {
        cancelAnimationFrame(animation);
        routeGroup.classList.remove('visible');
    }

    function renderEmpty(message) {
        resultEl.innerHTML = '<div class="result-empty"><div><i class="fas fa-location-crosshairs" aria-hidden="true"></i><span></span></div></div>';
        $('span', resultEl).textContent = message;
    }

    function renderResult(legs) {
        const minutes = legs.reduce((sum, l) => sum + l.min, 0);
        const km = legs.reduce((sum, l) => sum + l.km, 0);
        const fare = legs.reduce((sum, l) => sum + legFare(l), 0);
        const low = Math.round(fare);
        const high = Math.max(low + 2, Math.round(fare * 1.15));

        resultEl.innerHTML = `
            <div class="stats">
                <div><span>Est. time</span><strong>${minutes} min</strong></div>
                <div><span>Fare estimate</span><strong>₱${low}–₱${high}</strong></div>
                <div><span>Distance</span><strong>${km.toFixed(1)} km</strong></div>
            </div>
            <ol class="legs">
                ${legs.map((leg, n) => `
                    <li style="--n:${n}">
                        <i class="fas ${MODE_INFO[leg.mode].icon}" aria-hidden="true"></i>
                        <span>${STOPS[leg.from].name} to ${STOPS[leg.to].name}
                            <small>${MODE_INFO[leg.mode].label} · ${leg.min} min</small>
                        </span>
                    </li>`).join('')}
            </ol>
            <p class="note">Illustrative demo values, not official fares.</p>`;
    }

    // State
    const state = { from: '', to: '' };

    function sync(fromUser) {
        fromSel.value = state.from;
        toSel.value = state.to;

        Object.entries(pins).forEach(([id, pin]) => {
            pin.classList.toggle('is-from', id === state.from);
            pin.classList.toggle('is-to', id === state.to);
            pin.classList.remove('is-on-route');
        });

        if (!state.from || !state.to) {
            clearRoute();
            renderEmpty(state.from ? 'Now pick a destination.' : 'Tap two stops on the map, or use the lists above.');
            return;
        }
        if (state.from === state.to) {
            clearRoute();
            renderEmpty('Pick two different stops.');
            return;
        }

        const legs = findRoute(state.from, state.to);
        if (!legs) {
            clearRoute();
            renderEmpty('No sample route between those stops.');
            return;
        }

        const ids = [legs[0].from, ...legs.map(l => l.to)];
        ids.forEach(id => pins[id].classList.add('is-on-route'));
        drawRoute(ids);
        renderResult(legs);
        if (fromUser) unlockBadge('first-ride');
    }

    function onPin(id) {
        unlockBadge('pin-dropper');

        const ping = document.createElement('span');
        ping.className = 'ping';
        pins[id].appendChild(ping);
        setTimeout(() => ping.remove(), 900);

        if (!state.from || state.to) {
            state.from = id;
            state.to = '';
        } else if (id !== state.from) {
            state.to = id;
        }
        sync(true);
    }

    fromSel.addEventListener('change', () => { state.from = fromSel.value; sync(true); });
    toSel.addEventListener('change', () => { state.to = toSel.value; sync(true); });

    $('#swapBtn').addEventListener('click', () => {
        [state.from, state.to] = [state.to, state.from];
        sync(true);
    });

    $('#clearRoute').addEventListener('click', () => {
        state.from = '';
        state.to = '';
        sync(false);
    });

    view3dBtn.addEventListener('click', () => {
        const on = wrap.classList.toggle('is-3d');
        view3dBtn.setAttribute('aria-pressed', String(on));
        $('span', view3dBtn).textContent = on ? 'Back to 2D' : 'View in 3D';
        if (on) unlockBadge('map-explorer');
    });

    // Show a sample trip the first time the planner scrolls into view
    renderEmpty('Tap two stops on the map, or use the lists above.');
    const demoObserver = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        demoObserver.disconnect();
        if (!state.from && !state.to) {
            state.from = 'malinta';
            state.to = 'monumento';
            sync(false);
        }
    }, { threshold: 0.45 });
    demoObserver.observe(wrap);
})();

/* ==========================================================================
   Feature explorer (tabs) + sample community feed
   ========================================================================== */
(function initExplorer() {
    const tabs = $$('[role="tab"]', $('#explorer'));
    const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    const seen = new Set();

    function select(index, focus) {
        tabs.forEach((tab, i) => {
            const on = i === index;
            tab.setAttribute('aria-selected', String(on));
            tab.tabIndex = on ? 0 : -1;
            panels[i].hidden = !on;
        });
        seen.add(index);
        if (seen.size === tabs.length) unlockBadge('feature-hunter');
        if (focus) tabs[index].focus();
        feedPanelOpen = index === 0;
    }

    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(i));
        tab.addEventListener('keydown', event => {
            const last = tabs.length - 1;
            const keys = {
                ArrowDown: Math.min(i + 1, last),
                ArrowRight: Math.min(i + 1, last),
                ArrowUp: Math.max(i - 1, 0),
                ArrowLeft: Math.max(i - 1, 0),
                Home: 0,
                End: last
            };
            if (event.key in keys) {
                event.preventDefault();
                select(keys[event.key], true);
            }
        });
    });

    // Sample feed
    const feed = $('#feed');
    const AGES = ['just now', '1 min ago', '3 min ago', '6 min ago'];
    const MAX_ITEMS = AGES.length;
    const POOL = [
        'Smooth traffic near Monumento',
        'Long queue at the Malinta terminal',
        'Jeepneys loading at Potrero',
        'Heavy traffic near the Fish Port',
        'Karuhatan terminal moving fast',
        'Tonsuya route running normally',
        'Light rain, expect slower trips'
    ];
    let feedPanelOpen = true;
    let feedVisible = false;

    function refreshAges() {
        $$('time', feed).forEach((time, i) => (time.textContent = AGES[i]));
    }

    function addItem(text, mine) {
        const li = document.createElement('li');
        li.className = `new${mine ? ' mine' : ''}`;
        li.innerHTML = `<i class="fas ${mine ? 'fa-user' : 'fa-circle-exclamation'}" aria-hidden="true"></i><span></span><time></time>`;
        $('span', li).textContent = mine ? `You: ${text}` : text;
        feed.prepend(li);
        while (feed.children.length > MAX_ITEMS) feed.lastElementChild.remove();
        refreshAges();
        setTimeout(() => li.classList.remove('new'), 700);
    }

    function pickUnused() {
        const used = $$('li span', feed).map(s => s.textContent.replace(/^You: /, ''));
        const free = POOL.filter(text => !used.includes(text));
        return free[Math.floor(Math.random() * free.length)];
    }

    POOL.slice(0, 3).reverse().forEach(text => addItem(text, false));

    $('#shareUpdate').addEventListener('click', () => {
        addItem(pickUnused(), true);
        unlockBadge('community-voice');
    });

    new IntersectionObserver(([entry]) => {
        feedVisible = entry.isIntersecting;
    }).observe(feed);

    if (!prefersReducedMotion) {
        setInterval(() => {
            if (feedPanelOpen && feedVisible && !document.hidden) addItem(pickUnused(), false);
        }, 5500);
    }

    select(0);
})();
