// gsc-integration-module.js - Enhanced Lazy Loading Version

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
        fetchNodeData: fetchNodeGSCData, // New: expose lazy loading function
        events: gscEvents,
        reset: resetGSCData,
        loadVisibleNodes: loadVisibleNodesGSCData, // New: load all visible nodes
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

    // NEW: Initialize lazy loading
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

    // UPDATED: Main fetch function - now just sets up the connection
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
            
            // NEW: Don't fetch all data - just mark as ready
            gscDataLoaded = true;
            fetchInProgress = false;
            hideGSCLoadingIndicator();
            
            showGSCReadyMessage();
            gscEvents.emit('dataReady');
            
            // Optional: Pre-load data for important nodes
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

    // NEW: Lazy loading core function
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

    // NEW: Core function to fetch data for a single node
    async function fetchSingleNodeData(node) {
        try {
            debugLog('Fetching GSC data for:', node.url);
            
            const today = new Date();
            const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
            
            const variations = createUrlVariations(node.url);
            
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
                            position: row.position || 0,
                            url: variation,
                            fetchedAt: Date.now()
                        };
                        
                        // Store data using original URL as key
                        gscDataMap.set(node.url, gscData);
                        
                        debugLog(`Found GSC data for ${node.url} (using ${variation}):`, gscData);
                        
                        // Trigger tooltip update if this node is currently being displayed
                        updateTooltipIfVisible(node);
                        
                        return gscData;
                    }
                } catch (error) {
                    debugLog(`Error trying variation ${variation}:`, error);
                    // Continue to next variation
                }
            }
            
            // No data found - cache this fact to avoid repeated requests
            const noData = { 
                clicks: 0, 
                impressions: 0, 
                ctr: 0, 
                position: 0, 
                noDataFound: true, 
                fetchedAt: Date.now() 
            };
            gscDataMap.set(node.url, noData);
            debugLog(`No GSC data found for ${node.url}`);
            
            // Update tooltip if visible
            updateTooltipIfVisible(node);
            
            return noData;
            
        } catch (error) {
            console.error('Error fetching GSC data for node:', node.url, error);
            return null;
        }
    }

    // NEW: Batch loading for hover queue
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
        
        // Process in smaller batches to avoid overwhelming API
        const batchSize = 2;
        for (let i = 0; i < nodes.length; i += batchSize) {
            const batch = nodes.slice(i, i + batchSize);
            const promises = batch.map(node => fetchNodeGSCData(node));
            await Promise.all(promises);
            
            // Small delay between batches
            if (i + batchSize < nodes.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    // NEW: Preload important nodes
    async function preloadImportantNodes() {
        const importantNodes = getImportantNodes();
        debugLog(`Preloading GSC data for ${importantNodes.length} important nodes`);
        
        // Load in small batches to avoid overwhelming the API
        const batchSize = 3;
        for (let i = 0; i < importantNodes.length; i += batchSize) {
            const batch = importantNodes.slice(i, i + batchSize);
            const promises = batch.map(node => fetchNodeGSCData(node));
            await Promise.all(promises);
            
            // Small delay between batches
            if (i + batchSize < importantNodes.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        debugLog('Preloading complete');
    }

    function getImportantNodes() {
        const important = [];
        
        function traverse(node, depth = 0) {
            if (node.url && depth <= 2) { // Root and top 2 levels only
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

    // NEW: Load GSC data for all visible nodes
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
        
        // Get all currently expanded/visible nodes from the tree
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
        // Check if node is currently visible in the tree visualization
        let current = d;
        while (current.parent) {
            if (current.parent._children) {
                return false; // Parent is collapsed
            }
            current = current.parent;
        }
        return true;
    }

    // NEW: Update tooltip if currently visible
    function updateTooltipIfVisible(node) {
        const visibleTooltip = document.querySelector('.enhanced-tooltip.visible');
        if (visibleTooltip) {
            // Check if the tooltip is showing this node's data
            const tooltipContent = visibleTooltip.innerHTML;
            if (tooltipContent.includes(node.name) || (node.url && tooltipContent.includes(node.url))) {
                // Refresh the tooltip content
                const nodeData = findNodeByUrl(node.url);
                if (nodeData && window.showEnhancedTooltip) {
                    // Get the last mouse position (approximate)
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
        // Trigger an update of any visible tooltips
        gscEvents.emit('dataUpdated');
    }

    // UPDATED: URL variations function (more efficient)
    function createUrlVariations(originalUrl) {
        const variations = new Set();
        
        // Add original URL
        variations.add(originalUrl);
        
        // Handle relative URLs
        if (originalUrl.startsWith('/') && gscSiteUrl) {
            const baseUrl = gscSiteUrl.replace(/\/$/, '');
            variations.add(baseUrl + originalUrl);
        }
        
        // Common transformations for MABS.ie structure
        if (originalUrl.includes('/en/') || originalUrl.includes('/ga/')) {
            // Remove language prefix
            const withoutLangPrefix = originalUrl
                .replace('/en/', '/')
                .replace('/ga/', '/');
            variations.add(withoutLangPrefix);
            
            // HTTPS version without language prefix
            variations.add(withoutLangPrefix.replace('http://', 'https://'));
        }
        
        // HTTPS transformation
        if (originalUrl.includes('http://')) {
            variations.add(originalUrl.replace('http://', 'https://'));
        }
        
        // Limit to max 4 variations to keep requests manageable
        return Array.from(variations).slice(0, 4);
    }

    // NEW: Cache cleanup
    function setupCacheCleanup() {
        // Clean up old cache entries every 10 minutes
        cacheCleanupInterval = setInterval(cleanupGSCCache, 10 * 60 * 1000);
    }

    function cleanupGSCCache() {
        const maxAge = 30 * 60 * 1000; // 30 minutes
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
                    
                    // Initialize lazy loading if connected
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
                    
                    // Initialize lazy loading if connected
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

    // Hook into tooltips
    function hookIntoTooltips() {
        const checkAndHook = () => {
            if (window.showEnhancedTooltip) {
                const originalShowEnhancedTooltip = window.showEnhancedTooltip;
                window.showEnhancedTooltip = function(event, d, isLoadingGSC = false) {
                    // Call the enhanced version with GSC integration
                    showEnhancedTooltipWithGSC(event, d, isLoadingGSC);
                };
                debugLog('Hooked into tooltip display');
            } else {
                setTimeout(checkAndHook, 100);
            }
        };
        checkAndHook();
    }

    // UPDATED: Enhanced tooltip with GSC lazy loading
    function showEnhancedTooltipWithGSC(event, d, isLoadingGSC = false) {
        if (!window.enhancedTooltip || !d.data) return;
        
        const data = d.data;
        const now = new Date();
        
        // Trigger lazy loading if needed
        if (gscConnected && gscDataLoaded && data.url && !gscDataMap.has(data.url) && !isLoadingGSC) {
            isLoadingGSC = true;
            fetchNodeGSCData(data).then(() => {
                // Refresh tooltip with new data
                const currentTooltip = document.querySelector('.enhanced-tooltip.visible');
                if (currentTooltip) {
                    showEnhancedTooltipWithGSC(event, d, false);
                }
            });
        }
        
        // Calculate freshness
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
        
        // Calculate descendant count and sibling count
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
        
        // Build popup content
        const isLeaf = !d.children && !d._children;
        const nodeType = d.depth === 0 ? 'Root' : 
                        d.depth === 1 ? 'Language/Category' :
                        isLeaf ? 'Page' : 'Section';
        
        let html = `
            <div class="tooltip-header">
                <span>${data.name}</span>
                <span class="tooltip-freshness ${freshnessClass}">${freshnessLabel}</span>
            </div>
            <div class="tooltip-content">
                <div class="tooltip-stats">
                    <div class="tooltip-stat">
                        <div class="tooltip-stat-value">${d.depth}</div>
                        <div class="tooltip-stat-label">Depth Level</div>
                    </div>
                    <div class="tooltip-stat">
                        <div class="tooltip-stat-value">${isLeaf ? siblingCount : descendantCount}</div>
                        <div class="tooltip-stat-label">${isLeaf ? 'Sibling Pages' : 'Child Pages'}</div>
                    </div>
                    ${data.pageCount ? `
                    <div class="tooltip-stat">
                        <div class="tooltip-stat-value">${data.pageCount}</div>
                        <div class="tooltip-stat-label">Total Pages</div>
                    </div>
                    ` : ''}
                    <div class="tooltip-stat">
                        <div class="tooltip-stat-value">${nodeType}</div>
                        <div class="tooltip-stat-label">Type</div>
                    </div>
                </div>
                
                <div class="tooltip-meta">
                    ${data.url ? `
                    <div class="tooltip-meta-item">
                        <span class="tooltip-meta-icon">🔗</span>
                        <span style="word-break: break-all; color: #1f4788;">${data.url}</span>
                    </div>
                    ` : ''}
                    
                    ${data.lastModified ? `
                    <div class="tooltip-meta-item">
                        <span class="tooltip-meta-icon">📅</span>
                        <span>Last updated: ${formatDate(new Date(data.lastModified))}</span>
                    </div>
                    ` : ''}
                    
                    ${data.fullPath ? `
                    <div class="tooltip-meta-item">
                        <span class="tooltip-meta-icon">📍</span>
                        <span>Path: /${data.fullPath}</span>
                    </div>
                    ` : ''}
                </div>`;
        
        // Add GSC section with loading/data states
        if (gscConnected && data.url) {
            const gscData = gscDataMap.get(data.url);
            
            if (isLoadingGSC || (!gscData && !gscDataMap.has(data.url))) {
                // Loading state
                html += `
                    <div class="tooltip-gsc-section" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                        <div style="font-weight: 600; color: #1f4788; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;">
                            <span>🔍</span> Search Performance
                            <div class="gsc-loading-spinner" style="margin-left: auto; width: 16px; height: 16px; border: 2px solid #e0e0e0; border-top: 2px solid #1f4788; border-radius: 50%;"></div>
                        </div>
                        <div style="color: #666; font-style: italic; font-size: 0.9rem;">Loading data...</div>
                    </div>
                `;
            } else if (gscData && !gscData.noDataFound) {
                // Data available
                html += `
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
            } else if (gscData && gscData.noDataFound) {
                // No data found
                html += `
                    <div class="tooltip-gsc-section" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                        <div style="font-weight: 600; color: #1f4788; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;">
                            <span>🔍</span> Search Performance
                        </div>
                        <div style="color: #666; font-style: italic; font-size: 0.9rem;">No search data available</div>
                    </div>
                `;
            }
        }
        
        // Actions
        html += `
                ${data.url ? `
                <div class="tooltip-actions">
                    <a href="${data.url}" target="_blank" class="tooltip-action-btn">
                        <span>🔗</span>
                        <span>Visit Page</span>
                    </a>
                    <button class="tooltip-action-btn" onclick="window.focusOnNode('${d.id || data.name}')">
                        <span>🎯</span>
                        <span>Focus</span>
                    </button>
                    <button class="tooltip-action-btn" onclick="window.expandBranch('${d.id || data.name}')">
                        <span>🌳</span>
                        <span>Expand</span>
                    </button>
                </div>
                ` : `
                <div class="tooltip-actions">
                    <button class="tooltip-action-btn" onclick="window.focusOnNode('${d.id || data.name}')">
                        <span>🎯</span>
                        <span>Focus View</span>
                    </button>
                    ${!isLeaf ? `
                    <button class="tooltip-action-btn" onclick="window.toggleNode('${d.id || data.name}')">
                        <span>${d.children ? '➖' : '➕'}</span>
                        <span>${d.children ? 'Collapse' : 'Expand'}</span>
                    </button>
                    ` : ''}
                </div>
                `}
            </div>
        `;
        
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
            <div style="color: #666; margin-bottom: 15px;">Setting up lazy loading for performance data</div>
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
                <span style="font-size: 20px;">⚡</span>
                <div>
                    <div style="font-weight: bold;">Search Console Ready!</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">
                        Performance data loads on hover • <span style="font-weight: 600;">Ctrl+L</span> to load all visible
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.style.transition = 'opacity 0.3s';
            message.style.opacity = '0';
            setTimeout(() => message.remove(), 300);
        }, 5000);
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
            
            // Show feedback
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
            feedback.textContent = 'Loading GSC data for visible nodes...';
            document.body.appendChild(feedback);
            
            setTimeout(() => {
                feedback.style.opacity = '0';
                setTimeout(() => feedback.remove(), 300);
            }, 2000);
        }
    });

    // Utility function to format dates
    function formatDate(date) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

})();
