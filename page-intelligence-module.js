// page-intelligence-module.js
// Content Intelligence: fetches page HTML via CORS proxy and extracts
// readability, word count, heading structure, meta, images, links, schema.

(function() {
    'use strict';

    const cache = new Map();            // url → { data, fetchedAt }
    const pendingRequests = new Map();  // url → Promise (deduplication)
    const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes

    const GENERIC_ANCHOR_TEXTS = new Set(['click here','here','read more','more','link',
        'this','learn more','click','visit','see more']);

    // Issue pill metadata — color-coded to match the Document overlay system
    const AI_ISSUE_OPTS = {
        'long-sentences': { label: 'Long sentence',   color: '#dc2626', bg: 'rgba(220,38,38,0.09)',  border: 'rgba(220,38,38,0.3)'  },
        'passive-voice':  { label: 'Passive voice',   color: '#f97316', bg: 'rgba(249,115,22,0.09)', border: 'rgba(249,115,22,0.3)' },
        'meta-desc':      { label: 'Meta description',color: '#0891b2', bg: 'rgba(8,145,178,0.09)',  border: 'rgba(8,145,178,0.3)'  },
        'title-tag':      { label: 'Title tag',        color: '#6366f1', bg: 'rgba(99,102,241,0.09)', border: 'rgba(99,102,241,0.3)' },
        'weak-anchors':   { label: 'Anchor text',      color: '#10b981', bg: 'rgba(16,185,129,0.09)', border: 'rgba(16,185,129,0.3)' },
        'h2-headings':    { label: 'H2 heading',       color: '#7c3aed', bg: 'rgba(124,58,237,0.09)', border: 'rgba(124,58,237,0.3)' },
        'hedge-words':    { label: 'Hedge word',       color: '#ca8a04', bg: 'rgba(202,138,4,0.09)',  border: 'rgba(202,138,4,0.3)'  },
        'nominalisations':{ label: 'Nominalisation',   color: '#ea580c', bg: 'rgba(234,88,12,0.09)',  border: 'rgba(234,88,12,0.3)'  },
        'search-intent':  { label: 'Content gap',      color: '#0891b2', bg: 'rgba(8,145,178,0.09)',  border: 'rgba(8,145,178,0.3)'  },
        'page-intro':     { label: 'Page intro',        color: '#6366f1', bg: 'rgba(99,102,241,0.09)', border: 'rgba(99,102,241,0.3)' },
    };

    const _linkStatusCache = new Map(); // fullUrl → { status: number|null, checkedAt: number }
    const LINK_STATUS_TTL = 10 * 60 * 1000; // 10 minutes

    // Shared AI results cache — keyed by promptKey → { [index]: text }
    // Cleared at the start of each new analysis so stale results never bleed across URLs.
    var _aiResultsCache = {};

    function _cacheAIResult(key, index, text) {
        if (!_aiResultsCache[key]) _aiResultsCache[key] = {};
        _aiResultsCache[key][index] = text;
    }
    function _getCachedAIResult(key, index) {
        return (_aiResultsCache[key] && _aiResultsCache[key][index]) || null;
    }

    // Same proxy list as index.html sitemap fetcher
    const CORS_PROXIES = [
        url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        url => `https://cors.bridged.cc/${url}`,
        url => `https://cors-anywhere.herokuapp.com/${url}`
    ];

    async function fetchViaProxy(url) {
        for (const proxyFn of CORS_PROXIES) {
            try {
                const proxyUrl = proxyFn(url);
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 9000);
                let response;
                try {
                    response = await fetch(proxyUrl, { signal: controller.signal });
                } finally {
                    clearTimeout(timer);
                }
                if (!response.ok) continue;
                let text = await response.text();
                // allorigins wraps content in JSON
                if (proxyUrl.includes('allorigins.win')) {
                    try { text = JSON.parse(text).contents || text; } catch (e) {}
                }
                if (text && text.trim().length > 200) return text;
            } catch (e) {
                // try next proxy
            }
        }
        throw new Error('All proxies failed — page may block external requests.');
    }

    // Ordered list of strategies for checking link status.
    // corsproxy.io passes the target's HTTP status directly in response.status.
    // allorigins wraps it in JSON { status: { http_code: N } }.
    const _linkCheckStrategies = [
        async (url, signal) => {
            const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, { signal });
            // corsproxy returns the target status as the HTTP response status
            return r.status >= 100 ? r.status : null;
        },
        async (url, signal) => {
            const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal });
            if (!r.ok) throw new Error('allorigins itself errored');
            const json = await r.json();
            const code = json && json.status && json.status.http_code;
            return typeof code === 'number' && code >= 100 ? code : null;
        },
    ];

    async function checkLinkStatus(url) {
        const cached = _linkStatusCache.get(url);
        if (cached && (Date.now() - cached.checkedAt) < LINK_STATUS_TTL) return cached.status;

        for (const strategy of _linkCheckStrategies) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 7000);
                let status;
                try {
                    status = await strategy(url, controller.signal);
                } finally { clearTimeout(timer); }
                if (status !== null) {
                    _linkStatusCache.set(url, { status, checkedAt: Date.now() });
                    return status;
                }
            } catch (e) { /* try next strategy */ }
        }

        _linkStatusCache.set(url, { status: null, checkedAt: Date.now() });
        return null;
    }

    // Datamuse synonym cache: word → ['alt1', 'alt2', ...] | null (fetch attempted, nothing useful)
    const _datamuseCache = new Map();

    async function _fetchDatamuseSyns(word) {
        if (_datamuseCache.has(word)) return _datamuseCache.get(word);
        try {
            const res = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=5`, { signal: AbortSignal.timeout(4000) });
            if (!res.ok) throw new Error('bad response');
            const json = await res.json();
            const alts = json.map(r => r.word).filter(w => w && w !== word).slice(0, 4);
            const result = alts.length ? alts : null;
            _datamuseCache.set(word, result);
            return result;
        } catch (e) {
            _datamuseCache.set(word, null);
            return null;
        }
    }

    // Plain-language alternatives for common complex words (UK English)
    const PLAIN_ALTS = {
        'accommodate': ['fit', 'house', 'include'],
        'accordingly': ['so', 'therefore'],
        'acknowledgement': ['thanks', 'receipt'],
        'acknowledgment': ['thanks', 'receipt'],
        'acquaint': ['tell', 'inform'],
        'additional': ['extra', 'more', 'added'],
        'administer': ['run', 'manage', 'handle'],
        'administration': ['running', 'managing'],
        'advantageous': ['helpful', 'useful'],
        'aforementioned': ['the above', 'noted', 'earlier'],
        'aggregate': ['total', 'combined', 'overall'],
        'allocate': ['give', 'assign', 'share out'],
        'allocation': ['share', 'amount', 'portion'],
        'alternative': ['other', 'choice', 'option'],
        'amendment': ['change', 'update', 'revision'],
        'annually': ['each year', 'yearly'],
        'anticipate': ['expect', 'plan for', 'foresee'],
        'applicable': ['relevant', 'that applies'],
        'application': ['form', 'request'],
        'approximately': ['about', 'around'],
        'ascertain': ['find out', 'check', 'confirm'],
        'assessment': ['review', 'check', 'test'],
        'assistance': ['help', 'support'],
        'authorisation': ['approval', 'permission'],
        'authorization': ['approval', 'permission'],
        'authorise': ['allow', 'approve', 'permit'],
        'authorize': ['allow', 'approve', 'permit'],
        'authorities': ['bodies', 'agencies'],
        'authority': ['power', 'right', 'body'],
        'beneficial': ['helpful', 'useful', 'good'],
        'beneficiary': ['claimant', 'recipient'],
        'calculate': ['work out', 'find'],
        'capability': ['ability', 'skill'],
        'categorise': ['group', 'sort', 'classify'],
        'categorize': ['group', 'sort', 'classify'],
        'category': ['group', 'type', 'class'],
        'cease': ['stop', 'end', 'halt'],
        'circumstances': ['situation', 'case'],
        'clarification': ['explanation', 'clarity'],
        'clarify': ['explain', 'make clear'],
        'commence': ['start', 'begin'],
        'commencement': ['start', 'beginning'],
        'communicate': ['tell', 'contact', 'write'],
        'community': ['people', 'area', 'local'],
        'compliance': ['following the rules', 'meeting rules'],
        'compliant': ['following the rules', 'meeting requirements'],
        'comply': ['follow', 'meet', 'obey'],
        'compulsory': ['required', 'must'],
        'comprehensive': ['full', 'complete', 'thorough'],
        'concurrently': ['at the same time', 'together'],
        'confidential': ['private', 'secret'],
        'confirmation': ['proof', 'agreement'],
        'consequence': ['result', 'outcome', 'effect'],
        'consequently': ['so', 'as a result', 'therefore'],
        'considerable': ['large', 'great', 'much'],
        'considerably': ['much', 'greatly', 'a lot'],
        'consideration': ['thought', 'care', 'review'],
        'constitute': ['make up', 'form', 'be'],
        'consultation': ['discussion', 'advice', 'input'],
        'contravene': ['break', 'go against', 'breach'],
        'contribution': ['payment', 'input', 'share'],
        'convey': ['send', 'tell', 'pass on'],
        'correspondence': ['letters', 'emails', 'contact'],
        'criteria': ['conditions', 'rules', 'requirements'],
        'criterion': ['condition', 'rule', 'requirement'],
        'currently': ['now', 'at present'],
        'declaration': ['statement', 'claim'],
        'deem': ['treat as', 'consider', 'regard as'],
        'deemed': ['treated as', 'considered', 'regarded as'],
        'demonstrate': ['show', 'prove'],
        'department': ['office', 'team'],
        'designated': ['named', 'set', 'appointed'],
        'determination': ['decision', 'finding', 'ruling'],
        'determine': ['decide', 'find out', 'set'],
        'development': ['growth', 'change', 'progress'],
        'disburse': ['pay out', 'distribute', 'pay'],
        'disbursement': ['payment', 'payout'],
        'disclose': ['share', 'reveal', 'tell'],
        'disclosure': ['sharing', 'revealing', 'telling'],
        'discontinue': ['stop', 'end'],
        'discretion': ['judgement', 'choice'],
        'disseminate': ['share', 'spread', 'distribute'],
        'documentation': ['papers', 'records', 'forms'],
        'eligible': ['can apply', 'entitled', 'qualify'],
        'eligibility': ['who can apply'],
        'employment': ['work', 'job'],
        'endeavour': ['try', 'attempt'],
        'enquire': ['ask', 'check', 'contact'],
        'enquiry': ['question', 'request'],
        'ensure': ['make sure', 'check'],
        'entitlement': ['right', 'benefit', 'what you can get'],
        'environmental': ['nature', 'eco'],
        'equivalent': ['equal', 'same', 'matching'],
        'establishment': ['setting up', 'creating'],
        'evaluation': ['review', 'check', 'assessment'],
        'evidence': ['proof', 'documents'],
        'exceed': ['go over', 'be more than'],
        'exceptional': ['unusual', 'special', 'rare'],
        'exempt': ['free from', 'excluded', 'not subject to'],
        'exemption': ['exception', 'exclusion', 'relief'],
        'expedite': ['speed up', 'fast-track'],
        'expenditure': ['spending', 'costs', 'outgoings'],
        'explanation': ['reason', 'answer'],
        'expertise': ['skill', 'knowledge', 'know-how'],
        'facilitate': ['help', 'allow', 'enable'],
        'financial': ['money', 'cost'],
        'forthwith': ['at once', 'now', 'immediately'],
        'framework': ['system', 'structure', 'plan'],
        'frequently': ['often'],
        'fundamental': ['key', 'basic', 'main'],
        'furthermore': ['also', 'in addition'],
        'generally': ['usually', 'mostly'],
        'governance': ['oversight', 'management', 'control'],
        'government': ['state', 'public'],
        'guideline': ['rule', 'advice', 'guide'],
        'guidelines': ['rules', 'advice', 'guidance'],
        'hardship': ['difficulty', 'struggle', 'need'],
        'identify': ['find', 'name', 'spot'],
        'immediately': ['now', 'right away', 'at once'],
        'impact': ['effect', 'result', 'change'],
        'implement': ['do', 'carry out', 'use'],
        'implementation': ['doing', 'carrying out'],
        'important': ['key', 'vital', 'main'],
        'incorporate': ['include', 'add', 'bring in'],
        'indicate': ['show', 'mean', 'suggest'],
        'indication': ['sign', 'hint'],
        'individual': ['person', 'you', 'someone'],
        'ineligible': ['cannot apply', 'excluded', 'not eligible'],
        'information': ['details', 'facts', 'news'],
        'initially': ['at first', 'to start', 'first'],
        'initiate': ['start', 'begin'],
        'insufficient': ['not enough', 'lacking', 'too little'],
        'integral': ['key', 'essential', 'central'],
        'interim': ['temporary', 'short-term', 'for now'],
        'investigation': ['look into', 'check', 'review'],
        'jurisdiction': ['area', 'authority', 'remit'],
        'legislation': ['law', 'rules', 'act'],
        'levy': ['charge', 'tax', 'fee'],
        'liable': ['responsible', 'at risk', 'subject to'],
        'liaise': ['work with', 'contact', 'coordinate'],
        'lodge': ['file', 'submit', 'send in'],
        'maintenance': ['upkeep', 'support', 'care'],
        'majority': ['most'],
        'mandatory': ['required', 'must'],
        'maximum': ['most', 'top', 'up to'],
        'methodology': ['method', 'approach', 'way'],
        'minimum': ['least', 'at least'],
        'mitigate': ['reduce', 'lessen', 'ease'],
        'modification': ['change', 'update'],
        'monitor': ['check', 'track', 'watch'],
        'notwithstanding': ['despite', 'even if', 'regardless'],
        'notification': ['notice', 'alert', 'message'],
        'notify': ['tell', 'inform', 'let know'],
        'obligation': ['duty', 'responsibility', 'must'],
        'obligations': ['duties', 'responsibilities', 'rules'],
        'obtain': ['get', 'receive'],
        'occasionally': ['sometimes', 'at times'],
        'organisation': ['group', 'body', 'agency'],
        'organisations': ['groups', 'bodies', 'agencies'],
        'outcome': ['result', 'effect', 'end'],
        'overview': ['summary', 'outline'],
        'participate': ['take part', 'join in'],
        'participation': ['involvement', 'taking part'],
        'particularly': ['especially', 'mainly'],
        'payable': ['owed', 'due', 'to be paid'],
        'penalty': ['fine', 'charge', 'punishment'],
        'percentage': ['share', 'rate', 'portion'],
        'periodically': ['from time to time', 'regularly'],
        'permit': ['allow', 'let', 'approve'],
        'personnel': ['staff', 'workers', 'people'],
        'population': ['people'],
        'prescribed': ['set', 'required', 'specified'],
        'previously': ['before', 'earlier'],
        'principal': ['main', 'key', 'chief'],
        'prior': ['before', 'earlier', 'previous'],
        'prioritise': ['focus on', 'put first'],
        'prioritize': ['focus on', 'put first'],
        'priority': ['main aim', 'focus', 'first task'],
        'proceed': ['go ahead', 'continue', 'carry on'],
        'procedure': ['process', 'steps', 'way'],
        'professional': ['skilled', 'trained', 'expert'],
        'prohibit': ['ban', 'stop', 'not allow'],
        'proportionate': ['fair', 'in line with', 'balanced'],
        'provide': ['give', 'offer', 'supply'],
        'provision': ['supply', 'giving', 'rule'],
        'pursuant': ['under', 'following', 'in line with'],
        'qualification': ['skill', 'training', 'certificate'],
        'qualifications': ['skills', 'training', 'certificates'],
        'reasonable': ['fair', 'sensible', 'right'],
        'reassessment': ['review', 'recheck', 'reconsideration'],
        'recipient': ['person who gets', 'claimant'],
        'reconsider': ['think again', 'review', 'look again'],
        'rectify': ['fix', 'correct', 'put right'],
        'refer': ['send', 'direct', 'point to'],
        'register': ['sign up', 'enrol', 'record'],
        'reimburse': ['repay', 'pay back', 'refund'],
        'reimbursement': ['repayment', 'refund'],
        'relevant': ['related', 'about', 'fitting'],
        'remit': ['area', 'responsibility', 'scope'],
        'remuneration': ['pay', 'wages', 'salary'],
        'renewal': ['extension', 'update', 'continuation'],
        'repeal': ['cancel', 'end', 'remove'],
        'require': ['need', 'must have'],
        'requirement': ['need', 'rule', 'must'],
        'requirements': ['needs', 'rules'],
        'reside': ['live', 'stay', 'be based'],
        'residence': ['home', 'address', 'where you live'],
        'residency': ['living there', 'home status'],
        'residential': ['home', 'housing', 'living'],
        'resolution': ['solution', 'answer', 'fix'],
        'resolve': ['fix', 'settle', 'sort out'],
        'resources': ['money', 'staff', 'tools'],
        'responsibility': ['duty', 'role', 'job'],
        'retrospective': ['backdated', 'going back', 'past'],
        'revoke': ['cancel', 'end', 'take away'],
        'schedule': ['plan', 'timetable', 'list'],
        'scrutinise': ['examine', 'check carefully', 'review closely'],
        'scrutinize': ['examine', 'check carefully', 'review closely'],
        'significant': ['important', 'major', 'notable'],
        'significantly': ['greatly', 'much', 'notably'],
        'specifically': ['in particular', 'namely'],
        'specify': ['state', 'set out', 'name'],
        'stakeholder': ['partner', 'people involved'],
        'standardise': ['unify', 'make uniform', 'set rules for'],
        'standardize': ['unify', 'make uniform', 'set rules for'],
        'statute': ['law', 'act', 'legislation'],
        'statutory': ['legal', 'by law', 'required by law'],
        'subsequently': ['then', 'after', 'later'],
        'subsidy': ['grant', 'payment', 'support'],
        'submission': ['application', 'filing', 'sending'],
        'submit': ['send', 'apply', 'file'],
        'substantial': ['large', 'major', 'big'],
        'substantially': ['largely', 'mostly', 'mainly'],
        'sufficient': ['enough'],
        'summarise': ['sum up', 'outline', 'recap'],
        'summarize': ['sum up', 'outline', 'recap'],
        'supersede': ['replace', 'take over from'],
        'supplementary': ['extra', 'added', 'more'],
        'suspend': ['pause', 'stop', 'hold'],
        'suspension': ['pause', 'stop', 'hold'],
        'terminate': ['end', 'stop', 'close'],
        'termination': ['end', 'stop', 'closing'],
        'thereof': ['of it', 'of that'],
        'threshold': ['limit', 'level', 'point'],
        'timely': ['on time', 'prompt', 'quick'],
        'transition': ['change', 'move', 'shift'],
        'transparency': ['openness', 'clarity'],
        'transparent': ['open', 'clear', 'honest'],
        'undertaken': ['done', 'carried out'],
        'unnecessary': ['not needed', 'extra'],
        'utilisation': ['use', 'using'],
        'utilization': ['use', 'using'],
        'utilise': ['use'],
        'utilize': ['use'],
        'validate': ['confirm', 'check', 'prove'],
        'validity': ['correctness', 'standing', 'proof'],
        'various': ['many', 'different', 'several'],
        'verification': ['check', 'proof', 'confirm'],
        'voluntary': ['optional', 'by choice'],
        'vulnerable': ['at risk', 'in need'],
        'waive': ['give up', 'drop', 'set aside'],
        'waiver': ['exemption', 'giving up', 'dropping'],
        'withdraw': ['take back', 'cancel', 'remove'],
        'withdrawal': ['cancellation', 'taking back', 'removal'],
    };

    // Estimate syllable count via vowel-group approximation (accurate enough for FK scoring)
    function countSyllables(word) {
        word = word.toLowerCase().replace(/[^a-z]/g, '');
        if (!word) return 0;
        if (word.length <= 3) return 1;
        word = word.replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, '');
        word = word.replace(/^y/, '');
        const m = word.match(/[aeiouy]{1,2}/g);
        return m ? m.length : 1;
    }

    // Flesch-Kincaid Reading Ease
    // 90–100 Very Easy | 70–89 Easy | 60–69 Plain English | 50–59 Fairly Difficult | <50 Hard
    function fleschKincaidFull(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
        const words = text.split(/\s+/).filter(w => w.trim().length > 0);
        if (words.length < 10 || sentences.length < 1) return null;
        const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
        const avgSentenceLength = Math.round(words.length / sentences.length);
        const avgSyllablesPerWord = parseFloat((totalSyllables / words.length).toFixed(1));
        const score = 206.835
            - (1.015 * (words.length / sentences.length))
            - (84.6 * (totalSyllables / words.length));
        // Collect sentences over 20 words (capped at 5 for tooltip; full list for report)
        const _longAll = sentences
            .map(s => s.trim())
            .filter(s => s.split(/\s+/).filter(w => w.length > 0).length > 20);
        const longSentences = _longAll.slice(0, 5);
        const longSentencesAll = _longAll;
        const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
        return { score: Math.round(Math.min(100, Math.max(0, score))), avgSentenceLength, avgSyllablesPerWord, longSentences, longSentencesAll, sentenceLengths,
                 sentences: sentences.map(s => s.trim()) };
    }

    const TRANSITION_PATTERN = /\b(however|therefore|furthermore|moreover|nevertheless|consequently|additionally|alternatively|meanwhile|subsequently|accordingly|thus|hence|otherwise|nonetheless|also|finally|lastly|for example|for instance|in addition|as a result|in contrast|on the other hand|in other words|in summary|to summarise|to conclude|in conclusion|first|second|third)\b/gi;

    // Words ending in -ly that are NOT adverbs (verbs, nouns, adjectives)
    const NON_ADVERB_LY = new Set([
        // verbs ending in -ply/-ly
        'apply', 'reply', 'comply', 'supply', 'imply', 'multiply',
        // nouns ending in -ly
        'family', 'assembly', 'cavalry', 'colony', 'destiny', 'economy',
        'harmony', 'irony', 'journey', 'mercury', 'ministry', 'mystery',
        'penalty', 'recovery', 'remedy', 'tragedy', 'treasury', 'victory',
        'monopoly', 'melancholy', 'anomaly', 'ceremony',
        // nouns (also verbs) ending in -ly
        'bully', 'belly', 'jelly', 'rally', 'tally', 'valley', 'ally',
        // adjectives-only (not adverb-forming)
        'ugly', 'holy', 'lonely', 'lovely', 'friendly', 'lively', 'early',
        'elderly', 'likely', 'unlikely', 'costly', 'deadly', 'timely',
        'orderly', 'scholarly', 'silly', 'worldly', 'leisurely', 'cowardly',
        'brotherly', 'motherly', 'fatherly', 'sisterly', 'ghostly', 'earthly',
        'heavenly',
        // compound nouns
        'butterfly', 'dragonfly', 'mayfly', 'horsefly', 'gadfly', 'firefly',
        'housefly', 'fruitfly',
        // ambiguous (determiner/adjective more often than adverb in practice)
        'only',
        // transition discourse connectors (already tracked by Transitions overlay)
        'additionally', 'alternatively', 'consequently', 'subsequently',
        'accordingly', 'finally', 'lastly',
    ]);

    // Nouns that follow adjective-use -ly words (e.g. "friendly service", "early access")
    const COMMON_NOUNS = new Set([
        'service', 'services', 'policy', 'policies', 'decision', 'decisions',
        'result', 'results', 'outcome', 'outcomes', 'issue', 'issues',
        'problem', 'problems', 'approach', 'system', 'systems', 'process',
        'processes', 'method', 'methods', 'solution', 'solutions', 'plan',
        'plans', 'strategy', 'strategies', 'team', 'staff', 'support',
        'information', 'guidance', 'access', 'option', 'options', 'case',
        'cases', 'example', 'examples', 'stage', 'stages', 'step', 'steps',
        'action', 'actions', 'change', 'changes', 'rate', 'rates', 'level',
        'levels', 'number', 'numbers', 'amount', 'amounts', 'period',
        'periods', 'date', 'dates', 'time', 'times', 'way', 'ways',
        'type', 'types', 'form', 'forms', 'rule', 'rules', 'requirement',
        'requirements', 'condition', 'conditions', 'part', 'parts',
    ]);

    function analyseWritingStyle(bodyText, wordCount) {
        const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 3);
        const totalSentences = sentences.length;
        const words = bodyText.match(/[a-zA-Z]+/g) || [];

        // --- Passive voice ---
        const passiveRegular = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/i;
        const passiveIrregular = /\b(is|are|was|were|be|been|being)\s+(written|taken|given|made|found|known|shown|seen|done|gone|chosen|broken|spoken|forgotten|hidden|driven|risen|built|brought|caught|drawn|fallen|felt|fought|gotten|held|kept|laid|led|left|lost|meant|met|paid|put|said|sent|set|shut|slept|spent|stood|stuck|struck|swept|taught|thought|thrown|told|understood|won|worn)\b/i;
        const passiveSentences = sentences.filter(s => passiveRegular.test(s) || passiveIrregular.test(s));
        const passiveSentenceCount = passiveSentences.length;
        const passiveSentenceExamples = passiveSentences.slice(0, 5).map(s => s.trim());
        const passiveSentenceExamplesAll = passiveSentences.map(s => s.trim());

        // --- Complex words (3+ syllables, Gunning Fog signal) ---
        const complexWordCount = words.filter(w => countSyllables(w) >= 3).length;
        const complexWordPct = wordCount > 0 ? parseFloat((complexWordCount / wordCount * 100).toFixed(1)) : 0;
        const complexWordMap = new Map();
        words.forEach(w => {
            const clean = w.toLowerCase();
            if (complexWordMap.has(clean)) return;
            const syl = countSyllables(clean);
            if (syl >= 3) complexWordMap.set(clean, syl);
        });
        const _complexSorted = [...complexWordMap.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const complexWordList = _complexSorted.slice(0, 15).map(e => e[0]);
        const complexWordListAll = _complexSorted.map(e => e[0]);

        // --- Direct address ---
        const youYourCount = words.filter(w => /^(you|your|yours|yourself)$/i.test(w)).length;
        const directAddressRate = wordCount > 0 ? parseFloat((youYourCount / wordCount * 100).toFixed(1)) : 0;

        // --- Contractions ---
        const contractionPattern = /\b(don't|can't|won't|isn't|aren't|it's|I'm|you're|they're|we're|I've|you've|they've|we've|I'd|you'd|they'd|we'd|I'll|you'll|they'll|we'll|that's|there's|here's|what's|who's|couldn't|wouldn't|shouldn't|didn't|doesn't|hadn't|hasn't|haven't|mustn't|needn't|shan't|wasn't|weren't)\b/gi;
        const contractionCount = (bodyText.match(contractionPattern) || []).length;

        // --- Nominalisations ---
        const nominalisationDefs = [
            { re: /\bmake a decision\b/gi,            suggest: 'decide' },
            { re: /\bmake decisions\b/gi,              suggest: 'decide' },
            { re: /\bprovide assistance\b/gi,          suggest: 'help' },
            { re: /\bgive assistance\b/gi,             suggest: 'help' },
            { re: /\bgive consideration to\b/gi,       suggest: 'consider' },
            { re: /\btake into consideration\b/gi,     suggest: 'consider' },
            { re: /\bin order to\b/gi,                 suggest: 'to' },
            { re: /\bwith a view to\b/gi,              suggest: 'to' },
            { re: /\bin the event that\b/gi,           suggest: 'if' },
            { re: /\bin the event of\b/gi,             suggest: 'if' },
            { re: /\bat this point in time\b/gi,       suggest: 'now' },
            { re: /\bis required to\b/gi,              suggest: 'must' },
            { re: /\bare required to\b/gi,             suggest: 'must' },
            { re: /\bhas the ability to\b/gi,          suggest: 'can' },
            { re: /\bhave the ability to\b/gi,         suggest: 'can' },
            { re: /\bis able to\b/gi,                  suggest: 'can' },
            { re: /\bare able to\b/gi,                 suggest: 'can' },
            { re: /\bdue to the fact that\b/gi,        suggest: 'because' },
            { re: /\bin view of the fact that\b/gi,    suggest: 'because' },
            { re: /\bon the basis of\b/gi,             suggest: 'based on' },
            { re: /\bcarry out\b/gi,                   suggest: 'do / conduct' },
            { re: /\bmake a payment\b/gi,              suggest: 'pay' },
            { re: /\bmake payments\b/gi,               suggest: 'pay' },
            { re: /\bmake an application\b/gi,         suggest: 'apply' },
            { re: /\bsubmit an application\b/gi,       suggest: 'apply' },
            { re: /\bhave knowledge of\b/gi,           suggest: 'know' },
            { re: /\bhas knowledge of\b/gi,            suggest: 'knows' },
            { re: /\bis of the opinion\b/gi,           suggest: 'thinks / believes' },
            { re: /\bare of the opinion\b/gi,          suggest: 'think / believe' },
            { re: /\bwith regard to\b/gi,              suggest: 'about' },
            { re: /\bwith respect to\b/gi,             suggest: 'about / for' },
            { re: /\bprior to\b/gi,                    suggest: 'before' },
            { re: /\bsubsequent to\b/gi,               suggest: 'after' },
            { re: /\bin excess of\b/gi,                suggest: 'more than' },
            { re: /\bcome to an agreement\b/gi,        suggest: 'agree' },
            { re: /\bcommence\b/gi,                    suggest: 'start / begin' },
            { re: /\butili[sz]e\b/gi,                  suggest: 'use' },
            { re: /\butili[sz]ation\b/gi,              suggest: 'use' },
            { re: /\bascertain\b/gi,                   suggest: 'find out' },
            { re: /\bpurchase\b/gi,                    suggest: 'buy' },
            { re: /\bremuneration\b/gi,                suggest: 'pay' },
            { re: /\bterminate\b/gi,                   suggest: 'end / stop' },
            { re: /\bfacilitate\b/gi,                  suggest: 'help / enable' },
            { re: /\bimplementation\b/gi,              suggest: 'carrying out' },
            { re: /\bcommencement\b/gi,                suggest: 'start' },
            { re: /\bdemonstrate\b/gi,                 suggest: 'show' },
            { re: /\benquire\b/gi,                     suggest: 'ask' },
            { re: /\bindicate\b/gi,                    suggest: 'show / say' },
        ];
        const nominalisationMatches = [];
        nominalisationDefs.forEach(({ re, suggest }) => {
            const m = bodyText.match(re);
            if (m) nominalisationMatches.push({ found: m[0], count: m.length, suggest });
        });
        nominalisationMatches.sort((a, b) => b.count - a.count);
        const nominalisationCount = nominalisationMatches.reduce((s, m) => s + m.count, 0);

        // --- Hedge words ---
        const hedgeDefs = [
            /\bmay\b/gi, /\bmight\b/gi, /\bcould\b/gi, /\bpossibly\b/gi,
            /\bperhaps\b/gi, /\bgenerally\b/gi, /\btypically\b/gi, /\busually\b/gi,
            /\boften\b/gi, /\bsometimes\b/gi, /\bin some cases\b/gi,
            /\bin certain circumstances\b/gi, /\bsubject to\b/gi,
            /\bwhere applicable\b/gi, /\bas appropriate\b/gi, /\bwhere relevant\b/gi,
            /\bin many cases\b/gi,
        ];
        const hedgeMatches = [];
        hedgeDefs.forEach(re => {
            const m = bodyText.match(re);
            if (m) hedgeMatches.push({ phrase: m[0].toLowerCase(), count: m.length });
        });
        hedgeMatches.sort((a, b) => b.count - a.count);
        const hedgeCount = hedgeMatches.reduce((s, m) => s + m.count, 0);
        const hedgeExamples = hedgeMatches.slice(0, 5).map(m => m.count > 1 ? `"${m.phrase}" \xd7${m.count}` : `"${m.phrase}"`);
        const hedgeMatchesAll = hedgeMatches; // full list for report

        // --- Adverbs (-ly words) ---
        const adverbMap = new Map();
        for (let i = 0; i < words.length; i++) {
            const clean = words[i].toLowerCase();
            if (clean.length <= 4 || !/ly$/.test(clean) || NON_ADVERB_LY.has(clean)) continue;
            // Skip adjective context: "friendly service", "early access", etc.
            const nextWord = (words[i + 1] || '').toLowerCase();
            if (COMMON_NOUNS.has(nextWord)) continue;
            adverbMap.set(clean, (adverbMap.get(clean) || 0) + 1);
        }
        const adverbCount = [...adverbMap.values()].reduce((s, v) => s + v, 0);
        const adverbPct = wordCount > 0 ? parseFloat((adverbCount / wordCount * 100).toFixed(1)) : 0;
        const _adverbsSorted = [...adverbMap.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const topAdverbs = _adverbsSorted.slice(0, 8).map(([w, c]) => c > 1 ? `${w} \xd7${c}` : w);
        const adverbsAll = _adverbsSorted.map(([w, c]) => c > 1 ? `${w} \xd7${c}` : w);

        // --- Transition words ---
        const transitionPattern = new RegExp(TRANSITION_PATTERN.source, 'gi');
        const transitionHits = (bodyText.match(transitionPattern) || []).length;
        const transitionCoverage = totalSentences > 0 ? parseFloat((transitionHits / totalSentences * 100).toFixed(1)) : 0;

        return {
            passiveSentenceCount, passiveSentenceExamples, passiveSentenceExamplesAll, totalSentences,
            complexWordCount, complexWordPct, complexWordList, complexWordListAll,
            directAddressRate, youYourCount, contractionCount,
            nominalisationCount,
            nominalisationMatches: nominalisationMatches.slice(0, 8),
            nominalisationMatchesAll: nominalisationMatches,
            hedgeCount, hedgeExamples, hedgeMatchesAll,
            adverbCount, adverbPct, topAdverbs, adverbsAll,
            transitionHits, transitionCoverage,
        };
    }

    function readabilityGrade(score) {
        if (score >= 90) return { label: 'Very Easy',       color: '#16a34a', darkColor: '#4ade80' };
        if (score >= 70) return { label: 'Easy',            color: '#15803d', darkColor: '#34d399' };
        if (score >= 60) return { label: 'Plain English',   color: '#047857', darkColor: '#6ee7b7' };
        if (score >= 50) return { label: 'Fairly Difficult',color: '#d97706', darkColor: '#fbbf24' };
        if (score >= 30) return { label: 'Difficult',       color: '#ea580c', darkColor: '#fb923c' };
        return              { label: 'Very Confusing',      color: '#dc2626', darkColor: '#f87171' };
    }

    // Composite plain-language score 0–100 (A–F), used in full report
    function computePlainLanguageScore(ws, wordCount) {
        let score = 100;
        const passivePct = ws.totalSentences > 0 ? Math.round(ws.passiveSentenceCount / ws.totalSentences * 100) : 0;
        if (passivePct > 15)                            score -= Math.min(25, 10 + Math.round((passivePct - 15) * 0.75));
        if (ws.complexWordPct >= 10)                    score -= Math.min(15, 10 + Math.round((ws.complexWordPct - 10) * 0.5));
        if (ws.nominalisationCount > 5)                 score -= Math.min(15, 5 + Math.round((ws.nominalisationCount - 5) * 1.5));
        if (ws.contractionCount === 0 && wordCount > 300) score -= 10;
        if (ws.transitionCoverage < 15 && wordCount > 300) score -= Math.min(10, 5 + Math.round((15 - ws.transitionCoverage) * 0.4));
        if (ws.adverbPct >= 5)                          score -= 5;
        score = Math.max(0, Math.min(100, score));
        let grade, label, color;
        if (score >= 85)      { grade = 'A'; label = 'Excellent';   color = '#16a34a'; }
        else if (score >= 75) { grade = 'B'; label = 'Good';        color = '#15803d'; }
        else if (score >= 65) { grade = 'C'; label = 'Fair';        color = '#d97706'; }
        else if (score >= 55) { grade = 'D'; label = 'Needs work';  color = '#ea580c'; }
        else                  { grade = 'F'; label = 'Poor';        color = '#dc2626'; }
        return { score, grade, label, color };
    }

    // Horizontal progress bar for a writing metric
    // maxScale: axis upper bound; targetTick: where target marker sits; isOk: whether value is on-target
    function renderBenchmarkBar(label, pct, maxScale, targetTick, isOk, targetStr, colorOverride) {
        const fillPct   = Math.min(pct / maxScale * 100, 100);
        const tickPct   = Math.min(targetTick / maxScale * 100, 100);
        const fillColor = colorOverride || (isOk ? '#059669' : '#d97706');
        const icon      = isOk ? '\u2705' : (colorOverride === '#dc2626' ? '\u274c' : '\u26a0\ufe0f');
        return `<div style="margin-bottom:7px;">` +
            `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">` +
                `<span style="font-size:0.72rem;color:var(--color-text-primary);">${label}</span>` +
                `<span style="font-size:0.7rem;font-weight:600;color:${fillColor};">${pct}%\u2009` +
                    `<span style="font-weight:400;color:var(--color-text-muted);">${targetStr}</span> ${icon}</span>` +
            `</div>` +
            `<div style="height:6px;background:var(--color-bg-tertiary);border-radius:3px;overflow:hidden;position:relative;">` +
                `<div style="position:absolute;inset:0;width:${fillPct}%;background:${fillColor};border-radius:3px;"></div>` +
                `<div style="position:absolute;top:0;bottom:0;left:${tickPct}%;width:2px;background:rgba(100,100,100,0.4);border-radius:1px;"></div>` +
            `</div></div>`;
    }

    function renderRhythmChart(sentLens, chartHeight) {
        if (!sentLens || sentLens.length < 2) return '';
        const VW = 400, VH = chartHeight;
        const padL = 24, padR = 4, padT = 4, padB = 16;
        const cW = VW - padL - padR, cH = VH - padT - padB;
        const maxY = Math.max(Math.max(...sentLens), 30);
        const toX = i   => padL + (i / Math.max(sentLens.length - 1, 1)) * cW;
        const toY = len => padT + cH - (Math.min(len, maxY) / maxY) * cH;

        const y10  = toY(10), y20  = toY(20);
        const pts  = sentLens.map((len, i) => ({ x: toX(i), y: toY(len), len }));
        const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const areaD = lineD
            + ` L${pts[pts.length - 1].x.toFixed(1)},${(padT + cH).toFixed(1)}`
            + ` L${padL},${(padT + cH).toFixed(1)} Z`;

        const dots = sentLens.length <= 60
            ? pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${p.len < 10 ? '#16a34a' : p.len <= 20 ? '#d97706' : '#dc2626'}"><title>${p.len}w</title></circle>`).join('')
            : '';

        return `<svg viewBox="0 0 ${VW} ${VH}" style="width:100%;height:${VH}px;display:block;">` +
            `<rect x="${padL}" y="${padT}" width="${cW}" height="${(y20 - padT).toFixed(1)}" fill="rgba(220,38,38,0.09)"/>` +
            `<rect x="${padL}" y="${y20.toFixed(1)}" width="${cW}" height="${(y10 - y20).toFixed(1)}" fill="rgba(217,119,6,0.09)"/>` +
            `<rect x="${padL}" y="${y10.toFixed(1)}" width="${cW}" height="${(padT + cH - y10).toFixed(1)}" fill="rgba(22,163,74,0.09)"/>` +
            `<line x1="${padL}" y1="${y20.toFixed(1)}" x2="${padL + cW}" y2="${y20.toFixed(1)}" stroke="rgba(220,38,38,0.35)" stroke-width="1" stroke-dasharray="3,3"/>` +
            `<line x1="${padL}" y1="${y10.toFixed(1)}" x2="${padL + cW}" y2="${y10.toFixed(1)}" stroke="rgba(22,163,74,0.35)" stroke-width="1" stroke-dasharray="3,3"/>` +
            `<text x="${padL - 3}" y="${y20.toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-size="7" fill="rgba(220,38,38,0.6)">20</text>` +
            `<text x="${padL - 3}" y="${y10.toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-size="7" fill="rgba(22,163,74,0.6)">10</text>` +
            `<path d="${areaD}" fill="rgba(100,116,139,0.12)" stroke="none"/>` +
            `<path d="${lineD}" fill="none" stroke="var(--color-text-primary)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>` +
            dots +
            `<text x="${(padL + cW / 2).toFixed(1)}" y="${VH - 2}" text-anchor="middle" font-size="7" fill="rgba(100,116,139,0.6)">\u2190 sentence order \u2192  (${sentLens.length} sentences)</text>` +
            `</svg>`;
    }

    function catmullRomPath(pts, closeToBottomY, padL) {
        if (pts.length < 2) return '';
        const d = [`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`];
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(i - 1, 0)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(i + 2, pts.length - 1)];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            d.push(`C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`);
        }
        if (closeToBottomY !== undefined) {
            d.push(`L${pts[pts.length-1].x.toFixed(1)},${closeToBottomY.toFixed(1)}`);
            d.push(`L${padL},${closeToBottomY.toFixed(1)} Z`);
        }
        return d.join(' ');
    }

    function renderRhythmChartFull(sentLens, sentTexts) {
        if (!sentLens || sentLens.length < 2) return '';
        const truncatedTexts = (sentTexts || []).map(t => t.length > 200 ? t.slice(0, 197) + '\u2026' : t);
        return `<div style="position:relative;width:100%;">` +
            `<svg id="pi-rhythm-svg" style="width:100%;display:block;overflow:visible;"` +
            ` data-lens='${JSON.stringify(sentLens)}'` +
            ` data-texts='${JSON.stringify(truncatedTexts).replace(/'/g, "&#39;")}'>` +
            `<defs><linearGradient id="pi-rhythm-grad" x1="0" y1="0" x2="0" y2="1">` +
                `<stop offset="0%" stop-color="rgba(100,116,139,0.25)"/>` +
                `<stop offset="100%" stop-color="rgba(100,116,139,0)"/>` +
            `</linearGradient></defs>` +
            `</svg>` +
            `<div id="pi-rhythm-tip" style="position:absolute;pointer-events:none;display:none;` +
                `background:var(--color-bg-elevated);border:1px solid var(--color-border-primary);` +
                `border-radius:8px;padding:7px 11px;font-size:0.72rem;max-width:340px;white-space:normal;line-height:1.5;` +
                `box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10;"></div>` +
            `</div>`;
    }

    function initRhythmChartFull(container) {
        const svg = container.querySelector('#pi-rhythm-svg');
        const tip = container.querySelector('#pi-rhythm-tip');
        if (!svg || !tip) return;

        const lens  = JSON.parse(svg.dataset.lens);
        const texts = (() => { try { return JSON.parse(svg.dataset.texts || '[]'); } catch(e) { return []; } })();
        const VW   = Math.round(svg.getBoundingClientRect().width) || svg.parentElement.clientWidth || 600;
        const VH   = 160;
        const padL = 36, padR = 8, padT = 8, padB = 20;
        const cW   = VW - padL - padR;
        const cH   = VH - padT - padB;
        const maxY = Math.max(Math.max(...lens), 30);

        svg.setAttribute('width',  VW);
        svg.setAttribute('height', VH);

        const toX = i   => padL + (i / Math.max(lens.length - 1, 1)) * cW;
        const toY = len => padT + cH - (Math.min(len, maxY) / maxY) * cH;
        const pts = lens.map((len, i) => ({ x: toX(i), y: toY(len), len, idx: i }));

        const NS = 'http://www.w3.org/2000/svg';
        const mk = (tag, attrs) => {
            const e = document.createElementNS(NS, tag);
            for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
            return e;
        };

        const y0 = toY(0), y10 = toY(10), y20 = toY(20);
        const bottom = padT + cH;

        // Zone bands
        svg.appendChild(mk('rect', { x: padL, y: padT,         width: cW, height: y20 - padT,   fill: 'rgba(220,38,38,0.09)' }));
        svg.appendChild(mk('rect', { x: padL, y: y20,          width: cW, height: y10 - y20,    fill: 'rgba(217,119,6,0.09)' }));
        svg.appendChild(mk('rect', { x: padL, y: y10,          width: cW, height: bottom - y10, fill: 'rgba(22,163,74,0.09)' }));

        // Reference lines
        svg.appendChild(mk('line', { x1: padL, y1: y20, x2: padL + cW, y2: y20, stroke: 'rgba(220,38,38,0.35)',  'stroke-width': 1, 'stroke-dasharray': '3,3' }));
        svg.appendChild(mk('line', { x1: padL, y1: y10, x2: padL + cW, y2: y10, stroke: 'rgba(22,163,74,0.35)',  'stroke-width': 1, 'stroke-dasharray': '3,3' }));
        svg.appendChild(mk('line', { x1: padL, y1: y0,  x2: padL + cW, y2: y0,  stroke: 'rgba(100,116,139,0.2)', 'stroke-width': 1 }));

        // Y-axis labels
        svg.appendChild(mk('text', { x: padL - 5, y: y20, 'text-anchor': 'end', 'dominant-baseline': 'middle', 'font-size': 9, fill: 'rgba(220,38,38,0.7)' })).textContent = '20';
        svg.appendChild(mk('text', { x: padL - 5, y: y10, 'text-anchor': 'end', 'dominant-baseline': 'middle', 'font-size': 9, fill: 'rgba(22,163,74,0.7)'  })).textContent = '10';
        svg.appendChild(mk('text', { x: padL - 5, y: y0,  'text-anchor': 'end', 'dominant-baseline': 'middle', 'font-size': 9, fill: 'rgba(100,116,139,0.5)'})).textContent = '0';

        // Rotated "words" axis title
        const wLabel = mk('text', { 'text-anchor': 'middle', 'font-size': 8, fill: 'rgba(100,116,139,0.6)', transform: `rotate(-90) translate(${-(padT + cH / 2)}, 10)` });
        wLabel.textContent = 'words';
        svg.appendChild(wLabel);

        // Catmull-rom smooth path
        const linePts = catmullRomPath(pts);
        const areaD   = catmullRomPath(pts, bottom, padL);

        svg.appendChild(mk('path', { d: areaD,    fill: 'url(#pi-rhythm-grad)', stroke: 'none' }));
        svg.appendChild(mk('path', { d: linePts,  fill: 'none', stroke: 'var(--color-text-primary)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

        // Dots (≤120 sentences)
        if (lens.length <= 120) {
            pts.forEach(p => {
                const c = p.len < 10 ? '#16a34a' : p.len <= 20 ? '#d97706' : '#dc2626';
                const dot = mk('circle', { cx: p.x, cy: p.y, r: 3, fill: c });
                const t = document.createElementNS(NS, 'title');
                t.textContent = `${p.len}w`;
                dot.appendChild(t);
                svg.appendChild(dot);
            });
        }

        // Interactive layer: crosshair + hover dot + overlay
        const xhair   = mk('line',   { x1: 0, y1: padT, x2: 0, y2: bottom, stroke: 'rgba(100,116,139,0.6)', 'stroke-width': 1, 'stroke-dasharray': '4,3', display: 'none' });
        const xdot    = mk('circle', { cx: 0, cy: 0, r: 5, fill: 'white', stroke: '#64748b', 'stroke-width': 2, display: 'none' });
        const overlay = mk('rect',   { x: padL, y: padT, width: cW, height: cH, fill: 'transparent', style: 'cursor:crosshair;' });
        svg.appendChild(xhair);
        svg.appendChild(xdot);
        svg.appendChild(overlay);

        // X-axis label
        const xLabel = mk('text', { x: padL + cW / 2, y: VH - 3, 'text-anchor': 'middle', 'font-size': 8.5, fill: 'rgba(100,116,139,0.6)' });
        xLabel.textContent = `\u2190 sentence order \u2192  (${lens.length} sentences)`;
        svg.appendChild(xLabel);

        // Mouse events
        overlay.addEventListener('mousemove', e => {
            const rect   = svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            let near = pts[0];
            for (const p of pts) if (Math.abs(p.x - mouseX) < Math.abs(near.x - mouseX)) near = p;

            const color = near.len < 10 ? '#16a34a' : near.len <= 20 ? '#d97706' : '#dc2626';
            const zone  = near.len < 10 ? 'Short'   : near.len <= 20 ? 'Medium'  : 'Long';

            xhair.setAttribute('x1', near.x); xhair.setAttribute('x2', near.x);
            xhair.removeAttribute('display');
            xdot.setAttribute('cx', near.x); xdot.setAttribute('cy', near.y);
            xdot.setAttribute('stroke', color);
            xdot.removeAttribute('display');

            const sentText = texts[near.idx] || '';
            tip.innerHTML =
                `<div><span style="font-weight:700;color:${color};">${near.len}w</span>` +
                `<span style="color:var(--color-text-muted);"> \u00b7 Sentence ${near.idx + 1} \u00b7 ${zone}</span></div>` +
                (sentText ? `<div style="margin-top:4px;font-size:0.68rem;color:var(--color-text-secondary);font-style:italic;max-width:320px;">\u201c${sentText}\u201d</div>` : '');
            tip.style.left    = `${Math.min(mouseX + 14, rect.width - 200)}px`;
            tip.style.top     = `${Math.max(e.clientY - rect.top - 38, 0)}px`;
            tip.style.display = 'block';
        });

        overlay.addEventListener('mouseleave', () => {
            xhair.setAttribute('display', 'none');
            xdot.setAttribute('display',  'none');
            tip.style.display = 'none';
        });
    }

    function parsePageContent(html, pageUrl) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // --- Extract before noise removal ---

        // Schema types (must happen before scripts are removed)
        const schemaTypes = [];
        doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
            try {
                const schemaData = JSON.parse(script.textContent);
                const items = Array.isArray(schemaData) ? schemaData : [schemaData];
                items.forEach(item => {
                    const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
                    schemaTypes.push(...types.filter(Boolean));
                });
            } catch(e) {}
        });

        // Language & canonical (in <head>, safe before or after noise removal)
        const pageLanguage = doc.documentElement.getAttribute('lang') || '';
        const canonicalEl = doc.querySelector('link[rel="canonical"]');
        const canonicalUrl = (canonicalEl?.getAttribute('href') || '').trim();

        // noindex detection
        const robotsMeta = doc.querySelector('meta[name="robots"], meta[name="googlebot"]');
        const isNoindex = /noindex/i.test(robotsMeta?.getAttribute('content') || '');

        // Remove noise before extracting text
        doc.querySelectorAll([
            'script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript',
            '[aria-hidden="true"]',
            '[role="navigation"]',
            '[class*="cookie"]', '[id*="cookie"]',
            '[class*="consent"]', '[id*="consent"]',
            '[class*="breadcrumb"]', '[id*="breadcrumb"]',
            '[class*="skip"]',
        ].join(', ')).forEach(el => el.remove());

        // --- Metadata ---
        const titleText = (doc.querySelector('title')?.textContent || '').trim();
        const metaDescEl = doc.querySelector(
            'meta[name="description"], meta[name="Description"], ' +
            'meta[property="og:description"], meta[name="twitter:description"]'
        );
        const metaDescText = (metaDescEl?.getAttribute('content') || '').trim();

        // --- Headings ---
        const h1Els = doc.querySelectorAll('h1');
        const h1Text = h1Els.length > 0 ? h1Els[0].textContent.trim() : '';
        const h2Count = doc.querySelectorAll('h2').length;
        const h3Count = doc.querySelectorAll('h3').length;
        const h2Texts = [...doc.querySelectorAll('h2')].map(el => el.textContent.trim()).filter(Boolean);
        const h3Texts = [...doc.querySelectorAll('h3')].map(el => el.textContent.trim()).filter(Boolean);

        // --- Images ---
        const allImages = doc.querySelectorAll('img');
        const imagesWithoutAlt = [...allImages].filter(
            img => !(img.getAttribute('alt') || '').trim()
        ).length;

        // --- Links ---
        let origin = '';
        try { origin = new URL(pageUrl).origin; } catch (e) {}

        let internalLinks = 0, externalLinks = 0;
        const internalLinkData = [];  // { href: string (path), text: string }
        const externalLinkData = [];  // { href: string (full URL), text: string }

        const _normHref = h => h.replace(/\/$/, '').toLowerCase();
        const _seenInt = new Set(), _seenExt = new Set();

        doc.querySelectorAll('a[href]').forEach(a => {
            const href = (a.getAttribute('href') || '').trim();
            if (!href || /^(#|mailto:|tel:|javascript:)/.test(href)) return;
            const rawText = (a.textContent || '').replace(/\s+/g, ' ').trim();
            const rel        = (a.getAttribute('rel') || '').trim();
            const isNewTab   = a.getAttribute('target') === '_blank';
            const isImageLink = !rawText && a.querySelector('img') !== null;

            if (href.startsWith('/') || (origin && href.startsWith(origin))) {
                internalLinks++;
                let path = href;
                if (origin && href.startsWith(origin)) {
                    try { path = new URL(href).pathname + new URL(href).search; } catch(e) {}
                }
                const key = _normHref(path);
                if (!_seenInt.has(key)) {
                    _seenInt.add(key);
                    internalLinkData.push({ href: path, text: rawText || path, rel, isNewTab, isImageLink });
                }
            } else if (/^https?:\/\//.test(href)) {
                externalLinks++;
                const key = _normHref(href);
                if (!_seenExt.has(key)) {
                    _seenExt.add(key);
                    externalLinkData.push({ href, text: rawText || href, rel, isNewTab, isImageLink });
                }
            }
        });

        // --- Body text for word count + readability ---
        const _blockTags = new Set(['P','DIV','TD','TH','LI','TR','H1','H2','H3','H4','H5','H6','BR','DT','DD','BLOCKQUOTE','SECTION','ARTICLE','FIGCAPTION','PRE','ADDRESS']);
        // Tags that represent natural sentence boundaries — suffix with '. ' so the
        // sentence splitter treats each list item / paragraph / heading as its own sentence.
        const _sentenceBoundaries = new Set(['LI','P','H1','H2','H3','H4','H5','H6','DT','DD','TD','TH']);
        const _parts = [];
        (function _walk(node) {
            if (node.nodeType === 3) { _parts.push(node.nodeValue); }
            else if (node.nodeType === 1) {
                if (_blockTags.has(node.tagName)) _parts.push(' ');
                node.childNodes.forEach(_walk);
                if (_sentenceBoundaries.has(node.tagName)) _parts.push('. ');
                else if (_blockTags.has(node.tagName)) _parts.push(' ');
            }
        })(doc.body || document.createElement('body'));
        const bodyText = _parts.join('')
            .replace(/https?:\/\/\S+/gi, ' ')
            .replace(/\b\w+\.(ie|com|org|net|gov|eu|co\.uk|info|biz)\b/gi, ' ')
            .replace(/\s+/g, ' ').trim();
        const wordTokens = bodyText.split(/\s+/).filter(w => w.length > 0);
        const wordCount = wordTokens.length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));
        const fkResult = fleschKincaidFull(bodyText);
        const readabilityScore = fkResult ? fkResult.score : null;
        const avgSentenceLength = fkResult ? fkResult.avgSentenceLength : null;
        const avgSyllablesPerWord = fkResult ? fkResult.avgSyllablesPerWord : null;
        const longSentences = fkResult ? fkResult.longSentences : [];
        const longSentencesAll = fkResult ? fkResult.longSentencesAll : [];
        const sentenceLengths = fkResult ? fkResult.sentenceLengths : [];
        const sentenceTexts = fkResult ? fkResult.sentences : [];
        const writingStyle = wordCount >= 10 ? analyseWritingStyle(bodyText, wordCount) : null;

        function extractStructuredBlocks(doc) {
            const container =
                doc.querySelector('article') ||
                doc.querySelector('[role="main"]') ||
                doc.querySelector('main') ||
                doc.querySelector('#main-content, #content, .content') ||
                doc.body;
            if (!container) return [];

            const blocks = [];

            function nodeText(el) {
                return (el.textContent || '').replace(/\s+/g, ' ').trim();
            }

            function extractList(listEl) {
                const items = [];
                for (const li of listEl.children) {
                    if (li.tagName !== 'LI') continue;
                    const clone = li.cloneNode(true);
                    clone.querySelectorAll('ul, ol').forEach(sub => sub.remove());
                    const text = nodeText(clone);
                    if (text) items.push(text);
                    for (const sub of li.querySelectorAll(':scope > ul, :scope > ol')) {
                        const nested = extractList(sub);
                        if (nested.items.length) blocks.push(nested);
                    }
                }
                return { type: listEl.tagName.toLowerCase(), items };
            }

            function extractTable(tableEl) {
                const rows = [];
                let hasHeader = false;
                const thead = tableEl.querySelector('thead');
                if (thead) {
                    const headerRow = [...thead.querySelectorAll('tr')].map(tr =>
                        [...tr.querySelectorAll('th, td')].map(nodeText)
                    );
                    rows.push(...headerRow);
                    hasHeader = true;
                }
                const tbody = tableEl.querySelector('tbody') || tableEl;
                for (const tr of tbody.querySelectorAll('tr')) {
                    rows.push([...tr.querySelectorAll('th, td')].map(nodeText));
                }
                return { type: 'table', rows: rows.filter(r => r.length > 0), hasHeader };
            }

            function walk(node) {
                if (node.nodeType !== 1) return;
                const tag = node.tagName;
                if (/^H[1-4]$/.test(tag)) {
                    const text = nodeText(node);
                    if (text) blocks.push({ type: tag.toLowerCase(), text });
                } else if (tag === 'P') {
                    const text = nodeText(node);
                    if (text.length > 10) blocks.push({ type: 'p', text });
                } else if (tag === 'UL' || tag === 'OL') {
                    const list = extractList(node);
                    if (list.items.length) blocks.push(list);
                } else if (tag === 'TABLE') {
                    const table = extractTable(node);
                    if (table.rows.length) blocks.push(table);
                } else if (tag === 'BLOCKQUOTE') {
                    const text = nodeText(node);
                    if (text) blocks.push({ type: 'blockquote', text });
                } else if (tag === 'DL') {
                    const items = [];
                    let currentTerm = '';
                    for (const child of node.children) {
                        if (child.tagName === 'DT') currentTerm = nodeText(child);
                        else if (child.tagName === 'DD' && currentTerm) {
                            items.push({ term: currentTerm, def: nodeText(child) });
                        }
                    }
                    if (items.length) blocks.push({ type: 'dl', items });
                } else {
                    for (const child of node.children) walk(child);
                }
            }

            for (const child of container.children) walk(child);
            return blocks;
        }

        const structuredBlocks = extractStructuredBlocks(doc);

        return {
            titleText,
            titleLength: titleText.length,
            metaDescText,
            metaDescLength: metaDescText.length,
            h1Text,
            h1Count: h1Els.length,
            h2Count,
            h3Count,
            h2Texts,
            h3Texts,
            imageCount: allImages.length,
            imagesWithoutAlt,
            internalLinks,
            externalLinks,
            internalLinkData,
            externalLinkData,
            schemaTypes,
            pageLanguage,
            canonicalUrl,
            isNoindex,
            wordCount,
            readingTime,
            readabilityScore,
            avgSentenceLength,
            avgSyllablesPerWord,
            longSentences,
            longSentencesAll,
            sentenceLengths,
            sentenceTexts,
            writingStyle,
            structuredBlocks
        };
    }

    async function analyseUrl(url) {
        // Return cached result if fresh
        const cached = cache.get(url);
        if (cached && (Date.now() - cached.fetchedAt) < CACHE_MAX_AGE) {
            return cached.data;
        }

        // Deduplicate simultaneous requests for the same URL
        if (pendingRequests.has(url)) {
            return pendingRequests.get(url);
        }

        const promise = (async () => {
            const html = await fetchViaProxy(url);
            const data = parsePageContent(html, url);
            cache.set(url, { data, fetchedAt: Date.now() });
            pendingRequests.delete(url);
            return data;
        })();

        pendingRequests.set(url, promise);
        return promise;
    }

    // --- Rendering ---

    function renderLoading(container) {
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px;">
                ${Array.from({length: 3}, () => `
                    <div style="background: var(--color-bg-secondary); border-radius: 10px; padding: 14px; text-align: center; border: 1px solid var(--color-border-primary);">
                        <div style="height: 11px; width: 60%; margin: 0 auto 8px; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
                        <div style="height: 22px; width: 80%; margin: 0 auto 6px; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
                        <div style="height: 10px; width: 50%; margin: 0 auto; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
                    </div>
                `).join('')}
            </div>
            <div style="background: var(--color-bg-secondary); border-radius: 10px; padding: 14px; border: 1px solid var(--color-border-primary); margin-bottom: 10px;">
                <div style="height: 11px; width: 35%; margin-bottom: 8px; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
                <div style="height: 14px; width: 85%; margin-bottom: 6px; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
                <div style="height: 11px; width: 50%; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
            </div>
            <div style="background: var(--color-bg-secondary); border-radius: 10px; padding: 14px; border: 1px solid var(--color-border-primary);">
                ${Array.from({length: 5}, () => `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 7px;">
                        <div style="height: 11px; width: 40%; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
                        <div style="height: 11px; width: 30%; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
                    </div>
                `).join('')}
            </div>
            <div style="text-align: center; font-size: 0.72rem; color: var(--color-text-muted); margin-top: 10px;">
                Fetching page content…
            </div>
        `;
    }

    function renderError(container, url, message) {
        container.innerHTML = `
            <div style="text-align: center; padding: 28px 16px;">
                <div style="font-size: 2rem; margin-bottom: 10px;">🚫</div>
                <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 6px; font-size: 0.9rem;">Unable to analyse page</div>
                <div style="font-size: 0.78rem; color: var(--color-text-secondary); margin-bottom: 16px; line-height: 1.5; max-width: 280px; margin-left: auto; margin-right: auto;">
                    ${message || 'The page may block external requests (CORS policy).'}
                </div>
                <a href="${message ? '' : url}" target="_blank" rel="noopener" style="
                    display: inline-block;
                    padding: 8px 16px;
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--color-border-primary);
                    border-radius: 8px;
                    color: var(--color-link);
                    text-decoration: none;
                    font-size: 0.8rem;
                    font-weight: 500;
                ">Open page directly ↗</a>
            </div>
        `;
        // Fix the href
        container.querySelector('a').href = url;
    }

    function _statusBadgeHtml(status) {
        let color, text;
        if (status === null)     { color = '#6b7280'; text = '?'; }
        else if (status < 300)   { color = '#059669'; text = String(status); }
        else if (status < 400)   { color = '#d97706'; text = String(status); }
        else                     { color = '#dc2626'; text = String(status); }
        return `<span class="pi-status-badge" style="display:inline-block;font-size:0.6rem;font-weight:700;color:#fff;background:${color};border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:middle;flex-shrink:0;line-height:1.5;">${text}</span>`;
    }

    function wireLinkChecker(container, data, urlOrigin) {
        const btn = container.querySelector('#pi-check-links-btn');
        if (!btn) return;
        const _intAll = data.internalLinkData || [];
        const _extAll = data.externalLinkData || [];

        // Build items: internal first (path-only, needs origin), then external; cap at 100
        const items = [];
        for (const lk of _intAll) {
            if (items.length >= 100) break;
            if (!lk.href.startsWith('/') || !urlOrigin) continue;
            items.push({ fullUrl: urlOrigin + lk.href });
        }
        for (const lk of _extAll) {
            if (items.length >= 100) break;
            items.push({ fullUrl: lk.href });
        }

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Checking…';
            // Evict any null cache entries so re-checks aren't served stale unknowns
            items.forEach(({ fullUrl }) => {
                const c = _linkStatusCache.get(fullUrl);
                if (c && c.status === null) _linkStatusCache.delete(fullUrl);
            });
            // Remove any existing status badges so re-check renders fresh results
            container.querySelectorAll('[data-link-url] .pi-status-badge').forEach(el => el.remove());
            const progress = container.querySelector('#pi-link-check-progress');
            const summary  = container.querySelector('#pi-link-check-summary');
            if (progress) { progress.style.display = ''; progress.textContent = `Checking 0 / ${items.length} links…`; }
            if (summary)  summary.style.display = 'none';

            let done = 0, broken = 0, redirects = 0, ok = 0, unknown = 0;
            const BATCH = 2; // allorigins rate-limits aggressively; keep concurrency low
            for (let i = 0; i < items.length; i += BATCH) {
                const batch = items.slice(i, i + BATCH);
                await Promise.allSettled(batch.map(async ({ fullUrl }) => {
                    const status = await checkLinkStatus(fullUrl);
                    done++;
                    if (status === null)    unknown++;
                    else if (status < 300)  ok++;
                    else if (status < 400)  redirects++;
                    else                    broken++;
                    if (progress) progress.textContent = `Checking ${done} / ${items.length} links…`;
                    try {
                        const escaped = CSS.escape(fullUrl);
                        const rowEl = container.querySelector(`[data-link-url="${escaped}"]`);
                        if (rowEl && !rowEl.querySelector('.pi-status-badge')) {
                            rowEl.insertAdjacentHTML('beforeend', _statusBadgeHtml(status));
                        }
                    } catch(e) {}
                }));
                if (i + BATCH < items.length) await new Promise(r => setTimeout(r, 400));
            }

            if (progress) progress.style.display = 'none';
            if (summary) {
                summary.style.display = '';
                const parts = [];
                if (broken > 0)    parts.push(`<span style="color:#dc2626;font-weight:700;">${broken} broken</span>`);
                if (redirects > 0) parts.push(`<span style="color:#d97706;font-weight:700;">${redirects} redirect${redirects !== 1 ? 's' : ''}</span>`);
                if (ok > 0)        parts.push(`<span style="color:#059669;">${ok} ok</span>`);
                if (unknown > 0)   parts.push(`<span style="color:#6b7280;">${unknown} unknown</span>`);
                summary.innerHTML = parts.join(' &middot; ') || 'No links checked.';
            }
            btn.textContent = 'Re-check Links';
            btn.disabled = false;
        });
    }

    function wireDatamuseBadges(container) {
        container.querySelectorAll('[data-datamuse-word]').forEach(el => {
            let fetched = false;
            el.addEventListener('mouseenter', async function() {
                if (fetched) return;
                fetched = true;
                const word = el.getAttribute('data-datamuse-word');
                el.title = 'Loading synonyms…';
                const alts = await _fetchDatamuseSyns(word);
                if (alts && alts.length) {
                    el.title = 'Synonyms: ' + alts.join(', ');
                    el.style.borderColor = '#6366f1';
                    el.style.borderBottomColor = '#6366f1';
                    el.style.borderBottomWidth = '2px';
                    el.style.borderBottomStyle = 'dashed';
                    const arrow = document.createElement('span');
                    arrow.textContent = '→';
                    arrow.style.cssText = 'color:#6366f1;font-size:0.65rem;margin-left:3px;';
                    el.appendChild(arrow);
                } else {
                    el.title = 'No synonyms found';
                    el.style.cursor = '';
                }
            }, { once: false });
        });
    }

    function renderResults(container, data, url) {
        const isDark = window.__isDarkTheme || document.body.classList.contains('dark-theme');
        const grade = data.readabilityScore !== null ? readabilityGrade(data.readabilityScore) : null;
        const scoreColor = grade ? (isDark ? grade.darkColor : grade.color) : 'var(--color-text-secondary)';

        const metaStatus = data.metaDescLength === 0
            ? { icon: '❌', label: 'Missing', color: '#dc2626' }
            : data.metaDescLength < 70
            ? { icon: '⚠️', label: `${data.metaDescLength} chars (short)`, color: '#d97706' }
            : data.metaDescLength > 160
            ? { icon: '⚠️', label: `${data.metaDescLength} chars (long)`, color: '#d97706' }
            : { icon: '✅', label: `${data.metaDescLength} chars`, color: '#059669' };

        const titleStatus = data.titleLength === 0
            ? { icon: '❌', label: 'Missing', color: '#dc2626' }
            : data.titleLength > 60
            ? { icon: '⚠️', label: `${data.titleLength} chars (long)`, color: '#d97706' }
            : { icon: '✅', label: `${data.titleLength} chars`, color: '#059669' };

        const altLabel = data.imageCount === 0
            ? '— No images'
            : data.imagesWithoutAlt === 0
            ? `✅ ${data.imageCount} img, all have alt`
            : `⚠️ ${data.imagesWithoutAlt}/${data.imageCount} missing alt`;
        const altColor = data.imagesWithoutAlt > 0 ? '#d97706' : '#059669';

        const linkDensity = data.wordCount > 0 ? (data.internalLinks / data.wordCount * 100).toFixed(1) : '0.0';
        const linkDensityLow = data.wordCount > 0 && parseFloat(linkDensity) < 5;

        let canonicalStatus;
        if (!data.canonicalUrl) {
            canonicalStatus = { icon: '⚠️', label: 'Missing', color: '#d97706' };
        } else {
            try {
                const canonNorm = new URL(data.canonicalUrl).href.replace(/\/$/, '');
                const pageNorm = new URL(url).href.replace(/\/$/, '');
                if (canonNorm === pageNorm) {
                    canonicalStatus = { icon: '✅', label: 'Self-referencing', color: '#059669' };
                } else {
                    canonicalStatus = { icon: '⚠️', label: 'Points elsewhere', color: '#d97706' };
                }
            } catch(e) {
                canonicalStatus = { icon: '⚠️', label: 'Invalid URL', color: '#d97706' };
            }
        }

        const schemaBadgesHtml = data.schemaTypes.map(t => `<span style="
            display: inline-block;
            background: var(--color-bg-tertiary);
            border: 1px solid var(--color-border-primary);
            border-radius: 4px;
            padding: 1px 6px;
            font-size: 0.67rem;
            font-weight: 600;
            color: var(--color-text-primary);
            margin-right: 4px;
            margin-bottom: 3px;
        ">${t}</span>`).join('');

        const metaPreview = data.metaDescText
            ? `<div style="font-size: 0.68rem; color: var(--color-text-secondary); font-style: italic; margin-top: 5px; padding: 5px 8px; background: var(--color-bg-tertiary); border-radius: 6px; line-height: 1.4;">&ldquo;${data.metaDescText}&rdquo;</div>`
            : '';

        // Long sentences breakdown data (used in Writing Quality <details>)
        const _tooltipLongSentLens = data.sentenceLengths || [];
        const _tooltipLong30 = _tooltipLongSentLens.filter(l => l >= 30).length;
        const _tooltipLong40 = _tooltipLongSentLens.filter(l => l >= 40).length;
        const _tooltipLongBreakdown = _tooltipLong30 > 0
            ? ` (30+:&thinsp;${_tooltipLong30}${_tooltipLong40 > 0 ? `, 40+:&thinsp;${_tooltipLong40}` : ''})`
            : '';
        const _longWcColor = wc => wc >= 40 ? '#7f1d1d' : wc >= 30 ? '#b91c1c' : '#dc2626';

        // Writing style computed flags (shared by Top Fixes and Writing Quality)
        let wsComputed = null;
        if (data.writingStyle) {
            const ws = data.writingStyle;
            const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const passivePct = ws.totalSentences > 0 ? Math.round(ws.passiveSentenceCount / ws.totalSentences * 100) : 0;
            wsComputed = {
                ws, esc, passivePct,
                passiveWarn:     passivePct > 15,
                passivePoor:     passivePct > 25,
                complexWarn:     ws.complexWordPct >= 10,
                contractionWarn: ws.contractionCount === 0 && data.wordCount > 300,
                adverbWarn:      ws.adverbPct >= 5,
                transitionLow:   ws.transitionCoverage < 15 && data.wordCount > 300
            };
        }

        // ── Section 3: Top Fixes (standalone card) ──
        let topFixesHtml = '';
        if (wsComputed) {
            const { ws, esc, passivePct, passiveWarn, complexWarn, contractionWarn, adverbWarn, transitionLow } = wsComputed;
            const fixes = [];
            if (data.longSentences.length > 0)  fixes.push(`${data.longSentences.length} sentence${data.longSentences.length > 1 ? 's' : ''} over 20 words \u2014 shorten them`);
            if (passiveWarn)                     fixes.push(`Passive voice ${passivePct}% (${ws.passiveSentenceCount} sentences) \u2014 rewrite to start with the subject`);
            if (transitionLow)                   fixes.push(`Transitions ${ws.transitionCoverage}% \u2014 add however / therefore / also between paragraphs`);
            if (contractionWarn)                 fixes.push(`No contractions \u2014 try don\u2019t, can\u2019t, you\u2019ll to sound less formal`);
            if (complexWarn)                     fixes.push(`Complex words ${ws.complexWordPct}% \u2014 replace 3+ syllable words with simpler alternatives`);
            if (ws.nominalisationCount > 3)      fixes.push(`${ws.nominalisationCount} bureaucratic phrases \u2014 see list below`);
            if (adverbWarn && fixes.length < 3)  fixes.push(`Adverbs ${ws.adverbPct}% \u2014 remove or replace -ly adverbs`);
            if (fixes.length > 0) {
                topFixesHtml = `<div style="background: var(--color-bg-secondary); border-radius: 10px; padding: 11px 13px; border: 1px solid var(--color-border-primary); border-left: 3px solid #4f46e5; margin-bottom: 10px;">
                    <div style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #4f46e5; margin-bottom: 7px;">&#127919; Top things to fix</div>
                    <ol style="margin:0;padding-left:16px;display:flex;flex-direction:column;gap:4px;">
                        ${fixes.slice(0, 3).map(f => `<li style="font-size:0.72rem;color:var(--color-text-secondary);line-height:1.4;">${esc(f)}</li>`).join('')}
                    </ol></div>`;
            }
        }

        // ── Section 4: Writing Quality card ──
        let writingQualityHtml = '';
        if (wsComputed) {
            const { ws, esc, passivePct, passiveWarn, passivePoor, complexWarn, contractionWarn, adverbWarn, transitionLow } = wsComputed;

            // Reading Rhythm
            const sentLens = data.sentenceLengths || [];
            const rhythmHtml = sentLens.length >= 2
                ? `<div style="margin-bottom:10px;"><div style="font-size:0.63rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-secondary);margin-bottom:4px;">Reading Rhythm</div>${renderRhythmChart(sentLens, 55)}</div>`
                : '';

            // Benchmark bars — 2-col grid, last bar spans full width
            const barsHtml =
                `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;margin-bottom:10px;">` +
                    renderBenchmarkBar('Passive voice',  passivePct,           40, 15, !passiveWarn,  'target \u226415%', passivePoor ? '#dc2626' : undefined) +
                    renderBenchmarkBar('Complex words',  ws.complexWordPct,     30, 10, !complexWarn,  'target <10%') +
                    renderBenchmarkBar('Transitions',    ws.transitionCoverage, 30, 15, !transitionLow,'target >15%') +
                    renderBenchmarkBar('Direct address', ws.directAddressRate,  16,  2, ws.directAddressRate >= 2, 'target \u22652%') +
                    `<div style="grid-column:1/-1;">` + renderBenchmarkBar('Adverbs (-ly)', ws.adverbPct, 15, 5, !adverbWarn, 'target <5%') + `</div>` +
                `</div>`;

            // Tone dial
            const dialPct = Math.min(ws.contractionCount / 10 * 100, 100);
            const toneDialHtml =
                `<div style="margin-bottom:8px;">` +
                    `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">` +
                        `<span style="font-size:0.72rem;color:var(--color-text-primary);">Tone (contractions)</span>` +
                        `<span style="font-size:0.7rem;font-weight:600;color:${contractionWarn ? '#d97706' : 'var(--color-text-secondary)'};">${ws.contractionCount} found ${contractionWarn ? '\u26a0\ufe0f' : '\u2705'}</span>` +
                    `</div>` +
                    `<div style="position:relative;height:6px;background:linear-gradient(to right,#94a3b8,#16a34a);border-radius:3px;margin-bottom:3px;">` +
                        `<div style="position:absolute;top:50%;left:${dialPct}%;transform:translate(-50%,-50%);width:10px;height:10px;background:var(--color-bg-primary);border:2px solid ${contractionWarn ? '#d97706' : '#16a34a'};border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>` +
                    `</div>` +
                    `<div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--color-text-muted);"><span>Very formal</span><span>Conversational</span></div>` +
                    (contractionWarn ? `<div style="font-size:0.63rem;color:#d97706;margin-top:2px;">Try: don\u2019t, can\u2019t, you\u2019ll, it\u2019s</div>` : '') +
                `</div>`;

            // Long sentences — collapsible list
            const longSentDetailsHtml = data.longSentences.length > 0
                ? `<details${data.longSentences.length <= 3 ? ' open' : ''} style="margin-bottom:4px;">` +
                    `<summary style="font-size:0.72rem;font-weight:600;color:#d97706;cursor:pointer;list-style:none;padding:4px 0;">\u26a0\ufe0f ${data.longSentences.length} long sentence${data.longSentences.length > 1 ? 's' : ''} \u2014 see list${_tooltipLongBreakdown}</summary>` +
                    `<div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;padding-left:4px;padding-bottom:4px;">` +
                        data.longSentences.map(s => {
                            const wc = s.split(/\s+/).filter(w => w.length > 0).length;
                            return `<div style="font-size:0.68rem;color:var(--color-text-secondary);line-height:1.5;border-left:2px solid var(--color-border-primary);padding-left:7px;">&ldquo;${s}&rdquo; <span style="color:${_longWcColor(wc)};white-space:nowrap;font-weight:600;">(${wc}w)</span></div>`;
                        }).join('') +
                    `</div></details>`
                : '';

            // Nominalisations — collapsible
            const nomDetailsHtml = ws.nominalisationMatches.length > 0
                ? `<details${ws.nominalisationMatches.length <= 3 ? ' open' : ''} style="margin-bottom:4px;">` +
                    `<summary style="font-size:0.72rem;font-weight:600;color:#d97706;cursor:pointer;list-style:none;padding:4px 0;">\u26a0\ufe0f ${ws.nominalisationCount} bureaucratic phrase${ws.nominalisationCount > 1 ? 's' : ''}</summary>` +
                    `<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;padding-bottom:4px;">` +
                        ws.nominalisationMatches.map(m =>
                            `<div style="font-size:0.67rem;line-height:1.4;display:flex;flex-wrap:wrap;gap:4px;align-items:baseline;border-left:2px solid #d97706;padding-left:7px;">` +
                                `<span style="color:#d97706;">&ldquo;${esc(m.found)}&rdquo;${m.count > 1 ? ` <span style="color:var(--color-text-muted);">\xd7${m.count}</span>` : ''}</span>` +
                                `<span style="color:var(--color-text-muted);">&rarr;</span>` +
                                `<span style="color:#059669;font-weight:600;">${esc(m.suggest)}</span>` +
                            `</div>`
                        ).join('') +
                    `</div></details>`
                : '';

            // Hedge words — collapsible
            const hedgeDetailsHtml = ws.hedgeCount > 5
                ? `<details style="margin-bottom:4px;">` +
                    `<summary style="font-size:0.72rem;font-weight:600;color:#d97706;cursor:pointer;list-style:none;padding:4px 0;">\u26a0\ufe0f ${ws.hedgeCount} hedge words</summary>` +
                    `<div style="font-size:0.67rem;color:var(--color-text-muted);margin-top:4px;padding-left:4px;padding-bottom:4px;">${ws.hedgeExamples.join(', ')}</div>` +
                    `</details>`
                : '';

            writingQualityHtml = `<div style="background: var(--color-bg-secondary); border-radius: 10px; padding: 11px 13px; border: 1px solid var(--color-border-primary); margin-bottom: 10px;">
                <div style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-secondary); margin-bottom: 7px;">Writing Quality</div>
                ${rhythmHtml}
                ${barsHtml}
                ${toneDialHtml}
                ${longSentDetailsHtml}
                ${nomDetailsHtml}
                ${hedgeDetailsHtml}
            </div>`;
        }

        const wordCountFmt = data.wordCount >= 1000 ? (data.wordCount / 1000).toFixed(1) + 'k' : String(data.wordCount);

        container.innerHTML = `
            ${data.isNoindex ? `<div style="background: var(--color-danger-bg); border: 1px solid var(--color-border-primary); border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; font-size: 0.75rem; font-weight: 700; color: #dc2626; text-align: center;">⛔ NOINDEX — Google will not index this page</div>` : ''}

            <!-- Section 2: Hero Panel — Score + Content Metadata -->
            <div style="background: var(--color-bg-secondary); border-radius: 10px; padding: 11px 13px; border: 2px solid ${scoreColor}; margin-bottom: 10px; display: flex; gap: 12px; align-items: flex-start;">
                <!-- Left: readability score (35%) -->
                <div style="flex: 0 0 35%; text-align: center; padding-right: 10px; border-right: 1px solid var(--color-border-primary);">
                    <div style="font-size: 0.55rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-secondary); margin-bottom: 4px;">Readability</div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: ${scoreColor}; line-height: 1;">
                        ${data.readabilityScore !== null ? data.readabilityScore : '—'}
                    </div>
                    <div style="font-size: 0.65rem; color: ${scoreColor}; font-weight: 700; margin-top: 2px; line-height: 1.2;">
                        ${grade ? grade.label : 'N/A'}
                    </div>
                    <div style="font-size: 0.6rem; color: var(--color-text-muted); margin-top: 2px;">Flesch-Kincaid</div>
                    ${data.avgSentenceLength !== null ? `<div style="font-size: 0.6rem; color: var(--color-text-muted); margin-top: 2px;">Avg sent: ${data.avgSentenceLength}w</div>` : ''}
                    ${data.avgSyllablesPerWord !== null ? `<div style="font-size: 0.6rem; color: var(--color-text-muted); margin-top: 1px;">Avg syl: ${data.avgSyllablesPerWord}/w</div>` : ''}
                    <div style="font-size: 0.55rem; color: var(--color-text-muted); margin-top: 4px; border-top: 1px solid var(--color-border-primary); padding-top: 3px;">Target: 60+</div>
                </div>
                <!-- Right: content metadata (65%) -->
                <div style="flex: 1; min-width: 0;">
                    ${data.h1Text
                        ? `<div style="font-size: 0.78rem; color: var(--color-text-primary); font-weight: 700; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${data.h1Text.replace(/"/g, '&quot;')}">H1: &ldquo;${data.h1Text}&rdquo;</div>`
                        : `<div style="font-size: 0.78rem; color: #dc2626; margin-bottom: 5px; font-weight: 700;">❌ No H1 found</div>`
                    }
                    ${data.titleText
                        ? `<div style="font-size: 0.7rem; color: var(--color-text-secondary); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${data.titleText.replace(/"/g, '&quot;')}"><span style="color: ${titleStatus.color}; font-weight: 600;">${titleStatus.icon} ${titleStatus.label}</span> <span style="color: var(--color-text-muted);">Title:</span> &ldquo;${data.titleText}&rdquo;</div>`
                        : `<div style="font-size: 0.7rem; color: #dc2626; margin-bottom: 6px; font-weight: 600;">❌ No title tag</div>`
                    }
                    <div style="font-size: 0.68rem; color: var(--color-text-secondary); display: flex; flex-wrap: wrap; gap: 4px 10px;">
                        <span>Words: <strong>${wordCountFmt}</strong></span>
                        <span>${data.readingTime} min</span>
                        <span>H2: <strong>${data.h2Count}</strong></span>
                        <span>H3: <strong>${data.h3Count}</strong></span>
                        ${data.h1Count > 1 ? `<span style="color: #d97706;">⚠️ ${data.h1Count} H1s</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- Section 3: Top Fixes -->
            ${topFixesHtml}

            <!-- Section 4: Writing Quality -->
            ${writingQualityHtml}

            <!-- Section 5: SEO Snapshot (merges SEO + Structured Data) -->
            <div style="background: var(--color-bg-secondary); border-radius: 10px; padding: 11px 13px; border: 1px solid var(--color-border-primary);">
                <div style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-secondary); margin-bottom: 8px;">SEO Snapshot</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; margin-bottom: 4px;">
                    <div>
                        <div style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px;">Meta</div>
                        <div style="font-size: 0.7rem; font-weight: 600; color: ${metaStatus.color};">${metaStatus.icon} ${metaStatus.label}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px;">Canonical</div>
                        <div style="font-size: 0.7rem; font-weight: 600; color: ${canonicalStatus.color};">${canonicalStatus.icon} ${canonicalStatus.label}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px;">Images</div>
                        <div style="font-size: 0.7rem; font-weight: 600; color: ${data.imageCount === 0 ? 'var(--color-text-muted)' : altColor};">${altLabel}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px;">Language</div>
                        <div style="font-size: 0.7rem; color: var(--color-text-secondary);">${data.pageLanguage ? `🌐 ${data.pageLanguage}` : '<span style="color: var(--color-text-muted);">— Not set</span>'}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px;">Links</div>
                        <div style="font-size: 0.7rem; color: var(--color-text-secondary);">${data.internalLinks} int &middot; ${data.externalLinks} ext${linkDensityLow ? ' <span style="color:#d97706;">⚠️</span>' : ''}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px;">Schema</div>
                        <div style="font-size: 0.7rem; line-height: 1.6;">${data.schemaTypes.length > 0 ? schemaBadgesHtml : '<span style="color: var(--color-text-muted);">— None</span>'}</div>
                    </div>
                </div>
                ${metaPreview}
            </div>
        `;
        wireDatamuseBadges(container);
    }

    // ─── AI Rewrite wiring ────────────────────────────────────────────────────

    function _buildPageContext(data) {
        if (!data) return '';
        var parts = [];
        if (data.titleText)                       parts.push('Page title: ' + data.titleText);
        if (data.h1Texts && data.h1Texts[0])      parts.push('H1: ' + data.h1Texts[0]);
        if (data.h2Texts && data.h2Texts.length)  parts.push('Key sections: ' + data.h2Texts.slice(0, 4).join(' | '));
        if (data.wordCount)                       parts.push('Word count: ' + data.wordCount);
        return parts.length ? '--- Page context ---\n' + parts.join('\n') + '\n---\n\n' : '';
    }

    // Parses numbered (1. / 1)) or bulleted (- / • / *) list from AI response text.
    // Returns array of stripped item strings. Handles varied model output formats.
    function _parseListItems(text) {
        var items = [];
        var lines = text.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i].trim();
            if (/^\d+[\.\)]\s+/.test(l))  items.push(l.replace(/^\d+[\.\)]\s+/, '').trim());
            else if (/^[-•*]\s+/.test(l)) items.push(l.replace(/^[-•*]\s+/, '').trim());
        }
        return items.filter(Boolean);
    }

    // Strips wrapping quotes from model output and enforces 155-char limit.
    function _cleanMetaDesc(text) {
        var t = text.trim().replace(/^["']|["']$/g, '');
        if (t.length > 155) t = t.slice(0, 152) + '...';
        return t;
    }

    // If buffer has parseable items, renders them as cards with a "partial" warning.
    // Returns true if partial content was rendered, false if buffer was empty/unparseable.
    function _recoverPartial(output, buffer, opts) {
        var items = _parseListItems(buffer);
        if (items.length > 0) {
            output.innerHTML = items.map(function(text) {
                return _buildCardHTML(text, opts);
            }).join('') +
            '<div style="font-size:0.75rem;color:var(--color-text-muted);padding:4px 2px;margin-top:4px;">⚠️ Stream interrupted — partial results shown.</div>';
            return true;
        }
        return false;
    }

    // Parses structured Query/Gap/Action blocks from search-intent AI output.
    // Returns array of { query, gap, action } objects.
    // Falls back gracefully if the model didn't follow the format.
    function _parseSearchIntentItems(text) {
        var items = [];
        // Split on lines that begin a new numbered item
        var chunks = text.split(/(?=^\d+\.)/m);
        chunks.forEach(function(chunk) {
            chunk = chunk.trim();
            if (!chunk) return;
            var q = chunk.match(/Query(?:\s+theme)?:\s*[""\u201c\u201d]?(.+?)[""\u201c\u201d]?\s*(?:\n|$)/i);
            var g = chunk.match(/Gap:\s*(.+?)(?:\n|$)/i);
            var ev = chunk.match(/Evidence:\s*(.+?)(?:\n|$)/i);
            var a = chunk.match(/Action:\s*(.+?)(?:\n|$)/i);
            if (q || g || a) {
                items.push({
                    query:    q  ? q[1].replace(/[""'']/g, '').trim() : '',
                    gap:      g  ? g[1].trim() : '',
                    evidence: ev ? ev[1].trim() : '',
                    action:   a  ? a[1].trim() : '',
                });
            }
        });
        return items;
    }

    // Renders a single structured search-intent card (Query / Gap / Action).
    // Returns HTML string. Copy text is the formatted Action line.
    function _buildSearchIntentCard(item) {
        var _e = function(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
        var opts  = AI_ISSUE_OPTS['search-intent'];
        var copyText = [
            item.query    ? 'Query: '    + item.query    : '',
            item.gap      ? 'Gap: '      + item.gap      : '',
            item.evidence ? 'Evidence: ' + item.evidence : '',
            item.action   ? 'Action: '   + item.action   : '',
        ].filter(Boolean).join('\n');
        return '<div class="pi-ai-card" style="border:1px solid ' + opts.border + ';background:' + opts.bg + ';border-radius:8px;padding:10px 12px;margin-bottom:8px;">' +
            '<div class="pi-ai-card-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
                '<span class="pi-ai-label" style="font-size:0.62rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:' + opts.color + ';background:' + opts.bg + ';border:1px solid ' + opts.border + ';border-radius:10px;padding:2px 8px;">' + opts.label + '</span>' +
                '<button class="pi-copy-btn" style="font-size:0.65rem;padding:2px 8px;border-radius:6px;border:1px solid ' + opts.border + ';color:' + opts.color + ';background:transparent;cursor:pointer;" data-copy="' + _e(copyText) + '">Copy</button>' +
            '</div>' +
            (item.query    ? '<div style="font-size:0.72rem;margin-bottom:4px;"><span style="font-weight:700;color:' + opts.color + ';">Query</span> <span style="color:var(--color-text-muted);">"' + _e(item.query) + '"</span></div>' : '') +
            (item.gap      ? '<div style="font-size:0.75rem;color:var(--color-text-secondary);margin-bottom:4px;"><span style="font-weight:700;color:var(--color-text-primary);">Gap</span> ' + _e(item.gap) + '</div>' : '') +
            (item.evidence ? '<div style="font-size:0.72rem;color:var(--color-text-muted);margin-bottom:6px;font-style:italic;"><span style="font-weight:700;font-style:normal;color:var(--color-text-secondary);">Evidence</span> ' + _e(item.evidence) + '</div>' : '') +
            (item.action   ? '<div style="font-size:0.8rem;color:var(--color-text-primary);"><span style="font-weight:700;">Action</span> ' + _e(item.action) + '</div>' : '') +
        '</div>';
    }

    function _buildLongSentencesPrompt(sentences, data) {
        const p = (window.GroqAI && window.GroqAI.getPrompt)
            ? window.GroqAI.getPrompt('long-sentences')
            : {
                system:     'You are a plain-language editor for citizensinformation.ie, an Irish government information website. Rewrite sentences to be shorter and clearer. Split long sentences into two shorter ones where helpful. Keep all key information. Use plain English. Respond with a numbered list only — one rewrite per number, matching the original order. Do not include any preamble or explanation.',
                userPrefix: 'Shorten these sentences. Number each rewrite:',
            };
        return [
            { role: 'system', content: p.system },
            { role: 'user',   content: _buildPageContext(data) + p.userPrefix + '\n\n' + sentences.slice(0, 8).map((s, i) => `${i + 1}. "${s}"`).join('\n') },
        ];
    }

    function _buildPassivePrompt(sentences, data) {
        const p = (window.GroqAI && window.GroqAI.getPrompt)
            ? window.GroqAI.getPrompt('passive-voice')
            : {
                system:     'You are a plain-language editor for citizensinformation.ie, an Irish government information website. Rewrite passive voice sentences in active voice. Start each sentence with the subject — who does the action. Keep all key information. Use plain English. Respond with a numbered list only — one rewrite per number. Do not include any preamble or explanation.',
                userPrefix: 'Rewrite these passive voice sentences in active voice. Number each rewrite:',
            };
        return [
            { role: 'system', content: p.system },
            { role: 'user',   content: _buildPageContext(data) + p.userPrefix + '\n\n' + sentences.slice(0, 8).map((s, i) => `${i + 1}. "${s}"`).join('\n') },
        ];
    }

    function _buildMetaDescPrompt(data) {
        const p = (window.GroqAI && window.GroqAI.getPrompt)
            ? window.GroqAI.getPrompt('meta-description')
            : { system: 'You are an SEO editor for citizensinformation.ie, an Irish government information website. Write a single meta description in plain English. Maximum 155 characters. It must be action-oriented, state the main topic clearly, and end without truncation. Output the meta description text only — no quotes, no label, no explanation.', userPrefix: 'Write a meta description for this page.' };
        const queryLine = (data._gsc && data._gsc.topQueries && data._gsc.topQueries.length)
            ? '\nTop search queries: ' + data._gsc.topQueries.slice(0, 5).map(function(q) { return '"' + q.query + '"'; }).join(', ')
            : '';
        const introExcerpt = (data.structuredBlocks || [])
            .filter(function(b) { return b.type === 'p'; })
            .slice(0, 1).map(function(b) { return b.text; })
            .join('').slice(0, 200);
        return [
            { role: 'system', content: p.system },
            { role: 'user',   content: p.userPrefix + '\n\n' +
                'Page title: ' + (data.titleText || '(none)') + '\n' +
                'Current meta description: ' + (data.metaDescText || '(none)') + '\n' +
                'Main headings: ' + ((data.h2Texts || []).slice(0, 3).join(' / ') || '(none)') + '\n' +
                'Word count: ' + (data.wordCount || 0) +
                (introExcerpt ? '\nPage intro: ' + introExcerpt : '') + queryLine
            },
        ];
    }

    function _buildTitleTagPrompt(data) {
        const p = (window.GroqAI && window.GroqAI.getPrompt)
            ? window.GroqAI.getPrompt('title-tag')
            : { system: 'You are an SEO editor for citizensinformation.ie, an Irish government information website. Suggest 3 alternative title tags. Each must be under 60 characters, in plain English, topic first, no clickbait. Output a numbered list only — one title per number. No preamble.', userPrefix: 'Suggest 3 alternative title tags. Number each:' };
        const queryLine = (data._gsc && data._gsc.topQueries && data._gsc.topQueries.length)
            ? '\nTop search queries: ' + data._gsc.topQueries.slice(0, 5).map(function(q) { return '"' + q.query + '"'; }).join(', ')
            : '';
        return [
            { role: 'system', content: p.system },
            { role: 'user',   content: p.userPrefix + '\n\n' +
                'Current title: ' + (data.titleText || '(none)') + '\n' +
                'H1: ' + ((data.h1Texts && data.h1Texts[0]) || '(none)') + '\n' +
                'Meta description: ' + (data.metaDescText || '(none)') + queryLine
            },
        ];
    }

    function _buildWeakAnchorsPrompt(weakLinks, data) {
        const p = (window.GroqAI && window.GroqAI.getPrompt)
            ? window.GroqAI.getPrompt('weak-anchors')
            : { system: 'You are a content editor for citizensinformation.ie, an Irish government information website. Each item is a generic hyperlink anchor text with its destination URL. Suggest descriptive replacement anchor text for each. Respond with a numbered list only — one suggestion per number, matching the original order. Keep each under 8 words. No preamble.', userPrefix: 'Suggest descriptive anchor text for each weak link. Number each:' };
        return [
            { role: 'system', content: p.system },
            { role: 'user',   content: _buildPageContext(data) + p.userPrefix + '\n\n' +
                weakLinks.slice(0, 8).map((lk, i) => `${i + 1}. "${lk.text}" → ${lk.href}`).join('\n')
            },
        ];
    }

    function _buildPageIntroPrompt(data) {
        const p = (window.GroqAI && window.GroqAI.getPrompt)
            ? window.GroqAI.getPrompt('page-intro')
            : { system: 'You are a plain-language editor for citizensinformation.ie, an Irish government information website. Rewrite the provided page introduction to be clearer, more direct, and action-oriented. The first sentence must state exactly what the page is about and who it helps. Use plain English. Keep all key information. Output the rewritten introduction only — no explanation.', userPrefix: 'Rewrite this page introduction to be clearer and more direct:' };
        const introText = (data.structuredBlocks || [])
            .filter(b => b.type === 'p')
            .slice(0, 3)
            .map(b => b.text)
            .join('\n\n')
            .slice(0, 1200);
        return [
            { role: 'system', content: p.system },
            { role: 'user',   content: _buildPageContext(data) + p.userPrefix + '\n\n' + introText },
        ];
    }

    function _buildHedgeWordsPrompt(data) {
        const p = (window.GroqAI && window.GroqAI.getPrompt)
            ? window.GroqAI.getPrompt('hedge-words')
            : { system: 'You are a plain-language editor for citizensinformation.ie, an Irish government information website. For each numbered hedge phrase shown with a context sentence, suggest a more direct and confident rewrite of that sentence without the hedge. Keep the meaning. Use plain English. Respond with a numbered list only — one rewrite per number. No preamble.', userPrefix: 'Rewrite these hedge phrases to be more direct. Number each:' };
        const hedgeAll  = (data.writingStyle && data.writingStyle.hedgeMatchesAll) || [];
        const sentences = data.sentenceTexts || [];
        const items = hedgeAll.slice(0, 6).map(function(h, i) {
            const phrase  = h.phrase.toLowerCase();
            const example = sentences.find(function(s) { return s.toLowerCase().indexOf(phrase) !== -1; });
            var line = (i + 1) + '. Phrase: "' + h.phrase + '"' + (h.count > 1 ? ' (\xd7' + h.count + ')' : '');
            if (example) line += '\n   Example: "' + example.slice(0, 160).trim() + '"';
            return line;
        });
        return [
            { role: 'system', content: p.system },
            { role: 'user',   content: _buildPageContext(data) + p.userPrefix + '\n\n' + items.join('\n') },
        ];
    }

    function _buildNominalisationsPrompt(data) {
        const p = (window.GroqAI && window.GroqAI.getPrompt)
            ? window.GroqAI.getPrompt('nominalisations')
            : { system: 'You are a plain-language editor for citizensinformation.ie, an Irish government information website. Each item shows a nominalisation (a verb idea turned into a noun phrase) and its verb-form replacement, plus an example sentence. Rewrite the example sentence to use the verb form naturally. Keep all meaning. Use plain English. Respond with a numbered list only — one rewrite per number. No preamble.', userPrefix: 'Rewrite each sentence to replace the nominalisation with the verb form. Number each:' };
        const nomAll   = (data.writingStyle && data.writingStyle.nominalisationMatchesAll) || [];
        const sentences = data.sentenceTexts || [];
        const items = nomAll.slice(0, 6).map(function(m, i) {
            const phrase  = m.found.toLowerCase();
            const example = sentences.find(function(s) { return s.toLowerCase().indexOf(phrase) !== -1; });
            var line = (i + 1) + '. "' + m.found + '" \u2192 use "' + m.suggest + '" instead' + (m.count > 1 ? ' (\xd7' + m.count + ')' : '');
            if (example) line += '\n   Example: "' + example.slice(0, 160).trim() + '"';
            return line;
        });
        return [
            { role: 'system', content: p.system },
            { role: 'user',   content: _buildPageContext(data) + p.userPrefix + '\n\n' + items.join('\n') },
        ];
    }

    function _buildSearchIntentPrompt(data) {
        const p = (window.GroqAI && window.GroqAI.getPrompt)
            ? window.GroqAI.getPrompt('search-intent')
            : { system: 'You are an SEO content strategist for citizensinformation.ie, an Irish government information website. You are given the top search queries bringing users to a page, the page\'s H2 headings, and the full body text. Identify queries whose topic or intent is NOT covered anywhere in the body text. Only flag a true gap — do NOT flag if the topic appears anywhere in the body text, even if it lacks a dedicated heading. For each genuine gap respond in exactly this format:\n\n1. Query: [the search query]\n   Gap: [what is missing — one sentence]\n   Action: [one specific editorial action, e.g. add H2 "X", rename heading "Y" to "Z", add intro sentence about X]\n\nMaximum 5 items. Use this format exactly. No preamble, no other text.', userPrefix: 'Identify content gaps. Use the Query / Gap / Action format for each:' };
        const queries = ((data._gsc && data._gsc.topQueries) || [])
            .slice().sort(function(a, b) { return b.impressions - a.impressions; })
            .slice(0, 10)
            .map(function(q, i) { return (i + 1) + '. "' + q.query + '" \u2014 ' + q.impressions + ' impressions, pos ' + q.position.toFixed(1) + ', CTR ' + (q.ctr * 100).toFixed(1) + '%'; })
            .join('\n');
        const headings = (data.h2Texts || []).map(function(h, i) { return (i + 1) + '. "' + h + '"'; }).join('\n') || '(no H2 headings)';
        // Use sentence texts for full coverage — much more comprehensive than just first few paragraphs
        const pageBody = (data.sentenceTexts && data.sentenceTexts.length)
            ? data.sentenceTexts.join(' ').slice(0, 5000)
            : (data.structuredBlocks || [])
                .filter(function(b) { return b.type === 'p'; })
                .map(function(b) { return b.text; })
                .join(' ')
                .slice(0, 5000);
        const userContent =
            _buildPageContext(data) + p.userPrefix + '\n\n' +
            '--- Top search queries ---\n' + queries + '\n\n' +
            '--- Current H2 headings ---\n' + headings + '\n\n' +
            '--- Full page body text ---\n' + (pageBody || '(none)');
        return [
            { role: 'system', content: p.system },
            { role: 'user',   content: userContent },
        ];
    }

    function _buildH2HeadingsPrompt(data) {
        const p = (window.GroqAI && window.GroqAI.getPrompt)
            ? window.GroqAI.getPrompt('h2-headings')
            : { system: 'You are a content editor for citizensinformation.ie, an Irish government information website. Rewrite each H2 heading to be clearer, more action-oriented, and user-focused. Use plain English. Keep each under 8 words. Respond with a numbered list only — one rewrite per number. No preamble.', userPrefix: 'Rewrite these H2 headings to be clearer. Number each:' };
        const h2s = (data.h2Texts || []).slice(0, 10);
        return [
            { role: 'system', content: p.system },
            { role: 'user',   content: _buildPageContext(data) + p.userPrefix + '\n\n' + h2s.map(function(h, i) { return (i + 1) + '. "' + h + '"'; }).join('\n') },
        ];
    }


    // Renders numbered nominalisation rewrite lines into a container element.
    // originals = nominalisationMatchesAll.slice(0,6) — provides found+suggest for each card.
    function _renderNomCards(mount, lines, originals) {
        var _e = function(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
        mount.style.display = '';
        mount.innerHTML = lines.map(function(l, i) {
            var text = l.replace(/^\d+\.\s*/, '').trim();
            var orig = originals[i];
            var extra = orig ? '<div style="font-size:0.67rem;color:var(--color-text-muted);margin-bottom:4px;">"' + _e(orig.found) + '" \u2192 ' + _e(orig.suggest) + '</div>' : '';
            _cacheAIResult('nominalisations', i, text);
            return _buildCardHTML(text, AI_ISSUE_OPTS['nominalisations'], extra);
        }).join('');
        mount.querySelectorAll('.pi-copy-btn').forEach(function(copyBtn, idx) {
            var text = lines[idx] ? lines[idx].replace(/^\d+\.\s*/, '').trim() : '';
            copyBtn.addEventListener('click', function() {
                navigator.clipboard.writeText(text).then(function() {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
                });
            });
        });
    }

    // Renders numbered hedge-word suggestion lines into a container element.
    // originals = hedgeMatchesAll.slice(0,6) — provides the original phrase for each card.
    var _HEDGE_KEEP_OPTS = { label: 'Hedge preserved', labelText: '\u2713 Hedge preserved', color: '#0891b2', bg: 'rgba(8,145,178,0.07)', border: 'rgba(8,145,178,0.25)' };

    function _renderHedgeCards(mount, lines, originals) {
        var _e = function(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
        mount.style.display = '';
        mount.innerHTML = lines.map(function(l, i) {
            var text  = l.replace(/^\d+\.\s*/, '').trim();
            var phrase = originals[i] ? '"' + _e(originals[i].phrase) + '"' : '';
            var extra  = phrase ? '<div style="font-size:0.67rem;color:var(--color-text-muted);margin-bottom:4px;">' + phrase + '</div>' : '';
            _cacheAIResult('hedge-words', i, text);
            var keepMatch = text.match(/^keep\s*[—\-]\s*/i);
            if (keepMatch) {
                var reason = text.slice(keepMatch[0].length).trim();
                return _buildCardHTML(reason, _HEDGE_KEEP_OPTS, extra);
            }
            return _buildCardHTML(text, AI_ISSUE_OPTS['hedge-words'], extra);
        }).join('');
        mount.querySelectorAll('.pi-copy-btn').forEach(function(copyBtn, idx) {
            var text = lines[idx] ? lines[idx].replace(/^\d+\.\s*/, '').trim() : '';
            copyBtn.addEventListener('click', function() {
                navigator.clipboard.writeText(text).then(function() {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
                });
            });
        });
    }

    // After _renderHedgeCards fills hedgeMount, move each card to appear immediately
    // after the first paragraph containing the matching hedge <mark> in the document body.
    // Hides hedgeMount once all cards are distributed.
    function _distributeHedgeCards(hedgeMount, hedgeAll, panel) {
        var body = panel.querySelector('.pi-doc-body');
        if (!body) return;
        var cards = Array.prototype.slice.call(hedgeMount.children);
        var marks = Array.prototype.slice.call(body.querySelectorAll('mark[data-overlay="hedge"]'));
        cards.forEach(function(card, i) {
            var phrase = hedgeAll[i] ? hedgeAll[i].phrase : null;
            if (!phrase) return;
            var phraseLower = phrase.toLowerCase();
            var targetMark = null;
            for (var m = 0; m < marks.length; m++) {
                if (marks[m].textContent.toLowerCase() === phraseLower) {
                    targetMark = marks[m]; break;
                }
            }
            if (!targetMark) return;
            // Walk up to find the direct child of .pi-doc-body
            var block = targetMark.parentElement;
            while (block && block.parentElement && block.parentElement !== body) {
                block = block.parentElement;
            }
            if (!block || block === body) return;
            var wrapper = document.createElement('div');
            wrapper.className = 'pi-doc-hedge-inline';
            wrapper.style.cssText = 'margin:2px 0 8px 0;';
            wrapper.appendChild(card);
            if (block.nextSibling) {
                block.parentNode.insertBefore(wrapper, block.nextSibling);
            } else {
                block.parentNode.appendChild(wrapper);
            }
        });
        hedgeMount.style.display = 'none';
        hedgeMount.innerHTML = '';
    }

    // Returns card HTML string.
    // opts  = AI_ISSUE_OPTS entry — adds colored issue pill and optional labelText override.
    // extra = optional HTML string inserted between header and body (e.g. original text line).
    function _buildCardHTML(text, opts, extra) {
        var _e = function(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
        var labelText = (opts && opts.labelText) ? opts.labelText : '✨ AI suggestion';
        var pill = (opts && opts.label)
            ? '<span style="font-size:0.6rem;font-weight:700;padding:2px 8px;border-radius:20px;' +
              'background:' + opts.bg + ';color:' + opts.color + ';border:1px solid ' + opts.border + ';' +
              'letter-spacing:0.3px;white-space:nowrap;">' + _e(opts.label) + '</span>'
            : '';
        return '<div class="pi-ai-card">' +
            '<div class="pi-ai-card-header">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
            '<span class="pi-ai-label">' + labelText + '</span>' + pill +
            '</div>' +
            '<button class="pi-copy-btn">Copy</button>' +
            '</div>' +
            (extra || '') +
            '<div class="pi-ai-card-body">' + _e(text) + '</div>' +
            '</div>';
    }

    // Renders a card into `el`, wires the Copy button, and handles display.
    function _renderAICard(el, text, opts) {
        el.style.display = '';
        el.innerHTML = _buildCardHTML(text, opts);
        var copyBtn = el.querySelector('.pi-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                navigator.clipboard.writeText(text).then(function() {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
                });
            });
        }
    }

    function _wireAISection(container, config) {
        if (!window.GroqAI) return;
        const mount = container.querySelector('#' + config.mountId);
        if (!mount) return;
        const sentences = (config.sentences || []).slice(0, 8);
        if (sentences.length === 0) return;
        const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        // Create an inline rewrite slot below each sentence row
        const slots = sentences.map((_, i) => {
            const row = container.querySelector('#' + config.rowIdPrefix + i);
            if (!row) return null;
            const slot = document.createElement('div');
            slot.className = 'pi-ai-inline-output';
            slot.style.display = 'none';
            if (config.cacheKey) slot.id = 'pi-ai-slot-' + config.cacheKey + '-' + i;
            row.after(slot);
            return slot;
        });

        // Small thinking indicator inside the mount (below button)
        const thinking = document.createElement('div');
        thinking.className = 'pi-ai-thinking';
        thinking.style.display = 'none';
        thinking.textContent = '⏳ Generating rewrites…';

        const btn = document.createElement('button');
        btn.className   = 'pi-ai-btn';
        btn.textContent = '✨ Rewrite with AI';

        mount.appendChild(btn);
        mount.appendChild(thinking);

        function runStream() {
            if (!window.GroqAI.isConfigured()) {
                window.GroqAI.showSettings();
                return;
            }

            // Reset all slots
            slots.forEach(slot => {
                if (slot) { slot.style.display = 'none'; slot.innerHTML = ''; }
            });

            btn.disabled    = true;
            btn.textContent = 'Generating…';
            thinking.style.display = '';

            const messages = config.buildPrompt(sentences, config.data);
            let buffer       = '';
            let injectedCount = 0;

            function injectItem(index, text) {
                const slot = slots[index];
                if (!slot) return;
                const opts = config.cacheKey ? AI_ISSUE_OPTS[config.cacheKey] : null;
                _renderAICard(slot, text, opts);
                // Auto-open parent <details> so results are visible even when collapsed
                var det = slot.closest('details');
                if (det) det.open = true;
                // Cache and mirror to Document tab slot (if it exists)
                if (config.cacheKey) {
                    _cacheAIResult(config.cacheKey, index, text);
                    var docSlot = document.getElementById('pi-doc-slot-' + config.cacheKey + '-' + index);
                    if (docSlot) {
                        var docPair = docSlot.parentElement;
                        if (docPair) docPair.style.opacity = '0.65';
                        _renderAICard(docSlot, text, opts);
                    }
                }
            }

            function tryInjectNext() {
                var nextMarker = '\n' + (injectedCount + 2) + '.';
                var idx = buffer.indexOf(nextMarker);
                if (idx !== -1) {
                    var itemBlock = buffer.substring(0, idx);
                    var match = itemBlock.match(/^\d+\.\s+([\s\S]+)$/);
                    if (match) {
                        injectItem(injectedCount, match[1].trim());
                        injectedCount++;
                    }
                    buffer = buffer.substring(idx + 1);
                    tryInjectNext();
                }
            }

            window.GroqAI.stream(
                messages,
                function(token) {
                    buffer += token;
                    tryInjectNext();
                },
                function() {
                    // Inject last remaining item
                    var match = buffer.match(/^\d+\.\s+([\s\S]+)$/);
                    if (match) injectItem(injectedCount, match[1].trim());
                    thinking.style.display = 'none';
                    btn.disabled    = false;
                    btn.textContent = '↺ Regenerate';
                },
                function(err) {
                    thinking.style.display = 'none';
                    // Show error in first slot (or mount if no slots)
                    var errTarget = slots[0] || mount;
                    errTarget.style.display = '';
                    errTarget.innerHTML = `<div class="pi-ai-error">❌ ${esc(err && err.message ? err.message : 'Something went wrong.')}</div>`;
                    btn.disabled    = false;
                    btn.textContent = '✨ Rewrite with AI';
                },
                { max_tokens: 1024, temperature: 0.4 }
            );
        }

        btn.addEventListener('click', runStream);
    }

    function wireAIRewrites(container, data) {
        if (!window.GroqAI) return;
        const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        _wireAISection(container, {
            mountId:      'pi-long-sentences-ai',
            rowIdPrefix:  'pi-sent-long-',
            sentences:    data.longSentencesAll || data.longSentences || [],
            buildPrompt:  _buildLongSentencesPrompt,
            data:         data,
            cacheKey:     'long-sentences',
        });
        _wireAISection(container, {
            mountId:      'pi-passive-ai',
            rowIdPrefix:  'pi-sent-pass-',
            sentences:    (data.writingStyle && (data.writingStyle.passiveSentenceExamplesAll || data.writingStyle.passiveSentenceExamples)) || [],
            buildPrompt:  _buildPassivePrompt,
            data:         data,
            cacheKey:     'passive-voice',
        });

        // ── Meta description ──
        (function() {
            const mount = container.querySelector('#pi-meta-desc-ai');
            if (!mount) return;
            const btn = document.createElement('button');
            btn.className = 'pi-ai-btn';
            btn.textContent = '✨ Rewrite meta description';
            const output = document.createElement('div');
            output.className = 'pi-ai-output';
            output.style.display = 'none';
            mount.appendChild(btn);
            mount.appendChild(output);
            var _abortCtrl = null;
            btn.addEventListener('click', async function() {
                if (!window.GroqAI.isConfigured()) { window.GroqAI.showSettings(); return; }
                if (_abortCtrl) { _abortCtrl.abort(); }
                _abortCtrl = new AbortController();
                btn.disabled = true; btn.textContent = 'Generating…';
                output.style.display = 'none'; output.innerHTML = '';
                try {
                    const result = await window.GroqAI.complete(_buildMetaDescPrompt(data), { signal: _abortCtrl.signal, max_tokens: 200, temperature: 0.5 });
                    _abortCtrl = null;
                    const text = _cleanMetaDesc(result);
                    _renderAICard(output, text, AI_ISSUE_OPTS['meta-desc']);
                    _cacheAIResult('meta-desc', 0, text);
                    var docMetaMount = document.getElementById('pi-doc-meta-ai');
                    if (docMetaMount) _renderAICard(docMetaMount, text, AI_ISSUE_OPTS['meta-desc']);
                    btn.disabled = false; btn.textContent = '↺ Regenerate';
                } catch (err) {
                    _abortCtrl = null;
                    if (err && err.name === 'AbortError') return;
                    output.style.display = '';
                    output.innerHTML = '<div class="pi-ai-error">❌ ' + esc(err && err.message ? err.message : 'Something went wrong.') + '</div>';
                    btn.disabled = false; btn.textContent = '✨ Rewrite meta description';
                }
            });
        })();

        // ── Title tag suggestions ──
        (function() {
            const mount = container.querySelector('#pi-title-tag-ai');
            if (!mount || !data.titleText) return;
            const btn = document.createElement('button');
            btn.className = 'pi-ai-btn';
            btn.textContent = '✨ Suggest title tags';
            const output = document.createElement('div');
            output.className = 'pi-ai-output';
            output.style.cssText = 'display:none;white-space:pre-wrap;';
            mount.appendChild(btn);
            mount.appendChild(output);
            var _abortCtrl = null;
            btn.addEventListener('click', function() {
                if (!window.GroqAI.isConfigured()) { window.GroqAI.showSettings(); return; }
                if (_abortCtrl) { _abortCtrl.abort(); }
                _abortCtrl = new AbortController();
                btn.disabled = true; btn.textContent = 'Generating…';
                output.style.display = ''; output.textContent = '⏳ Thinking…';
                let buffer = '';
                window.GroqAI.stream(
                    _buildTitleTagPrompt(data),
                    function(token) {
                        if (output.textContent === '⏳ Thinking…') output.textContent = '';
                        buffer += token;
                        output.textContent = buffer;
                    },
                    function() {
                        const items = _parseListItems(buffer);
                        if (items.length > 0) {
                            output.innerHTML = items.map((text, i) => {
                                return _buildCardHTML(text, Object.assign({}, AI_ISSUE_OPTS['title-tag'], { labelText: '✨ Option ' + (i + 1) }));
                            }).join('');
                            output.querySelectorAll('.pi-copy-btn').forEach(function(copyBtn, idx) {
                                copyBtn.addEventListener('click', function() {
                                    navigator.clipboard.writeText(items[idx] || '').then(() => { copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500); });
                                });
                            });
                        } else if (buffer.trim()) {
                            output.innerHTML = '<div style="font-size:0.82rem;color:var(--color-text-primary);padding:8px 4px;line-height:1.6;white-space:pre-wrap;">' + esc(buffer.trim()) + '</div>';
                        }
                        _abortCtrl = null; btn.disabled = false; btn.textContent = '↺ Regenerate';
                    },
                    function(err) {
                        _abortCtrl = null;
                        if (!_recoverPartial(output, buffer, AI_ISSUE_OPTS['title-tag'])) {
                            output.innerHTML = '<div class="pi-ai-error">❌ ' + esc(err && err.message ? err.message : 'Something went wrong.') + '</div>';
                        }
                        btn.disabled = false; btn.textContent = '✨ Suggest title tags';
                    },
                    { signal: _abortCtrl.signal, max_tokens: 200, temperature: 0.6 }
                );
            });
        })();

        // ── Weak anchor text ──
        (function() {
            const mount = container.querySelector('#pi-weak-anchors-ai');
            if (!mount) return;
            const weakLinks = [...(data.internalLinkData || []), ...(data.externalLinkData || [])]
                .filter(lk => !lk.isImageLink)
                .filter(lk => { const t = (lk.text || '').toLowerCase().trim(); return GENERIC_ANCHOR_TEXTS.has(t) || (t.length <= 2 && t.length > 0); })
                .slice(0, 8);
            if (weakLinks.length === 0) return;
            const btn = document.createElement('button');
            btn.className = 'pi-ai-btn';
            btn.textContent = '✨ Suggest anchor text';
            const output = document.createElement('div');
            output.className = 'pi-ai-output';
            output.style.display = 'none';
            mount.appendChild(btn);
            mount.appendChild(output);
            var _abortCtrl = null;
            btn.addEventListener('click', function() {
                if (!window.GroqAI.isConfigured()) { window.GroqAI.showSettings(); return; }
                if (_abortCtrl) { _abortCtrl.abort(); }
                _abortCtrl = new AbortController();
                btn.disabled = true; btn.textContent = 'Generating…';
                output.style.display = ''; output.textContent = '⏳ Thinking…';
                let buffer = '';
                window.GroqAI.stream(
                    _buildWeakAnchorsPrompt(weakLinks, data),
                    function(token) {
                        if (output.textContent === '⏳ Thinking…') output.textContent = '';
                        buffer += token;
                        output.textContent = buffer;
                    },
                    function() {
                        const items = _parseListItems(buffer);
                        if (items.length > 0) {
                            output.innerHTML = items.map((suggestion, i) => {
                                const original = weakLinks[i] ? '"' + esc(weakLinks[i].text) + '"' : '';
                                const extra = original ? '<div style="font-size:0.67rem;color:var(--color-text-muted);margin-bottom:4px;">' + original + ' →</div>' : '';
                                return _buildCardHTML(suggestion, AI_ISSUE_OPTS['weak-anchors'], extra);
                            }).join('');
                            output.querySelectorAll('.pi-copy-btn').forEach(function(copyBtn, idx) {
                                copyBtn.addEventListener('click', function() {
                                    navigator.clipboard.writeText(items[idx] || '').then(() => { copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500); });
                                });
                            });
                        } else if (buffer.trim()) {
                            output.innerHTML = '<div style="font-size:0.82rem;color:var(--color-text-primary);padding:8px 4px;line-height:1.6;white-space:pre-wrap;">' + esc(buffer.trim()) + '</div>';
                        }
                        _abortCtrl = null; btn.disabled = false; btn.textContent = '↺ Regenerate';
                    },
                    function(err) {
                        _abortCtrl = null;
                        if (!_recoverPartial(output, buffer, AI_ISSUE_OPTS['weak-anchors'])) {
                            output.innerHTML = '<div class="pi-ai-error">❌ ' + esc(err && err.message ? err.message : 'Something went wrong.') + '</div>';
                        }
                        btn.disabled = false; btn.textContent = '✨ Suggest anchor text';
                    },
                    { signal: _abortCtrl.signal, max_tokens: 300, temperature: 0.4 }
                );
            });
        })();

        // ── Hedge words ──
        (function() {
            const mount = container.querySelector('#pi-hedge-ai');
            if (!mount) return;
            const hedgeAll = (data.writingStyle && data.writingStyle.hedgeMatchesAll) || [];
            if (hedgeAll.length === 0) return;
            const btn = document.createElement('button');
            btn.className = 'pi-ai-btn';
            btn.textContent = '✨ Suggest direct alternatives';
            const output = document.createElement('div');
            output.id = 'pi-hedge-ai-output';
            output.style.cssText = 'margin-top:6px;';
            mount.appendChild(btn);
            mount.appendChild(output);
            var _abortCtrl = null;
            btn.addEventListener('click', function() {
                if (!window.GroqAI.isConfigured()) { window.GroqAI.showSettings(); return; }
                if (_abortCtrl) { _abortCtrl.abort(); }
                _abortCtrl = new AbortController();
                btn.disabled = true; btn.textContent = 'Generating…';
                output.innerHTML = '';
                let buffer = '';
                window.GroqAI.stream(
                    _buildHedgeWordsPrompt(data),
                    function(token) { buffer += token; },
                    function() {
                        const items = _parseListItems(buffer);
                        if (items.length > 0) {
                            const originals = hedgeAll.slice(0, 6);
                            _renderHedgeCards(output, items, originals);
                            var docHedgeMount = document.getElementById('pi-doc-hedge-ai');
                            if (docHedgeMount) _renderHedgeCards(docHedgeMount, items, originals);
                        } else if (buffer.trim()) {
                            output.innerHTML = '<div style="font-size:0.82rem;color:var(--color-text-primary);padding:8px 4px;line-height:1.6;white-space:pre-wrap;">' + esc(buffer.trim()) + '</div>';
                        }
                        _abortCtrl = null; btn.disabled = false; btn.textContent = '↺ Regenerate';
                    },
                    function(err) {
                        _abortCtrl = null;
                        if (!_recoverPartial(output, buffer, AI_ISSUE_OPTS['hedge-words'])) {
                            output.innerHTML = '<div class="pi-ai-error">❌ ' + esc(err && err.message ? err.message : 'Something went wrong.') + '</div>';
                        }
                        btn.disabled = false; btn.textContent = '✨ Suggest direct alternatives';
                    },
                    { signal: _abortCtrl.signal, max_tokens: 600, temperature: 0.4 }
                );
            });
        })();

        // ── Nominalisations ──
        (function() {
            const mount = container.querySelector('#pi-nom-ai');
            if (!mount) return;
            const nomAll = (data.writingStyle && data.writingStyle.nominalisationMatchesAll) || [];
            if (nomAll.length === 0) return;
            const btn = document.createElement('button');
            btn.className = 'pi-ai-btn';
            btn.textContent = '✨ Rewrite sentences';
            const output = document.createElement('div');
            output.id = 'pi-nom-ai-output';
            output.style.cssText = 'margin-top:6px;';
            mount.appendChild(btn);
            mount.appendChild(output);
            var _abortCtrl = null;
            btn.addEventListener('click', function() {
                if (!window.GroqAI.isConfigured()) { window.GroqAI.showSettings(); return; }
                if (_abortCtrl) { _abortCtrl.abort(); }
                _abortCtrl = new AbortController();
                btn.disabled = true; btn.textContent = 'Generating…';
                output.innerHTML = '';
                let buffer = '';
                window.GroqAI.stream(
                    _buildNominalisationsPrompt(data),
                    function(token) { buffer += token; },
                    function() {
                        const items = _parseListItems(buffer);
                        if (items.length > 0) {
                            const originals = nomAll.slice(0, 6);
                            _renderNomCards(output, items, originals);
                            var docNomMount = document.getElementById('pi-doc-nom-ai');
                            if (docNomMount) _renderNomCards(docNomMount, items, originals);
                        } else if (buffer.trim()) {
                            output.innerHTML = '<div style="font-size:0.82rem;color:var(--color-text-primary);padding:8px 4px;line-height:1.6;white-space:pre-wrap;">' + esc(buffer.trim()) + '</div>';
                        }
                        _abortCtrl = null; btn.disabled = false; btn.textContent = '↺ Regenerate';
                    },
                    function(err) {
                        _abortCtrl = null;
                        if (!_recoverPartial(output, buffer, AI_ISSUE_OPTS['nominalisations'])) {
                            output.innerHTML = '<div class="pi-ai-error">❌ ' + esc(err && err.message ? err.message : 'Something went wrong.') + '</div>';
                        }
                        btn.disabled = false; btn.textContent = '✨ Rewrite sentences';
                    },
                    { signal: _abortCtrl.signal, max_tokens: 600, temperature: 0.4 }
                );
            });
        })();

        // ── H2 headings ──
        (function() {
            const mount = container.querySelector('#pi-h2-ai');
            if (!mount) return;
            const h2s = data.h2Texts || [];
            if (h2s.length === 0) return;
            const btn = document.createElement('button');
            btn.className = 'pi-ai-btn';
            btn.textContent = '✨ Rewrite headings';
            const output = document.createElement('div');
            output.style.cssText = 'margin-top:6px;';
            mount.appendChild(btn);
            mount.appendChild(output);
            var _abortCtrl = null;
            btn.addEventListener('click', function() {
                if (!window.GroqAI.isConfigured()) { window.GroqAI.showSettings(); return; }
                if (_abortCtrl) { _abortCtrl.abort(); }
                _abortCtrl = new AbortController();
                btn.disabled = true; btn.textContent = 'Generating…';
                output.innerHTML = '';
                let buffer = '';
                window.GroqAI.stream(
                    _buildH2HeadingsPrompt(data),
                    function(token) { buffer += token; },
                    function() {
                        const items = _parseListItems(buffer);
                        if (items.length > 0) {
                            output.innerHTML = items.map((text, i) => {
                                const original = h2s[i] ? '"' + esc(h2s[i]) + '"' : '';
                                const extra = original ? '<div style="font-size:0.67rem;color:var(--color-text-muted);margin-bottom:4px;">' + original + '</div>' : '';
                                return _buildCardHTML(text, AI_ISSUE_OPTS['h2-headings'], extra);
                            }).join('');
                            output.querySelectorAll('.pi-copy-btn').forEach(function(copyBtn, idx) {
                                copyBtn.addEventListener('click', function() {
                                    navigator.clipboard.writeText(items[idx] || '').then(() => { copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500); });
                                });
                            });
                        } else if (buffer.trim()) {
                            output.innerHTML = '<div style="font-size:0.82rem;color:var(--color-text-primary);padding:8px 4px;line-height:1.6;white-space:pre-wrap;">' + esc(buffer.trim()) + '</div>';
                        }
                        _abortCtrl = null; btn.disabled = false; btn.textContent = '↺ Regenerate';
                    },
                    function(err) {
                        _abortCtrl = null;
                        if (!_recoverPartial(output, buffer, AI_ISSUE_OPTS['h2-headings'])) {
                            output.innerHTML = '<div class="pi-ai-error">❌ ' + esc(err && err.message ? err.message : 'Something went wrong.') + '</div>';
                        }
                        btn.disabled = false; btn.textContent = '✨ Rewrite headings';
                    },
                    { signal: _abortCtrl.signal, max_tokens: 400, temperature: 0.5 }
                );
            });
        })();

        // ── Search Intent ──
        (function() {
            const mount = container.querySelector('#pi-search-intent-ai');
            if (!mount || !data._gsc || !(data._gsc.topQueries || []).length) return;
            const btn = document.createElement('button');
            btn.className = 'pi-ai-btn';
            btn.textContent = '✨ Analyse content gaps';
            const output = document.createElement('div');
            output.style.cssText = 'margin-top:8px;';
            mount.appendChild(btn);
            mount.appendChild(output);
            var _abortCtrl = null;
            btn.addEventListener('click', function() {
                if (!window.GroqAI.isConfigured()) { window.GroqAI.showSettings(); return; }
                if (_abortCtrl) { _abortCtrl.abort(); }
                _abortCtrl = new AbortController();
                btn.disabled = true; btn.textContent = 'Analysing…';
                output.innerHTML = '';
                var buffer = '';
                window.GroqAI.stream(
                    _buildSearchIntentPrompt(data),
                    function(token) { buffer += token; },
                    function() {
                        var structured = _parseSearchIntentItems(buffer);
                        if (structured.length > 0) {
                            output.innerHTML = structured.map(function(item) {
                                return _buildSearchIntentCard(item);
                            }).join('');
                            output.querySelectorAll('.pi-copy-btn').forEach(function(copyBtn) {
                                var text = copyBtn.getAttribute('data-copy') || '';
                                copyBtn.addEventListener('click', function() {
                                    navigator.clipboard.writeText(text).then(function() {
                                        copyBtn.textContent = 'Copied!'; setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
                                    });
                                });
                            });
                        } else {
                            // Fallback: model didn't use structured format — try plain list
                            var plain = _parseListItems(buffer);
                            if (plain.length > 0) {
                                output.innerHTML = plain.map(function(text) {
                                    return _buildCardHTML(text, AI_ISSUE_OPTS['search-intent']);
                                }).join('');
                                output.querySelectorAll('.pi-copy-btn').forEach(function(copyBtn, idx) {
                                    copyBtn.addEventListener('click', function() {
                                        navigator.clipboard.writeText(plain[idx] || '').then(function() {
                                            copyBtn.textContent = 'Copied!'; setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
                                        });
                                    });
                                });
                            } else {
                                output.innerHTML = '<div style="font-size:0.8rem;color:var(--color-text-muted);padding:6px 0;">No content gaps identified — the page appears to address its top queries well.</div>';
                            }
                        }
                        _abortCtrl = null; btn.disabled = false; btn.textContent = '↺ Re-analyse';
                    },
                    function(err) {
                        _abortCtrl = null;
                        if (!_recoverPartial(output, buffer, AI_ISSUE_OPTS['search-intent'])) {
                            output.innerHTML = '<div class="pi-ai-error">❌ ' + esc(err && err.message ? err.message : 'Something went wrong.') + '</div>';
                        }
                        btn.disabled = false; btn.textContent = '✨ Analyse content gaps';
                    },
                    { signal: _abortCtrl.signal, max_tokens: 800, temperature: 0.4 }
                );
            });
        })();
    }

    async function renderContentTab(container, url) {
        if (!url) {
            container.innerHTML = `<div style="text-align: center; padding: 28px; color: var(--color-text-muted); font-size: 0.85rem;">No URL for this node.</div>`;
            return;
        }
        renderLoading(container);
        try {
            const data = await analyseUrl(url);
            renderResults(container, data, url);
        } catch (err) {
            renderError(container, url, err.message);
        }
    }

    // ─── Annotated Document View ─────────────────────────────────────────────

    function renderAnnotatedView(data) {
        const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        if (!data.sentenceTexts || data.sentenceTexts.length === 0 || !data.writingStyle) {
            return '<div style="padding:40px;text-align:center;color:var(--color-text-muted);font-size:0.85rem;">No sentence data available for document view.</div>';
        }
        const ws = data.writingStyle;
        const passiveSet = new Set((ws.passiveSentenceExamplesAll || []).map(s => s.trim()));
        const complexSet = new Set((ws.complexWordListAll || []).map(w => w.toLowerCase()));
        const hedgeList  = (ws.hedgeMatchesAll || []).map(h => h.phrase.toLowerCase());
        const nominList  = (ws.nominalisationMatchesAll || []).map(n => ({ found: n.found.toLowerCase(), suggest: n.suggest }));
        const adverbSet  = new Set((ws.adverbsAll || []).map(s => s.replace(/ ×\d+$/, '').toLowerCase()));
        const h2Set = new Set((data.h2Texts || []).map(h => h.trim().toLowerCase()));
        const h3Set = new Set((data.h3Texts || []).map(h => h.trim().toLowerCase()));

        // Prefer longer matches when multiple patterns could match
        nominList.sort((a, b) => b.found.length - a.found.length);
        hedgeList.sort((a, b) => b.length - a.length);

        const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        function annotateText(text) {
            const matches = [];
            for (const { found, suggest } of nominList) {
                const re = new RegExp(escRe(found), 'gi');
                let m;
                while ((m = re.exec(text)) !== null) {
                    matches.push({ start: m.index, end: m.index + m[0].length, type: 'nominalisation', text: m[0], suggest });
                }
            }
            for (const phrase of hedgeList) {
                const re = new RegExp('\\b' + escRe(phrase) + '\\b', 'gi');
                let m;
                while ((m = re.exec(text)) !== null) {
                    matches.push({ start: m.index, end: m.index + m[0].length, type: 'hedge', text: m[0] });
                }
            }
            const wordRe = /\b([a-zA-Z]+)\b/g;
            let wm;
            while ((wm = wordRe.exec(text)) !== null) {
                if (complexSet.has(wm[1].toLowerCase())) {
                    matches.push({ start: wm.index, end: wm.index + wm[1].length, type: 'complex', text: wm[1] });
                }
            }
            // Transition words/phrases
            const transRe = new RegExp(TRANSITION_PATTERN.source, 'gi');
            let tm;
            while ((tm = transRe.exec(text)) !== null) {
                matches.push({ start: tm.index, end: tm.index + tm[0].length, type: 'transition', text: tm[0] });
            }
            // Direct address
            const daRe = /\b(you|your|yours|yourself)\b/gi;
            let dm;
            while ((dm = daRe.exec(text)) !== null) {
                matches.push({ start: dm.index, end: dm.index + dm[0].length, type: 'directaddress', text: dm[0] });
            }
            // Adverbs
            const advRe = /\b([a-zA-Z]+)\b/g;
            let am;
            while ((am = advRe.exec(text)) !== null) {
                if (adverbSet.has(am[1].toLowerCase())) {
                    const after = text.slice(am.index + am[1].length);
                    const nextWordMatch = after.match(/^\s+([a-zA-Z]+)/);
                    const nextWord = nextWordMatch ? nextWordMatch[1].toLowerCase() : '';
                    if (!COMMON_NOUNS.has(nextWord)) {
                        matches.push({ start: am.index, end: am.index + am[1].length, type: 'adverb', text: am[1] });
                    }
                }
            }
            // Sort by position; for ties prefer longest match
            matches.sort((a, b) => a.start !== b.start ? a.start - b.start : (b.end - b.start) - (a.end - a.start));
            // Remove overlapping spans (keep first/longest at each position)
            const filtered = [];
            let lastEnd = 0;
            for (const m of matches) {
                if (m.start >= lastEnd) { filtered.push(m); lastEnd = m.end; }
            }
            let html = '', pos = 0;
            for (const m of filtered) {
                html += esc(text.slice(pos, m.start));
                if (m.type === 'complex') {
                    const alts = PLAIN_ALTS[m.text.toLowerCase()];
                    const titleStr = alts ? `Try: ${alts.join(', ')}` : '';
                    const dm = alts ? '' : ` data-datamuse-word="${esc(m.text.toLowerCase())}"`;
                    html += `<mark data-overlay="complex" title="${esc(titleStr)}"${dm}>${esc(m.text)}</mark>`;
                } else if (m.type === 'hedge') {
                    html += `<mark data-overlay="hedge" title="Hedge word \u2014 be more direct: remove or replace \u2018${esc(m.text)}\u2019">${esc(m.text)}</mark>`;
                } else if (m.type === 'transition') {
                    html += `<mark data-overlay="transition" title="Transition word \u2014 good: shows logical flow between ideas">${esc(m.text)}</mark>`;
                } else if (m.type === 'directaddress') {
                    html += `<mark data-overlay="directaddress" title="Direct address \u2014 good: speaks directly to the reader">${esc(m.text)}</mark>`;
                } else if (m.type === 'adverb') {
                    html += `<mark data-overlay="adverb" title="Adverb \u2014 consider a stronger verb instead (e.g. \u2018walked quickly\u2019 \u2192 \u2018strode\u2019)">${esc(m.text)}</mark>`;
                } else {
                    html += `<mark data-overlay="nominalisation" title="Nominalisation \u2014 use the verb form instead: ${esc(m.suggest)}">${esc(m.text)}</mark>`;
                }
                pos = m.end;
            }
            html += esc(text.slice(pos));
            return html;
        }

        const sentTexts    = data.sentenceTexts;
        const sentLens     = data.sentenceLengths;
        const longCount       = (data.longSentencesAll || data.longSentences || []).length;
        const long30Count     = sentLens.filter(l => l >= 30).length;
        const long40Count     = sentLens.filter(l => l >= 40).length;
        const passiveCount    = ws.passiveSentenceCount || 0;
        const complexCount    = ws.complexWordCount || 0;
        const hedgeCount      = ws.hedgeCount || 0;
        const nomCount        = ws.nominalisationCount || 0;
        const transitionCount = ws.transitionHits || 0;
        const directAddrCount = ws.youYourCount || 0;
        const adverbCount     = ws.adverbCount || 0;
        const zoneColor    = len => len < 10 ? '#16a34a' : len <= 20 ? '#d97706' : len < 30 ? '#dc2626' : len < 40 ? '#b91c1c' : '#7f1d1d';
        const zoneClass    = len => len < 10 ? 'short'   : len <= 20 ? 'medium'  : len < 30 ? 'long'    : len < 40 ? 'long30'  : 'long40';

        function renderSentences(text) {
            const sents = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 2);
            if (!sents.length) sents.push(text);
            const buf = [];
            for (const s of sents) {
                const t = s.trim();
                const len = t.split(/\s+/).filter(w => w.length > 0).length;
                if (!len) continue;
                const isPassive = passiveSet.has(t) ? '1' : '0';
                buf.push(
                    `<div class="pi-sent" data-len="${len}" data-len-zone="${zoneClass(len)}" data-passive="${isPassive}"` +
                    ` style="position:relative;display:flex;align-items:baseline;gap:8px;padding:4px 8px;margin-bottom:2px;border-left:3px solid ${zoneColor(len)};">` +
                    `<span class="pi-sent-text" style="flex:1;font-size:0.88rem;line-height:1.7;color:var(--color-text-secondary);">${annotateText(t)}</span>` +
                    `<span class="pi-sent-wc" style="opacity:0;transition:opacity 0.15s;font-size:0.65rem;color:var(--color-text-muted);white-space:nowrap;flex-shrink:0;font-weight:600;">${len}w</span>` +
                    `</div>`
                );
            }
            return `<p class="pi-para" style="margin:0 0 18px 0;padding:0;">${buf.join('')}</p>`;
        }

        function renderBlock(block) {
            switch (block.type) {
                case 'h1': return `<h1 style="font-size:1.25rem;font-weight:800;color:var(--color-text-heading);margin:24px 0 12px 0;padding:0;">${esc(block.text)}</h1>`;
                case 'h2': return `<h2 style="font-size:1.05rem;font-weight:700;color:var(--color-text-primary);margin:22px 0 10px 0;padding:6px 10px;border-left:4px solid #0891b2;background:var(--color-bg-secondary);border-radius:0 6px 6px 0;">${esc(block.text)}</h2>`;
                case 'h3': return `<h3 style="font-size:0.92rem;font-weight:600;color:var(--color-text-secondary);margin:16px 0 8px 0;padding:4px 10px;border-left:3px solid var(--color-border-primary);border-radius:0 4px 4px 0;">${esc(block.text)}</h3>`;
                case 'h4': return `<h4 style="font-size:0.85rem;font-weight:600;color:var(--color-text-muted);margin:12px 0 6px 0;padding:3px 8px;">${esc(block.text)}</h4>`;
                case 'p': return renderSentences(block.text);
                case 'ul':
                case 'ol': {
                    const tag = block.type;
                    const items = block.items.map(item =>
                        `<li class="pi-list-item">${annotateText(item)}</li>`
                    ).join('');
                    return `<${tag} class="pi-list">${items}</${tag}>`;
                }
                case 'table': {
                    if (!block.rows.length) return '';
                    let html = '';
                    const cols = block.rows[0].length;
                    let colgroup = '<colgroup>';
                    for (let c = 0; c < cols; c++) colgroup += '<col>';
                    colgroup += '</colgroup>';
                    block.rows.forEach((row, ri) => {
                        const isHead = block.hasHeader && ri === 0;
                        html += '<tr>' + row.map(cell =>
                            isHead
                                ? `<th>${esc(cell)}</th>`
                                : `<td>${annotateText(cell)}</td>`
                        ).join('') + '</tr>';
                    });
                    return `<div style="overflow-x:auto;margin-bottom:18px;"><table class="pi-table">${colgroup}${html}</table></div>`;
                }
                case 'blockquote':
                    return `<div class="pi-blockquote">${annotateText(block.text)}</div>`;
                case 'dl': {
                    const pairs = block.items.map(({ term, def }) =>
                        `<dt class="pi-dt">${esc(term)}</dt><dd class="pi-dd">${annotateText(def)}</dd>`
                    ).join('');
                    return `<dl class="pi-dl">${pairs}</dl>`;
                }
                default: return '';
            }
        }

        let bodyHtml;
        if (data.structuredBlocks && data.structuredBlocks.length > 0) {
            bodyHtml = data.structuredBlocks.map(renderBlock).join('');
        } else {
            // Fallback: flat sentence loop (for old cache entries without structuredBlocks)
            const bodyParts = [];
            let paraBuf = [];
            function flushPara() {
                if (!paraBuf.length) return;
                bodyParts.push(`<p class="pi-para" style="margin:0 0 18px 0;padding:0;">${paraBuf.join('')}</p>`);
                paraBuf = [];
            }
            for (let i = 0; i < sentTexts.length; i++) {
                const text = sentTexts[i].trim();
                const len  = sentLens[i] || 0;
                if (!text) continue;
                const textLower = text.toLowerCase();
                const isH2 = h2Set.has(textLower);
                const isH3 = !isH2 && h3Set.has(textLower);
                if (isH2 || isH3) {
                    flushPara();
                    const hStyle = isH2
                        ? 'font-size:1.05rem;font-weight:700;color:var(--color-text-primary);margin:22px 0 10px 0;padding:6px 10px;border-left:4px solid #0891b2;background:var(--color-bg-secondary);border-radius:0 6px 6px 0;'
                        : 'font-size:0.92rem;font-weight:600;color:var(--color-text-secondary);margin:16px 0 8px 0;padding:4px 10px;border-left:3px solid var(--color-border-primary);border-radius:0 4px 4px 0;';
                    bodyParts.push(`<${isH2 ? 'h2' : 'h3'} style="${hStyle}">${esc(text)}</${isH2 ? 'h2' : 'h3'}>`);
                    continue;
                }
                if (len === 0) continue;
                const isPassive = passiveSet.has(text) ? '1' : '0';
                paraBuf.push(
                    `<div class="pi-sent" data-len="${len}" data-len-zone="${zoneClass(len)}" data-passive="${isPassive}"` +
                    ` style="position:relative;display:flex;align-items:baseline;gap:8px;padding:4px 8px;margin-bottom:2px;border-left:3px solid ${zoneColor(len)};">` +
                    `<span class="pi-sent-text" style="flex:1;font-size:0.88rem;line-height:1.7;color:var(--color-text-secondary);">${annotateText(text)}</span>` +
                    `<span class="pi-sent-wc" style="opacity:0;transition:opacity 0.15s;font-size:0.65rem;color:var(--color-text-muted);white-space:nowrap;flex-shrink:0;font-weight:600;">${len}w</span>` +
                    `</div>`
                );
                if (paraBuf.length >= 4) flushPara();
            }
            flushPara();
            bodyHtml = bodyParts.join('');
        }

        const css = `<style>
.pi-doc-wrap mark[data-overlay="complex"]{text-decoration:underline 2px #6366f1;background:transparent;cursor:help;border-radius:2px;}
.pi-doc-wrap mark[data-overlay="hedge"]{background:rgba(234,179,8,0.18);border-radius:2px;}
.pi-doc-wrap mark[data-overlay="nominalisation"]{background:rgba(234,88,12,0.15);border-radius:2px;}
.pi-doc-wrap .pi-sent[data-passive="1"]{background:rgba(251,146,60,0.07);}
.pi-doc-wrap:not(.show-complex) mark[data-overlay="complex"]{text-decoration:none;}
.pi-doc-wrap:not(.show-hedge) mark[data-overlay="hedge"]{background:transparent;}
.pi-doc-wrap:not(.show-nominalisation) mark[data-overlay="nominalisation"]{background:transparent;}
.pi-doc-wrap:not(.show-passive) .pi-sent[data-passive="1"]{background:transparent!important;}
.pi-doc-wrap:not(.show-long) .pi-sent[data-len-zone="long"],
.pi-doc-wrap:not(.show-long) .pi-sent[data-len-zone="long30"],
.pi-doc-wrap:not(.show-long) .pi-sent[data-len-zone="long40"]{border-left-color:var(--color-border-primary)!important;}
.pi-sent:hover .pi-sent-wc{opacity:1!important;}
.pi-overlay-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;border:1.5px solid var(--color-border-primary);background:var(--color-bg-secondary);color:var(--color-text-muted);font-size:0.72rem;font-weight:600;cursor:pointer;transition:all 0.15s;font-family:inherit;}
.pi-overlay-btn.active[data-overlay="long"]{color:#dc2626;border-color:#dc2626;background:rgba(220,38,38,0.07);}
.pi-overlay-btn.active[data-overlay="passive"]{color:#f97316;border-color:#f97316;background:rgba(249,115,22,0.07);}
.pi-overlay-btn.active[data-overlay="complex"]{color:#6366f1;border-color:#6366f1;background:rgba(99,102,241,0.07);}
.pi-overlay-btn.active[data-overlay="hedge"]{color:#ca8a04;border-color:#ca8a04;background:rgba(202,138,4,0.07);}
.pi-overlay-btn.active[data-overlay="nominalisation"]{color:#ea580c;border-color:#ea580c;background:rgba(234,88,12,0.07);}
.pi-overlay-btn.active[data-overlay="transition"]{color:#16a34a;border-color:#16a34a;background:rgba(22,163,74,0.07);}
.pi-overlay-btn.active[data-overlay="directaddress"]{color:#0891b2;border-color:#0891b2;background:rgba(8,145,178,0.07);}
.pi-overlay-btn.active[data-overlay="adverb"]{color:#7c3aed;border-color:#7c3aed;background:rgba(124,58,237,0.07);}
.pi-doc-wrap mark[data-overlay="transition"]{background:rgba(22,163,74,0.18);border-radius:2px;}
.pi-doc-wrap mark[data-overlay="directaddress"]{background:rgba(6,182,212,0.15);border-radius:2px;}
.pi-doc-wrap mark[data-overlay="adverb"]{background:rgba(168,85,247,0.15);border-radius:2px;}
.pi-doc-wrap:not(.show-transition) mark[data-overlay="transition"]{background:transparent;}
.pi-doc-wrap:not(.show-directaddress) mark[data-overlay="directaddress"]{background:transparent;}
.pi-doc-wrap:not(.show-adverb) mark[data-overlay="adverb"]{background:transparent;}
.pi-badge{display:inline-block;padding:0 5px;font-size:0.62rem;font-weight:700;line-height:1.4;min-width:16px;text-align:center;border-radius:10px;color:white;}
.pi-list { margin: 0 0 18px 0; padding-left: 28px; }
.pi-list-item { font-size: 0.88rem; line-height: 1.7; color: var(--color-text-secondary); margin-bottom: 5px; padding: 1px 4px; }
.pi-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.pi-table th { background: var(--color-bg-secondary); font-weight: 600; color: var(--color-text-primary); padding: 6px 10px; border: 1px solid var(--color-border-primary); text-align: left; }
.pi-table td { padding: 5px 10px; border: 1px solid var(--color-border-primary); color: var(--color-text-secondary); vertical-align: top; line-height: 1.5; }
.pi-table tr:nth-child(even) td { background: var(--color-bg-secondary); }
.pi-blockquote { margin: 0 0 18px 0; padding: 10px 16px; border-left: 4px solid var(--color-border-primary); background: var(--color-bg-secondary); font-style: italic; color: var(--color-text-secondary); font-size: 0.88rem; line-height: 1.7; border-radius: 0 6px 6px 0; }
.pi-dl { margin: 0 0 18px 0; }
.pi-dt { font-weight: 600; color: var(--color-text-primary); font-size: 0.85rem; margin-top: 10px; }
.pi-dd { margin: 2px 0 8px 20px; font-size: 0.83rem; color: var(--color-text-secondary); line-height: 1.6; }
</style>`;

        const toolbar =
            `<div class="pi-doc-toolbar" style="display:flex;align-items:flex-start;gap:0;padding:8px 0 14px 0;border-bottom:1px solid var(--color-border-primary);margin-bottom:14px;position:sticky;top:0;background:var(--color-bg-primary);z-index:5;">` +
            `<div class="pi-doc-toolbar-filters" style="display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:0;">` +
            `<button class="pi-overlay-btn active" data-overlay="long" title="Sentences over 20 words. Aim for under 20 words each.">Long sentences <span class="pi-badge" style="background:#dc2626;">${longCount}</span>${long30Count > 0 ? `<span style="font-size:0.65rem;color:var(--color-text-muted);margin-left:1px;">30+&thinsp;<span style="color:#b91c1c;font-weight:700;">${long30Count}</span>${long40Count > 0 ? `&ensp;40+&thinsp;<span style="color:#7f1d1d;font-weight:700;">${long40Count}</span>` : ''}</span>` : ''}</button>` +
            `<button class="pi-overlay-btn active" data-overlay="passive" title="Passive constructions. Rewrite as active: \u2018The team fixed it\u2019 not \u2018It was fixed by the team\u2019.">Passive voice <span class="pi-badge" style="background:#f97316;">${passiveCount}</span></button>` +
            `<button class="pi-overlay-btn active" data-overlay="complex" title="Uncommon or long words. Hover a highlighted word for simpler alternatives.">Complex words <span class="pi-badge" style="background:#6366f1;">${complexCount}</span></button>` +
            `<button class="pi-overlay-btn active" data-overlay="hedge" title="Vague, non-committal language (might, possibly, could). Be more direct and specific.">Hedge words <span class="pi-badge" style="background:#ca8a04;">${hedgeCount}</span></button>` +
            `<button class="pi-overlay-btn active" data-overlay="nominalisation" title="Verb ideas turned into nouns (discussion of \u2192 discuss). Use the verb form.">Nominalisations <span class="pi-badge" style="background:#ea580c;">${nomCount}</span></button>` +
            `<button class="pi-overlay-btn active" data-overlay="transition" title="Words that connect ideas (however, therefore, also). Good \u2014 target: >15% of sentences.">Transitions <span class="pi-badge" style="background:#16a34a;">${transitionCount}</span></button>` +
            `<button class="pi-overlay-btn active" data-overlay="directaddress" title="Words that speak to the reader (you, your). Good \u2014 target: \u22652% of words.">Direct address <span class="pi-badge" style="background:#0891b2;">${directAddrCount}</span></button>` +
            `<button class="pi-overlay-btn active" data-overlay="adverb" title="Words ending in -ly. Replace with stronger verbs where possible. Target: <5% of words.">Adverbs (-ly) <span class="pi-badge" style="background:#7c3aed;">${adverbCount}</span></button>` +
            `<button class="pi-doc-clear-filters" title="Reset all overlays to visible">\u2715 Clear all</button>` +
            `</div>` +
            `<div class="pi-doc-fab-group"></div>` +
            `</div>`;

        const swatchBox = (bg) => `<span style="display:inline-block;width:12px;height:12px;background:${bg};border-radius:2px;vertical-align:middle;flex-shrink:0;"></span>`;
        const keyRow = (swatch, name, desc) =>
            `<div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;">` +
            swatch +
            `<span><strong style="color:var(--color-text-primary);font-weight:600;">${name}</strong> ` +
            `<span style="color:var(--color-text-muted);">${desc}</span></span>` +
            `</div>`;
        const legend =
            `<details style="margin-bottom:14px;font-size:0.7rem;">` +
            `<summary style="cursor:pointer;color:var(--color-text-muted);font-size:0.68rem;user-select:none;list-style:none;display:inline-flex;align-items:center;gap:4px;">` +
            `<span style="font-size:0.65rem;">&#9654;</span> Show key</summary>` +
            `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0 24px;margin-top:8px;padding:10px 12px;background:var(--color-bg-secondary);border-radius:6px;border:1px solid var(--color-border-primary);">` +
            keyRow(swatchBox('rgba(220,38,38,0.25)'),   'Long sentences',  'Sentences over 20 words \u2014 aim for shorter, clearer sentences') +
            keyRow(swatchBox('rgba(249,115,22,0.2)'),   'Passive voice',   '\u201cIt was done by\u2026\u201d \u2014 rewrite as active voice') +
            keyRow(swatchBox('rgba(99,102,241,0.18)'),  'Complex words',   'Hover for simpler alternatives') +
            keyRow(swatchBox('rgba(234,179,8,0.3)'),    'Hedge words',     'Vague language \u2014 be direct and specific') +
            keyRow(swatchBox('rgba(234,88,12,0.2)'),    'Nominalisations', 'Noun form of a verb \u2014 use the verb instead') +
            keyRow(swatchBox('rgba(22,163,74,0.25)'),   'Transitions',     'Connecting words \u2014 shows good logical structure (target >15% of sentences)') +
            keyRow(swatchBox('rgba(6,182,212,0.2)'),    'Direct address',  'You/your \u2014 good: speaks directly to the reader (target \u22652%)') +
            keyRow(swatchBox('rgba(168,85,247,0.2)'),   'Adverbs (-ly)',   'Replace with a stronger verb where possible (target <5%)') +
            `</div></details>`;

        const metaCharCount = data.metaDescText ? data.metaDescText.length : 0;
        const metaCharNote = metaCharCount > 155
            ? ' &mdash; <strong style="color:#dc2626;">too long</strong>'
            : metaCharCount > 0 && metaCharCount < 70
                ? ' &mdash; <span style="color:#ca8a04;">too short</span>'
                : '';
        const metaBanner = data.metaDescText
            ? `<div class="pi-doc-meta-banner">
                   <div class="pi-doc-meta-header">
                       <span class="pi-doc-meta-label">Meta description</span>
                       <span class="pi-doc-meta-chars">${metaCharCount} chars${metaCharNote}</span>
                   </div>
                   <p class="pi-doc-meta-text">${esc(data.metaDescText)}</p>
                   <div id="pi-doc-meta-ai"></div>
               </div>`
            : `<div class="pi-doc-meta-banner pi-doc-meta-banner--empty">
                   <div class="pi-doc-meta-header">
                       <span class="pi-doc-meta-label">Meta description</span>
                   </div>
                   <p class="pi-doc-meta-missing">No meta description set &mdash; this page won&rsquo;t display a preview snippet in search results.</p>
                   <div id="pi-doc-meta-ai"></div>
               </div>`;

        return css +
            `<div class="pi-doc-wrap show-long show-passive show-complex show-hedge show-nominalisation show-transition show-directaddress show-adverb" style="padding:0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">` +
            toolbar + legend + metaBanner +
            `<div id="pi-doc-hedge-ai" style="display:none;margin:0 0 14px 0;"></div>` +
            `<div id="pi-doc-nom-ai" style="display:none;margin:0 0 14px 0;"></div>` +
            `<div class="pi-doc-body" style="max-width:780px;">${bodyHtml}</div>` +
            `</div>`;
    }

    function wireDocumentOverlays(panel) {
        const wrap = panel.querySelector('.pi-doc-wrap');
        if (!wrap) return;
        panel.querySelectorAll('.pi-overlay-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cls = 'show-' + btn.dataset.overlay;
                if (wrap.classList.contains(cls)) {
                    wrap.classList.remove(cls);
                    btn.classList.remove('active');
                } else {
                    wrap.classList.add(cls);
                    btn.classList.add('active');
                }
            });
        });
        const clearFiltersBtn = panel.querySelector('.pi-doc-clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', function() {
                ['long','passive','complex','hedge','nominalisation','transition','directaddress','adverb'].forEach(function(ov) {
                    wrap.classList.remove('show-' + ov);
                });
                panel.querySelectorAll('.pi-overlay-btn').forEach(function(b) { b.classList.remove('active'); });
            });
        }
        wireDatamuseBadges(panel);
    }

    // ─── Document tab AI wiring ───────────────────────────────────────────────

    function _runDocStream(pairs, messages, cacheKey, onDone, onError, signal) {
        var buffer = '';
        var injectedCount = 0;

        function injectItem(index, text) {
            var pair = pairs[index];
            if (!pair) return;
            var opts = cacheKey ? AI_ISSUE_OPTS[cacheKey] : null;
            pair.el.style.opacity = '0.65';
            _renderAICard(pair.slot, text, opts);
            // Cache and mirror to Analysis tab slot
            if (cacheKey) {
                _cacheAIResult(cacheKey, index, text);
                var analysisSlot = document.getElementById('pi-ai-slot-' + cacheKey + '-' + index);
                if (analysisSlot) {
                    _renderAICard(analysisSlot, text, opts);
                    // Auto-open any collapsed <details> ancestor so results are visible
                    var det = analysisSlot.closest('details');
                    if (det) det.open = true;
                }
            }
        }

        function tryInjectNext() {
            var nextMarker = '\n' + (injectedCount + 2) + '.';
            var idx = buffer.indexOf(nextMarker);
            if (idx !== -1) {
                var itemBlock = buffer.substring(0, idx);
                var match = itemBlock.match(/^\d+\.\s+([\s\S]+)$/);
                if (match) {
                    injectItem(injectedCount, match[1].trim());
                    injectedCount++;
                }
                buffer = buffer.substring(idx + 1);
                tryInjectNext();
            }
        }

        window.GroqAI.stream(
            messages,
            function(token) { buffer += token; tryInjectNext(); },
            function() {
                var match = buffer.match(/^\d+\.\s+([\s\S]+)$/);
                if (match) injectItem(injectedCount, match[1].trim());
                onDone();
            },
            function(err) {
                if (pairs[0]) {
                    pairs[0].slot.style.display = '';
                    pairs[0].slot.innerHTML = '<div class="pi-ai-error">❌ ' + (err && err.message ? err.message : 'Something went wrong.') + '</div>';
                }
                onDone(); // still signal done so the counter completes
            },
            { signal: signal || undefined, max_tokens: 1024, temperature: 0.4 }
        );
    }

    function wireDocumentAIReview(panel, data) {
        if (!window.GroqAI) return;
        var toolbar = panel.querySelector('.pi-doc-toolbar');
        if (!toolbar) return;
        var fabGroup = panel.querySelector('.pi-doc-fab-group') || toolbar;

        var esc = function(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };

        // Collect flagged sentences (cap at 8 each)
        var longEls    = Array.prototype.slice.call(panel.querySelectorAll('.pi-sent[data-len-zone^="long"]')).slice(0, 8);
        var passiveEls = Array.prototype.slice.call(panel.querySelectorAll('.pi-sent[data-passive="1"]')).slice(0, 8);

        // Create inline slots after each sentence, with stable IDs for cross-tab mirroring
        function makeSlot(el, cacheKey, index) {
            var slot = document.createElement('div');
            slot.className = 'pi-doc-ai-slot';
            slot.style.display = 'none';
            slot.id = 'pi-doc-slot-' + cacheKey + '-' + index;
            el.after(slot);
            return { el: el, slot: slot };
        }
        var longPairs    = longEls.map(function(el, i) { return makeSlot(el, 'long-sentences', i); });
        var passivePairs = passiveEls.map(function(el, i) { return makeSlot(el, 'passive-voice', i); });
        var totalSents   = longPairs.length + passivePairs.length;

        // FAB controls — mounted in the right-side FAB group
        var reviewBtn = document.createElement('button');
        reviewBtn.className = 'pi-doc-fab';
        var _reviewAbortCtrl = null;   // shared controller for all 4 FAB streams

        var progress = document.createElement('div');
        progress.className = 'pi-doc-toolbar-progress';
        progress.style.display = 'none';

        var clearLink = document.createElement('button');
        clearLink.className = 'pi-doc-toolbar-clear';
        clearLink.textContent = 'Clear suggestions';
        clearLink.style.display = 'none';

        fabGroup.appendChild(reviewBtn);
        fabGroup.appendChild(progress);
        fabGroup.appendChild(clearLink);

        var hedgeAll = (data.writingStyle && data.writingStyle.hedgeMatchesAll) || [];
        var hedgeMount = panel.querySelector('#pi-doc-hedge-ai');
        var nomAll   = (data.writingStyle && data.writingStyle.nominalisationMatchesAll) || [];
        var nomMount = panel.querySelector('#pi-doc-nom-ai');

        // Pre-fill any results already generated in the Analysis tab
        var anyPrefilled = false;
        longPairs.forEach(function(pair, i) {
            var cached = _getCachedAIResult('long-sentences', i);
            if (cached) { pair.el.style.opacity = '0.65'; _renderAICard(pair.slot, cached, AI_ISSUE_OPTS['long-sentences']); anyPrefilled = true; }
        });
        passivePairs.forEach(function(pair, i) {
            var cached = _getCachedAIResult('passive-voice', i);
            if (cached) { pair.el.style.opacity = '0.65'; _renderAICard(pair.slot, cached, AI_ISSUE_OPTS['passive-voice']); anyPrefilled = true; }
        });
        if (hedgeMount && hedgeAll.length > 0) {
            var hedgeCached = [];
            for (var _hi = 0; _hi < hedgeAll.length; _hi++) {
                var _hc = _getCachedAIResult('hedge-words', _hi);
                if (!_hc) break;
                hedgeCached.push({ phrase: hedgeAll[_hi].phrase, text: _hc });
            }
            if (hedgeCached.length > 0) {
                var fakeLines = hedgeCached.map(function(h, i) { return (i + 1) + '. ' + h.text; });
                _renderHedgeCards(hedgeMount, fakeLines, hedgeAll.slice(0, hedgeCached.length));
                _distributeHedgeCards(hedgeMount, hedgeAll.slice(0, hedgeCached.length), panel);
                anyPrefilled = true;
            }
        }
        if (nomMount && nomAll.length > 0) {
            var nomCached = [];
            for (var _ni = 0; _ni < nomAll.length; _ni++) {
                var _nc = _getCachedAIResult('nominalisations', _ni);
                if (!_nc) break;
                nomCached.push(_nc);
            }
            if (nomCached.length > 0) {
                var nomFakeLines = nomCached.map(function(t, i) { return (i + 1) + '. ' + t; });
                _renderNomCards(nomMount, nomFakeLines, nomAll.slice(0, nomCached.length));
                anyPrefilled = true;
            }
        }
        if (anyPrefilled) {
            clearLink.style.display = '';
            reviewBtn.textContent = '↺ Re-review';
        }

        // Pre-fill meta desc from Analysis tab cache
        var metaMountEarly = panel.querySelector('#pi-doc-meta-ai');
        if (metaMountEarly) {
            var cachedMeta = _getCachedAIResult('meta-desc', 0);
            if (cachedMeta) _renderAICard(metaMountEarly, cachedMeta, AI_ISSUE_OPTS['meta-desc']);
        }

        if (totalSents === 0) {
            reviewBtn.textContent = '✨ AI Review';
            reviewBtn.disabled = true;
            reviewBtn.title = 'No long or passive sentences found';
            return;
        }

        reviewBtn.textContent = '✨ AI Review';

        clearLink.addEventListener('click', function() {
            longPairs.concat(passivePairs).forEach(function(pair) {
                pair.el.style.opacity = '';
                pair.slot.style.display = 'none';
                pair.slot.innerHTML = '';
            });
            if (hedgeMount) { hedgeMount.style.display = 'none'; hedgeMount.innerHTML = ''; }
            panel.querySelectorAll('.pi-doc-hedge-inline').forEach(function(el) { el.remove(); });
            if (nomMount)   { nomMount.style.display = 'none';   nomMount.innerHTML = '';   }
            clearLink.style.display = 'none';
            reviewBtn.textContent = '✨ AI Review';
        });

        reviewBtn.addEventListener('click', function() {
            if (!window.GroqAI.isConfigured()) { window.GroqAI.showSettings(); return; }
            if (_reviewAbortCtrl) { _reviewAbortCtrl.abort(); }
            _reviewAbortCtrl = new AbortController();

            // Reset
            longPairs.concat(passivePairs).forEach(function(pair) {
                pair.el.style.opacity = '';
                pair.slot.style.display = 'none';
                pair.slot.innerHTML = '';
            });
            if (hedgeMount) { hedgeMount.style.display = 'none'; hedgeMount.innerHTML = ''; }
            panel.querySelectorAll('.pi-doc-hedge-inline').forEach(function(el) { el.remove(); });
            if (nomMount)   { nomMount.style.display = 'none';   nomMount.innerHTML = '';   }
            clearLink.style.display = 'none';
            reviewBtn.disabled = true;
            reviewBtn.textContent = 'Reviewing…';
            var extras = [];
            if (hedgeAll.length > 0) extras.push('hedge words');
            if (nomAll.length > 0)   extras.push('nominalisations');
            progress.textContent = 'Reviewing ' + totalSents + ' sentence' + (totalSents !== 1 ? 's' : '') + (extras.length > 0 ? ' + ' + extras.join(' & ') : '') + '…';
            progress.style.display = '';

            var doneCount = 0;
            var totalStreams = 4; // long, passive, hedge, nom — each calls onAllDone even if skipped
            function onAllDone() {
                doneCount++;
                if (doneCount >= totalStreams) {
                    _reviewAbortCtrl = null;
                    reviewBtn.disabled = false;
                    reviewBtn.textContent = '↺ Re-review';
                    progress.style.display = 'none';
                    clearLink.style.display = '';
                }
            }

            var longTexts    = longEls.map(function(el) { return el.querySelector('.pi-sent-text').textContent.trim(); });
            var passiveTexts = passiveEls.map(function(el) { return el.querySelector('.pi-sent-text').textContent.trim(); });

            // Run all four streams concurrently
            var _sig = _reviewAbortCtrl ? _reviewAbortCtrl.signal : undefined;
            if (longPairs.length > 0) {
                _runDocStream(longPairs, _buildLongSentencesPrompt(longTexts, data), 'long-sentences', onAllDone, onAllDone, _sig);
            } else {
                onAllDone();
            }
            if (passivePairs.length > 0) {
                _runDocStream(passivePairs, _buildPassivePrompt(passiveTexts, data), 'passive-voice', onAllDone, onAllDone, _sig);
            } else {
                onAllDone();
            }
            if (hedgeAll.length > 0 && hedgeMount) {
                hedgeMount.style.display = '';
                hedgeMount.innerHTML = '<em style="font-size:0.78rem;color:var(--color-text-muted);">⏳ Reviewing hedge words…</em>';
                var hBuffer = '';
                window.GroqAI.stream(
                    _buildHedgeWordsPrompt(data),
                    function(token) { hBuffer += token; },
                    function() {
                        var items = _parseListItems(hBuffer);
                        if (items.length > 0) {
                            _renderHedgeCards(hedgeMount, items, hedgeAll.slice(0, 6));
                            _distributeHedgeCards(hedgeMount, hedgeAll.slice(0, 6), panel);
                            var analysisHedgeOutput = document.getElementById('pi-hedge-ai-output');
                            if (analysisHedgeOutput) _renderHedgeCards(analysisHedgeOutput, items, hedgeAll.slice(0, 6));
                        } else {
                            hedgeMount.style.display = 'none';
                        }
                        onAllDone();
                    },
                    function(err) {
                        if (!_recoverPartial(hedgeMount, hBuffer, AI_ISSUE_OPTS['hedge-words'])) {
                            hedgeMount.style.display = 'none';
                        }
                        onAllDone();
                    },
                    { signal: _sig, max_tokens: 600, temperature: 0.4 }
                );
            } else {
                onAllDone();
            }
            if (nomAll.length > 0 && nomMount) {
                nomMount.style.display = '';
                nomMount.innerHTML = '<em style="font-size:0.78rem;color:var(--color-text-muted);">⏳ Reviewing nominalisations…</em>';
                var nBuffer = '';
                window.GroqAI.stream(
                    _buildNominalisationsPrompt(data),
                    function(token) { nBuffer += token; },
                    function() {
                        var items = _parseListItems(nBuffer);
                        if (items.length > 0) {
                            _renderNomCards(nomMount, items, nomAll.slice(0, 6));
                            var analysisNomOutput = document.getElementById('pi-nom-ai-output');
                            if (analysisNomOutput) _renderNomCards(analysisNomOutput, items, nomAll.slice(0, 6));
                        } else {
                            nomMount.style.display = 'none';
                        }
                        onAllDone();
                    },
                    function(err) {
                        if (!_recoverPartial(nomMount, nBuffer, AI_ISSUE_OPTS['nominalisations'])) {
                            nomMount.style.display = 'none';
                        }
                        onAllDone();
                    },
                    { signal: _sig, max_tokens: 600, temperature: 0.4 }
                );
            } else {
                onAllDone();
            }
        });

        // ── Rewrite intro button ──
        var introBlocks = (data.structuredBlocks || []).filter(function(b) { return b.type === 'p'; });
        if (introBlocks.length > 0) {
            var introBtn = document.createElement('button');
            introBtn.className = 'pi-doc-fab pi-doc-fab-intro';
            introBtn.textContent = '✨ Rewrite intro';
            fabGroup.insertBefore(introBtn, clearLink);

            // Output area — inserted before the document body
            var docBody = panel.querySelector('.pi-doc-body');
            var introOutput = document.createElement('div');
            introOutput.className = 'pi-doc-intro-output';
            introOutput.style.display = 'none';
            if (docBody) docBody.parentNode.insertBefore(introOutput, docBody);

            var _introAbortCtrl = null;
            introBtn.addEventListener('click', function() {
                if (!window.GroqAI.isConfigured()) { window.GroqAI.showSettings(); return; }
                if (_introAbortCtrl) { _introAbortCtrl.abort(); }
                _introAbortCtrl = new AbortController();
                introBtn.disabled = true;
                introBtn.textContent = 'Rewriting…';
                introOutput.style.display = '';
                introOutput.innerHTML = '<em style="color:var(--color-text-muted);font-size:0.8rem;">⏳ Thinking…</em>';

                var introText = introBlocks.slice(0, 3).map(function(b) { return b.text; }).join('\n\n');
                var buffer = '';
                window.GroqAI.stream(
                    _buildPageIntroPrompt(data),
                    function(token) {
                        buffer += token;
                        if (introOutput.querySelector('em')) introOutput.innerHTML = '';
                        introOutput.textContent = buffer;
                    },
                    function() {
                        var finalText = buffer;
                        introOutput.style.whiteSpace = '';
                        introOutput.innerHTML =
                            '<div class="pi-ai-card-header" style="margin-bottom:8px;"><span class="pi-ai-label" style="color:#6366f1;">✨ Rewritten introduction</span><button class="pi-copy-btn" style="border-color:rgba(99,102,241,0.4);color:#6366f1;background:rgba(99,102,241,0.07);">Copy</button></div>' +
                            '<div style="font-size:0.85rem;line-height:1.7;color:var(--color-text-primary);word-break:break-word;">' + esc(finalText) + '</div>';
                        introOutput.querySelector('.pi-copy-btn').addEventListener('click', function() {
                            navigator.clipboard.writeText(finalText).then(function() {
                                introOutput.querySelector('.pi-copy-btn').textContent = 'Copied!';
                                setTimeout(function() { introOutput.querySelector('.pi-copy-btn').textContent = 'Copy'; }, 1500);
                            });
                        });
                        _introAbortCtrl = null;
                        introBtn.disabled = false;
                        introBtn.textContent = '↺ Rewrite intro';
                    },
                    function(err) {
                        _introAbortCtrl = null;
                        introOutput.innerHTML = '<div class="pi-ai-error">❌ ' + esc(err && err.message ? err.message : 'Something went wrong.') + '</div>';
                        introBtn.disabled = false;
                        introBtn.textContent = '✨ Rewrite intro';
                    },
                    { signal: _introAbortCtrl.signal, max_tokens: 400, temperature: 0.5 }
                );
            });
        }

        // ── Meta description rewrite in Document tab ──
        (function() {
            var metaBanner = panel.querySelector('.pi-doc-meta-banner');
            var metaMount  = panel.querySelector('#pi-doc-meta-ai');
            if (!metaBanner || !metaMount) return;

            var metaBtn = document.createElement('button');
            metaBtn.className = 'pi-ai-btn';
            metaBtn.style.cssText = 'font-size:0.65rem;padding:3px 10px;margin-top:10px;';
            metaBtn.textContent = '✨ Rewrite meta';
            metaBanner.insertBefore(metaBtn, metaMount);

            var _metaAbortCtrl = null;
            metaBtn.addEventListener('click', function() {
                if (!window.GroqAI.isConfigured()) { window.GroqAI.showSettings(); return; }
                if (_metaAbortCtrl) { _metaAbortCtrl.abort(); }
                _metaAbortCtrl = new AbortController();
                metaBtn.disabled = true;
                metaBtn.textContent = 'Generating…';
                window.GroqAI.complete(_buildMetaDescPrompt(data), { signal: _metaAbortCtrl.signal, max_tokens: 200, temperature: 0.5 })
                    .then(function(result) {
                        _metaAbortCtrl = null;
                        var text = _cleanMetaDesc(result);
                        _renderAICard(metaMount, text, AI_ISSUE_OPTS['meta-desc']);
                        _cacheAIResult('meta-desc', 0, text);
                        var analysisMetaMount = document.getElementById('pi-meta-desc-ai');
                        if (analysisMetaMount) _renderAICard(analysisMetaMount, text, AI_ISSUE_OPTS['meta-desc']);
                        metaBtn.disabled = false;
                        metaBtn.textContent = '↺ Regenerate';
                    })
                    .catch(function(err) {
                        _metaAbortCtrl = null;
                        if (err && err.name === 'AbortError') { metaBtn.disabled = false; metaBtn.textContent = '✨ Rewrite meta'; return; }
                        metaMount.innerHTML = '<div class="pi-ai-error">❌ ' + esc(err && err.message ? err.message : 'Something went wrong.') + '</div>';
                        metaBtn.disabled = false;
                        metaBtn.textContent = '✨ Rewrite meta';
                    });
            });
        })();
    }

    // ─── Full Report (dashboard tab) ────────────────────────────────────────

    function renderFullResults(container, data, url) {
        _aiResultsCache = {}; // reset per-analysis so results never bleed across URLs
        const isDark = window.__isDarkTheme || document.body.classList.contains('dark-theme');
        const grade = data.readabilityScore !== null ? readabilityGrade(data.readabilityScore) : null;
        const scoreColor = grade ? (isDark ? grade.darkColor : grade.color) : 'var(--color-text-secondary)';
        const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        let _urlOrigin = '';
        try { _urlOrigin = new URL(url).origin; } catch(e) {}

        // Status helpers
        const metaStatus = data.metaDescLength === 0
            ? { icon: '❌', label: 'Missing', color: '#dc2626' }
            : data.metaDescLength < 70
            ? { icon: '⚠️', label: `${data.metaDescLength} chars (short)`, color: '#d97706' }
            : data.metaDescLength > 160
            ? { icon: '⚠️', label: `${data.metaDescLength} chars (long)`, color: '#d97706' }
            : { icon: '✅', label: `${data.metaDescLength} chars`, color: '#059669' };

        const titleStatus = data.titleLength === 0
            ? { icon: '❌', label: 'Missing', color: '#dc2626' }
            : data.titleLength > 60
            ? { icon: '⚠️', label: `${data.titleLength} chars (long)`, color: '#d97706' }
            : { icon: '✅', label: `${data.titleLength} chars`, color: '#059669' };

        let canonicalStatus;
        if (!data.canonicalUrl) {
            canonicalStatus = { icon: '⚠️', label: 'Missing', color: '#d97706' };
        } else {
            try {
                const cn = new URL(data.canonicalUrl).href.replace(/\/$/, '');
                const pn = new URL(url).href.replace(/\/$/, '');
                canonicalStatus = cn === pn
                    ? { icon: '✅', label: 'Self-referencing', color: '#059669' }
                    : { icon: '⚠️', label: `Points elsewhere`, color: '#d97706' };
            } catch(e) {
                canonicalStatus = { icon: '⚠️', label: 'Invalid URL', color: '#d97706' };
            }
        }

        // Layout helpers
        const card = (borderColor, content) =>
            `<div style="background:var(--color-bg-secondary);border-radius:12px;padding:18px 22px;border:1px solid ${borderColor || 'var(--color-border-primary)'};margin-bottom:14px;">${content}</div>`;
        const sectionHead = (label) =>
            `<div style="font-size:0.85rem;font-weight:700;color:var(--color-text-primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid var(--color-border-primary);">${label}</div>`;
        const subHead = (icon, label, warn) =>
            `<div style="font-size:0.72rem;font-weight:700;color:${warn ? '#d97706' : 'var(--color-text-secondary)'};margin-bottom:7px;display:flex;align-items:center;gap:5px;">${icon ? `<span>${icon}</span>` : ''}<span>${esc(label)}</span></div>`;
        const detailsSummaryStyle = 'font-size:0.78rem;font-weight:700;color:var(--color-text-secondary);cursor:pointer;list-style:none;padding:6px 0;user-select:none;display:flex;align-items:center;gap:4px;';
        const chev = '<span class="pi-chev" style="display:inline-block;font-size:0.7em;transition:transform 0.15s;color:var(--color-text-muted);flex-shrink:0;">&#9654;</span>';
        if (!document.getElementById('pi-details-chev-style')) {
            const _cs = document.createElement('style');
            _cs.id = 'pi-details-chev-style';
            _cs.textContent = 'details.pi-sec>summary{list-style:none;}details.pi-sec>summary::-webkit-details-marker{display:none;}details.pi-sec[open] .pi-chev{transform:rotate(90deg);}';
            document.head.appendChild(_cs);
        }

        // ── Noindex banner (dark-mode fix) ──
        const noindexBanner = data.isNoindex
            ? `<div style="background:var(--color-danger-bg);border:1px solid var(--color-border-primary);border-radius:10px;padding:10px 18px;margin-bottom:14px;font-size:0.82rem;font-weight:700;color:#dc2626;text-align:center;">⛔ NOINDEX — Google will not index this page</div>`
            : '';

        // ── SEO Health score ──
        let seoScore = 0;
        if (data.titleLength > 0) seoScore += data.titleLength <= 60 ? 2 : 1;
        if (data.metaDescLength > 0) seoScore += (data.metaDescLength >= 70 && data.metaDescLength <= 160) ? 2 : 1;
        if (canonicalStatus.label === 'Self-referencing') seoScore += 1;
        if (data.schemaTypes.length > 0) seoScore += 1;
        const seoGrade = seoScore >= 5 ? 'A' : seoScore === 4 ? 'B' : seoScore === 3 ? 'C' : seoScore === 2 ? 'D' : 'F';
        const seoGradeColor = seoScore >= 5 ? '#059669' : seoScore >= 4 ? '#16a34a' : seoScore >= 3 ? '#d97706' : '#dc2626';

        // ── Long sentences (shared) ──
        const allLong = (data.longSentencesAll && data.longSentencesAll.length > 0 ? data.longSentencesAll : data.longSentences) || [];
        const _rptLong30 = (data.sentenceLengths || []).filter(l => l >= 30).length;
        const _rptLong40 = (data.sentenceLengths || []).filter(l => l >= 40).length;
        const _rptBreakdown = _rptLong30 > 0
            ? ` (30+: ${_rptLong30}${_rptLong40 > 0 ? `, 40+: ${_rptLong40}` : ''})`
            : '';
        const _rptWcColor = wc => wc >= 40 ? '#7f1d1d' : wc >= 30 ? '#b91c1c' : '#dc2626';

        // ── Top priority fixes (computed early, for standalone card) ──
        const allFixes = [];
        let _passivePct = 0, _passiveWarn = false, _passivePoor = false;
        let _complexWarn = false, _adverbWarn = false, _contrWarn = false, _transLow = false;
        if (data.writingStyle) {
            const ws = data.writingStyle;
            _passivePct  = ws.totalSentences > 0 ? Math.round(ws.passiveSentenceCount / ws.totalSentences * 100) : 0;
            _passiveWarn = _passivePct > 15;
            _passivePoor = _passivePct > 25;
            _complexWarn = ws.complexWordPct >= 10;
            _adverbWarn  = ws.adverbPct >= 5;
            _contrWarn   = ws.contractionCount === 0 && data.wordCount > 300;
            _transLow    = ws.transitionCoverage < 15 && data.wordCount > 300;
            if (allLong.length > 0)             allFixes.push(`${allLong.length} sentence${allLong.length !== 1 ? 's' : ''} over 20 words \u2014 shorten them`);
            if (_passiveWarn)                   allFixes.push(`Passive voice ${_passivePct}% (${ws.passiveSentenceCount} sentences) \u2014 rewrite sentences to start with the subject`);
            if (_transLow)                      allFixes.push(`Transitions ${ws.transitionCoverage}% \u2014 add however / therefore / also between paragraphs`);
            if (_contrWarn)                     allFixes.push(`No contractions \u2014 try don\u2019t, can\u2019t, you\u2019ll to sound less formal`);
            if (_complexWarn)                   allFixes.push(`Complex words ${ws.complexWordPct}% \u2014 replace 3+ syllable words with simpler alternatives`);
            if (ws.nominalisationCount > 3)     allFixes.push(`${ws.nominalisationCount} bureaucratic phrases \u2014 see list below`);
            if (_adverbWarn)                    allFixes.push(`Adverbs ${ws.adverbPct}% \u2014 remove or replace -ly adverbs`);
        }

        // ── [1] KPI Hero Strip ──
        const kpiHeroStrip =
            `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px;">` +
            // Card 1: Readability (FK)
            `<div style="background:var(--color-bg-secondary);border-radius:12px;padding:16px 10px;text-align:center;border:2px solid ${scoreColor};">` +
            `<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-secondary);margin-bottom:4px;">Flesch-Kincaid</div>` +
            `<div style="font-size:2.2rem;font-weight:800;color:${scoreColor};line-height:1;">${data.readabilityScore !== null ? data.readabilityScore : '\u2014'}</div>` +
            `<div style="font-size:0.66rem;color:${scoreColor};font-weight:700;margin-top:3px;">${grade ? grade.label : 'N/A'}</div>` +
            (data.avgSentenceLength !== null ? `<div style="font-size:0.68rem;color:var(--color-text-muted);margin-top:4px;">Avg sentence: ${data.avgSentenceLength}w</div>` : '') +
            (data.avgSyllablesPerWord !== null ? `<div style="font-size:0.68rem;color:var(--color-text-muted);">Avg syllables: ${data.avgSyllablesPerWord}/w</div>` : '') +
            `</div>` +
            // Card 3: Content (words + read time)
            `<div style="background:var(--color-bg-secondary);border-radius:12px;padding:16px 10px;text-align:center;border:1px solid var(--color-border-primary);">` +
            `<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-secondary);margin-bottom:4px;">Content</div>` +
            `<div style="font-size:2.2rem;font-weight:800;color:var(--color-text-primary);line-height:1;">${data.wordCount >= 1000 ? (data.wordCount / 1000).toFixed(1) + 'k' : data.wordCount}</div>` +
            `<div style="font-size:0.66rem;color:var(--color-text-muted);margin-top:3px;">words</div>` +
            `<div style="font-size:0.72rem;color:var(--color-text-secondary);margin-top:5px;font-weight:600;">${data.readingTime} min read</div>` +
            (data.avgSentenceLength !== null ? `<div style="font-size:0.68rem;color:var(--color-text-muted);margin-top:2px;">Avg sentence: ${data.avgSentenceLength}w</div>` : '') +
            `</div>` +
            // Card 4: SEO Health
            `<div style="background:var(--color-bg-secondary);border-radius:12px;padding:16px 10px;text-align:center;border:2px solid ${seoGradeColor};">` +
            `<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-secondary);margin-bottom:4px;">SEO Health</div>` +
            `<div style="font-size:2.2rem;font-weight:800;color:${seoGradeColor};line-height:1;">${seoGrade}</div>` +
            `<div style="font-size:0.66rem;color:${seoGradeColor};font-weight:700;margin-top:3px;">${seoScore}/6 points</div>` +
            `<div style="font-size:0.64rem;color:var(--color-text-muted);margin-top:5px;line-height:1.6;">Title ${titleStatus.icon} &middot; Meta ${metaStatus.icon}<br>Canon ${canonicalStatus.icon} &middot; Schema ${data.schemaTypes.length > 0 ? '✅' : '❌'}</div>` +
            `</div>` +
            `</div>`;

        // ── [2] Top Priority Actions ──
        const topPriorityActions = allFixes.length > 0
            ? card(null,
                `<div style="border-left:4px solid #4f46e5;padding-left:14px;">` +
                `<div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#4f46e5;margin-bottom:10px;">&#127919; Top things to fix</div>` +
                `<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:7px;">` +
                    allFixes.map(f => `<li style="font-size:0.82rem;color:var(--color-text-secondary);line-height:1.5;">${esc(f)}</li>`).join('') +
                `</ol></div>`)
            : '';

        // ── Technical SEO (schema on own row) ──
        const technicalSEO = card(null, `
            ${sectionHead('Technical SEO')}
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="font-size:0.66rem;font-weight:700;color:var(--color-text-muted);min-width:40px;">TITLE</span>
                        <span style="font-size:0.74rem;color:${titleStatus.color};font-weight:600;">${titleStatus.icon} ${titleStatus.label}</span>
                    </div>
                    ${data.titleText ? `<div style="font-size:0.82rem;color:var(--color-text-primary);font-weight:500;padding-left:48px;line-height:1.5;">&ldquo;${esc(data.titleText)}&rdquo;</div>` : ''}
                    <div id="pi-title-tag-ai" style="margin-top:8px;padding-left:48px;"></div>
                </div>
                <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="font-size:0.66rem;font-weight:700;color:var(--color-text-muted);min-width:40px;">META</span>
                        <span style="font-size:0.74rem;color:${metaStatus.color};font-weight:600;">${metaStatus.icon} ${metaStatus.label}</span>
                    </div>
                    ${data.metaDescText ? `<div style="font-size:0.8rem;color:var(--color-text-secondary);font-style:italic;padding-left:48px;line-height:1.5;">&ldquo;${esc(data.metaDescText)}&rdquo;</div>` : `<div style="font-size:0.78rem;color:var(--color-text-muted);padding-left:48px;">No meta description found.</div>`}
                    <div id="pi-meta-desc-ai" style="margin-top:8px;padding-left:48px;"></div>
                </div>
                <div style="padding-top:4px;border-top:1px solid var(--color-border-primary);">
                    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:8px;">
                        <div><span style="font-size:0.66rem;font-weight:700;color:var(--color-text-muted);">CANONICAL </span><span style="font-size:0.75rem;color:${canonicalStatus.color};font-weight:600;">${canonicalStatus.icon} ${canonicalStatus.label}</span></div>
                        ${data.pageLanguage ? `<div><span style="font-size:0.66rem;font-weight:700;color:var(--color-text-muted);">LANG </span><span style="font-size:0.75rem;color:var(--color-text-primary);">${esc(data.pageLanguage)}</span></div>` : ''}
                    </div>
                    ${data.schemaTypes.length > 0
                        ? `<div><span style="font-size:0.66rem;font-weight:700;color:var(--color-text-muted);">SCHEMA </span>${data.schemaTypes.map(t => `<span style="display:inline-block;background:var(--color-bg-tertiary);border:1px solid var(--color-border-primary);border-radius:4px;padding:1px 7px;font-size:0.68rem;font-weight:600;color:var(--color-text-primary);margin-right:4px;">${esc(t)}</span>`).join('')}</div>`
                        : `<div style="font-size:0.74rem;color:var(--color-text-muted);">No schema markup found — consider adding for richer Google results.</div>`
                    }
                </div>
            </div>
        `);

        // ── Links & Images ──
        const linkDensity = data.wordCount > 0 ? (data.internalLinks / data.wordCount * 100).toFixed(1) : '0.0';
        const _ld = parseFloat(linkDensity);
        const densityTier = data.wordCount <= 300 ? null
            : _ld < 0.5  ? { label: 'Very low', color: '#dc2626', advice: 'Aim for 1–3 internal links per 100 words. Add contextual cross-links to related topics.' }
            : _ld < 1    ? { label: 'Low',      color: '#d97706', advice: 'Aim for 1–3 internal links per 100 words. Look for opportunities to link to related pages.' }
            : _ld <= 3   ? { label: 'Good',     color: '#059669', advice: 'Internal link density is within the recommended 1–3 per 100 words.' }
            :              { label: 'High',      color: '#d97706', advice: 'Above 3 links per 100 words may dilute link equity. Consider whether all links add value.' };
        const altLabel = data.imageCount === 0
            ? 'No images on this page.'
            : data.imagesWithoutAlt === 0
            ? `✅ All ${data.imageCount} images have alt text`
            : `⚠️ ${data.imagesWithoutAlt} of ${data.imageCount} images missing alt text`;
        const altColor = data.imagesWithoutAlt > 0 ? '#d97706' : '#059669';

        // Weak anchor detection
        let weakAnchorCount = 0;
        [...(data.internalLinkData || []), ...(data.externalLinkData || [])].forEach(lk => {
            if (lk.isImageLink) return;
            const t = (lk.text || '').toLowerCase().trim();
            if (GENERIC_ANCHOR_TEXTS.has(t) || (t.length <= 2 && t.length > 0)) weakAnchorCount++;
        });

        // Internal list
        const _intAll = data.internalLinkData || [];
        const _intShown = _intAll.slice(0, 50);
        const _intOverflow = _intAll.length - _intShown.length;
        const _linkRowBadges = (lk, anchorText) => {
            const lkRel = lk.rel || '';
            const lkNewTab = !!lk.isNewTab;
            const lkImg = !!lk.isImageLink;
            const t = (anchorText || '').toLowerCase().trim();
            const isWeak = !lkImg && (GENERIC_ANCHOR_TEXTS.has(t) || (t.length <= 2 && t.length > 0));
            let badges = '';
            if (lkRel.includes('nofollow')) badges += `<span style="font-size:0.6rem;font-weight:700;color:#d97706;background:rgba(217,119,6,0.12);border:1px solid rgba(217,119,6,0.3);border-radius:4px;padding:0 4px;margin-left:5px;flex-shrink:0;line-height:1.6;">nofollow</span>`;
            if (lkNewTab) {
                const missingNoopener = !lkRel.includes('noopener');
                badges += `<span style="font-size:0.6rem;color:${missingNoopener ? '#d97706' : 'var(--color-text-muted)'};background:var(--color-bg-tertiary);border:1px solid var(--color-border-primary);border-radius:4px;padding:0 4px;margin-left:5px;flex-shrink:0;line-height:1.6;">${missingNoopener ? '⚠ new tab' : 'new tab'}</span>`;
            }
            if (lkImg) badges += `<span style="font-size:0.6rem;color:var(--color-text-muted);background:var(--color-bg-tertiary);border:1px solid var(--color-border-primary);border-radius:4px;padding:0 4px;margin-left:5px;flex-shrink:0;line-height:1.6;">img link</span>`;
            if (isWeak) badges += `<span style="font-size:0.65rem;color:#9ca3af;margin-left:5px;flex-shrink:0;" title="Generic anchor text — consider something more descriptive">⚠</span>`;
            return badges;
        };

        const internalListHtml = _intShown.length === 0
            ? `<div style="font-size:0.75rem;color:var(--color-text-muted);padding:6px 0;">No internal links found.</div>`
            : `<div style="border:1px solid var(--color-border-primary);border-radius:8px;background:var(--color-bg-primary);">` +
                _intShown.map((lk, i) => {
                    const fullHref = _urlOrigin && lk.href.startsWith('/') ? _urlOrigin + lk.href : lk.href;
                    const disp = lk.href.length > 70 ? lk.href.slice(0, 67) + '\u2026' : lk.href;
                    const showText = lk.text && lk.text !== lk.href && lk.text !== disp;
                    return `<div data-link-url="${esc(fullHref)}" style="display:flex;flex-direction:column;padding:6px 10px;border-bottom:${i < _intShown.length - 1 ? '1px solid var(--color-border-primary)' : 'none'};">` +
                        `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;">` +
                            `<a href="${esc(fullHref)}" target="_blank" rel="noopener noreferrer" style="font-size:0.74rem;color:var(--color-link);text-decoration:none;word-break:break-all;line-height:1.4;" title="${esc(fullHref)}">${esc(disp)}</a>` +
                            _linkRowBadges(lk, lk.text) +
                        `</div>` +
                        (showText ? `<span style="font-size:0.68rem;color:var(--color-text-muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(lk.text)}">${esc(lk.text)}</span>` : '') +
                    `</div>`;
                }).join('') +
                (_intOverflow > 0 ? `<div style="padding:6px 10px;font-size:0.7rem;color:var(--color-text-muted);font-style:italic;">\u2026and ${_intOverflow} more</div>` : '') +
              `</div>`;

        // External list — grouped by domain
        const _extMap = new Map();
        (data.externalLinkData || []).forEach(lk => {
            let host = lk.href;
            try { host = new URL(lk.href).hostname.replace(/^www\./, ''); } catch(e) {}
            if (!_extMap.has(host)) _extMap.set(host, []);
            _extMap.get(host).push(lk);
        });
        const _domains = [..._extMap.entries()].sort((a, b) => b[1].length - a[1].length);
        const externalListHtml = _domains.length === 0
            ? `<div style="font-size:0.75rem;color:var(--color-text-muted);padding:6px 0;">No external links found.</div>`
            : `<div style="border:1px solid var(--color-border-primary);border-radius:8px;background:var(--color-bg-primary);">` +
                _domains.map(([domain, links], di) => {
                    const capped = links.slice(0, 30);
                    const over = links.length - capped.length;
                    return `<div style="border-bottom:${di < _domains.length - 1 ? '1px solid var(--color-border-primary)' : 'none'};">` +
                        `<div style="padding:5px 10px;background:var(--color-bg-tertiary);font-size:0.68rem;font-weight:700;color:var(--color-text-secondary);display:flex;justify-content:space-between;align-items:center;">` +
                            `<span>${esc(domain)}</span><span style="font-weight:400;color:var(--color-text-muted);">${links.length} link${links.length !== 1 ? 's' : ''}</span>` +
                        `</div>` +
                        capped.map(lk => {
                            const disp = lk.href.length > 80 ? lk.href.slice(0, 77) + '\u2026' : lk.href;
                            const showText = lk.text && lk.text !== lk.href && lk.text !== disp;
                            return `<div data-link-url="${esc(lk.href)}" style="display:flex;flex-direction:column;padding:5px 10px 5px 18px;border-top:1px solid var(--color-border-primary);">` +
                                `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;">` +
                                    `<a href="${esc(lk.href)}" target="_blank" rel="noopener noreferrer" style="font-size:0.73rem;color:var(--color-link);text-decoration:none;word-break:break-all;line-height:1.4;" title="${esc(lk.href)}">${esc(disp)}</a>` +
                                    _linkRowBadges(lk, lk.text) +
                                `</div>` +
                                (showText ? `<span style="font-size:0.67rem;color:var(--color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(lk.text)}">${esc(lk.text)}</span>` : '') +
                            `</div>`;
                        }).join('') +
                        (over > 0 ? `<div style="padding:5px 10px 5px 18px;border-top:1px solid var(--color-border-primary);font-size:0.7rem;color:var(--color-text-muted);font-style:italic;">\u2026and ${over} more</div>` : '') +
                    `</div>`;
                }).join('') +
              `</div>`;

        const linksImages = card(null, `
            <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:2px solid var(--color-border-primary);margin-bottom:14px;">
                <div style="font-size:0.85rem;font-weight:700;color:var(--color-text-primary);">Links &amp; Images</div>
                <button id="pi-check-links-btn" style="font-size:0.7rem;font-weight:600;color:var(--color-link);background:var(--color-bg-tertiary);border:1px solid var(--color-border-primary);border-radius:6px;padding:3px 10px;cursor:pointer;white-space:nowrap;">Check Links</button>
            </div>
            <div id="pi-link-check-progress" style="display:none;font-size:0.72rem;color:var(--color-text-muted);margin-bottom:8px;font-style:italic;"></div>
            <div id="pi-link-check-summary" style="display:none;font-size:0.75rem;margin-bottom:10px;padding:5px 10px;background:var(--color-bg-tertiary);border-radius:6px;border:1px solid var(--color-border-primary);"></div>
            <div style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:14px;">
                <div style="text-align:center;">
                    <div style="font-size:1.8rem;font-weight:800;color:var(--color-text-primary);line-height:1;">${data.internalLinks}</div>
                    <div style="font-size:0.65rem;color:var(--color-text-muted);margin-top:2px;">internal links</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:1.8rem;font-weight:800;color:var(--color-text-primary);line-height:1;">${data.externalLinks}</div>
                    <div style="font-size:0.65rem;color:var(--color-text-muted);margin-top:2px;">external links</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:1.8rem;font-weight:800;color:${densityTier ? densityTier.color : 'var(--color-text-primary)'};line-height:1;">${linkDensity}</div>
                    <div style="font-size:0.65rem;color:var(--color-text-muted);margin-top:2px;">internal per 100 words</div>
                    ${densityTier ? `<div style="font-size:0.62rem;font-weight:700;color:${densityTier.color};margin-top:3px;text-transform:uppercase;letter-spacing:0.4px;">${densityTier.label}</div>` : ''}
                </div>
                ${weakAnchorCount > 0 ? `<div style="text-align:center;">
                    <div style="font-size:1.8rem;font-weight:800;color:#d97706;line-height:1;">${weakAnchorCount}</div>
                    <div style="font-size:0.65rem;color:var(--color-text-muted);margin-top:2px;">weak anchors</div>
                </div>` : ''}
            </div>
            ${weakAnchorCount > 0 ? `<div id="pi-weak-anchors-ai" style="margin-bottom:10px;"></div>` : ''}
            ${densityTier ? `<div style="font-size:0.76rem;color:var(--color-text-secondary);background:var(--color-bg-secondary);border-left:3px solid ${densityTier.color};border-radius:0 6px 6px 0;padding:7px 10px;margin-bottom:10px;">${densityTier.advice}</div>` : ''}
            <div style="font-size:0.8rem;color:${altColor};font-weight:500;margin-bottom:18px;">${altLabel}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div>
                    <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-secondary);margin-bottom:8px;display:flex;justify-content:space-between;align-items:baseline;">
                        <span>Internal Links</span>
                        <span style="font-weight:400;color:var(--color-text-muted);">${_intShown.length}${_intOverflow > 0 ? ` of ${_intAll.length}` : ''} shown</span>
                    </div>
                    ${internalListHtml}
                </div>
                <div>
                    <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-secondary);margin-bottom:8px;display:flex;justify-content:space-between;align-items:baseline;">
                        <span>External Links</span>
                        <span style="font-weight:400;color:var(--color-text-muted);">${_domains.length} domain${_domains.length !== 1 ? 's' : ''}</span>
                    </div>
                    ${externalListHtml}
                </div>
            </div>
        `);

        // ── Reading Rhythm (full-width standalone card) ──
        const rhythmCard = (() => {
            const sentLens = data.sentenceLengths || [];
            if (sentLens.length < 2) return '';
            const shortN = sentLens.filter(l => l < 10).length;
            const medN   = sentLens.filter(l => l >= 10 && l <= 20).length;
            const longN  = sentLens.filter(l => l > 20).length;
            return card(null,
                `<div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--color-text-secondary);margin-bottom:8px;">Reading Rhythm</div>` +
                renderRhythmChartFull(sentLens, data.sentenceTexts || []) +
                `<div style="display:flex;gap:14px;font-size:0.66rem;color:var(--color-text-muted);margin-top:6px;">` +
                    `<span style="color:#16a34a;">&#9679; Short &lt;10w (${shortN})</span>` +
                    `<span style="color:#d97706;">&#9679; Medium 10\u201320w (${medN})</span>` +
                    `<span style="color:#dc2626;">&#9679; Long &gt;20w (${longN})</span>` +
                `</div>`
            );
        })();

        // ── Writing Quality ──
        let writingQualityHtml = '';
        if (data.writingStyle) {
            const ws = data.writingStyle;
            const passivePct  = _passivePct;
            const passiveWarn = _passiveWarn;
            const passivePoor = _passivePoor;
            const complexWarn = _complexWarn;
            const adverbWarn  = _adverbWarn;
            const contrWarn   = _contrWarn;
            const transLow    = _transLow;

            // Benchmark bars — 2-col grid, adverbs full-width
            const barsHtml =
                `<div style="margin-bottom:18px;">` +
                    `<div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--color-text-secondary);margin-bottom:10px;">Writing Quality Indicators</div>` +
                    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">` +
                        `<div>${renderBenchmarkBar('Passive voice',  passivePct,           40, 15, !passiveWarn, 'target \u226415%', passivePoor ? '#dc2626' : undefined)}</div>` +
                        `<div>${renderBenchmarkBar('Complex words',  ws.complexWordPct,     30, 10, !complexWarn, 'target <10%')}</div>` +
                        `<div>${renderBenchmarkBar('Transitions',    ws.transitionCoverage, 30, 15, !transLow,    'target >15%')}</div>` +
                        `<div>${renderBenchmarkBar('Direct address', ws.directAddressRate,  16,  2, ws.directAddressRate >= 2, 'target \u22652%')}</div>` +
                        `<div style="grid-column:1/-1;">${renderBenchmarkBar('Adverbs (-ly)', ws.adverbPct, 15, 5, !adverbWarn, 'target <5%')}</div>` +
                    `</div>` +
                `</div>`;

            // Tone dial (contractions)
            const dialPct = Math.min(ws.contractionCount / 10 * 100, 100);
            const toneDialHtml =
                `<div style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--color-border-primary);">` +
                    `<div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--color-text-secondary);margin-bottom:8px;">Tone (Contractions)</div>` +
                    `<div style="display:flex;align-items:center;gap:12px;">` +
                        `<span style="font-size:0.72rem;color:var(--color-text-muted);white-space:nowrap;">Very formal</span>` +
                        `<div style="flex:1;position:relative;height:8px;background:linear-gradient(to right,#94a3b8,#16a34a);border-radius:4px;">` +
                            `<div style="position:absolute;top:50%;left:${dialPct}%;transform:translate(-50%,-50%);width:14px;height:14px;background:var(--color-bg-primary);border:2px solid ${contrWarn ? '#d97706' : '#16a34a'};border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>` +
                        `</div>` +
                        `<span style="font-size:0.72rem;color:var(--color-text-muted);white-space:nowrap;">Conversational</span>` +
                        `<span style="font-size:0.8rem;font-weight:700;color:${contrWarn ? '#d97706' : '#059669'};white-space:nowrap;">${ws.contractionCount} found ${contrWarn ? '\u26a0\ufe0f' : '\u2705'}</span>` +
                    `</div>` +
                    (contrWarn ? `<div style="font-size:0.72rem;color:#d97706;margin-top:6px;">Try: don't, can't, you'll, it's, we're</div>` : '') +
                `</div>`;

            // Long sentences <details>
            const longSentencesDetails = allLong.length > 0
                ? `<div id="pi-long-sentences-ai" style="margin-bottom:6px;"></div>` +
                  `<details${allLong.length <= 3 ? ' open' : ''} class="pi-sec" style="margin-bottom:10px;border-top:1px solid var(--color-border-primary);">` +
                  `<summary style="${detailsSummaryStyle}">${chev}\u26a0\ufe0f ${allLong.length} sentence${allLong.length !== 1 ? 's' : ''} over 20 words${_rptBreakdown}</summary>` +
                  `<div style="padding:8px 0 4px;display:flex;flex-direction:column;gap:10px;">` +
                      `<div id="pi-long-sentences-list">` +
                      allLong.map((s, i) => {
                          const wc = s.split(/\s+/).filter(w => w.length > 0).length;
                          return `<div id="pi-sent-long-${i}" style="font-size:0.8rem;color:var(--color-text-secondary);line-height:1.6;border-left:3px solid ${_rptWcColor(wc)};padding:6px 12px;">&ldquo;${esc(s)}&rdquo; <span style="color:${_rptWcColor(wc)};font-size:0.72rem;white-space:nowrap;font-weight:600;">(${wc}w)</span></div>`;
                      }).join('') +
                      `</div>` +
                  `</div>` +
                  `</details>`
                : '';

            // Passive voice <details>
            const passiveAll = ws.passiveSentenceExamplesAll || ws.passiveSentenceExamples || [];
            const passiveDetails =
                (passiveAll.length > 0 ? `<div id="pi-passive-ai" style="margin-bottom:6px;"></div>` : '') +
                `<details${passiveAll.length <= 5 ? ' open' : ''} class="pi-sec" style="margin-bottom:10px;border-top:1px solid var(--color-border-primary);">` +
                `<summary style="${detailsSummaryStyle}">${chev}${passiveWarn ? '\u26a0\ufe0f' : '\u2705'} Passive voice (${ws.passiveSentenceCount} of ${ws.totalSentences} sentences, ${passivePct}%)</summary>` +
                `<div style="padding:8px 0 4px;">` +
                    (passiveAll.length > 0
                        ? `<div id="pi-passive-list" style="display:flex;flex-direction:column;gap:6px;">${passiveAll.map((s, i) =>
                            `<div id="pi-sent-pass-${i}" style="font-size:0.78rem;color:var(--color-text-secondary);line-height:1.6;border-left:3px solid var(--color-border-primary);padding:5px 12px;">&ldquo;${esc(s.length > 250 ? s.slice(0,250) + '\u2026' : s)}&rdquo;</div>`
                        ).join('')}</div>`
                        : `<div style="font-size:0.76rem;color:var(--color-text-muted);">No passive voice detected.</div>`) +
                    `<div style="margin-top:8px;font-size:0.72rem;color:var(--color-text-muted);line-height:1.5;font-style:italic;">Passive voice is sometimes appropriate when the actor is unknown, the focus is on the person affected, or legal wording requires it.</div>` +
                    (passiveWarn
                        ? `<div style="margin-top:10px;padding:8px 12px;background:var(--color-bg-secondary);border-radius:6px;font-size:0.72rem;line-height:1.6;color:var(--color-text-secondary);"><span style="font-weight:600;">Tip \u2014 name the actor:</span><br>Passive: <em>&ldquo;The complaint will be investigated.&rdquo;</em><br>Active: <em>&ldquo;The organisation will investigate the complaint.&rdquo;</em></div>`
                        : '') +
                `</div></details>`;

            // Complex words <details>
            const complexAll = ws.complexWordListAll || ws.complexWordList;
            const complexDetails = complexAll.length > 0
                ? `<details class="pi-sec" style="margin-bottom:10px;border-top:1px solid var(--color-border-primary);">` +
                  `<summary style="${detailsSummaryStyle}">${chev}${complexWarn ? '\u26a0\ufe0f' : '\u2705'} Complex words, 3+ syllables (${ws.complexWordCount} uses, ${ws.complexWordPct}%)</summary>` +
                  `<div style="padding:8px 0 4px;display:flex;flex-wrap:wrap;gap:5px;">` +
                  complexAll.map(w => {
                      const alts = PLAIN_ALTS[w.toLowerCase()];
                      if (alts && alts.length > 0) {
                          return `<span title="Try: ${alts.join(', ')}" style="display:inline-block;background:var(--color-bg-tertiary);border:1px solid #059669;border-radius:4px;padding:2px 8px;font-size:0.72rem;color:var(--color-text-secondary);cursor:help;border-bottom:2px dashed #059669;">${esc(w)}<span style="color:#059669;font-size:0.65rem;margin-left:3px;">\u2192</span></span>`;
                      }
                      return `<span data-datamuse-word="${esc(w.toLowerCase())}" title="" style="display:inline-block;background:var(--color-bg-tertiary);border:1px solid var(--color-border-primary);border-radius:4px;padding:2px 8px;font-size:0.72rem;color:var(--color-text-secondary);cursor:help;">${esc(w)}</span>`;
                  }).join('') +
                  `</div></details>`
                : '';

            // Nominalisations <details>
            const nomAll = ws.nominalisationMatchesAll || ws.nominalisationMatches;
            const nomDetails = nomAll.length > 0
                ? `<div id="pi-nom-ai" style="margin-bottom:6px;"></div>` +
                  `<details class="pi-sec" style="margin-bottom:10px;border-top:1px solid var(--color-border-primary);">` +
                  `<summary style="${detailsSummaryStyle}">${chev}\u26a0\ufe0f Bureaucratic phrases (${ws.nominalisationCount} occurrence${ws.nominalisationCount !== 1 ? 's' : ''})</summary>` +
                  `<div style="padding:8px 0 4px;display:flex;flex-direction:column;gap:6px;">` +
                  nomAll.map(m =>
                      `<div style="font-size:0.77rem;line-height:1.5;display:flex;flex-wrap:wrap;gap:6px;align-items:center;border-left:3px solid #d97706;padding:5px 12px;">` +
                          `<span style="color:#d97706;font-weight:600;">&ldquo;${esc(m.found)}&rdquo;${m.count > 1 ? ` <span style="color:var(--color-text-muted);">\xd7${m.count}</span>` : ''}</span>` +
                          `<span style="color:var(--color-text-muted);">&rarr;</span>` +
                          `<span style="color:#059669;font-weight:600;">${esc(m.suggest)}</span>` +
                      `</div>`
                  ).join('') +
                  `</div></details>`
                : '';

            // Adverbs <details>
            const advAll = ws.adverbsAll || ws.topAdverbs;
            const adverbDetails = ws.adverbCount > 0
                ? `<details class="pi-sec" style="margin-bottom:10px;border-top:1px solid var(--color-border-primary);">` +
                  `<summary style="${detailsSummaryStyle}">${chev}${adverbWarn ? '\u26a0\ufe0f' : '\u2705'} Adverbs (${ws.adverbCount}, ${ws.adverbPct}% of words)</summary>` +
                  `<div style="padding:8px 0 4px;display:flex;flex-wrap:wrap;gap:5px;">` +
                  advAll.map(w =>
                      `<span style="display:inline-block;background:var(--color-bg-tertiary);border:1px solid var(--color-border-primary);border-radius:4px;padding:2px 8px;font-size:0.72rem;color:var(--color-text-secondary);">${esc(w)}</span>`
                  ).join('') +
                  `</div></details>`
                : '';

            // Hedge words <details>
            const hedgeAll = ws.hedgeMatchesAll || [];
            const _sentTexts = data.sentenceTexts || [];
            const hedgeDetails = ws.hedgeCount > 0
                ? `<details class="pi-sec" style="margin-bottom:10px;border-top:1px solid var(--color-border-primary);">` +
                  `<summary style="${detailsSummaryStyle}">${chev}\ud83d\udcac Hedge words (${ws.hedgeCount} occurrence${ws.hedgeCount !== 1 ? 's' : ''})</summary>` +
                  `<div style="padding:8px 0 4px;display:flex;flex-direction:column;gap:5px;">` +
                  hedgeAll.map(m => {
                      const ex = _sentTexts.find(s => s.toLowerCase().includes(m.phrase.toLowerCase())) || '';
                      return `<div style="border-left:3px solid var(--color-border-primary);padding:5px 12px;">` +
                          `<div style="font-size:0.77rem;font-weight:600;color:var(--color-text-secondary);">\u201c${esc(m.phrase)}\u201d${m.count > 1 ? ` <span style="color:var(--color-text-muted);">\xd7${m.count}</span>` : ''}</div>` +
                          (ex ? `<div style="font-size:0.72rem;color:var(--color-text-muted);margin-top:3px;font-style:italic;line-height:1.5;">${esc(ex.length > 160 ? ex.slice(0, 157) + '\u2026' : ex)}</div>` : '') +
                      `</div>`;
                  }).join('') +
                  `</div>` +
                  `<div id="pi-hedge-ai" style="margin-top:6px;"></div>` +
                  `</details>`
                : '';

            // H2 headings <details>
            const h2sForCard = data.h2Texts || [];
            const headingStructureDetails = h2sForCard.length > 0
                ? `<details class="pi-sec" style="margin-bottom:10px;border-top:1px solid var(--color-border-primary);">` +
                  `<summary style="${detailsSummaryStyle}">${chev}\ud83d\udccb H2 Headings (${h2sForCard.length} heading${h2sForCard.length !== 1 ? 's' : ''})</summary>` +
                  `<div style="padding:8px 0 4px;display:flex;flex-direction:column;gap:4px;">` +
                  h2sForCard.slice(0, 10).map(h =>
                      `<div style="font-size:0.78rem;color:var(--color-text-secondary);line-height:1.5;border-left:2px solid var(--color-border-primary);padding:3px 10px;">${esc(h)}</div>`
                  ).join('') +
                  `</div>` +
                  `<div id="pi-h2-ai" style="margin-top:6px;"></div>` +
                  `</details>`
                : '';

            writingQualityHtml = card(null, `
                ${sectionHead('Writing Quality')}
                ${barsHtml}
                ${toneDialHtml}
                ${longSentencesDetails}
                ${passiveDetails}
                ${complexDetails}
                ${nomDetails}
                ${adverbDetails}
                ${hedgeDetails}
                ${headingStructureDetails}
            `);
        }

        // ── Search Intent card ──────────────────────────────────────────────────
        const searchIntentCard = (function() {
            const gsc = data._gsc;
            if (!gsc || !gsc.topQueries || !gsc.topQueries.length) {
                return card(null,
                    sectionHead('Search Intent') +
                    `<div style="font-size:0.8rem;color:var(--color-text-muted);padding:4px 0;">` +
                    ((!window.GSCIntegration || !window.GSCIntegration.isConnected())
                        ? 'Connect Google Search Console to analyse which search queries this page serves and identify content gaps.'
                        : 'No search data available for this URL yet.') +
                    `</div>`
                );
            }
            const queries = gsc.topQueries.slice().sort(function(a, b) { return b.impressions - a.impressions; }).slice(0, 10);
            const queryRows = queries.map(function(q) {
                const ctrPct   = (q.ctr * 100).toFixed(1) + '%';
                const posColor = q.position <= 3 ? '#059669' : q.position <= 10 ? '#d97706' : '#dc2626';
                const oppBadge = q.opportunity
                    ? `<span style="font-size:0.6rem;padding:1px 6px;border-radius:10px;background:rgba(99,102,241,0.1);color:#6366f1;margin-left:4px;">${q.opportunity === 'ctr-opportunity' ? 'low CTR' : 'low rank'}</span>`
                    : '';
                return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--color-border-primary);font-size:0.78rem;">` +
                    `<span style="flex:1;color:var(--color-text-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(q.query)}</span>` +
                    `<span style="color:${posColor};font-weight:700;font-size:0.72rem;white-space:nowrap;">pos ${q.position.toFixed(1)}</span>` +
                    `<span style="color:var(--color-text-muted);font-size:0.72rem;white-space:nowrap;">${q.impressions.toLocaleString()} impr</span>` +
                    `<span style="color:var(--color-text-muted);font-size:0.72rem;white-space:nowrap;">${ctrPct} CTR</span>` +
                    oppBadge +
                    `</div>`;
            }).join('');
            return card(null,
                sectionHead('Search Intent') +
                `<div style="margin-bottom:12px;">${queryRows}</div>` +
                `<div id="pi-search-intent-ai"></div>`
            );
        })();

        const tabBtnBase   = 'padding:9px 18px;border:none;background:none;cursor:pointer;font-size:0.83rem;font-weight:600;color:var(--color-text-muted);border-bottom:2px solid transparent;margin-bottom:-2px;font-family:inherit;transition:all 0.15s;';
        const tabBtnActive = 'padding:9px 18px;border:none;background:none;cursor:pointer;font-size:0.83rem;font-weight:600;color:var(--color-text-primary);border-bottom:2px solid var(--color-text-primary);margin-bottom:-2px;font-family:inherit;transition:all 0.15s;';

        container.innerHTML =
            `<div style="padding:4px 2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">` +
            `<div style="display:flex;gap:0;border-bottom:2px solid var(--color-border-primary);margin-bottom:16px;">` +
                `<button id="pi-tab-analysis" style="${tabBtnActive}">Analysis</button>` +
                `<button id="pi-tab-document" style="${tabBtnBase}">Document</button>` +
            `</div>` +
            `<div id="pi-panel-analysis">` +
                noindexBanner + kpiHeroStrip + topPriorityActions + rhythmCard + technicalSEO + searchIntentCard + writingQualityHtml + linksImages +
            `</div>` +
            `<div id="pi-panel-document" style="display:none;"></div>` +
            `</div>`;

        initRhythmChartFull(container);
        wireDatamuseBadges(container);
        wireLinkChecker(container, data, _urlOrigin);
        wireAIRewrites(container, data);

        const analysisBtn   = container.querySelector('#pi-tab-analysis');
        const docBtn        = container.querySelector('#pi-tab-document');
        const analysisPanel = container.querySelector('#pi-panel-analysis');
        const docPanel      = container.querySelector('#pi-panel-document');

        analysisBtn.addEventListener('click', () => {
            analysisPanel.style.display = '';
            docPanel.style.display = 'none';
            analysisBtn.style.cssText = tabBtnActive;
            docBtn.style.cssText = tabBtnBase;
        });

        docBtn.addEventListener('click', () => {
            if (!docPanel._rendered) {
                docPanel.innerHTML = renderAnnotatedView(data);
                wireDocumentOverlays(docPanel);
                wireDocumentAIReview(docPanel, data);
                docPanel._rendered = true;
            }
            analysisPanel.style.display = 'none';
            docPanel.style.display = '';
            analysisBtn.style.cssText = tabBtnBase;
            docBtn.style.cssText = tabBtnActive;
        });
    }

    async function _fetchGSCData(url) {
        if (!window.GSCIntegration || !window.GSCIntegration.isConnected()) return null;
        var cached = window.GSCIntegration.getData(url);
        if (cached) return cached;
        try { return await window.GSCIntegration.fetchNodeData({ url: url }); }
        catch (e) { return null; }
    }

    async function _fetchGA4Data(url) {
        if (!window.GA4Integration || !window.GA4Integration.isConnected()) return null;
        try { return await window.GA4Integration.fetchData(url); }
        catch (e) { return null; }
    }

    async function renderFullReport(container, url) {
        if (!url) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-text-muted);font-size:0.9rem;">No URL available.</div>`;
            return;
        }
        renderLoading(container);
        try {
            const [data, gscData, ga4Data] = await Promise.all([
                analyseUrl(url),
                _fetchGSCData(url),
                _fetchGA4Data(url),
            ]);
            data._gsc = gscData;
            data._ga4 = ga4Data;
            renderFullResults(container, data, url);
        } catch (err) {
            renderError(container, url, err && err.message);
        }
    }

    window.PageIntelligence = { renderContentTab, renderFullReport, getCachedData: url => cache.get(url)?.data || null };
    console.log('📄 Page Intelligence module loaded');

})();
