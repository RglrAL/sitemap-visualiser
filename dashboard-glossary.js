// dashboard-glossary.js - COMPLETE ENHANCED VERSION
// Comprehensive sliding panel glossary with bulletproof error handling
// Version: 2.0 - Enhanced with fail-safe initialization

console.log('📚 Loading Complete Dashboard Glossary System v2.0...');

// ===========================================
// IMMEDIATE FAIL-SAFE GLOBAL SETUP
// ===========================================

// Clean up any existing instance
if (window.DashboardGlossary) {
    console.log('⚠️ Existing DashboardGlossary found, cleaning up...');
    try {
        if (window.DashboardGlossary._instance && window.DashboardGlossary._instance.cleanup) {
            window.DashboardGlossary._instance.cleanup();
        }
    } catch (e) {
        console.warn('Cleanup error (safe to ignore):', e);
    }
}

// Create bulletproof global API - prevents "not defined" errors
console.log('🛡️ Creating bulletproof DashboardGlossary global...');

window.DashboardGlossary = {
    _initialized: false,
    _instance: null,
    _pendingActions: [],
    _initAttempts: 0,
    _maxInitAttempts: 5,
    _debugMode: true,
    
    // Public API methods
    open: function() {
        console.log('📖 DashboardGlossary.open() called');
        return this._executeOrQueue('open', []);
    },
    
    close: function() {
        console.log('📕 DashboardGlossary.close() called');
        return this._executeOrQueue('close', []);
    },
    
    searchFor: function(term) {
        console.log('🔍 DashboardGlossary.searchFor() called with:', term);
        return this._executeOrQueue('search', [term]);
    },
    
    goToCategory: function(category) {
        console.log('🏷️ DashboardGlossary.goToCategory() called with:', category);
        return this._executeOrQueue('filterCategory', [category]);
    },
    
    isHealthy: function() {
        const healthy = this._initialized && this._instance && this._instance.isHealthy();
        if (this._debugMode) {
            console.log('🩺 Health check:', healthy ? '✅ Healthy' : '❌ Not healthy');
        }
        return healthy;
    },
    
    getDebugInfo: function() {
        return {
            initialized: this._initialized,
            hasInstance: !!this._instance,
            pendingActions: this._pendingActions.length,
            initAttempts: this._initAttempts,
            panelExists: !!document.getElementById('dashboardGlossary'),
            fabExists: !!document.getElementById('glossaryFAB'),
            timestamp: new Date().toISOString()
        };
    },
    
    forceInit: function() {
        console.log('🔄 Force initialization requested...');
        this._initAttempts = 0;
        this._initialized = false;
        this._instance = null;
        return this._attemptInitialization();
    },
    
    // Internal methods
    _executeOrQueue: function(methodName, args) {
        if (this._initialized && this._instance) {
            try {
                return this._instance[methodName](...args);
            } catch (error) {
                console.error(`❌ Error executing ${methodName}:`, error);
                return false;
            }
        } else {
            console.log(`⏳ Glossary not ready, queuing ${methodName}...`);
            this._pendingActions.push({ method: methodName, args: args });
            this._attemptInitialization();
            return false;
        }
    },
    
    _markReady: function(instance) {
        console.log('✅ Marking glossary as ready with instance');
        this._initialized = true;
        this._instance = instance;
        
        // Execute pending actions
        if (this._pendingActions.length > 0) {
            console.log(`🔄 Executing ${this._pendingActions.length} pending actions...`);
            this._pendingActions.forEach(({ method, args }) => {
                try {
                    instance[method](...args);
                } catch (error) {
                    console.error(`❌ Error executing pending ${method}:`, error);
                }
            });
            this._pendingActions = [];
        }
        
        console.log('🎉 Dashboard Glossary is now fully operational!');
    },
    
    _attemptInitialization: function() {
        if (this._initialized) return true;
        
        this._initAttempts++;
        console.log(`🔄 Initialization attempt ${this._initAttempts}/${this._maxInitAttempts}`);
        
        if (this._initAttempts > this._maxInitAttempts) {
            console.error('❌ Max initialization attempts reached');
            this._showFailureMessage();
            return false;
        }
        
        if (!window._glossaryInitStarted) {
            window._glossaryInitStarted = true;
            setTimeout(() => {
                try {
                    if (typeof window.initializeGlossarySystem === 'function') {
                        window.initializeGlossarySystem();
                    } else {
                        console.warn('⚠️ initializeGlossarySystem not available yet');
                        window._glossaryInitStarted = false;
                    }
                } catch (error) {
                    console.error('❌ Initialization error:', error);
                    window._glossaryInitStarted = false;
                }
            }, 100);
        }
        
        return false;
    },
    
    _showFailureMessage: function() {
        console.error('%c❌ Dashboard Glossary Failed to Load', 'color: #ef4444; font-weight: bold;');
        console.error('💡 Troubleshooting steps:');
        console.error('   1. Check browser console for JavaScript errors');
        console.error('   2. Ensure script loads before any calls to DashboardGlossary');
        console.error('   3. Try: DashboardGlossary.forceInit()');
        console.error('   4. Check network tab for failed resources');
        
        if (typeof alert !== 'undefined') {
            alert('📚 Dashboard Glossary failed to load. Please refresh the page or contact support.');
        }
    }
};

console.log('✅ Bulletproof DashboardGlossary global created!');

// ===========================================
// COMPLETE GLOSSARY SYSTEM IMPLEMENTATION
// ===========================================

