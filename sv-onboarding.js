/*
 * sv-onboarding.js — a tiny dependency-free guided tour (spotlight + step tooltips).
 * Highlights the main features by pointing at the real UI. Exposes window.SVTour.
 *   SVTour.startDefault()  — run the built-in tour
 *   SVTour.start(steps)    — run a custom [{sel,title,body,action?}] list
 *   SVTour.hasSeen()       — localStorage flag ('sv-tour-seen')
 * Each step targets a CSS selector; missing/hidden targets are skipped automatically.
 */
(function () {
    'use strict';

    var overlay, spot, tip, steps, idx, onResize, settleTimer;

    function q(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }

    function visible(el) {
        if (!el) return false;
        var r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        var cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
    }

    function ensureNodes() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.id = 'sv-tour-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:transparent;';
        // Block page interaction during the tour (clicks fall on this, not the page).
        overlay.addEventListener('click', function (e) { e.stopPropagation(); });

        spot = document.createElement('div');
        spot.id = 'sv-tour-spot';
        spot.style.cssText = 'position:fixed;z-index:100001;border-radius:12px;' +
            'box-shadow:0 0 0 9999px rgba(0,0,0,0.65);pointer-events:none;' +
            'transition:top 0.25s ease,left 0.25s ease,width 0.25s ease,height 0.25s ease;';

        tip = document.createElement('div');
        tip.id = 'sv-tour-tip';
        tip.style.cssText = 'position:fixed;z-index:100002;max-width:330px;width:calc(100vw - 32px);' +
            'box-sizing:border-box;background:var(--color-bg-secondary,#fff);' +
            'color:var(--color-text-primary,#111);border:1px solid var(--color-border-primary,#e5e7eb);' +
            'border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:18px 20px;' +
            'font-family:var(--font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif);' +
            'transition:top 0.2s ease,left 0.2s ease;';

        document.body.appendChild(overlay);
        document.body.appendChild(spot);
        document.body.appendChild(tip);

        onResize = function () { render(); };
        window.addEventListener('resize', onResize);
    }

    function end() {
        if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
        if (onResize) window.removeEventListener('resize', onResize);
        [overlay, spot, tip].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
        overlay = spot = tip = null;
        try { localStorage.setItem('sv-tour-seen', 'true'); } catch (e) {}
    }

    function go(n) {
        idx = n < 0 ? 0 : n;
        // Skip forward over any missing/hidden targets.
        while (idx < steps.length) {
            var s = steps[idx];
            if (!s.sel || visible(q(s.sel))) break;
            idx++;
        }
        if (idx >= steps.length) { end(); return; }
        render();
    }

    function mkBtn(label, kind, fn) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.onclick = fn;
        if (kind === 'primary') {
            b.style.cssText = 'padding:8px 16px;border:none;border-radius:8px;background:var(--primary,#8b5cf6);' +
                'color:#fff;font-size:0.82rem;font-weight:600;cursor:pointer;';
        } else {
            b.style.cssText = 'padding:8px 12px;border:1px solid var(--color-border-primary,#e5e7eb);' +
                'border-radius:8px;background:transparent;color:var(--color-text-secondary,#555);' +
                'font-size:0.82rem;cursor:pointer;';
        }
        return b;
    }

    function place(el) {
        var vw = window.innerWidth, vh = window.innerHeight;
        if (el && visible(el)) {
            var r = el.getBoundingClientRect();
            var pad = 8;
            spot.style.display = 'block';
            spot.style.top = (r.top - pad) + 'px';
            spot.style.left = (r.left - pad) + 'px';
            spot.style.width = (r.width + pad * 2) + 'px';
            spot.style.height = (r.height + pad * 2) + 'px';
            var tw = tip.offsetWidth, th = tip.offsetHeight;
            var top = (r.bottom + 14 + th <= vh) ? (r.bottom + 14) : Math.max(14, r.top - 14 - th);
            var left = Math.min(Math.max(14, r.left), vw - tw - 14);
            tip.style.top = top + 'px';
            tip.style.left = left + 'px';
        } else {
            // No target: dim everything, centre the card.
            spot.style.display = 'none';
            tip.style.top = ((vh - tip.offsetHeight) / 2) + 'px';
            tip.style.left = ((vw - tip.offsetWidth) / 2) + 'px';
        }
    }

    function render() {
        if (!steps || idx >= steps.length) return;
        var s = steps[idx];
        var el = s.sel ? q(s.sel) : null;
        if (s.sel && !visible(el)) { go(idx + 1); return; }

        if (el) { try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (e) {} }

        var total = steps.length;
        tip.innerHTML = '';

        var h = document.createElement('div');
        h.textContent = s.title;
        h.style.cssText = 'font-size:1.02rem;font-weight:700;color:var(--color-text-heading,#111);margin-bottom:8px;';
        tip.appendChild(h);

        var b = document.createElement('div');
        b.textContent = s.body;
        b.style.cssText = 'font-size:0.85rem;line-height:1.55;color:var(--color-text-secondary,#555);white-space:pre-line;margin-bottom:14px;';
        tip.appendChild(b);

        if (s.action) {
            var act = mkBtn(s.action.label, 'primary', function () { try { s.action.fn(); } catch (e) {} });
            act.style.width = '100%';
            act.style.marginBottom = '12px';
            tip.appendChild(act);
        }

        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;';
        var count = document.createElement('span');
        count.textContent = (idx + 1) + ' / ' + total;
        count.style.cssText = 'font-size:0.72rem;color:var(--color-text-muted,#888);';
        var btns = document.createElement('div');
        btns.style.cssText = 'display:flex;gap:8px;';
        btns.appendChild(mkBtn('Skip', 'ghost', end));
        var back = mkBtn('Back', 'ghost', function () { go(idx - 1); });
        if (idx === 0) back.style.visibility = 'hidden';
        btns.appendChild(back);
        var last = idx === total - 1;
        btns.appendChild(mkBtn(last ? 'Done' : 'Next', 'primary', function () { last ? end() : go(idx + 1); }));
        row.appendChild(count);
        row.appendChild(btns);
        tip.appendChild(row);

        place(el);
        // Reposition once the smooth-scroll settles (rect can shift after scrollIntoView).
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(function () { place(el); }, 260);
    }

    function defaultSteps() {
        return [
            {
                sel: '#urlInput',
                title: 'Step 1. Load a sitemap',
                body: 'Paste a sitemap URL and press Load Sitemap. If you used the tool before, your last sitemap may already be loaded here.'
            },
            {
                sel: '#googleConnectBtn',
                title: 'Step 2. Connect Google (optional)',
                body: 'One click connects Google Analytics 4 and Search Console together, read only.\n\nGoogle shows a one time notice that the app is not verified. Click Advanced, then Go to the app, then Continue. That is expected and safe: the tool only reads your data.',
                action: { label: 'Connect Google now', fn: function () { if (typeof window.SVConnectGoogle === 'function') window.SVConnectGoogle(); } }
            },
            {
                sel: '#reportsNavBtn',
                title: 'Step 3. Reports',
                body: 'Site structure, content freshness, content by category and URL health reports all live in this menu.'
            },
            {
                sel: '#sv-ask-fab',
                title: 'Ask anything',
                body: 'Ask questions in plain English, like which pages are stale or what the biggest categories are, and get an instant answer. AI is already on, no key needed.'
            }
        ];
    }

    function start(customSteps) {
        steps = customSteps || defaultSteps();
        idx = 0;
        ensureNodes();
        go(0);
    }

    window.SVTour = {
        start: start,
        startDefault: function () { start(); },
        end: end,
        hasSeen: function () { try { return localStorage.getItem('sv-tour-seen') === 'true'; } catch (e) { return false; } }
    };
})();
