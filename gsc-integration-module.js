// gsc-integration-module.js - Enhanced Content Writer Version with Improved Display

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
            const navBar = document.querySelector('.nav-group') || document.querySelector('.nav-bar');
            if (!navBar) {
                setTimeout(checkAndAdd, 100);
                return;
            }
            
            if (document.getElementById('gscConnectBtn')) return;
            
            const gscButton = document.createElement('button');
            gscButton.className = 'nav-btn nav-gsc-btn';
            gscButton.id = 'gscConnectBtn';
            gscButton.onclick = toggleGSCConnection;
            gscButton.innerHTML = `
                <span id="gscIcon">🔍</span>
                <span id="gscText">Connect GSC</span>
            `;
            
            const reportsDropdown = document.getElementById('reportsDropdown');
            if (reportsDropdown) {
                navBar.insertBefore(gscButton, reportsDropdown);
            } else {
                navBar.appendChild(gscButton);
            }
            
            debugLog('GSC button added to navigation');
        };
        
        checkAndAdd();
    }

    // Add styles with all enhancements
    function addGSCStyles() {
        if (document.getElementById('gsc-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'gsc-styles';
        style.textContent = `
            .nav-gsc-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.3s ease;
            }
            
            .nav-gsc-btn.connected {
                background: #4caf50 !important;
                color: white !important;
            }
            
            .nav-gsc-btn.connected:hover {
                background: #45a049 !important;
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
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .gsc-loading-spinner {
                animation: spin 1s linear infinite;
            }
            
            .tooltip-gsc-section {
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @media (max-width: 768px) {
                .nav-gsc-btn span:not(#gscIcon) {
                    display: none;
                }
                
                .nav-gsc-btn {
                    padding: 0.5rem !important;
                    min-width: auto !important;
                }
            }

            /* Enhanced Tooltip Header */
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

            /* Enhanced GSC Section */
            .gsc-section-enhanced {
                background: #f8faff;
                border: 1px solid #e3f2fd;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
            }

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

            /* Metrics Grid */
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

            /* Top Queries Section */
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

            .query-count {
                font-size: 0.7rem;
                color: #666;
                margin-left: auto;
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

            /* Opportunities Alert */
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

            /* Insights Section */
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

            /* Responsive Adjustments */
            @media (max-width: 400px) {
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

            .gsc-section-enhanced {
                animation: fadeInUp 0.3s ease;
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

            /* Improved tooltip container */
            .enhanced-tooltip {
                max-width: 380px;
                min-width: 320px;
                font-size: 14px;
                line-height: 1.4;
            }

            .enhanced-tooltip.visible {
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
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

    // Hook into tooltips with enhanced display
    function hookIntoTooltips() {
        const checkAndHook = () => {
            if (window.showEnhancedTooltip) {
                const originalShowEnhancedTooltip = window.showEnhancedTooltip;
                window.showEnhancedTooltip = function(event, d, isLoadingGSC = false) {
                    showEnhancedTooltipWithImprovedGSC(event, d, isLoadingGSC);
                };
                debugLog('Hooked into tooltip display');
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
        
        // Trigger lazy loading if needed
        if (gscConnected && gscDataLoaded && data.url && !gscDataMap.has(data.url) && !isLoadingGSC) {
            isLoadingGSC = true;
            fetchNodeGSCData(data).then(() => {
                const currentTooltip = document.querySelector('.enhanced-tooltip.visible');
                if (currentTooltip) {
                    showEnhancedTooltipWithImprovedGSC(event, d, false);
                }
            });
        }
        
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
        
        // Position tooltip
        const tooltipNode = window.enhancedTooltip.node();
        const tooltipRect = tooltipNode.getBoundingClientRect();
        const pageWidth = window.innerWidth;
        const pageHeight = window.innerHeight;
        
        let left = event.pageX + 15;
        let top = event.pageY - tooltipRect.height / 2;
        
        if (left + tooltipRect.width > pageWidth - 20) {
            left = event.pageX - tooltipRect.width - 15;
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
            
        // Add mouse events to the tooltip itself
        window.enhancedTooltip
            .on("mouseenter", function() {
                window.tooltipMouseOver = true;
                if (window.hideTooltipTimeout) clearTimeout(window.hideTooltipTimeout);
            })
            .on("mouseleave", function() {
                window.tooltipMouseOver = false;
                window.enhancedTooltip
                    .transition()
                    .duration(200)
                    .style("opacity", 0)
                    .on("end", function() {
                        d3.select(this).classed("visible", false);
                    });
            });
    }

    // Create enhanced GSC section with better layout
    function createEnhancedGSCSection(gscData) {
        const performanceStatus = analyzePerformanceStatus(gscData);
        
        return `
            <div class="gsc-section-enhanced">
                <!-- Header with Status Indicator -->
                <div class="gsc-header">
                    <div class="gsc-header-left">
                        <span class="gsc-icon">📊</span>
                        <span class="gsc-title">Search Performance</span>
                        <span class="gsc-period">(30 days)</span>
                    </div>
                    <div class="gsc-status ${performanceStatus.class}">
                        ${performanceStatus.icon} ${performanceStatus.label}
                    </div>
                </div>
                
                <!-- Key Metrics Grid -->
                <div class="gsc-metrics-grid">
                    ${createMetricCard('Clicks', gscData.clicks, gscData.trend?.clicksChange, '👆')}
                    ${createMetricCard('Impressions', gscData.impressions, gscData.trend?.impressionsChange, '👀', true)}
                    ${createMetricCard('CTR', `${(gscData.ctr * 100).toFixed(1)}%`, null, '🎯')}
                    ${createMetricCard('Position', `#${gscData.position.toFixed(0)}`, gscData.trend?.positionChange, '📍')}
                </div>
                
                <!-- Top Queries Compact View -->
                ${gscData.topQueries && gscData.topQueries.length > 0 ? 
                    createTopQueriesSection(gscData.topQueries) : ''}
                
                <!-- Opportunities Alert -->
                ${gscData.opportunities && gscData.opportunities.length > 0 ? 
                    createOpportunitiesAlert(gscData.opportunities) : ''}
                
                <!-- Performance Insights -->
                ${gscData.insights && gscData.insights.length > 0 ? 
                    createInsightsSection(gscData.insights) : ''}
                
                <!-- Quick Actions -->
                <div class="gsc-actions">
                    <button class="gsc-action-btn primary" onclick="showDetailedGSCAnalysis('${gscData.url}')">
                        📈 Full Analysis
                    </button>
                    <button class="gsc-action-btn secondary" onclick="exportQuickGSCData('${gscData.url}')">
                        📋 Export
                    </button>
                </div>
            </div>
        `;
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
        const urlObj = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = urlObj;
        link.download = `gsc-analysis-${url.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(urlObj);
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
