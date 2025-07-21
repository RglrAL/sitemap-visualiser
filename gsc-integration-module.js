// gsc-integration-module.js - Enhanced Content Writer Version with Improved Display

(function() {
    // Configuration
    const GSC_CONFIG = {
        CLIENT_ID: '550630256834-9quh64fnqhfse6s488c8gutstuqcch04.apps.googleusercontent.com',
        DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/searchconsole/v1/rest'],
        SCOPES: 'https://www.googleapis.com/auth/webmasters.readonly'
    };

    let tooltipTimeout = null;
let isOverTooltip = false;
let isOverNode = false;
let currentTooltipNode = null;

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

    // New lazy loading variables
    const pendingRequests = new Map();
    const hoverQueue = new Set();
    let batchTimeout = null;
    let cacheCleanupInterval = null;

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
        initializeGoogleAPI();
        hookIntoSitemapLoader();
        hookIntoTooltips();
        listenForTreeReady();
        setupCacheCleanup();
        addTooltipInteractionStyles();

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
                        updateTooltipIfVisible(node);
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
            updateTooltipIfVisible(node);
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
        updateAllVisibleTooltips();
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

    // Update tooltip if currently visible
    function updateTooltipIfVisible(node) {
        const visibleTooltip = document.querySelector('.enhanced-tooltip.visible');
        if (visibleTooltip) {
            const tooltipContent = visibleTooltip.innerHTML;
            if (tooltipContent.includes(node.name) || (node.url && tooltipContent.includes(node.url))) {
                const nodeData = findNodeByUrl(node.url);
                if (nodeData && window.showEnhancedTooltip) {
                    const rect = visibleTooltip.getBoundingClientRect();
                    const event = { pageX: rect.left, pageY: rect.top };
                    setTimeout(() => {
                        window.showEnhancedTooltip(event, nodeData);
                    }, 100);
                }
            }
        }
    }

    function findNodeByUrl(url) {
        if (!window.allNodes) return null;
        return window.allNodes.find(d => d.data && d.data.url === url);
    }

    function updateAllVisibleTooltips() {
        gscEvents.emit('dataUpdated');
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
        // Debug log to see what's happening
        debugLog('Checking for navigation bar...');
        
        // Try multiple selectors for the navigation bar
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
        
        // Check if button already exists
        if (document.getElementById('gscConnectBtn')) {
            debugLog('GSC button already exists');
            return;
        }
        
        // Create the button
        const gscButton = document.createElement('button');
        gscButton.className = 'nav-btn nav-gsc-btn';
        gscButton.id = 'gscConnectBtn';
        gscButton.onclick = toggleGSCConnection;
        gscButton.innerHTML = `
            <span id="gscIcon">🔍</span>
            <span id="gscText">Connect GSC</span>
        `;
        
        // Add inline styles to ensure visibility
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
        
        // Try to find a good insertion point
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
        
        // Make sure it's visible
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


  // Complete addGSCStyles function
function addGSCStyles() {
    if (document.getElementById('gsc-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'gsc-styles';
    style.textContent = getCleanedStyles();
    document.head.appendChild(style);
    
    debugLog('GSC styles added to page');
}

// Complete getCleanedStyles function with all styles
function getCleanedStyles() {
    return `
        /* ============================================
           GSC Integration Styles - Complete Version
           ============================================ */

        /* Enhanced Color Palette */
        :root {
            --gsc-primary: #1a73e8;
            --gsc-primary-dark: #1557b0;
            --gsc-primary-light: #e8f1fe;
            --gsc-success: #0d652d;
            --gsc-success-light: #e6f4ea;
            --gsc-warning: #ea8600;
            --gsc-warning-light: #fef7e0;
            --gsc-danger: #d33b2c;
            --gsc-danger-light: #fce8e6;
            --gsc-info: #1967d2;
            --gsc-info-light: #e8f0fe;
            
            /* Neutral Colors */
            --gsc-gray-50: #f8f9fa;
            --gsc-gray-100: #f1f3f4;
            --gsc-gray-200: #e8eaed;
            --gsc-gray-300: #dadce0;
            --gsc-gray-400: #bdc1c6;
            --gsc-gray-500: #9aa0a6;
            --gsc-gray-600: #5f6368;
            --gsc-gray-700: #3c4043;
            --gsc-gray-800: #202124;
            --gsc-gray-900: #000000;
            
            /* Shadows */
            --gsc-shadow-sm: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
            --gsc-shadow-md: 0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15);
            --gsc-shadow-lg: 0 2px 6px 2px rgba(60,64,67,0.15), 0 8px 12px 4px rgba(60,64,67,0.1);
            
            /* Animations */
            --gsc-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            --gsc-transition-slow: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ============================================
           GSC Navigation Button Styles
           ============================================ */
        
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

        /* ============================================
           Enhanced Tooltip Styles
           ============================================ */

        /* Tooltip Container */
        .enhanced-tooltip {
            max-width: 420px;
            min-width: 320px;
            font-size: 14px;
            line-height: 1.4;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .enhanced-tooltip.visible {
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        }

        /* Tooltip Header */
        .tooltip-header-enhanced {
            background: linear-gradient(135deg, #1f4788 0%, #2563eb 100%);
            color: white;
            padding: 12px 15px;
            margin: -10px -15px 15px -15px;
            border-radius: 8px 8px 0 0;
        }

        .tooltip-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }

        .tooltip-page-title {
            font-weight: 600;
            font-size: 1rem;
            line-height: 1.2;
        }

        .tooltip-url {
            font-size: 0.75rem;
            opacity: 0.9;
            word-break: break-all;
            margin-top: 4px;
            font-family: monospace;
        }

        .tooltip-freshness {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .freshness-new { background: rgba(76, 175, 80, 0.2); color: #2e7d32; }
        .freshness-fresh { background: rgba(139, 195, 74, 0.2); color: #558b2f; }
        .freshness-recent { background: rgba(255, 193, 7, 0.2); color: #f57f17; }
        .freshness-aging { background: rgba(255, 152, 0, 0.2); color: #ef6c00; }
        .freshness-old { background: rgba(255, 87, 34, 0.2); color: #d84315; }
        .freshness-stale { background: rgba(244, 67, 54, 0.2); color: #c62828; }

        /* ============================================
           GSC Section Container
           ============================================ */

        .gsc-section-enhanced {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: var(--gsc-shadow-md);
            transition: var(--gsc-transition);
            margin-bottom: 15px;
            animation: fadeInUp 0.3s ease;
        }

        .gsc-section-enhanced:hover {
            box-shadow: var(--gsc-shadow-lg);
        }

        .gsc-visual-container {
            position: relative;
        }

        /* ============================================
           Date Range Selector
           ============================================ */

        .gsc-date-selector {
            background: var(--gsc-gray-50);
            padding: 12px 16px;
            border-bottom: 1px solid var(--gsc-gray-200);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .date-range-pills {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        }

        .date-pill {
            padding: 6px 14px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: var(--gsc-transition);
            border: 1px solid transparent;
            background: white;
            color: var(--gsc-gray-700);
            white-space: nowrap;
        }

        .date-pill:hover {
            background: var(--gsc-gray-100);
            border-color: var(--gsc-gray-300);
            transform: translateY(-1px);
        }

        .date-pill.active {
            background: var(--gsc-primary);
            color: white;
            border-color: var(--gsc-primary);
            box-shadow: 0 2px 4px rgba(26,115,232,0.2);
        }

        .date-info {
            font-size: 11px;
            color: var(--gsc-gray-600);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* ============================================
           Metrics Cards
           ============================================ */

        .gsc-metrics-visual {
            padding: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
        }

        .metric-card-visual {
            background: var(--gsc-gray-50);
            border-radius: 12px;
            padding: 16px;
            position: relative;
            overflow: hidden;
            transition: var(--gsc-transition);
            border: 1px solid transparent;
        }

        .metric-card-visual:hover {
            transform: translateY(-2px);
            box-shadow: var(--gsc-shadow-md);
            border-color: var(--gsc-primary-light);
            background: white;
        }

        .metric-header-visual {
            position: relative;
            z-index: 2;
        }

        .metric-label-visual {
            font-size: 12px;
            color: var(--gsc-gray-600);
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
        }

        .metric-icon-visual {
            font-size: 14px;
        }

        .metric-value-visual {
            font-size: 24px;
            font-weight: 700;
            color: var(--gsc-gray-800);
            line-height: 1.2;
            letter-spacing: -0.5px;
        }

        /* Trend Indicators */
        .metric-trend-visual {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 12px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 12px;
            margin-top: 6px;
        }

        .trend-positive {
            color: var(--gsc-success);
            background: var(--gsc-success-light);
        }

        .trend-negative {
            color: var(--gsc-danger);
            background: var(--gsc-danger-light);
        }

        .trend-neutral {
            color: var(--gsc-gray-600);
            background: var(--gsc-gray-100);
        }

        .trend-arrow {
            font-size: 10px;
        }

        /* Sparkline */
        .metric-sparkline {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 40px;
            opacity: 0.5;
            transition: opacity 0.2s;
        }

        .metric-card-visual:hover .metric-sparkline {
            opacity: 0.8;
        }

        /* Performance Score Ring */
        .performance-score-visual {
            width: 80px;
            height: 80px;
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
        }

        .score-ring {
            transform: rotate(-90deg);
        }

        .score-ring-bg {
            fill: none;
            stroke: var(--gsc-gray-200);
            stroke-width: 6;
        }

        .score-ring-fill {
            fill: none;
            stroke-width: 6;
            stroke-linecap: round;
            transition: stroke-dasharray 0.5s ease;
        }

        .score-text-visual {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 22px;
            font-weight: 700;
            color: var(--gsc-gray-800);
        }

        .score-label-visual {
            position: absolute;
            bottom: -18px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 10px;
            color: var(--gsc-gray-600);
            white-space: nowrap;
            font-weight: 500;
        }

        /* ============================================
           Performance Insights Bar
           ============================================ */

        .performance-insights-bar {
            padding: 0 20px 16px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .insight-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
            animation: fadeInUp 0.3s ease;
        }

        .insight-pill.warning {
            background: var(--gsc-warning-light);
            color: var(--gsc-warning);
        }

        .insight-pill.opportunity {
            background: var(--gsc-info-light);
            color: var(--gsc-info);
        }

        .insight-pill.success {
            background: var(--gsc-success-light);
            color: var(--gsc-success);
        }

        /* ============================================
           Queries Section
           ============================================ */

        .gsc-queries-visual {
            padding: 20px;
            border-top: 1px solid var(--gsc-gray-100);
        }

        .queries-header-visual {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 12px;
        }

        .section-title-visual {
            font-size: 16px;
            font-weight: 600;
            color: var(--gsc-gray-800);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .query-count {
            font-size: 12px;
            color: var(--gsc-gray-500);
            font-weight: 400;
        }

        .view-toggle {
            display: flex;
            background: var(--gsc-gray-100);
            border-radius: 6px;
            padding: 2px;
        }

        .toggle-btn {
            padding: 6px 12px;
            border: none;
            background: transparent;
            color: var(--gsc-gray-600);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: var(--gsc-transition);
            border-radius: 4px;
        }

        .toggle-btn:hover {
            color: var(--gsc-gray-800);
        }

        .toggle-btn.active {
            background: white;
            color: var(--gsc-primary);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        /* Query Items */
        .query-list-visual {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .query-item-visual {
            background: white;
            border: 1px solid var(--gsc-gray-200);
            border-radius: 10px;
            padding: 16px;
            transition: var(--gsc-transition);
            position: relative;
            overflow: hidden;
        }

        .query-item-visual:hover {
            border-color: var(--gsc-primary);
            box-shadow: var(--gsc-shadow-sm);
            transform: translateX(2px);
        }

        /* Query Performance Bar */
        .query-performance-bar {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            transition: width 0.2s ease;
        }

        .query-item-visual:hover .query-performance-bar {
            width: 6px;
        }

        .performance-excellent { background: var(--gsc-success); }
        .performance-good { background: var(--gsc-primary); }
        .performance-opportunity { background: var(--gsc-warning); }
        .performance-poor { background: var(--gsc-danger); }
        .performance-average { background: var(--gsc-gray-400); }

        /* Query Rank Badge */
        .query-rank-badge {
            position: absolute;
            top: 12px;
            right: 12px;
            background: var(--gsc-gray-100);
            color: var(--gsc-gray-600);
            font-size: 11px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 12px;
        }

        /* Query Content */
        .query-content-visual {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
        }

        .query-text-section {
            flex: 1;
            min-width: 0;
        }

        .query-text-visual {
            font-size: 14px;
            font-weight: 600;
            color: var(--gsc-gray-800);
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .opportunity-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: 500;
            padding: 2px 8px;
            border-radius: 12px;
            margin-top: 4px;
        }

        .opportunity-badge.rank-opportunity {
            background: var(--gsc-warning-light);
            color: var(--gsc-warning);
        }

        .opportunity-badge.ctr-opportunity {
            background: var(--gsc-info-light);
            color: var(--gsc-info);
        }

        /* Query Metrics */
        .query-metrics-visual {
            display: flex;
            gap: 20px;
            align-items: center;
        }

        .query-metric {
            text-align: center;
            min-width: 60px;
        }

        .query-metric-value {
            font-size: 14px;
            font-weight: 600;
            color: var(--gsc-gray-700);
            line-height: 1.2;
        }

        .query-metric-label {
            font-size: 10px;
            color: var(--gsc-gray-500);
            margin-top: 2px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* CTR Visualization */
        .ctr-visual {
            margin-top: 4px;
        }

        .ctr-bar {
            width: 50px;
            height: 3px;
            background: var(--gsc-gray-200);
            border-radius: 2px;
            overflow: hidden;
        }

        .ctr-fill {
            height: 100%;
            background: var(--gsc-primary);
            transition: width 0.3s ease;
        }

        /* Position Indicator */
        .position-indicator {
            margin-top: 4px;
        }

        .position-page {
            font-size: 9px;
            padding: 2px 6px;
            border-radius: 10px;
            font-weight: 500;
        }

        .page-1 {
            background: var(--gsc-success-light);
            color: var(--gsc-success);
        }

        .page-2 {
            background: var(--gsc-info-light);
            color: var(--gsc-info);
        }

        .page-3, .page-4, .page-5 {
            background: var(--gsc-warning-light);
            color: var(--gsc-warning);
        }

        /* Query Opportunity Hint */
        .query-opportunity-hint {
            background: var(--gsc-info-light);
            border-left: 3px solid var(--gsc-info);
            padding: 8px 12px;
            margin-top: 12px;
            border-radius: 0 6px 6px 0;
            font-size: 12px;
            color: var(--gsc-gray-700);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        /* Show More Button */
        .show-more-queries {
            width: 100%;
            padding: 12px;
            margin-top: 12px;
            border: 1px dashed var(--gsc-gray-300);
            background: transparent;
            color: var(--gsc-primary);
            font-size: 13px;
            font-weight: 500;
            border-radius: 8px;
            cursor: pointer;
            transition: var(--gsc-transition);
        }

        .show-more-queries:hover {
            background: var(--gsc-primary-light);
            border-color: var(--gsc-primary);
        }

        /* ============================================
           Opportunities Section
           ============================================ */

        .opportunities-section-visual {
            padding: 20px;
            background: linear-gradient(135deg, var(--gsc-warning-light) 0%, rgba(254,247,224,0.3) 100%);
            border-top: 1px solid var(--gsc-gray-100);
        }

        .opportunities-header-visual {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .opp-title-section {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .opp-icon {
            font-size: 20px;
        }

        .opp-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--gsc-gray-800);
        }

        .opp-summary {
            text-align: right;
        }

        .potential-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--gsc-warning);
            display: block;
        }

        .potential-label {
            font-size: 11px;
            color: var(--gsc-gray-600);
        }

        /* Opportunity Cards */
        .opportunities-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 12px;
        }

        .opportunity-card-visual {
            background: white;
            border-radius: 10px;
            padding: 16px;
            border: 1px solid rgba(234,134,0,0.2);
            transition: var(--gsc-transition);
        }

        .opportunity-card-visual:hover {
            transform: translateY(-2px);
            box-shadow: var(--gsc-shadow-md);
            border-color: var(--gsc-warning);
        }

        .high-impact {
            background: linear-gradient(135deg, white 0%, var(--gsc-warning-light) 100%);
        }

        .opp-query {
            font-size: 14px;
            font-weight: 600;
            color: var(--gsc-gray-800);
            margin-bottom: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .opp-metrics {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
        }

        .opp-metric {
            text-align: center;
        }

        .opp-metric-value {
            font-size: 14px;
            font-weight: 600;
            color: var(--gsc-gray-700);
            display: block;
        }

        .opp-metric-label {
            font-size: 10px;
            color: var(--gsc-gray-500);
            margin-top: 2px;
        }

        .opp-metric.highlight .opp-metric-value {
            color: var(--gsc-warning);
        }

        .opp-action-hint {
            font-size: 12px;
            color: var(--gsc-gray-600);
            padding-top: 8px;
            border-top: 1px solid var(--gsc-gray-100);
        }

        /* ============================================
           Insights Section
           ============================================ */

        .insights-section-visual {
            padding: 20px;
            border-top: 1px solid var(--gsc-gray-100);
        }

        .insights-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--gsc-gray-800);
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .insights-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
        }

        .insight-card-visual {
            background: var(--gsc-gray-50);
            border-radius: 10px;
            padding: 16px;
            border-left: 4px solid var(--gsc-gray-400);
            transition: var(--gsc-transition);
        }

        .insight-card-visual:hover {
            transform: translateX(2px);
            box-shadow: var(--gsc-shadow-sm);
        }

        .priority-critical {
            border-left-color: var(--gsc-danger);
            background: var(--gsc-danger-light);
        }

        .priority-high {
            border-left-color: var(--gsc-warning);
            background: var(--gsc-warning-light);
        }

        .priority-medium {
            border-left-color: var(--gsc-info);
            background: var(--gsc-info-light);
        }

        .priority-low {
            border-left-color: var(--gsc-success);
            background: var(--gsc-success-light);
        }

        .insight-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .insight-type-icon {
            font-size: 16px;
        }

        .insight-priority-badge {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 10px;
            background: rgba(0,0,0,0.1);
        }

        .insight-content h4 {
            font-size: 13px;
            font-weight: 600;
            color: var(--gsc-gray-800);
            margin-bottom: 4px;
        }

        .insight-description {
            font-size: 12px;
            color: var(--gsc-gray-600);
            line-height: 1.4;
        }

        /* ============================================
           Action Buttons
           ============================================ */

        .gsc-actions-visual {
            padding: 20px;
            background: var(--gsc-gray-50);
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        }

        .action-btn-visual {
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: var(--gsc-transition);
            border: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            text-decoration: none;
        }

        .action-primary {
            background: var(--gsc-primary);
            color: white;
        }

        .action-primary:hover {
            background: var(--gsc-primary-dark);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(26,115,232,0.3);
        }

        .action-secondary {
            background: white;
            color: var(--gsc-gray-700);
            border: 1px solid var(--gsc-gray-300);
        }

        .action-secondary:hover {
            background: var(--gsc-gray-50);
            border-color: var(--gsc-gray-400);
            transform: translateY(-1px);
        }

        /* ============================================
           Chart View Styles
           ============================================ */

        .query-chart-container {
            padding: 16px 0;
        }

        .query-chart-item {
            margin-bottom: 12px;
        }

        .query-chart-label {
            font-size: 12px;
            font-weight: 500;
            color: var(--gsc-gray-700);
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .query-chart-bars {
            position: relative;
            height: 24px;
            background: var(--gsc-gray-100);
            border-radius: 4px;
            overflow: hidden;
        }

        .impressions-bar {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            background: var(--gsc-primary-light);
            display: flex;
            align-items: center;
            padding: 0 8px;
            transition: width 0.3s ease;
        }

        .clicks-bar {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            background: var(--gsc-primary);
            display: flex;
            align-items: center;
            padding: 0 8px;
            transition: width 0.3s ease;
        }

        .bar-value {
            font-size: 11px;
            font-weight: 600;
            color: white;
            white-space: nowrap;
        }

        .chart-legend {
            display: flex;
            gap: 16px;
            margin-top: 16px;
            justify-content: center;
        }

        .legend-item {
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .legend-item::before {
            content: '';
            width: 12px;
            height: 12px;
            border-radius: 2px;
            display: inline-block;
        }

        .legend-item.impressions::before {
            background: var(--gsc-primary-light);
        }

        .legend-item.clicks::before {
            background: var(--gsc-primary);
        }

        /* ============================================
           Table View Styles
           ============================================ */

        .query-table-container {
            overflow-x: auto;
            margin: 16px 0;
        }

        .query-table {
            width: 100%;
            border-collapse: collapse;
        }

        .query-table th {
            text-align: left;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 600;
            color: var(--gsc-gray-600);
            border-bottom: 2px solid var(--gsc-gray-200);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .query-table td {
            padding: 10px 12px;
            font-size: 13px;
            border-bottom: 1px solid var(--gsc-gray-100);
        }

        .query-table tr:hover td {
            background: var(--gsc-gray-50);
        }

        .query-cell {
            font-weight: 500;
            color: var(--gsc-gray-800);
        }

        .numeric-cell {
            text-align: right;
            font-feature-settings: "tnum";
            color: var(--gsc-gray-700);
        }

        /* ============================================
           Modal Styles
           ============================================ */

        .gsc-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: fadeIn 0.2s ease;
        }

        .gsc-modal-content {
            background: white;
            border-radius: 16px;
            max-width: 800px;
            max-height: 90vh;
            width: 100%;
            overflow: hidden;
            box-shadow: var(--gsc-shadow-lg);
            animation: slideUp 0.3s ease;
        }

        .modal-header {
            padding: 20px;
            border-bottom: 1px solid var(--gsc-gray-200);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-header h2 {
            font-size: 20px;
            font-weight: 600;
            color: var(--gsc-gray-800);
        }

        .close-modal {
            background: none;
            border: none;
            font-size: 24px;
            color: var(--gsc-gray-500);
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: var(--gsc-transition);
        }

        .close-modal:hover {
            background: var(--gsc-gray-100);
            color: var(--gsc-gray-700);
        }

        .modal-body {
            padding: 20px;
            overflow-y: auto;
            max-height: calc(90vh - 80px);
        }

        .all-queries-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        /* ============================================
           Legacy Styles (from original)
           ============================================ */

        /* GSC Header and Status */
        .gsc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .gsc-header-left {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .gsc-icon {
            font-size: 1.1rem;
        }

        .gsc-title {
            font-weight: 600;
            color: #1f4788;
            font-size: 0.95rem;
        }

        .gsc-period {
            font-size: 0.75rem;
            color: #666;
            font-style: italic;
        }

        /* Status Indicators */
        .gsc-status {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .status-excellent { background: #e8f5e8; color: #2e7d32; }
        .status-good { background: #e3f2fd; color: #1565c0; }
        .status-attention { background: #fff3e0; color: #ef6c00; }
        .status-opportunity { background: #fff8e1; color: #f57f17; }
        .status-low { background: #fce4ec; color: #c2185b; }
        .status-average { background: #f5f5f5; color: #616161; }
        .status-none { background: #f0f0f0; color: #757575; }

        /* Loading States */
        .gsc-loading {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.8rem;
            color: #666;
        }

        .loading-spinner {
            width: 12px;
            height: 12px;
            border: 2px solid #e0e0e0;
            border-top: 2px solid #1f4788;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        .gsc-loading-placeholder {
            padding: 20px;
            text-align: center;
            color: #666;
            font-style: italic;
        }

        .gsc-no-data {
            padding: 15px;
            text-align: center;
            color: #666;
        }

        .no-data-text {
            font-size: 0.9rem;
            margin-bottom: 4px;
        }

        .no-data-suggestion {
            font-size: 0.8rem;
            font-style: italic;
            opacity: 0.8;
        }

        /* Legacy Metrics Grid */
        .gsc-metrics-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 12px;
        }

        .metric-card {
            background: white;
            border: 1px solid #e8eaed;
            border-radius: 6px;
            padding: 10px;
            text-align: center;
            position: relative;
        }

        .metric-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            margin-bottom: 4px;
        }

        .metric-icon {
            font-size: 0.9rem;
        }

        .metric-label {
            font-size: 0.75rem;
            color: #666;
            font-weight: 500;
        }

        .metric-value {
            font-size: 1.1rem;
            font-weight: bold;
            color: #1f4788;
            line-height: 1.2;
        }

        .metric-trend {
            position: absolute;
            top: 4px;
            right: 4px;
            font-size: 0.65rem;
            padding: 1px 4px;
            border-radius: 8px;
            font-weight: 500;
        }

        .trend-up {
            background: #e8f5e8;
            color: #2e7d32;
        }

        .trend-down {
            background: #ffebee;
            color: #c62828;
        }

        /* Legacy Query Styles */
        .gsc-queries-section {
            margin-bottom: 12px;
        }

        .section-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 8px;
        }

        .section-icon {
            font-size: 0.9rem;
        }

        .section-title {
            font-weight: 600;
            color: #1f4788;
            font-size: 0.85rem;
        }

        .queries-list {
            background: white;
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid #e8eaed;
        }

        .query-item {
            padding: 8px 10px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .query-item:last-child {
            border-bottom: none;
        }

        .query-main {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1;
            min-width: 0;
        }

        .query-rank {
            background: #f5f5f5;
            color: #666;
            font-size: 0.7rem;
            padding: 2px 5px;
            border-radius: 4px;
            font-weight: 500;
            min-width: 20px;
            text-align: center;
        }

        .query-text {
            font-size: 0.8rem;
            font-weight: 500;
            color: #333;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .query-opportunity {
            font-size: 0.8rem;
            margin-left: 4px;
        }

        .query-stats {
            display: flex;
            gap: 6px;
            font-size: 0.7rem;
            color: #666;
        }

        .stat-clicks, .stat-position, .stat-ctr {
            padding: 2px 4px;
            background: #f8f9fa;
            border-radius: 3px;
            font-weight: 500;
        }

        /* Query Priority Colors */
        .query-top { background: #e8f5e8; }
        .query-rank-opp { background: #fff8e1; }
        .query-ctr-opp { background: #e3f2fd; }
        .query-normal { background: white; }

        /* Legacy Opportunities Alert */
        .gsc-opportunities-alert {
            background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
            border: 1px solid #ffcc02;
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 12px;
        }

        .opportunity-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 6px;
        }

        .opportunity-icon {
            font-size: 1rem;
        }

        .opportunity-title {
            font-weight: 600;
            color: #e65100;
            font-size: 0.85rem;
        }

        .opportunity-potential {
            font-size: 0.7rem;
            color: #ef6c00;
            margin-left: auto;
            font-weight: 500;
        }

        .opportunity-preview {
            space-y: 4px;
        }

        .opportunity-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.75rem;
            padding: 3px 0;
        }

        .opportunity-query {
            font-weight: 500;
            color: #333;
        }

        .opportunity-stats {
            color: #666;
            font-size: 0.7rem;
        }

        .opportunity-more {
            text-align: center;
            font-size: 0.7rem;
            color: #ef6c00;
            font-style: italic;
            margin-top: 4px;
        }

        /* Legacy Insights */
        .gsc-insights-section {
            margin-bottom: 12px;
        }

        .insight-item {
            border-radius: 6px;
            padding: 10px;
            border-left: 3px solid #ccc;
        }

        .insight-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
        }

        .insight-icon {
            font-size: 0.9rem;
        }

        .insight-title {
            font-weight: 600;
            font-size: 0.85rem;
            color: #333;
        }

        .insight-priority {
            font-size: 0.65rem;
            padding: 2px 6px;
            border-radius: 8px;
            font-weight: 500;
            margin-left: auto;
        }

        .insight-description {
            font-size: 0.8rem;
            color: #555;
            line-height: 1.3;
        }

        .insights-more {
            text-align: center;
            font-size: 0.7rem;
            color: #666;
            font-style: italic;
            margin-top: 6px;
        }

        /* Priority Classes */
        .priority-high {
            background: #ffebee;
            border-left-color: #f44336;
        }

        .priority-medium {
            background: #fff3e0;
            border-left-color: #ff9800;
        }

        .priority-low {
            background: #e8f5e8;
            border-left-color: #4caf50;
        }

        .priority-critical {
            background: #fce4ec;
            border-left-color: #e91e63;
        }

        .priority-high .insight-priority {
            background: #ffcdd2;
            color: #c62828;
        }

        .priority-medium .insight-priority {
            background: #ffe0b2;
            color: #e65100;
        }

        .priority-low .insight-priority {
            background: #c8e6c9;
            color: #2e7d32;
        }

        .priority-critical .insight-priority {
            background: #f8bbd9;
            color: #ad1457;
        }

        /* Site Structure Section */
        .structure-section {
            background: #fafafa;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 15px;
        }

        .structure-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 8px;
        }

        .structure-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.8rem;
        }

        .structure-icon {
            font-size: 0.9rem;
            width: 16px;
            text-align: center;
        }

        .structure-label {
            color: #666;
            font-weight: 500;
        }

        .structure-value {
            color: #333;
            font-weight: 600;
            margin-left: auto;
        }

        .structure-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.75rem;
            color: #666;
            padding-top: 8px;
            border-top: 1px solid #e0e0e0;
        }

        .meta-icon {
            font-size: 0.8rem;
        }

        /* Actions Sections */
        .gsc-actions {
            display: flex;
            gap: 6px;
            justify-content: center;
        }

        .actions-section {
            display: flex;
            gap: 8px;
            justify-content: center;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e0e0e0;
        }

        .gsc-action-btn, .action-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            border: none;
            border-radius: 5px;
            font-size: 0.75rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
        }

        .gsc-action-btn.primary, .action-btn.primary {
            background: #4a90e2;
            color: white;
        }

        .gsc-action-btn.primary:hover, .action-btn.primary:hover {
            background: #357abd;
            transform: translateY(-1px);
        }

        .gsc-action-btn.secondary, .action-btn.secondary {
            background: #f0f0f0;
            color: #666;
            border: 1px solid #ddd;
        }

        .gsc-action-btn.secondary:hover, .action-btn.secondary:hover {
            background: #e0e0e0;
            color: #333;
        }

        .btn-icon {
            font-size: 0.8rem;
        }

        /* ============================================
           Loading States
           ============================================ */

        .gsc-section-enhanced.loading::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
        }

        .gsc-skeleton {
            background: linear-gradient(90deg, var(--gsc-gray-200) 25%, var(--gsc-gray-100) 50%, var(--gsc-gray-200) 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
            border-radius: 4px;
        }

        /* ============================================
           Animations
           ============================================ */

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes slideUp {
            from {
                transform: translateY(20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* ============================================
           Mobile Responsive Styles
           ============================================ */

        @media (max-width: 768px) {
            .nav-gsc-btn span:not(#gscIcon) {
                display: none;
            }
            
            .nav-gsc-btn {
                padding: 8px !important;
                min-width: auto !important;
                margin: 0 4px !important;
            }

            .gsc-metrics-visual {
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                padding: 16px;
            }
            
            .metric-value-visual {
                font-size: 20px;
            }
            
            .performance-score-visual {
                width: 60px;
                height: 60px;
            }
            
            .score-text-visual {
                font-size: 18px;
            }
            
            .queries-header-visual {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .query-content-visual {
                flex-direction: column;
                gap: 12px;
            }
            
            .query-metrics-visual {
                width: 100%;
                justify-content: space-between;
            }
            
            .opportunities-grid {
                grid-template-columns: 1fr;
            }
            
            .insights-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 480px) {
            .gsc-date-selector {
                flex-direction: column;
                align-items: stretch;
            }
            
            .date-range-pills {
                overflow-x: auto;
                flex-wrap: nowrap;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
                -ms-overflow-style: none;
            }
            
            .date-range-pills::-webkit-scrollbar {
                display: none;
            }
            
            .metric-card-visual {
                padding: 12px;
            }
            
            .query-item-visual {
                padding: 12px;
            }
            
            .query-rank-badge {
                position: static;
                margin-bottom: 8px;
                display: inline-block;
            }

            .gsc-metrics-grid {
                grid-template-columns: 1fr;
            }
            
            .structure-grid {
                grid-template-columns: 1fr;
            }
            
            .actions-section, .gsc-actions {
                flex-direction: column;
            }
            
            .tooltip-title-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
            }
        }

        /* ============================================
           Print Styles
           ============================================ */

        @media print {
            .gsc-section-enhanced {
                box-shadow: none;
                border: 1px solid #ddd;
            }
            
            .view-toggle,
            .show-more-queries,
            .gsc-actions-visual,
            .close-modal {
                display: none;
            }
            
            .query-item-visual {
                break-inside: avoid;
            }
        }
    `;
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

    // Hook into tooltips with enhanced display
    function hookIntoTooltips() {
    const checkAndHook = () => {
        if (window.showEnhancedTooltip) {
            // Store the original function
            const originalShowEnhancedTooltip = window.showEnhancedTooltip;
            
            // Create our enhanced version
            window.showEnhancedTooltip = function(event, d, isLoadingGSC = false) {
                currentTooltipNode = d;
                showEnhancedTooltipWithImprovedGSC(event, d, isLoadingGSC);
            };
            
            // Also hook into the hide function if it exists
            if (window.hideEnhancedTooltip) {
                const originalHideTooltip = window.hideEnhancedTooltip;
                window.hideEnhancedTooltip = function() {
                    // Add a delay before hiding
                    if (tooltipTimeout) clearTimeout(tooltipTimeout);
                    
                    tooltipTimeout = setTimeout(() => {
                        if (!isOverTooltip && !isOverNode) {
                            originalHideTooltip.apply(this, arguments);
                            currentTooltipNode = null;
                        }
                    }, 200); // 200ms delay before hiding
                };
            }
            
            debugLog('Hooked into tooltip display with enhanced mouse handling');
        } else {
            setTimeout(checkAndHook, 100);
        }
    };
    checkAndHook();
}

    // ============================================================================
    // ENHANCED TOOLTIP DISPLAY FUNCTIONS
    // ============================================================================

    // Enhanced tooltip with improved GSC data display
    function showEnhancedTooltipWithImprovedGSC(event, d, isLoadingGSC = false) {
    if (!window.enhancedTooltip || !d.data) return;
    
    const data = d.data;
    const now = new Date();
    
    // Clear any existing hide timeout
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
    
    // Mark that we're over a node
    isOverNode = true;
    
    // Trigger lazy loading if needed
    if (gscConnected && gscDataLoaded && data.url && !gscDataMap.has(data.url) && !isLoadingGSC) {
        isLoadingGSC = true;
        fetchNodeGSCData(data).then(() => {
            const currentTooltip = document.querySelector('.enhanced-tooltip.visible');
            if (currentTooltip && currentTooltipNode === d) {
                showEnhancedTooltipWithImprovedGSC(event, d, false);
            }
        });
    }
    
    // ... [Keep all the existing tooltip content generation code] ...
    // Calculate freshness and basic info
    let freshnessClass = '';
    let freshnessLabel = 'No date';
    if (data.lastModified) {
        const lastMod = new Date(data.lastModified);
        const daysSince = Math.floor((now - lastMod) / (1000 * 60 * 60 * 24));
        
        if (daysSince < 30) {
            freshnessClass = 'freshness-new';
            freshnessLabel = 'New';
        } else if (daysSince < 90) {
            freshnessClass = 'freshness-fresh';
            freshnessLabel = 'Fresh';
        } else if (daysSince < 180) {
            freshnessClass = 'freshness-recent';
            freshnessLabel = 'Recent';
        } else if (daysSince < 365) {
            freshnessClass = 'freshness-aging';
            freshnessLabel = 'Aging';
        } else if (daysSince < 730) {
            freshnessClass = 'freshness-old';
            freshnessLabel = 'Old';
        } else {
            freshnessClass = 'freshness-stale';
            freshnessLabel = 'Stale';
        }
    }
    
    // Calculate descendant/sibling counts
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
                    d.depth === 1 ? 'Language/Category' :
                    isLeaf ? 'Page' : 'Section';
    
    // Start building the enhanced tooltip
    let html = `
        <div class="tooltip-header-enhanced">
            <div class="tooltip-title-row">
                <span class="tooltip-page-title">${data.name}</span>
                <span class="tooltip-freshness ${freshnessClass}">${freshnessLabel}</span>
            </div>
            ${data.url ? `<div class="tooltip-url">${data.url}</div>` : ''}
        </div>
    `;
    
    // GSC Performance Section
    if (gscConnected && data.url) {
        const gscData = gscDataMap.get(data.url);
        
        if (isLoadingGSC || (!gscData && !gscDataMap.has(data.url))) {
            html += createGSCLoadingSection();
        } else if (gscData && !gscData.noDataFound) {
            html += createEnhancedGSCSection(gscData);
        } else if (gscData && gscData.noDataFound) {
            html += createNoGSCDataSection();
        }
    }
    
    // Basic site structure info
    html += createSiteStructureSection(d, nodeType, descendantCount, siblingCount, isLeaf, data);
    
    // Actions section
    html += createActionsSection(data, d, isLeaf);
    
    // Apply the HTML and show tooltip
    window.enhancedTooltip.html(html);
    
    // Position tooltip - ADJUSTED POSITIONING
    const tooltipNode = window.enhancedTooltip.node();
    const tooltipRect = tooltipNode.getBoundingClientRect();
    const pageWidth = window.innerWidth;
    const pageHeight = window.innerHeight;
    
    // Reduce the gap between node and tooltip
    let left = event.pageX + 10; // Reduced from 15
    let top = event.pageY - tooltipRect.height / 2;
    
    if (left + tooltipRect.width > pageWidth - 20) {
        left = event.pageX - tooltipRect.width - 10; // Reduced from 15
    }
    
    if (top < 20) {
        top = 20;
    } else if (top + tooltipRect.height > pageHeight - 20) {
        top = pageHeight - tooltipRect.height - 20;
    }
    
    window.enhancedTooltip
        .style("left", left + "px")
        .style("top", top + "px")
        .style("opacity", 0)
        .classed("visible", true)
        .transition()
        .duration(200)
        .style("opacity", 1);
    
    // Enhanced mouse event handling for the tooltip
    window.enhancedTooltip
        .on("mouseenter", function() {
            isOverTooltip = true;
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
                tooltipTimeout = null;
            }
        })
        .on("mouseleave", function() {
            isOverTooltip = false;
            hideTooltipWithDelay();
        });
}

// Add this helper function for delayed hiding
function hideTooltipWithDelay() {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    
    tooltipTimeout = setTimeout(() => {
        if (!isOverTooltip && !isOverNode && window.enhancedTooltip) {
            window.enhancedTooltip
                .transition()
                .duration(200)
                .style("opacity", 0)
                .on("end", function() {
                    d3.select(this).classed("visible", false);
                    currentTooltipNode = null;
                });
        }
    }, 300); // 300ms delay before checking if we should hide
}

// Add event listeners to the nodes to track mouse state
function setupNodeMouseTracking() {
    // This should be called after the D3 visualization is created
    if (window.d3 && window.d3.selectAll) {
        window.d3.selectAll('.node')
            .on('mouseenter.gsc', function(event, d) {
                isOverNode = true;
                if (tooltipTimeout) clearTimeout(tooltipTimeout);
            })
            .on('mouseleave.gsc', function(event, d) {
                isOverNode = false;
                hideTooltipWithDelay();
            });
    }
}

// Hook into the tree ready event to set up node tracking
gscEvents.on('treeReady', () => {
    setTimeout(() => {
        setupNodeMouseTracking();
    }, 500);
});

// Also add some CSS to improve tooltip interaction
function addTooltipInteractionStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Improve tooltip interaction */
        .enhanced-tooltip {
            pointer-events: auto !important;
        }
        
        /* Create an invisible bridge between node and tooltip */
        .enhanced-tooltip::before {
            content: '';
            position: absolute;
            width: 30px;
            height: 100%;
            left: -30px;
            top: 0;
            /* Uncomment to debug: background: rgba(255,0,0,0.2); */
        }
        
        /* When tooltip is on the left side */
        .enhanced-tooltip.tooltip-left::before {
            left: auto;
            right: -30px;
        }
        
        /* Ensure smooth cursor transitions */
        .node {
            cursor: pointer;
        }
        
        .enhanced-tooltip {
            cursor: default;
        }
        
        /* Prevent tooltip from blocking node interactions */
        .enhanced-tooltip.hiding {
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(style);
}





    

    // Enhanced visual display functions to integrate into your existing GSC module
// Add these to your existing code, replacing the current createEnhancedGSCSection function

// Enhanced GSC section with visual improvements
function createEnhancedGSCSection(gscData) {
    const performanceScore = calculatePerformanceScore(gscData);
    const performanceStatus = analyzePerformanceStatus(gscData);
    const trendData = gscData.trend || {};
    
    // Generate or fetch historical data for sparklines
    const sparklineData = generateSparklineData(gscData);
    
    return `
        <div class="gsc-section-enhanced gsc-visual-container">
            <!-- Date Range Selector -->
            <div class="gsc-date-selector">
                <div class="date-range-pills">
                    <button class="date-pill" data-days="7" onclick="updateGSCDateRange(this, '${gscData.url}')">7d</button>
                    <button class="date-pill active" data-days="30" onclick="updateGSCDateRange(this, '${gscData.url}')">30d</button>
                    <button class="date-pill" data-days="90" onclick="updateGSCDateRange(this, '${gscData.url}')">90d</button>
                    <button class="date-pill" data-days="180" onclick="updateGSCDateRange(this, '${gscData.url}')">6m</button>
                    <button class="date-pill" data-days="365" onclick="updateGSCDateRange(this, '${gscData.url}')">1y</button>
                </div>
                <div class="date-info">
                    <span>📅</span>
                    <span id="date-range-text">Last 30 days</span>
                </div>
            </div>
            
            <!-- Visual Metrics Grid -->
            <div class="gsc-metrics-visual">
                ${createVisualMetricCard('Clicks', formatMetricValue(gscData.clicks), trendData.clicksChange, '👆', sparklineData.clicks)}
                ${createVisualMetricCard('Impressions', formatMetricValue(gscData.impressions), trendData.impressionsChange, '👀', sparklineData.impressions)}
                ${createVisualMetricCard('CTR', `${(gscData.ctr * 100).toFixed(2)}%`, calculateCTRTrend(gscData, trendData), '🎯', sparklineData.ctr)}
                ${createPositionCard(gscData.position, trendData.positionChange, performanceScore)}
            </div>
            
            <!-- Performance Insights Bar -->
            ${createPerformanceInsightsBar(gscData, performanceStatus)}
            
            <!-- Enhanced Queries Section with Visualizations -->
            ${createVisualQueriesSection(gscData.topQueries, gscData.url)}
            
            <!-- Opportunities with Visual Impact -->
            ${gscData.opportunities && gscData.opportunities.length > 0 ? 
                createVisualOpportunitiesSection(gscData.opportunities) : ''}
            
            <!-- Content Insights Visual -->
            ${gscData.insights && gscData.insights.length > 0 ? 
                createVisualInsightsSection(gscData.insights) : ''}
            
            <!-- Action Buttons -->
            <div class="gsc-actions-visual">
                <button class="action-btn-visual action-primary" onclick="showDetailedGSCAnalysis('${gscData.url}')">
                    <span>📊</span>
                    <span>Full Analysis</span>
                </button>
                <button class="action-btn-visual action-secondary" onclick="showQueryBreakdown('${gscData.url}')">
                    <span>🔍</span>
                    <span>Query Analysis</span>
                </button>
                <button class="action-btn-visual action-secondary" onclick="exportVisualReport('${gscData.url}')">
                    <span>📥</span>
                    <span>Export</span>
                </button>
            </div>
        </div>
    `;
}

// Create visual metric card with enhanced sparkline
function createVisualMetricCard(label, value, trend, icon, sparklineData) {
    const trendClass = trend > 0 ? 'trend-positive' : trend < 0 ? 'trend-negative' : 'trend-neutral';
    const trendIcon = trend > 0 ? '↗' : trend < 0 ? '↘' : '→';
    const trendDisplay = trend !== null && trend !== undefined ? Math.abs(trend).toFixed(1) : null;
    
    return `
        <div class="metric-card-visual" data-metric="${label.toLowerCase()}">
            <div class="metric-header-visual">
                <div class="metric-info">
                    <div class="metric-label-visual">
                        <span class="metric-icon-visual">${icon}</span>
                        <span>${label}</span>
                    </div>
                    <div class="metric-value-visual">${value}</div>
                    ${trendDisplay !== null ? `
                        <div class="metric-trend-visual ${trendClass}">
                            <span class="trend-arrow">${trendIcon}</span>
                            <span class="trend-value">${trend > 0 ? '+' : ''}${trendDisplay}%</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            ${createSparklineSVG(sparklineData, label)}
        </div>
    `;
}

// Create position card with performance ring
function createPositionCard(position, trend, score) {
    const trendClass = trend > 0 ? 'trend-positive' : trend < 0 ? 'trend-negative' : 'trend-neutral';
    const trendIcon = trend > 0 ? '↗' : trend < 0 ? '↘' : '→';
    const scoreColor = score >= 75 ? '#4caf50' : score >= 50 ? '#1a73e8' : score >= 25 ? '#ff9800' : '#f44336';
    
    return `
        <div class="metric-card-visual position-card" data-metric="position">
            <div class="metric-header-visual">
                <div class="metric-info">
                    <div class="metric-label-visual">
                        <span class="metric-icon-visual">📍</span>
                        <span>Avg Position</span>
                    </div>
                    <div class="metric-value-visual">#${position.toFixed(1)}</div>
                    ${trend !== null && trend !== undefined ? `
                        <div class="metric-trend-visual ${trendClass}">
                            <span class="trend-arrow">${trendIcon}</span>
                            <span class="trend-value">${Math.abs(trend).toFixed(1)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="performance-score-visual">
                <svg class="score-ring" viewBox="0 0 36 36">
                    <defs>
                        <linearGradient id="scoreGradient${Date.now()}" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:${scoreColor};stop-opacity:1" />
                            <stop offset="100%" style="stop-color:${scoreColor};stop-opacity:0.6" />
                        </linearGradient>
                    </defs>
                    <path class="score-ring-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        stroke-dasharray="100, 100"/>
                    <path class="score-ring-fill"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        stroke-dasharray="${score}, 100"
                        stroke="url(#scoreGradient${Date.now()})"/>
                </svg>
                <div class="score-text-visual">${score}</div>
                <div class="score-label-visual">Performance</div>
            </div>
        </div>
    `;
}

// Create performance insights bar
function createPerformanceInsightsBar(gscData, performanceStatus) {
    const insights = [];
    
    // Quick performance insights
    if (gscData.position <= 3 && gscData.ctr < 0.1) {
        insights.push({ icon: '⚠️', text: 'Low CTR for top position', type: 'warning' });
    }
    if (gscData.impressions > 1000 && gscData.clicks < 50) {
        insights.push({ icon: '⚡', text: 'High visibility, low engagement', type: 'opportunity' });
    }
    if (gscData.trend && gscData.trend.clicksChange > 20) {
        insights.push({ icon: '🚀', text: 'Strong growth trend', type: 'success' });
    }
    
    if (insights.length === 0) return '';
    
    return `
        <div class="performance-insights-bar">
            ${insights.map(insight => `
                <div class="insight-pill ${insight.type}">
                    <span class="insight-icon">${insight.icon}</span>
                    <span class="insight-text">${insight.text}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Create visual queries section with enhanced display
function createVisualQueriesSection(queries, url) {
    if (!queries || queries.length === 0) return '';
    
    // Sort queries by opportunity score
    const sortedQueries = [...queries].sort((a, b) => {
        const scoreA = calculateQueryOpportunityScore(a);
        const scoreB = calculateQueryOpportunityScore(b);
        return scoreB - scoreA;
    });
    
    return `
        <div class="gsc-queries-visual">
            <div class="queries-header-visual">
                <h3 class="section-title-visual">
                    <span>🔍</span>
                    <span>Search Query Performance</span>
                    <span class="query-count">${queries.length} queries</span>
                </h3>
                <div class="view-toggle">
                    <button class="toggle-btn active" onclick="toggleQueryView('list', '${url}')">List</button>
                    <button class="toggle-btn" onclick="toggleQueryView('chart', '${url}')">Chart</button>
                    <button class="toggle-btn" onclick="toggleQueryView('table', '${url}')">Table</button>
                </div>
            </div>
            
            <div id="query-view-container" class="query-list-visual">
                ${sortedQueries.slice(0, 5).map((query, index) => createVisualQueryItem(query, index)).join('')}
            </div>
            
            ${queries.length > 5 ? `
                <button class="show-more-queries" onclick="showAllQueries('${url}')">
                    Show all ${queries.length} queries →
                </button>
            ` : ''}
        </div>
    `;
}

// Create individual query item with visual enhancements
function createVisualQueryItem(query, index) {
    const performanceClass = getQueryPerformanceClass(query);
    const opportunityScore = calculateQueryOpportunityScore(query);
    const ctrPercent = (query.ctr * 100);
    const impressionScale = Math.min(query.impressions / 1000, 100);
    
    return `
        <div class="query-item-visual ${performanceClass}" data-opportunity-score="${opportunityScore}">
            <div class="query-performance-bar ${performanceClass}"></div>
            <div class="query-rank-badge">#${index + 1}</div>
            
            <div class="query-content-visual">
                <div class="query-text-section">
                    <div class="query-text-visual">${escapeHtml(query.query)}</div>
                    ${query.opportunity ? `
                        <span class="opportunity-badge ${query.opportunity}">
                            ${query.opportunity === 'rank-opportunity' ? '📈 Rank' : '🎯 CTR'} Opportunity
                        </span>
                    ` : ''}
                </div>
                
                <div class="query-metrics-visual">
                    <div class="query-metric clicks-metric">
                        <div class="query-metric-value">${formatMetricValue(query.clicks)}</div>
                        <div class="query-metric-label">clicks</div>
                    </div>
                    
                    <div class="query-metric position-metric">
                        <div class="query-metric-value">#${query.position.toFixed(1)}</div>
                        <div class="query-metric-label">position</div>
                        <div class="position-indicator">
                            ${createPositionIndicator(query.position)}
                        </div>
                    </div>
                    
                    <div class="query-metric ctr-metric">
                        <div class="query-metric-value">${ctrPercent.toFixed(1)}%</div>
                        <div class="query-metric-label">CTR</div>
                        <div class="ctr-visual">
                            <div class="ctr-bar">
                                <div class="ctr-fill" style="width: ${Math.min(ctrPercent * 10, 100)}%"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="query-metric impressions-metric">
                        <div class="query-metric-value">${formatMetricValue(query.impressions)}</div>
                        <div class="query-metric-label">impr.</div>
                        <div class="impressions-scale" style="width: ${impressionScale}%"></div>
                    </div>
                </div>
            </div>
            
            ${opportunityScore > 50 ? `
                <div class="query-opportunity-hint">
                    <span class="hint-icon">💡</span>
                    <span class="hint-text">${getOpportunityHint(query)}</span>
                </div>
            ` : ''}
        </div>
    `;
}

// Create visual opportunities section with impact visualization
function createVisualOpportunitiesSection(opportunities) {
    const totalPotential = opportunities.reduce((sum, opp) => sum + opp.potentialClicks, 0);
    const topOpportunities = opportunities.slice(0, 3);
    
    return `
        <div class="opportunities-section-visual">
            <div class="opportunities-header-visual">
                <div class="opp-title-section">
                    <span class="opp-icon">⚡</span>
                    <h3 class="opp-title">Quick Win Opportunities</h3>
                </div>
                <div class="opp-summary">
                    <span class="potential-value">+${formatMetricValue(totalPotential)}</span>
                    <span class="potential-label">potential clicks/month</span>
                </div>
            </div>
            
            <div class="opportunities-grid">
                ${topOpportunities.map(opp => createOpportunityCard(opp)).join('')}
            </div>
            
            ${opportunities.length > 3 ? `
                <button class="see-all-opportunities" onclick="showAllOpportunities('${opportunities[0].url || ''}')">
                    View all ${opportunities.length} opportunities →
                </button>
            ` : ''}
        </div>
    `;
}

// Create opportunity card
function createOpportunityCard(opportunity) {
    const impactLevel = opportunity.potentialClicks > 100 ? 'high' : 
                       opportunity.potentialClicks > 50 ? 'medium' : 'low';
    
    return `
        <div class="opportunity-card-visual ${impactLevel}-impact">
            <div class="opp-query">"${escapeHtml(opportunity.query)}"</div>
            <div class="opp-metrics">
                <div class="opp-metric">
                    <span class="opp-metric-value">${formatMetricValue(opportunity.impressions)}</span>
                    <span class="opp-metric-label">impressions</span>
                </div>
                <div class="opp-metric">
                    <span class="opp-metric-value">#${opportunity.position.toFixed(0)}</span>
                    <span class="opp-metric-label">position</span>
                </div>
                <div class="opp-metric highlight">
                    <span class="opp-metric-value">+${opportunity.potentialClicks}</span>
                    <span class="opp-metric-label">potential clicks</span>
                </div>
            </div>
            <div class="opp-action-hint">
                ${getActionHint(opportunity)}
            </div>
        </div>
    `;
}

// Create visual insights section
function createVisualInsightsSection(insights) {
    const prioritizedInsights = insights.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    return `
        <div class="insights-section-visual">
            <h3 class="insights-title">
                <span>💡</span>
                Content Optimization Insights
            </h3>
            <div class="insights-grid">
                ${prioritizedInsights.slice(0, 3).map(insight => createInsightCard(insight)).join('')}
            </div>
        </div>
    `;
}

// Create insight card
function createInsightCard(insight) {
    const iconMap = {
        warning: '⚠️',
        opportunity: '⚡',
        info: 'ℹ️',
        success: '✅'
    };
    
    return `
        <div class="insight-card-visual priority-${insight.priority}">
            <div class="insight-header">
                <span class="insight-type-icon">${iconMap[insight.type] || '💡'}</span>
                <span class="insight-priority-badge">${insight.priority}</span>
            </div>
            <div class="insight-content">
                <h4 class="insight-title">${insight.title}</h4>
                <p class="insight-description">${insight.description}</p>
            </div>
        </div>
    `;
}

// Helper Functions

// Calculate performance score (0-100)
function calculatePerformanceScore(gscData) {
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

// Calculate query opportunity score
function calculateQueryOpportunityScore(query) {
    let score = 0;
    
    // High impressions with low CTR
    if (query.impressions > 100 && query.ctr < 0.02) {
        score += 40;
    }
    
    // Position 4-20 (can improve to first page)
    if (query.position > 3 && query.position <= 20) {
        score += 30;
    }
    
    // High impressions in general
    score += Math.min(query.impressions / 1000 * 20, 20);
    
    // Low hanging fruit (position 11-15)
    if (query.position > 10 && query.position <= 15) {
        score += 10;
    }
    
    return Math.round(score);
}

// Get query performance class
function getQueryPerformanceClass(query) {
    if (query.position <= 3 && query.ctr >= 0.08) return 'performance-excellent';
    if (query.position <= 10 && query.ctr >= 0.04) return 'performance-good';
    if (query.impressions > 100 && query.ctr < 0.02) return 'performance-opportunity';
    if (query.position > 20) return 'performance-poor';
    return 'performance-average';
}

// Format metric values for display
function formatMetricValue(value) {
    if (typeof value !== 'number') return value;
    
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 10000) {
        return (value / 1000).toFixed(1) + 'K';
    } else if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString();
}

// Create sparkline SVG
function createSparklineSVG(data, label) {
    if (!data || data.length < 2) return '';
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 30 - ((value - min) / range * 25);
        return { x, y };
    });
    
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaData = pathData + ` L100,30 L0,30 Z`;
    
    const color = label === 'Clicks' ? '#1a73e8' : 
                  label === 'Impressions' ? '#34a853' : 
                  label === 'CTR' ? '#fbbc04' : '#ea4335';
    
    return `
        <svg class="metric-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
            <defs>
                <linearGradient id="gradient-${label}-${Date.now()}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:${color};stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:${color};stop-opacity:0.05" />
                </linearGradient>
            </defs>
            <path class="sparkline-area" d="${areaData}" fill="url(#gradient-${label}-${Date.now()})"/>
            <path class="sparkline-path" d="${pathData}" stroke="${color}" stroke-width="2" fill="none"/>
        </svg>
    `;
}

// Generate sparkline data from GSC data
function generateSparklineData(gscData) {
    // In real implementation, this would use historical data
    // For now, generate sample trending data
    return {
        clicks: Array.from({length: 10}, () => Math.random() * gscData.clicks * 1.5),
        impressions: Array.from({length: 10}, () => Math.random() * gscData.impressions * 1.5),
        ctr: Array.from({length: 10}, () => Math.random() * gscData.ctr * 100 * 1.5)
    };
}

// Create position indicator
function createPositionIndicator(position) {
    const page = Math.ceil(position / 10);
    const pageLabel = page === 1 ? '1st page' : `${page}${getOrdinalSuffix(page)} page`;
    
    return `<span class="position-page page-${page}">${pageLabel}</span>`;
}

// Get ordinal suffix
function getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

// Get opportunity hint
function getOpportunityHint(query) {
    if (query.position > 10 && query.position <= 20) {
        return 'Move to page 1 with content optimization';
    }
    if (query.ctr < 0.02 && query.position <= 10) {
        return 'Improve meta description for better CTR';
    }
    if (query.impressions > 1000 && query.clicks < 50) {
        return 'High visibility - optimize for conversions';
    }
    return 'Optimize content for this query';
}

// Get action hint for opportunities
function getActionHint(opportunity) {
    if (opportunity.position > 10 && opportunity.position <= 15) {
        return '🎯 Add related content section';
    }
    if (opportunity.ctr < 0.01) {
        return '✏️ Rewrite title & meta description';
    }
    if (opportunity.position > 15) {
        return '📝 Create dedicated content';
    }
    return '🔧 Optimize existing content';
}

// Calculate CTR trend
function calculateCTRTrend(gscData, trendData) {
    if (!trendData || !trendData.clicksChange || !trendData.impressionsChange) return null;
    
    // CTR trend is more complex than just clicks/impressions change
    const currentCTR = gscData.ctr;
    const previousClicks = gscData.clicks / (1 + trendData.clicksChange / 100);
    const previousImpressions = gscData.impressions / (1 + trendData.impressionsChange / 100);
    const previousCTR = previousClicks / previousImpressions;
    
    return ((currentCTR - previousCTR) / previousCTR * 100);
}

// Escape HTML for security
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Date range update handler
window.updateGSCDateRange = async function(button, url) {
    const pills = button.parentElement.querySelectorAll('.date-pill');
    pills.forEach(pill => pill.classList.remove('active'));
    button.classList.add('active');
    
    const days = parseInt(button.getAttribute('data-days'));
    const dateRangeText = button.textContent;
    
    // Update date display
    const dateInfo = button.closest('.gsc-date-selector').querySelector('#date-range-text');
    if (dateInfo) {
        dateInfo.textContent = `Last ${dateRangeText}`;
    }
    
    // Show loading state
    const container = button.closest('.gsc-section-enhanced');
    if (container) {
        container.classList.add('loading');
    }
    
    // Fetch new data with date range
    await fetchGSCDataWithDateRange(url, days);
    
    // Remove loading state
    if (container) {
        container.classList.remove('loading');
    }
};

// Toggle query view
window.toggleQueryView = function(view, url) {
    const container = document.getElementById('query-view-container');
    const buttons = container.parentElement.querySelectorAll('.toggle-btn');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const gscData = gscDataMap.get(url);
    if (!gscData || !gscData.topQueries) return;
    
    switch(view) {
        case 'chart':
            container.innerHTML = createQueryChart(gscData.topQueries);
            break;
        case 'table':
            container.innerHTML = createQueryTable(gscData.topQueries);
            break;
        default:
            container.innerHTML = gscData.topQueries
                .slice(0, 5)
                .map((query, index) => createVisualQueryItem(query, index))
                .join('');
    }
};

// Create query chart view
function createQueryChart(queries) {
    const maxImpressions = Math.max(...queries.map(q => q.impressions));
    
    return `
        <div class="query-chart-container">
            ${queries.slice(0, 10).map(query => `
                <div class="query-chart-item">
                    <div class="query-chart-label">${escapeHtml(query.query)}</div>
                    <div class="query-chart-bars">
                        <div class="impressions-bar" style="width: ${(query.impressions / maxImpressions * 100)}%">
                            <span class="bar-value">${formatMetricValue(query.impressions)}</span>
                        </div>
                        <div class="clicks-bar" style="width: ${(query.clicks / query.impressions * 100)}%">
                            <span class="bar-value">${query.clicks}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
            <div class="chart-legend">
                <span class="legend-item impressions">Impressions</span>
                <span class="legend-item clicks">Clicks (CTR)</span>
            </div>
        </div>
    `;
}

// Create query table view
function createQueryTable(queries) {
    return `
        <div class="query-table-container">
            <table class="query-table">
                <thead>
                    <tr>
                        <th>Query</th>
                        <th>Clicks</th>
                        <th>Impr.</th>
                        <th>CTR</th>
                        <th>Pos.</th>
                    </tr>
                </thead>
                <tbody>
                    ${queries.map(query => `
                        <tr>
                            <td class="query-cell">${escapeHtml(query.query)}</td>
                            <td class="numeric-cell">${formatMetricValue(query.clicks)}</td>
                            <td class="numeric-cell">${formatMetricValue(query.impressions)}</td>
                            <td class="numeric-cell">${(query.ctr * 100).toFixed(1)}%</td>
                            <td class="numeric-cell">#${query.position.toFixed(1)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Show all queries modal
window.showAllQueries = function(url) {
    const gscData = gscDataMap.get(url);
    if (!gscData || !gscData.topQueries) return;
    
    // Create modal with all queries
    const modal = document.createElement('div');
    modal.className = 'gsc-modal';
    modal.innerHTML = `
        <div class="gsc-modal-content">
            <div class="modal-header">
                <h2>All Search Queries</h2>
                <button class="close-modal" onclick="this.closest('.gsc-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="all-queries-list">
                    ${gscData.topQueries.map((query, index) => createVisualQueryItem(query, index)).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

// Export visual report
window.exportVisualReport = function(url) {
    const gscData = gscDataMap.get(url);
    if (!gscData) return;
    
    // Generate visual report data
    const report = {
        url: url,
        generatedAt: new Date().toISOString(),
        performanceScore: calculatePerformanceScore(gscData),
        metrics: {
            clicks: gscData.clicks,
            impressions: gscData.impressions,
            ctr: (gscData.ctr * 100).toFixed(2) + '%',
            position: gscData.position.toFixed(1)
        },
        trends: gscData.trend || {},
        topQueries: gscData.topQueries || [],
        opportunities: gscData.opportunities || [],
        insights: gscData.insights || []
    };
    
    // Create downloadable report
    const reportHTML = generateVisualReportHTML(report);
    const blob = new Blob([reportHTML], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);  // Changed from 'url' to 'blobUrl'
    const link = document.createElement('a');
    link.href = blobUrl;  // Updated reference
    link.download = `gsc-visual-report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);  // Updated reference
    
    // Show success message
    showNotification('Visual report exported successfully!', 'success');
};

// Generate visual report HTML
function generateVisualReportHTML(report) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>GSC Performance Report - ${report.url}</title>
            <style>
                /* Include relevant styles here */
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                /* ... more styles ... */
            </style>
        </head>
        <body>
            <h1>Search Performance Report</h1>
            <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
            <!-- Report content here -->
        </body>
        </html>
    `;
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `gsc-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4caf50' : '#2196f3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Fetch GSC data with date range
async function fetchGSCDataWithDateRange(url, days) {
    // This would be integrated with your existing fetchNodeGSCData function
    // For now, showing the structure
    
    const today = new Date();
    const startDate = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));
    
    // You would modify your existing fetchSingleNodeData to accept date parameters
    // and update the GSC API calls accordingly
    
    console.log(`Fetching GSC data for ${url} from ${startDate.toISOString()} to ${today.toISOString()}`);
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update the display
    const nodeData = findNodeByUrl(url);
    if (nodeData && window.showEnhancedTooltip) {
        const tooltip = document.querySelector('.enhanced-tooltip.visible');
        if (tooltip) {
            // Refresh tooltip with new date range data
            showEnhancedTooltipWithImprovedGSC(event, nodeData);
        }
    }
}

    // Create individual metric cards with trend indicators
    function createMetricCard(label, value, trendValue, icon, useK = false) {
        let displayValue = value;
        if (useK && value >= 1000) {
            displayValue = (value / 1000).toFixed(1) + 'K';
        } else if (typeof value === 'number') {
            displayValue = value.toLocaleString();
        }
        
        let trendHtml = '';
        if (trendValue !== null && trendValue !== undefined) {
            const trendNum = parseFloat(trendValue);
            const trendClass = trendNum >= 0 ? 'trend-up' : 'trend-down';
            const trendIcon = trendNum >= 0 ? '↗' : '↘';
            trendHtml = `<div class="metric-trend ${trendClass}">${trendIcon} ${Math.abs(trendNum)}%</div>`;
        }
        
        return `
            <div class="metric-card">
                <div class="metric-header">
                    <span class="metric-icon">${icon}</span>
                    <span class="metric-label">${label}</span>
                </div>
                <div class="metric-value">${displayValue}</div>
                ${trendHtml}
            </div>
        `;
    }

    // Analyze performance status for quick visual indicator
    function analyzePerformanceStatus(gscData) {
        const ctr = gscData.ctr * 100;
        const position = gscData.position;
        const clicks = gscData.clicks;
        
        // Excellent performance
        if (position <= 3 && ctr >= 8 && clicks >= 100) {
            return { class: 'status-excellent', icon: '🚀', label: 'Excellent' };
        }
        
        // Good performance  
        if (position <= 5 && ctr >= 5) {
            return { class: 'status-good', icon: '✅', label: 'Good' };
        }
        
        // Needs attention
        if (position <= 10 && (ctr < 3 || (gscData.impressions > 500 && clicks < 50))) {
            return { class: 'status-attention', icon: '⚠️', label: 'Needs Attention' };
        }
        
        // Opportunity (high impressions, poor position)
        if (position > 10 && gscData.impressions > 100) {
            return { class: 'status-opportunity', icon: '⚡', label: 'Opportunity' };
        }
        
        // Low visibility
        if (gscData.impressions < 50) {
            return { class: 'status-low', icon: '📉', label: 'Low Visibility' };
        }
        
        return { class: 'status-average', icon: '📊', label: 'Average' };
    }

    // Create compact top queries section
    function createTopQueriesSection(topQueries) {
        const topThree = topQueries.slice(0, 3);
        
        return `
            <div class="gsc-queries-section">
                <div class="section-header">
                    <span class="section-icon">🔍</span>
                    <span class="section-title">Top Search Terms</span>
                    <span class="query-count">${topQueries.length} total</span>
                </div>
                <div class="queries-list">
                    ${topThree.map((query, index) => `
                        <div class="query-item ${getQueryPriorityClass(query)}">
                            <div class="query-main">
                                <span class="query-rank">#${index + 1}</span>
                                <span class="query-text">"${truncateQuery(query.query)}"</span>
                                ${query.opportunity ? `<span class="query-opportunity">⚡</span>` : ''}
                            </div>
                            <div class="query-stats">
                                <span class="stat-clicks">${query.clicks}c</span>
                                <span class="stat-position">#${query.position.toFixed(0)}</span>
                                <span class="stat-ctr">${(query.ctr * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Create opportunities alert section
    function createOpportunitiesAlert(opportunities) {
        const totalPotential = opportunities.reduce((sum, opp) => sum + opp.potentialClicks, 0);
        
        return `
            <div class="gsc-opportunities-alert">
                <div class="opportunity-header">
                    <span class="opportunity-icon">⚡</span>
                    <span class="opportunity-title">Quick Win Opportunities</span>
                    <span class="opportunity-potential">+${totalPotential} potential clicks</span>
                </div>
                <div class="opportunity-preview">
                    ${opportunities.slice(0, 2).map(opp => `
                        <div class="opportunity-item">
                            <span class="opportunity-query">"${truncateQuery(opp.query)}"</span>
                            <span class="opportunity-stats">${opp.impressions} imp • +${opp.potentialClicks}c</span>
                        </div>
                    `).join('')}
                    ${opportunities.length > 2 ? `<div class="opportunity-more">+${opportunities.length - 2} more</div>` : ''}
                </div>
            </div>
        `;
    }

    // Create insights section
    function createInsightsSection(insights) {
        const primaryInsight = insights[0];
        
        return `
            <div class="gsc-insights-section">
                <div class="insight-item ${getPriorityClass(primaryInsight.priority)}">
                    <div class="insight-header">
                        <span class="insight-icon">${getInsightIcon(primaryInsight.type)}</span>
                        <span class="insight-title">${primaryInsight.title}</span>
                        <span class="insight-priority">${primaryInsight.priority.toUpperCase()}</span>
                    </div>
                    <div class="insight-description">${primaryInsight.description}</div>
                </div>
                ${insights.length > 1 ? `<div class="insights-more">+${insights.length - 1} more insights</div>` : ''}
            </div>
        `;
    }

    // Create loading section
    function createGSCLoadingSection() {
        return `
            <div class="gsc-section-enhanced">
                <div class="gsc-header">
                    <div class="gsc-header-left">
                        <span class="gsc-icon">📊</span>
                        <span class="gsc-title">Search Performance</span>
                    </div>
                    <div class="gsc-loading">
                        <div class="loading-spinner"></div>
                        <span>Loading...</span>
                    </div>
                </div>
                <div class="gsc-loading-placeholder">
                    <div class="loading-text">Fetching comprehensive search data...</div>
                </div>
            </div>
        `;
    }

    // Create no data section
    function createNoGSCDataSection() {
        return `
            <div class="gsc-section-enhanced">
                <div class="gsc-header">
                    <div class="gsc-header-left">
                        <span class="gsc-icon">📊</span>
                        <span class="gsc-title">Search Performance</span>
                    </div>
                    <div class="gsc-status status-none">
                        📭 No Data
                    </div>
                </div>
                <div class="gsc-no-data">
                    <div class="no-data-text">No search console data found for this page</div>
                    <div class="no-data-suggestion">Page may be new, blocked, or not indexed</div>
                </div>
            </div>
        `;
    }

    // Create site structure section  
    function createSiteStructureSection(d, nodeType, descendantCount, siblingCount, isLeaf, data) {
        return `
            <div class="structure-section">
                <div class="structure-grid">
                    <div class="structure-item">
                        <span class="structure-icon">📊</span>
                        <span class="structure-label">Type</span>
                        <span class="structure-value">${nodeType}</span>
                    </div>
                    <div class="structure-item">
                        <span class="structure-icon">📏</span>
                        <span class="structure-label">Depth</span>
                        <span class="structure-value">${d.depth}</span>
                    </div>
                    <div class="structure-item">
                        <span class="structure-icon">${isLeaf ? '👫' : '👥'}</span>
                        <span class="structure-label">${isLeaf ? 'Siblings' : 'Children'}</span>
                        <span class="structure-value">${isLeaf ? siblingCount : descendantCount}</span>
                    </div>
                    ${data.pageCount ? `
                    <div class="structure-item">
                        <span class="structure-icon">📄</span>
                        <span class="structure-label">Total Pages</span>
                        <span class="structure-value">${data.pageCount}</span>
                    </div>
                    ` : ''}
                </div>
                ${data.lastModified ? `
                    <div class="structure-meta">
                        <span class="meta-icon">📅</span>
                        <span class="meta-text">Updated: ${formatDate(new Date(data.lastModified))}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Create actions section
    function createActionsSection(data, d, isLeaf) {
        return `
            <div class="actions-section">
                ${data.url ? `
                    <button class="action-btn primary" onclick="window.open('${data.url}', '_blank')">
                        <span class="btn-icon">🔗</span>
                        <span class="btn-text">Visit Page</span>
                    </button>
                    <button class="action-btn secondary" onclick="window.focusOnNode('${d.id || data.name}')">
                        <span class="btn-icon">🎯</span>
                        <span class="btn-text">Focus</span>
                    </button>
                ` : `
                    <button class="action-btn primary" onclick="window.focusOnNode('${d.id || data.name}')">
                        <span class="btn-icon">🎯</span>
                        <span class="btn-text">Focus View</span>
                    </button>
                    ${!isLeaf ? `
                    <button class="action-btn secondary" onclick="window.toggleNode('${d.id || data.name}')">
                        <span class="btn-icon">${d.children ? '➖' : '➕'}</span>
                        <span class="btn-text">${d.children ? 'Collapse' : 'Expand'}</span>
                    </button>
                    ` : ''}
                `}
            </div>
        `;
    }

    // Utility functions
    function getQueryPriorityClass(query) {
        if (query.opportunity === 'rank-opportunity') return 'query-rank-opp';
        if (query.opportunity === 'ctr-opportunity') return 'query-ctr-opp';
        if (query.position <= 3) return 'query-top';
        return 'query-normal';
    }

    function truncateQuery(query, maxLength = 25) {
        return query.length > maxLength ? query.substring(0, maxLength) + '...' : query;
    }

    function getPriorityClass(priority) {
        return `priority-${priority}`;
    }

    function getInsightIcon(type) {
        const icons = {
            warning: '⚠️',
            opportunity: '⚡',
            info: 'ℹ️',
            success: '✅'
        };
        return icons[type] || '💡';
    }

    function formatDate(date) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    // Quick export function
    window.exportQuickGSCData = function(url) {
        const gscData = gscDataMap.get(url);
        if (!gscData) return;
        
        const quickData = {
            url: url,
            summary: {
                clicks: gscData.clicks,
                impressions: gscData.impressions,
                ctr: (gscData.ctr * 100).toFixed(2) + '%',
                position: gscData.position.toFixed(1)
            },
            topQueries: gscData.topQueries?.slice(0, 5),
            opportunities: gscData.opportunities?.slice(0, 3),
            exportedAt: new Date().toISOString()
        };
        
        navigator.clipboard.writeText(JSON.stringify(quickData, null, 2));
        
        // Show feedback
        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #4caf50; color: white;
            padding: 10px 15px; border-radius: 6px; z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        feedback.textContent = 'GSC data copied to clipboard!';
        document.body.appendChild(feedback);
        
        setTimeout(() => feedback.remove(), 2000);
    };

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
                                <div style="font-weight: 500;">${query.query}</div>
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
                        <div style="font-weight: bold; color: #e65100; margin-bottom: 5px;">"${opp.query}"</div>
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
    const csvUrl = URL.createObjectURL(blob);  // Changed from 'urlObj' to 'csvUrl' for clarity
    const link = document.createElement('a');
    link.href = csvUrl;
    link.download = `gsc-analysis-${url.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(csvUrl);
};

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
