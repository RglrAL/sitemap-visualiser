// groq-integration-module.js
// Groq AI infrastructure: API key management, settings UI, nav button,
// and core complete()/stream() functions for use by other modules.

(function () {
    'use strict';

    // ─── Constants ────────────────────────────────────────────────────────────

    const GROQ_ENDPOINT      = 'https://api.groq.com/openai/v1/chat/completions';
    const STORAGE_KEY_API    = 'groqApiKey';
    const STORAGE_KEY_MODEL  = 'groqModel';
    const STORAGE_KEY_PIN    = 'groqAdminPin';
    const STORAGE_KEY_PROMPTS = 'groqPrompts';
    const SESSION_KEY_AUTH   = 'adminAuth';
    const DEFAULT_MODEL      = 'llama-3.3-70b-versatile';
    const FAST_MODEL         = 'llama-3.1-8b-instant';
    const AVAILABLE_MODELS   = [
        { id: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile (Best quality)' },
        { id: 'llama-3.1-8b-instant',    label: 'llama-3.1-8b-instant (Fastest)'        },
    ];

    // Default prompt content — single source of truth
    const DEFAULT_PROMPTS = {
        'long-sentences': {
            system:     'You are a plain-language editor for citizensinformation.ie, an Irish government information website. Rewrite sentences to be shorter and clearer. Split long sentences into two shorter ones where helpful. Keep all key information. Use plain English. Respond with a numbered list only — one rewrite per number, matching the original order. Do not include any preamble or explanation.',
            userPrefix: 'Shorten these sentences. Number each rewrite:',
        },
        'passive-voice': {
            system:     'You are a plain-language editor for citizensinformation.ie, an Irish government information website. Rewrite passive voice sentences in active voice. Start each sentence with the subject — who does the action. Keep all key information. Use plain English. Respond with a numbered list only — one rewrite per number. Do not include any preamble or explanation.',
            userPrefix: 'Rewrite these passive voice sentences in active voice. Number each rewrite:',
        },
        'meta-description': {
            system:     'You are an SEO editor for citizensinformation.ie, an Irish government information website. Write a single meta description in plain English. Maximum 155 characters. It must be action-oriented, state the main topic clearly, and end without truncation. Output the meta description text only — no quotes, no label, no explanation.',
            userPrefix: 'Write a meta description for this page.',
        },
        'title-tag': {
            system:     'You are an SEO editor for citizensinformation.ie, an Irish government information website. Suggest 3 alternative title tags. Each must be under 60 characters, in plain English, topic first, no clickbait. Output a numbered list only — one title per number. No preamble.',
            userPrefix: 'Suggest 3 alternative title tags. Number each:',
        },
        'weak-anchors': {
            system:     'You are a content editor for citizensinformation.ie, an Irish government information website. Each item is a generic hyperlink anchor text with its destination URL. Suggest descriptive replacement anchor text for each. Respond with a numbered list only — one suggestion per number, matching the original order. Keep each under 8 words. No preamble.',
            userPrefix: 'Suggest descriptive anchor text for each weak link. Number each:',
        },
        'page-intro': {
            system:     'You are a plain-language editor for citizensinformation.ie, an Irish government information website. Rewrite the provided page introduction to be clearer, more direct, and action-oriented. The first sentence must state exactly what the page is about and who it helps. Use plain English. Keep all key information. Output the rewritten introduction only — no explanation.',
            userPrefix: 'Rewrite this page introduction to be clearer and more direct:',
        },
    };

    // Prompt metadata for the library UI
    const PROMPT_META = [
        {
            key:         'long-sentences',
            name:        'Long Sentences',
            description: 'Rewrites sentences over 20 words into shorter, clearer alternatives.',
        },
        {
            key:         'passive-voice',
            name:        'Passive Voice',
            description: 'Rewrites passive voice sentences in active voice, naming who does the action.',
        },
        { key: 'meta-description', name: 'Meta Description',      description: 'Generates an optimised meta description (max 155 chars) using the title, headings, and word count.' },
        { key: 'title-tag',        name: 'Title Tag Suggestions', description: 'Suggests 3 alternative title tags under 60 characters — plain English, topic first.' },
        { key: 'weak-anchors',     name: 'Weak Anchor Text',      description: 'Suggests descriptive anchor text for generic links such as "click here" or "read more".' },
        { key: 'page-intro',       name: 'Page Introduction',     description: 'Rewrites the first 2–3 paragraphs to be clearer, more direct, and action-oriented.' },
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
        } catch (e) {}
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

    // Returns saved prompt for `key`, falling back to DEFAULT_PROMPTS[key].
    function _getPrompt(key) {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_PROMPTS) || '{}');
            const entry  = stored[key];
            if (entry && entry.system && entry.userPrefix) return entry;
        } catch (e) {}
        return DEFAULT_PROMPTS[key];
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
                lineBuffer  = lines.pop();

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
                    } catch (_) {}
                }
            }
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

