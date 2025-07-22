// combined-tooltip-integration.js - REFINED MINIMAL VERSION
// Fixes: hover behavior, size, design, buttons, undefined values

(function() {
console.log('🚀 Loading enhanced tooltip with trends integration...');

    // The enhanced tooltip function with trend support
const enhancedTooltipFunction = function(event, d) {
    console.log('🎯 Enhanced tooltip with trends for:', d.data?.name);
    
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

    // Create enhanced combined tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'enhanced-tooltip enhanced-combined-tooltip';
    tooltip.style.cssText = `
        position: absolute;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 0;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        z-index: 10000;
        max-width: 420px;
        opacity: 0;
        transition: opacity 0.3s ease;
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
        }
    }, 50);

    // Stable hover behavior - no immediate hiding
    addStableHoverBehavior(tooltip);

    // Load analytics data with trends
    loadEnhancedAnalyticsWithTrends(tooltip, d.data);
};

// Create enhanced content with trend placeholders
function createEnhancedContent(data) {
    // Safely get page info - with fallbacks for undefined
    const pageInfo = getPageInfoSafe(data);
    const freshnessInfo = getFreshnessInfoSafe(data);

    return `
        <!-- Compact Page Header -->
        <div style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0; background: #fafbfc;">
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

        <!-- Enhanced Analytics Section with Trends -->
        <div style="padding: 16px;">
            
            <!-- Search Console Card with Trends -->
            <div id="enhanced-gsc-card" style="background: #f8f9ff; border: 1px solid #e3f2fd; border-radius: 8px; padding: 0; margin-bottom: 12px; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; padding-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.9rem;">🔍</span>
                        <span style="font-size: 0.85rem; font-weight: 600; color: #1565c0;">Search Console</span>
                    </div>
                    <span id="enhanced-gsc-status" style="font-size: 0.7rem; color: #666; background: #fff; padding: 2px 6px; border-radius: 8px; border: 1px solid #e0e0e0;">
                        Loading...
                    </span>
                </div>
                <div id="enhanced-gsc-content" style="padding: 0 12px 12px 12px;">
                    <div style="text-align: center; color: #666; padding: 12px;">⏳ Loading search data with trends...</div>
                </div>
            </div>
            
            <!-- Google Analytics Card with Trends -->
            <div id="enhanced-ga4-card" style="background: #fff8e1; border: 1px solid #ffecb3; border-radius: 8px; padding: 0; margin-bottom: 12px; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; padding-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.9rem;">📈</span>
                        <span style="font-size: 0.85rem; font-weight: 600; color: #f57c00;">Google Analytics</span>
                    </div>
                    <span id="enhanced-ga4-status" style="font-size: 0.7rem; color: #666; background: #fff; padding: 2px 6px; border-radius: 8px; border: 1px solid #e0e0e0;">
                        Loading...
                    </span>
                </div>
                <div id="enhanced-ga4-content" style="padding: 0 12px 12px 12px;">
                    <div style="text-align: center; color: #666; padding: 12px;">⏳ Loading analytics data with trends...</div>
                </div>
            </div>
            
            <!-- Compact Action Buttons -->
            <div style="display: flex; gap: 6px; margin-top: 12px;">
                <button class="enhanced-btn enhanced-btn-primary" data-action="visit" data-url="${data.url}">
                    🔗 Visit
                </button>
                <button class="enhanced-btn enhanced-btn-secondary" data-action="refresh">
                    🔄 Refresh
                </button>
                <button class="enhanced-btn enhanced-btn-secondary" data-action="detailed" data-url="${data.url}">
                    📊 Detailed Report
                </button>
            </div>
        </div>

        <style>
            .enhanced-btn {
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 0.75rem;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
                flex: 1;
            }
            
            .enhanced-btn-primary {
                background: #1565c0;
                color: white;
            }
            
            .enhanced-btn-primary:hover {
                background: #0d47a1;
                transform: translateY(-1px);
            }
            
            .enhanced-btn-secondary {
                background: #f5f5f5;
                color: #666;
                border: 1px solid #e0e0e0;
            }
            
            .enhanced-btn-secondary:hover {
                background: #eeeeee;
                transform: translateY(-1px);
            }

            .trend-indicator {
                font-size: 0.65rem;
                margin-left: 4px;
                font-weight: 500;
                white-space: nowrap;
            }

            .change-badge {
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 0.65rem;
                font-weight: 500;
                white-space: nowrap;
                border: 1px solid;
            }
        </style>
    `;
}

// Enhanced GSC Display with Full Trend Support
function createEnhancedGSCDisplay(currentData, trendData = null) {
    // Calculate trend indicators
    const getTrendIndicator = (current, previous, isPosition = false) => {
        if (!previous || previous === 0) return '';
        
        let change, arrow, color;
        
        if (isPosition) {
            // For position, lower is better, so reverse the logic
            change = ((previous - current) / previous) * 100;
            arrow = change > 0 ? '↗️' : change < 0 ? '↘️' : '→';
            color = change > 0 ? '#4caf50' : change < 0 ? '#f44336' : '#999';
        } else {
            change = ((current - previous) / previous) * 100;
            arrow = change > 0 ? '↗️' : change < 0 ? '↘️' : '→';
            color = change > 0 ? '#4caf50' : change < 0 ? '#f44336' : '#999';
        }
        
        if (Math.abs(change) < 1) return '';
        
        return `<span class="trend-indicator" style="color: ${color};">${arrow} ${Math.abs(change).toFixed(0)}%</span>`;
    };

    const hasSignificantTrends = trendData && (
        Math.abs(currentData.clicks - (trendData.clicks || 0)) > (trendData.clicks || 0) * 0.1 ||
        Math.abs(currentData.ctr - (trendData.ctr || 0)) > (trendData.ctr || 0) * 0.1 ||
        Math.abs(currentData.position - (trendData.position || 0)) > 2
    );

    return `
        <!-- Period Indicator -->
        ${trendData ? `
            <div style="background: linear-gradient(90deg, #e3f2fd, #f8f9ff); padding: 4px 8px; margin: -12px -12px 8px -12px; font-size: 0.65rem; color: #666; text-align: center; border-radius: 8px 8px 0 0;">
                📊 Last 28 days vs Previous 28 days
            </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #e3f2fd;">
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 2px; flex-wrap: wrap; gap: 2px;">
                    <span style="font-size: 1.1rem; font-weight: 600; color: #1565c0;">
                        ${formatNumber(currentData.clicks)}
                    </span>
                    ${trendData ? getTrendIndicator(currentData.clicks, trendData.clicks) : ''}
                </div>
                <div style="font-size: 0.7rem; color: #666;">Clicks</div>
            </div>

            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #e3f2fd;">
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 2px; flex-wrap: wrap; gap: 2px;">
                    <span style="font-size: 1.1rem; font-weight: 600; color: #1565c0;">
                        ${formatNumber(currentData.impressions)}
                    </span>
                    ${trendData ? getTrendIndicator(currentData.impressions, trendData.impressions) : ''}
                </div>
                <div style="font-size: 0.7rem; color: #666;">Impressions</div>
            </div>

            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #e3f2fd;">
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 2px; flex-wrap: wrap; gap: 2px;">
                    <span style="font-size: 1.1rem; font-weight: 600; color: #1565c0;">
                        ${(currentData.ctr * 100).toFixed(1)}%
                    </span>
                    ${trendData ? getTrendIndicator(currentData.ctr, trendData.ctr) : ''}
                </div>
                <div style="font-size: 0.7rem; color: #666;">CTR</div>
            </div>

            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #e3f2fd;">
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 2px; flex-wrap: wrap; gap: 2px;">
                    <span style="font-size: 1.1rem; font-weight: 600; color: #1565c0;">
                        #${currentData.position.toFixed(0)}
                    </span>
                    ${trendData ? getTrendIndicator(currentData.position, trendData.position, true) : ''}
                </div>
                <div style="font-size: 0.7rem; color: #666;">Position</div>
            </div>
        </div>

        <!-- Key Changes Summary -->
        ${hasSignificantTrends ? `
            <div style="background: linear-gradient(135deg, #f8f9ff 0%, #fff8f0 100%); padding: 6px 8px; border-radius: 6px; margin-top: 8px; border: 1px solid #f0f0f0;">
                <div style="font-size: 0.7rem; color: #666; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                    ⚡ Notable Changes:
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 0.65rem;">
                    ${getNotableGSCChanges(currentData, trendData).map(change => `
                        <span class="change-badge" style="color: ${change.color}; background: ${change.color}15; border-color: ${change.color}30;">
                            ${change.text}
                        </span>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        <!-- Top Keywords -->
        ${currentData.topQueries && currentData.topQueries.length > 0 ? `
            <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #e3f2fd; margin-top: 8px;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #1565c0; margin-bottom: 6px;">🔥 Top Keywords:</div>
                ${currentData.topQueries.slice(0, 2).map(query => `
                    <div style="font-size: 0.7rem; margin-bottom: 3px;">
                        <div style="font-weight: 500; color: #333;">"${escapeHtml(query.query)}"</div>
                        <div style="color: #666;">${query.clicks} clicks • #${query.position.toFixed(0)}</div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

// Enhanced GA4 Display with Trend Support
function createEnhancedGA4Display(currentData, trendData = null) {
    const getTrendIndicator = (current, previous) => {
        if (!previous || previous === 0) return '';
        const change = ((current - previous) / previous) * 100;
        if (Math.abs(change) < 1) return '';
        
        const arrow = change > 0 ? '↗️' : '↘️';
        const color = change > 0 ? '#4caf50' : '#f44336';
        return `<span class="trend-indicator" style="color: ${color};">${arrow} ${Math.abs(change).toFixed(0)}%</span>`;
    };

    const hasSignificantTrends = trendData && (
        Math.abs((currentData.users || 0) - (trendData.users || 0)) > (trendData.users || 0) * 0.1 ||
        Math.abs((currentData.pageViews || 0) - (trendData.pageViews || 0)) > (trendData.pageViews || 0) * 0.1
    );

    return `
        ${trendData ? `
            <div style="background: linear-gradient(90deg, #fff8e1, #ffecb3); padding: 4px 8px; margin: -12px -12px 8px -12px; font-size: 0.65rem; color: #666; text-align: center; border-radius: 8px 8px 0 0;">
                📈 Last 28 days vs Previous 28 days
            </div>
        ` : ''}
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #ffecb3;">
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 2px; flex-wrap: wrap; gap: 2px;">
                    <span style="font-size: 1.1rem; font-weight: 600; color: #f57c00;">
                        ${formatNumber(currentData.users || 0)}
                    </span>
                    ${trendData ? getTrendIndicator(currentData.users || 0, trendData.users) : ''}
                </div>
                <div style="font-size: 0.7rem; color: #666;">Users</div>
            </div>
            
            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #ffecb3;">
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 2px; flex-wrap: wrap; gap: 2px;">
                    <span style="font-size: 1.1rem; font-weight: 600; color: #f57c00;">
                        ${formatNumber(currentData.pageViews || 0)}
                    </span>
                    ${trendData ? getTrendIndicator(currentData.pageViews || 0, trendData.pageViews) : ''}
                </div>
                <div style="font-size: 0.7rem; color: #666;">Page Views</div>
            </div>
            
            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #ffecb3;">
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 2px; flex-wrap: wrap; gap: 2px;">
                    <span style="font-size: 1.1rem; font-weight: 600; color: #f57c00;">
                        ${formatNumber(currentData.sessions || 0)}
                    </span>
                    ${trendData ? getTrendIndicator(currentData.sessions || 0, trendData.sessions) : ''}
                </div>
                <div style="font-size: 0.7rem; color: #666;">Sessions</div>
            </div>
            
            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #ffecb3;">
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 2px; flex-wrap: wrap; gap: 2px;">
                    <span style="font-size: 1.1rem; font-weight: 600; color: #f57c00;">
                        ${((currentData.engagementRate || 0) * 100).toFixed(0)}%
                    </span>
                    ${trendData ? getTrendIndicator((currentData.engagementRate || 0) * 100, (trendData.engagementRate || 0) * 100) : ''}
                </div>
                <div style="font-size: 0.7rem; color: #666;">Engagement</div>
            </div>
        </div>

        ${hasSignificantTrends ? `
            <div style="background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); padding: 6px 8px; border-radius: 6px; margin-top: 8px; border: 1px solid #f0f0f0;">
                <div style="font-size: 0.7rem; color: #666; margin-bottom: 3px;">⚡ Notable Changes:</div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 0.65rem;">
                    ${getNotableGA4Changes(currentData, trendData).map(change => `
                        <span class="change-badge" style="color: ${change.color}; background: ${change.color}15; border-color: ${change.color}30;">
                            ${change.text}
                        </span>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;
}

// Helper function to identify notable GSC changes
function getNotableGSCChanges(current, previous) {
    const changes = [];
    const threshold = 0.15; // 15% change threshold
    
    // Check clicks
    if (previous.clicks && previous.clicks > 0) {
        const clickChange = ((current.clicks - previous.clicks) / previous.clicks);
        if (Math.abs(clickChange) > threshold) {
            changes.push({
                text: `Clicks ${clickChange > 0 ? '+' : ''}${(clickChange * 100).toFixed(0)}%`,
                color: clickChange > 0 ? '#4caf50' : '#f44336'
            });
        }
    }
    
    // Check CTR
    if (previous.ctr && previous.ctr > 0) {
        const ctrChange = ((current.ctr - previous.ctr) / previous.ctr);
        if (Math.abs(ctrChange) > threshold) {
            changes.push({
                text: `CTR ${ctrChange > 0 ? '+' : ''}${(ctrChange * 100).toFixed(0)}%`,
                color: ctrChange > 0 ? '#4caf50' : '#f44336'
            });
        }
    }
    
    // Check position (different logic - lower is better)
    if (previous.position && previous.position > 0) {
        const positionChange = previous.position - current.position;
        if (Math.abs(positionChange) > 2) {
            changes.push({
                text: `Position ${positionChange > 0 ? '+' : ''}${positionChange.toFixed(0)}`,
                color: positionChange > 0 ? '#4caf50' : '#f44336'
            });
        }
    }
    
    return changes.slice(0, 3);
}

// Helper function to identify notable GA4 changes
function getNotableGA4Changes(current, previous) {
    const changes = [];
    const threshold = 0.15;
    
    const metrics = [
        { name: 'Users', current: current.users || 0, previous: previous.users || 0 },
        { name: 'Page Views', current: current.pageViews || 0, previous: previous.pageViews || 0 },
        { name: 'Sessions', current: current.sessions || 0, previous: previous.sessions || 0 }
    ];
    
    metrics.forEach(metric => {
        if (metric.previous > 0) {
            const change = ((metric.current - metric.previous) / metric.previous);
            if (Math.abs(change) > threshold) {
                changes.push({
                    text: `${metric.name} ${change > 0 ? '+' : ''}${(change * 100).toFixed(0)}%`,
                    color: change > 0 ? '#4caf50' : '#f44336'
                });
            }
        }
    });
    
    return changes.slice(0, 3);
}

// MAIN ENHANCED ANALYTICS LOADING WITH TRENDS
async function loadEnhancedAnalyticsWithTrends(tooltip, nodeData) {
    console.log('📊 Loading enhanced analytics with trends for:', nodeData.name);
    
    const gscContent = tooltip.querySelector('#enhanced-gsc-content');
    const ga4Content = tooltip.querySelector('#enhanced-ga4-content');
    const gscStatus = tooltip.querySelector('#enhanced-gsc-status');
    const ga4Status = tooltip.querySelector('#enhanced-ga4-status');
    
    // Calculate date ranges for current and previous periods
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000); // 28 days ago
    const prevEndDate = new Date(startDate.getTime() - 1); // Day before start
    const prevStartDate = new Date(prevEndDate.getTime() - 27 * 24 * 60 * 60 * 1000); // 28 days before that
    
    // Load GSC data with trends
    if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
        gscStatus.textContent = '🟢 Connected';
        gscStatus.style.color = '#4caf50';
        
        try {
            console.log('📊 Fetching GSC data for both periods...');
            
            // Fetch both periods in parallel
            const [currentGSC, previousGSC] = await Promise.all([
                window.GSCIntegration.fetchNodeData(nodeData, {
                    startDate: formatDateForAPI(startDate),
                    endDate: formatDateForAPI(endDate)
                }),
                window.GSCIntegration.fetchNodeData(nodeData, {
                    startDate: formatDateForAPI(prevStartDate),
                    endDate: formatDateForAPI(prevEndDate)
                })
            ]);
            
            console.log('📊 GSC Current:', currentGSC);
            console.log('📊 GSC Previous:', previousGSC);
            
            if (currentGSC && !currentGSC.noDataFound && !currentGSC.error) {
                const trendData = (previousGSC && !previousGSC.noDataFound && !previousGSC.error) ? previousGSC : null;
                gscContent.innerHTML = createEnhancedGSCDisplay(currentGSC, trendData);
            } else {
                gscContent.innerHTML = '<div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">📭 No search data</div>';
            }
        } catch (error) {
            console.error('❌ GSC trends error:', error);
            gscStatus.textContent = '🔴 Error';
            gscStatus.style.color = '#f44336';
            gscContent.innerHTML = '<div style="text-align: center; color: #f44336; padding: 10px; font-size: 0.8rem;">❌ Error loading trends</div>';
        }
    } else {
        gscStatus.textContent = '🔴 Not Connected';
        gscStatus.style.color = '#f44336';
        gscContent.innerHTML = '<div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">🔌 Not connected</div>';
    }
    
    // Load GA4 data with trends
    if (window.GA4Integration && window.GA4Integration.isConnected()) {
        ga4Status.textContent = '🟢 Connected';
        ga4Status.style.color = '#4caf50';
        
        try {
            console.log('📊 Fetching GA4 data for both periods...');
            
            // Check if GA4Integration supports date ranges
            const [currentGA4, previousGA4] = await Promise.all([
                window.GA4Integration.fetchData(nodeData.url, {
                    startDate: formatDateForAPI(startDate),
                    endDate: formatDateForAPI(endDate)
                }),
                window.GA4Integration.fetchData(nodeData.url, {
                    startDate: formatDateForAPI(prevStartDate),
                    endDate: formatDateForAPI(prevEndDate)
                })
            ]);
            
            console.log('📊 GA4 Current:', currentGA4);
            console.log('📊 GA4 Previous:', previousGA4);
            
            if (currentGA4 && !currentGA4.noDataFound && !currentGA4.error) {
                const trendData = (previousGA4 && !previousGA4.noDataFound && !previousGA4.error) ? previousGA4 : null;
                ga4Content.innerHTML = createEnhancedGA4Display(currentGA4, trendData);
            } else {
                ga4Content.innerHTML = '<div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">📭 No analytics data</div>';
            }
        } catch (error) {
            console.error('❌ GA4 trends error:', error);
            // Fallback to standard call if date range not supported
            try {
                const ga4Data = await window.GA4Integration.fetchData(nodeData.url);
                if (ga4Data && !ga4Data.noDataFound && !ga4Data.error) {
                    ga4Content.innerHTML = createEnhancedGA4Display(ga4Data);
                } else {
                    ga4Content.innerHTML = '<div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">📭 No analytics data</div>';
                }
            } catch (fallbackError) {
                ga4Status.textContent = '🔴 Error';
                ga4Status.style.color = '#f44336';
                ga4Content.innerHTML = '<div style="text-align: center; color: #f44336; padding: 10px; font-size: 0.8rem;">❌ Error</div>';
            }
        }
    } else {
        ga4Status.textContent = '🔴 Not Connected';
        ga4Status.style.color = '#f44336';
        ga4Content.innerHTML = '<div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">🔌 Not connected</div>';
    }
}

// Format date for API calls (YYYY-MM-DD)
function formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
}

// Enhanced page info function (keeping your existing logic)
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
            pageInfo.depth = Math.max(0, pathSegments.length - 2);
            
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

// Find node in tree structure and calculate siblings (keeping your existing logic)
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
            result.siblings = Math.max(0, siblingNodes.length - 1);
            return true;
        }

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                if (traverse(child, depth + 1, node, node.children)) {
                    return true;
                }
            }
        }
        return false;
    }

    if (treeData.url === targetUrl) {
        result.found = true;
        result.node = treeData;
        result.depth = 0;
        result.children = treeData.children ? treeData.children.length : 0;
        result.siblings = 0;
        result.hasChildren = result.children > 0;
    } else {
        traverse(treeData, 0, null, [treeData]);
    }

    return result;
}

