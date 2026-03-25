// groq-integration-module.js
// Groq AI infrastructure: API key management, settings UI, nav button,
// and core complete()/stream() functions for use by other modules.

(function () {
    'use strict';

    // ─── Constants ────────────────────────────────────────────────────────────

    const GROQ_ENDPOINT     = 'https://api.groq.com/openai/v1/chat/completions';
    const STORAGE_KEY_API   = 'groqApiKey';
    const STORAGE_KEY_MODEL = 'groqModel';
    const DEFAULT_MODEL     = 'llama-3.3-70b-versatile';
    const FAST_MODEL        = 'llama-3.1-8b-instant';
    const AVAILABLE_MODELS  = [
        { id: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile (Best quality)' },
        { id: 'llama-3.1-8b-instant',    label: 'llama-3.1-8b-instant (Fastest)'        },
    ];

    // ─── Private state ────────────────────────────────────────────────────────

    let _apiKey  = null;
    let _model   = DEFAULT_MODEL;
    let _testing = false;

    // ─── Storage helpers ──────────────────────────────────────────────────────

    function _loadFromStorage() {
        try {
            const key   = localStorage.getItem(STORAGE_KEY_API);
            const model = localStorage.getItem(STORAGE_KEY_MODEL);
            if (key)   _apiKey = key;
            if (model && AVAILABLE_MODELS.some(m => m.id === model)) _model = model;
        } catch (e) {
            // Private/incognito mode may throw — safe to ignore
        }
    }

    function _saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY_API,   _apiKey);
            localStorage.setItem(STORAGE_KEY_MODEL, _model);
        } catch (e) {}
    }

    function _clearStorage() {
        try {
            localStorage.removeItem(STORAGE_KEY_API);
            localStorage.removeItem(STORAGE_KEY_MODEL);
        } catch (e) {}
    }

    // ─── HTTP error mapping ───────────────────────────────────────────────────

    function _handleHttpError(status) {
        if (status === 401) throw new Error('Invalid API key. Check your key at console.groq.com');
        if (status === 429) throw new Error('Rate limit reached. Please wait a moment and try again.');
        if (status === 413) throw new Error('Request too large. Reduce the amount of content being sent.');
        if (status === 503) throw new Error('Groq service temporarily unavailable. Please try again shortly.');
        throw new Error(`Groq server error (HTTP ${status}). Please try again.`);
    }

    // ─── Core API ─────────────────────────────────────────────────────────────

    // Internal non-streaming call. `overrideKey` is used only for validation.
    async function _rawComplete(messages, options, overrideKey) {
        const key = overrideKey || _apiKey;
        const payload = {
            model:       (options && options.model)       || _model,
            messages,
            max_tokens:  (options && options.max_tokens)  || 2048,
            temperature: (options && options.temperature) !== undefined ? options.temperature : 0.7,
            stream:      false,
        };

        let response;
        try {
            response = await fetch(GROQ_ENDPOINT, {
                method:  'POST',
                headers: {
                    'Authorization': 'Bearer ' + key,
                    'Content-Type':  'application/json',
                },
                body: JSON.stringify(payload),
            });
        } catch (networkErr) {
            throw new Error('Network error: ' + networkErr.message);
        }

        if (!response.ok) _handleHttpError(response.status);

        const json = await response.json();
        return json.choices[0].message.content;
    }

    // Validate a candidate key without saving it.
    async function _validateKey(key) {
        await _rawComplete(
            [{ role: 'user', content: 'Hi' }],
            { model: FAST_MODEL, max_tokens: 1 },
            key
        );
        return true;
    }

    // PUBLIC: non-streaming completion. Returns Promise<string>.
    async function complete(messages, options) {
        if (!_apiKey) {
            throw new Error(
                'Groq AI not configured. Click ✨ AI in the toolbar to add your API key.'
            );
        }
        return _rawComplete(messages, options);
    }

    // PUBLIC: streaming completion. Tokens delivered via onChunk; full text via onDone.
    async function stream(messages, onChunk, onDone, onError, options) {
        if (!_apiKey) {
            if (typeof onError === 'function') {
                onError(new Error(
                    'Groq AI not configured. Click ✨ AI in the toolbar to add your API key.'
                ));
            }
            return;
        }

        const payload = {
            model:       (options && options.model)       || _model,
            messages,
            max_tokens:  (options && options.max_tokens)  || 2048,
            temperature: (options && options.temperature) !== undefined ? options.temperature : 0.7,
            stream:      true,
        };

        let response;
        try {
            response = await fetch(GROQ_ENDPOINT, {
                method:  'POST',
                headers: {
                    'Authorization': 'Bearer ' + _apiKey,
                    'Content-Type':  'application/json',
                },
                body: JSON.stringify(payload),
            });
        } catch (networkErr) {
            if (typeof onError === 'function') {
                onError(new Error('Network error: ' + networkErr.message));
            }
            return;
        }

        if (!response.ok) {
            try { _handleHttpError(response.status); } catch (err) {
                if (typeof onError === 'function') onError(err);
            }
            return;
        }

        // ── SSE parsing ──────────────────────────────────────────────────────
        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = '';
        let fullText   = '';

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                lineBuffer += decoder.decode(value, { stream: true });
                const lines = lineBuffer.split('\n');
                lineBuffer  = lines.pop(); // keep incomplete trailing line

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line === 'data: [DONE]') {
                        if (typeof onDone === 'function') onDone(fullText);
                        return;
                    }
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const json  = JSON.parse(line.slice(6));
                        const token = json.choices && json.choices[0] &&
                                      json.choices[0].delta && json.choices[0].delta.content;
                        if (token) {
                            fullText += token;
                            if (typeof onChunk === 'function') onChunk(token);
                        }
                    } catch (_) {
                        // Malformed SSE frame — skip silently
                    }
                }
            }
            // Stream ended without [DONE] (connection cut) — deliver what we have
            if (fullText && typeof onDone === 'function') onDone(fullText);
        } catch (streamErr) {
            if (typeof onError === 'function') onError(streamErr);
        }
    }

    // ─── CSS injection ────────────────────────────────────────────────────────

    function _injectStyles() {
        if (document.getElementById('groq-ai-styles')) return;
        const style = document.createElement('style');
        style.id = 'groq-ai-styles';
        style.textContent = `
/* ── Groq AI nav button ────────────────────────────────── */
.nav-ai-btn {
    display: flex !important;
    align-items: center;
    gap: 6px;
    padding: 8px 14px !important;
    margin: 0 4px !important;
    background: var(--color-bg-primary) !important;
    border: 1px solid var(--color-border-primary) !important;
    border-radius: 8px !important;
    cursor: pointer;
    font-size: 14px !important;
    font-weight: 500;
    color: var(--color-text-secondary) !important;
    transition: all 0.2s ease;
    position: relative;
}
.nav-ai-btn:hover {
    background: var(--color-bg-secondary) !important;
    color: var(--color-text-primary) !important;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}
.nav-ai-btn.configured {
    color: var(--color-text-primary) !important;
    border-color: rgba(16, 185, 129, 0.4) !important;
}
.nav-ai-btn.testing {
    animation: groq-btn-pulse 1.2s ease-in-out infinite;
}

/* ── Status dot ─────────────────────────────────────────── */
.groq-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-text-muted, #94a3b8);
    flex-shrink: 0;
    transition: background 0.3s ease;
}
.nav-ai-btn.configured .groq-status-dot {
    background: #10b981;
    animation: groq-dot-pulse 2.5s ease-in-out infinite;
}

/* ── Dark mode overrides ─────────────────────────────────── */
body.dark-theme .nav-ai-btn {
    color: var(--color-text-secondary) !important;
}
body.dark-theme .nav-ai-btn.configured {
    border-color: rgba(16, 185, 129, 0.35) !important;
    color: var(--color-text-primary) !important;
}

/* ── Animations ──────────────────────────────────────────── */
@keyframes groq-dot-pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.6; transform: scale(1.2); }
}
@keyframes groq-btn-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
    50%      { box-shadow: 0 0 0 4px rgba(16,185,129,0.18); }
}
@keyframes groq-spin {
    to { transform: rotate(360deg); }
}

/* ── AI Rewrite button (inside Content Intelligence report) ── */
.pi-ai-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: 1px solid rgba(16,185,129,0.35);
    border-radius: 8px;
    background: rgba(16,185,129,0.06);
    color: #10b981;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}
.pi-ai-btn:hover:not(:disabled) {
    background: rgba(16,185,129,0.14);
    border-color: rgba(16,185,129,0.6);
}
.pi-ai-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* ── Streaming output area ────────────────────────────────── */
.pi-ai-output {
    margin-top: 10px;
    padding: 12px 14px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-primary);
    border-left: 3px solid #10b981;
    border-radius: 8px;
    font-size: 0.8rem;
    color: var(--color-text-primary);
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
}

/* ── Modal helpers ────────────────────────────────────────── */
.groq-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-border-primary, #e2e8f0);
    border-top-color: #10b981;
    border-radius: 50%;
    animation: groq-spin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
}
.groq-status-area {
    min-height: 22px;
    font-size: 0.84rem;
    margin-top: 10px;
    line-height: 1.4;
}
.groq-status-area.testing { color: var(--color-text-secondary); }
.groq-status-area.success { color: #10b981; font-weight: 600; }
.groq-status-area.error   { color: #ef4444; }
        `;
        document.head.appendChild(style);
    }

    // ─── Nav button ───────────────────────────────────────────────────────────

    let _navBtn = null;

    function _createNavButton() {
        const btn = document.createElement('button');
        btn.className   = 'nav-btn nav-ai-btn';
        btn.id          = 'groqAiBtn';
        btn.setAttribute('aria-label', 'AI Settings');
        btn.title       = 'Configure Groq AI';
        btn.onclick     = _showSettingsModal;

        // Inner layout: icon · label · status dot
        const icon = document.createElement('span');
        icon.textContent = '✨';

        const label = document.createElement('span');
        label.textContent = 'AI';

        const dot = document.createElement('span');
        dot.className = 'groq-status-dot';

        btn.appendChild(icon);
        btn.appendChild(label);
        btn.appendChild(dot);

        return btn;
    }

    function _addNavButton() {
        const checkAndAdd = () => {
            // Guard: don't add twice
            if (document.getElementById('groqAiBtn')) return;

            // Insert just before the theme toggle button
            const themeBtn = document.querySelector('button.nav-theme-btn');
            if (!themeBtn) {
                setTimeout(checkAndAdd, 100);
                return;
            }

            _navBtn = _createNavButton();
            themeBtn.parentNode.insertBefore(_navBtn, themeBtn);
            _updateButtonState();
        };
        checkAndAdd();
    }

    function _updateButtonState() {
        const btn = document.getElementById('groqAiBtn');
        if (!btn) return;
        btn.classList.toggle('configured', !!_apiKey);
        btn.classList.toggle('testing',    _testing);
    }

    // ─── Settings modal ───────────────────────────────────────────────────────

    function _showSettingsModal() {
        // Overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
            'background:rgba(0,0,0,0.8)', 'z-index:10000',
            'display:flex', 'align-items:center', 'justify-content:center',
        ].join(';');
        overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

        // Content box
        const box = document.createElement('div');
        box.style.cssText = [
            'background:var(--color-bg-primary)',
            'border-radius:12px',
            'padding:28px 32px',
            'max-width:460px',
            'width:90%',
            'box-shadow:0 25px 50px -12px rgba(0,0,0,0.4)',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            'position:relative',
        ].join(';');

        // ── Title ──
        const title = document.createElement('h3');
        title.textContent = '✨ Groq AI';
        title.style.cssText = 'margin:0 0 6px;font-size:1.1rem;color:var(--color-text-primary);font-weight:700;';
        box.appendChild(title);

        // ── Description ──
        const desc = document.createElement('p');
        desc.style.cssText = 'margin:0 0 22px;font-size:0.82rem;color:var(--color-text-secondary);line-height:1.5;';
        desc.textContent = 'Add your Groq API key to enable AI-powered writing suggestions, meta description generation, and content analysis. Groq inference is free to try.';
        box.appendChild(desc);

        // ── API key label ──
        const keyLabel = document.createElement('label');
        keyLabel.textContent = 'API Key';
        keyLabel.style.cssText = 'display:block;font-size:0.78rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:6px;';
        box.appendChild(keyLabel);

        // ── API key input row ──
        const inputRow = document.createElement('div');
        inputRow.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';

        const keyInput = document.createElement('input');
        keyInput.type        = 'password';
        keyInput.placeholder = 'gsk_…';
        keyInput.autocomplete = 'off';
        keyInput.spellcheck  = false;
        keyInput.style.cssText = [
            'flex:1',
            'padding:9px 12px',
            'border:1px solid var(--color-border-primary)',
            'border-radius:8px',
            'background:var(--color-bg-secondary)',
            'color:var(--color-text-primary)',
            'font-size:0.85rem',
            'font-family:monospace',
            'outline:none',
            'transition:border-color 0.2s',
        ].join(';');
        // Prefill with masked placeholder if key already exists
        if (_apiKey) keyInput.value = _apiKey;

        keyInput.onfocus = () => {
            keyInput.style.borderColor = '#10b981';
        };
        keyInput.onblur = () => {
            keyInput.style.borderColor = 'var(--color-border-primary)';
        };

        const showHideBtn = document.createElement('button');
        showHideBtn.type      = 'button';
        showHideBtn.textContent = 'Show';
        showHideBtn.style.cssText = [
            'padding:9px 12px',
            'border:1px solid var(--color-border-primary)',
            'border-radius:8px',
            'background:var(--color-bg-secondary)',
            'color:var(--color-text-secondary)',
            'font-size:0.8rem',
            'cursor:pointer',
            'white-space:nowrap',
            'transition:all 0.2s',
        ].join(';');
        showHideBtn.onclick = () => {
            const isHidden = keyInput.type === 'password';
            keyInput.type           = isHidden ? 'text' : 'password';
            showHideBtn.textContent = isHidden ? 'Hide' : 'Show';
        };

        inputRow.appendChild(keyInput);
        inputRow.appendChild(showHideBtn);
        box.appendChild(inputRow);

        // ── Help link ──
        const helpLink = document.createElement('p');
        helpLink.style.cssText = 'margin:0 0 20px;font-size:0.78rem;color:var(--color-text-muted);';
        const helpA = document.createElement('a');
        helpA.href   = 'https://console.groq.com';
        helpA.target = '_blank';
        helpA.rel    = 'noopener noreferrer';
        helpA.textContent = 'Get your free API key at console.groq.com →';
        helpA.style.cssText = 'color:#10b981;text-decoration:none;';
        helpA.onmouseover = () => { helpA.style.textDecoration = 'underline'; };
        helpA.onmouseout  = () => { helpA.style.textDecoration = 'none'; };
        helpLink.appendChild(helpA);
        box.appendChild(helpLink);

        // ── Model label ──
        const modelLabel = document.createElement('label');
        modelLabel.textContent = 'Model';
        modelLabel.style.cssText = 'display:block;font-size:0.78rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:6px;';
        box.appendChild(modelLabel);

        // ── Model selector ──
        const modelSelect = document.createElement('select');
        modelSelect.style.cssText = [
            'width:100%',
            'padding:9px 12px',
            'border:1px solid var(--color-border-primary)',
            'border-radius:8px',
            'background:var(--color-bg-secondary)',
            'color:var(--color-text-primary)',
            'font-size:0.85rem',
            'margin-bottom:20px',
            'cursor:pointer',
            'outline:none',
        ].join(';');
        AVAILABLE_MODELS.forEach(m => {
            const opt = document.createElement('option');
            opt.value       = m.id;
            opt.textContent = m.label;
            if (m.id === _model) opt.selected = true;
            modelSelect.appendChild(opt);
        });
        box.appendChild(modelSelect);

        // ── Status area ──
        const statusArea = document.createElement('div');
        statusArea.className = 'groq-status-area';
        box.appendChild(statusArea);

        // ── Button row ──
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;margin-top:16px;';

        const saveBtn = document.createElement('button');
        saveBtn.type      = 'button';
        saveBtn.textContent = 'Save & Test';
        saveBtn.style.cssText = [
            'flex:1',
            'padding:10px 16px',
            'border:none',
            'border-radius:8px',
            'background:#10b981',
            'color:white',
            'font-size:0.88rem',
            'font-weight:600',
            'cursor:pointer',
            'transition:all 0.2s',
        ].join(';');
        saveBtn.onmouseover = () => { if (!saveBtn.disabled) saveBtn.style.background = '#059669'; };
        saveBtn.onmouseout  = () => { if (!saveBtn.disabled) saveBtn.style.background = '#10b981'; };

        const clearBtn = document.createElement('button');
        clearBtn.type        = 'button';
        clearBtn.textContent = 'Clear key';
        clearBtn.style.cssText = [
            'padding:10px 14px',
            'border:1px solid var(--color-border-primary)',
            'border-radius:8px',
            'background:var(--color-bg-secondary)',
            'color:var(--color-text-secondary)',
            'font-size:0.85rem',
            'cursor:pointer',
            'transition:all 0.2s',
        ].join(';');
        clearBtn.style.display = _apiKey ? 'block' : 'none';
        clearBtn.onmouseover = () => { clearBtn.style.borderColor = '#ef4444'; clearBtn.style.color = '#ef4444'; };
        clearBtn.onmouseout  = () => { clearBtn.style.borderColor = 'var(--color-border-primary)'; clearBtn.style.color = 'var(--color-text-secondary)'; };

        // ── Save & Test handler ──
        saveBtn.onclick = async () => {
            const key = keyInput.value.trim();
            if (!key) {
                _setModalStatus(statusArea, 'error', 'Please enter an API key.');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = 'Testing…';
            _testing = true;
            _updateButtonState();
            _setModalStatus(statusArea, 'testing', '<span class="groq-spinner"></span>Validating key…');

            try {
                await _validateKey(key);
                // Success
                _apiKey = key;
                _model  = modelSelect.value;
                _saveToStorage();
                _setModalStatus(statusArea, 'success', '✅ Key validated and saved.');
                _testing = false;
                _updateButtonState();
                setTimeout(() => overlay.remove(), 1200);
            } catch (err) {
                _testing = false;
                _updateButtonState();
                saveBtn.disabled    = false;
                saveBtn.textContent = 'Save & Test';
                _setModalStatus(statusArea, 'error', '❌ ' + err.message);
            }
        };

        // ── Clear handler ──
        clearBtn.onclick = () => {
            _apiKey = null;
            _clearStorage();
            _updateButtonState();
            overlay.remove();
        };

        btnRow.appendChild(saveBtn);
        btnRow.appendChild(clearBtn);
        box.appendChild(btnRow);

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Focus the input for immediate typing (unless already has a value)
        setTimeout(() => { if (!_apiKey) keyInput.focus(); }, 50);
    }

    function _setModalStatus(area, type, html) {
        area.className = 'groq-status-area ' + type;
        area.innerHTML = html;
    }

    // ─── Initialisation ───────────────────────────────────────────────────────

    function _init() {
        _loadFromStorage();
        _injectStyles();
        _addNavButton();
        console.log('✨ Groq AI module loaded');
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    window.GroqAI = {
        complete,
        stream,
        isConfigured: () => !!_apiKey,
        getModel:     () => _model,
        showSettings: _showSettingsModal,
        debug: {
            getStatus: () => ({ hasKey: !!_apiKey, model: _model, testing: _testing }),
            clearKey:  () => { _apiKey = null; _clearStorage(); _updateButtonState(); },
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

})();
