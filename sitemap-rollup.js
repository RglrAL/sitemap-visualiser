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

        // ── query index: aggregation, weighting, best-pos, category attribution, opportunity ──
        const qRows = [
            { query: 'q1', page: 'https://x/a/1', impressions: 100, clicks: 2,  position: 8 },
            { query: 'q1', page: 'https://x/b',   impressions: 50,  clicks: 1,  position: 4 },
            { query: 'q2', page: 'https://x/a/2', impressions: 200, clicks: 30, position: 2 }
        ];
        const qi = buildQueryIndex(qRows, r);
        const q1 = qi.find(function (x) { return x.query === 'q1'; });
        const q2 = qi.find(function (x) { return x.query === 'q2'; });
        // q1 counts summed across its two pages
        check('q1.impressions', q1.impressions, 150);
        check('q1.clicks', q1.clicks, 3);
        // q1 avg position impression-weighted = (8*100 + 4*50)/150 = 1000/150
        check('q1.position', q1.position, 1000 / 150);
        // q1 best position = 4 (page b); best page = b
        check('q1.bestPos', q1.bestPos, 4);
        results.push({ name: 'q1.bestPage', got: q1.bestPage, want: 'https://x/b', ok: q1.bestPage === 'https://x/b' });
        // attribution: A's page has 100 impr for q1 vs B's 50 -> owned by A
        results.push({ name: 'q1.category', got: q1.category, want: 'A', ok: q1.category === 'A' });
        // q1 potential = 150 * max(0, benchmark(3)=0.11 - ctr 3/150=0.02) = 150*0.09 = 13.5
        check('q1.potential', q1.potential, 13.5);
        // q2 already outperforms top-3 benchmark (15% CTR at pos 2) -> potential self-filters to 0
        check('q2.potential', q2.potential, 0);
        // labels: q1 best pos 4 -> snippet fix; q2 pos 2 -> also <=4.5 band
        results.push({ name: 'q1.label', got: q1.label, want: 'Fix title/snippet', ok: q1.label === 'Fix title/snippet' });

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

    // ══════════════════ Search query index (GSC 'query' dimension) ══════════════════
    // Standard organic CTR-by-position benchmark. MIRRORS getCTRBenchmark() in
    // gsc-integration-module.js (keep the two in sync) so Ask's opportunity numbers
    // agree with the per-page report's CTR analysis.
    function _ctrBenchmark(position) {
        if (position == null || !(position > 0)) return 0;
        if (position <= 1) return 0.28;
        if (position <= 2) return 0.15;
        if (position <= 3) return 0.11;
        if (position <= 4) return 0.08;
        if (position <= 5) return 0.06;
        if (position <= 10) return 0.03;
        return 0.01;
    }

    // normUrl -> category name, from a built rollup result (r.categories[].nodes subtrees).
    function _urlToCatMap(r) {
        const map = Object.create(null);
        r.categories.forEach(function (c) {
            (c.nodes || []).forEach(function walk(n) {
                if (n.url) { const k = normUrl(n.url); if (!(k in map)) map[k] = c.name; }
                (n.children || n._children || []).forEach(walk);
            });
        });
        return map;
    }

    // Aggregate raw {query, page, clicks, impressions, ctr, position} rows into a
    // per-query index. Deterministic maths only:
    //   counts summed; avg position impression-weighted; best (lowest) position +
    //   the page achieving it; each query ATTRIBUTED to the category whose pages
    //   earn the most impressions for it; opportunity score =
    //   impressions x max(0, benchmarkCTR(pos 3) - currentCTR)  ("extra clicks this
    //   period if it performed like a top-3 result" - already-great queries score ~0).
    function buildQueryIndex(rows, r) {
        const urlCat = _urlToCatMap(r);
        const byQ = new Map();
        (rows || []).forEach(function (row) {
            const q = String(row.query || '').trim();
            if (!q) return;
            let e = byQ.get(q);
            if (!e) { e = { query: q, impressions: 0, clicks: 0, _posSum: 0, _posW: 0, bestPos: null, bestPage: null, _catImp: Object.create(null) }; byQ.set(q, e); }
            const imp = num(row.impressions), clk = num(row.clicks), pos = num(row.position);
            e.impressions += imp; e.clicks += clk;
            if (imp > 0 && pos > 0) { e._posSum += pos * imp; e._posW += imp; }
            if (pos > 0 && (e.bestPos == null || pos < e.bestPos)) { e.bestPos = pos; e.bestPage = row.page || null; }
            const cat = urlCat[normUrl(row.page || '')];
            if (cat) e._catImp[cat] = (e._catImp[cat] || 0) + imp;
        });
        const out = [];
        byQ.forEach(function (e) {
            let cat = null, catBest = -1;
            for (const k in e._catImp) { if (e._catImp[k] > catBest) { catBest = e._catImp[k]; cat = k; } }
            const ctr = e.impressions > 0 ? e.clicks / e.impressions : 0;
            const pos = e._posW > 0 ? e._posSum / e._posW : null;
            const potential = e.impressions * Math.max(0, _ctrBenchmark(3) - ctr);
            // Action label (used by the opportunities view; self-explanatory rows):
            //   ranks well but under-clicked -> snippet problem; pos ~5-20 -> push it; pos >20 -> content gap.
            let label = null;
            if (e.bestPos != null) {
                if (e.bestPos <= 4.5) label = 'Fix title/snippet';
                else if (e.bestPos <= 20) label = 'Striking distance';
                else label = 'Build content';
            }
            out.push({ query: e.query, impressions: e.impressions, clicks: e.clicks, ctr: ctr,
                       position: pos, bestPos: e.bestPos, bestPage: e.bestPage,
                       category: cat, potential: potential, label: label });
        });
        return out;
    }

    // Lazy fetch of the raw query rows, cached per period (days) so the extra GSC
    // call only ever happens once per period, and only when a query intent runs.
    const _queryCache = {};   // days -> Promise<rows[]>
    function getQueryRows(days) {
        days = days || 30;
        if (_queryCache[days]) return _queryCache[days];
        const gsc = window.GSCIntegration;
        if (!gsc || !gsc.isConnected || !gsc.isConnected() || typeof gsc.fetchAllQueries !== 'function') {
            return Promise.resolve(null);   // not cached - may become available later
        }
        _queryCache[days] = gsc.fetchAllQueries({ days: days })
            .then(function (rows) { if (!rows || !rows.length) delete _queryCache[days]; return rows || []; })
            .catch(function (e) { delete _queryCache[days]; throw e; });
        return _queryCache[days];
    }

    // ── geography x queries: GSC 'country' is ISO-3166 alpha-3 (searcher location) ──
    const _COUNTRY_NAMES = {
        irl: 'Ireland', gbr: 'United Kingdom', usa: 'United States', aus: 'Australia', can: 'Canada', nzl: 'New Zealand',
        deu: 'Germany', fra: 'France', esp: 'Spain', ita: 'Italy', nld: 'Netherlands', bel: 'Belgium', lux: 'Luxembourg',
        pol: 'Poland', rou: 'Romania', prt: 'Portugal', che: 'Switzerland', aut: 'Austria', swe: 'Sweden', nor: 'Norway',
        dnk: 'Denmark', fin: 'Finland', isl: 'Iceland', grc: 'Greece', hun: 'Hungary', cze: 'Czechia', svk: 'Slovakia',
        ltu: 'Lithuania', lva: 'Latvia', est: 'Estonia', bgr: 'Bulgaria', hrv: 'Croatia', svn: 'Slovenia', mlt: 'Malta',
        cyp: 'Cyprus', ind: 'India', pak: 'Pakistan', nga: 'Nigeria', zaf: 'South Africa', ken: 'Kenya', egy: 'Egypt',
        mar: 'Morocco', are: 'United Arab Emirates', qat: 'Qatar', sau: 'Saudi Arabia', isr: 'Israel', tur: 'Turkey',
        ukr: 'Ukraine', rus: 'Russia', bra: 'Brazil', arg: 'Argentina', mex: 'Mexico', chn: 'China', jpn: 'Japan',
        kor: 'South Korea', phl: 'Philippines', tha: 'Thailand', mys: 'Malaysia', sgp: 'Singapore', hkg: 'Hong Kong',
        idn: 'Indonesia', vnm: 'Vietnam'
    };
    const _COUNTRY_ALIAS = {
        us: 'usa', usa: 'usa', america: 'usa', 'united states': 'usa', 'the united states': 'usa', 'united states of america': 'usa', 'the states': 'usa', 'the us': 'usa', states: 'usa',
        uk: 'gbr', 'united kingdom': 'gbr', britain: 'gbr', 'great britain': 'gbr', england: 'gbr', scotland: 'gbr',
        wales: 'gbr', 'northern ireland': 'gbr', gb: 'gbr', aussie: 'aus', 'new zealand': 'nzl', nz: 'nzl',
        uae: 'are', emirates: 'are', 'saudi arabia': 'sau', 'south korea': 'kor', korea: 'kor', 'czech republic': 'cze',
        czechia: 'cze', holland: 'nld', 'the netherlands': 'nld', 'hong kong': 'hkg'
    };
    function _countryName(code) { return _COUNTRY_NAMES[code] || (code ? code.toUpperCase() : ''); }
    function _resolveCountry(s) {
        if (!s) return null;
        const k = String(s).trim().toLowerCase();
        if (_COUNTRY_ALIAS[k]) return _COUNTRY_ALIAS[k];
        for (const code in _COUNTRY_NAMES) { if (_COUNTRY_NAMES[code].toLowerCase() === k) return code; }
        if (/^[a-z]{3}$/.test(k) && _COUNTRY_NAMES[k]) return k;
        return null;
    }
    // Aggregate raw query/country rows into per-query records (with the top country),
    // optionally keeping only rows whose country passes `keep`.
    function _aggCountryQueries(rows, keep) {
        const byQ = Object.create(null);
        rows.forEach(function (row) {
            if (keep && !keep(row.country)) return;
            const q = row.query; if (!q) return;
            let e = byQ[q]; if (!e) e = byQ[q] = { query: q, impressions: 0, clicks: 0, byC: Object.create(null) };
            e.impressions += row.impressions || 0; e.clicks += row.clicks || 0;
            const c = row.country || ''; e.byC[c] = (e.byC[c] || 0) + (row.impressions || 0);
        });
        return Object.keys(byQ).map(function (q) {
            const e = byQ[q]; let top = null, best = -1;
            for (const k in e.byC) { if (e.byC[k] > best) { best = e.byC[k]; top = k; } }
            return { query: q, impressions: e.impressions, clicks: e.clicks, topCountry: top };
        });
    }
    function _aggCountries(rows) {
        const byC = Object.create(null);
        rows.forEach(function (row) {
            const c = row.country || ''; if (!c) return;
            let e = byC[c]; if (!e) e = byC[c] = { country: c, impressions: 0, clicks: 0 };
            e.impressions += row.impressions || 0; e.clicks += row.clicks || 0;
        });
        return Object.keys(byC).map(function (c) { return byC[c]; });
    }
    const _countryQueryCache = {};   // days -> Promise<rows[]>
    function getCountryQueryRows(days) {
        days = days || 30;
        if (_countryQueryCache[days]) return _countryQueryCache[days];
        const gsc = window.GSCIntegration;
        if (!gsc || !gsc.isConnected || !gsc.isConnected() || typeof gsc.fetchQueriesByCountry !== 'function') {
            return Promise.resolve(null);
        }
        _countryQueryCache[days] = gsc.fetchQueriesByCountry({ days: days })
            .then(function (rows) { if (!rows || !rows.length) delete _countryQueryCache[days]; return rows || []; })
            .catch(function (e) { delete _countryQueryCache[days]; throw e; });
        return _countryQueryCache[days];
    }
    // Reuse SVGeoMap's world bubble map to visualise search DEMAND by country (bubbles
    // sized by GSC impressions instead of GA4 users). Self-inits via <img onload> so it
    // survives innerHTML injection; data is stashed on window.__svGeoData[uid].
    let _geoUid = 0;
    function _worldSearchMapHtml(rows) {
        if (typeof d3 === 'undefined' || !d3.geoNaturalEarth1 || !window.SVGeoMap || typeof window.SVGeoMap.initWorld !== 'function') return '';
        const cs = _aggCountries(rows).filter(function (x) { return x.country !== 'irl' && x.impressions > 0; });
        if (!cs.length) return '';
        const total = cs.reduce(function (s, x) { return s + x.impressions; }, 0) || 1;
        const mapData = cs.map(function (x) { return { country: _countryName(x.country), value: x.impressions, percentage: x.impressions / total * 100 }; });
        const uid = 'sv-qgeo-' + (++_geoUid);
        window.__svGeoData = window.__svGeoData || {};
        window.__svGeoData[uid] = mapData;
        return '<div style="margin:0 0 14px;">' +
            '<div class="sv-choropleth-wrap"><svg id="' + uid + '" class="sv-choropleth"></svg><div id="' + uid + '-tip" class="sv-choropleth-tip"></div></div>' +
            '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="" style="display:none" onload="window.SVGeoMap &amp;&amp; window.SVGeoMap.initWorld(\'' + uid + '\', {valueLabel:\'searches\'})">' +
            '</div>';
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
                const clickable = it.url ? ' class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(it.url) + '" style="cursor:pointer;"' : ' style=""';
                return '<div' + clickable + ' onmouseover="this.style.background=\'var(--color-bg-tertiary)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--color-border-primary);font-size:0.85rem;">' +
                    '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-primary);font-weight:600;">' + esc(it.name) + '</span>' +
                    '<span style="width:96px;flex-shrink:0;"><span style="display:block;height:6px;background:var(--color-bg-tertiary);border-radius:3px;overflow:hidden;"><span style="display:block;height:100%;width:' + bw + '%;background:' + col + ';"></span></span></span>' +
                    '<span style="width:88px;flex-shrink:0;text-align:right;font-weight:700;color:' + (it.valCol || 'var(--color-text-primary)') + ';">' + it.val + '</span>' +
                '</div></div>';
            }).join('') + '</div>';
    }
    // Two-line row card for query opportunities: query + potential on top,
    // position/impressions/CTR/action label beneath. Rows click through to the
    // best-ranking page's report via the existing sv-ask-page handler.
    function _oppCard(rows) {
        if (!rows.length) return '<div style="font-size:0.85rem;color:var(--color-text-muted);">No results.</div>';
        const max = Math.max.apply(null, rows.map(function (x) { return x.potential; }).concat([1]));
        return '<div style="border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);">' +
            rows.map(function (x) {
                const bw = Math.min(100, x.potential / max * 100);
                const sub = 'best pos ' + (x.bestPos != null ? '#' + x.bestPos.toFixed(0) : '?') + ' · ' +
                    fmt(x.impressions) + ' impressions · ' + (x.ctr * 100).toFixed(1) + '% CTR' +
                    (x.label ? ' · <span style="font-weight:700;color:var(--primary);">' + esc(x.label) + '</span>' : '');
                const clickable = x.bestPage ? ' class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(x.bestPage) + '"' : '';
                return '<div' + clickable + ' style="cursor:pointer;padding:8px 12px;border-bottom:1px solid var(--color-border-primary);" onmouseover="this.style.background=\'var(--color-bg-tertiary)\'" onmouseout="this.style.background=\'\'">' +
                    '<div style="display:flex;align-items:center;gap:10px;">' +
                        '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.85rem;font-weight:600;color:var(--color-text-primary);">' + esc(x.query) + '</span>' +
                        '<span style="width:96px;flex-shrink:0;"><span style="display:block;height:6px;background:var(--color-bg-tertiary);border-radius:3px;overflow:hidden;"><span style="display:block;height:100%;width:' + bw + '%;background:var(--primary);"></span></span></span>' +
                        '<span style="width:96px;flex-shrink:0;text-align:right;font-weight:700;font-size:0.85rem;color:var(--color-text-primary);">+' + fmt(Math.round(x.potential)) + ' clicks</span>' +
                    '</div>' +
                    '<div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:2px;">' + sub + '</div>' +
                '</div>';
            }).join('') + '</div>';
    }

    function _stripCard(rollup, hasGA4) {
        const cell = function (l, v) { return '<div style="flex:1;min-width:66px;padding:8px 10px;border-right:1px solid var(--color-border-primary);"><div style="font-size:0.56rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);">' + l + '</div><div style="font-size:1.05rem;font-weight:700;color:var(--color-text-primary);">' + v + '</div></div>'; };
        return '<div style="display:flex;flex-wrap:wrap;border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);">' +
            cell('Pages', fmt(rollup.leafCount)) + cell('Impressions', fmt(rollup.impressions)) + cell('Clicks', fmt(rollup.clicks)) +
            cell('CTR', (rollup.ctr * 100).toFixed(1) + '%') + cell('Avg pos', rollup.position != null ? rollup.position.toFixed(1) : '—') +
            (hasGA4 ? cell('Views', fmt(rollup.pageViews)) : '') + (hasGA4 ? cell('Users', fmt(rollup.users)) : '') + '</div>';
    }

    // Long-format metric rows for a rollup - used by summary/compare data + CSV export.
    function _metricRows(rollup, hasGA4) {
        const m = [['impressions', 'Impressions'], ['clicks', 'Clicks'], ['ctr', 'CTR %'], ['position', 'Avg position']].concat(hasGA4 ? [['pageViews', 'Views'], ['users', 'Users']] : []);
        return m.map(function (x) {
            const v = x[0] === 'ctr' ? +(rollup.ctr * 100).toFixed(2)
                : (x[0] === 'position' ? (rollup.position != null ? +rollup.position.toFixed(1) : null)
                : (rollup[x[0]] || 0));
            return { metric: x[1], value: v };
        });
    }

    // Resolve a page from a name in the question (exact name, then substring, best by traffic).
    function _findPage(pages, name) {
        if (!name) return null;
        const k = String(name).toLowerCase().trim().replace(/\s+page$/, '').replace(/^the\s+/, '');
        if (!k) return null;
        let exact = null; const incl = [];
        pages.forEach(function (p) {
            const pn = String(p.name || '').toLowerCase();
            if (pn === k) { if (!exact || (p.s.impressions || 0) > (exact.s.impressions || 0)) exact = p; }
            else if (pn.indexOf(k) >= 0 || (k.length >= 4 && k.indexOf(pn) >= 0)) incl.push(p);
        });
        if (exact) return exact;
        incl.sort(function (a, b) { return (b.s.impressions || 0) - (a.s.impressions || 0); });
        return incl[0] || null;
    }

    // ── keyword cannibalisation: 2+ of your own pages competing for one query ──
    function _shortUrl(u) { return String(u || '').replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'; }
    function _cannibalisation(rows, keepCat, urlCat) {
        const byQ = {};
        rows.forEach(function (row) {
            const q = row.query, p = row.page;
            if (!q || !p) return;
            if (keepCat && (urlCat[normUrl(p)] || null) !== keepCat) return;
            if (!byQ[q]) byQ[q] = { query: q, pages: {}, total: 0 };
            const e = byQ[q];
            if (!e.pages[p]) e.pages[p] = { url: p, impressions: 0, clicks: 0, _ps: 0, _pw: 0 };
            const pg = e.pages[p];
            pg.impressions += row.impressions || 0; pg.clicks += row.clicks || 0;
            if ((row.impressions || 0) > 0 && (row.position || 0) > 0) { pg._ps += row.position * row.impressions; pg._pw += row.impressions; }
            e.total += row.impressions || 0;
        });
        const out = [];
        Object.keys(byQ).forEach(function (q) {
            const e = byQ[q];
            const pages = Object.keys(e.pages).map(function (u) { const pg = e.pages[u]; return { url: u, impressions: pg.impressions, clicks: pg.clicks, position: pg._pw > 0 ? pg._ps / pg._pw : null }; })
                .filter(function (pg) { return pg.impressions >= 10; })
                .sort(function (a, b) { return b.impressions - a.impressions; });
            if (pages.length < 2 || e.total < 50) return;
            out.push({ query: q, total: e.total, competing: pages.length, pages: pages });
        });
        out.sort(function (a, b) { return b.total - a.total; });
        return out;
    }
    function _cannibalCard(items) {
        if (!items.length) return '<div style="font-size:0.85rem;color:var(--color-text-muted);">No cannibalisation found.</div>';
        return items.map(function (it) {
            const pagesHtml = it.pages.slice(0, 4).map(function (p) {
                return '<div class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(p.url) + '" style="cursor:pointer;display:flex;gap:8px;padding:4px 0 4px 14px;font-size:0.75rem;" onmouseover="this.style.color=\'var(--primary)\'" onmouseout="this.style.color=\'\'">' +
                    '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-secondary);">' + esc(_shortUrl(p.url)) + '</span>' +
                    '<span style="flex-shrink:0;color:var(--color-text-muted);">' + fmt(p.impressions) + ' impr &middot; #' + (p.position != null ? p.position.toFixed(0) : '-') + '</span>' +
                '</div>';
            }).join('');
            return '<div style="border:1px solid var(--color-border-primary);border-radius:10px;background:var(--color-bg-primary);padding:10px 12px;margin-bottom:10px;">' +
                '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:3px;"><span style="flex:1;min-width:0;font-weight:700;font-size:0.85rem;color:var(--color-text-primary);">' + esc(it.query) + '</span>' +
                '<span style="flex-shrink:0;font-size:0.68rem;font-weight:700;color:#d97706;">' + it.competing + ' pages competing</span></div>' +
                '<div style="font-size:0.66rem;color:var(--color-text-muted);margin-bottom:4px;">' + fmt(it.total) + ' impressions at stake</div>' +
                pagesHtml + '</div>';
        }).join('');
    }

    // ── deterministic charts: intent -> chart is decided in code (data.chart), never by the LLM ──
    function _renderChart(data) {
        if (!data || !data.chart) return '';
        const t = data.chart.type;
        if (t === 'diverging') return _chartDiverging(data);
        if (t === 'smallmultiples') return _chartSmallMultiples(data);
        if (t === 'line') return _chartLine(data);
        return '';   // 'bar'/null -> keep the rank card
    }
    function _chartDiverging(data) {
        const rows = data.rows || [];
        if (!rows.length) return '';
        const maxAbs = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.changePct || 0); }).concat([1]));
        const body = rows.map(function (r) {
            const pct = r.changePct || 0, up = pct >= 0, w = Math.min(100, Math.abs(pct) / maxAbs * 100) * 0.5;
            const col = up ? '#059669' : '#dc2626';
            const valTxt = (up ? '+' : '') + (Math.abs(pct) > 500 ? (up ? '500+' : '-500+') : pct.toFixed(0)) + '%';
            const clickable = r.url ? ' class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(r.url) + '" style="cursor:pointer;"' : '';
            return '<div' + clickable + ' onmouseover="this.style.background=\'var(--color-bg-tertiary)\'" onmouseout="this.style.background=\'\'" style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:5px;font-size:0.8rem;">' +
                '<span style="width:38%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-primary);font-weight:600;">' + esc(r.page) + '</span>' +
                '<span style="position:relative;flex:1;height:12px;">' +
                    '<span style="position:absolute;top:0;bottom:0;left:50%;width:1px;background:var(--color-border-primary);"></span>' +
                    '<span style="position:absolute;top:1px;bottom:1px;background:' + col + ';border-radius:3px;' + (up ? 'left:50%;width:' + w + '%;' : 'right:50%;width:' + w + '%;') + '"></span>' +
                '</span>' +
                '<span style="width:52px;flex-shrink:0;text-align:right;font-weight:700;color:' + col + ';">' + valTxt + '</span>' +
            '</div>';
        }).join('');
        return '<div style="border:1px solid var(--color-border-primary);border-radius:10px;background:var(--color-bg-primary);padding:8px 10px;">' + body + '</div>';
    }
    function _chartSmallMultiples(data) {
        const rows = data.rows || [];
        if (!rows.length) return '';
        const aName = (data.columns[1] && data.columns[1].label) || 'A';
        const bName = (data.columns[2] && data.columns[2].label) || 'B';
        const cA = 'var(--primary)', cB = '#94a3b8';
        const fmtV = function (metric, v) { return /CTR/i.test(metric) ? (Number(v) || 0).toFixed(1) + '%' : (/position/i.test(metric) ? (v == null ? '-' : Number(v).toFixed(1)) : fmt(Number(v) || 0)); };
        const legend = '<div style="display:flex;gap:14px;margin-bottom:10px;font-size:0.72rem;color:var(--color-text-secondary);">' +
            '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:' + cA + ';display:inline-block;"></span>' + esc(aName) + '</span>' +
            '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:' + cB + ';display:inline-block;"></span>' + esc(bName) + '</span></div>';
        const bar = function (metric, v, col) { const mx = arguments[3]; return '<div style="display:flex;align-items:center;gap:6px;margin-top:3px;"><div style="height:9px;width:' + (Math.abs(Number(v) || 0) / mx * 100) + '%;min-width:2px;background:' + col + ';border-radius:3px;"></div><span style="font-size:0.7rem;color:var(--color-text-secondary);font-weight:600;white-space:nowrap;">' + fmtV(metric, v) + '</span></div>'; };
        const cells = rows.map(function (r) {
            const a = Number(r.a) || 0, b = Number(r.b) || 0, mx = Math.max(a, b, 1);
            return '<div style="margin-bottom:12px;"><div style="font-size:0.66rem;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.03em;">' + esc(r.metric) + '</div>' + bar(r.metric, a, cA, mx) + bar(r.metric, b, cB, mx) + '</div>';
        }).join('');
        return '<div style="border:1px solid var(--color-border-primary);border-radius:10px;background:var(--color-bg-primary);padding:12px 14px;">' + legend + cells + '</div>';
    }
    function _chartLine(data) {
        const rows = data.rows || [];
        if (rows.length < 2) return '';
        const W = 400, H = 140, padL = 8, padR = 8, padT = 14, padB = 22;
        const vals = rows.map(function (r) { return Number(r.value) || 0; });
        const maxV = Math.max.apply(null, vals.concat([1])), n = rows.length;
        const x = function (i) { return padL + (i / (n - 1)) * (W - padL - padR); };
        const y = function (v) { return padT + (1 - v / (maxV || 1)) * (H - padT - padB); };
        const pts = rows.map(function (r, i) { return x(i) + ',' + y(Number(r.value) || 0); }).join(' ');
        const area = 'M' + x(0) + ',' + y(0) + ' L' + rows.map(function (r, i) { return x(i) + ',' + y(Number(r.value) || 0); }).join(' L') + ' L' + x(n - 1) + ',' + y(0) + ' Z';
        const dots = rows.map(function (r, i) { return '<circle cx="' + x(i) + '" cy="' + y(Number(r.value) || 0) + '" r="2.5" fill="var(--primary)"></circle>'; }).join('');
        const labels = rows.map(function (r, i) { return '<text x="' + x(i) + '" y="' + (H - 6) + '" font-size="8" text-anchor="middle" fill="var(--color-text-muted)">' + esc(r.period) + '</text>'; }).join('');
        const valLabels = rows.map(function (r, i) { return '<text x="' + x(i) + '" y="' + (y(Number(r.value) || 0) - 6) + '" font-size="8" text-anchor="middle" fill="var(--color-text-secondary)" font-weight="600">' + fmt(Number(r.value) || 0) + '</text>'; }).join('');
        return '<div style="border:1px solid var(--color-border-primary);border-radius:10px;background:var(--color-bg-primary);padding:10px;">' +
            '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;">' +
            '<path d="' + area + '" fill="var(--primary)" opacity="0.08"></path>' +
            '<polyline points="' + pts + '" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>' +
            dots + valLabels + labels + '</svg></div>';
    }

    // Cached period-window fetch for the trend intent (keyed by days:offset).
    const _trendCache = {};
    function fetchTrendWindow(tree, days, offset) {
        const key = days + ':' + offset;
        if (_trendCache[key]) return _trendCache[key];
        _trendCache[key] = fetchPeriodMaps(tree, days, offset).catch(function (e) { delete _trendCache[key]; throw e; });
        return _trendCache[key];
    }

    async function runIntent(plan, r) {
        const cats = r.categories, hasGA4 = r.totals.pageViews > 0 || r.totals.users > 0;
        const metric = ['impressions', 'clicks', 'ctr', 'position', 'pageViews', 'users'].indexOf(plan.metric) >= 0 ? plan.metric : 'impressions';
        const limit = Math.min(15, Math.max(1, plan.limit || 6));
        const intent = plan.intent;

        if (intent === 'site_summary') {
            return { html: _stripCard(r.totals, hasGA4), summary: 'Whole site: ' + fmt(r.totals.impressions) + ' impressions, ' + fmt(r.totals.clicks) + ' clicks, ' + (r.totals.ctr * 100).toFixed(1) + '% CTR, ' + fmt(r.totals.leafCount) + ' content pages.', data: { columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows: _metricRows(r.totals, hasGA4), chart: null } };
        }
        if (intent === 'section_summary') {
            const c = _catByName(cats, plan.category);
            if (!c) return { html: '', summary: '', err: 'I couldn\'t find that section.' };
            return { html: '<div style="font-weight:700;margin-bottom:8px;">' + esc(c.name) + '</div>' + _stripCard(c.rollup, hasGA4), summary: c.name + ': ' + fmt(c.rollup.impressions) + ' impressions, ' + (c.rollup.ctr * 100).toFixed(1) + '% CTR, ' + fmt(c.rollup.pageViews) + ' views, ' + fmt(c.rollup.leafCount) + ' pages.', data: { columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows: _metricRows(c.rollup, hasGA4), chart: null } };
        }
        if (intent === 'rank_categories') {
            const desc = plan.direction !== 'up';
            const sorted = cats.slice().sort(function (a, b) { const av = _mval(a.rollup, metric), bv = _mval(b.rollup, metric); return desc ? bv - av : av - bv; }).slice(0, limit);
            const items = sorted.map(function (c) { return { name: c.name, val: _mfmt(c.rollup, metric), bar: _mval(c.rollup, metric) }; });
            return { html: _rankCard(items), summary: 'Sections by ' + _MLABEL[metric] + ': ' + sorted.map(function (c) { return c.name + ' ' + _mfmt(c.rollup, metric); }).join(', ') + '.', data: { columns: [{ key: 'section', label: 'Section' }, { key: 'value', label: _MLABEL[metric] }], rows: sorted.map(function (c) { return { section: c.name, value: _mval(c.rollup, metric), display: _mfmt(c.rollup, metric) }; }), chart: { type: 'bar', x: 'section', y: 'value', label: _MLABEL[metric] } } };
        }
        if (intent === 'top_pages') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const desc = plan.direction !== 'up';
            const sorted = pages.filter(function (p) { return _mval(p.s, metric) > 0; }).sort(function (a, b) { const av = _mval(a.s, metric), bv = _mval(b.s, metric); return desc ? bv - av : av - bv; }).slice(0, limit);
            if (!sorted.length) return { html: '', err: 'No pages with ' + _MLABEL[metric] + ' data found' + (c ? ' in ' + c.name : '') + '. (' + pages.length + ' pages checked — is GA4 connected for views/users?)', summary: '' };
            const items = sorted.map(function (p) { return { name: p.name, val: _mfmt(p.s, metric), bar: _mval(p.s, metric), url: p.url }; });
            return { html: _rankCard(items), summary: 'Top pages' + (c ? ' in ' + c.name : '') + ' by ' + _MLABEL[metric] + ': ' + sorted.slice(0, 5).map(function (p) { return p.name + ' ' + _mfmt(p.s, metric); }).join(', ') + '.', data: { columns: [{ key: 'page', label: 'Page' }, { key: 'value', label: _MLABEL[metric] }, { key: 'url', label: 'URL' }], rows: sorted.map(function (p) { return { page: p.name, value: _mval(p.s, metric), display: _mfmt(p.s, metric), url: p.url }; }), chart: { type: 'bar', x: 'page', y: 'value', label: _MLABEL[metric] } } };
        }
        if (intent === 'low_ctr') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const avg = (c ? c.rollup.ctr : r.totals.ctr) || 0;
            const rows = pages.filter(function (p) { return (p.s.impressions || 0) >= 300 && p.s.ctr < Math.max(0.005, avg * 0.6); }).sort(function (a, b) { return b.s.impressions - a.s.impressions; }).slice(0, limit);
            const items = rows.map(function (p) { return { name: p.name, val: (p.s.ctr * 100).toFixed(1) + '%', bar: p.s.impressions, url: p.url }; });
            return { html: _rankCard(items), summary: 'High-impression, low-CTR pages' + (c ? ' in ' + c.name : '') + ': ' + rows.slice(0, 5).map(function (p) { return p.name + ' (' + fmt(p.s.impressions) + ' impr, ' + (p.s.ctr * 100).toFixed(1) + '%)'; }).join(', ') + '.', data: { columns: [{ key: 'page', label: 'Page' }, { key: 'impressions', label: 'Impressions' }, { key: 'ctr', label: 'CTR %' }, { key: 'url', label: 'URL' }], rows: rows.map(function (p) { return { page: p.name, impressions: p.s.impressions || 0, ctr: +((p.s.ctr || 0) * 100).toFixed(2), url: p.url }; }), chart: { type: 'bar', x: 'page', y: 'impressions', label: 'Impressions' } } };
        }
        if (intent === 'stale') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const now = Date.now();
            const rows = pages.map(function (p) { const t = p.lm ? Date.parse(p.lm) : NaN; return { p: p, m: isNaN(t) ? null : (now - t) / (1000 * 60 * 60 * 24 * 30.44) }; }).filter(function (x) { return x.m != null && x.m > 12; }).sort(function (a, b) { return b.m - a.m; }).slice(0, limit);
            const items = rows.map(function (x) { return { name: x.p.name, val: Math.round(x.m) + 'mo', bar: x.m, url: x.p.url }; });
            return { html: _rankCard(items), summary: (rows.length ? rows.length : 'No') + ' stale pages' + (c ? ' in ' + c.name : '') + ' (over 12 months old)' + (rows.length ? ', oldest: ' + rows.slice(0, 4).map(function (x) { return x.p.name + ' (' + Math.round(x.m) + 'mo)'; }).join(', ') : '') + '.', data: { columns: [{ key: 'page', label: 'Page' }, { key: 'monthsOld', label: 'Months old' }, { key: 'lastModified', label: 'Last modified' }, { key: 'url', label: 'URL' }], rows: rows.map(function (x) { return { page: x.p.name, monthsOld: Math.round(x.m), lastModified: x.p.lm || '', url: x.p.url }; }), chart: { type: 'bar', x: 'page', y: 'monthsOld', label: 'Months old' } } };
        }
        if (intent === 'compare') {
            const names = plan.categories || [];
            const a = _catByName(cats, names[0]), b = _catByName(cats, names[1]);
            if (!a || !b) return { html: '', summary: '', err: 'I need two sections to compare.' };
            return { html: '<div style="font-weight:700;margin:2px 0 6px;">' + esc(a.name) + '</div>' + _stripCard(a.rollup, hasGA4) + '<div style="font-weight:700;margin:12px 0 6px;">' + esc(b.name) + '</div>' + _stripCard(b.rollup, hasGA4),
                summary: a.name + ' vs ' + b.name + ': impressions ' + fmt(a.rollup.impressions) + ' vs ' + fmt(b.rollup.impressions) + ', CTR ' + (a.rollup.ctr * 100).toFixed(1) + '% vs ' + (b.rollup.ctr * 100).toFixed(1) + '%.', data: { columns: [{ key: 'metric', label: 'Metric' }, { key: 'a', label: a.name }, { key: 'b', label: b.name }], rows: (function () { const ra = _metricRows(a.rollup, hasGA4), rb = _metricRows(b.rollup, hasGA4); return ra.map(function (x, i) { return { metric: x.metric, a: x.value, b: rb[i].value }; }); })(), chart: { type: 'smallmultiples', a: a.name, b: b.name } } };
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
            return { html: _rankCard(items), summary: 'Biggest ' + (dir === 'down' ? 'fallers' : dir === 'up' ? 'risers' : 'movers') + (c ? ' in ' + c.name : ' across the site') + ' vs the previous ' + _ddDays + ' days: ' + rows.slice(0, 5).map(function (x) { return x.name + ' ' + (x.pct >= 0 ? '+' : '') + x.pct.toFixed(0) + '%'; }).join(', ') + '.', data: { columns: [{ key: 'page', label: 'Page' }, { key: 'changePct', label: 'Change %' }, { key: 'current', label: 'Current' }, { key: 'url', label: 'URL' }], rows: rows.map(function (x) { return { page: x.name, changePct: +x.pct.toFixed(1), current: x.cur, url: x.url }; }), chart: { type: 'diverging', x: 'page', y: 'changePct' } } };
        }
        if (intent === 'opportunities' || intent === 'top_queries') {
            let rows;
            try { rows = await getQueryRows(_ddDays); }
            catch (e) { return { html: '', summary: '', err: 'Couldn\'t fetch search-query data: ' + (e && e.message ? e.message : String(e)) }; }
            if (rows == null) {
                const _g = window.GSCIntegration;
                const _connected = _g && _g.isConnected && _g.isConnected();
                return { html: '', summary: '', err: _connected
                    ? 'Search-query data needs the updated GSC module. Redeploy gsc-integration-module.js (it must include fetchAllQueries) and hard-refresh.'
                    : 'Search-query answers need a Search Console connection.' };
            }
            if (!rows.length) return { html: '', summary: '', err: 'No search-query data came back for ' + periodLabel(_ddDays) + '.' };
            const idx = buildQueryIndex(rows, r);
            const c = _catByName(cats, plan.category);
            let qs = c ? idx.filter(function (x) { return x.category === c.name; }) : idx;

            if (intent === 'top_queries') {
                const mkey = metric === 'clicks' ? 'clicks' : 'impressions';
                qs = qs.filter(function (x) { return x[mkey] > 0; })
                       .sort(function (a, b) { return b[mkey] - a[mkey]; }).slice(0, limit);
                if (!qs.length) return { html: '', summary: '', err: 'No search queries found' + (c ? ' for ' + c.name : '') + ' in this period.' };
                const items = qs.map(function (x) {
                    return { name: x.query, val: fmt(x[mkey]) + (x.bestPos != null ? ' · #' + x.bestPos.toFixed(0) : ''), bar: x[mkey], url: x.bestPage };
                });
                return { html: _rankCard(items),
                    summary: 'Top searches' + (c ? ' in ' + c.name : ' site-wide') + ' by ' + mkey + ' (' + periodLabel(_ddDays) + '): ' +
                        qs.slice(0, 6).map(function (x) { return '"' + x.query + '" ' + fmt(x[mkey]) + (x.bestPos != null ? ' (best pos ' + x.bestPos.toFixed(0) + ')' : ''); }).join(', ') + '.', data: { columns: [{ key: 'query', label: 'Query' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }, { key: 'bestPosition', label: 'Best position' }, { key: 'section', label: 'Section' }, { key: 'bestPage', label: 'Best page' }], rows: qs.map(function (x) { return { query: x.query, impressions: x.impressions, clicks: x.clicks, bestPosition: x.bestPos != null ? +x.bestPos.toFixed(1) : null, section: x.category || '', bestPage: x.bestPage || '' }; }), chart: { type: 'bar', x: 'query', y: mkey, label: mkey === 'clicks' ? 'Clicks' : 'Impressions' } } };
            }

            // opportunities: rank by potential extra clicks; floors keep out noise.
            qs = qs.filter(function (x) { return x.impressions >= 100 && x.potential >= 5; })
                   .sort(function (a, b) { return b.potential - a.potential; }).slice(0, limit);
            if (!qs.length) return { html: '', summary: '', err: 'No sizeable search opportunities found' + (c ? ' in ' + c.name : '') + ' for ' + periodLabel(_ddDays) + ' - CTR looks healthy on the big queries.' };
            return { html: _oppCard(qs),
                summary: 'Biggest search opportunities' + (c ? ' in ' + c.name : '') + ' (potential extra clicks over ' + periodLabel(_ddDays) + ', if each performed like a top-3 result): ' +
                    qs.slice(0, 5).map(function (x) { return '"' + x.query + '" +' + fmt(Math.round(x.potential)) + ' clicks (best pos ' + (x.bestPos != null ? x.bestPos.toFixed(0) : '?') + ', ' + (x.label || '') + ')'; }).join(', ') + '.', data: { columns: [{ key: 'query', label: 'Query' }, { key: 'potentialClicks', label: 'Potential clicks' }, { key: 'bestPosition', label: 'Best position' }, { key: 'impressions', label: 'Impressions' }, { key: 'ctr', label: 'CTR %' }, { key: 'action', label: 'Action' }, { key: 'section', label: 'Section' }, { key: 'bestPage', label: 'Best page' }], rows: qs.map(function (x) { return { query: x.query, potentialClicks: Math.round(x.potential), bestPosition: x.bestPos != null ? +x.bestPos.toFixed(1) : null, impressions: x.impressions, ctr: +((x.ctr || 0) * 100).toFixed(2), action: x.label || '', section: x.category || '', bestPage: x.bestPage || '' }; }), chart: { type: 'bar', x: 'query', y: 'potentialClicks', label: 'Potential clicks' } } };
        }
        if (intent === 'international_queries' || intent === 'top_countries') {
            let rows;
            try { rows = await getCountryQueryRows(_ddDays); }
            catch (e) { return { html: '', summary: '', err: 'Couldn\'t fetch country search data: ' + (e && e.message ? e.message : String(e)) }; }
            if (rows == null) {
                const _g = window.GSCIntegration;
                const _connected = _g && _g.isConnected && _g.isConnected();
                return { html: '', summary: '', err: _connected
                    ? 'Country search data needs the updated GSC module. Redeploy gsc-integration-module.js (it must include fetchQueriesByCountry) and hard-refresh.'
                    : 'Country search answers need a Search Console connection.' };
            }
            if (!rows.length) return { html: '', summary: '', err: 'No country search data came back for ' + periodLabel(_ddDays) + '.' };

            if (intent === 'top_countries') {
                const mkey = metric === 'clicks' ? 'clicks' : 'impressions';
                const cs = _aggCountries(rows).filter(function (x) { return x.country !== 'irl' && x[mkey] > 0; })
                    .sort(function (a, b) { return b[mkey] - a[mkey]; }).slice(0, limit);
                if (!cs.length) return { html: '', summary: '', err: 'No international search data for ' + periodLabel(_ddDays) + '.' };
                const items = cs.map(function (x) { return { name: _countryName(x.country), val: fmt(x[mkey]), bar: x[mkey] }; });
                return { html: _worldSearchMapHtml(rows) + _rankCard(items),
                    summary: 'Countries searching the site the most (excluding Ireland, ' + periodLabel(_ddDays) + ', by ' + mkey + '): ' + cs.slice(0, 6).map(function (x) { return _countryName(x.country) + ' ' + fmt(x[mkey]); }).join(', ') + '.',
                    data: { columns: [{ key: 'country', label: 'Country' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }], rows: cs.map(function (x) { return { country: _countryName(x.country), impressions: x.impressions, clicks: x.clicks }; }), chart: { type: 'bar', x: 'country', y: mkey, label: mkey === 'clicks' ? 'Clicks' : 'Impressions' } } };
            }

            // international_queries: top searches from abroad, or from a named country.
            const code = plan.country ? _resolveCountry(plan.country) : null;
            const scopeName = code ? _countryName(code) : 'abroad';
            const keep = code ? function (c) { return c === code; } : function (c) { return c && c !== 'irl'; };
            const qs = _aggCountryQueries(rows, keep).filter(function (x) { return x.impressions > 0; })
                .sort(function (a, b) { return b.impressions - a.impressions; }).slice(0, limit);
            if (!qs.length) return { html: '', summary: '', err: 'No searches found from ' + scopeName + ' for ' + periodLabel(_ddDays) + '.' + (plan.country && !code ? ' (I didn\'t recognise that country.)' : '') };
            const items = qs.map(function (x) { return { name: x.query, val: fmt(x.impressions), bar: x.impressions }; });
            return { html: _rankCard(items),
                summary: 'Top searches from ' + scopeName + ' (' + periodLabel(_ddDays) + '): ' + qs.slice(0, 6).map(function (x) { return '"' + x.query + '" ' + fmt(x.impressions) + ' impr' + (!code && x.topCountry ? ' (mostly ' + _countryName(x.topCountry) + ')' : ''); }).join(', ') + '.',
                data: { columns: [{ key: 'query', label: 'Query' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }].concat(code ? [] : [{ key: 'topCountry', label: 'Top country' }]), rows: qs.map(function (x) { return { query: x.query, impressions: x.impressions, clicks: x.clicks, topCountry: _countryName(x.topCountry) }; }), chart: { type: 'bar', x: 'query', y: 'impressions', label: 'Impressions' } } };
        }
        if (intent === 'trend') {
            const c = _catByName(cats, plan.category);
            const tmetric = ['impressions', 'clicks', 'pageViews', 'users'].indexOf(metric) >= 0 ? metric : 'impressions';
            const N = 6, win = 30;
            const series = [];
            for (let i = N - 1; i >= 0; i--) {
                let val = 0;
                try {
                    const maps = await fetchTrendWindow(window.treeData, win, i * win);
                    const rb = build(window.treeData, { statsFor: statsForMaps(maps.gscBy, maps.ga4By) });
                    if (c) { const cc = _catByName(rb.categories, c.name); val = cc ? _mval(cc.rollup, tmetric) : 0; }
                    else { val = _mval(rb.totals, tmetric); }
                } catch (e) { val = 0; }
                series.push({ period: i === 0 ? 'now' : i + 'mo ago', value: Math.round(val) });
            }
            build(window.treeData);   // restore current-period annotations on the tree
            const nonzero = series.filter(function (s) { return s.value > 0; }).length;
            if (nonzero < 2) return { html: '', summary: '', err: 'Not enough history to plot a trend' + (c ? ' for ' + c.name : '') + '. (Needs GSC/GA4 data across several months.)' };
            const first = series[0].value, last = series[series.length - 1].value;
            const chg = first > 0 ? Math.round((last - first) / first * 100) : null;
            return {
                html: '',
                summary: (c ? c.name : 'The site') + ' ' + _MLABEL[tmetric] + ' over the last ' + N + ' months: ' + series.map(function (s) { return s.period + ' ' + fmt(s.value); }).join(', ') + (chg != null ? ' (' + (chg >= 0 ? '+' : '') + chg + '% overall)' : '') + '.',
                data: { columns: [{ key: 'period', label: 'Period' }, { key: 'value', label: _MLABEL[tmetric] }], rows: series, chart: { type: 'line', x: 'period', y: 'value', label: _MLABEL[tmetric] } }
            };
        }
        if (intent === 'diagnose') {
            const page = _findPage(_allPages(r), plan.page || plan.category || '');
            if (!page) return { html: '', summary: '', err: 'I could not find that page. Name it as it appears in the sitemap (e.g. "Fuel Allowance").' };
            const s = page.s || {};
            const impressions = s.impressions || 0, ctr = s.ctr || 0, position = s.position, pv = s.pageViews || 0;
            const bench = _ctrBenchmark(position);
            let prevImp = 0;
            try { const prior = await getPriorMaps(window.treeData, _ddDays); (page.urls || [page.url]).forEach(function (u) { const p = prior.gscBy[normUrl(u)]; if (p) prevImp += (p.impressions || 0); }); } catch (e) {}
            const impChg = prevImp >= 50 ? Math.round((impressions - prevImp) / prevImp * 100) : null;
            const months = page.lm ? (Date.now() - Date.parse(page.lm)) / (1000 * 60 * 60 * 24 * 30.44) : null;
            let qrows = [];
            try { const all = await getQueryRows(_ddDays); if (all && all.length) { const set = {}; (page.urls || [page.url]).forEach(function (u) { set[normUrl(u)] = 1; }); qrows = all.filter(function (row) { return set[normUrl(row.page || '')]; }); } } catch (e) {}
            const byQ = {}; qrows.forEach(function (row) { const q = row.query; if (!q) return; byQ[q] = (byQ[q] || 0) + (row.impressions || 0); });
            const topQ = Object.keys(byQ).map(function (q) { return { query: q, impressions: byQ[q] }; }).sort(function (a, b) { return b.impressions - a.impressions; }).slice(0, 6);
            const signals = [];
            if (impressions < 50) signals.push({ sev: 'info', t: 'Low search demand', d: 'Only ' + fmt(impressions) + ' impressions - few people search for this topic.' });
            if (position != null && position > 15 && impressions >= 50) signals.push({ sev: 'warn', t: 'Weak ranking', d: 'Ranks about #' + position.toFixed(0) + ' - needs stronger content or internal links to climb.' });
            else if (position != null && position > 7 && position <= 15) signals.push({ sev: 'info', t: 'Striking distance', d: 'Just off page one at #' + position.toFixed(0) + ' - a refresh could push it up.' });
            if (position != null && position <= 10 && bench > 0 && ctr < bench * 0.6 && impressions >= 50) signals.push({ sev: 'warn', t: 'Low click-through', d: 'Ranks well (#' + position.toFixed(0) + ') but only ' + (ctr * 100).toFixed(1) + '% click (typical is ~' + (bench * 100).toFixed(0) + '%) - the title/meta description may not be compelling.' });
            if (months != null && months > 18) signals.push({ sev: 'warn', t: 'Stale content', d: 'Last updated about ' + Math.round(months) + ' months ago - a refresh may help.' });
            else if (months != null && months > 12) signals.push({ sev: 'info', t: 'Ageing content', d: 'Last updated about ' + Math.round(months) + ' months ago.' });
            if (impChg != null && impChg <= -20) signals.push({ sev: 'warn', t: 'Declining', d: 'Impressions down ' + Math.abs(impChg) + '% vs the previous period.' });
            else if (impChg != null && impChg >= 20) signals.push({ sev: 'good', t: 'Growing', d: 'Impressions up ' + impChg + '% vs the previous period.' });
            if (!signals.length) signals.push({ sev: 'good', t: 'Looks healthy', d: 'No obvious problems - metrics are in a reasonable range.' });
            const sevCol = { warn: '#d97706', info: '#0369a1', good: '#059669' };
            const sigHtml = signals.map(function (x) { return '<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--color-border-primary);font-size:0.82rem;"><span style="width:7px;height:7px;border-radius:50%;background:' + sevCol[x.sev] + ';margin-top:5px;flex-shrink:0;"></span><span><span style="font-weight:700;color:var(--color-text-primary);">' + esc(x.t) + '</span> <span style="color:var(--color-text-secondary);">' + esc(x.d) + '</span></span></div>'; }).join('');
            const head = '<div class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(page.url) + '" style="cursor:pointer;font-weight:700;color:var(--color-text-heading);margin-bottom:4px;">' + esc(page.name) + '</div>';
            const stat = '<div style="font-size:0.72rem;color:var(--color-text-muted);margin-bottom:12px;">' + fmt(impressions) + ' impr &middot; ' + (ctr * 100).toFixed(1) + '% CTR &middot; pos ' + (position != null ? position.toFixed(1) : '-') + (pv ? (' &middot; ' + fmt(pv) + ' views') : '') + (impChg != null ? (' &middot; ' + (impChg >= 0 ? '+' : '') + impChg + '% vs prev') : '') + '</div>';
            const sigCard = '<div style="border:1px solid var(--color-border-primary);border-radius:10px;background:var(--color-bg-primary);padding:2px 12px;margin-bottom:12px;">' + sigHtml + '</div>';
            const qCard = topQ.length ? ('<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:6px;">Top queries for this page</div>' + _rankCard(topQ.map(function (x) { return { name: x.query, val: fmt(x.impressions), bar: x.impressions }; }))) : '';
            return {
                html: head + stat + sigCard + qCard,
                summary: 'Page "' + page.name + '": ' + fmt(impressions) + ' impressions, ' + (ctr * 100).toFixed(1) + '% CTR, position ' + (position != null ? position.toFixed(1) : 'n/a') + (impChg != null ? (', ' + (impChg >= 0 ? '+' : '') + impChg + '% vs previous period') : '') + (months != null ? (', updated ~' + Math.round(months) + 'mo ago') : '') + '. Findings: ' + signals.map(function (x) { return x.t + ' (' + x.d + ')'; }).join('; ') + '.',
                data: { columns: [{ key: 'finding', label: 'Finding' }, { key: 'detail', label: 'Detail' }], rows: signals.map(function (x) { return { finding: x.t, detail: x.d }; }), chart: null }
            };
        }
        if (intent === 'questions') {
            let rows;
            try { rows = await getQueryRows(_ddDays); }
            catch (e) { return { html: '', summary: '', err: 'Could not fetch search-query data: ' + (e && e.message ? e.message : String(e)) }; }
            if (rows == null) {
                const _g = window.GSCIntegration, _c = _g && _g.isConnected && _g.isConnected();
                return { html: '', summary: '', err: _c ? 'Search-query data needs the updated GSC module. Redeploy gsc-integration-module.js (it must include fetchAllQueries) and hard-refresh.' : 'Search-query answers need a Search Console connection.' };
            }
            if (!rows.length) return { html: '', summary: '', err: 'No search-query data came back for ' + periodLabel(_ddDays) + '.' };
            const c = _catByName(cats, plan.category);
            const urlCat = c ? _urlToCatMap(r) : null;
            const QRE = /^(how|what|when|where|why|who|which|can|do|does|is|are|am|should|could|will|would)\b|\bhow to\b|\bentitled\b|\bhow do i\b|\bcan i\b|\bdo i\b/i;
            const byQ = {};
            rows.forEach(function (row) {
                const q = row.query; if (!q || !QRE.test(q)) return;
                if (c) { if ((urlCat[normUrl(row.page || '')] || null) !== c.name) return; }
                if (!byQ[q]) byQ[q] = { query: q, impressions: 0, clicks: 0, bestPage: null, _bp: -1 };
                byQ[q].impressions += row.impressions || 0; byQ[q].clicks += row.clicks || 0;
                if ((row.impressions || 0) > byQ[q]._bp) { byQ[q]._bp = row.impressions || 0; byQ[q].bestPage = row.page; }
            });
            const qs = Object.keys(byQ).map(function (q) { return byQ[q]; }).filter(function (x) { return x.impressions > 0; }).sort(function (a, b) { return b.impressions - a.impressions; }).slice(0, Math.max(limit, 10));
            if (!qs.length) return { html: '', summary: '', err: 'No question-style searches found' + (c ? ' in ' + c.name : '') + ' for ' + periodLabel(_ddDays) + '.' };
            const items = qs.map(function (x) { return { name: x.query, val: fmt(x.impressions), bar: x.impressions, url: x.bestPage }; });
            return {
                html: _rankCard(items),
                summary: 'Question-style searches' + (c ? ' in ' + c.name : ' site-wide') + ' (' + periodLabel(_ddDays) + '), most-searched first: ' + qs.slice(0, 10).map(function (x) { return '"' + x.query + '" ' + fmt(x.impressions); }).join(', ') + '. In one sentence, name the 2-3 themes people are asking about.',
                data: { columns: [{ key: 'question', label: 'Question' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }, { key: 'bestPage', label: 'Best page' }], rows: qs.map(function (x) { return { question: x.query, impressions: x.impressions, clicks: x.clicks, bestPage: x.bestPage || '' }; }), chart: { type: 'bar', x: 'question', y: 'impressions', label: 'Impressions' } }
            };
        }
        if (intent === 'language_gap') {
            const byKey = {};
            (function walk(n) {
                if (n.url) {
                    const low = n.url.toLowerCase();
                    let lang = null;
                    if (/\/ga(\/|$)/.test(low)) lang = 'ga';
                    else if (/\/en(\/|$)/.test(low)) lang = 'en';
                    if (lang) {
                        const key = low.replace(/\/(en|ga)(\/|$)/, '/*$2');
                        const st = statsForUrl(n.url) || {};
                        if (!byKey[key]) byKey[key] = {};
                        byKey[key][lang] = { url: n.url, name: n.name, impr: st.impressions || 0, pv: st.pageViews || 0 };
                    }
                }
                (n.children || n._children || []).forEach(walk);
            })(window.treeData);
            const useImp = r.totals.impressions > 0;
            const gaps = [];
            Object.keys(byKey).forEach(function (k) {
                const pair = byKey[k]; if (!pair.en || !pair.ga) return;
                const enV = useImp ? pair.en.impr : pair.en.pv, gaV = useImp ? pair.ga.impr : pair.ga.pv;
                if (enV < 50) return;
                if (gaV >= enV * 0.4) return;
                gaps.push({ name: pair.en.name || pair.ga.name || pair.en.url, enUrl: pair.en.url, gaUrl: pair.ga.url, en: enV, ga: gaV, gap: enV - gaV });
            });
            gaps.sort(function (a, b) { return b.gap - a.gap; });
            const top = gaps.slice(0, limit);
            const metL = useImp ? 'impressions' : 'views';
            if (!top.length) return { html: '', summary: '', err: 'No clear English/Irish gaps found (needs paired /en/ and /ga/ pages with English ' + metL + ' of at least 50).' };
            const items = top.map(function (x) { return { name: x.name, val: fmt(x.en) + ' vs ' + fmt(x.ga), bar: x.gap, url: x.enUrl }; });
            return {
                html: _rankCard(items),
                summary: 'Pages where the Irish version most underperforms its English twin (English ' + metL + ' vs Irish, ' + periodLabel(_ddDays) + '): ' + top.slice(0, 6).map(function (x) { return x.name + ' (' + fmt(x.en) + ' vs ' + fmt(x.ga) + ')'; }).join('; ') + '.',
                data: { columns: [{ key: 'page', label: 'Page' }, { key: 'english', label: 'English ' + metL }, { key: 'irish', label: 'Irish ' + metL }, { key: 'gap', label: 'Gap' }, { key: 'enUrl', label: 'EN URL' }, { key: 'gaUrl', label: 'GA URL' }], rows: top.map(function (x) { return { page: x.name, english: x.en, irish: x.ga, gap: x.gap, enUrl: x.enUrl, gaUrl: x.gaUrl }; }), chart: { type: 'bar', x: 'page', y: 'gap', label: 'Gap' } }
            };
        }
        if (intent === 'cannibalisation') {
            let rows;
            try { rows = await getQueryRows(_ddDays); }
            catch (e) { return { html: '', summary: '', err: 'Could not fetch search-query data: ' + (e && e.message ? e.message : String(e)) }; }
            if (rows == null) {
                const _g = window.GSCIntegration, _c = _g && _g.isConnected && _g.isConnected();
                return { html: '', summary: '', err: _c ? 'Search-query data needs the updated GSC module. Redeploy gsc-integration-module.js (it must include fetchAllQueries) and hard-refresh.' : 'Search-query answers need a Search Console connection.' };
            }
            if (!rows.length) return { html: '', summary: '', err: 'No search-query data came back for ' + periodLabel(_ddDays) + '.' };
            const c = _catByName(cats, plan.category);
            const urlCat = c ? _urlToCatMap(r) : null;
            const items = _cannibalisation(rows, c ? c.name : null, urlCat).slice(0, limit);
            if (!items.length) return { html: '', summary: '', err: 'No cannibalisation found' + (c ? ' in ' + c.name : '') + ' - no queries have 2+ of your pages each drawing 10+ impressions.' };
            return {
                html: _cannibalCard(items),
                summary: 'Queries where several of your own pages compete' + (c ? ' in ' + c.name : '') + ' (' + periodLabel(_ddDays) + '): ' + items.slice(0, 5).map(function (it) { return '"' + it.query + '" (' + it.competing + ' pages, ' + fmt(it.total) + ' impr)'; }).join('; ') + '.',
                data: { columns: [{ key: 'query', label: 'Query' }, { key: 'competingPages', label: 'Competing pages' }, { key: 'totalImpressions', label: 'Total impressions' }, { key: 'page', label: 'Page' }, { key: 'pageImpressions', label: 'Page impressions' }, { key: 'position', label: 'Position' }], rows: items.reduce(function (acc, it) { it.pages.forEach(function (p) { acc.push({ query: it.query, competingPages: it.competing, totalImpressions: it.total, page: p.url, pageImpressions: p.impressions, position: p.position != null ? +p.position.toFixed(1) : '' }); }); return acc; }, []), chart: null }
            };
        }
        return { html: '', summary: '', unknown: true };
    }

    // Deterministic "explore next" suggestions from the answered intent (stateless
    // fake multi-turn). Every suggestion is a question the pipeline can actually
    // answer, so a chip just re-enters ask(). Max 3.
    function _followups(plan, res) {
        const cat = plan.category || (plan.categories && plan.categories[0]) || null;
        const out = [];
        const add = function (q) { if (q && out.length < 3 && out.indexOf(q) < 0) out.push(q); };
        const inCat = cat ? (' in ' + cat) : '';
        // Result-aware referents: chain a diagnosis off the ACTUAL top result. The page
        // name is baked into the chip text, so there is nothing for the LLM to misresolve.
        const rows = (res && res.data && res.data.rows) || [];
        const topRow = rows[0] || null;
        const addWhy = function (name) { if (name && typeof name === 'string') add('Why is ' + name + ' underperforming?'); };
        let faller = null; rows.forEach(function (x) { if (x && typeof x.changePct === 'number' && x.changePct < 0 && (!faller || x.changePct < faller.changePct)) faller = x; });
        switch (plan.intent) {
            case 'opportunities':
                if (cat) { add('Top queries in ' + cat); add('Top pages in ' + cat); add('Which ' + cat + ' pages lost traffic?'); }
                else { add('What do people search for?'); add('Which sections get the most traffic?'); add('Biggest movers across the site'); }
                break;
            case 'top_queries':
                add('Biggest search opportunities' + inCat);
                add('Any pages competing for the same search?');
                if (cat) add('What is stale in ' + cat + '?'); else add('Which sections get the most traffic?');
                break;
            case 'top_pages':
                if (cat) { add('Which ' + cat + ' pages lost traffic?'); add('Biggest search opportunities in ' + cat); add('What is stale in ' + cat + '?'); }
                else { add('Which sections get the most traffic?'); add('Biggest movers across the site'); add('Where are our biggest search opportunities?'); }
                break;
            case 'movers':
                if (faller) addWhy(faller.page);
                if (cat) { add('Top pages in ' + cat); add('Biggest search opportunities in ' + cat); }
                else { add('Which sections get the most traffic?'); add('Where are our biggest search opportunities?'); }
                break;
            case 'low_ctr':
                if (topRow) addWhy(topRow.page);
                add('Biggest search opportunities' + inCat);
                if (cat) add('Top pages in ' + cat); else add('Which sections get the most traffic?');
                break;
            case 'stale':
                if (topRow) addWhy(topRow.page);
                if (cat) { add('Top pages in ' + cat); add('Which ' + cat + ' pages lost traffic?'); }
                else add('Which sections get the most traffic?');
                break;
            case 'section_summary':
                if (cat) { add('Top pages in ' + cat); add('Biggest search opportunities in ' + cat); add('Which ' + cat + ' pages lost traffic?'); }
                break;
            case 'rank_categories':
                if (topRow && topRow.section) add('Where are our biggest search opportunities in ' + topRow.section + '?');
                add('Where are our biggest search opportunities?'); add('Biggest movers across the site');
                break;
            case 'compare':
                if (plan.categories && plan.categories.length === 2) { add('Top pages in ' + plan.categories[0]); add('Top pages in ' + plan.categories[1]); }
                break;
            case 'site_summary':
                add('Which sections get the most traffic?'); add('Where are our biggest search opportunities?'); add('Biggest movers across the site');
                break;
            case 'international_queries':
                add('Which countries search us the most?'); add('What do people search for?'); add('Where are our biggest search opportunities?');
                break;
            case 'top_countries':
                add('What do people abroad search us for?'); add('What do people search for?'); add('Where are our biggest search opportunities?');
                break;
            case 'questions':
                if (cat) { add('Biggest search opportunities in ' + cat); add('Top pages in ' + cat); }
                else { add('Where are our biggest search opportunities?'); add('What do people abroad search us for?'); }
                break;
            case 'language_gap':
                add('What do people search for?'); add('Where are our biggest search opportunities?'); add('Which sections get the most traffic?');
                break;
            case 'diagnose':
                add('What questions do people ask?'); add('Where are our biggest search opportunities?'); add('Any pages competing for the same search?');
                break;
            case 'cannibalisation':
                if (cat) { add('Biggest search opportunities in ' + cat); add('Top pages in ' + cat); }
                else { add('Where are our biggest search opportunities?'); add('What do people search for?'); }
                break;
        }
        return out;
    }

    const _ASK_EXAMPLES = ['Where are our biggest search opportunities?', 'What questions do people ask?', 'How has Health trended?', 'Which Housing pages lost traffic?', 'What do people abroad search us for?', 'Compare Health and Housing'];

    // ── export helpers (CSV + AI brief) — consume the runIntent data contract ──
    function _csvCell(v) {
        if (v == null) return '';
        const s = String(v);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    function _toCSV(data) {
        if (!data || !data.columns || !data.rows) return '';
        const head = data.columns.map(function (c) { return _csvCell(c.label); }).join(',');
        const body = data.rows.map(function (row) {
            return data.columns.map(function (c) { return _csvCell(row[c.key]); }).join(',');
        }).join('\r\n');
        return head + '\r\n' + body + '\r\n';
    }
    function _download(filename, text, mime) {
        try {
            const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 120);
        } catch (e) { alert('Download failed: ' + (e && e.message ? e.message : e)); }
    }
    function _slug(s) { return (String(s || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)) || 'export'; }
    function _todayStr() { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    const _ICON_DL = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
    const _ICON_DOC = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>';

    // Miss-log: record questions that resolve to `unknown` so the owner can see what
    // to build next. Capped ring buffer in localStorage. Inspect via SVRollup.getAskMisses().
    function _logMiss(q) {
        try {
            const arr = JSON.parse(localStorage.getItem('svAskMisses') || '[]');
            arr.push({ q: q, ts: Date.now() });
            while (arr.length > 200) arr.shift();
            localStorage.setItem('svAskMisses', JSON.stringify(arr));
        } catch (e) {}
    }
    function getAskMisses() { try { return JSON.parse(localStorage.getItem('svAskMisses') || '[]'); } catch (e) { return []; } }

    // Deterministic fast-path for the exact phrasings we generate as chips (e.g. the
    // result-aware "Why is X underperforming?"), so a long/odd page name can never be
    // mis-parsed to unknown. Returns a plan or null (null -> fall back to the LLM).
    function _quickParse(q) {
        const m = /^why is (?:the\s+)?(.+?)(?:\s+page)?\s+(?:underperforming|not getting clicks|not ranking|down)\??$/i.exec(String(q || '').trim());
        if (m && m[1]) return { intent: 'diagnose', page: m[1].trim() };
        return null;
    }

    async function showAsk() {
        const tree = window.treeData;
        if (!tree) { alert('Load a sitemap first.'); return; }
        if (!window.GroqAI || !window.GroqAI.isConfigured || !window.GroqAI.isConfigured()) { alert('Connect AI first - click the AI button in the toolbar to add your Groq key.'); return; }
        ensureDDStyle();

        // Already open? just focus it.
        const existing = document.getElementById('sv-ask-panel');
        if (existing) { const ei = existing.querySelector('#sv-ask-input'); if (ei) ei.focus(); return; }

        const _prevFocus = document.activeElement;
        const _chipsHtml = _ASK_EXAMPLES.map(function (q) { return '<button class="sv-ask-chip" data-q="' + esc(q) + '" style="font-size:0.72rem;padding:5px 10px;border-radius:20px;border:1px solid var(--color-border-primary);background:transparent;color:var(--color-text-secondary);cursor:pointer;font-family:inherit;">' + esc(q) + '</button>'; }).join('');
        const _introHtml =
            '<div class="sv-ask-intro">' +
                '<div style="font-size:0.82rem;color:var(--color-text-secondary);margin-bottom:12px;line-height:1.5;">Ask about sections, pages, search queries, opportunities, and where in the world people search for you. Figures come from your real GSC/GA4 data.</div>' +
                '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:7px;">Try one</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + _chipsHtml + '</div>' +
            '</div>';

        const panel = document.createElement('div');
        panel.id = 'sv-ask-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Ask your data');
        panel.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:min(460px,94vw);z-index:4000;background:var(--color-bg-secondary);border-left:1px solid var(--color-border-primary);box-shadow:-8px 0 30px rgba(0,0,0,0.18);display:flex;flex-direction:column;font-family:var(--font-family);transition:transform 0.22s ease;transform:translateX(100%);';
        panel.innerHTML =
            '<div style="flex:0 0 auto;padding:14px 16px;border-bottom:1px solid var(--color-border-primary);display:flex;align-items:center;gap:8px;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:1.05rem;font-weight:700;color:var(--color-text-heading);">Ask your data</div>' +
                    '<div style="font-size:0.66rem;color:var(--color-text-muted);">AI phrases &middot; code computes &middot; real GSC/GA4</div>' +
                '</div>' +
                '<button class="sv-ask-clear" title="Clear session" aria-label="Clear session" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;padding:5px;display:inline-flex;border-radius:6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>' +
                '<button class="sv-ask-close" title="Close (Esc)" aria-label="Close" style="background:none;border:none;font-size:22px;color:var(--color-text-muted);cursor:pointer;line-height:1;padding:0 4px;">&times;</button>' +
            '</div>' +
            '<div id="sv-ask-transcript" style="flex:1 1 auto;overflow-y:auto;padding:16px;">' + _introHtml + '</div>' +
            '<div style="flex:0 0 auto;padding:12px 14px;border-top:1px solid var(--color-border-primary);">' +
                '<div style="display:flex;gap:8px;">' +
                    '<input id="sv-ask-input" type="text" placeholder="Ask a question..." aria-label="Ask a question" style="flex:1;min-width:0;font-family:inherit;font-size:0.9rem;padding:10px 12px;border:1px solid var(--color-border-primary);border-radius:9px;background:var(--color-bg-primary);color:var(--color-text-primary);" />' +
                    '<button id="sv-ask-go" style="background:var(--primary);color:#fff;border:none;padding:10px 16px;border-radius:9px;font-weight:600;font-size:0.9rem;cursor:pointer;font-family:inherit;">Ask</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(panel);
        requestAnimationFrame(function () { panel.style.transform = 'translateX(0)'; });

        const input = panel.querySelector('#sv-ask-input');
        const transcript = panel.querySelector('#sv-ask-transcript');
        const _exports = Object.create(null);
        let _entryN = 0;

        function closePanel() {
            document.removeEventListener('keydown', onKey);
            panel.style.transform = 'translateX(100%)';
            setTimeout(function () { panel.remove(); }, 220);
            if (_prevFocus && _prevFocus.focus) { try { _prevFocus.focus(); } catch (e) {} }
        }
        function onKey(e) { if (e.key === 'Escape' && document.getElementById('sv-ask-panel')) closePanel(); }
        document.addEventListener('keydown', onKey);

        panel.querySelector('.sv-ask-close').addEventListener('click', closePanel);
        panel.querySelector('.sv-ask-clear').addEventListener('click', function () {
            for (const k in _exports) delete _exports[k];
            transcript.innerHTML = _introHtml;
            input.focus();
        });

        panel.addEventListener('click', function (e) {
            const ecsv = e.target.closest('.sv-ask-export-csv');
            if (ecsv) { const ex = _exports[ecsv.getAttribute('data-eid')]; if (ex) _download('ask-' + _slug(ex.q) + '-' + _todayStr() + '.csv', _toCSV(ex.data), 'text/csv'); return; }
            const ebrief = e.target.closest('.sv-ask-export-brief');
            if (ebrief) { const ex = _exports[ebrief.getAttribute('data-eid')]; if (ex) _exportBrief(ex, ebrief); return; }
            const chip = e.target.closest('.sv-ask-chip');
            if (chip) { input.value = chip.dataset.q; ask(); return; }
            const row = e.target.closest('.sv-ask-page[data-url]');
            if (row && window.showUnifiedDashboardReport) {
                const u = row.getAttribute('data-url');
                panel.style.display = 'none';   // keep transcript in DOM; restore when the report closes
                showLoadingOverlay('Loading page report...');
                Promise.resolve(window.showUnifiedDashboardReport(u)).catch(function () {}).finally(function () {
                    hideLoadingOverlay();
                    if (!document.getElementById('unified-dashboard-modal')) { if (document.getElementById('sv-ask-panel')) panel.style.display = ''; return; }
                    const _watch = setInterval(function () {
                        if (!document.getElementById('unified-dashboard-modal')) { clearInterval(_watch); if (document.getElementById('sv-ask-panel')) panel.style.display = ''; }
                    }, 400);
                });
            }
        });
        // Keyboard activation for clickable page rows (they are role=button, not real buttons).
        transcript.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const row = e.target && e.target.closest && e.target.closest('.sv-ask-page[data-url]');
            if (row) { e.preventDefault(); row.click(); }
        });

        panel.querySelector('#sv-ask-go').addEventListener('click', ask);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(); });
        setTimeout(function () { input.focus(); }, 60);

        async function _exportBrief(ex, btn) {
            if (!window.GroqAI || !window.GroqAI.isConfigured || !window.GroqAI.isConfigured()) { alert('Connect AI first to generate a brief.'); return; }
            const prev = btn ? btn.innerHTML : null;
            if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.innerHTML = 'Writing...'; }
            try {
                const rows = ex.data.rows.slice(0, 15);
                const cols = ex.data.columns.map(function (c) { return c.label; }).join(' | ');
                const lines = rows.map(function (row) { return ex.data.columns.map(function (c) { const v = row[c.key]; return v == null ? '' : String(v); }).join(' | '); }).join('\n');
                const sys = 'You are an analytics assistant writing a short internal memo for a website content owner. You are given a question and a table of REAL computed figures. Use the numbers exactly as given; never invent or recompute them. Write concise GitHub-flavoured Markdown: a "# " title, a one-sentence summary, a "## Key figures" bullet list, and a "## Recommended actions" list of 2-4 concrete next steps grounded in the data. No preamble, no code fences.';
                const usr = 'Question: ' + ex.q + '\n\nData columns: ' + cols + '\n' + lines + '\n\nContext: ' + (ex.summary || '');
                const md = await window.GroqAI.complete([{ role: 'system', content: sys }, { role: 'user', content: usr }], { temperature: 0.3, max_tokens: 650 });
                _download('brief-' + _slug(ex.q) + '-' + _todayStr() + '.md', String(md).trim() + '\n', 'text/markdown');
            } catch (e) { alert('Could not generate the brief: ' + (e && e.message ? e.message : e)); }
            finally { if (btn) { btn.disabled = false; btn.style.opacity = '1'; if (prev != null) btn.innerHTML = prev; } }
        }

        let busy = false;
        async function ask() {
            const q = input.value.trim();
            if (!q || busy) return;
            busy = true;
            input.value = '';
            const intro = transcript.querySelector('.sv-ask-intro'); if (intro) intro.remove();
            const eid = 'sv-ask-e-' + (++_entryN);
            const entry = document.createElement('div');
            entry.className = 'sv-ask-entry';
            entry.id = eid;
            entry.style.cssText = 'margin-bottom:18px;';
            entry.innerHTML =
                '<div style="display:flex;justify-content:flex-end;margin-bottom:9px;"><div style="background:var(--primary);color:#fff;font-size:0.82rem;font-weight:600;padding:7px 12px;border-radius:12px 12px 3px 12px;max-width:88%;word-break:break-word;">' + esc(q) + '</div></div>' +
                '<div class="sv-ask-resp"><div style="font-size:0.85rem;color:var(--color-text-muted);padding:4px 0;">Thinking...</div></div>';
            transcript.appendChild(entry);
            const resp = entry.querySelector('.sv-ask-resp');
            entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
            try {
                const r = await refreshForPeriod(tree, _ddDays).catch(function () { return build(tree); });
                const catNames = r.categories.map(function (c) { return c.name; });
                const sys = 'You turn a question about website analytics into a JSON query. Reply with ONLY a JSON object, no prose, no code fences. ' +
                    'Sections available: ' + catNames.join(', ') + '. ' +
                    'Schema: {"intent": one of ["rank_categories","section_summary","top_pages","low_ctr","stale","movers","site_summary","compare","opportunities","top_queries","international_queries","top_countries","trend","diagnose","questions","language_gap","cannibalisation","unknown"], ' +
                    '"category": exact section name from the list or null, "categories": [two section names] for compare, "country": a country name for international_queries (or null for all-abroad), "page": a page name for the diagnose intent (or null), ' +
                    '"metric": one of ["impressions","clicks","ctr","position","pageViews","users"] (default impressions), ' +
                    '"direction": "up"|"down"|"both", "limit": number (default 6)}. ' +
                    'Mapping: views->pageViews; traffic->impressions; lost/dropped/falling/down->intent movers direction down; rising/gained/up->direction up; ' +
                    'most viewed->top_pages metric pageViews; low CTR / seen but not clicked->low_ctr; out of date / old->stale; how is X doing->section_summary; ' +
                    'opportunities / quick wins / missing out / losing clicks / could win more->opportunities; ' +
                    'what do people search for / search terms / top searches / queries / keywords->top_queries (metric clicks only if they say clicks); ' +
                    'from abroad / overseas / internationally / the diaspora / emigrants / people outside Ireland->international_queries with country null; ' +
                    'from a named place (the US / in Australia / from Britain)->international_queries with country set to that country name; ' +
                    'which countries / where are searchers from / top countries->top_countries; ' +
                    'how has X trended / over time / trend / history / over the last months / month by month->trend (category optional; metric impressions/clicks/views); ' +
                    'why is X underperforming / why is X down / why is the X page underperforming / what is wrong with X / diagnose X / why is X not getting clicks->diagnose with page set to X (the page named, even a long multi-word name); ' +
                    'what questions do people ask / what are people asking / question searches / common questions->questions (category optional); ' +
                    'Irish vs English / as Gaeilge / language gap / where does the Irish version underperform / English vs Irish->language_gap; ' +
                    'cannibalisation / cannibalization / pages competing / competing pages / self-competition / multiple pages ranking for the same search->cannibalisation (category optional).';
                const raw = await window.GroqAI.complete([{ role: 'system', content: sys }, { role: 'user', content: q }], { temperature: 0, max_tokens: 200 });
                let plan; try { plan = JSON.parse(String(raw).replace(/```json|```/g, '').trim()); } catch (e) { plan = { intent: 'unknown' }; }
                if (!plan || plan.intent === 'unknown') { const _qp = _quickParse(q); if (_qp) plan = _qp; }
                if (((plan.intent === 'opportunities' || plan.intent === 'top_queries') && !_queryCache[_ddDays]) ||
                    ((plan.intent === 'international_queries' || plan.intent === 'top_countries') && !_countryQueryCache[_ddDays])) {
                    resp.innerHTML = '<div style="font-size:0.85rem;color:var(--color-text-muted);padding:4px 0;">Fetching search-query data from Search Console...</div>';
                }
                if (plan.intent === 'trend') { resp.innerHTML = '<div style="font-size:0.85rem;color:var(--color-text-muted);padding:4px 0;">Building a 6-month trend (fetching several periods from Search Console)...</div>'; }
                const res = await runIntent(plan, r);
                if (res.unknown) {
                    _logMiss(q);
                    resp.innerHTML = '<div style="font-size:0.85rem;color:var(--color-text-secondary);margin-bottom:10px;">I can answer about sections, pages, movers, low-CTR pages, stale content, what people search for, searches from abroad, and where you are missing clicks. Try one of these:</div><div style="display:flex;flex-wrap:wrap;gap:6px;">' + _chipsHtml + '</div>';
                    busy = false; return;
                }
                if (res.err) { resp.innerHTML = '<div style="font-size:0.85rem;color:var(--color-text-secondary);">' + esc(res.err) + '</div>'; busy = false; return; }
                const _ILBL = { rank_categories: 'rank sections', section_summary: 'section summary', top_pages: 'top pages', low_ctr: 'low-CTR pages', stale: 'stale pages', movers: 'movers', site_summary: 'site summary', compare: 'compare sections', opportunities: 'search opportunities', top_queries: 'top search queries', international_queries: 'searches from abroad', top_countries: 'top countries', trend: 'trend over time', diagnose: 'page diagnosis', questions: 'questions asked', language_gap: 'English vs Irish', cannibalisation: 'page cannibalisation' };
                if (res.data && res.data.rows && res.data.rows.length) _exports[eid] = { data: res.data, q: q, summary: res.summary };
                const interpBits = [_ILBL[plan.intent] || plan.intent];
                if (plan.category) interpBits.push(plan.category);
                if (plan.country) interpBits.push(plan.country);
                if (plan.page) interpBits.push(plan.page);
                if (plan.categories && plan.categories.length) interpBits.push(plan.categories.join(' vs '));
                interpBits.push(periodLabel(_ddDays));
                const interp = '<div style="font-size:0.68rem;color:var(--color-text-muted);margin-bottom:10px;">Interpreted as: <span style="color:var(--color-text-secondary);font-weight:600;">' + esc(interpBits.join(' · ')) + '</span></div>';
                resp.innerHTML = interp + '<div class="sv-ask-oneliner" style="font-size:0.92rem;color:var(--color-text-primary);font-weight:600;margin-bottom:12px;line-height:1.5;"></div>' + (_renderChart(res.data) || res.html);
                if (_exports[eid]) {
                    resp.insertAdjacentHTML('beforeend',
                        '<div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:14px;">' +
                        '<span style="font-size:0.68rem;color:var(--color-text-muted);margin-right:auto;">' + res.data.rows.length + ' row' + (res.data.rows.length === 1 ? '' : 's') + '</span>' +
                        '<button class="sv-ask-export-csv" data-eid="' + eid + '" title="Download these rows as CSV" style="display:inline-flex;align-items:center;font-size:0.72rem;padding:5px 11px;border-radius:8px;border:1px solid var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-secondary);cursor:pointer;font-family:inherit;font-weight:600;">' + _ICON_DL + 'CSV</button>' +
                        '<button class="sv-ask-export-brief" data-eid="' + eid + '" title="Write a short Markdown brief with AI" style="display:inline-flex;align-items:center;font-size:0.72rem;padding:5px 11px;border-radius:8px;border:1px solid var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-secondary);cursor:pointer;font-family:inherit;font-weight:600;">' + _ICON_DOC + 'Brief</button>' +
                        '</div>');
                }
                const _fups = _followups(plan, res);
                if (_fups.length) {
                    resp.insertAdjacentHTML('beforeend',
                        '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--color-border-primary);">' +
                        '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:8px;">Explore next</div>' +
                        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
                        _fups.map(function (fq) { return '<button class="sv-ask-chip sv-ask-follow" data-q="' + esc(fq) + '" style="font-size:0.72rem;padding:5px 11px;border-radius:20px;border:1px solid var(--primary);background:transparent;color:var(--primary);cursor:pointer;font-family:inherit;font-weight:600;">' + esc(fq) + ' &rarr;</button>'; }).join('') +
                        '</div></div>');
                }
                entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
                try {
                    const line = await window.GroqAI.complete([{ role: 'system', content: 'Given these real analytics results, write ONE short plain-English sentence that answers the question. Use the numbers exactly as given. No preamble, no markdown.' }, { role: 'user', content: 'Question: ' + q + '\nResults: ' + res.summary }], { temperature: 0.2, max_tokens: 90 });
                    const el = resp.querySelector('.sv-ask-oneliner'); if (el) el.textContent = String(line).trim();
                } catch (e) { const el = resp.querySelector('.sv-ask-oneliner'); if (el) el.textContent = res.summary; }
            } catch (e) {
                resp.innerHTML = '<div style="font-size:0.85rem;color:#dc2626;">Something went wrong: ' + esc(e && e.message ? e.message : String(e)) + '</div>';
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
        _normUrl: normUrl,
        countryName: _countryName,
        getAskMisses: getAskMisses
    };
    // Convenience global for the Reports menu onclick
    window.showCategoryPerformance = showPanel;
    window.showAskData = showAsk;
})();
