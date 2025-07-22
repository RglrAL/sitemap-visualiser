// gsc-integration-module.js - Complete Enhanced Content Writer Version with Robust Connection

(function() {
    // Configuration
    const GSC_CONFIG = {
        CLIENT_ID: '550630256834-9quh64fnqhfse6s488c8gutstuqcch04.apps.googleusercontent.com',
        DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/searchconsole/v1/rest'],
        SCOPES: 'https://www.googleapis.com/auth/webmasters.readonly'
    };

    // GSC data storage
    let gscDataMap = new Map();
    let gscConnected = false;
    let gscSiteUrl = null;
    let gscDataLoaded = false;
    let tokenClient = null;
    let accessToken = null;
    let tokenSetTime = null;
    let fetchInProgress = false;
    let gapiInited = false;
    let gisInited = false;

    // Lazy loading variables
    const pendingRequests = new Map();
    const hoverQueue = new Set();
    let batchTimeout = null;
    let cacheCleanupInterval = null;
    let healthCheckInterval = null;

    // Simplified tooltip variables
    let currentTooltip = null;
    let hideTimer = null;
    let showTimer = null;

    // Debug logging helper
    function debugLog(message, data = null) {
        console.log(`[GSC Integration] ${message}`, data || '');
    }

    // Create event system
    const gscEvents = {
        listeners: {},
        on: function(event, callback) {
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            this.listeners[event].push(callback);
        },
        emit: function(event, data) {
            debugLog(`Event emitted: ${event}`, data);
            if (this.listeners[event]) {
                this.listeners[event].forEach(callback => callback(data));
            }
        }
    };

    // ===========================================
    // ENHANCED URL VARIATIONS & ROBUST API CALLS
    // ===========================================

    // Enhanced URL variations function - more comprehensive matching
    function createEnhancedUrlVariations(originalUrl) {
        const variations = new Set();
        
        if (!originalUrl) return [];
        
        // Add original URL
        variations.add(originalUrl);
        
        try {
            // Handle relative URLs first
            if (originalUrl.startsWith('/') && gscSiteUrl) {
                const baseUrl = gscSiteUrl.replace(/\/$/, '');
                const fullUrl = baseUrl + originalUrl;
                variations.add(fullUrl);
                
                // Parse the full URL for further variations
                originalUrl = fullUrl;
            }
            
            const urlObj = new URL(originalUrl);
            const protocol = urlObj.protocol;
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;
            const search = urlObj.search;
            const hash = urlObj.hash;
            
            // Core variations without hash/search
            const baseVariations = [];
            
            // Protocol variations
            ['http:', 'https:'].forEach(proto => {
                // www variations
                [hostname, `www.${hostname}`, hostname.replace(/^www\./, '')].forEach(host => {
                    if (host && host !== hostname.replace(/^www\./, '').replace(/^www\./, '')) {
                        // Trailing slash variations
                        [pathname, pathname.replace(/\/$/, ''), pathname + (pathname.endsWith('/') ? '' : '/')].forEach(path => {
                            if (path) {
                                baseVariations.push(`${proto}//${host}${path}`);
                            }
                        });
                    }
                });
            });
            
            // Add all base variations
            baseVariations.forEach(url => variations.add(url));
            
            // Add variations with search params and hash
            baseVariations.forEach(baseUrl => {
                if (search) variations.add(baseUrl + search);
                if (hash) variations.add(baseUrl + hash);
                if (search && hash) variations.add(baseUrl + search + hash);
            });
            
            // Language-specific variations (for your MABS.ie case)
            const langPatterns = ['/en/', '/ga/', '/ie/', '/uk/'];
            langPatterns.forEach(lang => {
                if (pathname.includes(lang)) {
                    const withoutLang = pathname.replace(lang, '/');
                    baseVariations.forEach(baseUrl => {
                        const modifiedUrl = baseUrl.replace(pathname, withoutLang);
                        variations.add(modifiedUrl);
                    });
                } else {
                    // Add language prefixes
                    langPatterns.forEach(langPrefix => {
                        const withLang = pathname.replace('/', langPrefix);
                        baseVariations.forEach(baseUrl => {
                            const modifiedUrl = baseUrl.replace(pathname, withLang);
                            variations.add(modifiedUrl);
                        });
                    });
                }
            });
            
            // Common URL transformations
            const transformations = [
                // Remove query parameters
                url => url.split('?')[0],
                // Remove fragments
                url => url.split('#')[0],
                // Remove both
                url => url.split('?')[0].split('#')[0],
                // Add index.html
                url => url.endsWith('/') ? url + 'index.html' : url + '/index.html',
                // Remove index.html
                url => url.replace(/\/index\.html$/, '/'),
                url => url.replace(/\/index\.html$/, ''),
                // Common file extensions
                url => url.replace(/\/$/, '.html'),
                url => url.replace(/\/$/, '.php')
            ];
            
            // Apply transformations to base variations
            const currentVariations = Array.from(variations);
            currentVariations.forEach(url => {
                transformations.forEach(transform => {
                    try {
                        const transformed = transform(url);
                        if (transformed && transformed !== url) {
                            variations.add(transformed);
                        }
                    } catch (e) {
                        // Skip invalid transformations
                    }
                });
            });
            
        } catch (e) {
            debugLog('Error creating URL variations:', e);
        }
        
        // Convert to array and limit to prevent too many requests
        const result = Array.from(variations).slice(0, 15); // Increased limit
        debugLog(`Generated ${result.length} variations for:`, originalUrl);
        return result;
    }

    // Token management functions
    function isTokenExpired() {
        if (!accessToken) return true;
        
        // Check if token was set more than 55 minutes ago (tokens expire in 1 hour)
        const tokenAge = Date.now() - (tokenSetTime || 0);
        return tokenAge > 55 * 60 * 1000; // 55 minutes
    }

    async function refreshToken() {
        return new Promise((resolve, reject) => {
            if (!tokenClient) {
                reject(new Error('Token client not available'));
                return;
            }
            
            debugLog('Refreshing GSC token...');
            
            tokenClient.requestAccessToken({
                prompt: '',
                callback: (response) => {
                    if (response.error) {
                        debugLog('Token refresh failed:', response.error);
                        reject(new Error(`Token refresh failed: ${response.error}`));
                        return;
                    }
                    
                    accessToken = response.access_token;
                    tokenSetTime = Date.now();
                    
                    if (gapi && gapi.client) {
                        gapi.client.setToken({ access_token: accessToken });
                    }
                    
                    debugLog('Token refreshed successfully');
                    resolve();
                },
                error_callback: (error) => {
                    debugLog('Token refresh error:', error);
                    reject(new Error(`Token refresh error: ${error.message || 'Unknown error'}`));
                }
            });
        });
    }

    // Robust API calling with retry logic
    async function robustGSCApiCall(apiCall, maxRetries = 3, delay = 1000) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                debugLog(`GSC API attempt ${attempt}/${maxRetries}`);
                
                // Check token validity before call
                if (!accessToken || isTokenExpired()) {
                    debugLog('Token expired, refreshing...');
                    await refreshToken();
                }
                
                const result = await apiCall();
                debugLog(`GSC API success on attempt ${attempt}`);
                return result;
                
            } catch (error) {
                lastError = error;
                debugLog(`GSC API attempt ${attempt} failed:`, error);
                
                // Handle specific error types
                if (error.status === 401) {
                    // Unauthorized - refresh token and retry
                    debugLog('Refreshing token due to 401');
                    await refreshToken();
                    if (attempt < maxRetries) continue;
                }
                
                if (error.status === 403) {
                    // Forbidden - don't retry
                    throw new Error('Permission denied. Check GSC property access.');
                }
                
                if (error.status === 429) {
                    // Rate limited - wait longer
                    debugLog('Rate limited, waiting longer...');
                    await new Promise(resolve => setTimeout(resolve, delay * 2));
                    if (attempt < maxRetries) continue;
                }
                
                if (error.status >= 500) {
                    // Server error - retry with backoff
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                    if (attempt < maxRetries) continue;
                }
                
                // For other errors, don't retry
                if (attempt === maxRetries) {
                    throw lastError || error;
                }
            }
            
            // Progressive delay between retries
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
        
        throw lastError || new Error('Max retries exceeded');
    }

    // Enhanced site matching
    async function findBestMatchingSite(sites, targetDomain) {
        debugLog('Finding best site match for:', targetDomain);
        
        // Normalize target domain
        const normalizeUrl = (url) => {
            try {
                const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
                return urlObj.hostname.replace(/^www\./, '').toLowerCase();
            } catch {
                return url.replace(/^www\./, '').toLowerCase();
            }
        };
        
        const normalizedTarget = normalizeUrl(targetDomain);
        
        // Scoring system for site matching
        const scoreSite = (site) => {
            let score = 0;
            const siteHost = normalizeUrl(site.siteUrl);
            
            // Exact match
            if (siteHost === normalizedTarget) score += 100;
            
            // Subdomain match
            if (siteHost.includes(normalizedTarget) || normalizedTarget.includes(siteHost)) score += 50;
            
            // Domain contains check
            const targetParts = normalizedTarget.split('.');
            const siteParts = siteHost.split('.');
            const commonParts = targetParts.filter(part => siteParts.includes(part)).length;
            score += commonParts * 10;
            
            // Prefer domain property over sc-domain
            if (site.siteUrl.startsWith('https://') || site.siteUrl.startsWith('http://')) score += 20;
            
            // Prefer sites with full permission
            if (site.permissionLevel === 'siteOwner') score += 15;
            else if (site.permissionLevel === 'siteFullUser') score += 10;
            else if (site.permissionLevel === 'siteRestrictedUser') score += 5;
            
            return score;
        };
        
        // Score all sites and sort
        const scoredSites = sites.map(site => ({
            ...site,
            score: scoreSite(site)
        })).sort((a, b) => b.score - a.score);
        
        debugLog('Site matching scores:', scoredSites.map(s => ({ url: s.siteUrl, score: s.score })));
        
        // Return best match if score is good enough
        const bestMatch = scoredSites[0];
        if (bestMatch && bestMatch.score >= 50) {
            debugLog('Auto-selected site:', bestMatch.siteUrl);
            return bestMatch;
        }
        
        // If no good match, let user choose
        debugLog('No clear match found, showing selector');
        return await showSiteSelector(scoredSites);
    }

    // Connection health monitoring
    async function checkGSCConnectionHealth() {
        if (!gscConnected || !gscSiteUrl || !accessToken) {
            return { healthy: false, reason: 'Not connected' };
        }
        
        try {
            // Simple test query
            await robustGSCApiCall(async () => {
                return await gapi.client.request({
                    path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                    method: 'POST',
                    body: {
                        startDate: '2024-01-01',
                        endDate: '2024-01-02',
                        dimensions: ['page'],
                        rowLimit: 1
                    }
                });
            });
            
            return { healthy: true };
            
        } catch (error) {
            return { 
                healthy: false, 
                reason: error.message,
                shouldReconnect: error.status === 401
            };
        }
    }

    // Helper functions for enhanced analysis
    function getCTRBenchmark(position) {
        // Industry standard CTR benchmarks by position
        if (position <= 1) return 0.28;
        if (position <= 2) return 0.15;
        if (position <= 3) return 0.11;
        if (position <= 4) return 0.08;
        if (position <= 5) return 0.06;
        if (position <= 10) return 0.03;
        return 0.01;
    }

    function getCTRStatusIcon(performance) {
        switch(performance) {
            case 'excellent': return '🌟';
            case 'good': return '✅';
            case 'fair': return '⚠️';
            case 'poor': return '🔴';
            default: return '❓';
        }
    }

    function getPositionStatusIcon(performance) {
        switch(performance) {
            case 'excellent': return '🏆';
            case 'good': return '🥇';
            case 'fair': return '🥈';
            case 'poor': return '📉';
            default: return '❓';
        }
    }

    function getPositionGrade(position) {
        if (position <= 3) return 'A+';
        if (position <= 5) return 'A';
        if (position <= 10) return 'B';
        if (position <= 20) return 'C';
        return 'D';
    }

    function getCTRGrade(ctr, benchmark) {
        const ratio = ctr / benchmark;
        if (ratio >= 1.5) return 'A+';
        if (ratio >= 1.2) return 'A';
        if (ratio >= 1.0) return 'B';
        if (ratio >= 0.8) return 'C';
        return 'D';
    }

    function getTrafficGrade(clicks) {
        if (clicks >= 1000) return 'A+';
        if (clicks >= 500) return 'A';
        if (clicks >= 100) return 'B';
        if (clicks >= 50) return 'C';
        return 'D';
    }

    function getTrendGrade(trend) {
        if (!trend) return 'N/A';
        const clickChange = parseFloat(trend.clicksChange);
        if (clickChange >= 20) return 'A+';
        if (clickChange >= 10) return 'A';
        if (clickChange >= 0) return 'B';
        if (clickChange >= -10) return 'C';
        return 'D';
    }

    function getQueryOpportunity(query) {
        if (query.position > 10 && query.impressions > 100) {
            return { label: 'HIGH POTENTIAL', color: '#f44336' };
        }
        if (query.position > 5 && query.ctr < 0.05) {
            return { label: 'CTR BOOST', color: '#ff9800' };
        }
        if (query.position <= 3 && query.ctr > 0.15) {
            return { label: 'PERFORMING', color: '#4caf50' };
        }
        return { label: 'MONITOR', color: '#666' };
    }

    function generateQuickWins(gscData, avgPosition, ctrPerformance) {
        const wins = [];
        
        if (ctrPerformance === 'poor' || ctrPerformance === 'fair') {
            wins.push({
                title: 'Optimize Title & Meta Description',
                description: 'Your CTR is below benchmark. Improve click-through rates with compelling titles.',
                impact: 'HIGH'
            });
        }
        
        if (avgPosition > 10 && gscData.impressions > 100) {
            wins.push({
                title: 'Target Featured Snippets',
                description: 'High impressions but low position. Structure content for featured snippets.',
                impact: 'MEDIUM'
            });
        }
        
        if (gscData.topQueries && gscData.topQueries.length > 0) {
            wins.push({
                title: 'Expand Top-Performing Keywords',
                description: 'Create supporting content around your best-performing queries.',
                impact: 'MEDIUM'
            });
        }
        
        return wins.slice(0, 3); // Limit to 3 quick wins
    }



    // Add this to gsc-integration-module.js (around line 1000, before the dashboard functions)
function formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
}


    

    function generateActionPlan(gscData, avgPosition, ctrPerformance) {
        const actions = [];
        
        // Always include content audit
        actions.push({
            title: 'Conduct Content Quality Audit',
            description: 'Review and update content to ensure it matches search intent and provides comprehensive, valuable information.',
            priority: 'high',
            timeframe: '1-2 weeks',
            impact: 'High traffic increase',
            difficulty: 'Medium'
        });
        
        // CTR optimization if needed
        if (ctrPerformance === 'poor' || ctrPerformance === 'fair') {
            actions.push({
                title: 'Optimize Click-Through Rates',
                description: 'Rewrite title tags and meta descriptions to be more compelling and include primary keywords. A/B test different variations.',
                priority: 'high',
                timeframe: '3-5 days',
                impact: 'Immediate traffic boost',
                difficulty: 'Easy'
            });
        }
        
        // Technical optimization
        actions.push({
            title: 'Technical SEO Enhancement',
            description: 'Improve page speed, mobile responsiveness, and internal linking structure. Ensure proper schema markup implementation.',
            priority: 'medium',
            timeframe: '2-3 weeks',
            impact: 'Long-term ranking gains',
            difficulty: 'Hard'
        });
        
        return actions;
    }

    // ===========================================
    // MAIN GSC INTEGRATION FUNCTIONS
    // ===========================================

    // Export to global scope
    window.GSCIntegration = {
        init: initGSCIntegration,
        isConnected: () => gscConnected,
        hasData: () => gscDataLoaded,
        getData: (url) => gscDataMap.get(url),
        toggleConnection: toggleGSCConnection,
        fetchData: fetchGSCDataForSitemap,
        fetchNodeData: fetchNodeGSCData,
        events: gscEvents,
        reset: resetGSCData,
        loadVisibleNodes: loadVisibleNodesGSCData,
        debug: {
            getStatus: () => ({
                gscConnected,
                gscDataLoaded,
                gapiInited,
                gisInited,
                fetchInProgress,
                dataCount: gscDataMap.size,
                pendingRequests: pendingRequests.size,
                hasAccessToken: !!accessToken,
                tokenAge: tokenSetTime ? (Date.now() - tokenSetTime) / 1000 / 60 : null,
                hasTreeData: !!(window.treeData || (typeof treeData !== 'undefined' && treeData)),
                siteUrl: gscSiteUrl
            }),
            checkTreeData: () => {
                const globalTreeData = typeof treeData !== 'undefined' ? treeData : null;
                debugLog('Tree data check:', {
                    windowTreeData: !!window.treeData,
                    globalTreeData: !!globalTreeData,
                    treeDataType: globalTreeData ? typeof globalTreeData : 'undefined'
                });
                return window.treeData || globalTreeData;
            },
            triggerFetch: () => {
                debugLog('Manual fetch triggered');
                fetchGSCDataForSitemap();
            },
            clearCache: () => {
                gscDataMap.clear();
                pendingRequests.clear();
                debugLog('Cache cleared');
            },
            testSingleUrl: async (url) => {
                if (!accessToken || !gscSiteUrl) {
                    console.error('Not connected to GSC');
                    return;
                }
                
                debugLog('Testing single URL:', url);
                
                try {
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
                    
                    const response = await robustGSCApiCall(async () => {
                        return await gapi.client.request({
                            path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                            method: 'POST',
                            body: {
                                startDate: thirtyDaysAgo.toISOString().split('T')[0],
                                endDate: today.toISOString().split('T')[0],
                                dimensions: ['page'],
                                dimensionFilterGroups: [{
                                    filters: [{
                                        dimension: 'page',
                                        operator: 'equals',
                                        expression: url
                                    }]
                                }],
                                rowLimit: 10
                            }
                        });
                    });
                    
                    debugLog('Single URL test response:', response);
                    return response.result;
                } catch (error) {
                    console.error('Single URL test error:', error);
                    return error;
                }
            },
            testBroadQuery: async () => {
                if (!accessToken || !gscSiteUrl) {
                    console.error('Not connected to GSC');
                    return;
                }
                
                debugLog('Testing broad query for site:', gscSiteUrl);
                
                try {
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
                    
                    const response = await robustGSCApiCall(async () => {
                        return await gapi.client.request({
                            path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                            method: 'POST',
                            body: {
                                startDate: thirtyDaysAgo.toISOString().split('T')[0],
                                endDate: today.toISOString().split('T')[0],
                                dimensions: ['page'],
                                rowLimit: 10
                            }
                        });
                    });
                    
                    debugLog('Broad query response:', response);
                    debugLog('Total rows returned:', response.result?.rows?.length || 0);
                    if (response.result?.rows?.length > 0) {
                        debugLog('Sample URLs from GSC:', response.result.rows.slice(0, 5).map(row => row.keys[0]));
                    }
                    return response.result;
                } catch (error) {
                    console.error('Broad query test error:', error);
                    return error;
                }
            }
        }
    };

    // Initialize
    function initGSCIntegration() {
        debugLog('Initializing GSC Integration...');
        addGSCButton();
        addGSCStyles();
        addSimplifiedTooltipStyles();
        addLoadingAnimationStyles();
        initializeGoogleAPI();
        hookIntoSitemapLoader();
        
        listenForTreeReady();
        setupCacheCleanup();
        setupHealthMonitoring();
        initializeDebugging();
    }

    // Initialize Google API
    function initializeGoogleAPI() {
        debugLog('Initializing Google APIs...');
        
        if (typeof gapi !== 'undefined') {
            debugLog('GAPI already available, loading client...');
            gapi.load('client', initializeGapiClient);
        } else {
            debugLog('Waiting for GAPI to load...');
            let attempts = 0;
            const checkGapi = setInterval(() => {
                attempts++;
                if (typeof gapi !== 'undefined') {
                    clearInterval(checkGapi);
                    debugLog('GAPI loaded after ' + attempts + ' attempts');
                    gapi.load('client', initializeGapiClient);
                } else if (attempts > 50) {
                    clearInterval(checkGapi);
                    console.error('[GSC Integration] GAPI failed to load after 5 seconds');
                    alert('Failed to load Google APIs. Please refresh the page.');
                }
            }, 100);
        }
        
        initializeGIS();
    }

    // Initialize GAPI client
    function initializeGapiClient() {
        debugLog('Initializing GAPI client...');
        
        gapi.client.init({
            discoveryDocs: GSC_CONFIG.DISCOVERY_DOCS,
        }).then(() => {
            debugLog('GAPI client initialized successfully');
            gapiInited = true;
            gscEvents.emit('gapiReady');
        }).catch((error) => {
            console.error('[GSC Integration] Error initializing GAPI client:', error);
            alert('Failed to initialize Google API client. Error: ' + error.message);
        });
    }

    // Initialize GIS
    function initializeGIS() {
        debugLog('Initializing Google Identity Services...');
        
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            createTokenClient();
            return;
        }
        
        let attempts = 0;
        const checkGis = setInterval(() => {
            attempts++;
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                clearInterval(checkGis);
                debugLog('GIS loaded after ' + attempts + ' attempts');
                createTokenClient();
            } else if (attempts > 50) {
                clearInterval(checkGis);
                console.error('[GSC Integration] GIS failed to load after 5 seconds');
            }
        }, 100);
    }

    // Create token client
    function createTokenClient() {
        try {
            debugLog('Creating token client...');
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GSC_CONFIG.CLIENT_ID,
                scope: GSC_CONFIG.SCOPES,
                callback: handleAuthResponse,
                error_callback: (error) => {
                    console.error('[GSC Integration] Token client error:', error);
                    alert('Authentication error: ' + (error.message || 'Unknown error'));
                }
            });
            
            debugLog('Token client created successfully');
            gisInited = true;
            gscEvents.emit('gisReady');
        } catch (error) {
            console.error('[GSC Integration] Failed to create token client:', error);
        }
    }

    // Handle auth response
    function handleAuthResponse(response) {
        debugLog('Handling auth response...', response);
        hideGSCLoadingState();
        
        if (response.error) {
            console.error('[GSC Integration] Authentication error:', response);
            updateConnectionStatus(false);
            return;
        }
        
        accessToken = response.access_token;
        tokenSetTime = Date.now();
        debugLog('Access token received');
        
        if (gapi && gapi.client) {
            gapi.client.setToken({ access_token: accessToken });
            debugLog('Token set in GAPI client');
        }
        
        updateConnectionStatus(true);
        gscEvents.emit('authenticated');
        
        // Start lazy loading initialization
        initializeLazyLoading();
    }

    // Toggle connection
    function toggleGSCConnection() {
        debugLog('Toggle connection called. Current state:', gscConnected);
        
        if (gscConnected) {
            if (accessToken) {
                google.accounts.oauth2.revoke(accessToken, () => {
                    debugLog('Access token revoked');
                });
            }
            updateConnectionStatus(false);
            resetGSCData();
        } else {
            if (!gisInited || !gapiInited) {
                alert('Google services are still loading. Please wait a moment and try again.');
                return;
            }
            
            if (tokenClient) {
                debugLog('Requesting access token...');
                showGSCLoadingState();
                
                try {
                    tokenClient.requestAccessToken({ prompt: '' });
                } catch (error) {
                    console.error('[GSC Integration] Error requesting access token:', error);
                    hideGSCLoadingState();
                    alert('Failed to open authentication window. Please check your popup blocker.');
                }
            }
        }
    }

    // Initialize lazy loading
    function initializeLazyLoading() {
        const hasTreeData = !!(window.treeData || (typeof treeData !== 'undefined' && treeData));
        
        debugLog('Initializing lazy loading...', {
            connected: gscConnected,
            treeData: hasTreeData
        });
        
        if (gscConnected && hasTreeData && !fetchInProgress) {
            debugLog('Starting GSC initialization for lazy loading...');
            fetchGSCDataForSitemap();
        }
    }

    // Main fetch function - sets up the connection
    async function fetchGSCDataForSitemap() {
        const treeDataRef = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
        
        if (!treeDataRef || !accessToken || fetchInProgress) {
            debugLog('Cannot initialize GSC - conditions not met');
            return;
        }
        
        fetchInProgress = true;
        showGSCLoadingIndicator();
        
        try {
            if (!gapiInited) {
                debugLog('Waiting for GAPI to initialize...');
                await new Promise(resolve => {
                    gscEvents.on('gapiReady', resolve);
                });
            }
            
            debugLog('Fetching site list...');
            
            const sitesResponse = await robustGSCApiCall(async () => {
                return await gapi.client.request({
                    path: 'https://www.googleapis.com/webmasters/v3/sites',
                    method: 'GET'
                });
            });
            
            const sites = sitesResponse.result.siteEntry || [];
            debugLog('Found sites:', sites);
            
            if (sites.length === 0) {
                hideGSCLoadingIndicator();
                fetchInProgress = false;
                alert('No Search Console properties found for your account.');
                return;
            }
            
            // Better site matching
            const currentDomain = treeDataRef.name;
            debugLog('Looking for site matching domain:', currentDomain);
            
            let matchedSite = await findBestMatchingSite(sites, currentDomain);
            
            if (!matchedSite) {
                hideGSCLoadingIndicator();
                fetchInProgress = false;
                return;
            }
            
            gscSiteUrl = matchedSite.siteUrl;
            debugLog('Using site:', gscSiteUrl);
            debugLog('Available sites were:', sites);
            
            // Mark as ready
            gscDataLoaded = true;
            fetchInProgress = false;
            hideGSCLoadingIndicator();
            
            showGSCReadyMessage();
            gscEvents.emit('dataReady');
            
            // Pre-load data for important nodes
            setTimeout(() => {
                preloadImportantNodes();
            }, 1000);
            
        } catch (error) {
            console.error('[GSC Integration] Error initializing GSC:', error);
            hideGSCLoadingIndicator();
            fetchInProgress = false;
            
            if (error.message.includes('Permission denied')) {
                alert('Permission denied. Please make sure you have access to this Search Console property.');
            } else if (error.message.includes('Token refresh failed')) {
                updateConnectionStatus(false);
                alert('Your session has expired. Please reconnect to Google Search Console.');
            } else {
                alert('Error connecting to Search Console: ' + (error.message || 'Unknown error'));
            }
        }
    }

    // Lazy loading core function
    async function fetchNodeGSCData(node) {
        if (!node || !node.url || !gscConnected || !gscSiteUrl) return null;
        
        // Check if data already exists
        if (gscDataMap.has(node.url)) {
            return gscDataMap.get(node.url);
        }
        
        // Check if request is already pending
        if (pendingRequests.has(node.url)) {
            return pendingRequests.get(node.url);
        }
        
        // Create and store the promise
        const promise = fetchSingleNodeDataRobust(node);
        pendingRequests.set(node.url, promise);
        
        try {
            const result = await promise;
            return result;
        } finally {
            pendingRequests.delete(node.url);
        }
    }

    // Enhanced function to fetch comprehensive data for a single node
    async function fetchSingleNodeDataRobust(node) {
        if (!node || !node.url) return null;
        
        debugLog('Fetching robust GSC data for:', node.url);
        
        const urlVariations = createEnhancedUrlVariations(node.url);
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        const ninetyDaysAgo = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));
        
        let foundData = null;
        let attempts = 0;
        
        // Try variations in order of likelihood
        for (const variation of urlVariations) {
            attempts++;
            
            try {
                debugLog(`Trying variation ${attempts}/${urlVariations.length}:`, variation);
                
                const result = await robustGSCApiCall(async () => {
                    return await gapi.client.request({
                        path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                        method: 'POST',
                        body: {
                            startDate: thirtyDaysAgo.toISOString().split('T')[0],
                            endDate: today.toISOString().split('T')[0],
                            dimensions: ['page'],
                            dimensionFilterGroups: [{
                                filters: [{
                                    dimension: 'page',
                                    operator: 'equals',
                                    expression: variation
                                }]
                            }],
                            rowLimit: 1
                        }
                    });
                });
                
                if (result.result && result.result.rows && result.result.rows.length > 0) {
                    debugLog(`✅ Found data for variation:`, variation);
                    
                    // Get additional data for this successful variation
                    const enhancedData = await getEnhancedDataForUrl(variation, thirtyDaysAgo, ninetyDaysAgo, today);
                    foundData = enhancedData;
                    break;
                }
                
                // Add small delay between variations to avoid rate limiting
                if (attempts < urlVariations.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
            } catch (error) {
                debugLog(`❌ Error with variation ${variation}:`, error.message);
                
                // If we hit rate limits, wait longer
                if (error.status === 429) {
                    debugLog('Rate limited, waiting 2 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        if (foundData) {
            gscDataMap.set(node.url, foundData);
            return foundData;
        }
        
        // No data found for any variation
        const noData = { 
            clicks: 0, 
            impressions: 0, 
            ctr: 0, 
            position: 0, 
            noDataFound: true, 
            fetchedAt: Date.now(),
            triedVariations: urlVariations.length
        };
        
        gscDataMap.set(node.url, noData);
        debugLog(`No GSC data found after trying ${urlVariations.length} variations`);
        return noData;
    }

    // Get enhanced data for a successful URL
    async function getEnhancedDataForUrl(variation, thirtyDaysAgo, ninetyDaysAgo, today) {
        try {
            // 1. Get page performance summary
            const pageResponse = await robustGSCApiCall(async () => {
                return await gapi.client.request({
                    path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                    method: 'POST',
                    body: {
                        startDate: thirtyDaysAgo.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0],
                        dimensions: ['page'],
                        dimensionFilterGroups: [{
                            filters: [{
                                dimension: 'page',
                                operator: 'equals',
                                expression: variation
                            }]
                        }],
                        rowLimit: 1
                    }
                });
            });

            // 2. Get top queries for this page
            const queriesResponse = await robustGSCApiCall(async () => {
                return await gapi.client.request({
                    path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                    method: 'POST',
                    body: {
                        startDate: thirtyDaysAgo.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0],
                        dimensions: ['query'],
                        dimensionFilterGroups: [{
                            filters: [{
                                dimension: 'page',
                                operator: 'equals',
                                expression: variation
                            }]
                        }],
                        rowLimit: 10
                    }
                });
            });

            // 3. Get opportunity queries (high impressions, low CTR)
            const opportunityResponse = await robustGSCApiCall(async () => {
                return await gapi.client.request({
                    path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                    method: 'POST',
                    body: {
                        startDate: ninetyDaysAgo.toISOString().split('T')[0],
                        endDate: today.toISOString().split('T')[0],
                        dimensions: ['query'],
                        dimensionFilterGroups: [{
                            filters: [{
                                dimension: 'page',
                                operator: 'equals',
                                expression: variation
                            }]
                        }],
                        rowLimit: 25
                    }
                });
            });

            // 4. Get trend data (compare periods)
            const previousPeriodResponse = await robustGSCApiCall(async () => {
                return await gapi.client.request({
                    path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                    method: 'POST',
                    body: {
                        startDate: new Date(today.getTime() - (60 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
                        endDate: thirtyDaysAgo.toISOString().split('T')[0],
                        dimensions: ['page'],
                        dimensionFilterGroups: [{
                            filters: [{
                                dimension: 'page',
                                operator: 'equals',
                                expression: variation
                            }]
                        }],
                        rowLimit: 1
                    }
                });
            });

            const row = pageResponse.result.rows[0];
            const queries = queriesResponse.result.rows || [];
            const opportunityQueries = opportunityResponse.result.rows || [];
            const previousPeriod = previousPeriodResponse.result.rows?.[0];

            // Analyze opportunities
            const opportunities = opportunityQueries
                .filter(q => q.impressions > 10 && q.ctr < 0.05)
                .sort((a, b) => (b.impressions * (1 - b.ctr)) - (a.impressions * (1 - a.ctr)))
                .slice(0, 5);

            // Calculate trends
            const trend = previousPeriod ? {
                clicksChange: ((row.clicks - previousPeriod.clicks) / previousPeriod.clicks * 100).toFixed(1),
                impressionsChange: ((row.impressions - previousPeriod.impressions) / previousPeriod.impressions * 100).toFixed(1),
                positionChange: (previousPeriod.position - row.position).toFixed(1)
            } : null;

            const gscData = {
                // Basic metrics
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0,
                url: variation,
                fetchedAt: Date.now(),
                
                // Enhanced data for content writers
                topQueries: queries.slice(0, 5).map(q => ({
                    query: q.keys[0],
                    clicks: q.clicks,
                    impressions: q.impressions,
                    ctr: q.ctr,
                    position: q.position,
                    opportunity: q.impressions > 50 && q.position > 10 ? 'rank-opportunity' :
                               q.impressions > 20 && q.ctr < 0.03 ? 'ctr-opportunity' : null
                })),
                
                opportunities: opportunities.map(q => ({
                    query: q.keys[0],
                    impressions: q.impressions,
                    clicks: q.clicks,
                    ctr: q.ctr,
                    position: q.position,
                    potentialClicks: Math.round(q.impressions * 0.05)
                })),
                
                trend: trend,
                
                // Content insights
                insights: generateContentInsights(queries, opportunities, row)
            };
            
            return gscData;
        } catch (error) {
            console.error('Error fetching enhanced GSC data:', error);
            return null;
        }
    }

    // Generate content insights based on GSC data
    function generateContentInsights(queries, opportunities, pageData) {
        const insights = [];
        
        // Performance insights
        if (pageData.position <= 3 && pageData.ctr < 0.1) {
            insights.push({
                type: 'warning',
                title: 'Low CTR for Top Position',
                description: 'Page ranks well but has low click-through rate. Consider improving title and meta description.',
                priority: 'high'
            });
        }
        
        if (pageData.position > 10 && pageData.impressions > 100) {
            insights.push({
                type: 'opportunity',
                title: 'Ranking Opportunity',
                description: 'Page has good visibility but ranks on page 2+. Target content optimization.',
                priority: 'medium'
            });
        }
        
        // Query insights
        if (opportunities.length > 2) {
            insights.push({
                type: 'opportunity',
                title: 'Keyword Opportunities',
                description: `${opportunities.length} queries with optimization potential found.`,
                priority: 'medium'
            });
        }
        
        // Content freshness
        const topQueryPosition = queries[0]?.position || 0;
        if (topQueryPosition > 5 && topQueryPosition < 15) {
            insights.push({
                type: 'info',
                title: 'Content Update Opportunity',
                description: 'Consider refreshing content to improve rankings for top queries.',
                priority: 'low'
            });
        }
        
        return insights;
    }

    // Batch loading for hover queue
    function queueNodeForGSC(node) {
        if (!node || !node.url || gscDataMap.has(node.url)) return;
        
        hoverQueue.add(node);
        
        if (batchTimeout) clearTimeout(batchTimeout);
        batchTimeout = setTimeout(processBatch, 300);
    }

    async function processBatch() {
        if (hoverQueue.size === 0) return;
        
        const nodes = Array.from(hoverQueue);
        hoverQueue.clear();
        
        debugLog(`Processing batch of ${nodes.length} nodes`);
        
        const batchSize = 2;
        for (let i = 0; i < nodes.length; i += batchSize) {
            const batch = nodes.slice(i, i + batchSize);
            const promises = batch.map(node => fetchNodeGSCData(node));
            await Promise.all(promises);
            
            if (i + batchSize < nodes.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    // Preload important nodes
    async function preloadImportantNodes() {
        const importantNodes = getImportantNodes();
        debugLog(`Preloading GSC data for ${importantNodes.length} important nodes`);
        
        const batchSize = 3;
        for (let i = 0; i < importantNodes.length; i += batchSize) {
            const batch = importantNodes.slice(i, i + batchSize);
            const promises = batch.map(node => fetchNodeGSCData(node));
            await Promise.all(promises);
            
            if (i + batchSize < importantNodes.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        debugLog('Preloading complete');
    }

    function getImportantNodes() {
        const important = [];
        
        function traverse(node, depth = 0) {
            if (node.url && depth <= 2) {
                important.push(node);
            }
            if (node.children && depth < 2) {
                node.children.forEach(child => traverse(child, depth + 1));
            }
        }
        
        if (window.treeData) {
            traverse(window.treeData);
        }
        
        return important;
    }

    // Load GSC data for all visible nodes
    async function loadVisibleNodesGSCData() {
        if (!gscConnected || !gscDataLoaded) {
            debugLog('GSC not connected or not ready');
            return;
        }
        
        const visibleNodes = getVisibleNodes();
        debugLog(`Loading GSC data for ${visibleNodes.length} visible nodes`);
        
        const batchSize = 5;
        for (let i = 0; i < visibleNodes.length; i += batchSize) {
            const batch = visibleNodes.slice(i, i + batchSize);
            const promises = batch.map(node => fetchNodeGSCData(node));
            await Promise.all(promises);
            
            if (i + batchSize < visibleNodes.length) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }
        
        debugLog('Visible nodes loading complete');
    }

    function getVisibleNodes() {
        const visible = [];
        
        if (window.allNodes) {
            window.allNodes.forEach(d => {
                if (d.data && d.data.url && isNodeVisible(d)) {
                    visible.push(d.data);
                }
            });
        }
        
        return visible;
    }

    function isNodeVisible(d) {
        let current = d;
        while (current.parent) {
            if (current.parent._children) {
                return false;
            }
            current = current.parent;
        }
        return true;
    }

    // Cache cleanup
    function setupCacheCleanup() {
        cacheCleanupInterval = setInterval(cleanupGSCCache, 10 * 60 * 1000);
    }

    function cleanupGSCCache() {
        const maxAge = 30 * 60 * 1000;
        const now = Date.now();
        let cleaned = 0;
        
        for (const [url, data] of gscDataMap.entries()) {
            if (data && data.fetchedAt && (now - data.fetchedAt) > maxAge) {
                gscDataMap.delete(url);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            debugLog(`Cleaned up ${cleaned} old cache entries`);
        }
    }

    // Setup health monitoring
    function setupHealthMonitoring() {
        healthCheckInterval = setInterval(async () => {
            if (!gscConnected) return;
            
            const health = await checkGSCConnectionHealth();
            if (!health.healthy) {
                debugLog('GSC connection unhealthy:', health.reason);
                
                if (health.shouldReconnect) {
                    debugLog('Attempting auto-recovery...');
                    try {
                        await refreshToken();
                        debugLog('Auto-recovery successful');
                    } catch (error) {
                        debugLog('Auto-recovery failed:', error.message);
                        // Could trigger user notification here
                    }
                }
            }
        }, 5 * 60 * 1000); // Check every 5 minutes
    }

    // Reset GSC data
    function resetGSCData() {
        gscDataMap.clear();
        pendingRequests.clear();
        hoverQueue.clear();
        gscDataLoaded = false;
        fetchInProgress = false;
        gscSiteUrl = null;
        
        if (batchTimeout) {
            clearTimeout(batchTimeout);
            batchTimeout = null;
        }
        
        if (cacheCleanupInterval) {
            clearInterval(cacheCleanupInterval);
            cacheCleanupInterval = null;
        }
        
        if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
        }
        
        debugLog('GSC data reset');
    }

    // Update connection status
    function updateConnectionStatus(connected) {
        gscConnected = connected;
        const gscBtn = document.getElementById('gscConnectBtn');
        const gscIcon = document.getElementById('gscIcon');
        const gscText = document.getElementById('gscText');
        
        if (gscBtn) {
            if (connected) {
                // Add connecting animation first
                gscBtn.classList.add('connecting');
                setTimeout(() => gscBtn.classList.remove('connecting'), 600);
                
                // Then add connected state
                setTimeout(() => {
                    gscBtn.classList.add('connected');
                    gscBtn.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%) !important';
                    gscBtn.style.color = 'white !important';
                    gscBtn.style.borderColor = '#4caf50 !important';
                    
                    if (gscText) gscText.textContent = 'GSC Connected';
                }, 300);
                
            } else {
                gscBtn.classList.remove('connected', 'connecting');
                gscBtn.style.background = '#ffffff !important';
                gscBtn.style.color = '#3c4043 !important';
                gscBtn.style.borderColor = '#dadce0 !important';
                gscBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                
                if (gscText) gscText.textContent = 'Connect GSC';
            }
        }
        
        debugLog('Connection status updated with animations:', connected);
        
        if (!connected) {
            resetGSCData();
        }
    }

    // Remove loading state
    function hideGSCLoadingState() {
        const gscBtn = document.getElementById('gscConnectBtn');
        const gscText = document.getElementById('gscText');
        
        if (gscBtn && gscText) {
            gscBtn.style.pointerEvents = 'auto';
            // Text will be updated by updateConnectionStatus
        }
    }

    function showGSCLoadingState() {
        const gscBtn = document.getElementById('gscConnectBtn');
        const gscText = document.getElementById('gscText');
        
        if (gscBtn && gscText) {
            gscText.innerHTML = 'Connecting<span class="gsc-loading-dots"><span></span><span></span><span></span></span>';
            gscBtn.style.pointerEvents = 'none';
        }
    }

    // Add GSC button to navigation
    function addGSCButton() {
        const checkAndAdd = () => {
            debugLog('Checking for navigation bar...');
            
            const navBar = document.querySelector('.nav-group') || 
                          document.querySelector('.nav-bar') || 
                          document.querySelector('nav') ||
                          document.querySelector('[class*="nav"]') ||
                          document.querySelector('[class*="toolbar"]') ||
                          document.querySelector('[class*="header"]');
            
            if (!navBar) {
                debugLog('Navigation bar not found, retrying...');
                setTimeout(checkAndAdd, 100);
                return;
            }
            
            debugLog('Navigation bar found:', navBar);
            
            if (document.getElementById('gscConnectBtn')) {
                debugLog('GSC button already exists');
                return;
            }
            
            const gscButton = document.createElement('button');
            gscButton.className = 'nav-btn nav-gsc-btn';
            gscButton.id = 'gscConnectBtn';
            gscButton.onclick = toggleGSCConnection;
            
            // RECOMMENDED: Official Google "G" Logo with transparent SVG
            gscButton.innerHTML = `
                <svg id="gscIcon" width="18" height="18" viewBox="0 0 24 24" style="flex-shrink: 0;">
                    <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span id="gscText">Connect to Search Console</span>
            `;
            
            gscButton.style.cssText = `
                display: flex !important;
                align-items: center;
                gap: 8px;
                padding: 8px 16px !important;
                margin: 0 8px !important;
                background: #ffffff !important;
                border: 1px solid #dadce0 !important;
                border-radius: 8px !important;
                cursor: pointer;
                font-size: 14px !important;
                color: #3c4043 !important;
                transition: all 0.2s ease;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                z-index: 9999 !important;
                font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-weight: 500;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            `;
            
            const reportsDropdown = document.getElementById('reportsDropdown');
            const firstButton = navBar.querySelector('button');
            
            if (reportsDropdown) {
                navBar.insertBefore(gscButton, reportsDropdown);
                debugLog('GSC button inserted before reports dropdown');
            } else if (firstButton) {
                navBar.insertBefore(gscButton, firstButton.nextSibling);
                debugLog('GSC button inserted after first button');
            } else {
                navBar.appendChild(gscButton);
                debugLog('GSC button appended to navigation bar');
            }
        };
        
        checkAndAdd();
    }

    // Additional helper functions
    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function calculateSimplePerformanceScore(gscData) {
        let score = 0;
        
        // CTR component (0-40 points)
        const ctrScore = Math.min((gscData.ctr * 100) / 5 * 40, 40);
        score += ctrScore;
        
        // Position component (0-30 points)
        const positionScore = Math.max(30 - (gscData.position / 20 * 30), 0);
        score += positionScore;
        
        // Click volume component (0-20 points)
        const clickScore = Math.min(gscData.clicks / 100 * 20, 20);
        score += clickScore;
        
        // Growth component (0-10 points)
        if (gscData.trend && gscData.trend.clicksChange > 0) {
            score += Math.min(gscData.trend.clicksChange / 10, 10);
        }
        
        return Math.round(score);
    }

    function getScoreColor(score) {
        if (score >= 75) return '#4caf50';
        if (score >= 50) return '#1a73e8';
        if (score >= 25) return '#ff9800';
        return '#f44336';
    }

    // ===========================================
    // SIMPLIFIED TOOLTIP SYSTEM
    // ===========================================

    function hookIntoTooltips() {
        const checkAndHook = () => {
            if (window.showEnhancedTooltip) {
                const originalShow = window.showEnhancedTooltip;
                const originalHide = window.hideEnhancedTooltip;
                
                // Override show function
                window.showEnhancedTooltip = function(event, d) {
                    // Clear any pending operations
                    clearTimeout(hideTimer);
                    clearTimeout(showTimer);
                    
                    // Small delay to prevent rapid fire
                    showTimer = setTimeout(() => {
                        showSimplifiedTooltip(event, d);
                    }, 100);
                };
                
                // Override hide function  
                window.hideEnhancedTooltip = function() {
                    clearTimeout(showTimer);
                    hideTimer = setTimeout(() => {
                        hideCurrentTooltip();
                    }, 200);
                };
                
                debugLog('Simplified tooltip system hooked');
            } else {
                setTimeout(checkAndHook, 100);
            }
        };
        checkAndHook();
    }
    
    function showSimplifiedTooltip(event, d) {
        if (!d.data) return;
        
        // Hide any existing tooltip first
        hideCurrentTooltip();
        
        // Create basic tooltip structure
        const tooltip = createBasicTooltip(d.data);
        
        // Store the node data on the tooltip for GSC enhancement access
        tooltip._nodeData = d.data;
        
        // Position tooltip
        positionTooltip(tooltip, event);
        
        // Show tooltip
        document.body.appendChild(tooltip);
        currentTooltip = tooltip;
        
        // Add hover protection (simplified)
        tooltip.addEventListener('mouseenter', () => {
            clearTimeout(hideTimer);
        });
        
        tooltip.addEventListener('mouseleave', () => {
            window.hideEnhancedTooltip();
        });
        
        // Trigger GSC data loading (non-blocking)
        if (gscConnected && d.data.url && !gscDataMap.has(d.data.url)) {
            loadGSCDataAsync(d.data, tooltip);
        }
    }
    
    function hideCurrentTooltip() {
        if (currentTooltip) {
            currentTooltip.style.opacity = '0';
            setTimeout(() => {
                if (currentTooltip) {
                    currentTooltip.remove();
                    currentTooltip = null;
                }
            }, 200);
        }
    }
    
    function createBasicTooltip(data) {
        const tooltip = document.createElement('div');
        tooltip.className = 'enhanced-tooltip simplified-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.4;
        `;
        
        // Build basic content
        let html = createBasicContent(data);
        
        // Add sleek loading progress if connected
        if (gscConnected && data.url) {
            html += createSleekLoadingProgress();
        }
        
        tooltip.innerHTML = html;
        
        // Trigger fade in
        setTimeout(() => {
            tooltip.style.opacity = '1';
        }, 10);
        
        return tooltip;
    }

    function createSleekLoadingProgress() {
        return `
            <div id="gsc-loading-container" style="margin-top: 12px;">
                <div style="background: linear-gradient(135deg, #f8f9ff 0%, #e8f1fe 100%); padding: 16px; border-radius: 8px; border: 1px solid #e3f2fd;">
                    
                    <!-- Loading header -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="gsc-loading-spinner" style="
                                width: 16px; 
                                height: 16px; 
                                border: 2px solid #e3f2fd; 
                                border-top: 2px solid #4a90e2; 
                                border-radius: 50%; 
                                animation: gsc-spin 1s linear infinite;
                            "></div>
                            <span style="font-weight: 600; color: #1f4788; font-size: 0.9rem;">Loading Performance Data</span>
                        </div>
                        <span id="gsc-progress-percentage" style="font-size: 0.8rem; color: #666; font-weight: 500;">0%</span>
                    </div>
                    
                    <!-- Progress bar container -->
                    <div style="background: #f0f4ff; border-radius: 10px; height: 8px; overflow: hidden; margin-bottom: 12px; position: relative;">
                        <div id="gsc-progress-bar" style="
                            height: 100%;
                            width: 0%;
                            background: linear-gradient(90deg, #4a90e2 0%, #1f4788 50%, #4a90e2 100%);
                            background-size: 200% 100%;
                            border-radius: 10px;
                            transition: width 0.3s ease;
                            animation: gsc-shimmer 2s ease-in-out infinite;
                            position: relative;
                        "></div>
                        
                        <!-- Shimmer overlay -->
                        <div style="
                            position: absolute;
                            top: 0;
                            left: -100%;
                            width: 100%;
                            height: 100%;
                            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                            animation: gsc-shimmer-slide 1.5s ease-in-out infinite;
                        "></div>
                    </div>
                    
                    <!-- Loading steps -->
                    <div id="gsc-loading-steps" style="font-size: 0.75rem; color: #666;">
                        <div id="gsc-step-1" class="gsc-step active" style="margin-bottom: 4px; opacity: 0.7;">
                            🔍 Connecting to Search Console...
                        </div>
                        <div id="gsc-step-2" class="gsc-step" style="margin-bottom: 4px; opacity: 0.4;">
                            📊 Analyzing page performance...
                        </div>
                        <div id="gsc-step-3" class="gsc-step" style="margin-bottom: 4px; opacity: 0.4;">
                            🎯 Finding top keywords...
                        </div>
                        <div id="gsc-step-4" class="gsc-step" style="opacity: 0.4;">
                            ⚡ Identifying opportunities...
                        </div>
                    </div>
                    
                </div>
            </div>
        `;
    }

    function getFreshnessInfo(lastModified) {
        if (!lastModified) return null;
        
        const now = new Date();
        const lastMod = new Date(lastModified);
        const daysSince = Math.floor((now - lastMod) / (1000 * 60 * 60 * 24));
        
        let freshnessClass, freshnessLabel, freshnessColor;
        
        // Match desktop thresholds exactly
        if (daysSince < 30) {
            freshnessClass = 'new';        // Green - New
            freshnessLabel = 'New';
            freshnessColor = '#4caf50';
        } else if (daysSince < 90) {
            freshnessClass = 'fresh';      // Green - Fresh (1-3 months)
            freshnessLabel = 'Fresh';
            freshnessColor = '#4caf50';
        } else if (daysSince < 180) {
            freshnessClass = 'recent';     // Yellow - Recent (3-6 months)
            freshnessLabel = 'Recent';
            freshnessColor = '#ffc107';
        } else if (daysSince < 365) {
            freshnessClass = 'aging';      // Orange - Aging (6-12 months)
            freshnessLabel = 'Aging';
            freshnessColor = '#ff9800';
        } else if (daysSince < 730) {
            freshnessClass = 'old';        // Red - Old (1-2 years)
            freshnessLabel = 'Old';
            freshnessColor = '#f44336';
        } else {
            freshnessClass = 'stale';     // Dark Red - Stale (2+ years)
            freshnessLabel = 'Stale';
            freshnessColor = '#d32f2f';
        }
        
        // Format the actual date nicely
        const formattedDate = lastMod.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        // Create relative time string
        const relativeTime = daysSince === 0 ? 'today' :
                           daysSince === 1 ? 'yesterday' :
                           daysSince < 7 ? `${daysSince} days ago` :
                           daysSince < 30 ? `${Math.floor(daysSince / 7)} weeks ago` :
                           daysSince < 365 ? `${Math.floor(daysSince / 30)} months ago` :
                           `${Math.floor(daysSince / 365)} years ago`;
        
        return {
            daysSince,
            freshnessClass,
            freshnessLabel,
            freshnessColor,
            formattedDate,
            relativeTime
        };
    }
    
    function createBasicContent(data) {
        let freshnessInfo = '';
        let lastModifiedDisplay = '';
        
        const freshnessData = getFreshnessInfo(data.lastModified);
        
        if (freshnessData) {
            // Create freshness badge with exact color matching
            freshnessInfo = `<span style="background: ${freshnessData.freshnessColor}20; color: ${freshnessData.freshnessColor}; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 500;">${freshnessData.freshnessLabel}</span>`;
            
            // Last modified display
            lastModifiedDisplay = `
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 6px 0; border-top: 1px solid #f0f0f0;">
                    <span style="font-size: 0.7rem; color: #666;">📅 Updated:</span>
                    <span style="font-size: 0.75rem; color: #333; font-weight: 500;">${freshnessData.formattedDate}</span>
                    <span style="font-size: 0.7rem; color: #999;">(${freshnessData.relativeTime})</span>
                </div>
            `;
        }
        
        // Get page info
        const treeContext = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
        const pageInfo = getPageInfo(data, treeContext);
        
        // Create page info display
        const pageInfoDisplay = `
            <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin-top: 8px; border-left: 3px solid #6c757d;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.7rem;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="color: #666;">🏷️ Type:</span>
                        <span style="font-weight: 500; color: #333;">${pageInfo.type}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="color: #666;">📏 Depth:</span>
                        <span style="font-weight: 500; color: #333;">Level ${pageInfo.depth}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="color: #666;">👶 Children:</span>
                        <span style="font-weight: 500; color: ${pageInfo.children > 0 ? '#28a745' : '#6c757d'};">${pageInfo.children}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="color: #666;">👫 Siblings:</span>
                        <span style="font-weight: 500; color: ${pageInfo.siblings > 0 ? '#007bff' : '#6c757d'};">${pageInfo.siblings}</span>
                    </div>
                </div>
            </div>
        `;
        
        return `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; gap: 10px;">
                    <h4 style="margin: 0; color: #1f4788; font-size: 1rem; font-weight: 600; flex: 1;">${data.name}</h4>
                    ${freshnessInfo}
                </div>
                ${data.url ? `<a href="${data.url}" target="_blank" style="font-size: 0.75rem; color: #4a90e2; text-decoration: none; word-break: break-all; margin-bottom: 8px; display: block; border-bottom: 1px dotted #4a90e2;" 
                    onmouseover="this.style.textDecoration='underline'" 
                    onmouseout="this.style.textDecoration='none'">${data.url}</a>` : ''}
                ${lastModifiedDisplay}
                ${pageInfoDisplay}
            </div>
        `;
    }
    
    function positionTooltip(tooltip, event) {
        // Simple positioning - no complex edge detection
        let left = event.pageX + 10;
        let top = event.pageY - 10;
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        
        // Simple boundary check after render
        setTimeout(() => {
            const rect = tooltip.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            if (rect.right > windowWidth - 20) {
                tooltip.style.left = (event.pageX - rect.width - 10) + 'px';
            }
            
            if (rect.bottom > windowHeight - 20) {
                tooltip.style.top = (event.pageY - rect.height - 10) + 'px';
            }
        }, 50);
    }
    
    // Async GSC data loading (non-blocking)
    async function loadGSCDataAsync(data, tooltip) {
        if (!tooltip || !data.url) return;
        
        const progressContainer = tooltip.querySelector('#gsc-loading-container');
        if (!progressContainer) return;
        
        const progressBar = tooltip.querySelector('#gsc-progress-bar');
        const progressText = tooltip.querySelector('#gsc-progress-percentage');
        const steps = tooltip.querySelectorAll('.gsc-step');
        
        try {
            // Simulate realistic loading progress
            const progressStages = [
                { progress: 15, step: 0, delay: 200 },
                { progress: 35, step: 1, delay: 300 },
                { progress: 65, step: 2, delay: 400 },
                { progress: 85, step: 3, delay: 300 }
            ];
            
            // Animate through progress stages
            for (let i = 0; i < progressStages.length; i++) {
                const stage = progressStages[i];
                
                // Check if tooltip still exists
                if (tooltip !== currentTooltip || !tooltip.parentNode) return;
                
                // Update progress bar
                if (progressBar) {
                    progressBar.style.width = stage.progress + '%';
                }
                
                // Update percentage
                if (progressText) {
                    progressText.textContent = stage.progress + '%';
                }
                
                // Update active step
                steps.forEach((step, index) => {
                    if (index === stage.step) {
                        step.style.opacity = '1';
                        step.style.fontWeight = '600';
                        step.style.color = '#1f4788';
                    } else if (index < stage.step) {
                        step.style.opacity = '0.8';
                        step.style.color = '#28a745';
                        // Add checkmark to completed steps
                        if (!step.textContent.includes('✅')) {
                            step.textContent = step.textContent.replace(/🔍|📊|🎯|⚡/, '✅');
                        }
                    } else {
                        step.style.opacity = '0.4';
                        step.style.color = '#666';
                    }
                });
                
                await new Promise(resolve => setTimeout(resolve, stage.delay));
            }
            
            // Fetch the actual GSC data
            const gscData = await fetchNodeGSCData(data);
            
            // Check if tooltip still exists and is the current one
            if (tooltip === currentTooltip && tooltip.parentNode) {
                // Complete the final step
                if (progressBar) progressBar.style.width = '100%';
                if (progressText) progressText.textContent = '100%';
                
                // Mark final step as complete
                steps.forEach((step, index) => {
                    if (index === 3) { // Final step
                        step.style.opacity = '0.8';
                        step.style.color = '#28a745';
                        if (!step.textContent.includes('✅')) {
                            step.textContent = step.textContent.replace('⚡', '✅');
                        }
                    }
                });
                
                // Brief pause to show completion
                await new Promise(resolve => setTimeout(resolve, 400));
                
                // Replace loading with actual data
                if (tooltip === currentTooltip && tooltip.parentNode) {
                    replaceLoadingWithGSCData(tooltip, gscData, data);
                }
            }
            
        } catch (error) {
            console.warn('GSC data loading failed:', error);
            if (tooltip === currentTooltip && tooltip.parentNode) {
                showLoadingError(tooltip, 'Unable to load performance data');
            }
        }
    }

    function replaceLoadingWithGSCData(tooltip, gscData, originalData) {
        const loadingContainer = tooltip.querySelector('#gsc-loading-container');
        if (!loadingContainer) return;
        
        if (!gscData || gscData.noDataFound) {
            loadingContainer.innerHTML = gscData?.noDataFound ? 
                '<div style="color: #999; font-size: 0.8rem; text-align: center; padding: 20px;">📭 No search data found</div>' : 
                '<div style="color: #999; font-size: 0.8rem; text-align: center; padding: 20px;">❌ Performance data unavailable</div>';
            return;
        }
        
        // Get freshness data with exact matching
        const freshnessData = getFreshnessInfo(originalData.lastModified);
        
        // Get page info
        const treeContext = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
        const pageInfo = getPageInfo(originalData, treeContext);
        
        // Create enhanced GSC content
        const performanceScore = calculateSimplePerformanceScore(gscData);
        const gscHtml = `
            <div style="background: linear-gradient(135deg, #f8f9ff 0%, #e8f1fe 100%); padding: 16px; border-radius: 8px; border: 1px solid #e3f2fd;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 600; color: #1f4788; font-size: 0.95rem;">📊 Search Performance (30d)</div>
                    <div style="background: ${getScoreColor(performanceScore)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">
                        ${performanceScore}/100
                    </div>
                </div>
                
                <!-- Enhanced metrics grid with trends -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px;">
                    <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; position: relative;">
                        <div style="font-size: 1.3rem; font-weight: bold; color: #4a90e2; margin-bottom: 2px;">${formatNumber(gscData.clicks)}</div>
                        <div style="font-size: 0.75rem; color: #666;">Clicks</div>
                        ${gscData.trend && gscData.trend.clicksChange ? `
                            <div style="position: absolute; top: 4px; right: 4px; font-size: 0.6rem; padding: 1px 4px; border-radius: 8px; 
                                        background: ${parseFloat(gscData.trend.clicksChange) >= 0 ? '#4caf5020' : '#f4433620'}; 
                                        color: ${parseFloat(gscData.trend.clicksChange) >= 0 ? '#4caf50' : '#f44336'};">
                                ${parseFloat(gscData.trend.clicksChange) > 0 ? '+' : ''}${gscData.trend.clicksChange}%
                            </div>
                        ` : ''}
                    </div>
                    <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; position: relative;">
                        <div style="font-size: 1.3rem; font-weight: bold; color: #4a90e2; margin-bottom: 2px;">${formatNumber(gscData.impressions)}</div>
                        <div style="font-size: 0.75rem; color: #666;">Impressions</div>
                        ${gscData.trend && gscData.trend.impressionsChange ? `
                            <div style="position: absolute; top: 4px; right: 4px; font-size: 0.6rem; padding: 1px 4px; border-radius: 8px;
                                        background: ${parseFloat(gscData.trend.impressionsChange) >= 0 ? '#4caf5020' : '#f4433620'};
                                        color: ${parseFloat(gscData.trend.impressionsChange) >= 0 ? '#4caf50' : '#f44336'};">
                                ${parseFloat(gscData.trend.impressionsChange) > 0 ? '+' : ''}${gscData.trend.impressionsChange}%
                            </div>
                        ` : ''}
                    </div>
                    <div style="text-align: center; background: white; padding: 8px; border-radius: 6px;">
                        <div style="font-size: 1.3rem; font-weight: bold; color: #4a90e2; margin-bottom: 2px;">${(gscData.ctr * 100).toFixed(1)}%</div>
                        <div style="font-size: 0.75rem; color: #666;">CTR</div>
                    </div>
                    <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; position: relative;">
                        <div style="font-size: 1.3rem; font-weight: bold; color: #4a90e2; margin-bottom: 2px;">#${gscData.position.toFixed(0)}</div>
                        <div style="font-size: 0.75rem; color: #666;">Position</div>
                        ${gscData.trend && gscData.trend.positionChange ? `
                            <div style="position: absolute; top: 4px; right: 4px; font-size: 0.6rem; padding: 1px 4px; border-radius: 8px;
                                        background: ${parseFloat(gscData.trend.positionChange) >= 0 ? '#4caf5020' : '#f4433620'};
                                        color: ${parseFloat(gscData.trend.positionChange) >= 0 ? '#4caf50' : '#f44336'};">
                                ${parseFloat(gscData.trend.positionChange) > 0 ? '+' : ''}${gscData.trend.positionChange}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Top 3 Search Queries Section -->
                ${gscData.topQueries && gscData.topQueries.length > 0 ? `
                    <div style="background: white; padding: 12px; border-radius: 6px; border-top: 2px solid #1f4788; margin-bottom: 8px;">
                        <div style="font-size: 0.8rem; color: #666; margin-bottom: 8px; font-weight: 500;">🎯 Top Search Queries:</div>
                        ${gscData.topQueries.slice(0, 3).map((query, index) => `
                            <div style="margin-bottom: ${index < 2 ? '8px' : '0'}; padding: ${index < 2 ? '0 0 8px 0' : '0'}; 
                                        border-bottom: ${index < 2 ? '1px solid #f0f0f0' : 'none'};">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                                    <span style="background: #1f4788; color: white; width: 16px; height: 16px; border-radius: 50%; 
                                                display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold;">
                                        ${index + 1}
                                    </span>
                                    <div style="font-size: 0.85rem; font-weight: 600; color: #333; flex: 1;">"${escapeHtml(query.query)}"</div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 0.7rem; color: #666; margin-left: 24px;">
                                    <span>${query.clicks} clicks</span>
                                    <span>#${query.position.toFixed(0)} avg</span>
                                    <span>${(query.ctr * 100).toFixed(1)}% CTR</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <!-- Opportunities section (if any) -->
                ${gscData.opportunities && gscData.opportunities.length > 0 ? `
                    <div style="background: #fff8e1; padding: 8px; border-radius: 6px; border-left: 3px solid #ff9800; margin-bottom: 8px;">
                        <div style="font-size: 0.8rem; color: #e65100; font-weight: 600;">⚡ ${gscData.opportunities.length} optimization opportunities found</div>
                    </div>
                ` : ''}
                
                <!-- Action buttons -->
                <div style="display: flex; gap: 8px; justify-content: space-between; margin-top: 12px;">
                    <button onclick="window.open('${escapeHtml(gscData.url)}', '_blank')" 
                            style="background: #4caf50; color: white; border: none; padding: 6px 12px; border-radius: 4px; 
                                   font-size: 0.8rem; cursor: pointer; flex: 1; transition: background 0.2s;"
                            onmouseover="this.style.background='#45a049'" 
                            onmouseout="this.style.background='#4caf50'">
                        🔗 Visit Page
                    </button>
                    <button onclick="window.showDetailedGSCAnalysis && window.showDetailedGSCAnalysis('${gscData.url}')" 
                            style="background: #1f4788; color: white; border: none; padding: 6px 12px; border-radius: 4px; 
                                   font-size: 0.8rem; cursor: pointer; flex: 1; transition: background 0.2s;"
                            onmouseover="this.style.background='#1557b0'" 
                            onmouseout="this.style.background='#1f4788'">
                        📈 Full Analysis
                    </button>
                </div>
            </div>
        `;
        
        // Add smooth transition effect
        loadingContainer.style.transition = 'opacity 0.3s ease';
        loadingContainer.style.opacity = '0';
        
        setTimeout(() => {
            loadingContainer.outerHTML = gscHtml;
        }, 300);
    }

    // Show loading error state
    function showLoadingError(tooltip, message) {
        const progressContainer = tooltip.querySelector('#gsc-loading-container');
        if (!progressContainer) return;
        
        progressContainer.innerHTML = `
            <div style="background: #fff5f5; padding: 12px; border-radius: 6px; border-left: 3px solid #f56565; text-align: center;">
                <div style="color: #e53e3e; font-size: 0.85rem; margin-bottom: 4px;">❌ Loading Failed</div>
                <div style="color: #666; font-size: 0.75rem;">${message}</div>
            </div>
        `;
    }

    // Helper functions to extract page information from tree structure
    function getPageInfo(nodeData, treeContext = null) {
        const info = {
            type: 'Unknown',
            depth: 0,
            children: 0,
            siblings: 0
        };
        
        if (!nodeData) return info;
        
        // Calculate children count
        info.children = nodeData.children ? nodeData.children.length : 0;
        
        // Get tree context info
        let treeInfo = null;
        if (treeContext) {
            treeInfo = findNodeInTree(treeContext, nodeData.url);
            if (treeInfo.node) {
                info.depth = treeInfo.depth;
                info.siblings = treeInfo.siblings;
            }
        }
        
        // Fallback depth calculation if tree context failed
        if (info.depth === 0 && !treeInfo) {
            info.depth = calculatePageDepth(nodeData.url);
        }
        
        // Simple tree-position-based type detection
        info.type = determinePageType(nodeData.url, nodeData.name, nodeData, treeContext);
        
        return info;
    }

    function determinePageType(url, name, nodeData = null, treeContext = null) {
        if (!url) return 'Unknown';
        
        const urlLower = url.toLowerCase();
        
        // Check if it's the root homepage
        if (urlLower === '/' || urlLower.match(/^https?:\/\/[^\/]+\/?$/)) {
            return 'Homepage';
        }
        
        // Check if it's a language root (ends in /en/ or /ga/)
        if (urlLower.match(/\/(en|ga)\/?$/)) {
            return 'Language Root';
        }
        
        // Get tree depth and children info
        let depth = 0;
        let hasChildren = false;
        
        if (nodeData && nodeData.children) {
            hasChildren = nodeData.children.length > 0;
        }
        
        // Try to get accurate depth from tree context
        if (treeContext) {
            const nodeInfo = findNodeInTree(treeContext, url);
            if (nodeInfo && nodeInfo.depth !== undefined) {
                depth = nodeInfo.depth;
            }
        }
        
        // Fallback: calculate depth from URL
        if (depth === 0 && url !== '/') {
            depth = calculatePageDepth(url);
        }
        
        // Check if this page is under a language root
        const isUnderLanguageRoot = urlLower.match(/\/(en|ga)\//);
        
        // Adjust effective depth for pages under language roots
        let effectiveDepth = depth;
        if (isUnderLanguageRoot && depth > 1) {
            effectiveDepth = depth - 1; // Subtract 1 because language adds an extra level
        }
        
        // Determine type based on effective tree position
        if (effectiveDepth === 0) {
            return 'Homepage';
        } else if (effectiveDepth === 1) {
            return hasChildren ? 'Category' : 'Root Content';
        } else if (effectiveDepth === 2) {
            return hasChildren ? 'Sub-Category' : 'Content Page';
        } else if (effectiveDepth === 3) {
            return hasChildren ? 'Sub-Sub-Category' : 'Content Page';
        } else if (effectiveDepth >= 4) {
            return hasChildren ? 'Deep Category' : 'Content Page';
        }
        
        // Default fallback
        return hasChildren ? 'Category' : 'Content Page';
    }

    function calculatePageDepth(url) {
        if (!url) return 0;
        
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
            return pathSegments.length;
        } catch (e) {
            // Fallback for relative URLs
            const segments = url.split('/').filter(segment => segment.length > 0);
            return segments.length;
        }
    }

    function findNodeInTree(treeData, targetUrl) {
        const result = {
            node: null,
            depth: 0,
            siblings: 0,
            hasChildren: false
        };
        
        function traverse(node, depth = 0, parent = null) {
            if (node.url === targetUrl) {
                result.node = node;
                result.depth = depth;
                result.siblings = parent && parent.children ? parent.children.length - 1 : 0;
                result.hasChildren = node.children && node.children.length > 0;
                return true;
            }
            
            if (node.children) {
                for (const child of node.children) {
                    if (traverse(child, depth + 1, node)) {
                        return true;
                    }
                }
            }
            
            return false;
        }
        
        if (treeData) {
            traverse(treeData);
        }
        
        return result;
    }

    // ===========================================
    // GSC STYLES AND UI FUNCTIONS
    // ===========================================

    function addGSCStyles() {
        if (document.getElementById('gsc-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'gsc-styles';
        style.textContent = `
            /* Import Google Sans font */
            @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600&display=swap');
            
            /* GSC Integration Styles with Animations */
            .nav-gsc-btn {
                display: flex !important;
                align-items: center;
                gap: 8px;
                padding: 8px 16px !important;
                margin: 0 8px !important;
                background: #ffffff !important;
                border: 1px solid #dadce0 !important;
                border-radius: 8px !important;
                cursor: pointer;
                font-size: 14px !important;
                color: #3c4043 !important;
                transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                z-index: 9999 !important;
                font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-weight: 500;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                min-height: 36px;
                overflow: hidden;
            }
            
            .nav-gsc-btn:hover {
                background: #f8f9fa !important;
                border-color: #4285f4 !important;
                box-shadow: 0 2px 8px rgba(66, 133, 244, 0.15) !important;
                transform: translateY(-1px);
            }
            
            /* CONNECTED STATE WITH ANIMATIONS */
            .nav-gsc-btn.connected {
                background: linear-gradient(135deg, #4caf50 0%, #45a049 100%) !important;
                color: white !important;
                border-color: #4caf50 !important;
                box-shadow: 0 2px 8px rgba(76,175,80,0.3);
                animation: gsc-connected-pulse 3s ease-in-out infinite;
            }
            
            .nav-gsc-btn.connected:hover {
                background: linear-gradient(135deg, #45a049 0%, #388e3c 100%) !important;
                box-shadow: 0 3px 12px rgba(76,175,80,0.4) !important;
                transform: translateY(-2px);
                animation: gsc-connected-pulse 2s ease-in-out infinite;
            }

            /* Connected pulse animation */
            @keyframes gsc-connected-pulse {
                0%, 100% { 
                    box-shadow: 0 2px 8px rgba(76,175,80,0.3), 0 0 0 0 rgba(76,175,80,0.4);
                }
                50% { 
                    box-shadow: 0 2px 8px rgba(76,175,80,0.3), 0 0 0 4px rgba(76,175,80,0.1);
                }
            }

            /* Data flow animation for connected state */
            .nav-gsc-btn.connected::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                animation: gsc-data-flow 2.5s ease-in-out infinite;
            }

            @keyframes gsc-data-flow {
                0% { left: -100%; }
                50% { left: 100%; }
                100% { left: 100%; }
            }

            /* Icon animations */
            #gscIcon {
                transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
                flex-shrink: 0;
            }

            .nav-gsc-btn.connected #gscIcon {
                filter: drop-shadow(0 0 3px rgba(255,255,255,0.6));
                animation: gsc-icon-glow 2s ease-in-out infinite alternate;
            }

            @keyframes gsc-icon-glow {
                0% { filter: drop-shadow(0 0 3px rgba(255,255,255,0.6)); }
                100% { filter: drop-shadow(0 0 6px rgba(255,255,255,0.8)); }
            }

            /* Text animation */
            #gscText {
                font-weight: 500;
                white-space: nowrap;
                letter-spacing: 0.25px;
                transition: all 0.3s ease;
            }

            .nav-gsc-btn.connected #gscText {
                text-shadow: 0 0 8px rgba(255,255,255,0.3);
            }

            /* Success animation when first connected */
            .nav-gsc-btn.connecting {
                animation: gsc-connecting 0.6s ease-out;
            }

            @keyframes gsc-connecting {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }

            /* Loading dots animation */
            .gsc-loading-dots {
                display: inline-flex;
                gap: 2px;
                margin-left: 4px;
            }

            .gsc-loading-dots span {
                width: 3px;
                height: 3px;
                border-radius: 50%;
                background: currentColor;
                opacity: 0.4;
                animation: gsc-loading-dot 1.4s ease-in-out infinite;
            }

            .gsc-loading-dots span:nth-child(1) { animation-delay: 0s; }
            .gsc-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
            .gsc-loading-dots span:nth-child(3) { animation-delay: 0.4s; }

            @keyframes gsc-loading-dot {
                0%, 80%, 100% { opacity: 0.4; transform: scale(1); }
                40% { opacity: 1; transform: scale(1.2); }
            }

            /* Ripple effect on click */
            .nav-gsc-btn:active {
                transform: translateY(0);
                box-shadow: 0 1px 4px rgba(0,0,0,0.2) !important;
            }

            .nav-gsc-btn.connected:active {
                animation: gsc-click-ripple 0.3s ease-out;
            }

            @keyframes gsc-click-ripple {
                0% { box-shadow: 0 2px 8px rgba(76,175,80,0.3), 0 0 0 0 rgba(76,175,80,0.6); }
                100% { box-shadow: 0 2px 8px rgba(76,175,80,0.3), 0 0 0 8px rgba(76,175,80,0); }
            }

            /* Focus accessibility */
            .nav-gsc-btn:focus {
                outline: 2px solid #4285f4;
                outline-offset: 2px;
            }

            /* Subtle background animation for connected state */
            .nav-gsc-btn.connected {
                background-size: 200% 200%;
                animation: gsc-connected-pulse 3s ease-in-out infinite, 
                          gsc-gradient-shift 4s ease-in-out infinite;
            }

            @keyframes gsc-gradient-shift {
                0%, 100% { background-position: 0% 0%; }
                50% { background-position: 100% 100%; }
            }

            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
        `;
        document.head.appendChild(style);
        
        debugLog('Enhanced animated GSC styles added to page');
    }

    // Add loading animation styles
    function addLoadingAnimationStyles() {
        if (document.getElementById('gsc-loading-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'gsc-loading-animations';
        style.textContent = `
            @keyframes gsc-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @keyframes gsc-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            
            @keyframes gsc-shimmer-slide {
                0% { left: -100%; }
                50% { left: 100%; }
                100% { left: 100%; }
            }
            
            .gsc-step {
                transition: all 0.3s ease;
            }
            
            .gsc-step.active {
                transform: translateX(2px);
            }
            
            #gsc-progress-bar {
                position: relative;
                overflow: hidden;
            }
            
            #gsc-progress-bar::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
                animation: gsc-progress-shine 2s ease-in-out infinite;
            }
            
            @keyframes gsc-progress-shine {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
            }
            
            /* Pulse effect for loading container */
            #gsc-loading-container {
                animation: gsc-pulse 2s ease-in-out infinite;
            }
            
            @keyframes gsc-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.01); }
            }
            
            /* Smooth transitions */
            #gsc-progress-percentage {
                transition: all 0.3s ease;
            }
            
            /* Mobile responsive adjustments */
            @media (max-width: 480px) {
                #gsc-loading-steps {
                    font-size: 0.7rem;
                }
                
                #gsc-progress-bar {
                    height: 6px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Add simplified tooltip styles
    function addSimplifiedTooltipStyles() {
        if (document.getElementById('simplified-tooltip-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'simplified-tooltip-styles';
        style.textContent = `
            .simplified-tooltip {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .simplified-tooltip h4 {
                margin: 0 0 4px 0;
                font-size: 1rem;
                color: #1f4788;
            }
            
            .simplified-tooltip button:hover {
                background: #1557b0 !important;
                transform: translateY(-1px);
            }
            
            @media (max-width: 768px) {
                .simplified-tooltip {
                    max-width: 320px;
                    font-size: 13px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Hook into sitemap loading
    function hookIntoSitemapLoader() {
        const checkAndHook = () => {
            if (window.parseSitemap) {
                const originalParseSitemap = window.parseSitemap;
                window.parseSitemap = function(xmlString, source) {
                    debugLog('Sitemap parsing started');
                    resetGSCData();
                    originalParseSitemap(xmlString, source);
                    
                    if (typeof treeData !== 'undefined' && treeData && !window.treeData) {
                        window.treeData = treeData;
                        debugLog('Set window.treeData from global treeData');
                    }
                    
                    debugLog('Sitemap parsing completed');
                    gscEvents.emit('sitemapParsed');
                    
                    if (gscConnected) {
                        setTimeout(() => {
                            initializeLazyLoading();
                        }, 500);
                    }
                };
                debugLog('Hooked into sitemap parser');
            } else {
                setTimeout(checkAndHook, 100);
            }
        };
        checkAndHook();
    }

    // Listen for tree ready
    function listenForTreeReady() {
        const checkAndHook = () => {
            if (window.createVisualization) {
                const originalCreateVisualization = window.createVisualization;
                window.createVisualization = function() {
                    debugLog('Creating visualization');
                    originalCreateVisualization.apply(this, arguments);
                    
                    if (typeof treeData !== 'undefined' && treeData && !window.treeData) {
                        window.treeData = treeData;
                        debugLog('Set window.treeData from global treeData in createVisualization');
                    }
                    
                    debugLog('Tree visualization created');
                    gscEvents.emit('treeReady');
                    
                    if (gscConnected) {
                        setTimeout(() => {
                            initializeLazyLoading();
                        }, 500);
                    }
                };
                debugLog('Hooked into createVisualization');
            } else {
                setTimeout(checkAndHook, 100);
            }
        };
        checkAndHook();
    }

    // UI Helper Functions
    function showGSCLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'gscLoadingIndicator';
        indicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            text-align: center;
        `;
        indicator.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 15px;">🔍</div>
            <div style="font-weight: bold; margin-bottom: 10px;">Connecting to Search Console...</div>
            <div style="color: #666; margin-bottom: 15px;">Setting up enhanced content analysis</div>
            <div style="background: #f0f0f0; height: 20px; border-radius: 10px; overflow: hidden;">
                <div id="gscLoadingProgress" style="background: #4caf50; height: 100%; width: 0%; transition: width 0.3s;"></div>
            </div>
        `;
        document.body.appendChild(indicator);
    }

    function hideGSCLoadingIndicator() {
        const indicator = document.getElementById('gscLoadingIndicator');
        if (indicator) indicator.remove();
    }

    function showGSCReadyMessage() {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        message.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">🚀</span>
                <div>
                    <div style="font-weight: bold;">Content Analysis Ready!</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">
                        Enhanced GSC data with keyword insights • <span style="font-weight: 600;">Ctrl+L</span> to load all visible
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.style.transition = 'opacity 0.3s';
            message.style.opacity = '0';
            setTimeout(() => message.remove(), 300);
        }, 6000);
    }

    // Site selector
    async function showSiteSelector(sites) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 10px;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
            `;
            
            content.innerHTML = `
                <h3 style="margin-bottom: 20px;">Select Search Console Property</h3>
                <div style="color: #666; margin-bottom: 20px;">
                    Choose which Search Console property matches your sitemap:
                </div>
            `;
            
            sites.forEach(site => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    display: block;
                    width: 100%;
                    padding: 15px;
                    margin-bottom: 10px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    background: white;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                `;
                btn.innerHTML = `
                    <div style="font-weight: bold;">${site.siteUrl}</div>
                    <div style="font-size: 0.9rem; color: #666;">Permission: ${site.permissionLevel}</div>
                `;
                btn.onmouseover = () => btn.style.background = '#f0f0f0';
                btn.onmouseout = () => btn.style.background = 'white';
                btn.onclick = () => {
                    modal.remove();
                    resolve(site);
                };
                content.appendChild(btn);
            });
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = `
                padding: 10px 20px;
                background: #666;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 10px;
            `;
            cancelBtn.onclick = () => {
                modal.remove();
                resolve(null);
            };
            content.appendChild(cancelBtn);
            
            modal.appendChild(content);
            document.body.appendChild(modal);
        });
    }

    // Show detailed GSC analysis for content writers
    window.showDetailedGSCAnalysis = async function(url) {
    console.log('🚀 Loading Enhanced Dashboard for:', url);
    
    // Get GSC data
    const gscData = window.GSCIntegration?.getData?.(url);
    
    // Get GA4 data
    let ga4Data = null;
    if (window.GA4Integration?.fetchData) {
        try {
            ga4Data = await window.GA4Integration.fetchData(url);
        } catch (error) {
            console.warn('Failed to fetch GA4 data:', error);
        }
    }
    
    // Get trend comparisons
    let gscTrends = null;
    if (window.GSCIntegration?.fetchTrendComparison) {
        try {
            gscTrends = await window.GSCIntegration.fetchTrendComparison({ url, name: 'Page' });
        } catch (error) {
            console.warn('Failed to fetch GSC trends:', error);
        }
    }
    
    let ga4Trends = null;
    if (window.GA4Integration?.fetchTrendComparison) {
        try {
            ga4Trends = await window.GA4Integration.fetchTrendComparison(url);
        } catch (error) {
            console.warn('Failed to fetch GA4 trends:', error);
        }
    }

    // Get enhanced GA4 data (traffic sources, device data)
    let trafficSources = null;
    let deviceData = null;

    console.log('🔍 Fetching enhanced GA4 data for:', url);

    if (window.GA4Integration?.fetchTrafficSources) {
        try {
            console.log('📡 Calling fetchTrafficSources...');
            trafficSources = await window.GA4Integration.fetchTrafficSources(url);
            console.log('✅ Traffic sources fetched:', trafficSources);
        } catch (error) {
            console.warn('❌ Failed to fetch traffic sources:', error);
        }
    } else {
        console.log('❌ fetchTrafficSources function not available');
    }

    if (window.GA4Integration?.fetchDeviceData) {
        try {
            console.log('📡 Calling fetchDeviceData...');
            deviceData = await window.GA4Integration.fetchDeviceData(url);
            console.log('✅ Device data fetched:', deviceData);
        } catch (error) {
            console.warn('❌ Failed to fetch device data:', error);
        }
    } else {
        console.log('❌ fetchDeviceData function not available');
    }

    // Check if we have ANY data (AFTER all data is fetched)
    if ((!gscData || gscData.noDataFound) && (!ga4Data || ga4Data.noDataFound)) {
        alert('No performance data available from either GSC or GA4. Please ensure at least one service is connected and has data for this page.');
        return;
    }

    // Handle missing GSC data gracefully  
    const finalGscData = (!gscData || gscData.noDataFound) ? {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        noDataFound: true,
        isMinimalForGA4Only: true,
        topQueries: []
    } : gscData;

    // Create and show the dashboard
    const modal = document.createElement('div');
    modal.className = 'enhanced-dashboard-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
        align-items: center; justify-content: center; padding: 20px;
        animation: fadeIn 0.3s ease;
    `;

    modal.onclick = () => modal.remove();

    const dashboard = document.createElement('div');
    dashboard.style.cssText = `
        background: white; border-radius: 20px; 
        max-width: 1200px; width: 100%; max-height: 90vh; overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); position: relative;
        animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    dashboard.onclick = e => e.stopPropagation();

    // Generate dashboard HTML with enhanced data
    dashboard.innerHTML = createEnhancedDashboardHTML(url, finalGscData, ga4Data, gscTrends, ga4Trends, trafficSources, deviceData);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        position: absolute; top: 20px; right: 25px; background: none; border: none;
        font-size: 28px; color: rgba(255,255,255,0.8); cursor: pointer;
        width: 40px; height: 40px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s ease; z-index: 10;
    `;
    closeBtn.onmouseover = () => {
        closeBtn.style.background = 'rgba(255,255,255,0.2)';
        closeBtn.style.color = 'white';
    };
    closeBtn.onmouseout = () => {
        closeBtn.style.background = 'none';
        closeBtn.style.color = 'rgba(255,255,255,0.8)';
    };
    closeBtn.onclick = () => modal.remove();
    dashboard.appendChild(closeBtn);

    modal.appendChild(dashboard);
    document.body.appendChild(modal);

    // Initialize interactive elements
    initializeDashboardInteractions(dashboard);
};

// Keep the reference
window.showEnhancedDashboardReport = window.showDetailedGSCAnalysis;

    

    // Enhanced analysis HTML generation with modern design
    function generateEnhancedDetailedAnalysisHTML(url, gscData) {
        const performanceScore = calculateSimplePerformanceScore(gscData);
        const scoreColor = getScoreColor(performanceScore);
        const shortUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;
        
        // Calculate additional metrics
        const avgPosition = gscData.position;
        const positionStatus = avgPosition <= 3 ? 'excellent' : avgPosition <= 10 ? 'good' : avgPosition <= 20 ? 'fair' : 'poor';
        const ctrBenchmark = getCTRBenchmark(avgPosition);
        const ctrPerformance = gscData.ctr >= ctrBenchmark * 1.2 ? 'excellent' : 
                              gscData.ctr >= ctrBenchmark ? 'good' : 
                              gscData.ctr >= ctrBenchmark * 0.8 ? 'fair' : 'poor';

        return `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0; border-radius: 20px; overflow: hidden;">
                
                <!-- Header Section -->
                <div style="background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); padding: 30px; border-bottom: 1px solid rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div>
                            <h1 style="margin: 0; font-size: 2rem; font-weight: 700; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                📊 Performance Deep Dive
                            </h1>
                            <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9rem;">Advanced SEO & Content Analysis</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: ${scoreColor}; color: white; padding: 8px 16px; border-radius: 50px; font-weight: 700; font-size: 1.1rem; margin-bottom: 5px;">
                                ${performanceScore}/100
                            </div>
                            <div style="font-size: 0.8rem; color: #666;">Performance Score</div>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9ff; padding: 15px; border-radius: 12px; border-left: 4px solid #667eea;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 5px;">📄 Analyzing Page:</div>
                        <div style="font-family: monospace; font-size: 0.9rem; color: #667eea; word-break: break-all;">${url}</div>
                    </div>
                </div>

                <!-- Main Content -->
                <div style="background: white; padding: 30px;">
                    
                    <!-- Key Metrics Dashboard -->
                    <div style="margin-bottom: 40px;">
                        <h2 style="color: #333; margin-bottom: 20px; font-size: 1.5rem; font-weight: 600;">📈 Key Performance Metrics</h2>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                            
                            <!-- Clicks Card -->
                            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 25px; border-radius: 16px; position: relative; overflow: hidden;">
                                <div style="position: absolute; top: -10px; right: -10px; font-size: 4rem; opacity: 0.2;">🎯</div>
                                <div style="position: relative; z-index: 2;">
                                    <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Total Clicks</div>
                                    <div style="font-size: 2.5rem; font-weight: 700; margin-bottom: 10px;">${formatNumber(gscData.clicks)}</div>
                                    ${gscData.trend && gscData.trend.clicksChange ? `
                                        <div style="display: flex; align-items: center; gap: 5px; font-size: 0.85rem;">
                                            <span>${parseFloat(gscData.trend.clicksChange) >= 0 ? '📈' : '📉'}</span>
                                            <span style="font-weight: 600;">${parseFloat(gscData.trend.clicksChange) > 0 ? '+' : ''}${gscData.trend.clicksChange}%</span>
                                            <span style="opacity: 0.8;">vs last period</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>

                            <!-- Impressions Card -->
                            <div style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333; padding: 25px; border-radius: 16px; position: relative; overflow: hidden;">
                                <div style="position: absolute; top: -10px; right: -10px; font-size: 4rem; opacity: 0.2;">👁️</div>
                                <div style="position: relative; z-index: 2;">
                                    <div style="font-size: 0.9rem; opacity: 0.7; margin-bottom: 5px;">Impressions</div>
                                    <div style="font-size: 2.5rem; font-weight: 700; margin-bottom: 10px;">${formatNumber(gscData.impressions)}</div>
                                    ${gscData.trend && gscData.trend.impressionsChange ? `
                                        <div style="display: flex; align-items: center; gap: 5px; font-size: 0.85rem;">
                                            <span>${parseFloat(gscData.trend.impressionsChange) >= 0 ? '📈' : '📉'}</span>
                                            <span style="font-weight: 600;">${parseFloat(gscData.trend.impressionsChange) > 0 ? '+' : ''}${gscData.trend.impressionsChange}%</span>
                                            <span style="opacity: 0.7;">vs last period</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>

                            <!-- CTR Card -->
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 16px; position: relative; overflow: hidden;">
                                <div style="position: absolute; top: -10px; right: -10px; font-size: 4rem; opacity: 0.2;">⚡</div>
                                <div style="position: relative; z-index: 2;">
                                    <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">Click-through Rate</div>
                                    <div style="font-size: 2.5rem; font-weight: 700; margin-bottom: 10px;">${(gscData.ctr * 100).toFixed(1)}%</div>
                                    <div style="display: flex; align-items: center; gap: 5px; font-size: 0.85rem;">
                                        <span>${getCTRStatusIcon(ctrPerformance)}</span>
                                        <span style="font-weight: 600; text-transform: capitalize;">${ctrPerformance}</span>
                                        <span style="opacity: 0.8;">vs benchmark</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Position Card -->
                            <div style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); color: #333; padding: 25px; border-radius: 16px; position: relative; overflow: hidden;">
                                <div style="position: absolute; top: -10px; right: -10px; font-size: 4rem; opacity: 0.2;">🏆</div>
                                <div style="position: relative; z-index: 2;">
                                    <div style="font-size: 0.9rem; opacity: 0.7; margin-bottom: 5px;">Average Position</div>
                                    <div style="font-size: 2.5rem; font-weight: 700; margin-bottom: 10px;">#${gscData.position.toFixed(0)}</div>
                                    <div style="display: flex; align-items: center; gap: 5px; font-size: 0.85rem;">
                                        <span>${getPositionStatusIcon(positionStatus)}</span>
                                        <span style="font-weight: 600; text-transform: capitalize;">${positionStatus}</span>
                                        <span style="opacity: 0.7;">ranking</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Performance Insights -->
                    <div style="margin-bottom: 40px;">
                        <h2 style="color: #333; margin-bottom: 20px; font-size: 1.5rem; font-weight: 600;">🎯 Performance Insights</h2>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                            
                            <!-- SEO Health Check -->
                            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 25px; border-radius: 16px;">
                                <h3 style="margin: 0 0 15px 0; font-size: 1.2rem; font-weight: 600;">🏥 SEO Health Check</h3>
                                
                                <div style="space-y: 10px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <span>Ranking Performance</span>
                                        <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">
                                            ${getPositionGrade(avgPosition)}
                                        </span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <span>CTR Optimization</span>
                                        <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">
                                            ${getCTRGrade(gscData.ctr, ctrBenchmark)}
                                        </span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <span>Traffic Volume</span>
                                        <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">
                                            ${getTrafficGrade(gscData.clicks)}
                                        </span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span>Growth Trend</span>
                                        <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">
                                            ${getTrendGrade(gscData.trend)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Quick Wins -->
                            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 25px; border-radius: 16px;">
                                <h3 style="margin: 0 0 15px 0; font-size: 1.2rem; font-weight: 600;">⚡ Quick Wins</h3>
                                
                                <div style="space-y: 12px;">
                                    ${generateQuickWins(gscData, avgPosition, ctrPerformance).map(win => `
                                        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                                            <div style="font-weight: 600; margin-bottom: 4px;">${win.title}</div>
                                            <div style="font-size: 0.9rem; opacity: 0.9;">${win.description}</div>
                                            <div style="margin-top: 6px;">
                                                <span style="background: rgba(255,255,255,0.3); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                                                    ${win.impact} IMPACT
                                                </span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Top Keywords Analysis -->
                    ${gscData.topQueries && gscData.topQueries.length > 0 ? `
                    <div style="margin-bottom: 40px;">
                        <h2 style="color: #333; margin-bottom: 20px; font-size: 1.5rem; font-weight: 600;">🔍 Keyword Performance Analysis</h2>
                        
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2px; border-radius: 16px;">
                            <div style="background: white; border-radius: 14px; overflow: hidden;">
                                
                                <!-- Table Header -->
                                <div style="background: linear-gradient(135deg, #f8f9ff 0%, #e8f1fe 100%); padding: 20px; border-bottom: 1px solid #e0e0e0;">
                                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr; gap: 15px; font-weight: 600; color: #333; font-size: 0.9rem;">
                                        <div>🎯 Search Query</div>
                                        <div style="text-align: center;">Clicks</div>
                                        <div style="text-align: center;">Impressions</div>
                                        <div style="text-align: center;">CTR</div>
                                        <div style="text-align: center;">Position</div>
                                        <div style="text-align: center;">Opportunity</div>
                                    </div>
                                </div>
                                
                                <!-- Table Rows -->
                                ${gscData.topQueries.map((query, i) => {
                                    const queryOpportunity = getQueryOpportunity(query);
                                    return `
                                        <div style="padding: 18px 20px; background: ${i % 2 === 0 ? '#fafbff' : 'white'}; border-bottom: ${i < gscData.topQueries.length - 1 ? '1px solid #f0f0f0' : 'none'};">
                                            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr; gap: 15px; align-items: center; font-size: 0.9rem;">
                                                
                                                <!-- Query -->
                                                <div>
                                                    <div style="font-weight: 600; color: #333; margin-bottom: 3px; word-break: break-word;">
                                                        "${escapeHtml(query.query)}"
                                                    </div>
                                                    <div style="font-size: 0.75rem; color: #666;">
                                                        ${query.query.length} characters • ${query.query.split(' ').length} words
                                                    </div>
                                                </div>
                                                
                                                <!-- Clicks -->
                                                <div style="text-align: center;">
                                                    <div style="font-weight: 600; color: #4facfe;">${query.clicks}</div>
                                                </div>
                                                
                                                <!-- Impressions -->
                                                <div style="text-align: center;">
                                                    <div style="font-weight: 600; color: #667eea;">${formatNumber(query.impressions)}</div>
                                                </div>
                                                
                                                <!-- CTR -->
                                                <div style="text-align: center;">
                                                    <div style="font-weight: 600; color: ${query.ctr > 0.05 ? '#4caf50' : query.ctr > 0.02 ? '#ff9800' : '#f44336'};">
                                                        ${(query.ctr * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                                
                                                <!-- Position -->
                                                <div style="text-align: center;">
                                                    <div style="background: ${query.position <= 3 ? '#4caf50' : query.position <= 10 ? '#ff9800' : '#f44336'}; 
                                                                color: white; padding: 4px 8px; border-radius: 20px; font-weight: 600; font-size: 0.8rem;">
                                                        #${query.position.toFixed(0)}
                                                    </div>
                                                </div>
                                                
                                                <!-- Opportunity -->
                                                <div style="text-align: center;">
                                                    <span style="background: ${queryOpportunity.color}20; color: ${queryOpportunity.color}; 
                                                                 padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
                                                        ${queryOpportunity.label}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Optimization Opportunities -->
                    ${gscData.opportunities && gscData.opportunities.length > 0 ? `
                    <div style="margin-bottom: 40px;">
                        <h2 style="color: #333; margin-bottom: 20px; font-size: 1.5rem; font-weight: 600;">🚀 Content Optimization Opportunities</h2>
                        
                        <div style="background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%); padding: 20px; border-radius: 16px; margin-bottom: 20px;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div style="font-size: 3rem;">⚡</div>
                                <div>
                                    <h3 style="margin: 0; color: #2d3436; font-size: 1.3rem;">High-Impact Optimization Potential</h3>
                                    <p style="margin: 5px 0 0 0; color: #636e72;">
                                        Found ${gscData.opportunities.length} keywords with significant improvement potential. 
                                        Optimizing these could boost your traffic significantly.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px;">
                            ${gscData.opportunities.map((opp, index) => `
                                <div style="background: white; border: 2px solid #ff9800; border-radius: 16px; padding: 20px; position: relative; overflow: hidden;">
                                    
                                    <!-- Priority Badge -->
                                    <div style="position: absolute; top: 15px; right: 15px;">
                                        <span style="background: #ff9800; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
                                            #${index + 1} PRIORITY
                                        </span>
                                    </div>
                                    
                                    <!-- Keyword -->
                                    <div style="margin-bottom: 15px; padding-right: 80px;">
                                        <h4 style="margin: 0 0 5px 0; color: #e65100; font-size: 1.1rem; font-weight: 600;">
                                            "${escapeHtml(opp.query)}"
                                        </h4>
                                        <div style="font-size: 0.8rem; color: #666;">
                                            ${opp.query.length} chars • ${opp.query.split(' ').length} words
                                        </div>
                                    </div>
                                    
                                    <!-- Metrics Grid -->
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                        <div style="text-align: center; background: #fff3e0; padding: 12px; border-radius: 8px;">
                                            <div style="font-size: 1.5rem; font-weight: 700; color: #e65100;">${formatNumber(opp.impressions)}</div>
                                            <div style="font-size: 0.8rem; color: #666;">Impressions</div>
                                        </div>
                                        <div style="text-align: center; background: #fff3e0; padding: 12px; border-radius: 8px;">
                                            <div style="font-size: 1.5rem; font-weight: 700; color: #e65100;">#${opp.position.toFixed(0)}</div>
                                            <div style="font-size: 0.8rem; color: #666;">Position</div>
                                        </div>
                                    </div>
                                    
                                    <!-- Opportunity Metrics -->
                                    <div style="background: #e8f5e8; padding: 15px; border-radius: 12px; border-left: 4px solid #4caf50;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                            <span style="font-size: 0.9rem; color: #2e7d32; font-weight: 600;">Current Performance:</span>
                                            <span style="font-size: 0.9rem; color: #666;">${opp.clicks} clicks (${(opp.ctr * 100).toFixed(1)}% CTR)</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="font-size: 0.9rem; color: #2e7d32; font-weight: 600;">Potential Gain:</span>
                                            <span style="font-size: 1rem; color: #2e7d32; font-weight: 700;">+${opp.potentialClicks} clicks/month</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Action Plan -->
                    <div style="margin-bottom: 30px;">
                        <h2 style="color: #333; margin-bottom: 20px; font-size: 1.5rem; font-weight: 600;">📋 Recommended Action Plan</h2>
                        
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2px; border-radius: 16px;">
                            <div style="background: white; border-radius: 14px; padding: 25px;">
                                ${generateActionPlan(gscData, avgPosition, ctrPerformance).map((action, index) => `
                                    <div style="display: flex; align-items: flex-start; gap: 20px; padding: 20px 0; border-bottom: ${index < 2 ? '1px solid #f0f0f0' : 'none'};">
                                        
                                        <!-- Step Number -->
                                        <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; width: 40px; height: 40px; 
                                                    border-radius: 50%; display: flex; align-items: center; justify-content: center; 
                                                    font-weight: 700; font-size: 1.1rem; flex-shrink: 0;">
                                            ${index + 1}
                                        </div>
                                        
                                        <!-- Action Content -->
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                                <h4 style="margin: 0; color: #333; font-size: 1.1rem; font-weight: 600;">
                                                    ${action.title}
                                                </h4>
                                                <span style="background: ${action.priority === 'high' ? '#f44336' : action.priority === 'medium' ? '#ff9800' : '#4caf50'}20; 
                                                             color: ${action.priority === 'high' ? '#f44336' : action.priority === 'medium' ? '#ff9800' : '#4caf50'}; 
                                                             padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">
                                                    ${action.priority} PRIORITY
                                                </span>
                                            </div>
                                            
                                            <p style="margin: 0 0 10px 0; color: #666; line-height: 1.5;">
                                                ${action.description}
                                            </p>
                                            
                                            <div style="display: flex; align-items: center; gap: 15px; font-size: 0.85rem; color: #666;">
                                                <span>⏱️ ${action.timeframe}</span>
                                                <span>📈 ${action.impact}</span>
                                                <span>🔧 ${action.difficulty}</span>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Export & Actions -->
                    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 25px; border-radius: 16px; text-align: center;">
                        <h3 style="margin: 0 0 15px 0; color: white; font-size: 1.3rem; font-weight: 600;">📊 Export & Share</h3>
                        <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.9); font-size: 0.95rem;">
                            Download detailed reports or share insights with your team
                        </p>
                        
                        <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                            <button onclick="exportEnhancedGSCData('${escapeHtml(url)}')" 
                                    style="background: rgba(255,255,255,0.2); color: white; border: 2px solid rgba(255,255,255,0.3); 
                                           padding: 12px 24px; border-radius: 25px; font-weight: 600; cursor: pointer; 
                                           transition: all 0.3s ease; backdrop-filter: blur(10px);"
                                    onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-2px)'"
                                    onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'">
                                📊 Export CSV Report
                            </button>
                            
                            <button onclick="copyAnalysisToClipboard('${escapeHtml(url)}')" 
                                    style="background: rgba(255,255,255,0.2); color: white; border: 2px solid rgba(255,255,255,0.3); 
                                           padding: 12px 24px; border-radius: 25px; font-weight: 600; cursor: pointer; 
                                           transition: all 0.3s ease; backdrop-filter: blur(10px);"
                                    onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-2px)'"
                                    onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'">
                                📋 Copy Summary
                            </button>
                            
                            <button onclick="window.open('${escapeHtml(url)}', '_blank')" 
                                    style="background: rgba(255,255,255,0.9); color: #f5576c; border: 2px solid transparent; 
                                           padding: 12px 24px; border-radius: 25px; font-weight: 600; cursor: pointer; 
                                           transition: all 0.3s ease;"
                                    onmouseover="this.style.background='white'; this.style.transform='translateY(-2px)'"
                                    onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.transform='translateY(0)'">
                                🔗 Open Page
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Enhanced export functions
    function exportEnhancedGSCData(url) {
        const gscData = gscDataMap.get(url);
        if (!gscData || gscData.noDataFound) {
            alert('No data to export');
            return;
        }
        
        const performanceScore = calculateSimplePerformanceScore(gscData);
        const timestamp = new Date().toISOString();
        
        let csv = 'GSC Enhanced Analysis Report\n';
        csv += `Generated: ${timestamp}\n`;
        csv += `URL: ${url}\n`;
        csv += `Performance Score: ${performanceScore}/100\n\n`;
        
        // Main metrics
        csv += 'MAIN METRICS\n';
        csv += 'Metric,Value,Trend\n';
        csv += `Clicks,${gscData.clicks},${gscData.trend ? gscData.trend.clicksChange + '%' : 'N/A'}\n`;
        csv += `Impressions,${gscData.impressions},${gscData.trend ? gscData.trend.impressionsChange + '%' : 'N/A'}\n`;
        csv += `CTR,${(gscData.ctr * 100).toFixed(2)}%,N/A\n`;
        csv += `Position,${gscData.position.toFixed(1)},${gscData.trend ? gscData.trend.positionChange : 'N/A'}\n\n`;
        
        // Top queries
        if (gscData.topQueries && gscData.topQueries.length > 0) {
            csv += 'TOP PERFORMING KEYWORDS\n';
            csv += 'Rank,Query,Clicks,Impressions,CTR,Position,Opportunity\n';
            gscData.topQueries.forEach((query, index) => {
                const opp = getQueryOpportunity(query);
                csv += `${index + 1},"${query.query}",${query.clicks},${query.impressions},${(query.ctr * 100).toFixed(2)}%,${query.position.toFixed(1)},${opp.label}\n`;
            });
            csv += '\n';
        }
        
        // Opportunities
        if (gscData.opportunities && gscData.opportunities.length > 0) {
            csv += 'OPTIMIZATION OPPORTUNITIES\n';
            csv += 'Priority,Query,Impressions,Current Clicks,Position,Potential Clicks\n';
            gscData.opportunities.forEach((opp, index) => {
                csv += `${index + 1},"${opp.query}",${opp.impressions},${opp.clicks},${opp.position.toFixed(1)},${opp.potentialClicks}\n`;
            });
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = csvUrl;
        link.download = `gsc-enhanced-analysis-${url.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(csvUrl);
    }

    function copyAnalysisToClipboard(url) {
        const gscData = gscDataMap.get(url);
        if (!gscData || gscData.noDataFound) {
            alert('No data to copy');
            return;
        }
        
        const performanceScore = calculateSimplePerformanceScore(gscData);
        const summary = `
📊 GSC PERFORMANCE ANALYSIS

🔗 Page: ${url}
📈 Performance Score: ${performanceScore}/100

KEY METRICS (Last 30 days):
• Clicks: ${formatNumber(gscData.clicks)} ${gscData.trend ? `(${gscData.trend.clicksChange > 0 ? '+' : ''}${gscData.trend.clicksChange}%)` : ''}
• Impressions: ${formatNumber(gscData.impressions)} ${gscData.trend ? `(${gscData.trend.impressionsChange > 0 ? '+' : ''}${gscData.trend.impressionsChange}%)` : ''}
• CTR: ${(gscData.ctr * 100).toFixed(1)}%
• Avg Position: #${gscData.position.toFixed(0)}

TOP KEYWORDS:
${gscData.topQueries ? gscData.topQueries.slice(0, 5).map((q, i) => 
    `${i + 1}. "${q.query}" - ${q.clicks} clicks, #${q.position.toFixed(0)} position`
).join('\n') : 'No keyword data available'}

${gscData.opportunities && gscData.opportunities.length > 0 ? `
🚀 OPPORTUNITIES:
${gscData.opportunities.slice(0, 3).map((o, i) => 
    `${i + 1}. "${o.query}" - ${o.impressions} impressions, potential +${o.potentialClicks} clicks`
).join('\n')}` : ''}

Generated: ${new Date().toLocaleDateString()}
        `.trim();
        
        navigator.clipboard.writeText(summary).then(() => {
            // Show success message
            const message = document.createElement('div');
            message.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: #4caf50; color: white; padding: 15px 25px; border-radius: 8px;
                font-weight: 600; z-index: 10001; animation: fadeIn 0.3s ease;
            `;
            message.textContent = '✅ Analysis copied to clipboard!';
            document.body.appendChild(message);
            
            setTimeout(() => {
                message.style.opacity = '0';
                setTimeout(() => message.remove(), 300);
            }, 2000);
        }).catch(() => {
            alert('Failed to copy to clipboard. Please try again.');
        });
    }

    // Export GSC data function
    function exportGSCData(url) {
        const gscData = gscDataMap.get(url);
        if (!gscData || gscData.noDataFound) {
            alert('No data to export');
            return;
        }
        
        let csv = 'URL,Clicks,Impressions,CTR,Position,Trend_Clicks,Trend_Impressions,Trend_Position\n';
        csv += `"${url}",${gscData.clicks},${gscData.impressions},${(gscData.ctr * 100).toFixed(2)}%,${gscData.position.toFixed(1)}`;
        
        if (gscData.trend) {
            csv += `,${gscData.trend.clicksChange}%,${gscData.trend.impressionsChange}%,${gscData.trend.positionChange}`;
        } else {
            csv += ',,,';
        }
        csv += '\n\n';
        
        if (gscData.topQueries && gscData.topQueries.length > 0) {
            csv += 'Top Queries,Clicks,Impressions,CTR,Position\n';
            gscData.topQueries.forEach(query => {
                csv += `"${query.query}",${query.clicks},${query.impressions},${(query.ctr * 100).toFixed(2)}%,${query.position.toFixed(1)}\n`;
            });
            csv += '\n';
        }
        
        if (gscData.opportunities && gscData.opportunities.length > 0) {
            csv += 'Optimization Opportunities,Impressions,Clicks,CTR,Position,Potential_Clicks\n';
            gscData.opportunities.forEach(opp => {
                csv += `"${opp.query}",${opp.impressions},${opp.clicks},${(opp.ctr * 100).toFixed(2)}%,${opp.position.toFixed(1)},${opp.potentialClicks}\n`;
            });
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = csvUrl;
        link.download = `gsc-analysis-${url.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(csvUrl);
    }

    // Expose to global scope
    window.exportGSCData = exportGSCData;
    window.exportEnhancedGSCData = exportEnhancedGSCData;
    window.copyAnalysisToClipboard = copyAnalysisToClipboard;

    // ===========================================
    // DEBUGGING TOOLS AND DIAGNOSTICS
    // ===========================================

    function initializeDebugging() {
        // GSC Debugging and Diagnostic Tools
        window.GSCDebugger = {
            
            // Test connection and site matching
            async testConnection() {
                console.group('🔍 GSC Connection Test');
                
                const status = window.GSCIntegration.debug.getStatus();
                console.table(status);
                
                if (!status.gscConnected) {
                    console.error('❌ Not connected to GSC');
                    console.groupEnd();
                    return;
                }
                
                // Test basic API access
                try {
                    const sites = await robustGSCApiCall(async () => {
                        return await gapi.client.request({
                            path: 'https://www.googleapis.com/webmasters/v3/sites',
                            method: 'GET'
                        });
                    });
                    console.log('✅ API Access OK');
                    console.log('Available sites:', sites.result.siteEntry);
                } catch (error) {
                    console.error('❌ API Access Failed:', error);
                }
                
                console.groupEnd();
            },

            // Test URL matching for a specific URL
            async testUrlMatching(testUrl) {
                console.group(`🎯 URL Matching Test: ${testUrl}`);
                
                if (!window.GSCIntegration.isConnected()) {
                    console.error('❌ GSC not connected');
                    console.groupEnd();
                    return;
                }
                
                const variations = createEnhancedUrlVariations(testUrl);
                console.log(`Generated ${variations.length} variations:`);
                variations.forEach((v, i) => console.log(`${i + 1}. ${v}`));
                
                // Test each variation
                const results = [];
                for (const [index, variation] of variations.entries()) {
                    console.log(`\n🧪 Testing variation ${index + 1}: ${variation}`);
                    
                    try {
                        const today = new Date();
                        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
                        
                        const result = await robustGSCApiCall(async () => {
                            return await gapi.client.request({
                                path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                                method: 'POST',
                                body: {
                                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                                    endDate: today.toISOString().split('T')[0],
                                    dimensions: ['page'],
                                    dimensionFilterGroups: [{
                                        filters: [{
                                            dimension: 'page',
                                            operator: 'equals',
                                            expression: variation
                                        }]
                                    }],
                                    rowLimit: 1
                                }
                            });
                        });
                        
                        const hasData = result.result.rows && result.result.rows.length > 0;
                        results.push({
                            variation,
                            success: true,
                            hasData,
                            data: hasData ? result.result.rows[0] : null
                        });
                        
                        console.log(hasData ? '✅ HAS DATA' : '⚪ NO DATA', hasData ? result.result.rows[0] : '');
                        
                        if (hasData) {
                            break; // Found data, no need to test more
                        }
                        
                    } catch (error) {
                        results.push({
                            variation,
                            success: false,
                            error: error.message
                        });
                        console.log('❌ ERROR:', error.message);
                    }
                    
                    // Small delay between tests
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                console.log('\n📊 Summary:');
                console.table(results);
                
                const successful = results.filter(r => r.success && r.hasData);
                if (successful.length > 0) {
                    console.log(`✅ Found ${successful.length} working variation(s)`);
                } else {
                    console.log('❌ No variations returned data');
                    console.log('💡 Suggestions:');
                    console.log('   - Check if URL exists in GSC (try searching manually)');
                    console.log('   - Verify the site property is correct');
                    console.log('   - Check if URL has received clicks in the last 30 days');
                }
                
                console.groupEnd();
                return results;
            },

            // Analyze sitemap vs GSC coverage
            async analyzeCoverage() {
                console.group('📈 Sitemap vs GSC Coverage Analysis');
                
                if (!window.treeData) {
                    console.error('❌ No sitemap data loaded');
                    console.groupEnd();
                    return;
                }
                
                // Get all URLs from sitemap
                const allUrls = [];
                function collectUrls(node) {
                    if (node.url) allUrls.push(node.url);
                    if (node.children) {
                        node.children.forEach(collectUrls);
                    }
                }
                collectUrls(window.treeData);
                
                console.log(`📋 Found ${allUrls.length} URLs in sitemap`);
                
                // Sample a few URLs for testing (to avoid rate limits)
                const sampleUrls = allUrls.slice(0, Math.min(10, allUrls.length));
                console.log(`🧪 Testing sample of ${sampleUrls.length} URLs`);
                
                const coverage = {
                    total: allUrls.length,
                    tested: 0,
                    found: 0,
                    notFound: 0,
                    errors: 0
                };
                
                for (const url of sampleUrls) {
                    coverage.tested++;
                    console.log(`\n🔍 Testing: ${url}`);
                    
                    try {
                        const variations = createEnhancedUrlVariations(url);
                        let found = false;
                        
                        for (const variation of variations.slice(0, 5)) { // Limit variations for speed
                            try {
                                const today = new Date();
                                const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
                                
                                const result = await robustGSCApiCall(async () => {
                                    return await gapi.client.request({
                                        path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                                        method: 'POST',
                                        body: {
                                            startDate: thirtyDaysAgo.toISOString().split('T')[0],
                                            endDate: today.toISOString().split('T')[0],
                                            dimensions: ['page'],
                                            dimensionFilterGroups: [{
                                                filters: [{
                                                    dimension: 'page',
                                                    operator: 'equals',
                                                    expression: variation
                                                }]
                                            }],
                                            rowLimit: 1
                                        }
                                    });
                                });
                                
                                if (result.result.rows && result.result.rows.length > 0) {
                                    console.log(`✅ Found data for: ${variation}`);
                                    found = true;
                                    coverage.found++;
                                    break;
                                }
                                
                            } catch (error) {
                                // Continue with next variation
                            }
                            
                            // Rate limiting
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                        
                        if (!found) {
                            console.log('⚪ No data found');
                            coverage.notFound++;
                        }
                        
                    } catch (error) {
                        console.log('❌ Error:', error.message);
                        coverage.errors++;
                    }
                }
                
                console.log('\n📊 Coverage Summary:');
                console.table(coverage);
                
                const coveragePercent = (coverage.found / coverage.tested * 100).toFixed(1);
                console.log(`🎯 Coverage: ${coveragePercent}% of tested URLs found in GSC`);
                
                if (coverage.found < coverage.tested * 0.5) {
                    console.log('\n💡 Low coverage suggestions:');
                    console.log('   - Check if the correct GSC property is selected');
                    console.log('   - Verify URLs in sitemap match those in GSC');
                    console.log('   - Consider if pages have received organic clicks recently');
                }
                
                console.groupEnd();
                return coverage;
            },

            // Show current cache status
            showCacheStatus() {
                console.group('💾 GSC Cache Status');
                
                const cacheSize = gscDataMap.size;
                console.log(`Total cached entries: ${cacheSize}`);
                
                if (cacheSize === 0) {
                    console.log('ℹ️ Cache is empty');
                } else {
                    const entries = Array.from(gscDataMap.entries());
                    const withData = entries.filter(([url, data]) => !data.noDataFound);
                    const noData = entries.filter(([url, data]) => data.noDataFound);
                    
                    console.log(`✅ With data: ${withData.length}`);
                    console.log(`⚪ No data found: ${noData.length}`);
                    
                    // Show some examples
                    if (withData.length > 0) {
                        console.log('\n📊 Sample entries with data:');
                        withData.slice(0, 3).forEach(([url, data]) => {
                            console.log(`${url}: ${data.clicks} clicks, ${data.impressions} impressions`);
                        });
                    }
                    
                    if (noData.length > 0) {
                        console.log('\n⚪ Sample entries without data:');
                        noData.slice(0, 3).forEach(([url, data]) => {
                            console.log(`${url}: No data (tried ${data.triedVariations || 'unknown'} variations)`);
                        });
                    }
                }
                
                console.groupEnd();
            },

            // Clear cache and restart
            async restart() {
                console.log('🔄 Restarting GSC Integration...');
                window.GSCIntegration.reset();
                console.log('✅ Cache cleared, ready for fresh start');
            }
        };

        // Add keyboard shortcut for debugging
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+G for GSC debugging
            if (e.key === 'G' && e.ctrlKey && e.shiftKey) {
                e.preventDefault();
                console.log('🔧 GSC Debugger activated! Try:');
                console.log('   GSCDebugger.testConnection()');
                console.log('   GSCDebugger.testUrlMatching("your-url-here")');
                console.log('   GSCDebugger.analyzeCoverage()');
                console.log('   GSCDebugger.showCacheStatus()');
                window.GSCDebugger.testConnection();
            }
        });

        debugLog('Debugging tools initialized');
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+L to load GSC data for all visible nodes
        if (e.key === 'l' && e.ctrlKey && gscConnected && gscDataLoaded) {
            e.preventDefault();
            loadVisibleNodesGSCData();
            
            const feedback = document.createElement('div');
            feedback.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(74, 144, 226, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                z-index: 10001;
                pointer-events: none;
            `;
            feedback.textContent = 'Loading enhanced GSC data for visible nodes...';
            document.body.appendChild(feedback);
            
            setTimeout(() => {
                feedback.style.opacity = '0';
                setTimeout(() => feedback.remove(), 300);
            }, 2000);
        }

        // Ctrl+Shift+R to refresh GSC connection
        if (e.key === 'R' && e.ctrlKey && e.shiftKey && gscConnected) {
            e.preventDefault();
            debugLog('Manual refresh triggered via keyboard shortcut');
            
            const refreshFeedback = document.createElement('div');
            refreshFeedback.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255, 152, 0, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                z-index: 10001;
                pointer-events: none;
            `;
            refreshFeedback.textContent = 'Refreshing GSC connection...';
            document.body.appendChild(refreshFeedback);
            
            // Refresh token
            refreshToken().then(() => {
                refreshFeedback.textContent = 'GSC connection refreshed!';
                refreshFeedback.style.background = 'rgba(76, 175, 80, 0.9)';
                
                setTimeout(() => {
                    refreshFeedback.style.opacity = '0';
                    setTimeout(() => refreshFeedback.remove(), 300);
                }, 2000);
            }).catch((error) => {
                refreshFeedback.textContent = 'Refresh failed: ' + error.message;
                refreshFeedback.style.background = 'rgba(244, 67, 54, 0.9)';
                
                setTimeout(() => {
                    refreshFeedback.style.opacity = '0';
                    setTimeout(() => refreshFeedback.remove(), 300);
                }, 3000);
            });
        }
    });

    // Console welcome message
    setTimeout(() => {
        if (typeof console !== 'undefined' && console.log) {
            console.log(`
🚀 GSC Integration Module Loaded!

Enhanced features:
• Robust URL matching with 15+ variations
• Automatic token refresh and error recovery  
• Connection health monitoring
• Comprehensive debugging tools

Keyboard shortcuts:
• Ctrl+L: Load GSC data for all visible nodes
• Ctrl+Shift+G: Open GSC debugger  
• Ctrl+Shift+R: Refresh GSC connection

Debugging commands:
• GSCDebugger.testConnection()
• GSCDebugger.testUrlMatching("your-url")
• GSCDebugger.analyzeCoverage()
• GSCDebugger.showCacheStatus()

API Status: ${gapiInited && gisInited ? '✅ Ready' : '⏳ Loading...'}
            `);
        }
    }, 1000);


// ADD THESE FUNCTIONS TO YOUR gsc-integration-module (24).js
// Add these functions to the GSCIntegration object at the end

// Period comparison functions for GSC trends
window.GSCIntegration.fetchNodeDataForPeriod = async function(nodeData, startDate, endDate) {
    if (!nodeData || !nodeData.url || !gscConnected || !gscSiteUrl) {
        debugLog('GSC not connected or missing data for period fetch');
        return null;
    }

    debugLog('Fetching GSC data for period:', {
        url: nodeData.url,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    });

    // Check cache for this specific period
    const cacheKey = `${nodeData.url}_${startDate.getTime()}_${endDate.getTime()}`;
    if (gscDataMap.has(cacheKey)) {
        return gscDataMap.get(cacheKey);
    }

    // Check if request is already pending
    if (pendingRequests.has(cacheKey)) {
        return pendingRequests.get(cacheKey);
    }

    // Create and store the promise
    const promise = fetchSingleNodeDataForPeriod(nodeData, startDate, endDate);
    pendingRequests.set(cacheKey, promise);

    try {
        const result = await promise;
        return result;
    } finally {
        pendingRequests.delete(cacheKey);
    }
};

// Enhanced function to fetch data for a specific period
async function fetchSingleNodeDataForPeriod(node, startDate, endDate) {
    if (!node || !node.url) return null;

    debugLog('Fetching GSC data for specific period:', {
        url: node.url,
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
    });

    const urlVariations = createEnhancedUrlVariations(node.url);
    let foundData = null;
    let attempts = 0;

    // Try variations in order of likelihood
    for (const variation of urlVariations) {
        attempts++;

        try {
            debugLog(`Trying variation ${attempts}/${urlVariations.length} for period:`, variation);

            const result = await robustGSCApiCall(async () => {
                return await gapi.client.request({
                    path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                    method: 'POST',
                    body: {
                        startDate: startDate.toISOString().split('T')[0],
                        endDate: endDate.toISOString().split('T')[0],
                        dimensions: ['page'],
                        dimensionFilterGroups: [{
                            filters: [{
                                dimension: 'page',
                                operator: 'equals',
                                expression: variation
                            }]
                        }],
                        rowLimit: 1
                    }
                });
            });

            if (result.result && result.result.rows && result.result.rows.length > 0) {
                debugLog(`✅ Found period data for variation:`, variation);

                // Get basic period data
                const row = result.result.rows[0];
                const periodData = {
                    pagePath: variation,
                    clicks: row.clicks || 0,
                    impressions: row.impressions || 0,
                    ctr: row.ctr || 0,
                    position: row.position || 0,
                    noDataFound: false,
                    fetchedAt: Date.now(),
                    period: {
                        start: startDate.toISOString().split('T')[0],
                        end: endDate.toISOString().split('T')[0]
                    }
                };

                // Get top queries for this period (optional but useful)
                try {
                    const queriesResponse = await robustGSCApiCall(async () => {
                        return await gapi.client.request({
                            path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                            method: 'POST',
                            body: {
                                startDate: startDate.toISOString().split('T')[0],
                                endDate: endDate.toISOString().split('T')[0],
                                dimensions: ['query'],
                                dimensionFilterGroups: [{
                                    filters: [{
                                        dimension: 'page',
                                        operator: 'equals',
                                        expression: variation
                                    }]
                                }],
                                rowLimit: 5
                            }
                        });
                    });

                    const queries = queriesResponse.result.rows || [];
                    periodData.topQueries = queries.slice(0, 3).map(q => ({
                        query: q.keys[0],
                        clicks: q.clicks,
                        impressions: q.impressions,
                        ctr: q.ctr,
                        position: q.position
                    }));

                } catch (queryError) {
                    debugLog('Failed to get queries for period:', queryError);
                }

                foundData = periodData;
                break;
            }

            // Add small delay between variations to avoid rate limiting
            if (attempts < urlVariations.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

        } catch (error) {
            debugLog(`❌ Error with variation ${variation} for period:`, error.message);

            // If we hit rate limits, wait longer
            if (error.status === 429) {
                debugLog('Rate limited, waiting 2 seconds...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    if (foundData) {
        // Cache the result
        const cacheKey = `${node.url}_${startDate.getTime()}_${endDate.getTime()}`;
        gscDataMap.set(cacheKey, foundData);
        return foundData;
    }

    // No data found for any variation
    const noData = {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        noDataFound: true,
        fetchedAt: Date.now(),
        triedVariations: urlVariations.length,
        period: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        }
    };

    const cacheKey = `${node.url}_${startDate.getTime()}_${endDate.getTime()}`;
    gscDataMap.set(cacheKey, noData);
    debugLog(`No GSC period data found after trying ${urlVariations.length} variations`);
    return noData;
}

// Helper function to get previous period data (30-60 days ago)
window.GSCIntegration.fetchPreviousPeriodData = async function(nodeData) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(today.getTime() - (60 * 24 * 60 * 60 * 1000));
    
    return await window.GSCIntegration.fetchNodeDataForPeriod(nodeData, sixtyDaysAgo, thirtyDaysAgo);
};

// Enhanced function to get current vs previous comparison
window.GSCIntegration.fetchTrendComparison = async function(nodeData) {
    debugLog('Fetching trend comparison for:', nodeData.name);
    
    try {
        // Fetch both periods in parallel
        const [currentData, previousData] = await Promise.all([
            window.GSCIntegration.fetchNodeData(nodeData), // Current period (last 30 days)
            window.GSCIntegration.fetchPreviousPeriodData(nodeData) // Previous period (30-60 days ago)
        ]);

        if (!currentData || currentData.noDataFound) {
            return { 
                current: currentData, 
                previous: null, 
                trends: null 
            };
        }

        // Calculate trends if we have previous data
        let trends = null;
        if (previousData && !previousData.noDataFound) {
            trends = calculateGSCTrends(currentData, previousData);
        }

        return {
            current: currentData,
            previous: previousData,
            trends: trends
        };

    } catch (error) {
        debugLog('Error fetching trend comparison:', error);
        return { 
            current: null, 
            previous: null, 
            trends: null, 
            error: error.message 
        };
    }
};

// Calculate trend percentages and insights
function calculateGSCTrends(currentData, previousData) {
    const trends = {};

    // Calculate percentage changes
    if (previousData.clicks > 0) {
        trends.clicks = {
            current: currentData.clicks,
            previous: previousData.clicks,
            percentChange: ((currentData.clicks - previousData.clicks) / previousData.clicks) * 100,
            direction: currentData.clicks >= previousData.clicks ? 'up' : 'down'
        };
    }

    if (previousData.impressions > 0) {
        trends.impressions = {
            current: currentData.impressions,
            previous: previousData.impressions,
            percentChange: ((currentData.impressions - previousData.impressions) / previousData.impressions) * 100,
            direction: currentData.impressions >= previousData.impressions ? 'up' : 'down'
        };
    }

    if (previousData.ctr > 0) {
        trends.ctr = {
            current: currentData.ctr,
            previous: previousData.ctr,
            percentChange: ((currentData.ctr - previousData.ctr) / previousData.ctr) * 100,
            direction: currentData.ctr >= previousData.ctr ? 'up' : 'down'
        };
    }

    if (previousData.position > 0) {
        // For position, lower is better, so invert the logic
        trends.position = {
            current: currentData.position,
            previous: previousData.position,
            percentChange: ((previousData.position - currentData.position) / previousData.position) * 100, // Inverted
            direction: currentData.position <= previousData.position ? 'up' : 'down' // Up means better ranking
        };
    }

    // Add overall assessment
    trends.overall = assessOverallTrend(trends);

    debugLog('Calculated GSC trends:', trends);
    return trends;
}

// Assess overall trend direction
function assessOverallTrend(trends) {
    let positiveCount = 0;
    let negativeCount = 0;
    let totalWeight = 0;

    const weights = { clicks: 0.4, impressions: 0.2, ctr: 0.3, position: 0.1 };

    Object.keys(weights).forEach(metric => {
        if (trends[metric]) {
            const change = trends[metric].percentChange;
            const weight = weights[metric];
            totalWeight += weight;

            if (Math.abs(change) > 5) { // Only count significant changes
                if (change > 0) positiveCount += weight;
                else negativeCount += weight;
            }
        }
    });

    if (positiveCount > negativeCount) {
        return { direction: 'improving', confidence: positiveCount / totalWeight };
    } else if (negativeCount > positiveCount) {
        return { direction: 'declining', confidence: negativeCount / totalWeight };
    } else {
        return { direction: 'stable', confidence: 0.5 };
    }
}

// ADD THIS TO THE DEBUG SECTION OF YOUR GSC INTEGRATION
// Add to window.GSCIntegration.debug object
window.GSCIntegration.debug.testPeriodComparison = async function(url) {
    if (!gscConnected) {
        console.error('GSC not connected');
        return;
    }

    console.log('🧪 Testing period comparison for:', url);
    
    const nodeData = { url: url, name: 'Test Page' };
    const comparison = await window.GSCIntegration.fetchTrendComparison(nodeData);
    
    console.log('📊 Trend Comparison Results:');
    console.table(comparison.current);
    if (comparison.previous) {
        console.table(comparison.previous);
    }
    if (comparison.trends) {
        console.log('📈 Calculated Trends:', comparison.trends);
    }
    
    return comparison;
};

console.log('✅ GSC Period Comparison Functions Added!');


function createEnhancedDashboardHTML(url, gscData, ga4Data, gscTrends, ga4Trends, trafficSources, deviceData) {
    const pageTitle = extractPageTitle(url);
    const crossPlatformInsights = generateCrossPlatformInsights(gscData, ga4Data, gscTrends, ga4Trends);

    return `
        ${createEnhancedDashboardStyles()}
        
        <!-- Page Header Section -->
        <div class="page-header">
            <div class="header-background">
                <div class="header-pattern"></div>
                <div class="header-content">
                    <div class="page-info">
                        <h1 class="page-title">${pageTitle}</h1>
                        <div class="page-meta">
                            <div class="url-display">${url}</div>
                        </div>
                    </div>
                    
                    <div class="header-metrics">
                        ${createPrimaryPositionCard(gscData, gscTrends)}
                        ${createTrendIndicators(gscTrends, ga4Trends)}
                    </div>
                </div>
            </div>
        </div>

        <!-- Performance Snapshot -->
        <div class="performance-snapshot">
            <h2 class="section-title">📊 Performance Snapshot</h2>
            <div class="metrics-grid">
                ${createSearchConsoleMetrics(gscData, gscTrends)}
                ${createGA4Metrics(ga4Data, ga4Trends)}
                ${createCrossMetrics(gscData, ga4Data)}
            </div>
        </div>

        <!-- Cross-Platform Insights -->
        <div class="insights-section">
            <h2 class="section-title">⚡ Key Insights</h2>
            <div class="insights-grid">
                ${crossPlatformInsights.map(insight => createInsightCard(insight)).join('')}
            </div>
        </div>

        <!-- Search Visibility Panel -->
        <div class="search-visibility">
            <h2 class="section-title">🔍 Search Visibility</h2>
            <div class="visibility-content">
                ${createTopQueriesSection(gscData)}
                ${createCTRAnalysisSection(gscData)}
            </div>
        </div>

        <!-- Content Optimization Recommendations -->
        <div class="recommendations-section">
            <h2 class="section-title">💡 Content Optimization</h2>
            <div class="recommendations-content">
                ${createQuickWinsSection(crossPlatformInsights)}
            </div>
        </div>

        <!-- Citizens Impact Metrics -->
        <div class="impact-section">
            <h2 class="section-title">🎯 Citizens Impact</h2>
            <div class="impact-content">
                ${createCitizensImpactMetrics(ga4Data, gscData)}
            </div>
        </div>

        <!-- Action Center -->
        <div class="action-center">
            ${createActionButtons(url)}
        </div>
    `;
}

function createEnhancedDashboardStyles() {
    return `
        <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

            .enhanced-dashboard-modal * { box-sizing: border-box; }

            .page-header { margin: 0 0 30px 0; border-radius: 20px 20px 0 0; overflow: hidden; }
            .header-background { background: linear-gradient(135deg, #5a8200 0%, #72A300 100%); position: relative; overflow: hidden; }
            .header-pattern { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 2px, transparent 2px); background-size: 30px 30px; opacity: 0.3; }
            .header-content { position: relative; z-index: 2; padding: 30px; display: flex; justify-content: space-between; align-items: flex-start; gap: 30px; }
            .page-info { flex: 1; min-width: 0; }
            .page-title { margin: 0 0 12px 0; font-size: 2rem; font-weight: 700; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.1); line-height: 1.2; }
            .page-meta { display: flex; flex-direction: column; gap: 8px; }
            .url-display { font-family: 'Monaco', 'Menlo', monospace; font-size: 0.85rem; color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.15); padding: 8px 12px; border-radius: 8px; word-break: break-all; backdrop-filter: blur(10px); }
            .header-metrics { display: flex; flex-direction: column; gap: 15px; align-items: flex-end; }

            .section-title { font-size: 1.4rem; font-weight: 700; color: #1f2937; margin: 0 0 20px 0; display: flex; align-items: center; gap: 10px; }
            .performance-snapshot, .insights-section, .search-visibility, .recommendations-section, .impact-section { padding: 30px; border-bottom: 1px solid #f3f4f6; }
            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }

            .metric-card { background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; position: relative; overflow: hidden; transition: all 0.3s ease; }
            .metric-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
            .metric-card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: var(--accent-color, #72A300); }
            .metric-label { font-size: 0.8rem; color: #64748b; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
            .metric-value { font-size: 2rem; font-weight: 800; color: #1f2937; margin-bottom: 8px; line-height: 1; }
            .metric-trend { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 600; }
            .trend-positive { color: #059669; }
            .trend-negative { color: #dc2626; }
            .trend-neutral { color: #64748b; }

            .insights-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
            .insight-card { background: white; border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; position: relative; transition: all 0.3s ease; }
            .insight-card.priority-high { border-color: #ef4444; background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%); }
            .insight-card.priority-medium { border-color: #f59e0b; background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%); }
            .insight-card.priority-low { border-color: #10b981; background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%); }
            .insight-title { font-size: 1.1rem; font-weight: 700; color: #1f2937; margin: 0 0 8px 0; }
            .insight-description { font-size: 0.9rem; color: #64748b; line-height: 1.5; margin: 0 0 12px 0; }
            .insight-action { font-size: 0.85rem; font-weight: 600; color: var(--priority-color); background: rgba(var(--priority-rgb), 0.1); padding: 6px 12px; border-radius: 20px; display: inline-block; }

            .visibility-content, .recommendations-content { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 25px; }
            .content-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .card-title { font-size: 1.1rem; font-weight: 700; color: #1f2937; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; }

            .action-center { padding: 30px; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); text-align: center; border-radius: 0 0 20px 20px; }
            .action-buttons { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }
            .action-btn { padding: 12px 24px; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; }
            .action-btn.primary { background: linear-gradient(135deg, #5a8200 0%, #72A300 100%); color: white; box-shadow: 0 4px 14px rgba(114, 163, 0, 0.3); }
            .action-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(114, 163, 0, 0.4); }
            .action-btn.secondary { background: white; color: #64748b; border: 2px solid #e2e8f0; }
            .action-btn.secondary:hover { background: #f8fafc; border-color: #72A300; color: #72A300; transform: translateY(-1px); }

            @media (max-width: 768px) {
                .header-content { flex-direction: column; gap: 20px; }
                .page-title { font-size: 1.5rem; }
                .metrics-grid, .insights-grid, .visibility-content, .recommendations-content { grid-template-columns: 1fr; }
                .action-buttons { flex-direction: column; align-items: center; }
            }
        </style>
    `;
}

function createPrimaryPositionCard(gscData, gscTrends) {
    const position = gscData.position || 0;
    const trend = gscTrends?.trends?.position;
    
    return `
        <div class="metric-card" style="--accent-color: #3b82f6; min-width: 200px;">
            <div class="metric-label">Primary Position</div>
            <div class="metric-value" style="color: #3b82f6;">#${position.toFixed(0)}</div>
            ${trend ? `
                <div class="metric-trend ${trend.direction === 'up' ? 'trend-positive' : trend.direction === 'down' ? 'trend-negative' : 'trend-neutral'}">
                    <span>${trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'}</span>
                    <span>${Math.abs(trend.percentChange).toFixed(1)}% vs last period</span>
                </div>
            ` : ''}
        </div>
    `;
}

function createTrendIndicators(gscTrends, ga4Trends) {
    return `
        <div style="display: flex; gap: 12px; align-items: center;">
            ${gscTrends?.trends?.clicks ? `
                <div style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; backdrop-filter: blur(10px);">
                    <span style="color: white; font-size: 0.8rem;">🔍</span>
                    <span style="color: white; font-size: 0.8rem; font-weight: 600;">
                        ${gscTrends.trends.clicks.direction === 'up' ? '+' : ''}${gscTrends.trends.clicks.percentChange.toFixed(0)}%
                    </span>
                </div>
            ` : ''}
            ${ga4Trends?.trends?.pageViews ? `
                <div style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; backdrop-filter: blur(10px);">
                    <span style="color: white; font-size: 0.8rem;">📊</span>
                    <span style="color: white; font-size: 0.8rem; font-weight: 600;">
                        ${ga4Trends.trends.pageViews.direction === 'up' ? '+' : ''}${ga4Trends.trends.pageViews.percentChange.toFixed(0)}%
                    </span>
                </div>
            ` : ''}
        </div>
    `;
}

function createSearchConsoleMetrics(gscData, gscTrends) {
    const metrics = [
        { label: 'Total Clicks', value: formatNumber(gscData.clicks || 0), trend: gscTrends?.trends?.clicks, color: '#3b82f6', icon: '🎯' },
        { label: 'Impressions', value: formatNumber(gscData.impressions || 0), trend: gscTrends?.trends?.impressions, color: '#06b6d4', icon: '👁️' },
        { label: 'Click-through Rate', value: `${((gscData.ctr || 0) * 100).toFixed(1)}%`, trend: gscTrends?.trends?.ctr, color: '#8b5cf6', icon: '⚡' }
    ];

    return metrics.map(metric => `
        <div class="metric-card" style="--accent-color: ${metric.color};">
            <div class="metric-label">${metric.icon} ${metric.label}</div>
            <div class="metric-value" style="color: ${metric.color};">${metric.value}</div>
            ${metric.trend ? `
                <div class="metric-trend ${metric.trend.direction === 'up' ? 'trend-positive' : metric.trend.direction === 'down' ? 'trend-negative' : 'trend-neutral'}">
                    <span>${metric.trend.direction === 'up' ? '↗' : metric.trend.direction === 'down' ? '↘' : '→'}</span>
                    <span>${Math.abs(metric.trend.percentChange).toFixed(1)}% vs last period</span>
                </div>
            ` : '<div class="metric-trend trend-neutral">No trend data</div>'}
        </div>
    `).join('');
}

function createGA4Metrics(ga4Data, ga4Trends) {
    if (!ga4Data || ga4Data.noDataFound) {
        return `
            <div class="metric-card" style="--accent-color: #64748b;">
                <div class="metric-label">📊 Google Analytics</div>
                <div class="metric-value" style="color: #64748b; font-size: 1.2rem;">Not Connected</div>
                <div class="metric-trend trend-neutral">Connect GA4 for engagement data</div>
            </div>
        `;
    }

    const metrics = [
        { label: 'Page Views', value: formatNumber(ga4Data.pageViews || 0), trend: ga4Trends?.trends?.pageViews, color: '#f59e0b', icon: '📄' },
        { label: 'Avg. Time on Page', value: formatDuration(ga4Data.avgSessionDuration || 0), trend: ga4Trends?.trends?.avgSessionDuration, color: '#10b981', icon: '⏱️' },
        { label: 'Bounce Rate', value: `${((ga4Data.bounceRate || 0) * 100).toFixed(1)}%`, trend: ga4Trends?.trends?.bounceRate, color: '#ef4444', icon: '⚽' }
    ];

    return metrics.map(metric => `
        <div class="metric-card" style="--accent-color: ${metric.color};">
            <div class="metric-label">${metric.icon} ${metric.label}</div>
            <div class="metric-value" style="color: ${metric.color};">${metric.value}</div>
            ${metric.trend ? `
                <div class="metric-trend ${metric.trend.direction === 'up' ? (metric.label === 'Bounce Rate' ? 'trend-negative' : 'trend-positive') : metric.trend.direction === 'down' ? (metric.label === 'Bounce Rate' ? 'trend-positive' : 'trend-negative') : 'trend-neutral'}">
                    <span>${metric.trend.direction === 'up' ? '↗' : metric.trend.direction === 'down' ? '↘' : '→'}</span>
                    <span>${Math.abs(metric.trend.percentChange).toFixed(1)}% vs last period</span>
                </div>
            ` : '<div class="metric-trend trend-neutral">No trend data</div>'}
        </div>
    `).join('');
}

function createCrossMetrics(gscData, ga4Data) {
    let conversionRate = 0;
    let qualityScore = 50;

    if (gscData.clicks > 0 && ga4Data && ga4Data.pageViews > 0) {
        conversionRate = (ga4Data.pageViews / gscData.clicks) * 100;
        const positionScore = Math.max(0, 100 - (gscData.position * 10));
        const ctrScore = (gscData.ctr * 100) * 20;
        const bounceScore = ga4Data.bounceRate ? (1 - ga4Data.bounceRate) * 100 : 50;
        const timeScore = Math.min(100, (ga4Data.avgSessionDuration / 300) * 100);
        qualityScore = (positionScore + ctrScore + bounceScore + timeScore) / 4;
    }

    return `
        <div class="metric-card" style="--accent-color: #72A300;">
            <div class="metric-label">🚀 Traffic Conversion</div>
            <div class="metric-value" style="color: #72A300;">${conversionRate.toFixed(1)}%</div>
            <div class="metric-trend trend-neutral">Clicks → Page Views</div>
        </div>
        <div class="metric-card" style="--accent-color: #8b5cf6;">
            <div class="metric-label">⭐ Content Quality Score</div>
            <div class="metric-value" style="color: #8b5cf6;">${qualityScore.toFixed(0)}/100</div>
            <div class="metric-trend ${qualityScore >= 75 ? 'trend-positive' : qualityScore >= 50 ? 'trend-neutral' : 'trend-negative'}">
                ${qualityScore >= 75 ? 'Excellent' : qualityScore >= 50 ? 'Good' : 'Needs Work'}
            </div>
        </div>
    `;
}

function generateCrossPlatformInsights(gscData, ga4Data, gscTrends, ga4Trends) {
    const insights = [];

    if (gscData.position <= 5 && ga4Data && ga4Data.bounceRate > 0.7) {
        insights.push({
            priority: 'high',
            title: 'Search-Content Mismatch Detected',
            description: `Your page ranks well (#${gscData.position.toFixed(0)}) but has a high bounce rate (${(ga4Data.bounceRate * 100).toFixed(0)}%). Users aren't finding what they expect.`,
            action: 'Review search intent and align content with user expectations',
            color: '#ef4444'
        });
    }

    const expectedCTR = getCTRBenchmark(gscData.position);
    if (gscData.ctr < expectedCTR * 0.7) {
        insights.push({
            priority: 'medium',
            title: 'Title & Meta Description Optimization',
            description: `Your CTR (${(gscData.ctr * 100).toFixed(1)}%) is ${((expectedCTR - gscData.ctr) / expectedCTR * 100).toFixed(0)}% below average for position #${gscData.position.toFixed(0)}.`,
            action: 'Rewrite title tag and meta description to be more compelling',
            color: '#f59e0b'
        });
    }

    if (ga4Data && ga4Data.avgSessionDuration > 180 && gscData.position > 10) {
        insights.push({
            priority: 'medium',
            title: 'Hidden Gem - SEO Opportunity',
            description: `Users love this content (${formatDuration(ga4Data.avgSessionDuration)} avg. time) but it's buried on page 2. This has scaling potential.`,
            action: 'Invest in SEO optimization - keyword research and content expansion',
            color: '#f59e0b'
        });
    }

    if (insights.length === 0) {
        insights.push({
            priority: 'low',
            title: 'Steady Performance',
            description: 'Your page is performing within normal ranges. Focus on continuous improvement and monitoring trends.',
            action: 'Continue regular content updates and track performance monthly',
            color: '#10b981'
        });
    }

    return insights.slice(0, 3);
}

function createInsightCard(insight) {
    return `
        <div class="insight-card priority-${insight.priority}" style="--priority-color: ${insight.color}; --priority-rgb: ${hexToRgb(insight.color)};">
            <div class="insight-title">${insight.title}</div>
            <div class="insight-description">${insight.description}</div>
            <div class="insight-action">${insight.action}</div>
        </div>
    `;
}

function createTopQueriesSection(gscData) {
    if (!gscData.topQueries || gscData.topQueries.length === 0) {
        return `
            <div class="content-card">
                <div class="card-title">🎯 Top Search Queries</div>
                <div style="text-align: center; color: #64748b; padding: 20px;">No query data available</div>
            </div>
        `;
    }

    return `
        <div class="content-card">
            <div class="card-title">🎯 Top Search Queries</div>
            ${gscData.topQueries.slice(0, 5).map((query, index) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: ${index < 4 ? '1px solid #f3f4f6' : 'none'};">
                    <div>
                        <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">"${escapeHtml(query.query)}"</div>
                        <div style="font-size: 0.8rem; color: #64748b;">Position #${query.position.toFixed(0)}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: #72A300;">${query.clicks} clicks</div>
                        <div style="font-size: 0.8rem; color: #64748b;">${(query.ctr * 100).toFixed(1)}% CTR</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function createCTRAnalysisSection(gscData) {
    const expectedCTR = getCTRBenchmark(gscData.position);
    const performance = gscData.ctr >= expectedCTR * 1.2 ? 'excellent' : 
                       gscData.ctr >= expectedCTR ? 'good' : 
                       gscData.ctr >= expectedCTR * 0.8 ? 'fair' : 'poor';

    return `
        <div class="content-card">
            <div class="card-title">📊 CTR Performance Analysis</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #64748b;">Current CTR</span>
                <span style="font-weight: 700; font-size: 1.1rem; color: #1f2937;">${(gscData.ctr * 100).toFixed(2)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #64748b;">Expected CTR (Position #${gscData.position.toFixed(0)})</span>
                <span style="font-weight: 600; color: #64748b;">${(expectedCTR * 100).toFixed(2)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #64748b;">Performance</span>
                <span style="padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize;
                             background: ${performance === 'excellent' ? '#dcfce7' : performance === 'good' ? '#dbeafe' : performance === 'fair' ? '#fef3c7' : '#fee2e2'};
                             color: ${performance === 'excellent' ? '#166534' : performance === 'good' ? '#1e40af' : performance === 'fair' ? '#92400e' : '#dc2626'};">
                    ${performance}
                </span>
            </div>
            ${performance === 'poor' || performance === 'fair' ? `
                <div style="padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 3px solid #f59e0b; margin-top: 12px;">
                    <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">💡 Quick Win</div>
                    <div style="font-size: 0.85rem; color: #92400e;">
                        Improving CTR to industry average could generate ~${Math.round((expectedCTR - gscData.ctr) * gscData.impressions)} additional clicks per month.
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function createQuickWinsSection(insights) {
    const quickWins = insights.filter(insight => insight.priority === 'high' || insight.priority === 'medium');

    return `
        <div style="grid-column: 1 / -1;">
            <div class="content-card">
                <div class="card-title">⚡ Quick Wins & Priority Actions</div>
                ${quickWins.length > 0 ? quickWins.map((win, index) => `
                    <div style="display: flex; align-items: flex-start; gap: 16px; padding: 16px 0; border-bottom: ${index < quickWins.length - 1 ? '1px solid #f3f4f6' : 'none'};">
                        <div style="background: ${win.color}20; color: ${win.color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">
                            ${index + 1}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">${win.title}</div>
                            <div style="color: #64748b; margin-bottom: 8px; line-height: 1.4;">${win.description}</div>
                            <div style="font-size: 0.85rem; font-weight: 500; color: ${win.color}; background: ${win.color}15; padding: 4px 8px; border-radius: 6px; display: inline-block;">
                                ${win.action}
                            </div>
                        </div>
                        <div style="padding: 4px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
                                    background: ${win.priority === 'high' ? '#fee2e2' : '#fef3c7'};
                                    color: ${win.priority === 'high' ? '#dc2626' : '#d97706'};">
                            ${win.priority} Priority
                        </div>
                    </div>
                `).join('') : `
                    <div style="text-align: center; color: #64748b; padding: 20px;">
                        <div style="font-size: 1.5rem; margin-bottom: 8px;">🎉</div>
                        <div>No immediate issues found. Keep monitoring!</div>
                    </div>
                `}
            </div>
        </div>
    `;
}

function createCitizensImpactMetrics(ga4Data, gscData) {
    const avgReadingTime = ga4Data ? ga4Data.avgSessionDuration : 0;
    const informationConsumed = avgReadingTime > 0 ? Math.min(100, (avgReadingTime / 300) * 100) : 0;
    const serviceHelpfulness = gscData.clicks > 0 ? Math.min(100, (gscData.clicks / 100) * 100) : 0;

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 24px;">
            <div class="metric-card" style="--accent-color: #10b981;">
                <div class="metric-label">📖 Information Consumed</div>
                <div class="metric-value" style="color: #10b981;">${informationConsumed.toFixed(0)}%</div>
                <div class="metric-trend trend-neutral">Avg. reading time: ${formatDuration(avgReadingTime)}</div>
            </div>
            <div class="metric-card" style="--accent-color: #3b82f6;">
                <div class="metric-label">🎯 Citizens Helped</div>
                <div class="metric-value" style="color: #3b82f6;">${gscData.clicks || 0}</div>
                <div class="metric-trend trend-neutral">Monthly search visitors</div>
            </div>
            <div class="metric-card" style="--accent-color: #8b5cf6;">
                <div class="metric-label">📋 Service Effectiveness</div>
                <div class="metric-value" style="color: #8b5cf6;">${serviceHelpfulness.toFixed(0)}/100</div>
                <div class="metric-trend trend-neutral">Based on engagement patterns</div>
            </div>
        </div>

        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 24px; border-radius: 16px; border-left: 4px solid #0ea5e9;">
            <h3 style="margin: 0 0 16px 0; color: #0c4a6e; font-size: 1.1rem;">🏛️ Public Service Impact Summary</h3>
            <div style="font-size: 0.85rem; color: #0c4a6e; line-height: 1.5;">
                <strong>Citizens Impact Score:</strong> This page successfully helps 
                <strong>${gscData.clicks || 0} citizens per month</strong> find the information they need, 
                with an average engagement time of <strong>${formatDuration(avgReadingTime)}</strong>.
                ${informationConsumed > 75 ? ' Citizens are thoroughly consuming the information provided.' : 
                  informationConsumed > 40 ? ' Citizens are moderately engaging with the content.' : 
                  ' Consider improving content clarity and structure.'}
            </div>
        </div>
    `;
}

function createActionButtons(url) {
    return `
        <h3 style="margin: 0 0 16px 0; color: #374151;">Export & Share Analysis</h3>
        <div class="action-buttons">
            <button class="action-btn primary" onclick="window.open('${escapeHtml(url)}', '_blank')">
                <span>🔗</span><span>Visit Page</span>
            </button>
            <button class="action-btn secondary" onclick="alert('Export feature coming soon!')">
                <span>📊</span><span>Export Report</span>
            </button>
            <button class="action-btn secondary" onclick="alert('Copy feature coming soon!')">
                <span>📋</span><span>Copy Summary</span>
            </button>
        </div>
    `;
}

function initializeEnhancedDashboardInteractions(dashboard) {
    // Add any interactive functions here
}

// Helper functions
function extractPageTitle(url) {
    const segments = url.split('/').filter(s => s.length > 0);
    const lastSegment = segments[segments.length - 1];
    return lastSegment ? lastSegment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Page Analysis';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
}


// Add these functions to standalone-ga4-integration.js

window.GA4Integration.fetchTrafficSources = async function(pageUrl) {
    if (!window.GA4Integration.isConnected()) return null;
    console.log('[GA4] Fetching traffic sources for:', pageUrl);
    
    const propertyId = window.GA4Integration.getPropertyId();
    const pagePath = window.GA4Integration.urlToPath(pageUrl);
    
    try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dateRanges: [{
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                }],
                dimensions: [
                    { name: 'pagePath' },
                    { name: 'sessionDefaultChannelGrouping' }
                ],
                metrics: [{ name: 'sessions' }],
                dimensionFilter: {
                    filter: {
                        fieldName: 'pagePath',
                        stringFilter: {
                            matchType: 'EXACT',
                            value: pagePath
                        }
                    }
                },
                limit: 10
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const data = await response.json();
        const sources = {};
        let totalSessions = 0;
        
        if (data.rows) {
            data.rows.forEach(row => {
                const source = row.dimensionValues[1].value;
                const sessions = parseInt(row.metricValues[0].value);
                sources[source] = (sources[source] || 0) + sessions;
                totalSessions += sessions;
            });
        }
        
        const sourceBreakdown = Object.entries(sources).map(([source, sessions]) => ({
            source: source,
            sessions: sessions,
            percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0
        })).sort((a, b) => b.percentage - a.percentage);
        
        return { sources: sourceBreakdown, totalSessions };
        
    } catch (error) {
        console.error('[GA4] Error fetching traffic sources:', error);
        return null;
    }
};

window.GA4Integration.fetchDeviceData = async function(pageUrl) {
    if (!window.GA4Integration.isConnected()) return null;
    console.log('[GA4] Fetching device data for:', pageUrl);
    
    const propertyId = window.GA4Integration.getPropertyId();
    const pagePath = window.GA4Integration.urlToPath(pageUrl);
    
    try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dateRanges: [{
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                }],
                dimensions: [
                    { name: 'pagePath' },
                    { name: 'deviceCategory' }
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'bounceRate' },
                    { name: 'averageSessionDuration' }
                ],
                dimensionFilter: {
                    filter: {
                        fieldName: 'pagePath',
                        stringFilter: {
                            matchType: 'EXACT',
                            value: pagePath
                        }
                    }
                },
                limit: 10
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const data = await response.json();
        const devices = {};
        
        if (data.rows) {
            data.rows.forEach(row => {
                const device = row.dimensionValues[1].value;
                devices[device] = {
                    sessions: parseInt(row.metricValues[0].value),
                    bounceRate: parseFloat(row.metricValues[1].value),
                    avgDuration: parseFloat(row.metricValues[2].value)
                };
            });
        }
        
        return devices;
        
    } catch (error) {
        console.error('[GA4] Error fetching device data:', error);
        return null;
    }
};

console.log('✅ Enhanced GA4 functions added to integration!');

    

window.showEnhancedDashboardReport = window.showDetailedGSCAnalysis;

})();
