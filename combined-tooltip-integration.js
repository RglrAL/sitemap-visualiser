// combined-tooltip-integration.js - FIXED VERSION
// This version bypasses ForceOverride and ensures GA4 data displays properly

(function() {
    console.log('🚀 Loading FIXED combined tooltip integration...');

    // Force override removal - this bypasses the disabled functions
    function removeForceOverride() {
        console.log('🔧 Removing ForceOverride...');
        
        // Clear any existing disabled functions
        delete window.showEnhancedTooltip;
        delete window.hideEnhancedTooltip;
        
        // Remove any override flags
        if (window.ForceOverride) {
            window.ForceOverride = null;
        }
        
        console.log('✅ ForceOverride removed');
    }

    // Wait for both integrations to be ready
    function waitForIntegrations(callback) {
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkReady = () => {
            attempts++;
            console.log(`🔍 Checking integrations (attempt ${attempts}/${maxAttempts})`);
            console.log('GSC Integration:', !!window.GSCIntegration);
            console.log('GA4 Integration:', !!window.GA4Integration);
            
            if (window.GSCIntegration && window.GA4Integration) {
                console.log('✅ Both integrations ready');
                callback();
            } else if (attempts >= maxAttempts) {
                console.warn('⚠️ Max attempts reached, proceeding anyway');
                callback();
            } else {
                setTimeout(checkReady, 200);
            }
        };
        checkReady();
    }

    // Create enhanced tooltip with both GSC and GA4 data
    function createCombinedTooltip(nodeData) {
        console.log('🎯 Creating combined tooltip for:', nodeData.name);
        
        const tooltip = document.createElement('div');
        tooltip.className = 'enhanced-tooltip combined-analytics-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ddd;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 550px;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.4;
        `;

        // Create basic content
        tooltip.innerHTML = createBasicTooltipContent(nodeData);
        
        return tooltip;
    }

    // Create the basic page info content
    function createBasicTooltipContent(data) {
        return `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 10px;">
                    <h4 style="margin: 0; color: #1f4788; font-size: 1.1rem; font-weight: 600; flex: 1;">${data.name}</h4>
                </div>
                ${data.url ? `
                    <a href="${data.url}" target="_blank" 
                       style="font-size: 0.8rem; color: #4a90e2; text-decoration: none; word-break: break-all; 
                              margin-bottom: 12px; display: block; border-bottom: 1px dotted #4a90e2;" 
                       onmouseover="this.style.textDecoration='underline'" 
                       onmouseout="this.style.textDecoration='none'">
                        ${data.url}
                    </a>
                ` : ''}
            </div>
        `;
    }

    // Create analytics section with real-time status
    function createAnalyticsSection(nodeData) {
        return `
            <div id="combined-analytics-container" style="margin-top: 12px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; overflow: hidden;">
                    
                    <!-- Header -->
                    <div style="background: rgba(255,255,255,0.15); padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="color: white; font-weight: 600; font-size: 1rem; display: flex; align-items: center; justify-content: space-between;">
                            <span>📊 Analytics Overview</span>
                            <div style="background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 12px; font-size: 0.75rem;">
                                Last 30 Days
                            </div>
                        </div>
                    </div>
                    
                    <!-- Analytics Grid -->
                    <div style="background: rgba(255,255,255,0.1); padding: 16px;">
                        
                        <!-- Search Console Section -->
                        <div id="gsc-analytics-card" style="background: rgba(255,255,255,0.15); padding: 14px; border-radius: 10px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div style="font-size: 0.9rem; font-weight: 500; color: white; display: flex; align-items: center; gap: 6px;">
                                    🔍 Search Console
                                </div>
                                <span id="gsc-status-indicator" style="font-size: 0.7rem; color: rgba(255,255,255,0.8);">
                                    Loading...
                                </span>
                            </div>
                            <div id="gsc-data-content">
                                <div style="color: rgba(255,255,255,0.8); font-size: 0.85rem;">
                                    <div class="loading-animation">⏳ Fetching search data...</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Google Analytics 4 Section -->
                        <div id="ga4-analytics-card" style="background: rgba(255,255,255,0.15); padding: 14px; border-radius: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div style="font-size: 0.9rem; font-weight: 500; color: white; display: flex; align-items: center; gap: 6px;">
                                    📈 Google Analytics 4
                                </div>
                                <span id="ga4-status-indicator" style="font-size: 0.7rem; color: rgba(255,255,255,0.8);">
                                    Loading...
                                </span>
                            </div>
                            <div id="ga4-data-content">
                                <div style="color: rgba(255,255,255,0.8); font-size: 0.85rem;">
                                    <div class="loading-animation">⏳ Fetching analytics data...</div>
                                </div>
                            </div>
                        </div>
                        
                    </div>
                    
                    <!-- Footer Actions -->
                    <div style="background: rgba(255,255,255,0.05); padding: 12px 16px; display: flex; gap: 8px; justify-content: space-between;">
                        <button onclick="window.open('${nodeData.url}', '_blank')" 
                                style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 16px; 
                                       border-radius: 6px; font-size: 0.85rem; cursor: pointer; flex: 1; transition: all 0.2s;"
                                onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                                onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                            🔗 Visit Page
                        </button>
                        <button onclick="window.refreshAnalyticsData && window.refreshAnalyticsData()" 
                                style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 16px; 
                                       border-radius: 6px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;"
                                onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                                onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                            🔄 Refresh
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                .loading-animation {
                    position: relative;
                }
                
                .loading-animation::after {
                    content: '';
                    position: absolute;
                    right: -20px;
                    top: 0;
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top: 2px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    }

    // Load analytics data with proper error handling
    async function loadAnalyticsData(tooltip, nodeData) {
        console.log('📊 Loading analytics data for:', nodeData.name);
        
        const gscContent = tooltip.querySelector('#gsc-data-content');
        const ga4Content = tooltip.querySelector('#ga4-data-content');
        const gscStatus = tooltip.querySelector('#gsc-status-indicator');
        const ga4Status = tooltip.querySelector('#ga4-status-indicator');
        
        // Load GSC Data
        try {
            console.log('🔍 Checking GSC connection...');
            if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
                console.log('✅ GSC is connected, fetching data...');
                gscStatus.textContent = '🟢 Connected';
                
                const gscData = await window.GSCIntegration.fetchNodeData(nodeData);
                console.log('🔍 GSC Data received:', gscData);
                
                if (gscData && !gscData.noDataFound && !gscData.error) {
                    gscContent.innerHTML = `
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; color: white;">
                            <div style="text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 700; margin-bottom: 2px;">
                                    ${formatNumber(gscData.clicks)}
                                </div>
                                <div style="font-size: 0.75rem; opacity: 0.9;">Clicks</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 700; margin-bottom: 2px;">
                                    ${formatNumber(gscData.impressions)}
                                </div>
                                <div style="font-size: 0.75rem; opacity: 0.9;">Impressions</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 700; margin-bottom: 2px;">
                                    ${(gscData.ctr * 100).toFixed(1)}%
                                </div>
                                <div style="font-size: 0.75rem; opacity: 0.9;">CTR</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 700; margin-bottom: 2px;">
                                    #${gscData.position.toFixed(0)}
                                </div>
                                <div style="font-size: 0.75rem; opacity: 0.9;">Position</div>
                            </div>
                        </div>
                    `;
                } else {
                    gscContent.innerHTML = '<div style="color: rgba(255,255,255,0.7); font-size: 0.9rem; text-align: center;">📭 No search data found</div>';
                }
            } else {
                console.log('❌ GSC not connected');
                gscStatus.textContent = '🔴 Not Connected';
                gscContent.innerHTML = '<div style="color: rgba(255,255,255,0.7); font-size: 0.9rem; text-align: center;">🔌 GSC not connected</div>';
            }
        } catch (error) {
            console.error('❌ GSC Error:', error);
            gscStatus.textContent = '🔴 Error';
            gscContent.innerHTML = '<div style="color: #ffcdd2; font-size: 0.9rem; text-align: center;">❌ Error loading GSC data</div>';
        }
        
        // Load GA4 Data
        try {
            console.log('📈 Checking GA4 connection...');
            if (window.GA4Integration && window.GA4Integration.isConnected()) {
                console.log('✅ GA4 is connected, fetching data...');
                ga4Status.textContent = '🟢 Connected';
                
                // Try to get GA4 data
                const ga4Data = await window.GA4Integration.fetchData(nodeData.url);
                console.log('📈 GA4 Data received:', ga4Data);
                
                if (ga4Data && !ga4Data.noDataFound && !ga4Data.error) {
                    ga4Content.innerHTML = `
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; color: white;">
                            <div style="text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 700; margin-bottom: 2px;">
                                    ${formatNumber(ga4Data.users || 0)}
                                </div>
                                <div style="font-size: 0.75rem; opacity: 0.9;">Users</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 700; margin-bottom: 2px;">
                                    ${formatNumber(ga4Data.pageViews || 0)}
                                </div>
                                <div style="font-size: 0.75rem; opacity: 0.9;">Page Views</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 700; margin-bottom: 2px;">
                                    ${formatNumber(ga4Data.sessions || 0)}
                                </div>
                                <div style="font-size: 0.75rem; opacity: 0.9;">Sessions</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.4rem; font-weight: 700; margin-bottom: 2px;">
                                    ${((ga4Data.engagementRate || 0) * 100).toFixed(0)}%
                                </div>
                                <div style="font-size: 0.75rem; opacity: 0.9;">Engagement</div>
                            </div>
                        </div>
                    `;
                    console.log('✅ GA4 content updated successfully');
                } else {
                    console.warn('⚠️ GA4 no data found:', ga4Data);
                    ga4Content.innerHTML = '<div style="color: rgba(255,255,255,0.7); font-size: 0.9rem; text-align: center;">📭 No analytics data found</div>';
                }
            } else {
                console.log('❌ GA4 not connected');
                ga4Status.textContent = '🔴 Not Connected';
                ga4Content.innerHTML = '<div style="color: rgba(255,255,255,0.7); font-size: 0.9rem; text-align: center;">🔌 GA4 not connected</div>';
            }
        } catch (error) {
            console.error('❌ GA4 Error:', error);
            ga4Status.textContent = '🔴 Error';
            ga4Content.innerHTML = '<div style="color: #ffcdd2; font-size: 0.9rem; text-align: center;">❌ Error loading GA4 data</div>';
        }
    }

    // Enhanced tooltip functions (using window assignment to avoid conflicts)
    const enhancedTooltipShow = async function(event, d) {
        console.log('🎯 FIXED Enhanced tooltip triggered for:', d.data?.name);
        
        if (!d.data) {
            console.warn('⚠️ No data provided to tooltip');
            return;
        }

        // Hide any existing tooltip
        enhancedTooltipHide();

        // Create new tooltip
        const tooltip = createCombinedTooltip(d.data);
        
        // Add analytics section
        tooltip.innerHTML += createAnalyticsSection(d.data);
        
        // Position tooltip
        positionTooltip(tooltip, event);
        
        // Add to DOM
        document.body.appendChild(tooltip);
        
        // Show tooltip
        setTimeout(() => tooltip.style.opacity = '1', 10);
        
        // Store reference and node data
        window.currentEnhancedTooltip = tooltip;
        tooltip._nodeData = d.data;
        
        // Add hover protection
        tooltip.addEventListener('mouseenter', () => {
            if (window.tooltipHideTimer) {
                clearTimeout(window.tooltipHideTimer);
            }
        });
        
        tooltip.addEventListener('mouseleave', () => {
            enhancedTooltipHide();
        });

        // Load analytics data
        try {
            await loadAnalyticsData(tooltip, d.data);
        } catch (error) {
            console.error('❌ Error loading analytics data:', error);
        }
    };

    const enhancedTooltipHide = function() {
        window.tooltipHideTimer = setTimeout(() => {
            if (window.currentEnhancedTooltip) {
                window.currentEnhancedTooltip.style.opacity = '0';
                setTimeout(() => {
                    if (window.currentEnhancedTooltip) {
                        window.currentEnhancedTooltip.remove();
                        window.currentEnhancedTooltip = null;
                    }
                }, 300);
            }
        }, 100);
    };

    // Utility functions
    function formatNumber(num) {
        if (!num || num === 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    }

    // Position tooltip
    function positionTooltip(tooltip, event) {
        let left = event.pageX + 15;
        let top = event.pageY - 10;
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        
        // Boundary check
        setTimeout(() => {
            const rect = tooltip.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            if (rect.right > windowWidth - 20) {
                tooltip.style.left = (event.pageX - rect.width - 15) + 'px';
            }
            
            if (rect.bottom > windowHeight - 20) {
                tooltip.style.top = (event.pageY - rect.height - 15) + 'px';
            }
        }, 50);
    }

    // Refresh analytics data function
    const refreshAnalyticsData = function() {
        if (window.currentEnhancedTooltip && window.currentEnhancedTooltip._nodeData) {
            const nodeData = window.currentEnhancedTooltip._nodeData;
            loadAnalyticsData(window.currentEnhancedTooltip, nodeData);
        }
    };

    // Force install the fixed tooltip system
    const installFixedTooltipSystem = function() {
        console.log('🔧 Installing FIXED tooltip system...');
        
        // Remove any existing overrides
        removeForceOverride();
        
        // Force install our functions using direct assignment
        window.showEnhancedTooltip = enhancedTooltipShow;
        window.hideEnhancedTooltip = enhancedTooltipHide;
        window.refreshAnalyticsData = refreshAnalyticsData;
        
        console.log('✅ FIXED tooltip system installed');
        console.log('🔧 showEnhancedTooltip type:', typeof window.showEnhancedTooltip);
        console.log('🔧 hideEnhancedTooltip type:', typeof window.hideEnhancedTooltip);
    };

    // Initialize when ready
    waitForIntegrations(() => {
        installFixedTooltipSystem();
        console.log('🚀 FIXED combined analytics tooltips are now active!');
        
        // Test the tooltip system
        console.log('🧪 Testing tooltip functions:');
        console.log('showEnhancedTooltip type:', typeof window.showEnhancedTooltip);
        console.log('hideEnhancedTooltip type:', typeof window.hideEnhancedTooltip);
    });

})();