(function() {
    'use strict';
    
    console.log('🏗️ Loading complete glossary system...');
    
    // Enhanced configuration
    const CONFIG = {
        DEBUG: true,
        SEARCH_DEBOUNCE: 300,
        NAMESPACE: 'DashboardGlossary',
        INIT_TIMEOUT: 15000,
        SELECTORS: {
            fab: 'glossaryFAB',
            panel: 'dashboardGlossary',
            closeBtn: 'closeGlossary',
            search: 'glossarySearch',
            clearSearch: 'clearSearch',
            content: 'glossaryContent',
            backToTop: 'backToTop',
            resultsSummary: 'resultsSummary'
        }
    };
    
    // Enhanced utilities
    function debugLog(message, data = null) {
        if (CONFIG.DEBUG) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`🔧 [${timestamp}] ${message}`, data || '');
        }
    }
    
    function safeGetElement(id, context = document) {
        try {
            const element = context.getElementById ? context.getElementById(id) : context.querySelector(`#${id}`);
            if (!element && CONFIG.DEBUG) {
                debugLog(`⚠️ Element not found: #${id}`);
            }
            return element;
        } catch (error) {
            debugLog(`❌ Error getting element #${id}:`, error);
            return null;
        }
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    function cleanupExisting() {
        debugLog('🧹 Cleaning up existing elements...');
        
        const elements = [
            CONFIG.SELECTORS.panel,
            CONFIG.SELECTORS.fab,
            'glossary-styles'
        ];
        
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                debugLog(`⚠️ Removing existing: ${id}`);
                el.remove();
            }
        });
    }
    
    // ===========================================
    // COMPLETE GLOSSARY DATA
    // ===========================================
    
    const glossaryData = {
        // ── Search Console ────────────────────────────────────────────────
        'CTR (Click-Through Rate)': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Percentage of people who click on your page after seeing it in search results.',
            calculation: '(Clicks ÷ Impressions) × 100',
            benchmark: 'Position 1: ~28%, Position 2: ~15%, Position 3: ~11%, Position 4-5: ~6%',
            example: '5.2% CTR means 52 people clicked for every 1,000 who saw your page in search',
            relatedTerms: ['Clicks', 'Impressions', 'Average Position', 'Opportunity Queries']
        },

        'Clicks': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Number of times users clicked on your page from Google search results.',
            calculation: 'Direct count from Search Console',
            benchmark: 'Government pages typically 100–1,000+ monthly',
            example: '245 clicks means 245 people visited your page from Google search this month',
            relatedTerms: ['Impressions', 'CTR (Click-Through Rate)', 'Organic Traffic']
        },

        'Impressions': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Number of times your page appeared in Google search results.',
            calculation: 'Direct count from Search Console',
            benchmark: 'Good: 10× more than clicks; Excellent: 20× more than clicks',
            example: '5,000 impressions means your page appeared in search results 5,000 times',
            relatedTerms: ['Clicks', 'CTR (Click-Through Rate)', 'Average Position']
        },

        'Average Position': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Average ranking position of your page in Google search results.',
            calculation: 'Weighted average of all query positions',
            benchmark: 'Excellent: 1–3, Good: 4–10, Fair: 11–20, Poor: 20+',
            example: 'Position 5.2 means your page typically appears 5th–6th in search results',
            relatedTerms: ['CTR (Click-Through Rate)', 'Search Score', 'Impressions']
        },

        'Top Queries': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Most common search terms that lead people to your page.',
            calculation: 'Ranked by clicks or impressions from Search Console',
            benchmark: 'Top query should represent 10–30% of total traffic',
            example: '"passport application" bringing 45 clicks shows citizens need passport info',
            relatedTerms: ['Opportunity Queries', 'Query Intent', 'Clicks']
        },

        'Opportunity Queries': {
            category: 'Search Console',
            source: 'calculated',
            definition: 'High-impression queries with below-average CTR for their position — represent optimisation opportunities.',
            calculation: 'Queries with impressions above threshold and CTR below position benchmark',
            benchmark: 'CTR improvement potential >50% indicates high-value opportunity',
            example: 'Query with 1,000 impressions but 1% CTR when benchmark is 3% CTR',
            relatedTerms: ['Top Queries', 'CTR (Click-Through Rate)', 'Query Intent']
        },

        // ── Google Analytics ──────────────────────────────────────────────
        'Users': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Number of unique individuals who visited your page during the selected period.',
            calculation: 'Distinct count based on GA4 user identification',
            benchmark: 'Government pages: 500–5,000+ monthly users typical',
            example: '1,250 users means 1,250 different people visited your page',
            relatedTerms: ['Page Views', 'Sessions', 'Citizens Reached']
        },

        'Page Views': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Total number of times your page was viewed, including repeat visits by the same user.',
            calculation: 'Count of all page_view events from GA4',
            benchmark: 'Typically 1.2–2.5× higher than Users',
            example: '1,800 page views from 1,250 users means some people returned',
            relatedTerms: ['Users', 'Sessions', 'Engagement Rate']
        },

        'Sessions': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Number of individual visits to your site. A session ends after 30 minutes of inactivity.',
            calculation: 'Count of distinct user sessions from GA4',
            benchmark: 'Usually similar to Users for single-page analysis',
            example: '1,300 sessions means people made 1,300 separate visits',
            relatedTerms: ['Users', 'Engaged Sessions', 'Bounce Rate']
        },

        'Avg Engagement Time': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'GA4\'s native metric for the average time users actively spend on your page (tab in foreground). Replaces the Universal Analytics "Average Session Duration".',
            calculation: 'Total engaged time ÷ Number of users',
            benchmark: 'Government content: 52+ seconds excellent, 35+ good, 20+ fair',
            example: '1m 48s avg engagement time means users are actively reading your content',
            relatedTerms: ['Engaged Sessions', 'Engagement Score', 'Bounce Rate']
        },

        'Engaged Sessions': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Sessions lasting 10+ seconds, having 2+ page views, or triggering a conversion event. GA4\'s replacement for Bounce Rate inverse.',
            calculation: 'Count of sessions meeting at least one engagement threshold',
            benchmark: '50%+ of sessions should be engaged for quality content',
            example: '650 engaged sessions out of 1,000 total = 65% engagement rate',
            relatedTerms: ['Engagement Rate', 'Sessions', 'Bounce Rate']
        },

        'Bounce Rate': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Percentage of sessions where users leave without engaging (inverse of Engagement Rate in GA4).',
            calculation: '(Non-engaged sessions ÷ Total sessions) × 100',
            benchmark: 'Government: <40% excellent, 40–60% good, 60–80% fair, >80% poor',
            example: '35% bounce rate means 35 out of 100 visitors left without engaging',
            relatedTerms: ['Engagement Rate', 'Engaged Sessions', 'Avg Engagement Time']
        },

        'Engagement Rate': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Percentage of sessions classified as engaged (10+ seconds, 2+ pages, or conversion).',
            calculation: '(Engaged sessions ÷ Total sessions) × 100',
            benchmark: 'Government: 50%+ excellent, 35%+ good, 20%+ fair',
            example: '65% engagement rate means 65 out of 100 visitors actively engaged',
            relatedTerms: ['Engaged Sessions', 'Bounce Rate', 'Engagement Score']
        },

        // ── Dashboard Calculations ────────────────────────────────────────
        'Quality Score': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'Overall content performance score combining Search, Engagement, Relevance, and UX components.',
            calculation: '(Search Score + Engagement Score + Relevance Score + UX Score) ÷ 4',
            benchmark: 'A: 85+, B: 75+, C: 65+, D: 55+, Poor: <55',
            example: 'Quality Score 78 (B grade) indicates good overall performance',
            relatedTerms: ['Search Score', 'Engagement Score', 'Period Comparison']
        },

        'Search Score': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'Component of Quality Score measuring search result performance based on position and CTR benchmarks.',
            calculation: '(Position Score + CTR Score) ÷ 2, calibrated against position-based CTR benchmarks',
            benchmark: '80+: Excellent, 60+: Good, 40+: Fair, <40: Poor',
            example: 'Search Score 72 indicates good search performance',
            relatedTerms: ['Average Position', 'CTR (Click-Through Rate)', 'Quality Score']
        },

        'Engagement Score': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'Component of Quality Score measuring how well the page holds user attention.',
            calculation: 'Combines avg engagement time performance and bounce rate inverse against government benchmarks',
            benchmark: '80+: Highly engaging, 60+: Good, 40+: Fair, <40: Poor',
            example: 'Engagement Score 68 shows good user engagement',
            relatedTerms: ['Avg Engagement Time', 'Bounce Rate', 'Quality Score']
        },

        'Query Intent': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'Automatic classification of search queries into intent types used to suggest content improvements.',
            calculation: 'Keyword pattern matching on top queries — types: how_to 🛠️, what_is ❓, form 📄, emergency 🚨, where_can 📍, when_does 📅',
            example: '"how do I apply for..." → how_to intent → suggest step-by-step formatting',
            relatedTerms: ['Top Queries', 'Opportunity Queries', 'Quality Score']
        },

        'Period Comparison': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'Trend arrow shown beside each metric comparing the current period to the equivalent previous period.',
            calculation: '((Current period value − Previous period value) ÷ Previous period value) × 100',
            example: '↑ 12% beside Clicks means clicks are up 12% vs the previous equivalent period',
            relatedTerms: ['Date Range', 'Quality Score', 'Search Score']
        },

        // ── Impact Metrics ────────────────────────────────────────────────
        'Citizens Reached': {
            category: 'Impact Metrics',
            source: 'calculated',
            definition: 'Total number of citizens who accessed your content, combining search clicks and direct users.',
            calculation: 'Search Console clicks + GA4 users (with overlap consideration)',
            benchmark: 'Aim for consistent monthly growth',
            example: '2,850 citizens reached means your content helped 2,850 people find information',
            relatedTerms: ['Users', 'Clicks', 'Engagement Rate']
        },

        // ── Traffic Sources ───────────────────────────────────────────────
        'Organic Traffic': {
            category: 'Traffic Sources',
            source: 'ga4',
            definition: 'Visitors who arrive through unpaid search engine results.',
            calculation: 'Users attributed to organic search channel in GA4',
            benchmark: '60–80% organic traffic indicates strong SEO performance',
            example: '1,200 organic visitors means people found you through search',
            relatedTerms: ['Direct Traffic', 'Clicks', 'CTR (Click-Through Rate)']
        },

        'Direct Traffic': {
            category: 'Traffic Sources',
            source: 'ga4',
            definition: 'Users who visit by typing the URL directly, using bookmarks, or from an untracked source.',
            calculation: 'Sessions with no identifiable referral source in GA4',
            benchmark: '20–40% direct traffic shows good brand recognition',
            example: '340 direct visits indicate citizens know your URL',
            relatedTerms: ['Organic Traffic', 'Sessions', 'Users']
        },

        // ── Device Performance ────────────────────────────────────────────
        'Mobile Users': {
            category: 'Device Performance',
            source: 'ga4',
            definition: 'Percentage of users accessing your content via mobile devices.',
            calculation: '(Mobile sessions ÷ Total sessions) × 100',
            benchmark: '50%+ mobile usage is typical for government services',
            example: '67% mobile users indicates need for mobile-optimised content',
            relatedTerms: ['Desktop Users', 'Engagement Rate', 'Bounce Rate']
        },

        'Desktop Users': {
            category: 'Device Performance',
            source: 'ga4',
            definition: 'Percentage of users accessing your content via desktop computers.',
            calculation: '(Desktop sessions ÷ Total sessions) × 100',
            benchmark: 'Forms and complex services typically see higher desktop usage',
            example: '45% desktop users may indicate complex content requiring larger screens',
            relatedTerms: ['Mobile Users', 'Engagement Rate', 'Sessions']
        },

        // ── Content Intelligence ──────────────────────────────────────────
        'Readability Score': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Flesch-Kincaid Reading Ease score (0–100). Higher = easier to read. Plain, accessible language scores 60+.',
            calculation: '206.835 − (1.015 × avg sentence length) − (84.6 × avg syllables per word)',
            benchmark: '90+: Very Easy, 70+: Easy, 60+: Plain English (target), 50+: Fairly Difficult, <30: Very Confusing',
            example: 'Score 65 means the page is readable by most adults without specialist knowledge',
            relatedTerms: ['Readability Grade', 'Avg Sentence Length', 'Complex Words', 'Reading Time']
        },

        'Readability Grade': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Plain-language label derived from the Flesch-Kincaid Readability Score.',
            calculation: 'Very Easy (90+) / Easy (70+) / Plain English (60+) / Fairly Difficult (50+) / Difficult (30+) / Very Confusing (<30)',
            example: '"Plain English" grade means content is accessible to the general public',
            relatedTerms: ['Readability Score', 'Word Count', 'Avg Sentence Length']
        },

        'Reading Time': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Estimated minutes to read the page body at an average adult reading pace.',
            calculation: 'Word Count ÷ 200 words per minute',
            example: '4 min reading time on a benefits page suggests content may need chunking',
            relatedTerms: ['Word Count', 'Avg Engagement Time', 'Readability Score']
        },

        'Word Count': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Total words in the visible body text of the page.',
            example: '800 words is a reasonable length for a government service overview page',
            relatedTerms: ['Reading Time', 'Readability Score', 'Link Density']
        },

        'Avg Sentence Length': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Average number of words per sentence. Long sentences are harder to parse.',
            calculation: 'Total words ÷ Total sentences',
            benchmark: 'Target: fewer than 20 words per sentence',
            example: 'Avg sentence length 28 suggests sentences should be broken up',
            relatedTerms: ['Readability Score', 'Long Sentences', 'Complex Words']
        },

        'Passive Voice': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Percentage of sentences using passive construction (e.g. "the form must be submitted" vs "you must submit the form"). Passive voice is less direct and harder to act on.',
            calculation: '(Passive sentences ÷ Total sentences) × 100',
            benchmark: 'Target: ≤15%',
            example: '30% passive voice — rewriting to active voice will make instructions clearer',
            relatedTerms: ['Direct Address Rate', 'Readability Score', 'Readability Grade']
        },

        'Complex Words': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Percentage of words with 3 or more syllables. High density signals jargon-heavy content.',
            calculation: '(Words with 3+ syllables ÷ Total words) × 100',
            benchmark: 'Target: below 10%',
            example: '15% complex words suggests replacing technical terms with plain alternatives',
            relatedTerms: ['Readability Score', 'Avg Sentence Length', 'Bureaucratic Phrases']
        },

        'Transition Coverage': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Percentage of sentences preceded by a linking or transition word (however, therefore, first, next). Transitions help readers follow logical flow.',
            calculation: '(Sentences with a preceding transition word ÷ Total sentences) × 100',
            benchmark: 'Target: >15%',
            example: '8% transition coverage — adding signpost words improves scannability',
            relatedTerms: ['Readability Score', 'Avg Sentence Length', 'Direct Address Rate']
        },

        'Direct Address Rate': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Percentage of words that are "you", "your", or "yours". Signals how directly the content speaks to the reader.',
            calculation: '(you/your/yours word count ÷ Total words) × 100',
            benchmark: 'Target: ≥2%',
            example: '0.8% direct address — rewriting to address citizens directly increases clarity',
            relatedTerms: ['Passive Voice', 'Readability Grade', 'Transition Coverage']
        },

        'Contractions': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Count of contractions (don\'t, can\'t, it\'s, etc.) in the page text. Contractions signal a conversational, approachable tone.',
            example: '12 contractions on a service page helps citizens feel less intimidated by official content',
            relatedTerms: ['Direct Address Rate', 'Readability Grade', 'Bureaucratic Phrases']
        },

        'Bureaucratic Phrases': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Count of verbose official phrases that have shorter plain-language alternatives (e.g. "in order to" → "to", "at this point in time" → "now").',
            example: '6 bureaucratic phrases found — replacing them shortens the page and improves clarity',
            relatedTerms: ['Contractions', 'Complex Words', 'Readability Score']
        },

        'Hedge Words': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Count of vague qualifying words (may, might, possibly, perhaps). Overuse can undermine user confidence in official information.',
            example: '14 hedge words — review whether each qualification is legally necessary',
            relatedTerms: ['Bureaucratic Phrases', 'Direct Address Rate', 'Readability Grade']
        },

        'Long Sentences': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Sentences over 20 words in length. These are harder for citizens to parse, especially on mobile.',
            calculation: 'Count of sentences with more than 20 words',
            benchmark: 'Aim for 0–2 long sentences per page section',
            example: '8 long sentences flagged — splitting them will improve mobile readability',
            relatedTerms: ['Avg Sentence Length', 'Readability Score', 'Complex Words']
        },

        'Meta Description': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'The HTML &lt;meta name="description"&gt; tag. Shown in search results below your page title. Influences click-through rate.',
            benchmark: 'Ideal length: 70–160 characters',
            example: 'Missing meta description — Google will auto-generate a snippet, which may be unhelpful',
            relatedTerms: ['Title Tag', 'CTR (Click-Through Rate)', 'Canonical URL']
        },

        'Title Tag': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'The HTML &lt;title&gt; element. Shown as the clickable headline in Google search results and the browser tab.',
            benchmark: 'Ideal length: ≤60 characters',
            example: 'Title 72 chars — truncated in search results, reducing click-through',
            relatedTerms: ['Meta Description', 'CTR (Click-Through Rate)', 'Average Position']
        },

        'Canonical URL': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'The &lt;link rel="canonical"&gt; tag tells Google which URL is the preferred version of this page, preventing duplicate content issues.',
            example: 'Canonical points to the www version — Google will consolidate signals to that URL',
            relatedTerms: ['Noindex', 'Meta Description', 'Sitemap']
        },

        'Noindex': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: '&lt;meta name="robots" content="noindex"&gt; tells search engines not to index this page. Pages with this tag will not appear in Google search results.',
            example: 'Noindex detected — this page will not receive organic search traffic',
            relatedTerms: ['Canonical URL', 'Average Position', 'Impressions']
        },

        'Schema Markup': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'JSON-LD structured data embedded in the page (e.g. Article, FAQPage, BreadcrumbList). Helps Google understand content and can unlock rich results in search.',
            example: 'FAQPage schema detected — eligible for FAQ rich results in Google search',
            relatedTerms: ['Meta Description', 'Title Tag', 'CTR (Click-Through Rate)']
        },

        'Image Alt Coverage': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Percentage of images on the page that have a non-empty alt attribute. Required for accessibility and used by Google for image understanding.',
            calculation: '(Images with alt text ÷ Total images) × 100',
            benchmark: 'Target: 100%',
            example: '60% alt coverage — 4 of 10 images have no alt text, failing WCAG 2.1',
            relatedTerms: ['Noindex', 'Readability Score', 'Page Language']
        },

        'Link Density': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'Number of internal links per 100 words of body text. Very low density may signal thin content; very high density can dilute link equity.',
            calculation: '(Internal links ÷ Word Count) × 100',
            benchmark: 'Typical range: 1–5 internal links per 100 words',
            example: 'Link density 0.3 — very few internal links; consider linking to related services',
            relatedTerms: ['Word Count', 'Canonical URL', 'Sitemap']
        },

        'Page Language': {
            category: 'Content Intelligence',
            source: 'content_intelligence',
            definition: 'The lang attribute on the HTML element (e.g. lang="en" or lang="ga"). Used by screen readers for pronunciation and by Google for language targeting.',
            example: 'lang="en" — English content correctly declared',
            relatedTerms: ['Image Alt Coverage', 'Meta Description', 'Noindex']
        },

        // ── Graph & Visualisation ─────────────────────────────────────────
        'Force Graph': {
            category: 'Graph & Visualisation',
            source: 'visualisation',
            definition: 'The interactive 3D visualisation that shows all pages on the site as nodes connected by their parent-child relationships in the sitemap hierarchy.',
            example: 'Zoom and rotate the force graph to explore how sections of the site relate to each other',
            relatedTerms: ['Node', 'Depth Level', 'Leaf Node', 'Sitemap']
        },

        'Node': {
            category: 'Graph & Visualisation',
            source: 'visualisation',
            definition: 'Each circle (sphere) in the force graph represents one URL / page on the site. Node size and colour can reflect metrics such as clicks or quality score.',
            example: 'A large red node indicates a high-traffic page with performance issues',
            relatedTerms: ['Force Graph', 'Leaf Node', 'Depth Level']
        },

        'Depth Level': {
            category: 'Graph & Visualisation',
            source: 'visualisation',
            definition: 'How many clicks from the root URL a page sits in the sitemap hierarchy. The root (homepage) is depth 0; its direct children are depth 1, and so on.',
            example: '/en/benefits/ is depth 1; /en/benefits/disability/ is depth 2',
            relatedTerms: ['Node', 'Leaf Node', 'Force Graph', 'Sitemap']
        },

        'Leaf Node': {
            category: 'Graph & Visualisation',
            source: 'visualisation',
            definition: 'A page with no child pages in the sitemap hierarchy — a terminal endpoint in the tree.',
            example: 'A specific benefit application guide with no sub-pages is a leaf node',
            relatedTerms: ['Node', 'Depth Level', 'Force Graph']
        },

        'Sitemap': {
            category: 'Graph & Visualisation',
            source: 'visualisation',
            definition: 'The XML file (typically sitemap.xml) that lists all URLs on the site. This dashboard parses it to build the force graph and supply URLs for GSC and GA4 lookups.',
            example: 'Paste your sitemap.xml URL into the input field to load the visualisation',
            relatedTerms: ['Force Graph', 'Node', 'Canonical URL', 'Google Search Console (GSC)']
        },

        // ── Data Sources & Settings ───────────────────────────────────────
        'Google Search Console (GSC)': {
            category: 'Data Sources & Settings',
            source: 'system',
            definition: 'Free Google tool showing how your pages perform in Google Search. Provides clicks, impressions, CTR, and average position per URL.',
            example: 'Connect GSC via the "Connect Search Console" button to overlay search data on the graph',
            relatedTerms: ['Clicks', 'Impressions', 'CTR (Click-Through Rate)', 'Google Analytics 4 (GA4)']
        },

        'Google Analytics 4 (GA4)': {
            category: 'Data Sources & Settings',
            source: 'system',
            definition: 'Google\'s analytics platform tracking user behaviour on your site — sessions, engagement, bounce rate, and more. GA4 replaced Universal Analytics in 2023.',
            example: 'Connect GA4 via the "Connect Analytics" button to overlay user engagement data on the graph',
            relatedTerms: ['Users', 'Engaged Sessions', 'Engagement Rate', 'Google Search Console (GSC)']
        },

        'Data Availability Offset': {
            category: 'Data Sources & Settings',
            source: 'system',
            definition: 'GSC and GA4 data has a processing delay of approximately 3 days. The dashboard automatically offsets the date range so reports end 3 days before today.',
            example: 'Today is 10 Mar — the dashboard reports up to 7 Mar to avoid incomplete data',
            relatedTerms: ['Date Range', 'Google Search Console (GSC)', 'Google Analytics 4 (GA4)']
        },

        'Date Range': {
            category: 'Data Sources & Settings',
            source: 'system',
            definition: 'The configurable time window used for all GSC and GA4 metric queries. Default is the last 28 days (accounting for the data availability offset).',
            example: 'Changing date range to 90 days gives a longer trend view but may include seasonality',
            relatedTerms: ['Data Availability Offset', 'Period Comparison', 'Impressions']
        }
    };

    const categories = {
        'Search Console': {
            icon: '🔍',
            description: 'Direct metrics from Google Search Console showing search performance'
        },
        'Google Analytics': {
            icon: '📊',
            description: 'User behaviour and engagement metrics from Google Analytics 4'
        },
        'Dashboard Calculations': {
            icon: '🧮',
            description: 'Composite scores and calculated metrics for content quality assessment'
        },
        'Impact Metrics': {
            icon: '🎯',
            description: 'Measurements of real-world citizen service impact and effectiveness'
        },
        'Traffic Sources': {
            icon: '🚪',
            description: 'How citizens discover and arrive at your digital services'
        },
        'Device Performance': {
            icon: '📱',
            description: 'Usage patterns and performance across mobile, desktop, and tablet devices'
        },
        'Content Intelligence': {
            icon: '📄',
            description: 'Page-level content quality signals: readability, structure, SEO tags, and accessibility'
        },
        'Graph & Visualisation': {
            icon: '🕸️',
            description: 'Concepts behind the interactive 3D force graph and sitemap tree'
        },
        'Data Sources & Settings': {
            icon: '⚙️',
            description: 'How data is connected, processed, and time-windowed in the dashboard'
        }
    };
    
    // ===========================================
    // ENHANCED GLOSSARY CLASS
    // ===========================================
    
    class DashboardGlossarySystem {
        constructor() {
            this.isInitialized = false;
            this.searchTimeout = null;
            this.currentFilter = 'all';
            this.currentSearch = '';
            this.initStartTime = Date.now();
            
            debugLog('🎯 Enhanced glossary system constructor called');
        }
        
        async init() {
            try {
                debugLog('🚀 Starting complete glossary initialization...');
                
                cleanupExisting();
                await this.waitForDOM();
                this.createGlossaryHTML();
                this.addGlossaryStyles();
                this.setupEventListeners();
                this.initializeNavigationState();
                
                const verification = this.verifySetup();
                if (!verification.success) {
                    throw new Error(`Setup verification failed: ${verification.error}`);
                }
                
                this.isInitialized = true;
                
                const initTime = Date.now() - this.initStartTime;
                debugLog(`✅ Complete glossary initialization finished in ${initTime}ms`);
                
                return true;
                
            } catch (error) {
                debugLog('❌ Glossary initialization failed:', error);
                return false;
            }
        }
        
        waitForDOM() {
            return new Promise((resolve) => {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', resolve);
                } else {
                    resolve();
                }
            });
        }
        
        verifySetup() {
            const panel = safeGetElement(CONFIG.SELECTORS.panel);
            const fab = safeGetElement(CONFIG.SELECTORS.fab);
            
            if (!panel) return { success: false, error: 'Panel not created' };
            if (!fab) return { success: false, error: 'FAB not created' };
            
            debugLog('✅ Setup verification passed');
            return { success: true };
        }
        
        initializeNavigationState() {
            // Set initial active state for "All" category
            this.updateQuickCategoryButtons('all');
            this.updateCategoryDropdown('all');
            
            // Initialize smart navigation in expanded state
            const navContent = safeGetElement('navCollapsibleContent');
            const navToggle = safeGetElement('smartNavToggle');
            
            if (navContent && navToggle) {
                navContent.classList.add('expanded');
                navToggle.classList.add('expanded');
                navToggle.setAttribute('aria-expanded', 'true');
                
                const toggleArrow = navToggle.querySelector('.toggle-arrow');
                if (toggleArrow) toggleArrow.textContent = '▲';
            }
            
            debugLog('📖 Smart navigation initialized in expanded state');
        }
        
        toggleSmartNavigation() {
            const navContent = safeGetElement('navCollapsibleContent');
            const navToggle = safeGetElement('smartNavToggle');
            
            if (navContent && navToggle) {
                const isExpanded = navContent.classList.contains('expanded');
                const toggleArrow = navToggle.querySelector('.toggle-arrow');
                
                if (isExpanded) {
                    // Collapse
                    navContent.classList.remove('expanded');
                    navToggle.classList.remove('expanded');
                    if (toggleArrow) toggleArrow.textContent = '▼';
                    navToggle.setAttribute('aria-expanded', 'false');
                    debugLog('📖 Smart navigation collapsed');
                } else {
                    // Expand
                    navContent.classList.add('expanded');
                    navToggle.classList.add('expanded');
                    if (toggleArrow) toggleArrow.textContent = '▲';
                    navToggle.setAttribute('aria-expanded', 'true');
                    debugLog('📖 Smart navigation expanded');
                }
            }
        }
        
        createGlossaryHTML() {
            debugLog('🏗️ Creating complete glossary HTML...');
            
            const alphabetNav = this.createAlphabetNav();
            const categoryFilters = this.createCategoryFilters();
            const glossaryEntries = this.createGlossaryEntries();
            
            const glossaryHTML = `
                <div class="glossary-panel" id="${CONFIG.SELECTORS.panel}" role="dialog" aria-labelledby="glossaryTitle" aria-hidden="true">
                    <!-- Enhanced Header -->
                    <div class="glossary-header">
                        <div class="glossary-title">
                            <h2 id="glossaryTitle">📚 Dashboard Glossary</h2>
                            <p>Comprehensive reference for all metrics, terms, and calculations</p>
                        </div>
                        <button class="glossary-close" id="${CONFIG.SELECTORS.closeBtn}" aria-label="Close glossary">
                            <span aria-hidden="true">✕</span>
                        </button>
                    </div>
                    
                    <!-- Enhanced Search -->
                    <div class="glossary-search">
                        <label for="${CONFIG.SELECTORS.search}" class="sr-only">Search glossary terms</label>
                        <input type="text" 
                               id="${CONFIG.SELECTORS.search}" 
                               placeholder="Search terms, definitions, calculations..." 
                               autocomplete="off"
                               aria-describedby="searchHelp" />
                        <button class="search-clear" id="${CONFIG.SELECTORS.clearSearch}" aria-label="Clear search" style="display: none;">
                            <span aria-hidden="true">✕</span>
                        </button>
                        <div id="searchHelp" class="sr-only">Type to search through glossary terms and definitions</div>
                    </div>
                    
                    <!-- Smart Collapsible Navigation -->
                    <div class="smart-navigation" id="smartNavigation">
                        <div class="nav-toggle-header">
                            <button class="smart-nav-toggle" id="smartNavToggle" aria-label="Toggle navigation menu">
                                <span class="toggle-icon">🧭</span>
                                <span class="toggle-text">Navigation</span>
                                <span class="toggle-arrow">▲</span>
                            </button>
                        </div>
                        
                        <div class="nav-collapsible-content" id="navCollapsibleContent">
                            <!-- Alphabet Navigation -->
                            <div class="alphabet-nav-section">
                                <div class="nav-label">Jump to letter:</div>
                                <div class="alphabet-buttons" role="tablist" aria-label="Alphabetical navigation">
                                    ${alphabetNav}
                                </div>
                            </div>
                            
                            <!-- Category Navigation -->
                            <div class="category-nav-section">
                                <div class="category-dropdown">
                                    <label for="categorySelect" class="category-label">Filter by category:</label>
                                    <select id="categorySelect" class="category-select">
                                        <option value="all">All Terms (${Object.keys(glossaryData).length})</option>
                                        ${this.createCategoryOptions()}
                                    </select>
                                </div>
                                
                                <!-- Quick Category Buttons -->
                                <div class="quick-categories">
                                    <button class="quick-cat-btn active" data-category="all" title="Show all terms">
                                        📋 All
                                    </button>
                                    <button class="quick-cat-btn" data-category="Search Console" title="Google Search Console metrics">
                                        🔍 Search
                                    </button>
                                    <button class="quick-cat-btn" data-category="Google Analytics" title="Google Analytics metrics">
                                        📊 Analytics
                                    </button>
                                    <button class="quick-cat-btn" data-category="Dashboard Calculations" title="Calculated scores">
                                        🧮 Scores
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Simplified Results Summary -->
                    <div class="results-summary" id="${CONFIG.SELECTORS.resultsSummary}" role="status" aria-live="polite">
                        <span class="results-text">Showing ${Object.keys(glossaryData).length} terms</span>
                    </div>
                    
                    <!-- Glossary Content -->
                    <div class="glossary-content" id="${CONFIG.SELECTORS.content}" role="main" tabindex="0">
                        ${glossaryEntries}
                    </div>
                    
                    <!-- Back to Top -->
                    <button class="back-to-top" id="${CONFIG.SELECTORS.backToTop}" style="display: none;" aria-label="Back to top">
                        <span aria-hidden="true">↑</span> Back to Top
                    </button>
                </div>
                
                <!-- Floating Action Button -->
                <button class="glossary-fab" id="${CONFIG.SELECTORS.fab}" aria-label="Open Dashboard Glossary">
                    <span class="fab-icon" aria-hidden="true">📚</span>
                    <span class="fab-tooltip">Glossary</span>
                </button>
            `;
            
            document.body.insertAdjacentHTML('beforeend', glossaryHTML);
            debugLog('✅ Complete HTML structure created');
        }
        
        createAlphabetNav() {
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
            return alphabet.map(letter => {
                const hasTerms = Object.keys(glossaryData).some(term => 
                    term.charAt(0).toUpperCase() === letter
                );
                return `
                    <button class="alpha-btn ${hasTerms ? 'has-terms' : 'no-terms'}" 
                            data-letter="${letter}" 
                            role="tab"
                            aria-label="Jump to terms starting with ${letter}"
                            ${hasTerms ? '' : 'disabled'}>
                        ${letter}
                    </button>
                `;
            }).join('');
        }
        
        createCategoryOptions() {
            return Object.entries(categories).map(([category, config]) => {
                const termCount = Object.values(glossaryData).filter(term => term.category === category).length;
                return `<option value="${category}">${config.icon} ${category} (${termCount})</option>`;
            }).join('');
        }
        
        createCategoryFilters() {
            return Object.entries(categories).map(([category, config]) => {
                const termCount = Object.values(glossaryData).filter(term => term.category === category).length;
                return `
                    <button class="category-filter" 
                            data-category="${category}"
                            aria-pressed="false"
                            aria-label="Filter by ${category}, ${termCount} terms">
                        <span class="category-icon" aria-hidden="true">${config.icon}</span>
                        <span class="category-name">${category}</span>
                        <span class="category-count">${termCount}</span>
                    </button>
                `;
            }).join('');
        }
        
        createGlossaryEntries() {
            return Object.entries(glossaryData)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([term, data]) => this.createGlossaryEntry(term, data))
                .join('');
        }
        
        createGlossaryEntry(term, data) {
            const termId = `term-${term.replace(/\s+/g, '-').toLowerCase()}`;
            const termForData = term.toLowerCase().trim();
            
            return `
                <article class="glossary-entry" data-term="${termForData}" data-category="${data.category}">
                    <div class="entry-header">
                        <div class="entry-title-section">
                            <h3 class="entry-term" id="${termId}">${term}</h3>
                            <div class="source-indicator ${data.source}">
                                ${this.getSourceIcon(data.source)}
                                <span class="source-label">${this.getSourceLabel(data.source)}</span>
                            </div>
                        </div>
                        <span class="entry-category">${data.category}</span>
                    </div>
                    
                    <div class="entry-content">
                        <div class="entry-definition">
                            <strong>Definition:</strong> ${data.definition}
                        </div>
                        
                        ${data.calculation && data.calculation !== 'N/A - Service designation' ? `
                            <div class="entry-calculation">
                                <strong>Calculation:</strong> 
                                <code>${data.calculation}</code>
                            </div>
                        ` : ''}
                        
                        <div class="entry-benchmark">
                            <strong>Benchmark:</strong> ${data.benchmark}
                        </div>
                        
                        <div class="entry-example">
                            <strong>Example:</strong> ${data.example}
                        </div>
                        
                        ${data.relatedTerms && data.relatedTerms.length > 0 ? `
                            <div class="entry-related">
                                <strong>Related Terms:</strong> 
                                ${data.relatedTerms.map(relatedTerm => 
                                    `<button class="related-term-link" 
                                             data-related="${relatedTerm.toLowerCase()}"
                                             aria-label="Go to ${relatedTerm}">${relatedTerm}</button>`
                                ).join(', ')}
                            </div>
                        ` : ''}
                    </div>
                </article>
            `;
        }
        
        getSourceIcon(source) {
            const icons = {
                ga4: '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>',
                search_console: '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/></svg>',
                calculated: '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="#6b7280" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>'
            };
            return icons[source] || icons.calculated;
        }
        
        getSourceLabel(source) {
            const labels = {
                ga4: 'GA4',
                search_console: 'SC',
                calculated: 'CALC'
            };
            return labels[source] || 'CALC';
        }
        
        setupEventListeners() {
            debugLog('🎧 Setting up complete event listeners...');
            
            try {
                const fab = safeGetElement(CONFIG.SELECTORS.fab);
                const closeBtn = safeGetElement(CONFIG.SELECTORS.closeBtn);
                const searchInput = safeGetElement(CONFIG.SELECTORS.search);
                const clearSearch = safeGetElement(CONFIG.SELECTORS.clearSearch);
                const backToTop = safeGetElement(CONFIG.SELECTORS.backToTop);
                const content = safeGetElement(CONFIG.SELECTORS.content);
                const categorySelect = safeGetElement('categorySelect');
                const smartNavToggle = safeGetElement('smartNavToggle');
                
                // FAB click
                if (fab) {
                    fab.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.openGlossary();
                    });
                    debugLog('✅ FAB listener added');
                }
                
                // Close button
                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.closeGlossary();
                    });
                    debugLog('✅ Close button listener added');
                }
                
                // Search with debouncing
                if (searchInput) {
                    const debouncedSearch = debounce(() => this.handleSearch(), CONFIG.SEARCH_DEBOUNCE);
                    searchInput.addEventListener('input', debouncedSearch);
                    
                    searchInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this.handleSearch();
                        }
                    });
                    debugLog('✅ Search listeners added');
                }
                
                // Clear search
                if (clearSearch) {
                    clearSearch.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.clearSearch();
                    });
                    debugLog('✅ Clear search listener added');
                }
                
                // Back to top
                if (backToTop) {
                    backToTop.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.scrollToTop();
                    });
                    debugLog('✅ Back to top listener added');
                }
                
                // Smart navigation toggle
                if (smartNavToggle) {
                    smartNavToggle.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.toggleSmartNavigation();
                    });
                    debugLog('✅ Smart navigation toggle listener added');
                }
                
                // Category dropdown
                if (categorySelect) {
                    categorySelect.addEventListener('change', (e) => {
                        const category = e.target.value;
                        this.filterByCategory(category);
                        this.updateQuickCategoryButtons(category);
                    });
                    debugLog('✅ Category dropdown listener added');
                }
                
                // Scroll handling
                if (content) {
                    content.addEventListener('scroll', () => {
                        if (backToTop) {
                            backToTop.style.display = content.scrollTop > 200 ? 'block' : 'none';
                        }
                    });
                    debugLog('✅ Scroll listener added');
                }
                
                // Global event delegation
                document.addEventListener('click', (e) => this.handleDelegatedClicks(e));
                document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
                
                debugLog('✅ All event listeners setup complete');
                
            } catch (error) {
                debugLog('❌ Error setting up event listeners:', error);
                throw error;
            }
        }
        
        handleDelegatedClicks(e) {
            const target = e.target;
            
            // Alphabet navigation
            if (target.classList.contains('alpha-btn') && !target.disabled) {
                e.preventDefault();
                const letter = target.dataset.letter;
                this.scrollToLetter(letter);
            }
            
            // Quick category buttons
            if (target.classList.contains('quick-cat-btn')) {
                e.preventDefault();
                const category = target.dataset.category;
                this.filterByCategory(category);
                this.updateQuickCategoryButtons(category);
                this.updateCategoryDropdown(category);
            }
            
            // Related term links
            if (target.classList.contains('related-term-link')) {
                e.preventDefault();
                const relatedTerm = target.dataset.related;
                this.searchAndHighlight(relatedTerm);
            }
            
            // Close on backdrop
            if (target.classList.contains('glossary-panel')) {
                this.closeGlossary();
            }
        }
        
        updateQuickCategoryButtons(activeCategory) {
            document.querySelectorAll('.quick-cat-btn').forEach(btn => {
                const isActive = btn.dataset.category === activeCategory;
                btn.classList.toggle('active', isActive);
            });
        }
        
        updateCategoryDropdown(activeCategory) {
            const dropdown = safeGetElement('categorySelect');
            if (dropdown) {
                dropdown.value = activeCategory;
            }
        }
        
        handleKeyboardNavigation(e) {
            const panel = safeGetElement(CONFIG.SELECTORS.panel);
            
            if (panel && panel.classList.contains('active')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeGlossary();
                }
            }
        }
        
        handleSearch() {
            const searchInput = safeGetElement(CONFIG.SELECTORS.search);
            if (!searchInput) return;
            
            const query = searchInput.value.toLowerCase().trim();
            this.currentSearch = query;
            
            debugLog(`🔍 Searching for: "${query}"`);
            
            const entries = document.querySelectorAll('.glossary-entry');
            let visibleCount = 0;
            let exactMatch = null;
            
            entries.forEach(entry => {
                const termElement = entry.querySelector('.entry-term');
                const termName = termElement ? termElement.textContent.toLowerCase().trim() : '';
                const termData = entry.dataset.term || '';
                const content = entry.textContent.toLowerCase();
                
                const isVisible = query === '' || 
                    termName.includes(query) ||
                    termData.includes(query) ||
                    content.includes(query) ||
                    this.fuzzyMatch(termName, query) ||
                    this.acronymMatch(termName, query);
                
                if (isVisible) {
                    entry.style.display = 'block';
                    visibleCount++;
                    
                    if (termName === query || termData === query) {
                        exactMatch = entry;
                    }
                    
                    if (query !== '') {
                        this.highlightSearchTerm(entry, query);
                    } else {
                        this.removeHighlights(entry);
                    }
                } else {
                    entry.style.display = 'none';
                }
            });
            
            this.updateResultsSummary(visibleCount, query);
            this.updateClearButton(query);
            
            if (exactMatch && query !== '') {
                setTimeout(() => {
                    exactMatch.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    exactMatch.style.background = 'rgba(59, 130, 246, 0.15)';
                    setTimeout(() => {
                        exactMatch.style.background = '';
                    }, 2000);
                }, 100);
            }
        }
        
        fuzzyMatch(termName, query) {
            if (query.length < 3) return false;
            const cleanTerm = termName.replace(/[^\w]/g, '').toLowerCase();
            const cleanQuery = query.replace(/[^\w]/g, '').toLowerCase();
            return cleanTerm.includes(cleanQuery);
        }
        
        acronymMatch(termName, query) {
            if (query.length < 2) return false;
            const words = termName.split(/[\s\-\(\)]+/);
            const acronym = words
                .filter(word => word.length > 0)
                .map(word => word.charAt(0).toLowerCase())
                .join('');
            return acronym.includes(query) || query.includes(acronym);
        }
        
        clearSearch() {
            const searchInput = safeGetElement(CONFIG.SELECTORS.search);
            if (searchInput) {
                searchInput.value = '';
                this.handleSearch();
                searchInput.focus();
            }
        }
        
        updateClearButton(query) {
            const clearBtn = safeGetElement(CONFIG.SELECTORS.clearSearch);
            if (clearBtn) {
                clearBtn.style.display = query ? 'block' : 'none';
            }
        }
        
        filterByCategory(category) {
            debugLog(`🏷️ Filtering by category: ${category}`);
            
            this.currentFilter = category;
            const entries = document.querySelectorAll('.glossary-entry');
            let visibleCount = 0;
            
            entries.forEach(entry => {
                const entryCategory = entry.dataset.category;
                const isVisible = category === 'all' || entryCategory === category;
                
                if (isVisible) {
                    entry.style.display = 'block';
                    visibleCount++;
                } else {
                    entry.style.display = 'none';
                }
            });
            
            this.updateResultsSummary(visibleCount, '', category);
            
            // Clear search when filtering
            const searchInput = safeGetElement(CONFIG.SELECTORS.search);
            if (searchInput) {
                searchInput.value = '';
                this.updateClearButton('');
            }
            
            // Scroll to top of content
            this.scrollToTop();
            
            debugLog(`✅ Category filter applied: ${visibleCount} results`);
        }
        
        scrollToLetter(letter) {
            debugLog(`🔤 Scrolling to letter: ${letter}`);
            
            const entries = document.querySelectorAll('.glossary-entry');
            const targetEntry = Array.from(entries).find(entry => {
                const term = entry.dataset.term || '';
                return term.charAt(0).toUpperCase() === letter;
            });
            
            if (targetEntry) {
                targetEntry.scrollIntoView({ behavior: 'smooth', block: 'start' });
                targetEntry.style.background = 'rgba(59, 130, 246, 0.1)';
                setTimeout(() => {
                    targetEntry.style.background = '';
                }, 2000);
            }
        }
        
        searchAndHighlight(term) {
            debugLog(`🎯 Searching and highlighting: ${term}`);
            
            const searchInput = safeGetElement(CONFIG.SELECTORS.search);
            if (searchInput) {
                searchInput.value = term;
                this.handleSearch();
            }
        }
        
        highlightSearchTerm(entry, query) {
            this.removeHighlights(entry);
            
            const walker = document.createTreeWalker(
                entry,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            const textNodes = [];
            let node;
            
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            
            textNodes.forEach(textNode => {
                const text = textNode.textContent;
                const regex = new RegExp(`(${query})`, 'gi');
                
                if (regex.test(text)) {
                    const highlighted = text.replace(regex, '<mark class="search-highlight">$1</mark>');
                    const span = document.createElement('span');
                    span.innerHTML = highlighted;
                    textNode.parentNode.replaceChild(span, textNode);
                }
            });
        }
        
        removeHighlights(entry) {
            const highlights = entry.querySelectorAll('.search-highlight');
            highlights.forEach(highlight => {
                highlight.outerHTML = highlight.innerHTML;
            });
        }
        
        updateResultsSummary(count, query = '', category = '') {
            const summary = safeGetElement(CONFIG.SELECTORS.resultsSummary);
            if (!summary) return;
            
            let text = `Showing ${count} term${count !== 1 ? 's' : ''}`;
            
            if (query) {
                text += ` matching "${query}"`;
            } else if (category && category !== 'all') {
                text += ` in "${category}"`;
            }
            
            const resultsText = summary.querySelector('.results-text');
            
            if (resultsText) {
                resultsText.textContent = text;
            } else {
                summary.textContent = text;
            }
        }
        
        scrollToTop() {
            const content = safeGetElement(CONFIG.SELECTORS.content);
            if (content) {
                content.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
        
        openGlossary() {
            debugLog('📖 Opening glossary...');
            
            const panel = safeGetElement(CONFIG.SELECTORS.panel);
            const searchInput = safeGetElement(CONFIG.SELECTORS.search);
            
            if (panel) {
                panel.classList.add('active');
                panel.setAttribute('aria-hidden', 'false');
                
                if (searchInput) {
                    setTimeout(() => searchInput.focus(), 300);
                }
                
                document.body.style.overflow = 'hidden';
                debugLog('✅ Glossary opened');
            }
        }
        
        closeGlossary() {
            debugLog('📕 Closing glossary...');
            
            const panel = safeGetElement(CONFIG.SELECTORS.panel);
            
            if (panel) {
                panel.classList.remove('active');
                panel.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
                debugLog('✅ Glossary closed');
            }
        }
        
        // Public API methods
        search(term) {
            this.openGlossary();
            setTimeout(() => {
                this.searchAndHighlight(term);
            }, 300);
            return true;
        }
        
        filterCategory(category) {
            this.openGlossary();
            setTimeout(() => {
                this.filterByCategory(category);
            }, 300);
            return true;
        }
        
        open() {
            this.openGlossary();
            return true;
        }
        
        close() {
            this.closeGlossary();
            return true;
        }
        
        isHealthy() {
            return this.isInitialized && 
                   safeGetElement(CONFIG.SELECTORS.panel) && 
                   safeGetElement(CONFIG.SELECTORS.fab);
        }
        
        cleanup() {
            debugLog('🧹 Cleaning up instance...');
            this.isInitialized = false;
        }
        
        addGlossaryStyles() {
            const styles = `
                <style id="glossary-styles">
                    /* Screen reader only */
                    .sr-only {
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        padding: 0;
                        margin: -1px;
                        overflow: hidden;
                        clip: rect(0, 0, 0, 0);
                        white-space: nowrap;
                        border: 0;
                    }
                    
                    /* Floating Action Button */
                    .glossary-fab {
                        position: fixed;
                        bottom: 30px;
                        right: 30px;
                        width: 56px;
                        height: 56px;
                        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                        border: none;
                        border-radius: 50%;
                        color: white;
                        font-size: 1.5rem;
                        cursor: pointer;
                        box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        z-index: 9998;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        outline: none;
                        border: 2px solid transparent;
                    }
                    
                    .glossary-fab:hover {
                        transform: translateY(-3px) scale(1.05);
                        box-shadow: 0 8px 30px rgba(59, 130, 246, 0.6);
                    }
                    
                    .glossary-fab:focus {
                        border-color: #fbbf24;
                        box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.3);
                    }
                    
                    .fab-tooltip {
                        position: absolute;
                        left: -120px;
                        top: 50%;
                        transform: translateY(-50%);
                        background: #1f2937;
                        color: white;
                        padding: 8px 12px;
                        border-radius: 6px;
                        font-size: 0.8rem;
                        font-weight: 600;
                        opacity: 0;
                        transition: all 0.2s ease;
                        pointer-events: none;
                        white-space: nowrap;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    }
                    
                    .glossary-fab:hover .fab-tooltip {
                        opacity: 1;
                        transform: translateY(-50%) translateX(-5px);
                    }
                    
                    /* Glossary Panel */
                    .glossary-panel {
                        position: fixed;
                        top: 0;
                        right: -100%;
                        width: min(500px, 100vw);
                        height: 100vh;
                        background: var(--color-bg-primary);
                        border-left: 1px solid var(--color-border-primary);
                        box-shadow: -10px 0 50px rgba(0, 0, 0, 0.3);
                        z-index: 10001;
                        transition: right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                        display: flex;
                        flex-direction: column;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        overflow: hidden;
                    }
                    
                    .glossary-panel.active {
                        right: 0;
                    }
                    
                    /* Header */
                    .glossary-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        padding: 24px;
                        background: var(--color-bg-secondary);
                        border-bottom: 1px solid var(--color-border-primary);
                        flex-shrink: 0;
                    }
                    
                    .glossary-title h2 {
                        margin: 0 0 4px 0;
                        color: var(--color-text-primary);
                        font-size: 1.4rem;
                        font-weight: 700;
                    }
                    
                    .glossary-title p {
                        margin: 0;
                        color: var(--color-text-secondary);
                        font-size: 0.9rem;
                    }
                    
                    .glossary-close {
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        color: var(--color-text-secondary);
                        cursor: pointer;
                        padding: 8px;
                        border-radius: 6px;
                        transition: all 0.2s ease;
                        outline: none;
                        border: 2px solid transparent;
                    }
                    
                    .glossary-close:hover {
                        background: var(--color-bg-tertiary);
                        color: #ef4444;
                        transform: scale(1.1);
                    }
                    
                    .glossary-close:focus {
                        border-color: #3b82f6;
                        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
                    }
                    
                    /* Search */
                    .glossary-search {
                        padding: 16px 24px;
                        border-bottom: 1px solid var(--color-border-primary);
                        position: relative;
                        flex-shrink: 0;
                    }
                    
                    .glossary-search input {
                        width: 100%;
                        padding: 12px 40px 12px 16px;
                        border: 2px solid var(--color-border-secondary);
                        border-radius: 8px;
                        font-size: 0.9rem;
                        transition: all 0.2s ease;
                        outline: none;
                        background: var(--color-bg-primary);
                    }
                    
                    .glossary-search input:focus {
                        border-color: #3b82f6;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                        transform: translateY(-1px);
                    }
                    
                    .search-clear {
                        position: absolute;
                        right: 32px;
                        top: 50%;
                        transform: translateY(-50%);
                        background: none;
                        border: none;
                        color: #9ca3af;
                        cursor: pointer;
                        padding: 6px;
                        border-radius: 4px;
                        transition: all 0.2s ease;
                        outline: none;
                    }
                    
                    .search-clear:hover {
                        background: #f3f4f6;
                        color: #ef4444;
                    }
                    
                    /* Smart Collapsible Navigation */
                    .smart-navigation {
                        border-bottom: 1px solid var(--color-border-primary);
                        background: var(--color-bg-secondary);
                        flex-shrink: 0;
                        overflow: hidden;
                    }
                    
                    .nav-toggle-header {
                        padding: 12px 24px;
                        border-bottom: 1px solid var(--color-border-primary);
                        background: var(--color-bg-secondary);
                    }
                    
                    .smart-nav-toggle {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        width: 100%;
                        padding: 8px 12px;
                        background: var(--color-bg-primary);
                        border: 2px solid var(--color-border-secondary);
                        border-radius: 8px;
                        font-size: 0.85rem;
                        font-weight: 600;
                        color: var(--color-text-primary);
                        cursor: pointer;
                        transition: all 0.2s ease;
                        outline: none;
                        text-align: left;
                    }
                    
                    .smart-nav-toggle:hover {
                        background: var(--color-bg-secondary);
                        border-color: #3b82f6;
                        color: #3b82f6;
                        transform: translateY(-1px);
                        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
                    }
                    
                    .smart-nav-toggle:focus {
                        border-color: #3b82f6;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
                    }
                    
                    .smart-nav-toggle.expanded {
                        background: #3b82f6;
                        color: white;
                        border-color: #3b82f6;
                        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                    }
                    
                    .toggle-text {
                        flex: 1;
                    }
                    
                    .toggle-arrow {
                        font-size: 0.8rem;
                        transition: transform 0.2s ease;
                        font-weight: normal;
                    }
                    
                    .nav-collapsible-content {
                        max-height: 0;
                        opacity: 0;
                        overflow: hidden;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        background: var(--color-bg-secondary);
                    }
                    
                    .nav-collapsible-content.expanded {
                        max-height: 400px;
                        opacity: 1;
                        padding: 16px 24px;
                    }
                    
                    .alphabet-nav-section {
                        margin-bottom: 16px;
                    }
                    
                    .category-nav-section {
                        /* Category section styles */
                    }
                    
                    .nav-label {
                        font-size: 0.8rem;
                        font-weight: 600;
                        color: var(--color-text-primary);
                        margin-bottom: 8px;
                    }
                    
                    .alphabet-buttons {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 4px;
                        justify-content: center;
                    }
                    
                    .alpha-btn {
                        width: 32px;
                        height: 32px;
                        border: 1px solid var(--color-border-secondary);
                        background: var(--color-bg-primary);
                        border-radius: 6px;
                        font-size: 0.8rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        outline: none;
                    }
                    
                    .alpha-btn.has-terms:hover,
                    .alpha-btn.has-terms:focus {
                        background: #3b82f6;
                        color: white;
                        border-color: #3b82f6;
                        transform: translateY(-1px);
                        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                    }
                    
                    .alpha-btn.no-terms {
                        color: var(--color-border-secondary);
                        cursor: not-allowed;
                        background: var(--color-bg-secondary);
                    }
                    
                    /* Category Navigation */
                    .category-dropdown {
                        margin-bottom: 12px;
                    }
                    
                    .category-label {
                        display: block;
                        font-size: 0.8rem;
                        font-weight: 600;
                        color: var(--color-text-primary);
                        margin-bottom: 6px;
                    }
                    
                    .category-select {
                        width: 100%;
                        padding: 8px 12px;
                        border: 2px solid var(--color-border-secondary);
                        border-radius: 6px;
                        background: var(--color-bg-primary);
                        font-size: 0.85rem;
                        color: var(--color-text-primary);
                        cursor: pointer;
                        transition: all 0.2s ease;
                        outline: none;
                    }
                    
                    .category-select:hover,
                    .category-select:focus {
                        border-color: #3b82f6;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    }
                    
                    .quick-categories {
                        display: flex;
                        gap: 8px;
                        flex-wrap: wrap;
                    }
                    
                    .quick-cat-btn {
                        padding: 6px 12px;
                        background: var(--color-bg-primary);
                        border: 2px solid var(--color-border-primary);
                        border-radius: 20px;
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: var(--color-text-secondary);
                        cursor: pointer;
                        transition: all 0.2s ease;
                        outline: none;
                        text-align: center;
                        white-space: nowrap;
                    }
                    
                    .quick-cat-btn:hover {
                        background: var(--color-bg-secondary);
                        border-color: #3b82f6;
                        color: #3b82f6;
                        transform: translateY(-1px);
                    }
                    
                    .quick-cat-btn.active {
                        background: #3b82f6;
                        border-color: #3b82f6;
                        color: white;
                        transform: translateY(-1px);
                        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                    }
                    
                    .quick-cat-btn:focus {
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
                    }
                    
                    /* Simplified Results Summary */
                    .results-summary {
                        padding: 12px 24px;
                        background: var(--color-bg-secondary);
                        border-bottom: 1px solid var(--color-border-primary);
                        font-size: 0.85rem;
                        flex-shrink: 0;
                        text-align: center;
                    }
                    
                    .results-text {
                        color: var(--color-text-secondary);
                        font-weight: 500;
                    }
                    
                    /* Content */
                    .glossary-content {
                        flex: 1;
                        padding: 24px;
                        overflow-y: auto;
                        scroll-behavior: smooth;
                        outline: none;
                    }
                    
                    .glossary-entry {
                        margin-bottom: 32px;
                        padding-bottom: 24px;
                        border-bottom: 1px solid var(--color-bg-tertiary);
                        transition: all 0.3s ease;
                        border-radius: 8px;
                        padding: 20px;
                        margin: 0 -20px 20px -20px;
                    }
                    
                    .glossary-entry:hover {
                        background: var(--color-bg-secondary);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    }
                    
                    .entry-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 16px;
                        gap: 16px;
                    }
                    
                    .entry-title-section {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        flex: 1;
                    }
                    
                    .entry-term {
                        margin: 0;
                        color: var(--color-text-primary);
                        font-size: 1.2rem;
                        font-weight: 700;
                        line-height: 1.3;
                    }
                    
                    /* Source Indicators */
                    .source-indicator {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 0.7rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        flex-shrink: 0;
                        border: 1px solid;
                    }
                    
                    .source-indicator.ga4 {
                        background: linear-gradient(135deg, #fff5f2 0%, #fed7cc 100%);
                        color: #c2410c;
                        border-color: rgba(255, 107, 53, 0.3);
                    }
                    
                    .source-indicator.search-console {
                        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                        color: #1d4ed8;
                        border-color: rgba(66, 133, 244, 0.3);
                    }
                    
                    .source-indicator.calculated {
                        background: var(--color-bg-secondary);
                        color: var(--color-text-primary);
                        border-color: rgba(107, 114, 128, 0.3);
                    }
                    
                    .entry-category {
                        background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
                        color: #0284c7;
                        padding: 6px 10px;
                        border-radius: 16px;
                        font-size: 0.7rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        flex-shrink: 0;
                        border: 1px solid rgba(2, 132, 199, 0.2);
                    }
                    
                    .entry-content {
                        display: flex;
                        flex-direction: column;
                        gap: 14px;
                    }
                    
                    .entry-content > div {
                        padding: 14px;
                        border-radius: 8px;
                        line-height: 1.6;
                        font-size: 0.9rem;
                        border-left: 4px solid;
                    }
                    
                    .entry-definition {
                        background: var(--color-success-bg);
                        border-left-color: #10b981;
                        color: #064e3b;
                    }
                    
                    .entry-calculation {
                        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                        border-left-color: #f59e0b;
                        color: #92400e;
                    }
                    
                    .entry-calculation code {
                        background: rgba(0,0,0,0.1);
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-family: 'Monaco', 'Consolas', monospace;
                        font-size: 0.85rem;
                        font-weight: 500;
                    }
                    
                    .entry-benchmark {
                        background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
                        border-left-color: #0284c7;
                        color: #0c4a6e;
                    }
                    
                    .entry-example {
                        background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
                        border-left-color: #8b5cf6;
                        color: #581c87;
                    }
                    
                    .entry-related {
                        background: var(--color-bg-tertiary);
                        border-left-color: var(--color-text-secondary);
                        color: #475569;
                    }
                    
                    .related-term-link {
                        background: none;
                        border: none;
                        color: #3b82f6;
                        cursor: pointer;
                        text-decoration: underline;
                        font-size: inherit;
                        padding: 2px 4px;
                        margin: 0 2px;
                        border-radius: 4px;
                        transition: all 0.2s ease;
                        outline: none;
                    }
                    
                    .related-term-link:hover {
                        color: #1d4ed8;
                        background: rgba(59, 130, 246, 0.1);
                        text-decoration: none;
                    }
                    
                    /* Search Highlighting */
                    .search-highlight {
                        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                        color: #92400e;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-weight: 600;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    }
                    
                    /* Back to Top */
                    .back-to-top {
                        position: absolute;
                        bottom: 24px;
                        right: 24px;
                        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                        color: white;
                        border: none;
                        padding: 12px 16px;
                        border-radius: 8px;
                        font-size: 0.8rem;
                        font-weight: 600;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                        transition: all 0.3s ease;
                        outline: none;
                    }
                    
                    .back-to-top:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
                    }
                    
                    /* Responsive Design */
                    @media (max-width: 768px) {
                        .glossary-panel {
                            width: 100%;
                            right: -100%;
                        }
                        
                        .glossary-fab {
                            top: auto;
                            bottom: 20px;
                            right: 20px;
                            width: 48px;
                            height: 48px;
                            font-size: 1.2rem;
                        }
                        
                        .fab-tooltip {
                            display: none;
                        }
                        
                        .nav-toggle-header {
                            padding: 12px 16px;
                        }
                        
                        .nav-collapsible-content.expanded {
                            padding: 12px 16px;
                        }
                        
                        .alphabet-buttons {
                            gap: 3px;
                        }
                        
                        .alpha-btn {
                            width: 28px;
                            height: 28px;
                            font-size: 0.7rem;
                        }
                        
                        .quick-categories {
                            gap: 6px;
                        }
                        
                        .quick-cat-btn {
                            padding: 4px 8px;
                            font-size: 0.7rem;
                        }
                        
                        .entry-header {
                            flex-direction: column;
                            gap: 8px;
                        }
                        
                        .entry-title-section {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 8px;
                        }
                    }
                    
                    /* Scrollbar Styling */
                    .glossary-content::-webkit-scrollbar {
                        width: 8px;
                    }
                    
                    .glossary-content::-webkit-scrollbar-track {
                        background: var(--color-bg-tertiary);
                        border-radius: 4px;
                    }
                    
                    .glossary-content::-webkit-scrollbar-thumb {
                        background: linear-gradient(135deg, var(--color-border-secondary) 0%, var(--color-text-muted) 100%);
                        border-radius: 4px;
                        border: 1px solid var(--color-border-primary);
                    }
                    
                    .glossary-content::-webkit-scrollbar-thumb:hover {
                        background: linear-gradient(135deg, var(--color-text-muted) 0%, var(--color-text-secondary) 100%);
                    }
                </style>
            `;
            
            document.head.insertAdjacentHTML('beforeend', styles);
            debugLog('✅ Complete styles added');
        }
    }
    
    // Global initialization function
    window.initializeGlossarySystem = function() {
        debugLog('🚀 Starting complete system initialization...');
        
        try {
            const instance = new DashboardGlossarySystem();
            
            instance.init().then(success => {
                if (success) {
                    window.DashboardGlossary._markReady(instance);
                    
                    // Success messages
                    console.log('%c📚 Dashboard Glossary System Loaded Successfully!', 
                               'color: #10b981; font-weight: bold; font-size: 16px;');
                    console.log('%c🎉 All features operational', 'color: #3b82f6; font-weight: bold;');
                    console.log('');
                    console.log('📋 Available Commands:');
                    console.log('  DashboardGlossary.open() - Open the glossary');
                    console.log('  DashboardGlossary.searchFor("CTR") - Search for specific terms');
                    console.log('  DashboardGlossary.goToCategory("Google Analytics") - Filter by category');
                    console.log('  DashboardGlossary.isHealthy() - Check system status');
                    console.log('  DashboardGlossary.getDebugInfo() - Get debug information');
                    console.log('');
                    console.log('🔍 Try searching for:');
                    console.log('  • "CTR" or "Click-Through Rate"');
                    console.log('  • "Quality Score" or "engagement"');
                    console.log('  • "Core Web Vitals" or "accessibility"');
                    console.log('  • "Citizens Reached" or "satisfaction"');
                    console.log('');
                    console.log(`📊 Loaded ${Object.keys(glossaryData).length} terms across ${Object.keys(categories).length} categories`);
                    
                } else {
                    throw new Error('Instance initialization failed');
                }
            }).catch(error => {
                debugLog('❌ Instance initialization error:', error);
                window.DashboardGlossary._initAttempts++;
                
                if (window.DashboardGlossary._initAttempts < window.DashboardGlossary._maxInitAttempts) {
                    setTimeout(() => {
                        debugLog('🔄 Retrying initialization...');
                        window.initializeGlossarySystem();
                    }, 1000);
                }
            });
            
        } catch (error) {
            debugLog('❌ Critical initialization error:', error);
            window.DashboardGlossary._initAttempts++;
        }
    };
    
})();

