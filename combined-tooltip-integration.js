// combined-tooltip-integration.js - FIXED VERSION
// Replace your existing combined-tooltip-integration (1).js with this

(function() {
    // Wait for both integrations to be ready
    function waitForIntegrations(callback) {
        const checkReady = () => {
            if (window.GSCIntegration && window.GA4Integration) {
                callback();
            } else {
                setTimeout(checkReady, 100);
            }
        };
        checkReady();
    }

    // Enhanced tooltip with both GSC and GA4 data
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

        // Create basic content
        tooltip.innerHTML = createBasicTooltipContent(nodeData);
        
        return tooltip;
    }

    // Create the basic page info content (keep your original function if you have it)
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

    // Create loading section for both analytics sources
    function createCombinedLoadingSection() {
        return `
            <div id="combined-analytics-loading" style="margin-top: 16px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; overflow: hidden;">
                    
                    <!-- Header -->
                    <div style="background: rgba(255,255,255,0.15); padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="color: white; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; justify-content: space-between;">
                            <span>📊 Loading Analytics Data</span>
                            <div style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">
                                Multi-Source
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dual Progress Section -->
                    <div style="background: rgba(255,255,255,0.1); padding: 16px;">
                        
                        <!-- GSC Progress -->
                        <div id="gsc-loading-section" style="margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                <div style="display: flex; align-items: center; gap: 8px; color: white; font-size: 0.85rem;">
                                    <div class="loading-spinner gsc-spinner" style="width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.2); border-top: 2px solid #4caf50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                                    <span>🔍 Search Console</span>
                                </div>
                                <span id="gsc-status" style="color: rgba(255,255,255,0.8); font-size: 0.75rem;">Loading...</span>
                            </div>
                        </div>
                        
                        <!-- GA4 Progress -->
                        <div id="ga4-loading-section">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                <div style="display: flex; align-items: center; gap: 8px; color: white; font-size: 0.85rem;">
                                    <div class="loading-spinner ga4-spinner" style="width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.2); border-top: 2px solid #ff6b35; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                                    <span>📊 Analytics 4</span>
                                </div>
                                <span id="ga4-status" style="color: rgba(255,255,255,0.8); font-size: 0.75rem;">Loading...</span>
                            </div>
                        </div>
                        
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    }

    // Fetch both GSC and GA4 data in parallel
    async function fetchCombinedAnalyticsData(nodeData) {
        const results = { gsc: null, ga4: null };
        
        try {
            // Start both requests in parallel
            const promises = [];
            
            // GSC data
            if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
                promises.push(
                    window.GSCIntegration.fetchNodeData(nodeData)
                        .then(data => { 
                            results.gsc = data;
                            console.log('🔍 GSC data loaded:', data);
                        })
                        .catch(error => { 
                            console.warn('GSC fetch failed:', error);
                            results.gsc = { noDataFound: true, error: error.message };
                        })
                );
            } else {
                results.gsc = { noDataFound: true, error: 'GSC not connected' };
            }
            
            // GA4 data
            if (window.GA4Integration && window.GA4Integration.isConnected()) {
                promises.push(
                    window.GA4Integration.fetchData(nodeData.url)
                        .then(data => { 
                            results.ga4 = data;
                            console.log('📊 GA4 data loaded:', data);
                        })
                        .catch(error => { 
                            console.warn('GA4 fetch failed:', error);
                            results.ga4 = { noDataFound: true, error: error.message };
                        })
                );
            } else {
                results.ga4 = { noDataFound: true, error: 'GA4 not connected' };
            }
            
            // Wait for both to complete
            await Promise.all(promises);
            
        } catch (error) {
            console.error('Error fetching combined analytics data:', error);
        }
        
        return results;
    }

    // Update loading status for individual sources
    function updateLoadingStatus(source, status, message) {
        const statusElement = document.querySelector(`#${source}-status`);
        const spinnerElement = document.querySelector(`.${source}-spinner`);
        
        if (statusElement) {
            statusElement.textContent = message;
        }
        
        if (spinnerElement) {
            if (status === 'success') {
                spinnerElement.innerHTML = '✅';
                spinnerElement.style.animation = 'none';
                spinnerElement.style.border = 'none';
                spinnerElement.style.fontSize = '12px';
            } else if (status === 'error') {
                spinnerElement.innerHTML = '❌';
                spinnerElement.style.animation = 'none';
                spinnerElement.style.border = 'none';
                spinnerElement.style.fontSize = '12px';
            }
        }
    }

    // Generate combined analytics HTML - FIXED VERSION
    function generateCombinedAnalyticsHTML(gscData, ga4Data, nodeData) {
        const hasGSC = gscData && !gscData.noDataFound && !gscData.error;
        const hasGA4 = ga4Data && !ga4Data.noDataFound && !ga4Data.error;
        
        console.log('🎨 Generating HTML with:', { 
            hasGSC, 
            hasGA4, 
            gscData: gscData?.clicks || 'no data', 
            ga4Data: ga4Data?.users || 'no data' 
        });
        
        if (!hasGSC && !hasGA4) {
            return `
                <div style="margin-top: 16px; text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 8px;">
                    📭 No analytics data available
                    <div style="font-size: 0.8rem; margin-top: 8px; color: #999;">
                        ${!gscData || gscData.error ? 'GSC: ' + (gscData?.error || 'Not connected') : ''}
                        ${(!gscData || gscData.error) && (!ga4Data || ga4Data.error) ? ' • ' : ''}
                        ${!ga4Data || ga4Data.error ? 'GA4: ' + (ga4Data?.error || 'Not connected') : ''}
                    </div>
                </div>
            `;
        }

        let html = `
            <div style="margin-top: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; overflow: hidden;">
                
                <!-- Combined Header -->
                <div style="background: rgba(255,255,255,0.15); padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="color: white; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                        📊 Analytics Overview (30d)
                        <div style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">
                            ${hasGSC ? 'GSC' : ''}${hasGSC && hasGA4 ? ' + ' : ''}${hasGA4 ? 'GA4' : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Combined Metrics -->
                <div style="background: rgba(255,255,255,0.1); padding: 16px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
        `;

        // GSC Metrics
        if (hasGSC) {
            html += `
                <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; border-left: 3px solid #4caf50;">
                    <div style="color: rgba(255,255,255,0.8); font-size: 0.75rem; margin-bottom: 4px;">🔍 Search Performance</div>
                    <div style="color: white; font-weight: 600; margin-bottom: 6px;">${formatNumber(gscData.clicks)} clicks</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 0.7rem;">
                        ${formatNumber(gscData.impressions)} impr • ${(gscData.ctr * 100).toFixed(1)}% CTR • #${gscData.position.toFixed(0)} pos
                    </div>
                </div>
            `;
        }

        // GA4 Metrics
        if (hasGA4) {
            html += `
                <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; border-left: 3px solid #ff6b35;">
                    <div style="color: rgba(255,255,255,0.8); font-size: 0.75rem; margin-bottom: 4px;">👥 User Engagement</div>
                    <div style="color: white; font-weight: 600; margin-bottom: 6px;">${formatNumber(ga4Data.users)} users</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 0.7rem;">
                        ${formatNumber(ga4Data.pageViews)} views • ${(ga4Data.engagementRate * 100).toFixed(0)}% engaged
                    </div>
                </div>
                
                <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; border-left: 3px solid #2196f3;">
                    <div style="color: rgba(255,255,255,0.8); font-size: 0.75rem; margin-bottom: 4px;">📄 Page Performance</div>
                    <div style="color: white; font-weight: 600; margin-bottom: 6px;">${formatNumber(ga4Data.sessions)} sessions</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 0.7rem;">
                        ${(ga4Data.bounceRate * 100).toFixed(1)}% bounce • ${formatDuration(ga4Data.avgSessionDuration)}
                    </div>
                </div>
            `;
        }

        html += `
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div style="background: rgba(255,255,255,0.05); padding: 12px 16px; display: flex; gap: 8px;">
                    <button onclick="window.open('${nodeData.url}', '_blank')" 
                            style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; flex: 1;">
                        🔗 Visit Page
                    </button>
                    ${hasGSC ? `
                    <button onclick="window.showDetailedGSCAnalysis && window.showDetailedGSCAnalysis('${nodeData.url}')" 
                            style="background: rgba(255,255,255,0.3); color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; flex: 1;">
                        📈 Deep Analysis
                    </button>
                    ` : ''}
                </div>
            </div>
        `;

        return html;
    }

    // Enhanced tooltip show function
    async function showCombinedTooltip(event, nodeData) {
        // Hide existing tooltip
        if (window.hideEnhancedTooltip) {
            window.hideEnhancedTooltip();
        }

        // Create combined tooltip
        const tooltip = createCombinedTooltip(nodeData);
        
        // Add loading section
        tooltip.innerHTML += createCombinedLoadingSection();
        
        // Position tooltip (use your existing positioning logic)
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

        // Fetch combined data
        try {
            const combinedData = await fetchCombinedAnalyticsData(nodeData);
            
            // Update status indicators
            updateLoadingStatus('gsc', combinedData.gsc && !combinedData.gsc.noDataFound && !combinedData.gsc.error ? 'success' : 'error', 
                              combinedData.gsc && !combinedData.gsc.noDataFound && !combinedData.gsc.error ? 'Ready' : 'No data');
            updateLoadingStatus('ga4', combinedData.ga4 && !combinedData.ga4.noDataFound && !combinedData.ga4.error ? 'success' : 'error',
                              combinedData.ga4 && !combinedData.ga4.noDataFound && !combinedData.ga4.error ? 'Ready' : 'No data');
            
            // Brief delay to show completion
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Replace loading with data
            if (tooltip.parentNode) {
                const loadingSection = tooltip.querySelector('#combined-analytics-loading');
                if (loadingSection) {
                    const combinedHTML = generateCombinedAnalyticsHTML(combinedData.gsc, combinedData.ga4, nodeData);
                    loadingSection.outerHTML = combinedHTML;
                }
            }
            
        } catch (error) {
            console.error('Error loading combined analytics:', error);
            // Show error state
            const loadingSection = tooltip.querySelector('#combined-analytics-loading');
            if (loadingSection) {
                loadingSection.innerHTML = `
                    <div style="background: #fff5f5; padding: 12px; border-radius: 6px; border-left: 3px solid #f56565; text-align: center;">
                        <div style="color: #e53e3e; font-size: 0.85rem; margin-bottom: 4px;">❌ Loading Failed</div>
                        <div style="color: #666; font-size: 0.75rem;">Unable to load analytics data</div>
                    </div>
                `;
            }
        }
    }

    // Utility functions
    function formatNumber(num) {
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

    // Hook into existing tooltip system
    function enhanceExistingTooltips() {
        // Store original functions
        const originalShow = window.showEnhancedTooltip;
        const originalHide = window.hideEnhancedTooltip;
        
        // Override with combined version
        window.showEnhancedTooltip = function(event, d) {
            if (!d.data) return;
            console.log('🎯 Enhanced tooltip triggered for:', d.data.name);
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
        
        console.log('✅ Enhanced tooltips with combined GSC + GA4 data');
    }

    // Initialize when both integrations are ready
    waitForIntegrations(() => {
        enhanceExistingTooltips();
        console.log('🚀 Combined analytics tooltips ready with your original styling!');
    });

})();
