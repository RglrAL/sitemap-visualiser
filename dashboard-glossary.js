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
            relatedTerms: ['Click Rate', 'Search CTR', 'Clicks', 'Impressions']
        },
        
        'Clicks': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Number of times users clicked on your page from Google search results.',
            calculation: 'Direct count from Search Console',
            benchmark: 'Varies by content type - government pages typically 100-1,000+ monthly',
            example: '245 clicks means 245 people visited your page from Google search this month',
            relatedTerms: ['Search Clicks', 'Organic Clicks', 'CTR']
        },
        
        'Impressions': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Number of times your page appeared in Google search results.',
            calculation: 'Direct count from Search Console',
            benchmark: 'Good: 10x more than clicks, Excellent: 20x+ more than clicks',
            example: '5,000 impressions means your page appeared in search results 5,000 times',
            relatedTerms: ['Search Impressions', 'SERP Appearances', 'CTR']
        },
        
        'Average Position': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Average ranking position of your page in Google search results.',
            calculation: 'Weighted average of all query positions',
            benchmark: 'Excellent: 1-3, Good: 4-10, Fair: 11-20, Poor: 20+',
            example: 'Position 5.2 means your page typically appears 5th-6th in search results',
            relatedTerms: ['Ranking', 'SERP Position', 'Search Score']
        },
        
        'Top Queries': {
            category: 'Search Console',
            source: 'search_console',
            definition: 'Most common search terms that lead people to your page.',
            calculation: 'Ranked by clicks or impressions from Search Console',
            benchmark: 'Top query should represent 10-30% of total traffic',
            example: '"passport application" bringing 45 clicks shows citizens need passport info',
            relatedTerms: ['Search Queries', 'Keywords', 'Opportunity Queries']
        },

        'Opportunity Queries': {
            category: 'Search Console',
            source: 'calculated',
            definition: 'High impressions queries with low CTR that represent optimization opportunities.',
            calculation: 'Queries with high impressions but below-average CTR for their position',
            benchmark: 'CTR improvement potential >50% indicates high-value opportunity',
            example: 'Query with 1,000 impressions but 1% CTR when benchmark is 3% CTR',
            relatedTerms: ['Top Queries', 'CTR Gap Analysis', 'Quick Wins']
        },
        
        // Google Analytics Metrics
        'Users': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Number of unique individuals who visited your page.',
            calculation: 'Distinct count based on Google Analytics user identification',
            benchmark: 'Government pages: 500-5,000+ monthly users typical',
            example: '1,250 users means 1,250 different people visited your page',
            relatedTerms: ['New Users', 'Active Users', 'Citizens Reached']
        },

        'New Users': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Number of users visiting your page for the first time in the selected period.',
            calculation: 'GA4 count of users with no previous sessions',
            benchmark: '60-80% new users indicates strong discovery performance',
            example: '800 new users out of 1,250 total means good content discoverability',
            relatedTerms: ['Users', 'Active Users', 'Discovery']
        },

        'Active Users': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Users who had at least one engaged session during the selected period.',
            calculation: 'GA4 count of users with engaged sessions (10+ seconds, conversion, or 2+ page views)',
            benchmark: 'Should be 70-90% of total users for quality content',
            example: '1,100 active users from 1,250 total shows engaging content',
            relatedTerms: ['Users', 'Engaged Sessions', 'Engagement Rate']
        },
        
        'Page Views': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Total number of times your page was viewed (includes repeat visits).',
            calculation: 'Count of all page view events from GA4',
            benchmark: 'Typically 1.2-2.5x higher than users (people viewing multiple times)',
            example: '1,800 page views from 1,250 users means some people returned',
            relatedTerms: ['Screen Page Views', 'Sessions', 'Users']
        },
        
        'Sessions': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Number of visits to your website (a session can include multiple pages).',
            calculation: 'Count of distinct user sessions from GA4',
            benchmark: 'Usually similar to Users for single-page analysis',
            example: '1,300 sessions means people made 1,300 separate visits',
            relatedTerms: ['Users', 'Page Views', 'Engaged Sessions']
        },
        
        'Average Session Duration': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Average time users spend on your page during a session.',
            calculation: 'Total session duration ÷ Number of sessions',
            benchmark: 'Government: 52+ seconds excellent, 35+ good, 20+ fair',
            example: '2:15 duration means people typically spend 2 minutes 15 seconds reading',
            relatedTerms: ['Engagement Score', 'Bounce Rate', 'Content Helpfulness']
        },
        
        'Bounce Rate': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Percentage of users who leave your page without interacting (single-page sessions).',
            calculation: '(Single-page sessions ÷ Total sessions) × 100',
            benchmark: 'Government: <40% excellent, 40-60% good, 60-80% fair, >80% poor',
            example: '35% bounce rate means 35 out of 100 visitors left immediately',
            relatedTerms: ['Engagement Rate', 'Content Helpfulness', 'Engagement Score']
        },
        
        'Engagement Rate': {
            category: 'Google Analytics',
            source: 'ga4',
            definition: 'Percentage of sessions where users actively engaged with your content.',
            calculation: '(Engaged sessions ÷ Total sessions) × 100',
            benchmark: 'Government benchmark: 50%+ excellent, 35%+ good, 20%+ fair',
            example: '65% engagement rate means 65 out of 100 visitors actively engaged',
            relatedTerms: ['Active Users', 'Bounce Rate', 'Engagement Score']
        },
        
        // Dashboard Calculated Scores
        'Quality Score': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'Overall content performance score combining search, engagement, relevance, and UX.',
            calculation: '(Search Score + Engagement Score + Relevance Score + UX Score) ÷ 4',
            benchmark: 'A: 85+, B: 75+, C: 65+, D: 55+, F: <55',
            example: 'Quality Score 78 (B grade) indicates good overall performance',
            relatedTerms: ['Search Score', 'Engagement Score', 'Priority Score']
        },
        
        'Search Score': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'How well your page performs in search results based on position and CTR.',
            calculation: '(Position Score + CTR Score) ÷ 2, considering benchmarks for ranking position',
            benchmark: '80+: Excellent, 60+: Good, 40+: Fair, <40: Poor',
            example: 'Search Score 72 indicates good search performance',
            relatedTerms: ['Average Position', 'CTR', 'Quality Score']
        },
        
        'Engagement Score': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'How well your page engages visitors based on time and bounce rate.',
            calculation: 'Combines session duration performance and bounce rate inverse',
            benchmark: '80+: Highly engaging, 60+: Good, 40+: Fair, <40: Poor',
            example: 'Engagement Score 68 shows good user engagement',
            relatedTerms: ['Average Session Duration', 'Bounce Rate', 'Quality Score']
        },

        'Priority Score': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'Government framework weighted score combining traffic, growth, search, and discovery.',
            calculation: 'Traffic 40% + Growth 25% + Search 20% + Discovery 15%',
            benchmark: '80+: Critical priority, 60+: High, 40+: Medium, <40: Low',
            example: 'Priority Score 75 indicates high-priority content for improvement',
            relatedTerms: ['Quality Score', 'Traffic Grade', 'Growth Component']
        },

        'Traffic Grade': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'Letter grade assessment of traffic volume based on click thresholds.',
            calculation: 'A+: 1000+ clicks, A: 500+, B: 100+, C: 50+, D: 10+, F: <10',
            benchmark: 'B grade or higher indicates strong traffic performance',
            example: 'Traffic Grade B means 100-499 monthly clicks from search',
            relatedTerms: ['Clicks', 'CTR Grade', 'Priority Score']
        },

        'CTR Grade': {
            category: 'Dashboard Calculations',
            source: 'calculated',
            definition: 'Letter grade comparing actual CTR to position-based benchmarks.',
            calculation: 'Ratio of actual CTR vs expected CTR for ranking position',
            benchmark: 'A+: 150%+ of benchmark, A: 120%+, B: 100%+, C: 80%+',
            example: 'CTR Grade A means you exceed expected click rate for your position',
            relatedTerms: ['CTR', 'Average Position', 'Traffic Grade']
        },
        
        // Impact Metrics
        'Citizens Reached': {
            category: 'Impact Metrics',
            source: 'calculated',
            definition: 'Total number of citizens who accessed your content, combining search clicks and direct users.',
            calculation: 'Search Console clicks + GA4 users (with overlap consideration)',
            benchmark: 'Varies by service type - aim for consistent monthly growth',
            example: '2,850 citizens reached means your content helped 2,850 people find information',
            relatedTerms: ['Users', 'Clicks', 'Monthly Reach']
        },
        
        'Content Helpfulness': {
            category: 'Impact Metrics',
            source: 'calculated',
            definition: 'Percentage indicating how helpful your content is to citizens based on engagement.',
            calculation: '((1 - Bounce Rate) × 50) + (min(100, Session Duration ÷ 180) × 50)',
            benchmark: '80+%: Very helpful, 65+%: Helpful, 50+%: Somewhat helpful, <50%: Needs improvement',
            example: '72% helpfulness means most citizens find your content useful',
            relatedTerms: ['Bounce Rate', 'Average Session Duration', 'Engagement Score']
        },
        
        // Geographic Intelligence
        'Dublin Concentration': {
            category: 'Geographic Intelligence',
            source: 'calculated',
            definition: 'Percentage of your Irish users located in Dublin metropolitan area.',
            calculation: '(Dublin Users ÷ Total Irish Users) × 100',
            benchmark: '<30%: Well distributed, 30-50%: Moderate concentration, >50%: High concentration',
            example: '42% Dublin concentration suggests service accessibility focus may be needed',
            relatedTerms: ['Regional Distribution', 'International Traffic', 'Geographic Spread']
        },

        'International Traffic': {
            category: 'Geographic Intelligence',
            source: 'calculated',
            definition: 'Percentage of users accessing your content from outside Ireland.',
            calculation: '(Non-Irish Users ÷ Total Users) × 100',
            benchmark: 'Varies by service type - immigration services typically 40%+',
            example: '23% international traffic shows global interest in Irish services',
            relatedTerms: ['Dublin Concentration', 'Regional Distribution', 'Countries']
        },

        'Regional Distribution': {
            category: 'Geographic Intelligence',
            source: 'ga4',
            definition: 'How your users are spread across Irish counties and regions.',
            calculation: 'Percentage breakdown from GA4 geographic data by region',
            benchmark: 'Balanced distribution reflects equitable service access',
            example: 'Even spread across regions indicates good nationwide service accessibility',
            relatedTerms: ['Dublin Concentration', 'International Traffic', 'Cities']
        },
        
        // Traffic Sources
        'Organic Traffic': {
            category: 'Traffic Sources',
            source: 'ga4',
            definition: 'Website visitors who arrive through unpaid search engine results.',
            calculation: 'Users from Google, Bing, other search engines (excluding ads)',
            benchmark: '60-80% organic traffic indicates strong SEO performance',
            example: '1,200 organic visitors means people found you through search',
            relatedTerms: ['Direct Traffic', 'Search Console', 'Clicks']
        },
        
        'Direct Traffic': {
            category: 'Traffic Sources',
            source: 'ga4',
            definition: 'Users who visit by typing URL directly or using bookmarks.',
            calculation: 'Sessions with no identifiable referral source',
            benchmark: '20-40% direct traffic shows good brand recognition',
            example: '340 direct visits indicate citizens know your URL',
            relatedTerms: ['Organic Traffic', 'Session Sources', 'Return Visitors']
        },

        // Device Performance
        'Mobile Users': {
            category: 'Device Performance',
            source: 'ga4',
            definition: 'Percentage of users accessing your content via mobile devices.',
            calculation: '(Mobile Sessions ÷ Total Sessions) × 100',
            benchmark: '50%+ mobile usage is typical for government services',
            example: '67% mobile users indicates need for mobile-optimized content',
            relatedTerms: ['Desktop Users', 'Tablet Users', 'Device Categories']
        },

        'Desktop Users': {
            category: 'Device Performance',
            source: 'ga4',
            definition: 'Percentage of users accessing your content via desktop computers.',
            calculation: '(Desktop Sessions ÷ Total Sessions) × 100',
            benchmark: 'Varies by service complexity - forms typically higher desktop usage',
            example: '45% desktop users may indicate complex content requiring larger screens',
            relatedTerms: ['Mobile Users', 'Tablet Users', 'Device Categories']
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
        'Geographic Intelligence': {
            icon: '🌍',
            description: 'Location-based analysis of service usage across Ireland and internationally'
        },
        'Traffic Sources': {
            icon: '🚪',
            description: 'How citizens discover and arrive at your digital services'
        },
        'Device Performance': {
            icon: '📱',
            description: 'Usage patterns and performance across mobile, desktop, and tablet devices'
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
                    
                    /* Smart Collapsible Navigation */
                    .smart-navigation {
                        border-bottom: 1px solid #e2e8f0;
                        background: #fafbfc;
                        flex-shrink: 0;
                        overflow: hidden;
                    }
                    
                    .nav-toggle-header {
                        padding: 12px 24px;
                        border-bottom: 1px solid #e2e8f0;
                        background: #f8fafc;
                    }
                    
                    .smart-nav-toggle {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        width: 100%;
                        padding: 8px 12px;
                        background: white;
                        border: 2px solid #d1d5db;
                        border-radius: 8px;
                        font-size: 0.85rem;
                        font-weight: 600;
                        color: #374151;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        outline: none;
                        text-align: left;
                    }
                    
                    .smart-nav-toggle:hover {
                        background: #f8fafc;
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
                        background: #fafbfc;
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
                        color: #374151;
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
                        border: 1px solid #d1d5db;
                        background: white;
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
                        color: #d1d5db;
                        cursor: not-allowed;
                        background: #f9fafb;
                    }
                    
                    /* Category Navigation */
                    .category-dropdown {
                        margin-bottom: 12px;
                    }
                    
                    .category-label {
                        display: block;
                        font-size: 0.8rem;
                        font-weight: 600;
                        color: #374151;
                        margin-bottom: 6px;
                    }
                    
                    .category-select {
                        width: 100%;
                        padding: 8px 12px;
                        border: 2px solid #d1d5db;
                        border-radius: 6px;
                        background: white;
                        font-size: 0.85rem;
                        color: #374151;
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
                        background: white;
                        border: 2px solid #e2e8f0;
                        border-radius: 20px;
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: #64748b;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        outline: none;
                        text-align: center;
                        white-space: nowrap;
                    }
                    
                    .quick-cat-btn:hover {
                        background: #f8fafc;
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
                        background: #f8fafc;
                        border-bottom: 1px solid #e2e8f0;
                        font-size: 0.85rem;
                        flex-shrink: 0;
                        text-align: center;
                    }
                    
                    .results-text {
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
