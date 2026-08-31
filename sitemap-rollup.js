/*
 * sitemap-rollup.js — Category/branch-level analytics rollup engine.
 *
 * The sitemap tree IS the category taxonomy: any node's stats = the sum of its
 * subtree's page stats. This engine walks the tree once and attaches, to every
 * node, both its own-page stats and the aggregated stats of its whole subtree —
 * with COUNTS summed and RATES (CTR, position) impression-weighted (the correct
 * way; naive averaging of rates is wrong).
 *
 * Public API (window.SVRollup):
 *   build(tree, opts?)   → annotates every node with .rollup (subtree) and
 *                          .rollupSelf (own page); returns { tree, byUrl, categories, totals }.
 *   statsForUrl(url)     → live per-URL stats pulled from GSC (+ GA4 if prefetched).
 *   prefetchGA4(tree)    → async; one-ish bulk pass to fill the GA4 map (best effort).
 *   selfTest()           → runs synthetic assertions, returns {passed, results}.
 *
 * Data sourcing today:
 *   - GSC: window.GSCIntegration.getData(url) — already a full per-URL map after
 *     the module's bulk fetch. No extra calls needed.
 *   - GA4: exposes only per-page fetchData; prefetchGA4() fills a map from it.
 *     (A single runReport with dimensions:[pagePath] would be ideal — TODO in the
 *     GA4 module — but the engine is agnostic to how the map gets filled.)
 */
