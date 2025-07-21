// gsc-integration-module.js - Complete Enhanced Content Writer Version with Simplified Tooltips

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
    let fetchInProgress = false;
    let gapiInited = false;
    let gisInited = false;

    // Lazy loading variables
    const pendingRequests = new Map();
    const hoverQueue = new Set();
    let batchTimeout = null;
    let cacheCleanupInterval = null;

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
                    
                    const response = await gapi.client.request({
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
                    
                    const response = await gapi.client.request({
                        path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                        method: 'POST',
                        body: {
                            startDate: thirtyDaysAgo.toISOString().split('T')[0],
                            endDate: today.toISOString().split('T')[0],
                            dimensions: ['page'],
                            rowLimit: 10
                        }
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
    addLoadingAnimationStyles(); // Add this line
    initializeGoogleAPI();
    hookIntoSitemapLoader();
    hookIntoTooltips();
    listenForTreeReady();
    setupCacheCleanup();
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
        
        if (response.error) {
            console.error('[GSC Integration] Authentication error:', response);
            updateConnectionStatus(false);
            return;
        }
        
        accessToken = response.access_token;
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
                try {
                    tokenClient.requestAccessToken({ prompt: '' });
                } catch (error) {
                    console.error('[GSC Integration] Error requesting access token:', error);
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
            
            const sitesResponse = await gapi.client.request({
                path: 'https://www.googleapis.com/webmasters/v3/sites',
                method: 'GET'
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
            
            let matchedSite = sites.find(site => {
                const siteHost = new URL(site.siteUrl).hostname.replace('www.', '');
                const currentHost = currentDomain.replace('www.', '');
                return siteHost === currentHost;
            });
            
            if (!matchedSite) {
                matchedSite = sites.find(site => 
                    site.siteUrl.includes(currentDomain) || 
                    currentDomain.includes(new URL(site.siteUrl).hostname)
                );
            }
            
            if (!matchedSite) {
                matchedSite = await showSiteSelector(sites);
                if (!matchedSite) {
                    hideGSCLoadingIndicator();
                    fetchInProgress = false;
                    return;
                }
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
            
            if (error.status === 401) {
                updateConnectionStatus(false);
                alert('Your session has expired. Please reconnect to Google Search Console.');
            } else if (error.status === 403) {
                alert('Permission denied. Please make sure you have access to this Search Console property.');
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
        const promise = fetchSingleNodeData(node);
        pendingRequests.set(node.url, promise);
        
        try {
            const result = await promise;
            return result;
        } finally {
            pendingRequests.delete(node.url);
        }
    }

    // Enhanced function to fetch comprehensive data for a single node
    async function fetchSingleNodeData(node) {
        try {
            debugLog('Fetching comprehensive GSC data for:', node.url);
            debugLog('GSC Site URL is:', gscSiteUrl);
            
            const today = new Date();
            const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
            const ninetyDaysAgo = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));
            
            const variations = createUrlVariations(node.url);
            debugLog('Trying URL variations:', variations);
            
            for (const variation of variations) {
                try {
                    debugLog('Trying variation:', variation);
                    
                    // 1. Get page performance summary
                    const pageResponse = await gapi.client.request({
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

                    debugLog('API Response for', variation, ':', pageResponse);
                    debugLog('Response result:', pageResponse.result);
                    debugLog('Response rows:', pageResponse.result?.rows);
                    debugLog('Response row count:', pageResponse.result?.rows?.length || 0);

                    if (pageResponse.result.rows && pageResponse.result.rows.length > 0) {
                        // 2. Get top queries for this page
                        const queriesResponse = await gapi.client.request({
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

                        // 3. Get opportunity queries (high impressions, low CTR)
                        const opportunityResponse = await gapi.client.request({
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

                        // 4. Get trend data (compare periods)
                        const previousPeriodResponse = await gapi.client.request({
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
                        
                        gscDataMap.set(node.url, gscData);
                        debugLog(`Found comprehensive GSC data for ${node.url}:`, gscData);
                        return gscData;
                    }
                } catch (error) {
                    debugLog(`Error trying variation ${variation}:`, error);
                }
            }
            
            // No data found
            const noData = { 
                clicks: 0, impressions: 0, ctr: 0, position: 0, 
                noDataFound: true, fetchedAt: Date.now() 
            };
            gscDataMap.set(node.url, noData);
            debugLog(`No GSC data found for ${node.url}`);
            return noData;
            
        } catch (error) {
            console.error('Error fetching comprehensive GSC data:', error);
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

    // Enhanced URL variations function
    function createUrlVariations(originalUrl) {
        const variations = new Set();
        
        // Add original URL
        variations.add(originalUrl);
        
        try {
            const urlObj = new URL(originalUrl);
            const protocol = urlObj.protocol;
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;
            const search = urlObj.search;
            
            // Protocol variations (http/https)
            const otherProtocol = protocol === 'http:' ? 'https:' : 'http:';
            variations.add(`${otherProtocol}//${hostname}${pathname}${search}`);
            
            // www variations
            if (hostname.startsWith('www.')) {
                const withoutWww = hostname.substring(4);
                variations.add(`${protocol}//${withoutWww}${pathname}${search}`);
                variations.add(`${otherProtocol}//${withoutWww}${pathname}${search}`);
            } else {
                variations.add(`${protocol}//www.${hostname}${pathname}${search}`);
                variations.add(`${otherProtocol}//www.${hostname}${pathname}${search}`);
            }
            
            // Trailing slash variations
            if (pathname.endsWith('/') && pathname.length > 1) {
                const withoutSlash = pathname.slice(0, -1);
                variations.add(`${protocol}//${hostname}${withoutSlash}${search}`);
                variations.add(`${otherProtocol}//${hostname}${withoutSlash}${search}`);
                
                if (hostname.startsWith('www.')) {
                    const withoutWww = hostname.substring(4);
                    variations.add(`${protocol}//${withoutWww}${withoutSlash}${search}`);
                    variations.add(`${otherProtocol}//${withoutWww}${withoutSlash}${search}`);
                } else {
                    variations.add(`${protocol}//www.${hostname}${withoutSlash}/${search}`);
                    variations.add(`${otherProtocol}//www.${hostname}${withoutSlash}/${search}`);
                }
            } else if (!pathname.endsWith('/')) {
                variations.add(`${protocol}//${hostname}${pathname}/${search}`);
                variations.add(`${otherProtocol}//${hostname}${pathname}/${search}`);
            }
            
            // Language prefix variations for MABS.ie
            if (pathname.includes('/en/') || pathname.includes('/ga/')) {
                const withoutLangPrefix = pathname.replace('/en/', '/').replace('/ga/', '/');
                variations.add(`${protocol}//${hostname}${withoutLangPrefix}${search}`);
                variations.add(`${otherProtocol}//${hostname}${withoutLangPrefix}${search}`);
                
                if (hostname.startsWith('www.')) {
                    const withoutWww = hostname.substring(4);
                    variations.add(`${protocol}//${withoutWww}${withoutLangPrefix}${search}`);
                    variations.add(`${otherProtocol}//${withoutWww}${withoutLangPrefix}${search}`);
                } else {
                    variations.add(`${protocol}//www.${hostname}${withoutLangPrefix}${search}`);
                    variations.add(`${otherProtocol}//www.${hostname}${withoutLangPrefix}${search}`);
                }
            }
            
        } catch (e) {
            debugLog('Error parsing URL for variations:', originalUrl, e);
        }
        
        // Handle relative URLs
        if (originalUrl.startsWith('/') && gscSiteUrl) {
            const baseUrl = gscSiteUrl.replace(/\/$/, '');
            variations.add(baseUrl + originalUrl);
        }
        
        // Convert to array and limit to prevent too many requests
        const result = Array.from(variations).slice(0, 8);
        debugLog('Generated variations for', originalUrl, ':', result);
        return result;
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
            gscBtn.classList.add('connected');
            gscBtn.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%) !important';
            gscBtn.style.color = 'white !important';
            gscBtn.style.borderColor = '#4caf50 !important';
            gscBtn.style.boxShadow = '0 2px 8px rgba(76,175,80,0.3)';
            
            // Add subtle glow to the Google icon when connected
            if (gscIcon) {
                gscIcon.style.filter = 'drop-shadow(0 0 2px rgba(255,255,255,0.5))';
            }
            
            if (gscText) gscText.textContent = 'GSC Connected';
        } else {
            gscBtn.classList.remove('connected');
            gscBtn.style.background = '#ffffff !important';
            gscBtn.style.color = '#3c4043 !important';
            gscBtn.style.borderColor = '#dadce0 !important';
            gscBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            
            // Reset icon glow
            if (gscIcon) {
                gscIcon.style.filter = '';
            }
            
            if (gscText) gscText.textContent = 'Connect to Search Console';
        }
    }
    
    debugLog('Connection status updated:', connected);
    
    if (!connected) {
        resetGSCData();
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
            
            <!-- Header with matched freshness info -->
            ${freshnessData ? `
                <div style="background: #f0f4ff; padding: 8px; border-radius: 6px; margin-bottom: 12px; border-left: 3px solid #4a90e2;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.8rem; color: #666;">📅 Last Updated:</span>
                            <span style="font-size: 0.85rem; color: #333; font-weight: 500;">${freshnessData.formattedDate}</span>
                            <span style="font-size: 0.7rem; color: #999;">(${freshnessData.relativeTime})</span>
                        </div>
                        <span style="background: ${freshnessData.freshnessColor}20; color: ${freshnessData.freshnessColor}; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 500;">${freshnessData.freshnessLabel}</span>
                    </div>
                </div>
            ` : ''}
            
            <!-- Page Info Section -->
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 12px; border-left: 3px solid #6c757d;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="color: #666;">🏷️</span>
                        <span style="font-weight: 500; color: #333;">${pageInfo.type}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="color: #666;">📏 Level ${pageInfo.depth}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="color: #666;">👶</span>
                        <span style="font-weight: 500; color: ${pageInfo.children > 0 ? '#28a745' : '#6c757d'};">${pageInfo.children} children</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="color: #666;">👫</span>
                        <span style="font-weight: 500; color: ${pageInfo.siblings > 0 ? '#007bff' : '#6c757d'};">${pageInfo.siblings} siblings</span>
                    </div>
                </div>
            </div>
            
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

// Add CSS animations for the loading effects
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


    




    
    function updateTooltipWithGSCData(tooltip, gscData) {
    const placeholder = tooltip.querySelector('#gsc-placeholder');
    if (!placeholder) return;
    
    if (!gscData || gscData.noDataFound) {
        placeholder.innerHTML = gscData?.noDataFound ? 
            '<div style="color: #999; font-size: 0.8rem;">📭 No search data found</div>' : 
            '<div style="color: #999; font-size: 0.8rem;">❌ Performance data unavailable</div>';
        return;
    }
    
    // Get the original node data to access lastModified and page info
    const tooltipContainer = tooltip.closest('.enhanced-tooltip');
    const originalData = tooltipContainer?._nodeData || {};
    
    // Get page info
    const treeContext = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
    const pageInfo = getPageInfo(originalData, treeContext);
    
    // Create enhanced GSC content with page info
    const performanceScore = calculateSimplePerformanceScore(gscData);
    const gscHtml = `
        <div style="background: linear-gradient(135deg, #f8f9ff 0%, #e8f1fe 100%); padding: 16px; border-radius: 8px; border: 1px solid #e3f2fd;">
            
            <!-- Header with date info if available -->
            
            
            
            
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
    
    placeholder.outerHTML = gscHtml;
}




    
    
    function updateGSCPlaceholder(tooltip, message) {
        const placeholder = tooltip.querySelector('#gsc-placeholder');
        if (placeholder) {
            placeholder.innerHTML = `<div style="color: #999; font-size: 0.8rem;">${message}</div>`;
        }
    }

    // Helper functions for simplified tooltips
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
        
        /* GSC Integration Styles with Google Material Design */
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
        }
        
        .nav-gsc-btn:hover {
            background: #f8f9fa !important;
            border-color: #4285f4 !important;
            box-shadow: 0 2px 8px rgba(66, 133, 244, 0.15) !important;
            transform: translateY(-1px);
        }
        
        .nav-gsc-btn.connected {
            background: linear-gradient(135deg, #4caf50 0%, #45a049 100%) !important;
            color: white !important;
            border-color: #4caf50 !important;
            box-shadow: 0 2px 8px rgba(76,175,80,0.3);
        }
        
        .nav-gsc-btn.connected:hover {
            background: linear-gradient(135deg, #45a049 0%, #388e3c 100%) !important;
            box-shadow: 0 3px 12px rgba(76,175,80,0.4) !important;
            transform: translateY(-2px);
        }

        #gscIcon {
            transition: all 0.2s ease;
            flex-shrink: 0;
        }

        #gscText {
            font-weight: 500;
            white-space: nowrap;
            letter-spacing: 0.25px;
        }

        /* Ripple effect on click */
        .nav-gsc-btn:active {
            transform: translateY(0);
            box-shadow: 0 1px 4px rgba(0,0,0,0.2) !important;
        }

        /* Focus accessibility */
        .nav-gsc-btn:focus {
            outline: 2px solid #4285f4;
            outline-offset: 2px;
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
    
    debugLog('Enhanced GSC styles added to page');
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
    window.showDetailedGSCAnalysis = function(url) {
        const gscData = gscDataMap.get(url);
        if (!gscData || gscData.noDataFound) {
            alert('No GSC data available for this page');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
            align-items: center; justify-content: center; padding: 20px;
        `;
        
        modal.onclick = () => modal.remove();
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white; padding: 30px; border-radius: 15px; 
            max-width: 900px; max-height: 90vh; overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3); position: relative;
        `;
        content.onclick = e => e.stopPropagation();
        
        content.innerHTML = generateDetailedAnalysisHTML(url, gscData);
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute; top: 15px; right: 15px; background: none; border: none;
            font-size: 28px; color: #666; cursor: pointer;
        `;
        closeBtn.onclick = () => modal.remove();
        content.appendChild(closeBtn);
        
        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    function generateDetailedAnalysisHTML(url, gscData) {
        return `
            <h2 style="color: #1f4788; margin-bottom: 20px;">📊 Content Performance Analysis</h2>
            <div style="color: #666; margin-bottom: 20px; word-break: break-all;">${url}</div>
            
            <!-- Performance Overview -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px;">
                <div style="background: #f8f9ff; padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #4a90e2;">${gscData.clicks.toLocaleString()}</div>
                    <div style="color: #666;">Total Clicks</div>
                    ${gscData.trend ? `<div style="font-size: 0.8rem; color: ${gscData.trend.clicksChange >= 0 ? '#4caf50' : '#f44336'}">
                        ${gscData.trend.clicksChange > 0 ? '+' : ''}${gscData.trend.clicksChange}% vs previous period
                    </div>` : ''}
                </div>
                <div style="background: #f8f9ff; padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #4a90e2;">${gscData.impressions.toLocaleString()}</div>
                    <div style="color: #666;">Impressions</div>
                    ${gscData.trend ? `<div style="font-size: 0.8rem; color: ${gscData.trend.impressionsChange >= 0 ? '#4caf50' : '#f44336'}">
                        ${gscData.trend.impressionsChange > 0 ? '+' : ''}${gscData.trend.impressionsChange}%
                    </div>` : ''}
                </div>
                <div style="background: #f8f9ff; padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #4a90e2;">${(gscData.ctr * 100).toFixed(1)}%</div>
                    <div style="color: #666;">Click-through Rate</div>
                </div>
                <div style="background: #f8f9ff; padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #4a90e2;">#${gscData.position.toFixed(0)}</div>
                    <div style="color: #666;">Average Position</div>
                    ${gscData.trend && gscData.trend.positionChange ? `<div style="font-size: 0.8rem; color: ${gscData.trend.positionChange >= 0 ? '#4caf50' : '#f44336'}">
                        ${gscData.trend.positionChange > 0 ? '+' : ''}${gscData.trend.positionChange} positions
                    </div>` : ''}
                </div>
            </div>
            
            <!-- Top Performing Queries -->
            ${gscData.topQueries && gscData.topQueries.length > 0 ? `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #1f4788;">🎯 Top Performing Keywords</h3>
                <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background: #1f4788; color: white; padding: 12px; font-weight: bold;">
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 10px;">
                            <div>Search Query</div>
                            <div style="text-align: center;">Clicks</div>
                            <div style="text-align: center;">Impressions</div>
                            <div style="text-align: center;">CTR</div>
                            <div style="text-align: center;">Position</div>
                        </div>
                    </div>
                    ${gscData.topQueries.map((query, i) => `
                        <div style="padding: 12px; background: ${i % 2 === 0 ? '#f9f9f9' : 'white'}; border-bottom: 1px solid #f0f0f0;">
                            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 10px; align-items: center;">
                                <div style="font-weight: 500;">${escapeHtml(query.query)}</div>
                                <div style="text-align: center;">${query.clicks}</div>
                                <div style="text-align: center;">${query.impressions}</div>
                                <div style="text-align: center;">${(query.ctr * 100).toFixed(1)}%</div>
                                <div style="text-align: center; color: ${query.position <= 3 ? '#4caf50' : query.position <= 10 ? '#ff9800' : '#f44336'}">
                                    #${query.position.toFixed(0)}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            <!-- Optimization Opportunities -->
            ${gscData.opportunities && gscData.opportunities.length > 0 ? `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #ff9800;">⚡ Content Optimization Opportunities</h3>
                <p style="color: #666; margin-bottom: 15px;">Keywords with high potential for improvement</p>
                ${gscData.opportunities.map(opp => `
                    <div style="background: #fff8e1; border-left: 4px solid #ff9800; padding: 15px; margin-bottom: 10px; border-radius: 6px;">
                        <div style="font-weight: bold; color: #e65100; margin-bottom: 5px;">"${escapeHtml(opp.query)}"</div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; font-size: 0.9rem;">
                            <div><strong>Impressions:</strong> ${opp.impressions}</div>
                            <div><strong>Clicks:</strong> ${opp.clicks}</div>
                            <div><strong>CTR:</strong> ${(opp.ctr * 100).toFixed(1)}%</div>
                            <div><strong>Position:</strong> #${opp.position.toFixed(0)}</div>
                            <div style="color: #ff9800;"><strong>Potential:</strong> +${opp.potentialClicks} clicks</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <!-- Content Insights & Recommendations -->
            ${gscData.insights && gscData.insights.length > 0 ? `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #1f4788;">💡 Content Recommendations</h3>
                ${gscData.insights.map(insight => `
                    <div style="background: #e8f2ff; border-left: 4px solid #4a90e2; padding: 15px; margin-bottom: 10px; border-radius: 6px;">
                        <div style="font-weight: bold; color: #1565c0; margin-bottom: 5px;">${insight.title}</div>
                        <div style="color: #333;">${insight.description}</div>
                        <div style="margin-top: 8px;">
                            <span style="background: #1f4788; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                                ${insight.priority.toUpperCase()} PRIORITY
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <!-- Export Options -->
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <button onclick="exportGSCData('${url}')" 
                        style="background: #4a90e2; color: white; border: none; padding: 10px 20px; 
                               border-radius: 6px; margin-right: 10px; cursor: pointer;">
                    📊 Export Data
                </button>
                <button onclick="this.closest('.modal').remove()" 
                        style="background: #666; color: white; border: none; padding: 10px 20px; 
                               border-radius: 6px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
    }

    // Export GSC data
    window.exportGSCData = function(url) {
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
    };

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
    });

})();
