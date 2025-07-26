// dashboard-glossary.js - FIXED version with proper debugging
// Sliding panel glossary with better error handling and performance

// ===========================================
// IMMEDIATE SAFE API - PREVENTS TIMING ISSUES
// ===========================================
console.log('📚 Creating safe DashboardGlossary API...');

// Create safe wrapper that works immediately, even before initialization
window.DashboardGlossary = window.DashboardGlossary || {
    _initialized: false,
    _instance: null,
    _pendingActions: [],
    
    open: function() {
        console.log('📖 DashboardGlossary.open() called');
        if (this._initialized && this._instance) {
            return this._instance.open();
        } else {
            console.log('⏳ Glossary not ready, queuing open action...');
            this._pendingActions.push({ action: 'open', args: [] });
            this._retryWhenReady('open');
            return false;
        }
    },
    
    close: function() {
        if (this._initialized && this._instance) {
            return this._instance.close();
        }
        return false;
    },
    
    searchFor: function(term) {
        console.log('🔍 DashboardGlossary.searchFor() called with:', term);
        if (this._initialized && this._instance) {
            return this._instance.search(term);
        } else {
            console.log('⏳ Glossary not ready, queuing search action...');
            this._pendingActions.push({ action: 'search', args: [term] });
            this._retryWhenReady('searchFor', term);
            return false;
        }
    },
    
    goToCategory: function(category) {
        if (this._initialized && this._instance) {
            return this._instance.filterCategory(category);
        } else {
            this._pendingActions.push({ action: 'filterCategory', args: [category] });
            this._retryWhenReady('goToCategory', category);
            return false;
        }
    },
    
    isHealthy: function() {
        return this._initialized && this._instance && this._instance.isHealthy();
    },
    
    _retryWhenReady: function(actionName, ...args) {
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = 500;
        
        const checker = setInterval(() => {
            attempts++;
            console.log(`🔄 Attempt ${attempts}/${maxAttempts} to execute ${actionName}...`);
            
            if (this._initialized && this._instance) {
                console.log(`✅ Glossary ready! Executing ${actionName}`);
                clearInterval(checker);
                
                // Execute the pending action
                switch(actionName) {
                    case 'open':
                        this._instance.open();
                        break;
                    case 'searchFor':
                        this._instance.search(...args);
                        break;
                    case 'goToCategory':
                        this._instance.filterCategory(...args);
                        break;
                }
            } else if (attempts >= maxAttempts) {
                console.error(`❌ Glossary failed to initialize after ${maxAttempts} attempts`);
                console.error('💡 Please check:');
                console.error('   1. No JavaScript errors in console');
                console.error('   2. Script is loading properly');
                console.error('   3. No CSS/JS conflicts');
                clearInterval(checker);
                
                // Show user-friendly message
                if (actionName === 'open') {
                    alert('📚 Glossary is loading... Please try again in a moment.');
                }
            }
        }, checkInterval);
    },
    
    _markReady: function(instance) {
        console.log('✅ Marking glossary as ready with instance:', instance);
        this._initialized = true;
        this._instance = instance;
        
        // Execute any pending actions
        this._pendingActions.forEach(({ action, args }) => {
            try {
                switch(action) {
                    case 'open':
                        instance.open();
                        break;
                    case 'search':
                        instance.search(...args);
                        break;
                    case 'filterCategory':
                        instance.filterCategory(...args);
                        break;
                }
            } catch (error) {
                console.error('Error executing pending action:', error);
            }
        });
        
        this._pendingActions = []; // Clear the queue
    }
};

console.log('✅ Safe DashboardGlossary API created, ready for use!');

// ===========================================
// MAIN GLOSSARY IMPLEMENTATION
// ===========================================