(function () {
    'use strict';

    // GA4 per-URL stats, filled by prefetchGA4() (path -> {pageViews, users, ...})
    let _ga4Map = Object.create(null);
    // GSC per-URL stats, filled by prefetchGSC() (normUrl -> {impressions, clicks, ctr, position})
    let _gscMap = Object.create(null);

    function num(v) { const n = Number(v); return isFinite(n) ? n : 0; }

    function normUrl(u) {
        if (!u) return '';
        let s = String(u).trim();
        try { s = decodeURI(s); } catch (e) {}
        s = s.replace(/#.*$/, '').replace(/\?.*$/, '');   // drop hash/query
        if (s.length > 1) s = s.replace(/\/+$/, '');       // drop trailing slash(es)
        return s.toLowerCase();
    }

    // ── aggregation accumulator ──
    // pageCount = every URL-bearing node (incl. section/landing pages — needed so analytics tally).
    // leafCount = leaf pages only (matches the Content-by-Category report's "Pages").
    function emptyAgg() {
        return { impressions: 0, clicks: 0, pageViews: 0, users: 0,
                 _posSum: 0, _posWeight: 0, pageCount: 0, leafCount: 0, pagesWithData: 0 };
    }
    function addSelf(agg, s, isPage, isLeaf) {
        if (isPage) agg.pageCount += 1;
        if (isLeaf) agg.leafCount += 1;
        if (!s) return;
        const imp = num(s.impressions), clk = num(s.clicks),
              pv = num(s.pageViews), us = num(s.users), pos = num(s.position);
        agg.impressions += imp; agg.clicks += clk; agg.pageViews += pv; agg.users += us;
        if (imp > 0 && pos > 0) { agg._posSum += pos * imp; agg._posWeight += imp; }
        if (imp || clk || pv || us) agg.pagesWithData += 1;
    }
    function mergeAgg(into, from) {
        into.impressions += from.impressions; into.clicks += from.clicks;
        into.pageViews += from.pageViews;     into.users += from.users;
        into._posSum += from._posSum;         into._posWeight += from._posWeight;
        into.pageCount += from.pageCount;     into.leafCount += from.leafCount;
        into.pagesWithData += from.pagesWithData;
    }
    function finalize(agg) {
        return {
            impressions: agg.impressions,
            clicks: agg.clicks,
            pageViews: agg.pageViews,
            users: agg.users,
            ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
            position: agg._posWeight > 0 ? agg._posSum / agg._posWeight : null,
            pageCount: agg.pageCount,
            leafCount: agg.leafCount,
            pagesWithData: agg.pagesWithData
        };
    }

    // ── live per-URL stats: prefer the bulk maps; fall back to GSC's per-node getData ──
    function statsForUrl(url) {
        const out = {};
        const key = normUrl(url);
        const g = _gscMap[key];
        if (g) { out.impressions = g.impressions; out.clicks = g.clicks; out.position = g.position; }
        else {
            const gsc = window.GSCIntegration;
            if (gsc && typeof gsc.getData === 'function') {
                const gg = gsc.getData(url) || gsc.getData(key);
                if (gg) { out.impressions = gg.impressions; out.clicks = gg.clicks; out.position = gg.position; }
            }
        }
        const ga = _ga4Map[key] || _ga4Map[url];
        if (ga) { out.pageViews = ga.pageViews; out.users = ga.users; }
        return out;
    }

    // ── bulk GSC prefetch: ONE query for the whole property ──
    async function prefetchGSC(tree, days) {
        const gsc = window.GSCIntegration;
        if (!gsc || !gsc.isConnected || !gsc.isConnected() || typeof gsc.fetchAllPages !== 'function') return _gscMap;
        const byUrl = await gsc.fetchAllPages({ days: days || 30 });
        _gscMap = Object.create(null);
        byUrl.forEach(function (rec, url) { _gscMap[normUrl(url)] = rec; });
        return _gscMap;
    }

    // ── category picker: skip a language-code top level (e.g. CI's /en/, /ga/) ──
    const LANG_RE = /^(en|ga|gd|cy|fr|de|es|it|pl|pt|ro|ru|lt|lv|nl|sv|no|da|fi|cs|sk|hu|el|zh|ar|uk|bg)$/i;
    function isLangNode(n) { return n && n.name && LANG_RE.test(String(n.name).trim()); }
    function pickCategories(tree) {
        let cats = (tree.children || []).slice();
        // If the whole top level looks like language codes, descend one level.
        if (cats.length && cats.every(isLangNode)) {
            cats = cats.reduce(function (acc, lang) { return acc.concat(lang.children || []); }, []);
        }
        return cats;
    }

    // ── the core walk (post-order): O(n), one pass ──
    function build(tree, opts) {
        opts = opts || {};
        const statsFor = opts.statsFor || statsForUrl;
        const byUrl = Object.create(null);

        function walk(node) {
            const agg = emptyAgg();
            const isPage = !!node.url;
            const kids = node.children || node._children || [];
            const isLeaf = isPage && kids.length === 0;
            const self = isPage ? (statsFor(node.url) || {}) : null;
            addSelf(agg, self, isPage, isLeaf);

            for (let i = 0; i < kids.length; i++) mergeAgg(agg, walk(kids[i]));

            node.rollup = finalize(agg);                       // whole subtree
            node._agg = agg;                                   // raw accumulator (for correct merging)
            const selfAgg = emptyAgg(); addSelf(selfAgg, self, isPage, isLeaf);
            node.rollupSelf = finalize(selfAgg);               // this page only
            if (isPage) byUrl[normUrl(node.url)] = node.rollupSelf;
            return agg;
        }

        const rootAgg = walk(tree);
        // Categories = top-level sections (skipping a language-code level), MERGED by name
        // so a section that exists in several languages (CI's /en/ + /ga/) is one card.
        const merged = new Map();
        pickCategories(tree).forEach(function (c) {
            const key = String(c.name || '').trim().toLowerCase();
            if (!merged.has(key)) merged.set(key, { name: c.name, url: c.url || null, agg: emptyAgg(), nodes: [] });
            const m = merged.get(key);
            mergeAgg(m.agg, c._agg);
            m.nodes.push(c);
        });
        const categories = Array.from(merged.values()).map(function (m) {
            return { name: m.name, url: m.url, rollup: finalize(m.agg), nodes: m.nodes };
        }).sort(function (a, b) {
            if (b.rollup.impressions !== a.rollup.impressions) return b.rollup.impressions - a.rollup.impressions;
            return b.rollup.pageViews - a.rollup.pageViews;   // fall back to GA4 when no GSC
        });

        return { tree: tree, byUrl: byUrl, categories: categories, totals: finalize(rootAgg) };
    }

    // ── GA4 prefetch: ONE bulk call (fetchAllPages) when available; per-page fallback ──
    async function prefetchGA4(tree, opts) {
        opts = opts || {};
        const ga4 = window.GA4Integration;
        if (!ga4 || !ga4.isConnected || !ga4.isConnected()) return _ga4Map;

        const urls = [];
        (function collect(n) {
            if (n.url) urls.push(n.url);
            (n.children || n._children || []).forEach(collect);
        })(tree);

        // Preferred: single runReport for the whole property, keyed by pagePath.
        if (typeof ga4.fetchAllPages === 'function') {
            const byPath = await ga4.fetchAllPages({ days: opts.days || 30, limit: opts.limit });
            const toPath = (typeof ga4.urlToPath === 'function') ? ga4.urlToPath : function (u) { return u; };
            urls.forEach(function (url) {
                const rec = byPath.get(toPath(url));
                if (rec) _ga4Map[normUrl(url)] = { pageViews: num(rec.pageViews), users: num(rec.users) };
            });
            return _ga4Map;
        }

        // Fallback: per-page (slower) — used only if the bulk method isn't present.
        if (typeof ga4.fetchData !== 'function') return _ga4Map;
        const limit = opts.limit || urls.length;
        const conc = opts.concurrency || 4;
        let i = 0;
        async function worker() {
            while (i < Math.min(limit, urls.length)) {
                const url = urls[i++];
                try {
                    const d = await ga4.fetchData(url);
                    if (d) _ga4Map[normUrl(url)] = { pageViews: num(d.pageViews), users: num(d.users) };
                } catch (e) { /* skip */ }
            }
        }
        await Promise.all(Array.from({ length: conc }, worker));
        return _ga4Map;
    }

    // ── synthetic self-test: proves sum + impression-weighting are correct ──
    function selfTest() {
        // Tree: Root → [A → (A1, A2), B → (B1)]
        const tree = {
            name: 'Root', url: 'https://x/',
            children: [
                { name: 'A', url: 'https://x/a', children: [
                    { name: 'A1', url: 'https://x/a/1' },
                    { name: 'A2', url: 'https://x/a/2' }
                ]},
                { name: 'B', url: 'https://x/b', children: [
                    { name: 'B1', url: 'https://x/b/1' }
                ]}
            ]
        };
        const S = {
            'https://x/':     { impressions: 0,    clicks: 0,  position: 0 },
            'https://x/a':    { impressions: 100,  clicks: 10, position: 5 },
            'https://x/a/1':  { impressions: 300,  clicks: 30, position: 3 },
            'https://x/a/2':  { impressions: 100,  clicks: 5,  position: 10 },
            'https://x/b':    { impressions: 200,  clicks: 40, position: 2 }
            // B1 intentionally has no data
        };
        const r = build(tree, { statsFor: function (u) { return S[u] || {}; } });
        const A = r.categories.find(c => c.name === 'A').rollup;
        const results = [];
        function check(name, got, want) {
            const ok = Math.abs(got - want) < 1e-9;
            results.push({ name, got, want, ok });
            return ok;
        }
        // A subtree impressions = 100 + 300 + 100 = 500
        check('A.impressions', A.impressions, 500);
        // A subtree clicks = 10 + 30 + 5 = 45  →  CTR = 45/500 = 0.09
        check('A.ctr', A.ctr, 0.09);
        // A position impression-weighted = (5*100 + 3*300 + 10*100)/500 = 2400/500 = 4.8
        check('A.position', A.position, 4.8);
        // A pages counted = 3 (a, a1, a2); pagesWithData = 3
        check('A.pageCount', A.pageCount, 3);
        check('A.pagesWithData', A.pagesWithData, 3);
        // Totals: impressions = 500 + 200 = 700 (B1 no data), clicks = 45 + 40 = 85
        check('totals.impressions', r.totals.impressions, 700);
        check('totals.clicks', r.totals.clicks, 85);
        // totals.position weighted = (2400 + 2*200)/700 = 2800/700 = 4.0
        check('totals.position', r.totals.position, 4.0);
        // pageCount = 6 pages total (Root, A, A1, A2, B, B1 all have URLs); pagesWithData = 4 (Root+B1 empty)
        check('totals.pageCount', r.totals.pageCount, 6);
        check('totals.pagesWithData', r.totals.pagesWithData, 4);
        const passed = results.every(r => r.ok);
        return { passed, results };
    }

    // ── formatting + escaping for the UI ──
    function fmt(n) {
        n = num(n);
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(Math.round(n));
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    // Keyword-matched line icon for a category name (Feather-style, inherits colour).
    function catIcon(name, size) {
        size = size || 18;
        const n = String(name || '').toLowerCase();
        const body =
            /welfare|social/.test(n) ? '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21l8.84-8.84a5.5 5.5 0 0 0 0-7.55z"/>' :
            /new|latest|update/.test(n) ? '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' :
            /money|tax|financ|payment|budget/.test(n) ? '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>' :
            /employ|work|job|career/.test(n) ? '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>' :
            /government|gov|state/.test(n) ? '<line x1="3" y1="21" x2="21" y2="21"/><line x1="6" y1="21" x2="6" y2="9"/><line x1="10" y1="21" x2="10" y2="9"/><line x1="14" y1="21" x2="14" y2="9"/><line x1="18" y1="21" x2="18" y2="9"/><polygon points="12 2 3 9 21 9"/>' :
            /hous|home|accommodat|rent/.test(n) ? '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' :
            /travel|recreation|leisure|holiday/.test(n) ? '<path d="M17.8 19.2 16 11l3.5-3.5c1.5-1.5 2-3.5 1.5-4-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.2L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.2.3l.5-.2c.5-.3.7-.7.6-1.2z"/>' :
            /justice|law|legal|court|rights/.test(n) ? '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' :
            /moving|emigrat|abroad/.test(n) ? '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' :
            /health|medical|hospital/.test(n) ? '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' :
            /educat|school|learn|student|training/.test(n) ? '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 2 6 2s6-1 6-2v-5"/>' :
            /birth|family|relationship|child|marriage/.test(n) ? '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' :
            /consumer|shopping|purchas|goods/.test(n) ? '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>' :
            /return|coming back/.test(n) ? '<polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>' :
            /environment|climate|nature|energy/.test(n) ? '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 22 17 7"/>' :
            /death|bereave|funeral|will/.test(n) ? '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' :
            /about|info/.test(n) ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' :
            /situation/.test(n) ? '<circle cx="12" cy="12" r="10"/><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8"/>' :
            /all categor/.test(n) ? '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' :
            '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>';
        return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
    }

    // ── Biggest movers: current period vs the prior period, by section ──
    function statsForMaps(gscBy, ga4By) {
        return function (url) {
            const key = normUrl(url), out = {};
            const g = gscBy[key]; if (g) { out.impressions = g.impressions; out.clicks = g.clicks; out.position = g.position; }
            const a = ga4By[key]; if (a) { out.pageViews = a.pageViews; out.users = a.users; }
            return out;
        };
    }
    async function fetchPeriodMaps(tree, days, offset) {
        const gscBy = Object.create(null), ga4By = Object.create(null);
        const gsc = window.GSCIntegration, ga4 = window.GA4Integration;
        const jobs = [];
        if (gsc && gsc.isConnected && gsc.isConnected() && gsc.fetchAllPages) {
            jobs.push(gsc.fetchAllPages({ days: days, offset: offset }).then(function (m) {
                m.forEach(function (rec, url) { gscBy[normUrl(url)] = rec; });
            }));
        }
        if (ga4 && ga4.isConnected && ga4.isConnected() && ga4.fetchAllPages) {
            const toPath = (typeof ga4.urlToPath === 'function') ? ga4.urlToPath : function (u) { return u; };
            jobs.push(ga4.fetchAllPages({ days: days, offset: offset }).then(function (byPath) {
                (function collect(n) {
                    if (n.url) { const r = byPath.get(toPath(n.url)); if (r) ga4By[normUrl(n.url)] = r; }
                    (n.children || n._children || []).forEach(collect);
                })(tree);
            }));
        }
        await Promise.all(jobs);
        return { gscBy: gscBy, ga4By: ga4By };
    }
    // Returns [{name, curImp, prevImp, delta, pct}] sorted by |pct|, filtered to meaningful volume.
    // Cached prior-period page maps, keyed by window length (days). Prior = the N days before now-N.
    const _priorCache = {};
    function getPriorMaps(tree, days) {
        days = days || 30;
        if (_priorCache[days]) return Promise.resolve(_priorCache[days]);
        return fetchPeriodMaps(tree, days, days).then(function (m) { _priorCache[days] = m; return m; });
    }

    // Re-fetch the shared maps for a given window (days) and rebuild. Resets GA4 map first.
    async function refreshForPeriod(tree, days) {
        days = days || 30;
        const gscOn = window.GSCIntegration && window.GSCIntegration.isConnected && window.GSCIntegration.isConnected();
        const ga4On = window.GA4Integration && window.GA4Integration.isConnected && window.GA4Integration.isConnected();
        _ga4Map = Object.create(null);
        await Promise.all([ gscOn ? prefetchGSC(tree, days) : null, ga4On ? prefetchGA4(tree, { days: days }) : null ]);
        _loadedDays = days;
        return build(tree);
    }
    let _loadedDays = 30;

    async function computeMovers(tree, currentCategories, opts) {
        opts = opts || {};
        const days = opts.days || 30;
        const prev = await fetchPeriodMaps(tree, days, days);          // the 30 days BEFORE the current window
        const prevResult = build(tree, { statsFor: statsForMaps(prev.gscBy, prev.ga4By) });
        build(tree);                                                    // restore current-period annotations on the tree
        const prevByName = new Map(prevResult.categories.map(function (c) { return [String(c.name).toLowerCase(), c.rollup]; }));
        const rows = currentCategories.map(function (c) {
            const p = prevByName.get(String(c.name).toLowerCase());
            const curImp = c.rollup.impressions, prevImp = p ? p.impressions : 0;
            const delta = curImp - prevImp;
            const pct = prevImp > 0 ? (delta / prevImp * 100) : null;   // null = no prior baseline
            return { name: c.name, curImp: curImp, prevImp: prevImp, delta: delta, pct: pct };
        }).filter(function (r) { return (r.curImp >= 300 || r.prevImp >= 300) && r.pct != null; });
        rows.sort(function (a, b) { return Math.abs(b.pct) - Math.abs(a.pct); });
        return rows;
    }
    function renderMovers(rows) {
        if (!rows || !rows.length) return '';
        const maxPct = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.pct); }).concat([1]));
        const row = function (r) {
            const up = r.delta >= 0;
            const col = up ? '#059669' : '#dc2626';
            const arrow = up ? '▲' : '▼';
            const barW = Math.min(100, Math.abs(r.pct) / maxPct * 100);
            return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--color-border-primary);">' +
                '<div style="flex:1;min-width:0;font-size:0.85rem;font-weight:600;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(r.name) + '</div>' +
                '<div style="width:120px;flex-shrink:0;display:flex;align-items:center;gap:2px;justify-content:flex-end;">' +
                    '<div style="height:6px;width:' + barW + '%;background:' + col + ';border-radius:3px;opacity:0.8;"></div>' +
                '</div>' +
                '<div style="width:78px;flex-shrink:0;text-align:right;font-size:0.8rem;font-weight:700;color:' + col + ';">' + arrow + ' ' + Math.abs(r.pct).toFixed(0) + '%</div>' +
                '<div style="width:64px;flex-shrink:0;text-align:right;font-size:0.72rem;color:var(--color-text-muted);">' + fmt(r.curImp) + '</div>' +
            '</div>';
        };
        const top = rows.slice(0, 8).sort(function (a, b) { return b.pct - a.pct; });   // biggest gain -> biggest loss
        return '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin:4px 0 8px;">Biggest movers · vs previous 30 days</div>' +
            '<div style="border:1px solid var(--color-border-primary);border-radius:10px;background:var(--color-bg-primary);padding:4px 14px;margin-bottom:20px;">' +
            top.map(row).join('') +
            '</div>';
    }

    // ── Treemap: sections sized by traffic, tinted by CTR health ──
    function renderTreemap(categories, totals, hasGA4) {
        if (typeof d3 === 'undefined' || !d3.treemap) return '';
        const valueOf = function (c) { return c.rollup.impressions || c.rollup.pageViews || 0; };
        const leaves = categories.filter(function (c) { return valueOf(c) > 0; });
        if (leaves.length < 2) return '';

        const W = 1000, H = 380;
        const root = d3.hierarchy({ children: leaves.map(function (c) { return { name: c.name, value: valueOf(c), rollup: c.rollup }; }) })
            .sum(function (d) { return d.value; })
            .sort(function (a, b) { return b.value - a.value; });
        d3.treemap().size([W, H]).paddingInner(3).round(true)(root);

        const avgCtr = totals.ctr;
        const usesCtr = avgCtr > 0;
        function fill(c) {
            let op = 0.5;
            if (usesCtr) {
                const ratio = c.ctr / avgCtr;                 // vs site average
                const t = Math.max(0, Math.min(1, (ratio - 0.5) / 1.0)); // 0 at .5x, 1 at 1.5x
                op = 0.16 + t * 0.74;
            }
            return { css: 'rgba(0,124,182,' + op.toFixed(2) + ')', light: op >= 0.45 };
        }

        const cells = root.leaves().map(function (leaf) {
            const c = leaf.data.rollup;
            const wPct = (leaf.x1 - leaf.x0) / W * 100, hPct = (leaf.y1 - leaf.y0) / H * 100;
            const pxW = (leaf.x1 - leaf.x0), pxH = (leaf.y1 - leaf.y0);
            const f = fill(c);
            const txt = f.light ? '#ffffff' : 'var(--color-text-primary)';
            const sub = f.light ? 'rgba(255,255,255,0.85)' : 'var(--color-text-secondary)';
            const showName = pxW > 64 && pxH > 30;
            const showVal = pxW > 64 && pxH > 46;
            const title = leaf.data.name + ' — ' + fmt(c.impressions) + ' impressions · ' +
                fmt(c.clicks) + ' clicks · ' + (c.ctr * 100).toFixed(1) + '% CTR · pos ' +
                (c.position != null ? c.position.toFixed(1) : '—') + ' · ' + fmt(c.pageCount) + ' pages';
            return '<div data-cat="' + esc(leaf.data.name) + '" title="' + esc(title) + '" style="cursor:pointer;position:absolute;left:' + (leaf.x0 / W * 100) +
                '%;top:' + (leaf.y0 / H * 100) + '%;width:' + wPct + '%;height:' + hPct +
                '%;background:' + f.css + ';border-radius:4px;overflow:hidden;padding:6px 8px;box-sizing:border-box;cursor:default;" class="sv-treemap-cell">' +
                (showName ? '<div style="font-size:0.72rem;font-weight:700;color:' + txt + ';line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(leaf.data.name) + '</div>' : '') +
                (showVal ? '<div style="font-size:0.66rem;color:' + sub + ';margin-top:2px;">' + fmt(c.impressions) + (usesCtr ? ' · ' + (c.ctr * 100).toFixed(1) + '%' : '') + '</div>' : '') +
            '</div>';
        }).join('');

        const legend = '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:0.68rem;color:var(--color-text-muted);">' +
            '<span><strong style="color:var(--color-text-secondary);">Size</strong> = ' + (usesCtr ? 'search impressions' : 'page views') + '</span>' +
            (usesCtr ? '<span style="display:flex;align-items:center;gap:6px;"><strong style="color:var(--color-text-secondary);">Colour</strong> = CTR ' +
                '<span style="display:inline-block;width:56px;height:10px;border-radius:3px;background:linear-gradient(90deg,rgba(0,124,182,0.16),rgba(0,124,182,0.9));"></span> low → high vs site avg</span>' : '') +
        '</div>';

        const style = '<style>.sv-treemap-cell{transition:filter 0.15s,outline 0.15s;outline:1px solid transparent;}.sv-treemap-cell:hover{filter:brightness(1.1);outline:1px solid var(--primary);}</style>';
        return style +
            '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:8px;">Site at a glance</div>' +
            '<div style="position:relative;width:100%;aspect-ratio:' + W + '/' + H + ';margin-bottom:6px;">' + cells + '</div>' +
            legend;
    }

    // ── Category Performance scorecard (modal) ──
    async function showPanel(days) {
        const tree = window.treeData;
        if (!tree) { alert('Load a sitemap first, then open Category Performance.'); return; }
        _ddDays = days || _ddDays || 30;
        const gscOn = window.GSCIntegration && window.GSCIntegration.isConnected && window.GSCIntegration.isConnected();
        const ga4On = window.GA4Integration && window.GA4Integration.isConnected && window.GA4Integration.isConnected();
        if (!gscOn && !ga4On) { alert('Connect Search Console and/or GA4 to see category performance.'); return; }

        // Overlay + loading
        const overlay = document.createElement('div');
        overlay.id = 'sv-rollup-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow:auto;backdrop-filter:blur(3px);';
        overlay.innerHTML = '<div style="color:#fff;margin-top:80px;font-size:0.95rem;">Aggregating category performance (' + periodLabel(_ddDays) + ')…</div>';
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);

        let r;
        try { r = await refreshForPeriod(tree, _ddDays); } catch (e) { r = build(tree); }
        const hasGA4 = r.totals.users > 0 || r.totals.pageViews > 0;

        const metric = (label, value) =>
            '<div style="flex:1;min-width:70px;padding:8px 10px;border-right:1px solid var(--color-border-primary);">' +
                '<div style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);">' + label + '</div>' +
                '<div style="font-size:1.05rem;font-weight:700;color:var(--color-text-primary);line-height:1.2;">' + value + '</div>' +
            '</div>';

        const maxImp = Math.max.apply(null, r.categories.map(c => c.rollup.impressions).concat([1]));

        const cardFor = (c) => {
            const d = c.rollup;
            const share = maxImp > 0 ? (d.impressions / maxImp * 100) : 0;
            return '<div class="sv-cat-card" data-cat="' + esc(c.name) + '" style="border:1px solid var(--color-border-primary);border-radius:10px;background:var(--color-bg-primary);margin-bottom:10px;overflow:hidden;cursor:pointer;transition:border-color .15s,box-shadow .15s;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid var(--color-border-primary);">' +
                    '<div style="display:flex;align-items:center;gap:9px;min-width:0;font-weight:700;font-size:0.95rem;color:var(--color-text-primary);"><span style="color:var(--primary);flex-shrink:0;line-height:0;">' + catIcon(c.name, 18) + '</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(c.name) + ' <span style="color:var(--color-link);font-weight:400;font-size:0.8rem;">view section ›</span></span></div>' +
                    '<div style="font-size:0.72rem;color:var(--color-text-muted);white-space:nowrap;flex-shrink:0;">' + fmt(d.leafCount) + ' content pages · ' + fmt(d.pageCount) + ' URLs · ' + fmt(d.pagesWithData) + ' with data</div>' +
                '</div>' +
                '<div style="height:3px;background:var(--color-bg-tertiary);"><div style="height:100%;width:' + share.toFixed(1) + '%;background:var(--primary);"></div></div>' +
                '<div style="display:flex;flex-wrap:wrap;">' +
                    metric('Impressions', fmt(d.impressions)) +
                    metric('Clicks', fmt(d.clicks)) +
                    metric('CTR', (d.ctr * 100).toFixed(1) + '%') +
                    metric('Avg pos', d.position != null ? d.position.toFixed(1) : '—') +
                    (hasGA4 ? metric('Views', fmt(d.pageViews)) : '') +
                    (hasGA4 ? metric('Users', fmt(d.users)) : '') +
                '</div>' +
            '</div>';
        };

        const t = r.totals;
        const content = document.createElement('div');
        content.style.cssText = 'background:var(--color-bg-secondary);border-radius:16px;max-width:1160px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);position:relative;font-family:var(--font-family);';
        content.innerHTML =
            '<div style="padding:24px 28px;">' +
                '<button id="sv-rollup-close" title="Close" style="position:absolute;top:16px;right:18px;background:none;border:none;font-size:22px;color:var(--color-text-muted);cursor:pointer;line-height:1;">×</button>' +
                '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
                    '<div style="min-width:0;">' +
                        '<div style="font-size:1.4rem;font-weight:700;color:var(--color-text-heading);margin-bottom:4px;">Category Performance</div>' +
                        '<div style="font-size:0.85rem;color:var(--color-text-secondary);margin-bottom:18px;">Search &amp; analytics rolled up by top-level section' + (hasGA4 ? '' : ' (connect GA4 for views/users)') + ' · ' + periodLabel(_ddDays) + '</div>' +
                    '</div>' +
                    '<select class="sv-panel-period" style="font-family:inherit;font-size:0.8rem;padding:5px 8px;border-radius:7px;border:1px solid var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-primary);cursor:pointer;flex-shrink:0;">' +
                        PERIODS.map(function (p) { return '<option value="' + p.d + '"' + (p.d === _ddDays ? ' selected' : '') + '>' + p.label + '</option>'; }).join('') +
                    '</select>' +
                '</div>' +
                // whole-site strip
                '<div style="display:flex;flex-wrap:wrap;border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;margin-bottom:18px;background:var(--color-bg-primary);">' +
                    metric('Content pages', fmt(t.leafCount)) +
                    metric('URLs', fmt(t.pageCount)) +
                    metric('Impressions', fmt(t.impressions)) +
                    metric('Clicks', fmt(t.clicks)) +
                    metric('CTR', (t.ctr * 100).toFixed(1) + '%') +
                    metric('Avg pos', t.position != null ? t.position.toFixed(1) : '—') +
                    (hasGA4 ? metric('Views', fmt(t.pageViews)) : '') +
                    (hasGA4 ? metric('Users', fmt(t.users)) : '') +
                '</div>' +
                // treemap hero
                '<div style="margin-bottom:20px;">' + renderTreemap(r.categories, t, hasGA4) + '</div>' +
                // movers (filled async — needs the prior-period fetch)
                '<div id="sv-movers-slot"><div style="font-size:0.72rem;color:var(--color-text-muted);margin-bottom:16px;">Comparing with previous 30 days…</div></div>' +
                '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:10px;">Sections, by search impressions</div>' +
                r.categories.map(cardFor).join('') +
                (r.categories.length === 0 ? '<div style="color:var(--color-text-muted);font-size:0.85rem;">No category data available.</div>' : '') +
            '</div>';

        overlay.innerHTML = '';
        overlay.appendChild(content);
        content.querySelector('#sv-rollup-close').addEventListener('click', function () { overlay.remove(); });
        const _panelSel = content.querySelector('.sv-panel-period');
        if (_panelSel) _panelSel.addEventListener('change', function () { const nd = parseInt(this.value, 10); overlay.remove(); showPanel(nd); });

        // Click a section (card or treemap cell) → open its deep-dive
        content.addEventListener('click', function (e) {
            const el = e.target.closest('[data-cat]');
            if (!el) return;
            overlay.remove();
            showDeepDive(el.dataset.cat);
        });
        content.addEventListener('mouseover', function (e) {
            const el = e.target.closest('.sv-cat-card');
            if (el) { el.style.borderColor = 'var(--primary)'; el.style.boxShadow = '0 2px 10px rgba(0,124,182,0.12)'; }
        });
        content.addEventListener('mouseout', function (e) {
            const el = e.target.closest('.sv-cat-card');
            if (el) { el.style.borderColor = 'var(--color-border-primary)'; el.style.boxShadow = 'none'; }
        });

        // Fill the movers section asynchronously (prior-period fetch)
        const moversSlot = content.querySelector('#sv-movers-slot');
        if (moversSlot && (gscOn || ga4On)) {
            computeMovers(tree, r.categories, {}).then(function (rows) {
                const html = renderMovers(rows);
                if (document.body.contains(moversSlot)) moversSlot.innerHTML = html || '';
            }).catch(function () { if (document.body.contains(moversSlot)) moversSlot.innerHTML = ''; });
        } else if (moversSlot) {
            moversSlot.innerHTML = '';
        }
    }

    // ── Category Deep-Dive: one section's scorecard + top pages + sub-sections ──
    function collectPages(node, out) {
        if (node.url && node.rollupSelf) out.push({ name: node.name, url: node.url, s: node.rollupSelf, lm: node.lastModified || (node.lastModDates && node.lastModDates[0]) || null });
        const kids = node.children || node._children || [];
        for (let i = 0; i < kids.length; i++) collectPages(kids[i], out);
    }
    // Merge same-named pages (e.g. EN + GA versions) into one logical page.
    function mergePages(raw) {
        const map = new Map();
        raw.forEach(function (p) {
            const k = String(p.name || '').toLowerCase();
            if (!map.has(k)) map.set(k, { name: p.name, url: p.url, urls: [], lm: p.lm, _maxImp: -1, imp: 0, clk: 0, pv: 0, us: 0, posSum: 0, posW: 0 });
            const m = map.get(k), sp = p.s || {};
            m.urls.push(p.url);
            m.imp += sp.impressions || 0; m.clk += sp.clicks || 0; m.pv += sp.pageViews || 0; m.us += sp.users || 0;
            if ((sp.impressions || 0) > 0 && sp.position != null) { m.posSum += sp.position * sp.impressions; m.posW += sp.impressions; }
            if ((sp.impressions || 0) > m._maxImp) { m._maxImp = sp.impressions || 0; m.url = p.url; }
            if (p.lm && (!m.lm || Date.parse(p.lm) > Date.parse(m.lm))) m.lm = p.lm;
        });
        return Array.from(map.values()).map(function (m) {
            return { name: m.name, url: m.url, urls: m.urls, lm: m.lm,
                s: { impressions: m.imp, clicks: m.clk, pageViews: m.pv, users: m.us,
                     ctr: m.imp > 0 ? m.clk / m.imp : 0, position: m.posW > 0 ? m.posSum / m.posW : null } };
        });
    }
    function catPages(cat) {
        const raw = [];
        (cat.nodes || []).forEach(function (n) { collectPages(n, raw); });
        return mergePages(raw);
    }

    function showLoadingOverlay(text) {
        let el = document.getElementById('sv-loading-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'sv-loading-overlay';
            el.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px);';
            el.innerHTML = '<div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:sv-spin 0.8s linear infinite;"></div>' +
                '<div style="color:#fff;font-size:0.9rem;font-family:var(--font-family,sans-serif);">' + (text || 'Loading…') + '</div>';
            document.body.appendChild(el);
            if (!document.getElementById('sv-spin-style')) { const st = document.createElement('style'); st.id = 'sv-spin-style'; st.textContent = '@keyframes sv-spin{to{transform:rotate(360deg)}}'; document.head.appendChild(st); }
        }
        el.style.display = 'flex';
    }
    function hideLoadingOverlay() { const el = document.getElementById('sv-loading-overlay'); if (el) el.remove(); }

    let _ddDays = 30;
    const PERIODS = [ { d: 7, label: 'Last 7 days' }, { d: 30, label: 'Last 30 days' }, { d: 90, label: 'Last 3 months' }, { d: 180, label: 'Last 6 months' }, { d: 365, label: 'Last 12 months' } ];
    function periodLabel(days) { const p = PERIODS.find(function (x) { return x.d === days; }); return p ? p.label.toLowerCase() : ('last ' + days + ' days'); }
    function ensureDDStyle() {
        if (document.getElementById('sv-dd-style')) return;
        const st = document.createElement('style'); st.id = 'sv-dd-style';
        st.textContent = [
            '.sv-dd-modal{box-sizing:border-box;max-height:calc(100vh - 80px);overflow-y:auto;overflow-x:hidden;}',
            '.sv-dd-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}',
            '.sv-dd-grid>*{min-width:0;}',
            '.sv-dd-card{border:1px solid var(--color-border-primary);border-radius:12px;padding:16px 18px;background:var(--color-bg-primary);}',
            '.sv-dd-card .sv-dd-sec-rows>*:last-child{border-bottom:none;}',
            '@media(max-width:720px){.sv-dd-grid{grid-template-columns:1fr;}}',
            '.sv-dd-page{cursor:pointer;border-radius:5px;transition:background .12s;margin:0 -8px;padding-left:8px;padding-right:8px;}',
            '.sv-dd-page:hover{background:var(--color-bg-tertiary);}'
        ].join('');
        document.head.appendChild(st);
    }

    async function showDeepDive(categoryName, days) {
        const tree = window.treeData;
        if (!tree) { alert('Load a sitemap first.'); return; }
        ensureDDStyle();
        if (days && days !== _loadedDays) {
            _ddDays = days;
            const _g = window.GSCIntegration && window.GSCIntegration.isConnected && window.GSCIntegration.isConnected();
            const _a = window.GA4Integration && window.GA4Integration.isConnected && window.GA4Integration.isConnected();
            if (_g || _a) { try { await refreshForPeriod(tree, days); } catch (e) {} }
        } else { _ddDays = days || _ddDays || 30; }
        const r = build(tree);   // annotate with current-period data
        const cat = r.categories.find(function (c) { return String(c.name).toLowerCase() === String(categoryName).toLowerCase(); });
        if (!cat) { alert('Category not found: ' + categoryName); return; }
        const d = cat.rollup;
        const hasGA4 = (d.pageViews || 0) > 0 || (d.users || 0) > 0;

        // most-viewed pages under this category (leaf/URL nodes)
        const pages = catPages(cat);
        const rankKey = hasGA4 ? 'pageViews' : 'impressions';
        const topPages = pages.filter(function (p) { return (p.s[rankKey] || 0) > 0; })
            .sort(function (a, b) { return (b.s[rankKey] || 0) - (a.s[rankKey] || 0); }).slice(0, 12);

        // sub-sections: immediate children of the category nodes, merged by name
        const subMap = new Map();
        (cat.nodes || []).forEach(function (n) {
            (n.children || []).forEach(function (child) {
                const k = String(child.name || '').toLowerCase();
                if (!subMap.has(k)) subMap.set(k, { name: child.name, agg: emptyAgg() });
                mergeAgg(subMap.get(k).agg, child._agg);
            });
        });
        const subs = Array.from(subMap.values()).map(function (m) { return { name: m.name, rollup: finalize(m.agg) }; })
            .filter(function (x) { return x.rollup.impressions > 0 || x.rollup.pageViews > 0; })
            .sort(function (a, b) { return b.rollup.impressions - a.rollup.impressions; });

        // needs attention: high-impressions/low-CTR pages + stale content
        const _now = Date.now();
        function monthsSince(dstr) { if (!dstr) return null; const t = Date.parse(dstr); if (isNaN(t)) return null; return (_now - t) / (1000 * 60 * 60 * 24 * 30.44); }
        const lowCtr = pages.filter(function (p) { return (p.s.impressions || 0) >= 300 && (p.s.ctr || 0) < Math.max(0.005, (d.ctr || 0) * 0.6); })
            .sort(function (a, b) { return (b.s.impressions || 0) - (a.s.impressions || 0); }).slice(0, 6);
        const staleAll = pages.map(function (p) { return { p: p, m: monthsSince(p.lm) }; })
            .filter(function (x) { return x.m != null && x.m > 12; }).sort(function (a, b) { return b.m - a.m; });
        const stale = staleAll.slice(0, 6);

        // ── render ──
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow:auto;backdrop-filter:blur(3px);';
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        const metric = function (label, value) {
            return '<div style="flex:1;min-width:70px;padding:8px 10px;border-right:1px solid var(--color-border-primary);">' +
                '<div style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);">' + label + '</div>' +
                '<div style="font-size:1.05rem;font-weight:700;color:var(--color-text-primary);line-height:1.2;">' + value + '</div>' +
            '</div>';
        };
        const maxView = Math.max.apply(null, topPages.map(function (p) { return p.s[rankKey] || 0; }).concat([1]));
        const pageRow = function (p, i) {
            const v = p.s[rankKey] || 0;
            const bar = (v / maxView * 100).toFixed(0);
            const sub = hasGA4
                ? fmt(p.s.pageViews) + ' views · ' + fmt(p.s.impressions) + ' impr'
                : fmt(p.s.impressions) + ' impr · ' + (p.s.ctr * 100).toFixed(1) + '% CTR';
            return '<div class="sv-dd-page" data-url="' + esc(p.url) + '" style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--color-border-primary);">' +
                '<div style="width:18px;color:var(--color-text-muted);font-size:0.75rem;flex-shrink:0;">' + (i + 1) + '</div>' +
                '<div style="flex:1;min-width:0;"><div style="font-size:0.84rem;font-weight:600;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(p.name) + '</div>' +
                    '<div style="font-size:0.7rem;color:var(--color-text-muted);">' + sub + '</div></div>' +
                '<div style="width:90px;flex-shrink:0;"><div style="height:6px;background:var(--color-bg-tertiary);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + bar + '%;background:var(--primary);"></div></div></div>' +
                '<div style="width:56px;text-align:right;font-size:0.8rem;font-weight:700;color:var(--color-text-primary);flex-shrink:0;">' + fmt(v) + '</div>' +
            '</div>';
        };
        const subRow = function (x) {
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--color-border-primary);font-size:0.84rem;">' +
                '<span style="font-weight:600;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(x.name) + '</span>' +
                '<span style="color:var(--color-text-secondary);white-space:nowrap;flex-shrink:0;">' + fmt(x.rollup.impressions) + ' impressions · ' + (x.rollup.ctr * 100).toFixed(1) + '% CTR' + (hasGA4 ? ' · ' + fmt(x.rollup.pageViews) + ' views' : '') + '</span>' +
            '</div>';
        };
        const secHd = function (t) { return '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin:2px 0 8px;">' + t + '</div>'; };
        const naRow = function (name, mid, right, url) {
            return '<div' + (url ? ' class="sv-dd-page" data-url="' + esc(url) + '"' : '') + ' style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--color-border-primary);font-size:0.82rem;">' +
                '<span style="font-weight:600;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;">' + esc(name) + '</span>' +
                (mid ? '<span style="color:var(--color-text-muted);font-size:0.72rem;white-space:nowrap;flex-shrink:0;">' + mid + '</span>' : '') +
                '<span style="color:var(--color-text-secondary);font-weight:600;white-space:nowrap;flex-shrink:0;">' + right + '</span>' +
            '</div>';
        };
        const emptyNote = function (t) { return '<div style="font-size:0.8rem;color:var(--color-text-muted);">' + t + '</div>'; };

        const content = document.createElement('div');
        content.className = 'sv-dd-modal';
        content.style.cssText = 'background:var(--color-bg-secondary);border-radius:16px;max-width:1080px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);position:relative;font-family:var(--font-family);';
        content.innerHTML =
            '<div style="padding:24px 28px;">' +
                '<button class="sv-dd-back" style="background:none;border:none;color:var(--color-link);font-size:0.82rem;cursor:pointer;padding:0;margin-bottom:12px;font-family:inherit;">‹ All categories</button>' +
                '<button class="sv-dd-close" title="Close" style="position:absolute;top:18px;right:20px;background:none;border:none;font-size:22px;color:var(--color-text-muted);cursor:pointer;line-height:1;">×</button>' +
                '<div style="font-size:1.5rem;font-weight:700;color:var(--color-text-heading);margin-bottom:2px;display:flex;align-items:center;gap:11px;"><span style="color:var(--primary);line-height:0;flex-shrink:0;">' + catIcon(cat.name, 26) + '</span><span style="overflow:hidden;text-overflow:ellipsis;">' + esc(cat.name) + '</span></div>' +
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
                    '<div style="font-size:0.85rem;color:var(--color-text-secondary);">Section deep-dive · ' + periodLabel(_ddDays) + '</div>' +
                    '<select class="sv-dd-period" style="font-family:inherit;font-size:0.8rem;padding:5px 8px;border-radius:7px;border:1px solid var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-primary);cursor:pointer;">' +
                        PERIODS.map(function (p) { return '<option value="' + p.d + '"' + (p.d === _ddDays ? ' selected' : '') + '>' + p.label + '</option>'; }).join('') +
                    '</select>' +
                '</div>' +
                '<div style="display:flex;flex-wrap:wrap;border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;margin-bottom:16px;background:var(--color-bg-primary);">' +
                    metric('Content pages', fmt(d.leafCount)) +
                    metric('Impressions', fmt(d.impressions)) +
                    metric('Clicks', fmt(d.clicks)) +
                    metric('CTR', (d.ctr * 100).toFixed(1) + '%') +
                    metric('Avg pos', d.position != null ? d.position.toFixed(1) : '—') +
                    (hasGA4 ? metric('Views', fmt(d.pageViews)) : '') +
                    (hasGA4 ? metric('Users', fmt(d.users)) : '') +
                '</div>' +
                '<div class="sv-dd-grid">' +
                    '<div class="sv-dd-card">' + secHd('Most viewed pages') +
                        '<div class="sv-dd-sec-rows">' + (topPages.length ? topPages.map(pageRow).join('') : emptyNote('No page-level data.')) + '</div>' +
                    '</div>' +
                    '<div class="sv-dd-card" id="sv-dd-movers">' + secHd('Biggest movers') +
                        '<div style="font-size:0.78rem;color:var(--color-text-muted);">Comparing with previous period…</div>' +
                    '</div>' +
                '</div>' +
                '<div class="sv-dd-card" style="margin-top:16px;">' + secHd('Sub-sections') +
                    '<div class="sv-dd-sec-rows">' + (subs.length ? subs.map(subRow).join('') : emptyNote('No sub-sections.')) + '</div>' +
                '</div>' +
                '<div class="sv-dd-card" style="margin-top:16px;">' + secHd('Needs attention') +
                    '<div style="font-size:0.7rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:6px;">High views &middot; low click-through</div>' +
                    '<div class="sv-dd-sec-rows">' + (lowCtr.length ? lowCtr.map(function (p) { return naRow(p.name, '', fmt(p.s.impressions) + ' impr &middot; ' + (p.s.ctr * 100).toFixed(1) + '% CTR', p.url); }).join('') : emptyNote('Nothing flagged \u2014 CTR looks healthy.')) + '</div>' +
                    '<div style="font-size:0.7rem;font-weight:600;color:var(--color-text-secondary);margin:18px 0 6px;">Stale content &middot; ' + staleAll.length + ' page' + (staleAll.length === 1 ? '' : 's') + ' &gt;12mo</div>' +
                    '<div class="sv-dd-sec-rows">' + (stale.length ? stale.map(function (x) { return naRow(x.p.name, '', Math.round(x.m) + 'mo old', x.p.url); }).join('') : emptyNote('No stale pages detected.')) + '</div>' +
                '</div>' +
            '</div>';
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        hideLoadingOverlay();   // clear the period-switch loader now the deep-dive is rendered
        content.querySelector('.sv-dd-close').addEventListener('click', function () { overlay.remove(); });
        content.querySelector('.sv-dd-back').addEventListener('click', function () { overlay.remove(); showPanel(); });
        const _psel = content.querySelector('.sv-dd-period');
        if (_psel) _psel.addEventListener('change', function () { const nd = parseInt(this.value, 10); showLoadingOverlay('Loading ' + periodLabel(nd) + '\u2026'); overlay.remove(); showDeepDive(cat.name, nd); });
        content.addEventListener('click', function (e) {
            const row = e.target.closest('.sv-dd-page[data-url]');
            if (!row) return;
            const u = row.getAttribute('data-url');
            if (!u || !window.showUnifiedDashboardReport) return;
            showLoadingOverlay('Loading page report…');   // covers the tree while the report fetches
            overlay.remove();
            const safety = setTimeout(hideLoadingOverlay, 20000);
            Promise.resolve(window.showUnifiedDashboardReport(u))
                .catch(function () {})
                .finally(function () { clearTimeout(safety); hideLoadingOverlay(); });
        });

        // Fill page-level movers within this section (prior-period fetch, cached)
        const moversSlot = content.querySelector('#sv-dd-movers');
        const gscOn = window.GSCIntegration && window.GSCIntegration.isConnected && window.GSCIntegration.isConnected();
        const ga4On = window.GA4Integration && window.GA4Integration.isConnected && window.GA4Integration.isConnected();
        if (moversSlot && (gscOn || ga4On)) {
            getPriorMaps(tree, _ddDays).then(function (prior) {
                if (!document.body.contains(moversSlot)) return;
                const useImp = d.impressions > 0;
                const metricKey = useImp ? 'impressions' : 'pageViews';
                const priorBy = useImp ? prior.gscBy : prior.ga4By;
                let rows = pages.map(function (p) {
                    const cur = p.s[metricKey] || 0;
                    const prev = (p.urls || [p.url]).reduce(function (sum, u) { const pr = priorBy[normUrl(u)]; return sum + (pr ? (pr[metricKey] || 0) : 0); }, 0);
                    const pct = prev > 0 ? (cur - prev) / prev * 100 : null;
                    return { name: p.name, url: p.url, cur: cur, prev: prev, pct: pct };
                }).filter(function (r) { return r.pct != null && r.prev >= 100; });   // real prior baseline only
                rows.sort(function (a, b) { return Math.abs(b.pct) - Math.abs(a.pct); });   // pick biggest movers (both ways)
                rows = rows.slice(0, 10);
                rows.sort(function (a, b) { return b.pct - a.pct; });   // display: biggest gain -> biggest loss
                if (!rows.length) { moversSlot.innerHTML = secHd('Biggest movers') + '<div style="font-size:0.8rem;color:var(--color-text-muted);">Not enough prior-period data to compare.</div>'; return; }
                const maxPct = Math.min(500, Math.max.apply(null, rows.map(function (r) { return Math.abs(r.pct); }).concat([1])));
                const mrow = function (r) {
                    const up = r.pct >= 0, col = up ? '#059669' : '#dc2626', arrow = up ? '▲' : '▼';
                    const pa = Math.abs(r.pct);
                    const pctText = (pa > 500 ? '500+' : pa.toFixed(0)) + '%';
                    const bw = Math.min(100, pa / maxPct * 100);
                    return '<div class="sv-dd-page" data-url="' + esc(r.url) + '" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--color-border-primary);">' +
                        '<div style="flex:1;min-width:0;font-size:0.82rem;font-weight:600;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(r.name) + '</div>' +
                        '<div style="width:60px;display:flex;justify-content:flex-end;flex-shrink:0;"><div style="height:6px;width:' + bw + '%;background:' + col + ';border-radius:3px;opacity:0.85;"></div></div>' +
                        '<div style="width:60px;text-align:right;font-size:0.8rem;font-weight:700;color:' + col + ';flex-shrink:0;">' + arrow + ' ' + pctText + '</div>' +
                        '<div style="width:48px;text-align:right;font-size:0.72rem;color:var(--color-text-muted);flex-shrink:0;">' + fmt(r.cur) + '</div>' +
                    '</div>';
                };
                moversSlot.innerHTML = secHd('Biggest movers · vs previous ' + _ddDays + ' days') + '<div class="sv-dd-sec-rows">' + rows.map(mrow).join('') + '</div>';
            }).catch(function () { if (document.body.contains(moversSlot)) moversSlot.innerHTML = secHd('Biggest movers') + '<div style="font-size:0.8rem;color:var(--color-text-muted);">Comparison unavailable.</div>'; });
        } else if (moversSlot) {
            moversSlot.innerHTML = secHd('Biggest movers') + '<div style="font-size:0.8rem;color:var(--color-text-muted);">Connect GSC/GA4 to compare periods.</div>';
        }
    }

    // One-call: prefetch whatever's connected (bulk) + build. Lights up tree drill-down.
    let _refreshing = false;
    async function refresh(tree) {
        tree = tree || window.treeData;
        if (!tree || _refreshing) return null;
        _refreshing = true;
        try {
            const gscOn = window.GSCIntegration && window.GSCIntegration.isConnected && window.GSCIntegration.isConnected();
            const ga4On = window.GA4Integration && window.GA4Integration.isConnected && window.GA4Integration.isConnected();
            await Promise.all([ gscOn ? prefetchGSC(tree) : null, ga4On ? prefetchGA4(tree) : null ]);
            return build(tree);
        } finally { _refreshing = false; }
    }

    // ══════════════════ "Ask your data" ══════════════════
    function _catByName(cats, name) {
        if (!name) return null;
        const k = String(name).toLowerCase();
        return cats.find(function (c) { return String(c.name).toLowerCase() === k; })
            || cats.find(function (c) { return String(c.name).toLowerCase().indexOf(k) >= 0 || k.indexOf(String(c.name).toLowerCase()) >= 0; })
            || null;
    }
    function _allPages(r) { const out = []; r.categories.forEach(function (c) { catPages(c).forEach(function (p) { out.push(p); }); }); return out; }
    function _mval(s, m) { return m === 'ctr' ? s.ctr : (m === 'position' ? (s.position == null ? 999 : s.position) : (s[m] || 0)); }
    function _mfmt(s, m) { return m === 'ctr' ? (s.ctr * 100).toFixed(1) + '%' : (m === 'position' ? (s.position != null ? s.position.toFixed(1) : '—') : fmt(s[m] || 0)); }
    const _MLABEL = { impressions: 'impressions', clicks: 'clicks', ctr: 'CTR', position: 'avg position', pageViews: 'views', users: 'users' };

    function _rankCard(items) {
        if (!items.length) return '<div style="font-size:0.85rem;color:var(--color-text-muted);">No results.</div>';
        const max = Math.max.apply(null, items.map(function (it) { return Math.abs(it.bar || 0); }).concat([1]));
        return '<div style="border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);">' +
            items.map(function (it) {
                const bw = Math.min(100, Math.abs(it.bar || 0) / max * 100);
                const col = it.col || 'var(--primary)';
                const clickable = it.url ? ' class="sv-ask-page" data-url="' + esc(it.url) + '" style="cursor:pointer;"' : ' style=""';
                return '<div' + clickable + ' onmouseover="this.style.background=\'var(--color-bg-tertiary)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--color-border-primary);font-size:0.85rem;">' +
                    '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-primary);font-weight:600;">' + esc(it.name) + '</span>' +
                    '<span style="width:96px;flex-shrink:0;"><span style="display:block;height:6px;background:var(--color-bg-tertiary);border-radius:3px;overflow:hidden;"><span style="display:block;height:100%;width:' + bw + '%;background:' + col + ';"></span></span></span>' +
                    '<span style="width:88px;flex-shrink:0;text-align:right;font-weight:700;color:' + (it.valCol || 'var(--color-text-primary)') + ';">' + it.val + '</span>' +
                '</div></div>';
            }).join('') + '</div>';
    }
    function _stripCard(rollup, hasGA4) {
        const cell = function (l, v) { return '<div style="flex:1;min-width:66px;padding:8px 10px;border-right:1px solid var(--color-border-primary);"><div style="font-size:0.56rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);">' + l + '</div><div style="font-size:1.05rem;font-weight:700;color:var(--color-text-primary);">' + v + '</div></div>'; };
        return '<div style="display:flex;flex-wrap:wrap;border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);">' +
            cell('Pages', fmt(rollup.leafCount)) + cell('Impressions', fmt(rollup.impressions)) + cell('Clicks', fmt(rollup.clicks)) +
            cell('CTR', (rollup.ctr * 100).toFixed(1) + '%') + cell('Avg pos', rollup.position != null ? rollup.position.toFixed(1) : '—') +
            (hasGA4 ? cell('Views', fmt(rollup.pageViews)) : '') + (hasGA4 ? cell('Users', fmt(rollup.users)) : '') + '</div>';
    }

    async function runIntent(plan, r) {
        const cats = r.categories, hasGA4 = r.totals.pageViews > 0 || r.totals.users > 0;
        const metric = ['impressions', 'clicks', 'ctr', 'position', 'pageViews', 'users'].indexOf(plan.metric) >= 0 ? plan.metric : 'impressions';
        const limit = Math.min(15, Math.max(1, plan.limit || 6));
        const intent = plan.intent;

        if (intent === 'site_summary') {
            return { html: _stripCard(r.totals, hasGA4), summary: 'Whole site: ' + fmt(r.totals.impressions) + ' impressions, ' + fmt(r.totals.clicks) + ' clicks, ' + (r.totals.ctr * 100).toFixed(1) + '% CTR, ' + fmt(r.totals.leafCount) + ' content pages.' };
        }
        if (intent === 'section_summary') {
            const c = _catByName(cats, plan.category);
            if (!c) return { html: '', summary: '', err: 'I couldn\'t find that section.' };
            return { html: '<div style="font-weight:700;margin-bottom:8px;">' + esc(c.name) + '</div>' + _stripCard(c.rollup, hasGA4), summary: c.name + ': ' + fmt(c.rollup.impressions) + ' impressions, ' + (c.rollup.ctr * 100).toFixed(1) + '% CTR, ' + fmt(c.rollup.pageViews) + ' views, ' + fmt(c.rollup.leafCount) + ' pages.' };
        }
        if (intent === 'rank_categories') {
            const desc = plan.direction !== 'up';
            const sorted = cats.slice().sort(function (a, b) { const av = _mval(a.rollup, metric), bv = _mval(b.rollup, metric); return desc ? bv - av : av - bv; }).slice(0, limit);
            const items = sorted.map(function (c) { return { name: c.name, val: _mfmt(c.rollup, metric), bar: _mval(c.rollup, metric) }; });
            return { html: _rankCard(items), summary: 'Sections by ' + _MLABEL[metric] + ': ' + sorted.map(function (c) { return c.name + ' ' + _mfmt(c.rollup, metric); }).join(', ') + '.' };
        }
        if (intent === 'top_pages') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const desc = plan.direction !== 'up';
            const sorted = pages.filter(function (p) { return _mval(p.s, metric) > 0; }).sort(function (a, b) { const av = _mval(a.s, metric), bv = _mval(b.s, metric); return desc ? bv - av : av - bv; }).slice(0, limit);
            const items = sorted.map(function (p) { return { name: p.name, val: _mfmt(p.s, metric), bar: _mval(p.s, metric), url: p.url }; });
            return { html: _rankCard(items), summary: 'Top pages' + (c ? ' in ' + c.name : '') + ' by ' + _MLABEL[metric] + ': ' + sorted.slice(0, 5).map(function (p) { return p.name + ' ' + _mfmt(p.s, metric); }).join(', ') + '.' };
        }
        if (intent === 'low_ctr') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const avg = (c ? c.rollup.ctr : r.totals.ctr) || 0;
            const rows = pages.filter(function (p) { return (p.s.impressions || 0) >= 300 && p.s.ctr < Math.max(0.005, avg * 0.6); }).sort(function (a, b) { return b.s.impressions - a.s.impressions; }).slice(0, limit);
            const items = rows.map(function (p) { return { name: p.name, val: (p.s.ctr * 100).toFixed(1) + '%', bar: p.s.impressions, url: p.url }; });
            return { html: _rankCard(items), summary: 'High-impression, low-CTR pages' + (c ? ' in ' + c.name : '') + ': ' + rows.slice(0, 5).map(function (p) { return p.name + ' (' + fmt(p.s.impressions) + ' impr, ' + (p.s.ctr * 100).toFixed(1) + '%)'; }).join(', ') + '.' };
        }
        if (intent === 'stale') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const now = Date.now();
            const rows = pages.map(function (p) { const t = p.lm ? Date.parse(p.lm) : NaN; return { p: p, m: isNaN(t) ? null : (now - t) / (1000 * 60 * 60 * 24 * 30.44) }; }).filter(function (x) { return x.m != null && x.m > 12; }).sort(function (a, b) { return b.m - a.m; }).slice(0, limit);
            const items = rows.map(function (x) { return { name: x.p.name, val: Math.round(x.m) + 'mo', bar: x.m, url: x.p.url }; });
            return { html: _rankCard(items), summary: (rows.length ? rows.length : 'No') + ' stale pages' + (c ? ' in ' + c.name : '') + ' (over 12 months old)' + (rows.length ? ', oldest: ' + rows.slice(0, 4).map(function (x) { return x.p.name + ' (' + Math.round(x.m) + 'mo)'; }).join(', ') : '') + '.' };
        }
        if (intent === 'compare') {
            const names = plan.categories || [];
            const a = _catByName(cats, names[0]), b = _catByName(cats, names[1]);
            if (!a || !b) return { html: '', summary: '', err: 'I need two sections to compare.' };
            return { html: '<div style="font-weight:700;margin:2px 0 6px;">' + esc(a.name) + '</div>' + _stripCard(a.rollup, hasGA4) + '<div style="font-weight:700;margin:12px 0 6px;">' + esc(b.name) + '</div>' + _stripCard(b.rollup, hasGA4),
                summary: a.name + ' vs ' + b.name + ': impressions ' + fmt(a.rollup.impressions) + ' vs ' + fmt(b.rollup.impressions) + ', CTR ' + (a.rollup.ctr * 100).toFixed(1) + '% vs ' + (b.rollup.ctr * 100).toFixed(1) + '%.' };
        }
        if (intent === 'movers') {
            const c = _catByName(cats, plan.category);
            const prior = await getPriorMaps(window.treeData, _ddDays);
            const useImp = (c ? c.rollup.impressions : r.totals.impressions) > 0;
            const mkey = useImp ? 'impressions' : 'pageViews';
            const priorBy = useImp ? prior.gscBy : prior.ga4By;
            const pages = c ? catPages(c) : _allPages(r);
            let rows = pages.map(function (p) {
                const cur = p.s[mkey] || 0;
                const prev = (p.urls || [p.url]).reduce(function (sum, u) { const pr = priorBy[normUrl(u)]; return sum + (pr ? (pr[mkey] || 0) : 0); }, 0);
                return { name: p.name, url: p.url, cur: cur, pct: prev >= 100 ? (cur - prev) / prev * 100 : null };
            }).filter(function (x) { return x.pct != null; });
            const dir = plan.direction || 'both';
            if (dir === 'up') rows = rows.filter(function (x) { return x.pct > 0; });
            else if (dir === 'down') rows = rows.filter(function (x) { return x.pct < 0; });
            rows.sort(function (a, b) { return Math.abs(b.pct) - Math.abs(a.pct); });
            rows = rows.slice(0, limit).sort(function (a, b) { return b.pct - a.pct; });
            const items = rows.map(function (x) { const up = x.pct >= 0, pa = Math.abs(x.pct); return { name: x.name, val: (up ? '▲ ' : '▼ ') + (pa > 500 ? '500+' : pa.toFixed(0)) + '%', bar: Math.min(500, pa), col: up ? '#059669' : '#dc2626', valCol: up ? '#059669' : '#dc2626', url: x.url }; });
            return { html: _rankCard(items), summary: 'Biggest ' + (dir === 'down' ? 'fallers' : dir === 'up' ? 'risers' : 'movers') + (c ? ' in ' + c.name : ' across the site') + ' vs the previous ' + _ddDays + ' days: ' + rows.slice(0, 5).map(function (x) { return x.name + ' ' + (x.pct >= 0 ? '+' : '') + x.pct.toFixed(0) + '%'; }).join(', ') + '.' };
        }
        return { html: '', summary: '', unknown: true };
    }

    const _ASK_EXAMPLES = ['Which sections get the most search traffic?', 'Top 5 most viewed pages in Health', 'Which Housing pages lost traffic?', 'Pages with high impressions but low clicks', 'What is stale in Employment?', 'Compare Health and Housing'];

    async function showAsk() {
        const tree = window.treeData;
        if (!tree) { alert('Load a sitemap first.'); return; }
        if (!window.GroqAI || !window.GroqAI.isConfigured || !window.GroqAI.isConfigured()) { alert('Connect AI first — click the ✨ AI button in the toolbar to add your Groq key.'); return; }
        ensureDDStyle();

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow:auto;backdrop-filter:blur(3px);';
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        const content = document.createElement('div');
        content.className = 'sv-dd-modal';
        content.style.cssText = 'background:var(--color-bg-secondary);border-radius:16px;max-width:720px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);position:relative;font-family:var(--font-family);';
        content.innerHTML =
            '<div style="padding:24px 28px;">' +
                '<button class="sv-ask-close" title="Close" style="position:absolute;top:18px;right:20px;background:none;border:none;font-size:22px;color:var(--color-text-muted);cursor:pointer;line-height:1;">×</button>' +
                '<div style="font-size:1.4rem;font-weight:700;color:var(--color-text-heading);margin-bottom:2px;">Ask your data</div>' +
                '<div style="font-size:0.82rem;color:var(--color-text-secondary);margin-bottom:16px;">Ask a question about your sections, pages, and trends. Figures come from your real GSC/GA4 data.</div>' +
                '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
                    '<input id="sv-ask-input" type="text" placeholder="e.g. which Health pages lost traffic?" style="flex:1;font-family:inherit;font-size:0.9rem;padding:10px 12px;border:1px solid var(--color-border-primary);border-radius:9px;background:var(--color-bg-primary);color:var(--color-text-primary);" />' +
                    '<button id="sv-ask-go" style="background:var(--primary);color:#fff;border:none;padding:10px 18px;border-radius:9px;font-weight:600;font-size:0.9rem;cursor:pointer;font-family:inherit;">Ask</button>' +
                '</div>' +
                '<div id="sv-ask-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">' +
                    _ASK_EXAMPLES.map(function (q) { return '<button class="sv-ask-chip" data-q="' + esc(q) + '" style="font-size:0.72rem;padding:5px 10px;border-radius:20px;border:1px solid var(--color-border-primary);background:transparent;color:var(--color-text-secondary);cursor:pointer;font-family:inherit;">' + esc(q) + '</button>'; }).join('') +
                '</div>' +
                '<div id="sv-ask-answer"></div>' +
            '</div>';
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        const input = content.querySelector('#sv-ask-input');
        const answer = content.querySelector('#sv-ask-answer');
        content.querySelector('.sv-ask-close').addEventListener('click', function () { overlay.remove(); });
        content.addEventListener('click', function (e) {
            const chip = e.target.closest('.sv-ask-chip');
            if (chip) { input.value = chip.dataset.q; ask(); return; }
            const row = e.target.closest('.sv-ask-page[data-url]');
            if (row && window.showUnifiedDashboardReport) { const u = row.getAttribute('data-url'); overlay.remove(); showLoadingOverlay('Loading page report…'); Promise.resolve(window.showUnifiedDashboardReport(u)).catch(function () {}).finally(hideLoadingOverlay); }
        });
        content.querySelector('#sv-ask-go').addEventListener('click', ask);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(); });
        setTimeout(function () { input.focus(); }, 50);

        let busy = false;
        async function ask() {
            const q = input.value.trim();
            if (!q || busy) return;
            busy = true;
            answer.innerHTML = '<div style="font-size:0.85rem;color:var(--color-text-muted);padding:8px 0;">Thinking…</div>';
            try {
                const r = await refreshForPeriod(tree, _ddDays).catch(function () { return build(tree); });
                const catNames = r.categories.map(function (c) { return c.name; });
                const sys = 'You turn a question about website analytics into a JSON query. Reply with ONLY a JSON object, no prose, no code fences. ' +
                    'Sections available: ' + catNames.join(', ') + '. ' +
                    'Schema: {"intent": one of ["rank_categories","section_summary","top_pages","low_ctr","stale","movers","site_summary","compare","unknown"], ' +
                    '"category": exact section name from the list or null, "categories": [two section names] for compare, ' +
                    '"metric": one of ["impressions","clicks","ctr","position","pageViews","users"] (default impressions), ' +
                    '"direction": "up"|"down"|"both", "limit": number (default 6)}. ' +
                    'Mapping: views->pageViews; traffic->impressions; lost/dropped/falling/down->intent movers direction down; rising/gained/up->direction up; ' +
                    'most viewed->top_pages metric pageViews; low CTR / seen but not clicked->low_ctr; out of date / old->stale; how is X doing->section_summary.';
                const raw = await window.GroqAI.complete([{ role: 'system', content: sys }, { role: 'user', content: q }], { temperature: 0, max_tokens: 200 });
                let plan; try { plan = JSON.parse(String(raw).replace(/```json|```/g, '').trim()); } catch (e) { plan = { intent: 'unknown' }; }
                const res = await runIntent(plan, r);
                if (res.unknown) { answer.innerHTML = '<div style="font-size:0.85rem;color:var(--color-text-secondary);">I can answer about sections, pages, movers, low-CTR pages, and stale content. Try one of the examples above.</div>'; busy = false; return; }
                if (res.err) { answer.innerHTML = '<div style="font-size:0.85rem;color:var(--color-text-secondary);">' + esc(res.err) + '</div>'; busy = false; return; }
                answer.innerHTML = '<div id="sv-ask-oneliner" style="font-size:0.92rem;color:var(--color-text-primary);font-weight:600;margin-bottom:12px;line-height:1.5;"></div>' + res.html;
                // one-line takeaway from the REAL results (numbers already computed)
                try {
                    const line = await window.GroqAI.complete([{ role: 'system', content: 'Given these real analytics results, write ONE short plain-English sentence that answers the question. Use the numbers exactly as given. No preamble, no markdown.' }, { role: 'user', content: 'Question: ' + q + '\nResults: ' + res.summary }], { temperature: 0.2, max_tokens: 90 });
                    const el = answer.querySelector('#sv-ask-oneliner'); if (el) el.textContent = String(line).trim();
                } catch (e) { const el = answer.querySelector('#sv-ask-oneliner'); if (el) el.textContent = res.summary; }
            } catch (e) {
                answer.innerHTML = '<div style="font-size:0.85rem;color:#dc2626;">Something went wrong: ' + esc(e && e.message ? e.message : String(e)) + '</div>';
            }
            busy = false;
        }
    }

    window.SVRollup = {
        build: build,
        statsForUrl: statsForUrl,
        prefetchGA4: prefetchGA4,
        prefetchGSC: prefetchGSC,
        refresh: refresh,
        computeMovers: computeMovers,
        showPanel: showPanel,
        showAsk: showAsk,
        showDeepDive: showDeepDive,
        selfTest: selfTest,
        _normUrl: normUrl
    };
    // Convenience global for the Reports menu onclick
    window.showCategoryPerformance = showPanel;
    window.showAskData = showAsk;
})();
