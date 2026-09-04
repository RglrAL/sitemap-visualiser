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
                 _posSum: 0, _posWeight: 0, pageCount: 0, leafCount: 0, pagesWithData: 0,
                 // engagement (GA4): rates are SESSION-weighted, not impression-weighted.
                 sessions: 0, _engSum: 0, _durSum: 0, _bounceSum: 0, _engW: 0 };
    }
    function addSelf(agg, s, isPage, isLeaf) {
        if (isPage) agg.pageCount += 1;
        if (isLeaf) agg.leafCount += 1;
        if (!s) return;
        const imp = num(s.impressions), clk = num(s.clicks),
              pv = num(s.pageViews), us = num(s.users), pos = num(s.position);
        agg.impressions += imp; agg.clicks += clk; agg.pageViews += pv; agg.users += us;
        if (imp > 0 && pos > 0) { agg._posSum += pos * imp; agg._posWeight += imp; }
        const ses = num(s.sessions);
        if (ses > 0) {
            agg.sessions += ses; agg._engW += ses;
            if (s.engagementRate != null) agg._engSum += num(s.engagementRate) * ses;
            if (s.avgSessionDuration != null) agg._durSum += num(s.avgSessionDuration) * ses;
            if (s.bounceRate != null) agg._bounceSum += num(s.bounceRate) * ses;
        }
        if (imp || clk || pv || us || ses) agg.pagesWithData += 1;
    }
    function mergeAgg(into, from) {
        into.impressions += from.impressions; into.clicks += from.clicks;
        into.pageViews += from.pageViews;     into.users += from.users;
        into._posSum += from._posSum;         into._posWeight += from._posWeight;
        into.pageCount += from.pageCount;     into.leafCount += from.leafCount;
        into.pagesWithData += from.pagesWithData;
        into.sessions += from.sessions;       into._engW += from._engW;
        into._engSum += from._engSum;         into._durSum += from._durSum;
        into._bounceSum += from._bounceSum;
    }
    function finalize(agg) {
        return {
            impressions: agg.impressions,
            clicks: agg.clicks,
            pageViews: agg.pageViews,
            users: agg.users,
            sessions: agg.sessions,
            ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
            position: agg._posWeight > 0 ? agg._posSum / agg._posWeight : null,
            // session-weighted engagement (null when no sessions had the metric)
            engagementRate: agg._engW > 0 ? agg._engSum / agg._engW : null,
            avgSessionDuration: agg._engW > 0 ? agg._durSum / agg._engW : null,
            bounceRate: agg._engW > 0 ? agg._bounceSum / agg._engW : null,
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
        if (ga) { out.pageViews = ga.pageViews; out.users = ga.users; out.sessions = ga.sessions; out.engagementRate = ga.engagementRate; out.avgSessionDuration = ga.avgSessionDuration; out.bounceRate = ga.bounceRate; }
        return out;
    }
    // Copy the GA4 engagement fields from a bulk record onto a compact map entry.
    function _ga4Rec(rec) {
        return { pageViews: num(rec.pageViews), users: num(rec.users), sessions: num(rec.sessions),
                 engagementRate: rec.engagementRate != null ? num(rec.engagementRate) : null,
                 avgSessionDuration: rec.avgSessionDuration != null ? num(rec.avgSessionDuration) : null,
                 bounceRate: rec.bounceRate != null ? num(rec.bounceRate) : null };
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
    let _builtSig = null;
    function build(tree, opts) {
        opts = opts || {};
        // Cache invalidation: every period-keyed cache below is module-scoped and survives a
        // sitemap swap. Without this, loading CI then MABS would serve CI's cached data against
        // MABS's tree — wrong numbers, no error, and the interpretation chip would vouch for them.
        // If the sitemap root changed since the last build, wipe them all. (Same tree re-built =
        // a refresh; caches are kept.)
        const _sig = String((tree && (tree.url || tree.name)) || '') + '|' + ((tree && (tree.children || tree._children) || []).length);
        if (_sig !== _builtSig) { _builtSig = _sig; try { clearCaches(); } catch (e) {} }
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
                if (rec) _ga4Map[normUrl(url)] = _ga4Rec(rec);
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
                    if (d) _ga4Map[normUrl(url)] = _ga4Rec(d);
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
            'https://x/a':    { impressions: 100,  clicks: 10, position: 5,  sessions: 50,  engagementRate: 0.4, avgSessionDuration: 30, bounceRate: 0.6 },
            'https://x/a/1':  { impressions: 300,  clicks: 30, position: 3,  sessions: 150, engagementRate: 0.8, avgSessionDuration: 90, bounceRate: 0.2 },
            'https://x/a/2':  { impressions: 100,  clicks: 5,  position: 10, sessions: 50,  engagementRate: 0.6, avgSessionDuration: 60, bounceRate: 0.4 },
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
        // A engagement is SESSION-weighted: sessions = 50+150+50 = 250
        check('A.sessions', A.sessions, 250);
        // engagementRate = (0.4*50 + 0.8*150 + 0.6*50)/250 = 170/250 = 0.68
        check('A.engagementRate', A.engagementRate, 0.68);
        // avgSessionDuration = (30*50 + 90*150 + 60*50)/250 = 18000/250 = 72
        check('A.avgSessionDuration', A.avgSessionDuration, 72);
        // bounceRate = (0.6*50 + 0.2*150 + 0.4*50)/250 = 80/250 = 0.32
        check('A.bounceRate', A.bounceRate, 0.32);
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

        // ── shared scorer is the single source of truth for buildQueryIndex ──
        const sc1 = _scoreQuery(q1.impressions, q1.clicks, q1.bestPos);
        results.push({ name: 'scoreQuery.matches_index', got: sc1.potential, want: q1.potential, ok: Math.abs(sc1.potential - q1.potential) < 1e-9 && sc1.label === q1.label });

        // ── cannibalisation: EN/GA twins (same merged name) must NOT be flagged ──
        const _u2n = {}; _u2n[normUrl('https://x/en/fuel')] = 'fuel'; _u2n[normUrl('https://x/ga/fuel')] = 'fuel';
        const cannEnGa = _cannibalisation([{ query: 'cq', page: 'https://x/en/fuel', impressions: 300, position: 3 }, { query: 'cq', page: 'https://x/ga/fuel', impressions: 250, position: 5 }], null, null, _u2n);
        results.push({ name: 'cannibal.enga_not_flagged', got: cannEnGa.length, want: 0, ok: cannEnGa.length === 0 });
        // two genuinely different pages splitting a query >=20% each, total>=100 -> flagged
        const cannReal = _cannibalisation([{ query: 'cq2', page: 'https://x/en/carers-a', impressions: 400, position: 4 }, { query: 'cq2', page: 'https://x/en/carers-b', impressions: 300, position: 6 }], null, null, {});
        results.push({ name: 'cannibal.real_flagged', got: cannReal.length, want: 1, ok: cannReal.length === 1 });

        // ── page-name resolver: exact wins; unambiguous exact proceeds; no match -> none ──
        const _pn = _pagesByNameScored(r, 'A1');
        results.push({ name: 'resolve.exact_first', got: (_pn[0] && _pn[0].page.name) || null, want: 'A1', ok: !!(_pn.length && _pn[0].page.name === 'A1') });
        results.push({ name: 'resolve.exact_proceeds', got: !!_resolvePage(r, 'A').page, want: true, ok: !!_resolvePage(r, 'A').page });
        results.push({ name: 'resolve.none', got: !!_resolvePage(r, 'zzznomatch').none, want: true, ok: !!_resolvePage(r, 'zzznomatch').none });

        // ── exposure classifier: the thresholds diagnose/briefing now lean on, pinned as assertions ──
        const _ce = _classifyExposure;
        const mk = function (name, got, want) { results.push({ name: name, got: got, want: want, ok: got === want }); };
        mk('classify.exposed', _ce({ impr: 10000, clk: 260, pos: 5.1 }, { impr: 10000, clk: 520, pos: 5.0 }).tier, 'exposed');   // held rank, CTR halved, page 1
        mk('classify.cited', _ce({ impr: 20000, clk: 800, pos: 1.8 }, { impr: 20000, clk: 1600, pos: 1.6 }).tier, 'cited');       // same pattern at top-2
        mk('classify.rankslip_reason', _ce({ impr: 10000, clk: 200, pos: 6.0 }, { impr: 10000, clk: 520, pos: 3.0 }).reason, 'rankslip');  // rank slipped 3 places
        mk('classify.rankslip_notkept', _ce({ impr: 10000, clk: 200, pos: 6.0 }, { impr: 10000, clk: 520, pos: 3.0 }).keep, false);
        mk('classify.artifact', _ce({ impr: 166000, clk: 0, pos: 3.7 }, { impr: 166000, clk: 13778, pos: 3.7 }).artifact, true);   // ~0 clicks at rank 3.7 = artifact
        mk('classify.deep_nearzero_artifact', _ce({ impr: 11600, clk: 58, pos: 9.3 }, { impr: 11600, clk: 963, pos: 9.3 }).reason, 'artifact');   // C1: Construction 8.3%->0.5% at pos 9.3 (page 1, deeper than 5) is now caught as artifact, not exposed
        mk('classify.exposed_not_overcaught', _ce({ impr: 10000, clk: 260, pos: 5.1 }, { impr: 10000, clk: 520, pos: 5.0 }).tier, 'exposed');   // 2.6% CTR is a real exposed page, NOT swept up by the near-zero floor
        mk('classify.baseCTR', _ce({ impr: 1200000, clk: 6000, pos: 6.2 }, { impr: 1200000, clk: 8400, pos: 6.0 }).reason, 'baseCTR');   // never converted
        mk('classify.page2', _ce({ impr: 72000, clk: 720, pos: 14.6 }, { impr: 72000, clk: 2448, pos: 14.5 }).reason, 'page2');   // rank 14 = not the Overview zone
        mk('classify.floor', _ce({ impr: 500, clk: 20, pos: 4.0 }, { impr: 500, clk: 40, pos: 4.0 }).reason, 'floor');            // too few impressions
        mk('classify.ctrheld', _ce({ impr: 10000, clk: 490, pos: 5.0 }, { impr: 10000, clk: 520, pos: 5.0 }).reason, 'ctrheld');  // CTR barely moved

        // ── ambient AI finding: the machinery diagnose/page_summary/briefing all read (can't detach) ──
        const _Aok = { gscOn: true, classifyOk: true, exposed: [{ url: 'https://x/en/foo', pos: 5.1, ctrB: 0.052, ctrN: 0.026, lost: 2300 }], excluded: [{ url: 'https://x/en/baz', pos: 3.7, ctrB: 0.083, ctrN: 0, impr: 166000 }] };
        mk('aifind.exposed_kind', _aiFinding(['https://x/en/foo'], _Aok).kind, 'exposed');
        mk('aifind.exposed_mag', _aiFinding(['https://x/en/foo'], _Aok).score, 2300);              // exposure carries its floor as the ranking magnitude
        mk('aifind.artifact_kind', _aiFinding(['https://x/en/baz'], _Aok).kind, 'artifact');
        mk('aifind.absent_null', _aiFinding(['https://x/en/notlisted'], _Aok), null);              // rank-slip / not-flagged pages say nothing
        mk('aifind.gscoff_null', _aiFinding(['https://x/en/foo'], { gscOn: false }), null);
        mk('aifind.unavailable', _aiFinding(['https://x/en/foo'], { gscOn: true, classifyOk: false }).kind, 'unavailable');

        // ── briefing common currency: a ~2,300 clicks/mo exposure must outrank an 800-click opportunity ──
        const _saCtx = { hasQueries: true, qrows: [], qidx: [{ category: null, query: 'q', impressions: 500, potential: 800, bestPos: 6, bestPage: 'https://x/a' }], urlCat: null, urlToName: {}, prior: null, aiExposed: [{ url: 'https://x/a/1', name: 'A1', pos: 5.1, ctrB: 0.05, ctrN: 0.02, lost: 2300 }], aiChecked: true, gscOn: true };
        const _sa = _sectionActions(null, r, _saCtx);
        mk('brief.exposure_leads', (_sa[0] && _sa[0].type) || '', 'AI exposure');   // 2,300 floor outranks the 800 opportunity
        mk('brief.ranked_count', _sa._rankedCount, 2);                              // opportunity + exposure ranked; staleness excluded from the ranked slice
        // ranking CURRENCY is clicks/mo, not impressions: a 4,700-impr decline (~570 clicks) ranks BELOW an 800-click opportunity
        const _rankCtx = { hasQueries: true, qrows: [], qidx: [{ category: null, query: 'q', impressions: 500, potential: 800, bestPos: 6, bestPage: 'https://x/a' }], urlCat: null, urlToName: {}, prior: { gscBy: (function () { const o = {}; o[normUrl('https://x/a/1')] = { impressions: 5000 }; return o; })() }, aiExposed: null, aiChecked: false, gscOn: false };
        mk('brief.rank_currency_is_clicks', (_sectionActions(null, r, _rankCtx)[0] || {}).type, 'Opportunity');

        // ── verdict headline: the big-type number MUST equal the sum of the rows shown (worst possible bug) ──
        mk('headline.opps_sum', _headlineFor('opportunities', { rows: [{ potentialClicks: 2500 }, { potentialClicks: 1700 }] }).value, 4200);   // real quantity: sum is the finding
        mk('headline.opps_tier', _headlineFor('opportunities', { rows: [{ potentialClicks: 10 }] }).tier, 'estimated');
        mk('headline.exposed_sum', _headlineFor('ai_exposed', { rows: [{ lostClicks: 2300 }, { lostClicks: 817 }, { lostClicks: 711 }] }).value, 3828);
        mk('headline.share', _headlineFor('top_queries', { rows: [{ impressions: 380 }, { impressions: 0 }], shareBase: 1000, shareKey: 'impressions', shareNoun: 'search impressions' }).value, 38);   // ranked list -> SHARE of scope total, not a limit-dependent sum
        mk('headline.share_pct', _headlineFor('top_queries', { rows: [{ impressions: 380 }], shareBase: 1000, shareKey: 'impressions' }).pct, true);
        mk('headline.share_zerobase', _headlineFor('top_queries', { rows: [{ impressions: 380 }], shareBase: 0, shareKey: 'impressions' }), null);
        mk('headline.empty_null', _headlineFor('opportunities', { rows: [] }), null);
        // weighted aggregate delta (the override-path headline class): -33.3%, NOT the naive per-row mean (-45%)
        mk('netdelta.change', _netDelta([{ c: 900, p: 1000 }, { c: 100, p: 500 }], 'c', 'p').change, -500);
        mk('netdelta.weighted', Math.round(_netDelta([{ c: 900, p: 1000 }, { c: 100, p: 500 }], 'c', 'p').pct * 10) / 10, -33.3);
        mk('netdelta.zeroprev', _netDelta([{ c: 5, p: 0 }], 'c', 'p').pct, null);
        // 'both' churn: net cancels to 0 but 12K actually moved — why a two-directional movers answer headlines churn, not net
        mk('netdelta.churn', _netDelta([{ c: 6000, p: 0 }, { c: 0, p: 6000 }], 'c', 'p').churn, 12000);
        mk('netdelta.churn_net_cancels', _netDelta([{ c: 6000, p: 0 }, { c: 0, p: 6000 }], 'c', 'p').change, 0);

        // ── SERP ladder bands (shared vocabulary) + renderers produce an SVG ──
        mk('serp.top3', _serpBand(2), 'top3');
        mk('serp.top3_edge', _serpBand(_SERP_TOP3), 'top3');
        mk('serp.strike', _serpBand(7), 'strike');
        mk('serp.strike_edge', _serpBand(_SERP_STRIKE), 'strike');
        mk('serp.off', _serpBand(_SERP_STRIKE + 5), 'off');
        mk('ladder.renders', _chartLadder({ rows: [{ q: 'a', p: 2, i: 900 }, { q: 'b', p: 8, i: 400 }], chart: { type: 'ladder', label: 'q', pos: 'p', size: 'i' } }, {}).indexOf('<svg') === 0, true);
        mk('ladder.skips_zeropos', _chartLadder({ rows: [{ q: 'x', p: 0, i: 100 }], chart: { type: 'ladder', label: 'q', pos: 'p', size: 'i' } }, {}), '');   // pos 0 -> no valid rows -> empty
        mk('dumbbell.renders', _chartDumbbell({ rows: [{ n: 'p', was: 1000, now: 600 }], chart: { type: 'dumbbell', label: 'n', before: 'was', after: 'now', shared: true } }, {}).indexOf('<svg') === 0, true);
        mk('ellip.adds_ellipsis', _ellip('Local Authority Mortgages', 22).slice(-1), '…');   // no mid-word truncation
        mk('ellip.short_untouched', _ellip('Stamp Duty', 22), 'Stamp Duty');
        // middle-truncation keeps the DISCRIMINATING tail so common-prefix names stay distinct
        mk('ellipmid.keeps_tail', _ellipMid('Local Authority Purchase And Renovation Loan', 22).indexOf('Loan') >= 0, true);
        mk('ellipmid.distinct', _ellipMid('Local Authority Mortgages', 22) !== _ellipMid('Local Authority Purchase And Renovation Loan', 22), true);
        mk('ellipmid.short_untouched', _ellipMid('Stamp Duty', 22), 'Stamp Duty');
        // single-series line chart carries its endpoint values on the line, not just in the sentence
        mk('chartline.endpoint_labels', (function () { const t = _chartLine({ periods: ['a', 'b', 'c', 'd', 'e', 'f'], series: [{ name: '', values: [1200000, 1100000, 1000000, 950000, 880000, 829300] }], chart: { type: 'line' } }, {}); return t.indexOf('829.3K') >= 0 && t.indexOf('1.2M') >= 0; })(), true);
        // compare_periods small-multiples: position INVERTS. The classic once-per-tool bug, pinned both ways.
        mk('deltaimproved.pos_down_good', _deltaImproved('lower', 6.4, 5.1), true);      // position 6.4 -> 5.1 is an improvement
        mk('deltaimproved.pos_up_bad', _deltaImproved('lower', 5.1, 6.4), false);
        mk('deltaimproved.count_down_bad', _deltaImproved('higher', 100, 90), false);
        const _cpMini = function (older, newer) { return _chartMiniDeltas({ rows: [{ metric: 'Avg position', older: older, newer: newer, change: +(newer - older).toFixed(1), dtype: 'ptpos', better: 'lower' }], chart: { type: 'minideltas' } }, {}); };
        mk('minideltas.pos_improve_good', _cpMini(6.4, 5.1).indexOf('data-sentiment="good"') >= 0, true);   // position dropped -> GOOD (semantic hook, survives a repaint)
        mk('minideltas.pos_worsen_bad', _cpMini(5.1, 6.4).indexOf('data-sentiment="bad"') >= 0, true);
        mk('minideltas.glyph_follows_number', _cpMini(5.1, 6.4).indexOf('▲') >= 0, true);   // position ROSE -> ▲ (glyph=number) but RED (colour=sentiment); no more ▼ paired with +0.2
        mk('minideltas.zero_neutral', _chartMiniDeltas({ rows: [{ metric: 'Views', older: 57000, newer: 57100, change: 0, dtype: 'pct', better: 'higher' }], chart: { type: 'minideltas' } }, {}).indexOf('data-sentiment') < 0, true);   // zero delta = noise: no sentiment, no arrow (deadband)
        // B4 a11y: where the glyph (number direction) and sentiment DIVERGE (position, lower=better), a textual "worse"/"better"
        // cue rides alongside so meaning never depends on colour alone; metrics whose glyph agrees with sentiment get no redundant word.
        mk('minideltas.pos_rose_says_worse', _cpMini(5.1, 6.4).indexOf('worse') >= 0, true);
        mk('minideltas.pos_fell_says_better', _cpMini(6.4, 5.1).indexOf('better') >= 0, true);
        mk('minideltas.impr_down_no_cue', _chartMiniDeltas({ rows: [{ metric: 'Impressions', older: 781500, newer: 698500, change: -11, dtype: 'pct', better: 'higher' }], chart: { type: 'minideltas' } }, {}).indexOf('worse') < 0, true);
        // C6 min-separation clamp: a small delta still renders two visibly separate dots; a zero delta stays coincident (single).
        const _mdCx = function (svg) { return (svg.match(/cx="[\d.]+"/g) || []).map(function (m) { return parseFloat(m.replace(/[^\d.]/g, '')); }); };
        const _mdSmall = _mdCx(_chartMiniDeltas({ rows: [{ metric: 'Impr', older: 781500, newer: 728000, change: -7, dtype: 'pct', better: 'higher' }], chart: { type: 'minideltas' } }, {}));
        mk('minideltas.small_delta_dots_separate', _mdSmall.length >= 2 && Math.abs(_mdSmall[1] - _mdSmall[0]) >= 15, true);
        const _mdZero = _mdCx(_chartMiniDeltas({ rows: [{ metric: 'V', older: 57000, newer: 57000, change: 0, dtype: 'pct', better: 'higher' }], chart: { type: 'minideltas' } }, {}));
        mk('minideltas.zero_dots_coincide', _mdZero.length >= 2 && Math.abs(_mdZero[1] - _mdZero[0]) < 2, true);
        // B5 overlap: "this month" inside "last 90 days" must be auto-disjointed, never compared raw (deltas drag to zero).
        mk('overlap.subset_detected', _periodsOverlap({ offset: 0, days: 30 }, { offset: 0, days: 90 }), true);
        mk('overlap.previous_disjoint', _periodsOverlap({ offset: 0, days: 90 }, { offset: 90, days: 90 }), false);
        mk('overlap.adjacent_disjoint', _periodsOverlap({ offset: 0, days: 30 }, { offset: 30, days: 30 }), false);
        const _ovlP90 = { offset: 0, days: 90, label: 'the last 90 days' };
        const _ovlR = _disjoinOverlap({ offset: 0, days: 30, label: 'the last 30 days' }, _ovlP90);
        mk('overlap.shifts_longer_before', _ovlP90.offset, 30);                                   // the 90d window moves to sit before this month
        mk('overlap.now_disjoint', _periodsOverlap({ offset: 0, days: 30 }, _ovlP90), false);      // and no longer overlaps
        mk('overlap.discloses', _ovlR.note.indexOf('overlap') >= 0, true);
        mk('overlap.none_when_disjoint', _disjoinOverlap({ offset: 0, days: 90 }, { offset: 90, days: 90 }), null);
        // B8 navigational queries: a service/brand name is demand for ANOTHER site, not content upside.
        mk('nav.mywelfare', _isNavigational('mywelfare'), true);
        mk('nav.my_welfare_spaced', _isNavigational('my welfare'), true);
        mk('nav.mygovid', _isNavigational('mygovid'), true);
        mk('nav.real_content_no', _isNavigational('carers allowance'), false);
        mk('nav.fuel_allowance_no', _isNavigational('fuel allowance 2026'), false);
        mk('nav.coru', _isNavigational('coru'), true);                          // B12: CORU is the health regulator (coru.ie), brand-navigation
        mk('nav.coru_wholeword', _isNavigational('corundum hardness'), false);  // bare short token must not substring-match
        mk('nav.eircode', _isNavigational('eircode finder'), true);              // C4: Eircode's own tool, navigational exhibit #5
        // C4 ladder: dot size is the RANKED quantity, labelled so it is not misread (size=potential in an opportunities ladder)
        mk('ladder.size_labelled', _chartLadder({ rows: [{ q: 'a', p: 2, pot: 900 }, { q: 'b', p: 8, pot: 400 }], chart: { type: 'ladder', label: 'q', pos: 'p', size: 'pot', sizeLabel: 'potential clicks/mo' } }, {}).indexOf('potential clicks/mo') >= 0, true);
        // C5 shared percent formatter: a nonzero sliver reads "<1%" everywhere, never "0%".
        mk('pcttxt.sliver', _pctTxt(0.003), '<1%');
        mk('pcttxt.exact_zero', _pctTxt(0), '0%');
        mk('pcttxt.normal', _pctTxt(0.82), '82%');
        mk('followup.traffic_sources_has_chips', _followups({ intent: 'traffic_sources' }, { data: { rows: [] } }, r).length > 0, true);   // C5: the answer grew no chips; now it does
        mk('followup.traffic_sources_source_growth', _followups({ intent: 'traffic_sources', source: 'Facebook' }, { data: { rows: [] } }, r).join(' | ').indexOf('Facebook traffic growing') >= 0, true);
        // B8 diagnose chip only where warranted: opportunities offers a NEUTRAL page look, never "why underperforming" (its best page may be winning).
        const _fOpp = _followups({ intent: 'opportunities', category: 'Health' }, { data: { rows: [{ query: 'q', bestPage: 'https://x/a/1' }] } }, r);
        mk('followup.opps_no_diagnose', _fOpp.join(' | ').indexOf('underperforming') < 0, true);
        mk('followup.opps_neutral_page', _fOpp.join(' | ').indexOf('How is A1 performing?') >= 0, true);
        // B10 seasonal scope: the chip must render the RESOLVED scope (res.scope), never claim a scope the answer ignored.
        mk('interpscope.seasonal_page', _interpScope({ intent: 'seasonal', category: 'Contact Tracing page' }, {}, { scope: { label: 'Contact Tracing', isPage: true } }).join('|'), 'Contact Tracing');   // resolved page name shown (oneShot annotation covered separately by interpscope.oneshot_preserved)
        mk('interpscope.seasonal_site_honest', _interpScope({ intent: 'seasonal', category: 'Nonexistent' }, {}, { scope: { label: null, isPage: false } }).join('|'), '');   // fell to site -> chip says nothing (whole site), does NOT echo the unresolved term
        mk('interpscope.oneshot_preserved', _interpScope({ intent: 'seasonal' }, { oneShot: true }, { scope: { label: 'Health', isPage: false } }).join('|'), 'Health (this question only)');   // res.scope keeps the one-shot annotation
        // B10 seasonal follow-ups: page scope must NOT emit a briefing (category-only) chip.
        const _fSeasP = _followups({ intent: 'seasonal', category: 'Contact Tracing page' }, { scope: { label: 'Contact Tracing', isPage: true }, data: { rows: [] } }, r);
        mk('followup.seasonal_page_no_briefing', _fSeasP.join(' | ').indexOf('What should I focus on') < 0, true);
        mk('followup.seasonal_page_uses_resolved', _fSeasP.join(' | ').indexOf('Contact Tracing page') < 0 && _fSeasP.join(' | ').indexOf('Contact Tracing') >= 0, true);   // uses the resolved name, not the raw "... page" string
        mk('followup.seasonal_cat_keeps_briefing', _followups({ intent: 'seasonal', category: 'Health' }, { scope: { label: 'Health', isPage: false }, data: { rows: [] } }, r).join(' | ').indexOf('What should I focus on in Health?') >= 0, true);
        // B11 merge contract: pages merge by NAME (same name -> one page, summed); a different-language name does NOT pair
        // (the EN/GA twin leak - an Irish page whose English twin is named differently surfaces solo).
        mk('merge.same_name_pairs', mergePages([{ name: 'X', url: 'https://x/en/a', s: { impressions: 100 } }, { name: 'X', url: 'https://x/ga/a', s: { impressions: 50 } }]).length, 1);
        mk('merge.same_name_sums', mergePages([{ name: 'X', url: 'a', s: { impressions: 100 } }, { name: 'X', url: 'b', s: { impressions: 50 } }])[0].s.impressions, 150);
        mk('merge.diff_language_name_solo', mergePages([{ name: 'Civil Legal Aid', url: 'https://x/en/a', s: { impressions: 100 } }, { name: 'Comhairle Dhlí', url: 'https://x/ga/a', s: { impressions: 0, pageViews: 14 } }]).length, 2);
        // CTR formatter: sub-0.1% renders '<0.1%' everywhere (tile, sentence, table) via the ONE shared _ctrTxt, so no surface can round a real-but-tiny CTR to a self-contradicting '0.0%'
        mk('ctrtxt.subdecimal', _ctrTxt(0.0004), '<0.1%');
        mk('ctrtxt.zero_plain', _ctrTxt(0), '0.0%');           // an actual zero stays 0.0% (not '<0.1%' - reserve that for the non-zero-but-tiny case)
        mk('mfmt.subdecimal_ctr', _mfmt({ ctr: 0.0004 }, 'ctr'), '<0.1%');   // the metric formatter inherits it -> every _mfmt consumer is covered
        // ROLLUP artifact drag: a section whose CTR is pulled down by a few near-zero-at-top-rank pages is flagged, and the ex-artifact CTR lifts materially
        const _raT = _rollupArtifacts([{ s: { impressions: 100000, clicks: 20, position: 2.5, ctr: 0.0002 } }, { s: { impressions: 10000, clicks: 500, position: 5, ctr: 0.05 } }, { s: { impressions: 10000, clicks: 400, position: 6, ctr: 0.04 } }]);
        mk('rollupart.detects_drag', _raT.dragged, true);
        mk('rollupart.excl_lifts', _raT.exCtr > _raT.rawCtr, true);
        mk('rollupart.clean_undragged', _rollupArtifacts([{ s: { impressions: 10000, clicks: 500, position: 5, ctr: 0.05 } }]).dragged, false);   // no cliff page -> no false alarm
        // FOLLOW-UP entity-typing: a template must only be filled with the entity type it names. An emerging ROW is a QUERY;
        // its follow-up must resolve to the query's ranking PAGE, never stuff the query into a page template (the A5 hard fail).
        const _fupEm = _followups({ intent: 'emerging' }, { data: { rows: [{ query: 'hostile witness meaning', bestPage: 'https://x/a/1' }] } }, r);
        mk('followup.emerging_no_query_as_page', _fupEm.join(' ').indexOf('hostile witness meaning') < 0, true);   // the query string must NEVER become "the <query> page" (negative assertion: the bug can't hide)
        mk('followup.emerging_chains_to_page', _fupEm.indexOf('How is A1 performing?') >= 0, true);                // it chains to the resolved ranking page (answerable via page_summary)
        const _fupEm2 = _followups({ intent: 'emerging' }, { data: { rows: [{ query: 'hostile witness meaning', bestPage: 'https://x/nope' }] } }, r);
        mk('followup.emerging_unresolved_safe', _fupEm2.join(' ').indexOf('hostile witness meaning') < 0, true);   // unresolvable page -> fall to safe generics, still never a query-as-page chip
        // A7 cliff guard reaches the OPPORTUNITY engine: a near-zero CTR at a top rank on real impressions is fictional
        // upside, not an opportunity, so it's flagged an artifact (excluded from #1 opportunity/briefing slots). Medical Card's real numbers.
        mk('scorequery.artifact_flagged', _scoreQuery(19900, 4, 4.7).artifact, true);
        mk('scorequery.artifact_label', _scoreQuery(19900, 4, 4.7).label, 'Investigate first (CTR unreliable)');
        mk('scorequery.healthy_not_artifact', _scoreQuery(10000, 500, 3).artifact, false);   // a genuinely improvable query is NOT an artifact
        mk('scorequery.lowimpr_not_artifact', _scoreQuery(500, 1, 3).artifact, false);        // below the impressions floor -> too little data to call it
        // A7 movers headline: MAGNITUDE only. A % over a direction-filtered top-N (fallers-only) is not a property of anything real.
        const _mvH = _moversHeadline({ prev: 35400, change: -34700, pct: -98, churn: 35528 }, 'down', 'impressions');
        mk('movers.headline_magnitude', Math.round(_mvH.value), 34700);
        mk('movers.headline_no_pct', _mvH.delta == null, true);   // the misleading down-98% chip must NOT exist (semantic, not arithmetic, error)
        mk('movers.both_churn_no_pct', (function () { const h = _moversHeadline({ prev: 100, change: 0, pct: 0, churn: 500 }, 'both', 'impressions'); return h.value === 500 && h.delta == null; })(), true);
        // A8 did-you-mean click CONTRACT: a candidate re-runs the SAME intent with the RESOLVED page, dispatched
        // structurally - a page_summary disambig must NOT emit a diagnose question (the shipped-un-exercised crash path).
        const _disPS = _disambig('page_summary', [{ name: 'Disability Payments And Work', url: 'https://x/d', s: { impressions: 100000 } }], 'payments');
        mk('disambig.carries_intent', _disPS.indexOf('data-intent="page_summary"') >= 0, true);
        mk('disambig.carries_resolved_page', _disPS.indexOf('data-page="Disability Payments And Work"') >= 0, true);
        mk('disambig.not_diagnose', _disPS.indexOf('underperforming') < 0, true);           // page_summary disambig must NOT fire a diagnose question (the A8 contract bug)
        mk('disambig.no_raw_ref_as_page', _disPS.indexOf('data-page="payments"') < 0, true); // the unresolved raw string is never treated as a page
        mk('disambigq.page_summary', _disambigQ('page_summary', 'X'), 'How is X doing?');     // display bubble routes intent-correctly (page_summary, not diagnose)
        mk('disambigq.diagnose', _disambigQ('diagnose', 'X'), 'Why is X underperforming?');
        // A9 not-found: honest miss teaches the concept/coverage escape (not "spell it better"), uses a LIVE example
        // (never the old hardcoded strings), and logs page_not_found as its own demand signal.
        const _nf = _pageNotFound('Wizard Hat Grants', r);
        mk('notfound.tagged', _nf.missTag, 'page_not_found');
        mk('notfound.teaches_escape', _nf.err.indexOf('what content should we create') >= 0 || _nf.err.indexOf('what do people search for') >= 0, true);
        mk('notfound.live_example_not_hardcoded', _nf.err.indexOf('EU and family law') < 0 && _nf.err.indexOf('Airline liability') < 0, true);
        mk('notfound.echoes_ref', _nf.err.indexOf('Wizard Hat Grants') >= 0, true);
        // A10 chip integrity: the scope segment renders what runIntent RESOLVED (res.scope), never what the plan requested.
        mk('interpscope.resolved_country_over_plan', _interpScope({ intent: 'international_queries', country: 'America' }, {}, { scope: { label: null, country: 'United States' } }).join('|'), 'United States');
        mk('interpscope.drops_false_category', _interpScope({ intent: 'international_queries', category: 'Health', country: 'America' }, { oneShot: false }, { scope: { label: null, country: 'United States' } }).indexOf('Health') < 0, true);   // a scope-ignoring handler cannot leave a false section on the chip
        mk('interpscope.abroad_empty', _interpScope({ intent: 'international_queries' }, {}, { scope: { label: null, country: null } }).join('|'), '');
        mk('interpscope.fallback_shows_category', _interpScope({ intent: 'top_pages', category: 'Health' }, { oneShot: false }, {}).join('|'), 'Health');
        mk('interpscope.fallback_unscoped_site', _interpScope({ intent: 'rank_categories' }, { unscoped: true }, {}).join('|'), 'whole site');
        // A11 qualifier guard: an unserveable DEVICE cut must be NAMED in the answer (carve-out), never silently dropped.
        mk('segnote.device_mobile_named', _segmentNote("what's our bounce rate on mobile", ['Health', 'Money']).indexOf('device') >= 0 && _segmentNote("what's our bounce rate on mobile", ['Health']).indexOf('mobile') >= 0, true);
        mk('segnote.device_desktop', _segmentNote('top pages on desktop', ['Health']).indexOf('desktop') >= 0, true);
        mk('segnote.device_suppressed_by_name', _segmentNote('how is the mobile page doing', ['Mobile Phones']), '');   // 'mobile' is a page name -> no false carve-out
        mk('segnote.demographic', _segmentNote('bounce rate by age group', ['Health']).indexOf('demographic') >= 0, true);
        mk('segnote.clean_none', _segmentNote('which pages do people leave quickly in Health', ['Health']), '');
        // A11 example sampler: distinct sections (never "Compare X and X"), meta-sections deprioritised.
        mk('examplecats.distinct', (function () { const c = _exampleCats(3); return c[0] !== c[1] && c[1] !== c[2] && c[0] !== c[2]; })(), true);
        // A12 compound remainder: a second ask must surface (not vanish), but an "X and Y" scope list must NOT over-fire.
        mk('compound.fires_on_and_their', _compoundRemainder('top pages and their engagement and compare with Housing') != null, true);
        mk('compound.captures_tail', /compare with Housing/i.test(_compoundRemainder('top pages and their engagement and compare with Housing') || ''), true);
        mk('compound.fires_on_and_compare', _compoundRemainder('how is Health doing and compare with Housing') != null, true);
        mk('compound.no_overfire_scope_list', _compoundRemainder('top pages in Health and Housing'), null);   // one question, two scopes: must NOT apologise
        mk('compound.no_overfire_section_name', _compoundRemainder('top pages in money and tax'), null);      // "and tax" is part of a section name
        // A13 artifact tile marker: a dragged rollup CTR carries a * on the tile (crop-honest), a clean one does not.
        mk('stripcard.ctr_marked_when_dragged', _stripCard({ leafCount: 10, impressions: 1000, clicks: 10, ctr: 0.01, position: 5 }, false, true).indexOf('*') >= 0, true);
        mk('stripcard.ctr_unmarked_when_clean', _stripCard({ leafCount: 10, impressions: 1000, clicks: 10, ctr: 0.01, position: 5 }, false, false).indexOf('*') < 0, true);
        // A14 guard-at-row-source: _rankCard renders the artifact marker from item.artifact (so any page-row list inherits it),
        // and a low_ctr list topped by an artifact drops the wrong "why underperforming" chip, pointing at the artifact list.
        mk('rankcard.artifact_marker', _rankCard([{ name: 'Medical Card', val: '<0.1%', bar: 34000, artifact: true }], { nameLabel: 'Page', valueLabel: 'CTR' }).indexOf('&#9888;') >= 0, true);
        mk('rankcard.no_marker_when_clean', _rankCard([{ name: 'Medical Card', val: '5%', bar: 34000 }], { nameLabel: 'Page' }).indexOf('&#9888;') < 0, true);
        // C3: the trajectory column is labelled with its METRIC when sparklines are present (so it is not misread as CTR-over-time)
        mk('rankcard.track_label_when_spark', _rankCard([{ name: 'P', val: '1%', bar: 100, spark: [1, 2, 3] }], { nameLabel: 'Page', valueLabel: 'CTR', trackLabel: 'impr (6mo)' }).indexOf('impr (6mo)') >= 0, true);
        mk('rankcard.no_track_label_no_spark', _rankCard([{ name: 'P', val: '1%', bar: 100 }], { nameLabel: 'Page', valueLabel: 'CTR', trackLabel: 'impr (6mo)' }).indexOf('impr (6mo)') < 0, true);   // no sparks -> no track header (bars, not trajectories)
        // C3: a navigational top row (Mygovid) suppresses the diagnose chip in low_ctr (low CTR expected, not fixable)
        mk('followup.lowctr_navtop_no_why', _followups({ intent: 'low_ctr' }, { navTop: true, data: { rows: [{ page: 'Mygovid' }] } }, r).join(' | ').indexOf('underperforming') < 0, true);
        mk('followup.lowctr_artifact_drops_why', _followups({ intent: 'low_ctr', category: 'Health' }, { ctrArtifact: true, data: { rows: [{ page: 'Medical Card' }] } }, r).join(' | ').indexOf('underperforming') < 0, true);
        mk('followup.lowctr_artifact_points_to_artifacts', _followups({ intent: 'low_ctr', category: 'Health' }, { ctrArtifact: true, data: { rows: [{ page: 'Medical Card' }] } }, r).join(' | ').indexOf('tracking issues') >= 0, true);
        mk('followup.lowctr_clean_keeps_why', _followups({ intent: 'low_ctr' }, { ctrArtifact: false, data: { rows: [{ page: 'Xyz' }] } }, r).join(' | ').indexOf('underperforming') >= 0, true);
        // B1 compare CTR precision: 1 decimal normally, 2 when the rounded values TIE or either is under 0.5%.
        mk('ctrpair.normal_1dp', _ctrPair(0.011, 0.008).join(' vs '), '1.1% vs 0.8%');
        mk('ctrpair.subhalf_2dp', _ctrPair(0.0112, 0.0021).join(' vs '), '1.12% vs 0.21%');   // Environment's 0.2% is <0.5% -> both go to 2dp
        mk('ctrpair.tie_2dp', _ctrPair(0.010, 0.0104).join(' vs '), '1.00% vs 1.04%');          // rounded tie at 1dp -> 2dp reveals the real ordering
        mk('ctrpair.subdecimal_floor', _ctrPair(0.000004, 0.02)[0], '<0.01%');                  // never "0.00%"
        // B2 impression-side cliff: a healthy prior collapsing to single digits is a URL going dark, not a decline.
        mk('imprcliff.illness_benefit', _imprCliff(58300, 8), true);      // real numbers: 58.3K -> 8
        mk('imprcliff.back_to_school', _imprCliff(101100, 1), true);      // 101.1K -> 1
        mk('imprcliff.real_decline_no', _imprCliff(5000, 2000), false);   // a genuine 60% decline is NOT a vanish
        mk('imprcliff.fuel_rising_no', _imprCliff(60800, 137900), false); // impressions UP is never a cliff
        mk('imprcliff.below_floor_no', _imprCliff(500, 1), false);        // too small a prior to call it
        mk('imprcliff.at_floor_yes', _imprCliff(2000, 1), true);          // prior exactly at the named floor counts
        mk('imprcliff.just_below_floor_no', _imprCliff(1600, 1), false);  // C2: a 1.6K -> 1 row looks identical but is below the floor, so it is NOT in the count (boundary named + tested)
        // Movers chip-swap: a vanished faller offers "trended" (date the cliff), never "underperforming".
        const _fmV = _followups({ intent: 'movers', category: 'Social Welfare' }, { data: { rows: [{ page: 'Illness Benefit', previous: 58300, current: 8, changePct: -100 }] } }, r);
        mk('followup.movers_vanished_no_why', _fmV.join(' | ').indexOf('underperforming') < 0, true);
        mk('followup.movers_vanished_offers_trend', _fmV.join(' | ').indexOf('trended') >= 0, true);
        mk('followup.movers_normal_keeps_why', _followups({ intent: 'movers' }, { data: { rows: [{ page: 'Normal Page', previous: 5000, current: 2000, changePct: -60 }] } }, r).join(' | ').indexOf('underperforming') >= 0, true);
        // B3 sentence-vs-table drift: a sentence listing fewer than the table shows must disclose the cap.
        mk('sentencecap.discloses', _sentenceCap(6, 10), ' (the biggest 6 of 10 shown; the table has the rest).');
        mk('sentencecap.silent_when_equal', _sentenceCap(6, 6), '.');
        mk('sentencecap.silent_when_fewer', _sentenceCap(6, 4), '.');
        // #1 rate headline: a named rate reads in POINTS, never percent-of-percent; sentiment via the hook
        const _ctrHl = _headlineHtml({ value: 1.4, pct: true, unit: 'CTR now', delta: { pts: -0.3, improved: false }, tier: 'measured' });
        const _ctrChip = (/data-sentiment="[^"]*"[^>]*>([^<]*)</.exec(_ctrHl) || [])[1] || '';   // scope to the chip (the #3 hook IS the selector) so an innocent '1,180' or a date elsewhere can't false-fail the negative assertion
        mk('headline.ctr_pts', _ctrChip.indexOf('0.3pts') >= 0, true);
        mk('headline.ctr_not_relpct', _ctrChip.indexOf('18') < 0, true);        // the WRONG answer (-0.3/1.7 = -18%) must never be the chip's text (negative assertion: the bug can't hide behind both numbers rendering)
        mk('headline.ctr_sentiment_bad', _ctrHl.indexOf('data-sentiment="bad"') >= 0, true);
        // #3 position headline sentiment inverts correctly through the SAME chip path (down = good)
        mk('headline.pos_sentiment_good', _headlineHtml({ value: 5.1, unit: 'position now', delta: { pts: -1.3, improved: true }, tier: 'measured' }).indexOf('data-sentiment="good"') >= 0, true);
        // #2 per-day marker rides on the number (crop-proof), not hover-only
        mk('headline.perday_on_number', _headlineHtml({ value: 12400, sfx: ' /day', unit: 'fewer impressions', delta: { pct: -23 }, tier: 'measured' }).indexOf('12.4K /day') >= 0, true);   // marker rides the number (fmt abbreviates)
        // Wave 3 line-fills: the gap between two series is shaded only with the flag; sentiment via the hook
        const _2ser = function (flag) { return { periods: ['a', 'b', 'c'], series: [{ name: 'X', values: [100, 120, 140] }, { name: 'Y', values: [80, 70, 60] }], chart: { type: 'line', fillGap: flag } }; };
        mk('linefill.gap_on', _chartLine(_2ser(true), {}).indexOf('sv-carea') >= 0, true);
        mk('linefill.gap_off', _chartLine(_2ser(false), {}).indexOf('sv-carea') < 0, true);   // two series, no flag -> no fill (avoids muddy overlap)
        mk('linefill.sentiment_decline', _chartLine({ periods: ['a', 'b'], series: [{ name: 'cur', values: [100, 80] }, { name: 'prior', values: [100, 100] }], chart: { type: 'line', fillGap: 'sentiment' } }, {}).indexOf('data-sentiment="bad"') >= 0, true);   // current ends below prior, never crosses = decline
        mk('linefill.crossing_no_lie', _chartLine({ periods: ['a', 'b', 'c'], series: [{ name: 'cur', values: [80, 100, 130] }, { name: 'prior', values: [120, 100, 90] }], chart: { type: 'line', fillGap: 'sentiment' } }, {}).indexOf('data-sentiment') < 0, true);   // cur trails then overtakes -> crosses -> NO sentiment claim (drops to neutral)
        // sparkline-in-row: per-row scale, guarded against manufactured drama (clamp + deadband)
        mk('spark.renders', _sparkline([10, 20, 30], {}).indexOf('<svg') === 0, true);
        mk('spark.needs_two', _sparkline([5], {}), '');
        // guard #1 min-range clamp: a low-variance series pads its domain (renders flat); a real collapse does not
        mk('spark.clamp_lowvar', _sparkRange([980, 1000, 1020], _SPARK_MINRANGE).clamped, true);
        mk('spark.no_clamp_collapse', _sparkRange([1000, 600, 200], _SPARK_MINRANGE).clamped, false);
        // guard #2 sentiment deadband: a tiny drift is noise (no sentiment); a genuine collapse/growth reads
        mk('spark.deadband_noise', _sparkTrend([1000, 1005, 995, 1002], _SPARK_DEADBAND).sentiment, '');
        mk('spark.collapse_bad', _sparkTrend([1000, 800, 600, 200, 100, 80], _SPARK_DEADBAND).sentiment, 'bad');
        mk('spark.growth_good', _sparkTrend([20, 40, 80, 120], _SPARK_DEADBAND).sentiment, 'good');
        // negative assertion: a noisy stable series NEVER gets a sentiment dot (the manufactured-drama bug, pinned)
        mk('spark.noise_no_sentiment', _sparkline([1000, 1005, 995, 1002, 998, 1003], {}).indexOf('data-sentiment') < 0, true);
        // stacked proportion bar: segments proportional to value; benchmark: below typical = bad via the hook
        mk('stacked.proportional', _stackedBar([{ label: 'Direct', value: 30 }, { label: 'Google', value: 70 }], {}).indexOf('width:70.00%') >= 0, true);
        mk('stacked.empty', _stackedBar([{ label: 'x', value: 0 }], {}), '');
        mk('bench.below_bad', _benchmarkBar(0.017, 0.024, {}).indexOf('data-sentiment="bad"') >= 0, true);    // CTR below typical-for-position
        mk('bench.above_good', _benchmarkBar(0.030, 0.024, {}).indexOf('data-sentiment="good"') >= 0, true);
        // CTR cliff guard: a near-zero CTR at a strong rank on real impressions is an artifact, not a grade
        mk('ctrcliff.fuel', _ctrCliff(2.7, 0.0004, 137900), true);   // Fuel Allowance's real numbers: 137.9K impr, ~0 clicks at pos 2.7
        mk('ctrcliff.real_lowctr', _ctrCliff(3, 0.05, 10000), false);   // a genuinely low but real CTR is NOT an artifact
        mk('ctrcliff.below_floor', _ctrCliff(2.7, 0.0004, 500), false);   // too few impressions to call it
        // sub-decimal CTR must not read as a literal 0.0%
        mk('aictr.subdecimal', _aiCtr(0.0004), '<0.1%');
        mk('aictr.normal', _aiCtr(0.017), '1.7%');
        // the SHARED verdict sentence: a MIXED decline is DECOMPOSED (visibility vs AI), AI is the REMAINDER not the whole
        const _vs = _aiVerdictSentence({ months: 14, read: 'mixed', clkChange: -0.62, imprChange: -0.41, eCtr: 0.017, lCtr: 0.011 });
        mk('verdict.carries_visibility', _vs.indexOf('reduced visibility') >= 0 && _vs.indexOf('41 points') >= 0, true);
        mk('verdict.ai_is_remainder', _vs.indexOf('remainder consistent with AI') >= 0, true);   // NOT "clicks down 62% consistent with AI" (the over-claim)
        mk('verdict.clean_case', _aiVerdictSentence({ months: 12, read: 'clean', clkChange: -0.3, imprChange: -0.02, eCtr: 0.02, lCtr: 0.014 }).indexOf('roughly steady impressions') >= 0, true);
        // FIXED-WINDOW comparability: exactly N complete months, partial current month dropped, INVARIANT as GSC accrues
        const _tmRows = ['202407', '202408', '202409', '202410', '202411', '202412', '202501', '202502', '202503', '202504', '202505', '202506', '202507', '202508', '202509'].map(function (y) { return { ym: y, impressions: 100 }; });
        mk('trend.fixed_len', _capTrendMonths(_tmRows, 12, 202509).length, 12);
        mk('trend.drops_partial_current', _capTrendMonths(_tmRows, 12, 202509).filter(function (x) { return x.ym === '202509'; }).length, 0);
        mk('trend.invariant_on_accrual', _capTrendMonths(_tmRows.concat([{ ym: '202510', impressions: 5 }]), 12, 202510).length, 12);   // next month accrues -> STILL 12 (the drift bug class cannot return)

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
    // Truncate with an ellipsis so a chart label never cuts mid-word ("Local Authority Mortga").
    function _ellip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
    // MIDDLE truncation keeps BOTH ends, so common-prefix names ("Local Authority Mortgages" vs "…Purchase
    // And Renovation Loan") stay distinguishable — the discriminating word survives (the full name lives in
    // the row's hover title). End-ellipsis fails exactly this case, which is the one that matters in a compare.
    function _ellipMid(s, n) { s = String(s); if (s.length <= n) return s; const head = Math.ceil((n - 1) / 2), tail = n - 1 - head; return s.slice(0, head) + '…' + (tail > 0 ? s.slice(s.length - tail) : ''); }
    // THE CTR formatter (one place, all consumers): a sub-decimal rate must not render as a literal '0.0%'.
    // Every tile, sentence, table, and chart routes CTR through here so 0.04% can't say '0.0%' on one surface
    // and '<0.1%' on another (the Fuel Allowance self-contradiction). Data rows keep numeric (2dp) for export.
    function _ctrTxt(ctr) { const c = Number(ctr) || 0; return (c > 0 && c < 0.001) ? '<0.1%' : (c * 100).toFixed(1) + '%'; }
    // ONE place all "share of total" percents route through (C5): a nonzero sliver reads "<1%", never a misleading "0%".
    // Takes a FRACTION (value/total, 0 to 1). Every inline "Math.round(v/total*100)+'%'" should call this instead.
    function _pctTxt(frac) { const p = (Number(frac) || 0) * 100; return (p > 0 && p < 1) ? '<1%' : Math.round(p) + '%'; }
    // Comparison-aware CTR pair: rates in a compare read at ONE decimal, but get a SECOND when the rounded values TIE
    // (A2's "1.0% vs 1.0%" hides the real ordering) or when either is under 0.5% (B1's "1.1% vs 0.2%" near-order-of-
    // magnitude spread) - precision on demand, not everywhere. Sub-decimal still floors to "<0.0..1%" (never "0.00%").
    function _ctrPair(a, b) {
        a = Number(a) || 0; b = Number(b) || 0;
        const tie = (a * 100).toFixed(1) === (b * 100).toFixed(1);
        const dp = (tie || (a > 0 && a < 0.005) || (b > 0 && b < 0.005)) ? 2 : 1;
        const f = function (x) { if (x <= 0) return (0).toFixed(dp) + '%'; const s = (x * 100).toFixed(dp); return parseFloat(s) === 0 ? ('<0.' + (dp > 1 ? '0'.repeat(dp - 1) : '') + '1%') : (s + '%'); };
        return [f(a), f(b)];
    }
    // Renders of one answer must AGREE or DISCLOSE their difference (B3): when a summary SENTENCE lists fewer rows than the
    // TABLE shows, say so - a sentence-copier / screen-reader user must not get a silently shorter answer. Returns the tail.
    function _sentenceCap(listed, total) {
        return (total > listed) ? ' (the biggest ' + listed + ' of ' + total + ' shown; the table has the rest).' : '.';
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
            const a = ga4By[key]; if (a) { out.pageViews = a.pageViews; out.users = a.users; out.sessions = a.sessions; out.engagementRate = a.engagementRate; out.avgSessionDuration = a.avgSessionDuration; out.bounceRate = a.bounceRate; }
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
                fmt(c.clicks) + ' clicks · ' + _ctrTxt(c.ctr) + ' CTR · pos ' +
                (c.position != null ? c.position.toFixed(1) : '—') + ' · ' + fmt(c.pageCount) + ' pages';
            return '<div data-cat="' + esc(leaf.data.name) + '" title="' + esc(title) + '" style="cursor:pointer;position:absolute;left:' + (leaf.x0 / W * 100) +
                '%;top:' + (leaf.y0 / H * 100) + '%;width:' + wPct + '%;height:' + hPct +
                '%;background:' + f.css + ';border-radius:4px;overflow:hidden;padding:6px 8px;box-sizing:border-box;cursor:default;" class="sv-treemap-cell">' +
                (showName ? '<div style="font-size:0.72rem;font-weight:700;color:' + txt + ';line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(leaf.data.name) + '</div>' : '') +
                (showVal ? '<div style="font-size:0.66rem;color:' + sub + ';margin-top:2px;">' + fmt(c.impressions) + (usesCtr ? ' · ' + _ctrTxt(c.ctr) : '') + '</div>' : '') +
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
                    metric('CTR', _ctrTxt(d.ctr)) +
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
                    metric('CTR', _ctrTxt(t.ctr)) +
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
            if (!map.has(k)) map.set(k, { name: p.name, url: p.url, urls: [], lm: p.lm, _maxImp: -1, imp: 0, clk: 0, pv: 0, us: 0, posSum: 0, posW: 0, ses: 0, engSum: 0, durSum: 0, bounceSum: 0 });
            const m = map.get(k), sp = p.s || {};
            m.urls.push(p.url);
            m.imp += sp.impressions || 0; m.clk += sp.clicks || 0; m.pv += sp.pageViews || 0; m.us += sp.users || 0;
            if ((sp.impressions || 0) > 0 && sp.position != null) { m.posSum += sp.position * sp.impressions; m.posW += sp.impressions; }
            const ses = sp.sessions || 0;
            if (ses > 0) { m.ses += ses; if (sp.engagementRate != null) m.engSum += sp.engagementRate * ses; if (sp.avgSessionDuration != null) m.durSum += sp.avgSessionDuration * ses; if (sp.bounceRate != null) m.bounceSum += sp.bounceRate * ses; }
            if ((sp.impressions || 0) > m._maxImp) { m._maxImp = sp.impressions || 0; m.url = p.url; }
            if (p.lm && (!m.lm || Date.parse(p.lm) > Date.parse(m.lm))) m.lm = p.lm;
        });
        return Array.from(map.values()).map(function (m) {
            return { name: m.name, url: m.url, urls: m.urls, lm: m.lm,
                s: { impressions: m.imp, clicks: m.clk, pageViews: m.pv, users: m.us, sessions: m.ses,
                     ctr: m.imp > 0 ? m.clk / m.imp : 0, position: m.posW > 0 ? m.posSum / m.posW : null,
                     engagementRate: m.ses > 0 ? m.engSum / m.ses : null, avgSessionDuration: m.ses > 0 ? m.durSum / m.ses : null, bounceRate: m.ses > 0 ? m.bounceSum / m.ses : null } };
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
    // ── Period comparison (compare_periods) ──────────────────────────────────────────────
    // Canonical cache key for ANY period (relative or, in stage 2, absolute) — every cache
    // should key on this so two different absolute ranges can never collide (point 1).
    function periodKey(p) { return (p && p.startDate && p.endDate) ? (p.startDate + '|' + p.endDate) : ('d' + ((p && p.days) || 30) + 'o' + ((p && p.offset) || 0)); }
    // Resolve a period phrase. Stage 1 = RELATIVE windows only (map to days+offset). Calendar
    // terms (q1-q4, month names, years) return {calendar:true} so the intent can say "coming".
    function _resolvePeriod(term) {
        const t = String(term || '').trim().toLowerCase().replace(/\bthe\b/g, '').replace(/\s+/g, ' ').trim();
        if (!t) return null;
        if (/\b(?:q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b/.test(t) || /\b20\d\d\b/.test(t)) return { calendar: true, raw: term };
        if (/^(?:this|current|last 30 days?|past 30 days?|this month|current month)$/.test(t) || t === 'month' || t === 'this month') return { label: 'the last 30 days', days: 30, offset: 0 };
        if (/\b(?:last|previous|prior) month\b|\bmonth before\b|\bprevious 30 days?\b/.test(t)) return { label: 'the previous 30 days', days: 30, offset: 30 };
        if (/\b(?:this|current|past|last) week\b|\blast 7 days?\b/.test(t) || t === 'week') return { label: 'the last 7 days', days: 7, offset: 0 };
        if (/\b(?:last|previous|prior) week\b|\bweek before\b|\bprevious 7 days?\b/.test(t)) return { label: 'the previous 7 days', days: 7, offset: 7 };
        if (/\b(?:this|current|past) quarter\b|\blast 90 days?\b|\blast 3 months?\b/.test(t) || t === 'quarter') return { label: 'the last 90 days', days: 90, offset: 0 };
        if (/\b(?:last|previous|prior) quarter\b|\bquarter before\b|\bprevious 90 days?\b|\bprevious 3 months?\b/.test(t)) return { label: 'the previous 90 days', days: 90, offset: 90 };
        const nm = /\b(\d{1,3})\s*days?\b/.exec(t);
        if (nm) { const d = Math.min(365, Math.max(1, parseInt(nm[1], 10))); return /\b(?:previous|prior|before|earlier)\b/.test(t) ? { label: 'the previous ' + d + ' days', days: d, offset: d } : { label: 'the last ' + d + ' days', days: d, offset: 0 }; }
        if (/\bprevious period\b/.test(t)) return { label: 'the previous period', days: 30, offset: 30, _prev: true };
        return null;
    }
    // A window is [offset, offset+days] in DAYS-AGO. Two windows OVERLAP when those intervals share positive length.
    function _periodsOverlap(a, b) {
        if (!a || !b) return false;
        const aS = (a.offset || 0), aE = aS + (a.days || 0), bS = (b.offset || 0), bE = bS + (b.days || 0);
        return Math.min(aE, bE) - Math.max(aS, bS) > 0;
    }
    // Overlapping windows silently DILUTE every delta toward zero (e.g. "this month" is INSIDE "last 90 days", so one
    // third of the baseline IS the thing compared -> systematically muted, real changes made invisible). Auto-disjoint
    // (B5): KEEP the window closest to now (smaller offset; tie -> shorter), re-anchor the OTHER to sit immediately before
    // it, and return a disclosure note. Mutates the shifted period in place. Returns null when the windows are already disjoint.
    function _disjoinOverlap(pa, pb) {
        if (!_periodsOverlap(pa, pb)) return null;
        let keep;
        if ((pa.offset || 0) !== (pb.offset || 0)) keep = (pa.offset || 0) < (pb.offset || 0) ? pa : pb;
        else keep = (pa.days || 0) <= (pb.days || 0) ? pa : pb;
        const shift = (keep === pa) ? pb : pa;
        shift.offset = (keep.offset || 0) + (keep.days || 0);
        shift.label = 'the ' + shift.days + ' days before ' + ((keep.offset || 0) ? 'that' : 'it');
        return { note: 'The windows you named overlap (' + keep.label + ' sits inside the other), which would flatten every change toward zero, so I compared ' + keep.label + ' vs ' + shift.label + '.' };
    }
    // Combine finalized per-URL stats into one, re-weighting rates correctly (point 5): CTR by
    // impressions, position by impressions, engagement/duration/bounce by sessions.
    function _combineStats(arr) {
        let imp = 0, clk = 0, pv = 0, us = 0, ses = 0, posW = 0, posSum = 0, engW = 0, engSum = 0, durSum = 0, bounceSum = 0;
        (arr || []).forEach(function (s) { if (!s) return; const i = s.impressions || 0; imp += i; clk += s.clicks || 0; pv += s.pageViews || 0; us += s.users || 0; const se = s.sessions || 0; ses += se; if (i > 0 && s.position != null) { posSum += s.position * i; posW += i; } if (se > 0) { if (s.engagementRate != null) engSum += s.engagementRate * se; if (s.avgSessionDuration != null) durSum += s.avgSessionDuration * se; if (s.bounceRate != null) bounceSum += s.bounceRate * se; engW += se; } });
        return { impressions: imp, clicks: clk, pageViews: pv, users: us, sessions: ses, ctr: imp > 0 ? clk / imp : 0, position: posW > 0 ? posSum / posW : null, engagementRate: engW > 0 ? engSum / engW : null, avgSessionDuration: engW > 0 ? durSum / engW : null, bounceRate: engW > 0 ? bounceSum / engW : null };
    }
    // Honour an explicit metric window in the question ("this week"/"this month") for that
    // answer, so the data matches the words. Only returns windows the fetch supports (PERIODS).
    // "last year" is deliberately excluded - that's the seasonal comparison, not a 365-day window.
    function _askPeriod(q) {
        const s = String(q || '').toLowerCase();
        if (/\blast year\b/.test(s)) return null;
        if (/\b(?:this|past|last)\s+week\b|\b(?:last|past)\s+7\s+days\b|\bweekly\b/.test(s)) return 7;
        if (/\b(?:this|past|last)\s+month\b|\b(?:last|past)\s+30\s+days\b|\bmonthly\b/.test(s)) return 30;
        if (/\b(?:this|past|last)\s+quarter\b|\b(?:last|past)\s+3\s+months\b|\b(?:last|past)\s+90\s+days\b/.test(s)) return 90;
        if (/\b(?:last|past)\s+6\s+months\b|\b(?:last|past)\s+180\s+days\b/.test(s)) return 180;
        if (/\b(?:this|past)\s+year\b|\b(?:last|past)\s+12\s+months\b/.test(s)) return 365;
        return null;
    }
    // The tool has no traffic-source (paid/organic/social) split yet. If the question asks for
    // one, say so honestly. BUT don't fire on a word that's part of a section/page NAME — e.g.
    // "social" in "Social Welfare", "direct" in "Direct Provision", "paid" in "Paid leave".
    function _segmentNote(q, names) {
        const s = String(q || '');
        const named = function (w) { return (names || []).some(function (n) { return String(n || '').toLowerCase().indexOf(w) > -1; }); };
        // DEVICE split (mobile/desktop/tablet): a dimension the tool never fetches. Naming the dropped qualifier is
        // MANDATORY, or an all-traffic answer reads as the mobile answer the user asked for (A11: "bounce rate on mobile"
        // silently dropped "mobile" and answered a different question with a confident chip - the never-force rule, live).
        const dev = /\bmobile\b|\bdesktop\b|\btablet\b|\bby device\b|\bdevice split\b/i.exec(s);
        if (dev && !named('mobile') && !named('desktop') && !named('tablet')) {
            const d = /desktop/i.test(s) ? 'desktop' : (/tablet/i.test(s) ? 'tablet' : 'mobile');
            return 'Note: this tool can’t split by device, so the figures below are ALL traffic, not just ' + d + '.';
        }
        // Browser / demographic splits: also never fetched.
        if (/\bby browser\b|\bsafari\b|\bchrome\b|\bfirefox\b|\bby age\b|\bage group\b|\bgender\b|\bdemographic/i.test(s)) {
            return 'Note: this tool can’t split by browser or demographics, so the figures below are ALL traffic.';
        }
        const m = /\b(paid|organic|direct|referral|social|email|cpc)\b/i.exec(s);
        if (!m) return '';
        const w = m[1].toLowerCase();
        if (named(w)) return '';   // it's a section/page name, not a source
        return 'Note: this tool doesn’t split traffic by source yet, so the figures below are ALL traffic, not just ' + w + '.';
    }
    // The plan must account for the WHOLE question: a compound ("top pages and their engagement and compare with Housing")
    // answers ONE part, so the REMAINDER must surface as a tap, never vanish silently (A12 - the same missing concept as
    // the A11 qualifier guard: anything the plan did not consume is debt the answer must declare). Deterministic backstop
    // for the obvious conjunction joins; the Groq path also returns a `remainder` field. Must NOT over-fire on an "X and Y"
    // scope list ("top pages in Health and Housing" is ONE question about two scopes, not a compound).
    function _compoundRemainder(q) {
        const s = String(q || '').trim();
        // an "and" that introduces a NEW ask: "and compare ...", "and their <noun> ...", "and <question-word> ..."
        const m = /\band\s+(compare\b.*|their\s+\S+.*|(?:how|what|which|why|where|when|is|are|do|does|show)\b.*)$/i.exec(s);
        if (!m) return null;
        const rem = m[1].trim();
        return rem.length >= 4 ? rem : null;
    }

    // ── Category scope (for category owners) ──────────────────────────────────────────
    // A sticky, per-sitemap default that scopes the hero, examples and bare questions to the
    // owner's section — but never walls them in. The five rules live here, not in judgement.
    const _SCOPE_PAGE_INTENTS = { diagnose: 1, page_summary: 1, page_queries: 1 };            // rule 2: resolve site-wide
    const _SCOPE_NONE_INTENTS = { rank_categories: 1, compare: 1, site_summary: 1, digest: 1, ai_impact: 1 }; // rule 3: ignore scope
    // Namespace the stored scope per sitemap (rule 4) so a "Health" from CI isn't applied to MABS.
    function _scopeRootId() {
        const t = window.treeData || {};
        let host = '';
        (function find(n) { if (host || !n) return; if (n.url) { try { host = new URL(n.url).hostname; } catch (e) {} } (n.children || n._children || []).forEach(find); })(t);
        return String(host || t.name || 'default').toLowerCase().replace(/[^a-z0-9.-]/g, '');
    }
    function _scopeKey() { return 'sv:askScope:' + _scopeRootId(); }
    // Deduped by the SAME key build() merges categories with (trim+lowercase), so the pill lists
    // each section once — matching r.categories — instead of the raw /en/ + /ga/ copies.
    function _scopeCatNames() {
        try {
            const seen = Object.create(null), out = [];
            pickCategories(window.treeData || {}).forEach(function (c) {
                const n = c && c.name; if (!n) return;
                const k = String(n).trim().toLowerCase();
                if (!seen[k]) { seen[k] = 1; out.push(n); }
            });
            return out;
        } catch (e) { return []; }
    }
    // Read + VALIDATE against the current sitemap's sections (rule 4); stale/removed -> whole site.
    function _getScopeName() {
        let v = '';
        try { v = localStorage.getItem(_scopeKey()) || ''; } catch (e) {}
        if (!v) return '';
        const hit = _scopeCatNames().find(function (n) { return n.toLowerCase() === v.toLowerCase(); });
        return hit || '';
    }
    function _setScopeName(name) { try { if (name) localStorage.setItem(_scopeKey(), name); else localStorage.removeItem(_scopeKey()); } catch (e) {} }
    // Decide the scope actually used for THIS question. NEVER rebinds the sticky pill (rule 1).
    // Returns { resolvedScope, oneShot, unscoped }; may set plan.category as a silent default.
    function _applyScope(plan, sticky, forceSite) {
        const out = { resolvedScope: '', oneShot: false, unscoped: false };
        if (_SCOPE_NONE_INTENTS[plan.intent]) { out.unscoped = true; return out; }               // rule 3
        if (_SCOPE_PAGE_INTENTS[plan.intent]) { return out; }                                     // rule 2: page questions are site-wide
        if (plan.category) { out.resolvedScope = plan.category; out.oneShot = !!(sticky && String(plan.category).toLowerCase() !== String(sticky).toLowerCase()); return out; } // rule 1: explicit = one-shot, pill unchanged
        if (!forceSite && sticky) { plan.category = sticky; out.resolvedScope = sticky; }         // silent default to the owner's section
        return out;
    }
    // Proactive hero findings — computed from the ALREADY-BUILT rollup only (no fetch on open).
    function _heroFindings(r, scopeName) {
        const c = scopeName ? _catByName(r.categories, scopeName) : null;
        const pages = c ? catPages(c) : _allPages(r);
        const now = Date.now(), out = [];
        const avg = (c ? c.rollup.ctr : r.totals.ctr) || 0;
        const lowc = pages.filter(function (p) { return (p.s.impressions || 0) >= 300 && p.s.ctr < Math.max(0.005, avg * 0.6); }).sort(function (a, b) { return b.s.impressions - a.s.impressions; })[0];
        if (lowc) out.push({ icon: _ficon('zap'), text: '“' + lowc.name + '” gets ' + fmt(lowc.s.impressions) + ' impressions but only ' + _ctrTxt(lowc.s.ctr) + ' click', q: 'Why is the ' + lowc.name + ' page underperforming?' });
        const stale = pages.map(function (p) { const t = p.lm ? Date.parse(p.lm) : NaN; return { p: p, m: isNaN(t) ? null : (now - t) / (1000 * 60 * 60 * 24 * 30.44) }; }).filter(function (x) { return x.m != null && x.m > 12 && (x.p.s.impressions || 0) >= 200; }).sort(function (a, b) { return b.m - a.m; })[0];
        if (stale) out.push({ icon: _ficon('edit'), text: '“' + stale.p.name + '” is ~' + Math.round(stale.m) + ' months old and still gets ' + fmt(stale.p.s.impressions) + ' impressions', q: 'What is stale' + (scopeName ? ' in ' + scopeName : '') + '?' });
        const eng = pages.filter(function (p) { return p.s.engagementRate != null && (p.s.sessions || 0) >= 20; }).sort(function (a, b) { return a.s.engagementRate - b.s.engagementRate; })[0];
        if (eng && eng.s.engagementRate < 0.5) out.push({ icon: _ficon('activity'), text: '“' + eng.name + '” — only ' + Math.round(eng.s.engagementRate * 100) + '% of visits are engaged', q: 'Which pages do people leave quickly' + (scopeName ? ' in ' + scopeName : '') + '?' });
        const dead = pages.filter(function (p) { return (p.s.impressions || 0) === 0; }).length;
        if (dead > 0) out.push({ icon: _ficon('circle'), text: dead + ' page' + (dead === 1 ? '' : 's') + (scopeName ? ' in ' + scopeName : '') + ' get no search traffic', q: 'Which pages get no search traffic' + (scopeName ? ' in ' + scopeName : '') + '?' });
        if (!out.length) { const top = pages.slice().sort(function (a, b) { return (b.s.pageViews || b.s.impressions || 0) - (a.s.pageViews || a.s.impressions || 0); })[0]; if (top && (top.s.pageViews || top.s.impressions)) out.push({ icon: _ficon('star'), text: 'Most-viewed' + (scopeName ? ' in ' + scopeName : '') + ': “' + top.name + '”', q: 'How is the ' + top.name + ' page performing?' }); }
        return out.slice(0, 4);
    }
    function _scopeOptions(sel) {
        return '<option value="">Whole site</option>' + _scopeCatNames().map(function (n) { return '<option value="' + esc(n) + '"' + (String(n).toLowerCase() === String(sel || '').toLowerCase() ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
    }
    // Proactive empty state: "what stands out" in the owner's section (rule 5 makes picking it the onboarding).
    function _heroHtml(r, scopeName) {
        const findings = _heroFindings(r, scopeName);
        const scopeLbl = scopeName || 'the whole site';
        const head = '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:8px;">What stands out &middot; ' + esc(scopeLbl) + '</div>';
        const body = findings.length
            ? '<div style="display:flex;flex-direction:column;gap:6px;">' + findings.map(function (f) { return '<button class="sv-ask-chip sv-ask-chip-row" data-q="' + esc(f.q) + '" style="display:flex;gap:9px;align-items:flex-start;font-size:0.8rem;padding:9px 11px;line-height:1.4;"><span style="flex-shrink:0;display:inline-flex;align-items:center;color:var(--primary);">' + f.icon + '</span><span>' + esc(f.text) + '</span></button>'; }).join('') + '</div>'
            : '<div style="font-size:0.82rem;color:var(--color-text-secondary);margin-bottom:6px;">Nothing jumps out' + (scopeName ? ' in ' + esc(scopeName) : '') + ' right now — ask a question below to dig in.</div>';
        const pickHint = !scopeName ? '<div style="font-size:0.68rem;color:var(--color-text-muted);margin-top:11px;">Owner of a section? <button class="sv-ask-scope-open" style="background:none;border:none;color:var(--primary);font-weight:700;cursor:pointer;font-family:inherit;padding:0;text-decoration:underline;font-size:0.68rem;">Pick your section</button> to make this yours.</div>' : '';
        const more = '<button class="sv-ask-help" style="margin-top:12px;background:none;border:none;color:var(--primary);font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;padding:0;text-decoration:underline;">See what you can ask</button>';
        return '<div class="sv-ask-intro">' + head + body + pickHint + more + '</div>';
    }
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
            '.sv-dd-page:hover{background:var(--color-bg-tertiary);}',
            '@keyframes sv-bounce{0%,80%,100%{transform:translateY(0);opacity:.45}40%{transform:translateY(-5px);opacity:1}}',
            // Chart entrances — base state is the FINAL state (so PNG export, which doesn\'t run these, stays correct).
            '@keyframes sv-draw{from{stroke-dashoffset:3000}to{stroke-dashoffset:0}}',
            '@keyframes sv-fadein{from{opacity:0}to{opacity:1}}',
            '@keyframes sv-growx{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
            '.sv-chart svg .sv-cline{stroke-dasharray:3000;animation:sv-draw .85s cubic-bezier(.22,.61,.36,1);}',
            '.sv-chart svg .sv-carea{animation:sv-fadein .7s ease .15s both;}',
            '.sv-chart svg .sv-cdot{animation:sv-fadein .01s linear both;}',
            '.sv-chart .sv-cbar{transform-box:fill-box;transform-origin:left center;animation:sv-growx .55s cubic-bezier(.22,.61,.36,1) both;}'
        ].join('');
        document.head.appendChild(st);
    }
    // Ask-panel stylesheet — committed radius (6/10/14), type (0.72/0.8/0.9rem, weight carries the
    // rest) and spacing (8/12/16/20) scales, plus the :hover / :focus-visible states that inline
    // styles literally cannot express (so this doubles as the accessibility fix). Injected once.
    function ensureAskStyle() {
        if (document.getElementById('sv-ask-style')) return;
        const st = document.createElement('style'); st.id = 'sv-ask-style';
        st.textContent = `
#sv-ask-panel{--sv-r-sm:6px;--sv-r-md:10px;--sv-r-lg:14px;font-variant-numeric:tabular-nums;}
.sv-ask-ctl{appearance:none;-webkit-appearance:none;font-family:inherit;font-size:0.72rem;font-weight:600;padding:6px 26px 6px 10px;border:1px solid var(--color-border-primary);border-radius:var(--sv-r-sm);color:var(--color-text-secondary);cursor:pointer;background:var(--color-bg-primary) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") no-repeat right 8px center;transition:border-color .15s,box-shadow .15s;}
.sv-ask-ctl:hover{border-color:var(--primary);}
.sv-ask-ctl:focus-visible{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,124,182,0.18);}
.sv-ask-input{flex:1;min-width:0;font-family:inherit;font-size:0.9rem;padding:10px 12px;border:1px solid var(--color-border-primary);border-radius:var(--sv-r-md);background:var(--color-bg-primary);color:var(--color-text-primary);transition:border-color .15s,box-shadow .15s;}
.sv-ask-input:focus-visible{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,124,182,0.18);}
.sv-ask-btn-primary{background:var(--primary);color:#fff;border:none;padding:10px 16px;border-radius:var(--sv-r-md);font-weight:600;font-size:0.9rem;cursor:pointer;font-family:inherit;transition:filter .15s,transform .05s;}
.sv-ask-btn-primary:hover{filter:brightness(1.08);}
.sv-ask-btn-primary:active{transform:translateY(1px);}
.sv-ask-icon-btn{display:inline-flex;align-items:center;background:var(--color-bg-primary);border:1px solid var(--color-border-primary);color:var(--color-text-secondary);border-radius:var(--sv-r-md);padding:0 11px;cursor:pointer;font-family:inherit;transition:border-color .15s,color .15s;}
.sv-ask-icon-btn:hover{border-color:var(--primary);color:var(--primary);}
.sv-ask-iconbtn-muted{background:none;border:none;color:var(--color-text-muted);cursor:pointer;border-radius:var(--sv-r-sm);padding:5px;display:inline-flex;align-items:center;transition:color .15s,background .15s;}
.sv-ask-iconbtn-muted:hover{color:var(--color-text-primary);background:var(--color-bg-tertiary);}
@keyframes sv-ask-enter{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
.sv-ask-entry{margin-bottom:22px;animation:sv-ask-enter .32s cubic-bezier(.22,.61,.36,1) both;}
.sv-ask-chip{font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s,color .15s,transform .06s;}
.sv-ask-chip:active{transform:scale(0.97);}
.sv-ask-chip-pill{font-size:0.72rem;padding:5px 11px;border-radius:20px;border:1px solid var(--color-border-primary);background:transparent;color:var(--color-text-secondary);}
.sv-ask-chip-pill:hover{border-color:var(--primary);color:var(--primary);background:var(--color-bg-tertiary);}
.sv-ask-chip-accent{font-size:0.72rem;padding:5px 11px;border-radius:20px;border:1px solid var(--primary);background:transparent;color:var(--primary);font-weight:600;}
.sv-ask-chip-accent:hover{background:var(--primary);color:#fff;}
.sv-ask-chip-row{text-align:left;border:1px solid var(--color-border-primary);border-radius:var(--sv-r-md);background:var(--color-bg-primary);color:var(--color-text-primary);}
.sv-ask-chip-row:hover{border-color:var(--primary);background:var(--color-bg-tertiary);}
/* Fewer boxes: the answer list is borderless with hairline dividers between rows (not around each);
   the panel is the only real box. Last row drops its trailing divider. */
.sv-ask-list{border:none;border-radius:var(--sv-r-md);overflow:hidden;background:var(--color-bg-primary);}
.sv-ask-list>*:last-child>div{border-bottom:none;}
.sv-ask-bar{transform-origin:left center;animation:sv-growx .5s cubic-bezier(.22,.61,.36,1) both;}
/* Epistemic grammar — measured (plain), estimated (~, muted), inferred/pending (dashed "bound"). */
.sv-epi-meas{font-weight:700;}
.sv-epi-est{color:var(--color-text-secondary);}
.sv-epi-inf{border:1px dashed var(--color-border-primary);border-radius:4px;padding:0 4px;color:var(--color-text-muted);cursor:help;}
@media(prefers-reduced-motion:reduce){#sv-ask-panel,#sv-ask-panel *{animation:none !important;transition:none !important;}.sv-chart svg .sv-cline,.sv-chart svg .sv-carea,.sv-chart svg .sv-cdot,.sv-chart .sv-cbar{animation:none !important;}}
`;
        document.head.appendChild(st);
    }
    // Feather-style icon (SVG via currentColor) for the hero findings — replaces emoji, which
    // violate the design language and render inconsistently across the colleagues' machines.
    function _ficon(n) {
        const p = {
            zap:      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
            edit:     '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
            activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
            circle:   '<circle cx="12" cy="12" r="9"/>',
            star:     '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>'
        }[n] || '';
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
    }
    // Animated "thinking" indicator (three bouncing dots) - better feedback than static text.
    function _thinkingHtml(text) {
        const dot = function (d) { return '<span style="width:6px;height:6px;border-radius:50%;background:var(--primary);display:inline-block;animation:sv-bounce 1s infinite ' + d + ';"></span>'; };
        return '<div style="display:flex;align-items:center;gap:9px;padding:6px 0;font-size:0.85rem;color:var(--color-text-muted);"><span style="display:inline-flex;gap:4px;align-items:flex-end;">' + dot('0s') + dot('.15s') + dot('.3s') + '</span><span>' + esc(text || 'Thinking') + '</span></div>';
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
                : fmt(p.s.impressions) + ' impr · ' + _ctrTxt(p.s.ctr) + ' CTR';
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
                '<span style="color:var(--color-text-secondary);white-space:nowrap;flex-shrink:0;">' + fmt(x.rollup.impressions) + ' impressions · ' + _ctrTxt(x.rollup.ctr) + ' CTR' + (hasGA4 ? ' · ' + fmt(x.rollup.pageViews) + ' views' : '') + '</span>' +
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
                    metric('CTR', _ctrTxt(d.ctr)) +
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
                    '<div class="sv-dd-sec-rows">' + (lowCtr.length ? lowCtr.map(function (p) { return naRow(p.name, '', fmt(p.s.impressions) + ' impr &middot; ' + _ctrTxt(p.s.ctr) + ' CTR', p.url); }).join('') : emptyNote('Nothing flagged \u2014 CTR looks healthy.')) + '</div>' +
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
    // NAVIGATIONAL queries: people typing a service/brand name to REACH a specific site (mywelfare, mygovid, revenue.ie).
    // Their low CTR isn't a snippet problem, it's users correctly skipping us for the service - so "+N clicks if top-3" is
    // clicks that were never ours to win. A short, site-specific known-terms list (B8); flag, don't price. Tune per site.
    const _NAV_TERMS = ['mywelfare', 'my welfare', 'mygovid', 'my govid', 'revenue.ie', 'gov.ie', 'welfare.ie', 'ros.ie', 'motortax', 'motor tax online', 'basi.ie', 'coru', 'coru.ie', 'hse.ie', 'eircode', 'eircode finder', 'eircode.ie'];
    function _isNavigational(q) {
        const s = String(q || '').toLowerCase().replace(/\s+/g, ' ').trim();
        return _NAV_TERMS.some(function (t) {
            if (t.indexOf('.') >= 0 || t.indexOf(' ') >= 0) return s.indexOf(t) >= 0;   // domains / phrases: substring match
            return new RegExp('\\b' + t + '\\b').test(s);                                // bare tokens (coru, mywelfare): whole-word only, so "corundum" is not navigational
        });
    }
    // Single source of truth for per-query opportunity scoring (used by buildQueryIndex
    // AND the page_queries "quick wins" view). potential = clicks left on the table vs a
    // top-3 benchmark; label keyed on best position. Keep both callers in sync via this.
    function _scoreQuery(impressions, clicks, bestPos) {
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const potential = impressions * Math.max(0, _ctrBenchmark(3) - ctr);
        // A near-zero CTR at a strong rank on real impressions means the CLICK figure is unreliable (attribution
        // split / redirect), so `potential` is fictional upside, not a real opportunity. Flag it (A7 systemic fix:
        // the cliff guard reaches the opportunity engine) so callers can demote/annotate rather than rank it #1.
        const artifact = _ctrCliff(bestPos, ctr, impressions);
        let label = null;
        if (bestPos != null) {
            if (bestPos <= 4.5) label = 'Fix title/snippet';
            else if (bestPos <= 20) label = 'Striking distance';
            else label = 'Build content';
        }
        if (artifact) label = 'Investigate first (CTR unreliable)';
        return { ctr: ctr, potential: potential, label: label, artifact: artifact };
    }
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
            const pos = e._posW > 0 ? e._posSum / e._posW : null;
            const sc = _scoreQuery(e.impressions, e.clicks, e.bestPos);
            const nav = _isNavigational(e.query);
            out.push({ query: e.query, impressions: e.impressions, clicks: e.clicks, ctr: sc.ctr,
                       position: pos, bestPos: e.bestPos, bestPage: e.bestPage,
                       category: cat, potential: sc.potential, label: nav ? 'Navigational (likely not winnable)' : sc.label, artifact: sc.artifact, navigational: nav });
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

    // Prior-period query rows (the window immediately before the current one) for the
    // 'emerging' diff. Same shape as getQueryRows but offset back by `days`.
    const _priorQueryCache = {};   // days -> Promise<rows[]>
    function getPriorQueryRows(days) {
        days = days || 30;
        if (_priorQueryCache[days]) return _priorQueryCache[days];
        const gsc = window.GSCIntegration;
        if (!gsc || !gsc.isConnected || !gsc.isConnected() || typeof gsc.fetchAllQueries !== 'function') {
            return Promise.resolve(null);
        }
        _priorQueryCache[days] = gsc.fetchAllQueries({ days: days, offset: days })
            .then(function (rows) { if (!rows || !rows.length) delete _priorQueryCache[days]; return rows || []; })
            .catch(function (e) { delete _priorQueryCache[days]; throw e; });
        return _priorQueryCache[days];
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
    // Source-by-page (GA4): sessions per pagePath x source x channel, cached per (days:offset).
    // We classify sources into buckets in OUR code (retroactive + AI-aware), not GA4's native channel.
    const _sourcesCache = {};   // "days:offset" -> Promise<{byPage:Map, truncated:bool}>
    function getSourcesByPage(days, offset) {
        days = days || 30; offset = offset || 0;
        const key = days + ':' + offset;
        if (_sourcesCache[key]) return _sourcesCache[key];
        const ga4 = window.GA4Integration;
        if (!ga4 || !ga4.isConnected || !ga4.isConnected() || typeof ga4.fetchSourcesByPage !== 'function') return Promise.resolve(null);
        _sourcesCache[key] = ga4.fetchSourcesByPage({ days: days, offset: offset })
            .then(function (d) { if (!d || !d.byPage || !d.byPage.size) { delete _sourcesCache[key]; return null; } return d; })
            .catch(function (e) { delete _sourcesCache[key]; throw e; });
        return _sourcesCache[key];
    }
    // Deterministic source classifier. Retroactive (source was always recorded) and AI-aware —
    // GA4's native "AI" channel is forward-only from mid-2026 and misses Perplexity etc. Extend
    // AI_ANY as new assistants launch. Buckets: Google search / Other search / AI assistants /
    // AskCI chatbot / Facebook / Other social / Email / Direct / Other referral.
    const AI_ANY = /(chatgpt|openai|claude\.ai|anthropic|perplexity|gemini|bard\.google|copilot|deepseek|meta\.ai|grok|x\.ai|you\.com|poe\.com|phind)/i;
    const AI_ASSISTANTS = [
        { name: 'ChatGPT', re: /(chatgpt|openai)/i }, { name: 'Claude', re: /(claude\.ai|anthropic)/i },
        { name: 'Perplexity', re: /perplexity/i }, { name: 'Gemini', re: /(gemini|bard\.google)/i },
        { name: 'Copilot', re: /copilot/i }, { name: 'DeepSeek', re: /deepseek/i },
        { name: 'Meta AI', re: /meta\.ai/i }, { name: 'Grok', re: /(grok|x\.ai)/i }
    ];
    // Specific assistant name for a source already classified as 'AI assistants' (else 'Other AI').
    function _aiName(source) {
        const s = String(source || '');
        for (let i = 0; i < AI_ASSISTANTS.length; i++) { if (AI_ASSISTANTS[i].re.test(s)) return AI_ASSISTANTS[i].name; }
        return 'Other AI';
    }
    function classifySource(source, channel) {
        const s = String(source || '').toLowerCase(), ch = String(channel || '');
        if (/ask[\s_-]?ci/.test(s)) return 'AskCI chatbot';
        if (AI_ANY.test(s)) return 'AI assistants';
        if (s === '(direct)' || s === '(none)' || s === '(not set)' || s === '' || ch === 'Direct') return 'Direct';
        if (/(facebook|(^|\.)fb\.|(^|\.)fb$|instagram|l\.facebook|m\.facebook|lm\.facebook)/.test(s)) return 'Facebook';
        if (ch === 'Organic Social' || ch === 'Paid Social' || /(twitter|(^|\.)x\.com|t\.co|linkedin|lnkd\.in|reddit|youtube|tiktok|pinterest|whatsapp|telegram|bsky|mastodon)/.test(s)) return 'Other social';
        if (ch === 'Email' || /(newsletter|mailchimp|sendgrid|(^|\.)mail\.|e?mail|campaign-archive)/.test(s)) return 'Email';
        if (/google/.test(s)) return 'Google search';
        if (/(bing|duckduckgo|(^|\.)yahoo|ecosia|baidu|yandex|brave|startpage|qwant)/.test(s) || ch === 'Organic Search') return 'Other search';
        return 'Other referral';
    }
    // Map a user term ("AI", "ChatGPT", "Facebook", "google", "askci", or a raw source) to a matcher
    // over source-rows: returns {label, pred, isAI}. Per-assistant when a specific assistant is named.
    function _sourceMatcher(term) {
        const t = String(term || '').trim().toLowerCase();
        if (!t) return null;
        for (let i = 0; i < AI_ASSISTANTS.length; i++) { if (AI_ASSISTANTS[i].name.toLowerCase() === t || AI_ASSISTANTS[i].re.test(t)) { const a = AI_ASSISTANTS[i]; return { label: a.name, isAI: true, pred: function (rw) { return a.re.test(String(rw.source || '')); } }; } }
        if (/^(ai|ai assistants?|ai traffic|ai search|llm|llms|chatbots?|ai referr)/.test(t)) return { label: 'AI assistants', isAI: true, pred: function (rw) { return classifySource(rw.source, rw.channel) === 'AI assistants'; } };
        if (/ask[\s_-]?ci/.test(t)) return { label: 'AskCI chatbot', pred: function (rw) { return /ask[\s_-]?ci/i.test(String(rw.source || '')); } };
        const BUCKETS = { facebook: 'Facebook', fb: 'Facebook', meta: 'Facebook', social: null, google: 'Google search', 'google search': 'Google search', search: null, email: 'Email', newsletter: 'Email', direct: 'Direct', referral: 'Other referral' };
        if (t === 'social') return { label: 'social', pred: function (rw) { const b = classifySource(rw.source, rw.channel); return b === 'Facebook' || b === 'Other social'; } };
        if (t === 'search') return { label: 'search', pred: function (rw) { const b = classifySource(rw.source, rw.channel); return b === 'Google search' || b === 'Other search'; } };
        if (t === 'organic') return { label: 'Organic search', pred: function (rw) { return /organic/i.test(rw.channel); } };
        if (t === 'paid') return { label: 'Paid', pred: function (rw) { return /paid|cpc|display/i.test(rw.channel); } };
        if (BUCKETS[t]) { const b = BUCKETS[t]; return { label: b, pred: function (rw) { return classifySource(rw.source, rw.channel) === b; } }; }
        return { label: term, pred: function (rw) { return String(rw.source || '').toLowerCase().indexOf(t) > -1; } };   // raw source substring
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
    // Build the world map from already-aggregated rows ({country: NAME, impressions}) —
    // used by the expand modal (which only has the answer's data, not the raw query rows).
    function _worldMapFromRows(rows, opts) {
        if (typeof d3 === 'undefined' || !d3.geoNaturalEarth1 || !window.SVGeoMap || typeof window.SVGeoMap.initWorld !== 'function') return '';
        const cs = (rows || []).filter(function (x) { return (x.impressions || 0) > 0 && x.country; });
        if (!cs.length) return '';
        const total = cs.reduce(function (s, x) { return s + (x.impressions || 0); }, 0) || 1;
        const mapData = cs.map(function (x) { return { country: x.country, value: x.impressions || 0, percentage: (x.impressions || 0) / total * 100 }; });
        const uid = 'sv-qgeo-' + (++_geoUid);
        window.__svGeoData = window.__svGeoData || {};
        window.__svGeoData[uid] = mapData;
        const h = (opts && opts.big) ? 460 : 400;
        return '<div style="margin:0 0 10px;"><div class="sv-choropleth-wrap" style="height:' + h + 'px;"><svg id="' + uid + '" class="sv-choropleth"></svg><div id="' + uid + '-tip" class="sv-choropleth-tip"></div></div>' +
            '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="" style="display:none" onload="window.SVGeoMap &amp;&amp; window.SVGeoMap.initWorld(\'' + uid + '\', {valueLabel:\'searches\'})"></div>';
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
    function _mfmt(s, m) { return m === 'ctr' ? _ctrTxt(s.ctr) : (m === 'position' ? (s.position != null ? s.position.toFixed(1) : '—') : fmt(s[m] || 0)); }
    const _MLABEL = { impressions: 'impressions', clicks: 'clicks', ctr: 'CTR', position: 'avg position', pageViews: 'views', users: 'users', __overlay: 'overlay' };
    // Canonical intent -> interpretation-chip label registry (one source; used by ask()).
    // Build stamp (C1): every answer carries it, so a paste can be traced to the exact build - fixes were landing mid-run
    // and verdicts could not be tied to a version. BUMP THIS with the index.html ?v= each deploy.
    const _BUILD = '20260904z23';
    const _ILBL = { rank_categories: 'rank categories', section_summary: 'category summary', top_pages: 'top pages', low_ctr: 'low-CTR pages', stale: 'stale pages', movers: 'movers', site_summary: 'site summary', compare: 'compare categories', opportunities: 'search opportunities', top_queries: 'top search queries', international_queries: 'searches from abroad', top_countries: 'top countries', trend: 'trend over time', diagnose: 'page diagnosis', questions: 'questions asked', language_gap: 'English vs Irish', cannibalisation: 'page cannibalisation', briefing: 'priorities', page_queries: 'queries for a page', digest: 'weekly digest', dead_pages: 'zero-traffic pages', page_summary: 'page performance', content_gaps: 'content gaps', section_movers: 'category movers', emerging: 'emerging searches', recently_updated: 'recently updated', abandoned: 'low engagement', seasonal: 'seasonality (vs last year)', traffic_sources: 'traffic sources', ai_impact: 'AI impact', ai_exposed: 'AI exposure', compare_periods: 'period comparison', artifact_pages: 'tracking artifacts' };
    // Which answers light up the tree, and in what tone. null = no tree highlight (non-spatial
    // intents like trend / rank_categories / traffic_sources). Movers is handled separately (it
    // splits red-fallers / teal-risers). Single-page focus (diagnose/page_summary) is a fast-follow.
    function _toneFor(intent) {
        if (intent === 'dead_pages') return 'grey';
        if (intent === 'opportunities' || intent === 'top_pages' || intent === 'low_ctr' ||
            intent === 'briefing' || intent === 'recently_updated') return 'teal';
        return null;
    }

    // Ask parse system prompt — STATIC (built once, so it caches on Groq and never varies per call).
    const _ASK_SYS_PROMPT = 'You turn a question about website analytics into a JSON query. Reply with ONLY a JSON object, no prose, no code fences. ' +
                    'Schema: {"intent": one of ["rank_categories","section_summary","top_pages","low_ctr","stale","movers","site_summary","compare","opportunities","top_queries","international_queries","top_countries","trend","diagnose","questions","language_gap","cannibalisation","briefing","page_queries","digest","dead_pages","page_summary","content_gaps","section_movers","emerging","recently_updated","abandoned","seasonal","traffic_sources","ai_impact","ai_exposed","compare_periods","artifact_pages","unknown"], ' +
                    '"category": exact section name from the list or null, "categories": [two section names] for compare or trend, "country": a country name for international_queries (or null for all-abroad), "page": a page name for the diagnose/page_queries intents (or null), "by_potential": true only when asking what a page should target / quick wins for a page (else omit), "days": integer window in days for recently_updated (e.g. 90 for "last 90 days", 30 for "last month"; default 90), "yoy": true when the user asks if a change is seasonal / vs last year (else omit), "periodA": first period phrase and "periodB": second period phrase for compare_periods (e.g. "this month","last month","last 90 days","the previous 90 days","q1","q2"); "source": for traffic_sources: a source, AI assistant, or bucket the question names - e.g. "AI" / "ChatGPT" / "Claude" / "Perplexity" / "Facebook" / "google" / "askci" / a newsletter (else omit), "growth": true when they ask if a source is GROWING / how it has grown over time (else omit), ' +
                    '"metric": one of ["impressions","clicks","ctr","position","pageViews","users"] (default impressions), ' +
                    '"direction": "up"|"down"|"both", "aspect": one of ["overview","takes","ctr"] for the ai_impact intent (default overview), "remainder": if the question asks for MORE than the chosen intent answers (a compound like "top pages and their engagement and compare with Housing"), a SHORT standalone question for the most important unanswered part (else omit), "limit": number (default 6)}. ' +
                    'Mapping: views->pageViews; traffic->impressions; lost/dropped/falling/down->intent movers direction down; rising/gained/up->direction up; ' +
                    'most viewed->top_pages metric pageViews; low CTR / seen but not clicked->low_ctr; out of date / old->stale; how is X doing->section_summary; ' +
                    'which sections/categories perform best / rank the sections / rank the categories / best and worst sections / which sections or categories get the most traffic / section or category league table->rank_categories; ' +
                    'how is the whole site doing / overall / site-wide totals / the big picture / how are we doing overall->site_summary; ' +
                    'compare X and Y / X versus Y / how does X compare to Y (side by side, current period)->compare with categories [X,Y] (use trend only if they explicitly say over time/history); ' +
                    'opportunities / quick wins / missing out / losing clicks / could win more->opportunities; ' +
                    'what do people search for / search terms / top searches / queries / keywords->top_queries (metric clicks only if they say clicks); ' +
                    'from abroad / overseas / internationally / the diaspora / emigrants / people outside Ireland->international_queries with country null; ' +
                    'from a named place / what does X search us for / what do people in X search for (the US / Australia / Britain / Mexico)->international_queries with country set to that country name; ' +
                    'which countries / where are searchers from / top countries->top_countries; ' +
                    'how has X trended / over time / trend / history / over the last months / month by month->trend (category optional; metric impressions/clicks/views); trend of X vs Y / compare X and Y over time->trend with categories [X,Y]; ' +
                    'what PAGES are trending / which pages are rising or growing or gaining or climbing / top rising pages / biggest movers / which pages are up or down / what pages are moving in X->movers (page-level; direction up for trending/rising/growing, down for falling/dropping, both otherwise; category optional). IMPORTANT: trend draws ONE line over time for a whole section/site; use movers when the user asks WHICH PAGES changed (e.g. "what pages are trending in Environment" is movers, NOT trend); reserve trend for "over time / history / trended / month by month". ' +
                    'why is X underperforming / why is X down / why is the X page underperforming / what is wrong with X / diagnose X / why is X not getting clicks->diagnose with page set to X (the page named, even a long multi-word name); ' +
                    'what questions do people ask / what are people asking / question searches / common questions->questions (category optional); ' +
                    'Irish vs English / as Gaeilge / language gap / where does the Irish version underperform / English vs Irish->language_gap; ' +
                    'cannibalisation / cannibalization / pages competing / competing pages / self-competition / multiple pages ranking for the same search->cannibalisation (category optional); ' +
                    'what should I focus on / what should I work on / my priorities / where should I focus / where do I start / what needs attention / section briefing / triage->briefing (category optional). Prefer briefing when the user asks what to DO; prefer section_summary when they ask how a section is DOING; ' +
                    'what queries bring people to X / what searches lead to X / what do people search to find X / how do people find the X page / queries for the X page->page_queries with page set to X (a specific PAGE, not a section); what should the X page target / quick wins for the X page / how do we improve X in search->page_queries with page X and by_potential true; ' +
                    'weekly digest / generate a digest / digest for all sections / all owners priorities / everyone\'s priorities->digest (a site-wide roll-up of each section\'s priorities); a digest / briefing for ONE named section->briefing with that category; ' +
                    'which pages get no traffic / no search traffic / zero impressions / nobody finds / orphaned / invisible / dead pages->dead_pages (category optional); ' +
                    'how is the X page performing / how is X doing (when X is a PAGE) / X page performance / page views for X / stats for the X page / how many views does X get->page_summary with page X (use this, not section_summary, when X is a specific page rather than a section); what content should we create / content gaps / what should we write / where do we have no good page / high demand we rank poorly for->content_gaps (category optional); which sections/categories are growing / declining / rising / biggest section or category movers / how are sections or categories trending->section_movers (direction up/down/both); what is newly trending / new searches this / emerging or rising queries / what is growing in search / what is people newly searching->emerging (category optional); how are pages we updated / edited / changed doing / what pages were updated recently / recently updated or refreshed pages / pages updated in the last N days or months->recently_updated (set days to the window, category optional); leave quickly / bounce / bouncing / low engagement / found but not read / people arrive but leave->abandoned (category optional); is this normal / is this seasonal / seasonal / vs last year / compared to last year / same time last year / year on year->seasonal yoy true (page or category optional; it compares current vs previous period AND vs the same period last year); where do visitors come from / where does traffic to X come from / traffic sources / how do people get to X / which channels / channel breakdown / organic vs direct->traffic_sources (page or category optional); which pages does X send / drive / bring (X = a source, an AI assistant like ChatGPT, or a bucket like social/paid/organic)->traffic_sources with source X; how many from X / how much traffic from X / sessions from X / how many to the Y page from X (X = a NAMED source like AI, ChatGPT, Facebook, google, askci)->traffic_sources with source X (and page Y if a specific page is named); how much traffic from AI / how much of X is AI->traffic_sources source AI; is AI (or ChatGPT/etc) traffic growing / how has AI traffic grown / is AI traffic rising->traffic_sources with source AI and growth true (distinct from emerging/rising_queries which are about SEARCH QUERIES, not traffic sources); compare X from A and B / X: A vs B / how did X do in A vs B / X this month vs last month / compare X between two periods->compare_periods with page OR category (the scope) and periodA + periodB (relative period phrases like this month / last month / last 90 days / the previous 90 days / q1 / q2). Distinct from compare (two SECTIONS side by side, one period) and seasonal (current vs previous vs same-time-last-year). what is AI doing to us / AI impact / impact of AI / are we losing clicks to AI / zero-click / see but do not click->ai_impact aspect "overview"; how many clicks is AI or Google Overviews taking / clicks lost to AI / what are AI Overviews costing us->ai_impact aspect "takes"; is our click-through rate falling / CTR trend / is CTR dropping->ai_impact aspect "ctr"; which pages is Google answering for / which of my pages are exposed to AI / pages losing clicks to AI / exposed pages / AI exposure in X->ai_exposed (category optional; the SCOPED per-page exposed list). which pages have tracking or measurement or attribution issues / artifact pages / pages with near-zero clicks at a top rank / which pages are dragging CTR / pages with a redirect or canonical split->artifact_pages (category optional; the pages whose clicks look mis-attributed, distinct from ai_exposed). (ai_impact is the whole-site AI verdict, ai_exposed is the per-page list; both distinct from traffic_sources, which is "how much traffic FROM a named source". Use traffic_sources for "traffic from AI" / "is AI traffic growing".) If nothing fits, use intent "unknown" - never force the closest match. Examples: "how did Health do this month vs last month"->{"intent":"compare_periods","category":"Health","periodA":"this month","periodB":"last month"} ; "which pages does ChatGPT send people to"->{"intent":"traffic_sources","source":"ChatGPT"} ; "what pages are trending in Housing"->{"intent":"movers","category":"Housing","direction":"up"} ; "why is the fuel allowance page not getting clicks"->{"intent":"diagnose","page":"fuel allowance"} ; "what is the capital of France"->{"intent":"unknown"}.';
    // Integrity check (cheap insurance): a corrupted/truncated prompt breaks routing silently.
    try { if (_ASK_SYS_PROMPT.length < 8000 || _ASK_SYS_PROMPT.indexOf('never force the closest match') < 0) { if (typeof console !== 'undefined') console.error('[SVRollup] Ask system prompt looks truncated/corrupted (' + _ASK_SYS_PROMPT.length + ' chars) - routing will be unreliable.'); } } catch (e) {}

    function _rankCard(items, opts) {
        opts = opts || {};
        if (!items.length) return '<div style="font-size:0.85rem;color:var(--color-text-muted);">No results.</div>';
        const max = Math.max.apply(null, items.map(function (it) { return Math.abs(it.bar || 0); }).concat([1]));
        // Labelled header so the numbers say WHAT they are (name column + value column).
        // Label the trajectory column with its METRIC when sparklines are present (C3): the line sits beside CTR and is read
        // as CTR-over-time, but it is IMPRESSIONS - three words retire that misreading (esp. a rising line on a low-CTR row).
        const _hasSpark = items.some(function (it) { return it.spark && it.spark.length >= 2; });
        const _trackHdr = (_hasSpark && opts.trackLabel) ? esc(opts.trackLabel) : '';
        const header = (opts.nameLabel || opts.valueLabel) ? '<div style="display:flex;align-items:center;gap:10px;padding:5px 12px;border-bottom:1px solid var(--color-border-primary);font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);background:var(--color-bg-secondary);">' +
            '<span style="flex:1;min-width:0;">' + esc(opts.nameLabel || '') + '</span><span style="width:96px;flex-shrink:0;text-align:center;">' + _trackHdr + '</span>' +
            '<span style="width:88px;flex-shrink:0;text-align:right;">' + esc(opts.valueLabel || '') + '</span></div>' : '';
        return '<div class="sv-ask-list">' + header +
            items.map(function (it) {
                const bw = Math.min(100, Math.abs(it.bar || 0) / max * 100);
                const col = it.col || 'var(--primary)';
                const tipTxt = esc(String(it.name) + ' - ' + it.val + (opts.valueLabel ? ' ' + opts.valueLabel.toLowerCase() : ''));
                const clickable = it.url ? ' class="sv-ask-page sv-tipel" role="button" tabindex="0" data-url="' + esc(it.url) + '" data-tip="' + tipTxt + '" style="cursor:pointer;"' : ' class="sv-tipel" data-tip="' + tipTxt + '" style=""';
                const trackHtml = (it.spark && it.spark.length >= 2)   // trajectory replaces the magnitude bar (magnitude stays in the number); per-row scale, drama-clamped
                    ? _sparkline(it.spark, { w: 90, h: 18 })
                    : '<span style="display:block;height:6px;background:var(--color-bg-tertiary);border-radius:3px;overflow:hidden;"><span class="sv-ask-bar" style="display:block;height:100%;width:' + bw + '%;background:' + col + ';"></span></span>';
                return '<div' + clickable + ' onmouseover="this.style.background=\'var(--color-bg-tertiary)\'" onmouseout="this.style.background=\'\'"><div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--color-border-primary);font-size:0.85rem;">' +
                    '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-primary);font-weight:600;">' + esc(it.name) + (it.artifact ? ' <span style="color:#d97706;font-weight:400;" title="Near-zero clicks at a top rank, likely a tracking artifact not real performance">&#9888;</span>' : '') + '</span>' +
                    '<span style="width:96px;flex-shrink:0;">' + trackHtml + '</span>' +
                    '<span style="width:88px;flex-shrink:0;text-align:right;font-weight:700;color:' + (it.valCol || 'var(--color-text-primary)') + ';">' + it.val + '</span>' +
                '</div></div>';
            }).join('') + '</div>';
    }
    // Stacked proportion bar (Wave 3): a source split reads in half a second as one 100%-stacked bar
    // (pie/donut refused — the bar wins). Semantic colours per bucket so the language is consistent.
    const _SOURCE_COLORS = { 'Organic Search': '#4285F4', 'Google': '#4285F4', 'AI assistants': '#7c3aed', 'AskCI chatbot': '#0ea5e9', 'Direct': '#9ca3af', 'Social': '#ec4899', 'Email': '#14b8a6', 'Referral': '#f59e0b', 'Paid Search': '#16a34a', 'Paid': '#16a34a', 'Other': '#94a3b8' };
    const _STACK_PALETTE = ['#4285F4', '#7c3aed', '#ec4899', '#14b8a6', '#f59e0b', '#16a34a', '#9ca3af', '#0ea5e9'];
    function _stackColor(name, i) { return _SOURCE_COLORS[name] || _STACK_PALETTE[i % _STACK_PALETTE.length]; }
    function _stackedBar(entries, opts) {
        opts = opts || {};
        const es = (entries || []).filter(function (x) { return (x.value || 0) > 0; });
        if (!es.length) return '';
        const total = es.reduce(function (s, x) { return s + x.value; }, 0) || 1;
        const pctTxt = function (v) { return _pctTxt(v / total); };   // routes through the shared formatter (C5)
        const seg = es.map(function (x, i) { const pct = x.value / total * 100; return '<div class="sv-tipel" data-tip="' + esc(x.label + ': ' + fmt(x.value) + ' (' + pctTxt(x.value) + ')') + '" style="width:' + pct.toFixed(2) + '%;background:' + _stackColor(x.label, i) + ';height:100%;"></div>'; }).join('');
        const legend = es.map(function (x, i) { return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.68rem;color:var(--color-text-secondary);"><span style="width:9px;height:9px;border-radius:2px;flex-shrink:0;background:' + _stackColor(x.label, i) + ';"></span>' + esc(x.label) + ' ' + pctTxt(x.value) + '</span>'; }).join('');
        return '<div style="margin-bottom:12px;"><div style="display:flex;height:16px;border-radius:5px;overflow:hidden;background:var(--color-bg-tertiary);">' + seg + '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:10px 14px;margin-top:7px;">' + legend + '</div></div>';
    }
    // Benchmark encoding (Wave 3): a bare number is a fact; a number against its expectation is a judgement.
    // Fill = actual, tick = the expected-for-position value, colour + data-sentiment hook by above/below.
    function _benchmarkBar(actual, expected, opts) {
        opts = opts || {};
        const a = Number(actual) || 0, e = Number(expected) || 0;
        const max = Math.max(a, e, 1e-9) * 1.15, aPct = Math.min(100, a / max * 100), ePct = Math.min(100, e / max * 100);
        const good = a >= e, col = good ? '#059669' : '#dc2626', vf = opts.fmt || function (v) { return fmt(v); };
        return '<div style="margin-top:8px;">' +
            '<div style="position:relative;height:8px;background:var(--color-bg-tertiary);border-radius:4px;">' +
                '<div style="height:100%;width:' + aPct.toFixed(1) + '%;background:' + col + ';border-radius:4px;"></div>' +
                '<div data-sentiment="' + (good ? 'good' : 'bad') + '" title="' + esc('typical: ' + vf(e)) + '" style="position:absolute;top:-3px;left:' + ePct.toFixed(1) + '%;width:2px;height:14px;background:var(--color-text-heading);"></div>' +
            '</div>' +
            '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:4px;">yours <span style="color:' + col + ';font-weight:700;">' + esc(vf(a)) + '</span> &middot; typical ' + esc(vf(e)) + ' ' + esc(opts.note || 'for this position') + '</div>' +
        '</div>';
    }
    // A near-zero CTR at a strong rank on real impressions is a DATA artifact (redirect / attribution gap),
    // not a content verdict — the AI classifier's cliff vocabulary (_HL_CLIFF*). The benchmark/scorecard must
    // NOT paint it 'below typical' (that judges a tracking bug as the writer's fault). Same pattern the AI
    // Impact report excludes; surfaced here as 'investigate', not a failing grade.
    function _ctrCliff(position, ctr, impressions) {
        return position != null && position <= _HL_CLIFFPOS && (impressions || 0) >= _HL_FLOOR && (ctr || 0) < _HL_CLIFFCTR;
    }
    // IMPRESSION-side sibling of _ctrCliff (B2): a page with a healthy prior that collapses to single/low-double digits
    // hasn't "declined" - its URL has effectively gone dark in search (deindexed / redirected / canonical flipped away).
    // The CTR cliff catches "rank held, clicks vanished"; this catches "impressions vanished wholesale". Same artifact
    // family, opposite metric. Mechanical shape: prior well above the floor, current a rounding error of it.
    // Named thresholds (C2) so the count/list boundary is explicit and tested: a page counts as "gone dark" only when its
    // PRIOR cleared _IMPR_CLIFF_FLOOR (below it is just a small page, noise), now sits under _IMPR_CLIFF_MAX absolute AND
    // under _IMPR_CLIFF_RATIO of prior. This is why a 1.6K -> 1 row looks identical but is not counted (below the floor).
    const _IMPR_CLIFF_FLOOR = 2000, _IMPR_CLIFF_MAX = 20, _IMPR_CLIFF_RATIO = 0.02;
    function _imprCliff(prev, cur) {
        prev = Number(prev) || 0; cur = Number(cur) || 0;
        return prev >= _IMPR_CLIFF_FLOOR && cur < _IMPR_CLIFF_MAX && cur < prev * _IMPR_CLIFF_RATIO;
    }
    // ROLLUP-scale sibling: a section/site CTR silently lies DOWNWARD when a few artifact pages (per _ctrCliff)
    // drag the weighted average. Recompute CTR EXCLUDING them; if that lifts it materially, the rollup is
    // dragged and the surface should say so (so section_summary / compare / rank_categories don't rank on a lie).
    function _rollupArtifacts(pages) {
        let totI = 0, totC = 0, artI = 0, artC = 0; const arts = [];
        (pages || []).forEach(function (p) {
            const s = p.s || {}, i = s.impressions || 0, c = s.clicks || 0; totI += i; totC += c;
            if (_ctrCliff(s.position, s.ctr, i)) { artI += i; artC += c; arts.push(p); }
        });
        const rawCtr = totI > 0 ? totC / totI : 0, exI = totI - artI, exCtr = exI > 0 ? (totC - artC) / exI : rawCtr;
        return { arts: arts, count: arts.length, rawCtr: rawCtr, exCtr: exCtr, dragged: arts.length > 0 && rawCtr > 0 && exCtr >= rawCtr * 1.3 };
    }
    // Movers headline: MAGNITUDE only. A percentage over a DIRECTION-FILTERED top-N (the fallers-only rows) is not a
    // property of anything real - it just reflects which extreme rows dominate the shown sum, so "34.7K lost (down 98%)"
    // reads as "the section lost 98%" when the section lost 11%. Directional -> absolute magnitude, NO delta chip;
    // 'both' -> churn. (Same top-N-share bug B3 closed for shares, in delta clothing.)
    function _moversHeadline(nd, dir, mword) {
        if (!nd || nd.prev <= 0) return null;
        if (dir === 'both') return { value: nd.churn, unit: mword + ' moved across these pages', tier: 'measured' };
        return { value: Math.abs(nd.change), unit: (nd.change >= 0 ? 'gained' : 'lost') + ' ' + mword + ' across these movers', tier: 'measured' };
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
                    fmt(x.impressions) + ' impressions · ' + _ctrTxt(x.ctr) + ' CTR' +
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

    function _relAge(days) {
        if (days == null || isNaN(days)) return '';
        if (days < 1) return 'today';
        if (days < 2) return 'yesterday';
        if (days < 45) return Math.round(days) + ' days ago';
        return Math.round(days / 30.44) + ' months ago';
    }
    // Two-line card for recently-updated pages: name + when-updated on top; impressions /
    // CTR / position + change-vs-prior beneath. Clickable through to the page.
    function _freshCard(rows) {
        if (!rows.length) return '<div style="font-size:0.85rem;color:var(--color-text-muted);">No results.</div>';
        const maxAge = Math.max.apply(null, rows.map(function (x) { return x.age || 0; }).concat([1]));
        return '<div style="border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);">' +
            rows.map(function (x) {
                const fresh = 1 - Math.min(1, (x.age || 0) / maxAge);   // newer -> fuller bar
                const chgTxt = x.chg == null ? '<span style="color:var(--color-text-muted);">no prior data</span>'
                    : (x.chg >= 0 ? '<span style="color:#059669;font-weight:700;">&#9650; ' + x.chg.toFixed(0) + '%</span> vs prior' : '<span style="color:#dc2626;font-weight:700;">&#9660; ' + Math.abs(x.chg).toFixed(0) + '%</span> vs prior');
                const sub = fmt(x.impr) + ' impr · ' + _ctrTxt(x.ctr) + ' CTR' + (x.pos != null ? ' · pos ' + x.pos.toFixed(1) : '') + (x.eng != null ? ' · ' + Math.round(x.eng * 100) + '% engaged' : '') + ' · ' + chgTxt;
                const clickable = x.url ? ' class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(x.url) + '"' : '';
                return '<div' + clickable + ' style="cursor:pointer;padding:8px 12px;border-bottom:1px solid var(--color-border-primary);" onmouseover="this.style.background=\'var(--color-bg-tertiary)\'" onmouseout="this.style.background=\'\'">' +
                    '<div style="display:flex;align-items:center;gap:10px;">' +
                        '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.85rem;font-weight:600;color:var(--color-text-primary);">' + esc(x.name) + '</span>' +
                        '<span style="width:70px;flex-shrink:0;"><span style="display:block;height:6px;background:var(--color-bg-tertiary);border-radius:3px;overflow:hidden;"><span style="display:block;height:100%;width:' + (fresh * 100).toFixed(0) + '%;background:var(--primary);"></span></span></span>' +
                        '<span style="width:84px;flex-shrink:0;text-align:right;font-weight:700;font-size:0.72rem;color:var(--color-text-secondary);">' + esc(_relAge(x.age)) + '</span>' +
                    '</div>' +
                    '<div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:2px;">' + sub + '</div>' +
                '</div>';
            }).join('') + '</div>';
    }

    function _stripCard(rollup, hasGA4, ctrMark) {
        const cell = function (l, v) { return '<div style="flex:1;min-width:66px;padding:8px 10px;border-right:1px solid var(--color-border-primary);"><div style="font-size:0.56rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);">' + l + '</div><div style="font-size:1.05rem;font-weight:700;color:var(--color-text-primary);">' + v + '</div></div>'; };
        // ctrMark flags that this CTR is dragged by artifacts (a * that the caveat below explains) so a cropped tile stays honest (A13).
        const ctrCell = _ctrTxt(rollup.ctr) + (ctrMark ? '<span style="color:#d97706;font-size:0.72rem;" title="Dragged by tracking artifacts, see the note below">*</span>' : '');
        return '<div style="display:flex;flex-wrap:wrap;border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);">' +
            cell('Pages', fmt(rollup.leafCount)) + cell('Impressions', fmt(rollup.impressions)) + cell('Clicks', fmt(rollup.clicks)) +
            cell('CTR', ctrCell) + cell('Avg pos', rollup.position != null ? rollup.position.toFixed(1) : '—') +
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

    // Ranked page-name matches (exact > name-contains-ref > ref-contains-name > all-words-present),
    // tie-broken by traffic. Substring/word matching only, in the spirit of _catByName - no embeddings.
    function _pagesByNameScored(r, ref) {
        const k = String(ref || '').toLowerCase().trim().replace(/\s+page$/, '').replace(/^the\s+/, '');
        if (!k) return [];
        const words = k.split(/\s+/).filter(Boolean);
        const scored = [];
        _allPages(r).forEach(function (p) {
            const pn = String(p.name || '').toLowerCase();
            let score = 0;
            if (pn === k) score = 100;
            else if (pn.indexOf(k) >= 0) score = 70;
            else if (pn.length >= 4 && k.indexOf(pn) >= 0) score = 55;
            else if (words.length && words.every(function (w) { return pn.indexOf(w) >= 0; })) score = 40;
            if (score > 0) scored.push({ page: p, score: score + Math.min(9, (p.s.impressions || 0) / 5000) });
        });
        scored.sort(function (a, b) { return b.score - a.score; });
        return scored;
    }
    // Resolution policy: 1 match -> proceed; strong/dominant top -> proceed; else disambiguate.
    function _resolvePage(r, ref) {
        const scored = _pagesByNameScored(r, ref);
        if (!scored.length) return { none: true };
        if (scored.length === 1) return { page: scored[0].page };
        const top = scored[0], second = scored[1];
        if (top.score >= 100 || (top.score - second.score) >= 25) return { page: top.page };
        return { candidates: scored.slice(0, 6).map(function (x) { return x.page; }) };
    }
    // "Did you mean:" list - a question PAUSED mid-resolution, not an answer. Each candidate re-runs the SAME intent
    // (data-intent) with the RESOLVED page (data-page), dispatched STRUCTURALLY by the .sv-ask-disambig handler - so a
    // page_summary disambig can never be mis-templated into a diagnose question (the A8 click-contract bug). No
    // follow-up chips are grown from a disambig (nothing has been answered yet).
    function _disambig(intent, candidates, ref) {
        return '<div style="font-size:0.85rem;color:var(--color-text-secondary);margin-bottom:8px;">A few pages match "' + esc(ref) + '". Did you mean:</div>' +
            '<div style="display:flex;flex-direction:column;gap:6px;">' + candidates.map(function (p) {
                return '<button class="sv-ask-chip sv-ask-chip-row sv-ask-disambig" data-intent="' + esc(intent) + '" data-page="' + esc(p.name) + '" style="display:flex;flex-direction:column;gap:2px;padding:8px 11px;">' +
                    '<span style="font-weight:600;font-size:0.82rem;">' + esc(p.name) + '</span>' +
                    '<span style="font-size:0.68rem;color:var(--color-text-muted);">' + esc(_shortUrl(p.url)) + ' &middot; ' + fmt(p.s.impressions || 0) + ' impr</span>' +
                '</button>';
            }).join('') + '</div>';
    }
    // Display-only readable question for the transcript bubble when a did-you-mean candidate is clicked (routing uses
    // the structured _forcedPlan, so this phrasing never needs to round-trip through the parser).
    function _disambigQ(intent, name) {
        switch (intent) {
            case 'page_summary': return 'How is ' + name + ' doing?';
            case 'diagnose': return 'Why is ' + name + ' underperforming?';
            case 'page_queries': return 'What queries bring people to ' + name + '?';
            case 'compare_periods': return 'Compare ' + name + ' over two periods';
            case 'traffic_sources': return 'Where does traffic to ' + name + ' come from?';
            case 'seasonal': return 'Is ' + name + ' seasonal?';
            default: return name;
        }
    }
    // Honest not-found: whoever reaches this branch holds a page that does NOT exist or a concept the site words
    // differently (a genuine typo of a real page hits the did-you-mean instead). So the recovery is a concept/coverage
    // search, not "spell it better" (A9). The example is pulled from LIVE data (a prominent real page), never hardcoded
    // (the MABS/CIB rule), and the dead-end is logged via missTag so page_not_found is its own demand signal (distinct
    // from unknown / parse_error / calendar_period). One helper, so all page intents give the same honest message.
    function _pageNotFound(ref, r) {
        let eg = 'Fuel Allowance';
        try { const top = _allPages(r).filter(function (p) { return (p.s.impressions || 0) > 0; }).sort(function (a, b) { return (b.s.impressions || 0) - (a.s.impressions || 0); })[0]; if (top && top.name) eg = top.name; } catch (e) {}
        return { html: '', summary: '', err: 'I could not find a page called ' + (ref ? '"' + ref + '"' : 'that') + '. It may not exist, or the site may word the topic differently. If you are after a topic, try "what content should we create" or "what do people search for" to see how the site covers it. If it is a specific page, name it as it appears in the sitemap (for example "' + eg + '").', missTag: 'page_not_found' };
    }
    // The SCOPE segment of the interpretation chip. Rule 5 says the chip shows what was RESOLVED, not what was
    // requested - so it prefers res.scope (what runIntent ACTUALLY used) over the plan. This is the structural fix for
    // the chip-lies-about-scope class (A2 seasonal dropped it, A10 international ignored-but-displayed it): a handler
    // whose scope handling diverges from the plan returns res.scope = { label, country }, and the chip renders THAT.
    function _interpScope(plan, sc, res) {
        const out = [];
        if (res && res.scope) {                        // handler declared the scope it actually used - AUTHORITATIVE, so the
            if (res.scope.label) out.push(res.scope.label + (sc && sc.oneShot ? ' (this question only)' : ''));   // chip cannot show a scope the answer
            if (res.scope.country) out.push(res.scope.country); // did not use; keep the one-shot annotation. (Do NOT also push plan.page - res.scope.label carries the resolved name.)
            return out;
        }
        if (plan.categories && plan.categories.length) out.push(plan.categories.join(' vs '));
        else if (sc && sc.unscoped) out.push('whole site');
        else if (plan.category) out.push(plan.category + (sc && sc.oneShot ? ' (this question only)' : ''));
        else if (!plan.page) out.push('whole site');
        if (plan.country) out.push(plan.country);
        if (plan.page) out.push(plan.page);
        return out;
    }

    // ── keyword cannibalisation: 2+ of your own pages competing for one query ──
    function _shortUrl(u) { return String(u || '').replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'; }
    // normUrl(url) -> merged logical page name; collapses EN/GA twins (same merged name).
    function _urlToPageName(r) {
        const map = Object.create(null);
        _allPages(r).forEach(function (p) {
            const nm = String(p.name || '').toLowerCase();
            (p.urls || [p.url]).forEach(function (u) { if (u) map[normUrl(u)] = nm; });
        });
        return map;
    }
    // A query is cannibalised when >=2 of your DISTINCT LOGICAL pages each take a real
    // share of it. EN/GA twins collapse to one logical page (by merged name) so language
    // pairs aren't false positives. Named thresholds - tune against real data.
    const CANNIBAL_MIN_TOTAL = 100;   // query needs real demand
    const CANNIBAL_MIN_SHARE = 0.20;  // each competing page needs >=20% of the query's impressions
    // 'abandoned' thresholds (tunable): a page needs enough sessions for a reliable rate,
    // and its engagement must fall below this fraction of the cohort median to be flagged.
    const ABANDON_MIN_SESSIONS = 20;
    const ABANDON_RATIO = 0.7;
    function _cannibalisation(rows, keepCat, urlCat, urlToName) {
        urlToName = urlToName || {};
        const byQ = {};
        rows.forEach(function (row) {
            const q = row.query, p = row.page;
            if (!q || !p) return;
            if (keepCat && (urlCat[normUrl(p)] || null) !== keepCat) return;
            const key = urlToName[normUrl(p)] || normUrl(p);   // collapse EN/GA into one logical page
            if (!byQ[q]) byQ[q] = { query: q, pages: {}, total: 0 };
            const e = byQ[q];
            if (!e.pages[key]) e.pages[key] = { url: p, _bestImp: -1, impressions: 0, clicks: 0, _ps: 0, _pw: 0 };
            const pg = e.pages[key], imp = row.impressions || 0;
            pg.impressions += imp; pg.clicks += row.clicks || 0;
            if (imp > 0 && (row.position || 0) > 0) { pg._ps += row.position * imp; pg._pw += imp; }
            if (imp > pg._bestImp) { pg._bestImp = imp; pg.url = p; }   // representative = highest-traffic variant
            e.total += imp;
        });
        const out = [];
        Object.keys(byQ).forEach(function (q) {
            const e = byQ[q];
            if (e.total < CANNIBAL_MIN_TOTAL) return;
            const pages = Object.keys(e.pages).map(function (k) { const pg = e.pages[k]; return { url: pg.url, impressions: pg.impressions, clicks: pg.clicks, position: pg._pw > 0 ? pg._ps / pg._pw : null, share: e.total > 0 ? pg.impressions / e.total : 0 }; })
                .filter(function (pg) { return pg.share >= CANNIBAL_MIN_SHARE; })
                .sort(function (a, b) { return b.impressions - a.impressions; });
            if (pages.length < 2) return;
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
                    '<span style="flex-shrink:0;color:var(--color-text-muted);">' + fmt(p.impressions) + ' impr &middot; ' + Math.round((p.share || 0) * 100) + '% &middot; #' + (p.position != null ? p.position.toFixed(0) : '-') + '</span>' +
                '</div>';
            }).join('');
            return '<div style="border:1px solid var(--color-border-primary);border-radius:10px;background:var(--color-bg-primary);padding:10px 12px;margin-bottom:10px;">' +
                '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:3px;"><span style="flex:1;min-width:0;font-weight:700;font-size:0.85rem;color:var(--color-text-primary);">' + esc(it.query) + '</span>' +
                '<span style="flex-shrink:0;font-size:0.68rem;font-weight:700;color:#d97706;">' + it.competing + ' pages competing</span></div>' +
                '<div style="font-size:0.66rem;color:var(--color-text-muted);margin-bottom:4px;">' + fmt(it.total) + ' impressions at stake</div>' +
                pagesHtml + '</div>';
        }).join('');
    }

    // ── deterministic SVG charts: intent -> chart is decided in code, never by the LLM.
    // All charts are SVG (exportable as PNG, hover-tooltip-able, expandable). Bars/points
    // carry class="sv-tipel" data-tip="..." for the delegated tooltip; clickable page bars
    // also carry class="sv-ask-page" data-url="...".
    function _svTrunc(s, max) { s = String(s == null ? '' : s); max = Math.max(4, max || 20); return s.length > max ? s.slice(0, max - 1) + '…' : s; }
    // ── SERP ladder (Wave 2): position made spatial. Shared band constants, so the ladder draws the SAME
    // bands the labels and classifier vocabulary use (visual and language never disagree). ──
    const _SERP_TOP3 = 3, _SERP_STRIKE = 20;                     // top 3 / striking distance 4-20 / off page 1 (>20)
    function _serpBand(pos) { if (pos == null || !isFinite(+pos)) return 'off'; if (+pos <= _SERP_TOP3) return 'top3'; if (+pos <= _SERP_STRIKE) return 'strike'; return 'off'; }
    function _chartLadder(data, opts) {
        opts = opts || {};
        const cfg = data.chart || {};
        const posK = cfg.pos || 'position', sizeK = cfg.size || 'impressions', labK = cfg.label || 'query', urlK = cfg.url || null;
        const sizeLabel = cfg.sizeLabel || 'impressions';   // C4: name the size encoding so a dot isn't misread (in an opportunities ladder, size = potential, NOT impressions)
        let rows = (data.rows || []).filter(function (r) { return r[posK] !== '' && r[posK] != null && isFinite(+r[posK]) && +r[posK] > 0; });
        if (!rows.length) return '';
        rows = rows.slice().sort(function (a, b) { return (+b[sizeK] || 0) - (+a[sizeK] || 0); });
        const W = opts.w || (opts.big ? 900 : 440), H = opts.h || (opts.big ? 460 : 330);
        const padT = 16, padB = 16, padL = 12, padR = 96;
        const plotY0 = padT, floorY = H - padB - 8, plotY1 = floorY - 20;
        const yFor = function (pos) { if (+pos > _SERP_STRIKE) return floorY; return plotY0 + (plotY1 - plotY0) * ((Math.max(1, +pos) - 1) / (_SERP_STRIKE - 1)); };
        const uid = 'L' + (++_chartUid), yTop3 = yFor(_SERP_TOP3);
        const bands = '<rect x="' + padL + '" y="' + plotY0 + '" width="' + (W - padL - padR) + '" height="' + (yTop3 - plotY0) + '" fill="rgba(5,150,105,0.09)"/>' +
            '<rect x="' + padL + '" y="' + yTop3 + '" width="' + (W - padL - padR) + '" height="' + (plotY1 - yTop3) + '" fill="rgba(3,105,161,0.05)"/>' +
            '<rect x="' + padL + '" y="' + (floorY - 9) + '" width="' + (W - padL - padR) + '" height="18" fill="rgba(120,120,120,0.10)"/>';
        const blabels = '<text x="' + (W - padR + 6) + '" y="' + (plotY0 + 11) + '" font-size="9" fill="#059669">top 3</text>' +
            '<text x="' + (W - padR + 6) + '" y="' + (yTop3 + 13) + '" font-size="9" fill="#0369a1">striking</text>' +
            '<text x="' + (W - padR + 6) + '" y="' + (yTop3 + 24) + '" font-size="9" fill="#0369a1">4 to ' + _SERP_STRIKE + '</text>' +
            '<text x="' + (W - padR + 6) + '" y="' + (floorY + 3) + '" font-size="9" fill="var(--color-text-muted)">off page 1</text>';
        const CAP = opts.big ? 24 : 12, indiv = rows.slice(0, CAP), rest = rows.slice(CAP);
        const maxSize = Math.max.apply(null, rows.map(function (r) { return +r[sizeK] || 0; }).concat([1]));
        const rFor = function (sz) { return 4 + 12 * Math.sqrt((+sz || 0) / maxSize); };
        const innerW = W - padL - padR - 30, xFor = function (i, n) { return padL + 18 + innerW * (n > 1 ? i / (n - 1) : 0.5); };
        let dots = '', labels = '';
        indiv.forEach(function (r, i) {
            const pos = +r[posK], sz = +r[sizeK] || 0, cx = xFor(i, indiv.length), cy = yFor(pos), rr = rFor(sz);
            const band = _serpBand(pos), col = band === 'top3' ? '#059669' : band === 'strike' ? '#0369a1' : '#9ca3af';
            const tip = esc(String(r[labK]) + ': pos ' + pos.toFixed(1) + ', ' + fmt(sz) + ' ' + sizeLabel);
            const link = (urlK && r[urlK]);
            dots += '<circle class="sv-tipel' + (link ? ' sv-ask-page' : '') + '" data-tip="' + tip + '"' + (link ? ' data-url="' + esc(r[urlK]) + '"' : '') + ' cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + rr.toFixed(1) + '" fill="' + col + '" fill-opacity="0.75" stroke="#fff" stroke-width="1.5" style="cursor:' + (link ? 'pointer' : 'default') + ';"/>';
            if (i < (opts.big ? 12 : 6)) labels += '<text x="' + cx.toFixed(1) + '" y="' + (cy - rr - 3).toFixed(1) + '" font-size="8" text-anchor="middle" fill="var(--color-text-secondary)">' + esc(String(r[labK]).slice(0, 16)) + '</text>';
        });
        let aggNote = '';
        if (rest.length) {
            const byBand = { top3: [], strike: [], off: [] };
            rest.forEach(function (r) { byBand[_serpBand(+r[posK])].push(r); });
            const parts = [];
            ['top3', 'strike', 'off'].forEach(function (b) { const arr = byBand[b]; if (!arr.length) return; const sm = arr.reduce(function (s, r) { return s + (+r[sizeK] || 0); }, 0); parts.push(arr.length + ' more in ' + (b === 'top3' ? 'top 3' : b === 'strike' ? 'striking distance' : 'off page 1') + ' (' + fmt(sm) + ' ' + sizeLabel + ')'); });
            const listId = 'sv-ladder-more-' + uid;
            aggNote = '<div style="font-size:0.68rem;color:var(--color-text-muted);margin-top:4px;cursor:pointer;" onclick="var e=document.getElementById(\'' + listId + '\');if(e)e.style.display=e.style.display===\'none\'?\'block\':\'none\'">' + esc(parts.join(' · ')) + ' &middot; <span style="text-decoration:underline;">show</span></div>' +
                '<div id="' + listId + '" style="display:none;font-size:0.72rem;color:var(--color-text-secondary);margin-top:4px;line-height:1.5;">' + rest.map(function (r) { return esc(String(r[labK]) + ' (pos ' + (+r[posK]).toFixed(1) + ', ' + fmt(+r[sizeK] || 0) + ' ' + sizeLabel + ')'); }).join('<br>') + '</div>';
        }
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;font-family:var(--font-family);max-width:' + W + 'px;">' + bands + blabels + dots + labels + '</svg>' + '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:2px;">Dot size = ' + esc(sizeLabel) + '; height = search rank.</div>' + aggNote;
    }
    // ── Dumbbell (Wave 2): before -> after as two dots joined, so both LEVELS show (delta bars hide them). ──
    function _chartDumbbell(data, opts) {
        opts = opts || {};
        const cfg = data.chart || {};
        const labK = cfg.label || 'label', bK = cfg.before, aK = cfg.after, urlK = cfg.url || null, shared = !!cfg.shared;
        const rows = (data.rows || []).filter(function (r) { return isFinite(+r[bK]) && isFinite(+r[aK]); });
        if (!rows.length) return '';
        const W = opts.w || (opts.big ? 720 : 440), rowH = opts.big ? 32 : 25, padT = 8, padB = 16;
        const labelW = Math.round(W * (opts.big ? 0.24 : 0.28)), valW = opts.big ? 188 : 152, gap = 10;   // wide enough to carry 'B to A ±X%' on every row (the number says what a smudged dot can't)
        const trackW = W - labelW - gap - valW - gap, x0 = labelW + gap;
        const H = rows.length * rowH + padT + padB;
        const sharedMax = shared ? Math.max.apply(null, rows.map(function (r) { return Math.max(Math.abs(+r[bK] || 0), Math.abs(+r[aK] || 0)); }).concat([1])) : null;
        let body = '';
        rows.forEach(function (r, i) {
            const b = +r[bK] || 0, a = +r[aK] || 0, mx = sharedMax != null ? sharedMax : Math.max(Math.abs(b), Math.abs(a), 1);
            const bx = x0 + trackW * Math.min(1, Math.abs(b) / mx), ax = x0 + trackW * Math.min(1, Math.abs(a) / mx);
            const y = padT + i * rowH + rowH / 2, up = a >= b, col = up ? '#059669' : '#dc2626';
            const link = (urlK && r[urlK]);
            const pct = b > 0 ? (a - b) / b * 100 : null;
            const pctTxt = pct != null ? '  ' + (pct >= 0 ? '▲' : '▼') + Math.abs(Math.round(pct)) + '%' : '';   // the delta rides on every row, legible even when the dots collapse to a smudge
            body += '<g' + (link ? ' class="sv-ask-page" data-url="' + esc(r[urlK]) + '" style="cursor:pointer;"' : '') + '><title>' + esc(String(r[labK])) + '</title>' +
                '<text x="' + labelW + '" y="' + (y + 3) + '" font-size="' + (opts.big ? 12 : 10) + '" text-anchor="end" fill="var(--color-text-primary)">' + esc(_ellipMid(r[labK], opts.big ? 40 : 22)) + '</text>' +
                '<line x1="' + Math.min(bx, ax).toFixed(1) + '" y1="' + y + '" x2="' + Math.max(bx, ax).toFixed(1) + '" y2="' + y + '" stroke="' + col + '" stroke-width="2" opacity="0.45"/>' +
                '<circle cx="' + bx.toFixed(1) + '" cy="' + y + '" r="4.5" fill="var(--color-bg-primary)" stroke="var(--color-text-muted)" stroke-width="2"/>' +
                '<circle cx="' + ax.toFixed(1) + '" cy="' + y + '" r="5" fill="' + col + '"/>' +
                '<text x="' + (W - 2) + '" y="' + (y + 3) + '" font-size="' + (opts.big ? 11 : 9) + '" text-anchor="end" fill="' + col + '">' + esc(fmt(b) + ' to ' + fmt(a)) + pctTxt + '</text>' +
            '</g>';
        });
        const leg = '<text x="' + x0 + '" y="' + (H - 3) + '" font-size="8" fill="var(--color-text-muted)">hollow = before, solid = after</text>';
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;font-family:var(--font-family);max-width:' + W + 'px;">' + body + leg + '</svg>';
    }
    // ── Small-multiples of before/after deltas (Wave 3): one self-scaled mini per metric (mixed units, so
    // NO shared axis — that would be the dial problem). Each mini is a labelled mini-dumbbell + a delta
    // chip whose colour/arrow come from _deltaImproved(better,...), so position (lower=better) reads green
    // when it drops. Rates arrive PRE-WEIGHTED from the rollup (Σclicks/Σimpr); the mini never averages. ──
    function _chartMiniDeltas(data, opts) {
        opts = opts || {};
        const cfg = data.chart || {};
        const bK = cfg.before || 'older', aK = cfg.after || 'newer', labK = cfg.label || 'metric';
        const rows = (data.rows || []).filter(function (r) { return r[bK] != null && r[aK] != null; });
        if (!rows.length) return '';
        const cols = opts.big ? 3 : 2, cellW = (opts.big ? 750 : 452) / cols, cellH = opts.big ? 116 : 100, pad = 9;
        const W = cellW * cols, H = cellH * Math.ceil(rows.length / cols);
        const fmtV = function (v, r) { if (v == null) return 'n/a'; if (r.unit === '%') return v + '%'; if (r.dtype === 'ptpos') return '#' + v; return fmt(v); };
        let cells = '';
        rows.forEach(function (r, i) {
            const x0 = (i % cols) * cellW, y0 = Math.floor(i / cols) * cellH;
            const b = +r[bK], a = +r[aK], better = r.better || (r.dtype === 'ptpos' ? 'lower' : 'higher');
            const d = r.change;
            // GLYPH = the NUMBER's direction (▲ for +, ▼ for -); COLOUR + data-sentiment = _deltaImproved (so a
            // position rise reads ▲ but RED). Zero delta is NOISE: neutral, no arrow, no sentiment (the deadband).
            const isZero = (d == null) || d === 0;
            const improved = _deltaImproved(better, b, a);
            const col = isZero ? 'var(--color-text-muted)' : (improved ? '#059669' : '#dc2626');
            const sentA = isZero ? '' : ' data-sentiment="' + (improved ? 'good' : 'bad') + '"';
            const arrow = isZero ? '' : (d >= 0 ? '▲ ' : '▼ ');
            // Accessibility (B4): glyph = NUMBER direction, so for a "lower is better" metric (position) the arrow points
            // the WRONG way for sentiment and a colour-blind user gets only the misleading arrow. Where glyph and sentiment
            // DIVERGE, add a textual "worse"/"better" word so meaning never rides on colour alone (the project's a11y rule).
            const cue = (!isZero && ((d >= 0) !== improved)) ? (' ' + (improved ? 'better' : 'worse')) : '';
            const dtxt = (d != null) ? ((d > 0 ? '+' : '') + d + (r.dtype === 'pct' ? '%' : (r.unit === '%' ? 'pt' : '')) + cue) : '';
            const tX0 = x0 + pad + 4, tW = cellW - 2 * pad - 10, mx = Math.max(Math.abs(b), Math.abs(a), 1);
            let bx = tX0 + tW * Math.min(1, Math.abs(b) / mx), ax = tX0 + tW * Math.min(1, Math.abs(a) / mx);
            const ty = y0 + cellH - 33;
            // Min-separation clamp (C6): on a 0-to-max scale a typical delta (7%) puts the two dots <1 diameter apart, so
            // "changed a little" is indistinguishable from the zero-delta single dot. For any NONZERO delta, force a visible
            // gap (preserving direction, kept in-cell) - the exact magnitude lives in the text; the dumbbell just shows a real,
            // directional change happened. (Same honesty pattern as the sparkline deadband+clamp.)
            if (!isZero) {
                const minSep = 16, g = ax - bx;
                if (Math.abs(g) < minSep) { const mid = (ax + bx) / 2, half = (minSep / 2) * (g >= 0 ? 1 : -1); bx = mid - half; ax = mid + half; }
                const lo = tX0, hi = tX0 + tW;
                if (Math.min(bx, ax) < lo) { const dd = lo - Math.min(bx, ax); bx += dd; ax += dd; }
                if (Math.max(bx, ax) > hi) { const dd = Math.max(bx, ax) - hi; bx -= dd; ax -= dd; }
            }
            cells += '<g>' +
                '<rect x="' + (x0 + 4) + '" y="' + (y0 + 4) + '" width="' + (cellW - 8) + '" height="' + (cellH - 8) + '" rx="9" fill="var(--color-bg-primary)" stroke="var(--color-border-primary)"/>' +
                '<text x="' + (x0 + pad + 3) + '" y="' + (y0 + 22) + '" font-size="' + (opts.big ? 12 : 10.5) + '" font-weight="700" fill="var(--color-text-heading)">' + esc(String(r[labK])) + '</text>' +
                (d != null ? '<text' + sentA + ' x="' + (x0 + cellW - pad - 3) + '" y="' + (y0 + 22) + '" font-size="' + (opts.big ? 12 : 10.5) + '" font-weight="700" text-anchor="end" fill="' + col + '">' + arrow + esc(dtxt) + '</text>' : '') +
                '<line x1="' + Math.min(bx, ax).toFixed(1) + '" y1="' + ty + '" x2="' + Math.max(bx, ax).toFixed(1) + '" y2="' + ty + '" stroke="' + col + '" stroke-width="2" opacity="0.45"/>' +
                '<circle cx="' + bx.toFixed(1) + '" cy="' + ty + '" r="4.5" fill="var(--color-bg-primary)" stroke="var(--color-text-muted)" stroke-width="2"/>' +
                '<circle' + sentA + ' cx="' + ax.toFixed(1) + '" cy="' + ty + '" r="5" fill="' + col + '"/>' +
                '<text x="' + tX0 + '" y="' + (y0 + cellH - 12) + '" font-size="' + (opts.big ? 11 : 9.5) + '" fill="var(--color-text-muted)">' + esc(fmtV(r[bK], r)) + '</text>' +
                '<text x="' + (x0 + cellW - pad - 5) + '" y="' + (y0 + cellH - 12) + '" font-size="' + (opts.big ? 11 : 9.5) + '" text-anchor="end" font-weight="700" fill="var(--color-text-primary)">' + esc(fmtV(r[aK], r)) + '</text>' +
            '</g>';
        });
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;font-family:var(--font-family);max-width:' + W + 'px;">' + cells + '</svg>';
    }
    function _renderChart(data, opts) {
        if (!data || !data.chart) return '';
        const t = data.chart.type; let svg = '';
        if (t === 'diverging') svg = _chartDiverging(data, opts);
        else if (t === 'smallmultiples') svg = _chartSmallMultiples(data, opts);
        else if (t === 'line') svg = _chartLine(data, opts);
        else if (t === 'ladder') svg = _chartLadder(data, opts);
        else if (t === 'dumbbell') svg = _chartDumbbell(data, opts);
        else if (t === 'minideltas') svg = _chartMiniDeltas(data, opts);
        else return '';
        return svg ? '<div class="sv-chart">' + svg + '</div>' : '';
    }
    function _isChart(data) { return !!(data && data.chart && ['diverging', 'smallmultiples', 'line', 'ladder', 'dumbbell', 'minideltas'].indexOf(data.chart.type) >= 0); }
    // Segmented metric toggle for charts that carry data.metricSeries (currently trend) — switches
    // impressions/clicks/views/users live, no re-fetch (all metrics were computed up front).
    function _metricToggleHtml(eid, avail, current) {
        if (!avail || avail.length < 2) return '';
        return '<div style="display:flex;gap:2px;border:1px solid var(--color-border-primary);border-radius:7px;padding:2px;margin-bottom:10px;width:fit-content;">' +
            avail.map(function (m) { return '<button class="sv-ask-metric-btn" data-eid="' + eid + '" data-metric="' + m + '" style="font:inherit;font-size:0.68rem;font-weight:600;padding:3px 10px;border:none;border-radius:5px;cursor:pointer;background:' + (m === current ? 'var(--primary)' : 'transparent') + ';color:' + (m === current ? '#fff' : 'var(--color-text-secondary)') + ';">' + _MLABEL[m] + '</button>'; }).join('') +
        '</div>';
    }

    // Delegated hover tooltip for any .sv-tipel[data-tip] within a chart container.
    function _chartTipMove(e) {
        const el = e.target && e.target.closest ? e.target.closest('.sv-tipel') : null;
        if (!el) { _chartTipHide(); return; }
        const text = el.getAttribute('data-tip'); if (!text) { _chartTipHide(); return; }
        let tip = document.getElementById('sv-chart-tip');
        if (!tip) { tip = document.createElement('div'); tip.id = 'sv-chart-tip'; tip.style.cssText = 'position:fixed;z-index:100002;pointer-events:none;background:#1f2937;color:#ffffff;font:600 0.72rem/1.4 var(--font-family,sans-serif);padding:6px 9px;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,0.28);white-space:nowrap;display:none;'; document.body.appendChild(tip); }
        tip.textContent = text; tip.style.display = 'block';
        let x = e.clientX + 13, y = e.clientY + 13;
        if (x + tip.offsetWidth + 8 > window.innerWidth) x = e.clientX - 13 - tip.offsetWidth;
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }
    function _chartTipHide() { const t = document.getElementById('sv-chart-tip'); if (t) t.style.display = 'none'; }

    // Serialize an on-page SVG to PNG (resolves CSS vars to computed colours; no deps).
    function _svgToPng(svgEl, filename, scale) {
        if (!svgEl) return;
        scale = scale || 2;
        const cs = getComputedStyle(document.body);
        const vb = (svgEl.getAttribute('viewBox') || '0 0 400 200').split(/\s+/).map(Number);
        const w = vb[2] || 400, h = vb[3] || 200;
        const clone = svgEl.cloneNode(true);
        clone.setAttribute('width', w); clone.setAttribute('height', h);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        let str = new XMLSerializer().serializeToString(clone);
        str = str.replace(/var\((--[a-z0-9-]+)(?:,[^)]*)?\)/gi, function (m, name) { const v = cs.getPropertyValue(name).trim(); return v || '#888'; });
        const bg = (cs.getPropertyValue('--color-bg-primary').trim()) || '#ffffff';
        str = str.replace(/(<svg[^>]*>)/, '$1<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="' + bg + '"/>');
        const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(str)));
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
            const ctx = canvas.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(function (blob) {
                if (!blob) { alert('Chart export failed.'); return; }
                const u = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = u; a.download = filename;
                document.body.appendChild(a); a.click();
                setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(u); }, 150);
            }, 'image/png');
        };
        img.onerror = function () { alert('Chart export failed (render).'); };
        img.src = url;
    }

    // View a chart larger in a modal (re-rendered at big size); has its own PNG button.
    function _expandChart(data, title, listHtml) {
        const hasChart = _isChart(data);
        const isMap = !!(data && data.chart && data.chart.type === 'map');
        // List-style answers (rankCard bars + sparklines) render in res.html, not as an _isChart SVG, so expand used to
        // fall straight to the table and lose the sparklines. Carry the rich list HTML through and show it as a "List" view.
        const hasList = !hasChart && !isMap && !!listHtml;
        const hasVisual = hasChart || isMap || hasList;
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.6);display:flex;align-items:flex-start;justify-content:center;padding:28px;overflow:auto;backdrop-filter:blur(2px);';
        function close() { document.removeEventListener('keydown', onKey); ov.remove(); }
        function onKey(e) { if (e.key === 'Escape') close(); }
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        document.addEventListener('keydown', onKey);
        const box = document.createElement('div');
        box.style.cssText = 'background:var(--color-bg-secondary);border-radius:14px;max-width:960px;width:100%;margin:auto;padding:22px 24px;position:relative;font-family:var(--font-family);box-shadow:0 20px 60px rgba(0,0,0,0.3);';
        const tog = hasVisual ? ('<div style="display:inline-flex;gap:2px;border:1px solid var(--color-border-primary);border-radius:7px;padding:2px;margin-bottom:14px;">' +
            '<button class="sv-xc-view" data-mode="chart" style="font:inherit;font-size:0.72rem;font-weight:600;padding:4px 13px;border:none;border-radius:5px;cursor:pointer;background:var(--primary);color:#fff;">' + (isMap ? 'Map' : (hasChart ? 'Chart' : 'List')) + '</button>' +
            '<button class="sv-xc-view" data-mode="table" style="font:inherit;font-size:0.72rem;font-weight:600;padding:4px 13px;border:none;border-radius:5px;cursor:pointer;background:transparent;color:var(--color-text-secondary);">Table</button></div>') : '';
        const mtog = (data && data.metricViews && data.availableMetrics && data.availableMetrics.length > 1) ? ('<div style="display:inline-flex;gap:2px;border:1px solid var(--color-border-primary);border-radius:7px;padding:2px;margin-bottom:14px;margin-left:8px;">' + data.availableMetrics.map(function (m) { return '<button class="sv-xc-metric" data-metric="' + m + '" style="font:inherit;font-size:0.72rem;font-weight:600;padding:4px 12px;border:none;border-radius:5px;cursor:pointer;background:' + (m === data.metric ? 'var(--primary)' : 'transparent') + ';color:' + (m === data.metric ? '#fff' : 'var(--color-text-secondary)') + ';">' + _MLABEL[m] + '</button>'; }).join('') + '</div>') : '';
        const visualHtml = isMap ? _worldMapFromRows(data.rows, { big: true }) : (hasChart ? _renderChart(data, { w: 900, h: 460, big: true }) : (hasList ? listHtml : ''));
        box.innerHTML =
            '<button class="sv-xc-close" aria-label="Close" style="position:absolute;top:12px;right:14px;background:none;border:none;font-size:22px;color:var(--color-text-muted);cursor:pointer;line-height:1;">&times;</button>' +
            (title ? '<div style="font-weight:700;font-size:0.98rem;margin-bottom:12px;color:var(--color-text-heading);padding-right:24px;">' + esc(title) + '</div>' : '') +
            tog + mtog +
            (hasVisual ? ('<div class="sv-xc-chart">' + visualHtml + '</div>') : '') +
            '<div class="sv-xc-tbl"' + (hasVisual ? ' style="display:none;"' : '') + '>' + _dataTable(data, { big: true }) + '</div>' +
            '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">' +
                ((hasChart || isMap) ? '<button class="sv-xc-png" style="display:inline-flex;align-items:center;font-size:0.78rem;font-weight:600;padding:7px 14px;border-radius:8px;border:1px solid var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-secondary);cursor:pointer;font-family:inherit;">Download PNG</button>' : '') +
                '<button class="sv-xc-csv" style="display:inline-flex;align-items:center;font-size:0.78rem;font-weight:600;padding:7px 14px;border-radius:8px;border:1px solid var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-secondary);cursor:pointer;font-family:inherit;">Download CSV</button>' +
            '</div>';
        ov.appendChild(box); document.body.appendChild(ov);
        box.querySelector('.sv-xc-close').addEventListener('click', close);
        box.addEventListener('mousemove', _chartTipMove);
        box.addEventListener('mouseleave', _chartTipHide);
        const pngBtn = box.querySelector('.sv-xc-png'); if (pngBtn) pngBtn.addEventListener('click', function () { const svg = box.querySelector('.sv-xc-chart svg'); if (svg) _svgToPng(svg, (isMap ? 'map-' : 'chart-') + _todayStr() + '.png', 2); });
        box.querySelector('.sv-xc-csv').addEventListener('click', function () { _download('ask-' + _todayStr() + '.csv', _toCSV(data), 'text/csv'); });
        box.addEventListener('click', function (e) {
            const mb = e.target.closest ? e.target.closest('.sv-xc-metric') : null;
            if (mb) {
                const m = mb.getAttribute('data-metric'), mv = data.metricViews && data.metricViews[m];
                if (mv) {
                    data.columns = mv.columns; data.rows = mv.rows; data.chart = mv.chart; data.metric = m; if (mv.series) data.series = mv.series;
                    const ch2 = box.querySelector('.sv-xc-chart'); if (ch2) ch2.innerHTML = (_renderChart(data, { w: 900, h: 460, big: true }) || '');
                    const tb2 = box.querySelector('.sv-xc-tbl'); if (tb2) tb2.innerHTML = _dataTable(data, { big: true });
                    Array.prototype.forEach.call(box.querySelectorAll('.sv-xc-metric'), function (x) { const on = x.getAttribute('data-metric') === m; x.style.background = on ? 'var(--primary)' : 'transparent'; x.style.color = on ? '#fff' : 'var(--color-text-secondary)'; });
                }
                return;
            }
            const b = e.target.closest ? e.target.closest('.sv-xc-view') : null; if (!b) return;
            const mode = b.getAttribute('data-mode');
            const ch = box.querySelector('.sv-xc-chart'), tb = box.querySelector('.sv-xc-tbl');
            if (ch) ch.style.display = mode === 'table' ? 'none' : '';
            if (tb) tb.style.display = mode === 'table' ? '' : 'none';
            Array.prototype.forEach.call(box.querySelectorAll('.sv-xc-view'), function (x) { const on = x.getAttribute('data-mode') === mode; x.style.background = on ? 'var(--primary)' : 'transparent'; x.style.color = on ? '#fff' : 'var(--color-text-secondary)'; });
        });
    }

    let _chartUid = 0;
    // Catmull-Rom -> cubic-bezier smoothing so lines read as smooth curves, not jagged polylines.
    function _smoothPath(pts) {
        if (!pts.length) return '';
        if (pts.length < 3) return 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L');
        let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1); const t = 0.16;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
            const c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = p1[1] + (p2[1] - p0[1]) * t;
            const c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t;
            d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
        }
        return d;
    }
    // Line chart: single or multi-series, smooth curves, gradient area fill, animated draw-in, hover.
    // Sparkline-in-row (Wave 3). PER-ROW scale: a sparkline is a SHAPE visualisation (the trajectory is the
    // payload; magnitude is already the number's job), so the dumbbell's shared-scale / label-carries rule
    // — which only holds where number and geometry encode the SAME quantity — INVERTS here (see the flip
    // exchange). Two guards against per-row's mirror bug, MANUFACTURED DRAMA: (1) a min-range clamp so a
    // low-variance series renders flat (stable looks stable, the drama is earned); (2) a sentiment deadband
    // so a tiny drift is noise, not a red dot. Trend uses first/last PAIR averages (sturdier vs endpoint noise).
    const _SPARK_MINRANGE = 0.15, _SPARK_DEADBAND = 0.06;   // tune on real data
    function _sparkRange(vals, frac) {
        let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
        const mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        const floor = Math.max(1e-9, Math.abs(mean) * frac);
        if ((mx - mn) < floor) { const c = (mx + mn) / 2; return { mn: c - floor / 2, mx: c + floor / 2, clamped: true }; }
        return { mn: mn, mx: mx, clamped: false };
    }
    function _sparkTrend(vals, deadband) {
        const k = Math.min(2, Math.floor(vals.length / 2)) || 1;
        const fa = vals.slice(0, k).reduce(function (a, b) { return a + b; }, 0) / k;
        const la = vals.slice(-k).reduce(function (a, b) { return a + b; }, 0) / k;
        const drift = fa > 0 ? (la - fa) / fa : 0;
        return { drift: drift, sentiment: Math.abs(drift) >= deadband ? (drift >= 0 ? 'good' : 'bad') : '' };
    }
    function _sparkline(values, opts) {
        opts = opts || {};
        const vals = (values || []).map(function (v) { return Number(v) || 0; });
        if (vals.length < 2) return '';
        const W = opts.w || 90, H = opts.h || 18, pad = 2;
        const dom = _sparkRange(vals, _SPARK_MINRANGE), span = (dom.mx - dom.mn) || 1;
        const x = function (i) { return pad + (W - 2 * pad) * (i / (vals.length - 1)); };
        const y = function (v) { return H - pad - (H - 2 * pad) * Math.max(0, Math.min(1, (v - dom.mn) / span)); };
        const pts = vals.map(function (v, i) { return [x(i), y(v)]; });
        const tr = _sparkTrend(vals, _SPARK_DEADBAND);
        const dotCol = tr.sentiment === 'good' ? '#059669' : tr.sentiment === 'bad' ? '#dc2626' : 'var(--color-text-muted)';
        const last = pts[pts.length - 1];
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="display:block;overflow:visible;">' +
            '<path d="' + _smoothPath(pts) + '" fill="none" stroke="var(--color-text-muted)" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>' +
            '<circle' + (tr.sentiment ? ' data-sentiment="' + tr.sentiment + '"' : '') + ' cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.1" fill="' + dotCol + '"/>' +
        '</svg>';
    }
    // Per-row trajectories: `months` cached windows via fetchTrendWindow, one series per page for `metric`.
    // Impressions is the default (a metric-independent "search visibility" trend, stable across any toggle).
    async function _pageTrends(pages, months, win, metric) {
        metric = metric || 'impressions';
        const useGsc = ['impressions', 'clicks'].indexOf(metric) >= 0;
        const series = {};
        (pages || []).forEach(function (p) { series[normUrl(p.url || (p.urls || [])[0])] = []; });
        for (let i = months - 1; i >= 0; i--) {
            let by = {};
            try { const maps = await fetchTrendWindow(window.treeData, win, i * win); by = (useGsc ? maps.gscBy : maps.ga4By) || {}; } catch (e) {}
            (pages || []).forEach(function (p) {
                const urls = p.urls || [p.url]; let v = 0;
                urls.forEach(function (u) { const g = by[normUrl(u)]; if (g) v += Number(g[metric]) || 0; });
                series[normUrl(p.url || urls[0])].push(v);
            });
        }
        return series;
    }
    function _chartLine(data, opts) {
        opts = opts || {};
        let periods, series;
        if (data.series && data.periods) { periods = data.periods; series = data.series; }
        else { periods = (data.rows || []).map(function (r) { return r.period; }); series = [{ name: '', values: (data.rows || []).map(function (r) { return Number(r.value) || 0; }) }]; }
        if (periods.length < 2) return '';
        const W = opts.w || 420, H = opts.h || (opts.big ? 420 : 152), padL = opts.big ? 46 : 36, padR = 12, padT = series.length > 1 ? 20 : 14, padB = 24;
        const vf = opts.valFmt || fmt;   // axis + tooltip value formatter (default: thousands). Lets callers show %, etc.
        const colors = ['var(--primary)', '#d97706', '#7c3aed'];
        let maxV = 1; series.forEach(function (s) { (s.values || []).forEach(function (v) { if ((Number(v) || 0) > maxV) maxV = Number(v) || 0; }); });
        maxV = maxV * 1.08;   // headroom so the peak isn't jammed against the top
        const n = periods.length, uid = 'g' + (++_chartUid), baseY = H - padB;
        const x = function (i) { return padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - padR)); };
        const y = function (v) { return padT + (1 - (Number(v) || 0) / maxV) * (H - padT - padB); };
        let grid = ''; const ticks = 3;
        for (let t = 0; t <= ticks; t++) { const gv = maxV * t / ticks, gy = y(gv); grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="var(--color-border-primary)" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/><text x="' + (padL - 5) + '" y="' + (gy + 3) + '" font-size="8" text-anchor="end" fill="var(--color-text-muted)">' + vf(gv) + '</text>'; }
        let xl = ''; periods.forEach(function (p, i) { xl += '<text x="' + x(i) + '" y="' + (H - 6) + '" font-size="8" text-anchor="middle" fill="var(--color-text-muted)">' + esc(p) + '</text>'; });
        let defs = '', areas = '', lines = '', dots = '';
        series.forEach(function (s, si) {
            const col = colors[si % colors.length];
            const pts = (s.values || []).map(function (v, i) { return [x(i), y(v)]; });
            const d = _smoothPath(pts);
            if (series.length === 1) {   // area fill only for a single series (avoids muddy overlap)
                defs += '<linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity="0.26"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient>';
                areas += '<path class="sv-carea" d="' + d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + baseY + ' L' + pts[0][0].toFixed(1) + ' ' + baseY + ' Z" fill="url(#' + uid + ')" stroke="none"/>';
            }
            lines += '<path class="sv-cline" d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (opts.big ? 2.6 : 2.2) + '" stroke-linejoin="round" stroke-linecap="round" style="animation-delay:' + (si * 0.12).toFixed(2) + 's;"/>';
            (s.values || []).forEach(function (v, i) {
                const cx = x(i), cy = y(v), tv = (s.raw ? s.raw[i] : v), tip = esc((s.name ? s.name + ' ' : '') + periods[i] + ': ' + vf(tv)), r = opts.big ? 4 : 3.2;
                dots += '<circle class="sv-tipel" data-tip="' + tip + '" cx="' + cx + '" cy="' + cy + '" r="11" fill="transparent" style="cursor:pointer;"/>' +
                    '<circle class="sv-cdot" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(--color-bg-primary)" stroke="' + col + '" stroke-width="2" style="pointer-events:none;animation-delay:' + (0.5 + i * 0.06).toFixed(2) + 's;"/>';
            });
        });
        // Gap fill (Wave 3): shade the wedge BETWEEN two series — the area between the lines is the story
        // (generalises the AI divergence wedge). Neutral tint for a two-entity compare; fillGap:'sentiment'
        // tints by which line ends on top (growth green / decline red) for a future trend-vs-prior overlay.
        let gapFill = '';
        if (series.length === 2 && data.chart && data.chart.fillGap) {
            const pts0 = (series[0].values || []).map(function (v, i) { return [x(i), y(v)]; });
            const pts1 = (series[1].values || []).map(function (v, i) { return [x(i), y(v)]; });
            if (pts0.length >= 2 && pts1.length === pts0.length) {
                const rev1 = _smoothPath(pts1.slice().reverse()).replace(/^M\s*[-\d.]+\s+[-\d.]+/, '');   // series1 back-to-front, minus its leading moveto
                const gd = _smoothPath(pts0) + ' L' + pts1[pts1.length - 1][0].toFixed(1) + ' ' + pts1[pts1.length - 1][1].toFixed(1) + rev1 + ' Z';
                let fCol = 'var(--primary)', fOp = '0.10', sent = '';
                if (data.chart.fillGap === 'sentiment') {
                    // CROSSING RULE (decided in the contract, not left to the consumer): tinting by the FINAL
                    // state lies about the segments before a crossover (trailing then overtaking would paint
                    // the whole wedge green). If the series CROSS, drop to NEUTRAL — the cheap option that
                    // never lies. Per-segment tinting (each inter-crossing region by who leads there) is the
                    // fuller fix; add it only when a consumer needs the expressiveness.
                    const v0 = series[0].values, v1 = series[1].values;
                    let mn = Infinity, mx = -Infinity;
                    for (let i = 0; i < v0.length; i++) { const dd = (Number(v0[i]) || 0) - (Number(v1[i]) || 0); if (dd < mn) mn = dd; if (dd > mx) mx = dd; }
                    if (!(mn < 0 && mx > 0)) {   // not crossed -> "who's on top" is consistent, so the tint is honest for the whole wedge
                        const good = (Number(v0[v0.length - 1]) || 0) >= (Number(v1[v1.length - 1]) || 0);
                        fCol = good ? '#059669' : '#dc2626'; fOp = '0.13'; sent = ' data-sentiment="' + (good ? 'good' : 'bad') + '"';
                    }
                }
                gapFill = '<path class="sv-carea"' + sent + ' d="' + gd + '" fill="' + fCol + '" fill-opacity="' + fOp + '" fill-rule="evenodd" stroke="none"/>';
            }
        }
        // Endpoint value labels (single series): the start/end values ride ON the line, so the story ("1.2M
        // to 829.3K") is visible in the chart, not only in the sentence — same idiom as the sparkline's last dot.
        let endLabels = '';
        if (series.length === 1) {
            const s0 = series[0], v0 = s0.values || [], nn = v0.length;
            if (nn >= 2) {
                const fv = s0.raw ? s0.raw[0] : v0[0], lv = s0.raw ? s0.raw[nn - 1] : v0[nn - 1];
                endLabels = '<text x="' + (x(0) + 2).toFixed(1) + '" y="' + (y(v0[0]) - 6).toFixed(1) + '" font-size="8.5" font-weight="700" text-anchor="start" fill="var(--color-text-secondary)">' + esc(vf(fv)) + '</text>' +
                    '<text x="' + (x(nn - 1) - 2).toFixed(1) + '" y="' + (y(v0[nn - 1]) - 6).toFixed(1) + '" font-size="8.5" font-weight="700" text-anchor="end" fill="var(--color-text-primary)">' + esc(vf(lv)) + '</text>';
            }
        }
        let legend = '';
        if (series.length > 1) { let lx = padL; series.forEach(function (s, si) { const col = colors[si % colors.length]; legend += '<rect x="' + lx + '" y="2" width="9" height="9" rx="2" fill="' + col + '"/><text x="' + (lx + 12) + '" y="10" font-size="9" fill="var(--color-text-secondary)">' + esc(s.name) + '</text>'; lx += 12 + Math.min(120, String(s.name).length * 6) + 18; }); }
        const cap = (data.chart && data.chart.label) ? '<text x="' + (W - padR) + '" y="9" font-size="8" text-anchor="end" fill="var(--color-text-muted)">' + esc(data.chart.label) + '</text>' : '';
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;font-family:var(--font-family);"><defs>' + defs + '</defs>' + grid + areas + gapFill + lines + dots + endLabels + xl + legend + cap + '</svg>';
    }

    // Diverging horizontal bars (movers): green right / red left from a centre axis.
    function _chartDiverging(data, opts) {
        opts = opts || {};
        const rows = data.rows || []; if (!rows.length) return '';
        const W = opts.w || 400, rowH = opts.big ? 30 : 22, padT = 4, padB = 4, valW = opts.big ? 66 : 54, gap = 8;
        const labelW = Math.round(W * (opts.big ? 0.3 : 0.34));
        const H = opts.h || (rows.length * rowH + padT + padB);
        const barAreaW = W - labelW - gap - valW - gap, halfW = barAreaW / 2;
        const cx = labelW + gap + halfW;
        const maxAbs = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.changePct || 0); }).concat([1]));
        const fsz = opts.big ? 12 : 10, maxChars = Math.floor(labelW / (opts.big ? 7 : 6));
        let body = '';
        rows.forEach(function (r, i) {
            const y = padT + i * rowH, midY = y + rowH / 2;
            const pct = r.changePct || 0, up = pct >= 0, col = up ? '#059669' : '#dc2626';
            const w = Math.min(halfW, Math.abs(pct) / maxAbs * halfW);
            const barX = up ? cx : cx - w;
            const valTxt = (up ? '+' : '') + (Math.abs(pct) > 500 ? (up ? '500+' : '-500+') : pct.toFixed(0)) + '%';
            const tip = esc(r.page + ': ' + valTxt);
            body += '<g class="sv-tipel' + (r.url ? ' sv-ask-page' : '') + '"' + (r.url ? (' data-url="' + esc(r.url) + '"') : '') + ' data-tip="' + tip + '"' + (r.url ? ' style="cursor:pointer;"' : '') + '>' +
                '<rect x="0" y="' + y + '" width="' + W + '" height="' + rowH + '" fill="transparent"/>' +
                '<text x="0" y="' + (midY + 3) + '" font-size="' + fsz + '" fill="var(--color-text-primary)" font-weight="600">' + esc(_svTrunc(r.page, maxChars)) + '</text>' +
                '<line x1="' + cx + '" y1="' + (y + 3) + '" x2="' + cx + '" y2="' + (y + rowH - 3) + '" stroke="var(--color-border-primary)" stroke-width="1"/>' +
                '<rect class="sv-cbar" style="animation-delay:' + (i * 0.045).toFixed(2) + 's;" x="' + barX + '" y="' + (midY - 5) + '" width="' + Math.max(0, w) + '" height="10" rx="2.5" fill="' + col + '"/>' +
                '<text x="' + W + '" y="' + (midY + 3) + '" font-size="' + fsz + '" text-anchor="end" fill="' + col + '" font-weight="700">' + valTxt + '</text>' +
                '</g>';
        });
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;font-family:var(--font-family);">' + body + '</svg>';
    }

    // Small-multiples (compare): one mini bar-pair per metric (own scale each).
    function _chartSmallMultiples(data, opts) {
        opts = opts || {};
        const rows = data.rows || []; if (!rows.length) return '';
        const aName = (data.columns[1] && data.columns[1].label) || 'A', bName = (data.columns[2] && data.columns[2].label) || 'B';
        const cA = 'var(--primary)', cB = '#94a3b8';
        const W = opts.w || 400, padT = 24, rowGap = opts.big ? 50 : 40, barH = opts.big ? 12 : 9, labelH = 14, valW = 66, barMaxW = W - valW - 4;
        const H = opts.h || (padT + rows.length * rowGap + 6);
        // CTR uses the shared sub-decimal formatter (v is already *100, so /100 back to a ratio) - no "0.0%" for an artifact.
        const fmtV = function (metric, v) { return /CTR/i.test(metric) ? _ctrTxt((Number(v) || 0) / 100) : (/position/i.test(metric) ? (v == null ? '-' : Number(v).toFixed(1)) : fmt(Number(v) || 0)); };
        let s = '<rect x="0" y="3" width="9" height="9" rx="2" fill="' + cA + '"/><text x="13" y="11" font-size="10" fill="var(--color-text-secondary)">' + esc(aName) + '</text>';
        const bOff = 13 + Math.min(160, String(aName).length * 6) + 18;
        s += '<rect x="' + bOff + '" y="3" width="9" height="9" rx="2" fill="' + cB + '"/><text x="' + (bOff + 13) + '" y="11" font-size="10" fill="var(--color-text-secondary)">' + esc(bName) + '</text>';
        rows.forEach(function (r, i) {
            const y = padT + i * rowGap;
            const a = Number(r.a) || 0, b = Number(r.b) || 0, mx = Math.max(a, b, 1);
            s += '<text x="0" y="' + (y + 9) + '" font-size="10" font-weight="700" fill="var(--color-text-muted)">' + esc(String(r.metric).toUpperCase()) + '</text>';
            const bar = function (v, col, name, yy, mark) { const w = Math.max(2, Math.abs(v) / mx * barMaxW); const vt = fmtV(r.metric, v) + (mark ? '*' : ''); const tip = esc(r.metric + ' - ' + name + ': ' + fmtV(r.metric, v) + (mark ? ' (dragged by tracking artifacts)' : '')); return '<g class="sv-tipel" data-tip="' + tip + '"><rect x="0" y="' + yy + '" width="' + w + '" height="' + barH + '" rx="2" fill="' + col + '"/><text x="' + (w + 5) + '" y="' + (yy + barH - 1) + '" font-size="9" font-weight="600" fill="var(--color-text-secondary)">' + vt + '</text></g>'; };
            s += bar(a, cA, aName, y + labelH, r.aMark) + bar(b, cB, bName, y + labelH + barH + 3, r.bMark);
        });
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;font-family:var(--font-family);">' + s + '</svg>';
    }

    // Cached period-window fetch for the trend intent (keyed by days:offset).
    const _trendCache = {};
    function fetchTrendWindow(tree, days, offset) {
        const key = days + ':' + offset;
        if (_trendCache[key]) return _trendCache[key];
        _trendCache[key] = fetchPeriodMaps(tree, days, offset).catch(function (e) { delete _trendCache[key]; throw e; });
        return _trendCache[key];
    }
    // GSC site-wide monthly trend (impressions/clicks/ctr/position), cached per window. For the
    // AI-Impact report's divergence wedge. REGISTERED in clearCaches (cross-period cache read).
    const _gscTrendCache = {};   // months -> Promise<[{ym,impressions,clicks,ctr,position}]>
    // FIXED-WINDOW invariant: the trend must be EXACTLY N COMPLETE months, or every conclusion drawn from it
    // (the divergence %, "is it accelerating?", the deck screenshot) drifts silently as GSC accrues months and
    // the current partial month deflates the late third. Drop the partial current month, keep the last N. The
    // fetch over-fetches a buffer; this is the ONE place the window is pinned — selfTest asserts N is invariant.
    function _capTrendMonths(rows, months, curYm) {
        curYm = curYm || (function () { const d = new Date(); return d.getFullYear() * 100 + (d.getMonth() + 1); })();
        return (rows || []).filter(function (x) { return parseInt(x.ym, 10) < curYm; }).slice(-months);
    }
    function getGscSiteTrend(months) {
        const gsc = window.GSCIntegration;
        if (!(gsc && gsc.isConnected && gsc.isConnected() && gsc.fetchSiteTrend)) return Promise.resolve([]);
        const n = months || 12, key = String(n);
        if (_gscTrendCache[key]) return _gscTrendCache[key];
        _gscTrendCache[key] = gsc.fetchSiteTrend({ months: n })
            .then(function (rows) { rows = _capTrendMonths(rows || [], n); if (!rows.length) delete _gscTrendCache[key]; return rows; })
            .catch(function (e) { delete _gscTrendCache[key]; throw e; });
        return _gscTrendCache[key];
    }
    // Epistemic grammar (design principle #1): render a FIGURE with its evidence tier — the apparatus
    // attaches to numbers, never sentences. tier: 'measured' (plain, confident — no apparatus),
    // 'estimated' (~ prefix, muted), 'inferred' (dashed chip, "bound not measurement"). Tier is passed
    // at call time (a property of the datum), so a value can be promoted across tiers without redesign.
    function _epi(text, tier, title) {
        const t = esc(String(text));
        if (tier === 'estimated') return '<span class="sv-epi sv-epi-est" title="' + esc(title || 'Estimated: a modelled figure, not a direct measurement.') + '">~' + t + '</span>';
        if (tier === 'inferred') return '<span class="sv-epi sv-epi-inf" title="' + esc(title || 'Inferred: a bound from triangulating two data sources, not a measurement.') + '">' + t + '</span>';
        if (tier === 'pending') return '<span class="sv-epi sv-epi-inf" title="Not yet computed — lands with the per-page classification (Phase 2).">' + t + '</span>';
        return '<span class="sv-epi sv-epi-meas">' + t + '</span>';   // measured: plain, confident
    }

    // Ranked action-card list for the section briefing (numbered, colour-tagged by type).
    function _briefCard(items) {
        const tcol = { Opportunity: '#0369a1', Cannibalisation: '#d97706', Decline: '#dc2626', Freshness: '#7c3aed', 'AI exposure': '#dc2626' };
        return '<div style="display:flex;flex-direction:column;gap:8px;">' + items.map(function (it, i) {
            const col = tcol[it.type] || 'var(--primary)';
            const clickable = it.url ? ' class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(it.url) + '" style="cursor:pointer;"' : '';
            return '<div' + clickable + ' style="display:flex;gap:10px;padding:10px 12px;border:1px solid var(--color-border-primary);border-radius:10px;background:var(--color-bg-primary);">' +
                '<div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:' + col + ';color:#fff;font-size:0.72rem;font-weight:700;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</div>' +
                '<div style="min-width:0;flex:1;">' +
                    '<div style="font-size:0.8rem;font-weight:700;color:var(--color-text-primary);"><span style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:' + col + ';margin-right:6px;">' + esc(it.type) + '</span>' + esc(it.title) + '</div>' +
                    '<div style="font-size:0.72rem;color:var(--color-text-secondary);margin-top:2px;">' + esc(it.detail) + '</div>' +
                '</div></div>';
        }).join('') + '</div>';
    }

    // Shared briefing engine (used by the briefing intent AND the digest roll-up).
    // Fetch once, compute per-section many times.
    async function _briefingContext(r) {
        let qrows = null;
        try { qrows = await getQueryRows(_ddDays); } catch (e) {}
        const hasQueries = !!(qrows && qrows.length);
        let prior = null;
        try { prior = await getPriorMaps(window.treeData, _ddDays); } catch (e) {}
        // AI exposure is read CACHE-ONLY here (deliberately asymmetric with diagnose, which pulls): the
        // briefing/hero renders on panel-open and must not trigger the expensive two-window fetch. If the
        // engine is cold, aiExposed stays null and the briefing shows a muted "not yet checked" line.
        let aiExposed = null; const _cached = getAIImpactCached(_ddDays);
        if (_cached) { try { const A = await _cached; if (A && A.classifyOk) aiExposed = A.exposed || []; } catch (e) {} }
        const _gscOn = !!(window.GSCIntegration && window.GSCIntegration.isConnected && window.GSCIntegration.isConnected());
        return { qrows: qrows, hasQueries: hasQueries, qidx: hasQueries ? buildQueryIndex(qrows, r) : [], urlCat: hasQueries ? _urlToCatMap(r) : null, urlToName: hasQueries ? _urlToPageName(r) : {}, prior: prior, aiExposed: aiExposed, aiChecked: aiExposed != null, gscOn: _gscOn };
    }
    function _sectionActions(c, r, ctx) {
        const pages = c ? catPages(c) : _allPages(r);
        const ctr = (c ? c.rollup.ctr : r.totals.ctr) || 0.02;
        // Common currency = clicks/mo at stake; everything with a magnitude is ranked on it. Magnitude-less
        // findings (staleness) go to a fixed bottom slot below, never interleaved (that would imply a
        // comparison we didn't compute). AI exposure enters here with its per-page floor as the score.
        const ranked = [];
        if (ctx.hasQueries) {
            let opps = c ? ctx.qidx.filter(function (x) { return x.category === c.name; }) : ctx.qidx;
            // Exclude artifact queries (near-zero CTR at a top rank): their "potential" is fictional, so they must not
            // occupy a briefing priority slot (A7: Medical Card was the section's #1 action, computed from artifact CTR).
            opps = opps.filter(function (x) { return x.impressions >= 100 && x.potential >= 5 && !x.artifact && !x.navigational; }).sort(function (a, b) { return b.potential - a.potential; }).slice(0, 3);
            opps.forEach(function (o) { ranked.push({ type: 'Opportunity', score: o.potential, title: 'Improve "' + o.query + '"', detail: '+' + fmt(Math.round(o.potential)) + ' clicks/mo potential, pos ' + (o.bestPos != null ? o.bestPos.toFixed(0) : '?') + ', ' + fmt(o.impressions) + ' impr', url: o.bestPage }); });
            const cann = _cannibalisation(ctx.qrows, c ? c.name : null, ctx.urlCat, ctx.urlToName).slice(0, 2);
            cann.forEach(function (k) { const _cc = k.total * ctr * 0.3; ranked.push({ type: 'Cannibalisation', score: _cc, title: 'Resolve competing pages for "' + k.query + '"', detail: k.competing + ' of your pages compete, ' + fmt(k.total) + ' impr at stake (~' + fmt(Math.round(_cc)) + ' clicks/mo)', url: (k.pages[0] && k.pages[0].url) || null }); });
        }
        if (ctx.prior) {
            let worst = null;
            pages.forEach(function (p) {
                const cur = p.s.impressions || 0;
                const prev = (p.urls || [p.url]).reduce(function (s, u) { const pr = ctx.prior.gscBy[normUrl(u)]; return s + (pr ? (pr.impressions || 0) : 0); }, 0);
                if (prev >= 200) { const pct = (cur - prev) / prev * 100; if (pct <= -15 && (!worst || pct < worst.pct)) worst = { p: p, pct: pct, cur: cur, prev: prev }; }
            });
            if (worst) { const _dc = (worst.prev - worst.cur) * ctr; ranked.push({ type: 'Decline', score: _dc, title: 'Investigate ' + worst.p.name, detail: 'down ' + Math.round(Math.abs(worst.pct)) + '%, ' + fmt(worst.cur) + ' impr, was ' + fmt(worst.prev) + ' (~' + fmt(Math.round(_dc)) + ' clicks/mo lost)', url: worst.p.url }); }
        }
        // AI exposure (cache-only via ctx; the report is the full registry). Cap at 2 per briefing.
        let exposedScoped = [];
        if (ctx.aiExposed && ctx.aiExposed.length) {
            if (c) { const set = Object.create(null); catPages(c).forEach(function (p) { (p.urls || [p.url]).forEach(function (u) { set[normUrl(u)] = 1; }); }); exposedScoped = ctx.aiExposed.filter(function (x) { return set[normUrl(x.url)]; }); }
            else exposedScoped = ctx.aiExposed;
            exposedScoped.slice(0, 2).forEach(function (x) { ranked.push({ type: 'AI exposure', score: x.lost, title: 'Review ' + x.name, detail: '~' + fmt(x.lost) + ' clicks/mo, pattern consistent with AI answers (position held ' + x.pos.toFixed(1) + ', CTR ' + _aiCtr(x.ctrB) + ' to ' + _aiCtr(x.ctrN) + ')', url: x.url }); });
        }
        ranked.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
        // Bottom slot: staleness (no clicks/mo magnitude), kept out of the ranked list on purpose.
        const now = Date.now(); const fresh = [];
        pages.map(function (p) { const t = p.lm ? Date.parse(p.lm) : NaN; const m = isNaN(t) ? null : (now - t) / (1000 * 60 * 60 * 24 * 30.44); return { p: p, m: m }; })
            .filter(function (x) { return x.m != null && x.m > 12 && (x.p.s.impressions || 0) >= 200; })
            .sort(function (a, b) { return (b.p.s.impressions || 0) - (a.p.s.impressions || 0); }).slice(0, 2)
            .forEach(function (x) { fresh.push({ type: 'Freshness', score: 0, title: 'Refresh ' + x.p.name, detail: Math.round(x.m) + ' months old - still ' + fmt(x.p.s.impressions || 0) + ' impr', url: x.p.url }); });
        const out = ranked.slice(0, 6).concat(fresh);
        out._rankedCount = Math.min(ranked.length, 6);
        out._aiExposedTotal = exposedScoped.length;
        out._aiChecked = !!ctx.aiChecked; out._gscOn = !!ctx.gscOn;
        return out;
    }
    function _briefMarkdown(scope, rollup, actions) {
        let md = '## ' + scope + '\n\n';
        md += '- Impressions: ' + fmt(rollup.impressions) + ' | Clicks: ' + fmt(rollup.clicks) + ' | CTR: ' + _ctrTxt(rollup.ctr) + (rollup.pageViews ? (' | Views: ' + fmt(rollup.pageViews)) : '') + '\n\n';
        if (!actions.length) { return md + '_No urgent priorities - looks healthy._\n\n'; }
        md += '**Priorities (ranked by estimated impact):**\n\n';
        actions.forEach(function (it, i) { md += (i + 1) + '. **' + it.type + '** - ' + it.title.replace(/"/g, '') + ' (' + it.detail + ')' + (it.url ? ('\n   ' + it.url) : '') + '\n'; });
        return md + '\n';
    }

    // Opportunistic on-page content signals from the Page Intelligence module. Returns null
    // unless that page has already been analysed - its cache fills when a user opens the
    // page's Content/Document tab (many CI pages are proxy-blocked, so it's often absent).
    function _contentIntel(page) {
        const PI = window.PageIntelligence;
        if (!PI || typeof PI.getCachedData !== 'function' || !page) return null;
        const urls = page.urls || [page.url];
        let d = null;
        for (let i = 0; i < urls.length; i++) { const c = PI.getCachedData(urls[i]); if (c) { d = c; break; } }
        if (!d) return null;
        const findings = [];
        if (d.isNoindex) findings.push({ sev: 'warn', t: 'Blocked from search', d: 'This page is set to noindex - search engines are told not to list it.' });
        if (d.metaDescLength === 0) findings.push({ sev: 'warn', t: 'No meta description', d: 'Search shows a guessed snippet - a written meta description lifts click-through.' });
        else if (d.metaDescLength < 70) findings.push({ sev: 'info', t: 'Short meta description', d: d.metaDescLength + ' chars - room to make the search snippet more compelling.' });
        else if (d.metaDescLength > 160) findings.push({ sev: 'info', t: 'Long meta description', d: d.metaDescLength + ' chars - may be truncated in results.' });
        if (d.titleLength === 0) findings.push({ sev: 'warn', t: 'Missing title tag', d: 'No page title - critical for both ranking and the result headline.' });
        else if (d.titleLength > 60) findings.push({ sev: 'info', t: 'Long title tag', d: d.titleLength + ' chars - may be cut off in the search result.' });
        if (d.readabilityScore != null && d.readabilityScore < 45) findings.push({ sev: 'warn', t: 'Hard to read', d: 'Reading ease ' + Math.round(d.readabilityScore) + ' (lower = harder) - simpler sentences suit a citizen audience.' });
        else if (d.readabilityScore != null && d.readabilityScore < 55) findings.push({ sev: 'info', t: 'Fairly hard to read', d: 'Reading ease ' + Math.round(d.readabilityScore) + ' - a plainer style would help.' });
        if (d.wordCount != null && d.wordCount > 0 && d.wordCount < 300) findings.push({ sev: 'info', t: 'Thin content', d: d.wordCount + ' words - more depth can help it rank and fully answer.' });
        return { data: d, findings: findings, readability: d.readabilityScore, words: d.wordCount, titleLen: d.titleLength, metaLen: d.metaDescLength, noindex: !!d.isNoindex };
    }
    function _readEase(score) { if (score == null) return null; if (score >= 60) return 'plain'; if (score >= 50) return 'ok'; if (score >= 30) return 'hard'; return 'very hard'; }
    // One-line on-page summary for page_summary.
    function _contentIntelLine(ci) {
        if (!ci) return '';
        const bits = [];
        if (ci.readability != null) bits.push('reading ease ' + Math.round(ci.readability) + (_readEase(ci.readability) ? ' (' + _readEase(ci.readability) + ')' : ''));
        if (ci.words != null) bits.push(fmt(ci.words) + ' words');
        bits.push('meta ' + (ci.metaLen || 0) + ' chars' + (ci.metaLen === 0 ? ' (missing)' : ci.metaLen > 160 ? ' (long)' : ci.metaLen < 70 ? ' (short)' : ''));
        if (ci.noindex) bits.push('<span style="color:#d97706;font-weight:700;">noindex</span>');
        return '<div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:6px;"><span style="font-weight:700;">On-page:</span> ' + bits.join(' &middot; ') + '</div>';
    }

    async function runIntent(plan, r) {
        const cats = r.categories, hasGA4 = r.totals.pageViews > 0 || r.totals.users > 0;
        const metric = ['impressions', 'clicks', 'ctr', 'position', 'pageViews', 'users'].indexOf(plan.metric) >= 0 ? plan.metric : 'impressions';
        const limit = Math.min(15, Math.max(1, plan.limit || 6));
        const intent = plan.intent;

        if (intent === 'site_summary') {
            return { html: _stripCard(r.totals, hasGA4), summary: 'Whole site: ' + fmt(r.totals.impressions) + ' impressions, ' + fmt(r.totals.clicks) + ' clicks, ' + _ctrTxt(r.totals.ctr) + ' CTR, ' + fmt(r.totals.leafCount) + ' content pages.', data: { columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows: _metricRows(r.totals, hasGA4), chart: null } };
        }
        if (intent === 'section_summary') {
            const c = _catByName(cats, plan.category);
            if (!c) return { html: '', summary: '', err: 'I couldn\'t find that section.' };
            const _ra = _rollupArtifacts(catPages(c));   // a few near-zero-CTR-at-top-rank pages can drag the whole section's CTR down
            // Pointer fix (A13): artifact pages are EXCLUDED from ai_exposed by construction, so pointing there returns a
            // list that omits them. Point at artifact_pages, the intent that lists exactly these.
            const _raNote = _ra.dragged ? '<div style="font-size:0.72rem;color:#d97706;margin-top:8px;padding:7px 10px;border:1px solid rgba(217,119,6,0.3);border-radius:8px;background:rgba(217,119,6,0.06);">CTR is dragged down by ' + _ra.count + ' page' + (_ra.count === 1 ? '' : 's') + ' with near-zero clicks at a top rank (likely a redirect or tracking artifact, not real performance); excluding ' + (_ra.count === 1 ? 'it' : 'them') + ', CTR is ~' + _ctrTxt(_ra.exCtr) + '. Ask "which ' + esc(c.name) + ' pages have tracking issues" to see them.</div>' : '';
            return { html: '<div style="font-weight:700;margin-bottom:8px;">' + esc(c.name) + '</div>' + _stripCard(c.rollup, hasGA4, _ra.dragged) + _raNote, summary: c.name + ': ' + fmt(c.rollup.impressions) + ' impressions, ' + _ctrTxt(c.rollup.ctr) + ' CTR' + (_ra.dragged ? ' (dragged by ' + _ra.count + ' artifact page' + (_ra.count === 1 ? '' : 's') + '; ~' + _ctrTxt(_ra.exCtr) + ' without them)' : '') + ', ' + fmt(c.rollup.pageViews) + ' views, ' + fmt(c.rollup.leafCount) + ' pages.', data: { columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows: _metricRows(c.rollup, hasGA4), chart: null } };
        }
        if (intent === 'rank_categories') {
            const desc = plan.direction !== 'up';
            const TM = ['impressions', 'clicks', 'pageViews', 'users'];
            const availRC = TM.filter(function (m) { return cats.some(function (c) { return _mval(c.rollup, m) > 0; }); });
            if (!availRC.length) return { html: '', summary: '', err: 'No category data to rank yet.' };
            const curRC = availRC.indexOf(metric) >= 0 ? metric : availRC[0];
            const viewRC = function (m) {
                const sorted = cats.slice().sort(function (a, b) { const av = _mval(a.rollup, m), bv = _mval(b.rollup, m); return desc ? bv - av : av - bv; }).slice(0, limit);
                const items = sorted.map(function (c) { return { name: c.name, val: _mfmt(c.rollup, m), bar: _mval(c.rollup, m) }; });
                return { body: _rankCard(items, { nameLabel: 'Category', valueLabel: _MLABEL[m] }), columns: [{ key: 'section', label: 'Category' }, { key: 'value', label: _MLABEL[m] }], rows: sorted.map(function (c) { return { section: c.name, value: _mval(c.rollup, m), display: _mfmt(c.rollup, m) }; }), chart: { type: 'bar', x: 'section', y: 'value', label: _MLABEL[m] } };
            };
            const mvRC = {}; availRC.forEach(function (m) { mvRC[m] = viewRC(m); });
            const curV = mvRC[curRC];
            return { html: curV.body, summary: 'Sections by ' + _MLABEL[curRC] + ': ' + curV.rows.map(function (x) { return x.section + ' ' + x.display; }).join(', ') + '.', data: { columns: curV.columns, rows: curV.rows, chart: curV.chart, metric: curRC, availableMetrics: availRC, metricViews: mvRC } };
        }
        if (intent === 'top_pages') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const desc = plan.direction !== 'up';
            const TM = ['impressions', 'clicks', 'pageViews', 'users'];
            const availTP = TM.filter(function (m) { return pages.some(function (p) { return _mval(p.s, m) > 0; }); });
            if (!availTP.length) return { html: '', err: 'No pages with ' + _MLABEL[metric] + ' data found' + (c ? ' in ' + c.name : '') + '. (' + pages.length + ' pages checked — is GA4 connected for views/users?)', summary: '' };
            const curTP = availTP.indexOf(metric) >= 0 ? metric : availTP[0];
            const viewTP = function (m) {
                const sorted = pages.filter(function (p) { return _mval(p.s, m) > 0; }).sort(function (a, b) { const av = _mval(a.s, m), bv = _mval(b.s, m); return desc ? bv - av : av - bv; }).slice(0, limit);
                const items = sorted.map(function (p) { return { name: p.name, val: _mfmt(p.s, m), bar: _mval(p.s, m), url: p.url, artifact: _ctrCliff(p.s.position, p.s.ctr, p.s.impressions) }; });   // guard propagation: a high-impression artifact page rides to the top of this list; flag it (the _rankCard ⚠ lever)
                return { body: _rankCard(items, { nameLabel: 'Page', valueLabel: _MLABEL[m] }), columns: [{ key: 'page', label: 'Page' }, { key: 'value', label: _MLABEL[m] }, { key: 'url', label: 'URL' }], rows: sorted.map(function (p) { return { page: p.name, value: _mval(p.s, m), display: _mfmt(p.s, m), url: p.url }; }), chart: { type: 'bar', x: 'page', y: 'value', label: _MLABEL[m] } };
            };
            const mvTP = {}; availTP.forEach(function (m) { mvTP[m] = viewTP(m); });
            const curV = mvTP[curTP];
            return { html: curV.body, summary: 'Top pages' + (c ? ' in ' + c.name : '') + ' by ' + _MLABEL[curTP] + ': ' + curV.rows.slice(0, 5).map(function (x) { return x.page + ' ' + x.display; }).join(', ') + '.', data: { columns: curV.columns, rows: curV.rows, chart: curV.chart, metric: curTP, availableMetrics: availTP, metricViews: mvTP } };
        }
        if (intent === 'low_ctr') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const avg = (c ? c.rollup.ctr : r.totals.ctr) || 0;
            const rows = pages.filter(function (p) { return (p.s.impressions || 0) >= 300 && p.s.ctr < Math.max(0.005, avg * 0.6); }).sort(function (a, b) { return b.s.impressions - a.s.impressions; }).slice(0, limit);
            let _lcTr = {};   // these are high-impression pages, so their impression trajectories actually populate (unlike stale's dead pages)
            try { _lcTr = await _pageTrends(rows, 6, 30, 'impressions'); } catch (e) {}
            // Guard on the FOURTH surface (A14): a low-CTR list is mostly tracking artifacts, not content failures. Mark
            // each artifact row (the _rankCard item.artifact lever - the row-source fix so any consumer inherits it), and
            // when the top row is one, set res.ctrArtifact so the follow-ups drop "why underperforming" (wrong for an artifact).
            const items = rows.map(function (p) { const sk = _lcTr[normUrl(p.url)]; return { name: p.name, val: _ctrTxt(p.s.ctr), bar: p.s.impressions, url: p.url, artifact: _ctrCliff(p.s.position, p.s.ctr, p.s.impressions), spark: (sk && sk.some(function (v) { return v > 0; })) ? sk : null }; });
            const _lcArts = rows.filter(function (p) { return _ctrCliff(p.s.position, p.s.ctr, p.s.impressions); });
            const _lcNote = _lcArts.length ? '<div style="font-size:0.72rem;color:#d97706;margin-top:8px;padding:7px 10px;border:1px solid rgba(217,119,6,0.3);border-radius:8px;background:rgba(217,119,6,0.06);">' + _lcArts.length + ' of these ' + rows.length + ' pages (marked &#9888;) have near-zero clicks at a top rank, the signature of a tracking artifact (a redirect or canonical split), not a content problem. Ask "which ' + (c ? esc(c.name) + ' ' : '') + 'pages have tracking issues" to see them all.</div>' : '';
            // Navigational pages (C3): a service-name page (Mygovid) gets huge impressions and ~0 CTR because searchers want
            // the service site, not us - low CTR is EXPECTED, not a content problem. Flag so the head of this flagship list
            // isn't read as fixable (and the diagnose chip doesn't fire on it).
            const _lcNav = rows.filter(function (p) { return _isNavigational(p.name); });
            const _lcNavNote = _lcNav.length ? '<div style="font-size:0.72rem;color:var(--color-text-muted);margin-top:8px;padding:7px 10px;border:1px solid var(--color-border-primary);border-radius:8px;">' + _lcNav.length + ' of these are navigational (' + _lcNav.slice(0, 2).map(function (p) { return esc(p.name); }).join(', ') + (_lcNav.length > 2 ? ', and more' : '') + '): people search a service name to reach it, so low CTR is expected, not a snippet problem.</div>' : '';
            return { html: _rankCard(items, { nameLabel: 'Page', valueLabel: 'CTR', trackLabel: 'impr (6mo)' }) + _lcNote + _lcNavNote, ctrArtifact: !!(rows[0] && _ctrCliff(rows[0].s.position, rows[0].s.ctr, rows[0].s.impressions)), navTop: !!(rows[0] && _isNavigational(rows[0].name)), summary: 'High-impression, low-CTR pages' + (c ? ' in ' + c.name : '') + ': ' + rows.slice(0, 5).map(function (p) { return p.name + ' (' + fmt(p.s.impressions) + ' impr, ' + _ctrTxt(p.s.ctr) + ')'; }).join(', ') + '.', data: { columns: [{ key: 'page', label: 'Page' }, { key: 'impressions', label: 'Impressions' }, { key: 'ctr', label: 'CTR %' }, { key: 'url', label: 'URL' }], rows: rows.map(function (p) { return { page: p.name, impressions: p.s.impressions || 0, ctr: +((p.s.ctr || 0) * 100).toFixed(2), url: p.url }; }), chart: { type: 'bar', x: 'page', y: 'impressions', label: 'Impressions' }, shareBase: (c ? c.rollup.impressions : r.totals.impressions) || 0, shareKey: 'impressions', shareNoun: 'impressions, barely clicked' } };
        }
        if (intent === 'stale') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const now = Date.now();
            const rows = pages.map(function (p) { const t = p.lm ? Date.parse(p.lm) : NaN; return { p: p, m: isNaN(t) ? null : (now - t) / (1000 * 60 * 60 * 24 * 30.44) }; }).filter(function (x) { return x.m != null && x.m > 12; }).sort(function (a, b) { return b.m - a.m; }).slice(0, limit);
            let _staleTr = {};   // 6-month impression trajectory per row: a stale page that is ALSO fading is the urgent one
            try { _staleTr = await _pageTrends(rows.map(function (x) { return x.p; }), 6, 30, 'impressions'); } catch (e) {}
            const items = rows.map(function (x) { const sk = _staleTr[normUrl(x.p.url)], s = x.p.s || {}; return { name: x.p.name, val: Math.round(x.m) + 'mo', bar: x.m, url: x.p.url, artifact: _ctrCliff(s.position, s.ctr, s.impressions), spark: (sk && sk.some(function (v) { return v > 0; })) ? sk : null }; });   // guard propagation: a stale page that is also a tracking artifact is flagged (the _rankCard ⚠ lever)
            return { html: _rankCard(items, { nameLabel: 'Page', valueLabel: 'Age', trackLabel: 'impr (6mo)' }), summary: (rows.length ? rows.length : 'No') + ' stale pages' + (c ? ' in ' + c.name : '') + ' (over 12 months old)' + (rows.length ? ', oldest: ' + rows.slice(0, 4).map(function (x) { return x.p.name + ' (' + Math.round(x.m) + 'mo)'; }).join(', ') : '') + '.', data: { columns: [{ key: 'page', label: 'Page' }, { key: 'monthsOld', label: 'Months old' }, { key: 'lastModified', label: 'Last modified' }, { key: 'url', label: 'URL' }], rows: rows.map(function (x) { return { page: x.p.name, monthsOld: Math.round(x.m), lastModified: x.p.lm || '', url: x.p.url }; }), chart: { type: 'bar', x: 'page', y: 'monthsOld', label: 'Months old' } } };
        }
        if (intent === 'compare') {
            const names = plan.categories || [];
            const a = _catByName(cats, names[0]), b = _catByName(cats, names[1]);
            if (!a || !b) return { html: '', summary: '', err: 'I need two categories to compare.' };
            // B1: compare is a JUDGEMENTAL surface (X vs Y). A section whose CTR is dragged by tracking artifacts would be
            // silently graded as failing content, when the story is moved URLs. Reach the rollup guard here too: mark the
            // affected CTR cell (chart + tile) and carry the recomputed rate in the verdict line so the judgement is honest.
            const _raA = _rollupArtifacts(catPages(a)), _raB = _rollupArtifacts(catPages(b));
            const _ctrP = _ctrPair(a.rollup.ctr, b.rollup.ctr);   // precision on demand (tie or sub-0.5%)
            const _dragNote = function (nm, ra) { return ra.dragged ? ' ' + nm + '’s CTR is dragged by ' + ra.count + ' tracking artifact' + (ra.count === 1 ? '' : 's') + ' (about ' + _ctrTxt(ra.exCtr) + ' without them).' : ''; };
            const _cmpCaveat = _dragNote(a.name, _raA) + _dragNote(b.name, _raB);
            return { html: '<div style="font-weight:700;margin:2px 0 6px;">' + esc(a.name) + '</div>' + _stripCard(a.rollup, hasGA4, _raA.dragged) + '<div style="font-weight:700;margin:12px 0 6px;">' + esc(b.name) + '</div>' + _stripCard(b.rollup, hasGA4, _raB.dragged),
                summary: a.name + ' vs ' + b.name + ': impressions ' + fmt(a.rollup.impressions) + ' vs ' + fmt(b.rollup.impressions) + ', CTR ' + _ctrP[0] + (_raA.dragged ? '*' : '') + ' vs ' + _ctrP[1] + (_raB.dragged ? '*' : '') + '.' + _cmpCaveat, data: { columns: [{ key: 'metric', label: 'Metric' }, { key: 'a', label: a.name }, { key: 'b', label: b.name }], rows: (function () { const ra = _metricRows(a.rollup, hasGA4), rb = _metricRows(b.rollup, hasGA4); return ra.map(function (x, i) { const row = { metric: x.metric, a: x.value, b: rb[i].value }; if (/CTR/i.test(x.metric)) { row.aMark = _raA.dragged; row.bMark = _raB.dragged; } return row; }); })(), chart: { type: 'smallmultiples', a: a.name, b: b.name } } };
        }
        if (intent === 'movers') {
            // IDIOM (deliberate, do not "unify" with section_movers): page movers use the DUMBBELL (many
            // pages, size-skewed, absolute levels matter) while section_movers keep DIVERGING bars (few,
            // comparable, % change is the honest comparator). Two idioms, one question, two scales — chosen.
            const c = _catByName(cats, plan.category);
            const prior = await getPriorMaps(window.treeData, _ddDays);
            const useImp = (c ? c.rollup.impressions : r.totals.impressions) > 0;
            const mkey = useImp ? 'impressions' : 'pageViews';
            const priorBy = useImp ? prior.gscBy : prior.ga4By;
            const pages = c ? catPages(c) : _allPages(r);
            let rows = pages.map(function (p) {
                const cur = p.s[mkey] || 0;
                const prev = (p.urls || [p.url]).reduce(function (sum, u) { const pr = priorBy[normUrl(u)]; return sum + (pr ? (pr[mkey] || 0) : 0); }, 0);
                return { name: p.name, url: p.url, cur: cur, prev: prev, pct: prev >= 100 ? (cur - prev) / prev * 100 : null };
            }).filter(function (x) { return x.pct != null; });
            const dir = plan.direction || 'both';
            if (dir === 'up') rows = rows.filter(function (x) { return x.pct > 0; });
            else if (dir === 'down') rows = rows.filter(function (x) { return x.pct < 0; });
            // "which pages are MOVING" (both) literally asks for the biggest MOVEMENT -> sort by absolute change, not by
            // %, so a 101K->1 page outranks a 175->543 page (B2: pct-sort buried the two six-figure events at ranks 5-6).
            // up/down keep %-sort (biggest proportional riser/faller is the honest read there).
            const _mv = function (x) { return Math.abs((x.cur || 0) - (x.prev || 0)); };
            if (dir === 'both') { rows.sort(function (a, b) { return _mv(b) - _mv(a); }); rows = rows.slice(0, limit); }
            else { rows.sort(function (a, b) { return Math.abs(b.pct) - Math.abs(a.pct); }); rows = rows.slice(0, limit).sort(function (a, b) { return b.pct - a.pct; }); }
            const items = rows.map(function (x) { const up = x.pct >= 0, pa = Math.abs(x.pct); return { name: x.name, val: (up ? '▲ ' : '▼ ') + (pa > 500 ? '500+' : pa.toFixed(0)) + '%', bar: Math.min(500, pa), col: up ? '#059669' : '#dc2626', valCol: up ? '#059669' : '#dc2626', url: x.url, artifact: _imprCliff(x.prev, x.cur) }; });
            const _vanished = rows.filter(function (x) { return _imprCliff(x.prev, x.cur); });
            // Count, list and naming must agree (C2): name up to 3 (biggest first, rows are movement-sorted) then say how many more.
            const _vanNames = _vanished.slice(0, 3).map(function (x) { return x.name; }).join(', ') + (_vanished.length > 3 ? ', and ' + (_vanished.length - 3) + ' more' : '');
            const _vanNote = _vanished.length ? ' ' + _vanished.length + ' page' + (_vanished.length === 1 ? '' : 's') + ' dropped to near-zero impressions (' + _vanNames + '), the signature of a URL going dark in search (deindexed or redirected), not a demand drop. Ask "how has ' + _vanished[0].name + ' trended" to date it.' : '';
            const _nd = _netDelta(rows, 'cur', 'prev');   // weighted aggregate change across the shown movers (override path)
            const _mword = mkey === 'pageViews' ? 'views' : 'impressions';
            const _mvHead = _moversHeadline(_nd, dir, _mword);   // magnitude only: no % over a direction-filtered top-N (see _moversHeadline)
            return { html: _rankCard(items, { nameLabel: 'Page', valueLabel: 'Change %' }),
                headline: _mvHead,
                summary: 'Biggest ' + (dir === 'down' ? 'fallers' : dir === 'up' ? 'risers' : 'movers') + (c ? ' in ' + c.name : ' across the site') + ' vs the previous ' + _ddDays + ' days: ' + rows.slice(0, 5).map(function (x) { return x.name + ' ' + (x.pct >= 0 ? '+' : '') + x.pct.toFixed(0) + '%'; }).join(', ') + '.' + _vanNote, data: { columns: [{ key: 'page', label: 'Page' }, { key: 'previous', label: 'Before' }, { key: 'current', label: 'After' }, { key: 'changePct', label: 'Change %' }, { key: 'url', label: 'URL' }], rows: rows.map(function (x) { return { page: x.name, previous: x.prev, current: x.cur, changePct: +x.pct.toFixed(1), url: x.url }; }), chart: { type: 'dumbbell', label: 'page', before: 'previous', after: 'current', url: 'url', shared: true } } };
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
                const _qf = qs.filter(function (x) { return x[mkey] > 0; });
                const _qbase = _qf.reduce(function (s, x) { return s + (x[mkey] || 0); }, 0);   // scope total (all queries) -> the share is limit-stable in meaning
                qs = _qf.sort(function (a, b) { return b[mkey] - a[mkey]; }).slice(0, limit);
                if (!qs.length) return { html: '', summary: '', err: 'No search queries found' + (c ? ' for ' + c.name : '') + ' in this period.' };
                const items = qs.map(function (x) {
                    return { name: x.query, val: fmt(x[mkey]) + (x.bestPos != null ? ' · #' + x.bestPos.toFixed(0) : ''), bar: x[mkey], url: x.bestPage };
                });
                return { html: _rankCard(items, { nameLabel: 'Query', valueLabel: mkey === 'clicks' ? 'Clicks' : 'Impressions' }),
                    summary: 'Top searches' + (c ? ' in ' + c.name : ' site-wide') + ' by ' + mkey + ' (' + periodLabel(_ddDays) + '): ' +
                        qs.slice(0, 6).map(function (x) { return '"' + x.query + '" ' + fmt(x[mkey]) + (x.bestPos != null ? ' (best pos ' + x.bestPos.toFixed(0) + ')' : ''); }).join(', ') + _sentenceCap(Math.min(6, qs.length), qs.length), data: { columns: [{ key: 'query', label: 'Query' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }, { key: 'bestPosition', label: 'Best position' }, { key: 'section', label: 'Category' }, { key: 'bestPage', label: 'Best page' }], rows: qs.map(function (x) { return { query: x.query, impressions: x.impressions, clicks: x.clicks, bestPosition: x.bestPos != null ? +x.bestPos.toFixed(1) : null, section: x.category || '', bestPage: x.bestPage || '' }; }), chart: { type: 'bar', x: 'query', y: mkey, label: mkey === 'clicks' ? 'Clicks' : 'Impressions' }, shareBase: _qbase, shareKey: mkey, shareNoun: mkey === 'clicks' ? 'search clicks' : 'search impressions' } };
            }

            // opportunities: rank by potential extra clicks; floors keep out noise.
            const _oppPool = qs.filter(function (x) { return x.impressions >= 100 && x.potential >= 5; });
            // Artifact queries (near-zero CTR at a top rank) produce FICTIONAL potential - keep a tracking split off
            // the #1-priority slot (A7: Medical Card was ranked top on artifact CTR). Surface them as investigate-first,
            // don't silently drop - the demand to fix the tracking is real, the "content upside" is not.
            const _oppArts = _oppPool.filter(function (x) { return x.artifact; }).sort(function (a, b) { return b.impressions - a.impressions; });
            // Navigational queries (brand/service names) are demand for ANOTHER site, not content upside - exclude from the
            // ranked opportunities and name them, so a quarter-million "mywelfare" impressions aren't priced as +5.5K clicks (B8).
            const _oppNav = _oppPool.filter(function (x) { return !x.artifact && x.navigational; }).sort(function (a, b) { return b.impressions - a.impressions; });
            // Denominator honesty (C4): the headline sums the SHOWN rows; if the winnable pool is larger, say so, so "~179K on
            // the table" isn't read as the site's total when hundreds more sit below the cut.
            const _winPool = _oppPool.filter(function (x) { return !x.artifact && !x.navigational; }).sort(function (a, b) { return b.potential - a.potential; });
            qs = _winPool.slice(0, limit);
            const _morePot = _winPool.slice(limit).reduce(function (s, x) { return s + (x.potential || 0); }, 0);
            const _oppMore = _winPool.length > qs.length ? ' (the biggest ' + qs.length + ' of ' + _winPool.length + ' winnable queries; ~' + fmt(Math.round(_morePot)) + ' more clicks/mo sit below the cut)' : '';
            const _artNote = (_oppArts.length
                ? '<div style="font-size:0.72rem;color:#d97706;margin-top:10px;padding:7px 10px;border:1px solid rgba(217,119,6,0.3);border-radius:8px;background:rgba(217,119,6,0.06);">' + _oppArts.length + ' high-impression quer' + (_oppArts.length === 1 ? 'y' : 'ies') + ' left out: near-zero CTR at a top rank looks like a tracking artifact, not real upside (' + _oppArts.slice(0, 3).map(function (x) { return '"' + esc(x.query) + '"'; }).join(', ') + '). Investigate the page URL and canonical first.</div>'
                : '') + (_oppNav.length
                ? '<div style="font-size:0.72rem;color:var(--color-text-muted);margin-top:8px;padding:7px 10px;border:1px solid var(--color-border-primary);border-radius:8px;">' + _oppNav.length + ' navigational quer' + (_oppNav.length === 1 ? 'y' : 'ies') + ' left out (' + _oppNav.slice(0, 3).map(function (x) { return '"' + esc(x.query) + '"'; }).join(', ') + '): people typing a service name to reach it, likely not winnable as content.</div>'
                : '');
            if (!qs.length) return (_oppArts.length || _oppNav.length)
                ? { html: _artNote, summary: 'No winnable content opportunities' + (c ? ' in ' + c.name : '') + ': the big low-CTR queries here are ' + (_oppArts.length ? 'measurement artifacts' : '') + (_oppArts.length && _oppNav.length ? ' or ' : '') + (_oppNav.length ? 'navigational (people seeking another service)' : '') + ', not content upside. See the notes.', data: { columns: [], rows: [] } }
                : { html: '', summary: '', err: 'No sizeable search opportunities found' + (c ? ' in ' + c.name : '') + ' for ' + periodLabel(_ddDays) + ', CTR looks healthy on the big queries.' };
            return { html: _oppCard(qs) + _artNote,
                summary: 'Biggest search opportunities' + (c ? ' in ' + c.name : '') + ' (potential extra clicks over ' + periodLabel(_ddDays) + ', if each performed like a top-3 result): ' +
                    qs.slice(0, 5).map(function (x) { return '"' + x.query + '" +' + fmt(Math.round(x.potential)) + ' clicks (best pos ' + (x.bestPos != null ? x.bestPos.toFixed(0) : '?') + ', ' + (x.label || '') + ')'; }).join(', ') + '.' + _oppMore, data: { columns: [{ key: 'query', label: 'Query' }, { key: 'potentialClicks', label: 'Potential clicks' }, { key: 'bestPosition', label: 'Best position' }, { key: 'impressions', label: 'Impressions' }, { key: 'ctr', label: 'CTR %' }, { key: 'action', label: 'Action' }, { key: 'section', label: 'Category' }, { key: 'bestPage', label: 'Best page' }], rows: qs.map(function (x) { return { query: x.query, potentialClicks: Math.round(x.potential), bestPosition: x.bestPos != null ? +x.bestPos.toFixed(1) : null, impressions: x.impressions, ctr: +((x.ctr || 0) * 100).toFixed(2), action: x.label || '', section: x.category || '', bestPage: x.bestPage || '' }; }), chart: { type: 'ladder', label: 'query', pos: 'bestPosition', size: 'potentialClicks', sizeLabel: 'potential clicks/mo', url: 'bestPage' } } };
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
                return { html: _worldSearchMapHtml(rows) + _rankCard(items, { nameLabel: 'Country', valueLabel: mkey === 'clicks' ? 'Clicks' : 'Impressions' }),
                    summary: 'Countries searching the site the most (excluding Ireland, ' + periodLabel(_ddDays) + ', by ' + mkey + '): ' + cs.slice(0, 6).map(function (x) { return _countryName(x.country) + ' ' + fmt(x[mkey]); }).join(', ') + '.',
                    scope: { label: null, country: null },   // country data is site-wide, never category-scoped: the chip must not claim a section (A10)
                    data: { columns: [{ key: 'country', label: 'Country' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }], rows: cs.map(function (x) { return { country: _countryName(x.country), impressions: x.impressions, clicks: x.clicks }; }), chart: { type: 'map', label: mkey === 'clicks' ? 'Clicks' : 'Impressions' } } };
            }

            // international_queries: top searches from abroad, or from a named country.
            const code = plan.country ? _resolveCountry(plan.country) : null;
            const scopeName = code ? _countryName(code) : 'abroad';
            const keep = code ? function (c) { return c === code; } : function (c) { return c && c !== 'irl'; };
            const qs = _aggCountryQueries(rows, keep).filter(function (x) { return x.impressions > 0; })
                .sort(function (a, b) { return b.impressions - a.impressions; }).slice(0, limit);
            if (!qs.length) return { html: '', summary: '', err: 'No searches found from ' + scopeName + ' for ' + periodLabel(_ddDays) + '.' + (plan.country && !code ? ' (I didn\'t recognise that country.)' : '') };
            const items = qs.map(function (x) { return { name: x.query, val: fmt(x.impressions), bar: x.impressions }; });
            return { html: _rankCard(items, { nameLabel: 'Query', valueLabel: 'Impressions' }),
                summary: 'Top searches from ' + scopeName + ' (' + periodLabel(_ddDays) + '): ' + qs.slice(0, 6).map(function (x) { return '"' + x.query + '" ' + fmt(x.impressions) + ' impr' + (!code && x.topCountry ? ' (mostly ' + _countryName(x.topCountry) + ')' : ''); }).join(', ') + '.',
                scope: { label: null, country: code ? _countryName(code) : null },   // scope-ignoring by design (v1): country queries are site-wide, so the chip shows the RESOLVED country (America -> United States), never a section (A10)
                data: { columns: [{ key: 'query', label: 'Query' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }].concat(code ? [] : [{ key: 'topCountry', label: 'Top country' }]), rows: qs.map(function (x) { return { query: x.query, impressions: x.impressions, clicks: x.clicks, topCountry: _countryName(x.topCountry) }; }), chart: { type: 'bar', x: 'query', y: 'impressions', label: 'Impressions' } } };
        }
        if (intent === 'trend') {
            const tmetric = ['impressions', 'clicks', 'pageViews', 'users'].indexOf(metric) >= 0 ? metric : 'impressions';
            const N = 6, win = 30;
            let targets;
            if (plan.categories && plan.categories.length >= 2) { const a = _catByName(cats, plan.categories[0]), b = _catByName(cats, plan.categories[1]); targets = [a, b].filter(Boolean); }
            if (!targets || !targets.length) targets = [_catByName(cats, plan.category)];   // may be [null] = whole site
            // Fetch once; compute ALL metrics per period so the chart's metric toggle needs no re-fetch.
            const TM = ['impressions', 'clicks', 'pageViews', 'users'];
            const periods = [], byMetric = {}; TM.forEach(function (m) { byMetric[m] = targets.map(function () { return []; }); });
            for (let i = N - 1; i >= 0; i--) {
                periods.push(i === 0 ? 'now' : i + 'mo ago');
                let rb = null;
                try { const maps = await fetchTrendWindow(window.treeData, win, i * win); rb = build(window.treeData, { statsFor: statsForMaps(maps.gscBy, maps.ga4By) }); } catch (e) {}
                targets.forEach(function (tg, ti) {
                    let rollup = null;
                    if (rb) { if (tg) { const cc = _catByName(rb.categories, tg.name); rollup = cc ? cc.rollup : null; } else rollup = rb.totals; }
                    TM.forEach(function (m) { byMetric[m][ti].push(rollup ? Math.round(_mval(rollup, m)) : 0); });
                });
            }
            build(window.treeData);   // restore current-period annotations on the tree
            const names = targets.map(function (t) { return t ? t.name : 'The site'; });
            const hasM = function (m) { return byMetric[m].some(function (v) { return v.filter(function (x) { return x > 0; }).length >= 2; }); };
            const avail = TM.filter(hasM);
            if (!avail.length) return { html: '', summary: '', err: 'Not enough history to plot a trend for ' + names.join(' / ') + '. (Needs GSC/GA4 data across several months.)' };
            const curMetric = hasM(tmetric) ? tmetric : avail[0];   // requested metric if it has data, else the first that does
            const seriesFor = function (m) { return byMetric[m].map(function (v, ti) { return { name: names[ti], values: v }; }); };
            const viewFor = function (m) {
                const ser = seriesFor(m), chart = { type: 'line', label: _MLABEL[m], fillGap: targets.length === 2 };   // shade the lead between the two sections
                const cols = [{ key: 'period', label: 'Period' }].concat(ser.map(function (s) { return { key: s.name || 'value', label: (s.name ? s.name + ' · ' : '') + _MLABEL[m] }; }));
                const rws = periods.map(function (p, i) { const row = { period: p }; ser.forEach(function (s) { row[s.name || 'value'] = s.values[i]; }); return row; });
                return { body: _renderChart({ periods: periods, series: ser, chart: chart }), columns: cols, rows: rws, chart: chart, series: ser };
            };
            const metricViews = {}; avail.forEach(function (m) { metricViews[m] = viewFor(m); });
            // Indexed overlay: all metrics on ONE chart, each scaled to its own 0-100 so you compare
            // SHAPES (raw scales differ wildly). Single-target only; tooltips still show real values.
            if (targets.length === 1 && avail.length >= 2) {
                const ovSeries = avail.map(function (m) {
                    const vals = metricViews[m].series[0].values;
                    const mx = Math.max.apply(null, vals.concat([1]));
                    return { name: _MLABEL[m], values: vals.map(function (v) { return mx > 0 ? Math.round(v / mx * 1000) / 10 : 0; }), raw: vals };
                });
                const ovChart = { type: 'line', label: 'indexed 0–100 (each metric to its own peak)' };
                metricViews.__overlay = {
                    body: _renderChart({ periods: periods, series: ovSeries, chart: ovChart }),
                    columns: [{ key: 'period', label: 'Period' }].concat(avail.map(function (m) { return { key: m, label: _MLABEL[m] }; })),
                    rows: periods.map(function (p, i) { const row = { period: p }; avail.forEach(function (m) { row[m] = metricViews[m].series[0].values[i]; }); return row; }),
                    chart: ovChart, series: ovSeries
                };
                avail.push('__overlay');
            }
            const cur = metricViews[curMetric];
            const summaryParts = cur.series.map(function (s) { const f = s.values[0], l = s.values[s.values.length - 1], chg = f > 0 ? Math.round((l - f) / f * 100) : null; return s.name + ' ' + fmt(f) + '->' + fmt(l) + (chg != null ? ' (' + (chg >= 0 ? '+' : '') + chg + '%)' : ''); });
            return {
                html: '',
                summary: (targets.length > 1 ? 'Trend comparison' : 'Trend') + ' over the last ' + N + ' months by ' + _MLABEL[curMetric] + ': ' + summaryParts.join('; ') + '.',
                data: { columns: cur.columns, rows: cur.rows, periods: periods, series: cur.series, metric: curMetric, availableMetrics: avail, metricViews: metricViews, chart: cur.chart }
            };
        }
        if (intent === 'diagnose') {
            const _ref = plan.page || plan.category || '';
            const _res = _resolvePage(r, _ref);
            if (_res.none) return _pageNotFound(_ref, r);
            if (_res.candidates) return { html: _disambig('diagnose', _res.candidates, _ref), summary: 'Several pages match "' + _ref + '", pick one.', data: { columns: [], rows: [] }, disambig: true };
            const page = _res.page;
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
            const _ci = _contentIntel(page);   // on-page intel (readability/words/meta/noindex); consumed by the signals below and the Content tip (A8: was referenced but never defined -> ReferenceError on every diagnose)
            const signals = [];
            if (impressions < 50) signals.push({ sev: 'info', t: 'Low search demand', d: 'Only ' + fmt(impressions) + ' impressions - few people search for this topic.' });
            if (position != null && position > 15 && impressions >= 50) signals.push({ sev: 'warn', t: 'Weak ranking', d: 'Ranks about #' + position.toFixed(0) + ' - needs stronger content or internal links to climb.' });
            else if (position != null && position > 7 && position <= 15) signals.push({ sev: 'info', t: 'Striking distance', d: 'Just off page one at #' + position.toFixed(0) + ' - a refresh could push it up.' });
            if (position != null && position <= 10 && bench > 0 && ctr < bench * 0.6 && impressions >= 50) signals.push({ sev: 'warn', t: 'Low click-through', d: 'Ranks well (#' + position.toFixed(0) + ') but only ' + _ctrTxt(ctr) + ' click (typical is ~' + (bench * 100).toFixed(0) + '%) - the title/meta description may not be compelling.' });
            if (months != null && months > 18) signals.push({ sev: 'warn', t: 'Stale content', d: 'Last updated about ' + Math.round(months) + ' months ago - a refresh may help.' });
            else if (months != null && months > 12) signals.push({ sev: 'info', t: 'Ageing content', d: 'Last updated about ' + Math.round(months) + ' months ago.' });
            if (impChg != null && impChg <= -20) signals.push({ sev: 'warn', t: 'Declining', d: 'Impressions down ' + Math.abs(impChg) + '% vs the previous period.' });
            else if (impChg != null && impChg >= 20) signals.push({ sev: 'good', t: 'Growing', d: 'Impressions up ' + impChg + '% vs the previous period.' });
            if (s.engagementRate != null && (s.sessions || 0) >= 20 && s.engagementRate < 0.4) signals.push({ sev: 'warn', t: 'Low engagement', d: 'Only ' + Math.round(s.engagementRate * 100) + '% of visits are engaged - people arrive but leave without reading. Check the intro, layout and whether the page answers the search.' });
            if (_ci) _ci.findings.forEach(function (f) { signals.push({ sev: f.sev, t: f.t, d: f.d }); });
            // AI-exposure hypothesis (ambient): pull the engine (wait once per period — a diagnosis must
            // not silently omit its sharpest hypothesis). Findings rank by clicks/mo at stake; exposure
            // carries the only magnitude here so it LEADS, artifact leads as the causal reframe, and an
            // engine-fetch failure appends an honest "unavailable" note (distinct from "checked, clean").
            if (window.GSCIntegration && window.GSCIntegration.isConnected && window.GSCIntegration.isConnected()) {
                let _A; try { _A = await getAIImpact(_ddDays); } catch (e) {}
                const _af = _aiFinding(page.urls || [page.url], _A);
                if (_af && (_af.kind === 'exposed' || _af.kind === 'artifact')) signals.unshift({ sev: _af.sev, t: _af.t, d: _af.d });
                else if (_af && _af.kind === 'unavailable') signals.push({ sev: _af.sev, t: _af.t, d: _af.d });
            }
            if (!signals.length) signals.push({ sev: 'good', t: 'Looks healthy', d: 'No obvious problems - metrics are in a reasonable range.' });
            const sevCol = { warn: '#d97706', info: '#0369a1', good: '#059669' };
            const sigHtml = signals.map(function (x) { return '<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--color-border-primary);font-size:0.82rem;"><span style="width:7px;height:7px;border-radius:50%;background:' + sevCol[x.sev] + ';margin-top:5px;flex-shrink:0;"></span><span><span style="font-weight:700;color:var(--color-text-primary);">' + esc(x.t) + '</span> <span style="color:var(--color-text-secondary);">' + esc(x.d) + '</span></span></div>'; }).join('');
            const head = '<div class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(page.url) + '" style="cursor:pointer;font-weight:700;color:var(--color-text-heading);margin-bottom:4px;">' + esc(page.name) + '</div>';
            const stat = '<div style="font-size:0.72rem;color:var(--color-text-muted);margin-bottom:12px;">' + fmt(impressions) + ' impr &middot; ' + _ctrTxt(ctr) + ' CTR &middot; pos ' + (position != null ? position.toFixed(1) : '-') + (pv ? (' &middot; ' + fmt(pv) + ' views') : '') + (impChg != null ? (' &middot; ' + (impChg >= 0 ? '+' : '') + impChg + '% vs prev') : '') + '</div>';
            const sigCard = '<div style="border:1px solid var(--color-border-primary);border-radius:10px;background:var(--color-bg-primary);padding:2px 12px;margin-bottom:12px;">' + sigHtml + '</div>';
            const ciNote = _ci ? '' : '<div style="font-size:0.62rem;color:var(--color-text-muted);margin:-4px 0 12px;">Tip: open this page&rsquo;s <b>Content</b> tab for on-page checks too (title, meta description, readability).</div>';
            const qCard = topQ.length ? ('<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:6px;">Top queries for this page</div>' + _rankCard(topQ.map(function (x) { return { name: x.query, val: fmt(x.impressions), bar: x.impressions }; }), { nameLabel: 'Query', valueLabel: 'Impressions' })) : '';
            return {
                html: head + stat + sigCard + ciNote + qCard,
                summary: 'Page "' + page.name + '": ' + fmt(impressions) + ' impressions, ' + _ctrTxt(ctr) + ' CTR, position ' + (position != null ? position.toFixed(1) : 'n/a') + (impChg != null ? (', ' + (impChg >= 0 ? '+' : '') + impChg + '% vs previous period') : '') + (months != null ? (', updated ~' + Math.round(months) + 'mo ago') : '') + '. Findings: ' + signals.map(function (x) { return x.t + ' (' + x.d + ')'; }).join('; ') + '.',
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
                html: _rankCard(items, { nameLabel: 'Question', valueLabel: 'Impressions' }),
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
                html: _rankCard(items, { nameLabel: 'Page', valueLabel: 'English vs Irish' }),
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
            const items = _cannibalisation(rows, c ? c.name : null, urlCat, _urlToPageName(r)).slice(0, limit);
            if (!items.length) return { html: '', summary: '', err: 'No cannibalisation found' + (c ? ' in ' + c.name : '') + ' - no queries have 2+ of your pages each drawing 10+ impressions.' };
            return {
                html: _cannibalCard(items),
                summary: 'Queries where several of your own pages compete' + (c ? ' in ' + c.name : '') + ' (' + periodLabel(_ddDays) + '): ' + items.slice(0, 5).map(function (it) { return '"' + it.query + '" (' + it.competing + ' pages, ' + fmt(it.total) + ' impr)'; }).join('; ') + '.',
                data: { columns: [{ key: 'query', label: 'Query' }, { key: 'competingPages', label: 'Competing pages' }, { key: 'totalImpressions', label: 'Total impressions' }, { key: 'page', label: 'Page' }, { key: 'pageImpressions', label: 'Page impressions' }, { key: 'position', label: 'Position' }], rows: items.reduce(function (acc, it) { it.pages.forEach(function (p) { acc.push({ query: it.query, competingPages: it.competing, totalImpressions: it.total, page: p.url, pageImpressions: p.impressions, position: p.position != null ? +p.position.toFixed(1) : '' }); }); return acc; }, []), chart: null }
            };
        }
        if (intent === 'briefing') {
            const c = _catByName(cats, plan.category);
            const scopeName = c ? c.name : 'the site';
            const scopeTitle = scopeName === 'the site' ? 'Whole site' : scopeName;
            const ctx = await _briefingContext(r);
            const top = _sectionActions(c, r, ctx);
            const rollup = c ? c.rollup : r.totals;
            const hasGA4b = r.totals.pageViews > 0 || r.totals.users > 0;
            // Compact one-line context (NOT the full section strip — that's the section_summary answer; the
            // briefing's job is priorities, and its most action-dense answer shouldn't open with its least).
            const statsLine = '<div style="font-weight:700;font-size:0.95rem;color:var(--color-text-heading);">' + esc(scopeTitle) + '</div><div style="font-size:0.68rem;color:var(--color-text-muted);margin-bottom:12px;">' + fmt(rollup.impressions) + ' impr &middot; ' + _ctrTxt(rollup.ctr) + ' CTR' + (hasGA4b ? ' &middot; ' + fmt(rollup.pageViews) + ' views' : '') + ' &middot; ' + fmt(rollup.leafCount || 0) + ' pages</div>';
            const md = '# Briefing: ' + scopeTitle + ' (' + periodLabel(_ddDays) + ')\n\n' + _briefMarkdown(scopeTitle, rollup, top);
            if (!top.length) return { html: statsLine + '<div style="font-size:0.85rem;color:var(--color-text-secondary);margin-top:4px;">No urgent priorities right now, ' + esc(scopeName) + ' looks healthy. Try "biggest search opportunities' + (c ? ' in ' + c.name : '') + '".</div>', summary: esc(scopeName) + ' has no urgent priorities right now.', data: { columns: [], rows: [] }, markdown: md };
            const _rk = top.slice(0, top._rankedCount || top.length), _fr = top.slice(top._rankedCount || top.length);
            const _muted = 'font-size:0.68rem;color:var(--color-text-muted);margin-top:8px;';
            const aiTail = (top._aiExposedTotal > 2) ? '<div style="' + _muted + '">+' + (top._aiExposedTotal - 2) + ' more exposed page' + (top._aiExposedTotal - 2 === 1 ? '' : 's') + ' in the AI Impact report.</div>' : '';
            const coldLine = (!top._aiChecked && top._gscOn) ? '<div style="' + _muted + '">AI exposure not yet checked this period. Open the AI Impact report to include it.</div>' : '';
            const html = statsLine + '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin:0 0 8px;">Your priorities (ranked by estimated impact)</div>' + _briefCard(_rk) + aiTail +
                (_fr.length ? '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin:14px 0 8px;">Also worth a look</div>' + _briefCard(_fr) : '') + coldLine;
            return {
                html: html,
                summary: 'Top priorities for ' + scopeName + ' (' + periodLabel(_ddDays) + '): ' + top.slice(0, 5).map(function (it, i) { return (i + 1) + ') ' + it.type + ' - ' + it.title.replace(/"/g, '') + ' (' + it.detail + ')'; }).join('; ') + '.',
                data: { columns: [{ key: 'priority', label: '#' }, { key: 'type', label: 'Type' }, { key: 'action', label: 'Action' }, { key: 'detail', label: 'Detail' }, { key: 'url', label: 'URL' }], rows: top.map(function (it, i) { return { priority: i + 1, type: it.type, action: it.title.replace(/"/g, ''), detail: it.detail, url: it.url || '' }; }), chart: null },
                markdown: md
            };
        }
        if (intent === 'digest') {
            const ctx = await _briefingContext(r);
            const sections = cats.slice().sort(function (a, b) { return b.rollup.impressions - a.rollup.impressions; });
            let md = '# Weekly digest (' + periodLabel(_ddDays) + ')\n\n';
            const previews = [];
            sections.forEach(function (sc) {
                const acts = _sectionActions(sc, r, ctx);
                if (!acts.length) return;
                md += _briefMarkdown(sc.name, sc.rollup, acts);
                previews.push({ name: sc.name, rollup: sc.rollup, actions: acts });
            });
            if (!previews.length) return { html: '<div style="font-size:0.9rem;color:var(--color-text-secondary);">All categories look healthy - no urgent priorities across the site right now.</div>', summary: 'All categories look healthy - no urgent priorities.', data: { columns: [], rows: [] }, markdown: md };
            const html = '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:10px;">Weekly digest - ' + previews.length + ' section' + (previews.length === 1 ? '' : 's') + ' need attention</div>' +
                previews.map(function (p) { return '<div style="margin-bottom:16px;"><div style="font-weight:700;margin-bottom:6px;font-size:0.9rem;">' + esc(p.name) + ' <span style="font-weight:400;font-size:0.68rem;color:var(--color-text-muted);">' + fmt(p.rollup.impressions) + ' impr</span></div>' + _briefCard(p.actions.slice(0, 3)) + '</div>'; }).join('') +
                ((!ctx.aiChecked && ctx.gscOn) ? '<div style="font-size:0.68rem;color:var(--color-text-muted);">AI exposure not yet checked this period. Open the AI Impact report to include it across sections.</div>' : '');
            const rows = [];
            previews.forEach(function (p) { p.actions.forEach(function (it, i) { rows.push({ section: p.name, priority: i + 1, type: it.type, action: it.title.replace(/"/g, ''), detail: it.detail, url: it.url || '' }); }); });
            return {
                html: html,
                summary: 'Weekly digest (' + periodLabel(_ddDays) + '): ' + previews.slice(0, 5).map(function (p) { return p.name + ' - ' + p.actions.length + ' action' + (p.actions.length === 1 ? '' : 's') + ' (top: ' + p.actions[0].type.toLowerCase() + ')'; }).join('; ') + '.',
                data: { columns: [{ key: 'section', label: 'Category' }, { key: 'priority', label: '#' }, { key: 'type', label: 'Type' }, { key: 'action', label: 'Action' }, { key: 'detail', label: 'Detail' }, { key: 'url', label: 'URL' }], rows: rows, chart: null },
                markdown: md
            };
        }
        if (intent === 'page_queries') {
            const _ref = plan.page || plan.category || '';
            const _res = _resolvePage(r, _ref);
            if (_res.none) return _pageNotFound(_ref, r);
            if (_res.candidates) return { html: _disambig('page_queries', _res.candidates, _ref), summary: 'Several pages match "' + _ref + '", pick one.', data: { columns: [], rows: [] }, disambig: true };
            const page = _res.page;
            let all;
            try { all = await getQueryRows(_ddDays); }
            catch (e) { return { html: '', summary: '', err: 'Could not fetch search-query data: ' + (e && e.message ? e.message : String(e)) }; }
            if (all == null) {
                const _g = window.GSCIntegration, _c = _g && _g.isConnected && _g.isConnected();
                return { html: '', summary: '', err: _c ? 'Search-query data needs the updated GSC module. Redeploy gsc-integration-module.js (it must include fetchAllQueries) and hard-refresh.' : 'Search-query answers need a Search Console connection.' };
            }
            const set = {}; (page.urls || [page.url]).forEach(function (u) { set[normUrl(u)] = 1; });
            const byQ = {};
            all.forEach(function (row) {
                if (!set[normUrl(row.page || '')]) return;
                const q = row.query; if (!q) return;
                if (!byQ[q]) byQ[q] = { query: q, impressions: 0, clicks: 0, _ps: 0, _pw: 0, bestPos: null };
                const e = byQ[q], pos = row.position || 0; e.impressions += row.impressions || 0; e.clicks += row.clicks || 0;
                if ((row.impressions || 0) > 0 && pos > 0) { e._ps += pos * row.impressions; e._pw += row.impressions; if (e.bestPos == null || pos < e.bestPos) e.bestPos = pos; }
            });
            let qs = Object.keys(byQ).map(function (q) { const e = byQ[q]; const sc = _scoreQuery(e.impressions, e.clicks, e.bestPos); return { query: e.query, impressions: e.impressions, clicks: e.clicks, position: e._pw > 0 ? e._ps / e._pw : null, bestPos: e.bestPos, ctr: sc.ctr, potential: sc.potential, label: sc.label, bestPage: page.url, category: null }; });
            const by = metric === 'clicks' ? 'clicks' : 'impressions';
            const byPotential = !!plan.by_potential;
            if (byPotential) qs = qs.filter(function (x) { return x.potential >= 1; }).sort(function (a, b) { return b.potential - a.potential; }).slice(0, limit);
            else qs = qs.filter(function (x) { return x[by] > 0; }).sort(function (a, b) { return b[by] - a[by]; }).slice(0, limit);
            if (!qs.length) return { html: '', summary: '', err: (byPotential ? 'No clear quick wins found for "' : 'No search queries found for "') + page.name + '" in ' + periodLabel(_ddDays) + '.' + (byPotential ? ' (Its queries already convert well, or it gets little search traffic.)' : ' (It may get little search traffic, or mostly GA4/referral traffic.)') };
            const head = '<div class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(page.url) + '" style="cursor:pointer;font-weight:700;color:var(--color-text-heading);margin-bottom:8px;">' + esc(page.name) + '</div>';
            const footnote = '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:8px;">Based on the site-wide top-25k query/page pairs - very long-tail queries for small pages may be missing; the per-page report has the completist view.</div>';
            if (byPotential) {
                return { html: head + _oppCard(qs) + footnote,
                    summary: 'Quick wins for "' + page.name + '" (biggest extra-clicks potential, ' + periodLabel(_ddDays) + '): ' + qs.slice(0, 6).map(function (x) { return '"' + x.query + '" +' + fmt(Math.round(x.potential)) + ' (pos ' + (x.bestPos != null ? x.bestPos.toFixed(0) : '?') + ', ' + (x.label || '') + ')'; }).join(', ') + '.',
                    data: { columns: [{ key: 'query', label: 'Query' }, { key: 'potentialClicks', label: 'Potential clicks' }, { key: 'bestPosition', label: 'Best position' }, { key: 'impressions', label: 'Impressions' }, { key: 'ctr', label: 'CTR %' }, { key: 'action', label: 'Action' }], rows: qs.map(function (x) { return { query: x.query, potentialClicks: Math.round(x.potential), bestPosition: x.bestPos != null ? +x.bestPos.toFixed(1) : null, impressions: x.impressions, ctr: +((x.ctr || 0) * 100).toFixed(2), action: x.label || '' }; }), chart: { type: 'ladder', label: 'query', pos: 'bestPosition', size: 'potentialClicks', sizeLabel: 'potential clicks/mo' } } };
            }
            const items = qs.map(function (x) { return { name: x.query, val: fmt(x[by]) + (x.position != null ? ' · #' + x.position.toFixed(0) : ''), bar: x[by] }; });
            return {
                html: head + _rankCard(items, { nameLabel: 'Query', valueLabel: by === 'clicks' ? 'Clicks' : 'Impressions' }) + footnote,
                summary: 'Top search queries bringing people to "' + page.name + '" (' + periodLabel(_ddDays) + ', by ' + by + '): ' + qs.slice(0, 8).map(function (x) { return '"' + x.query + '" ' + fmt(x[by]) + (x.position != null ? ' (pos ' + x.position.toFixed(0) + ')' : ''); }).join(', ') + '.',
                data: { columns: [{ key: 'query', label: 'Query' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }, { key: 'position', label: 'Position' }], rows: qs.map(function (x) { return { query: x.query, impressions: x.impressions, clicks: x.clicks, position: x.position != null ? +x.position.toFixed(1) : '' }; }), chart: { type: 'ladder', label: 'query', pos: 'position', size: by } }
            };
        }
        if (intent === 'dead_pages') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const ga4On = r.totals.pageViews > 0 || r.totals.users > 0;
            const dead = pages.filter(function (p) { return (p.s.impressions || 0) === 0; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
            const total = pages.length;
            // Near-dead floor (B11): functionally-dark pages (1 to 9 impr) hide just above the zero threshold - surface them
            // even when NOTHING is fully dead, so "nothing invisible" can't hide a page sitting at 1 impression.
            const near = pages.filter(function (p) { const i = p.s.impressions || 0; return i > 0 && i < 10; }).sort(function (a, b) { return (a.s.impressions || 0) - (b.s.impressions || 0); });
            if (!dead.length && !near.length) return { html: '<div style="font-size:0.9rem;color:var(--color-text-secondary);">Every page' + (c ? ' in ' + esc(c.name) : '') + ' got at least some search impressions in ' + periodLabel(_ddDays) + ' - nothing invisible.</div>', summary: 'No pages with zero search impressions' + (c ? ' in ' + c.name : '') + '.', data: { columns: [], rows: [] } };
            const pctDead = _pctTxt(dead.length / (total || 1));   // routes through the shared formatter (C5): a 1-of-500 dead count reads "<1%", not "0%"
            const shown = dead.slice(0, limit);
            const items = shown.map(function (p) { return { name: p.name, val: ga4On ? (fmt(p.s.pageViews || 0) + ' views') : '0 impr', bar: ga4On ? (p.s.pageViews || 0) : 0, url: p.url }; });
            const _nearNote = near.length ? '<div style="font-size:0.72rem;color:#d97706;margin-top:8px;padding:7px 10px;border:1px solid rgba(217,119,6,0.3);border-radius:8px;background:rgba(217,119,6,0.06);">Plus ' + near.length + ' page' + (near.length === 1 ? '' : 's') + ' under 10 impressions (functionally dark, just above the zero threshold): ' + near.slice(0, 4).map(function (p) { return esc(p.name) + ' (' + (p.s.impressions || 0) + ')'; }).join(', ') + (near.length > 4 ? ', and more' : '') + '.</div>' : '';
            // Merge-integrity annotation (B11): pages merge by NAME, so an Irish-language page whose English twin is named
            // differently never pairs and can surface here as "dead" while its English version is alive. Flag, don't hide.
            const _irish = dead.filter(function (p) { return /[áéíóúÁÉÍÓÚ]/.test(String(p.name || '')); });
            const _irishNote = _irish.length ? '<div style="font-size:0.72rem;color:var(--color-text-muted);margin-top:8px;padding:7px 10px;border:1px solid var(--color-border-primary);border-radius:8px;">' + _irish.length + ' of these look like Irish-language pages (' + _irish.slice(0, 2).map(function (p) { return esc(p.name); }).join(', ') + (_irish.length > 2 ? ', and more' : '') + '). Pages merge by name, so an Irish page whose English twin is named differently will not pair and can show as "dead" when its English version is alive. Check the pairing before treating these as dead.</div>' : '';
            const deadHead = dead.length
                ? ('<div style="font-weight:700;font-size:0.95rem;color:var(--color-text-heading);margin-bottom:2px;">' + fmt(dead.length) + ' page' + (dead.length === 1 ? '' : 's') + (c ? ' in ' + esc(c.name) : '') + ' had zero search impressions</div>' +
                    '<div style="font-size:0.72rem;color:var(--color-text-muted);margin-bottom:12px;">' + pctDead + ' of ' + fmt(total) + ' pages, ' + periodLabel(_ddDays) + (ga4On ? ' (views are GA4 - some may still get referral/direct visits)' : '') + '</div>' +
                    _rankCard(items, { nameLabel: 'Page', valueLabel: ga4On ? 'Views' : 'Impressions' }) + (dead.length > shown.length ? '<div style="font-size:0.66rem;color:var(--color-text-muted);margin-top:6px;">Showing ' + shown.length + ' of ' + fmt(dead.length) + ' - Table / CSV has all.</div>' : ''))
                : ('<div style="font-weight:700;font-size:0.95rem;color:var(--color-text-heading);margin-bottom:8px;">No page' + (c ? ' in ' + esc(c.name) : '') + ' had zero search impressions, but ' + near.length + ' ' + (near.length === 1 ? 'is' : 'are') + ' functionally dark (under 10 impressions).</div>');
            return {
                html: deadHead + _nearNote + _irishNote,
                summary: (dead.length ? (fmt(dead.length) + ' page' + (dead.length === 1 ? '' : 's') + (c ? ' in ' + c.name : '') + ' had zero search impressions in ' + periodLabel(_ddDays) + ' (' + pctDead + ' of ' + fmt(total) + ')') : ('No pages with zero search impressions' + (c ? ' in ' + c.name : ''))) + (near.length ? ', plus ' + near.length + ' under 10 impressions' : '') + (ga4On && dead.length ? '; GA4 views shown' : '') + '.',
                data: { columns: [{ key: 'page', label: 'Page' }, { key: 'impressions', label: 'Impressions' }, { key: 'views', label: 'Views (GA4)' }, { key: 'url', label: 'URL' }], rows: (dead.length ? dead : near).map(function (p) { return { page: p.name, impressions: p.s.impressions || 0, views: p.s.pageViews || 0, url: p.url }; }), chart: null }
            };
        }
        if (intent === 'artifact_pages') {
            // The list the section caveat points at: pages with near-zero clicks at a strong rank (the _ctrCliff signature),
            // which drag the section CTR. Distinct from ai_exposed, which by construction EXCLUDES these (A13).
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const ra = _rollupArtifacts(pages);
            if (!ra.arts.length) return { html: '', summary: '', err: 'No measurement artifacts found' + (c ? ' in ' + c.name : '') + ' (no pages with near-zero clicks at a top rank). The CTR here looks trustworthy.' };
            const arts = ra.arts.slice().sort(function (a, b) { return (b.s.impressions || 0) - (a.s.impressions || 0); });
            const shown = arts.slice(0, limit);
            const items = shown.map(function (p) { return { name: p.name, val: fmt(p.s.impressions || 0) + ' impr, ' + _ctrTxt(p.s.ctr) + ' at #' + (p.s.position != null ? p.s.position.toFixed(0) : '?'), bar: p.s.impressions || 0, url: p.url }; });
            const headline = '<div style="font-weight:700;font-size:0.95rem;color:var(--color-text-heading);margin-bottom:2px;">' + fmt(ra.arts.length) + ' page' + (ra.arts.length === 1 ? '' : 's') + (c ? ' in ' + esc(c.name) : '') + ' with likely tracking artifacts</div>' +
                '<div style="font-size:0.72rem;color:var(--color-text-muted);margin-bottom:12px;">Near-zero clicks at a strong rank on real impressions, dragging CTR from ' + _ctrTxt(ra.rawCtr) + ' to a real ~' + _ctrTxt(ra.exCtr) + '. ' + periodLabel(_ddDays) + '</div>';
            const note = '<div style="font-size:0.72rem;color:#d97706;margin-top:8px;padding:7px 10px;border:1px solid rgba(217,119,6,0.3);border-radius:8px;background:rgba(217,119,6,0.06);">These pages get big impressions at a top rank but almost no clicks, the signature of a redirect or canonical split (clicks attributed to another URL). Check each page URL and canonical. If they all started at the same time, suspect one site-wide change.</div>';
            return {
                html: headline + _rankCard(items, { nameLabel: 'Page', valueLabel: 'Impressions' }) + (ra.arts.length > shown.length ? '<div style="font-size:0.66rem;color:var(--color-text-muted);margin-top:6px;">Showing ' + shown.length + ' of ' + fmt(ra.arts.length) + ', Table / CSV has all.</div>' : '') + note,
                summary: fmt(ra.arts.length) + ' page' + (ra.arts.length === 1 ? '' : 's') + (c ? ' in ' + c.name : '') + ' with likely tracking artifacts (near-zero CTR at a top rank), dragging CTR from ' + _ctrTxt(ra.rawCtr) + ' to a real ~' + _ctrTxt(ra.exCtr) + ': ' + shown.slice(0, 5).map(function (p) { return p.name; }).join(', ') + '.',
                data: { columns: [{ key: 'page', label: 'Page' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }, { key: 'ctr', label: 'CTR %' }, { key: 'position', label: 'Position' }, { key: 'url', label: 'URL' }], rows: arts.map(function (p) { return { page: p.name, impressions: p.s.impressions || 0, clicks: p.s.clicks || 0, ctr: +((p.s.ctr || 0) * 100).toFixed(2), position: p.s.position != null ? +p.s.position.toFixed(1) : null, url: p.url }; }), chart: { type: 'bar', x: 'page', y: 'impressions', label: 'Impressions' } }
            };
        }
        if (intent === 'page_summary') {
            const _ref = plan.page || plan.category || '';
            const _res = _resolvePage(r, _ref);
            if (_res.none) return _pageNotFound(_ref, r);
            if (_res.candidates) return { html: _disambig('page_summary', _res.candidates, _ref), summary: 'Several pages match "' + _ref + '", pick one.', data: { columns: [], rows: [] }, disambig: true };
            const p = _res.page, s = p.s || {};
            const hasGA4p = r.totals.pageViews > 0 || r.totals.users > 0;
            const cell = function (l, v) { return '<div style="flex:1;min-width:64px;padding:8px 10px;border-right:1px solid var(--color-border-primary);"><div style="font-size:0.56rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);">' + l + '</div><div style="font-size:1.05rem;font-weight:700;color:var(--color-text-primary);">' + v + '</div></div>'; };
            const strip = '<div style="display:flex;flex-wrap:wrap;border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);">' +
                cell('Impressions', fmt(s.impressions || 0)) + cell('Clicks', fmt(s.clicks || 0)) + cell('CTR', _ctrTxt(s.ctr)) + cell('Avg pos', s.position != null ? s.position.toFixed(1) : '-') +
                (hasGA4p ? cell('Views', fmt(s.pageViews || 0)) : '') + (hasGA4p ? cell('Users', fmt(s.users || 0)) : '') + (s.engagementRate != null ? cell('Engaged', Math.round(s.engagementRate * 100) + '%') : '') + '</div>';
            // Benchmark: CTR against the typical-for-its-position rate — a fact becomes a judgement. BUT a
            // near-zero CTR at a strong rank is a data artifact (redirect/attribution), not a low grade, so
            // surface it as 'investigate' rather than paint it stark red against typical.
            const _bench = (s.position != null && (s.impressions || 0) >= 100) ? _ctrBenchmark(s.position) : 0;
            const _cliff = _ctrCliff(s.position, s.ctr, s.impressions);
            // GA4-corroborated framing: views >> clicks says real people reach the page, so GSC clicks is the broken figure.
            const _viewsCorrob = (hasGA4p && (s.pageViews || 0) > (s.clicks || 0) * 10) ? ' GA4 shows ' + fmt(s.pageViews || 0) + ' views, so people are reaching it;' : '';
            // If the page was freshly edited, the update itself is the prime suspect for a URL/canonical change that broke click attribution.
            const _cliffFreshMo = (_cliff && p.lm) ? (Date.now() - Date.parse(p.lm)) / (1000 * 60 * 60 * 24 * 30.44) : null;
            const _cliffFresh = (_cliffFreshMo != null && _cliffFreshMo >= 0 && _cliffFreshMo < 2) ? ' It was updated ' + (_cliffFreshMo < 1 ? 'this month' : 'about ' + Math.round(_cliffFreshMo) + ' months ago') + ', so if that edit changed the URL, that is the likely cause.' : '';
            const benchHtml = _cliff
                ? '<div style="font-size:0.72rem;color:#d97706;margin-top:8px;padding:7px 10px;border:1px solid rgba(217,119,6,0.3);border-radius:8px;background:rgba(217,119,6,0.06);">' + fmt(s.impressions || 0) + ' impressions at position ' + s.position.toFixed(1) + ' but only ' + fmt(s.clicks || 0) + ' clicks (' + _aiCtr(s.ctr || 0) + ' CTR), implausibly low for a top rank.' + _viewsCorrob + ' this looks like a measurement artifact (clicks likely attributed to another URL), not performance: check the page URL and canonical.' + _cliffFresh + '</div>'
                : (_bench > 0 ? _benchmarkBar(s.ctr || 0, _bench, { fmt: function (v) { return _ctrTxt(v); }, note: 'for position ' + s.position.toFixed(0) }) : '');
            const months = p.lm ? (Date.now() - Date.parse(p.lm)) / (1000 * 60 * 60 * 24 * 30.44) : null;
            const meta = '<div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:8px;">' + (months != null ? ('Last updated ~' + Math.round(months) + ' months ago') : 'No last-modified date') + '</div>';
            const _ci = _contentIntel(p);
            const ciLine = _contentIntelLine(_ci);
            const head = '<div class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(p.url) + '" style="cursor:pointer;font-weight:700;font-size:0.95rem;color:var(--color-text-heading);margin-bottom:8px;">' + esc(p.name) + '</div>';
            // top queries for the page, if query data is available (best-effort, non-blocking)
            let topQ = '';
            try {
                const all = await getQueryRows(_ddDays);
                if (all && all.length) {
                    const set = {}; (p.urls || [p.url]).forEach(function (u) { set[normUrl(u)] = 1; });
                    const byQ = {};
                    all.forEach(function (row) { if (!set[normUrl(row.page || '')]) return; const q = row.query; if (!q) return; byQ[q] = (byQ[q] || 0) + (row.impressions || 0); });
                    const tq = Object.keys(byQ).map(function (q) { return { name: q, val: fmt(byQ[q]), bar: byQ[q] }; }).sort(function (a, b) { return b.bar - a.bar; }).slice(0, 5);
                    if (tq.length) topQ = '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin:14px 0 6px;">Top queries for this page</div>' + _rankCard(tq, { nameLabel: 'Query', valueLabel: 'Impressions' });
                }
            } catch (e) {}
            const _ciRows = _ci ? [{ metric: 'Reading ease', value: _ci.readability != null ? Math.round(_ci.readability) : null }, { metric: 'Word count', value: _ci.words != null ? _ci.words : null }, { metric: 'Meta desc chars', value: _ci.metaLen != null ? _ci.metaLen : null }, { metric: 'Noindex', value: _ci.noindex ? 'yes' : 'no' }] : [];
            // AI flag: only the CONFIRMED exposed case earns a line here (a scorecard is not a diagnosis).
            let aiLine = '';
            if (window.GSCIntegration && window.GSCIntegration.isConnected && window.GSCIntegration.isConnected()) {
                let _A; try { _A = await getAIImpact(_ddDays); } catch (e) {}
                const _af = _aiFinding(p.urls || [p.url], _A);
                if (_af && _af.kind === 'exposed') aiLine = '<div style="font-size:0.72rem;color:#dc2626;margin-top:8px;padding:7px 10px;border:1px solid rgba(220,38,38,0.25);border-radius:8px;background:rgba(220,38,38,0.05);">' + esc(_af.d) + '</div>';
            }
            return {
                ctrArtifact: _cliff,   // so the follow-ups don't offer "why underperforming" on a measurement artifact
                html: head + strip + benchHtml + meta + ciLine + aiLine + topQ,
                summary: '"' + p.name + '" (' + periodLabel(_ddDays) + '): ' + fmt(s.impressions || 0) + ' impressions, ' + fmt(s.clicks || 0) + ' clicks, ' + _ctrTxt(s.ctr) + ' CTR, position ' + (s.position != null ? s.position.toFixed(1) : 'n/a') + (hasGA4p ? (', ' + fmt(s.pageViews || 0) + ' views') : '') + (months != null ? (', updated ~' + Math.round(months) + 'mo ago') : '') + (_ci ? (' On-page: reading ease ' + (_ci.readability != null ? Math.round(_ci.readability) : 'n/a') + ', ' + fmt(_ci.words || 0) + ' words, meta ' + (_ci.metaLen || 0) + ' chars' + (_ci.noindex ? ', NOINDEX (hidden from search)' : '') + '.') : '') + '.',
                data: { columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows: [{ metric: 'Impressions', value: s.impressions || 0 }, { metric: 'Clicks', value: s.clicks || 0 }, { metric: 'CTR %', value: +((s.ctr || 0) * 100).toFixed(2) }, { metric: 'Avg position', value: s.position != null ? +s.position.toFixed(1) : null }].concat(hasGA4p ? [{ metric: 'Views', value: s.pageViews || 0 }, { metric: 'Users', value: s.users || 0 }] : []).concat(_ciRows), chart: null }
            };
        }
        if (intent === 'recently_updated') {
            const c = _catByName(cats, plan.category);
            const pages = c ? catPages(c) : _allPages(r);
            const windowDays = (plan.days && plan.days > 0) ? plan.days : 90;
            const now = Date.now();
            let recent = pages.map(function (p) {
                const t = p.lm ? Date.parse(p.lm) : NaN;
                return { p: p, age: isNaN(t) ? null : (now - t) / 86400000 };
            }).filter(function (o) { return o.age != null && o.age >= 0 && o.age <= windowDays; })
              .sort(function (a, b) { return a.age - b.age; });   // most recently updated first
            if (!recent.length) return { html: '', summary: '', err: 'No pages have a last-updated date within the last ' + windowDays + ' days' + (c ? ' in ' + c.name : '') + '. (Freshness comes from the sitemap\'s lastmod - some sites omit it.)' };
            recent = recent.slice(0, limit);
            let prior = null;
            try { prior = await getPriorMaps(window.treeData, _ddDays); } catch (e) {}
            const urlCat = _urlToCatMap(r);
            const rows = recent.map(function (o) {
                const s = o.p.s || {};
                const prev = prior && prior.gscBy ? (prior.gscBy[normUrl(o.p.url)] || null) : null;
                const cur = s.impressions || 0;
                const pImp = prev ? (prev.impressions || 0) : null;
                const chg = (pImp != null && pImp > 0) ? (cur - pImp) / pImp * 100 : null;
                return { name: o.p.name, url: o.p.url, age: o.age, lm: o.p.lm, impr: cur, prior: pImp,
                    clicks: s.clicks || 0, ctr: s.ctr || 0, pos: s.position, chg: chg, eng: s.engagementRate,
                    section: c ? c.name : (urlCat[normUrl(o.p.url)] || '') };
            });
            const withData = rows.filter(function (x) { return x.chg != null; });
            const rising = withData.filter(function (x) { return x.chg > 0; }).length;
            return {
                html: _freshCard(rows) + '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:8px;">Pages with a last-updated date in the last ' + windowDays + ' days' + (prior ? ', with impressions vs the previous ' + _ddDays + ' days so you can see if the update helped' : '') + '. Freshness comes from the sitemap.</div>',
                summary: rows.length + ' page' + (rows.length === 1 ? '' : 's') + ' updated in the last ' + windowDays + ' days' + (c ? ' in ' + c.name : '') + (withData.length ? ' - ' + rising + ' of ' + withData.length + ' gained search impressions vs the previous ' + _ddDays + ' days' : '') + '. Most recent: ' + rows.slice(0, 5).map(function (x) { return x.name + ' (' + _relAge(x.age) + (x.chg != null ? ', ' + (x.chg >= 0 ? '+' : '') + x.chg.toFixed(0) + '%' : '') + ')'; }).join(', ') + '.',
                data: { columns: [{ key: 'page', label: 'Page' }, { key: 'updated', label: 'Updated' }, { key: 'daysAgo', label: 'Days ago' }, { key: 'impressions', label: 'Impressions' }, { key: 'priorImpressions', label: 'Prior impr' }, { key: 'changePct', label: 'Change %' }, { key: 'clicks', label: 'Clicks' }, { key: 'section', label: 'Category' }, { key: 'url', label: 'URL' }], rows: rows.map(function (x) { return { page: x.name, updated: x.lm || '', daysAgo: Math.round(x.age), impressions: x.impr, priorImpressions: x.prior, changePct: x.chg != null ? +x.chg.toFixed(1) : null, clicks: x.clicks, section: x.section, url: x.url }; }), chart: (withData.length ? { type: 'diverging', x: 'page', y: 'changePct' } : { type: 'bar', x: 'page', y: 'impressions', label: 'Impressions' }) }
            };
        }
        if (intent === 'compare_periods') {
            const pa0 = _resolvePeriod(plan.periodA), pb0 = _resolvePeriod(plan.periodB);
            // A calendar/anchored-date comparison ("before and after May 12", "q1 vs q2") is exactly the change_impact
            // demand signal: refuse gracefully AND log it (missTag) so the err path captures the demand the crash used to eat.
            if ((pa0 && pa0.calendar) || (pb0 && pb0.calendar)) {
                // Teach the nearest CAPABLE intent, not just the nearest phrasing of this incapable one (B9): a calendar
                // quarter-vs-quarter is a YEAR-OVER-YEAR question, which `seasonal` already answers. Route there. No product
                // promise ("coming"), and no scope-escape chip (broadening scope does not make a calendar period parseable).
                const _scH = plan.category || plan.page;
                const _seas = _scH ? ('is ' + _scH + ' seasonal') : 'is this drop seasonal';
                const _vsyr = _scH ? (_scH + ' vs last year') : 'how does this compare to last year';
                return { html: '', summary: '', err: 'I can compare relative periods (for example "this month vs last month" or "last 90 days vs the previous 90 days"), but not specific calendar quarters or months. For a year over year comparison like this, try "' + _seas + '" or "' + _vsyr + '", which compares the same period against last year.', missTag: 'calendar_period', noScopeEscape: true };
            }
            if (!pa0 || !pb0) return { html: '', summary: '', err: 'I could not read those two periods. Try "this month vs last month" or "last 90 days vs the previous 90 days".' };
            // Never compare OVERLAPPING windows silently (B5): auto-disjoint with disclosure so the delta measures a real change.
            const _ovl = _disjoinOverlap(pa0, pb0);
            // Order older -> newer by offset so the strip reads left (older) to right (newer).
            let older = pa0, newer = pb0;
            if ((pa0.offset || 0) < (pb0.offset || 0)) { older = pb0; newer = pa0; }
            let page = null, catNode = null, scopeLabel;
            // Scope resolution. quickParse can't tell a section from a page by syntax, so a section
            // name ("compare Health…") lands in `page`. Prefer an exact SECTION match first, then
            // resolve as a page — otherwise a section-scoped period comparison would dead-end on
            // "I could not find that page" (the intent used to error on _resolvePage .none here).
            const _scopeTerm = plan.page || plan.category;
            if (_scopeTerm && _catByName(cats, _scopeTerm)) { catNode = _catByName(cats, _scopeTerm); scopeLabel = catNode.name; }
            else if (plan.page) {
                const _res = _resolvePage(r, plan.page);
                if (_res.candidates) return { html: _disambig('compare_periods', _res.candidates, plan.page), summary: 'Several pages match "' + plan.page + '", pick one.', data: { columns: [], rows: [] }, disambig: true };
                if (_res.none) return _pageNotFound(plan.page, r);
                page = _res.page; scopeLabel = page.name;
            } else scopeLabel = 'the whole site';
            let mo, mn;
            try { mo = await fetchTrendWindow(window.treeData, older.days, older.offset); mn = await fetchTrendWindow(window.treeData, newer.days, newer.offset); }
            catch (e) { return { html: '', summary: '', err: 'Could not fetch the two periods: ' + (e && e.message ? e.message : String(e)) }; }
            const rbO = build(window.treeData, { statsFor: statsForMaps(mo.gscBy, mo.ga4By) });
            const rbN = build(window.treeData, { statsFor: statsForMaps(mn.gscBy, mn.ga4By) });
            build(window.treeData);   // restore current-period annotations
            const statOf = function (rb) { if (page) return _combineStats((page.urls || [page.url]).map(function (u) { return rb.byUrl[normUrl(u)]; })); if (catNode) { const cc = _catByName(rb.categories, catNode.name); return cc ? cc.rollup : {}; } return rb.totals; };
            const so = statOf(rbO) || {}, sn = statOf(rbN) || {};
            if (!(so.impressions || so.pageViews || sn.impressions || sn.pageViews)) return { html: '', summary: '', err: 'No data for ' + scopeLabel + ' across those two periods. (GSC keeps ~16 months; GA4 keeps only 2 or 14 months depending on the property.)' };
            const norm = older.days !== newer.days;
            const ds = function (v, days) { return norm ? v / days : v; };
            const ga4o = (so.pageViews || so.sessions || 0) > 0, ga4n = (sn.pageViews || sn.sessions || 0) > 0;
            const ga4both = ga4o && ga4n;
            // count metrics (per-day-normalised when lengths differ), then rate metrics (point-diff Δ)
            const rows = [];
            const countM = [['impressions', 'Impressions'], ['clicks', 'Clicks']];
            if (ga4both) { countM.push(['pageViews', 'Views']); countM.push(['sessions', 'Sessions']); }
            countM.forEach(function (mm) { const a = ds(so[mm[0]] || 0, older.days), b = ds(sn[mm[0]] || 0, newer.days); const pct = a > 0 ? Math.round((b - a) / a * 100) : null; rows.push({ metric: mm[1], older: Math.round(a), newer: Math.round(b), delta: pct, dtype: 'pct' }); });
            // CTR
            rows.push({ metric: 'CTR', older: +((so.ctr || 0) * 100).toFixed(1), newer: +((sn.ctr || 0) * 100).toFixed(1), delta: +(((sn.ctr || 0) - (so.ctr || 0)) * 100).toFixed(1), dtype: 'pt', unit: '%' });
            if (so.position != null || sn.position != null) rows.push({ metric: 'Avg position', older: so.position != null ? +so.position.toFixed(1) : null, newer: sn.position != null ? +sn.position.toFixed(1) : null, delta: (so.position != null && sn.position != null) ? +(sn.position - so.position).toFixed(1) : null, dtype: 'ptpos' });
            if (ga4both && (so.engagementRate != null || sn.engagementRate != null)) rows.push({ metric: 'Engaged', older: +((so.engagementRate || 0) * 100).toFixed(0), newer: +((sn.engagementRate || 0) * 100).toFixed(0), delta: +(((sn.engagementRate || 0) - (so.engagementRate || 0)) * 100).toFixed(0), dtype: 'pt', unit: '%' });
            const fmtCell = function (v, r) { if (v == null) return '&mdash;'; if (r.unit === '%') return v + '%'; return (r.dtype === 'ptpos' && r.metric === 'Avg position') ? '#' + v : fmt(v); };
            const dcell = function (r) {
                if (r.delta == null) return '<span style="color:var(--color-text-muted);">&mdash;</span>';
                const goodUp = r.metric !== 'Avg position';   // lower position = better
                const good = r.dtype === 'ptpos' ? r.delta < 0 : r.delta >= 0;
                const col = good ? '#059669' : '#dc2626';
                const txt = r.dtype === 'pct' ? (r.delta >= 0 ? '+' : '') + r.delta + '%' : r.dtype === 'ptpos' ? (r.delta >= 0 ? '+' : '') + r.delta : (r.delta >= 0 ? '+' : '') + r.delta + (r.unit === '%' ? 'pt' : '');
                return '<span style="color:' + col + ';font-weight:700;">' + txt + '</span>';
            };
            const hcell = 'padding:7px 10px;border-bottom:1px solid var(--color-border-primary);font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);';
            const cell = 'padding:8px 10px;border-bottom:1px solid var(--color-border-primary);font-size:0.85rem;';
            const table = '<div style="border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);">' +
                '<div style="display:flex;"><span style="flex:1;' + hcell + '">Metric</span><span style="flex:1;text-align:right;' + hcell + '">' + esc(older.label) + '</span><span style="flex:1;text-align:right;' + hcell + '">' + esc(newer.label) + '</span><span style="width:84px;text-align:right;' + hcell + '">Change</span></div>' +
                rows.map(function (r) { return '<div style="display:flex;align-items:center;"><span style="flex:1;' + cell + 'font-weight:600;color:var(--color-text-primary);">' + r.metric + '</span><span style="flex:1;text-align:right;' + cell + 'color:var(--color-text-secondary);">' + fmtCell(r.older, r) + '</span><span style="flex:1;text-align:right;' + cell + 'color:var(--color-text-primary);font-weight:600;">' + fmtCell(r.newer, r) + '</span><span style="width:84px;text-align:right;' + cell + '">' + dcell(r) + '</span></div>'; }).join('') +
                '</div>';
            const ovlNote = _ovl ? '<div style="font-size:0.62rem;color:#b45309;margin-top:8px;">' + esc(_ovl.note) + '</div>' : '';
            const normNote = norm ? '<div style="font-size:0.62rem;color:#b45309;margin-top:8px;">The periods are different lengths (' + older.days + ' vs ' + newer.days + ' days), so counts are shown as <b>daily averages</b>.</div>' : '';
            const retNote = (!ga4both && (ga4o || ga4n)) ? '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:6px;">GA4 (views / engagement) isn&rsquo;t retained across both periods — showing search metrics only. GA4 keeps 2 or 14 months depending on the property.</div>' : '';
            // headline (override path): the named count metric if any, else impressions — NEVER a synthesised
            // "overall" score (that's a gauge in verdict clothing). Rate metrics fall back to impressions.
            // Weighted count delta; direction-coloured; the per-day-normalisation caveat rides in the hover.
            let _cpHead = null;
            const _rateName = metric === 'ctr' ? 'CTR' : metric === 'position' ? 'Avg position' : null;
            if (_rateName) {   // a NAMED rate headlines AS the rate, in POINTS (never percent-of-percent) — answer the question asked, don't fall back to impressions
                const rr = rows.filter(function (r) { return r.metric === _rateName; })[0];
                if (rr && rr.older != null && rr.newer != null && rr.delta != null) {
                    const _imp = _deltaImproved(rr.dtype === 'ptpos' ? 'lower' : 'higher', rr.older, rr.newer);
                    _cpHead = { value: rr.newer, pct: (rr.unit === '%'), unit: rr.metric + ' now', delta: { pts: rr.delta, improved: _imp }, tier: 'measured' };
                }
            }
            if (!_cpHead) {   // unnamed metric -> impressions default; the /day marker rides on the NUMBER when normalised
                const _wantM = metric === 'clicks' ? 'Clicks' : metric === 'pageViews' ? 'Views' : 'Impressions';
                const _hlRow = rows.filter(function (r) { return r.metric === _wantM; })[0] || rows.filter(function (r) { return r.metric === 'Impressions'; })[0] || null;
                if (_hlRow && _hlRow.dtype === 'pct' && _hlRow.older != null) {
                    const _chg = (_hlRow.newer || 0) - (_hlRow.older || 0);
                    _cpHead = { value: Math.abs(_chg), sfx: norm ? ' /day' : '', unit: (_chg >= 0 ? 'more ' : 'fewer ') + _hlRow.metric.toLowerCase(), delta: { pct: _hlRow.delta }, tier: 'measured', hover: norm ? ('Per-day averages; the two periods differ in length (' + older.days + ' vs ' + newer.days + ' days).') : '' };
                }
            }
            // Summary: NOW-first (match the question's "this vs last" frame, not the strip's before-first) and LEAD with
            // the ASKED metric (B4: the sentence recited Impressions/Clicks/Views and never said CTR even when CTR was the
            // question - the consumed input vanished from one renderer). Named metric reads "now (was prior, delta)".
            const _named = _rateName || (metric === 'clicks' ? 'Clicks' : metric === 'pageViews' ? 'Views' : 'Impressions');
            const _dTxt = function (rr) { return rr.delta == null ? '' : (rr.dtype === 'pct' ? (rr.delta >= 0 ? '+' : '') + rr.delta + '%' : (rr.delta >= 0 ? '+' : '') + rr.delta + (rr.unit === '%' ? 'pt' : '')); };
            const _lead = rows.filter(function (rr) { return rr.metric === _named; })[0];
            const _leadTxt = _lead ? (_lead.metric + ' ' + fmtCell(_lead.newer, _lead) + ' (was ' + fmtCell(_lead.older, _lead) + (_lead.delta != null ? ', ' + _dTxt(_lead) : '') + ')') : '';
            const _restTxt = rows.filter(function (rr) { return rr !== _lead && ['Impressions', 'Clicks', 'Views'].indexOf(rr.metric) >= 0; }).slice(0, 3).map(function (rr) { return rr.metric.toLowerCase() + ' ' + (_dTxt(rr) || fmtCell(rr.newer, rr)); }).join(', ');
            const _cpSummary = scopeLabel + ' (' + newer.label + ' vs ' + older.label + '): ' + (_leadTxt ? (_leadTxt + (_restTxt ? '; ' + _restTxt : '')) : rows.slice(0, 3).map(function (rr) { return rr.metric + ' ' + fmtCell(rr.older, rr) + ' to ' + fmtCell(rr.newer, rr) + (rr.delta != null ? ' (' + _dTxt(rr) + ')' : ''); }).join('; ')) + '.' + (norm ? ' (daily averages, periods differ in length.)' : '');
            return {
                scope: { label: (scopeLabel === 'the whole site' ? null : scopeLabel), isPage: !!page },   // chip renders what was RESOLVED (page or section), not the raw plan slot (C12 chip-audit: same class as seasonal B10)
                html: '<div style="font-weight:700;color:var(--color-text-heading);margin-bottom:10px;">' + esc(scopeLabel === 'the whole site' ? 'Whole site' : scopeLabel) + ' &middot; ' + esc(older.label) + ' vs ' + esc(newer.label) + '</div>' + table + ovlNote + normNote + retNote,
                headline: _cpHead,
                summary: _cpSummary + (_ovl ? ' ' + _ovl.note : ''),
                data: { columns: [{ key: 'metric', label: 'Metric' }, { key: 'older', label: older.label }, { key: 'newer', label: newer.label }, { key: 'change', label: 'Change' }], rows: rows.map(function (r) { return { metric: r.metric, older: r.older, newer: r.newer, change: r.delta, dtype: r.dtype, unit: r.unit, better: (r.dtype === 'ptpos' ? 'lower' : 'higher') }; }), chart: { type: 'minideltas', label: 'metric', before: 'older', after: 'newer' } }
            };
        }
        if (intent === 'traffic_sources') {
            let data;
            try { data = await getSourcesByPage(_ddDays); }
            catch (e) { return { html: '', summary: '', err: 'Could not fetch traffic-source data: ' + (e && e.message ? e.message : String(e)) }; }
            if (data == null) {
                const ga = window.GA4Integration, on = ga && ga.isConnected && ga.isConnected();
                return { html: '', summary: '', err: on ? 'Traffic-source data needs the updated GA4 module. Redeploy standalone-ga4-integration.js (it must include fetchSourcesByPage) and hard-refresh.' : 'Traffic-source answers need a GA4 connection.' };
            }
            const ga4 = window.GA4Integration;
            const toPath = (ga4 && typeof ga4.urlToPath === 'function') ? ga4.urlToPath : function (u) { return u; };
            const rowsFor = function (p, byPage) { const out = []; (p.urls || [p.url]).forEach(function (u) { const rs = byPage.get(toPath(u)); if (rs) rs.push.apply(out, [].concat(rs)); }); return out; };
            const sumScope = function (byPage, pgs, pred) { let s = 0; pgs.forEach(function (p) { (p.urls || [p.url]).forEach(function (u) { const rs = byPage.get(toPath(u)); if (rs) rs.forEach(function (rw) { if (!pred || pred(rw)) s += rw.sessions; }); }); }); return s; };
            const AI_FLOOR = 'Note: this is a floor, not a ceiling — AI-Overview clicks are counted as Organic Search, and AI visits with no referrer fall into Direct, so real AI traffic is higher than shown.';
            const truncNote = data.truncated ? ' <span style="color:#b45309;">(source list truncated at the cap — long-tail sources may be undercounted).</span>' : '';
            const m = plan.source ? _sourceMatcher(plan.source) : (plan.channel ? _sourceMatcher(plan.channel) : null);
            const _mVerb = (m && /s$/i.test(m.label) && !/\bsearch$/i.test(m.label)) ? 'are' : 'is';   // "AI assistants ARE", "Google IS" (C1 subject-verb slip); "Paid Search IS" stays singular

            // ── Growth: "is AI traffic growing?" — current vs previous period vs same period last year ──
            if (m && plan.growth) {
                const cats2 = cats; const c = _catByName(cats2, plan.category);
                const pgs = c ? catPages(c) : _allPages(r);
                const cur = sumScope(data.byPage, pgs, m.pred);
                let prev = null, yoy = null;
                try { const pd = await getSourcesByPage(_ddDays, _ddDays); if (pd && pd.byPage) prev = sumScope(pd.byPage, pgs, m.pred); } catch (e) {}
                try { const yd = await getSourcesByPage(_ddDays, 365); if (yd && yd.byPage) yoy = sumScope(yd.byPage, pgs, m.pred); } catch (e) {}
                const pct = function (now, then) { return (then != null && then > 0) ? Math.round((now - then) / then * 100) : null; };
                const pp = pct(cur, prev), yp = pct(cur, yoy);
                const dcell = function (l, v, sub) { return '<div style="flex:1;min-width:92px;padding:9px 11px;border-right:1px solid var(--color-border-primary);"><div style="font-size:0.56rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);">' + l + '</div><div style="font-size:1.05rem;font-weight:700;color:var(--color-text-primary);">' + v + '</div>' + (sub ? '<div style="font-size:0.62rem;color:' + sub.col + ';font-weight:700;">' + sub.txt + '</div>' : '') + '</div>'; };
                const dl = function (x) { return x == null ? { txt: 'n/a', col: 'var(--color-text-muted)' } : { txt: (x >= 0 ? '+' : '') + x + '%', col: x >= 0 ? '#059669' : '#dc2626' }; };
                const strip = '<div style="display:flex;flex-wrap:wrap;border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);margin-bottom:10px;">' +
                    dcell('Now', fmt(cur) + ' sess') + dcell('Vs previous', prev != null ? fmt(prev) : 'n/a', dl(pp)) + dcell('Vs last year', yoy != null ? fmt(yoy) : 'n/a', dl(yp)) + '</div>';
                const note = (m.isAI ? '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:8px;">' + AI_FLOOR + '</div>' : '') +
                    (yoy == null ? '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:6px;">Same-period-last-year data was unavailable (outside GA4 retention).</div>' : '');
                return {
                    scope: { label: c ? c.name : null, isPage: false },   // C12: chip renders the resolved section (or site), not the raw plan.category
                    html: '<div style="font-weight:700;color:var(--color-text-heading);margin-bottom:8px;">' + esc(m.label) + ' traffic' + (c ? ' &middot; ' + esc(c.name) : '') + '</div>' + strip + note,
                    summary: m.label + ' traffic' + (c ? ' in ' + c.name : '') + ' (' + periodLabel(_ddDays) + '): ' + fmt(cur) + ' sessions' + (pp != null ? ', ' + (pp >= 0 ? '+' : '') + pp + '% vs the previous period' : '') + (yp != null ? ', ' + (yp >= 0 ? '+' : '') + yp + '% vs the same period last year' : '') + '.',
                    data: { columns: [{ key: 'period', label: 'Period' }, { key: 'sessions', label: 'Sessions' }, { key: 'changePct', label: 'Change %' }], rows: [{ period: 'Now', sessions: cur, changePct: 0 }, { period: 'Previous', sessions: prev, changePct: pp }, { period: 'Last year', sessions: yoy, changePct: yp }], chart: { type: 'bar', x: 'period', y: 'sessions', label: 'Sessions' } }
                };
            }

            // ── Named source / bucket: rank pages (or a single page's count + share) ──
            if (m) {
                if (plan.page) {
                    const _res = _resolvePage(r, plan.page);
                    if (_res.none) return _pageNotFound(plan.page, r);
                    if (_res.candidates) return { html: _disambig('traffic_sources', _res.candidates, plan.page), summary: 'Several pages match "' + plan.page + '", pick one.', data: { columns: [], rows: [] }, disambig: true };
                    const pg = _res.page, sess = sumScope(data.byPage, [pg], m.pred), pgSess = (pg.s && pg.s.sessions) || 0, share = pgSess > 0 ? Math.round(sess / pgSess * 100) : null;
                    const cell = function (l, v) { return '<div style="flex:1;min-width:80px;padding:9px 11px;border-right:1px solid var(--color-border-primary);"><div style="font-size:0.56rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);">' + l + '</div><div style="font-size:1.15rem;font-weight:700;color:var(--color-text-primary);">' + v + '</div></div>'; };
                    return {
                        scope: { label: pg.name, isPage: true },   // C12: chip shows the resolved page, not the raw plan.page string
                        html: '<div style="font-weight:700;color:var(--color-text-heading);margin-bottom:8px;">' + esc(pg.name) + ' &middot; from ' + esc(m.label) + '</div><div style="display:flex;flex-wrap:wrap;border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);">' + cell('Sessions from ' + m.label, fmt(sess)) + (share != null ? cell('Share of its traffic', share + '%') : '') + (pgSess ? cell('All sessions', fmt(pgSess)) : '') + '</div>' + (m.isAI ? '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:8px;">' + AI_FLOOR + '</div>' : ''),
                        summary: '"' + pg.name + '" got ' + fmt(sess) + ' session' + (sess === 1 ? '' : 's') + ' from ' + m.label + (share != null ? ' (' + share + '% of its ' + fmt(pgSess) + ' sessions)' : '') + ' in ' + periodLabel(_ddDays) + '.',
                        data: { columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows: [{ metric: 'Sessions from ' + m.label, value: sess }, { metric: 'All sessions', value: pgSess }, { metric: 'Share %', value: share }], chart: null }
                    };
                }
                const c = _catByName(cats, plan.category);
                const pages = c ? catPages(c) : _allPages(r);
                const scored = pages.map(function (p) { return { name: p.name, url: p.url, sess: sumScope(data.byPage, [p], m.pred) }; }).filter(function (x) { return x.sess > 0; });
                const total = scored.reduce(function (s, x) { return s + x.sess; }, 0);
                if (!scored.length) return { html: '', summary: '', err: 'No pages' + (c ? ' in ' + c.name : '') + ' got traffic from ' + m.label + ' in ' + periodLabel(_ddDays) + '.' + (data.truncated ? ' (Source data was truncated — a rare source may be missing.)' : '') };
                // Share of ALL sessions in scope — answers "what percentage of traffic is from X".
                const allTotal = pages.reduce(function (s, p) { let ps = 0; (p.urls || [p.url]).forEach(function (u) { const rs = data.byPage.get(toPath(u)); if (rs) rs.forEach(function (rw) { ps += rw.sessions; }); }); return s + ps; }, 0);
                const share = allTotal > 0 ? total / allTotal * 100 : null;
                const shareTxt = share != null ? (share < 1 ? '<1' : Math.round(share)) + '% of all traffic' : '';
                const scopeTxt = c ? c.name : 'the site';
                const rk = scored.sort(function (a, b) { return b.sess - a.sess; }).slice(0, limit);
                const items = rk.map(function (x) { return { name: x.name, val: fmt(x.sess), bar: x.sess, url: x.url }; });
                return {
                    scope: { label: c ? c.name : null, isPage: false },   // C12: resolved section (or site)
                    html: (share != null ? '<div style="font-size:1.1rem;font-weight:700;color:var(--color-text-primary);margin-bottom:10px;">' + esc(m.label) + ' ' + _mVerb + ' ' + shareTxt + ' &mdash; ' + fmt(total) + ' of ' + fmt(allTotal) + ' sessions' + (c ? ' in ' + esc(c.name) : '') + '.</div>' : '') + _rankCard(items, { nameLabel: 'Page', valueLabel: m.label + ' sessions' }) + '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:8px;">' + fmt(total) + ' session' + (total === 1 ? '' : 's') + ' from ' + esc(m.label) + (c ? ' in ' + esc(c.name) : ' site-wide') + ' (' + periodLabel(_ddDays) + '), across ' + scored.length + ' page' + (scored.length === 1 ? '' : 's') + '.' + truncNote + '</div>' + (m.isAI ? '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:6px;">' + AI_FLOOR + '</div>' : ''),
                    summary: (share != null ? m.label + ' ' + _mVerb + ' ' + shareTxt + ' to ' + scopeTxt + ' (' + fmt(total) + ' of ' + fmt(allTotal) + ' sessions, ' + periodLabel(_ddDays) + '). ' : fmt(total) + ' sessions from ' + m.label + (c ? ' in ' + c.name : ' site-wide') + ' (' + periodLabel(_ddDays) + '). ') + 'Top pages: ' + rk.slice(0, 6).map(function (x) { return x.name + ' (' + fmt(x.sess) + ')'; }).join('; ') + '.',
                    data: { columns: [{ key: 'page', label: 'Page' }, { key: 'sessions', label: m.label + ' sessions' }, { key: 'url', label: 'URL' }], rows: rk.map(function (x) { return { page: x.name, sessions: x.sess, url: x.url }; }), chart: { type: 'bar', x: 'page', y: 'sessions', label: m.label + ' sessions' } }
                };
            }

            // ── Bucket breakdown for a page / section / whole site ──
            let scopeLabel, pages;
            if (plan.page) {
                const _res = _resolvePage(r, plan.page);
                if (_res.none) return _pageNotFound(plan.page, r);
                if (_res.candidates) return { html: _disambig('traffic_sources', _res.candidates, plan.page), summary: 'Several pages match "' + plan.page + '", pick one.', data: { columns: [], rows: [] }, disambig: true };
                pages = [_res.page]; scopeLabel = _res.page.name;
            } else { const c = _catByName(cats, plan.category); pages = c ? catPages(c) : _allPages(r); scopeLabel = c ? c.name : 'the whole site'; }
            const buckets = Object.create(null), aiB = Object.create(null);
            pages.forEach(function (p) { (p.urls || [p.url]).forEach(function (u) { const rs = data.byPage.get(toPath(u)); if (rs) rs.forEach(function (rw) { const b = classifySource(rw.source, rw.channel); buckets[b] = (buckets[b] || 0) + rw.sessions; if (b === 'AI assistants') { const n = _aiName(rw.source); aiB[n] = (aiB[n] || 0) + rw.sessions; } }); }); });
            const entries = Object.keys(buckets).map(function (k) { return { channel: k, sess: buckets[k] }; }).filter(function (x) { return x.sess > 0; }).sort(function (a, b) { return b.sess - a.sess; });
            if (!entries.length) return { html: '', summary: '', err: 'No traffic-source data for ' + scopeLabel + ' in ' + periodLabel(_ddDays) + '.' };
            const total = entries.reduce(function (s, x) { return s + x.sess; }, 0) || 1;
            const items = entries.map(function (x) { return { name: x.channel, val: fmt(x.sess) + ' (' + _pctTxt(x.sess / total) + ')', bar: x.sess }; });   // ALL buckets (few, and the bar shows all): list and legend must agree (C5)
            const hasAI = entries.some(function (x) { return x.channel === 'AI assistants'; });
            // Break the single "AI assistants" bucket out by named assistant (ChatGPT/Perplexity/…).
            const aiEntries = Object.keys(aiB).map(function (k) { return { name: k, sess: aiB[k] }; }).filter(function (x) { return x.sess > 0; }).sort(function (a, b) { return b.sess - a.sess; });
            const aiTotal = aiEntries.reduce(function (s, x) { return s + x.sess; }, 0) || 1;
            const aiHtml = (hasAI && aiEntries.length) ? '<div style="margin-top:10px;border-top:1px solid var(--color-border-primary);padding-top:8px;"><div style="font-size:0.66rem;font-weight:700;color:var(--color-text-secondary);margin-bottom:4px;">Which AI assistants (' + fmt(aiTotal) + ' AI sessions)</div>' + aiEntries.map(function (x) { return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:0.72rem;padding:2px 0;color:var(--color-text-primary);"><span>' + esc(x.name) + '</span><span style="color:var(--color-text-secondary);">' + fmt(x.sess) + ' &middot; ' + _pctTxt(x.sess / aiTotal) + '</span></div>'; }).join('') + '</div>' : '';
            return {
                scope: { label: scopeLabel === 'the whole site' ? null : scopeLabel, isPage: !!plan.page },   // C12: resolved page/section, not the raw plan slot
                html: _stackedBar(entries.map(function (x) { return { label: x.channel, value: x.sess }; }), {}) + _rankCard(items, { nameLabel: 'Source', valueLabel: 'Sessions' }) + '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:8px;">' + fmt(total) + ' sessions to ' + esc(scopeLabel === 'the whole site' ? 'the site' : scopeLabel) + ' (' + periodLabel(_ddDays) + '), classified by source.' + truncNote + '</div>' + aiHtml + (hasAI ? '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:6px;">' + AI_FLOOR + '</div>' : ''),
                summary: 'Where visitors to ' + scopeLabel + ' come from (' + periodLabel(_ddDays) + '): ' + entries.slice(0, 6).map(function (x) { return x.channel + ' ' + _pctTxt(x.sess / total); }).join(', ') + '.' + (hasAI && aiEntries.length ? ' AI assistants ' + _pctTxt(aiTotal / total) + ' (' + fmt(aiTotal) + '), of which ' + aiEntries.slice(0, 3).map(function (x) { return x.name + ' ' + _pctTxt(x.sess / aiTotal); }).join(', ') + '.' : ''),
                data: { columns: [{ key: 'source', label: 'Source' }, { key: 'sessions', label: 'Sessions' }, { key: 'share', label: 'Share %' }], rows: entries.map(function (x) { return { source: x.channel, sessions: x.sess, share: +(x.sess / total * 100).toFixed(1) }; }), chart: { type: 'bar', x: 'source', y: 'sessions', label: 'Sessions' } }
            };
        }
        if (intent === 'abandoned') {
            const hasEng = r.totals.engagementRate != null || (r.totals.sessions || 0) > 0;
            if (!hasEng) return { html: '', summary: '', err: 'Engagement answers need GA4 with engagement metrics (sessions + engagement rate). Connect GA4 and refresh.' };
            const c = _catByName(cats, plan.category);
            const pages = (c ? catPages(c) : _allPages(r)).filter(function (p) { return p.s && p.s.engagementRate != null && (p.s.sessions || 0) >= ABANDON_MIN_SESSIONS; });
            if (!pages.length) return { html: '', summary: '', err: 'Not enough engagement data' + (c ? ' in ' + c.name : '') + ' - pages need at least ' + ABANDON_MIN_SESSIONS + ' sessions for a reliable engagement rate.' };
            const rates = pages.map(function (p) { return p.s.engagementRate; }).slice().sort(function (a, b) { return a - b; });
            const median = rates.length % 2 ? rates[(rates.length - 1) / 2] : (rates[rates.length / 2 - 1] + rates[rates.length / 2]) / 2;
            const cut = median * ABANDON_RATIO;
            const flagged = pages.filter(function (p) { return p.s.engagementRate < cut; })
                .map(function (p) { return { p: p, wasted: (p.s.sessions || 0) * Math.max(0, median - p.s.engagementRate) }; })
                .sort(function (a, b) { return b.wasted - a.wasted; }).slice(0, limit);
            if (!flagged.length) return { html: '', summary: '', err: 'No pages fall well below the ' + (c ? c.name : 'site') + ' median engagement of ' + Math.round(median * 100) + '% - engagement looks even' + (c ? ' in ' + c.name : '') + '.' };
            const items = flagged.map(function (o) { const s = o.p.s; return { name: o.p.name, val: Math.round(s.engagementRate * 100) + '%', bar: s.sessions || 0, url: o.p.url, col: '#dc2626', valCol: '#dc2626' }; });
            return {
                html: _rankCard(items, { nameLabel: 'Page', valueLabel: 'Engagement' }) + '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:8px;">Engagement under ' + Math.round(cut * 100) + '% (well below the ' + (c ? c.name : 'site') + ' median of ' + Math.round(median * 100) + '%), among pages with ' + ABANDON_MIN_SESSIONS + '+ sessions. People arrive but do not stay - often a sign the page does not match what they expected.</div>',
                summary: (c ? c.name + ' pages' : 'Pages') + ' people find but leave (' + periodLabel(_ddDays) + '): ' + flagged.slice(0, 6).map(function (o) { return o.p.name + ' (' + Math.round(o.p.s.engagementRate * 100) + '% engaged, ' + fmt(o.p.s.sessions || 0) + ' sessions)'; }).join('; ') + '. The ' + (c ? c.name : 'site') + ' median engagement is ' + Math.round(median * 100) + '%.',
                data: { columns: [{ key: 'page', label: 'Page' }, { key: 'engagementRate', label: 'Engagement %' }, { key: 'bounceRate', label: 'Bounce %' }, { key: 'sessions', label: 'Sessions' }, { key: 'avgSessionSec', label: 'Avg session (s)' }, { key: 'impressions', label: 'Impressions' }, { key: 'url', label: 'URL' }], rows: flagged.map(function (o) { const s = o.p.s; return { page: o.p.name, engagementRate: +(s.engagementRate * 100).toFixed(1), bounceRate: s.bounceRate != null ? +(s.bounceRate * 100).toFixed(1) : null, sessions: s.sessions || 0, avgSessionSec: s.avgSessionDuration != null ? Math.round(s.avgSessionDuration) : null, impressions: s.impressions || 0, url: o.p.url }; }), chart: { type: 'bar', x: 'page', y: 'engagementRate', label: 'Engagement %' } }
            };
        }
        if (intent === 'seasonal') {
            // Scope resolution (B10 / A2 root fix): quickParse can't tell a section from a page by syntax, so the scope
            // term ("Contact Tracing page") can land in EITHER slot. Try section first, then PAGE, else site - the old code
            // only did _catByName on plan.category, so a page-scoped question silently fell through to the whole site while
            // the chip still rendered the term. Return res.scope so the chip renders what was ACTUALLY used (A10 contract).
            let page = null, catNode = null, scopeLabel;
            const _term = plan.page || plan.category;
            if (_term && _catByName(cats, _term)) { catNode = _catByName(cats, _term); scopeLabel = catNode.name; }
            else if (_term) {
                const _res = _resolvePage(r, _term);
                if (_res.candidates) return { html: _disambig('seasonal', _res.candidates, _term), summary: 'Several pages match "' + _term + '", pick one.', data: { columns: [], rows: [] }, disambig: true };
                if (_res.page) { page = _res.page; scopeLabel = page.name; }
                else scopeLabel = 'the whole site';   // named term is neither a section nor a page: fall to site, but the chip (res.scope) will say so honestly
            } else scopeLabel = 'the whole site';
            const curImp = page ? ((page.s || {}).impressions || 0) : catNode ? catNode.rollup.impressions : r.totals.impressions;
            const curClk = page ? ((page.s || {}).clicks || 0) : catNode ? catNode.rollup.clicks : r.totals.clicks;
            let prev = null, yoy = null;
            try { prev = await getPriorMaps(window.treeData, _ddDays); } catch (e) {}
            try { yoy = await fetchTrendWindow(window.treeData, _ddDays, 365); } catch (e) {}
            const scopeOf = function (maps) {
                if (!maps) return null;
                if (page) { let i = 0, c = 0; (page.urls || [page.url]).forEach(function (u) { const g = maps.gscBy[normUrl(u)]; if (g) { i += g.impressions || 0; c += g.clicks || 0; } }); return { imp: i, clk: c }; }
                const rb = build(window.treeData, { statsFor: statsForMaps(maps.gscBy, maps.ga4By) });
                if (catNode) { const cc = _catByName(rb.categories, catNode.name); return cc ? { imp: cc.rollup.impressions, clk: cc.rollup.clicks } : { imp: 0, clk: 0 }; }
                return { imp: rb.totals.impressions, clk: rb.totals.clicks };
            };
            const pv = scopeOf(prev), yv = scopeOf(yoy);
            const prevPct = (pv && pv.imp > 0) ? Math.round((curImp - pv.imp) / pv.imp * 100) : null;
            const yoyOk = !!(yv && yv.imp > 0);
            const yoyPct = yoyOk ? Math.round((curImp - yv.imp) / yv.imp * 100) : null;
            let verdict;
            if (prevPct != null && prevPct <= -10) {
                if (yoyPct != null && yoyPct >= -5) verdict = 'This dip looks SEASONAL - down vs the previous period, but level with or above the same time last year.';
                else if (yoyPct != null) verdict = 'This looks like a REAL decline - down both vs the previous period AND vs the same time last year.';
                else verdict = 'Down vs the previous period; last-year data is unavailable, so I cannot confirm whether it is seasonal.';
            } else if (prevPct != null && prevPct >= 10) {
                if (yoyPct != null && yoyPct >= 10) verdict = 'Genuine growth - up vs both the previous period and the same time last year.';
                else if (yoyPct != null && yoyPct < -5) verdict = 'Up vs last period but still below the same time last year - a partial recovery.';
                else verdict = 'Up vs the previous period.';
            } else {
                verdict = yoyPct != null ? ('Broadly stable vs the previous period; ' + (yoyPct >= 0 ? 'up ' + yoyPct : 'down ' + Math.abs(yoyPct)) + '% vs last year.') : 'Broadly stable vs the previous period.';
            }
            const dlt = function (p) { return p == null ? { txt: 'n/a', col: 'var(--color-text-muted)' } : { txt: (p >= 0 ? '+' : '') + p + '%', col: p >= 0 ? '#059669' : '#dc2626' }; };
            const cell = function (l, v, sub) { return '<div style="flex:1;min-width:92px;padding:9px 11px;border-right:1px solid var(--color-border-primary);"><div style="font-size:0.56rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);">' + l + '</div><div style="font-size:1.05rem;font-weight:700;color:var(--color-text-primary);">' + v + '</div>' + (sub ? '<div style="font-size:0.62rem;color:' + sub.col + ';font-weight:700;">' + sub.txt + '</div>' : '') + '</div>'; };
            const strip = '<div style="display:flex;flex-wrap:wrap;border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);margin-bottom:10px;">' +
                cell('Current', fmt(curImp) + ' impr') +
                cell('Vs previous', pv ? fmt(pv.imp) : 'n/a', dlt(prevPct)) +
                cell('Vs last year', yoyOk ? fmt(yv.imp) : 'n/a', yoyOk ? dlt(yoyPct) : null) + '</div>';
            const verdictHtml = '<div style="font-size:0.82rem;color:var(--color-text-primary);border-left:3px solid var(--primary);padding:4px 0 4px 10px;">' + esc(verdict) + '</div>';
            const note = !yoyOk ? '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:8px;">Same-period-last-year data was not available (it may fall outside Search Console&rsquo;s ~16-month history).</div>' : '';
            return {
                scope: { label: (scopeLabel === 'the whole site' ? null : scopeLabel), isPage: !!page },   // chip renders WHAT WAS USED, not the plan (A10 contract) - so it can never claim a scope the answer ignored (B10)
                html: '<div style="font-weight:700;color:var(--color-text-heading);margin-bottom:8px;">' + esc(scopeLabel === 'the whole site' ? 'Whole site' : scopeLabel) + ' &middot; seasonality</div>' + strip + verdictHtml + note,
                summary: scopeLabel + ' (' + periodLabel(_ddDays) + '): ' + fmt(curImp) + ' impressions' + (prevPct != null ? ', ' + (prevPct >= 0 ? '+' : '') + prevPct + '% vs the previous period' : '') + (yoyOk ? ', ' + (yoyPct >= 0 ? '+' : '') + yoyPct + '% vs the same period last year' : ', last-year data unavailable') + '. ' + verdict,
                data: { columns: [{ key: 'period', label: 'Period' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }, { key: 'changePct', label: 'Change % vs current' }], rows: [
                    { period: 'Current (' + periodLabel(_ddDays) + ')', impressions: curImp, clicks: curClk, changePct: 0 },
                    { period: 'Previous period', impressions: pv ? pv.imp : null, clicks: pv ? pv.clk : null, changePct: prevPct },
                    { period: 'Same period last year', impressions: yoyOk ? yv.imp : null, clicks: yoyOk ? yv.clk : null, changePct: yoyPct }
                ], chart: { type: 'bar', x: 'period', y: 'impressions', label: 'Impressions' } }
            };
        }
        if (intent === 'emerging') {
            let rows, prows;
            try { rows = await getQueryRows(_ddDays); }
            catch (e) { return { html: '', summary: '', err: 'Could not fetch search-query data: ' + (e && e.message ? e.message : String(e)) }; }
            if (rows == null) {
                const _g = window.GSCIntegration, _c = _g && _g.isConnected && _g.isConnected();
                return { html: '', summary: '', err: _c ? 'Search-query data needs the updated GSC module. Redeploy gsc-integration-module.js (it must include fetchAllQueries) and hard-refresh.' : 'Search-query answers need a Search Console connection.' };
            }
            if (!rows.length) return { html: '', summary: '', err: 'No search-query data came back for ' + periodLabel(_ddDays) + '.' };
            try { prows = await getPriorQueryRows(_ddDays); }
            catch (e) { return { html: '', summary: '', err: 'Could not fetch the previous period for comparison: ' + (e && e.message ? e.message : String(e)) }; }
            if (prows == null) return { html: '', summary: '', err: 'Emerging queries need a second GSC fetch (the previous ' + _ddDays + ' days) and it did not come back. Check the connection / redeploy the GSC module and retry.' };
            // Prior-period impressions per query (lower-cased) to diff against the current window.
            const pj = Object.create(null);
            prows.forEach(function (row) { const q = String(row.query || '').trim().toLowerCase(); if (!q) return; pj[q] = (pj[q] || 0) + num(row.impressions); });
            const idx = buildQueryIndex(rows, r);
            const c = _catByName(cats, plan.category);
            let pool = c ? idx.filter(function (x) { return x.category === c.name; }) : idx;
            const EMERGE_MIN = 30;   // floor on current impressions to cut GSC noise
            let em = pool.map(function (x) {
                const prior = pj[x.query.toLowerCase()] || 0;
                return { x: x, prior: prior, gain: x.impressions - prior, isNew: prior === 0, mult: prior > 0 ? x.impressions / prior : Infinity };
            }).filter(function (o) {
                if (o.x.impressions < EMERGE_MIN) return false;
                if (o.isNew) return true;                     // brand-new search with real demand
                return o.mult >= 2 && o.gain >= 20;           // at least doubled, meaningful absolute gain
            }).sort(function (a, b) { return b.gain - a.gain; }).slice(0, limit);
            if (!em.length) return { html: '', summary: '', err: 'No newly emerging or fast-rising searches' + (c ? ' in ' + c.name : '') + ' vs the previous ' + _ddDays + ' days.' };
            const _ctrPct = _ctrTxt;
            // Resolve each query's ranking page URL back to a name so the row can say WHERE you rank, not just that demand rose.
            const _u2n = Object.create(null); _allPages(r).forEach(function (p) { (p.urls || [p.url]).forEach(function (u) { if (u) _u2n[normUrl(u)] = p.name; }); });
            // Richer than the generic rank card: query + a muted stat line (impressions · clicks · CTR · rank · page)
            // so it reads as a work list, not a news bulletin — position is what turns "demand rose" into a to-do. Borderless .sv-ask-list.
            const _emRow = function (o) {
                const x = o.x;
                const badge = o.isNew
                    ? '<span style="color:#059669;font-weight:700;">NEW</span>'
                    : '<span style="color:#059669;font-weight:700;">▲ rising</span> <span style="color:var(--color-text-muted);">(was ' + fmt(o.prior) + ' impressions)</span>';
                const pg = x.bestPage ? _u2n[normUrl(x.bestPage)] : null;
                const stat = fmt(x.impressions) + ' impressions · ' + fmt(x.clicks) + ' clicks · ' + _ctrPct(x.ctr) + ' CTR' + (x.bestPos != null ? ' · best pos #' + x.bestPos.toFixed(0) : '') + (pg ? ' · ' + _ellipMid(pg, 28) : '');
                const click = x.bestPage ? ' class="sv-ask-page sv-tipel" role="button" tabindex="0" data-url="' + esc(x.bestPage) + '" style="cursor:pointer;"' : '';
                return '<div' + click + ' onmouseover="this.style.background=\'var(--color-bg-tertiary)\'" onmouseout="this.style.background=\'\'"><div style="padding:9px 12px;border-bottom:1px solid var(--color-border-primary);">' +
                    '<div style="display:flex;align-items:baseline;gap:8px;"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;font-size:0.85rem;color:var(--color-text-primary);">' + esc(x.query) + '</span><span style="flex-shrink:0;font-size:0.72rem;font-weight:700;color:#059669;">+' + fmt(o.gain) + '</span></div>' +
                    '<div style="font-size:0.68rem;color:var(--color-text-muted);margin-top:3px;">' + badge + ' · ' + stat + '</div>' +
                '</div></div>';
            };
            const _emHead = '<div style="display:flex;align-items:center;gap:10px;padding:5px 12px;border-bottom:1px solid var(--color-border-primary);font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);background:var(--color-bg-secondary);"><span style="flex:1;">Emerging query</span><span style="flex-shrink:0;">Impressions gained</span></div>';
            return {
                html: '<div class="sv-ask-list">' + _emHead + em.map(_emRow).join('') + '</div><div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:8px;">New or fast-rising searches vs the previous ' + _ddDays + ' days (current impressions vs prior). Ride the demand while it is fresh.</div>',
                summary: 'Emerging searches' + (c ? ' in ' + c.name : '') + ' vs the previous ' + _ddDays + ' days: ' + em.slice(0, 6).map(function (o) { return '"' + o.x.query + '" ' + fmt(o.x.impressions) + ' impressions' + (o.isNew ? ' (new)' : ' (was ' + fmt(o.prior) + ')'); }).join('; ') + '.',
                data: { columns: [{ key: 'query', label: 'Query' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }, { key: 'ctr', label: 'CTR %' }, { key: 'bestPosition', label: 'Best position' }, { key: 'priorImpressions', label: 'Prior impressions' }, { key: 'gain', label: 'Impressions gained' }, { key: 'status', label: 'Status' }, { key: 'category', label: 'Category' }, { key: 'bestPage', label: 'Best page' }], rows: em.map(function (o) { return { query: o.x.query, impressions: o.x.impressions, clicks: o.x.clicks, ctr: +(((o.x.ctr) || 0) * 100).toFixed(2), bestPosition: o.x.bestPos != null ? +o.x.bestPos.toFixed(1) : null, priorImpressions: o.prior, gain: o.gain, status: o.isNew ? 'new' : 'rising', category: o.x.category || '', bestPage: o.x.bestPage || '' }; }), chart: { type: 'bar', x: 'query', y: 'gain', label: 'Impressions gained' } }
            };
        }
        if (intent === 'content_gaps') {
            let rows;
            try { rows = await getQueryRows(_ddDays); }
            catch (e) { return { html: '', summary: '', err: 'Could not fetch search-query data: ' + (e && e.message ? e.message : String(e)) }; }
            if (rows == null) {
                const _g = window.GSCIntegration, _c = _g && _g.isConnected && _g.isConnected();
                return { html: '', summary: '', err: _c ? 'Search-query data needs the updated GSC module. Redeploy gsc-integration-module.js (it must include fetchAllQueries) and hard-refresh.' : 'Search-query answers need a Search Console connection.' };
            }
            if (!rows.length) return { html: '', summary: '', err: 'No search-query data came back for ' + periodLabel(_ddDays) + '.' };
            const idx = buildQueryIndex(rows, r);
            const c = _catByName(cats, plan.category);
            let qs = c ? idx.filter(function (x) { return x.category === c.name; }) : idx;
            // Real demand where even your best page ranks poorly (page 2+) -> create/expand content.
            qs = qs.filter(function (x) { return x.impressions >= 100 && x.bestPos != null && x.bestPos > 15; }).sort(function (a, b) { return b.impressions - a.impressions; }).slice(0, limit);
            if (!qs.length) return { html: '', summary: '', err: 'No obvious content gaps' + (c ? ' in ' + c.name : '') + ' for ' + periodLabel(_ddDays) + ' - you already rank on page one for the high-demand queries.' };
            return {
                html: _oppCard(qs) + '<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:8px;">High demand where your best page ranks page 2 or worse - candidates for a new or expanded page.</div>',
                summary: 'Content gaps' + (c ? ' in ' + c.name : '') + ' (high-demand searches where you rank poorly, ' + periodLabel(_ddDays) + '): ' + qs.slice(0, 6).map(function (x) { return '"' + x.query + '" ' + fmt(x.impressions) + ' impr at ~pos ' + (x.bestPos != null ? x.bestPos.toFixed(0) : '?'); }).join('; ') + '.',
                data: { columns: [{ key: 'query', label: 'Query' }, { key: 'impressions', label: 'Impressions' }, { key: 'bestPosition', label: 'Best position' }, { key: 'potentialClicks', label: 'Potential clicks' }, { key: 'section', label: 'Category' }, { key: 'bestPage', label: 'Best page' }], rows: qs.map(function (x) { return { query: x.query, impressions: x.impressions, bestPosition: x.bestPos != null ? +x.bestPos.toFixed(1) : null, potentialClicks: Math.round(x.potential), section: x.category || '', bestPage: x.bestPage || '' }; }), chart: { type: 'bar', x: 'query', y: 'impressions', label: 'Impressions' } }
            };
        }
        if (intent === 'section_movers') {
            // DIVERGING bars (not dumbbell) on purpose: sections are few and comparable, so % change is the
            // right comparator here. See the movers handler for the deliberate page-vs-section idiom split.
            let mrows;
            try { mrows = await computeMovers(window.treeData, cats, { days: _ddDays }); }
            catch (e) { return { html: '', summary: '', err: 'Could not compare categories: ' + (e && e.message ? e.message : String(e)) }; }
            if (!mrows || !mrows.length) return { html: '', summary: '', err: 'Not enough history to compare categories. (Needs GSC data across two periods.)' };
            const dir = plan.direction || 'both';
            let flt = mrows.slice();
            if (dir === 'up') flt = flt.filter(function (x) { return x.pct > 0; });
            else if (dir === 'down') flt = flt.filter(function (x) { return x.pct < 0; });
            flt.sort(function (a, b) { return Math.abs(b.pct) - Math.abs(a.pct); });
            flt = flt.slice(0, limit).sort(function (a, b) { return b.pct - a.pct; });
            if (!flt.length) return { html: '', summary: '', err: 'No categories ' + (dir === 'up' ? 'rose' : dir === 'down' ? 'fell' : 'moved') + ' meaningfully vs the previous ' + _ddDays + ' days.' };
            const items = flt.map(function (x) { const up = x.pct >= 0, pa = Math.abs(x.pct); return { name: x.name, val: (up ? '▲ ' : '▼ ') + (pa > 500 ? '500+' : pa.toFixed(0)) + '%', bar: Math.min(500, pa), col: up ? '#059669' : '#dc2626', valCol: up ? '#059669' : '#dc2626' }; });
            return {
                html: _rankCard(items, { nameLabel: 'Category', valueLabel: 'Change %' }),
                summary: 'Biggest section ' + (dir === 'down' ? 'declines' : dir === 'up' ? 'risers' : 'movers') + ' vs the previous ' + _ddDays + ' days: ' + flt.slice(0, 6).map(function (x) { return x.name + ' ' + (x.pct >= 0 ? '+' : '') + x.pct.toFixed(0) + '%'; }).join(', ') + '.',
                data: { columns: [{ key: 'page', label: 'Category' }, { key: 'changePct', label: 'Change %' }, { key: 'current', label: 'Current impr' }], rows: flt.map(function (x) { return { page: x.name, changePct: +x.pct.toFixed(1), current: x.curImp, url: null }; }), chart: { type: 'diverging', x: 'page', y: 'changePct' } }
            };
        }
        if (intent === 'ai_exposed') {
            // "Which of MY pages are losing clicks to AI?" the exposed list, filtered to the resolved
            // scope. This is where the scope model pays off: a Health owner gets their exposure, sorted
            // by loss, clickable to page reports. Reads the shared engine (getAIImpact), never re-derives.
            const _g = window.GSCIntegration; const gscOn = !!(_g && _g.isConnected && _g.isConnected());
            if (!gscOn) return { html: '', summary: '', err: 'The exposed-pages list needs a Search Console connection.' };
            const A = await getAIImpact(_ddDays);
            const viewBtn = '<button onclick="window.showAIImpact&&window.showAIImpact()" style="margin-top:10px;background:none;border:1px solid var(--color-border-primary);border-radius:8px;padding:6px 12px;font-size:0.72rem;font-weight:600;color:var(--primary);cursor:pointer;font-family:inherit;">Open the full AI Impact report</button>';
            let exp = A.exposed || [];
            const c = _catByName(cats, plan.category);
            let scopeLabel = 'across the site';
            if (c) {
                const inCat = Object.create(null); catPages(c).forEach(function (p) { (p.urls || [p.url]).forEach(function (u) { inCat[normUrl(u)] = 1; }); });
                exp = exp.filter(function (x) { return inCat[normUrl(x.url)]; });
                scopeLabel = 'in ' + c.name;
            }
            if (!exp.length) {
                const escapeChip = c ? '<div style="margin-top:8px;"><button class="sv-ask-chip sv-ask-chip-pill" data-q="Which pages is Google answering for?">Check the whole site</button></div>' : '';
                return { html: '<div style="font-size:0.85rem;color:var(--color-text-secondary);">No pages ' + esc(scopeLabel) + ' match the AI exposure pattern this period (held rank on page 1, click through down 25% or more).</div>' + escapeChip + viewBtn, summary: 'No pages ' + scopeLabel + ' match the AI exposure pattern this period.', data: { columns: [], rows: [] } };
            }
            const floorScoped = exp.reduce(function (s, x) { return s + x.lost; }, 0);
            const top = exp.slice(0, limit);
            return {
                html: '<div style="font-weight:700;color:var(--color-text-heading);margin-bottom:8px;">Pages exposed to AI ' + esc(scopeLabel) + '</div>' + _aiExposedCard(top) + viewBtn,
                summary: 'Pages ' + scopeLabel + ' where Google appears to be answering for you (held rank, click through down sharply): ' + top.slice(0, 5).map(function (x) { return x.name + ' (~' + fmt(x.lost) + '/mo)'; }).join(', ') + '. ' + exp.length + ' exposed page' + (exp.length === 1 ? '' : 's') + ', an estimated floor of ~' + fmt(floorScoped) + ' clicks/mo.',
                data: { columns: [{ key: 'page', label: 'Page' }, { key: 'position', label: 'Position' }, { key: 'ctrBefore', label: 'CTR before %' }, { key: 'ctrNow', label: 'CTR now %' }, { key: 'lostClicks', label: 'Lost clicks/mo' }], rows: exp.map(function (x) { return { page: x.name, position: +x.pos.toFixed(1), ctrBefore: +(x.ctrB * 100).toFixed(1), ctrNow: +(x.ctrN * 100).toFixed(1), lostClicks: x.lost, url: x.url }; }), chart: { type: 'bar', x: 'page', y: 'lostClicks', label: 'Lost clicks/mo' } }
            };
        }
        if (intent === 'ai_impact') {
            // Queryable slices of the site-level AI Impact report. Reads the SAME shared engine as the
            // report (getAIImpact -> _classifyExposure), so counts/floor never drift between chat and
            // report. aspect: overview|takes|pages|ctr; a button opens the full visual report.
            const A = await getAIImpact(_ddDays);
            if (!A.gscOn && !A.ga4On) return { html: '', summary: '', err: 'AI-impact answers need a Search Console and/or GA4 connection.' };
            const aspect = plan.aspect || 'overview';
            const viewBtn = '<button onclick="window.showAIImpact&&window.showAIImpact()" style="margin-top:10px;background:none;border:1px solid var(--color-border-primary);border-radius:8px;padding:6px 12px;font-size:0.72rem;font-weight:600;color:var(--primary);cursor:pointer;font-family:inherit;">Open the full AI Impact report</button>';

            if (aspect === 'ctr') {
                if (!A.gscOn) return { html: '', summary: '', err: 'The click-through trend needs a Search Console connection.' };
                const trend = A.trend, div = A.div;
                if (!div) return { html: '', summary: '', err: 'Not enough Search Console history yet to read the click-through trend.' };
                return {
                    html: '<div style="font-weight:700;color:var(--color-text-heading);margin-bottom:6px;">Click through rate over ' + trend.length + ' months</div>' + _aiCtrChart(trend) + viewBtn,
                    summary: 'Google click through rate went from ' + _aiCtr(div.eCtr) + ' to ' + _aiCtr(div.lCtr) + ' over ' + div.months + ' months (clicks ' + _aiPct(div.clkChange) + ' on impressions ' + _aiPct(div.imprChange) + '). Falling CTR at steady impressions is the see but don’t click signal.',
                    data: { columns: [{ key: 'period', label: 'Month' }, { key: 'ctr', label: 'CTR %' }], rows: trend.map(function (x) { return { period: _aiYm(x.ym), ctr: x.impressions > 0 ? +(x.clicks / x.impressions * 100).toFixed(2) : 0 }; }), chart: { type: 'line', x: 'period', y: 'ctr', label: 'CTR %' } }
                };
            }
            // overview / takes
            const gscOn = A.gscOn, ga4On = A.ga4On, div = A.div, exposed = A.exposed, sends = A.sends;
            const takesMo = gscOn ? A.floor : null;
            const showSends = aspect !== 'takes';
            const sendsMo = (showSends && ga4On && sends && sends.ai > 0) ? Math.round(sends.ai * 30 / (_ddDays || 30)) : ((showSends && ga4On) ? 0 : null);
            const cell = function (l, v, col) { return '<div style="flex:1;min-width:96px;padding:9px 11px;border-right:1px solid var(--color-border-primary);"><div style="font-size:0.56rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);">' + l + '</div><div style="font-size:1.1rem;font-weight:700;color:' + (col || 'var(--color-text-primary)') + ';">' + v + '</div></div>'; };
            const strip = '<div style="display:flex;flex-wrap:wrap;border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);margin-bottom:8px;">' +
                cell('AI takes', takesMo == null ? 'n/a' : '~' + fmt(takesMo) + ' clicks/mo', '#dc2626') +
                (sendsMo != null ? cell('AI sends', fmt(sendsMo) + ' sess/mo', '#059669') : '') + '</div>';
            const takesTxt = takesMo == null ? '' : ' An estimated floor of ~' + fmt(takesMo) + ' clicks/mo is lost across ' + exposed.length + ' exposed page' + (exposed.length === 1 ? '' : 's') + '.';
            const sendsTxt = (sendsMo != null && sendsMo > 0) ? ' AI assistants send about ' + fmt(sendsMo) + ' sessions/mo' + (sends && sends.growth != null ? ' (' + (sends.growth >= 0 ? 'up ' : 'down ') + Math.abs(Math.round(sends.growth * 100)) + '%)' : '') + (sends && sends.named && sends.named.length ? ', mostly ' + sends.named.slice(0, 3).map(function (x) { return x.name; }).join(', ') : '') + '.' : (sendsMo === 0 ? ' No measurable AI-assistant referrals this period.' : '');
            const summary = ((A.verdict || '') + takesTxt + sendsTxt).trim() || 'Connect Search Console and GA4 to measure both sides of AI impact.';   // A.verdict = the SHARED sentence (with the decomposition); one builder
            // Crop rule: the takes number is a crop unit, so the "consistent with" framing rides WITH the card.
            const takesCaveat = takesMo != null ? '<div style="font-size:0.68rem;color:var(--color-text-muted);margin-bottom:8px;">AI takes is an estimated floor, a pattern consistent with AI answers in results, not a measured "AI took" figure.</div>' : '';
            return {
                html: strip + takesCaveat + viewBtn,   // the verdict sentence lives in the summary (one-liner); do NOT repeat it in the body (was the duplication bug)
                summary: summary,
                data: { columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows: [{ metric: 'AI takes (clicks/mo, est floor)', value: takesMo }, { metric: 'Exposed pages', value: exposed.length }, { metric: 'AI sends (sessions/mo)', value: sendsMo }], chart: null }
            };
        }
        return { html: '', summary: '', unknown: true };
    }

    // Deterministic "explore next" suggestions from the answered intent (stateless
    // fake multi-turn). Every suggestion is a question the pipeline can actually
    // answer, so a chip just re-enters ask(). Max 3.
    function _followups(plan, res, r) {
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
        // For query answers, resolve the top row's ranking page (URL) back to a page name,
        // so we can chain to that page - the thing the owner actually edits.
        let topPageName = null;
        if (topRow && topRow.bestPage && r) {
            const _k = normUrl(topRow.bestPage), _pgs = _allPages(r);
            for (let i = 0; i < _pgs.length && !topPageName; i++) { const _us = _pgs[i].urls || [_pgs[i].url]; for (let j = 0; j < _us.length; j++) { if (normUrl(_us[j]) === _k) { topPageName = _pgs[i].name; break; } } }
        }
        switch (plan.intent) {
            case 'opportunities':
                // The top opportunity's best page may be WINNING other queries (B8: the diagnose chip fired on a pos-1
                // high-CTR page). Offer a neutral page look, not "why underperforming" - diagnose only where warranted.
                if (topPageName) add('How is ' + topPageName + ' performing?');
                if (cat) { add('Top queries in ' + cat); add('Top pages in ' + cat); }
                else { add('What do people search for?'); add('Which categories get the most traffic?'); }
                break;
            case 'top_queries':
                if (topPageName) add('How is ' + topPageName + ' performing?');
                add('Biggest search opportunities' + inCat);
                add('Any pages competing for the same search?');
                break;
            case 'top_pages':
                if (cat) { add('Which ' + cat + ' pages lost traffic?'); add('Biggest search opportunities in ' + cat); add('What is stale in ' + cat + '?'); }
                else { add('Which categories get the most traffic?'); add('Biggest movers across the site'); add('Where are our biggest search opportunities?'); }
                break;
            case 'movers':
                // A vanished page (impressions gone to single digits) is not "underperforming", it's gone (B2): offer the
                // trend (to date the cliff) and the artifact list, not a content diagnosis that has nothing to diagnose.
                if (faller && _imprCliff(faller.previous, faller.current)) { add('How has ' + faller.page + ' trended?'); add('Which ' + (cat ? cat + ' ' : '') + 'pages have tracking issues?'); }
                else if (faller) addWhy(faller.page);
                if (cat) { add('Top pages in ' + cat); add('Biggest search opportunities in ' + cat); }
                else { add('Which categories get the most traffic?'); add('Where are our biggest search opportunities?'); }
                break;
            case 'low_ctr':
                // The top page is a tracking artifact (A14) or navigational (C3): "why underperforming" is the wrong question
                // (neither is a content problem), so suppress the diagnose chip; artifacts point at the artifact list.
                if (topRow && !(res && (res.ctrArtifact || res.navTop))) addWhy(topRow.page);
                if (res && res.ctrArtifact) add('Which ' + (cat ? cat + ' ' : '') + 'pages have tracking issues?');
                add('Biggest search opportunities' + inCat);
                if (cat) add('Top pages in ' + cat); else add('Which categories get the most traffic?');
                break;
            case 'stale':
                if (topRow) addWhy(topRow.page);
                if (cat) { add('Top pages in ' + cat); add('Which ' + cat + ' pages lost traffic?'); }
                else add('Which categories get the most traffic?');
                break;
            case 'section_summary':
                if (cat) { add('What should I focus on in ' + cat + '?'); add('Biggest search opportunities in ' + cat); add('Which ' + cat + ' pages lost traffic?'); }
                break;
            case 'briefing':
                if (cat) { add('Biggest search opportunities in ' + cat); add('What is stale in ' + cat + '?'); add('How has ' + cat + ' trended?'); }
                else { add('Generate a weekly digest'); add('Which categories get the most traffic?'); add('Where are our biggest search opportunities?'); }
                break;
            case 'digest':
                add('Which categories get the most traffic?'); add('Where are our biggest search opportunities?'); add('Biggest movers across the site');
                break;
            case 'rank_categories':
                if (topRow && topRow.section) add('Where are our biggest search opportunities in ' + topRow.section + '?');
                add('Where are our biggest search opportunities?'); add('Biggest movers across the site');
                break;
            case 'compare':
                if (plan.categories && plan.categories.length === 2) { add('Top pages in ' + plan.categories[0]); add('Top pages in ' + plan.categories[1]); }
                break;
            case 'site_summary':
                add('What should I focus on?'); add('Which categories get the most traffic?'); add('Where are our biggest search opportunities?');
                break;
            case 'international_queries':
                add('Which countries search us the most?'); add('What do people search for?'); add('Where are our biggest search opportunities?');
                break;
            case 'top_countries':
                add('What do people abroad search us for?'); add('What do people search for?'); add('Where are our biggest search opportunities?');
                break;
            case 'traffic_sources':
                // C5: this answer grew NO chips; its natural follow-ups (per-source pages, AI growth) are among the best.
                if (plan.source) { add('Is ' + plan.source + ' traffic growing?'); if (cat) add('How is ' + cat + ' doing?'); else add('Which categories get the most traffic?'); }
                else { add('How much traffic from AI?'); add('Is AI traffic growing?'); if (cat) add('How is ' + cat + ' doing?'); else add('What is AI doing to us?'); }
                break;
            case 'questions':
                if (topPageName) add('How is ' + topPageName + ' performing?');
                if (cat) add('Biggest search opportunities in ' + cat); else add('Where are our biggest search opportunities?');
                add('What do people abroad search us for?');
                break;
            case 'language_gap':
                add('What do people search for?'); add('Where are our biggest search opportunities?'); add('Which categories get the most traffic?');
                break;
            case 'diagnose':
                if (plan.page) add('What queries bring people to ' + plan.page + '?');
                add('Where are our biggest search opportunities?'); add('Any pages competing for the same search?');
                break;
            case 'page_queries':
                if (plan.page) { add('How is ' + plan.page + ' performing?'); add('Why is ' + plan.page + ' underperforming?'); }
                add('What questions do people ask?');
                break;
            case 'cannibalisation':
                if (cat) { add('Biggest search opportunities in ' + cat); add('Top pages in ' + cat); }
                else { add('Where are our biggest search opportunities?'); add('What do people search for?'); }
                break;
            case 'dead_pages':
                if (cat) { add('What is stale in ' + cat + '?'); add('Top pages in ' + cat); }
                else { add('What is stale across the site?'); add('Which categories get the most traffic?'); }
                break;
            case 'artifact_pages':
                if (topRow && topRow.page) add('How is the ' + topRow.page + ' page performing?');
                if (cat) add('How is ' + cat + ' doing?'); else add('Which categories get the most traffic?');
                add('What is AI doing to us?');
                break;
            case 'page_summary':
                if (plan.page) { add('What queries bring people to ' + plan.page + '?'); if (!(res && res.ctrArtifact)) add('Why is ' + plan.page + ' underperforming?'); if (res && res.ctrArtifact) add('How has ' + plan.page + ' trended?'); }
                else add('Where are our biggest search opportunities?');
                break;
            case 'content_gaps':
                if (cat) { add('Biggest search opportunities in ' + cat); add('What questions do people ask?'); }
                else { add('Where are our biggest search opportunities?'); add('What do people search for?'); }
                break;
            case 'section_movers':
                if (topRow && topRow.page) add('What should I focus on in ' + topRow.page + '?');
                add('Which categories get the most traffic?'); add('Where are our biggest search opportunities?');
                break;
            case 'emerging':
                // an emerging ROW is a QUERY, not a page: resolve the query's ranking page (topPageName) and ask about
                // THAT (answerable), never stuff the query string into a page template ("the <query> page" names nothing).
                if (topPageName) add('How is ' + topPageName + ' performing?');
                add('What content should we create?'); add('What questions do people ask?');
                break;
            case 'recently_updated':
                if (topRow && topRow.page) add('How is the ' + topRow.page + ' page performing?');
                add('What is stale' + (cat ? ' in ' + cat : '') + '?'); add('What should I focus on' + (cat ? ' in ' + cat : '') + '?');
                break;
            case 'abandoned':
                if (topRow && topRow.page) { add('How is the ' + topRow.page + ' page performing?'); add('Where does traffic to the ' + topRow.page + ' page come from?'); }
                add('What should I focus on' + (cat ? ' in ' + cat : '') + '?');
                break;
            case 'traffic_sources':
                if (plan.page) add('How is the ' + plan.page + ' page performing?');
                add('Where are our biggest search opportunities?'); add('What should I focus on' + (cat ? ' in ' + cat : '') + '?');
                break;
            case 'ai_impact':
                add('Which pages is Google answering for?');
                if (plan.aspect !== 'ctr') add('Is our click through rate falling?');
                add('Is AI traffic growing?');
                break;
            case 'ai_exposed':
                if (topRow && topRow.page) addWhy(topRow.page);
                add('What is AI doing to us?'); add('Is AI traffic growing?');
                break;
            case 'seasonal': {
                // Use the RESOLVED scope (res.scope), and never build a type-invalid chip (B10: "What should I focus on in
                // <page>?" is briefing scoped to a PAGE, a plan shape no handler can honour - briefing takes categories).
                const _ss = (res && res.scope) || {};
                const _sn = _ss.label || plan.category || plan.page;
                if (_sn) {
                    add('How has ' + _sn + ' trended?');
                    if (_ss.isPage) add('How is ' + _sn + ' performing?');   // page-appropriate, not a briefing chip
                    else add('What should I focus on in ' + _sn + '?');       // category-only briefing
                } else { add('How has the site trended?'); add('What should I focus on?'); }
                break;
            }
        }
        return out;
    }

    // Real section names from the loaded sitemap so example questions never reference a
    // section that doesn't exist (CI has Health/Housing/...; MABS/CIB have their own).
    function _exampleCats(n) {
        n = n || 3;
        let names = [];
        try {
            names = pickCategories(window.treeData || {}).slice()
                .sort(function (a, b) { return (b.children ? b.children.length : 0) - (a.children ? a.children.length : 0); })
                .map(function (c) { return c.name; }).filter(Boolean);
        } catch (e) {}
        // DISTINCT names only (duplicate section names are a known bug class, and wrapping produced "Compare Whats New
        // and Whats New" - a nonsense question the tool was recommending), and push meta-sections to the back so example
        // slots draw real content sections first (A11 dignity filter). No wrap: pad rather than repeat a name.
        const META = /^(what'?s new|about|my situation|a\s*-?\s*z|a to z|home|contact|search)/i;
        const seen = Object.create(null), real = [], meta = [];
        names.forEach(function (nm) { const k = nm.toLowerCase(); if (seen[k]) return; seen[k] = 1; (META.test(nm) ? meta : real).push(nm); });
        const ordered = real.concat(meta);
        const pad = ['this section', 'another section', 'a third section'];
        const out = [];
        for (let i = 0; i < n; i++) out.push(ordered[i] || pad[Math.min(i, pad.length - 1)]);
        return out;
    }
    // Real page (leaf) names for page-level examples, same reason.
    function _exampleLeaves(n) {
        n = n || 2;
        const leaves = [];
        try {
            const stack = [window.treeData]; let guard = 0;
            while (stack.length && guard++ < 5000) {
                const nd = stack.pop(); if (!nd) continue;
                if (nd.url && nd.name && !(nd.children && nd.children.length)) leaves.push(String(nd.name));
                (nd.children || []).forEach(function (c) { stack.push(c); });
            }
        } catch (e) {}
        // Dignity filter: an example page a lost user is shown must not read as parody. A very long name signals a deep,
        // hyper-specific leaf ("Changes To The Nationwide Hosepipe Ban"); prominent top pages have short names ("Medical
        // Card"). Cap length as a stats-free prominence proxy (a true impressions floor is the follow-up, needs r wired in).
        const good = leaves.filter(function (x) { return x.length >= 6 && x.length <= 28 && x.split(/\s+/).length <= 4; });
        const pool = good.length >= n ? good : (leaves.length ? leaves : _exampleCats(n));
        const out = [];
        for (let i = 0; i < n; i++) out.push(pool[i] || pool[0] || 'the top');
        return out;
    }
    // Example questions grouped by capability; _pickChips rotates one from each group so
    // suggestions vary each open. Section/page names come from the actual sitemap.
    function _askPool() {
        const c = _exampleCats(3), l = _exampleLeaves(2);
        const A = c[0], B = c[1], C = c[2], P0 = l[0], P1 = l[1];
        return [
            ['What should I focus on in ' + A + '?', 'What should I focus on in ' + B + '?', 'Generate a weekly digest'],
            ['Where are our biggest search opportunities?', 'Biggest search opportunities in ' + C, 'What questions do people ask?'],
            ['How is the ' + P0 + ' page performing?', 'What queries bring people to the ' + P1 + ' page?', 'What do people search for in ' + A + '?'],
            ['Which ' + B + ' pages lost traffic?', 'What is stale in ' + C + '?', 'Which pages get no search traffic?', 'Which pages do people leave quickly?', 'Any pages competing for the same search?'],
            ['What do people abroad search us for?', 'Which countries search us the most?', 'Where does the Irish version underperform?'],
            ["What's newly trending in search?", 'How are pages we updated recently doing?', 'Is the recent change in ' + A + ' seasonal?', 'How has ' + A + ' trended?', 'Compare ' + A + ' and ' + B],
            ['What is AI doing to us?', 'Which pages is Google answering for?', 'Is our click through rate falling?']
        ];
    }
    function _shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
    function _pickChips() { return _shuffle(_askPool().map(function (g) { return g[Math.floor(Math.random() * g.length)]; })); }
    function _chipBtns(list) { return list.map(function (q) { return '<button class="sv-ask-chip sv-ask-chip-pill" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join(''); }
    // In-context discovery: rank the (scope-aware) example pool against what the user is typing.
    function _suggestPool() { const seen = {}, out = []; _askPool().forEach(function (g) { g.forEach(function (q) { const k = q.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(q); } }); }); return out; }
    function _suggest(q) {
        const s = String(q || '').trim().toLowerCase();
        if (s.length < 2) return [];
        const words = s.split(/\s+/).filter(Boolean);
        return _suggestPool().map(function (cand) {
            const lc = cand.toLowerCase(); let score = 0;
            if (lc.indexOf(s) === 0) score = 4; else if (lc.indexOf(s) > -1) score = 3; else if (words.every(function (w) { return lc.indexOf(w) > -1; })) score = 2;
            return { cand: cand, score: score };
        }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score || a.cand.length - b.cand.length; }).slice(0, 6).map(function (x) { return x.cand; });
    }
    // Searchable command palette grouped by the content-creator JOBS (Triage/Discover/Improve/
    // Verify/Report). Example names come from the loaded sitemap. Live-filtered by _wirePalette.
    function _paletteHtml() {
        const cc = _exampleCats(3), ll = _exampleLeaves(2);
        const A = cc[0], B = cc[1], C = cc[2], P0 = ll[0], P1 = ll[1];
        const JOBS = [
            { t: 'Triage — what needs attention', items: ['What should I focus on in ' + A + '?', 'Which ' + A + ' pages lost traffic?', 'Pages with high impressions but low clicks', 'What is stale in ' + A + '?', 'Which pages get no search traffic?', 'Which pages do people leave quickly?', 'Any pages competing for the same search?'] },
            { t: 'Discover — new demand & questions', items: ['Where are our biggest search opportunities?', 'What content should we create?', "What's newly trending in search?", 'What do people search for in ' + A + '?', 'What questions do people ask?', 'Where do visitors to ' + A + ' come from?', 'How much traffic comes from AI?', 'Is AI traffic growing?', 'What do people abroad search us for?', 'Which countries search us the most?'] },
            { t: 'Improve — fix a page', items: ['Why is the ' + P0 + ' page underperforming?', 'How is the ' + P1 + ' page performing?', 'What queries bring people to the ' + P0 + ' page?', 'Where does traffic to the ' + P0 + ' page come from?', 'Quick wins for the ' + P0 + ' page', 'Where does the Irish version underperform?'] },
            { t: 'Verify — did it work / is it normal', items: ['How are pages we updated in the last 90 days doing?', 'Is the recent change in ' + A + ' seasonal?', 'How has ' + A + ' trended?', 'What pages are trending in ' + A + '?', 'Compare ' + A + ' and ' + B, 'Compare ' + A + ': this month vs last month'] },
            { t: 'Report — roll up & share', items: ['How is the whole site doing?', 'Generate a weekly digest', 'Which categories get the most traffic?', 'How is ' + A + ' doing?', 'Top pages in ' + A, 'Which sections are declining?'] }
        ];
        const grp = function (j) {
            return '<div class="sv-pal-group" style="margin-bottom:13px;">' +
                '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:6px;">' + esc(j.t) + '</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                j.items.map(function (q) { return '<button class="sv-ask-chip sv-pal-item sv-ask-chip-row" data-q="' + esc(q) + '" style="font-size:0.8rem;padding:7px 10px;">' + esc(q) + '</button>'; }).join('') +
                '</div></div>';
        };
        return '<div class="sv-ask-palette">' +
            '<div style="font-size:0.9rem;font-weight:700;color:var(--color-text-heading);margin-bottom:10px;">What you can ask</div>' +
            '<input id="sv-ask-pal-search" type="text" placeholder="Filter capabilities…" autocomplete="off" style="width:100%;box-sizing:border-box;font-family:inherit;font-size:0.82rem;padding:8px 11px;border:1px solid var(--color-border-primary);border-radius:9px;background:var(--color-bg-primary);color:var(--color-text-primary);margin-bottom:14px;" />' +
            '<div class="sv-pal-body">' + JOBS.map(grp).join('') + '</div>' +
            '<div class="sv-pal-empty" style="display:none;font-size:0.8rem;color:var(--color-text-muted);">No preset matches — just type your question in the box below; I understand plain English.</div>' +
            '<div style="font-size:0.66rem;color:var(--color-text-muted);margin-top:6px;line-height:1.5;">These are <b>examples</b> spanning what the tool can do — you’re not limited to them. Phrase questions in your own words, and name a country, a page, a section or a time window (“this week”, “last 90 days”). You can also ask by voice.</div>' +
            '</div>';
    }

    // ── Answer anatomy (Wave 1 chassis): verdict-first headline + honest tier + motion-flagged count-up ──
    // The headline is DERIVED from the rendered rows by the renderer (not emitted per-handler), so the
    // big-type number is the sum of the rows shown BY CONSTRUCTION — it cannot drift. Handlers may still
    // set res.headline explicitly when the number needs data not in the rows (e.g. a period delta).
    // A big number is a real property of the data (a sum) or an honest share, never a top-N accident;
    // absent when neither fits. Delta-shaped verdicts come via the res.headline override, not here.
    function _headlineFor(intent, data) {
        if (!data || !data.rows || !data.rows.length) return null;
        const rows = data.rows;
        const sum = function (k) { return rows.reduce(function (s, r) { return s + (Number(r[k]) || 0); }, 0); };
        // REAL QUANTITIES: the sum is the finding, not a display artifact (a floor / potential is a property of the data).
        if (intent === 'opportunities') return { value: sum('potentialClicks'), unit: 'clicks/mo on the table', tier: 'estimated' };
        if (intent === 'ai_exposed') return { value: sum('lostClicks'), unit: 'clicks/mo at stake', tier: 'estimated' };
        // RANKED LISTS: a top-N sum changes with the display limit, so it's an artifact, not a verdict. The
        // honest headline is the SHARE of the scope total (limit-stable in MEANING). A handler opts in by
        // attaching shareBase (its rollup total) + shareKey + shareNoun; the renderer reacts to the contract.
        if (data.shareBase != null && data.shareKey) {
            const base = Number(data.shareBase) || 0; if (base <= 0) return null;
            return { value: Math.round(sum(data.shareKey) / base * 100), pct: true, unit: 'of ' + (data.shareNoun || 'the total'), tier: 'measured' };
        }
        return null;
    }
    // Weighted aggregate change (NOT a mean of per-row percentages): (Sum cur - Sum prev)/Sum prev. Also
    // `churn` = Sum|cur-prev| — because for a two-directional set, NET cancels (5 up 6K + 5 down 6K = ~0%),
    // and a calm net over a churn story is the limit-artifact bug in delta clothing. selfTest pins both.
    function _netDelta(rows, curKey, prevKey) {
        let c = 0, p = 0, ch = 0; (rows || []).forEach(function (r) { const cv = Number(r[curKey]) || 0, pv = Number(r[prevKey]) || 0; c += cv; p += pv; ch += Math.abs(cv - pv); });
        return { cur: c, prev: p, change: c - p, churn: ch, pct: p > 0 ? (c - p) / p * 100 : null };
    }
    // Direction of GOODNESS per metric: position improves by going DOWN (6.4 -> 5.1 is better), everything
    // else by going up. Drives both colour and arrow SENTIMENT so the position mini never paints good news red.
    function _deltaImproved(betterDirection, before, after) { return betterDirection === 'lower' ? (+after < +before) : (+after >= +before); }
    // Motion is separable from anatomy: one flag (localStorage svAskMotion='off') + prefers-reduced-motion
    // both disable it, and the number always RENDERS as its true value — count-up only animates toward it.
    function _askMotionOn() {
        try { if (localStorage.getItem('svAskMotion') === 'off') return false; } catch (e) {}
        try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
        return true;
    }
    function _headlineHtml(h) {
        if (!h || h.value == null || !isFinite(h.value)) return '';
        const tier = h.tier || 'measured', pfx = tier === 'estimated' ? '~' : '';
        const numStyle = 'font-size:2rem;font-weight:800;line-height:1;color:var(--color-text-heading);' + (tier === 'inferred' ? 'border-bottom:2px dashed var(--color-text-muted);padding-bottom:1px;' : '');
        const tierT = tier === 'estimated' ? 'Estimated: a modelled figure, not a direct measurement.' : tier === 'inferred' ? 'Inferred: a bound, not a measurement.' : '';
        const title = [tierT, h.hover].filter(Boolean).join('  ');   // extra caveats (e.g. per-day normalisation) ride in the hover
        const sfx = (h.sfx != null) ? h.sfx : (h.pct ? '%' : '');   // e.g. ' /day' rides ON the number (crop-proof), not just the hover
        const numCls = 'sv-ask-hnum' + (_askMotionOn() ? ' sv-countup' : '');
        let chip = '';
        if (h.delta && (h.delta.pct != null || h.delta.pts != null)) {
            const hasPts = h.delta.pts != null;                     // POINTS for rates (CTR 1.7->1.4 is -0.3pts, NOT -18%)
            const good = (h.delta.improved != null) ? h.delta.improved : ((hasPts ? h.delta.pts : h.delta.pct) >= 0);   // sentiment, not raw sign (position inverts)
            const col = good ? '#059669' : '#dc2626';
            const mag = hasPts ? (Math.abs(h.delta.pts) + 'pts') : (Math.abs(Math.round(h.delta.pct)) + '%');
            chip = '<span data-sentiment="' + (good ? 'good' : 'bad') + '" style="font-size:0.75rem;font-weight:700;color:' + col + ';background:' + (good ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.12)') + ';padding:2px 8px;border-radius:20px;align-self:center;">' + (good ? '▲' : '▼') + ' ' + mag + '</span>';
        }
        return '<div class="sv-ask-headline" style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 10px;">' +
            '<span class="' + numCls + '" data-to="' + h.value + '" data-pfx="' + pfx + '" data-sfx="' + esc(sfx) + '"' + (title ? ' title="' + esc(title) + '"' : '') + ' style="' + numStyle + '">' + esc(pfx + fmt(h.value) + sfx) + '</span>' +
            '<span style="font-size:0.8rem;color:var(--color-text-secondary);">' + esc(h.unit || '') + '</span>' + chip + '</div>';
    }
    function _animateCountups(root) {
        if (!root || !root.querySelectorAll) return;
        const els = root.querySelectorAll('.sv-countup');
        for (let i = 0; i < els.length; i++) {
            (function (el) {
                const to = Number(el.getAttribute('data-to')); if (!isFinite(to)) return;
                const pfx = el.getAttribute('data-pfx') || '', sfx = el.getAttribute('data-sfx') || '', dur = 420, t0 = Date.now();
                el.setAttribute('data-to', '');   // guard against a re-run double-animating
                const step = function () {
                    const p = Math.min(1, (Date.now() - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
                    el.textContent = pfx + fmt(Math.round(to * eased)) + sfx;
                    if (p < 1) requestAnimationFrame(step); else el.textContent = pfx + fmt(to) + sfx;   // land EXACTLY on the true value
                };
                requestAnimationFrame(step);
            })(els[i]);
        }
    }
    // ── export helpers (CSV + AI brief) — consume the runIntent data contract ──
    function _csvCell(v) {
        if (v == null) return '';
        const s = String(v);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    // Render the answer's structured data as an HTML table (Chart/List <-> Table toggle).
    function _dataTable(data, opts) {
        opts = opts || {};
        if (!data || !data.columns || !data.rows || !data.rows.length) return '<div style="font-size:0.8rem;color:var(--color-text-muted);padding:6px 0;">No table data.</div>';
        const cols = data.columns, rows = data.rows;
        const big = !!opts.big, fs = big ? '0.82rem' : '0.72rem', pad = big ? '7px 12px' : '5px 8px', maxH = big ? '560px' : '340px', cap = big ? 500 : 200, urlMax = big ? '320px' : '150px';
        const th = cols.map(function (c) { return '<th style="text-align:left;padding:' + pad + ';border-bottom:1px solid var(--color-border-primary);color:var(--color-text-muted);font-weight:600;white-space:nowrap;position:sticky;top:0;background:var(--color-bg-primary);">' + esc(c.label) + '</th>'; }).join('');
        const tb = rows.slice(0, cap).map(function (r) {
            return '<tr>' + cols.map(function (c) {
                const v = r[c.key]; const num = typeof v === 'number';
                const disp = num ? v.toLocaleString() : String(v == null ? '' : v);
                const urlish = /url/i.test(c.key);
                return '<td style="padding:' + pad + ';border-bottom:1px solid var(--color-border-primary);color:var(--color-text-secondary);text-align:' + (num ? 'right' : 'left') + ';' + (urlish ? 'max-width:' + urlMax + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' : '') + '">' + esc(disp) + '</td>';
            }).join('') + '</tr>';
        }).join('');
        const more = rows.length > cap ? '<div style="font-size:0.66rem;color:var(--color-text-muted);padding:5px 8px;">Showing first ' + cap + ' of ' + rows.length + ' rows (CSV has all).</div>' : '';
        return '<div style="overflow:auto;max-height:' + maxH + ';border:1px solid var(--color-border-primary);border-radius:8px;"><table style="width:100%;border-collapse:collapse;font-size:' + fs + ';font-family:var(--font-family);"><thead><tr>' + th + '</tr></thead><tbody>' + tb + '</tbody></table></div>' + more;
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
    const _ICON_EXPAND = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px;"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
    const _ICON_IMG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
    const _ICON_COPY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

    // Miss-log: record questions that resolve to `unknown` so the owner can see what
    // to build next. Capped ring buffer in localStorage. Inspect via SVRollup.getAskMisses().
    function _logMiss(q, tag) {
        try {
            const arr = JSON.parse(localStorage.getItem('svAskMisses') || '[]');
            arr.push({ q: q, ts: Date.now(), tag: tag || 'unknown' });   // tag distinguishes a genuine unknown from a parse_error crash in the demand log
            while (arr.length > 200) arr.shift();
            localStorage.setItem('svAskMisses', JSON.stringify(arr));
        } catch (e) {}
    }
    function getAskMisses() { try { return JSON.parse(localStorage.getItem('svAskMisses') || '[]'); } catch (e) { return []; } }

    // Deterministic fast-path for the exact phrasings we generate as chips (e.g. the
    // result-aware "Why is X underperforming?"), so a long/odd page name can never be
    // mis-parsed to unknown. Returns a plan or null (null -> fall back to the LLM).
    function _quickParse(q) {
        const s = String(q || '').trim();
        const m = /^why is (?:the\s+)?(.+?)(?:\s+page)?\s+(?:underperforming|not getting clicks|not ranking|down)\??$/i.exec(s);
        if (m && m[1]) return { intent: 'diagnose', page: m[1].trim() };
        const m2 = /^(?:what(?:'s| is) wrong with|what(?:'s| is) the problem with|diagnose)\s+(?:the\s+)?(.+?)(?:\s+page)?\??$/i.exec(s);
        if (m2 && m2[1]) return { intent: 'diagnose', page: m2[1].trim() };
        // "what does <country> search (us) for" / "what do people in <country> search for"
        // Only fires when the term resolves to a real country (so it can't hijack
        // "what do people search for in Health").
        const cm = /^what (?:does|do) (?:people (?:in|from) )?(.+?) search(?: us)?(?: for)?\??$/i.exec(s);
        if (cm && cm[1] && _resolveCountry(cm[1].trim())) return { intent: 'international_queries', country: cm[1].trim() };
        // "what should I focus on (in X)" / "my priorities" / "where do I start" / "briefing" -> section briefing
        const bm = /^(?:what should (?:i|we) (?:focus on|work on|do|prioriti[sz]e)|what are (?:my|our) priorities|where should (?:i|we) (?:focus|start)|where do (?:i|we) start|what needs (?:my |our )?attention|(?:give me )?(?:a |my )?(?:section )?briefing)(?: (?:in|for) (.+?))?\??$/i.exec(s);
        if (bm) return { intent: 'briefing', category: (bm[1] || '').trim() || null };
        // "what (search) queries bring people to X" / "what do people search to find X" -> page_queries
        // "weekly digest" / "generate a digest" / "digest for all sections" -> all-sections roll-up
        // "what content should we create" / "content gaps" -> content_gaps
        // "low engagement" / "people leave quickly" / "found but not read" -> abandoned
        if (/\blow engagement\b|\b(?:leave|leaving|bounce|bouncing|drop off|click away)\b|\bfound but (?:leave|not read|dont? read|don't read)\b|\bread but leave\b|\bpeople (?:arrive|come) but leave\b/i.test(s)) { const _im = / in (.+?)\??$/i.exec(s); return { intent: 'abandoned', category: _im ? _im[1].trim() : null }; }
        // "what pages are trending / rising / falling in X" -> page-level movers (NOT the trend line).
        // Also "biggest/top movers" (unambiguous) even without the word "pages".
        {
            const _mvWord = /\b(?:trending|rising|growing|gaining|gained|climbing|surging|falling|dropping|declining|sinking|losing|lost|moving|gone up|gone down)\b/i.test(s);
            const _mvPages = /\bpages?\b/.test(s) && _mvWord;
            const _mvNamed = /\b(?:biggest|top|page) movers?\b/i.test(s);
            // don't steal "biggest SECTION movers" (section_movers), "newly trending" (emerging), or
            // AI-exposure phrasings like "losing clicks to AI" (ai_exposed, routed just below).
            if ((_mvPages || _mvNamed) && !/\bsection movers?\b/i.test(s) && !/\bnewly (?:trending|rising)\b/i.test(s) && !/\b(?:to|by) (?:ai|overviews?)\b/i.test(s)) {
                let _dir = 'both';
                if (/\b(?:trending|rising|growing|gaining|gained|climbing|surging|gone up)\b/i.test(s)) _dir = 'up';
                else if (/\b(?:falling|dropping|declining|sinking|losing|lost|gone down)\b/i.test(s)) _dir = 'down';
                const _im = / (?:in|for|within) (.+?)\??$/i.exec(s);
                return { intent: 'movers', category: _im ? _im[1].trim() : null, direction: _dir };
            }
        }
        // "compare traffic to X from A and B" / "compare X from A and B" -> compare_periods
        {
            const _fab = /\bcompare\b[\s\S]*\bfrom\s+(.+?)\s+(?:and|vs\.?|versus|to|against|compared to)\s+(.+?)\s*\??$/i.exec(s);
            if (_fab) {
                const _pm = /\bto (?:the )?(.+?)(?: page)? from\b/i.exec(s) || /\bcompare (?:traffic (?:to|on|for) |the )?(.+?)(?: page)? from\b/i.exec(s);
                return { intent: 'compare_periods', page: _pm ? _pm[1].trim() : null, periodA: _fab[1].trim(), periodB: _fab[2].trim() };
            }
        }
        // ── AI Impact routes: the holistic AI report (takes / exposed pages / CTR divergence). Kept
        //    ahead of traffic_sources; "traffic from AI" / "is AI traffic growing" still fall through to it. ──
        if (/\bwhich pages (?:is|are) (?:google|ai|overviews?) answering\b/i.test(s) || /\bwhere (?:is|are) google answering for (?:us|me|the site)\b/i.test(s) || /\bpages\b[^?]*\b(?:losing|lost|leaking) clicks to (?:ai|google|overviews?)\b/i.test(s) || /\b(?:ai[\s-]?)?exposed pages\b/i.test(s) || /\bpages (?:hit|affected|hurt) by (?:ai|overviews?)\b/i.test(s) || /\b(?:ai|overview) exposure\b/i.test(s) || /\bwhich of (?:my|our) pages (?:are )?(?:exposed|losing clicks to ai)\b/i.test(s) || /\bexposed to ai\b/i.test(s)) {
            const _ec = / (?:in|for) (.+?)\??$/i.exec(s); return { intent: 'ai_exposed', category: _ec ? _ec[1].trim() : null };
        }
        if (/\b(?:is|has|our|the)\b[^?]*\b(?:click[\s-]?through(?: rate)?|ctr)\b[^?]*\b(?:falling|fallen|dropping|dropped|declining|going down|collapsing|collapsed|down|worse)\b/i.test(s) || /\bctr trend\b|\bclick[\s-]?through trend\b/i.test(s))
            return { intent: 'ai_impact', aspect: 'ctr' };
        if (/\bhow (?:much|many)(?: clicks?)?\b[^?]*\b(?:ai|google|overviews?)\b[^?]*\b(?:taking|taken|stealing|stolen|costing|lost)\b/i.test(s) || /\bclicks?\b[^?]*\b(?:lost|taken|stolen)\b[^?]*\bto (?:ai|google|overviews?)\b/i.test(s) || /\bai overviews?\b[^?]*\b(?:cost|costing|impact|effect|taking|taken)\b/i.test(s))
            return { intent: 'ai_impact', aspect: 'takes' };
        if (/\bai impact\b|\bimpact of ai\b|\bhow (?:is|are|much)\s+ai\b[^?]*\b(?:affecting|impacting|hurting|hitting|costing)\b|\bwhat(?:'s| is)\s+ai\b[^?]*\b(?:doing|costing|taking)\b|\bzero[\s-]?click\b|\bsee but (?:don'?t|not) click\b|\bare we losing (?:traffic|clicks) to ai\b/i.test(s))
            return { intent: 'ai_impact', aspect: 'overview' };
        // ── traffic_sources routes: growth / "which pages does X send" / "from X" / breakdown ──
        {
            const _srcCat = / (?:in|for) (.+?)\??$/i.exec(s);
            const _cat = _srcCat ? _srcCat[1].trim() : null;
            // "is AI traffic growing" / "how has ChatGPT traffic grown"
            const _gm = /\b(ai|chatgpt|claude|perplexity|gemini|copilot|deepseek|grok|meta ai|facebook|google|social|search|email|direct|referral|ask[\s_-]?ci)\b[^?]*\b(?:growing|grown|growth|rising|increas|on the rise)\b/i.exec(s);
            if (_gm && /\b(?:traffic|sessions|visits?|referrals?)\b/i.test(s)) {
                let _src = _gm[1].trim(); if (/ask/i.test(_src)) _src = 'askci';
                return { intent: 'traffic_sources', source: _src, growth: true, category: _cat };
            }
            // "which pages does X send / drive / bring"
            const _drv = /\bwhich pages\s+(?:does|do)\s+(.+?)\s+(?:send|sends|drive|drives|bring|brings|refer|refers)\b/i.exec(s);
            if (_drv) { let _src = _drv[1].trim(); if (/ask/i.test(_src)) _src = 'askci'; return { intent: 'traffic_sources', source: _src, category: _cat }; }
            // "how many from X" / "traffic from X" / "how many to the Y page from X"
            const _fromAsk = /\bfrom\s+(ask[\s_-]?ci\w*)/i.exec(s);
            // Don't treat "from X" as a source when it's a period comparison ("compare … from q1 and q2")
            // or a time token (q1-q4, a month, a year) — those are periods, not traffic sources.
            const _isCmp = /\bcompare\b/i.test(s) || /\bfrom\s+q[1-4]\b/i.test(s) || /\bfrom\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s) || /\bfrom\s+20\d\d\b/i.test(s);
            const _fromGen = (!_fromAsk && !_isCmp && /\b(?:how many|how much|traffic|sessions|visits?|visitors)\b/i.test(s)) ? /\bfrom\s+([a-z][\w.\-]{1,30})\b/i.exec(s) : null;
            const _fm = _fromAsk || _fromGen;
            if (_fm && !/^(abroad|overseas|internationally|q[1-4]|20\d\d)$/i.test(_fm[1].trim())) {
                const _term = /ask[\s_-]?ci/i.test(_fm[1]) ? 'askci' : _fm[1].trim();
                const _pm = /\bto (?:the )?(.+?)(?: page)? from\b/i.exec(s) || /\bfrom [\w.\-]+ to (?:the )?(.+?)(?: page)?\??$/i.exec(s);
                return { intent: 'traffic_sources', source: _term, page: _pm ? _pm[1].trim() : null };
            }
            // breakdown: "traffic sources / where do visitors come from / how much from AI"
            if (/\btraffic sources?\b|\bchannel breakdown\b|\bwhich channels?\b|\bhow much (?:traffic )?(?:comes? )?from ai\b|\bwhere (?:do|does) (?:my |our |the )?(?:visitors?|traffic|people) (?:come from|arrive|land)\b/i.test(s)) {
                return { intent: 'traffic_sources', category: _cat };
            }
        }
        // "is this normal / seasonal / vs last year" -> seasonal
        if (/\bseasonal\b|\bis (?:this|that|it) normal\b|\bvs\.? last year\b|\bversus last year\b|\bto last year\b|\bagainst last year\b|\bcompared? to last year\b|\bsame (?:time|period) last year\b|\byear[- ]on[- ]year\b|\byoy\b/i.test(s)) {
            const _s1 = / (?:in|for) (.+?)\??$/i.exec(s);
            const _s2 = /\bcompared?\s+(?:the\s+)?(.+?)\s+(?:to|vs\.?|versus|against|with)\s+last year/i.exec(s);
            const _s3 = /\b(.+?)\s+(?:vs\.?|versus)\s+last year/i.exec(s);
            const _s4 = /^is (?:the |this |that )?(.+?)(?:'s)?\s+(?:drop|dip|decline|fall|slump|slide|change|dropoff|trend)\b/i.exec(s);   // "is the Health drop seasonal" -> Health (handler validates against real sections)
            const _cat = _s1 ? _s1[1].trim() : _s2 ? _s2[1].trim() : _s3 ? _s3[1].trim() : _s4 ? _s4[1].trim() : null;
            return { intent: 'seasonal', category: _cat, yoy: true };
        }
        // "how are pages we updated doing" / "what pages were updated recently" / "pages updated in the last N days" -> recently_updated
        if (/\b(?:recently|newly|lately)\s+(?:updated|changed|edited|refreshed|revised)\b|\b(?:updated|changed|edited|refreshed|revised)\s+(?:recently|lately)\b|\b(?:pages?|content)\s+(?:that\s+|we\s+|were\s+|was\s+|have\s+been\s+|got\s+|just\s+)*(?:updated|changed|edited|refreshed|revised)\b|\b(?:updated|changed|edited|refreshed)\s+pages?\b|\bhow\s+are\s+(?:the\s+)?(?:pages?|content)\s+we\s+(?:updated|changed|edited)\b/i.test(s)) {
            let _days = 90;
            const _wm = /(?:last\s+)?(\d+)\s*(day|week|month)s?\b/i.exec(s);
            if (_wm) { const _u = _wm[2].toLowerCase(); _days = _u === 'day' ? +_wm[1] : _u === 'week' ? _wm[1] * 7 : _wm[1] * 30; }
            else if (/\blast\s+week\b/i.test(s)) _days = 7;
            else if (/\blast\s+month\b/i.test(s)) _days = 30;
            else if (/\blast\s+(?:quarter|3\s*months)\b/i.test(s)) _days = 90;
            const _s2 = s.replace(/\b(?:in|over|during|within)?\s*the\s+last\s+\d+\s*(?:day|week|month)s?\b/gi, '').replace(/\blast\s+(?:week|month|quarter)\b/gi, '');
            const _cm = / in (.+?)\??$/i.exec(_s2);
            return { intent: 'recently_updated', category: _cm ? _cm[1].trim() : null, days: _days };
        }
        // "what's newly trending" / "new searches" / "emerging queries" / "rising searches" -> emerging
        if (/\bemerging\b|\bnewly (?:trending|searched|rising|popular)\b|\bnew (?:searches|queries|search terms)\b|\bwhat(?:'s| is| are)? (?:newly )?(?:trending|rising|taking off|growing) (?:in )?search\b|\brising (?:queries|searches|search terms)\b|\bgaining search\b/i.test(s)) { const _im = / in (.+?)\??$/i.exec(s); const _ec = _im && !/^search(?:es)?$/i.test(_im[1].trim()) ? _im[1].trim() : null; return { intent: 'emerging', category: _ec }; }
        if (/\bcontent gaps?\b|\bcontent to create\b|\bwhat (?:content )?should we (?:create|write|make)\b|\bwhat should we (?:create|write)\b|\bwhere do we have no (?:good )?page\b/i.test(s)) { const _im = / in (.+?)\??$/i.exec(s); return { intent: 'content_gaps', category: _im ? _im[1].trim() : null }; }
        // "which sections are growing/declining" / "biggest section movers" -> section_movers
        { const smm = /^(?:which |what )?sections? (?:are |have )?(growing|rising|declining|falling|dropping|shrinking|moving|trending)\b/i.exec(s) || /^(?:biggest |top )?section movers\b/i.exec(s); if (smm) { const d = /grow|ris|climb/i.test(s) ? 'up' : /declin|fall|drop|shrink|los/i.test(s) ? 'down' : 'both'; return { intent: 'section_movers', direction: d }; } }
        // "which pages get no (search) traffic" / "orphaned/dead pages" / "zero impressions"
        // (deliberately excludes "no clicks" -> that's low_ctr). Extracts an optional "in X".
        if (/\b(?:no|zero|0)\s+(?:search\s+)?(?:traffic|impressions|visits)\b/i.test(s) || /\b(?:orphaned|dead|invisible|unvisited)\s+pages\b/i.test(s) || /^(?:is|does)\s+anyone\s+(?:finding|find|see|seeing)\b/i.test(s)) {
            const inM = / in (.+?)\??$/i.exec(s);
            return { intent: 'dead_pages', category: inM ? inM[1].trim() : null };
        }
        // "which pages have tracking/measurement/attribution issues" / "artifact pages" / "pages with near-zero clicks
        // at a top rank" -> the artifact list (near-zero-CTR-cliff pages dragging the CTR). Extracts an optional "in X".
        if (/\b(?:tracking|measurement|attribution|canonical|redirect)\s+(?:issue|issues|problem|problems|artifact|artifacts|split|splits)\b/i.test(s) || /\b(?:artifact|measurement)\s+pages\b/i.test(s) || /\bpages? with (?:tracking|measurement|attribution)\b/i.test(s)) {
            const inM = / in (.+?)\??$/i.exec(s);
            return { intent: 'artifact_pages', category: inM ? inM[1].trim() : null };
        }
        const dm = /^(?:generate |create |show |give me |make )?(?:a |the |my )?(?:weekly |content |section )?digest(?: (?:for|of|across) (?:all(?: sections| owners| the sections)?|every section|everyone|the (?:whole )?site))?\??$/i.exec(s);
        if (dm) return { intent: 'digest' };
        const dm2 = /^(?:generate |create |show |give me |make )?(?:a |the |my )?(?:weekly |content )?digest (?:for|of) (.+?)\??$/i.exec(s);
        if (dm2 && dm2[1]) return { intent: 'briefing', category: dm2[1].trim() };
        // "most viewed / top pages in X" -> top_pages, with the METRIC inferred from the wording
        // ("viewed/visited/popular"->views, "clicks"->clicks, "searched/seen"->impressions).
        {
            const _isTop = (/\b(?:top|most (?:viewed|visited|popular|read|searched|clicked)|best|biggest|highest[- ]?traffic)\b[^?]*\bpages?\b/i.test(s) || /\bpages?\b[^?]*\bby (?:views?|impressions?|clicks?|traffic)\b/i.test(s));
            const _notTop = /\b(?:lost|losing|falling|dropping|declining|rising|trending|growing|competing|cannibal|stale|updated|leave|bounce|no (?:search )?traffic|zero|get no)\b/i.test(s);
            if (_isTop && !_notTop) {
                let _metric = 'impressions';
                if (/\b(?:views?|viewed|visits?|visited|popular|read)\b/i.test(s)) _metric = 'pageViews';
                else if (/\b(?:click|clicked|clicks)\b/i.test(s)) _metric = 'clicks';
                else if (/\b(?:user|users|visitors)\b/i.test(s)) _metric = 'users';
                const _cs = s.replace(/\bby (?:views?|impressions?|clicks?|traffic|users?)\b/gi, '').replace(/\s+/g, ' ').trim();
                const _im = / (?:in|for|within) (.+?)\??$/i.exec(_cs);
                return { intent: 'top_pages', metric: _metric, category: _im ? _im[1].trim() : null };
            }
        }
        // "how is the X page doing" / "page views for X" / "how many views has X page (this month)" -> page_summary
        // Strip a trailing time expression first so it isn't captured as part of the page name.
        const _psq = s.replace(/\b(?:in\s+)?(?:the\s+)?(?:this|last|past)\s+(?:week|month|quarter|year|\d+\s*(?:days?|weeks?|months?))\b/gi, '').replace(/\bin the last\b[^?]*/gi, '').replace(/\s+/g, ' ').trim();
        const psm = /^(?:how's|how is|how are|what's|what is|what are)\s+(?:the\s+)?(.+?)\s+page(?:\s+(?:doing|performing|going|getting on|perform))?\??$/i.exec(_psq)
            || /^(?:page ?views|views|clicks|impressions|traffic|stats|metrics|performance|numbers)\s+(?:for|on|of)\s+(?:the )?(.+?)(?:\s+page)?\??$/i.exec(_psq)
            || /^how (?:many|much)\s+(?:page ?)?(?:views?|clicks?|impressions?|hits?|traffic)\s+(?:does|do|did|has|have|is|are|got)?\s*(?:the )?(.+?)(?:\s+page)?(?:\s+(?:get|gets|got|have|had|getting|receives?))?\??$/i.exec(_psq);
        if (psm && psm[1]) { const _pg = psm[1].replace(/\s+page$/i, '').trim(); if (_pg && !/^from\b/i.test(_pg)) return { intent: 'page_summary', page: _pg }; }
        // "quick wins for X" / "what should X target" -> page_queries by potential
        const pmp = /^(?:quick wins for (?:the )?(.+?)(?:\s+page)?|what should (?:the )?(.+?)(?:\s+page)? target)\??$/i.exec(s);
        if (pmp && (pmp[1] || pmp[2])) return { intent: 'page_queries', page: (pmp[1] || pmp[2]).trim(), by_potential: true };
        const pm = /^(?:what (?:search )?queries|what searches|what search terms) (?:bring|brings|lead|leads|send|sends|drive|drives) (?:people |visitors |users |traffic )?to (?:the )?(.+?)(?:\s+page)?\??$/i.exec(s);
        if (pm && pm[1]) return { intent: 'page_queries', page: pm[1].trim() };
        const pm2 = /^what do people search (?:for )?to (?:find|reach|get to) (?:the )?(.+?)(?:\s+page)?\??$/i.exec(s);
        if (pm2 && pm2[1]) return { intent: 'page_queries', page: pm2[1].trim() };
        return null;
    }

    async function showAsk() {
        const tree = window.treeData;
        if (!tree) { alert('Load a sitemap first.'); return; }
        if (!window.GroqAI || !window.GroqAI.isConfigured || !window.GroqAI.isConfigured()) { alert('Connect AI first - click the AI button in the toolbar to add your Groq key.'); return; }
        ensureDDStyle();
        ensureAskStyle();

        // Already open? just focus it.
        const existing = document.getElementById('sv-ask-panel');
        if (existing) { const ei = existing.querySelector('#sv-ask-input'); if (ei) ei.focus(); return; }

        const _prevFocus = document.activeElement;
        // Intro = the scoped "what stands out" hero when a rollup is already cached (no fetch on
        // open); otherwise the static example chips. Recomputed on clear + on scope change.
        function _buildIntro() {
            let r0 = null; try { r0 = build(window.treeData); } catch (e) {}
            const hasData = r0 && (r0.totals.impressions > 0 || r0.totals.pageViews > 0);
            if (hasData) return _heroHtml(r0, _getScopeName());
            return '<div class="sv-ask-intro">' +
                '<div style="font-size:0.82rem;color:var(--color-text-secondary);margin-bottom:12px;line-height:1.5;">Ask about sections, pages, search queries, opportunities and engagement. Figures come from your real GSC/GA4 data.</div>' +
                '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:7px;">Try one</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + _chipBtns(_pickChips()) + '</div>' +
                '<button class="sv-ask-help" style="margin-top:12px;background:none;border:none;color:var(--primary);font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;padding:0;text-decoration:underline;">What can I ask?</button>' +
            '</div>';
        }
        const _introHtml = _buildIntro();

        const panel = document.createElement('div');
        panel.id = 'sv-ask-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Ask your data');
        panel.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:min(680px,96vw);z-index:4000;background:var(--color-bg-secondary);border-left:1px solid var(--color-border-primary);box-shadow:-8px 0 30px rgba(0,0,0,0.18);display:flex;flex-direction:column;font-family:var(--font-family);transition:transform 0.22s ease;transform:translateX(100%);';
        panel.innerHTML =
            '<div style="flex:0 0 auto;padding:14px 16px;border-bottom:1px solid var(--color-border-primary);display:flex;align-items:center;gap:8px;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:1.05rem;font-weight:700;color:var(--color-text-heading);">Ask your data</div>' +
                    '<div style="font-size:0.66rem;color:var(--color-text-muted);">AI phrases &middot; code computes &middot; real GSC/GA4</div>' +
                '</div>' +
                '<select id="sv-ask-period" class="sv-ask-ctl" title="Time window for answers">' + PERIODS.map(function (p) { return '<option value="' + p.d + '"' + (p.d === _ddDays ? ' selected' : '') + '>' + p.label.replace(/^Last /, '') + '</option>'; }).join('') + '</select>' +
                '<select id="sv-ask-scope" class="sv-ask-ctl" title="Your section — scopes answers, one tap to broaden" style="max-width:124px;">' + _scopeOptions(_getScopeName()) + '</select>' +
                '<button class="sv-ask-clear sv-ask-iconbtn-muted" title="Clear session" aria-label="Clear session"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>' +
                '<button class="sv-ask-close sv-ask-iconbtn-muted" title="Close (Esc)" aria-label="Close" style="font-size:22px;line-height:1;padding:0 4px;">&times;</button>' +
            '</div>' +
            '<div id="sv-ask-transcript" style="flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px;">' + _introHtml + '</div>' +
            '<div style="flex:0 0 auto;padding:12px 14px;border-top:1px solid var(--color-border-primary);">' +
                '<div id="sv-ask-suggest" style="display:none;flex-direction:column;gap:3px;margin-bottom:8px;max-height:184px;overflow-y:auto;overscroll-behavior:contain;"></div>' +
                '<div style="display:flex;gap:8px;">' +
                    '<input id="sv-ask-input" class="sv-ask-input" type="text" placeholder="Ask a question..." aria-label="Ask a question" autocomplete="off" />' +
                    '<button id="sv-ask-mic" class="sv-ask-icon-btn" title="Ask by voice" aria-label="Ask by voice" style="display:none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg></button>' +
                    '<button id="sv-ask-go" class="sv-ask-btn-primary">Ask</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(panel);
        requestAnimationFrame(function () { panel.style.transform = 'translateX(0)'; });
        const _askFab = document.getElementById('sv-ask-fab');
        if (_askFab) _askFab.style.display = 'none';   // panel covers the right; hide its own launcher

        const input = panel.querySelector('#sv-ask-input');
        const transcript = panel.querySelector('#sv-ask-transcript');
        const _exports = Object.create(null);
        let _entryN = 0;
        // Session-memory cap. _exports (rows/markdown/chart data per answer) and the transcript DOM
        // (charts, tables, SVGs) grow unboundedly until "clear" or close — a 40-question morning
        // would eventually feel it, and per house rule that "panel got slow" report arrives with NO
        // console error. Past ~30 answers, collapse the oldest to just its headline: free its export
        // record and swap its heavy body for the one-liner. Cheap, and history stays readable.
        function _capHistory() {
            const CAP = 30;
            const entries = transcript.querySelectorAll('.sv-ask-entry');
            const excess = entries.length - CAP;
            for (let i = 0; i < excess; i++) {
                const old = entries[i];
                if (old.getAttribute('data-collapsed')) continue;
                if (old.id && _exports[old.id]) delete _exports[old.id];
                const resp = old.querySelector('.sv-ask-resp');
                const one = old.querySelector('.sv-ask-oneliner');
                if (resp) resp.innerHTML = one ? one.outerHTML : '<div style="font-size:0.72rem;color:var(--color-text-muted);font-style:italic;">(earlier answer collapsed to save memory)</div>';
                old.setAttribute('data-collapsed', '1');
            }
        }
        let _forceSite = false;   // set by the "check whole site" escape chip; consumed once by ask()
        let _forcedPlan = null;   // set by a did-you-mean candidate click: re-run the SAME intent with the RESOLVED page, structurally (consumed once by ask())

        // Scope pill: persist the owner's section and re-render the hero (only while the intro shows).
        const _scopeSel = panel.querySelector('#sv-ask-scope');
        if (_scopeSel) _scopeSel.addEventListener('change', function () {
            _setScopeName(this.value);
            const intro = transcript.querySelector('.sv-ask-intro');
            if (intro) transcript.innerHTML = _buildIntro();
        });
        // Period pill: sets the base window for subsequent questions (a typed "this week" still
        // overrides per-question). No fetch here — the next question fetches for the new window.
        const _perSel = panel.querySelector('#sv-ask-period');
        if (_perSel) _perSel.addEventListener('change', function () { const d = parseInt(this.value, 10); if (d) _ddDays = d; });

        function closePanel() {
            document.removeEventListener('keydown', onKey);
            try { if (window.askClearHighlight) window.askClearHighlight(); } catch (e) {}   // don't leave the tree glowing
            panel.style.transform = 'translateX(100%)';
            setTimeout(function () { panel.remove(); }, 220);
            if (_askFab) _askFab.style.display = '';   // bring the launcher back
            if (_prevFocus && _prevFocus.focus) { try { _prevFocus.focus(); } catch (e) {} }
        }
        function onKey(e) { if (e.key === 'Escape' && document.getElementById('sv-ask-panel')) closePanel(); }
        document.addEventListener('keydown', onKey);

        panel.querySelector('.sv-ask-close').addEventListener('click', closePanel);
        panel.querySelector('.sv-ask-clear').addEventListener('click', function () {
            for (const k in _exports) delete _exports[k];
            try { if (window.askClearHighlight) window.askClearHighlight(); } catch (e) {}
            transcript.innerHTML = _buildIntro();
            input.focus();
        });

        // Keep wheel/touch scrolling inside the panel — never let it reach the D3 tree zoom behind it.
        panel.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
        panel.addEventListener('touchmove', function (e) { e.stopPropagation(); }, { passive: true });
        panel.addEventListener('mousemove', _chartTipMove);
        panel.addEventListener('mouseleave', _chartTipHide);
        panel.addEventListener('click', function (e) {
            const more = e.target.closest('.sv-ask-more');
            if (more) { const box = transcript.querySelector('.sv-ask-actions[data-eid="' + more.getAttribute('data-eid') + '"]'); if (box) { const open = box.style.display !== 'none'; box.style.display = open ? 'none' : 'flex'; more.setAttribute('aria-expanded', open ? 'false' : 'true'); more.style.background = open ? 'var(--color-bg-primary)' : 'var(--color-bg-tertiary)'; } return; }
            const mbtn = e.target.closest('.sv-ask-metric-btn');
            if (mbtn) {
                const eid = mbtn.getAttribute('data-eid'), m = mbtn.getAttribute('data-metric');
                const ex = _exports[eid];
                if (ex && ex.data && ex.data.metricViews && ex.data.metricViews[m]) {
                    const mv = ex.data.metricViews[m];
                    ex.data.columns = mv.columns; ex.data.rows = mv.rows; ex.data.chart = mv.chart; ex.data.metric = m;
                    const entry = document.getElementById(eid);
                    if (entry) {
                        const rich = entry.querySelector('.sv-ask-rich'); if (rich) rich.innerHTML = mv.body;
                        const tb = entry.querySelector('.sv-ask-tbl'); if (tb) tb.innerHTML = _dataTable(ex.data);
                        Array.prototype.forEach.call(entry.querySelectorAll('.sv-ask-metric-btn'), function (b) { const on = b.getAttribute('data-metric') === m; b.style.background = on ? 'var(--primary)' : 'transparent'; b.style.color = on ? '#fff' : 'var(--color-text-secondary)'; });
                    }
                }
                return;
            }
            const ecsv = e.target.closest('.sv-ask-export-csv');
            if (ecsv) { const ex = _exports[ecsv.getAttribute('data-eid')]; if (ex) _download('ask-' + _slug(ex.q) + '-' + _todayStr() + '.csv', _toCSV(ex.data), 'text/csv'); return; }
            const ebrief = e.target.closest('.sv-ask-export-brief');
            if (ebrief) { const ex = _exports[ebrief.getAttribute('data-eid')]; if (ex) _exportBrief(ex, ebrief); return; }
            const ecopy = e.target.closest('.sv-ask-memo-copy');
            if (ecopy) { const ex = _exports[ecopy.getAttribute('data-eid')]; if (ex && ex.markdown) { const done = function () { const t = ecopy.innerHTML; ecopy.innerHTML = 'Copied'; setTimeout(function () { ecopy.innerHTML = t; }, 1400); }; if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(ex.markdown).then(done, function () {}); } else { try { const ta = document.createElement('textarea'); ta.value = ex.markdown; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done(); } catch (e2) {} } } return; }
            const emd = e.target.closest('.sv-ask-memo-md');
            if (emd) { const ex = _exports[emd.getAttribute('data-eid')]; if (ex && ex.markdown) _download('digest-' + _slug(ex.q) + '-' + _todayStr() + '.md', ex.markdown, 'text/markdown'); return; }
            const epng = e.target.closest('.sv-ask-chart-png');
            if (epng) { const eid = epng.getAttribute('data-eid'); const el = document.getElementById(eid); const svg = el && el.querySelector('.sv-chart svg'); const ex = _exports[eid]; if (svg) _svgToPng(svg, 'chart-' + _slug(ex ? ex.q : 'ask') + '-' + _todayStr() + '.png', 2); return; }
            const eexp = e.target.closest('.sv-ask-chart-expand');
            if (eexp) { const ex = _exports[eexp.getAttribute('data-eid')]; if (ex) _expandChart(ex.data, ex.q, ex.list); return; }
            const vbtn = e.target.closest('.sv-ask-view-btn');
            if (vbtn) {
                const veid = vbtn.getAttribute('data-eid'), vmode = vbtn.getAttribute('data-mode');
                const ventry = document.getElementById(veid);
                if (ventry) {
                    const vr = ventry.querySelector('.sv-ask-rich'), vt = ventry.querySelector('.sv-ask-tbl');
                    if (vr) vr.style.display = (vmode === 'table') ? 'none' : '';
                    if (vt) vt.style.display = (vmode === 'table') ? '' : 'none';
                    Array.prototype.forEach.call(ventry.querySelectorAll('.sv-ask-view-btn'), function (b) { const on = b.getAttribute('data-mode') === vmode; b.style.background = on ? 'var(--primary)' : 'transparent'; b.style.color = on ? '#fff' : 'var(--color-text-secondary)'; });
                }
                return;
            }
            const help = e.target.closest('.sv-ask-help');
            if (help) {
                const _in = transcript.querySelector('.sv-ask-intro'); if (_in) _in.remove();
                const _d = document.createElement('div'); _d.style.cssText = 'margin-bottom:18px;'; _d.innerHTML = _paletteHtml(); transcript.appendChild(_d);
                const ps = _d.querySelector('#sv-ask-pal-search');
                if (ps) {
                    ps.addEventListener('input', function () {
                        const term = this.value.trim().toLowerCase(); let any = false;
                        Array.prototype.forEach.call(_d.querySelectorAll('.sv-pal-group'), function (g) {
                            let gv = false;
                            Array.prototype.forEach.call(g.querySelectorAll('.sv-pal-item'), function (it) { const show = !term || it.textContent.toLowerCase().indexOf(term) > -1; it.style.display = show ? '' : 'none'; if (show) gv = true; });
                            g.style.display = gv ? '' : 'none'; if (gv) any = true;
                        });
                        const emp = _d.querySelector('.sv-pal-empty'); if (emp) emp.style.display = any ? 'none' : 'block';
                    });
                    setTimeout(function () { try { ps.focus(); } catch (_e) {} }, 50);
                }
                _d.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
            const scopeOpen = e.target.closest('.sv-ask-scope-open');
            if (scopeOpen) { if (_scopeSel) { try { _scopeSel.focus(); } catch (_e) {} } return; }
            const dis = e.target.closest('.sv-ask-disambig');
            if (dis) {
                // Structured re-dispatch: force the ORIGINAL intent with the RESOLVED page (exact name), so it resolves
                // uniquely and re-runs the same question - never a mis-templated diagnose (A8). Bubble text is display-only.
                const di = dis.getAttribute('data-intent'), dp = dis.getAttribute('data-page');
                if (di && dp) { _forcedPlan = { intent: di, page: dp }; input.value = _disambigQ(di, dp); ask(); }
                return;
            }
            const chip = e.target.closest('.sv-ask-chip');
            if (chip) { if (chip.getAttribute('data-scope') === 'site') _forceSite = true; input.value = chip.dataset.q; ask(); return; }
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

        panel.querySelector('#sv-ask-go').addEventListener('click', function () { _hideSuggest(); ask(); });
        // ── Typeahead: suggest matching questions as the user types ──
        const suggestBox = panel.querySelector('#sv-ask-suggest');
        let _sugItems = [], _sugIdx = -1;
        function _highlightSug() { Array.prototype.forEach.call(suggestBox.children, function (el, i) { el.style.background = i === _sugIdx ? 'var(--color-bg-tertiary)' : 'var(--color-bg-primary)'; }); }
        function _hideSuggest() { suggestBox.style.display = 'none'; suggestBox.innerHTML = ''; _sugItems = []; _sugIdx = -1; }
        function _renderSuggest() {
            _sugItems = _suggest(input.value); _sugIdx = -1;
            if (!_sugItems.length) { _hideSuggest(); return; }
            suggestBox.innerHTML = _sugItems.map(function (qq) { return '<button class="sv-ask-sug" data-q="' + esc(qq) + '" style="text-align:left;font-size:0.8rem;padding:7px 10px;border-radius:8px;border:1px solid var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-primary);cursor:pointer;font-family:inherit;">' + esc(qq) + '</button>'; }).join('');
            suggestBox.style.display = 'flex';
        }
        input.addEventListener('input', _renderSuggest);
        input.addEventListener('blur', function () { setTimeout(_hideSuggest, 150); });
        input.addEventListener('keydown', function (e) {
            const open = suggestBox.style.display !== 'none' && _sugItems.length;
            if (open && e.key === 'ArrowDown') { e.preventDefault(); _sugIdx = (_sugIdx + 1) % _sugItems.length; _highlightSug(); return; }
            if (open && e.key === 'ArrowUp') { e.preventDefault(); _sugIdx = (_sugIdx - 1 + _sugItems.length) % _sugItems.length; _highlightSug(); return; }
            if (open && e.key === 'Escape') { e.preventDefault(); _hideSuggest(); return; }
            if (e.key === 'Enter') { if (open && _sugIdx >= 0) { input.value = _sugItems[_sugIdx]; } _hideSuggest(); ask(); }
        });
        suggestBox.addEventListener('click', function (e) { const b = e.target.closest('.sv-ask-sug'); if (b) { input.value = b.getAttribute('data-q'); _hideSuggest(); ask(); } });
        // Voice input via the Web Speech API — feature-detected; the mic stays hidden otherwise.
        const _mic = panel.querySelector('#sv-ask-mic');
        const _SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (_mic && _SR) {
            _mic.style.display = '';
            let _rec = null, _listening = false;
            _mic.addEventListener('click', function () {
                if (_listening) { try { _rec.stop(); } catch (e) {} return; }
                _rec = new _SR(); _rec.lang = 'en-IE'; _rec.interimResults = false; _rec.maxAlternatives = 1;
                _rec.onstart = function () { _listening = true; _mic.style.color = '#dc2626'; _mic.style.borderColor = '#dc2626'; };
                _rec.onerror = function () { _listening = false; _mic.style.color = ''; _mic.style.borderColor = ''; };
                _rec.onend = function () { _listening = false; _mic.style.color = ''; _mic.style.borderColor = ''; };
                _rec.onresult = function (ev) { const t = ev.results[0][0].transcript; if (t) { input.value = t; ask(); } };
                try { _rec.start(); } catch (e) {}
            });
        }
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
            entry.className = 'sv-ask-entry';   // margin + fade-up entrance now live in the stylesheet
            entry.id = eid;
            entry.innerHTML =
                '<div style="display:flex;justify-content:flex-end;margin-bottom:9px;"><div style="background:var(--primary);color:#fff;font-size:0.82rem;font-weight:600;padding:7px 12px;border-radius:12px 12px 3px 12px;max-width:88%;word-break:break-word;">' + esc(q) + '</div></div>' +
                '<div class="sv-ask-resp">' + _thinkingHtml('Thinking') + '</div>';
            transcript.appendChild(entry);
            _capHistory();                                  // collapse oldest answers past the cap
            const resp = entry.querySelector('.sv-ask-resp');
            entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const _savedDD = _ddDays;                       // honour a per-question window, then restore
            const _ap = _askPeriod(q);
            if (_ap && _ap !== _ddDays) _ddDays = _ap;
            try {
                const r = await refreshForPeriod(tree, _ddDays).catch(function () { return build(tree); });
                const catNames = r.categories.map(function (c) { return c.name; });
                // Prompt-caching: keep the system prompt 100% STATIC (identical every request) so Groq
                // caches this ~3k-token prefix — cached tokens don't count toward rate limits. The
                // per-session section list is dynamic, so it goes in the USER message (the tail), NOT here.
                const sys = _ASK_SYS_PROMPT;
                // Deterministic parser FIRST — only fall back to the LLM (a Groq call) when it
                // can't handle the phrasing. Cuts ~1 Groq call per question for common queries.
                // A did-you-mean click supplies a structured plan directly (resolved page + original intent): use it as-is
                // and skip parsing entirely, so the same intent re-runs and the exact name resolves uniquely.
                const _forced = _forcedPlan; _forcedPlan = null;
                let plan = _forced || _quickParse(q);
                let _parseErr = false;
                if (!plan) {
                    const _usr = 'Sections available: ' + catNames.join(', ') + '.\nQuestion: ' + q;
                    let raw = null;
                    try {
                        // max_tokens is the ceiling for reasoning + content combined. The JSON answer is ~30 tokens,
                        // but gpt-oss reasons in the same budget, and a HARD/ambiguous question (exactly what the LLM
                        // fallback exists for) can burn a 200 cap entirely on reasoning, leaving EMPTY content -> Groq's
                        // json_validate_failed -> 400. Give reasoning headroom (1000) and ask for minimal deliberation
                        // (a classification wants compliance, not a think). This is the A6 root-cause fix.
                        raw = await window.GroqAI.complete([{ role: 'system', content: sys }, { role: 'user', content: _usr }], { temperature: 0, max_tokens: 1000, reasoning_effort: 'low', response_format: { type: 'json_object' } });
                    } catch (pe) {
                        // The parser FAILING is not the ANSWER failing. A rejected/malformed Groq request (e.g. an
                        // unbuilt question the prompt has no fields for) must degrade to the graceful unknown path,
                        // never crash the panel. Log it (house rule: real error before theorising) and mark it so
                        // the miss is tagged parse_error, keeping crashes distinguishable from genuine unknowns.
                        if (typeof console !== 'undefined') console.error('[SVRollup] Ask parser request failed, treating as unknown:', (pe && pe.message) ? pe.message : pe);
                        _parseErr = true;
                    }
                    if (raw != null) { try { plan = JSON.parse(String(raw).replace(/```json|```/g, '').trim()); } catch (e) { plan = { intent: 'unknown' }; } }
                    else plan = { intent: 'unknown' };
                }
                if (!plan) plan = { intent: 'unknown' };
                // Category-owner scope: default bare questions to the owner's section, one-shot for
                // explicit overrides, site-wide for page/unscopeable intents (rules 1-3).
                const _sticky = _getScopeName();
                const _sc = _applyScope(plan, _sticky, _forceSite);
                _forceSite = false;
                // Canonicalise the resolved section to the ENTITY's real name, not the user's raw casing: the chip and
                // follow-up chips must show what was RESOLVED ("Health"), not the typed string ("HEALTH"). The resolver
                // already matched case-insensitively; this stops the DISPLAY from echoing the raw string.
                if (plan.category) { const _cc = _catByName(r.categories, plan.category); if (_cc) plan.category = _cc.name; }
                if (plan.categories) plan.categories = plan.categories.map(function (n) { const _cc = _catByName(r.categories, n); return _cc ? _cc.name : n; });
                if (((plan.intent === 'opportunities' || plan.intent === 'top_queries') && !_queryCache[_ddDays]) ||
                    ((plan.intent === 'international_queries' || plan.intent === 'top_countries') && !_countryQueryCache[_ddDays])) {
                    resp.innerHTML = _thinkingHtml('Fetching search-query data from Search Console');
                }
                if (plan.intent === 'trend') { resp.innerHTML = _thinkingHtml('Building a 6-month trend (fetching several periods)'); }
                if (plan.intent === 'seasonal') { resp.innerHTML = _thinkingHtml('Comparing to last period and the same period last year'); }
                if (plan.intent === 'traffic_sources') { resp.innerHTML = _thinkingHtml('Fetching traffic sources from GA4'); }
                if (plan.intent === 'ai_impact') { resp.innerHTML = _thinkingHtml('Measuring AI impact (Search Console + GA4)'); }
                if (plan.intent === 'ai_exposed') { resp.innerHTML = _thinkingHtml('Finding the pages Google answers for'); }
                if (plan.intent === 'diagnose') { resp.innerHTML = _thinkingHtml('Diagnosing the page (checking AI exposure, may fetch a comparison window)'); }
                if (plan.intent === 'stale') { resp.innerHTML = _thinkingHtml('Fetching 6-month trajectories for the stale pages'); }
                if (plan.intent === 'low_ctr') { resp.innerHTML = _thinkingHtml('Fetching 6-month trajectories for the under-clicked pages'); }
                if (plan.intent === 'compare_periods') { resp.innerHTML = _thinkingHtml('Fetching both periods'); }
                const res = await runIntent(plan, r);
                if (res.unknown) {
                    _logMiss(q, _parseErr ? 'parse_error' : 'unknown');
                    resp.innerHTML = '<div style="font-size:0.85rem;color:var(--color-text-secondary);margin-bottom:10px;">I did not quite catch that. I cover priorities, opportunities, page &amp; section performance, search queries, geography and the Irish/English gap. Try one of these (or tap <b>What can I ask?</b>):</div><div style="display:flex;flex-wrap:wrap;gap:6px;">' + _chipBtns(_pickChips()) + '</div><button class="sv-ask-help" style="margin-top:10px;background:none;border:none;color:var(--primary);font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;padding:0;text-decoration:underline;">What can I ask?</button>';
                    busy = false; return;
                }
                if (res.err) {
                    // A handler can flag its refusal as a demand signal (res.missTag): capture it in the same log as
                    // genuine unknowns, so a graceful "can't do that yet" no longer silently eats the evidence for the
                    // feature that would answer it (the A6 lesson: the crash ate change_impact demand; the err must not).
                    if (res.missTag) _logMiss(q, res.missTag);
                    // Escape hatch (rule note): a scoped default that comes up empty shouldn't feel like a trap. But the chip
                    // must derive from the ACTUAL failure - a period-grammar refusal (res.noScopeEscape) isn't fixed by
                    // broadening scope, so don't offer "check the whole site" there (B9: chips follow the failure state).
                    const _esc = (!res.noScopeEscape && _sc.resolvedScope && !_sc.oneShot && _sticky)
                        ? '<button class="sv-ask-chip sv-ask-chip-accent" data-scope="site" data-q="' + esc(q) + '" style="margin-top:10px;">Check the whole site &rarr;</button>'
                        : '';
                    resp.innerHTML = '<div style="font-size:0.85rem;color:var(--color-text-secondary);">' + esc(res.err) + '</div>' + _esc;
                    busy = false; return;
                }
                // Carry the rich LIST html (rankCard bars/sparklines) so Expand can show it - a list answer is not an
                // _isChart SVG, so without this expand falls to the table and loses the sparklines.
                const _listBody = (_isChart(res.data) || (res.data && res.data.chart && res.data.chart.type === 'map')) ? null : (res.html || null);
                if ((res.data && res.data.rows && res.data.rows.length) || res.markdown) _exports[eid] = { data: res.data, q: q, summary: res.summary, markdown: res.markdown || null, list: _listBody };
                // Light up the pages this answer concerns, ON the tree (one-way). Central + tone-by-
                // intent, so no intent body needs to know the tree exists. Rows already carry `url`
                // (or `bestPage` for query answers); movers splits by direction. Cleared each question.
                try {
                    if (window.askClearHighlight) window.askClearHighlight();
                    const _rows = (res.data && res.data.rows) || [];
                    let _hls = null;
                    if (plan.intent === 'movers' && _rows.length) {
                        const _pick = function (test) { return _rows.filter(test).map(function (x) { return x.url; }).filter(Boolean); };
                        _hls = [{ tone: 'red', urls: _pick(function (x) { return (x.changePct || 0) < 0; }) },
                                { tone: 'teal', urls: _pick(function (x) { return (x.changePct || 0) >= 0; }) }];
                    } else {
                        const _t = _toneFor(plan.intent);
                        if (_t) { const _us = _rows.map(function (x) { return x.url || x.bestPage; }).filter(Boolean); if (_us.length) _hls = [{ tone: _t, urls: _us }]; }
                    }
                    if (_hls && window.askHighlight) _hls.forEach(function (h) { if (h.urls && h.urls.length) window.askHighlight(h.urls, h.tone); });
                } catch (e) {}
                const interpBits = [_ILBL[plan.intent] || plan.intent];
                // Source + growth ride the plan but were invisible in the chip: an answer scoped to AI, read as growth,
                // must SAY so (a chip narrower than its answer is the honesty mechanism half-failing). e.g. "AI traffic · growth".
                if (plan.intent === 'traffic_sources' && plan.source) interpBits[0] = plan.source + ' traffic';
                if (plan.growth) interpBits.push('growth');
                // The chip shows the RESOLVED scope (rule 5) via _interpScope: it prefers what runIntent ACTUALLY used
                // (res.scope) over what the plan requested, so a scope-ignoring handler can't leave a false category chip.
                _interpScope(plan, _sc, res).forEach(function (b) { interpBits.push(b); });
                interpBits.push(periodLabel(_ddDays));
                const interp = '<div style="font-size:0.68rem;color:var(--color-text-muted);margin-bottom:10px;">Interpreted as: <span style="color:var(--color-text-secondary);font-weight:600;">' + esc(interpBits.join(' · ')) + '</span><span style="opacity:0.4;margin-left:6px;" title="Build stamp: which deploy produced this answer">build ' + esc(_BUILD) + '</span></div>';
                const _metricTgl = (res.data && res.data.availableMetrics && res.data.availableMetrics.length > 1 && res.data.metricViews) ? _metricToggleHtml(eid, res.data.availableMetrics, res.data.metric) : '';
                // Chart/card body only — the metric toggle sits OUTSIDE .sv-ask-rich so the handler's
                // innerHTML swap (which replaces .sv-ask-rich) doesn't delete the toggle buttons.
                const _bodyHtml = (res.data && res.data.metricViews) ? res.data.metricViews[res.data.metric].body : (_renderChart(res.data) || res.html);
                const _tblHtml = _exports[eid] ? '<div class="sv-ask-tbl" style="display:none;">' + _dataTable(res.data) + '</div>' : '';
                const _segNames = r.categories.map(function (c) { return c.name; }).concat([plan.category, plan.page]).concat(plan.categories || []);
                const _segNote = plan.intent === 'traffic_sources' ? '' : _segmentNote(q, _segNames);
                const _segHtml = _segNote ? '<div style="font-size:0.7rem;color:#b45309;background:var(--color-bg-tertiary);border-radius:7px;padding:7px 10px;margin-bottom:10px;">' + esc(_segNote) + '</div>' : '';
                const _hlHtml = _headlineHtml(res.headline || _headlineFor(plan.intent, res.data));   // verdict-first: the one number, big, above the sentence
                resp.innerHTML = interp + _segHtml + _hlHtml + '<div class="sv-ask-oneliner" style="font-size:0.95rem;color:var(--color-text-heading);font-weight:700;line-height:1.5;margin:0 0 13px;border-left:3px solid var(--primary);padding-left:11px;">' + esc(res.summary || '') + '</div>' + _metricTgl + '<div class="sv-ask-rich">' + _bodyHtml + '</div>' + _tblHtml;
                _animateCountups(resp);
                if (_exports[eid]) {
                    const _abtn = 'display:inline-flex;align-items:center;font-size:0.72rem;padding:5px 11px;border-radius:8px;border:1px solid var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-secondary);cursor:pointer;font-family:inherit;font-weight:600;';
                    const _hasMemo = _exports[eid] && _exports[eid].markdown;
                    // Primary row: row count + the view toggle + one "⋯" that reveals export/expand actions.
                    resp.insertAdjacentHTML('beforeend',
                        '<div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:14px;">' +
                        '<span style="font-size:0.68rem;color:var(--color-text-muted);margin-right:auto;">' + res.data.rows.length + ' row' + (res.data.rows.length === 1 ? '' : 's') + '</span>' +
                        '<div style="display:inline-flex;gap:2px;border:1px solid var(--color-border-primary);border-radius:7px;padding:2px;">' +
                        '<button class="sv-ask-view-btn" data-eid="' + eid + '" data-mode="rich" style="font:inherit;font-size:0.68rem;font-weight:600;padding:3px 9px;border:none;border-radius:5px;cursor:pointer;background:var(--primary);color:#fff;">' + (_isChart(res.data) ? 'Chart' : ((res.data.chart && res.data.chart.type === 'map') ? 'Map' : 'List')) + '</button>' +
                        '<button class="sv-ask-view-btn" data-eid="' + eid + '" data-mode="table" style="font:inherit;font-size:0.68rem;font-weight:600;padding:3px 9px;border:none;border-radius:5px;cursor:pointer;background:transparent;color:var(--color-text-secondary);">Table</button>' +
                        '</div>' +
                        '<button class="sv-ask-more" data-eid="' + eid + '" title="Export & more" aria-label="Export and more actions" aria-expanded="false" style="font:inherit;font-size:0.95rem;font-weight:700;line-height:1;padding:3px 11px;border-radius:8px;border:1px solid var(--color-border-primary);background:var(--color-bg-primary);color:var(--color-text-secondary);cursor:pointer;">&#8943;</button>' +
                        '</div>' +
                        // Secondary actions, hidden until "⋯" is tapped.
                        '<div class="sv-ask-actions" data-eid="' + eid + '" style="display:none;flex-wrap:wrap;justify-content:flex-end;gap:6px;margin-top:8px;">' +
                        '<button class="sv-ask-chart-expand" data-eid="' + eid + '" title="View larger" style="' + _abtn + '">' + _ICON_EXPAND + 'Expand</button>' +
                        (_isChart(res.data) ? '<button class="sv-ask-chart-png" data-eid="' + eid + '" title="Download chart as PNG" style="' + _abtn + '">' + _ICON_IMG + 'PNG</button>' : '') +
                        '<button class="sv-ask-export-csv" data-eid="' + eid + '" title="Download these rows as CSV" style="' + _abtn + '">' + _ICON_DL + 'CSV</button>' +
                        '<button class="sv-ask-export-brief" data-eid="' + eid + '" title="Write a short Markdown brief with AI" style="' + _abtn + '">' + _ICON_DOC + 'Brief</button>' +
                        (_hasMemo ? ('<button class="sv-ask-memo-copy" data-eid="' + eid + '" title="Copy the memo (Markdown)" style="' + _abtn + '">' + _ICON_COPY + 'Copy</button>' +
                        '<button class="sv-ask-memo-md" data-eid="' + eid + '" title="Download the memo (.md)" style="' + _abtn + '">' + _ICON_DOC + '.md</button>') : '') +
                        '</div>');
                }
                // A compound question answers ONE part: surface the REMAINDER as a tap so it can't vanish silently (A12).
                // Prefer the Groq-supplied clean standalone question; fall back to the deterministic tail. Disambig grows nothing.
                const _rem = res.disambig ? null : ((plan.remainder && String(plan.remainder).trim().length > 3) ? String(plan.remainder).trim() : _compoundRemainder(q));
                // A did-you-mean is a paused question, not an answer: grow NO follow-up chips from it (they would be
                // template-filled with the unresolved raw string, e.g. "payments" as if it were a page). A8 sibling of the A5 entity-typing bug.
                const _fups = (res.disambig || _rem) ? [] : _followups(plan, res, r);
                if (_rem) {
                    resp.insertAdjacentHTML('beforeend',
                        '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--color-border-primary);">' +
                        '<div style="font-size:0.72rem;color:#b45309;margin-bottom:8px;">I answered the first part. You also asked for more, tap to ask the rest:</div>' +
                        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
                        '<button class="sv-ask-chip sv-ask-chip-accent sv-ask-follow" data-q="' + esc(_rem) + '">' + esc(_rem) + ' &rarr;</button>' +
                        '</div></div>');
                } else if (_fups.length) {
                    resp.insertAdjacentHTML('beforeend',
                        '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--color-border-primary);">' +
                        '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted);margin-bottom:8px;">Explore next</div>' +
                        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
                        _fups.map(function (fq) { return '<button class="sv-ask-chip sv-ask-chip-accent sv-ask-follow" data-q="' + esc(fq) + '">' + esc(fq) + ' &rarr;</button>'; }).join('') +
                        '</div></div>');
                }
                entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Headline = the deterministic res.summary (rendered above). No second Groq call —
                // it saved nothing over the summary and was the source of hallucination/truncation.
            } catch (e) {
                // Graceful degradation must wrap intent EXECUTION, not just parsing (A8: a ReferenceError inside a handler
                // reached the user as raw text). Log the real error for diagnosis, capture the miss, show a calm message.
                if (typeof console !== 'undefined') console.error('[SVRollup] Ask failed while answering:', e);
                _logMiss(q, 'exec_error');
                resp.innerHTML = '<div style="font-size:0.85rem;color:var(--color-text-secondary);">I hit a problem answering that, and it has been logged. Try rephrasing, or ask something else.</div>';
            } finally {
                _ddDays = _savedDD;   // restore the period selector's window (runs on every exit path)
            }
            busy = false;
        }
    }

    // Bottom-right launcher for Ask (replaces the old nav button). Chat-bubble + "Ask".
    // Sits just below the panel's z-index and hides itself while the panel is open.
    function _ensureAskFab() {
        if (document.getElementById('sv-ask-fab')) return;
        const b = document.createElement('button');
        b.id = 'sv-ask-fab';
        b.type = 'button';
        b.title = 'Ask a question about your data';
        b.setAttribute('aria-label', 'Ask your data');
        b.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:3900;display:flex;align-items:center;gap:9px;height:56px;padding:0 22px 0 20px;border:none;border-radius:28px;background:linear-gradient(135deg,var(--primary) 0%,var(--primary-dark,#005f8c) 100%);color:#fff;font-family:var(--font-family,inherit);font-size:0.95rem;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(0,124,182,0.4);transition:transform 0.25s cubic-bezier(0.4,0,0.2,1),box-shadow 0.25s;';
        b.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"></path><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line></svg><span>Ask</span>';
        b.addEventListener('mouseenter', function () { b.style.transform = 'translateY(-3px) scale(1.04)'; b.style.boxShadow = '0 8px 30px rgba(0,124,182,0.6)'; });
        b.addEventListener('mouseleave', function () { b.style.transform = ''; b.style.boxShadow = '0 4px 20px rgba(0,124,182,0.4)'; });
        b.addEventListener('click', function () { showAsk(); });
        document.body.appendChild(b);
    }

    // Wipe every period-keyed cache. Called automatically on sitemap swap (see build's signature
    // guard) and exposed as SVRollup.clearCaches() for manual use. Also nudges the GSC/GA4 modules'
    // own caches so a new site never inherits the old site's fetched maps.
    function clearCaches() {
        [_priorCache, _queryCache, _priorQueryCache, _countryQueryCache, _sourcesCache, _trendCache, _gscTrendCache, _aiImpactCache]
            .forEach(function (c) { for (const k in c) delete c[k]; });
        try { if (window.GSCIntegration && window.GSCIntegration.clearCache) window.GSCIntegration.clearCache(); } catch (e) {}
        try { if (window.GA4Integration && window.GA4Integration.clearCache) window.GA4Integration.clearCache(); } catch (e) {}
    }

    // Golden ROUTING test for the deterministic parser (_quickParse). The parser is ~135 lines of
    // ordered regexes and precedence is its failure mode: a new pattern above an old one silently
    // steals matches. selfTest() covers the maths; this covers the routing, in the same headless
    // harness. Each case: {q, intent, page?, category?}; intent:null means "must DEFER to the LLM"
    // (quickParse returns null). page/category are case-insensitive substring checks (robust to the
    // parser's " page" trimming). Coverage: every asserted intent must exist in the _ILBL registry,
    // so you can't route to an intent the rest of the system doesn't know about.
    function selfTestRouting() {
        const R = [
            // triage
            { q: 'what should I focus on in Health', intent: 'briefing', category: 'health' },
            { q: 'which pages get no search traffic', intent: 'dead_pages' },
            { q: 'which pages have tracking issues', intent: 'artifact_pages' },
            { q: 'which pages have measurement artifacts in Health', intent: 'artifact_pages', category: 'health' },
            { q: 'which pages do people leave quickly', intent: 'abandoned' },
            { q: 'what is stale in Employment', intent: null },                 // stale -> LLM
            { q: 'any pages competing for the same search', intent: null },
            { q: 'generate a weekly digest', intent: 'digest' },
            // discover
            { q: 'what content should we create', intent: 'content_gaps' },
            { q: "what's newly trending in search", intent: 'emerging' },
            { q: 'what do people abroad search us for', intent: null },
            { q: 'what does the US search us for', intent: 'international_queries' },
            // top_pages metric inference
            { q: 'most viewed pages in money and tax', intent: 'top_pages' },
            { q: 'most clicked pages in Housing', intent: 'top_pages' },
            { q: 'top pages in Health', intent: 'top_pages', category: 'health' },
            // page-level (assert the extracted page name)
            { q: 'how many views has capital gains tax page this month', intent: 'page_summary', page: 'capital gains tax' },
            { q: 'why is the Fuel Allowance page underperforming', intent: 'diagnose', page: 'fuel allowance' },
            { q: 'how is the Medical Card page performing', intent: 'page_summary', page: 'medical card' },
            // movers vs trend (the classic confusion)
            { q: 'what pages are trending in Environment', intent: 'movers' },
            { q: 'which pages lost traffic', intent: 'movers' },
            { q: 'how has Health trended', intent: null },                      // trend -> LLM
            { q: 'which sections are declining', intent: 'section_movers' },
            // traffic sources / AI — assert the SOURCE slot (extraction is the fragile bit)
            { q: 'how much traffic from askci', intent: 'traffic_sources', source: 'askci' },
            { q: 'how much traffic from AI', intent: 'traffic_sources', source: 'AI' },
            { q: 'which pages does ChatGPT send', intent: 'traffic_sources', source: 'ChatGPT' },
            { q: 'is AI traffic growing', intent: 'traffic_sources', source: 'AI' },
            { q: 'how many to the medical card page from askci', intent: 'traffic_sources', source: 'askci', page: 'medical card' },
            { q: 'traffic sources in Health', intent: 'traffic_sources', category: 'health' },
            // ai_impact (holistic verdict) + ai_exposed (scoped page list). Collision-prone cluster:
            // "is AI traffic growing" must stay traffic_sources; "exposed to AI" must be ai_exposed.
            { q: 'what is AI doing to us', intent: 'ai_impact', aspect: 'overview' },
            { q: 'are we losing clicks to AI', intent: 'ai_impact', aspect: 'overview' },
            { q: 'how many clicks is Google taking', intent: 'ai_impact', aspect: 'takes' },
            { q: 'is our click through rate falling', intent: 'ai_impact', aspect: 'ctr' },
            { q: 'which pages is Google answering for', intent: 'ai_exposed' },
            { q: 'which pages are exposed to AI', intent: 'ai_exposed' },
            { q: 'which pages are losing clicks to AI', intent: 'ai_exposed' },
            { q: 'what is wrong with the Fuel Allowance page', intent: 'diagnose', page: 'fuel allowance' },
            { q: 'AI exposure in Health', intent: 'ai_exposed', category: 'health' },
            { q: 'which of our pages are losing clicks to AI', intent: 'ai_exposed' },
            { q: 'is AI traffic growing', intent: 'traffic_sources', source: 'AI' },   // NOT ai_impact/ai_exposed
            // seasonal / recently updated
            { q: 'is the recent drop seasonal', intent: 'seasonal' },
            { q: 'is the Health drop seasonal', intent: 'seasonal', category: 'health' },   // the section slot must survive (A2 scope bug)
            { q: 'what pages were updated recently', intent: 'recently_updated' },
            { q: 'pages updated in the last 30 days in Health', intent: 'recently_updated', category: 'health' },
            // compare_periods — assert the scope slot. quickParse can't tell a section from a page by
            // syntax, so a section name lands in `page` ("Health"); the intent reconciles that to a
            // category downstream (see the compare_periods branch). This case pins the parse so the
            // reconciliation stays honest.
            { q: 'compare traffic to Voting In A Referendum page from q1 and q2', intent: 'compare_periods', page: 'Voting In A Referendum' },
            { q: 'compare Health from this month and last month', intent: 'compare_periods', page: 'Health' },
            // must DEFER to the LLM (quickParse deliberately null)
            { q: 'what is the capital of France', intent: null },
            { q: 'compare Health and Housing', intent: null },                  // section compare -> LLM
            { q: 'compare the Fuel Allowance page before and after May 12', intent: null },   // anchored before/after = change_impact territory (unbuilt): must DEFER, never be grabbed by compare_periods' "from A and B" matcher (the pinned collision)
            { q: 'how are we doing overall', intent: null },                    // site_summary -> LLM
            { q: 'what do people search for in Health', intent: null }          // top_queries -> LLM (no hijack)
        ];
        const results = [];
        let passed = 0;
        function inc(s, sub) { return String(s == null ? '' : s).toLowerCase().indexOf(String(sub).toLowerCase()) >= 0; }
        R.forEach(function (c) {
            let p = null, err = null;
            try { p = _quickParse(c.q); } catch (e) { err = String(e); }
            let ok, why = '';
            if (c.intent === null) {
                ok = (p == null); if (!ok) why = 'should defer';
            } else {
                ok = !!p && p.intent === c.intent; if (!ok) why = 'intent';
                // Slot assertions (subset): only the slots a case names are checked, via
                // case-insensitive substring. This is where quickParse's regexes are most fragile
                // ("the Fuel" vs "Fuel Allowance", a section name landing in the page slot) — and
                // intent-only assertions would sail green straight through every one of them.
                ['page', 'category', 'source', 'aspect'].forEach(function (slot) {
                    if (ok && c[slot] != null && !inc(p[slot], c[slot])) { ok = false; why = slot + '="' + (p ? p[slot] : '') + '" (want "' + c[slot] + '")'; }
                });
            }
            if (ok) passed++;
            results.push({ name: c.q, ok: ok, expect: c.intent, got: err ? ('ERR ' + err) : (p ? p.intent : null), why: ok ? '' : why });
        });
        // Coverage: no case may route to an intent the _ILBL registry doesn't know.
        R.forEach(function (c) {
            if (c.intent && !(c.intent in _ILBL)) results.push({ name: 'coverage: ' + c.q, ok: false, note: 'intent "' + c.intent + '" not in _ILBL' });
        });
        return { passed: results.every(function (r) { return r.ok; }), matched: passed, total: R.length, results: results };
    }

    // ── Monthly report (.xlsx) ────────────────────────────────────────────────────
    // Automates the manual GA4 monthly spreadsheet. Tree-driven, and clean BY CONSTRUCTION:
    // the GA4 fetch is keyed by pagePath only, so translated-title duplicate rows never exist
    // (that's the manual "drop rows that aren't real page titles" step — gone); titles come from
    // the sitemap (always real); non-content artifacts (e.g. .../search_wagtail/) aren't in the
    // tree, so they drop out. Output: Top Views + Trends + one sheet per category, this month vs
    // the prior month. GA4-only for now (matches the current workflow; GSC columns can come later).
    const _RPT_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    // Curation: ONLY these top-level sections become tabs (full sitemap names, owner's preference),
    // in this order. Excludes non-content sections (About / All Categories / My Situation).
    const _RPT_CATS = [
        'Consumer', 'Death', 'Education', 'Employment', 'Environment',
        'Birth Family Relationships', 'Government In Ireland', 'Health', 'Housing', 'Justice',
        'Money And Tax', 'Moving Country', 'Returning To Ireland', 'Social Welfare',
        'Travel And Recreation', 'Whats New'
    ];
    const _RPT_TOPVIEWS_MIN = 1000;   // Top Views: pages with >= this many views (owner's ~1,003 floor)
    const _RPT_TREND_MIN = 0.5;       // Trends: pages that grew >= +50% MoM, sorted desc (owner's rule)
    function _monthRange(year, month) {                       // month is 1-12
        const mm = ('0' + month).slice(-2);
        const last = new Date(year, month, 0).getDate();     // day 0 of next month = last day of this one
        return { start: year + '-' + mm + '-01', end: year + '-' + mm + '-' + ('0' + last).slice(-2) };
    }
    function _pctDelta(cur, prev) { return prev > 0 ? (cur - prev) / prev : null; }   // null = brand-new / no prior
    function _xlSheetName(name) { return (String(name || 'Sheet').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31)) || 'Sheet'; }
    async function _fetchGA4Range(tree, startDate, endDate) {
        const ga4By = Object.create(null);
        const ga4 = window.GA4Integration;
        if (!(ga4 && ga4.isConnected && ga4.isConnected() && ga4.fetchAllPages)) return ga4By;
        const toPath = (typeof ga4.urlToPath === 'function') ? ga4.urlToPath : function (u) { return u; };
        const byPath = await ga4.fetchAllPages({ startDate: startDate, endDate: endDate });
        (function collect(n) {
            if (n.url) { const r = byPath.get(toPath(n.url)); if (r) ga4By[normUrl(n.url)] = r; }
            (n.children || n._children || []).forEach(collect);
        })(tree);
        return ga4By;
    }
    function _reportWs(headers, rows, pctKeys) {              // array-of-objects -> worksheet; pctKeys get % format
        const aoa = [headers.map(function (h) { return h.label; })];
        rows.forEach(function (r) { aoa.push(headers.map(function (h) { return r[h.key]; })); });
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = 1; R <= range.e.r; R++) {
            headers.forEach(function (h, C) {
                const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                if (!cell || typeof cell.v !== 'number') return;
                cell.z = pctKeys.indexOf(h.key) >= 0 ? '0.0%' : '#,##0';   // % for deltas, thousands-comma for counts
            });
        }
        ws['!cols'] = headers.map(function (h) { return { wch: h.key === 'path' ? 60 : h.key === 'title' ? 40 : 12 }; });
        return ws;
    }
    // Conditional formatting SheetJS (free) can't write, so we inject it into the finished file.
    // Clean uniform scheme: count columns (Views / Active users) get green DATA BARS; %Δ columns get
    // a red→white→green COLOUR SCALE. Column letters are detected from each sheet's header row, so it
    // works for both the site sheets (Views=D) and category sheets (Views=C). Pure + headless-testable.
    // Reusable CF-rule builders (shared by the per-sheet detector and the Summary sheet). Modern x14
    // data bar: solid green, red negatives, auto centre-axis (legacy <dataBar> kept as fallback, GUID-
    // linked to the x14 rule that goes in the worksheet extLst). Colour scale: red→white→green.
    function _cfDataBar(sq, prio) {
        const g = '{DA7ABAA5-0000-4A5E-B000-' + String(prio).padStart(12, '0') + '}';
        return {
            cf: '<conditionalFormatting sqref="' + sq + '"><cfRule type="dataBar" priority="' + prio + '"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF63C384"/></dataBar><extLst><ext uri="{B025F937-C7B1-47D3-B67F-A62EFF666E3E}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:id>' + g + '</x14:id></ext></extLst></cfRule></conditionalFormatting>',
            ext: '<x14:conditionalFormatting xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><x14:cfRule type="dataBar" id="' + g + '"><x14:dataBar minLength="0" maxLength="100" gradient="0"><x14:cfvo type="autoMin"/><x14:cfvo type="autoMax"/><x14:negativeFillColor rgb="FFFF0000"/><x14:axisColor rgb="FF000000"/></x14:dataBar></x14:cfRule><xm:sqref>' + sq + '</xm:sqref></x14:conditionalFormatting>'
        };
    }
    function _cfColorScale(sq, prio) {
        return { cf: '<conditionalFormatting sqref="' + sq + '"><cfRule type="colorScale" priority="' + prio + '"><colorScale><cfvo type="min"/><cfvo type="percentile" val="50"/><cfvo type="max"/><color rgb="FFF8696B"/><color rgb="FFFCFCFF"/><color rgb="FF63BE7B"/></colorScale></cfRule></conditionalFormatting>', ext: '' };
    }
    function _condFmtForSheet(sheetXml, prio) {
        const firstRow = /<row[^>]*>[\s\S]*?<\/row>/.exec(sheetXml);
        if (!firstRow) return { cf: '', prio: prio };
        const cols = {}, cellRe = /<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g; let m;
        while ((m = cellRe.exec(firstRow[0]))) {
            const inner = m[2];
            const tm = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);   // inline string  <is><t>label</t></is>
            const vm = /<v>([\s\S]*?)<\/v>/.exec(inner);        // SheetJS default: t="str" stores the label in <v>
            cols[m[1]] = tm ? tm[1] : (vm ? vm[1] : '');
        }
        let last = 1, rm; const rowRe = /<row r="(\d+)"/g;
        while ((rm = rowRe.exec(sheetXml))) { const n = +rm[1]; if (n > last) last = n; }
        if (last < 2) return { cf: '', prio: prio };
        // Match the hand-made original's per-sheet pattern (option B):
        //  • site sheets (they have a Category column = Top Views / Trends): green DATA BARS on Views
        //    AND both %Δ columns; the Active-users count column is left plain.
        //  • category tabs: red→green COLOUR SCALE on both %Δ columns only; count columns left plain.
        const isSite = Object.keys(cols).some(function (c) { return /Category/.test(cols[c]); });
        let cf = '', ext = '';
        const bar = function (sq) { const b = _cfDataBar(sq, prio++); cf += b.cf; ext += b.ext; };   // Views + %Δ (modern data bar)
        const scale = function (sq) { cf += _cfColorScale(sq, prio++).cf; };                         // %Δ (colour scale)
        Object.keys(cols).forEach(function (col) {
            const label = cols[col], sq = col + '2:' + col + last, isDelta = /%|Δ/.test(label), isViews = /Views/.test(label);
            if (isSite) { if (isViews || isDelta) bar(sq); }              // Views + both %Δ -> data bars
            else if (isDelta) scale(sq);                                  // category tabs: %Δ -> colour scale only
        });
        return { cf: cf, ext: ext, prio: prio };
    }
    // Header names (from row 1) + extent, for wrapping a sheet as an Excel Table. Names come from the
    // header cells (SheetJS t="str" stores them in <v>); they must be unique (see the "% Δ2" dedupe).
    function _tableInfo(sheetXml) {
        const fr = /<row[^>]*>[\s\S]*?<\/row>/.exec(sheetXml);
        if (!fr) return null;
        const names = []; let m, lastCol = 'A'; const cellRe = /<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g;
        while ((m = cellRe.exec(fr[0]))) {
            const tm = /<t[^>]*>([\s\S]*?)<\/t>/.exec(m[2]), vm = /<v>([\s\S]*?)<\/v>/.exec(m[2]);
            names.push(tm ? tm[1] : (vm ? vm[1] : '')); lastCol = m[1];
        }
        let last = 1, rm; const rowRe = /<row r="(\d+)"/g;
        while ((rm = rowRe.exec(sheetXml))) { const n = +rm[1]; if (n > last) last = n; }
        return { names: names, lastCol: lastCol, lastRow: last };
    }
    async function _decorateXlsx(bytes, filename, opts) {
        const dl = function (blob) {
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        };
        const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        if (typeof JSZip === 'undefined') {                          // graceful fallback: save without the formatting
            if (typeof console !== 'undefined') console.warn('[SVRollup] JSZip not loaded - saving the report without conditional formatting.');
            dl(new Blob([bytes], { type: MIME })); return;
        }
        try {
            const zip = await JSZip.loadAsync(bytes);
            let prio = 1, injected = 0;
            const names = Object.keys(zip.files).filter(function (f) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(f); });
            for (let i = 0; i < names.length; i++) {
                let xml = await zip.file(names[i]).async('string');
                const res = _condFmtForSheet(xml, prio); prio = res.prio;
                if (!res.cf && !res.ext) continue;
                if (res.cf) xml = xml.replace('</sheetData>', '</sheetData>' + res.cf);   // rules go after sheetData
                if (res.ext) xml = xml.replace('</worksheet>', '<extLst><ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:conditionalFormattings>' + res.ext + '</x14:conditionalFormattings></ext></extLst></worksheet>');   // x14 defs go last, before </worksheet>
                zip.file(names[i], xml); injected++;
            }
            if (typeof console !== 'undefined') console.log('[SVRollup] monthly report: conditional formatting injected into ' + injected + '/' + names.length + ' sheets.');
            // Summary sheet: explicit CF (it isn't a uniform table) — data bars on the league Views
            // column, colour scale on its %Δ columns; ranges come from _summarySheet via opts.
            if (opts && opts.summary) {
                for (let i = 0; i < names.length; i++) {
                    let xml = await zip.file(names[i]).async('string');
                    const fr = /<row[^>]*>[\s\S]*?<\/row>/.exec(xml);
                    if (!fr || fr[0].indexOf('Monthly Summary') < 0) continue;   // the summary tab
                    let scf = '', sext = '';
                    (opts.summary.dataBars || []).forEach(function (sq) { const b = _cfDataBar(sq, prio++); scf += b.cf; sext += b.ext; });
                    (opts.summary.colorScales || []).forEach(function (sq) { scf += _cfColorScale(sq, prio++).cf; });
                    if (scf) xml = xml.replace('</sheetData>', '</sheetData>' + scf);
                    // The worksheet extLst can hold two exts: conditional formatting AND sparklines.
                    let exts = '';
                    if (sext) exts += '<ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:conditionalFormattings>' + sext + '</x14:conditionalFormattings></ext>';
                    const sp = opts.summary.sparkline;
                    if (sp && sp.dataRef && sp.locRef) {
                        exts += '<ext uri="{05C60535-1F16-4fd2-B633-F4F36F0B64E0}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:sparklineGroups xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><x14:sparklineGroup type="line" displayEmptyCellsAs="gap"><x14:colorSeries rgb="FF007CB6"/><x14:colorNegative rgb="FFFF0000"/><x14:colorMarkers rgb="FF007CB6"/><x14:colorHigh rgb="FF63BE7B"/><x14:colorLow rgb="FFF8696B"/><x14:sparklines><x14:sparkline><xm:f>' + sp.dataRef + '</xm:f><xm:sqref>' + sp.locRef + '</xm:sqref></x14:sparkline></x14:sparklines></x14:sparklineGroup></x14:sparklineGroups></ext>';
                    }
                    if (exts) xml = xml.replace('</worksheet>', '<extLst>' + exts + '</extLst></worksheet>');
                    zip.file(names[i], xml);
                    break;
                }
            }
            // KPI big-number styling: bold+large font on the summary's "This month" value cells.
            // SheetJS (free) won't write fonts, so inject a font+xf into styles.xml and repoint the cells' s.
            if (opts && opts.summary && opts.summary.kpiCells && opts.summary.kpiCells.length) {
                try {
                    let styles = await zip.file('xl/styles.xml').async('string');
                    const fc = +((/<fonts count="(\d+)"/.exec(styles) || [])[1] || 1);   // new font index = old count
                    const xc = +((/<cellXfs count="(\d+)"/.exec(styles) || [])[1] || 1);  // new xf index  = old count
                    styles = styles.replace('</fonts>', '<font><b/><sz val="16"/><color rgb="FF1F4E79"/><name val="Calibri"/></font></fonts>').replace(/<fonts count="\d+"/, '<fonts count="' + (fc + 1) + '"');
                    styles = styles.replace('</cellXfs>', '<xf numFmtId="3" fontId="' + fc + '" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs>').replace(/<cellXfs count="\d+"/, '<cellXfs count="' + (xc + 1) + '"');
                    zip.file('xl/styles.xml', styles);
                    for (let i = 0; i < names.length; i++) {
                        let xml = await zip.file(names[i]).async('string');
                        const fr = /<row[^>]*>[\s\S]*?<\/row>/.exec(xml);
                        if (!fr || fr[0].indexOf('Monthly Summary') < 0) continue;
                        opts.summary.kpiCells.forEach(function (ref) { xml = xml.replace(new RegExp('<c r="' + ref + '"( s="\\d+")?'), '<c r="' + ref + '" s="' + xc + '"'); });
                        zip.file(names[i], xml); break;
                    }
                } catch (se) { if (typeof console !== 'undefined') console.error('[SVRollup] KPI styling failed (kept content):', se); }
            }
            // Tables pass: wrap each sheet's data as an Excel Table (TableStyleMedium20). Touches 3
            // parts per table — the table XML, the worksheet <tableParts>+rels, and [Content_Types].
            // Own try so a table hiccup never loses the conditional formatting already applied.
            try {
                const ct = await zip.file('[Content_Types].xml').async('string'); let ctAdd = '', tabled = 0;
                for (let i = 0; i < names.length; i++) {
                    let xml = await zip.file(names[i]).async('string');
                    const fr0 = /<row[^>]*>[\s\S]*?<\/row>/.exec(xml);
                    if (fr0 && fr0[0].indexOf('Monthly Summary') >= 0) continue;   // summary isn't a single table
                    const info = _tableInfo(xml);
                    if (!info || info.lastRow < 2 || !info.names.length) continue;
                    const tId = i + 1, ref = 'A1:' + info.lastCol + info.lastRow;
                    const colXml = info.names.map(function (nm, j) { return '<tableColumn id="' + (j + 1) + '" name="' + nm + '"/>'; }).join('');
                    zip.file('xl/tables/table' + tId + '.xml',
                        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="' + tId + '" name="Table' + tId + '" displayName="Table' + tId + '" ref="' + ref + '" totalsRowShown="0"><autoFilter ref="' + ref + '"/><tableColumns count="' + info.names.length + '">' + colXml + '</tableColumns><tableStyleInfo name="TableStyleMedium20" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>');
                    // <tableParts> must sit just before the worksheet-level extLst (or before </worksheet>)
                    const tp = '<tableParts count="1"><tablePart r:id="rIdTbl1"/></tableParts>';
                    const marker = '<extLst><ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}"';
                    xml = xml.indexOf(marker) >= 0 ? xml.replace(marker, tp + marker) : xml.replace('</worksheet>', tp + '</worksheet>');
                    zip.file(names[i], xml);
                    const relPath = 'xl/worksheets/_rels/' + names[i].split('/').pop() + '.rels';
                    const rel = '<Relationship Id="rIdTbl1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table' + tId + '.xml"/>';
                    const existing = zip.file(relPath);
                    zip.file(relPath, existing
                        ? (await existing.async('string')).replace('</Relationships>', rel + '</Relationships>')
                        : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rel + '</Relationships>');
                    ctAdd += '<Override PartName="/xl/tables/table' + tId + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>';
                    tabled++;
                }
                if (ctAdd) zip.file('[Content_Types].xml', ct.replace('</Types>', ctAdd + '</Types>'));
                if (typeof console !== 'undefined') console.log('[SVRollup] monthly report: Excel table applied to ' + tabled + '/' + names.length + ' sheets.');
            } catch (te) { if (typeof console !== 'undefined') console.error('[SVRollup] table step failed (kept conditional formatting):', te); }
            dl(await zip.generateAsync({ type: 'blob', mimeType: MIME }));
        } catch (e) {
            if (typeof console !== 'undefined') console.error('[SVRollup] conditional-formatting step failed, saving plain file:', e);
            dl(new Blob([bytes], { type: MIME }));   // never fail the download over formatting
        }
    }
    // Exec-summary sheet (this-month-vs-last): site KPI band + category league table (data bars +
    // colour scale) + biggest risers/fallers site-wide. Returns {ws, dataBars, colorScales}; the CF
    // ranges are applied by _decorateXlsx (the summary isn't a uniform table, so CF is explicit).
    function _summarySheet(rows, tot, trend, title) {
        const byCat = {};
        rows.forEach(function (r) {
            const c = byCat[r.category] || (byCat[r.category] = { cat: r.category, v: 0, pv: 0, u: 0, pu: 0 });
            c.v += r.views; c.pv += (r.pViews || 0); c.u += r.users; c.pu += (r.pUsers || 0);
        });
        const cats = Object.keys(byCat).map(function (k) { return byCat[k]; }).sort(function (a, b) { return b.v - a.v; });
        const FLOOR = 100;   // ignore tiny-view pages so a +900%-on-3-views doesn't dominate the "stories"
        const movable = rows.filter(function (r) { return r.dViews != null && r.views >= FLOOR; });
        const risers = movable.slice().sort(function (a, b) { return b.dViews - a.dViews; }).slice(0, 5);
        const fallers = movable.slice().sort(function (a, b) { return a.dViews - b.dViews; }).slice(0, 5);
        const aoa = [], pct = []; const push = function (a) { aoa.push(a); return aoa.length - 1; };
        push([title]); push([]);
        // KPI table: three headline metrics × this-month / vs-last-month / vs-last-year (YoY blank if
        // beyond GA4 retention). Value column gets comma format; the two delta columns get %.
        push(['', 'This month', 'vs last month', 'vs last year']);
        let kr; const kpiCells = [];
        kr = push(['Total views', tot.v, _pctDelta(tot.v, tot.pv), _pctDelta(tot.v, tot.yv)]); pct.push([kr, 2]); pct.push([kr, 3]); kpiCells.push('B' + (kr + 1));
        kr = push(['Active users', tot.u, _pctDelta(tot.u, tot.pu), _pctDelta(tot.u, tot.yu)]); pct.push([kr, 2]); pct.push([kr, 3]); kpiCells.push('B' + (kr + 1));
        kr = push(['Sessions', tot.s, _pctDelta(tot.s, tot.ps), _pctDelta(tot.s, tot.ys)]); pct.push([kr, 2]); pct.push([kr, 3]); kpiCells.push('B' + (kr + 1));
        push([]);
        push(['Category performance']);
        const hdr = push(['Category', 'Views', '% Δ', 'Active users', '% Δ2']);
        cats.forEach(function (c) { const rr = push([c.cat, c.v, _pctDelta(c.v, c.pv), c.u, _pctDelta(c.u, c.pu)]); pct.push([rr, 2]); pct.push([rr, 4]); });
        const leagueStart = hdr + 2, leagueEnd = aoa.length;   // 1-based Excel rows spanning the league data
        push([]);
        push(['Biggest risers this month (pages with ' + FLOOR + '+ views)']);
        push(['Page', 'Category', '% Δ', 'Views']);
        risers.forEach(function (x) { const rr = push([x.title, x.category, x.dViews, x.views]); pct.push([rr, 2]); });
        push([]);
        push(['Biggest fallers this month (pages with ' + FLOOR + '+ views)']);
        push(['Page', 'Category', '% Δ', 'Views']);
        fallers.forEach(function (x) { const rr = push([x.title, x.category, x.dViews, x.views]); pct.push([rr, 2]); });
        // 6-month site-views trend + a line sparkline in the cell after the values row.
        let sparkline = null;
        if (trend && trend.length && trend.some(function (t) { return t.value; })) {
            push([]);
            push(['Site views — last ' + trend.length + ' months']);
            push([''].concat(trend.map(function (t) { return t.label; })));            // month labels, B..
            const vr = push([''].concat(trend.map(function (t) { return t.value; })));  // values, B..
            const lastCol = String.fromCharCode(66 + trend.length - 1);                 // B + (n-1)
            const locCol = String.fromCharCode(66 + trend.length);                      // the cell right after the values
            sparkline = { dataRef: 'Summary!B' + (vr + 1) + ':' + lastCol + (vr + 1), locRef: locCol + (vr + 1) };
        }
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const pctSet = {}; pct.forEach(function (rc) { pctSet[rc[0] + ',' + rc[1]] = 1; });
        aoa.forEach(function (row, R) { row.forEach(function (val, C) { if (typeof val !== 'number') return; const ref = XLSX.utils.encode_cell({ r: R, c: C }); if (ws[ref]) ws[ref].z = pctSet[R + ',' + C] ? '0.0%' : '#,##0'; }); });   // % for deltas, thousands-comma for counts
        ws['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];
        return {
            ws: ws,
            dataBars: cats.length ? ['B' + leagueStart + ':B' + leagueEnd] : [],
            colorScales: cats.length ? ['C' + leagueStart + ':C' + leagueEnd, 'E' + leagueStart + ':E' + leagueEnd] : [],
            kpiCells: kpiCells,
            sparkline: sparkline
        };
    }
    async function buildMonthlyReport(year, month) {
        const tree = window.treeData;
        if (!tree) { alert('Load a sitemap first.'); return; }
        const ga4 = window.GA4Integration;
        if (!(ga4 && ga4.isConnected && ga4.isConnected())) { alert('Connect GA4 first - the monthly report is GA4-based.'); return; }
        if (typeof XLSX === 'undefined') { alert('Spreadsheet library not loaded. Hard-refresh (index.html must include xlsx.full.min.js).'); return; }
        const cur = _monthRange(year, month);
        const pm = month === 1 ? 12 : month - 1, py = month === 1 ? year - 1 : year;
        const prev = _monthRange(py, pm);
        const yr = _monthRange(year - 1, month);                         // same month last year (YoY; blank if beyond GA4 retention)
        let _tsM = month - 5, _tsY = year; while (_tsM < 1) { _tsM += 12; _tsY -= 1; }
        const trendStart = _monthRange(_tsY, _tsM).start;                // first day of the 6-month trend window
        let pair;
        try { pair = await Promise.all([_fetchGA4Range(tree, cur.start, cur.end), _fetchGA4Range(tree, prev.start, prev.end), _fetchGA4Range(tree, yr.start, yr.end)]); }
        catch (e) { alert('Could not fetch GA4 data: ' + (e && e.message ? e.message : String(e))); return; }
        const curBy = pair[0], prevBy = pair[1], yearBy = pair[2];
        const toPath = (typeof ga4.urlToPath === 'function') ? ga4.urlToPath : function (u) { return u; };
        const rc = build(tree, { statsFor: statsForMaps({}, curBy) });   // categories, merged by name
        build(tree);                                                     // restore current-period annotations
        const catOrder = {};                                          // sitemap category name (lc) -> tab order
        _RPT_CATS.forEach(function (name, i) { catOrder[String(name).toLowerCase()] = i; });
        const rows = [];
        const tot = { v: 0, pv: 0, yv: 0, u: 0, pu: 0, yu: 0, s: 0, ps: 0, ys: 0 };   // site totals cur/prev/year for the KPI band
        const uOf = function (x) { return x ? ((x.activeUsers != null ? x.activeUsers : x.users) || 0) : 0; };
        rc.categories.forEach(function (cat) {
            const ord = catOrder[String(cat.name || '').toLowerCase()];
            if (ord === undefined) return;                            // excludes non-content / uncurated sections
            (cat.nodes || []).forEach(function (top) {
                (function walk(n) {
                    if (n.url) {
                        const p = toPath(n.url);
                        if (p.indexOf('/en/') === 0) {          // English pages only — the report is EN; excludes /ga/ (Irish) versions
                            const k = normUrl(n.url), a = curBy[k], b = prevBy[k], c = yearBy[k];
                            // "Active users" uses GA4 activeUsers (matches the manual export); falls back to users(=totalUsers).
                            const v = a ? (a.pageViews || 0) : 0, pv = b ? (b.pageViews || 0) : 0, yv = c ? (c.pageViews || 0) : 0;
                            const u = uOf(a), pu = uOf(b), yu = uOf(c);
                            tot.v += v; tot.pv += pv; tot.yv += yv; tot.u += u; tot.pu += pu; tot.yu += yu;       // site totals (all EN pages)
                            tot.s += a ? (a.sessions || 0) : 0; tot.ps += b ? (b.sessions || 0) : 0; tot.ys += c ? (c.sessions || 0) : 0;
                            if (v > 0 || pv > 0) rows.push({ category: cat.name, order: ord, title: n.name || '', path: p, views: v, pViews: pv, dViews: _pctDelta(v, pv), users: u, pUsers: pu, dUsers: _pctDelta(u, pu) });
                        }
                    }
                    (n.children || n._children || []).forEach(walk);
                })(top);
            });
        });
        if (!rows.length) { alert('No GA4 page data for ' + _RPT_MONTHS[month - 1] + ' ' + year + '. (GA4 retention is ~2-14 months; the month may be out of range.)'); return; }
        let monthly = [];
        try { if (ga4.fetchMonthlyViews) monthly = await ga4.fetchMonthlyViews({ startDate: trendStart, endDate: cur.end }); } catch (e) { monthly = []; }
        const trend6 = [];                                               // 6 months of EN site views, oldest→newest
        for (let k = 5; k >= 0; k--) {
            let mm = month - k, yy = year; while (mm < 1) { mm += 12; yy -= 1; }
            const ym = yy + ('0' + mm).slice(-2), hit = monthly.filter(function (x) { return x.ym === ym; })[0];
            trend6.push({ label: _RPT_MONTHS[mm - 1].slice(0, 3), value: hit ? hit.views : 0 });
        }
        const wb = XLSX.utils.book_new();
        const summary = _summarySheet(rows, tot, trend6, 'Monthly Summary — ' + _RPT_MONTHS[month - 1] + ' ' + year);
        XLSX.utils.book_append_sheet(wb, summary.ws, 'Summary');                                        // exec summary = first tab
        const siteH = [{ key: 'category', label: 'Category' }, { key: 'title', label: 'Page title' }, { key: 'path', label: 'Page path' }, { key: 'views', label: 'Views' }, { key: 'dViews', label: '% Δ' }, { key: 'users', label: 'Active users' }, { key: 'dUsers', label: '% Δ2' }];   // 2nd %Δ deduped for Excel-table column-name uniqueness (matches original)
        const catH = siteH.slice(1);                                    // per-category sheets drop the Category column
        const byViews = function (a, b) { return b.views - a.views; };
        // %Δ descending, new pages (null delta) last — matches the hand-made Trends + category tabs.
        const byDelta = function (a, b) { return (b.dViews == null ? -Infinity : b.dViews) - (a.dViews == null ? -Infinity : a.dViews); };
        const topViews = rows.filter(function (r) { return r.views >= _RPT_TOPVIEWS_MIN; }).sort(byViews);
        XLSX.utils.book_append_sheet(wb, _reportWs(siteH, topViews, ['dViews', 'dUsers']), 'Top Views');                         // views >= floor
        const trend = rows.filter(function (r) { return r.dViews != null && r.dViews >= _RPT_TREND_MIN; }).sort(byDelta);
        XLSX.utils.book_append_sheet(wb, _reportWs(siteH, trend, ['dViews', 'dUsers']), 'Trends');                               // grew >= +50%
        const seenCat = {};                                            // category name -> order (present in data)
        rows.forEach(function (r) { seenCat[r.category] = r.order; });
        Object.keys(seenCat).sort(function (a, b) { return seenCat[a] - seenCat[b]; }).forEach(function (name) {
            const cr = rows.filter(function (r) { return r.category === name; }).sort(byDelta);   // all real pages, %Δ desc
            if (cr.length) XLSX.utils.book_append_sheet(wb, _reportWs(catH, cr, ['dViews', 'dUsers']), _xlSheetName(name));
        });
        const _fname = 'CI Pageview Stats ' + _RPT_MONTHS[month - 1] + ' ' + year + '.xlsx';
        await _decorateXlsx(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), _fname, { summary: { dataBars: summary.dataBars, colorScales: summary.colorScales, kpiCells: summary.kpiCells, sparkline: summary.sparkline } });   // write + inject formatting/tables/sparkline
    }
    // Month picker modal for the .xlsx report: year stepper + a 4-col month grid. Future (incomplete)
    // months are disabled; clicking a month generates the report. Replaces the old YYYY-MM prompt().
    function promptMonthlyReport() {
        if (typeof XLSX === 'undefined') { alert('Spreadsheet library not loaded. Hard-refresh (index.html must include xlsx.full.min.js).'); return; }
        if (typeof ensureDDStyle === 'function') ensureDDStyle();
        const now = new Date();
        let lm = now.getMonth(), ly = now.getFullYear();     // getMonth() 0-11 == last-completed month as 1-12
        if (lm === 0) { lm = 12; ly -= 1; }
        const curY = now.getFullYear(), curM = now.getMonth() + 1;   // this calendar month (1-12), not yet complete
        const minY = curY - 2, maxY = curY;
        let viewY = ly;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:40px 20px;overflow:auto;backdrop-filter:blur(3px);';
        const close = function () { overlay.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = function (e) { if (e.key === 'Escape') close(); };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        document.addEventListener('keydown', onKey);
        const modal = document.createElement('div');
        modal.className = 'sv-dd-modal';
        modal.style.cssText = 'background:var(--color-bg-secondary);border-radius:14px;max-width:380px;width:100%;padding:20px 22px;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
        const stepBtn = function (id, glyph, disabled) {
            return '<button id="' + id + '"' + (disabled ? ' disabled' : '') + ' style="background:none;border:1px solid var(--color-border-primary);border-radius:8px;width:34px;height:34px;font-size:17px;line-height:1;color:var(--color-text-primary);cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';opacity:' + (disabled ? '0.35' : '1') + ';">' + glyph + '</button>';
        };
        const render = function () {
            const isFuture = function (m) { return viewY > curY || (viewY === curY && m >= curM); };
            const btns = _RPT_MONTHS.map(function (name, i) {
                const m = i + 1, fut = isFuture(m), sel = (viewY === ly && m === lm);
                const bd = sel ? 'var(--primary)' : 'var(--color-border-primary)';
                const bg = sel ? 'var(--primary)' : 'var(--color-bg-primary)';
                const fg = fut ? 'var(--color-text-muted)' : (sel ? '#fff' : 'var(--color-text-primary)');
                const hov = (!fut && !sel) ? ' onmouseover="this.style.borderColor=\'var(--primary)\';this.style.color=\'var(--primary)\'" onmouseout="this.style.borderColor=\'var(--color-border-primary)\';this.style.color=\'var(--color-text-primary)\'"' : '';
                return '<button class="sv-mp-m" data-m="' + m + '"' + (fut ? ' disabled' : '') + hov +
                    ' style="padding:10px 0;border:1px solid ' + bd + ';border-radius:8px;background:' + bg + ';color:' + fg + ';font-size:0.8rem;font-weight:600;cursor:' + (fut ? 'not-allowed' : 'pointer') + ';opacity:' + (fut ? '0.4' : '1') + ';transition:border-color 0.12s,color 0.12s;">' + name.slice(0, 3) + '</button>';
            }).join('');
            modal.innerHTML =
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;"><div style="font-weight:800;font-size:1.05rem;color:var(--color-text-heading);">Monthly pageview report</div><button id="sv-mp-close" style="background:none;border:none;font-size:22px;color:var(--color-text-muted);cursor:pointer;line-height:1;">×</button></div>' +
                '<div style="font-size:0.72rem;color:var(--color-text-secondary);margin-bottom:16px;">Pick a month to generate the spreadsheet. GA4 data covers roughly the last 14 months.</div>' +
                '<div style="display:flex;align-items:center;justify-content:center;gap:18px;margin-bottom:14px;">' +
                    stepBtn('sv-mp-prev', '‹', viewY <= minY) +
                    '<div style="font-weight:800;font-size:1.15rem;color:var(--color-text-heading);min-width:64px;text-align:center;">' + viewY + '</div>' +
                    stepBtn('sv-mp-next', '›', viewY >= maxY) +
                '</div>' +
                '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">' + btns + '</div>';
            modal.querySelector('#sv-mp-close').addEventListener('click', close);
            const pv = modal.querySelector('#sv-mp-prev'); if (pv && viewY > minY) pv.addEventListener('click', function () { viewY--; render(); });
            const nx = modal.querySelector('#sv-mp-next'); if (nx && viewY < maxY) nx.addEventListener('click', function () { viewY++; render(); });
            modal.querySelectorAll('.sv-mp-m').forEach(function (b) { if (!b.disabled) b.addEventListener('click', function () { const m = parseInt(b.getAttribute('data-m'), 10); close(); buildMonthlyReport(viewY, m); }); });
        };
        render();
        overlay.appendChild(modal); document.body.appendChild(overlay);
    }

    // ── Site-level AI Impact report (Phase 1) ────────────────────────────────────
    // Honest whole-site picture: measured SENDS (AI-assistant referrals) + the 12-month GSC
    // divergence WEDGE (evidence, not estimate). TAKES is a pending placeholder until the Phase 2
    // per-page classifier (position discipline can't run at site aggregate). Epistemic grammar via _epi.
    const _aiPct = function (x) { return (x >= 0 ? 'up ' : 'down ') + Math.abs(Math.round(x * 100)) + '%'; };
    const _aiCtr = _ctrTxt;   // unified: the shared CTR formatter (sub-decimal '<0.1%' rule lives in one place)
    // THE verdict sentence — built ONCE here, consumed verbatim by the report AND the ai_impact chat answer
    // (one engine, two views includes the WORDS). Plain text (measured numbers render plain per the grammar).
    // For the MIXED read it carries the DECOMPOSITION: since clicks = impressions x CTR, a clicks decline is
    // part visibility (impressions) and part CTR (AI) — attributing the whole fall to AI is the over-claim.
    function _aiVerdictSentence(div) {
        if (!div) return '';
        const n = div.months, clk = _aiPct(div.clkChange), a = _aiCtr(div.eCtr), b = _aiCtr(div.lCtr);
        if (div.read === 'improving') return 'Over the last ' + n + ' months, Google click through actually rose (' + a + ' to ' + b + '), so you are capturing more of your impressions, not losing them to AI.';
        if (div.read === 'flat') return 'Over the last ' + n + ' months, Google clicks ' + clk + ' but click through held roughly steady (' + a + ' to ' + b + '), so this reads as a visibility or demand change, not the AI zero click signature.';
        if (div.read === 'clean') return 'Over the last ' + n + ' months, Google clicks ' + clk + ' on roughly steady impressions, with CTR falling ' + a + ' to ' + b + ', a pattern consistent with AI answers taking clicks in the results page.';
        // mixed: split the clicks decline into its visibility component (impressions) and the CTR/AI remainder
        const visPts = Math.abs(Math.round(div.imprChange * 100));
        return 'Over the last ' + n + ' months, Google clicks ' + clk + ', roughly ' + visPts + ' points of that from reduced visibility (impressions ' + _aiPct(div.imprChange) + '), the remainder consistent with AI answers taking clicks in the results page (CTR ' + a + ' to ' + b + ').';
    }
    async function _aiSends() {                                   // site-wide AI-assistant sends (measured), cur + prior for growth
        const cur = await getSourcesByPage(_ddDays);
        if (!cur || !cur.byPage) return null;
        let prev = null; try { prev = await getSourcesByPage(_ddDays, _ddDays); } catch (e) {}
        let ai = 0, askci = 0, prevAskci = 0, total = 0, prevAI = 0; const named = Object.create(null), prevNamed = Object.create(null);
        cur.byPage.forEach(function (rows) { rows.forEach(function (rw) { total += rw.sessions; const b = classifySource(rw.source, rw.channel); if (b === 'AI assistants') { ai += rw.sessions; const nm = _aiName(rw.source); named[nm] = (named[nm] || 0) + rw.sessions; } else if (b === 'AskCI chatbot') { askci += rw.sessions; } }); });
        if (prev && prev.byPage) prev.byPage.forEach(function (rows) { rows.forEach(function (rw) { const b = classifySource(rw.source, rw.channel); if (b === 'AI assistants') { prevAI += rw.sessions; const nm = _aiName(rw.source); prevNamed[nm] = (prevNamed[nm] || 0) + rw.sessions; } else if (b === 'AskCI chatbot') { prevAskci += rw.sessions; } }); });
        const namedArr = Object.keys(named).map(function (k) { return { name: k, sess: named[k], growth: prevNamed[k] > 0 ? (named[k] - prevNamed[k]) / prevNamed[k] : null }; }).sort(function (a, b) { return b.sess - a.sess; });
        return { ai: ai, askci: askci, total: total, named: namedArr, growth: prevAI > 0 ? (ai - prevAI) / prevAI : null, askciGrowth: prevAskci > 0 ? (askci - prevAskci) / prevAskci : null };
    }
    function _aiDivergence(trend) {                              // the wedge read from GSC monthly trend (evidence)
        if (!trend || trend.length < 4) return null;
        const n = trend.length, k = Math.max(1, Math.min(3, Math.floor(n / 3)));
        const slice = function (arr) { const s = { impr: 0, clk: 0 }; arr.forEach(function (x) { s.impr += x.impressions; s.clk += x.clicks; }); return { impr: s.impr / arr.length, clk: s.clk / arr.length }; };
        const e = slice(trend.slice(0, k)), l = slice(trend.slice(n - k));
        const eCtr = e.impr > 0 ? e.clk / e.impr : 0, lCtr = l.impr > 0 ? l.clk / l.impr : 0;
        const imprChange = e.impr > 0 ? (l.impr - e.impr) / e.impr : 0;
        const clkChange = e.clk > 0 ? (l.clk - e.clk) / e.clk : 0;
        const ctrChange = eCtr > 0 ? (lCtr - eCtr) / eCtr : 0;
        // The divergence signal is CTR (clicks-per-impression), not whether impressions held. Nuanced read:
        let read;
        if (ctrChange > 0.1) read = 'improving';                                  // capturing more of impressions
        else if (ctrChange < -0.1 && imprChange >= -0.05) read = 'clean';         // CTR fell, impressions held = clean zero-click
        else if (ctrChange < -0.1) read = 'mixed';                                // CTR fell AND impressions fell = zero-click + visibility loss
        else read = 'flat';                                                       // CTR steady = click change tracks visibility, not AI
        return { months: n, eCtr: eCtr, lCtr: lCtr, imprChange: imprChange, clkChange: clkChange, ctrChange: ctrChange, read: read };
    }
    // Click-through rate over time = the honest "see but don't click" signal (clicks/impressions per
    // month). One line, no indexing, no coincident start, no possible inversion. Rendered with the
    // polished _chartLine engine (smooth curve, gradient, hover tooltips) via a % value formatter.
    function _aiCtrChart(trend) {
        if (!trend || trend.length < 2) return '';
        const periods = trend.map(function (x, i) {                                    // month labels; year tag at the start and each January so the boundary is clear
            const ym = String(x.ym), mo = parseInt(ym.slice(4, 6), 10), mlab = (_RPT_MONTHS[mo - 1] || '').slice(0, 3);
            return (i === 0 || mo === 1) ? mlab + " '" + ym.slice(2, 4) : mlab;
        });
        const values = trend.map(function (x) { return x.impressions > 0 ? x.clicks / x.impressions * 100 : 0; });
        return _chartLine({ series: [{ name: '', values: values }], periods: periods }, { w: 560, h: 180, valFmt: function (v) { return v.toFixed(1) + '%'; } });
    }
    function _aiYm(ym) { const y = String(ym).slice(0, 4), m = parseInt(String(ym).slice(4, 6), 10); return (_RPT_MONTHS[m - 1] || '').slice(0, 3) + ' ' + y; }
    // Two-line exposed card for the Ask tool (the _oppCard idiom): page + ~lost/mo on top, the why
    // subline beneath (position held · CTR before to after · impressions), clickable to the page report.
    function _aiExposedCard(rows) {
        const max = Math.max.apply(null, rows.map(function (x) { return x.lost || 0; }).concat([1]));   // scale bars to the biggest loser
        return '<div style="border:1px solid var(--color-border-primary);border-radius:10px;overflow:hidden;background:var(--color-bg-primary);">' +
            rows.map(function (x) {
                const bw = Math.min(100, (x.lost || 0) / max * 100);
                return '<div class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(x.url) + '" style="cursor:pointer;padding:8px 12px;border-bottom:1px solid var(--color-border-primary);" onmouseover="this.style.background=\'var(--color-bg-tertiary)\'" onmouseout="this.style.background=\'\'">' +
                    '<div style="display:flex;align-items:center;gap:10px;"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.85rem;font-weight:600;color:var(--color-text-primary);">' + esc(x.name) + '</span>' +
                    '<span style="flex-shrink:0;text-align:right;font-weight:700;font-size:0.85rem;color:#dc2626;">~' + fmt(x.lost) + ' clicks/mo</span></div>' +
                    '<div style="height:5px;background:var(--color-bg-tertiary);border-radius:3px;overflow:hidden;margin:5px 0 4px;"><span class="sv-ask-bar" style="display:block;height:100%;width:' + bw + '%;background:#dc2626;border-radius:3px;"></span></div>' +
                    '<div style="font-size:0.7rem;color:var(--color-text-muted);">position held ' + x.pos.toFixed(1) + ' &middot; CTR ' + _aiCtr(x.ctrB) + ' to ' + _aiCtr(x.ctrN) + ' &middot; ' + fmt(Math.round(x.impr)) + ' impressions</div>' +
                '</div>';
            }).join('') + '</div>';
    }
    function _aiImpactBody(A) {
        const S = 'font-size:0.72rem;color:var(--color-text-secondary);';
        const MUT = 'color:var(--color-text-muted);';
        const RED = '#dc2626', GRN = '#059669';
        const trend = A.trend, sends = A.sends, div = A.div, gscOn = A.gscOn, ga4On = A.ga4On;
        // ── derive the two headline flows, both normalised to per-month so they are comparable ──
        const exposed = A.exposed || [];
        const takesMo = gscOn ? A.floor : null;                                                    // estimated floor (0 = none cleared the bar)
        const sendsMo = (ga4On && sends && sends.ai > 0) ? Math.round(sends.ai * 30 / (_ddDays || 30)) : 0;               // measured, normalised to /mo
        // ── KPI cards ──
        const kpi = function (label, big, unit, sub, accent) {
            return '<div style="flex:1;min-width:0;border:1px solid var(--color-border-primary);border-radius:11px;padding:12px 14px;background:var(--color-bg-secondary);">' +
                '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;' + MUT + 'margin-bottom:5px;">' + esc(label) + '</div>' +
                '<div style="display:flex;align-items:baseline;gap:5px;"><span style="font-size:1.7rem;font-weight:800;line-height:1;color:' + accent + ';">' + big + '</span><span style="' + S + '">' + esc(unit) + '</span></div>' +
                '<div style="' + S + 'margin-top:5px;line-height:1.35;">' + sub + '</div></div>';
        };
        const takesBig = takesMo == null ? _epi('pending', 'pending') : _epi(fmt(takesMo), 'estimated');
        const takesSub = takesMo == null ? (gscOn ? 'reading the pages…' : 'connect Search Console')
            : (takesMo > 0 ? 'pattern consistent with AI answers in results, a floor from ' + exposed.length + ' page' + (exposed.length === 1 ? '' : 's') + ' below' : 'no pages cleared the strict bar this period');
        const sendsBig = ga4On ? _epi(fmt(sendsMo), 'measured') : _epi('n/a', 'pending');
        const sendsSub = !ga4On ? 'connect GA4 to measure' : (sends && sends.growth != null ? (sends.growth >= 0 ? 'up ' : 'down ') + Math.abs(Math.round(sends.growth * 100)) + '% vs the prior period' : 'AI assistant referrals');
        const kpiRow = '<div style="display:flex;gap:10px;margin:14px 0 10px;">' +
            kpi('What AI takes', takesBig, 'clicks/mo', takesSub, RED) +
            kpi('What AI sends', sendsBig, 'sessions/mo', sendsSub, GRN) + '</div>';
        // ── takes vs sends bar: real magnitudes, one shared monthly scale (the lopsidedness is the point) ──
        const barMax = Math.max(takesMo || 0, sendsMo, 1);
        const lw = Math.round((takesMo || 0) / barMax * 100), rw = Math.round(sendsMo / barMax * 100);
        const bar = '<div style="margin:2px 0 4px;"><div style="display:flex;align-items:center;height:18px;">' +
            '<div style="flex:1;display:flex;justify-content:flex-end;">' + (takesMo != null
                ? '<div style="height:15px;width:' + lw + '%;background:' + RED + ';border-radius:3px 0 0 3px;"></div>'
                : '<div style="height:15px;width:40%;border:1px dashed var(--color-border-primary);border-radius:3px 0 0 3px;"></div>') + '</div>' +
            '<div style="width:2px;height:22px;background:var(--color-text-muted);"></div>' +
            '<div style="flex:1;"><div style="height:15px;width:' + rw + '%;background:' + GRN + ';border-radius:0 3px 3px 0;"></div></div></div>' +
            '<div style="display:flex;justify-content:space-between;' + S + 'margin-top:4px;"><span style="color:' + RED + ';font-weight:700;">takes</span><span style="' + MUT + '">per month</span><span style="color:' + GRN + ';font-weight:700;">sends</span></div>' +
            '<div style="' + S + 'text-align:center;margin-top:2px;">clicks (GSC) vs sessions (GA4): closely comparable, not identical units</div></div>';
        // ── verdict sentence (the divergence read) ──
        let verdict;
        if (!gscOn) verdict = '<div style="' + S + '">Connect Search Console to read the AI Overviews divergence.</div>';
        else if (!div) verdict = '<div style="' + S + '">Not enough Search Console history yet to read the divergence (needs a few months).</div>';
        else {
            // ONE sentence-builder: the SAME _aiVerdictSentence the chat uses (via A.verdict). No second copy here.
            verdict = '<div style="font-size:0.86rem;line-height:1.5;">' + esc(A.verdict || '') + (takesMo ? ' The exposed pages are listed below.' : '') + '</div>';
        }
        const legend = '<div style="' + S + 'margin-top:12px;display:flex;gap:14px;flex-wrap:wrap;"><span>' + _epi('measured', 'measured') + ' direct figure</span><span>' + _epi('estimated', 'estimated') + ' modelled</span><span>' + _epi('inferred', 'inferred') + ' a bound, not a measurement</span></div>';
        const fresh = '<div style="' + S + 'margin-top:5px;">' + (gscOn && trend && trend.length ? 'GSC through ~' + esc(_aiYm(trend[trend.length - 1].ym)) + ' (Google lags ~3 days). ' : '') + (ga4On ? 'GA4 through ~yesterday.' : '') + '</div>';
        // ── sends detail: who is sending (per-assistant share + growth), plus the AskCI bucket ──
        const chip = function (x) {
            const g = x.growth != null ? ', ' + (x.growth >= 0 ? 'up ' : 'down ') + Math.abs(Math.round(x.growth * 100)) + '%' : '';
            return '<span style="' + S + 'border:1px solid var(--color-border-primary);border-radius:20px;padding:3px 11px;">' + esc(x.name) + ' ' + _epi(fmt(x.sess), 'measured') + ' <span style="' + MUT + '">(' + Math.round(x.sess / (sends.ai || 1) * 100) + '%' + g + ')</span></span>';
        };
        const sendsDetail = (ga4On && sends)
            ? '<div style="margin-top:16px;"><div style="font-weight:700;font-size:0.8rem;margin-bottom:6px;">AI assistants (who is sending)</div>' +
                (sends.named && sends.named.length
                    ? '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + sends.named.slice(0, 6).map(chip).join('') + '</div>'
                    : '<div style="' + S + '">No measurable AI assistant referrals this period.</div>') +
                '<div style="' + S + 'margin-top:8px;">AskCI, our own chatbot: ' + (sends.askci > 0 ? _epi(fmt(sends.askci), 'measured') + ' sessions' + (sends.askciGrowth != null ? ' (' + (sends.askciGrowth >= 0 ? 'up ' : 'down ') + Math.abs(Math.round(sends.askciGrowth * 100)) + '%)' : '') : 'none measured this period') + '.</div></div>'
            : '';
        return '<div id="sv-ai-verdict" style="border:1px solid var(--color-border-primary);border-radius:14px;padding:18px 20px;background:var(--color-bg-primary);">' +
            '<div style="font-weight:800;font-size:1.1rem;color:var(--color-text-heading);line-height:1.2;">AI Impact: the whole site</div>' +
            '<div style="' + S + '">' + esc(periodLabel(_ddDays)) + ' · ' + esc(window.treeData && (window.treeData.name || 'site')) + '</div>' +
            kpiRow + bar +
            '<div style="margin-top:12px;">' + verdict + '</div>' +
            legend + fresh + '</div>' +
            (gscOn && trend && trend.length >= 2 ? '<div style="margin-top:16px;"><div style="font-weight:700;font-size:0.8rem;margin-bottom:2px;">Click through rate over ' + trend.length + ' months</div><div style="' + S + 'margin-bottom:6px;">Of everyone who saw you in Google, the share who clicked (' + esc(_aiYm(trend[0].ym)) + ' to ' + esc(_aiYm(trend[trend.length - 1].ym)) + '). Falling is the see but don’t click signal.</div>' + _aiCtrChart(trend) + '</div>' : '') +
            (gscOn ? _aiHitListHtml(A.exposed, A.cited) : '') +
            (gscOn ? _aiExcludedNote(A.excluded) : '') +
            sendsDetail +
            '<div style="' + S + 'margin-top:16px;padding-top:10px;border-top:1px solid var(--color-border-primary);">Search Console only sees Google, so this catches Google’s AI Overviews; losses to ChatGPT/Perplexity etc. are invisible here (they show up as GA4 down while GSC holds steady). For a public service body, being the source an AI answer cites can be mission success even without the click.</div>';
    }
    // ── Phase 2: the hit-list — per-page, position-controlled ────────────────────
    // TWO GSC windows (now vs ~1yr back), reusing the cached fetchTrendWindow machinery.
    // A page is flagged ONLY when position held (controls for rank slip) AND impressions clear a
    // floor AND CTR fell hard: that is the zero-click fingerprint, not demand or ranking loss.
    // Pre-committed discipline (a tight, real list beats a long mixed one):
    //  _HL_POSMAX  page-1 only — AI Overviews/rich results sit at the top; a page at rank 12 losing CTR
    //              is a ranking/depth story, not an Overviews one.
    //  _HL_CTRBASE the page needed a real baseline CTR to have meaningful clicks to lose (a page that
    //              never converted shows noisy relative drops).
    //  cliff guard near-zero CTR *at a top rank* (pos<=5) is implausible from AI (Overviews reduce, they
    //              don't zero out a rank-3 page) — it is a redirect/tracking artifact; set aside, not counted.
    const _HL_WIN = 90, _HL_FLOOR = 2000, _HL_POS = 1.0, _HL_CTRDROP = 0.75, _HL_TOP = 15;
    const _HL_POSMAX = 10, _HL_CTRBASE = 0.02, _HL_CLIFFPOS = 5, _HL_CLIFFCTR = 0.005;
    // _HL_AIMINCTR: the "near zero needs a number" line (C1). Below this CURRENT CTR, a held-rank page-1 collapse is an
    // attribution artifact, not AI - Overviews reduce CTR, they do not drop a page-1 page to ~0. Set between the site's
    // real exposed CTRs (~2 to 3%) and the artifact floor (Construction: 0.5%), so 0.8% cleanly separates them. Tune on data.
    const _HL_AIMINCTR = 0.008;
    // Pure, testable per-page verdict from two GSC windows: now `a`, ~1yr ago `b`, each {impr, clk, pos}.
    // The ONE place the exposure thresholds are applied — selfTest asserts this directly, and because
    // diagnose / briefing now lean on it, a threshold change is a single, tested edit here.
    function _classifyExposure(a, b) {
        const cN = a.impr > 0 ? a.clk / a.impr : 0, cB = b.impr > 0 ? b.clk / b.impr : 0;
        const base = { ctrN: cN, ctrB: cB, pos: a.pos, impr: a.impr };
        if (a.impr < _HL_FLOOR || b.impr <= 0) return Object.assign({ keep: false, reason: 'floor' }, base);
        if (cB < _HL_CTRBASE) return Object.assign({ keep: false, reason: 'baseCTR' }, base);      // never converted -> noisy
        if (Math.abs(a.pos - b.pos) > _HL_POS) return Object.assign({ keep: false, reason: 'rankslip' }, base);   // rank slip, not AI
        if (a.pos > _HL_POSMAX) return Object.assign({ keep: false, reason: 'page2' }, base);       // page 2, not the Overview zone
        if (cN >= cB * _HL_CTRDROP) return Object.assign({ keep: false, reason: 'ctrheld' }, base); // CTR held
        if (cN < _HL_AIMINCTR) return Object.assign({ keep: false, reason: 'artifact', artifact: true }, base);   // near-zero CTR NOW, even at a held DEEPER page-1 rank (we are past the page-2 gate): implausible from AI, so it is a redirect/tracking artifact, not an AI take (C1: Construction 8.3% to 0.5% at pos 9.3 used to slip through the pos<=5 guard)
        return Object.assign({ keep: true, tier: a.pos <= 2.0 ? 'cited' : 'exposed', lost: Math.max(0, Math.round(a.impr * (cB - cN) / 3)) }, base);
    }
    // Classify every English page into exposed / cited / excluded from two cached GSC windows.
    // The report AND the Ask tool both read this via getAIImpact — one engine, two views, no drift.
    async function _aiClassifyPages(tree, r) {
        const pair = await Promise.all([fetchTrendWindow(tree, _HL_WIN, 0), fetchTrendWindow(tree, _HL_WIN, 365)]);
        const now = pair[0].gscBy, base = pair[1].gscBy;
        const out = { exposed: [], cited: [], excluded: [] };
        if (!now || !base) return out;
        const agg = function (maps, urls) {
            let i = 0, c = 0, pw = 0;
            urls.forEach(function (u) { const g = maps[normUrl(u)]; if (g) { const gi = g.impressions || 0; i += gi; c += g.clicks || 0; pw += (g.position || 0) * gi; } });
            return { impr: i, clk: c, pos: i > 0 ? pw / i : 0 };
        };
        _allPages(r).forEach(function (p) {
            const urls = p.urls || [p.url];
            if (!urls.some(function (u) { return String(u).indexOf('/en/') >= 0; })) return;       // English pages only
            const v = _classifyExposure(agg(now, urls), agg(base, urls));
            const nm = p.name || urls[0], url = p.url || urls[0];
            if (v.artifact) { out.excluded.push({ name: nm, url: url, pos: v.pos, ctrN: v.ctrN, ctrB: v.ctrB, impr: v.impr }); return; }
            if (!v.keep) return;
            (v.tier === 'cited' ? out.cited : out.exposed).push({ name: nm, url: url, tier: v.tier, pos: v.pos, ctrN: v.ctrN, ctrB: v.ctrB, impr: v.impr, lost: v.lost });
        });
        out.exposed.sort(function (a, b) { return b.lost - a.lost; });
        out.cited.sort(function (a, b) { return b.lost - a.lost; });
        out.excluded.sort(function (a, b) { return b.impr - a.impr; });
        return out;
    }
    // ── The shared engine: one cached compute the report and Ask both read (registered in clearCaches) ──
    const _aiImpactCache = {};   // days -> Promise<{trend,div,exposed,cited,excluded,floor,sends,gscOn,ga4On,r}>
    function getAIImpact(days) {
        days = days || _ddDays || 30;
        if (_aiImpactCache[days]) return _aiImpactCache[days];
        _aiImpactCache[days] = (async function () {
            const g = window.GSCIntegration, a = window.GA4Integration;
            const gscOn = !!(g && g.isConnected && g.isConnected()), ga4On = !!(a && a.isConnected && a.isConnected());
            const tree = window.treeData, r = tree ? build(tree) : { categories: [] };
            let trend = [], cls = { exposed: [], cited: [], excluded: [] }, sends = null, classifyOk = false;
            if (gscOn) { try { trend = await getGscSiteTrend(12); } catch (e) {} try { cls = await _aiClassifyPages(tree, r); classifyOk = true; } catch (e) {} }   // classifyOk=false => fetch failed, distinct from "clean"
            if (ga4On) { try { sends = await _aiSends(); } catch (e) {} }
            const floor = cls.exposed.reduce(function (s, x) { return s + x.lost; }, 0);
            const div = _aiDivergence(trend);
            return { trend: trend, div: div, verdict: _aiVerdictSentence(div), exposed: cls.exposed, cited: cls.cited, excluded: cls.excluded, floor: floor, sends: sends, gscOn: gscOn, ga4On: ga4On, classifyOk: classifyOk, r: r };
        })().catch(function (e) { delete _aiImpactCache[days]; throw e; });
        return _aiImpactCache[days];
    }
    // Read the engine ONLY if already cached (never triggers the expensive two-window fetch). The
    // briefing/hero uses this to stay free on panel-open; diagnose uses getAIImpact() to pull-and-wait.
    function getAIImpactCached(days) { return _aiImpactCache[days || _ddDays || 30] || null; }
    // Pure finding assembly (selfTest asserts this): given a page's urls and an engine result, return
    // the AI finding for that page, or null. exposed => the "consistent with AI" flag with its floor
    // magnitude; excluded => the redirect/artifact reframe; not found (incl. rank slip) => null.
    function _aiFinding(urls, A) {
        if (!A || !A.gscOn) return null;
        if (!A.classifyOk) return { kind: 'unavailable', sev: 'info', score: 0, t: 'AI check unavailable', d: 'The AI exposure comparison could not run this period (Search Console history or fetch).' };
        const keys = Object.create(null); (urls || []).forEach(function (u) { keys[normUrl(u)] = 1; });
        const find = function (arr) { for (let i = 0; i < (arr || []).length; i++) if (keys[normUrl(arr[i].url)]) return arr[i]; return null; };
        const ex = find(A.exposed);
        if (ex) return { kind: 'exposed', sev: 'warn', score: ex.lost, t: 'AI exposure', d: 'Position held at ' + ex.pos.toFixed(1) + ' but CTR fell ' + _aiCtr(ex.ctrB) + ' to ' + _aiCtr(ex.ctrN) + ', a pattern consistent with AI answers in the results page (~' + fmt(ex.lost) + ' clicks/mo at stake). See the AI Impact report.' };
        const art = find(A.excluded);
        if (art) return { kind: 'artifact', sev: 'warn', score: 0, t: 'Data artifact', d: 'Click through collapsed to near zero at a strong rank (position ' + art.pos.toFixed(1) + ', ' + fmt(Math.round(art.impr)) + ' impressions), which looks like a redirect or attribution issue, not AI or content.' };
        return null;
    }
    function _aiHitListHtml(exposed, cited) {
        const S = 'font-size:0.72rem;color:var(--color-text-secondary);';
        const head = '<div style="margin-top:16px;"><div style="font-weight:700;font-size:0.8rem;margin-bottom:2px;">Where Google is answering for you</div>';
        const rows = (exposed || []).concat(cited || []);                                         // exposed first (each already sorted by lost)
        if (!rows.length) return head + '<div style="' + S + '">No pages cleared the bar this period (page 1, ' + fmt(_HL_FLOOR) + ' or more impressions, baseline CTR ' + Math.round(_HL_CTRBASE * 100) + '% or more, position held, CTR down 25% or more). That is a good sign, or the two windows are too close to separate the signal.</div></div>';
        const top = rows.slice(0, _HL_TOP);
        const row = function (x) {
            const cited = x.tier === 'cited';
            const tag = cited
                ? '<span class="sv-epi sv-epi-inf" title="Inferred: still ranking near the top with high impressions, so you are plausibly the source the AI answer cites. Search Console cannot confirm this.">likely cited</span>'
                : '<span style="font-size:0.56rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:#dc2626;background:rgba(220,38,38,0.10);padding:2px 6px;border-radius:4px;">exposed</span>';
            const why = 'position held at ' + _epi(x.pos.toFixed(1), 'measured') + ', CTR ' + _aiCtr(x.ctrB) + ' to ' + _aiCtr(x.ctrN) + ', ' + _epi(fmt(Math.round(x.impr)), 'measured') + ' impressions';
            return '<div class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(x.url) + '" style="cursor:pointer;display:flex;gap:10px;padding:9px 11px;border:1px ' + (cited ? 'dashed' : 'solid') + ' var(--color-border-primary);border-radius:9px;background:var(--color-bg-primary);align-items:flex-start;">' +
                '<div style="flex-shrink:0;margin-top:1px;">' + tag + '</div>' +
                '<div style="min-width:0;flex:1;"><div style="font-size:0.8rem;font-weight:700;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(x.name) + '</div>' +
                '<div style="font-size:0.7rem;color:var(--color-text-secondary);margin-top:2px;">' + why + '</div></div>' +
                '<div style="flex-shrink:0;text-align:right;"><div style="font-weight:700;font-size:0.78rem;color:#dc2626;">' + _epi(fmt(x.lost), 'estimated') + '</div><div style="font-size:0.62rem;color:var(--color-text-muted);">clicks/mo</div></div></div>';
        };
        const exp = exposed || [];
        const citedN = (cited || []).length;
        let cluster = '';                                                                          // the finding the data already holds: where the losses sit
        if (exp.length >= 3) {
            const ps = exp.map(function (x) { return x.pos; }), lo = Math.min.apply(null, ps), hi = Math.max.apply(null, ps);
            if (lo > 3) cluster = '<div style="' + S + 'margin-bottom:8px;"><strong>Exposed pages cluster at positions ' + Math.floor(lo) + ' to ' + Math.ceil(hi) + '</strong>, none in the top 3, so your top rankings appear to be keeping their clicks. Defending positions 1 to 2 matters more than ever.</div>';
        }
        return head +
            '<div style="' + S + 'margin-bottom:8px;">Pages still ranking as well as a year ago, but with click through down sharply. ' + _epi('Exposed', 'measured') + ' pages lead (losing clicks, act on these). ' + _epi('Likely cited', 'inferred') + ' pages are inferred: still at the top, so the citizen may be getting your answer inside the result.</div>' +
            cluster +
            '<div style="display:flex;flex-direction:column;gap:7px;">' + top.map(row).join('') + '</div>' +
            (citedN === 0 ? '<div style="' + S + 'margin-top:6px;">No pages matched the likely cited pattern this period.</div>' : '') +
            (rows.length > top.length ? '<div style="' + S + 'margin-top:6px;">Showing top ' + top.length + ' of ' + rows.length + ', by estimated lost clicks.</div>' : '') +
            '</div>';
    }
    // Provenance note (NOT a content-ops panel): the AI report owns the disclosure of what was excluded
    // from the takes number and why, so the figure is honest, but the remediation ("fix your redirects")
    // is site-health work that belongs elsewhere. Compact, muted, no call-to-action; names link out.
    function _aiExcludedNote(arts) {
        if (!arts || !arts.length) return '';
        const S = 'font-size:0.72rem;color:var(--color-text-secondary);';
        const names = arts.slice(0, 10).map(function (x) {
            return '<span class="sv-ask-page" role="button" tabindex="0" data-url="' + esc(x.url) + '" style="cursor:pointer;border-bottom:1px dotted var(--color-text-muted);" title="' + esc(fmt(Math.round(x.impr)) + ' impressions at position ' + x.pos.toFixed(1) + ', but CTR ' + _aiCtr(x.ctrB) + ' to ' + _aiCtr(x.ctrN)) + '">' + esc(x.name) + '</span>';
        }).join(', ');
        return '<div style="' + S + 'margin-top:12px;line-height:1.45;"><strong>' + arts.length + ' page' + (arts.length === 1 ? '' : 's') + ' excluded from the takes number:</strong> click through fell below ' + (_HL_CLIFFCTR * 100) + '% at a top-' + _HL_CLIFFPOS + ' rank, which is a data pattern (a redirect or attribution gap) rather than AI: ' + names + (arts.length > 10 ? ', and ' + (arts.length - 10) + ' more' : '') + '.</div>';
    }
    // ── Export the report to PDF ─────────────────────────────────────────────────
    // Rather than rasterise HTML (html2canvas was flaky), clone the report body into a print root and
    // use the browser's own print -> Save as PDF. Same document, so CSS vars + SVG charts resolve; a
    // print stylesheet hides everything else and forces a clean light theme regardless of app theme.
    function _ensurePrintStyle() {
        if (document.getElementById('sv-print-style')) return;
        const st = document.createElement('style'); st.id = 'sv-print-style';
        st.textContent =
            '#sv-print-root{display:none;}' +
            '@media print{' +
                'body.sv-printing>*:not(#sv-print-root){display:none !important;}' +
                'body.sv-printing #sv-print-root{display:block !important;margin:0 auto;max-width:720px;padding:6px 2px;' +
                    'color:#111 !important;background:#fff !important;' +
                    '--color-bg-primary:#ffffff;--color-bg-secondary:#ffffff;--color-bg-elevated:#ffffff;' +
                    '--color-text-primary:#111111;--color-text-heading:#000000;--color-text-secondary:#444444;--color-text-muted:#777777;' +
                    '--color-border-primary:#dddddd;--primary:#007cb6;}' +
                '#sv-print-root *{animation:none !important;transition:none !important;}' +
                '#sv-print-root .sv-ask-page{cursor:default;}' +
                '@page{margin:14mm;}' +
            '}';
        document.head.appendChild(st);
    }
    // Clone the modal content (minus its header/buttons) into the print root, print, then clean up.
    function _exportVerdictPdf(content) {
        if (!content) return;
        _ensurePrintStyle();
        const old = document.getElementById('sv-print-root'); if (old) old.remove();
        const root = document.createElement('div'); root.id = 'sv-print-root';
        const clone = content.cloneNode(true);
        if (clone.firstElementChild) clone.removeChild(clone.firstElementChild);   // drop the breadcrumb + close/export buttons
        root.appendChild(clone);
        document.body.appendChild(root);
        document.body.classList.add('sv-printing');
        let done = false;
        const cleanup = function () { if (done) return; done = true; document.body.classList.remove('sv-printing'); root.remove(); window.removeEventListener('afterprint', cleanup); };
        window.addEventListener('afterprint', cleanup);
        setTimeout(function () { window.print(); }, 80);
        setTimeout(cleanup, 60000);   // fallback if afterprint never fires
    }
    async function showAIImpact(days) {
        const tree = window.treeData;
        if (!tree) { alert('Load a sitemap first.'); return; }
        ensureDDStyle(); ensureAskStyle();
        if (days) _ddDays = days;
        const gsc = window.GSCIntegration, ga4 = window.GA4Integration;
        const gscOn = !!(gsc && gsc.isConnected && gsc.isConnected()), ga4On = !!(ga4 && ga4.isConnected && ga4.isConnected());
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow:auto;backdrop-filter:blur(3px);';
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        const content = document.createElement('div');
        content.className = 'sv-dd-modal';
        content.style.cssText = 'background:var(--color-bg-secondary);border-radius:14px;max-width:640px;width:100%;padding:20px 22px;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
        const stage = function (txt) { content.innerHTML = '<div style="display:flex;justify-content:flex-end;"><button id="sv-ai-close" style="background:none;border:none;font-size:22px;color:var(--color-text-muted);cursor:pointer;line-height:1;">×</button></div><div style="text-align:center;padding:30px 0;color:var(--color-text-secondary);font-size:0.85rem;">' + esc(txt) + '</div>'; const c = content.querySelector('#sv-ai-close'); if (c) c.addEventListener('click', function () { overlay.remove(); }); };
        stage('Measuring AI impact (Search Console + GA4)…');
        overlay.appendChild(content); document.body.appendChild(overlay);
        let A; try { A = await getAIImpact(_ddDays); } catch (e) { A = { trend: [], div: null, exposed: [], cited: [], excluded: [], floor: 0, sends: null, gscOn: gscOn, ga4On: ga4On }; }
        const hasCard = gscOn || ga4On;
        const exportBtn = hasCard ? '<button id="sv-ai-export" title="Open the print dialog to save the report as a PDF" style="background:none;border:1px solid var(--color-border-primary);border-radius:7px;padding:5px 11px;font-size:0.72rem;color:var(--color-text-secondary);cursor:pointer;display:inline-flex;align-items:center;gap:5px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Export as PDF</button>' : '';
        content.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-size:0.72rem;color:var(--color-text-muted);">Reports → AI Impact</div><div style="display:flex;align-items:center;gap:10px;">' + exportBtn + '<button id="sv-ai-close" style="background:none;border:none;font-size:22px;color:var(--color-text-muted);cursor:pointer;line-height:1;">×</button></div></div>' +
            (!hasCard ? '<div style="text-align:center;padding:24px;color:var(--color-text-secondary);font-size:0.85rem;">Connect Search Console and GA4 to measure AI impact.</div>' : _aiImpactBody(A));
        const c2 = content.querySelector('#sv-ai-close'); if (c2) c2.addEventListener('click', function () { overlay.remove(); });
        const ex = content.querySelector('#sv-ai-export'); if (ex) ex.addEventListener('click', function () { _exportVerdictPdf(content); });
    }

    window.SVRollup = {
        build: build,
        clearCaches: clearCaches,
        showAIImpact: showAIImpact,
        buildMonthlyReport: buildMonthlyReport,
        downloadMonthlyReport: promptMonthlyReport,
        statsForUrl: statsForUrl,
        prefetchGA4: prefetchGA4,
        prefetchGSC: prefetchGSC,
        refresh: refresh,
        computeMovers: computeMovers,
        showPanel: showPanel,
        showAsk: showAsk,
        showDeepDive: showDeepDive,
        selfTest: selfTest,
        selfTestRouting: selfTestRouting,
        _normUrl: normUrl,
        countryName: _countryName,
        ctrBenchmark: _ctrBenchmark,
        getAskMisses: getAskMisses
    };
    // Convenience global for the Reports menu onclick
    window.showCategoryPerformance = showPanel;
    window.showAskData = showAsk;
    window.downloadMonthlyReport = promptMonthlyReport;
    window.showAIImpact = function () { showAIImpact(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _ensureAskFab);
    else _ensureAskFab();
})();
