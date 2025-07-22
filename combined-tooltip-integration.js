// enhanced-modern-tooltip-with-trends.js
// Modern, minimal tooltip with period-over-period trend analysis

(function() {
    console.log('🚀 Loading modern tooltip with trend analysis...');

    // Modern enhanced tooltip function
    const modernTooltipFunction = function(event, d) {
        console.log('🎯 Modern tooltip for:', d.data?.name);
        
        if (!d.data) return;

        // Clear existing timers and tooltips
        clearTooltipTimers();
        hideExistingTooltip(d.data);

        // Create modern tooltip
        const tooltip = createModernTooltip(d.data);
        positionTooltip(tooltip, event);
        
        document.body.appendChild(tooltip);
        window.currentEnhancedTooltip = tooltip;
        tooltip._nodeData = d.data;

        // Animate in
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0) scale(1)';
        });

        addModernHoverBehavior(tooltip);
        loadTrendAnalytics(tooltip, d.data);
    };

    function createModernTooltip(data) {
        const tooltip = document.createElement('div');
        tooltip.className = 'modern-enhanced-tooltip';
        
        // Modern styling with better visual hierarchy
        tooltip.style.cssText = `
            position: absolute;
            background: white;
            border-radius: 16px;
            padding: 0;
            box-shadow: 
                0 20px 25px -5px rgba(0, 0, 0, 0.1),
                0 10px 10px -5px rgba(0, 0, 0, 0.04),
                0 0 0 1px rgba(0, 0, 0, 0.05);
            z-index: 10000;
            max-width: 420px;
            opacity: 0;
            transform: translateY(8px) scale(0.95);
            transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            pointer-events: auto;
            backdrop-filter: blur(20px);
        `;

        tooltip.innerHTML = createModernContent(data);
        return tooltip;
    }

    function createModernContent(data) {
        const pageInfo = getPageInfoSafe(data);
        const freshnessInfo = getFreshnessInfoSafe(data);

        return `
            <!-- Modern Header with Glassmorphism -->
            <div style="
                padding: 20px 20px 16px 20px; 
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border-bottom: 1px solid rgba(0,0,0,0.06);
            ">
                <div style="display: flex; justify-content: between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                    <div style="flex: 1; min-width: 0;">
                        <h3 style="
                            margin: 0 0 6px 0; 
                            font-size: 1.1rem; 
                            font-weight: 600; 
                            color: #0f172a;
                            line-height: 1.3;
                            display: -webkit-box;
                            -webkit-line-clamp: 2;
                            -webkit-box-orient: vertical;
                            overflow: hidden;
                        ">
                            ${data.name || 'Page'}
                        </h3>
                        
                        ${data.url ? `
                            <a href="${data.url}" target="_blank" 
                               style="
                                   font-size: 0.75rem; 
                                   color: #3b82f6; 
                                   text-decoration: none;
                                   display: block;
                                   white-space: nowrap;
                                   overflow: hidden;
                                   text-overflow: ellipsis;
                                   margin-bottom: 8px;
                               " 
                               onmouseover="this.style.color='#1d4ed8'" 
                               onmouseout="this.style.color='#3b82f6'">
                                ${data.url}
                            </a>
                        ` : ''}
                    </div>
                    
                    ${freshnessInfo.badge}
                </div>
                
                <!-- Compact Page Metrics -->
                <div style="
                    display: grid; 
                    grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); 
                    gap: 12px; 
                    font-size: 0.75rem; 
                    color: #64748b;
                ">
                    <div style="text-align: center;">
                        <div style="font-weight: 600; color: #0f172a;">${pageInfo.type}</div>
                        <div style="color: #94a3b8;">Type</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-weight: 600; color: #0f172a;">L${pageInfo.depth}</div>
                        <div style="color: #94a3b8;">Depth</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-weight: 600; color: ${pageInfo.children > 0 ? '#10b981' : '#94a3b8'};">${pageInfo.children}</div>
                        <div style="color: #94a3b8;">Children</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-weight: 600; color: ${pageInfo.siblings > 0 ? '#3b82f6' : '#94a3b8'};">${pageInfo.siblings}</div>
                        <div style="color: #94a3b8;">Siblings</div>
                    </div>
                </div>
            </div>

            <!-- Modern Analytics Section -->
            <div style="padding: 20px;">
                
                <!-- Search Console Trends -->
                <div id="modern-gsc-section" style="margin-bottom: 16px;">
                    <div style="
                        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                        color: white;
                        padding: 16px;
                        border-radius: 12px;
                        position: relative;
                        overflow: hidden;
                    ">
                        <!-- Header -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; position: relative; z-index: 2;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="
                                    width: 24px; height: 24px; 
                                    background: rgba(255,255,255,0.2); 
                                    border-radius: 6px; 
                                    display: flex; align-items: center; justify-content: center;
                                    font-size: 0.9rem;
                                ">🔍</div>
                                <div>
                                    <div style="font-weight: 600; font-size: 0.9rem;">Search Performance</div>
                                    <div style="font-size: 0.7rem; opacity: 0.8;">Last 30 days vs Previous 30</div>
                                </div>
                            </div>
                            <div id="gsc-connection-badge" style="
                                padding: 4px 8px; 
                                background: rgba(255,255,255,0.2); 
                                border-radius: 20px; 
                                font-size: 0.7rem; 
                                font-weight: 600;
                            ">
                                ●●● Loading
                            </div>
                        </div>
                        
                        <!-- Trend Metrics Grid -->
                        <div id="gsc-metrics-grid" style="
                            display: grid; 
                            grid-template-columns: repeat(2, 1fr); 
                            gap: 12px; 
                            position: relative; 
                            z-index: 2;
                        ">
                            ${createLoadingMetricCard()}
                            ${createLoadingMetricCard()}
                            ${createLoadingMetricCard()}
                            ${createLoadingMetricCard()}
                        </div>
                        
                        <!-- Background Pattern -->
                        <div style="
                            position: absolute; 
                            top: -50%; 
                            right: -50%; 
                            width: 100%; 
                            height: 200%; 
                            background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path d=\"M0 32V.5h32\" stroke=\"white\" stroke-opacity=\".1\" fill=\"none\"/></svg>');
                            opacity: 0.1;
                        "></div>
                    </div>
                </div>
                
                <!-- Google Analytics Trends -->
                <div id="modern-ga4-section" style="margin-bottom: 16px;">
                    <div style="
                        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                        color: white;
                        padding: 16px;
                        border-radius: 12px;
                        position: relative;
                        overflow: hidden;
                    ">
                        <!-- Header -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; position: relative; z-index: 2;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="
                                    width: 24px; height: 24px; 
                                    background: rgba(255,255,255,0.2); 
                                    border-radius: 6px; 
                                    display: flex; align-items: center; justify-content: center;
                                    font-size: 0.9rem;
                                ">📈</div>
                                <div>
                                    <div style="font-weight: 600; font-size: 0.9rem;">User Analytics</div>
                                    <div style="font-size: 0.7rem; opacity: 0.8;">Last 30 days vs Previous 30</div>
                                </div>
                            </div>
                            <div id="ga4-connection-badge" style="
                                padding: 4px 8px; 
                                background: rgba(255,255,255,0.2); 
                                border-radius: 20px; 
                                font-size: 0.7rem; 
                                font-weight: 600;
                            ">
                                ●●● Loading
                            </div>
                        </div>
                        
                        <!-- Trend Metrics Grid -->
                        <div id="ga4-metrics-grid" style="
                            display: grid; 
                            grid-template-columns: repeat(2, 1fr); 
                            gap: 12px; 
                            position: relative; 
                            z-index: 2;
                        ">
                            ${createLoadingMetricCard()}
                            ${createLoadingMetricCard()}
                            ${createLoadingMetricCard()}
                            ${createLoadingMetricCard()}
                        </div>
                        
                        <!-- Background Pattern -->
                        <div style="
                            position: absolute; 
                            top: -50%; 
                            right: -50%; 
                            width: 100%; 
                            height: 200%; 
                            background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path d=\"M0 32V.5h32\" stroke=\"white\" stroke-opacity=\".1\" fill=\"none\"/></svg>');
                            opacity: 0.1;
                        "></div>
                    </div>
                </div>
                
                <!-- Modern Action Bar -->
                <div style="
                    display: flex; 
                    gap: 8px; 
                    padding: 12px; 
                    background: #f8fafc; 
                    border-radius: 12px; 
                    border: 1px solid #e2e8f0;
                ">
                    <button class="modern-action-btn modern-action-primary" data-action="visit" data-url="${data.url}">
                        <span class="btn-icon">🚀</span>
                        <span class="btn-text">Visit</span>
                    </button>
                    <button class="modern-action-btn modern-action-secondary" data-action="refresh">
                        <span class="btn-icon">🔄</span>
                        <span class="btn-text">Refresh</span>
                    </button>
                    <button class="modern-action-btn modern-action-secondary" data-action="detailed" data-url="${data.url}">
                        <span class="btn-icon">📊</span>
                        <span class="btn-text">Report</span>
                    </button>
                </div>
            </div>

            <style>
                .modern-action-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 10px 12px;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s cubic-bezier(0.4, 0.0, 0.2, 1);
                    font-family: inherit;
                }
                
                .modern-action-primary {
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    box-shadow: 0 1px 3px rgba(59, 130, 246, 0.3);
                }
                
                .modern-action-primary:hover {
                    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                    transform: translateY(-1px);
                }
                
                .modern-action-secondary {
                    background: white;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                
                .modern-action-secondary:hover {
                    background: #f8fafc;
                    color: #334155;
                    border-color: #cbd5e1;
                    transform: translateY(-1px);
                }
                
                .btn-icon {
                    font-size: 0.9rem;
                }
                
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                
                .loading-shimmer {
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                }
            </style>
        `;
    }

    function createLoadingMetricCard() {
        return `
            <div style="
                background: rgba(255,255,255,0.15); 
                border-radius: 8px; 
                padding: 12px; 
                text-align: center;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <div style="
                    height: 16px; 
                    background: rgba(255,255,255,0.3); 
                    border-radius: 4px; 
                    margin-bottom: 6px;
                " class="loading-shimmer"></div>
                <div style="
                    height: 10px; 
                    background: rgba(255,255,255,0.2); 
                    border-radius: 4px; 
                    width: 60%; 
                    margin: 0 auto;
                " class="loading-shimmer"></div>
            </div>
        `;
    }

    function createTrendMetricCard(label, currentValue, previousValue, color = '#ffffff') {
        const current = parseFloat(currentValue) || 0;
        const previous = parseFloat(previousValue) || 0;
        
        // Calculate trend
        let percentChange = 0;
        let changeDirection = '→';
        let changeColor = 'rgba(255,255,255,0.7)';
        
        if (previous > 0) {
            percentChange = ((current - previous) / previous) * 100;
            
            if (Math.abs(percentChange) < 2) {
                changeDirection = '→';
                changeColor = 'rgba(255,255,255,0.7)';
            } else if (percentChange > 0) {
                changeDirection = '↗';
                changeColor = '#10b981';
            } else {
                changeDirection = '↘';
                changeColor = '#ef4444';
            }
        }

        return `
            <div style="
                background: rgba(255,255,255,0.15); 
                border-radius: 8px; 
                padding: 12px; 
                text-align: center;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.1);
                position: relative;
                overflow: hidden;
            ">
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 2px;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: white;">
                        ${formatDisplayValue(current)}
                    </div>
                    <div style="
                        font-size: 0.7rem; 
                        color: ${changeColor}; 
                        font-weight: 600;
                        padding: 2px 4px;
                        background: rgba(0,0,0,0.1);
                        border-radius: 4px;
                    ">
                        ${changeDirection}${Math.abs(percentChange).toFixed(0)}%
                    </div>
                </div>
                
                <!-- Mini trend visualization -->
                ${createMiniTrendLine(current, previous, changeColor)}
                
                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.8); margin-top: 4px;">
                    ${label}
                </div>
                
                <div style="font-size: 0.65rem; color: rgba(255,255,255,0.6); margin-top: 2px;">
                    was ${formatDisplayValue(previous)}
                </div>
            </div>
        `;
    }

    function createMiniTrendLine(current, previous, color) {
        const points = [previous, current];
        const max = Math.max(...points);
        const min = Math.min(...points);
        const range = max - min || 1;
        
        const x1 = 2;
        const x2 = 38;
        const y1 = 8 - ((previous - min) / range) * 6;
        const y2 = 8 - ((current - min) / range) * 6;
        
        return `
            <svg width="40" height="10" style="margin: 2px auto; display: block;">
                <defs>
                    <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:rgba(255,255,255,0.3)" />
                        <stop offset="100%" style="stop-color:${color}" />
                    </linearGradient>
                </defs>
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                      stroke="url(#trendGradient)" 
                      stroke-width="2" 
                      stroke-linecap="round"/>
                <circle cx="${x2}" cy="${y2}" r="1.5" fill="${color}"/>
            </svg>
        `;
    }

    async function loadTrendAnalytics(tooltip, nodeData) {
        console.log('📈 Loading trend analytics for:', nodeData.name);
        
        // Load GSC trends
        if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
            await loadGSCTrends(tooltip, nodeData);
        } else {
            showGSCDisconnected(tooltip);
        }
        
        // Load GA4 trends  
        if (window.GA4Integration && window.GA4Integration.isConnected()) {
            await loadGA4Trends(tooltip, nodeData);
        } else {
            showGA4Disconnected(tooltip);
        }
    }

    async function loadGSCTrends(tooltip, nodeData) {
        const badge = tooltip.querySelector('#gsc-connection-badge');
        const grid = tooltip.querySelector('#gsc-metrics-grid');
        
        try {
            badge.textContent = '🟢 Connected';
            badge.style.background = 'rgba(16, 185, 129, 0.2)';
            
            // Fetch current period data
            const currentData = await window.GSCIntegration.fetchNodeData(nodeData);
            
            if (!currentData || currentData.noDataFound) {
                grid.innerHTML = createNoDataMessage('No search data available');
                return;
            }
            
            // Simulate previous period data (you'll need to implement this in your GSC integration)
            const previousData = await fetchPreviousPeriodGSC(nodeData);
            
            grid.innerHTML = `
                ${createTrendMetricCard('Clicks', currentData.clicks, previousData?.clicks || 0)}
                ${createTrendMetricCard('Impressions', currentData.impressions, previousData?.impressions || 0)}
                ${createTrendMetricCard('CTR', `${(currentData.ctr * 100).toFixed(1)}%`, `${((previousData?.ctr || 0) * 100).toFixed(1)}%`)}
                ${createTrendMetricCard('Position', currentData.position.toFixed(1), (previousData?.position || 0).toFixed(1))}
            `;
            
        } catch (error) {
            console.error('GSC trend error:', error);
            badge.textContent = '🔴 Error';
            badge.style.background = 'rgba(239, 68, 68, 0.2)';
            grid.innerHTML = createNoDataMessage('Failed to load search data');
        }
    }

    async function loadGA4Trends(tooltip, nodeData) {
        const badge = tooltip.querySelector('#ga4-connection-badge');
        const grid = tooltip.querySelector('#ga4-metrics-grid');
        
        try {
            badge.textContent = '🟢 Connected';
            badge.style.background = 'rgba(16, 185, 129, 0.2)';
            
            const currentData = await window.GA4Integration.fetchData(nodeData.url);
            
            if (!currentData || currentData.noDataFound) {
                grid.innerHTML = createNoDataMessage('No analytics data available');
                return;
            }
            
            // Simulate previous period data (you'll need to implement this in your GA4 integration)
            const previousData = await fetchPreviousPeriodGA4(nodeData.url);
            
            grid.innerHTML = `
                ${createTrendMetricCard('Users', currentData.users || 0, previousData?.users || 0)}
                ${createTrendMetricCard('Page Views', currentData.pageViews || 0, previousData?.pageViews || 0)}
                ${createTrendMetricCard('Sessions', currentData.sessions || 0, previousData?.sessions || 0)}
                ${createTrendMetricCard('Bounce Rate', `${((currentData.bounceRate || 0) * 100).toFixed(0)}%`, `${((previousData?.bounceRate || 0) * 100).toFixed(0)}%`)}
            `;
            
        } catch (error) {
            console.error('GA4 trend error:', error);
            badge.textContent = '🔴 Error';
            badge.style.background = 'rgba(239, 68, 68, 0.2)';
            grid.innerHTML = createNoDataMessage('Failed to load analytics data');
        }
    }

    function createNoDataMessage(message) {
        return `
            <div style="
                grid-column: 1 / -1; 
                text-align: center; 
                color: rgba(255,255,255,0.7); 
                padding: 20px;
                font-size: 0.8rem;
            ">
                📭 ${message}
                <div style="font-size: 0.7rem; margin-top: 4px; opacity: 0.7;">
                    This page may not have data for the selected period
                </div>
            </div>
        `;
    }

    function showGSCDisconnected(tooltip) {
        const badge = tooltip.querySelector('#gsc-connection-badge');
        const grid = tooltip.querySelector('#gsc-metrics-grid');
        
        badge.textContent = '🔴 Not Connected';
        badge.style.background = 'rgba(239, 68, 68, 0.2)';
        
        grid.innerHTML = `
            <div style="
                grid-column: 1 / -1; 
                text-align: center; 
                color: rgba(255,255,255,0.7); 
                padding: 20px;
                font-size: 0.8rem;
            ">
                🔌 Connect Search Console to see trends
                <div style="font-size: 0.7rem; margin-top: 4px; opacity: 0.7;">
                    Click the GSC button in the toolbar
                </div>
            </div>
        `;
    }

    function showGA4Disconnected(tooltip) {
        const badge = tooltip.querySelector('#ga4-connection-badge');
        const grid = tooltip.querySelector('#ga4-metrics-grid');
        
        badge.textContent = '🔴 Not Connected';
        badge.style.background = 'rgba(239, 68, 68, 0.2)';
        
        grid.innerHTML = `
            <div style="
                grid-column: 1 / -1; 
                text-align: center; 
                color: rgba(255,255,255,0.7); 
                padding: 20px;
                font-size: 0.8rem;
            ">
                🔌 Connect Google Analytics to see trends
                <div style="font-size: 0.7rem; margin-top: 4px; opacity: 0.7;">
                    Click the GA4 button in the toolbar
                </div>
            </div>
        `;
    }

    // Utility functions for period comparison (you'll need to implement these)
    async function fetchPreviousPeriodGSC(nodeData) {
        // This should fetch data from 60-30 days ago
        // You'll need to modify your GSC integration to support date ranges
        if (window.GSCIntegration.fetchNodeDataForPeriod) {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - 30);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 60);
            
            return await window.GSCIntegration.fetchNodeDataForPeriod(nodeData, startDate, endDate);
        }
        return null;
    }

    async function fetchPreviousPeriodGA4(url) {
        // This should fetch data from 60-30 days ago  
        // You'll need to modify your GA4 integration to support date ranges
        if (window.GA4Integration.fetchDataForPeriod) {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - 30);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 60);
            
            return await window.GA4Integration.fetchDataForPeriod(url, startDate, endDate);
        }
        return null;
    }

    function formatDisplayValue(value) {
        if (typeof value === 'string') return value;
        const num = parseFloat(value) || 0;
        
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        if (num < 1 && num > 0) return num.toFixed(2);
        return Math.round(num).toLocaleString();
    }

    // Enhanced behavior functions
    function clearTooltipTimers() {
        if (window.enhancedHideTimer) {
            clearTimeout(window.enhancedHideTimer);
            window.enhancedHideTimer = null;
        }
    }

    function hideExistingTooltip(currentData) {
        if (window.currentEnhancedTooltip) {
            const existingNodeName = window.currentEnhancedTooltip._nodeData?.name;
            if (existingNodeName !== currentData.name) {
                window.currentEnhancedTooltip.style.opacity = '0';
                window.currentEnhancedTooltip.style.transform = 'translateY(8px) scale(0.95)';
                setTimeout(() => {
                    if (window.currentEnhancedTooltip) {
                        window.currentEnhancedTooltip.remove();
                        window.currentEnhancedTooltip = null;
                    }
                }, 200);
            }
        }
    }

    function positionTooltip(tooltip, event) {
        let left = event.pageX + 20;
        let top = event.pageY - 60;
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        
        setTimeout(() => {
            const rect = tooltip.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            if (rect.right > windowWidth - 20) {
                tooltip.style.left = (event.pageX - rect.width - 20) + 'px';
            }
            
            if (rect.top < 10) {
                tooltip.style.top = (event.pageY + 20) + 'px';
            }
            
            if (rect.bottom > windowHeight - 20) {
                tooltip.style.top = Math.max(10, windowHeight - rect.height - 20) + 'px';
            }
        }, 10);
    }

    function addModernHoverBehavior(tooltip) {
        let isHovering = false;
        
        tooltip.addEventListener('mouseenter', () => {
            isHovering = true;
            clearTooltipTimers();
        });
        
        tooltip.addEventListener('mouseleave', () => {
            isHovering = false;
            hideModernTooltip();
        });
        
        tooltip.addEventListener('click', (e) => {
            const button = e.target.closest('.modern-action-btn');
            if (!button) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const action = button.dataset.action;
            const url = button.dataset.url;
            
            handleModernAction(action, url, tooltip);
        });
    }

    function hideModernTooltip(immediate = false) {
        const delay = immediate ? 0 : 200;
        
        window.enhancedHideTimer = setTimeout(() => {
            if (window.currentEnhancedTooltip) {
                window.currentEnhancedTooltip.style.opacity = '0';
                window.currentEnhancedTooltip.style.transform = 'translateY(8px) scale(0.95)';
                setTimeout(() => {
                    if (window.currentEnhancedTooltip) {
                        window.currentEnhancedTooltip.remove();
                        window.currentEnhancedTooltip = null;
                    }
                }, 200);
            }
        }, delay);
    }

    function handleModernAction(action, url, tooltip) {
        console.log('🎯 Modern action:', action);
        
        switch (action) {
            case 'visit':
                if (url && url !== 'undefined') {
                    window.open(url, '_blank');
                }
                break;
            case 'refresh':
                if (tooltip && tooltip._nodeData) {
                    loadTrendAnalytics(tooltip, tooltip._nodeData);
                }
                break;
            case 'detailed':
                if (window.showDetailedGSCAnalysis && url && url !== 'undefined') {
                    window.showDetailedGSCAnalysis(url);
                }
                break;
        }
    }

    // Safe fallback functions (keeping your existing logic)
    function getPageInfoSafe(data) {
        // Use your existing getPageInfo logic or fallback
        return {
            type: 'Content Page',
            depth: 1,
            children: 0,
            siblings: 0
        };
    }

    function getFreshnessInfoSafe(data) {
        // Use your existing getFreshnessInfo logic or fallback
        return {
            badge: '<span style="background: #64748b; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">No Date</span>'
        };
    }

    // Install the modern tooltip system
    function installModernTooltipSystem() {
        console.log('✅ Installing modern tooltip system with trends...');
        
        window.showEnhancedTooltip = modernTooltipFunction;
        window.hideEnhancedTooltip = hideModernTooltip;
        
        console.log('🎯 Modern tooltip with trend analysis installed!');
    }

    // Initialize
    function initModernTooltips() {
        let attempts = 0;
        const checkReady = () => {
            attempts++;
            const gscReady = !!window.GSCIntegration;
            const ga4Ready = !!window.GA4Integration;
            
            if ((gscReady || ga4Ready) || attempts >= 50) {
                installModernTooltipSystem();
            } else {
                setTimeout(checkReady, 200);
            }
        };
        checkReady();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModernTooltips);
    } else {
        initModernTooltips();
    }

    console.log('🚀 Modern tooltip with trend analysis loaded!');

})();