(function() {
    'use strict';
    
    console.log('📚 Loading IMPROVED Dashboard Glossary System...');
    
    // ===========================================
    // GLOSSARY CONFIGURATION & UTILITIES
    // ===========================================
    
    const CONFIG = {
        DEBUG: true,
        SEARCH_DEBOUNCE: 300,
        NAMESPACE: 'DashboardGlossary',
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
    
    // Debug utility
    function debugLog(message, data = null) {
        if (CONFIG.DEBUG) {
            console.log(`🔧 [Glossary Debug]: ${message}`, data || '');
        }
    }
    
    // Safe element getter with error handling
    function safeGetElement(id, context = document) {
        try {
            const element = context.getElementById ? context.getElementById(id) : context.querySelector(`#${id}`);
            if (!element) {
                debugLog(`⚠️ Element not found: #${id}`);
            }
            return element;
        } catch (error) {
            debugLog(`❌ Error getting element #${id}:`, error);
            return null;
        }
    }
    
    // Debounce utility
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
    
    // Check for existing glossary to prevent duplicates
    function checkForExistingGlossary() {
        const existing = safeGetElement(CONFIG.SELECTORS.panel);
        if (existing) {
            debugLog('⚠️ Existing glossary found, removing...');
            existing.remove();
        }
        
        const existingFab = safeGetElement(CONFIG.SELECTORS.fab);
        if (existingFab) {
            debugLog('⚠️ Existing FAB found, removing...');
            existingFab.remove();
        }
    }
    
    // ===========================================
    // GLOSSARY DATA (Same as original but organized)
    // ===========================================
    
    const glossaryData = {
        // ===========================================
        // SEARCH CONSOLE METRICS
        // ===========================================
        'CTR (Click-Through Rate)': {
            category: 'Search Console',
            definition: 'Percentage of people who click on your page after seeing it in search results.',
            calculation: '(Clicks ÷ Impressions) × 100',
            benchmark: 'Position 1: ~28%, Position 2: ~15%, Position 3: ~11%, Position 4-5: ~6%',
            example: '5.2% CTR means 52 people clicked for every 1,000 who saw your page in search',
            relatedTerms: ['Click Rate', 'Search CTR', 'Organic CTR']
        },

        'Clicks': {
            category: 'Search Console',
            definition: 'Number of times users clicked on your page from Google search results.',
            calculation: 'Direct count from Search Console',
            benchmark: 'Varies by content type - government pages typically 100-1,000+ monthly',
            example: '245 clicks means 245 people visited your page from Google search this month',
            relatedTerms: ['Search Clicks', 'Organic Clicks', 'GSC Clicks']
        },

        'Impressions': {
            category: 'Search Console',
            definition: 'Number of times your page appeared in Google search results.',
            calculation: 'Direct count from Search Console',
            benchmark: 'Good: 10x more than clicks, Excellent: 20x+ more than clicks',
            example: '5,000 impressions means your page appeared in search results 5,000 times',
            relatedTerms: ['Search Impressions', 'SERP Appearances', 'Visibility']
        },

        'Average Position': {
            category: 'Search Console',
            definition: 'Average ranking position of your page in Google search results.',
            calculation: 'Weighted average of all query positions',
            benchmark: 'Excellent: 1-3, Good: 4-10, Fair: 11-20, Poor: 20+',
            example: 'Position 5.2 means your page typically appears 5th-6th in search results',
            relatedTerms: ['Ranking', 'SERP Position', 'Search Ranking']
        },

        'Top Queries': {
            category: 'Search Console',
            definition: 'Most common search terms that lead people to your page.',
            calculation: 'Ranked by clicks or impressions',
            benchmark: 'Top query should represent 10-30% of total traffic',
            example: '"passport application" bringing 45 clicks shows citizens need passport info',
            relatedTerms: ['Search Queries', 'Keywords', 'Search Terms']
        },

        // ===========================================
        // GOOGLE ANALYTICS 4 METRICS
        // ===========================================
        'Users': {
            category: 'Google Analytics',
            definition: 'Number of unique individuals who visited your page.',
            calculation: 'Distinct count based on Google Analytics user identification',
            benchmark: 'Government pages: 500-5,000+ monthly users typical',
            example: '1,250 users means 1,250 different people visited your page',
            relatedTerms: ['Unique Visitors', 'Distinct Users', 'People']
        },

        'Page Views': {
            category: 'Google Analytics',
            definition: 'Total number of times your page was viewed (includes repeat visits).',
            calculation: 'Count of all page view events',
            benchmark: 'Typically 1.2-2.5x higher than users (people viewing multiple times)',
            example: '1,800 page views from 1,250 users means some people returned',
            relatedTerms: ['Views', 'Page Hits', 'Total Views']
        },

        'Sessions': {
            category: 'Google Analytics',
            definition: 'Number of visits to your website (a session can include multiple pages).',
            calculation: 'Count of distinct user sessions',
            benchmark: 'Usually similar to Users for single-page analysis',
            example: '1,300 sessions means people made 1,300 separate visits',
            relatedTerms: ['Visits', 'Site Sessions', 'User Sessions']
        },

        'Average Session Duration': {
            category: 'Google Analytics',
            definition: 'Average time users spend on your page during a session.',
            calculation: 'Total session duration ÷ Number of sessions',
            benchmark: 'Government: 52+ seconds excellent, 35+ good, 20+ fair',
            example: '2:15 duration means people typically spend 2 minutes 15 seconds reading',
            relatedTerms: ['Time on Page', 'Session Length', 'Engagement Time']
        },

        'Bounce Rate': {
            category: 'Google Analytics',
            definition: 'Percentage of users who leave your page without interacting (single-page sessions).',
            calculation: '(Single-page sessions ÷ Total sessions) × 100',
            benchmark: 'Government: <40% excellent, 40-60% good, 60-80% fair, >80% poor',
            example: '35% bounce rate means 35 out of 100 visitors left immediately',
            relatedTerms: ['Exit Rate', 'Single Page Sessions', 'Immediate Exits']
        },

        'Engagement Rate': {
            category: 'Google Analytics',
            definition: 'Percentage of sessions where users actively engaged with your content.',
            calculation: '(Engaged sessions ÷ Total sessions) × 100',
            benchmark: 'Government benchmark: 50%+ excellent, 35%+ good, 20%+ fair',
            example: '65% engagement rate means 65 out of 100 visitors actively engaged',
            relatedTerms: ['User Engagement', 'Active Sessions', 'Content Engagement']
        },

        'Pages per Session': {
            category: 'Google Analytics',
            definition: 'Average number of pages viewed during a session.',
            calculation: 'Total page views ÷ Total sessions',
            benchmark: '1.0-1.5 typical for landing pages, 2.0+ excellent for hub pages',
            example: '1.8 pages per session means users view nearly 2 pages per visit',
            relatedTerms: ['Page Depth', 'Site Navigation', 'Content Consumption']
        },

        // ===========================================
        // CALCULATED QUALITY METRICS
        // ===========================================
        'Quality Score': {
            category: 'Dashboard Calculations',
            definition: 'Overall content performance score combining search, engagement, relevance, and UX.',
            calculation: '(Search Score + Engagement Score + Relevance Score + UX Score) ÷ 4',
            benchmark: 'A: 85+, B: 75+, C: 65+, D: 55+, F: <55',
            example: 'Quality Score 78 (B grade) indicates good overall performance',
            relatedTerms: ['Performance Score', 'Content Rating', 'Overall Score']
        },

        'Search Score': {
            category: 'Dashboard Calculations',
            definition: 'How well your page performs in search results.',
            calculation: '(Position Score + CTR Score) ÷ 2, where Position Score = max(0, 100 - position × 5) and CTR Score = min(100, CTR × 1000)',
            benchmark: '80+: Excellent, 60+: Good, 40+: Fair, <40: Poor',
            example: 'Search Score 72 indicates good search performance',
            relatedTerms: ['SEO Score', 'Search Performance', 'Visibility Score']
        },

        'Engagement Score': {
            category: 'Dashboard Calculations',
            definition: 'How well your page engages visitors.',
            calculation: '(Duration Score + Bounce Score) ÷ 2, where Duration Score = min(100, session duration ÷ 300 × 100) and Bounce Score = max(0, (1 - bounce rate) × 100)',
            benchmark: '80+: Highly engaging, 60+: Good, 40+: Fair, <40: Poor',
            example: 'Engagement Score 68 shows good user engagement',
            relatedTerms: ['User Engagement', 'Content Engagement', 'Interaction Score']
        },

        'Relevance Score': {
            category: 'Dashboard Calculations',
            definition: 'How well your content matches user search intent.',
            calculation: '(Actual CTR ÷ Expected CTR for position) × 100',
            benchmark: '100+: Exceeds expectations, 80+: Good, 60+: Fair, <60: Poor relevance',
            example: 'Relevance Score 110 means content exceeds user expectations',
            relatedTerms: ['Content Relevance', 'Search Intent Match', 'User Satisfaction']
        },

        'UX Score': {
            category: 'Dashboard Calculations',
            definition: 'User experience quality based on engagement patterns.',
            calculation: '(Engagement Rate × 60) + min(40, Pages per Session × 20)',
            benchmark: '80+: Excellent UX, 60+: Good, 40+: Fair, <40: Poor UX',
            example: 'UX Score 75 indicates good user experience',
            relatedTerms: ['User Experience', 'Usability Score', 'Interface Quality']
        },

        // ===========================================
        // CITIZEN IMPACT METRICS
        // ===========================================
        'Citizens Reached': {
            category: 'Impact Metrics',
            definition: 'Total number of citizens who accessed your content monthly.',
            calculation: 'Search Clicks + Unique Users (with overlap consideration)',
            benchmark: 'Varies by service type - aim for consistent monthly growth',
            example: '2,850 citizens reached means your content helped 2,850 people find information',
            relatedTerms: ['Monthly Reach', 'Citizen Engagement', 'Public Impact']
        },

        'Content Helpfulness': {
            category: 'Impact Metrics',
            definition: 'Percentage indicating how helpful your content is to citizens.',
            calculation: '((1 - Bounce Rate) × 50) + (min(100, Session Duration ÷ 180) × 50)',
            benchmark: '80+%: Very helpful, 65+%: Helpful, 50+%: Somewhat helpful, <50%: Needs improvement',
            example: '72% helpfulness means most citizens find your content useful',
            relatedTerms: ['Content Effectiveness', 'User Satisfaction', 'Service Quality']
        },

        'Information Seekers': {
            category: 'Impact Metrics',
            definition: 'Citizens actively searching for information you provide.',
            calculation: 'Search Console Clicks + Direct Analytics Users',
            benchmark: 'Growth month-over-month indicates improving service delivery',
            example: '1,450 information seekers shows strong citizen demand for your content',
            relatedTerms: ['Active Users', 'Service Demand', 'Citizen Need']
        },

        'Content Success Rate': {
            category: 'Impact Metrics',
            definition: 'Percentage of citizens who successfully engaged with your content.',
            calculation: '(1 - Bounce Rate) × 100',
            benchmark: 'Government services: 60%+ good, 70%+ excellent',
            example: '68% success rate means 68 out of 100 citizens found what they needed',
            relatedTerms: ['Success Percentage', 'Effectiveness Rate', 'Completion Rate']
        },

        // ===========================================
        // GOVERNMENT BENCHMARKS
        // ===========================================
        'Government Engagement Benchmark': {
            category: 'Government Standards',
            definition: 'Public sector standard for user engagement with government content.',
            calculation: 'Based on GOV.UK, Canada.ca, and Irish government research',
            benchmark: '50%+ engagement rate for government services',
            example: 'Your 45% engagement is below the 50% government benchmark',
            relatedTerms: ['Public Sector Standard', 'Digital Government KPI', 'Service Standard']
        },

        'Government Time Benchmark': {
            category: 'Government Standards',
            definition: 'Expected time citizens spend finding government information.',
            calculation: 'Research-based standard for public service digital content',
            benchmark: '52+ seconds average session duration',
            example: 'Your 1:45 duration exceeds the 52-second government benchmark',
            relatedTerms: ['Service Efficiency', 'Information Access Time', 'Digital Service Standard']
        },

        'Discovery Benchmark': {
            category: 'Government Standards',
            definition: 'How easily citizens can find government services through search.',
            calculation: '(Sessions ÷ Page Views) × 100 (Entrance Rate)',
            benchmark: '30%+ entrance rate indicates good discoverability',
            example: '35% discovery rate means citizens easily find your service',
            relatedTerms: ['Findability', 'Service Discovery', 'Search Visibility']
        },

        // ===========================================
        // GEOGRAPHIC INTELLIGENCE
        // ===========================================
        'Regional Distribution': {
            category: 'Geographic Intelligence',
            definition: 'How your users are spread across Irish counties and regions.',
            calculation: 'Percentage breakdown from GA4 geographic data',
            benchmark: 'Balanced: <40% Dublin, Concentrated: >50% Dublin',
            example: '38% Dublin distribution shows good regional balance',
            relatedTerms: ['Geographic Spread', 'Regional Access', 'County Coverage']
        },

        'Dublin Concentration': {
            category: 'Geographic Intelligence',
            definition: 'Percentage of your users located in Dublin metropolitan area.',
            calculation: '(Dublin Users ÷ Total Irish Users) × 100',
            benchmark: '<30%: Distributed, 30-50%: Moderate, >50%: High concentration',
            example: '42% Dublin concentration suggests service accessibility focus needed',
            relatedTerms: ['Capital Concentration', 'Urban Focus', 'Metropolitan Bias']
        },

        'International Reach': {
            category: 'Geographic Intelligence',
            definition: 'Number of countries from which citizens access your services.',
            calculation: 'Count of distinct countries in GA4 geographic data',
            benchmark: '5+: Good reach, 10+: Excellent, 15+: Global service',
            example: '12 countries shows good international Irish service reach',
            relatedTerms: ['Global Access', 'Diaspora Engagement', 'Cross-border Service']
        },

        'Coverage Percentage': {
            category: 'Geographic Intelligence',
            definition: 'Percentage of Irish counties your service reaches.',
            calculation: '(Counties with Users ÷ 32 total counties) × 100',
            benchmark: '75%+: Excellent coverage, 50%+: Good, <50%: Limited reach',
            example: '78% coverage means you serve citizens in 25 of 32 counties',
            relatedTerms: ['Geographic Coverage', 'Service Reach', 'National Access']
        },

        // ===========================================
        // CITIZEN JOURNEY INTELLIGENCE
        // ===========================================
        'Immediate Action Intent': {
            category: 'Citizen Journey',
            definition: 'Citizens who need to take urgent action or meet deadlines.',
            calculation: 'Query analysis for urgency keywords (urgent, today, deadline, expires)',
            benchmark: 'High priority - requires immediate response capability',
            example: '"apply today" queries indicate citizens with urgent application needs',
            relatedTerms: ['Urgent Needs', 'Time-sensitive Queries', 'Critical Actions']
        },

        'Eligibility Research Intent': {
            category: 'Citizen Journey',
            definition: 'Citizens checking if they qualify for government services.',
            calculation: 'Query analysis for eligibility keywords (entitled, qualify, eligible, criteria)',
            benchmark: 'Common for government services - optimize for clear eligibility info',
            example: '"am I entitled to" queries show citizens researching service eligibility',
            relatedTerms: ['Qualification Queries', 'Entitlement Research', 'Criteria Checking']
        },

        'Process Learning Intent': {
            category: 'Citizen Journey',
            definition: 'Citizens learning how to complete government processes.',
            calculation: 'Query analysis for process keywords (how to, step by step, application process)',
            benchmark: 'Optimize for clear, step-by-step guidance',
            example: '"how to apply" queries indicate need for process clarification',
            relatedTerms: ['Process Queries', 'Application Help', 'Procedure Learning']
        },

        'Problem Solving Intent': {
            category: 'Citizen Journey',
            definition: 'Citizens with issues, appeals, or complaints needing resolution.',
            calculation: 'Query analysis for problem keywords (appeal, complaint, problem, rejected)',
            benchmark: 'High priority - indicates service delivery issues',
            example: '"appeal decision" queries show citizens facing process problems',
            relatedTerms: ['Issue Resolution', 'Complaint Handling', 'Appeal Process']
        },

        // ===========================================
        // OPPORTUNITY SCORING
        // ===========================================
        'Priority Score': {
            category: 'Optimization',
            definition: 'Government framework score for content optimization priority.',
            calculation: '(Traffic Score × 0.4) + (Growth Score × 0.25) + (Search Score × 0.2) + (Discovery Score × 0.15)',
            benchmark: '80+: Critical, 60+: High, 40+: Medium, <40: Low priority',
            example: 'Priority Score 75 indicates high-priority optimization opportunity',
            relatedTerms: ['Optimization Priority', 'Improvement Potential', 'Resource Allocation']
        },

        'Citizen Opportunity Score': {
            category: 'Optimization',
            definition: 'Potential for improving citizen service delivery through content optimization.',
            calculation: 'Weighted score based on search volume, engagement gaps, and citizen impact potential',
            benchmark: '8+: High impact, 5+: Medium impact, 3+: Low impact',
            example: 'Opportunity Score 9 suggests high potential for citizen service improvement',
            relatedTerms: ['Service Improvement Potential', 'Citizen Impact Score', 'Optimization Value']
        },

        'Expected CTR Benchmark': {
            category: 'Optimization',
            definition: 'Expected click-through rate based on search result position.',
            calculation: 'Position-based CTR benchmarks from industry research',
            benchmark: 'Pos 1: 28.4%, Pos 2: 15.5%, Pos 3: 11.0%, Pos 4: 7.7%, Pos 5: 6.1%',
            example: 'Position 3 with 8% CTR exceeds 11% benchmark (underperforming)',
            relatedTerms: ['CTR Expectation', 'Position Performance', 'Click Rate Standard']
        },

        // ===========================================
        // TREND ANALYSIS
        // ===========================================
        'Trend Direction': {
            category: 'Performance Trends',
            definition: 'Whether a metric is improving, declining, or stable over time.',
            calculation: 'Comparison of current vs previous period performance',
            benchmark: 'Up: >2% improvement, Down: >2% decline, Stable: ±2%',
            example: 'CTR trend ↗ +15% shows improving click-through performance',
            relatedTerms: ['Performance Direction', 'Change Indicator', 'Progress Tracking']
        },

        'Growth Rate': {
            category: 'Performance Trends',
            definition: 'Rate of change in performance metrics over time.',
            calculation: '((Current Period - Previous Period) ÷ Previous Period) × 100',
            benchmark: 'Positive growth indicates improving service delivery',
            example: '+12% growth in users shows increasing citizen engagement',
            relatedTerms: ['Change Rate', 'Performance Growth', 'Improvement Rate']
        },

        // ===========================================
        // PROBLEM DETECTION
        // ===========================================
        'Position Anomaly': {
            category: 'Problem Detection',
            definition: 'Query ranking in unexpected position relative to click volume.',
            calculation: 'Based on GOV.UK framework: position 4/5 clicks shouldnt exceed 50% of position 1',
            benchmark: 'Indicates technical SEO or content relevance issues',
            example: 'Position 6 query getting more clicks than position 2 suggests ranking problem',
            relatedTerms: ['Ranking Issues', 'Search Anomalies', 'Performance Inconsistencies']
        },

        'CTR Gap': {
            category: 'Problem Detection',
            definition: 'Difference between actual and expected click-through rate.',
            calculation: 'Expected CTR (position-based) - Actual CTR',
            benchmark: '>2% gap indicates title/description optimization opportunity',
            example: 'Position 3 with 5% CTR has 6% gap (expected 11%) needs title optimization',
            relatedTerms: ['Click Rate Gap', 'Performance Shortfall', 'Optimization Gap']
        },

        'High Impression Low Click': {
            category: 'Problem Detection',
            definition: 'Pages appearing in search frequently but getting few clicks.',
            calculation: 'Impressions >1000 AND CTR <2%',
            benchmark: 'Indicates poor title/meta description or content mismatch',
            example: '5,000 impressions with 1.2% CTR suggests title optimization needed',
            relatedTerms: ['Visibility Without Engagement', 'Poor Click Performance', 'Title Issues']
        },

        // ===========================================
        // CONTENT GAPS
        // ===========================================
        'High Opportunity Gap': {
            category: 'Content Gaps',
            definition: 'Search queries with high volume but low click-through, indicating content optimization opportunity.',
            calculation: 'Impressions ≥1000 AND CTR <2%',
            benchmark: 'High-priority optimization targets',
            example: '"passport renewal" with 2,000 impressions, 1.5% CTR needs content improvement',
            relatedTerms: ['Content Optimization Opportunity', 'Search Demand Gap', 'Click Deficit']
        },

        'Missing Content Gap': {
            category: 'Content Gaps',
            definition: 'Search queries showing demand but minimal content coverage.',
            calculation: 'Impressions ≥100 AND Clicks <5',
            benchmark: 'Indicates need for dedicated content creation',
            example: '"emergency passport" with 300 impressions, 2 clicks needs dedicated content',
            relatedTerms: ['Content Creation Opportunity', 'Unmet Search Demand', 'Service Gap']
        },

        // ===========================================
        // TECHNICAL PERFORMANCE
        // ===========================================
        'Core Web Vitals': {
            category: 'Technical Performance',
            definition: 'Google\'s user experience metrics measuring loading, interactivity, and visual stability.',
            calculation: 'LCP (Largest Contentful Paint) + FID (First Input Delay) + CLS (Cumulative Layout Shift)',
            benchmark: 'Good: LCP <2.5s, FID <100ms, CLS <0.1',
            example: 'LCP 1.8s, FID 45ms, CLS 0.05 = Excellent Core Web Vitals score',
            relatedTerms: ['Page Speed', 'User Experience', 'SEO Performance']
        },

        'Page Load Speed': {
            category: 'Technical Performance',
            definition: 'Time taken for a web page to completely load and display all content.',
            calculation: 'Time from navigation start to load event completion',
            benchmark: 'Excellent: <1s, Good: 1-3s, Fair: 3-5s, Poor: >5s',
            example: '2.3 second load time provides good user experience',
            relatedTerms: ['Core Web Vitals', 'User Experience', 'Bounce Rate']
        },

        'Mobile Responsiveness Score': {
            category: 'Technical Performance',
            definition: 'How well a website adapts and functions across different mobile devices.',
            calculation: 'Google Mobile-Friendly Test + viewport configuration + touch targets',
            benchmark: '90+: Excellent, 70+: Good, 50+: Fair, <50: Poor mobile experience',
            example: 'Score 92 indicates excellent mobile responsiveness',
            relatedTerms: ['User Experience', 'Mobile Traffic', 'Accessibility']
        },

        'Accessibility Score': {
            category: 'Technical Performance',
            definition: 'Website compliance with accessibility standards for users with disabilities.',
            calculation: 'WCAG 2.1 compliance + screen reader compatibility + keyboard navigation',
            benchmark: 'AA compliance required, AAA preferred for government sites',
            example: 'WCAG AA compliance ensures 95% of users can access content',
            relatedTerms: ['User Experience', 'Government Standards', 'Inclusion']
        },

        // ===========================================
        // TRAFFIC SOURCES
        // ===========================================
        'Organic Traffic': {
            category: 'Traffic Sources',
            definition: 'Website visitors who arrive through unpaid search engine results.',
            calculation: 'Users from Google, Bing, other search engines (excluding ads)',
            benchmark: '60-80% organic traffic indicates strong SEO performance',
            example: '1,200 organic visitors means people found you through search',
            relatedTerms: ['Search Console', 'SEO Performance', 'Clicks']
        },

        'Direct Traffic': {
            category: 'Traffic Sources',
            definition: 'Users who visit by typing URL directly or using bookmarks.',
            calculation: 'Sessions with no identifiable referral source',
            benchmark: '20-40% direct traffic shows good brand recognition',
            example: '340 direct visits indicate citizens know your URL',
            relatedTerms: ['Brand Awareness', 'Return Visitors', 'Bookmarks']
        },

        'Referral Traffic': {
            category: 'Traffic Sources',
            definition: 'Visitors who arrive from links on other websites.',
            calculation: 'Sessions originating from external website links',
            benchmark: '5-15% referral traffic indicates good external visibility',
            example: '150 referral visits from gov.ie shows good integration',
            relatedTerms: ['External Links', 'Partnerships', 'Content Sharing']
        },

        'Social Media Traffic': {
            category: 'Traffic Sources',
            definition: 'Website visits originating from social media platforms.',
            calculation: 'Sessions from Facebook, Twitter, LinkedIn, other social platforms',
            benchmark: '2-10% social traffic typical for government services',
            example: '45 social visits show citizens sharing your content',
            relatedTerms: ['Content Sharing', 'Public Engagement', 'Viral Content']
        },

        // ===========================================
        // ADVANCED USER BEHAVIOR
        // ===========================================
        'Exit Rate': {
            category: 'Advanced User Behavior',
            definition: 'Percentage of visitors who leave the website from a specific page.',
            calculation: '(Exits from page ÷ Total page views) × 100',
            benchmark: '<40% excellent, 40-60% good, >60% needs improvement',
            example: '35% exit rate means 35 of 100 visitors leave from this page',
            relatedTerms: ['Bounce Rate', 'User Journey', 'Content Effectiveness']
        },

        'Scroll Depth': {
            category: 'Advanced User Behavior',
            definition: 'How far down a page users scroll, indicating content engagement.',
            calculation: 'Percentage of page height viewed by users',
            benchmark: '75%+ scroll depth indicates engaging content',
            example: '82% average scroll depth means users read most content',
            relatedTerms: ['Content Engagement', 'User Interest', 'Content Length']
        },

        'Time on Page': {
            category: 'Advanced User Behavior',
            definition: 'Average time users spend actively reading a specific page.',
            calculation: 'Total time spent on page ÷ Number of page views',
            benchmark: '2+ minutes excellent, 1+ minute good for informational content',
            example: '3:24 time on page shows high content engagement',
            relatedTerms: ['Engagement Rate', 'Content Quality', 'User Interest']
        },

        'Return Visit Intent': {
            category: 'Advanced User Behavior',
            definition: 'Likelihood that users will return to the website in the future.',
            calculation: '(Return visitors ÷ Total visitors) × 100',
            benchmark: '30%+ return rate excellent for government services',
            example: '35% return intent shows citizens find ongoing value',
            relatedTerms: ['User Loyalty', 'Content Value', 'Service Quality']
        },

        // ===========================================
        // DIGITAL SERVICE DELIVERY
        // ===========================================
        'Task Completion Rate': {
            category: 'Digital Service Delivery',
            definition: 'Percentage of users who successfully complete their intended actions.',
            calculation: '(Completed tasks ÷ Attempted tasks) × 100',
            benchmark: '80%+ excellent, 60%+ good for complex government processes',
            example: '78% completion rate means most citizens finish applications',
            relatedTerms: ['User Success', 'Process Efficiency', 'Service Quality']
        },

        'Form Completion Rate': {
            category: 'Digital Service Delivery',
            definition: 'Percentage of users who complete forms versus abandoning them.',
            calculation: '(Form submissions ÷ Form starts) × 100',
            benchmark: '70%+ excellent, 50%+ good for government forms',
            example: '68% form completion shows user-friendly design',
            relatedTerms: ['Task Completion', 'User Experience', 'Process Optimization']
        },

        'Self-service Success Rate': {
            category: 'Digital Service Delivery',
            definition: 'Citizens who resolve issues without requiring human assistance.',
            calculation: '(Self-resolved queries ÷ Total queries) × 100',
            benchmark: '70%+ reduces support burden, improves efficiency',
            example: '75% self-service success reduces call center load',
            relatedTerms: ['Service Efficiency', 'Content Effectiveness', 'Cost Savings']
        },

        'Digital Adoption Rate': {
            category: 'Digital Service Delivery',
            definition: 'Citizens choosing digital channels over traditional methods.',
            calculation: '(Digital transactions ÷ Total transactions) × 100',
            benchmark: '60%+ shows successful digital transformation',
            example: '67% digital adoption means citizens prefer online services',
            relatedTerms: ['Digital Transformation', 'Channel Preference', 'Service Modernization']
        },

        // ===========================================
        // CONTENT ENGAGEMENT
        // ===========================================
        'PDF Download Rate': {
            category: 'Content Engagement',
            definition: 'How frequently documents and forms are downloaded by users.',
            calculation: '(PDF downloads ÷ Page views) × 100',
            benchmark: '15%+ download rate indicates valuable resources',
            example: '22% download rate shows citizens value your documents',
            relatedTerms: ['Resource Usage', 'Content Value', 'Document Effectiveness']
        },

        'Video Engagement Rate': {
            category: 'Content Engagement',
            definition: 'Percentage of video content watched versus total video length.',
            calculation: '(Total watch time ÷ Total video length × views) × 100',
            benchmark: '50%+ engagement excellent, 25%+ good for instructional videos',
            example: '58% video engagement shows compelling visual content',
            relatedTerms: ['Content Quality', 'User Interest', 'Information Delivery']
        },

        'Site Search Usage': {
            category: 'Content Engagement',
            definition: 'How often visitors use internal search to find information.',
            calculation: '(Sessions with search ÷ Total sessions) × 100',
            benchmark: '10-30% search usage indicates good findability balance',
            example: '18% search usage shows citizens actively seek information',
            relatedTerms: ['Information Architecture', 'User Intent', 'Content Findability']
        },

        'FAQ Effectiveness': {
            category: 'Content Engagement',
            definition: 'How well FAQ sections answer questions without requiring further support.',
            calculation: '(FAQ page exits ÷ FAQ page views) × 100',
            benchmark: '60%+ exit rate from FAQ indicates effective answers',
            example: '71% FAQ effectiveness reduces support ticket volume',
            relatedTerms: ['Self-service', 'Content Quality', 'Support Reduction']
        },

        // ===========================================
        // CITIZEN EXPERIENCE
        // ===========================================
        'User Satisfaction Score': {
            category: 'Citizen Experience',
            definition: 'Survey-based measurement of citizen happiness with digital services.',
            calculation: 'Average rating from user feedback surveys (1-10 scale)',
            benchmark: '8.0+ excellent, 7.0+ good, 6.0+ acceptable citizen satisfaction',
            example: '8.2 satisfaction score indicates citizens are very happy',
            relatedTerms: ['Service Quality', 'User Experience', 'Citizen Feedback']
        },

        'Error Rate': {
            category: 'Citizen Experience',
            definition: 'Frequency of technical problems encountered by users.',
            calculation: '(Error events ÷ Total interactions) × 100',
            benchmark: '<2% error rate excellent, <5% acceptable for government sites',
            example: '1.3% error rate shows stable, reliable service',
            relatedTerms: ['Technical Performance', 'User Experience', 'Site Reliability']
        },

        'Support Ticket Volume': {
            category: 'Citizen Experience',
            definition: 'Number of help requests generated by website content or processes.',
            calculation: 'Count of support requests attributed to website issues',
            benchmark: 'Decreasing trend indicates improving self-service effectiveness',
            example: '15% reduction in tickets shows better content clarity',
            relatedTerms: ['Self-service Success', 'Content Effectiveness', 'Cost Efficiency']
        },

        'Multi-language Usage': {
            category: 'Citizen Experience',
            definition: 'Distribution of citizens accessing content in different languages.',
            calculation: 'Percentage breakdown by language preference',
            benchmark: 'Reflects Ireland\'s linguistic diversity and accessibility',
            example: '92% English, 8% Irish shows language preference patterns',
            relatedTerms: ['Accessibility', 'Cultural Inclusion', 'Service Reach']
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
        'Government Standards': {
            icon: '🏛️',
            description: 'Public sector benchmarks and standards for digital government services'
        },
        'Geographic Intelligence': {
            icon: '🌍',
            description: 'Location-based analysis of service usage across Ireland and internationally'
        },
        'Citizen Journey': {
            icon: '🗺️',
            description: 'Understanding citizen intent and needs at different service stages'
        },
        'Optimization': {
            icon: '💡',
            description: 'Priority scoring and opportunity identification for content improvement'
        },
        'Performance Trends': {
            icon: '📈',
            description: 'How metrics change over time and growth rate analysis'
        },
        'Problem Detection': {
            icon: '⚠️',
            description: 'Identification of performance issues and optimization opportunities'
        },
        'Content Gaps': {
            icon: '🔍',
            description: 'Missing or underperforming content areas with citizen demand'
        }
    };
    
    // ===========================================
    // GLOSSARY CLASS DEFINITION
    // ===========================================
    
    class DashboardGlossarySystem {
        constructor() {
            this.isInitialized = false;
            this.searchTimeout = null;
            this.currentFilter = 'all';
            this.currentSearch = '';
            
            debugLog('🎯 Glossary system constructor called');
        }
        
        // Initialize navigation state (now as a proper class method)
        initializeNavigationState() {
            const navContent = safeGetElement('navContent');
            const navToggle = safeGetElement('navToggle');
            
            if (navContent && navToggle) {
                // Start collapsed to give more space for content
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
        
        // Initialize the glossary system
        async init() {
            try {
                debugLog('🚀 Starting glossary initialization...');
                
                // Check for duplicates
                checkForExistingGlossary();
                
                // Wait for DOM to be ready
                await this.waitForDOM();
                
                // Create and inject HTML
                this.createGlossaryHTML();
                
                // Add styles
                this.addGlossaryStyles();
                
                // Setup event listeners with proper error handling
                this.setupEventListeners();
                
                // Initialize navigation state (now properly called)
                this.initializeNavigationState();
                
                // Mark as initialized
                this.isInitialized = true;
                
                debugLog('✅ Glossary initialization complete');
                
                return true;
                
            } catch (error) {
                debugLog('❌ Glossary initialization failed:', error);
                return false;
            }
        }
        
        // Wait for DOM to be ready
        waitForDOM() {
            return new Promise((resolve) => {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', resolve);
                } else {
                    resolve();
                }
            });
        }
        
        // Create glossary HTML structure
        createGlossaryHTML() {
            debugLog('🏗️ Creating glossary HTML...');
            
            const alphabetNav = this.createAlphabetNav();
            const categoryFilters = this.createCategoryFilters();
            const glossaryEntries = this.createGlossaryEntries();
            
            const glossaryHTML = `
                <div class="glossary-panel" id="${CONFIG.SELECTORS.panel}" role="dialog" aria-labelledby="glossaryTitle" aria-hidden="true">
                    <!-- Glossary Header -->
                    <div class="glossary-header">
                        <div class="glossary-title">
                            <h2 id="glossaryTitle">📚 Dashboard Glossary</h2>
                            <p>Comprehensive reference for all metrics, terms, and calculations</p>
                        </div>
                        <button class="glossary-close" id="${CONFIG.SELECTORS.closeBtn}" aria-label="Close glossary">
                            <span aria-hidden="true">✕</span>
                        </button>
                    </div>
                    
                    <!-- Search -->
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
                    
                    <!-- Navigation -->
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
            
            // Insert HTML safely
            try {
                document.body.insertAdjacentHTML('beforeend', glossaryHTML);
                debugLog('✅ HTML structure created successfully');
            } catch (error) {
                debugLog('❌ Failed to create HTML structure:', error);
                throw error;
            }
        }
        
        // Create alphabet navigation
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
        
        // Create category filters
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
        
        // Create glossary entries
        createGlossaryEntries() {
            return Object.entries(glossaryData)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([term, data]) => this.createGlossaryEntry(term, data))
                .join('');
        }
        
        // Create individual glossary entry
        createGlossaryEntry(term, data) {
            const termId = `term-${term.replace(/\s+/g, '-').toLowerCase()}`;
            const termForData = term.toLowerCase().trim();
            
            // Only debug first few entries to avoid spam
            if (CONFIG.DEBUG && Object.keys(glossaryData).indexOf(term) < 3) {
                debugLog(`Creating entry for term: "${term}" -> data-term: "${termForData}"`);
            }
            return `
                <article class="glossary-entry" data-term="${termForData}" data-category="${data.category}">
                    <div class="entry-header">
                        <h3 class="entry-term" id="${termId}">${term}</h3>
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
        
        // Setup event listeners with proper error handling
        setupEventListeners() {
            debugLog('🎧 Setting up event listeners...');
            
            try {
                // Get elements safely
                const fab = safeGetElement(CONFIG.SELECTORS.fab);
                const panel = safeGetElement(CONFIG.SELECTORS.panel);
                const closeBtn = safeGetElement(CONFIG.SELECTORS.closeBtn);
                const searchInput = safeGetElement(CONFIG.SELECTORS.search);
                const clearSearch = safeGetElement(CONFIG.SELECTORS.clearSearch);
                const backToTop = safeGetElement(CONFIG.SELECTORS.backToTop);
                const content = safeGetElement(CONFIG.SELECTORS.content);
                const navToggle = safeGetElement('navToggle');
                const navContent = safeGetElement('navContent');
                
                // FAB click to open
                if (fab) {
                    fab.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.openGlossary();
                    });
                } else {
                    debugLog('⚠️ FAB button not found');
                }
                
                // Close button
                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.closeGlossary();
                    });
                }
                
                // Search functionality with debouncing
                if (searchInput) {
                    const debouncedSearch = debounce(() => this.handleSearch(), CONFIG.SEARCH_DEBOUNCE);
                    searchInput.addEventListener('input', debouncedSearch);
                    
                    // Enter key handling
                    searchInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this.handleSearch();
                        }
                    });
                }
                
                // Clear search
                if (clearSearch) {
                    clearSearch.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.clearSearch();
                    });
                }
                
                // Back to top
                if (backToTop) {
                    backToTop.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.scrollToTop();
                    });
                }
                
                // Navigation toggle
                if (navToggle) {
                    navToggle.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.toggleNavigation();
                    });
                }
                
                // Scroll handling for back to top button
                if (content) {
                    content.addEventListener('scroll', () => {
                        if (backToTop) {
                            backToTop.style.display = content.scrollTop > 200 ? 'block' : 'none';
                        }
                    });
                }
                
                // Global event delegation for dynamic content
                document.addEventListener('click', (e) => {
                    this.handleDelegatedClicks(e);
                });
                
                // Keyboard navigation
                document.addEventListener('keydown', (e) => {
                    this.handleKeyboardNavigation(e);
                });
                
                debugLog('✅ Event listeners setup complete');
                
            } catch (error) {
                debugLog('❌ Error setting up event listeners:', error);
                throw error;
            }
        }
        
        // Handle delegated clicks for dynamic content
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
            
            // Close on backdrop click
            if (target.classList.contains('glossary-panel')) {
                this.closeGlossary();
            }
        }
        
        // Handle keyboard navigation
        handleKeyboardNavigation(e) {
            const panel = safeGetElement(CONFIG.SELECTORS.panel);
            
            if (panel && panel.classList.contains('active')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeGlossary();
                }
            }
        }
        
        // Open glossary
        openGlossary() {
            debugLog('📖 Opening glossary...');
            
            const panel = safeGetElement(CONFIG.SELECTORS.panel);
            const searchInput = safeGetElement(CONFIG.SELECTORS.search);
            
            if (panel) {
                panel.classList.add('active');
                panel.setAttribute('aria-hidden', 'false');
                
                // Focus management
                if (searchInput) {
                    setTimeout(() => searchInput.focus(), 300);
                }
                
                // Prevent body scroll
                document.body.style.overflow = 'hidden';
                
                debugLog('✅ Glossary opened');
            }
        }
        
        // Close glossary
        closeGlossary() {
            debugLog('📕 Closing glossary...');
            
            const panel = safeGetElement(CONFIG.SELECTORS.panel);
            
            if (panel) {
                panel.classList.remove('active');
                panel.setAttribute('aria-hidden', 'true');
                
                // Restore body scroll
                document.body.style.overflow = '';
                
                debugLog('✅ Glossary closed');
            }
        }
        
        // Handle search with improved performance
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
                
                // Debug logging for search
                if (CONFIG.DEBUG && query.length > 0 && query.length < 8) { // Limit debug output
                    console.log(`🔍 Checking "${termName}" against "${query}":`, {
                        termName: termName,
                        termData: termData,
                        termNameMatch: termName.includes(query),
                        termDataMatch: termData.includes(query),
                        contentMatch: content.includes(query)
                    });
                }
                
                // Multiple search criteria for better matching
                const isVisible = query === '' || 
                    termName.includes(query) ||           // Search in actual term name
                    termData.includes(query) ||           // Search in data attribute
                    content.includes(query) ||            // Search in full content
                    this.fuzzyMatch(termName, query) ||   // Fuzzy matching for acronyms
                    this.acronymMatch(termName, query);   // Acronym matching
                
                if (isVisible) {
                    entry.style.display = 'block';
                    visibleCount++;
                    
                    // Check for exact match to scroll to later
                    if (termName === query || termData === query) {
                        exactMatch = entry;
                        debugLog(`🎯 Found exact match: ${termName}`);
                    }
                    
                    // Highlight search terms
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
            
            // If we found an exact match, scroll to it
            if (exactMatch && query !== '') {
                setTimeout(() => {
                    exactMatch.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    exactMatch.style.background = 'rgba(59, 130, 246, 0.15)';
                    setTimeout(() => {
                        exactMatch.style.background = '';
                    }, 2000);
                }, 100);
            }
            
            debugLog(`✅ Search complete: ${visibleCount} results${exactMatch ? ' (exact match found)' : ''}`);
        }
        
        // Fuzzy matching for partial term searches
        fuzzyMatch(termName, query) {
            if (query.length < 3) return false;
            
            // Remove special characters and spaces for comparison
            const cleanTerm = termName.replace(/[^\w]/g, '').toLowerCase();
            const cleanQuery = query.replace(/[^\w]/g, '').toLowerCase();
            
            return cleanTerm.includes(cleanQuery);
        }
        
        // Acronym matching (e.g., "ctr" matches "Click-Through Rate")
        acronymMatch(termName, query) {
            if (query.length < 2) return false;
            
            // Extract first letters of words (for acronyms)
            const words = termName.split(/[\s\-\(\)]+/);
            const acronym = words
                .filter(word => word.length > 0)
                .map(word => word.charAt(0).toLowerCase())
                .join('');
            
            return acronym.includes(query) || query.includes(acronym);
        }
        
        // Clear search
        clearSearch() {
            const searchInput = safeGetElement(CONFIG.SELECTORS.search);
            
            if (searchInput) {
                searchInput.value = '';
                this.handleSearch();
                searchInput.focus();
            }
        }
        
        // Update clear button visibility
        updateClearButton(query) {
            const clearBtn = safeGetElement(CONFIG.SELECTORS.clearSearch);
            if (clearBtn) {
                clearBtn.style.display = query ? 'block' : 'none';
            }
        }
        
        // Filter by category
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
            
            // Update category filter buttons
            document.querySelectorAll('.category-filter').forEach(btn => {
                const isActive = btn.dataset.category === category;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', isActive.toString());
            });
            
            this.updateResultsSummary(visibleCount, '', category);
            
            // Clear search when filtering
            const searchInput = safeGetElement(CONFIG.SELECTORS.search);
            if (searchInput) {
                searchInput.value = '';
                this.updateClearButton('');
            }
            
            debugLog(`✅ Category filter applied: ${visibleCount} results`);
        }
        
        // Scroll to letter
        scrollToLetter(letter) {
            debugLog(`🔤 Scrolling to letter: ${letter}`);
            
            const entries = document.querySelectorAll('.glossary-entry');
            const targetEntry = Array.from(entries).find(entry => {
                const term = entry.dataset.term || '';
                return term.charAt(0).toUpperCase() === letter;
            });
            
            if (targetEntry) {
                targetEntry.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                // Brief highlight
                targetEntry.style.background = 'rgba(59, 130, 246, 0.1)';
                setTimeout(() => {
                    targetEntry.style.background = '';
                }, 2000);
                
                debugLog(`✅ Scrolled to letter ${letter}`);
            }
        }
        
        // Search and highlight specific term
        searchAndHighlight(term) {
            debugLog(`🎯 Searching and highlighting: ${term}`);
            
            const searchInput = safeGetElement(CONFIG.SELECTORS.search);
            if (searchInput) {
                searchInput.value = term;
                this.handleSearch();
                
                // Try to find exact term match for scrolling
                const entries = document.querySelectorAll('.glossary-entry');
                let targetEntry = null;
                
                // Look for exact match first
                entries.forEach(entry => {
                    const termElement = entry.querySelector('.entry-term');
                    const termName = termElement ? termElement.textContent.toLowerCase().trim() : '';
                    const termData = entry.dataset.term || '';
                    
                    if (termName === term.toLowerCase() || 
                        termData === term.toLowerCase() ||
                        termName.includes(term.toLowerCase())) {
                        targetEntry = entry;
                    }
                });
                
                // Scroll to target
                if (targetEntry) {
                    setTimeout(() => {
                        targetEntry.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        
                        // Add highlight effect
                        targetEntry.style.background = 'rgba(59, 130, 246, 0.15)';
                        targetEntry.style.transform = 'scale(1.02)';
                        targetEntry.style.transition = 'all 0.3s ease';
                        
                        setTimeout(() => {
                            targetEntry.style.background = '';
                            targetEntry.style.transform = '';
                        }, 2000);
                    }, 100);
                } else {
                    // Fallback: try the old method
                    const termId = `term-${term.replace(/\s+/g, '-').toLowerCase()}`;
                    const targetElement = document.getElementById(termId);
                    
                    if (targetElement) {
                        setTimeout(() => {
                            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                    }
                }
            }
        }
        
        // Highlight search terms
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
        
        // Remove highlights
        removeHighlights(entry) {
            const highlights = entry.querySelectorAll('.search-highlight');
            highlights.forEach(highlight => {
                highlight.outerHTML = highlight.innerHTML;
            });
        }
        
        // Update results summary
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
            } else {
                summary.textContent = text;
            }
            
            // Show/hide menu hint based on navigation state
            if (menuHint) {
                const navContent = safeGetElement('navContent');
                const isNavExpanded = navContent && navContent.classList.contains('expanded');
                menuHint.style.display = (isNavExpanded || query || category !== '') ? 'none' : 'block';
            }
        }
        
        // Scroll to top
        scrollToTop() {
            const content = safeGetElement(CONFIG.SELECTORS.content);
            if (content) {
                content.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
        
        // Toggle navigation menu
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
                    debugLog('📖 Navigation menu collapsed');
                } else {
                    navContent.classList.add('expanded');
                    navToggle.classList.add('expanded');
                    if (toggleArrow) toggleArrow.textContent = '↑';
                    if (toggleText) toggleText.textContent = 'Hide Menu';
                    navToggle.setAttribute('aria-expanded', 'true');
                    if (menuHint) menuHint.style.display = 'none';
                    debugLog('📖 Navigation menu expanded');
                }
            }
        }
        
        // Add improved styles
        addGlossaryStyles() {
            const existingStyles = document.querySelector('#glossary-styles');
            if (existingStyles) {
                existingStyles.remove();
            }
            
            const styles = `
                <style id="glossary-styles">
                    /* Screen reader only content */
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
                    
                    /* Floating Action Button - Repositioned to Top Right */
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
                        position: relative;
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
                    
                    .glossary-fab:active {
                        transform: translateY(-1px) scale(1.02);
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
                    
                    /* Glossary Panel - Enhanced */
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
                    
                    /* Header - Enhanced */
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
                    
                    /* Search - Enhanced */
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
                    
                    /* Navigation - Enhanced with Toggle */
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
                    
                    .nav-toggle:focus {
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
                        border-color: #3b82f6;
                    }
                    
                    .nav-toggle.expanded {
                        background: #3b82f6;
                        color: white;
                        border-color: #3b82f6;
                    }
                    
                    .toggle-icon {
                        font-size: 1rem;
                    }
                    
                    .toggle-text {
                        flex: 1;
                    }
                    
                    .toggle-arrow {
                        font-size: 0.8rem;
                        transition: transform 0.3s ease;
                    }
                    
                    .nav-toggle.expanded .toggle-arrow {
                        transform: rotate(180deg);
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
                    
                    .alpha-btn.has-terms:focus {
                        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
                    }
                    
                    .alpha-btn.no-terms {
                        color: #d1d5db;
                        cursor: not-allowed;
                    }
                    
                    .category-nav .category-filters {
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
                    
                    .category-filter:focus {
                        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
                    }
                    
                    .category-filter.active {
                        background: #3b82f6;
                        color: white;
                        border-color: #3b82f6;
                        transform: translateY(-1px);
                    }
                    
                    .category-icon {
                        font-size: 1rem;
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
                    
                    /* Results Summary - Enhanced */
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
                    }
                    
                    .results-text {
                        color: #64748b;
                        font-weight: 500;
                    }
                    
                    .menu-hint {
                        color: #3b82f6;
                        font-size: 0.8rem;
                        font-weight: 500;
                        animation: fadeIn 0.5s ease-in-out;
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-5px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    
                    /* Content - Enhanced */
                    .glossary-content {
                        flex: 1;
                        padding: 24px;
                        overflow-y: auto;
                        scroll-behavior: smooth;
                        outline: none;
                    }
                    
                    .glossary-content:focus {
                        box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.2);
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
                    
                    .glossary-entry:last-child {
                        border-bottom: none;
                    }
                    
                    .entry-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 16px;
                        gap: 16px;
                    }
                    
                    .entry-term {
                        margin: 0;
                        color: #1f2937;
                        font-size: 1.2rem;
                        font-weight: 700;
                        flex: 1;
                        line-height: 1.3;
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
                        background-clip: padding-box;
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
                    
                    .related-term-link:focus {
                        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
                    }
                    
                    /* Search Highlighting - Enhanced */
                    .search-highlight {
                        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                        color: #92400e;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-weight: 600;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                        animation: highlightPulse 2s ease-in-out;
                    }
                    
                    @keyframes highlightPulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.02); }
                    }
                    
                    /* Back to Top - Enhanced */
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
                        border: 2px solid transparent;
                    }
                    
                    .back-to-top:hover {
                        background: linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%);
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
                    }
                    
                    .back-to-top:focus {
                        border-color: #fbbf24;
                        box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.3);
                    }
                    
                    /* Responsive Design - Enhanced */
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
                        
                        .glossary-header {
                            padding: 16px;
                        }
                        
                        .glossary-search {
                            padding: 12px 16px;
                        }
                        
                        .glossary-nav .nav-header {
                            padding: 12px 16px;
                        }
                        
                        .nav-content.expanded {
                            padding: 12px 16px;
                        }
                        
                        .glossary-content {
                            padding: 16px;
                        }
                        
                        .alphabet-buttons {
                            justify-content: center;
                        }
                        
                        .alpha-btn {
                            width: 28px;
                            height: 28px;
                            font-size: 0.7rem;
                        }
                        
                        .entry-header {
                            flex-direction: column;
                            gap: 8px;
                        }
                        
                        .entry-category {
                            align-self: flex-start;
                        }
                    }
                    
                    /* Scrollbar Styling - Enhanced */
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
                    
                    /* Loading States */
                    .glossary-loading {
                        opacity: 0.6;
                        pointer-events: none;
                    }
                    
                    /* High Contrast Mode Support */
                    @media (prefers-contrast: high) {
                        .glossary-panel {
                            border-left: 3px solid #000;
                        }
                        
                        .category-filter.active {
                            background: #000;
                            color: #fff;
                        }
                        
                        .search-highlight {
                            background: #ffff00;
                            color: #000;
                        }
                    }
                    
                    /* Reduced Motion Support */
                    @media (prefers-reduced-motion: reduce) {
                        .glossary-panel,
                        .glossary-fab,
                        .back-to-top,
                        .category-filter,
                        .alpha-btn {
                            transition: none;
                        }
                        
                        .search-highlight {
                            animation: none;
                        }
                    }
                </style>
            `;
            
            document.head.insertAdjacentHTML('beforeend', styles);
            debugLog('✅ Styles added successfully');
        }
        
        // Public API methods
        search(term) {
            if (!this.isInitialized) return false;
            
            this.openGlossary();
            setTimeout(() => {
                this.searchAndHighlight(term);
            }, 300);
            return true;
        }
        
        filterCategory(category) {
            if (!this.isInitialized) return false;
            
            this.openGlossary();
            setTimeout(() => {
                this.filterByCategory(category);
            }, 300);
            return true;
        }
        
        open() {
            if (!this.isInitialized) return false;
            this.openGlossary();
            return true;
        }
        
        close() {
            if (!this.isInitialized) return false;
            this.closeGlossary();
            return true;
        }
        
        // Health check
        isHealthy() {
            return this.isInitialized && 
                   safeGetElement(CONFIG.SELECTORS.panel) && 
                   safeGetElement(CONFIG.SELECTORS.fab);
        }
    }
    
    // ===========================================
    // INITIALIZATION & GLOBAL SETUP
    // ===========================================
    
    let glossaryInstance = null;
    
    function initializeGlossarySystem() {
        debugLog('🚀 Initializing glossary system...');
        
        try {
            // Create new instance
            glossaryInstance = new DashboardGlossarySystem();
            
            // Initialize
            glossaryInstance.init().then(success => {
                if (success) {
                    // Mark the safe wrapper as ready
                    window.DashboardGlossary._markReady(glossaryInstance);
                    
                    debugLog('✅ Glossary system initialized successfully!');
                    console.log('📚 Dashboard Glossary Features:');
                    console.log('   ✨ Enhanced error handling and debugging');
                    console.log('   🚀 Improved performance with debouncing');
                    console.log('   ♿ Full accessibility support');
                    console.log('   📱 Mobile-responsive design');
                    console.log('   🎨 Modern UI with smooth animations');
                    console.log('   🔍 Advanced search with highlighting');
                    console.log('   ⌨️  Keyboard navigation support');
                    console.log('');
                    console.log('💡 Usage:');
                    console.log('   - DashboardGlossary.open() - Open the glossary');
                    console.log('   - DashboardGlossary.searchFor("CTR") - Search for CTR');
                    console.log('   - DashboardGlossary.searchFor("clicks") - Search for clicks');
                    console.log('   - DashboardGlossary.searchFor("bounce rate") - Search for bounce rate');
                    console.log('   - DashboardGlossary.goToCategory("Search Console") - Filter by category');
                    console.log('   - DashboardGlossary.isHealthy() - Check if system is working');
                    console.log('');
                    console.log('🔍 Test the search with these terms:');
                    console.log('   - "CTR" or "ctr" (should find Click-Through Rate)');
                    console.log('   - "users" (should find Users term)');
                    console.log('   - "bounce" (should find Bounce Rate)');
                    console.log('   - "average session" (should find Average Session Duration)');
                    console.log('');
                    console.log('🧪 Quick test helper:');
                    console.log('   window.testSearch = () => {');
                    console.log('     DashboardGlossary.open();');
                    console.log('     setTimeout(() => DashboardGlossary.searchFor("CTR"), 500);');
                    console.log('   };');
                    
                    // Create test helper
                    window.testSearch = () => {
                        DashboardGlossary.open();
                        setTimeout(() => DashboardGlossary.searchFor("CTR"), 500);
                    };
                    
                } else {
                    debugLog('❌ Glossary initialization failed');
                }
            }).catch(error => {
                debugLog('❌ Glossary initialization error:', error);
            });
            
        } catch (error) {
            debugLog('❌ Critical error during initialization:', error);
        }
    }
    
    // Auto-initialize with proper timing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGlossarySystem);
    } else {
        // DOM is already ready, but let's add a small delay to avoid conflicts
        setTimeout(initializeGlossarySystem, 100);
    }
    
    // Additional safety net - try again if first attempt fails
    setTimeout(() => {
        if (!window.DashboardGlossary || !window.DashboardGlossary.isHealthy()) {
            debugLog('🔄 Retrying glossary initialization...');
            initializeGlossarySystem();
        }
    }, 2000);
    
})();
