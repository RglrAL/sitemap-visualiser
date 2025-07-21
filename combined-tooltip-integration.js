// combined-tooltip-integration.js - PERMANENT VERSION
// Replace your entire combined-tooltip-integration (1).js file with this

(function() {
    console.log('🚀 Loading permanent combined tooltip integration...');

    // Wait for both integrations to be ready
    function waitForIntegrations(callback) {
        const checkReady = () => {
            if (window.GSCIntegration && window.GA4Integration) {
                console.log('✅ Both integrations ready');
                callback();
            } else {
                setTimeout(checkReady, 100);
            }
        };
        checkReady();
    }

    // Clear existing tooltips
    function clearExistingTooltips() {
        document.querySelectorAll('.enhanced-tooltip, .combined-analytics-tooltip, [class*="tooltip"]').forEach(el => el.remove());
    }

    // Enhanced tooltip with both GSC and GA4 data + connection status
    function createCombinedTooltip(nodeData) {
        const tooltip = document.createElement('div');
        tooltip.className = 'enhanced-tooltip combined-analytics-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ddd;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 500px;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.4;
        `;

        // Create basic content with your original styling
        tooltip.innerHTML = createBasicTooltipContent(nodeData);
        
        return tooltip;
    }

    // Create the basic page info content (enhanced with your original features)
    function createBasicTooltipContent(data) {
        // Get freshness info (using your original function if available)
        let freshnessInfo = '';
        let lastModifiedDisplay = '';
        
        if (typeof getFreshnessInfo === 'function' && data.lastModified) {
            const freshnessData = getFreshnessInfo(data.lastModified);
            if (freshnessData) {
                freshnessInfo = `<span style="background: ${freshnessData.freshnessColor}20; color: ${freshnessData.freshnessColor}; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 500;">${freshnessData.freshnessLabel}</span>`;
                lastModifiedDisplay = `
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 6px 0; border-top: 1px solid #f0f0f0;">
                        <span style="font-size: 0.7rem; color: #666;">📅 Updated:</span>
                        <span style="font-size: 0.75rem; color: #333; font-weight: 500;">${freshnessData.formattedDate}</span>
                        <span style="font-size: 0.7rem; color: #999;">(${freshnessData.relativeTime})</span>
                    </div>
                `;
            }
        }

        // Get page info (using your original function if available)
        let pageInfoDisplay = '';
        if (typeof getPageInfo === 'function') {
            const treeContext = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
            const pageInfo = getPageInfo(data, treeContext);
            
            pageInfoDisplay = `
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
        }

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

    // Create analytics loading section with connection status
    function createAnalyticsLoadingSection() {
        return `
            <div id="combined-analytics-loading" style="margin-top: 16px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; overflow: hidden;">
                    
                    <!-- Header -->
                    <div style="background: rgba(255,255,255,0.15); padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="color: white; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; justify-content: space-between;">
                            <span>📊 Analytics Data (30 days)</span>
                            <div style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">
                                Live Data
                            </div>
                        </div>
                    </div>
                    
                    <!-- Analytics Sections -->
                    <div style="background: rgba(255,255,255,0.1); padding: 16px;">
                        
                        <!-- GSC Section -->
                        <div id="gsc-section" style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                            <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 6px; font-weight: 500; display: flex; justify-content: space-between; align-items: center;">
                                <span>🔍 Search Console</span>
                                <span id="gsc-connection-status" style="font-size: 0.7rem; opacity: 0.8;">Checking...</span>
                            </div>
                            <div id="gsc-content" style="font-size: 0.9rem;">
                                <div class="loading-dots">Loading data...</div>
                            </div>
                        </div>
                        
                        <!-- GA4 Section -->
                        <div id="ga4-section" style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px;">
                            <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 6px; font-weight: 500; display: flex; justify-content: space-between; align-items: center;">
                                <span>📊 Google Analytics 4</span>
                                <span id="ga4-connection-status" style="font-size: 0.7rem; opacity: 0.8;">Checking...</span>
                            </div>
                            <div id="ga4-content" style="font-size: 0.9rem;">
                                <div class="loading-dots">Loading data...</div>
                            </div>
                        </div>
                        
                        <!-- Reconnect Section (hidden by default) -->
                        <div id="reconnect-section" style="margin-top: 10px; text-align: center; display: none;">
                            <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
                                <div style="font-size: 0.8rem; opacity: 0.9; margin-bottom: 4px;">⚠️ Connection Issues Detected</div>
                            </div>
                            <button onclick="window.reconnectAnalytics && window.reconnectAnalytics()" 
                                    style="background: rgba(255,255,255,0.3); color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
                                🔄 Reconnect Analytics
                            </button>
                        </div>
                        
                    </div>
                    
                    <!-- Action Buttons -->
                    <div style="background: rgba(255,255,255,0.05); padding: 12px 16px; display: flex; gap: 8px;">
                        <button onclick="window.open('${nodeData.url}', '_blank')" 
                                style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; flex: 1;">
                            🔗 Visit Page
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                .loading-dots {
                    opacity: 0.8;
                }
                
                .loading-dots::after {
                    content: '...';
                    animation: loading-dots 1.5s infinite;
                }
                
                @keyframes loading-dots {
                    0%, 20% { content: '.'; }
                    40% { content: '..'; }
                    60%, 100% { content: '...'; }
                }
            </style>
        `;
    }

    // Load analytics data with robust error handling
    async function loadAnalyticsDataRobust(tooltip, nodeData) {
        console.log('📊 Loading analytics data for:', nodeData.name);
        
        const gscContent = tooltip.querySelector('#gsc-content');
        const ga4Content = tooltip.querySelector('#ga4-content');
        const gscStatus = tooltip.querySelector('#gsc-connection-status');
        const ga4Status = tooltip.querySelector('#ga4-connection-status');
        const reconnectSection = tooltip.querySelector('#reconnect-section');
        
        let needsReconnection = false;
        
        // Load GSC data
        if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
            gscStatus.textContent = '🟢 Connected';
            try {
                const gscData = await window.GSCIntegration.fetchNodeData(nodeData);
                console.log('🔍 GSC data loaded:', gscData);
                
                if (gscData && !gscData.noDataFound && !gscData.error) {
                    gscContent.innerHTML = `
                        <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 4px;">
                            ${formatNumber(gscData.clicks)} clicks
                        </div>
                        <div style="font-size: 0.85rem; opacity: 0.9; line-height: 1.3;">
                            ${formatNumber(gscData.impressions)} impressions<br>
                            ${(gscData.ctr * 100).toFixed(1)}% CTR • #${gscData.position.toFixed(0)} avg position
                        </div>
                    `;
                } else {
                    gscContent.innerHTML = '<div style="opacity: 0.7; font-size: 0.9rem;">No data available</div>';
                }
            } catch (error) {
                console.error('❌ GSC error:', error);
                gscContent.innerHTML = '<div style="opacity: 0.7; color: #ffcdd2; font-size: 0.9rem;">Error loading data</div>';
                gscStatus.textContent = '🔴 Error';
                needsReconnection = true;
            }
        } else {
            gscContent.innerHTML = '<div style="opacity: 0.7; font-size: 0.9rem;">Not connected</div>';
            gscStatus.textContent = '🔴 Disconnected';
            needsReconnection = true;
        }
        
        // Load GA4 data
        if (window.GA4Integration && window.GA4Integration.isConnected()) {
            ga4Status.textContent = '🟢 Connected';
            try {
                console.log('📊 Fetching GA4 data...');
                const ga4Data = await window.GA4Integration.fetchData(nodeData.url);
                console.log('📊 GA4 data loaded:', ga4Data);
                
                if (ga4Data && !ga4Data.noDataFound && !ga4Data.error) {
                    ga4Content.innerHTML = `
                        <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 4px;">
                            ${formatNumber(ga4Data.users || 0)} users
                        </div>
                        <div style="font-size: 0.85rem; opacity: 0.9; line-height: 1.3;">
                            ${formatNumber(ga4Data.pageViews || 0)} page views<br>
                            ${formatNumber(ga4Data.sessions || 0)} sessions • ${((ga4Data.engagementRate || 0) * 100).toFixed(0)}% engaged
                        </div>
                    `;
                    console.log('✅ GA4 content updated successfully');
                } else {
                    console.warn('⚠️ GA4 data issue:', ga4Data);
                    if (ga4Data?.error && ga4Data.error.includes('401')) {
                        ga4Content.innerHTML = '<div style="opacity: 0.7; color: #ffcdd2; font-size: 0.9rem;">Authentication expired</div>';
                        ga4Status.textContent = '🔴 Auth expired';
                        needsReconnection = true;
                    } else {
                        ga4Content.innerHTML = '<div style="opacity: 0.7; font-size: 0.9rem;">No data available</div>';
                    }
                }
            } catch (error) {
                console.error('❌ GA4 error:', error);
                ga4Content.innerHTML = '<div style="opacity: 0.7; color: #ffcdd2; font-size: 0.9rem;">Error loading data</div>';
                ga4Status.textContent = '🔴 Error';
                needsReconnection = true;
            }
        } else {
            ga4Content.innerHTML = '<div style="opacity: 0.7; font-size: 0.9rem;">Not connected</div>';
            ga4Status.textContent = '🔴 Disconnected';
            needsReconnection = true;
        }
        
        // Show reconnect section if needed
        if (needsReconnection) {
            reconnectSection.style.display = 'block';
        }
    }

    // Enhanced tooltip show function
    async function showCombinedTooltip(event, nodeData) {
        console.log('🎯 Enhanced tooltip triggered for:', nodeData.name);
        
        // Hide existing tooltip
        if (window.hideEnhancedTooltip) {
            window.hideEnhancedTooltip();
        }

        // Create combined tooltip
        const tooltip = createCombinedTooltip(nodeData);
        
        // Add analytics loading section
        tooltip.innerHTML += createAnalyticsLoadingSection();
        
        // Position tooltip
        positionTooltip(tooltip, event);
        
        // Add to DOM and show
        document.body.appendChild(tooltip);
        setTimeout(() => tooltip.style.opacity = '1', 10);
        
        // Store reference for cleanup
        window.currentTooltip = tooltip;
        
        // Add hover protection
        tooltip.addEventListener('mouseenter', () => {
            if (window.hideTimer) clearTimeout(window.hideTimer);
        });
        
        tooltip.addEventListener('mouseleave', () => {
            if (window.hideEnhancedTooltip) window.hideEnhancedTooltip();
        });

        // Load analytics data
        await loadAnalyticsDataRobust(tooltip, nodeData);
    }

    // Utility functions
    function formatNumber(num) {
        if (!num || num === 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    }

    function formatDuration(seconds) {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    }

    // Position tooltip (basic version - use your existing function if available)
    function positionTooltip(tooltip, event) {
        let left = event.pageX + 15;
        let top = event.pageY - 10;
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        
        // Simple boundary check
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

    // Reconnect function
    function reconnectAnalytics() {
        console.log('🔄 Reconnecting analytics integrations...');
        
        // Find and click the connect buttons
        const gscButton = document.getElementById('gscConnectBtn');
        const ga4Button = document.getElementById('ga4ConnectBtn');
        
        if (gscButton) {
            const gscConnected = gscButton.classList.contains('connected');
            if (gscConnected) {
                gscButton.click(); // Disconnect
                setTimeout(() => gscButton.click(), 500); // Reconnect
            } else {
                gscButton.click(); // Connect
            }
        }
        
        if (ga4Button) {
            const ga4Connected = ga4Button.classList.contains('connected');
            if (ga4Connected) {
                ga4Button.click(); // Disconnect  
                setTimeout(() => ga4Button.click(), 1000); // Reconnect
            } else {
                ga4Button.click(); // Connect
            }
        }
        
        // Hide current tooltip
        if (window.hideEnhancedTooltip) {
            window.hideEnhancedTooltip();
        }
        
        console.log('✅ Reconnection initiated - follow the auth flows');
    }

    // Hook into existing tooltip system
    function enhanceExistingTooltips() {
        console.log('🔧 Enhancing existing tooltips with combined analytics...');
        
        // Store original functions
        const originalShow = window.showEnhancedTooltip;
        const originalHide = window.hideEnhancedTooltip;
        
        // Override with combined version
        window.showEnhancedTooltip = function(event, d) {
            if (!d.data) return;
            showCombinedTooltip(event, d.data);
        };
        
        // Keep existing hide functionality or create if missing
        if (!originalHide) {
            window.hideEnhancedTooltip = function() {
                if (window.currentTooltip) {
                    window.currentTooltip.style.opacity = '0';
                    setTimeout(() => {
                        if (window.currentTooltip) {
                            window.currentTooltip.remove();
                            window.currentTooltip = null;
                        }
                    }, 200);
                }
            };
        }
        
        // Make reconnect function globally available
        window.reconnectAnalytics = reconnectAnalytics;
        
        console.log('✅ Enhanced tooltips with combined GSC + GA4 data and connection status');
    }

    // Initialize when both integrations are ready
    waitForIntegrations(() => {
        enhanceExistingTooltips();
        console.log('🚀 Permanent combined analytics tooltips ready with connection status!');
    });

})();
