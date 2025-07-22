// combined-tooltip-integration-enhanced.js - COMPLETE ENHANCED VERSION
// Features: hover behavior, trends, loading indicators, modern design

(function() {
    console.log('🚀 Loading enhanced combined tooltip integration with trends...');

    // The enhanced tooltip function with stable behavior and trends
    const enhancedTooltipFunction = function(event, d) {
        console.log('🎯 Enhanced tooltip for:', d.data?.name);
        
        if (!d.data) {
            console.warn('⚠️ No data provided to tooltip');
            return;
        }

        // Clear any existing hide timers
        if (window.enhancedHideTimer) {
            clearTimeout(window.enhancedHideTimer);
            window.enhancedHideTimer = null;
        }

        // Only hide existing tooltip if it's for a different node
        if (window.currentEnhancedTooltip) {
            const existingNodeName = window.currentEnhancedTooltip._nodeData?.name;
            if (existingNodeName !== d.data.name) {
                window.currentEnhancedTooltip.remove();
                window.currentEnhancedTooltip = null;
            } else {
                // Same node, don't recreate
                return;
            }
        }

        // Create enhanced tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'enhanced-tooltip refined-combined-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            padding: 0;
            box-shadow: 0 12px 28px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 440px;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.2s ease;
            transform: translateY(5px);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            line-height: 1.4;
            overflow: hidden;
            pointer-events: auto;
        `;

        // Create enhanced content
        tooltip.innerHTML = createEnhancedContent(d.data);

        // Position tooltip AWAY from cursor to avoid interference
        positionEnhancedTooltip(tooltip, event);

        // Add to DOM
        document.body.appendChild(tooltip);
        window.currentEnhancedTooltip = tooltip;
        tooltip._nodeData = d.data;

        // Show with animation after positioning
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateY(0)';
            }
        }, 50);

        // Stable hover behavior - no immediate hiding
        addStableHoverBehavior(tooltip);

        // Load analytics data with trends
        loadEnhancedAnalyticsData(tooltip, d.data);
    };

    // Create enhanced content with loading states
    function createEnhancedContent(data) {
        // Safely get page info - with fallbacks for undefined
        const pageInfo = getPageInfoSafe(data);
        const freshnessInfo = getFreshnessInfoSafe(data);

        return `
            <!-- Compact Page Header -->
            <div style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0; background: linear-gradient(135deg, #fafbfc 0%, #f8f9fa 100%);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px;">
                    <h4 style="margin: 0; color: #1a1a1a; font-size: 0.95rem; font-weight: 600; flex: 1; line-height: 1.3;">
                        ${data.name || 'Page'}
                    </h4>
                    ${freshnessInfo.badge}
                </div>
                
                ${data.url ? `
                    <a href="${data.url}" target="_blank" 
                       style="font-size: 0.75rem; color: #0066cc; text-decoration: none; word-break: break-all; 
                              display: block; margin-bottom: 6px;" 
                       onmouseover="this.style.textDecoration='underline'" 
                       onmouseout="this.style.textDecoration='none'">
                        ${data.url}
                    </a>
                ` : ''}
                
                <!-- Enhanced Page Info with Siblings -->
                <div style="display: flex; gap: 12px; font-size: 0.7rem; color: #666; margin-top: 8px; flex-wrap: wrap;">
                    <span title="Page type based on content and hierarchy">Type: ${pageInfo.type}</span>
                    <span title="Depth in site hierarchy">Level: ${pageInfo.depth}</span>
                    <span title="Number of child pages" style="color: ${pageInfo.children > 0 ? '#4caf50' : '#999'};">Children: ${pageInfo.children}</span>
                    <span title="Pages at the same level with same parent" style="color: ${pageInfo.siblings > 0 ? '#2196f3' : '#999'};">Siblings: ${pageInfo.siblings}</span>
                    ${freshnessInfo.text ? `<span title="Last modified date">Last Edited: ${freshnessInfo.text}</span>` : ''}
                </div>
                
                ${freshnessInfo.daysSince !== null ? `
                    <div style="background: ${freshnessInfo.freshnessColor}15; border: 1px solid ${freshnessInfo.freshnessColor}40; border-radius: 6px; padding: 6px 8px; margin-top: 8px; font-size: 0.7rem;">
                        <span style="color: ${freshnessInfo.freshnessColor}; font-weight: 600;">Content Age:</span>
                        <span style="color: #333; margin-left: 4px;">${freshnessInfo.daysSince} days old</span>
                        ${freshnessInfo.daysSince > 365 ? '<span style="color: #666; margin-left: 4px;">⚠️ Consider updating</span>' : ''}
                    </div>
                ` : ''}
            </div>

            <!-- Enhanced Analytics Section -->
            <div style="padding: 16px;">
                
                <!-- Search Console Card with Loading -->
                <div id="enhanced-gsc-card" style="background: linear-gradient(135deg, #f8f9ff 0%, #e8f2ff 100%); border: 1px solid #e3f2fd; border-radius: 8px; padding: 12px; margin-bottom: 12px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 0.9rem;">🔍</span>
                            <span style="font-size: 0.85rem; font-weight: 600; color: #1565c0;">Search Console</span>
                            <span style="font-size: 0.7rem; color: #999; background: white; padding: 1px 4px; border-radius: 4px;">30d vs 30d</span>
                        </div>
                        <span id="enhanced-gsc-status" style="font-size: 0.7rem; color: #666; background: #fff; padding: 2px 6px; border-radius: 8px; border: 1px solid #e0e0e0;">
                            Loading...
                        </span>
                    </div>
                    
                    <!-- Loading Progress Bar -->
                    <div id="enhanced-gsc-progress" style="width: 100%; height: 3px; background: #f0f0f0; border-radius: 2px; overflow: hidden; margin-bottom: 8px;">
                        <div class="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #1565c0, #42a5f5); border-radius: 2px; transition: width 0.3s ease;"></div>
                    </div>
                    
                    <div id="enhanced-gsc-content">
                        <div style="text-align: center; color: #666; padding: 12px;">
                            <div class="loading-pulse" style="display: inline-block; margin-bottom: 8px;">⏳</div>
                            <div>Loading search data...</div>
                        </div>
                    </div>
                </div>
                
                <!-- Google Analytics Card with Loading -->
                <div id="enhanced-ga4-card" style="background: linear-gradient(135deg, #fff8e1 0%, #fff3c4 100%); border: 1px solid #ffecb3; border-radius: 8px; padding: 12px; margin-bottom: 12px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 0.9rem;">📈</span>
                            <span style="font-size: 0.85rem; font-weight: 600; color: #f57c00;">Google Analytics</span>
                            <span style="font-size: 0.7rem; color: #999; background: white; padding: 1px 4px; border-radius: 4px;">30d vs 30d</span>
                        </div>
                        <span id="enhanced-ga4-status" style="font-size: 0.7rem; color: #666; background: #fff; padding: 2px 6px; border-radius: 8px; border: 1px solid #e0e0e0;">
                            Loading...
                        </span>
                    </div>
                    
                    <!-- Loading Progress Bar -->
                    <div id="enhanced-ga4-progress" style="width: 100%; height: 3px; background: #f0f0f0; border-radius: 2px; overflow: hidden; margin-bottom: 8px;">
                        <div class="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #f57c00, #ffa726); border-radius: 2px; transition: width 0.3s ease;"></div>
                    </div>
                    
                    <div id="enhanced-ga4-content">
                        <div style="text-align: center; color: #666; padding: 12px;">
                            <div class="loading-pulse" style="display: inline-block; margin-bottom: 8px;">📊</div>
                            <div>Loading analytics data...</div>
                        </div>
                    </div>
                </div>
                
                <!-- Enhanced Action Buttons -->
                <div style="display: flex; gap: 6px; margin-top: 12px;">
                    <button class="enhanced-btn enhanced-btn-primary" data-action="visit" data-url="${data.url}">
                        🔗 Visit Page
                    </button>
                    <button class="enhanced-btn enhanced-btn-secondary" data-action="refresh">
                        🔄 Refresh Data
                    </button>
                    <button class="enhanced-btn enhanced-btn-secondary" data-action="detailed" data-url="${data.url}">
                        📊 Full Report
                    </button>
                </div>
            </div>

            <style>
                .enhanced-btn {
                    border: none;
                    padding: 7px 12px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                }
                
                .enhanced-btn-primary {
                    background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%);
                    color: white;
                    box-shadow: 0 2px 4px rgba(21, 101, 192, 0.3);
                }
                
                .enhanced-btn-primary:hover {
                    background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(21, 101, 192, 0.4);
                }
                
                .enhanced-btn-secondary {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    color: #666;
                    border: 1px solid #e0e0e0;
                }
                
                .enhanced-btn-secondary:hover {
                    background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
                    transform: translateY(-1px);
                    color: #495057;
                }
                
                .loading-pulse {
                    animation: pulse 1.5s ease-in-out infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                .progress-bar {
                    animation: progress-indeterminate 2s ease-in-out infinite;
                }
                
                @keyframes progress-indeterminate {
                    0% { width: 0%; margin-left: 0%; }
                    50% { width: 70%; margin-left: 15%; }
                    100% { width: 0%; margin-left: 100%; }
                }
            </style>
        `;
    }

    // Enhanced GSC display with trends and loading states
    function createTrendingGSCDisplay(gscData, gscTrends = null) {
        return `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                ${createTrendMetricCard('Clicks', gscData.clicks, gscTrends?.clicks, '#1565c0')}
                ${createTrendMetricCard('Impressions', gscData.impressions, gscTrends?.impressions, '#1565c0')}
                ${createTrendMetricCard('CTR', `${(gscData.ctr * 100).toFixed(1)}%`, gscTrends?.ctr, '#1565c0')}
                ${createTrendMetricCard('Position', `#${gscData.position.toFixed(0)}`, gscTrends?.position, '#1565c0', true)}
            </div>
            
            <!-- Period Comparison Summary -->
            ${gscTrends ? `
                <div style="background: linear-gradient(135deg, #f8f9ff 0%, #e3f2fd 100%); 
                            padding: 8px 10px; border-radius: 8px; margin-top: 8px; 
                            border: 1px solid #e3f2fd;">
                    <div style="font-size: 0.7rem; color: #1565c0; font-weight: 600; margin-bottom: 4px;">
                        📊 Trend Summary
                    </div>
                    <div style="font-size: 0.7rem; color: #666;">
                        ${generateTrendSummary(gscTrends)}
                    </div>
                </div>
            ` : ''}
            
            <!-- Top Keywords with trend indicators -->
            ${gscData.topQueries && gscData.topQueries.length > 0 ? `
                <div style="background: white; padding: 8px; border-radius: 6px; 
                            border: 1px solid #e3f2fd; margin-top: 8px;">
                    <div style="font-size: 0.75rem; font-weight: 600; color: #1565c0; margin-bottom: 6px;">
                        🔍 Top Keywords:
                    </div>
                    ${gscData.topQueries.slice(0, 3).map((query, index) => `
                        <div style="font-size: 0.7rem; margin-bottom: 4px; 
                                    padding: 4px 6px; background: #fafbfc; border-radius: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 500; color: #333; flex: 1; 
                                             white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    "${escapeHtml(query.query)}"
                                </span>
                                ${query.trend ? createMiniTrend(query.trend) : ''}
                            </div>
                            <div style="color: #666; font-size: 0.65rem; margin-top: 2px;">
                                ${query.clicks} clicks • #${query.position.toFixed(0)} avg position
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    }

    // Enhanced GA4 display with trends
    function createTrendingGA4Display(ga4Data, ga4Trends = null) {
        return `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                ${createTrendMetricCard('Users', ga4Data.users || 0, ga4Trends?.users, '#f57c00')}
                ${createTrendMetricCard('Page Views', ga4Data.pageViews || 0, ga4Trends?.pageViews, '#f57c00')}
                ${createTrendMetricCard('Sessions', ga4Data.sessions || 0, ga4Trends?.sessions, '#f57c00')}
                ${createTrendMetricCard('Engagement', `${((ga4Data.engagementRate || 0) * 100).toFixed(0)}%`, ga4Trends?.engagementRate, '#f57c00')}
            </div>
            
            <!-- GA4 Insights -->
            ${ga4Trends ? `
                <div style="background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); 
                            padding: 8px 10px; border-radius: 8px; margin-top: 8px; 
                            border: 1px solid #ffecb3;">
                    <div style="font-size: 0.7rem; color: #f57c00; font-weight: 600; margin-bottom: 4px;">
                        📈 Performance Insights
                    </div>
                    <div style="font-size: 0.7rem; color: #666;">
                        ${generateGA4Insights(ga4Data, ga4Trends)}
                    </div>
                </div>
            ` : ''}
        `;
    }

    // Create a trend metric card with visual indicators
    function createTrendMetricCard(label, value, trend, color, inverted = false) {
        const trendElement = trend ? createTrendIndicator(trend, inverted) : '';
        const sparkline = trend?.sparkline ? createMiniSparkline(trend.sparkline, color) : '';
        
        return `
            <div style="text-align: center; background: white; padding: 8px; 
                        border-radius: 6px; border: 1px solid ${color}30; 
                        position: relative; overflow: hidden;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                
                <!-- Subtle background pattern for trending metrics -->
                ${trend && Math.abs(trend.percentChange) > 10 ? `
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                                background: linear-gradient(135deg, ${color}05 0%, transparent 50%); 
                                pointer-events: none;"></div>
                ` : ''}
                
                <div style="position: relative; z-index: 1;">
                    <div style="display: flex; align-items: center; justify-content: center; 
                                gap: 4px; margin-bottom: 2px;">
                        <span style="font-size: 1.1rem; font-weight: 600; color: ${color};">
                            ${formatNumber(value)}
                        </span>
                        ${trendElement}
                    </div>
                    
                    <!-- Mini sparkline -->
                    ${sparkline}
                    
                    <div style="font-size: 0.7rem; color: #666; margin-top: ${sparkline ? '4px' : '0'};">
                        ${label}
                    </div>
                </div>
            </div>
        `;
    }

    // Create trend indicator with arrow and percentage
    function createTrendIndicator(trend, inverted = false) {
        if (!trend || trend.percentChange === undefined) return '';
        
        const change = trend.percentChange;
        const absChange = Math.abs(change);
        
        // For metrics like position, down is better (inverted)
        const isPositive = inverted ? change < 0 : change > 0;
        const isNegative = inverted ? change > 0 : change < 0;
        
        let color, arrow, bgColor;
        
        if (absChange < 2) {
            color = '#666';
            arrow = '→';
            bgColor = '#f5f5f5';
        } else if (isPositive) {
            color = '#4caf50';
            arrow = '↗';
            bgColor = '#e8f5e8';
        } else if (isNegative) {
            color = '#f44336';
            arrow = '↘';
            bgColor = '#ffeaea';
        }
        
        return `
            <span style="font-size: 0.7rem; color: ${color}; background: ${bgColor}; 
                         padding: 1px 4px; border-radius: 4px; font-weight: 600;
                         box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                ${arrow}${absChange.toFixed(0)}%
            </span>
        `;
    }

    // Create mini sparkline (simple SVG)
    function createMiniSparkline(dataPoints, color) {
        if (!dataPoints || dataPoints.length < 2) return '';
        
        const width = 40;
        const height = 12;
        const max = Math.max(...dataPoints);
        const min = Math.min(...dataPoints);
        const range = max - min || 1;
        
        const points = dataPoints.map((value, index) => {
            const x = (index / (dataPoints.length - 1)) * width;
            const y = height - ((value - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');
        
        return `
            <svg width="${width}" height="${height}" style="margin: 2px 0;">
                <polyline points="${points}" 
                         fill="none" 
                         stroke="${color}60" 
                         stroke-width="1.5" 
                         stroke-linecap="round"/>
            </svg>
        `;
    }

    // Create mini trend for keywords
    function createMiniTrend(trend) {
        if (!trend) return '';
        
        const change = trend.percentChange || 0;
        let color, arrow;
        
        if (Math.abs(change) < 2) {
            color = '#666';
            arrow = '→';
        } else if (change > 0) {
            color = '#4caf50';
            arrow = '↗';
        } else {
            color = '#f44336';
            arrow = '↘';
        }
        
        return `
            <span style="font-size: 0.65rem; color: ${color}; font-weight: 600;">
                ${arrow}${Math.abs(change).toFixed(0)}%
            </span>
        `;
    }

    // Generate trend summary text
    function generateTrendSummary(trends) {
        const summaries = [];
        
        if (trends.clicks?.percentChange > 5) {
            summaries.push('📈 Strong click growth');
        } else if (trends.clicks?.percentChange < -5) {
            summaries.push('📉 Declining clicks');
        }
        
        if (trends.position?.percentChange < -2) { // Position improvement
            summaries.push('🚀 Rising in rankings');
        } else if (trends.position?.percentChange > 5) {
            summaries.push('⚠️ Dropping in rankings');
        }
        
        if (trends.ctr?.percentChange > 10) {
            summaries.push('🎯 CTR improving');
        }
        
        return summaries.length > 0 ? summaries.join(' • ') : 'Steady performance across metrics';
    }

    // Generate GA4 insights
    function generateGA4Insights(currentData, trends) {
        const insights = [];
        
        // Traffic insights
        if (trends.users?.percentChange > 15) {
            insights.push('🔥 User growth accelerating');
        } else if (trends.users?.percentChange < -15) {
            insights.push('⚠️ User decline detected');
        }
        
        // Engagement insights
        if (trends.engagementRate?.percentChange > 20) {
            insights.push('💎 Engagement significantly up');
        } else if (trends.engagementRate?.percentChange < -20) {
            insights.push('📱 Engagement needs attention');
        }
        
        // Session quality
        const pagesPerSession = (currentData.pageViews || 0) / (currentData.sessions || 1);
        if (pagesPerSession > 2) {
            insights.push('📖 Good session depth');
        }
        
        return insights.length > 0 ? insights.join(' • ') : 'Performance within normal range';
    }

    // Enhanced analytics loading with progress indicators
    async function loadEnhancedAnalyticsData(tooltip, nodeData) {
        console.log('📊 Loading enhanced analytics with trends for:', nodeData.name);
        
        const gscContent = tooltip.querySelector('#enhanced-gsc-content');
        const ga4Content = tooltip.querySelector('#enhanced-ga4-content');
        const gscStatus = tooltip.querySelector('#enhanced-gsc-status');
        const ga4Status = tooltip.querySelector('#enhanced-ga4-status');
        const gscProgress = tooltip.querySelector('#enhanced-gsc-progress .progress-bar');
        const ga4Progress = tooltip.querySelector('#enhanced-ga4-progress .progress-bar');
        
        // Animate progress bars
        const animateProgress = (progressBar, duration = 2000) => {
            if (!progressBar) return;
            
            let start = 0;
            const increment = 100 / (duration / 50);
            
            const animate = () => {
                start += increment;
                if (start <= 90) {
                    progressBar.style.width = start + '%';
                    setTimeout(animate, 50);
                }
            };
            animate();
        };

        // Load Search Console data with trends and progress
        if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
            gscStatus.textContent = '🟢 Connected';
            gscStatus.style.color = '#4caf50';
            
            // Start progress animation
            animateProgress(gscProgress);
            
            try {
                // Show loading states
                gscContent.innerHTML = `
                    <div style="text-align: center; color: #666; padding: 12px;">
                        <div class="loading-pulse" style="display: inline-block; margin-bottom: 8px;">⏳</div>
                        <div>Fetching search console data...</div>
                        <div style="font-size: 0.7rem; margin-top: 4px; color: #999;">Including trend analysis</div>
                    </div>
                `;
                
                // Fetch current and trend data
                const [gscData, gscTrends] = await Promise.all([
                    window.GSCIntegration.fetchNodeData(nodeData),
                    window.GSCIntegration.fetchTrendData ? window.GSCIntegration.fetchTrendData(nodeData) : null
                ]);
                
                // Complete progress
                if (gscProgress) {
                    gscProgress.style.width = '100%';
                    setTimeout(() => {
                        const progressContainer = tooltip.querySelector('#enhanced-gsc-progress');
                        if (progressContainer) progressContainer.style.display = 'none';
                    }, 300);
                }
                
                if (gscData && !gscData.noDataFound && !gscData.error) {
                    gscContent.innerHTML = createTrendingGSCDisplay(gscData, gscTrends);
                } else {
                    gscContent.innerHTML = `
                        <div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">
                            📭 No search data available
                            <div style="font-size: 0.7rem; margin-top: 4px;">This page may not have search visibility yet</div>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('❌ GSC error:', error);
                gscStatus.textContent = '🔴 Error';
                gscStatus.style.color = '#f44336';
                
                // Hide progress bar
                const progressContainer = tooltip.querySelector('#enhanced-gsc-progress');
                if (progressContainer) progressContainer.style.display = 'none';
                
                gscContent.innerHTML = `
                    <div style="text-align: center; color: #f44336; padding: 10px; font-size: 0.8rem;">
                        ❌ Failed to load data
                        <div style="font-size: 0.7rem; margin-top: 4px; color: #999;">Check console for details</div>
                    </div>
                `;
            }
        } else {
            gscStatus.textContent = '🔴 Not Connected';
            gscStatus.style.color = '#f44336';
            
            // Hide progress bar
            const progressContainer = tooltip.querySelector('#enhanced-gsc-progress');
            if (progressContainer) progressContainer.style.display = 'none';
            
            gscContent.innerHTML = `
                <div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">
                    🔌 Search Console not connected
                    <div style="font-size: 0.7rem; margin-top: 4px;">Connect to see search performance</div>
                </div>
            `;
        }
        
        // Load GA4 data with trends and progress
        if (window.GA4Integration && window.GA4Integration.isConnected()) {
            ga4Status.textContent = '🟢 Connected';
            ga4Status.style.color = '#4caf50';
            
            // Start progress animation
            animateProgress(ga4Progress);
            
            try {
                // Show loading states
                ga4Content.innerHTML = `
                    <div style="text-align: center; color: #666; padding: 12px;">
                        <div class="loading-pulse" style="display: inline-block; margin-bottom: 8px;">📊</div>
                        <div>Fetching analytics data...</div>
                        <div style="font-size: 0.7rem; margin-top: 4px; color: #999;">Including trend comparison</div>
                    </div>
                `;
                
                const [ga4Data, ga4Trends] = await Promise.all([
                    window.GA4Integration.fetchData(nodeData.url),
                    window.GA4Integration.fetchTrendData ? window.GA4Integration.fetchTrendData(nodeData.url) : null
                ]);
                
                // Complete progress
                if (ga4Progress) {
                    ga4Progress.style.width = '100%';
                    setTimeout(() => {
                        const progressContainer = tooltip.querySelector('#enhanced-ga4-progress');
                        if (progressContainer) progressContainer.style.display = 'none';
                    }, 300);
                }
                
                if (ga4Data && !ga4Data.noDataFound && !ga4Data.error) {
                    ga4Content.innerHTML = createTrendingGA4Display(ga4Data, ga4Trends);
                } else {
                    ga4Content.innerHTML = `
                        <div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">
                            📭 No analytics data available
                            <div style="font-size: 0.7rem; margin-top: 4px;">This page may not have traffic yet</div>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('❌ GA4 error:', error);
                ga4Status.textContent = '🔴 Error';
                ga4Status.style.color = '#f44336';
                
                // Hide progress bar
                const progressContainer = tooltip.querySelector('#enhanced-ga4-progress');
                if (progressContainer) progressContainer.style.display = 'none';
                
                ga4Content.innerHTML = `
                    <div style="text-align: center; color: #f44336; padding: 10px; font-size: 0.8rem;">
                        ❌ Failed to load data
                        <div style="font-size: 0.7rem; margin-top: 4px; color: #999;">Check console for details</div>
                    </div>
                `;
            }
        } else {
            ga4Status.textContent = '🔴 Not Connected';
            ga4Status.style.color = '#f44336';
            
            // Hide progress bar
            const progressContainer = tooltip.querySelector('#enhanced-ga4-progress');
            if (progressContainer) progressContainer.style.display = 'none';
            
            ga4Content.innerHTML = `
                <div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">
                    🔌 Google Analytics not connected
                    <div style="font-size: 0.7rem; margin-top: 4px;">Connect to see user behavior</div>
                </div>
            `;
        }
    }

    // Enhanced page info function with better siblings calculation
    function getPageInfoSafe(data) {
        let pageInfo = {
            type: 'Page',
            depth: 0,
            children: 0,
            siblings: 0
        };

        try {
            // Try to use existing function if available
            if (typeof getPageInfo === 'function') {
                const treeContext = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
                const result = getPageInfo(data, treeContext);
                if (result && typeof result === 'object') {
                    pageInfo = { ...pageInfo, ...result };
                    return pageInfo;
                }
            }

            // Enhanced fallback: calculate from tree data
            const treeContext = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
            if (treeContext && data.url) {
                const nodeInfo = findNodeInTreeStructure(treeContext, data.url);
                if (nodeInfo.found) {
                    pageInfo = {
                        type: determinePageType(nodeInfo.node, nodeInfo.depth, nodeInfo.hasChildren),
                        depth: nodeInfo.depth,
                        children: nodeInfo.children,
                        siblings: nodeInfo.siblings
                    };
                    return pageInfo;
                }
            }

            // Basic fallback: calculate from URL and data
            if (data.children) {
                pageInfo.children = data.children.length;
            }
            
            if (data.url) {
                // Simple depth calculation
                const pathSegments = data.url.split('/').filter(segment => segment.length > 0);
                pageInfo.depth = Math.max(0, pathSegments.length - 2); // Subtract domain parts
                
                // Simple type detection
                if (pageInfo.children > 0) {
                    pageInfo.type = pageInfo.depth <= 1 ? 'Category' : 'Sub-Category';
                } else {
                    pageInfo.type = 'Content Page';
                }
            }

        } catch (error) {
            console.warn('Error getting page info:', error);
        }

        return pageInfo;
    }

    // Find node in tree structure and calculate siblings
    function findNodeInTreeStructure(treeData, targetUrl) {
        const result = {
            found: false,
            node: null,
            depth: 0,
            children: 0,
            siblings: 0,
            hasChildren: false
        };

        function traverse(node, depth = 0, parent = null, siblingNodes = []) {
            if (node.url === targetUrl) {
                result.found = true;
                result.node = node;
                result.depth = depth;
                result.children = node.children ? node.children.length : 0;
                result.hasChildren = result.children > 0;
                
                // Calculate siblings: nodes at same level with same parent (excluding self)
                result.siblings = Math.max(0, siblingNodes.length - 1);
                
                return true;
            }

            // Continue traversing children
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    if (traverse(child, depth + 1, node, node.children)) {
                        return true;
                    }
                }
            }

            return false;
        }

        // Start traversal - root node has no siblings
        if (treeData.url === targetUrl) {
            result.found = true;
            result.node = treeData;
            result.depth = 0;
            result.children = treeData.children ? treeData.children.length : 0;
            result.siblings = 0; // Root has no siblings
            result.hasChildren = result.children > 0;
        } else {
            traverse(treeData, 0, null, [treeData]);
        }

        return result;
    }

    // Enhanced page type determination
    function determinePageType(node, depth, hasChildren) {
        // Root page
        if (depth === 0) {
            return 'Homepage';
        }

        // Check if this is a language root (common pattern)
        if (node.url && node.url.match(/\/(en|ga|ie)\/?$/)) {
            return 'Language Root';
        }

        // Determine type based on depth and children
        if (hasChildren) {
            if (depth === 1) return 'Main Category';
            if (depth === 2) return 'Sub-Category';
            if (depth === 3) return 'Section';
            return 'Category';
        } else {
            if (depth === 1) return 'Root Page';
            if (depth === 2) return 'Content Page';
            if (depth >= 3) return 'Content Page';
            return 'Content Page';
        }
    }

    // Enhanced freshness info function with exact color logic
    function getFreshnessInfoSafe(data) {
        let result = {
            badge: '',
            text: '',
            daysSince: null
        };

        try {
            // Try existing function first
            if (typeof getFreshnessInfo === 'function' && data.lastModified) {
                const freshnessData = getFreshnessInfo(data.lastModified);
                if (freshnessData && freshnessData.freshnessLabel) {
                    result.badge = `<span style="background: ${freshnessData.freshnessColor}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">${freshnessData.freshnessLabel}</span>`;
                    result.text = freshnessData.formattedDate;
                    result.daysSince = freshnessData.daysSince;
                    result.freshnessColor = freshnessData.freshnessColor;
                    return result;
                }
            }

            // Enhanced fallback with exact color logic
            if (data.lastModified) {
                let lastModified;
                
                // Try different date formats
                if (typeof data.lastModified === 'string') {
                    lastModified = new Date(data.lastModified);
                } else if (data.lastModified instanceof Date) {
                    lastModified = data.lastModified;
                } else {
                    return result; // Can't parse date
                }

                // Check if date is valid
                if (isNaN(lastModified.getTime())) {
                    return result;
                }

                // Calculate days since last modified
                const now = new Date();
                const daysSince = Math.floor((now - lastModified) / (1000 * 60 * 60 * 24));
                
                let freshnessClass, freshnessLabel, freshnessColor;
                
                // Exact freshness logic
                if (daysSince < 30) {
                    freshnessClass = 'new';
                    freshnessLabel = 'New';
                    freshnessColor = '#4caf50'; // Green
                } else if (daysSince < 90) {
                    freshnessClass = 'fresh';
                    freshnessLabel = 'Fresh';
                    freshnessColor = '#4caf50'; // Green
                } else if (daysSince < 180) {
                    freshnessClass = 'recent';
                    freshnessLabel = 'Recent';
                    freshnessColor = '#ffc107'; // Yellow
                } else if (daysSince < 365) {
                    freshnessClass = 'aging';
                    freshnessLabel = 'Aging';
                    freshnessColor = '#ff9800'; // Orange
                } else if (daysSince < 730) {
                    freshnessClass = 'old';
                    freshnessLabel = 'Old';
                    freshnessColor = '#f44336'; // Red
                } else {
                    freshnessClass = 'stale';
                    freshnessLabel = 'Stale';
                    freshnessColor = '#d32f2f'; // Dark Red
                }

                // Format the date nicely
                const formattedDate = lastModified.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                // Create relative time string
                const relativeTime = daysSince === 0 ? 'today' :
                                   daysSince === 1 ? 'yesterday' :
                                   daysSince < 7 ? `${daysSince} days ago` :
                                   daysSince < 30 ? `${Math.floor(daysSince / 7)} weeks ago` :
                                   daysSince < 365 ? `${Math.floor(daysSince / 30)} months ago` :
                                   `${Math.floor(daysSince / 365)} years ago`;

                result.badge = `<span style="background: ${freshnessColor}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">${freshnessLabel}</span>`;
                result.text = `${formattedDate} (${relativeTime})`;
                result.daysSince = daysSince;
                result.freshnessClass = freshnessClass;
                result.freshnessColor = freshnessColor;
            }
        } catch (error) {
            console.warn('Error getting freshness info:', error);
        }

        return result;
    }

    // Stable hide function - longer delays, better control
    function hideEnhancedTooltip(immediate = false) {
        if (window.enhancedHideTimer) {
            clearTimeout(window.enhancedHideTimer);
        }
        
        const delay = immediate ? 0 : 300; // Longer delay to prevent flashing
        
        window.enhancedHideTimer = setTimeout(() => {
            if (window.currentEnhancedTooltip) {
                window.currentEnhancedTooltip.style.opacity = '0';
                window.currentEnhancedTooltip.style.transform = 'translateY(5px)';
                setTimeout(() => {
                    if (window.currentEnhancedTooltip) {
                        window.currentEnhancedTooltip.remove();
                        window.currentEnhancedTooltip = null;
                    }
                }, 300);
            }
        }, delay);
    }

    // Stable hover behavior - prevents flickering
    function addStableHoverBehavior(tooltip) {
        // Tooltip hover events
        tooltip.addEventListener('mouseenter', () => {
            // Cancel any pending hide when entering tooltip
            if (window.enhancedHideTimer) {
                clearTimeout(window.enhancedHideTimer);
                window.enhancedHideTimer = null;
            }
        });
        
        tooltip.addEventListener('mouseleave', () => {
            // Start hide timer when leaving tooltip
            hideEnhancedTooltip();
        });
        
        // Button clicks using event delegation
        tooltip.addEventListener('click', (e) => {
            const button = e.target.closest('.enhanced-btn');
            if (!button) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const action = button.dataset.action;
            const url = button.dataset.url;
            
            console.log('🎯 Button clicked:', action);
            
            switch (action) {
                case 'visit':
                    if (url && url !== 'undefined') {
                        window.open(url, '_blank');
                    }
                    break;
                case 'refresh':
                    if (window.currentEnhancedTooltip && window.currentEnhancedTooltip._nodeData) {
                        loadEnhancedAnalyticsData(window.currentEnhancedTooltip, window.currentEnhancedTooltip._nodeData);
                    }
                    break;
                case 'detailed':
                    if (window.showDetailedGSCAnalysis && url && url !== 'undefined') {
                        window.showDetailedGSCAnalysis(url);
                    }
                    break;
            }
        });
    }

    // Position tooltip AWAY from cursor to prevent interference
    function positionEnhancedTooltip(tooltip, event) {
        // Position further away from cursor to avoid hover conflicts
        let left = event.pageX + 25; // Increased distance
        let top = event.pageY - 50;  // Position above cursor
        
        // Initial position
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        
        // Adjust after render to ensure visibility
        setTimeout(() => {
            const rect = tooltip.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // Horizontal adjustment - ensure tooltip doesn't go off screen
            if (rect.right > windowWidth - 20) {
                tooltip.style.left = (event.pageX - rect.width - 25) + 'px';
            }
            
            // Vertical adjustment - keep tooltip visible
            if (rect.top < 10) {
                tooltip.style.top = (event.pageY + 25) + 'px'; // Position below if above doesn't fit
            }
            
            if (rect.bottom > windowHeight - 20) {
                tooltip.style.top = Math.max(10, windowHeight - rect.height - 20) + 'px';
            }
            
            // Final safety check - ensure never off screen
            const finalRect = tooltip.getBoundingClientRect();
            if (finalRect.left < 10) {
                tooltip.style.left = '10px';
            }
        }, 10);
    }

    // Utility functions
    function formatNumber(value) {
        if (typeof value === 'string' && (value.includes('%') || value.includes('#'))) return value;
        
        const num = parseInt(value) || 0;
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Install enhanced tooltip system
    function installEnhancedTooltipSystem() {
        console.log('✅ Installing enhanced tooltip system with trends...');
        
        // Install main functions
        window.showEnhancedTooltip = enhancedTooltipFunction;
        
        // Override the existing hideEnhancedTooltip to work with our system
        const originalHide = window.hideEnhancedTooltip;
        window.hideEnhancedTooltip = function() {
            // Use our stable hide function
            hideEnhancedTooltip();
        };
        
        console.log('🎯 Enhanced tooltip functions installed with trend support');

        // Monitor for interference
        let checkCount = 0;
        const monitorInterval = setInterval(() => {
            checkCount++;
            
            if (window.showEnhancedTooltip !== enhancedTooltipFunction) {
                console.log('🔄 Show function overridden, reinstalling...');
                window.showEnhancedTooltip = enhancedTooltipFunction;
            }
            
            if (window.hideEnhancedTooltip !== hideEnhancedTooltip) {
                console.log('🔄 Hide function overridden, reinstalling...');
                window.hideEnhancedTooltip = hideEnhancedTooltip;
            }
            
            // Stop monitoring after 30 seconds
            if (checkCount > 150) {
                clearInterval(monitorInterval);
                console.log('✅ Enhanced tooltip monitoring complete');
            }
        }, 200);
    }

    // Wait for integrations and install
    function waitAndInstallEnhanced() {
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkReady = () => {
            attempts++;
            const gscReady = !!window.GSCIntegration;
            const ga4Ready = !!window.GA4Integration;
            
            if (gscReady && ga4Ready) {
                console.log('✅ Both integrations ready - installing enhanced tooltips with trends');
                installEnhancedTooltipSystem();
            } else if (attempts >= maxAttempts) {
                console.log('⚠️ Max attempts reached - installing enhanced tooltips anyway');
                installEnhancedTooltipSystem();
            } else {
                setTimeout(checkReady, 200);
            }
        };
        
        checkReady();
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitAndInstallEnhanced);
    } else {
        waitAndInstallEnhanced();
    }

    console.log('🚀 Enhanced combined tooltip integration with trends and loading indicators loaded!');

})();