/* ── Inline rewrite slot (appears below each source sentence) */
.pi-ai-inline-output {
    border-left: 3px solid #10b981;
    background: rgba(16,185,129,0.05);
    border-radius: 0 6px 6px 0;
    margin: 2px 0 6px 0;
}
.pi-ai-rewrite-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 12px;
    font-size: 0.78rem;
    color: var(--color-text-primary);
    line-height: 1.6;
}
.pi-rewrite-text {
    flex: 1;
    word-break: break-word;
}
.pi-copy-btn {
    flex-shrink: 0;
    font-size: 0.67rem;
    font-weight: 600;
    padding: 2px 8px;
    border: 1px solid var(--color-border-primary);
    border-radius: 4px;
    background: var(--color-bg-primary);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
}
.pi-copy-btn:hover {
    border-color: #10b981;
    color: #10b981;
}
.pi-ai-thinking {
    margin-top: 6px;
    font-size: 0.73rem;
    color: var(--color-text-muted);
    font-style: italic;
}
.pi-ai-error {
    padding: 6px 12px;
    font-size: 0.75rem;
    color: #dc2626;
}

/* ── Legacy streaming output area (kept for safety) ──────── */
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

/* ── Admin PIN modal shake ──────────────────────────────── */
@keyframes admin-shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-8px); }
    40%     { transform: translateX(8px); }
    60%     { transform: translateX(-5px); }
    80%     { transform: translateX(5px); }
}
.admin-modal-shake {
    animation: admin-shake 0.5s ease;
}

/* ── Prompts nav button ──────────────────────────────────── */
.nav-prompts-btn {
    border-color: rgba(99,102,241,0.4) !important;
}
.nav-prompts-btn:hover {
    border-color: rgba(99,102,241,0.7) !important;
}

/* ── Prompts sliding panel ──────────────────────────────── */
.groq-prompts-panel {
    position: fixed;
    top: 0;
    right: -100%;
    width: min(580px, 100vw);
    height: 100vh;
    background: var(--color-bg-primary);
    border-left: 1px solid var(--color-border-primary);
    box-shadow: -10px 0 50px rgba(0,0,0,0.25);
    z-index: 10001;
    transition: right 0.35s cubic-bezier(0.4,0,0.2,1);
    display: flex;
    flex-direction: column;
    font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    overflow: hidden;
}
.groq-prompts-panel.active { right: 0; }

