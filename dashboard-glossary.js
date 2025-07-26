// dashboard-glossary.js - Comprehensive Glossary for Citizens Information Dashboard
// Sliding panel glossary with A-Z navigation and search functionality

(function() {
    'use strict';
    
    console.log('📚 Loading Dashboard Glossary System...');
    
    // ===========================================
    // COMPREHENSIVE GLOSSARY DATA
    // ===========================================
    
    const glossaryData = {
        // METRICS & KPIs
        'Average Position': {
            category: 'Search Metrics',
            definition: 'The average ranking position of your page in Google search results for all queries.',
            calculation: 'Sum of (position × impressions) ÷ total impressions for all queries',
            benchmark: 'Position 1-3: Excellent, 4-10: Good, 11-20: Fair, 21+: Poor',
            example: 'If your page ranks #3 for "social welfare" and #7 for "benefits", the average considers impression volume',
            relatedTerms: ['Search Position', 'SERP Ranking', 'Organic Position']
        },
        
        'Average Session Duration': {
            category: 'User Behavior',
            definition: 'The average amount of time users spend on your page during a single visit.',
            calculation: 'Total session duration ÷ number of sessions',
            benchmark: 'Government standard: 52+ seconds is good, 180+ seconds is excellent',
            example: '2:30 means citizens spend an average of 2 minutes 30 seconds reading your content',
            relatedTerms: ['Time on Page', 'Engagement Time', 'Dwell Time']
        },
        
        'Bounce Rate': {
            category: 'User Behavior',
            definition: 'Percentage of visitors who leave your page without interacting or viewing other pages.',
            calculation: '(Single-page sessions ÷ total sessions) × 100',
            benchmark: 'Under 40%: Excellent, 40-60%: Good, 60-80%: Fair, 80%+: Poor',
            example: '45% bounce rate means 45 out of 100 visitors leave immediately',
            relatedTerms: ['Exit Rate', 'Single Page Sessions', 'Engagement Rate']
        },
        
        'CTR (Click-Through Rate)': {
            category: 'Search Metrics',
            definition: 'Percentage of people who click on your page after seeing it in search results.',
            calculation: '(Clicks ÷ Impressions) × 100',
            benchmark: 'Position 1: ~28%, Position 2: ~15%, Position 3: ~11%, Position 4-5: ~6%',
            example: '5.2% CTR means 52 people clicked for every 1,000 who saw your page in search',
            relatedTerms: ['Click Rate', 'Search CTR', 'Organic CTR']
        },
        
        'Citizens Reached': {
            category: 'Impact Metrics',
            definition: 'Total number of unique citizens who accessed your page in the last 30 days.',
            calculation: 'Search Console clicks + Google Analytics unique users (with overlap consideration)',
            benchmark: 'Varies by service type and page scope',
            example: '2.3K citizens reached means 2,300 individual people accessed your information',
            relatedTerms: ['Monthly Reach', 'User Count', 'Citizen Impact']
        },
        
        'Content Quality Score': {
            category: 'Quality Metrics',
            definition: 'Composite score measuring how well your content serves citizen needs.',
            calculation: '(Search Score + Engagement Score + Relevance Score + UX Score) ÷ 4',
            benchmark: '85+: A grade, 75-84: B grade, 65-74: C grade, <65: Needs improvement',
            example: 'Score of 78/100 indicates good content that could be optimized further',
            relatedTerms: ['Page Quality', 'Content Effectiveness', 'User Satisfaction']
        },
        
        'Engagement Rate': {
            category: 'User Behavior',
            definition: 'Percentage of sessions where users actively engaged with your content.',
            calculation: '(Engaged sessions ÷ total sessions) × 100. Engaged = 10+ seconds OR page view OR conversion',
            benchmark: 'Government standard: 50%+ is good, 70%+ is excellent',
            example: '65% engagement rate means 2 out of 3 visitors actively read your content',
            relatedTerms: ['Active Sessions', 'User Engagement', 'Content Interaction']
        },
        
        'Impressions': {
            category: 'Search Metrics',
            definition: 'Number of times your page appeared in Google search results.',
            calculation: 'Count of search result appearances across all queries and users',
            benchmark: 'More impressions = broader reach, but CTR quality matters more',
            example: '15.2K impressions means your page was shown 15,200 times in search',
            relatedTerms: ['Search Visibility', 'SERP Appearances', 'Organic Impressions']
        },
        
        'Page Views': {
            category: 'Traffic Metrics',
            definition: 'Total number of times your page was viewed, including repeat visits by same user.',
            calculation: 'Count of all page loads within the reporting period',
            benchmark: 'Higher is generally better, but engagement quality is crucial',
            example: '8.7K page views could be 8,700 unique visits or fewer people visiting multiple times',
            relatedTerms: ['Page Loads', 'Traffic Volume', 'View Count']
        },
        
        'Search Clicks': {
            category: 'Search Metrics',
            definition: 'Number of times people clicked on your page from Google search results.',
            calculation: 'Count of clicks from organic search results',
            benchmark: 'Should grow with impressions while maintaining good CTR',
            example: '1.2K clicks means 1,200 people clicked through from search',
            relatedTerms: ['Organic Clicks', 'Search Traffic', 'SERP Clicks']
        },
        
        'Sessions': {
            category: 'Traffic Metrics',
            definition: 'A session is a period of user activity that begins when they arrive and ends after 30 minutes of inactivity.',
            calculation: 'Count of user sessions within reporting period',
            benchmark: 'Quality matters more than quantity - focus on engagement',
            example: '3.4K sessions means 3,400 separate visits to your page',
            relatedTerms: ['Visits', 'User Sessions', 'Site Sessions']
        },
        
        'Users': {
            category: 'Traffic Metrics',
            definition: 'Number of unique individuals who visited your page (counted once regardless of visits).',
            calculation: 'Count of unique user identifiers within reporting period',
            benchmark: 'Key metric for understanding true audience reach',
            example: '2.1K users means 2,100 different people visited your page',
            relatedTerms: ['Unique Visitors', 'Unique Users', 'Individual Visitors']
        },
        
        // CALCULATIONS & FORMULAS
        'CTR Benchmark': {
            category: 'Calculations',
            definition: 'Expected click-through rate based on Google search position.',
            calculation: 'Position 1: 28.4%, Position 2: 15.5%, Position 3: 11.0%, Position 4: 7.7%, Position 5: 6.1%, Position 6-10: 2.5-5.0%, Position 11-20: 1.5%',
            benchmark: 'Use these to identify CTR optimization opportunities',
            example: 'If you rank #3 but have 5% CTR vs 11% benchmark, optimize title/description',
            relatedTerms: ['Expected CTR', 'Position CTR', 'Organic CTR Standards']
        },
        
        'Entrance Rate': {
            category: 'Calculations',
            definition: 'Percentage of page views that were entry points to the website.',
            calculation: '(Sessions ÷ Page Views) × 100',
            benchmark: 'Government standard: 30%+ indicates good discoverability',
            example: '25% entrance rate means 1 in 4 page views were from external sources',
            relatedTerms: ['Entry Rate', 'Landing Page Performance', 'Traffic Source Quality']
        },
        
        'Priority Score': {
            category: 'Calculations',
            definition: 'Government framework scoring system for content optimization priority.',
            calculation: 'Traffic Volume (40%) + Growth Rate (25%) + Search Behavior (20%) + Discovery (15%)',
            benchmark: '80+: Critical priority, 60-79: High priority, 40-59: Medium priority, <40: Low priority',
            example: 'Score of 75 suggests high-priority optimization opportunity',
            relatedTerms: ['Optimization Priority', 'Content Ranking', 'Investment Priority']
        },
        
        'Quality Score Components': {
            category: 'Calculations',
            definition: 'Four-part scoring system for content quality assessment.',
            calculation: 'Search Performance (25%) + User Engagement (25%) + Content Relevance (25%) + User Experience (25%)',
            benchmark: 'Each component scored 0-100, combined for overall quality',
            example: 'Search: 85, Engagement: 70, Relevance: 80, UX: 75 = Overall: 77.5',
            relatedTerms: ['Content Assessment', 'Page Quality', 'Performance Scoring']
        },
        
        // GOVERNMENT TERMS
        'Citizens Information': {
            category: 'Government Terms',
            definition: 'Official Irish government information service providing advice on public services, social services, and entitlements.',
            calculation: 'N/A - Service designation',
            benchmark: 'Primary source for official Irish government information',
            example: 'Citizens Information Centres provide face-to-face support across Ireland',
            relatedTerms: ['Public Information', 'Government Services', 'Citizen Services']
        },
        
        'Government Benchmarks': {
            category: 'Government Terms',
            definition: 'Performance standards based on research from GOV.UK, Canada.ca, and other public sector organizations.',
            calculation: 'Engagement Rate: 50%, Average Time: 52 seconds, Discovery: 30%, Effectiveness: 40%',
            benchmark: 'These are the standards used to evaluate government content performance',
            example: '52-second engagement time benchmark comes from government UX research',
            relatedTerms: ['Public Sector Standards', 'Government Performance', 'Service Standards']
        },
        
        'Irish Service Categories': {
            category: 'Government Terms',
            definition: 'Classification system for Irish government services and information needs.',
            calculation: 'Categories: Social Welfare, Health, Housing, Education, Employment, Legal, Documents, Emergency, etc.',
            benchmark: 'Based on Citizens Information service taxonomy',
            example: 'Social Welfare includes benefits, allowances, pensions, and payments',
            relatedTerms: ['Service Types', 'Government Categories', 'Public Services']
        },
        
        // CITIZEN JOURNEY TERMS
        'Citizen Journey Stages': {
            category: 'User Journey',
            definition: '12-category classification system for understanding where citizens are in their service journey.',
            calculation: 'Categories prioritized by urgency: Immediate Action (10), Problem Solving (9), Eligibility Research (8), etc.',
            benchmark: 'Urgent needs get highest priority for optimization',
            example: '"Immediate Action" includes queries with deadlines, "Eligibility Research" covers qualification questions',
            relatedTerms: ['User Intent', 'Service Journey', 'Citizen Needs']
        },
        
        'Eligibility Research': {
            category: 'User Journey',
            definition: 'Citizens checking if they qualify for government services or benefits.',
            calculation: 'Detected by keywords: "am I entitled", "do I qualify", "requirements", "criteria"',
            benchmark: 'High-priority intent requiring clear eligibility information',
            example: '"Am I entitled to carers allowance?" - needs clear criteria and requirements',
            relatedTerms: ['Qualification Checking', 'Entitlement Research', 'Criteria Checking']
        },
        
        'Immediate Action': {
            category: 'User Journey',
            definition: 'Highest priority citizen needs requiring urgent attention or immediate response.',
            calculation: 'Keywords: "urgent", "emergency", "today", "deadline", "expires", "apply now"',
            benchmark: 'Priority 10/10 - requires immediate optimization',
            example: '"Apply now before deadline" or "urgent housing application"',
            relatedTerms: ['Urgent Needs', 'Critical Queries', 'Time-Sensitive Requests']
        },
        
        'Problem Solving': {
            category: 'User Journey',
            definition: 'Citizens dealing with issues, disputes, or problems with government services.',
            calculation: 'Keywords: "appeal", "complaint", "problem", "rejected", "dispute", "wrong decision"',
            benchmark: 'Priority 9/10 - citizens in distress need quick solutions',
            example: '"Appeal rejected benefit claim" or "complaint about housing decision"',
            relatedTerms: ['Issue Resolution', 'Dispute Handling', 'Service Problems']
        },
        
        'Process Learning': {
            category: 'User Journey',
            definition: 'Citizens learning how to complete applications or navigate government processes.',
            calculation: 'Keywords: "how to apply", "step by step", "what documents", "application process"',
            benchmark: 'Priority 7/10 - requires clear instructional content',
            example: '"How to apply for passport" or "what documents needed for PPS number"',
            relatedTerms: ['How-to Queries', 'Process Guidance', 'Application Help']
        },
        
        // GEOGRAPHIC TERMS
        'Geographic Intelligence': {
            category: 'Geographic Analysis',
            definition: 'Analysis of where citizens access government services and optimization for regional service delivery.',
            calculation: 'Based on GA4 geographic data and search patterns',
            benchmark: 'Balanced regional distribution with <50% Dublin concentration',
            example: 'Dublin 35%, Cork 12%, Other counties distributed across remaining 53%',
            relatedTerms: ['Regional Analysis', 'Location Intelligence', 'Service Distribution']
        },
        
        'Dublin Concentration': {
            category: 'Geographic Analysis',
            definition: 'Percentage of total users accessing services from Dublin region.',
            calculation: '(Dublin users ÷ Total Irish users) × 100',
            benchmark: '<30%: Distributed, 30-50%: Moderate, >50%: Critical concentration',
            example: '45% Dublin concentration may indicate need for regional optimization',
            relatedTerms: ['Capital Concentration', 'Urban Focus', 'Regional Balance']
        },
        
        'County Coverage': {
            category: 'Geographic Analysis',
            definition: 'Number of Irish counties from which citizens access your services.',
            calculation: 'Count of distinct counties with recorded users',
            benchmark: '25+ counties: Excellent, 15-24: Good, 10-14: Fair, <10: Poor',
            example: '28/32 counties covered indicates strong national reach',
            relatedTerms: ['Regional Reach', 'National Coverage', 'Service Accessibility']
        },
        
        // TECHNICAL TERMS
        'Crawl Budget': {
            category: 'Technical SEO',
            definition: 'The number of pages Google will crawl on your site within a given timeframe.',
            calculation: 'Determined by Google based on site authority, speed, and content freshness',
            benchmark: 'Higher authority sites get more crawl budget',
            example: 'Government sites typically have good crawl budget due to authority',
            relatedTerms: ['Googlebot', 'Crawling', 'Indexing Budget']
        },
        
        'Index Coverage': {
            category: 'Technical SEO',
            definition: 'How well Google has indexed (stored) your pages in their search database.',
            calculation: '(Indexed pages ÷ Submitted pages) × 100',
            benchmark: '90%+ coverage is good for quality content',
            example: '95% coverage means 95 out of 100 submitted pages are indexed',
            relatedTerms: ['Indexing', 'Search Visibility', 'Page Discovery']
        },
        
        'Core Web Vitals': {
            category: 'Technical Performance',
            definition: 'Google\'s metrics for measuring real-world user experience: loading, interactivity, and visual stability.',
            calculation: 'LCP (2.5s), FID (100ms), CLS (0.1) for good ratings',
            benchmark: 'All three must be "Good" for optimal ranking',
            example: 'Fast loading (LCP), quick interaction (FID), stable layout (CLS)',
            relatedTerms: ['Page Speed', 'User Experience', 'Performance Metrics']
        },
        
        // TREND TERMS
        'Trend Indicators': {
            category: 'Trend Analysis',
            definition: 'Visual indicators showing whether metrics are improving, declining, or stable.',
            calculation: 'Compare current period to previous period: >5% change = trend, <5% = stable',
            benchmark: '↗ Positive (green), ↘ Negative (red), → Neutral (gray)',
            example: '↗ +12% means metric improved by 12% compared to previous period',
            relatedTerms: ['Performance Trends', 'Period Comparison', 'Metric Changes']
        },
        
        'Seasonal Patterns': {
            category: 'Trend Analysis',
            definition: 'Recurring patterns in citizen service usage throughout the year.',
            calculation: 'Analysis of monthly/quarterly usage patterns over multiple years',
            benchmark: 'Varies by service type - education peaks in August/September',
            example: 'Tax services peak January-October, housing services peak spring/summer',
            relatedTerms: ['Cyclical Trends', 'Usage Patterns', 'Demand Cycles']
        },
        
        // OPPORTUNITY TERMS
        'Content Gaps': {
            category: 'Opportunities',
            definition: 'Areas where citizens are searching but finding insufficient or missing content.',
            calculation: 'High impressions + Low clicks + Low CTR = content gap',
            benchmark: '1000+ impressions with <2% CTR indicates major gap',
            example: '"Housing benefit application" getting 2000 searches but 1% CTR',
            relatedTerms: ['Missing Content', 'Search Gaps', 'Unmet Needs']
        },
        
        'Optimization Opportunity': {
            category: 'Opportunities',
            definition: 'Specific improvements that could help more citizens find and use your content.',
            calculation: 'Based on CTR gaps, position improvements, and content quality scores',
            benchmark: 'High-impact opportunities can increase traffic by 20-50%',
            example: 'Improving from position 8 to position 3 could triple your traffic',
            relatedTerms: ['Improvement Potential', 'Growth Opportunity', 'Performance Gains']
        },
        
        'Citizen Impact Score': {
            category: 'Opportunities',
            definition: 'Estimated number of additional citizens who could be helped through optimization.',
            calculation: 'Potential clicks × engagement rate × service completion rate',
            benchmark: 'Higher impact scores get optimization priority',
            example: '+500 potential citizens helped monthly through title optimization',
            relatedTerms: ['Service Impact', 'Citizen Benefit', 'Public Value']
        },
        
        // SPECIALIZED TERMS
        'Surge Detection': {
            category: 'Government Intelligence',
            definition: 'Identification of sudden increases in citizen demand for specific services.',
            calculation: 'Compare current search volume to historical baseline: >50% increase = surge',
            benchmark: 'Critical: >200%, High: 100-200%, Medium: 50-100%',
            example: 'COVID-19 caused surges in unemployment benefit searches',
            relatedTerms: ['Demand Spikes', 'Emergency Response', 'Capacity Planning']
        },
        
        'Service Effectiveness': {
            category: 'Government Intelligence',
            definition: 'How well your content helps citizens complete their intended tasks.',
            calculation: '(1 - Bounce Rate) × Content Quality × Task Completion Rate',
            benchmark: 'Government standard: 40%+ effectiveness rate',
            example: '75% effectiveness means 3 out of 4 citizens successfully use the service',
            relatedTerms: ['Task Success', 'Service Quality', 'Citizen Satisfaction']
        },
        
        'Diaspora Reach': {
            category: 'International',
            definition: 'Measurement of how well your services reach Irish citizens and diaspora abroad.',
            calculation: 'Based on international traffic from countries with Irish populations',
            benchmark: 'High: 10+ countries, Medium: 5-9 countries, Low: <5 countries',
            example: 'Strong reach to UK, US, Australia, Canada indicates good diaspora service',
            relatedTerms: ['International Users', 'Global Irish', 'Overseas Citizens']
        }
    };
    
    // ===========================================
    // GLOSSARY CATEGORIES
    // ===========================================
    
    const categories = {
        'Search Metrics': {
            icon: '🔍',
            description: 'Metrics from Google Search Console showing how people find your content'
        },
        'User Behavior': {
            icon: '👥',
            description: 'How citizens interact with your content once they arrive'
        },
        'Traffic Metrics': {
            icon: '📊',
            description: 'Basic website traffic and visitor measurements'
        },
        'Quality Metrics': {
            icon: '⭐',
            description: 'Scores measuring how well your content serves citizen needs'
        },
        'Impact Metrics': {
            icon: '🎯',
            description: 'Measurements of real-world citizen service impact'
        },
        'Calculations': {
            icon: '🧮',
            description: 'Formulas and methods used to calculate dashboard metrics'
        },
        'Government Terms': {
            icon: '🏛️',
            description: 'Irish government and public service terminology'
        },
        'User Journey': {
            icon: '🗺️',
            description: 'Stages citizens go through when seeking government services'
        },
        'Geographic Analysis': {
            icon: '🌍',
            description: 'Location-based analysis of service usage and optimization'
        },
        'Technical SEO': {
            icon: '⚙️',
            description: 'Technical aspects of search engine optimization'
        },
        'Technical Performance': {
            icon: '🚀',
            description: 'Website speed and performance measurements'
        },
        'Trend Analysis': {
            icon: '📈',
            description: 'How metrics change over time and seasonal patterns'
        },
        'Opportunities': {
            icon: '💡',
            description: 'Potential improvements and optimization strategies'
        },
        'Government Intelligence': {
            icon: '🧠',
            description: 'Advanced government service analytics and insights'
        },
        'International': {
            icon: '🌐',
            description: 'Cross-border and diaspora service considerations'
        }
    };
    
    // ===========================================
    // GLOSSARY HTML CREATION
    // ===========================================
    
    function createGlossaryHTML() {
        // Create alphabet navigation
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const alphabetNav = alphabet.map(letter => {
            const hasTerms = Object.keys(glossaryData).some(term => term.charAt(0).toUpperCase() === letter);
            return `
                <button class="alpha-btn ${hasTerms ? 'has-terms' : 'no-terms'}" 
                        data-letter="${letter}" 
                        ${hasTerms ? '' : 'disabled'}>
                    ${letter}
                </button>
            `;
        }).join('');
        
        // Create category filters
        const categoryFilters = Object.entries(categories).map(([category, config]) => {
            const termCount = Object.values(glossaryData).filter(term => term.category === category).length;
            return `
                <button class="category-filter" data-category="${category}">
                    <span class="category-icon">${config.icon}</span>
                    <span class="category-name">${category}</span>
                    <span class="category-count">${termCount}</span>
                </button>
            `;
        }).join('');
        
        // Create glossary entries
        const glossaryEntries = Object.entries(glossaryData)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([term, data]) => createGlossaryEntry(term, data))
            .join('');
        
        return `
            <div class="glossary-panel" id="dashboardGlossary">
                <!-- Glossary Header -->
                <div class="glossary-header">
                    <div class="glossary-title">
                        <h2>📚 Dashboard Glossary</h2>
                        <p>Comprehensive reference for all metrics, terms, and calculations</p>
                    </div>
                    <button class="glossary-close" id="closeGlossary">✕</button>
                </div>
                
                <!-- Search -->
                <div class="glossary-search">
                    <input type="text" id="glossarySearch" placeholder="Search terms, definitions, calculations..." />
                    <button class="search-clear" id="clearSearch">✕</button>
                </div>
                
                <!-- Navigation -->
                <div class="glossary-nav">
                    <!-- Alphabet Navigation -->
                    <div class="alphabet-nav">
                        <div class="nav-label">Jump to:</div>
                        <div class="alphabet-buttons">${alphabetNav}</div>
                    </div>
                    
                    <!-- Category Filters -->
                    <div class="category-nav">
                        <div class="nav-label">Filter by category:</div>
                        <button class="category-filter active" data-category="all">
                            <span class="category-icon">📋</span>
                            <span class="category-name">All Terms</span>
                            <span class="category-count">${Object.keys(glossaryData).length}</span>
                        </button>
                        ${categoryFilters}
                    </div>
                </div>
                
                <!-- Results Summary -->
                <div class="results-summary" id="resultsSummary">
                    Showing ${Object.keys(glossaryData).length} terms
                </div>
                
                <!-- Glossary Content -->
                <div class="glossary-content" id="glossaryContent">
                    ${glossaryEntries}
                </div>
                
                <!-- Back to Top -->
                <button class="back-to-top" id="backToTop" style="display: none;">
                    ↑ Back to Top
                </button>
            </div>
            
            <!-- Floating Action Button -->
            <button class="glossary-fab" id="glossaryFAB" title="Open Dashboard Glossary">
                <span class="fab-icon">📚</span>
                <span class="fab-tooltip">Glossary</span>
            </button>
        `;
    }
    
    function createGlossaryEntry(term, data) {
        return `
            <div class="glossary-entry" data-term="${term.toLowerCase()}" data-category="${data.category}">
                <div class="entry-header">
                    <h3 class="entry-term" id="term-${term.replace(/\s+/g, '-').toLowerCase()}">${term}</h3>
                    <span class="entry-category">${data.category}</span>
                </div>
                
                <div class="entry-content">
                    <div class="entry-definition">
                        <strong>Definition:</strong> ${data.definition}
                    </div>
                    
                    ${data.calculation !== 'N/A - Service designation' ? `
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
                    
                    ${data.relatedTerms.length > 0 ? `
                        <div class="entry-related">
                            <strong>Related Terms:</strong> 
                            ${data.relatedTerms.map(relatedTerm => 
                                `<button class="related-term-link" data-related="${relatedTerm.toLowerCase()}">${relatedTerm}</button>`
                            ).join(', ')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // ===========================================
    // GLOSSARY FUNCTIONALITY
    // ===========================================
    
    function initializeGlossary() {
        // Add glossary to body
        document.body.insertAdjacentHTML('beforeend', createGlossaryHTML());
        
        // Add styles
        addGlossaryStyles();
        
        // Initialize event listeners
        setupEventListeners();
        
        console.log('✅ Dashboard Glossary initialized');
    }
    
    function setupEventListeners() {
        const fab = document.getElementById('glossaryFAB');
        const panel = document.getElementById('dashboardGlossary');
        const closeBtn = document.getElementById('closeGlossary');
        const searchInput = document.getElementById('glossarySearch');
        const clearSearch = document.getElementById('clearSearch');
        const backToTop = document.getElementById('backToTop');
        
        // FAB click to open
        fab.addEventListener('click', () => {
            panel.classList.add('active');
            searchInput.focus();
        });
        
        // Close button
        closeBtn.addEventListener('click', () => {
            panel.classList.remove('active');
        });
        
        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && panel.classList.contains('active')) {
                panel.classList.remove('active');
            }
        });
        
        // Search functionality
        searchInput.addEventListener('input', handleSearch);
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            handleSearch();
            searchInput.focus();
        });
        
        // Alphabet navigation
        document.querySelectorAll('.alpha-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const letter = btn.dataset.letter;
                scrollToLetter(letter);
            });
        });
        
        // Category filters
        document.querySelectorAll('.category-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                filterByCategory(category);
                
                // Update active state
                document.querySelectorAll('.category-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Related term links
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('related-term-link')) {
                const relatedTerm = e.target.dataset.related;
                searchAndHighlight(relatedTerm);
            }
        });
        
        // Back to top
        backToTop.addEventListener('click', () => {
            document.querySelector('.glossary-content').scrollTop = 0;
        });
        
        // Show/hide back to top button
        document.querySelector('.glossary-content').addEventListener('scroll', (e) => {
            if (e.target.scrollTop > 200) {
                backToTop.style.display = 'block';
            } else {
                backToTop.style.display = 'none';
            }
        });
    }
    
    function handleSearch() {
        const query = document.getElementById('glossarySearch').value.toLowerCase();
        const entries = document.querySelectorAll('.glossary-entry');
        let visibleCount = 0;
        
        entries.forEach(entry => {
            const term = entry.dataset.term;
            const content = entry.textContent.toLowerCase();
            
            if (query === '' || term.includes(query) || content.includes(query)) {
                entry.style.display = 'block';
                visibleCount++;
                
                // Highlight search terms
                if (query !== '') {
                    highlightSearchTerm(entry, query);
                } else {
                    removeHighlights(entry);
                }
            } else {
                entry.style.display = 'none';
            }
        });
        
        updateResultsSummary(visibleCount, query);
        
        // Show/hide clear button
        const clearBtn = document.getElementById('clearSearch');
        clearBtn.style.display = query ? 'block' : 'none';
    }
    
    function filterByCategory(category) {
        const entries = document.querySelectorAll('.glossary-entry');
        let visibleCount = 0;
        
        entries.forEach(entry => {
            if (category === 'all' || entry.dataset.category === category) {
                entry.style.display = 'block';
                visibleCount++;
            } else {
                entry.style.display = 'none';
            }
        });
        
        updateResultsSummary(visibleCount, '', category);
        
        // Clear search when filtering by category
        document.getElementById('glossarySearch').value = '';
        document.getElementById('clearSearch').style.display = 'none';
    }
    
    function scrollToLetter(letter) {
        const entries = document.querySelectorAll('.glossary-entry');
        const targetEntry = Array.from(entries).find(entry => {
            return entry.dataset.term.charAt(0).toUpperCase() === letter;
        });
        
        if (targetEntry) {
            targetEntry.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Highlight briefly
            targetEntry.style.background = 'rgba(59, 130, 246, 0.1)';
            setTimeout(() => {
                targetEntry.style.background = '';
            }, 2000);
        }
    }
    
    function searchAndHighlight(term) {
        document.getElementById('glossarySearch').value = term;
        handleSearch();
        
        // Scroll to the specific term
        const targetEntry = document.querySelector(`#term-${term.replace(/\s+/g, '-').toLowerCase()}`);
        if (targetEntry) {
            targetEntry.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
    function highlightSearchTerm(entry, query) {
        // Simple highlighting - in production you might want more sophisticated highlighting
        removeHighlights(entry);
        
        const content = entry.innerHTML;
        const regex = new RegExp(`(${query})`, 'gi');
        const highlighted = content.replace(regex, '<mark class="search-highlight">$1</mark>');
        entry.innerHTML = highlighted;
    }
    
    function removeHighlights(entry) {
        const highlights = entry.querySelectorAll('.search-highlight');
        highlights.forEach(highlight => {
            highlight.outerHTML = highlight.innerHTML;
        });
    }
    
    function updateResultsSummary(count, query = '', category = '') {
        const summary = document.getElementById('resultsSummary');
        let text = `Showing ${count} term${count !== 1 ? 's' : ''}`;
        
        if (query) {
            text += ` matching "${query}"`;
        } else if (category && category !== 'all') {
            text += ` in "${category}"`;
        }
        
        summary.textContent = text;
    }
    
    // ===========================================
    // GLOSSARY STYLES
    // ===========================================
    
    function addGlossaryStyles() {
        const styles = `
            <style>
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
                    transition: all 0.3s ease;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                
                .glossary-fab:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 30px rgba(59, 130, 246, 0.6);
                }
                
                .glossary-fab:active {
                    transform: translateY(0);
                }
                
                .fab-tooltip {
                    position: absolute;
                    right: 70px;
                    background: #1f2937;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    pointer-events: none;
                    white-space: nowrap;
                }
                
                .glossary-fab:hover .fab-tooltip {
                    opacity: 1;
                }
                
                /* Glossary Panel */
                .glossary-panel {
                    position: fixed;
                    top: 0;
                    right: -100%;
                    width: 500px;
                    height: 100vh;
                    background: white;
                    border-left: 1px solid #e2e8f0;
                    box-shadow: -10px 0 50px rgba(0, 0, 0, 0.3);
                    z-index: 10001;
                    transition: right 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
                }
                
                .glossary-close:hover {
                    background: #f1f5f9;
                    color: #ef4444;
                }
                
                /* Search */
                .glossary-search {
                    padding: 16px 24px;
                    border-bottom: 1px solid #e2e8f0;
                    position: relative;
                }
                
                .glossary-search input {
                    width: 100%;
                    padding: 12px 40px 12px 16px;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    transition: border-color 0.2s ease;
                }
                
                .glossary-search input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
                    padding: 4px;
                    display: none;
                }
                
                /* Navigation */
                .glossary-nav {
                    padding: 16px 24px;
                    border-bottom: 1px solid #e2e8f0;
                    background: #fafbfc;
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
                }
                
                .alpha-btn.has-terms:hover {
                    background: #3b82f6;
                    color: white;
                    border-color: #3b82f6;
                }
                
                .alpha-btn.no-terms {
                    color: #d1d5db;
                    cursor: not-allowed;
                }
                
                .category-nav {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                
                .category-filter {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: left;
                }
                
                .category-filter:hover {
                    background: #f8fafc;
                    border-color: #3b82f6;
                }
                
                .category-filter.active {
                    background: #3b82f6;
                    color: white;
                    border-color: #3b82f6;
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
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 0.7rem;
                    font-weight: 600;
                }
                
                .category-filter.active .category-count {
                    background: rgba(255,255,255,0.2);
                }
                
                /* Results Summary */
                .results-summary {
                    padding: 12px 24px;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 0.85rem;
                    color: #64748b;
                    font-weight: 500;
                }
                
                /* Content */
                .glossary-content {
                    flex: 1;
                    padding: 24px;
                    overflow-y: auto;
                    scroll-behavior: smooth;
                }
                
                .glossary-entry {
                    margin-bottom: 32px;
                    padding-bottom: 24px;
                    border-bottom: 1px solid #f1f5f9;
                    transition: background 0.3s ease;
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
                }
                
                .entry-category {
                    background: #e0f2fe;
                    color: #0284c7;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    flex-shrink: 0;
                }
                
                .entry-content {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .entry-content > div {
                    padding: 12px;
                    border-radius: 6px;
                    line-height: 1.5;
                    font-size: 0.9rem;
                }
                
                .entry-definition {
                    background: #f0fdf4;
                    border-left: 3px solid #10b981;
                    color: #064e3b;
                }
                
                .entry-calculation {
                    background: #fef3c7;
                    border-left: 3px solid #f59e0b;
                    color: #92400e;
                }
                
                .entry-calculation code {
                    background: rgba(0,0,0,0.1);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: 'Monaco', 'Consolas', monospace;
                    font-size: 0.85rem;
                }
                
                .entry-benchmark {
                    background: #e0f2fe;
                    border-left: 3px solid #0284c7;
                    color: #0c4a6e;
                }
                
                .entry-example {
                    background: #f3e8ff;
                    border-left: 3px solid #8b5cf6;
                    color: #581c87;
                }
                
                .entry-related {
                    background: #f1f5f9;
                    border-left: 3px solid #64748b;
                    color: #475569;
                }
                
                .related-term-link {
                    background: none;
                    border: none;
                    color: #3b82f6;
                    cursor: pointer;
                    text-decoration: underline;
                    font-size: inherit;
                    padding: 0;
                    margin: 0;
                }
                
                .related-term-link:hover {
                    color: #1d4ed8;
                }
                
                /* Search Highlighting */
                .search-highlight {
                    background: #fbbf24;
                    color: #92400e;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-weight: 600;
                }
                
                /* Back to Top */
                .back-to-top {
                    position: absolute;
                    bottom: 24px;
                    right: 24px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 12px 16px;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                    transition: all 0.2s ease;
                }
                
                .back-to-top:hover {
                    background: #1d4ed8;
                    transform: translateY(-2px);
                }
                
                /* Responsive */
                @media (max-width: 768px) {
                    .glossary-panel {
                        width: 100%;
                        right: -100%;
                    }
                    
                    .glossary-fab {
                        bottom: 20px;
                        right: 20px;
                        width: 48px;
                        height: 48px;
                        font-size: 1.2rem;
                    }
                    
                    .fab-tooltip {
                        display: none;
                    }
                    
                    .alphabet-buttons {
                        justify-content: center;
                    }
                    
                    .alpha-btn {
                        width: 28px;
                        height: 28px;
                        font-size: 0.7rem;
                    }
                }
                
                /* Scrollbar styling */
                .glossary-content::-webkit-scrollbar {
                    width: 6px;
                }
                
                .glossary-content::-webkit-scrollbar-track {
                    background: #f1f5f9;
                }
                
                .glossary-content::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }
                
                .glossary-content::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    // ===========================================
    // INITIALIZATION
    // ===========================================
    
    function initializeGlossarySystem() {
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeGlossary);
        } else {
            initializeGlossary();
        }
    }
    
    // ===========================================
    // PUBLIC API
    // ===========================================
    
    window.DashboardGlossary = {
        open: function() {
            const panel = document.getElementById('dashboardGlossary');
            if (panel) {
                panel.classList.add('active');
                document.getElementById('glossarySearch').focus();
            }
        },
        
        close: function() {
            const panel = document.getElementById('dashboardGlossary');
            if (panel) {
                panel.classList.remove('active');
            }
        },
        
        searchFor: function(term) {
            this.open();
            setTimeout(() => {
                searchAndHighlight(term);
            }, 300);
        },
        
        goToCategory: function(category) {
            this.open();
            setTimeout(() => {
                filterByCategory(category);
            }, 300);
        }
    };
    
    // Auto-initialize
    initializeGlossarySystem();
    
    console.log('✅ Dashboard Glossary System loaded successfully!');
    console.log('📚 Features:');
    console.log('   - 📖 Comprehensive definitions for all dashboard terms');
    console.log('   - 🧮 Calculation formulas and benchmarks');
    console.log('   - 🔍 Search functionality with highlighting');
    console.log('   - 📑 A-Z navigation and category filtering');
    console.log('   - 🔗 Related term linking');
    console.log('   - 📱 Fully responsive design');
    console.log('');
    console.log('💡 Usage:');
    console.log('   - Click the floating book icon (📚) to open');
    console.log('   - Use DashboardGlossary.searchFor("term") to search programmatically');
    console.log('   - Use DashboardGlossary.goToCategory("Search Metrics") to filter');

})();