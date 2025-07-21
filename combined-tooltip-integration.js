// combined-tooltip-integration.js - REFINED MINIMAL VERSION
// Fixes: hover behavior, size, design, buttons, undefined values

(function() {
    console.log('🚀 Loading refined minimal combined tooltip integration...');

    // The refined tooltip function with stable behavior
    const refinedTooltipFunction = function(event, d) {
        console.log('🎯 Refined tooltip for:', d.data?.name);
        
        if (!d.data) {
            console.warn('⚠️ No data provided to tooltip');
            return;
        }

        // Clear any existing hide timers
        if (window.refinedHideTimer) {
            clearTimeout(window.refinedHideTimer);
            window.refinedHideTimer = null;
        }

        // Only hide existing tooltip if it's for a different node
        if (window.currentRefinedTooltip) {
            const existingNodeName = window.currentRefinedTooltip._nodeData?.name;
            if (existingNodeName !== d.data.name) {
                window.currentRefinedTooltip.remove();
                window.currentRefinedTooltip = null;
            } else {
                // Same node, don't recreate
                return;
            }
        }

        // Create minimal combined tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'enhanced-tooltip refined-combined-tooltip';
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

        // Create refined content
        tooltip.innerHTML = createRefinedContent(d.data);

        // Position tooltip AWAY from cursor to avoid interference
        positionRefinedTooltip(tooltip, event);

        // Add to DOM
        document.body.appendChild(tooltip);
        window.currentRefinedTooltip = tooltip;
        tooltip._nodeData = d.data;

        // Show with animation after positioning
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.style.opacity = '1';
            }
        }, 50);

        // Stable hover behavior - no immediate hiding
        addStableHoverBehavior(tooltip);

        // Load analytics data
        loadRefinedAnalyticsData(tooltip, d.data);
    };

    // Create refined minimal content
    function createRefinedContent(data) {
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
                
                <!-- Compact Page Info -->
                <div style="display: flex; gap: 12px; font-size: 0.7rem; color: #666; margin-top: 8px;">
                    <span>📁 ${pageInfo.type}</span>
                    <span>📏 Level ${pageInfo.depth}</span>
                    <span>👶 ${pageInfo.children}</span>
                    ${freshnessInfo.text ? `<span>📅 ${freshnessInfo.text}</span>` : ''}
                </div>
            </div>

            <!-- Compact Analytics Section -->
            <div style="padding: 16px;">
                
                <!-- Search Console Card -->
                <div id="refined-gsc-card" style="background: #f8f9ff; border: 1px solid #e3f2fd; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 0.9rem;">🔍</span>
                            <span style="font-size: 0.85rem; font-weight: 600; color: #1565c0;">Search Console</span>
                        </div>
                        <span id="refined-gsc-status" style="font-size: 0.7rem; color: #666; background: #fff; padding: 2px 6px; border-radius: 8px; border: 1px solid #e0e0e0;">
                            Loading...
                        </span>
                    </div>
                    <div id="refined-gsc-content">
                        <div style="text-align: center; color: #666; padding: 12px;">⏳ Loading search data...</div>
                    </div>
                </div>
                
                <!-- Google Analytics Card -->
                <div id="refined-ga4-card" style="background: #fff8e1; border: 1px solid #ffecb3; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 0.9rem;">📈</span>
                            <span style="font-size: 0.85rem; font-weight: 600; color: #f57c00;">Google Analytics</span>
                        </div>
                        <span id="refined-ga4-status" style="font-size: 0.7rem; color: #666; background: #fff; padding: 2px 6px; border-radius: 8px; border: 1px solid #e0e0e0;">
                            Loading...
                        </span>
                    </div>
                    <div id="refined-ga4-content">
                        <div style="text-align: center; color: #666; padding: 12px;">⏳ Loading analytics data...</div>
                    </div>
                </div>
                
                <!-- Compact Action Buttons -->
                <div style="display: flex; gap: 6px; margin-top: 12px;">
                    <button class="refined-btn refined-btn-primary" data-action="visit" data-url="${data.url}">
                        🔗 Visit
                    </button>
                    <button class="refined-btn refined-btn-secondary" data-action="refresh">
                        🔄
                    </button>
                    <button class="refined-btn refined-btn-secondary" data-action="detailed" data-url="${data.url}">
                        📊
                    </button>
                </div>
            </div>

            <style>
                .refined-btn {
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    flex: 1;
                }
                
                .refined-btn-primary {
                    background: #1565c0;
                    color: white;
                }
                
                .refined-btn-primary:hover {
                    background: #0d47a1;
                    transform: translateY(-1px);
                }
                
                .refined-btn-secondary {
                    background: #f5f5f5;
                    color: #666;
                    border: 1px solid #e0e0e0;
                }
                
                .refined-btn-secondary:hover {
                    background: #eeeeee;
                    transform: translateY(-1px);
                }
            </style>
        `;
    }

    // Safe page info function with fallbacks
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
                }
            } else {
                // Fallback: calculate from data
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
            }
        } catch (error) {
            console.warn('Error getting page info:', error);
        }

        return pageInfo;
    }

    // Safe freshness info function with fallbacks
    function getFreshnessInfoSafe(data) {
        let result = {
            badge: '',
            text: ''
        };

        try {
            if (typeof getFreshnessInfo === 'function' && data.lastModified) {
                const freshnessData = getFreshnessInfo(data.lastModified);
                if (freshnessData && freshnessData.freshnessLabel) {
                    result.badge = `<span style="background: ${freshnessData.freshnessColor}20; color: ${freshnessData.freshnessColor}; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 500;">${freshnessData.freshnessLabel}</span>`;
                    result.text = freshnessData.formattedDate;
                }
            } else if (data.lastModified) {
                // Fallback: simple date display
                try {
                    const date = new Date(data.lastModified);
                    if (!isNaN(date.getTime())) {
                        result.text = date.toLocaleDateString();
                        result.badge = '<span style="background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 500;">Updated</span>';
                    }
                } catch (e) {
                    // Invalid date, skip
                }
            }
        } catch (error) {
            console.warn('Error getting freshness info:', error);
        }

        return result;
    }

    // Load refined analytics data
    async function loadRefinedAnalyticsData(tooltip, nodeData) {
        console.log('📊 Loading refined analytics for:', nodeData.name);
        
        const gscContent = tooltip.querySelector('#refined-gsc-content');
        const ga4Content = tooltip.querySelector('#refined-ga4-content');
        const gscStatus = tooltip.querySelector('#refined-gsc-status');
        const ga4Status = tooltip.querySelector('#refined-ga4-status');
        
        // Load Search Console data
        if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
            gscStatus.textContent = '🟢 Connected';
            gscStatus.style.color = '#4caf50';
            try {
                const gscData = await window.GSCIntegration.fetchNodeData(nodeData);
                
                if (gscData && !gscData.noDataFound && !gscData.error) {
                    gscContent.innerHTML = createCompactGSCDisplay(gscData);
                } else {
                    gscContent.innerHTML = '<div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">📭 No search data</div>';
                }
            } catch (error) {
                console.error('❌ GSC error:', error);
                gscStatus.textContent = '🔴 Error';
                gscStatus.style.color = '#f44336';
                gscContent.innerHTML = '<div style="text-align: center; color: #f44336; padding: 10px; font-size: 0.8rem;">❌ Error</div>';
            }
        } else {
            gscStatus.textContent = '🔴 Not Connected';
            gscStatus.style.color = '#f44336';
            gscContent.innerHTML = '<div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">🔌 Not connected</div>';
        }
        
        // Load GA4 data
        if (window.GA4Integration && window.GA4Integration.isConnected()) {
            ga4Status.textContent = '🟢 Connected';
            ga4Status.style.color = '#4caf50';
            try {
                const ga4Data = await window.GA4Integration.fetchData(nodeData.url);
                
                if (ga4Data && !ga4Data.noDataFound && !ga4Data.error) {
                    ga4Content.innerHTML = createCompactGA4Display(ga4Data);
                } else {
                    ga4Content.innerHTML = '<div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">📭 No analytics data</div>';
                }
            } catch (error) {
                console.error('❌ GA4 error:', error);
                ga4Status.textContent = '🔴 Error';
                ga4Status.style.color = '#f44336';
                ga4Content.innerHTML = '<div style="text-align: center; color: #f44336; padding: 10px; font-size: 0.8rem;">❌ Error</div>';
            }
        } else {
            ga4Status.textContent = '🔴 Not Connected';
            ga4Status.style.color = '#f44336';
            ga4Content.innerHTML = '<div style="text-align: center; color: #999; padding: 10px; font-size: 0.8rem;">🔌 Not connected</div>';
        }
    }

    // Create compact GSC display
    function createCompactGSCDisplay(gscData) {
        return `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #e3f2fd;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1565c0; margin-bottom: 2px;">
                        ${formatNumber(gscData.clicks)}
                    </div>
                    <div style="font-size: 0.7rem; color: #666;">Clicks</div>
                </div>
                <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #e3f2fd;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1565c0; margin-bottom: 2px;">
                        ${formatNumber(gscData.impressions)}
                    </div>
                    <div style="font-size: 0.7rem; color: #666;">Impressions</div>
                </div>
                <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #e3f2fd;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1565c0; margin-bottom: 2px;">
                        ${(gscData.ctr * 100).toFixed(1)}%
                    </div>
                    <div style="font-size: 0.7rem; color: #666;">CTR</div>
                </div>
                <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #e3f2fd;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1565c0; margin-bottom: 2px;">
                        #${gscData.position.toFixed(0)}
                    </div>
                    <div style="font-size: 0.7rem; color: #666;">Position</div>
                </div>
            </div>
            ${gscData.topQueries && gscData.topQueries.length > 0 ? `
                <div style="background: white; padding: 8px; border-radius: 6px; border: 1px solid #e3f2fd; margin-top: 8px;">
                    <div style="font-size: 0.75rem; font-weight: 600; color: #1565c0; margin-bottom: 6px;">Top Keywords:</div>
                    ${gscData.topQueries.slice(0, 2).map(query => `
                        <div style="font-size: 0.7rem; margin-bottom: 3px;">
                            <div style="font-weight: 500; color: #333;">"${escapeHtml(query.query)}"</div>
                            <div style="color: #666;">${query.clicks} clicks • #${query.position.toFixed(0)}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    }

    // Create compact GA4 display
    function createCompactGA4Display(ga4Data) {
        return `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #ffecb3;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #f57c00; margin-bottom: 2px;">
                        ${formatNumber(ga4Data.users || 0)}
                    </div>
                    <div style="font-size: 0.7rem; color: #666;">Users</div>
                </div>
                <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #ffecb3;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #f57c00; margin-bottom: 2px;">
                        ${formatNumber(ga4Data.pageViews || 0)}
                    </div>
                    <div style="font-size: 0.7rem; color: #666;">Page Views</div>
                </div>
                <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #ffecb3;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #f57c00; margin-bottom: 2px;">
                        ${formatNumber(ga4Data.sessions || 0)}
                    </div>
                    <div style="font-size: 0.7rem; color: #666;">Sessions</div>
                </div>
                <div style="text-align: center; background: white; padding: 8px; border-radius: 6px; border: 1px solid #ffecb3;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #f57c00; margin-bottom: 2px;">
                        ${((ga4Data.engagementRate || 0) * 100).toFixed(0)}%
                    </div>
                    <div style="font-size: 0.7rem; color: #666;">Engagement</div>
                </div>
            </div>
        `;
    }

    // Stable hide function - longer delays, better control
    function hideRefinedTooltip(immediate = false) {
        if (window.refinedHideTimer) {
            clearTimeout(window.refinedHideTimer);
        }
        
        const delay = immediate ? 0 : 300; // Longer delay to prevent flashing
        
        window.refinedHideTimer = setTimeout(() => {
            if (window.currentRefinedTooltip) {
                window.currentRefinedTooltip.style.opacity = '0';
                setTimeout(() => {
                    if (window.currentRefinedTooltip) {
                        window.currentRefinedTooltip.remove();
                        window.currentRefinedTooltip = null;
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
            if (window.refinedHideTimer) {
                clearTimeout(window.refinedHideTimer);
                window.refinedHideTimer = null;
            }
        });
        
        tooltip.addEventListener('mouseleave', () => {
            // Start hide timer when leaving tooltip
            hideRefinedTooltip();
        });
        
        // Button clicks using event delegation
        tooltip.addEventListener('click', (e) => {
            const button = e.target.closest('.refined-btn');
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
                    if (window.currentRefinedTooltip && window.currentRefinedTooltip._nodeData) {
                        loadRefinedAnalyticsData(window.currentRefinedTooltip, window.currentRefinedTooltip._nodeData);
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
    function positionRefinedTooltip(tooltip, event) {
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

    // Install refined tooltip system
    function installRefinedTooltipSystem() {
        console.log('✅ Installing refined tooltip system...');
        
        // Install main functions
        window.showEnhancedTooltip = refinedTooltipFunction;
        
        // Override the existing hideEnhancedTooltip to work with our system
        const originalHide = window.hideEnhancedTooltip;
        window.hideEnhancedTooltip = function() {
            // Use our stable hide function
            hideRefinedTooltip();
        };
        
        console.log('🎯 Refined tooltip functions installed');

        // Monitor for interference
        let checkCount = 0;
        const monitorInterval = setInterval(() => {
            checkCount++;
            
            if (window.showEnhancedTooltip !== refinedTooltipFunction) {
                console.log('🔄 Show function overridden, reinstalling...');
                window.showEnhancedTooltip = refinedTooltipFunction;
            }
            
            if (window.hideEnhancedTooltip !== hideRefinedTooltip) {
                console.log('🔄 Hide function overridden, reinstalling...');
                window.hideEnhancedTooltip = hideRefinedTooltip;
            }
            
            // Stop monitoring after 30 seconds
            if (checkCount > 150) {
                clearInterval(monitorInterval);
                console.log('✅ Refined tooltip monitoring complete');
            }
        }, 200);
    }

    // Wait for integrations and install
    function waitAndInstallRefined() {
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkReady = () => {
            attempts++;
            const gscReady = !!window.GSCIntegration;
            const ga4Ready = !!window.GA4Integration;
            
            if (gscReady && ga4Ready) {
                console.log('✅ Both integrations ready - installing refined tooltips');
                installRefinedTooltipSystem();
            } else if (attempts >= maxAttempts) {
                console.log('⚠️ Max attempts reached - installing refined tooltips anyway');
                installRefinedTooltipSystem();
            } else {
                setTimeout(checkReady, 200);
            }
        };
        
        checkReady();
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitAndInstallRefined);
    } else {
        waitAndInstallRefined();
    }

    console.log('🚀 Refined minimal combined tooltip integration loaded!');

})();
