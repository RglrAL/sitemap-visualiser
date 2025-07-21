// rich-combined-tooltip-integration.js - FILE VERSION
// Replace your combined-tooltip-integration.js file with this content

(function() {
    console.log('🚀 Loading rich combined tooltip integration (FILE VERSION)...');

    // Robust override mechanism - waits for page to be ready
    function initializeRichTooltips() {
        console.log('🔧 Initializing rich combined tooltips...');
        
        // Wait for both integrations and DOM
        const waitForReady = () => {
            const hasGSC = window.GSCIntegration;
            const hasGA4 = window.GA4Integration;
            const hasDOM = document.readyState === 'complete' || document.readyState === 'interactive';
            
            console.log('📊 Readiness check:', { hasGSC: !!hasGSC, hasGA4: !!hasGA4, hasDOM });
            
            if (hasGSC && hasGA4 && hasDOM) {
                installRichTooltipSystem();
            } else {
                setTimeout(waitForReady, 200);
            }
        };
        
        waitForReady();
    }

    // Rich tooltip system installation
    function installRichTooltipSystem() {
        console.log('🎯 Installing rich tooltip system...');
        
        // Store original functions if they exist
        const originalShow = window.showEnhancedTooltip;
        const originalHide = window.hideEnhancedTooltip;
        
        // Install our enhanced functions
        window.showEnhancedTooltip = showRichCombinedTooltip;
        window.hideEnhancedTooltip = hideRichTooltip;
        window.refreshRichTooltipData = refreshRichTooltipData;
        
        console.log('✅ Rich combined tooltip system installed');
        console.log('📋 Available functions:', {
            show: typeof window.showEnhancedTooltip,
            hide: typeof window.hideEnhancedTooltip,
            refresh: typeof window.refreshRichTooltipData
        });
    }

    // Main rich tooltip show function
    async function showRichCombinedTooltip(event, d) {
        console.log('🎯 Rich combined tooltip for:', d.data?.name);
        
        if (!d.data) {
            console.warn('⚠️ No data provided to tooltip');
            return;
        }

        // Hide existing tooltip
        hideRichTooltip();

        // Create rich tooltip
        const tooltip = createRichTooltip(d.data);
        
        // Position tooltip
        positionTooltip(tooltip, event);
        
        // Add to DOM
        document.body.appendChild(tooltip);
        
        // Store references
        window.currentRichTooltip = tooltip;
        tooltip._nodeData = d.data;
        
        // Show with animation
        setTimeout(() => tooltip.style.opacity = '1', 10);
        
        // Add hover protection
        addHoverProtection(tooltip);

        // Load analytics data
        try {
            await loadRichAnalyticsData(tooltip, d.data);
        } catch (error) {
            console.error('❌ Error loading rich analytics data:', error);
        }
    }

    // Create rich tooltip with detailed layout
    function createRichTooltip(nodeData) {
        const tooltip = document.createElement('div');
        tooltip.className = 'enhanced-tooltip rich-combined-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ddd;
            border-radius: 16px;
            padding: 0;
            box-shadow: 0 12px 32px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 600px;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.4;
            overflow: hidden;
        `;

        // Create rich content structure
        tooltip.innerHTML = createRichTooltipContent(nodeData);
        
        return tooltip;
    }

    // Create rich tooltip content with detailed info
    function createRichTooltipContent(data) {
        // Get freshness info (if available from your existing functions)
        let freshnessInfo = '';
        let lastModifiedDisplay = '';
        
        if (typeof getFreshnessInfo === 'function' && data.lastModified) {
            const freshnessData = getFreshnessInfo(data.lastModified);
            if (freshnessData) {
                freshnessInfo = `<span style="background: ${freshnessData.freshnessColor}20; color: ${freshnessData.freshnessColor}; padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 500;">${freshnessData.freshnessLabel}</span>`;
                lastModifiedDisplay = `
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 8px 0; border-top: 1px solid #f0f0f0;">
                        <span style="font-size: 0.75rem; color: #666;">📅 Updated:</span>
                        <span style="font-size: 0.8rem; color: #333; font-weight: 500;">${freshnessData.formattedDate}</span>
                        <span style="font-size: 0.75rem; color: #999;">(${freshnessData.relativeTime})</span>
                    </div>
                `;
            }
        }

        // Get page info (if available from your existing functions)
        let pageInfoDisplay = '';
        if (typeof getPageInfo === 'function') {
            const treeContext = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
            const pageInfo = getPageInfo(data, treeContext);
            
            pageInfoDisplay = `
                <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin-top: 10px; border-left: 3px solid #6c757d;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.75rem;">
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
            <!-- Page Header -->
            <div style="padding: 20px; border-bottom: 1px solid #e0e0e0; background: linear-gradient(135deg, #f8f9ff 0%, #e8f1fe 100%);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 12px;">
                    <h4 style="margin: 0; color: #1f4788; font-size: 1.1rem; font-weight: 600; flex: 1;">${data.name}</h4>
                    ${freshnessInfo}
                </div>
                
                ${data.url ? `
                    <a href="${data.url}" target="_blank" 
                       style="font-size: 0.8rem; color: #4a90e2; text-decoration: none; word-break: break-all; 
                              margin-bottom: 8px; display: block; border-bottom: 1px dotted #4a90e2;" 
                       onmouseover="this.style.textDecoration='underline'" 
                       onmouseout="this.style.textDecoration='none'">
                        ${data.url}
                    </a>
                ` : ''}
                
                ${lastModifiedDisplay}
                ${pageInfoDisplay}
            </div>

            <!-- Combined Analytics Section -->
            <div id="rich-analytics-container" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                
                <!-- Analytics Header -->
                <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">📊 Performance Analytics</h3>
                        <div style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 15px; font-size: 0.75rem; font-weight: 500;">
                            Last 30 Days
                        </div>
                    </div>
                </div>
                
                <!-- Metrics Grid -->
                <div style="padding: 20px;">
                    
                    <!-- Search Console Card -->
                    <div id="rich-gsc-card" style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 16px; margin-bottom: 16px; backdrop-filter: blur(10px);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.1rem;">🔍</span>
                                <span style="font-size: 0.95rem; font-weight: 600;">Search Console</span>
                            </div>
                            <span id="rich-gsc-status" style="font-size: 0.75rem; opacity: 0.9; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px;">
                                Loading...
                            </span>
                        </div>
                        <div id="rich-gsc-content">
                            <div style="text-align: center; opacity: 0.8; padding: 20px;">
                                <div style="margin-bottom: 8px;">⏳</div>
                                <div style="font-size: 0.9rem;">Fetching search performance data...</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Google Analytics 4 Card -->
                    <div id="rich-ga4-card" style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 16px; backdrop-filter: blur(10px);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.1rem;">📈</span>
                                <span style="font-size: 0.95rem; font-weight: 600;">Google Analytics 4</span>
                            </div>
                            <span id="rich-ga4-status" style="font-size: 0.75rem; opacity: 0.9; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px;">
                                Loading...
                            </span>
                        </div>
                        <div id="rich-ga4-content">
                            <div style="text-align: center; opacity: 0.8; padding: 20px;">
                                <div style="margin-bottom: 8px;">⏳</div>
                                <div style="font-size: 0.9rem;">Fetching user analytics data...</div>
                            </div>
                        </div>
                    </div>
                    
                </div>
                
                <!-- Action Footer -->
                <div style="background: rgba(255,255,255,0.05); padding: 16px 20px; display: flex; gap: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button onclick="window.open('${data.url}', '_blank')" 
                            style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px 18px; 
                                   border-radius: 8px; font-size: 0.85rem; cursor: pointer; flex: 1; font-weight: 500; transition: all 0.2s;"
                            onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-1px)'"
                            onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'">
                        🔗 Visit Page
                    </button>
                    <button onclick="window.refreshRichTooltipData && window.refreshRichTooltipData()" 
                            style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px 18px; 
                                   border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 500; transition: all 0.2s;"
                            onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-1px)'"
                            onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'">
                        🔄 Refresh
                    </button>
                    <button onclick="window.showDetailedAnalysis && window.showDetailedAnalysis('${data.url}')" 
                            style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px 18px; 
                                   border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 500; transition: all 0.2s;"
                            onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-1px)'"
                            onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'">
                        📊 Detailed Analysis
                    </button>
                </div>
            </div>
        `;
    }

    // Load rich analytics data with detailed metrics
    async function loadRichAnalyticsData(tooltip, nodeData) {
        console.log('📊 Loading rich analytics for:', nodeData.name);
        
        const gscContent = tooltip.querySelector('#rich-gsc-content');
        const ga4Content = tooltip.querySelector('#rich-ga4-content');
        const gscStatus = tooltip.querySelector('#rich-gsc-status');
        const ga4Status = tooltip.querySelector('#rich-ga4-status');
        
        // Load Search Console data with detailed metrics
        if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
            gscStatus.textContent = '🟢 Connected';
            try {
                const gscData = await window.GSCIntegration.fetchNodeData(nodeData);
                console.log('🔍 Rich GSC data:', gscData);
                
                if (gscData && !gscData.noDataFound && !gscData.error) {
                    // Create detailed GSC display
                    gscContent.innerHTML = createRichGSCDisplay(gscData);
                } else {
                    gscContent.innerHTML = createNoDataDisplay('search', '📭 No search performance data found for this page');
                }
            } catch (error) {
                console.error('❌ GSC error:', error);
                gscStatus.textContent = '🔴 Error';
                gscContent.innerHTML = createErrorDisplay('search', 'Error loading Search Console data');
            }
        } else {
            gscStatus.textContent = '🔴 Not Connected';
            gscContent.innerHTML = createNotConnectedDisplay('search', 'Search Console not connected');
        }
        
        // Load GA4 data with detailed metrics
        if (window.GA4Integration && window.GA4Integration.isConnected()) {
            ga4Status.textContent = '🟢 Connected';
            try {
                const ga4Data = await window.GA4Integration.fetchData(nodeData.url);
                console.log('📈 Rich GA4 data:', ga4Data);
                
                if (ga4Data && !ga4Data.noDataFound && !ga4Data.error) {
                    // Create detailed GA4 display
                    ga4Content.innerHTML = createRichGA4Display(ga4Data);
                } else {
                    ga4Content.innerHTML = createNoDataDisplay('analytics', '📭 No user analytics data found for this page');
                }
            } catch (error) {
                console.error('❌ GA4 error:', error);
                ga4Status.textContent = '🔴 Error';
                ga4Content.innerHTML = createErrorDisplay('analytics', 'Error loading Google Analytics data');
            }
        } else {
            ga4Status.textContent = '🔴 Not Connected';
            ga4Content.innerHTML = createNotConnectedDisplay('analytics', 'Google Analytics 4 not connected');
        }
    }

    // Create rich GSC display with detailed metrics
    function createRichGSCDisplay(gscData) {
        const hasQueries = gscData.topQueries && gscData.topQueries.length > 0;
        
        return `
            <!-- Main Metrics Grid -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: ${hasQueries ? '16px' : '0'};">
                <div style="text-align: center; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; color: #4fc3f7;">
                        ${formatNumber(gscData.clicks)}
                    </div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Clicks</div>
                    ${gscData.trend && gscData.trend.clicksChange ? `
                        <div style="font-size: 0.7rem; margin-top: 2px; color: ${parseFloat(gscData.trend.clicksChange) >= 0 ? '#81c784' : '#e57373'};">
                            ${parseFloat(gscData.trend.clicksChange) > 0 ? '+' : ''}${gscData.trend.clicksChange}%
                        </div>
                    ` : ''}
                </div>
                <div style="text-align: center; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; color: #81c784;">
                        ${formatNumber(gscData.impressions)}
                    </div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Impressions</div>
                    ${gscData.trend && gscData.trend.impressionsChange ? `
                        <div style="font-size: 0.7rem; margin-top: 2px; color: ${parseFloat(gscData.trend.impressionsChange) >= 0 ? '#81c784' : '#e57373'};">
                            ${parseFloat(gscData.trend.impressionsChange) > 0 ? '+' : ''}${gscData.trend.impressionsChange}%
                        </div>
                    ` : ''}
                </div>
                <div style="text-align: center; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; color: #ffb74d;">
                        ${(gscData.ctr * 100).toFixed(1)}%
                    </div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">CTR</div>
                </div>
                <div style="text-align: center; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; color: #f06292;">
                        #${gscData.position.toFixed(0)}
                    </div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Avg Position</div>
                    ${gscData.trend && gscData.trend.positionChange ? `
                        <div style="font-size: 0.7rem; margin-top: 2px; color: ${parseFloat(gscData.trend.positionChange) >= 0 ? '#81c784' : '#e57373'};">
                            ${parseFloat(gscData.trend.positionChange) > 0 ? '+' : ''}${gscData.trend.positionChange}
                        </div>
                    ` : ''}
                </div>
            </div>

            ${hasQueries ? `
                <!-- Top Keywords -->
                <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; opacity: 0.9;">🎯 Top Keywords:</div>
                    ${gscData.topQueries.slice(0, 3).map((query, index) => `
                        <div style="margin-bottom: ${index < 2 ? '6px' : '0'}; font-size: 0.8rem;">
                            <div style="font-weight: 500; margin-bottom: 2px;">"${escapeHtml(query.query)}"</div>
                            <div style="opacity: 0.8; font-size: 0.75rem;">
                                ${query.clicks} clicks • #${query.position.toFixed(0)} position • ${(query.ctr * 100).toFixed(1)}% CTR
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    }

    // Create rich GA4 display with detailed metrics
    function createRichGA4Display(ga4Data) {
        return `
            <!-- Main Metrics Grid -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                <div style="text-align: center; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; color: #4fc3f7;">
                        ${formatNumber(ga4Data.users || 0)}
                    </div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Users</div>
                </div>
                <div style="text-align: center; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; color: #81c784;">
                        ${formatNumber(ga4Data.pageViews || 0)}
                    </div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Page Views</div>
                </div>
                <div style="text-align: center; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; color: #ffb74d;">
                        ${formatNumber(ga4Data.sessions || 0)}
                    </div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Sessions</div>
                </div>
                <div style="text-align: center; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; color: #f06292;">
                        ${((ga4Data.engagementRate || 0) * 100).toFixed(0)}%
                    </div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Engagement</div>
                </div>
            </div>

            <!-- Additional Metrics Row -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px;">
                <div style="text-align: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px;">
                    <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 2px;">
                        ${formatNumber(ga4Data.newUsers || 0)}
                    </div>
                    <div style="font-size: 0.7rem; opacity: 0.8;">New Users</div>
                </div>
                <div style="text-align: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px;">
                    <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 2px;">
                        ${formatDuration(ga4Data.avgSessionDuration || 0)}
                    </div>
                    <div style="font-size: 0.7rem; opacity: 0.8;">Avg Duration</div>
                </div>
                <div style="text-align: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px;">
                    <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 2px;">
                        ${((ga4Data.bounceRate || 0) * 100).toFixed(0)}%
                    </div>
                    <div style="font-size: 0.7rem; opacity: 0.8;">Bounce Rate</div>
                </div>
            </div>
        `;
    }

    // Helper display functions
    function createNoDataDisplay(type, message) {
        return `
            <div style="text-align: center; opacity: 0.7; padding: 20px;">
                <div style="font-size: 1.5rem; margin-bottom: 8px;">📭</div>
                <div style="font-size: 0.9rem;">${message}</div>
                <div style="font-size: 0.75rem; margin-top: 4px; opacity: 0.8;">
                    Try checking if this page has received ${type === 'search' ? 'organic search traffic' : 'user visits'} recently
                </div>
            </div>
        `;
    }

    function createErrorDisplay(type, message) {
        return `
            <div style="text-align: center; opacity: 0.7; padding: 20px;">
                <div style="font-size: 1.5rem; margin-bottom: 8px;">❌</div>
                <div style="font-size: 0.9rem; color: #ffcdd2;">${message}</div>
                <div style="font-size: 0.75rem; margin-top: 4px; opacity: 0.8;">
                    Try refreshing or reconnecting the integration
                </div>
            </div>
        `;
    }

    function createNotConnectedDisplay(type, message) {
        return `
            <div style="text-align: center; opacity: 0.7; padding: 20px;">
                <div style="font-size: 1.5rem; margin-bottom: 8px;">🔌</div>
                <div style="font-size: 0.9rem;">${message}</div>
                <div style="font-size: 0.75rem; margin-top: 4px; opacity: 0.8;">
                    Click the "${type === 'search' ? 'Connect GSC' : 'Connect GA4'}" button to enable ${type} analytics
                </div>
            </div>
        `;
    }

    // Hide rich tooltip
    function hideRichTooltip() {
        window.tooltipHideTimer = setTimeout(() => {
            if (window.currentRichTooltip) {
                window.currentRichTooltip.style.opacity = '0';
                setTimeout(() => {
                    if (window.currentRichTooltip) {
                        window.currentRichTooltip.remove();
                        window.currentRichTooltip = null;
                    }
                }, 300);
            }
        }, 100);
    }

    // Refresh rich tooltip data
    function refreshRichTooltipData() {
        if (window.currentRichTooltip && window.currentRichTooltip._nodeData) {
            console.log('🔄 Refreshing rich tooltip data...');
            loadRichAnalyticsData(window.currentRichTooltip, window.currentRichTooltip._nodeData);
        }
    }

    // Add hover protection
    function addHoverProtection(tooltip) {
        tooltip.addEventListener('mouseenter', () => {
            if (window.tooltipHideTimer) {
                clearTimeout(window.tooltipHideTimer);
            }
        });
        
        tooltip.addEventListener('mouseleave', () => {
            hideRichTooltip();
        });
    }

    // Position tooltip with boundary detection
    function positionTooltip(tooltip, event) {
        let left = event.pageX + 15;
        let top = event.pageY - 10;
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        
        // Boundary check after render
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

    // Utility functions
    function formatNumber(num) {
        if (!num || num === 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    }

    function formatDuration(seconds) {
        if (!seconds || seconds < 1) return '0s';
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeRichTooltips);
    } else {
        initializeRichTooltips();
    }

    console.log('📋 Rich combined tooltip integration loaded - waiting for integrations...');

})();
