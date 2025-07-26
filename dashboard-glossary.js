// dashboard-glossary.js - IMPROVED with debug fixes and enhancements
// Sliding panel glossary with better error handling and performance

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
        
        'Search Clicks': {
            category: 'Search Metrics',
            definition: 'Number of times people clicked on your page from Google search results.',
            calculation: 'Count of clicks from organic search results',
            benchmark: 'Should grow with impressions while maintaining good CTR',
            example: '1.2K clicks means 1,200 people clicked through from search',
            relatedTerms: ['Organic Clicks', 'Search Traffic', 'SERP Clicks']
        }
        
        // Add more terms as needed...
    };
    
    const categories = {
        'Search Metrics': {
            icon: '🔍',
            description: 'Metrics from Google Search Console showing how people find your content'
        },
        'User Behavior': {
            icon: '👥',
            description: 'How citizens interact with your content once they arrive'
        },
        'Quality Metrics': {
            icon: '⭐',
            description: 'Scores measuring how well your content serves citizen needs'
        },
        'Impact Metrics': {
            icon: '🎯',
            description: 'Measurements of real-world citizen service impact'
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
                    <div class="glossary-nav">
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
                    
                    <!-- Results Summary -->
                    <div class="results-summary" id="${CONFIG.SELECTORS.resultsSummary}" role="status" aria-live="polite">
                        Showing ${Object.keys(glossaryData).length} terms
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
            
            return `
                <article class="glossary-entry" data-term="${term.toLowerCase()}" data-category="${data.category}">
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
            
            // Use document fragment for better performance
            const fragment = document.createDocumentFragment();
            
            entries.forEach(entry => {
                const term = entry.dataset.term || '';
                const content = entry.textContent.toLowerCase();
                const isVisible = query === '' || term.includes(query) || content.includes(query);
                
                if (isVisible) {
                    entry.style.display = 'block';
                    visibleCount++;
                    
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
            
            debugLog(`✅ Search complete: ${visibleCount} results`);
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
                
                // Scroll to the specific term
                const termId = `term-${term.replace(/\s+/g, '-').toLowerCase()}`;
                const targetElement = document.getElementById(termId);
                
                if (targetElement) {
                    setTimeout(() => {
                        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
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
            
            summary.textContent = text;
        }
        
        // Scroll to top
        scrollToTop() {
            const content = safeGetElement(CONFIG.SELECTORS.content);
            if (content) {
                content.scrollTo({ top: 0, behavior: 'smooth' });
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
                    
                    /* Floating Action Button - Enhanced */
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
                        z-index: 9999;
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
                        right: 70px;
                        background: #1f2937;
                        color: white;
                        padding: 8px 12px;
                        border-radius: 6px;
                        font-size: 0.8rem;
                        font-weight: 600;
                        opacity: 0;
                        transform: translateX(10px);
                        transition: all 0.2s ease;
                        pointer-events: none;
                        white-space: nowrap;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    }
                    
                    .glossary-fab:hover .fab-tooltip {
                        opacity: 1;
                        transform: translateX(0);
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
                    
                    /* Navigation - Enhanced */
                    .glossary-nav {
                        padding: 16px 24px;
                        border-bottom: 1px solid #e2e8f0;
                        background: #fafbfc;
                        flex-shrink: 0;
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
                    
                    /* Results Summary */
                    .results-summary {
                        padding: 12px 24px;
                        background: #f8fafc;
                        border-bottom: 1px solid #e2e8f0;
                        font-size: 0.85rem;
                        color: #64748b;
                        font-weight: 500;
                        flex-shrink: 0;
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
                            bottom: 20px;
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
                        
                        .glossary-nav {
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
                    // Set up global API
                    window.DashboardGlossary = {
                        open: () => glossaryInstance.open(),
                        close: () => glossaryInstance.close(),
                        searchFor: (term) => glossaryInstance.search(term),
                        goToCategory: (category) => glossaryInstance.filterCategory(category),
                        isHealthy: () => glossaryInstance.isHealthy(),
                        instance: glossaryInstance
                    };
                    
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
                    console.log('   - DashboardGlossary.searchFor("term") - Search for a term');
                    console.log('   - DashboardGlossary.goToCategory("Search Metrics") - Filter by category');
                    console.log('   - DashboardGlossary.isHealthy() - Check if system is working');
                    
                } else {
                    debugLog('❌ Glossary initialization failed');
                }
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