.groq-prompts-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 24px;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border-primary);
    flex-shrink: 0;
}
.groq-prompts-header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-primary);
}
.groq-prompts-close {
    background: none;
    border: none;
    font-size: 1.3rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    transition: all 0.2s;
}
.groq-prompts-close:hover { background: var(--color-bg-tertiary); color: #ef4444; }

.groq-prompts-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

/* ── Prompt card ─────────────────────────────────────────── */
.groq-prompt-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: 10px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.groq-prompt-card h3 {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--color-text-primary);
}
.groq-prompt-desc {
    margin: 0;
    font-size: 0.76rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
}
.groq-prompt-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 4px;
}
.groq-prompt-ta {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 11px;
    border: 1px solid var(--color-border-primary);
    border-radius: 7px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 0.76rem;
    font-family: inherit;
    line-height: 1.55;
    resize: vertical;
    min-height: 80px;
    outline: none;
    transition: border-color 0.2s;
}
.groq-prompt-ta:focus { border-color: #6366f1; }
.groq-token-estimate {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    text-align: right;
    margin-top: -6px;
}
.groq-prompt-btn-row {
    display: flex;
    gap: 8px;
    margin-top: 2px;
}
.groq-save-btn {
    padding: 7px 16px;
    border: none;
    border-radius: 7px;
    background: #6366f1;
    color: white;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    font-family: inherit;
}
.groq-save-btn:hover:not(:disabled) { background: #4f46e5; }
.groq-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.groq-reset-btn {
    padding: 7px 14px;
    border: 1px solid var(--color-border-primary);
    border-radius: 7px;
    background: var(--color-bg-primary);
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}
.groq-reset-btn:hover { border-color: #6366f1; color: #6366f1; }

/* ── Change PIN section ─────────────────────────────────── */
.groq-admin-pin-section {
    border: 1px solid var(--color-border-primary);
    border-radius: 10px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.groq-admin-pin-section h3 {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--color-text-secondary);
}
.groq-pin-input {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 12px;
    border: 1px solid var(--color-border-primary);
    border-radius: 7px;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 0.85rem;
    font-family: monospace;
    outline: none;
    transition: border-color 0.2s;
}
.groq-pin-input:focus { border-color: #6366f1; }
.groq-update-pin-btn {
    align-self: flex-start;
    padding: 8px 16px;
    border: 1px solid var(--color-border-primary);
    border-radius: 7px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}
.groq-update-pin-btn:hover { border-color: #6366f1; color: #6366f1; }
.groq-pin-status {
    font-size: 0.78rem;
    min-height: 18px;
    line-height: 1.4;
}
.groq-pin-status.success { color: #10b981; font-weight: 600; }
.groq-pin-status.error   { color: #ef4444; }

/* ── Document tab AI Review slot ─────────────────────────── */
.pi-doc-ai-slot {
    border-left: 3px solid #10b981;
    background: rgba(16,185,129,0.05);
    border-radius: 0 6px 6px 0;
    margin: 0 0 4px 11px;
}
.pi-doc-toolbar .pi-ai-btn { font-size: 0.7rem; padding: 4px 11px; }
.pi-doc-toolbar-progress {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-style: italic;
    align-self: center;
    margin-left: 6px;
}
.pi-doc-toolbar-clear {
    font-size: 0.7rem;
    color: #10b981;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    text-decoration: underline;
    align-self: center;
    margin-left: 4px;
    padding: 0;
}
.pi-doc-intro-output {
    margin: 10px 11px;
    padding: 12px 14px;
    background: rgba(99,102,241,0.05);
    border-left: 3px solid #6366f1;
    border-radius: 0 8px 8px 0;
    font-size: 0.85rem;
    color: var(--color-text-primary);
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
}
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
            if (document.getElementById('groqAiBtn')) return;
            const themeBtn = document.querySelector('button.nav-theme-btn');
            if (!themeBtn) { setTimeout(checkAndAdd, 100); return; }
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
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed','top:0','left:0','width:100%','height:100%',
            'background:rgba(0,0,0,0.8)','z-index:10000',
            'display:flex','align-items:center','justify-content:center',
        ].join(';');
        overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

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

        const title = document.createElement('h3');
        title.textContent = '✨ Groq AI';
        title.style.cssText = 'margin:0 0 6px;font-size:1.1rem;color:var(--color-text-primary);font-weight:700;';
        box.appendChild(title);

        const desc = document.createElement('p');
        desc.style.cssText = 'margin:0 0 22px;font-size:0.82rem;color:var(--color-text-secondary);line-height:1.5;';
        desc.textContent = 'Add your Groq API key to enable AI-powered writing suggestions, meta description generation, and content analysis. Groq inference is free to try.';
        box.appendChild(desc);

        const keyLabel = document.createElement('label');
        keyLabel.textContent = 'API Key';
        keyLabel.style.cssText = 'display:block;font-size:0.78rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:6px;';
        box.appendChild(keyLabel);

        const inputRow = document.createElement('div');
        inputRow.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';

        const keyInput = document.createElement('input');
        keyInput.type        = 'password';
        keyInput.placeholder = 'gsk_…';
        keyInput.autocomplete = 'off';
        keyInput.spellcheck  = false;
        keyInput.style.cssText = [
            'flex:1','padding:9px 12px',
            'border:1px solid var(--color-border-primary)',
            'border-radius:8px','background:var(--color-bg-secondary)',
            'color:var(--color-text-primary)','font-size:0.85rem',
            'font-family:monospace','outline:none','transition:border-color 0.2s',
        ].join(';');
        if (_apiKey) keyInput.value = _apiKey;
        keyInput.onfocus = () => { keyInput.style.borderColor = '#10b981'; };
        keyInput.onblur  = () => { keyInput.style.borderColor = 'var(--color-border-primary)'; };

        const showHideBtn = document.createElement('button');
        showHideBtn.type = 'button';
        showHideBtn.textContent = 'Show';
        showHideBtn.style.cssText = [
            'padding:9px 12px','border:1px solid var(--color-border-primary)',
            'border-radius:8px','background:var(--color-bg-secondary)',
            'color:var(--color-text-secondary)','font-size:0.8rem',
            'cursor:pointer','white-space:nowrap','transition:all 0.2s',
        ].join(';');
        showHideBtn.onclick = () => {
            const isHidden = keyInput.type === 'password';
            keyInput.type           = isHidden ? 'text' : 'password';
            showHideBtn.textContent = isHidden ? 'Hide' : 'Show';
        };

        inputRow.appendChild(keyInput);
        inputRow.appendChild(showHideBtn);
        box.appendChild(inputRow);

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

        const modelLabel = document.createElement('label');
        modelLabel.textContent = 'Model';
        modelLabel.style.cssText = 'display:block;font-size:0.78rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:6px;';
        box.appendChild(modelLabel);

        const modelSelect = document.createElement('select');
        modelSelect.style.cssText = [
            'width:100%','padding:9px 12px',
            'border:1px solid var(--color-border-primary)',
            'border-radius:8px','background:var(--color-bg-secondary)',
            'color:var(--color-text-primary)','font-size:0.85rem',
            'margin-bottom:20px','cursor:pointer','outline:none',
        ].join(';');
        AVAILABLE_MODELS.forEach(m => {
            const opt = document.createElement('option');
            opt.value       = m.id;
            opt.textContent = m.label;
            if (m.id === _model) opt.selected = true;
            modelSelect.appendChild(opt);
        });
        box.appendChild(modelSelect);

        const statusArea = document.createElement('div');
        statusArea.className = 'groq-status-area';
        box.appendChild(statusArea);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;margin-top:16px;';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = 'Save & Test';
        saveBtn.style.cssText = [
            'flex:1','padding:10px 16px','border:none','border-radius:8px',
            'background:#10b981','color:white','font-size:0.88rem',
            'font-weight:600','cursor:pointer','transition:all 0.2s',
        ].join(';');
        saveBtn.onmouseover = () => { if (!saveBtn.disabled) saveBtn.style.background = '#059669'; };
        saveBtn.onmouseout  = () => { if (!saveBtn.disabled) saveBtn.style.background = '#10b981'; };

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = 'Clear key';
        clearBtn.style.cssText = [
            'padding:10px 14px','border:1px solid var(--color-border-primary)',
            'border-radius:8px','background:var(--color-bg-secondary)',
            'color:var(--color-text-secondary)','font-size:0.85rem',
            'cursor:pointer','transition:all 0.2s',
        ].join(';');
        clearBtn.style.display = _apiKey ? 'block' : 'none';
        clearBtn.onmouseover = () => { clearBtn.style.borderColor = '#ef4444'; clearBtn.style.color = '#ef4444'; };
        clearBtn.onmouseout  = () => { clearBtn.style.borderColor = 'var(--color-border-primary)'; clearBtn.style.color = 'var(--color-text-secondary)'; };

        saveBtn.onclick = async () => {
            const key = keyInput.value.trim();
            if (!key) { _setModalStatus(statusArea, 'error', 'Please enter an API key.'); return; }
            saveBtn.disabled = true;
            saveBtn.textContent = 'Testing…';
            _testing = true;
            _updateButtonState();
            _setModalStatus(statusArea, 'testing', '<span class="groq-spinner"></span>Validating key…');
            try {
                await _validateKey(key);
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
        setTimeout(() => { if (!_apiKey) keyInput.focus(); }, 50);
    }

    function _setModalStatus(area, type, html) {
        area.className = 'groq-status-area ' + type;
        area.innerHTML = html;
    }

    // ─── Admin authentication ─────────────────────────────────────────────────

    function _isAdminMode() {
        try {
            return new URLSearchParams(window.location.search).get('admin') === '1';
        } catch (e) { return false; }
    }

    function _onAdminAuthed() {
        try { sessionStorage.setItem(SESSION_KEY_AUTH, 'true'); } catch (e) {}
        _addPromptsNavButton();
    }

    function _addPromptsNavButton() {
        const checkAndAdd = () => {
            if (document.getElementById('groqPromptsBtn')) return;
            const themeBtn = document.querySelector('button.nav-theme-btn');
            if (!themeBtn) { setTimeout(checkAndAdd, 100); return; }
            const btn = document.createElement('button');
            btn.className   = 'nav-btn nav-ai-btn nav-prompts-btn';
            btn.id          = 'groqPromptsBtn';
            btn.textContent = '📋 Prompts';
            btn.title       = 'Admin: Prompt Library';
            btn.onclick     = _showPromptsPanel;
            themeBtn.parentNode.insertBefore(btn, themeBtn);
        };
        checkAndAdd();
    }

    function _showAdminModal() {
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed','top:0','left:0','width:100%','height:100%',
            'background:rgba(0,0,0,0.85)','z-index:10002',
            'display:flex','align-items:center','justify-content:center',
        ].join(';');
        // No overlay click-to-dismiss — gate must be deliberate

        const box = document.createElement('div');
        box.style.cssText = [
            'background:var(--color-bg-primary)',
            'border-radius:12px',
            'padding:32px',
            'max-width:400px',
            'width:90%',
            'box-shadow:0 25px 50px -12px rgba(0,0,0,0.5)',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        ].join(';');

        let hasPIN;
        try { hasPIN = !!localStorage.getItem(STORAGE_KEY_PIN); } catch (e) { hasPIN = false; }

        // Title
        const title = document.createElement('h3');
        title.style.cssText = 'margin:0 0 6px;font-size:1.05rem;font-weight:700;color:var(--color-text-primary);';
        title.textContent = hasPIN ? '🔒 Admin Access' : '🔒 Set Admin PIN';
        box.appendChild(title);

        const sub = document.createElement('p');
        sub.style.cssText = 'margin:0 0 22px;font-size:0.8rem;color:var(--color-text-muted);line-height:1.5;';
        sub.textContent = hasPIN
            ? 'Enter your admin PIN to access the Prompt Library.'
            : 'Choose a PIN to protect admin access. Store it somewhere safe — it cannot be recovered.';
        box.appendChild(sub);

        const statusArea = document.createElement('div');
        statusArea.style.cssText = 'min-height:18px;font-size:0.8rem;margin-bottom:12px;color:#ef4444;';

        if (hasPIN) {
            // ── Enter PIN mode ──
            const pinLabel = document.createElement('label');
            pinLabel.textContent = 'PIN';
            pinLabel.style.cssText = 'display:block;font-size:0.76rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:6px;';
            box.appendChild(pinLabel);

            const pinInput = document.createElement('input');
            pinInput.type        = 'password';
            pinInput.placeholder = '••••';
            pinInput.autocomplete = 'current-password';
            pinInput.style.cssText = [
                'width:100%','box-sizing:border-box','padding:10px 12px',
                'border:1px solid var(--color-border-primary)',
                'border-radius:8px','background:var(--color-bg-secondary)',
                'color:var(--color-text-primary)','font-size:1rem',
                'font-family:monospace','outline:none','margin-bottom:16px',
                'transition:border-color 0.2s',
            ].join(';');
            pinInput.onfocus = () => { pinInput.style.borderColor = '#6366f1'; };
            pinInput.onblur  = () => { pinInput.style.borderColor = 'var(--color-border-primary)'; };
            box.appendChild(pinInput);
            box.appendChild(statusArea);

            const unlockBtn = document.createElement('button');
            unlockBtn.type = 'button';
            unlockBtn.textContent = 'Unlock';
            unlockBtn.style.cssText = [
                'width:100%','padding:11px','border:none','border-radius:8px',
                'background:#6366f1','color:white','font-size:0.9rem',
                'font-weight:600','cursor:pointer','transition:background 0.2s',
                'font-family:inherit',
            ].join(';');
            unlockBtn.onmouseover = () => { unlockBtn.style.background = '#4f46e5'; };
            unlockBtn.onmouseout  = () => { unlockBtn.style.background = '#6366f1'; };
            box.appendChild(unlockBtn);

            const doUnlock = () => {
                let storedPin;
                try { storedPin = localStorage.getItem(STORAGE_KEY_PIN); } catch (e) { storedPin = null; }
                if (pinInput.value === storedPin) {
                    overlay.remove();
                    _onAdminAuthed();
                } else {
                    statusArea.textContent = 'Incorrect PIN. Please try again.';
                    box.classList.add('admin-modal-shake');
                    setTimeout(() => box.classList.remove('admin-modal-shake'), 600);
                    pinInput.value = '';
                    pinInput.focus();
                }
            };

            unlockBtn.onclick = doUnlock;
            pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') doUnlock(); });
            setTimeout(() => pinInput.focus(), 50);

        } else {
            // ── Set PIN mode ──
            const mkField = (labelText, placeholder) => {
                const wrap = document.createElement('div');
                wrap.style.cssText = 'margin-bottom:14px;';
                const lbl = document.createElement('label');
                lbl.textContent = labelText;
                lbl.style.cssText = 'display:block;font-size:0.76rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:6px;';
                const inp = document.createElement('input');
                inp.type        = 'password';
                inp.placeholder = placeholder;
                inp.autocomplete = 'new-password';
                inp.style.cssText = [
                    'width:100%','box-sizing:border-box','padding:10px 12px',
                    'border:1px solid var(--color-border-primary)',
                    'border-radius:8px','background:var(--color-bg-secondary)',
                    'color:var(--color-text-primary)','font-size:1rem',
                    'font-family:monospace','outline:none','transition:border-color 0.2s',
                ].join(';');
                inp.onfocus = () => { inp.style.borderColor = '#6366f1'; };
                inp.onblur  = () => { inp.style.borderColor = 'var(--color-border-primary)'; };
                wrap.appendChild(lbl);
                wrap.appendChild(inp);
                return { wrap, inp };
            };

            const { wrap: w1, inp: newPin }     = mkField('Choose a PIN', 'Choose a PIN');
            const { wrap: w2, inp: confirmPin }  = mkField('Confirm PIN',  'Confirm PIN');
            box.appendChild(w1);
            box.appendChild(w2);
            box.appendChild(statusArea);

            const setBtn = document.createElement('button');
            setBtn.type = 'button';
            setBtn.textContent = 'Set PIN & Continue';
            setBtn.style.cssText = [
                'width:100%','padding:11px','border:none','border-radius:8px',
                'background:#6366f1','color:white','font-size:0.9rem',
                'font-weight:600','cursor:pointer','transition:background 0.2s',
                'font-family:inherit',
            ].join(';');
            setBtn.onmouseover = () => { setBtn.style.background = '#4f46e5'; };
            setBtn.onmouseout  = () => { setBtn.style.background = '#6366f1'; };
            box.appendChild(setBtn);

            const doSet = () => {
                if (!newPin.value) {
                    statusArea.textContent = 'Please choose a PIN.';
                    newPin.focus();
                    return;
                }
                if (newPin.value !== confirmPin.value) {
                    statusArea.textContent = 'PINs do not match. Please try again.';
                    box.classList.add('admin-modal-shake');
                    setTimeout(() => box.classList.remove('admin-modal-shake'), 600);
                    confirmPin.value = '';
                    confirmPin.focus();
                    return;
                }
                try { localStorage.setItem(STORAGE_KEY_PIN, newPin.value); } catch (e) {}
                overlay.remove();
                _onAdminAuthed();
            };

            setBtn.onclick = doSet;
            setTimeout(() => newPin.focus(), 50);
        }

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // ─── Prompt Library panel ─────────────────────────────────────────────────

    function _flashSuccess(btn, text) {
        const orig = btn.textContent;
        btn.textContent = text;
        btn.disabled = true;
        setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1600);
    }

    function _tokenEst(text) {
        return '~' + Math.round(text.length / 4) + ' tokens';
    }

    function _buildPromptCard(key, meta) {
        const card = document.createElement('div');
        card.className = 'groq-prompt-card';

        const h3 = document.createElement('h3');
        h3.textContent = meta.name;
        card.appendChild(h3);

        const desc = document.createElement('p');
        desc.className   = 'groq-prompt-desc';
        desc.textContent = meta.description;
        card.appendChild(desc);

        const current = _getPrompt(key);

        // System prompt
        const sysLabel = document.createElement('label');
        sysLabel.className   = 'groq-prompt-label';
        sysLabel.textContent = 'System prompt';
        card.appendChild(sysLabel);

        const sysTa = document.createElement('textarea');
        sysTa.className = 'groq-prompt-ta';
        sysTa.rows      = 5;
        sysTa.value     = current.system;
        card.appendChild(sysTa);

        const sysEst = document.createElement('div');
        sysEst.className   = 'groq-token-estimate';
        sysEst.textContent = _tokenEst(sysTa.value);
        card.appendChild(sysEst);
        sysTa.addEventListener('input', () => { sysEst.textContent = _tokenEst(sysTa.value); });

        // User message prefix
        const preLabel = document.createElement('label');
        preLabel.className   = 'groq-prompt-label';
        preLabel.textContent = 'User message prefix';
        card.appendChild(preLabel);

        const preTa = document.createElement('textarea');
        preTa.className = 'groq-prompt-ta';
        preTa.rows      = 2;
        preTa.value     = current.userPrefix;
        card.appendChild(preTa);

        const preEst = document.createElement('div');
        preEst.className   = 'groq-token-estimate';
        preEst.textContent = _tokenEst(preTa.value);
        card.appendChild(preEst);
        preTa.addEventListener('input', () => { preEst.textContent = _tokenEst(preTa.value); });

        // Buttons
        const btnRow = document.createElement('div');
        btnRow.className = 'groq-prompt-btn-row';

        const saveBtn = document.createElement('button');
        saveBtn.className   = 'groq-save-btn';
        saveBtn.textContent = 'Save';
        saveBtn.onclick = () => {
            try {
                const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_PROMPTS) || '{}');
                stored[key] = { system: sysTa.value, userPrefix: preTa.value };
                localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(stored));
                _flashSuccess(saveBtn, 'Saved ✓');
            } catch (e) {
                saveBtn.textContent = 'Error saving';
            }
        };

        const resetBtn = document.createElement('button');
        resetBtn.className   = 'groq-reset-btn';
        resetBtn.textContent = 'Reset to default';
        resetBtn.onclick = () => {
            const def = DEFAULT_PROMPTS[key];
            sysTa.value = def.system;
            preTa.value = def.userPrefix;
            sysTa.dispatchEvent(new Event('input'));
            preTa.dispatchEvent(new Event('input'));
            try {
                const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_PROMPTS) || '{}');
                delete stored[key];
                localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(stored));
                _flashSuccess(resetBtn, 'Reset ✓');
            } catch (e) {}
        };

        btnRow.appendChild(saveBtn);
        btnRow.appendChild(resetBtn);
        card.appendChild(btnRow);

        return card;
    }

    function _buildChangePinSection() {
        const section = document.createElement('div');
        section.className = 'groq-admin-pin-section';

        const h3 = document.createElement('h3');
        h3.textContent = '🔑 Change admin PIN';
        section.appendChild(h3);

        const mkPinInput = placeholder => {
            const inp = document.createElement('input');
            inp.type        = 'password';
            inp.placeholder = placeholder;
            inp.className   = 'groq-pin-input';
            inp.autocomplete = 'new-password';
            inp.onfocus = () => { inp.style.borderColor = '#6366f1'; };
            inp.onblur  = () => { inp.style.borderColor = 'var(--color-border-primary)'; };
            return inp;
        };

        const curPin  = mkPinInput('Current PIN');
        const newPin  = mkPinInput('New PIN');
        const confPin = mkPinInput('Confirm new PIN');
        section.appendChild(curPin);
        section.appendChild(newPin);
        section.appendChild(confPin);

        const updateBtn = document.createElement('button');
        updateBtn.className   = 'groq-update-pin-btn';
        updateBtn.textContent = 'Update PIN';
        section.appendChild(updateBtn);

        const status = document.createElement('div');
        status.className = 'groq-pin-status';
        section.appendChild(status);

        updateBtn.onclick = () => {
            status.className   = 'groq-pin-status';
            status.textContent = '';
            let storedPin;
            try { storedPin = localStorage.getItem(STORAGE_KEY_PIN); } catch (e) { storedPin = null; }

            if (curPin.value !== storedPin) {
                status.className   = 'groq-pin-status error';
                status.textContent = 'Current PIN is incorrect.';
                curPin.value = '';
                curPin.focus();
                return;
            }
            if (!newPin.value) {
                status.className   = 'groq-pin-status error';
                status.textContent = 'New PIN cannot be empty.';
                newPin.focus();
                return;
            }
            if (newPin.value !== confPin.value) {
                status.className   = 'groq-pin-status error';
                status.textContent = 'New PINs do not match.';
                confPin.value = '';
                confPin.focus();
                return;
            }
            try { localStorage.setItem(STORAGE_KEY_PIN, newPin.value); } catch (e) {}
            curPin.value = '';
            newPin.value = '';
            confPin.value = '';
            status.className   = 'groq-pin-status success';
            status.textContent = '✓ PIN updated successfully.';
        };

        return section;
    }

    function _showPromptsPanel() {
        // Re-open if already in DOM
        const existing = document.getElementById('groqPromptsPanel');
        if (existing) {
            existing.classList.add('active');
            return;
        }

        const panel = document.createElement('div');
        panel.className = 'groq-prompts-panel';
        panel.id        = 'groqPromptsPanel';

        // Header
        const header = document.createElement('div');
        header.className = 'groq-prompts-header';

        const headerTitle = document.createElement('h2');
        headerTitle.textContent = '📋 Prompt Library';
        header.appendChild(headerTitle);

        const closeBtn = document.createElement('button');
        closeBtn.className   = 'groq-prompts-close';
        closeBtn.textContent = '×';
        closeBtn.title       = 'Close';
        closeBtn.onclick = () => panel.classList.remove('active');
        header.appendChild(closeBtn);

        panel.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'groq-prompts-body';

        PROMPT_META.forEach(meta => {
            body.appendChild(_buildPromptCard(meta.key, meta));
        });

        body.appendChild(_buildChangePinSection());
        panel.appendChild(body);
        document.body.appendChild(panel);

        // Slide in after paint
        requestAnimationFrame(() => {
            requestAnimationFrame(() => panel.classList.add('active'));
        });

        // Close on Escape
        const onKey = e => {
            if (e.key === 'Escape' && panel.classList.contains('active')) {
                panel.classList.remove('active');
            }
        };
        document.addEventListener('keydown', onKey);
        // Clean up listener if panel is ever removed
        panel.addEventListener('transitionend', () => {
            if (!panel.classList.contains('active') && !document.body.contains(panel)) {
                document.removeEventListener('keydown', onKey);
            }
        });
    }

    // ─── Initialisation ───────────────────────────────────────────────────────

    function _init() {
        _loadFromStorage();
        _injectStyles();
        _addNavButton();

        if (_isAdminMode()) {
            let authed = false;
            try { authed = sessionStorage.getItem(SESSION_KEY_AUTH) === 'true'; } catch (e) {}
            if (authed) {
                _addPromptsNavButton();
            } else {
                _showAdminModal();
            }
        }

        console.log('✨ Groq AI module loaded');
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    window.GroqAI = {
        complete,
        stream,
        isConfigured: () => !!_apiKey,
        getModel:     () => _model,
        showSettings: _showSettingsModal,
        getPrompt:    _getPrompt,
        debug: {
            getStatus:      () => ({ hasKey: !!_apiKey, model: _model, testing: _testing }),
            clearKey:       () => { _apiKey = null; _clearStorage(); _updateButtonState(); },
            isAdminAuthed:  () => { try { return sessionStorage.getItem(SESSION_KEY_AUTH) === 'true'; } catch(e) { return false; } },
            clearAdminAuth: () => { try { sessionStorage.removeItem(SESSION_KEY_AUTH); } catch(e) {} },
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

})();
