// gsc-integration.js - Google Search Console Integration Module

(function() {
    // Configuration
    const GSC_CONFIG = {
        CLIENT_ID: '550630256834-9quh64fnqhfse6s488c8gutstuqcch04.apps.googleusercontent.com',
        API_KEY: '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',
        DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/searchconsole/v1/rest'],
        SCOPES: 'https://www.googleapis.com/auth/webmasters.readonly'
    };

    // GSC data storage
    let gscDataMap = new Map();
    let gscConnected = false;
    let gscSiteUrl = null;
    let gscDataLoaded = false;

    // Export to global scope for access from main app
    window.GSCIntegration = {
        init: initGSCIntegration,
        isConnected: () => gscConnected,
        hasData: () => gscDataLoaded,
        getData: (url) => gscDataMap.get(url),
        toggleConnection: toggleGSCConnection
    };

    // Initialize the integration
    function initGSCIntegration() {
        // Add GSC button to nav
        addGSCButton();
        
        // Add styles
        addGSCStyles();
        
        // Initialize Google API when ready
        if (window.gapi) {
            initGoogleClient();
        } else {
            // Wait for gapi to load
            window.handleGoogleAPILoad = function() {
                gapi.load('client:auth2', initGoogleClient);
            };
        }
        
        // Hook into sitemap loading
        hookIntoSitemapLoader();
        
        // Hook into tooltip display
        hookIntoTooltips();
    }

    // Add GSC button to navigation
    function addGSCButton() {
        const navBar = document.querySelector('.nav-group') || document.querySelector('.nav-bar');
        if (!navBar) return;
        
        const gscButton = document.createElement('button');
        gscButton.className = 'nav-btn nav-gsc-btn';
        gscButton.id = 'gscConnectBtn';
        gscButton.style.display = 'none';
        gscButton.onclick = toggleGSCConnection;
        gscButton.innerHTML = `
            <span id="gscIcon">🔍</span>
            <span id="gscText">Connect GSC</span>
        `;
        
        // Insert before theme button or at the end
        const themeBtn = navBar.querySelector('.nav-theme-btn');
        if (themeBtn) {
            navBar.insertBefore(gscButton, themeBtn);
        } else {
            navBar.appendChild(gscButton);
        }
    }

    // Add required styles
    function addGSCStyles() {
        const style = document.createElement('style');
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

    // Initialize Google Client
    function initGoogleClient() {
        gapi.client.init({
            apiKey: GSC_CONFIG.API_KEY,
            clientId: GSC_CONFIG.CLIENT_ID,
            discoveryDocs: GSC_CONFIG.DISCOVERY_DOCS,
            scope: GSC_CONFIG.SCOPES
        }).then(function () {
            gapi.auth2.getAuthInstance().isSignedIn.listen(updateGSCSigninStatus);
            updateGSCSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
            
            const gscBtn = document.getElementById('gscConnectBtn');
            if (gscBtn) gscBtn.style.display = 'flex';
        }).catch(function(error) {
            console.error('Error initializing Google API:', error);
        });
    }

    function updateGSCSigninStatus(isSignedIn) {
        gscConnected = isSignedIn;
        const gscBtn = document.getElementById('gscConnectBtn');
        const gscIcon = document.getElementById('gscIcon');
        const gscText = document.getElementById('gscText');
        
        if (gscBtn) {
            if (isSignedIn) {
                gscBtn.classList.add('connected');
                gscBtn.style.background = '#4caf50';
                gscBtn.style.color = 'white';
                gscIcon.textContent = '✓';
                gscText.textContent = 'GSC Connected';
                
                if (window.treeData && !gscDataLoaded) {
                    fetchGSCDataForSitemap();
                }
            } else {
                gscBtn.classList.remove('connected');
                gscBtn.style.background = '';
                gscBtn.style.color = '';
                gscIcon.textContent = '🔍';
                gscText.textContent = 'Connect GSC';
                gscDataMap.clear();
                gscDataLoaded = false;
            }
        }
    }

    function toggleGSCConnection() {
        if (gscConnected) {
            if (confirm('Disconnect from Google Search Console?')) {
                gapi.auth2.getAuthInstance().signOut();
            }
        } else {
            gapi.auth2.getAuthInstance().signIn();
        }
    }

    async function fetchGSCDataForSitemap() {
        if (!window.treeData) return;
        
        showGSCLoadingIndicator();
        
        try {
            const sitesResponse = await gapi.client.webmasters.sites.list({});
            const sites = sitesResponse.result.siteEntry || [];
            
            if (sites.length === 0) {
                hideGSCLoadingIndicator();
                alert('No Search Console properties found for your account.');
                return;
            }
            
            const currentDomain = window.treeData.name;
            let matchedSite = sites.find(site => 
                site.siteUrl.includes(currentDomain) || 
                currentDomain.includes(new URL(site.siteUrl).hostname)
            );
            
            if (!matchedSite) {
                matchedSite = await showSiteSelector(sites);
                if (!matchedSite) {
                    hideGSCLoadingIndicator();
                    return;
                }
            }
            
            gscSiteUrl = matchedSite.siteUrl;
            
            const allUrls = [];
            function collectUrls(node) {
                if (node.url) allUrls.push(node.url);
                if (node.children) {
                    node.children.forEach(child => collectUrls(child));
                }
            }
            collectUrls(window.treeData);
            
            await fetchGSCDataInBatches(allUrls);
            
            gscDataLoaded = true;
            hideGSCLoadingIndicator();
            showGSCSuccessMessage();
            updateVisibleTooltips();
            
        } catch (error) {
            console.error('Error fetching GSC data:', error);
            hideGSCLoadingIndicator();
            alert('Error loading Search Console data. Please try again.');
        }
    }

    async function fetchGSCDataInBatches(urls, batchSize = 100) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        for (let i = 0; i < urls.length; i += batchSize) {
            const batchUrls = urls.slice(i, i + batchSize);
            
            try {
                const response = await gapi.client.webmasters.searchanalytics.query({
                    'siteUrl': gscSiteUrl,
                    'resource': {
                        'startDate': thirtyDaysAgo.toISOString().split('T')[0],
                        'endDate': today.toISOString().split('T')[0],
                        'dimensions': ['page'],
                        'dimensionFilterGroups': [{
                            'filters': batchUrls.map(url => ({
                                'dimension': 'page',
                                'operator': 'equals',
                                'expression': url
                            }))
                        }],
                        'rowLimit': batchSize
                    }
                });
                
                const rows = response.result.rows || [];
                rows.forEach(row => {
                    const url = row.keys[0];
                    gscDataMap.set(url, {
                        clicks: row.clicks || 0,
                        impressions: row.impressions || 0,
                        ctr: row.ctr || 0,
                        position: row.position || 0
                    });
                });
                
                updateGSCLoadingProgress((i + batchSize) / urls.length * 100);
                
            } catch (error) {
                console.error('Error fetching batch:', error);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
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

    // Hook into sitemap loading
    function hookIntoSitemapLoader() {
        // Wait for parseSitemap to be defined
        const checkAndHook = () => {
            if (window.parseSitemap) {
                const originalParseSitemap = window.parseSitemap;
                window.parseSitemap = function(xmlString, source) {
                    originalParseSitemap(xmlString, source);
                    
                    if (gscConnected && !gscDataLoaded) {
                        setTimeout(() => {
                            fetchGSCDataForSitemap();
                        }, 1000);
                    }
                };
            } else {
                setTimeout(checkAndHook, 100);
            }
        };
        checkAndHook();
    }

    // Hook into tooltip display
    function hookIntoTooltips() {
        // Wait for showEnhancedTooltip to be defined
        const checkAndHook = () => {
            if (window.showEnhancedTooltip) {
                const originalShowEnhancedTooltip = window.showEnhancedTooltip;
                window.showEnhancedTooltip = function(event, d) {
                    originalShowEnhancedTooltip(event, d);
                    
                    if (gscConnected && gscDataLoaded && window.enhancedTooltip) {
                        const currentHtml = window.enhancedTooltip.html();
                        const enhancedHtml = enhanceTooltipWithGSC(currentHtml, d.data);
                        window.enhancedTooltip.html(enhancedHtml);
                    }
                };
            } else {
                setTimeout(checkAndHook, 100);
            }
        };
        checkAndHook();
    }

    function enhanceTooltipWithGSC(html, nodeData) {
        if (!gscConnected || !gscDataLoaded || !nodeData.url) {
            return html;
        }
        
        const gscData = gscDataMap.get(nodeData.url);
        
        if (!gscData) {
            return html.replace('</div>', `
                <div class="tooltip-gsc-section" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                    <div style="font-size: 0.9rem; color: #666; text-align: center;">
                        No Search Console data available for this page
                    </div>
                </div>
            </div>`);
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
        
        return html.replace('</div>', gscSection + '</div>');
    }

    function updateVisibleTooltips() {
        const visibleTooltip = document.querySelector('.enhanced-tooltip.visible');
        if (visibleTooltip && window.selectedNode3D) {
            window.showEnhancedTooltip(null, window.selectedNode3D);
        }
    }

})();