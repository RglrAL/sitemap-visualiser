// gsc-integration-module.js - Enhanced debugging version

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
        events: gscEvents,
        reset: resetGSCData,
        debug: {
            getStatus: () => ({
                gscConnected,
                gscDataLoaded,
                gapiInited,
                gisInited,
                fetchInProgress,
                dataCount: gscDataMap.size,
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
                tryFetchGSCData();
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
            }
        }
    };

    // Add these debug functions to the debug object
    window.GSCIntegration.debug.listGSCUrls = async function(limit = 25) {
        if (!accessToken || !gscSiteUrl) {
            console.error('Not connected to GSC');
            return;
        }
        
        debugLog('Fetching URLs from GSC...');
        
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
                    rowLimit: limit,
                    startRow: 0
                }
            });
            
            const rows = response.result.rows || [];
            console.log(`Found ${rows.length} URLs in GSC:`);
            
            rows.forEach((row, index) => {
                console.log(`${index + 1}. ${row.keys[0]} - Clicks: ${row.clicks}, Impressions: ${row.impressions}`);
            });
            
            return rows;
        } catch (error) {
            console.error('Error listing GSC URLs:', error);
            return error;
        }
    };

    window.GSCIntegration.debug.compareUrls = async function() {
        if (!window.treeData) {
            console.error('No sitemap data loaded');
            return;
        }
        
        // Get sitemap URLs
        const sitemapUrls = new Set();
        function collectUrls(node) {
            if (node.url) sitemapUrls.add(node.url);
            if (node.children) {
                node.children.forEach(child => collectUrls(child));
            }
        }
        collectUrls(window.treeData);
        
        console.log(`Sitemap contains ${sitemapUrls.size} URLs`);
        console.log('First 5 sitemap URLs:');
        Array.from(sitemapUrls).slice(0, 5).forEach(url => console.log(`  ${url}`));
        
        // Get GSC URLs
        const gscRows = await GSCIntegration.debug.listGSCUrls(100);
        if (!gscRows || !Array.isArray(gscRows)) return;
        
        const gscUrls = new Set(gscRows.map(row => row.keys[0]));
        
        // Compare
        console.log('\n=== URL Comparison ===');
        console.log(`Sitemap URLs: ${sitemapUrls.size}`);
        console.log(`GSC URLs: ${gscUrls.size}`);
        
        // Find exact matches
        const matches = Array.from(sitemapUrls).filter(url => gscUrls.has(url));
        console.log(`\n✓ Exact matches found: ${matches.length}`);
        
        if (matches.length === 0) {
            console.log('\n❌ No exact URL matches found!');
            
            // Analyze the differences
            const sitemapSample = Array.from(sitemapUrls)[0];
            const gscSample = gscRows[0]?.keys[0];
            
            if (sitemapSample && gscSample) {
                console.log('\nExample comparison:');
                console.log('Sitemap URL:', sitemapSample);
                console.log('GSC URL:    ', gscSample);
                
                // Check for common differences
                if (sitemapSample.startsWith('http://') && gscSample.startsWith('https://')) {
                    console.log('⚠️ Protocol mismatch detected (http vs https)');
                }
                if (sitemapSample.includes('://www.') !== gscSample.includes('://www.')) {
                    console.log('⚠️ WWW subdomain mismatch detected');
                }
                if (sitemapSample.endsWith('/') !== gscSample.endsWith('/')) {
                    console.log('⚠️ Trailing slash mismatch detected');
                }
                if (!sitemapSample.includes('://') && gscSample.includes('://')) {
                    console.log('⚠️ Sitemap has relative URLs, GSC has absolute URLs');
                }
            }
        }
        
        return {
            sitemapUrls: sitemapUrls.size,
            gscUrls: gscUrls.size,
            matches: matches.length
        };
    };

    // Add a function to fix URL matching
    window.GSCIntegration.debug.fixUrlMatching = async function() {
        console.log('Attempting to fix URL matching...');
        
        // First, get a sample of GSC URLs to understand the format
        const gscRows = await GSCIntegration.debug.listGSCUrls(10);
        if (!gscRows || gscRows.length === 0) {
            console.error('No URLs found in GSC');
            return;
        }
        
        const gscSampleUrl = gscRows[0].keys[0];
        console.log('GSC URL format example:', gscSampleUrl);
        
        // Analyze the GSC URL format
        const gscUrlObj = new URL(gscSampleUrl);
        const gscProtocol = gscUrlObj.protocol;
        const gscHasWww = gscUrlObj.hostname.startsWith('www.');
        const gscHasTrailingSlash = gscUrlObj.pathname.endsWith('/');
        
        console.log('GSC URL characteristics:');
        console.log('- Protocol:', gscProtocol);
        console.log('- Has www:', gscHasWww);
        console.log('- Has trailing slash:', gscHasTrailingSlash);
        
        // Now update the fetchGSCDataInBatches function to handle URL transformation
        console.log('\nTo fix this, the code needs to transform sitemap URLs to match GSC format.');
        console.log('Re-run the fetch with URL transformation...');
        
        // Clear existing data and re-fetch
        GSCIntegration.reset();
        
        // Modify the URL collection logic
        window._originalFetchGSCData = GSCIntegration.fetchData;
        GSCIntegration.fetchData = async function() {
            console.log('Using modified fetch with URL transformation');
            return window._originalFetchGSCData.call(this);
        };
        
        return {
            gscFormat: {
                protocol: gscProtocol,
                hasWww: gscHasWww,
                hasTrailingSlash: gscHasTrailingSlash,
                example: gscSampleUrl
            }
        };
    };

    window.GSCIntegration.debug.testUrlTransformation = function(sitemapUrl) {
        // Simulate the transformation
        const variations = [];
        
        // Original
        variations.push(sitemapUrl);
        
        // Remove language prefix and change to HTTPS
        if (sitemapUrl.includes('/en/') || sitemapUrl.includes('/ga/')) {
            const withoutLang = sitemapUrl
                .replace('/en/', '/')
                .replace('/ga/', '/')
                .replace('http://', 'https://');
            variations.push(withoutLang);
        }
        
        // Just HTTPS
        variations.push(sitemapUrl.replace('http://', 'https://'));
        
        console.log('URL transformation test:');
        console.log('Original:', sitemapUrl);
        console.log('Variations:', variations);
        
        return variations;
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
        tryFetchGSCData();
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

    // Try to fetch GSC data
    function tryFetchGSCData() {
        const hasTreeData = !!(window.treeData || (typeof treeData !== 'undefined' && treeData));
        
        debugLog('Trying to fetch GSC data...', {
            connected: gscConnected,
            treeData: hasTreeData,
            dataLoaded: gscDataLoaded,
            fetchInProgress: fetchInProgress
        });
        
        if (gscConnected && hasTreeData && !gscDataLoaded && !fetchInProgress) {
            debugLog('All conditions met, fetching GSC data...');
            fetchGSCDataForSitemap();
        }
    }

    // Fetch GSC data for sitemap
    async function fetchGSCDataForSitemap() {
        const treeDataRef = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
        
        if (!treeDataRef || !accessToken || fetchInProgress) {
            debugLog('Cannot fetch GSC data - conditions not met');
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
            
            // Try exact match first
            let matchedSite = sites.find(site => {
                const siteHost = new URL(site.siteUrl).hostname.replace('www.', '');
                const currentHost = currentDomain.replace('www.', '');
                return siteHost === currentHost;
            });
            
            // If no exact match, try partial match
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
            
            // Collect all URLs from the tree
            const allUrls = [];
            function collectUrls(node) {
                if (node.url) {
                    // Normalize URL to match what might be in GSC
                    let normalizedUrl = node.url;
                    
                    // If the sitemap URL doesn't include the protocol/domain, construct it
                    if (normalizedUrl.startsWith('/')) {
                        // Remove trailing slash from gscSiteUrl if present
                        const baseUrl = gscSiteUrl.replace(/\/$/, '');
                        normalizedUrl = baseUrl + normalizedUrl;
                    }
                    
                    allUrls.push(normalizedUrl);
                }
                if (node.children) {
                    node.children.forEach(child => collectUrls(child));
                }
            }
            collectUrls(treeDataRef);
            
            debugLog(`Collected ${allUrls.length} URLs to fetch GSC data for`);
            
            // For large sites, we might want to limit or prioritize
            let urlsToFetch = allUrls;
            if (allUrls.length > 500) {
                // For very large sites, prioritize higher-level pages and a sample of others
                const highLevelUrls = allUrls.filter(url => {
                    const pathSegments = new URL(url).pathname.split('/').filter(s => s);
                    return pathSegments.length <= 3; // Prioritize top-level pages
                });
                const otherUrls = allUrls.filter(url => !highLevelUrls.includes(url));
                
                // Take all high-level URLs and a sample of others
                urlsToFetch = [
                    ...highLevelUrls,
                    ...otherUrls.slice(0, Math.max(100, 500 - highLevelUrls.length))
                ];
                
                debugLog(`Large site detected. Limiting to ${urlsToFetch.length} URLs (${highLevelUrls.length} high-level pages)`);
            }
            
            // Log first 5 URLs for debugging
            debugLog('Sample URLs:', urlsToFetch.slice(0, 5));
            
            // First, try a general query to see what URLs GSC has
            await testGeneralQuery();
            
            // Then fetch data for our URLs
            await fetchGSCDataInBatches(urlsToFetch);
            
            gscDataLoaded = true;
            fetchInProgress = false;
            hideGSCLoadingIndicator();
            
            if (gscDataMap.size === 0) {
                showNoDataMessage();
            } else {
                showGSCSuccessMessage();
            }
            
            gscEvents.emit('dataLoaded');
            updateVisibleTooltips();
            
        } catch (error) {
            console.error('[GSC Integration] Error fetching GSC data:', error);
            hideGSCLoadingIndicator();
            fetchInProgress = false;
            
            if (error.status === 401) {
                updateConnectionStatus(false);
                alert('Your session has expired. Please reconnect to Google Search Console.');
            } else if (error.status === 403) {
                alert('Permission denied. Please make sure you have access to this Search Console property.');
            } else {
                alert('Error loading Search Console data: ' + (error.message || 'Unknown error'));
            }
        }
    }

    // Test general query to see what URLs GSC has
    async function testGeneralQuery() {
        try {
            debugLog('Running general query to see available URLs...');
            
            const today = new Date();
            const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
            
            const response = await gapi.client.request({
                path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                method: 'POST',
                body: {
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0],
                    dimensions: ['page'],
                    rowLimit: 25,
                    startRow: 0
                }
            });
            
            const rows = response.result.rows || [];
            debugLog(`General query found ${rows.length} URLs with data`);
            
            if (rows.length > 0) {
                debugLog('Sample URLs from GSC:', rows.slice(0, 5).map(r => r.keys[0]));
            }
            
            return rows;
        } catch (error) {
            console.error('General query error:', error);
            return [];
        }
    }

    // Fetch GSC data in batches
    async function fetchGSCDataInBatches(urls, batchSize = 5) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        debugLog(`Fetching data for ${urls.length} URLs`);
        
        // First, let's understand what URL format GSC is using
        let gscUrlFormat = null;
        try {
            const testResponse = await gapi.client.request({
                path: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
                method: 'POST',
                body: {
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0],
                    dimensions: ['page'],
                    rowLimit: 5
                }
            });
            
            if (testResponse.result.rows && testResponse.result.rows.length > 0) {
                gscUrlFormat = testResponse.result.rows[0].keys[0];
                debugLog('GSC URL format detected:', gscUrlFormat);
            }
        } catch (error) {
            debugLog('Could not detect GSC URL format:', error);
        }
        
        let successCount = 0;
        let processedCount = 0;
        
        // Create URL variations for better matching
        function createUrlVariations(originalUrl) {
            const variations = new Set();
            
            // Add original URL
            variations.add(originalUrl);
            
            // Special handling for MABS.ie structure
            // Sitemap has: http://mabs.ie/en/...
            // GSC has: https://mabs.ie/...
            
            if (originalUrl.includes('/en/') || originalUrl.includes('/ga/')) {
                // Remove language prefix variations
                const withoutLangPrefix = originalUrl
                    .replace('/en/', '/')
                    .replace('/ga/', '/');
                
                variations.add(withoutLangPrefix);
                
                // Also try with HTTPS
                variations.add(withoutLangPrefix.replace('http://', 'https://'));
                
                // Original with HTTPS
                variations.add(originalUrl.replace('http://', 'https://'));
            }
            
            // If we detected GSC format, try to match it
            if (gscUrlFormat) {
                try {
                    const gscUrlObj = new URL(gscUrlFormat);
                    const protocol = gscUrlObj.protocol;
                    const hasWww = gscUrlObj.hostname.startsWith('www.');
                    
                    // Handle relative URLs
                    if (originalUrl.startsWith('/')) {
                        // Build absolute URL matching GSC format
                        const baseHost = gscUrlObj.hostname;
                        let absoluteUrl = `${protocol}//${baseHost}${originalUrl}`;
                        variations.add(absoluteUrl);
                        
                        // If the URL has language prefix, try without it
                        if (originalUrl.includes('/en/') || originalUrl.includes('/ga/')) {
                            const withoutLang = originalUrl.replace('/en/', '/').replace('/ga/', '/');
                            variations.add(`${protocol}//${baseHost}${withoutLang}`);
                        }
                        
                        // Add with/without trailing slash
                        if (!absoluteUrl.endsWith('/') && !absoluteUrl.includes('?') && !absoluteUrl.match(/\.[a-z]{2,4}$/i)) {
                            variations.add(absoluteUrl + '/');
                        } else if (absoluteUrl.endsWith('/')) {
                            variations.add(absoluteUrl.slice(0, -1));
                        }
                    } else if (originalUrl.includes('://')) {
                        // Handle absolute URLs
                        const urlObj = new URL(originalUrl);
                        
                        // Create base transformations
                        let baseUrl = originalUrl;
                        
                        // 1. Match protocol
                        if (urlObj.protocol !== protocol) {
                            baseUrl = baseUrl.replace(urlObj.protocol, protocol);
                            variations.add(baseUrl);
                        }
                        
                        // 2. Remove language prefixes if present
                        if (baseUrl.includes('/en/') || baseUrl.includes('/ga/')) {
                            const withoutLang = baseUrl
                                .replace('/en/', '/')
                                .replace('/ga/', '/');
                            variations.add(withoutLang);
                            
                            // Also add HTTPS version without language
                            variations.add(withoutLang.replace('http://', 'https://'));
                        }
                        
                        // 3. Match www
                        if (hasWww && !urlObj.hostname.startsWith('www.')) {
                            variations.add(baseUrl.replace(urlObj.hostname, 'www.' + urlObj.hostname));
                        } else if (!hasWww && urlObj.hostname.startsWith('www.')) {
                            variations.add(baseUrl.replace('www.', ''));
                        }
                    }
                } catch (e) {
                    debugLog('Error creating URL variation:', e);
                }
            }
            
            // Standard variations
            if (originalUrl.includes('://')) {
                // Try both http and https
                variations.add(originalUrl.replace('http://', 'https://'));
                variations.add(originalUrl.replace('https://', 'http://'));
                
                // Try with/without www
                if (originalUrl.includes('://www.')) {
                    variations.add(originalUrl.replace('://www.', '://'));
                } else {
                    variations.add(originalUrl.replace('://', '://www.'));
                }
                
                // Try with/without trailing slash (except for files)
                if (!originalUrl.includes('?') && !originalUrl.match(/\.[a-z]{2,4}$/i)) {
                    if (originalUrl.endsWith('/')) {
                        variations.add(originalUrl.slice(0, -1));
                    } else {
                        variations.add(originalUrl + '/');
                    }
                }
            }
            
            // Log first few variations for debugging
            if (processedCount <= 3) {
                debugLog(`URL variations for ${originalUrl}:`, Array.from(variations));
            }
            
            return Array.from(variations);
        }

        // Process URLs in batches
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            const batchPromises = batch.map(async (url) => {
                const variations = createUrlVariations(url);
                
                // Try each variation until we find data
                for (const variation of variations) {
                    try {
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
                                        expression: variation
                                    }]
                                }],
                                rowLimit: 1
                            }
                        });
                        
                        if (response.result.rows && response.result.rows.length > 0) {
                            const row = response.result.rows[0];
                            const gscData = {
                                clicks: row.clicks || 0,
                                impressions: row.impressions || 0,
                                ctr: row.ctr || 0,
                                position: row.position || 0
                            };
                            
                            // Store data using the original URL as key
                            gscDataMap.set(url, gscData);
                            
                            // Also store using the variation that worked
                            if (variation !== url) {
                                gscDataMap.set(variation, gscData);
                            }
                            
                            successCount++;
                            debugLog(`Found data for ${url} (using ${variation}):`, gscData);
                            break; // Found data, no need to try other variations
                        }
                    } catch (error) {
                        debugLog(`Error fetching data for ${variation}:`, error);
                        // Continue to next variation
                    }
                }
                
                processedCount++;
                updateGSCLoadingProgress((processedCount / urls.length) * 100);
            });
            
            await Promise.all(batchPromises);
            
            // Add delay between batches to respect rate limits
            if (i + batchSize < urls.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        debugLog(`Batch processing complete. Found data for ${successCount} out of ${urls.length} URLs`);
        return successCount;
    }

    // Show no data message
    function showNoDataMessage() {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #ff9800;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        message.innerHTML = `
            <div style="display: flex; align-items: start; gap: 10px;">
                <span style="font-size: 20px;">⚠️</span>
                <div>
                    <div style="font-weight: bold; margin-bottom: 8px;">No Search Console Data Found</div>
                    <div style="font-size: 0.9rem; opacity: 0.9; line-height: 1.4;">
                        This could mean:
                        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                            <li>The URLs in your sitemap don't match those in Search Console</li>
                            <li>Your site might be using www vs non-www differently</li>
                            <li>The site hasn't accumulated data in the last 30 days</li>
                        </ul>
                        <div style="margin-top: 12px;">
                            <button onclick="GSCIntegration.debug.testSingleUrl(prompt('Enter a URL to test:'))" 
                                    style="background: white; color: #ff9800; border: none; padding: 6px 12px; 
                                           border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                                Test Single URL
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.style.transition = 'opacity 0.3s';
            message.style.opacity = '0';
            setTimeout(() => message.remove(), 300);
        }, 10000);
    }

    // Reset GSC data
    function resetGSCData() {
        gscDataMap.clear();
        gscDataLoaded = false;
        fetchInProgress = false;
        gscSiteUrl = null;
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

    // Add styles
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
                    
                    setTimeout(() => {
                        tryFetchGSCData();
                    }, 500);
                };
                debugLog('Hooked into createVisualization');
            } else {
                setTimeout(checkAndHook, 100);
            }
        };
        checkAndHook();
    }

    // Hook into tooltips
    function hookIntoTooltips() {
        const checkAndHook = () => {
            if (window.showEnhancedTooltip) {
                const originalShowEnhancedTooltip = window.showEnhancedTooltip;
                window.showEnhancedTooltip = function(event, d) {
                    originalShowEnhancedTooltip.apply(this, arguments);
                    
                    if (gscConnected && gscDataLoaded) {
                        setTimeout(() => {
                            try {
                                const tooltipElement = document.querySelector('.enhanced-tooltip.visible');
                                if (tooltipElement && d && d.data && !tooltipElement.querySelector('.tooltip-gsc-section')) {
                                    const currentHtml = tooltipElement.innerHTML;
                                    const enhancedHtml = enhanceTooltipWithGSC(currentHtml, d.data);
                                    tooltipElement.innerHTML = enhancedHtml;
                                }
                            } catch (error) {
                                console.error('[GSC Integration] Error enhancing tooltip:', error);
                            }
                        }, 50);
                    }
                };
                debugLog('Hooked into tooltip display');
            } else {
                setTimeout(checkAndHook, 100);
            }
        };
        checkAndHook();
    }

    // Enhance tooltip with GSC data
    function enhanceTooltipWithGSC(html, nodeData) {
        if (!gscConnected || !gscDataLoaded || !nodeData || !nodeData.url) {
            return html;
        }
        
        // Try multiple URL formats
        let gscData = gscDataMap.get(nodeData.url);
        
        // If not found, try with the gscSiteUrl prefix
        if (!gscData && gscSiteUrl && nodeData.url.startsWith('/')) {
            const fullUrl = gscSiteUrl.replace(/\/$/, '') + nodeData.url;
            gscData = gscDataMap.get(fullUrl);
        }
        
        if (!gscData) {
            return html;
        }
        
        const gscSection = `
            <div class="tooltip-gsc-section" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                <div style="font-weight: 600; color: #1f4788; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;">
                    <span>🔍</span> Search Performance (30 days)
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div style="background: #f8f9ff; padding: 8px; border-radius: 6px;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #4a90e2;">${gscData.clicks.toLocaleString()}</div>
                        <div style="font-size: 0.8rem; color: #666;">Clicks</div>
                    </div>
                    <div style="background: #f8f9ff; padding: 8px; border-radius: 6px;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #4a90e2;">${gscData.impressions.toLocaleString()}</div>
                        <div style="font-size: 0.8rem; color: #666;">Impressions</div>
                    </div>
                    <div style="background: #f8f9ff; padding: 8px; border-radius: 6px;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #4a90e2;">${(gscData.ctr * 100).toFixed(1)}%</div>
                        <div style="font-size: 0.8rem; color: #666;">CTR</div>
                    </div>
                    <div style="background: #f8f9ff; padding: 8px; border-radius: 6px;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #4a90e2;">${gscData.position.toFixed(1)}</div>
                        <div style="font-size: 0.8rem; color: #666;">Avg Position</div>
                    </div>
                </div>
            </div>
        `;
        
        const lastDivIndex = html.lastIndexOf('</div>');
        if (lastDivIndex > -1) {
            return html.substring(0, lastDivIndex) + gscSection + html.substring(lastDivIndex);
        }
        
        return html + gscSection;
    }

    // Update visible tooltips
    function updateVisibleTooltips() {
        const visibleTooltip = document.querySelector('.enhanced-tooltip.visible');
        if (visibleTooltip) {
            const hoveredNode = d3.select('.node:hover').datum();
            if (hoveredNode && window.showEnhancedTooltip) {
                const event = new MouseEvent('mouseenter');
                window.showEnhancedTooltip(event, hoveredNode);
            }
        }
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
            <div style="font-weight: bold; margin-bottom: 10px;">Loading Search Console Data...</div>
            <div style="color: #666; margin-bottom: 15px;">This may take a moment for large sites</div>
            <div style="background: #f0f0f0; height: 20px; border-radius: 10px; overflow: hidden;">
                <div id="gscLoadingProgress" style="background: #4caf50; height: 100%; width: 0%; transition: width 0.3s;"></div>
            </div>
        `;
        document.body.appendChild(indicator);
    }

    function updateGSCLoadingProgress(percent) {
        const progress = document.getElementById('gscLoadingProgress');
        if (progress) {
            progress.style.width = Math.min(100, percent) + '%';
        }
    }

    function hideGSCLoadingIndicator() {
        const indicator = document.getElementById('gscLoadingIndicator');
        if (indicator) indicator.remove();
    }

    function showGSCSuccessMessage() {
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
                <span style="font-size: 20px;">✓</span>
                <div>
                    <div style="font-weight: bold;">Search Console Connected!</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">
                        Loaded data for ${gscDataMap.size} pages
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.style.transition = 'opacity 0.3s';
            message.style.opacity = '0';
            setTimeout(() => message.remove(), 300);
        }, 3000);
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

})();
