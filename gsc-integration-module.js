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
                gscBtn.style.background = '#4caf50';
                gscBtn.style.color = 'white';
                if (gscIcon) gscIcon.textContent = '✓';
                if (gscText) gscText.textContent = 'GSC Connected';
            } else {
                gscBtn.classList.remove('connected');
                gscBtn.style.background = '';
                gscBtn.style.color = '';
                if (gscIcon) gscIcon.textContent = '🔍';
                if (gscText) gscText.textContent = 'Connect GSC';
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
            gscButton.innerHTML = `
                <span id="gscIcon">🔍</span>
                <span id="gscText">Connect GSC</span>
            `;
            
            gscButton.style.cssText = `
                display: flex !important;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                margin: 0 8px;
                background: #f0f0f0;
                border: 1px solid #ddd;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                color: #333;
                transition: all 0.3s ease;
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
            
            setTimeout(() => {
                const btn = document.getElementById('gscConnectBtn');
                if (btn) {
                    debugLog('GSC button visibility check:', {
                        display: window.getComputedStyle(btn).display,
                        visibility: window.getComputedStyle(btn).visibility,
                        opacity: window.getComputedStyle(btn).opacity,
                        width: btn.offsetWidth,
                        height: btn.offsetHeight
                    });
                }
            }, 100);
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
    
    // Create enhanced tooltip structure
    const tooltip = createEnhancedTooltip(d.data, d);
    
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

function createEnhancedTooltip(data, d) {
    const tooltip = document.createElement('div');
    tooltip.className = 'enhanced-tooltip simplified-tooltip';
    tooltip.style.cssText = `
        position: absolute;
        background: linear-gradient(135deg, #ffffff 0%, #f8fafe 100%);
        border: 1px solid #e3f2fd;
        border-radius: 12px;
        padding: 0;
        box-shadow: 0 8px 32px rgba(26, 115, 232, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
        z-index: 10000;
        max-width: 420px;
        min-width: 320px;
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        overflow: hidden;
    `;
    
    // Build enhanced content
    let html = createEnhancedHeader(data) + createPageInfoSection(data, d);
    
    // Add GSC placeholder if connected
    if (gscConnected && data.url) {
        html += '<div id="gsc-placeholder" style="margin: 16px; padding: 16px; background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1976d2;"><div style="display: flex; align-items: center; gap: 8px; color: #1565c0;"><div class="loading-dots">📊</div><span>Loading performance data...</span></div></div>';
    }
    
    tooltip.innerHTML = html;
    
    // Trigger fade in
    setTimeout(() => {
        tooltip.style.opacity = '1';
    }, 10);
    
    return tooltip;
}  


function createEnhancedHeader(data) {
    const now = new Date();
    let freshnessInfo = '';
    let lastModifiedInfo = '';
    
    if (data.lastModified) {
        const lastMod = new Date(data.lastModified);
        const daysSince = Math.floor((now - lastMod) / (1000 * 60 * 60 * 24));
        
        let freshnessLabel, freshnessColor, freshnessBg;
        if (daysSince < 7) {
            freshnessLabel = 'Fresh'; freshnessColor = '#2e7d32'; freshnessBg = '#e8f5e8';
        } else if (daysSince < 30) {
            freshnessLabel = 'Recent'; freshnessColor = '#558b2f'; freshnessBg = '#f1f8e9';
        } else if (daysSince < 90) {
            freshnessLabel = 'Good'; freshnessColor = '#1976d2'; freshnessBg = '#e3f2fd';
        } else if (daysSince < 180) {
            freshnessLabel = 'Aging'; freshnessColor = '#f57f17'; freshnessBg = '#fff8e1';
        } else {
            freshnessLabel = 'Old'; freshnessColor = '#d32f2f'; freshnessBg = '#ffebee';
        }
        
        freshnessInfo = `<span style="background: ${freshnessBg}; color: ${freshnessColor}; padding: 4px 10px; border-radius: 16px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${freshnessLabel}</span>`;
        lastModifiedInfo = `<div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">📅 Updated ${formatRelativeDate(lastMod)}</div>`;
    }
    
    const urlSection = data.url ? `
        <div style="margin-top: 8px;">
            <a href="${data.url}" target="_blank" rel="noopener noreferrer" 
               style="color: #1976d2; text-decoration: none; font-size: 0.8rem; word-break: break-all; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: #f0f7ff; border-radius: 6px;">
                <span>🔗</span>
                <span>${data.url}</span>
                <span style="opacity: 0.7;">↗</span>
            </a>
            ${lastModifiedInfo}
        </div>
    ` : lastModifiedInfo;
    
    return `
        <div style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; padding: 16px; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; opacity: 0.6;"></div>
            <div style="position: relative; z-index: 1;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 12px;">
                    <h4 style="margin: 0; font-size: 1.1rem; font-weight: 600; flex: 1; line-height: 1.3;">${data.name}</h4>
                    ${freshnessInfo}
                </div>
                ${urlSection}
            </div>
        </div>
    `;
}


unction createPageInfoSection(data, d) {
    // Calculate page structure info
    let descendantCount = 0;
    let siblingCount = 0;
    
    function countDescendants(node) {
        if (node.children) {
            descendantCount += node.children.length;
            node.children.forEach(child => countDescendants(child));
        } else if (node._children) {
            descendantCount += node._children.length;
            node._children.forEach(child => countDescendants(child));
        }
    }
    countDescendants(d);

    if (d.parent) {
        siblingCount = (d.parent.children ? d.parent.children.length : 
                       d.parent._children ? d.parent._children.length : 0) - 1;
    }
    
    const isLeaf = !d.children && !d._children;
    const nodeType = d.depth === 0 ? 'Root' : 
                    d.depth === 1 ? 'Category' :
                    d.depth === 2 ? 'Section' :
                    isLeaf ? 'Page' : 'Container';
    
    const typeIcon = d.depth === 0 ? '🏠' : 
                    d.depth === 1 ? '📁' :
                    d.depth === 2 ? '📂' :
                    isLeaf ? '📄' : '🗂️';
    
    const typeColor = d.depth === 0 ? '#e53e3e' : 
                     d.depth === 1 ? '#3182ce' :
                     d.depth === 2 ? '#38a169' :
                     isLeaf ? '#805ad5' : '#718096';

    return `
        <div style="padding: 16px; background: #fafbfc;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 1.2rem;">${typeIcon}</div>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Type</div>
                        <div style="font-weight: 600; color: ${typeColor}; font-size: 0.9rem;">${nodeType}</div>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 1.2rem;">📏</div>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Level</div>
                        <div style="font-weight: 600; color: #374151; font-size: 0.9rem;">${d.depth}</div>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 1.2rem;">${isLeaf ? '👫' : '👥'}</div>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">${isLeaf ? 'Siblings' : 'Children'}</div>
                        <div style="font-weight: 600; color: #374151; font-size: 0.9rem;">${isLeaf ? siblingCount : descendantCount}</div>
                    </div>
                </div>
                
                ${data.pageCount ? `
                <div style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 1.2rem;">📊</div>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Total Pages</div>
                        <div style="font-weight: 600; color: #374151; font-size: 0.9rem;">${data.pageCount.toLocaleString()}</div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
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
        
        // Add GSC placeholder if connected
        if (gscConnected && data.url) {
            html += '<div id="gsc-placeholder" style="margin-top: 12px; color: #666; font-size: 0.9rem;">📊 Loading performance data...</div>';
        }
        
        tooltip.innerHTML = html;
        
        // Trigger fade in
        setTimeout(() => {
            tooltip.style.opacity = '1';
        }, 10);
        
        return tooltip;
    }
    
    function createBasicContent(data) {
        const now = new Date();
        let freshnessInfo = '';
        
        if (data.lastModified) {
            const lastMod = new Date(data.lastModified);
            const daysSince = Math.floor((now - lastMod) / (1000 * 60 * 60 * 24));
            const freshnessLabel = daysSince < 30 ? 'Recent' : 
                                 daysSince < 90 ? 'Fresh' : 
                                 daysSince < 180 ? 'Aging' : 'Old';
            const freshnessColor = daysSince < 30 ? '#4caf50' : 
                                  daysSince < 90 ? '#8bc34a' : 
                                  daysSince < 180 ? '#ff9800' : '#f44336';
            freshnessInfo = `<span style="background: ${freshnessColor}20; color: ${freshnessColor}; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 500;">${freshnessLabel}</span>`;
        }
        
        return `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; gap: 10px;">
                    <h4 style="margin: 0; color: #1f4788; font-size: 1rem; font-weight: 600; flex: 1;">${data.name}</h4>
                    ${freshnessInfo}
                </div>
                ${data.url ? `<div style="font-size: 0.75rem; color: #666; word-break: break-all; margin-bottom: 8px;">${data.url}</div>` : ''}
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
        
        try {
            const gscData = await fetchNodeGSCData(data);
            
            // Check if tooltip still exists and is the current one
            if (tooltip === currentTooltip && tooltip.parentNode) {
                updateTooltipWithGSCData(tooltip, gscData);
            }
        } catch (error) {
            console.warn('GSC data loading failed:', error);
            if (tooltip === currentTooltip && tooltip.parentNode) {
                updateGSCPlaceholder(tooltip, 'Performance data unavailable');
            }
        }
    }
    
    function updateTooltipWithGSCData(tooltip, gscData) {
    const placeholder = tooltip.querySelector('#gsc-placeholder');
    if (!placeholder) return;
    
    if (!gscData || gscData.noDataFound) {
        placeholder.innerHTML = gscData?.noDataFound ? 
            '<div style="text-align: center; color: #64748b; padding: 12px;"><div style="font-size: 2rem; margin-bottom: 8px;">📭</div><div style="font-weight: 500;">No search data found</div><div style="font-size: 0.8rem; opacity: 0.8;">Page may be new or not indexed</div></div>' : 
            '<div style="text-align: center; color: #64748b; padding: 12px;"><div style="font-size: 2rem; margin-bottom: 8px;">❌</div><div style="font-weight: 500;">Performance data unavailable</div></div>';
        return;
    }
    
    // Create enhanced GSC content with trends and better styling
    const performanceScore = calculateSimplePerformanceScore(gscData);
    const trendData = gscData.trend || {};
    
    const gscHtml = `
        <div style="margin: 16px; background: linear-gradient(135deg, #f8fafe 0%, #e8f4f8 100%); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(26, 115, 232, 0.08);">
            <div style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; padding: 14px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">📊</span>
                    <span style="font-weight: 600; font-size: 1rem;">Search Performance (30d)</span>
                </div>
                <div style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px;">
                    <div style="width: 8px; height: 8px; background: ${getScoreColor(performanceScore)}; border-radius: 50%;"></div>
                    <span style="font-weight: 700; font-size: 0.9rem;">${performanceScore}/100</span>
                </div>
            </div>
            
            <div style="padding: 16px;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
                    ${createMetricCard('Clicks', formatNumber(gscData.clicks), trendData.clicksChange, '👆', '#10b981')}
                    ${createMetricCard('Impressions', formatNumber(gscData.impressions), trendData.impressionsChange, '👀', '#3b82f6')}
                    ${createMetricCard('CTR', (gscData.ctr * 100).toFixed(1) + '%', calculateCTRTrend(gscData, trendData), '🎯', '#8b5cf6')}
                    ${createMetricCard('Position', '#' + gscData.position.toFixed(1), trendData.positionChange, '📍', '#f59e0b', true)}
                </div>
                
                ${gscData.topQueries && gscData.topQueries.length > 0 ? `
                    <div style="background: white; border-radius: 10px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-left: 4px solid #1976d2;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="font-size: 0.9rem; color: #374151; font-weight: 600;">🎯 Top Search Query</div>
                            ${gscData.topQueries[0].opportunity ? `
                                <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">
                                    ⚡ OPPORTUNITY
                                </span>
                            ` : ''}
                        </div>
                        <div style="font-size: 1rem; font-weight: 600; color: #111827; margin-bottom: 8px; line-height: 1.3;">"${escapeHtml(gscData.topQueries[0].query)}"</div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                            <div style="color: #10b981; font-weight: 600;">${gscData.topQueries[0].clicks} clicks</div>
                            <div style="color: #3b82f6; font-weight: 600;">#${gscData.topQueries[0].position.toFixed(0)} position</div>
                            <div style="color: #8b5cf6; font-weight: 600;">${(gscData.topQueries[0].ctr * 100).toFixed(1)}% CTR</div>
                        </div>
                    </div>
                ` : ''}
                
                ${gscData.opportunities && gscData.opportunities.length > 0 ? `
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 12px; border-radius: 10px; border-left: 4px solid #f59e0b; margin-top: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px; color: #92400e; font-weight: 600; font-size: 0.9rem;">
                            <span>⚡</span>
                            <span>${gscData.opportunities.length} optimization opportunities found</span>
                        </div>
                    </div>
                ` : ''}
                
                <div style="text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                    <button onclick="window.showDetailedGSCAnalysis && window.showDetailedGSCAnalysis('${gscData.url}')" 
                            style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(25, 118, 210, 0.3);">
                        📈 Full Analysis & Export
                    </button>
                </div>
            </div>
        </div>
    `;
    
    placeholder.outerHTML = gscHtml;
}

function createMetricCard(label, value, trend, icon, color, isPosition = false) {
    let trendElement = '';
    
    if (trend !== null && trend !== undefined && !isNaN(trend)) {
        const trendValue = parseFloat(trend);
        let trendColor, trendIcon, trendDirection;
        
        if (isPosition) {
            // For position, lower is better (inverted logic)
            if (trendValue > 0) {
                trendColor = '#ef4444'; trendIcon = '↗'; trendDirection = 'worse';
            } else if (trendValue < 0) {
                trendColor = '#10b981'; trendIcon = '↘'; trendDirection = 'better';
            } else {
                trendColor = '#6b7280'; trendIcon = '→'; trendDirection = 'same';
            }
        } else {
            // For other metrics, higher is better
            if (trendValue > 0) {
                trendColor = '#10b981'; trendIcon = '↗'; trendDirection = 'better';
            } else if (trendValue < 0) {
                trendColor = '#ef4444'; trendIcon = '↘'; trendDirection = 'worse';
            } else {
                trendColor = '#6b7280'; trendIcon = '→'; trendDirection = 'same';
            }
        }
        
        trendElement = `
            <div style="display: flex; align-items: center; gap: 2px; margin-top: 4px; padding: 2px 6px; background: ${trendColor}20; border-radius: 12px; width: fit-content;">
                <span style="color: ${trendColor}; font-size: 0.7rem; font-weight: 700;">${trendIcon}</span>
                <span style="color: ${trendColor}; font-size: 0.7rem; font-weight: 600;">${Math.abs(trendValue).toFixed(1)}%</span>
            </div>
        `;
    }
    
    return `
        <div style="background: white; padding: 12px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); border-left: 3px solid ${color};">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="font-size: 0.9rem;">${icon}</span>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${label}</span>
            </div>
            <div style="font-size: 1.4rem; font-weight: 700; color: #111827; line-height: 1.2; margin-bottom: 2px;">${value}</div>
            ${trendElement}
        </div>
    `;
}

// Helper function to format relative dates
function formatRelativeDate(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
}

// Helper function to calculate CTR trend
function calculateCTRTrend(gscData, trendData) {
    if (!trendData || !trendData.clicksChange || !trendData.impressionsChange) return null;
    
    const currentCTR = gscData.ctr;
    const clicksChange = parseFloat(trendData.clicksChange) / 100;
    const impressionsChange = parseFloat(trendData.impressionsChange) / 100;
    
    const previousClicks = gscData.clicks / (1 + clicksChange);
    const previousImpressions = gscData.impressions / (1 + impressionsChange);
    const previousCTR = previousClicks / previousImpressions;
    
    return ((currentCTR - previousCTR) / previousCTR * 100);
}

// Add enhanced tooltip styles
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
            color: white;
        }
        
        .loading-dots {
            animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        @media (max-width: 768px) {
            .simplified-tooltip {
                max-width: 350px;
                min-width: 280px;
                font-size: 13px;
            }
        }
    `;
    document.head.appendChild(style);
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
            /* GSC Integration Styles */
            .nav-gsc-btn {
                display: flex !important;
                align-items: center;
                gap: 6px;
                padding: 8px 16px !important;
                margin: 0 8px !important;
                background: #f0f0f0 !important;
                border: 1px solid #ddd !important;
                border-radius: 6px !important;
                cursor: pointer;
                font-size: 14px !important;
                color: #333 !important;
                transition: all 0.3s ease;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                z-index: 9999 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .nav-gsc-btn:hover {
                background: #e0e0e0 !important;
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .nav-gsc-btn.connected {
                background: #4caf50 !important;
                color: white !important;
                border-color: #4caf50 !important;
            }
            
            .nav-gsc-btn.connected:hover {
                background: #45a049 !important;
                box-shadow: 0 2px 8px rgba(76,175,80,0.3);
            }

            #gscIcon {
                font-size: 16px;
                line-height: 1;
            }

            #gscText {
                font-weight: 500;
                white-space: nowrap;
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
        
        debugLog('GSC styles added to page');
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