// Enhanced page type determination (keeping your existing logic)
function determinePageType(node, depth, hasChildren) {
    if (depth === 0) return 'Homepage';
    if (node.url && node.url.match(/\/(en|ga|ie)\/?$/)) return 'Language Root';
    
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

// Enhanced freshness info function (keeping your existing logic)
function getFreshnessInfoSafe(data) {
    let result = {
        badge: '',
        text: '',
        daysSince: null
    };

    try {
        if (typeof getFreshnessInfo === 'function' && data.lastModified) {
            const freshnessData = getFreshnessInfo(data.lastModified);
            if (freshnessData && freshnessData.freshnessLabel) {
                result.badge = `<span style="background: ${freshnessData.freshnessColor}20; color: ${freshnessData.freshnessColor}; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 500;">${freshnessData.freshnessLabel}</span>`;
                result.text = freshnessData.formattedDate;
                result.daysSince = freshnessData.daysSince;
                result.freshnessColor = freshnessData.freshnessColor;
                return result;
            }
        }

        if (data.lastModified) {
            let lastModified;
            
            if (typeof data.lastModified === 'string') {
                lastModified = new Date(data.lastModified);
            } else if (data.lastModified instanceof Date) {
                lastModified = data.lastModified;
            } else {
                return result;
            }

            if (isNaN(lastModified.getTime())) return result;

            const now = new Date();
            const daysSince = Math.floor((now - lastModified) / (1000 * 60 * 60 * 24));
            
            let freshnessClass, freshnessLabel, freshnessColor;
            
            if (daysSince < 30) {
                freshnessClass = 'new';
                freshnessLabel = 'New';
                freshnessColor = '#4caf50';
            } else if (daysSince < 90) {
                freshnessClass = 'fresh';
                freshnessLabel = 'Fresh';
                freshnessColor = '#4caf50';
            } else if (daysSince < 180) {
                freshnessClass = 'recent';
                freshnessLabel = 'Recent';
                freshnessColor = '#ffc107';
            } else if (daysSince < 365) {
                freshnessClass = 'aging';
                freshnessLabel = 'Aging';
                freshnessColor = '#ff9800';
            } else if (daysSince < 730) {
                freshnessClass = 'old';
                freshnessLabel = 'Old';
                freshnessColor = '#f44336';
            } else {
                freshnessClass = 'stale';
                freshnessLabel = 'Stale';
                freshnessColor = '#d32f2f';
            }

            const formattedDate = lastModified.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

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
    
    const delay = immediate ? 0 : 300;
    
    window.enhancedHideTimer = setTimeout(() => {
        if (window.currentEnhancedTooltip) {
            window.currentEnhancedTooltip.style.opacity = '0';
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
    tooltip.addEventListener('mouseenter', () => {
        if (window.enhancedHideTimer) {
            clearTimeout(window.enhancedHideTimer);
            window.enhancedHideTimer = null;
        }
    });
    
    tooltip.addEventListener('mouseleave', () => {
        hideEnhancedTooltip();
    });
    
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
                    loadEnhancedAnalyticsWithTrends(window.currentEnhancedTooltip, window.currentEnhancedTooltip._nodeData);
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
    let left = event.pageX + 25;
    let top = event.pageY - 50;
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    
    setTimeout(() => {
        const rect = tooltip.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        if (rect.right > windowWidth - 20) {
            tooltip.style.left = (event.pageX - rect.width - 25) + 'px';
        }
        
        if (rect.top < 10) {
            tooltip.style.top = (event.pageY + 25) + 'px';
        }
        
        if (rect.bottom > windowHeight - 20) {
            tooltip.style.top = Math.max(10, windowHeight - rect.height - 20) + 'px';
        }
        
        const finalRect = tooltip.getBoundingClientRect();
        if (finalRect.left < 10) {
            tooltip.style.left = '10px';
        }
    }, 10);
}

// Utility functions
function formatNumber(num) {
    if (!num || num === 0) return '0';
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
    
    window.showEnhancedTooltip = enhancedTooltipFunction;
    window.hideEnhancedTooltip = hideEnhancedTooltip;
    
    console.log('🎯 Enhanced tooltip functions with trends installed');

    // Monitor for interference
    let checkCount = 0;
    const monitorInterval = setInterval(() => {
        checkCount++;
        
        if (window.showEnhancedTooltip !== enhancedTooltipFunction) {
            console.log('🔄 Show function overridden, reinstalling...');
            window.showEnhancedTooltip = enhancedTooltipFunction;
        }
        
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

console.log('🚀 Enhanced tooltip integration with trends loaded!');

})();