// ===========================================
// BULLETPROOF AUTO-INITIALIZATION
// ===========================================

console.log('⚡ Starting bulletproof auto-initialization...');

function startInitialization() {
    console.log('🔄 Attempting initialization...');
    
    try {
        if (typeof window.initializeGlossarySystem === 'function') {
            window.initializeGlossarySystem();
        } else {
            console.warn('⚠️ initializeGlossarySystem not available, retrying...');
            setTimeout(startInitialization, 500);
        }
    } catch (error) {
        console.error('❌ Initialization error:', error);
        window.DashboardGlossary._initAttempts++;
    }
}

// Multiple initialization strategies
if (document.readyState === 'loading') {
    console.log('📄 DOM loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', startInitialization);
} else {
    console.log('📄 DOM ready, starting initialization...');
    setTimeout(startInitialization, 100);
}

// Backup attempts with increasing delays
setTimeout(() => {
    if (!window.DashboardGlossary.isHealthy()) {
        console.log('🔄 Backup initialization attempt 1...');
        startInitialization();
    }
}, 1000);

setTimeout(() => {
    if (!window.DashboardGlossary.isHealthy()) {
        console.log('🔄 Backup initialization attempt 2...');
        startInitialization();
    }
}, 3000);

setTimeout(() => {
    if (!window.DashboardGlossary.isHealthy()) {
        console.log('🔄 Final backup initialization attempt...');
        startInitialization();
    }
}, 5000);

// Final diagnostic and user guidance
setTimeout(() => {
    const debugInfo = window.DashboardGlossary.getDebugInfo();
    console.log('🩺 Final system diagnostic:', debugInfo);
    
    if (!window.DashboardGlossary.isHealthy()) {
        console.error('%c❌ Dashboard Glossary Failed to Initialize', 'color: #ef4444; font-weight: bold;');
        console.log('%c💡 Try these troubleshooting steps:', 'color: #f59e0b; font-weight: bold;');
        console.log('1. Check browser console for errors above this message');
        console.log('2. Run: DashboardGlossary.forceInit()');
        console.log('3. Run: DashboardGlossary.getDebugInfo()');
        console.log('4. Refresh the page');
        console.log('5. Check that no other scripts are interfering');
    } else {
        console.log('%c✅ Dashboard Glossary System Ready!', 'color: #10b981; font-weight: bold; font-size: 14px;');
        console.log('Click the 📚 button in the top-right corner to open the glossary!');
    }
}, 10000);
