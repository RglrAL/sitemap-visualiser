/*
 * sitemap-geomap.js — interactive geographic maps for the dashboard's Geographic tab.
 *
 * Ireland choropleth: counties shaded pale→teal by GA4 users. Self-contained —
 * loads ireland-counties.geo.json (same-origin, ~39KB, embedded at build time, no
 * runtime CDN/CORS) and renders with the already-loaded d3-geo. Init is triggered
 * by an <img onload> in the markup (survives innerHTML injection), reading the
 * region data stashed on window.__svGeoData by createInteractiveIrelandMap().
 */
(function () {
    'use strict';

    let _geo = null, _loading = null;
    function loadGeo() {
        if (_geo) return Promise.resolve(_geo);
        if (_loading) return _loading;
        _loading = fetch('ireland-counties.geo.json').then(r => r.json()).then(j => { _geo = j; return j; });
        return _loading;
    }

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
    function fmt(n) { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(Math.round(n)); }

    // Normalise a county/region name so GA4's names match the geojson's.
    const ALIAS = { laois: 'laoighis', queens: 'laoighis', kings: 'offaly', 'derry': 'northernireland', 'londonderry': 'northernireland', antrim: 'northernireland', armagh: 'northernireland', down: 'northernireland', fermanagh: 'northernireland', tyrone: 'northernireland', belfast: 'northernireland' };
    function key(s) {
        let k = String(s || '').toLowerCase()
            .replace(/^county\s+/, '').replace(/^co\.?\s+/, '')
            .replace(/\s+city$/, '').replace(/\s+county$/, '')
            .replace(/[^a-z]/g, '');
        return ALIAS[k] || k;
    }

    function ensureStyle() {
        if (document.getElementById('sv-geomap-style')) return;
        const s = document.createElement('style');
        s.id = 'sv-geomap-style';
        s.textContent = [
            // Fixed equal height so the Ireland (portrait) and World (landscape) maps
            // line up and the content below both cards aligns. SVGs letterbox inside.
            '.sv-choropleth-wrap{position:relative;width:100%;margin:0 auto;height:400px;}',
            '.sv-choropleth{width:100%;height:100%;display:block;}',
            '.sv-choropleth-tip{position:absolute;pointer-events:none;display:none;z-index:50;background:var(--color-bg-elevated,#1f2937);color:#fff;font-size:0.74rem;line-height:1.5;padding:8px 11px;border-radius:7px;box-shadow:0 6px 18px rgba(0,0,0,0.28);white-space:nowrap;font-weight:500;}',
            '.sv-choropleth-legend{display:flex;align-items:center;justify-content:center;gap:8px;font-size:0.68rem;color:var(--color-text-muted);margin-top:6px;}',
            '.sv-legend-ramp{display:inline-block;width:64px;height:9px;border-radius:3px;background:linear-gradient(90deg,rgba(0,124,182,0.18),rgba(0,124,182,0.92));}'
        ].join('');
        document.head.appendChild(s);
    }

    async function initIreland(uid) {
        const svg = document.getElementById(uid);
        if (!svg || svg._svDone) return;
        svg._svDone = true;
        ensureStyle();
        const regions = (window.__svGeoData || {})[uid] || [];
        let geo;
        try { geo = await loadGeo(); } catch (e) { return; }
        if (typeof d3 === 'undefined' || !d3.geoMercator || !d3.geoPath) return;

        const byCounty = {}; let maxU = 0;
        regions.forEach(r => {
            const k = key(r.region);
            const u = Number(r.users) || 0;
            byCounty[k] = { users: u, pct: Number(r.percentage) || 0, name: r.region };
            if (u > maxU) maxU = u;
        });

        const W = 440, H = 500;
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        const proj = d3.geoMercator().fitSize([W - 12, H - 12], geo);
        const path = d3.geoPath(proj);
        const dark = document.body.classList.contains('dark-theme');
        const noData = dark ? '#2a3340' : '#e8edf1';
        const strokeBase = dark ? '#151b23' : '#ffffff';
        const hoverStroke = dark ? '#7dd3fc' : '#007cb6';
        const tip = document.getElementById(uid + '-tip');
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const NS = 'http://www.w3.org/2000/svg';
        geo.features.forEach(f => {
            const cname = f.properties.county;
            const d = byCounty[key(cname)];
            const op = (d && maxU > 0) ? (0.18 + (d.users / maxU) * 0.74) : 0;
            const fill = d ? 'rgba(0,124,182,' + op.toFixed(2) + ')' : noData;
            const dstr = path(f);
            if (!dstr) return;
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', dstr);
            p.setAttribute('fill', fill);
            p.setAttribute('stroke', strokeBase);
            p.setAttribute('stroke-width', '0.6');
            p.setAttribute('stroke-linejoin', 'round');
            p.style.transition = 'fill .15s';
            p.style.cursor = d ? 'pointer' : 'default';
            p.addEventListener('mouseenter', function () { p.setAttribute('stroke', hoverStroke); p.setAttribute('stroke-width', '1.5'); p.parentNode.appendChild(p); });
            p.addEventListener('mouseleave', function () { p.setAttribute('stroke', strokeBase); p.setAttribute('stroke-width', '0.6'); if (tip) tip.style.display = 'none'; });
            p.addEventListener('mousemove', function (ev) {
                if (!tip) return;
                tip.style.display = 'block';
                tip.innerHTML = d
                    ? '<strong>' + esc(d.name) + '</strong><br>' + fmt(d.users) + ' users · ' + d.pct.toFixed(1) + '%'
                    : '<strong>' + esc(cname) + '</strong><br>no data';
                const wrap = svg.parentElement.getBoundingClientRect();
                let x = ev.clientX - wrap.left + 12, y = ev.clientY - wrap.top + 12;
                if (x > wrap.width - 120) x = ev.clientX - wrap.left - 120;
                tip.style.left = x + 'px';
                tip.style.top = y + 'px';
            });
            svg.appendChild(p);
        });
    }

    // ── World bubble map (international) ──
    let _world = null, _wLoading = null;
    function loadWorld() {
        if (_world) return Promise.resolve(_world);
        if (_wLoading) return _wLoading;
        _wLoading = fetch('world-countries.geo.json').then(r => r.json()).then(j => { _world = j; return j; });
        return _wLoading;
    }
    const CALIAS = {
        unitedstates: 'unitedstatesofamerica', usa: 'unitedstatesofamerica', us: 'unitedstatesofamerica', america: 'unitedstatesofamerica',
        uk: 'unitedkingdom', greatbritain: 'unitedkingdom', britain: 'unitedkingdom', england: 'unitedkingdom', scotland: 'unitedkingdom', wales: 'unitedkingdom',
        russia: 'russia', southkorea: 'southkorea', czechia: 'czechrepublic', uae: 'unitedarabemirates'
    };
    function ckey(s) {
        let k = String(s || '').toLowerCase().replace(/[^a-z]/g, '');
        return CALIAS[k] || k;
    }

    async function initWorld(uid) {
        const svg = document.getElementById(uid);
        if (!svg || svg._svDone) return;
        svg._svDone = true;
        ensureStyle();
        const countries = (window.__svGeoData || {})[uid] || [];
        let geo;
        try { geo = await loadWorld(); } catch (e) { return; }
        if (typeof d3 === 'undefined' || !d3.geoNaturalEarth1 || !d3.geoPath) return;

        const byC = {}; let maxU = 0;
        countries.forEach(c => {
            const u = Number(c.users) || 0;
            byC[ckey(c.country)] = { users: u, pct: Number(c.percentage) || 0, name: c.country };
            if (u > maxU) maxU = u;
        });

        const W = 640, H = 340;
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        const proj = d3.geoNaturalEarth1().fitSize([W - 8, H - 8], geo);
        const path = d3.geoPath(proj);
        const dark = document.body.classList.contains('dark-theme');
        const land = dark ? '#232c37' : '#e8edf1';
        const landStroke = dark ? '#2f3a47' : '#d5dde4';
        const tip = document.getElementById(uid + '-tip');
        const NS = 'http://www.w3.org/2000/svg';
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        // faint land for context
        geo.features.forEach(f => {
            const dstr = path(f);
            if (!dstr) return;
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', dstr);
            p.setAttribute('fill', land);
            p.setAttribute('stroke', landStroke);
            p.setAttribute('stroke-width', '0.4');
            svg.appendChild(p);
        });

        // bubbles at country centroids
        const maxR = 22;
        const idx = {};
        geo.features.forEach(f => { idx[ckey(f.properties.name)] = f; });
        const rows = countries.slice().sort((a, b) => (b.users || 0) - (a.users || 0));
        rows.forEach(c => {
            const f = idx[ckey(c.country)];
            if (!f) return;
            let cen;
            try { cen = proj(d3.geoCentroid(f)); } catch (e) { return; }
            if (!cen || !isFinite(cen[0]) || !isFinite(cen[1])) return;
            const u = Number(c.users) || 0;
            const r = maxU > 0 ? Math.max(3, maxR * Math.sqrt(u / maxU)) : 4;
            const circ = document.createElementNS(NS, 'circle');
            circ.setAttribute('cx', cen[0]); circ.setAttribute('cy', cen[1]); circ.setAttribute('r', r);
            circ.setAttribute('fill', 'rgba(0,124,182,0.55)');
            circ.setAttribute('stroke', '#007cb6'); circ.setAttribute('stroke-width', '1');
            circ.style.cursor = 'pointer'; circ.style.transition = 'fill .15s';
            const nm = c.country, pct = (Number(c.percentage) || 0).toFixed(1);
            circ.addEventListener('mouseenter', function () { circ.setAttribute('fill', 'rgba(0,124,182,0.8)'); });
            circ.addEventListener('mouseleave', function () { circ.setAttribute('fill', 'rgba(0,124,182,0.55)'); if (tip) tip.style.display = 'none'; });
            circ.addEventListener('mousemove', function (ev) {
                if (!tip) return;
                tip.style.display = 'block';
                tip.innerHTML = '<strong>' + esc(nm) + '</strong><br>' + fmt(u) + ' users · ' + pct + '%';
                const wrap = svg.parentElement.getBoundingClientRect();
                let x = ev.clientX - wrap.left + 12, y = ev.clientY - wrap.top + 12;
                if (x > wrap.width - 130) x = ev.clientX - wrap.left - 130;
                tip.style.left = x + 'px'; tip.style.top = y + 'px';
            });
            svg.appendChild(circ);
        });
    }

    window.SVGeoMap = { initIreland: initIreland, initWorld: initWorld, _key: key, _ckey: ckey };
})();
