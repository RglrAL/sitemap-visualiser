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
        // Search Console Metrics
        'CTR (Click-Through Rate)': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Percentage of people who click on your page after seeing it in search results.',
            calculation: '(Clicks ÷ Impressions) × 100',
            benchmark: 'Position 1: ~28%, Position 2: ~15%, Position 3: ~11%, Position 4-5: ~6%',
            example: '5.2% CTR means 52 people clicked for every 1,000 who saw your page in search',
            relatedTerms: ['Click Rate', 'Search CTR', 'Organic CTR']
        },
        
        'Clicks': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Number of times users clicked on your page from Google search results.',
            calculation: 'Direct count from Search Console',
            benchmark: 'Varies by content type - government pages typically 100-1,000+ monthly',
            example: '245 clicks means 245 people visited your page from Google search this month',
            relatedTerms: ['Search Clicks', 'Organic Clicks', 'GSC Clicks']
        },
        
        'Impressions': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Number of times your page appeared in Google search results.',
            calculation: 'Direct count from Search Console',
            benchmark: 'Good: 10x more than clicks, Excellent: 20x+ more than clicks',
            example: '5,000 impressions means your page appeared in search results 5,000 times',
            relatedTerms: ['Search Impressions', 'SERP Appearances', 'Visibility']
        },
        
        'Average Position': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Average ranking position of your page in Google search results.',
            calculation: 'Weighted average of all query positions',
            benchmark: 'Excellent: 1-3, Good: 4-10, Fair: 11-20, Poor: 20+',
            example: 'Position 5.2 means your page typically appears 5th-6th in search results',
            relatedTerms: ['Ranking', 'SERP Position', 'Search Ranking']
        },
        
        'Top Queries': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Most common search terms that lead people to your page.',
            calculation: 'Ranked by clicks or impressions',
            benchmark: 'Top query should represent 10-30% of total traffic',
            example: '"passport application" bringing 45 clicks shows citizens need passport info',
            relatedTerms: ['Search Queries', 'Keywords', 'Search Terms']
        },
        
        // Google Analytics Metrics
        'Users': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Number of unique individuals who visited your page.',
            calculation: 'Distinct count based on Google Analytics user identification',
            benchmark: 'Government pages: 500-5,000+ monthly users typical',
            example: '1,250 users means 1,250 different people visited your page',
            relatedTerms: ['Unique Visitors', 'Distinct Users', 'People']
        },
        
        'Page Views': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Total number of times your page was viewed (includes repeat visits).',
            calculation: 'Count of all page view events',
            benchmark: 'Typically 1.2-2.5x higher than users (people viewing multiple times)',
            example: '1,800 page views from 1,250 users means some people returned',
            relatedTerms: ['Views', 'Page Hits', 'Total Views']
        },
        
        'Sessions': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Number of visits to your website (a session can include multiple pages).',
            calculation: 'Count of distinct user sessions',
            benchmark: 'Usually similar to Users for single-page analysis',
            example: '1,300 sessions means people made 1,300 separate visits',
            relatedTerms: ['Visits', 'Site Sessions', 'User Sessions']
        },
        
        'Average Session Duration': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Average time users spend on your page during a session.',
            calculation: 'Total session duration ÷ Number of sessions',
            benchmark: 'Government: 52+ seconds excellent, 35+ good, 20+ fair',
            example: '2:15 duration means people typically spend 2 minutes 15 seconds reading',
            relatedTerms: ['Time on Page', 'Session Length', 'Engagement Time']
        },
        
        'Bounce Rate': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Percentage of users who leave your page without interacting (single-page sessions).',
            calculation: '(Single-page sessions ÷ Total sessions) × 100',
            benchmark: 'Government: <40% excellent, 40-60% good, 60-80% fair, >80% poor',
            example: '35% bounce rate means 35 out of 100 visitors left immediately',
            relatedTerms: ['Exit Rate', 'Single Page Sessions', 'Immediate Exits']
        },
        
        'Engagement Rate': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Percentage of sessions where users actively engaged with your content.',
            calculation: '(Engaged sessions ÷ Total sessions) × 100',
            benchmark: 'Government benchmark: 50%+ excellent, 35%+ good, 20%+ fair',
            example: '65% engagement rate means 65 out of 100 visitors actively engaged',
            relatedTerms: ['User Engagement', 'Active Sessions', 'Content Engagement']
        },
        
        // Dashboard Calculations
        'Quality Score': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'Overall content performance score combining search, engagement, relevance, and UX.',
            calculation: '(Search Score + Engagement Score + Relevance Score + UX Score) ÷ 4',
            benchmark: 'A: 85+, B: 75+, C: 65+, D: 55+, F: <55',
            example: 'Quality Score 78 (B grade) indicates good overall performance',
            relatedTerms: ['Performance Score', 'Content Rating', 'Overall Score']
        },
        
        'Search Score': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'How well your page performs in search results.',
            calculation: '(Position Score + CTR Score) ÷ 2, where Position Score = max(0, 100 - position × 5) and CTR Score = min(100, CTR × 1000)',
            benchmark: '80+: Excellent, 60+: Good, 40+: Fair, <40: Poor',
            example: 'Search Score 72 indicates good search performance',
            relatedTerms: ['SEO Score', 'Search Performance', 'Visibility Score']
        },
        
        'Engagement Score': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'How well your page engages visitors.',
            calculation: '(Duration Score + Bounce Score) ÷ 2, where Duration Score = min(100, session duration ÷ 300 × 100) and Bounce Score = max(0, (1 - bounce rate) × 100)',
            benchmark: '80+: Highly engaging, 60+: Good, 40+: Fair, <40: Poor',
            example: 'Engagement Score 68 shows good user engagement',
            relatedTerms: ['User Engagement', 'Content Engagement', 'Interaction Score']
        },
        
        // Impact Metrics
        'Citizens Reached': {
            category: 'Impact Metrics',
            source: 'calculated',
            definition: 'Total number of citizens who accessed your content monthly.',
            calculation: 'Search Clicks + Unique Users (with overlap consideration)',
            benchmark: 'Varies by service type - aim for consistent monthly growth',
            example: '2,850 citizens reached means your content helped 2,850 people find information',
            relatedTerms: ['Monthly Reach', 'Citizen Engagement', 'Public Impact']
        },
        
        'Content Helpfulness': {
            category: 'Impact Metrics',
            source: 'calculated',
            definition: 'Percentage indicating how helpful your content is to citizens.',
            calculation: '((1 - Bounce Rate) × 50) + (min(100, Session Duration ÷ 180) × 50)',
            benchmark: '80+%: Very helpful, 65+%: Helpful, 50+%: Somewhat helpful, <50%: Needs improvement',
            example: '72% helpfulness means most citizens find your content useful',
            relatedTerms: ['Content Effectiveness', 'User Satisfaction', 'Service Quality']
        },
        
        // Technical Performance
        'Core Web Vitals': {
            category: 'Technical Performance',
            source: 'ga4',
            definition: 'Google\'s user experience metrics measuring loading, interactivity, and visual stability.',
            calculation: 'LCP (Largest Contentful Paint) + FID (First Input Delay) + CLS (Cumulative Layout Shift)',
            benchmark: 'Good: LCP <2.5s, FID <100ms, CLS <0.1',
            example: 'LCP 1.8s, FID 45ms, CLS 0.05 = Excellent Core Web Vitals score',
            relatedTerms: ['Page Speed', 'User Experience', 'SEO Performance']
        },
        
        'Page Load Speed': {
            category: 'Technical Performance',
            source: 'ga4',
            definition: 'Time taken for a web page to completely load and display all content.',
            calculation: 'Time from navigation start to load event completion',
            benchmark: 'Excellent: <1s, Good: 1-3s, Fair: 3-5s, Poor: >5s',
            example: '2.3 second load time provides good user experience',
            relatedTerms: ['Core Web Vitals', 'User Experience', 'Bounce Rate']
        },
        
        'Accessibility Score': {
            category: 'Technical Performance',
            source: 'calculated',
            definition: 'Website compliance with accessibility standards for users with disabilities.',
            calculation: 'WCAG 2.1 compliance + screen reader compatibility + keyboard navigation',
            benchmark: 'AA compliance required, AAA preferred for government sites',
            example: 'WCAG AA compliance ensures 95% of users can access content',
            relatedTerms: ['User Experience', 'Government Standards', 'Inclusion']
        },
        
        // Geographic Intelligence
        'Regional Distribution': {
            category: 'Geographic Intelligence',
            source: 'ga4',
            definition: 'How your users are spread across Irish counties and regions.',
            calculation: 'Percentage breakdown from GA4 geographic data',
            benchmark: 'Balanced: <40% Dublin, Concentrated: >50% Dublin',
            example: '38% Dublin distribution shows good regional balance',
            relatedTerms: ['Geographic Spread', 'Regional Access', 'County Coverage']
        },
        
        'Dublin Concentration': {
            category: 'Geographic Intelligence',
            source: 'calculated',
            definition: 'Percentage of your users located in Dublin metropolitan area.',
            calculation: '(Dublin Users ÷ Total Irish Users) × 100',
            benchmark: '<30%: Distributed, 30-50%: Moderate, >50%: High concentration',
            example: '42% Dublin concentration suggests service accessibility focus needed',
            relatedTerms: ['Capital Concentration', 'Urban Focus', 'Metropolitan Bias']
        },
        
        // Traffic Sources
        'Organic Traffic': {
            category: 'Traffic Sources',
            source: 'ga4',
            definition: 'Website visitors who arrive through unpaid search engine results.',
            calculation: 'Users from Google, Bing, other search engines (excluding ads)',
            benchmark: '60-80% organic traffic indicates strong SEO performance',
            example: '1,200 organic visitors means people found you through search',
            relatedTerms: ['Search Console', 'SEO Performance', 'Clicks']
        },
        
        'Direct Traffic': {
            category: 'Traffic Sources',
            source: 'ga4',
            definition: 'Users who visit by typing URL directly or using bookmarks.',
            calculation: 'Sessions with no identifiable referral source',
            benchmark: '20-40% direct traffic shows good brand recognition',
            example: '340 direct visits indicate citizens know your URL',
            relatedTerms: ['Brand Awareness', 'Return Visitors', 'Bookmarks']
        },
        
        // Citizen Experience
        'User Satisfaction Score': {
            category: 'Citizen Experience',
            source: 'calculated',
            definition: 'Survey-based measurement of citizen happiness with digital services.',
            calculation: 'Average rating from user feedback surveys (1-10 scale)',
            benchmark: '8.0+ excellent, 7.0+ good, 6.0+ acceptable citizen satisfaction',
            example: '8.2 satisfaction score indicates citizens are very happy',
            relatedTerms: ['Service Quality', 'User Experience', 'Citizen Feedback']
        },
        
        'Task Completion Rate': {
            category: 'Digital Service Delivery',
            source: 'ga4',
            definition: 'Percentage of users who successfully complete their intended actions.',
            calculation: '(Completed tasks ÷ Attempted tasks) × 100',
            benchmark: '80%+ excellent, 60%+ good for complex government processes',
            example: '78% completion rate means most citizens finish applications',
            relatedTerms: ['User Success', 'Process Efficiency', 'Service Quality']
        }
    };
    
    const categories = {
        'Search Console': {
            icon: '🔍',
            description: 'Direct metrics from Google Search Console showing search performance'
        },
        'Google Analytics': {
            icon: '📊',
            description: 'User behavior and engagement metrics from Google Analytics 4'
        },
        'Dashboard Calculations': {
            icon: '🧮',
            description: 'Composite scores and calculated metrics for content quality assessment'
        },
        'Impact Metrics': {
            icon: '🎯',
            description: 'Measurements of real-world citizen service impact and effectiveness'
        },
        'Technical Performance': {
            icon: '⚡',
            description: 'Website speed, accessibility, and technical user experience metrics'
        },
        'Geographic Intelligence': {
            icon: '🌍',
            description: 'Location-based analysis of service usage across Ireland and internationally'
        },
        'Traffic Sources': {
            icon: '🚪',
            description: 'How citizens discover and arrive at your digital services'
        },
        'Citizen Experience': {
            icon: '😊',
            description: 'Overall satisfaction and experience quality metrics for citizens'
        },
        'Digital Service Delivery': {
            icon: '💻',
            description: 'Effectiveness of online government services and processes'
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
            const navContent = safeGetElement('navContent');
            const navToggle = safeGetElement('navToggle');
            
            if (navContent && navToggle) {
                navContent.classList.remove('expanded');
                navToggle.classList.remove('expanded');
                navToggle.setAttribute('aria-expanded', 'false');
                
                const toggleArrow = navToggle.querySelector('.toggle-arrow');
                const toggleText = navToggle.querySelector('.toggle-text');
                
                if (toggleArrow) toggleArrow.textContent = '↓';
                if (toggleText) toggleText.textContent = 'Show Menu';
                
                debugLog('📖 Navigation initialized in collapsed state');
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
                    
                    <!-- Enhanced Navigation -->
                    <div class="glossary-nav" id="glossaryNav">
                        <div class="nav-header">
                            <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation menu">
                                <span class="toggle-icon">📖</span>
                                <span class="toggle-text">Menu</span>
                                <span class="toggle-arrow">↑</span>
                            </button>
                        </div>
                        
                        <div class="nav-content" id="navContent">
                            <!-- Alphabet Navigation -->
                            <div class="alphabet-nav">
                                <div class="nav-label">Jump to:</div>
                                <div class="alphabet-buttons" role="tablist" aria-label="Alphabetical navigation">
                                    ${alphabetNav}
                                </div>
                            </div>
                            
                            <!-- Category Filters -->
                            <div class="category-nav">
                                <div class="nav-label">Filter by category:</div>
                                <div class="category-filters" role="group" aria-label="Category filters">
                                    <button class="category-filter active" data-category="all" aria-pressed="true">
                                        <span class="category-icon" aria-hidden="true">📋</span>
                                        <span class="category-name">All Terms</span>
                                        <span class="category-count">${Object.keys(glossaryData).length}</span>
                                    </button>
                                    ${categoryFilters}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Results Summary -->
                    <div class="results-summary" id="${CONFIG.SELECTORS.resultsSummary}" role="status" aria-live="polite">
                        <div class="summary-content">
                            <span class="results-text">Showing ${Object.keys(glossaryData).length} terms</span>
                            <span class="menu-hint" id="menuHint">💡 Click "Show Menu" above to browse by category or letter</span>
                        </div>
                        <div class="source-legend">
                            <div class="legend-item">
                                <div class="source-indicator ga4">
                                    <svg width="14" height="14" viewBox="0 0 24 24" style="opacity: 0.8;">
                                        <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                                    </svg>
                                    <span class="source-label">GA4</span>
                                </div>
                                <span class="legend-desc">Google Analytics 4</span>
                            </div>
                            <div class="legend-item">
                                <div class="source-indicator search-console">
                                    <svg width="14" height="14" viewBox="0 0 24 24" style="opacity: 0.8;">
                                        <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    <span class="source-label">SC</span>
                                </div>
                                <span class="legend-desc">Search Console</span>
                            </div>
                            <div class="legend-item">
                                <div class="source-indicator calculated">
                                    <svg width="14" height="14" viewBox="0 0 24 24" style="opacity: 0.8;">
                                        <path fill="#6b7280" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                                    </svg>
                                    <span class="source-label">CALC</span>
                                </div>
                                <span class="legend-desc">Calculated</span>
                            </div>
                        </div>
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
                const navToggle = safeGetElement('navToggle');
                
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
                
                // Navigation toggle
                if (navToggle) {
                    navToggle.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.toggleNavigation();
                    });
                    debugLog('✅ Navigation toggle listener added');
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
            
            // Category filters
            if (target.classList.contains('category-filter') || target.closest('.category-filter')) {
                e.preventDefault();
                const button = target.classList.contains('category-filter') ? target : target.closest('.category-filter');
                const category = button.dataset.category;
                this.filterByCategory(category);
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
            
            // Update category buttons
            document.querySelectorAll('.category-filter').forEach(btn => {
                const isActive = btn.dataset.category === category;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', isActive.toString());
            });
            
            this.updateResultsSummary(visibleCount, '', category);
            
            // Clear search
            const searchInput = safeGetElement(CONFIG.SELECTORS.search);
            if (searchInput) {
                searchInput.value = '';
                this.updateClearButton('');
            }
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
            const menuHint = summary.querySelector('#menuHint');
            
            if (resultsText) {
                resultsText.textContent = text;
            }
            
            if (menuHint) {
                const navContent = safeGetElement('navContent');
                const isNavExpanded = navContent && navContent.classList.contains('expanded');
                menuHint.style.display = (isNavExpanded || query || category !== '') ? 'none' : 'block';
            }
        }
        
        scrollToTop() {
            const content = safeGetElement(CONFIG.SELECTORS.content);
            if (content) {
                content.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
        
        toggleNavigation() {
            const navContent = safeGetElement('navContent');
            const navToggle = safeGetElement('navToggle');
            const menuHint = safeGetElement('menuHint');
            
            if (navContent && navToggle) {
                const isExpanded = navContent.classList.contains('expanded');
                const toggleArrow = navToggle.querySelector('.toggle-arrow');
                const toggleText = navToggle.querySelector('.toggle-text');
                
                if (isExpanded) {
                    navContent.classList.remove('expanded');
                    navToggle.classList.remove('expanded');
                    if (toggleArrow) toggleArrow.textContent = '↓';
                    if (toggleText) toggleText.textContent = 'Show Menu';
                    navToggle.setAttribute('aria-expanded', 'false');
                    if (menuHint) menuHint.style.display = 'block';
                } else {
                    navContent.classList.add('expanded');
                    navToggle.classList.add('expanded');
                    if (toggleArrow) toggleArrow.textContent = '↑';
                    if (toggleText) toggleText.textContent = 'Hide Menu';
                    navToggle.setAttribute('aria-expanded', 'true');
                    if (menuHint) menuHint.style.display = 'none';
                }
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
                        top: 80px;
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
                        background: white;
                        border-left: 1px solid #e2e8f0;
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
                        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                        border-bottom: 1px solid #e2e8f0;
                        flex-shrink: 0;
                    }
                    
                    .glossary-title h2 {
                        margin: 0 0 4px 0;
                        color: #1f2937;
                        font-size: 1.4rem;
                        font-weight: 700;
                    }
                    
                    .glossary-title p {
                        margin: 0;
                        color: #64748b;
                        font-size: 0.9rem;
                    }
                    
                    .glossary-close {
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        color: #64748b;
                        cursor: pointer;
                        padding: 8px;
                        border-radius: 6px;
                        transition: all 0.2s ease;
                        outline: none;
                        border: 2px solid transparent;
                    }
                    
                    .glossary-close:hover {
                        background: #f1f5f9;
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
                        border-bottom: 1px solid #e2e8f0;
                        position: relative;
                        flex-shrink: 0;
                    }
                    
                    .glossary-search input {
                        width: 100%;
                        padding: 12px 40px 12px 16px;
                        border: 2px solid #d1d5db;
                        border-radius: 8px;
                        font-size: 0.9rem;
                        transition: all 0.2s ease;
                        outline: none;
                        background: white;
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
                    
                    /* Navigation */
                    .glossary-nav {
                        border-bottom: 1px solid #e2e8f0;
                        background: #fafbfc;
                        flex-shrink: 0;
                        overflow: hidden;
                    }
                    
                    .nav-header {
                        padding: 12px 24px;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    
                    .nav-toggle {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        width: 100%;
                        padding: 8px 12px;
                        background: white;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        font-size: 0.85rem;
                        font-weight: 600;
                        color: #374151;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        outline: none;
                        text-align: left;
                    }
                    
                    .nav-toggle:hover {
                        background: #f8fafc;
                        border-color: #3b82f6;
                        color: #3b82f6;
                    }
                    
                    .nav-toggle.expanded {
                        background: #3b82f6;
                        color: white;
                        border-color: #3b82f6;
                    }
                    
                    .toggle-text {
                        flex: 1;
                    }
                    
                    .toggle-arrow {
                        font-size: 0.8rem;
                        transition: transform 0.3s ease;
                    }
                    
                    .nav-content {
                        max-height: 0;
                        opacity: 0;
                        overflow: hidden;
                        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                        padding: 0 24px;
                    }
                    
                    .nav-content.expanded {
                        max-height: 800px;
                        opacity: 1;
                        padding: 16px 24px;
                    }
                    
                    .nav-label {
                        font-size: 0.8rem;
                        font-weight: 600;
                        color: #374151;
                        margin-bottom: 8px;
                    }
                    
                    .alphabet-nav {
                        margin-bottom: 16px;
                    }
                    
                    .alphabet-buttons {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 4px;
                    }
                    
                    .alpha-btn {
                        width: 32px;
                        height: 32px;
                        border: 1px solid #d1d5db;
                        background: white;
                        border-radius: 6px;
                        font-size: 0.8rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        outline: none;
                    }
                    
                    .alpha-btn.has-terms:hover {
                        background: #3b82f6;
                        color: white;
                        border-color: #3b82f6;
                        transform: translateY(-1px);
                    }
                    
                    .alpha-btn.no-terms {
                        color: #d1d5db;
                        cursor: not-allowed;
                    }
                    
                    .category-filters {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    
                    .category-filter {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 10px 12px;
                        background: white;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        font-size: 0.8rem;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        text-align: left;
                        outline: none;
                    }
                    
                    .category-filter:hover {
                        background: #f8fafc;
                        border-color: #3b82f6;
                        transform: translateY(-1px);
                    }
                    
                    .category-filter.active {
                        background: #3b82f6;
                        color: white;
                        border-color: #3b82f6;
                        transform: translateY(-1px);
                    }
                    
                    .category-name {
                        flex: 1;
                        font-weight: 500;
                    }
                    
                    .category-count {
                        background: rgba(0,0,0,0.1);
                        padding: 3px 8px;
                        border-radius: 12px;
                        font-size: 0.7rem;
                        font-weight: 600;
                        min-width: 20px;
                        text-align: center;
                    }
                    
                    .category-filter.active .category-count {
                        background: rgba(255,255,255,0.25);
                    }
                    
                    /* Results Summary */
                    .results-summary {
                        padding: 12px 24px;
                        background: #f8fafc;
                        border-bottom: 1px solid #e2e8f0;
                        font-size: 0.85rem;
                        flex-shrink: 0;
                    }
                    
                    .summary-content {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        margin-bottom: 12px;
                    }
                    
                    .results-text {
                        color: #64748b;
                        font-weight: 500;
                    }
                    
                    .menu-hint {
                        color: #3b82f6;
                        font-size: 0.8rem;
                        font-weight: 500;
                    }
                    
                    /* Source Legend */
                    .source-legend {
                        display: flex;
                        gap: 16px;
                        flex-wrap: wrap;
                        padding-top: 8px;
                        border-top: 1px solid rgba(226, 232, 240, 0.5);
                    }
                    
                    .legend-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 0.75rem;
                    }
                    
                    .legend-desc {
                        color: #64748b;
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
                        border-bottom: 1px solid #f1f5f9;
                        transition: all 0.3s ease;
                        border-radius: 8px;
                        padding: 20px;
                        margin: 0 -20px 20px -20px;
                    }
                    
                    .glossary-entry:hover {
                        background: #fafbfc;
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
                        color: #1f2937;
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
                        background: linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%);
                        color: #374151;
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
                        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
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
                        background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
                        border-left-color: #64748b;
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
                            top: 60px;
                            right: 20px;
                            width: 48px;
                            height: 48px;
                            font-size: 1.2rem;
                        }
                        
                        .fab-tooltip {
                            display: none;
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
                        background: #f1f5f9;
                        border-radius: 4px;
                    }
                    
                    .glossary-content::-webkit-scrollbar-thumb {
                        background: linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%);
                        border-radius: 4px;
                        border: 1px solid #e2e8f0;
                    }
                    
                    .glossary-content::-webkit-scrollbar-thumb:hover {
                        background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
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
