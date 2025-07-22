// compact-vertical-tooltip.js
// Compact vertical layout with optimized spacing and readability

(function() {
    console.log('🚀 Loading compact vertical tooltip...');

    const modernTooltipFunction = function(event, d) {
        console.log('🎯 Compact tooltip for:', d.data?.name);
        
        if (!d.data) return;

        clearTooltipTimers();
        hideExistingTooltip(d.data);

        const tooltip = createCompactTooltip(d.data);
        positionTooltip(tooltip, event);
        
        document.body.appendChild(tooltip);
        window.currentEnhancedTooltip = tooltip;
        tooltip._nodeData = d.data;

        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0) scale(1)';
        });

        addModernHoverBehavior(tooltip);
        loadEnhancedAnalytics(tooltip, d.data);
    };

    function createCompactTooltip(data) {
        const tooltip = document.createElement('div');
        tooltip.className = 'compact-modern-tooltip';
        
        tooltip.style.cssText = `
            position: absolute;
            background: white;
            border-radius: 16px;
            padding: 0;
            box-shadow: 
                0 20px 35px -12px rgba(0, 0, 0, 0.25),
                0 0 0 1px rgba(0, 0, 0, 0.05);
            z-index: 10000;
            width: 400px;
            max-height: 85vh;
            opacity: 0;
            transform: translateY(8px) scale(0.96);
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            pointer-events: auto;
            backdrop-filter: blur(20px);
        `;

        tooltip.innerHTML = createCompactContent(data);
        return tooltip;
    }

    function createCompactContent(data) {
        const pageInfo = getPageInfoSafe(data);
        const freshnessInfo = getFreshnessInfoSafe(data);
        const lastEditedInfo = getLastEditedInfo(data);

        return `
            <!-- Compact Header -->
            <div style="
                padding: 16px 18px 14px 18px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                position: relative;
            ">
                <div style="position: relative; z-index: 2;">
                    <!-- Title and Freshness Badge -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
                        <h3 style="
                            margin: 0; 
                            font-size: 1.05rem; 
                            font-weight: 600; 
                            color: white;
                            line-height: 1.2;
                            flex: 1;
                            display: -webkit-box;
                            -webkit-line-clamp: 2;
                            -webkit-box-orient: vertical;
                            overflow: hidden;
                        ">${data.name || 'Page'}</h3>
                        ${freshnessInfo.badge}
                    </div>
                    
                    <!-- URL -->
                    ${data.url ? `
                        <a href="${data.url}" target="_blank" 
                           style="
                               font-size: 0.75rem; 
                               color: rgba(255,255,255,0.9); 
                               text-decoration: none;
                               display: block;
                               white-space: nowrap;
                               overflow: hidden;
                               text-overflow: ellipsis;
                               margin-bottom: 8px;
                               padding: 3px 6px;
                               background: rgba(255,255,255,0.15);
                               border-radius: 4px;
                               transition: all 0.2s ease;
                           " 
                           onmouseover="this.style.background='rgba(255,255,255,0.25)'" 
                           onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                            🔗 ${data.url}
                        </a>
                    ` : ''}
                    
                    <!-- Last Edited (more compact) -->
                    ${lastEditedInfo}
                    
                    <!-- Page Metrics - Compact pills -->
                    <div style="display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap;">
                        ${createCompactPill(pageInfo.type, '📄')}
                        ${createCompactPill(`L${pageInfo.depth}`, '🏗️')}
                        ${createCompactPill(pageInfo.children.toString(), '👶', pageInfo.children > 0)}
                        ${createCompactPill(pageInfo.siblings.toString(), '👫', pageInfo.siblings > 0)}
                    </div>
                </div>
            </div>

            <!-- Compact Analytics Section -->
            <div style="padding: 16px 18px;">
                
                <!-- Search Console - More Compact -->
                <div id="compact-gsc-section" style="margin-bottom: 14px;">
                    <div style="
                        background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
                        border-radius: 12px;
                        overflow: hidden;
                        position: relative;
                    ">
                        <div style="padding: 14px; position: relative; z-index: 2;">
                            <!-- GSC Header - Compact -->
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 1rem;">🔍</span>
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.9rem; color: white;">Search Console</div>
                                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.8);">30d vs Previous</div>
                                    </div>
                                </div>
                                <div id="gsc-status-badge" style="
                                    padding: 4px 8px; 
                                    background: rgba(255,255,255,0.2); 
                                    border-radius: 12px; 
                                    font-size: 0.7rem; 
                                    font-weight: 600;
                                    color: white;
                                ">Loading...</div>
                            </div>
                            
                            <!-- GSC Metrics - Compact grid -->
                            <div id="gsc-metrics-container" style="margin-bottom: 10px;">
                                ${createCompactLoadingGrid()}
                            </div>
                            
                            <!-- GSC Queries - More compact -->
                            <div style="
                                background: rgba(255,255,255,0.15);
                                border-radius: 8px;
                                padding: 10px;
                            ">
                                <div style="font-size: 0.8rem; font-weight: 600; color: white; margin-bottom: 8px;">
                                    🎯 Top Queries
                                </div>
                                <div id="gsc-queries-list">
                                    ${createCompactQueryLoading()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Google Analytics - More Compact -->
                <div id="compact-ga4-section" style="margin-bottom: 14px;">
                    <div style="
                        background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
                        border-radius: 12px;
                        overflow: hidden;
                        position: relative;
                    ">
                        <div style="padding: 14px; position: relative; z-index: 2;">
                            <!-- GA4 Header - Compact -->
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 1rem;">📊</span>
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.9rem; color: white;">Google Analytics</div>
                                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.8);">30d vs Previous</div>
                                    </div>
                                </div>
                                <div id="ga4-status-badge" style="
                                    padding: 4px 8px; 
                                    background: rgba(255,255,255,0.2); 
                                    border-radius: 12px; 
                                    font-size: 0.7rem; 
                                    font-weight: 600;
                                    color: white;
                                ">Loading...</div>
                            </div>
                            
                            <!-- GA4 Metrics -->
                            <div id="ga4-metrics-container">
                                ${createCompactLoadingGrid()}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Compact Action Bar -->
                <div style="
                    display: flex; 
                    gap: 8px; 
                    padding: 10px 12px; 
                    background: #f8fafc; 
                    border-radius: 12px; 
                    border: 1px solid #e2e8f0;
                ">
                    <button class="compact-action-btn compact-action-primary" data-action="visit" data-url="${data.url}">
                        <span class="btn-icon">🚀</span>
                        <span class="btn-text">Visit</span>
                    </button>
                    <button class="compact-action-btn compact-action-secondary" data-action="refresh">
                        <span class="btn-icon">🔄</span>
                        <span class="btn-text">Refresh</span>
                    </button>
                    <button class="compact-action-btn compact-action-secondary" data-action="detailed" data-url="${data.url}">
                        <span class="btn-icon">📈</span>
                        <span class="btn-text">Report</span>
                    </button>
                </div>
            </div>

            <style>
                @keyframes shimmer {
                    0% { background-position: -200% -200%; }
                    100% { background-position: 200% 200%; }
                }
                
                @keyframes slide-up {
                    from { transform: translateY(6px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                .loading-skeleton {
                    background: linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.2) 100%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s ease-in-out infinite;
                    border-radius: 4px;
                }
                
                .compact-action-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 8px 12px;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    font-family: inherit;
                }
                
                .compact-action-primary {
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                }
                
                .compact-action-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                }
                
                .compact-action-secondary {
                    background: white;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                
                .compact-action-secondary:hover {
                    background: #f1f5f9;
                    color: #334155;
                    transform: translateY(-1px);
                }
            </style>
        `;
    }

    function createCompactPill(value, icon, isActive = false) {
        return `
            <div style="
                background: rgba(255,255,255,0.2);
                border-radius: 12px;
                padding: 4px 8px;
                font-size: 0.7rem;
                font-weight: 600;
                color: white;
                display: flex;
                align-items: center;
                gap: 4px;
                ${isActive ? 'box-shadow: 0 0 0 1px rgba(255,255,255,0.4);' : ''}
            ">
                <span style="font-size: 0.8rem;">${icon}</span>
                <span>${value}</span>
            </div>
        `;
    }

    function getLastEditedInfo(data) {
        if (!data.lastModified) return '';
        
        let lastMod;
        if (typeof data.lastModified === 'string') {
            lastMod = new Date(data.lastModified);
        } else if (data.lastModified instanceof Date) {
            lastMod = data.lastModified;
        }
        
        if (!lastMod || isNaN(lastMod.getTime())) return '';
        
        const formattedDate = lastMod.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
        
        const daysSince = Math.floor((new Date() - lastMod) / (1000 * 60 * 60 * 24));
        const relativeTime = daysSince === 0 ? 'today' :
                           daysSince === 1 ? '1d ago' :
                           daysSince < 7 ? `${daysSince}d ago` :
                           daysSince < 30 ? `${Math.floor(daysSince / 7)}w ago` :
                           `${Math.floor(daysSince / 30)}mo ago`;
        
        return `
            <div style="
                font-size: 0.7rem; 
                color: rgba(255,255,255,0.9);
                background: rgba(255,255,255,0.15);
                padding: 4px 8px;
                border-radius: 6px;
                display: inline-block;
            ">
                📅 ${formattedDate} (${relativeTime})
            </div>
        `;
    }

    function createCompactLoadingGrid() {
        return `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                ${Array.from({length: 4}, () => `
                    <div style="
                        background: rgba(255,255,255,0.15); 
                        border-radius: 8px; 
                        padding: 10px; 
                        text-align: center;
                    ">
                        <div style="height: 14px; width: 60%; margin: 0 auto 6px; background: rgba(255,255,255,0.3); border-radius: 3px;" class="loading-skeleton"></div>
                        <div style="height: 8px; width: 50%; margin: 0 auto; background: rgba(255,255,255,0.2); border-radius: 3px;" class="loading-skeleton"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function createCompactQueryLoading() {
        return Array.from({length: 3}, (_, i) => `
            <div style="
                margin-bottom: ${i < 2 ? '6px' : '0'};
                padding: ${i < 2 ? '0 0 6px 0' : '0'};
                ${i < 2 ? 'border-bottom: 1px solid rgba(255,255,255,0.2);' : ''}
            ">
                <div style="height: 11px; width: 75%; margin-bottom: 4px; background: rgba(255,255,255,0.3); border-radius: 3px;" class="loading-skeleton"></div>
                <div style="height: 8px; width: 55%; background: rgba(255,255,255,0.2); border-radius: 3px;" class="loading-skeleton"></div>
            </div>
        `).join('');
    }

    function createCompactTrendCard(label, currentValue, previousValue, icon = '') {
        const current = parseFloat(currentValue) || 0;
        const previous = parseFloat(previousValue) || 0;
        
        let percentChange = 0;
        let changeDirection = '→';
        let changeColor = '#fff';
        let changeBg = 'rgba(255,255,255,0.25)';
        
        if (previous > 0) {
            percentChange = ((current - previous) / previous) * 100;
            
            if (Math.abs(percentChange) < 2) {
                changeDirection = '→';
                changeColor = '#fff';
                changeBg = 'rgba(255,255,255,0.25)';
            } else if (percentChange > 0) {
                changeDirection = '↗';
                changeColor = '#000';
                changeBg = '#10b981';
            } else {
                changeDirection = '↘';
                changeBg = '#ef4444';
                changeColor = '#fff';
            }
        }

        return `
            <div style="
                background: rgba(255,255,255,0.15); 
                border-radius: 8px; 
                padding: 10px; 
                text-align: center;
                border: 1px solid rgba(255,255,255,0.2);
                animation: slide-up 0.3s ease;
            ">
                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.9); margin-bottom: 3px; font-weight: 500;">
                    ${icon} ${label}
                </div>
                
                <div style="font-size: 1.1rem; font-weight: 700; color: white; margin-bottom: 4px;">
                    ${formatDisplayValue(current)}
                </div>
                
                <div style="
                    font-size: 0.65rem; 
                    color: ${changeColor}; 
                    font-weight: 700;
                    padding: 2px 6px;
                    background: ${changeBg};
                    border-radius: 10px;
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                ">
                    <span>${changeDirection}</span>
                    <span>${Math.abs(percentChange).toFixed(0)}%</span>
                </div>
            </div>
        `;
    }

    function createCompactQueryCard(query, index) {
        const opportunityColors = {
            'HIGH POTENTIAL': '#ef4444',
            'CTR BOOST': '#f59e0b',
            'PERFORMING': '#10b981',
            'MONITOR': '#6b7280'
        };
        
        const opportunity = getQueryOpportunity(query);
        const oppColor = opportunityColors[opportunity.label] || '#6b7280';
        
        return `
            <div style="
                margin-bottom: ${index < 2 ? '6px' : '0'};
                padding: ${index < 2 ? '0 0 6px 0' : '0'};
                ${index < 2 ? 'border-bottom: 1px solid rgba(255,255,255,0.2);' : ''}
                animation: slide-up 0.3s ease;
                animation-delay: ${index * 0.05}s;
                animation-fill-mode: both;
            ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                    <span style="
                        background: rgba(255,255,255,0.3); 
                        color: white; 
                        width: 18px; 
                        height: 18px; 
                        border-radius: 50%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        font-weight: 700;
                        font-size: 0.7rem;
                        flex-shrink: 0;
                    ">${index + 1}</span>
                    
                    <div style="
                        font-size: 0.8rem; 
                        font-weight: 600; 
                        color: white; 
                        flex: 1;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    ">"${query.query}"</div>
                    
                    <div style="
                        padding: 2px 6px;
                        background: ${oppColor};
                        color: white;
                        border-radius: 8px;
                        font-size: 0.6rem;
                        font-weight: 600;
                        flex-shrink: 0;
                    ">${opportunity.label}</div>
                </div>
                
                <div style="font-size: 0.65rem; color: rgba(255,255,255,0.8); margin-left: 26px;">
                    ${query.clicks} clicks • #${query.position.toFixed(0)} avg • ${(query.ctr * 100).toFixed(1)}% CTR
                </div>
            </div>
        `;
    }

    function getQueryOpportunity(query) {
        if (query.position > 10 && query.impressions > 100) {
            return { label: 'HIGH POTENTIAL', color: '#ef4444' };
        }
        if (query.position > 5 && query.ctr < 0.05) {
            return { label: 'CTR BOOST', color: '#f59e0b' };
        }
        if (query.position <= 3 && query.ctr > 0.15) {
            return { label: 'PERFORMING', color: '#10b981' };
        }
        return { label: 'MONITOR', color: '#6b7280' };
    }

    // Enhanced loading functions
    async function loadEnhancedAnalytics(tooltip, nodeData) {
        console.log('📈 Loading compact analytics for:', nodeData.name);
        
        // Load in parallel for better performance
        const promises = [];
        
        if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
            promises.push(loadCompactGSCTrends(tooltip, nodeData));
        } else {
            showGSCDisconnected(tooltip);
        }
        
        if (window.GA4Integration && window.GA4Integration.isConnected()) {
            promises.push(loadCompactGA4Trends(tooltip, nodeData));
        } else {
            showGA4Disconnected(tooltip);
        }
        
        await Promise.all(promises);
    }

    async function loadCompactGSCTrends(tooltip, nodeData) {
        const badge = tooltip.querySelector('#gsc-status-badge');
        const metricsContainer = tooltip.querySelector('#gsc-metrics-container');
        const queriesContainer = tooltip.querySelector('#gsc-queries-list');
        
        try {
            badge.textContent = '🟢 Connected';
            badge.style.background = 'rgba(16, 185, 129, 0.3)';
            
            const currentData = await window.GSCIntegration.fetchNodeData(nodeData);
            
            if (!currentData || currentData.noDataFound) {
                metricsContainer.innerHTML = createCompactNoData('No search data');
                queriesContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 12px; font-size: 0.75rem;">No queries available</div>';
                return;
            }
            
            const previousData = await window.GSCIntegration.fetchPreviousPeriodData(nodeData);
            
            metricsContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    ${createCompactTrendCard('Clicks', currentData.clicks, previousData?.clicks || 0, '🎯')}
                    ${createCompactTrendCard('Impressions', currentData.impressions, previousData?.impressions || 0, '👁️')}
                    ${createCompactTrendCard('CTR', `${(currentData.ctr * 100).toFixed(1)}%`, `${((previousData?.ctr || 0) * 100).toFixed(1)}%`, '⚡')}
                    ${createCompactTrendCard('Position', currentData.position.toFixed(1), (previousData?.position || 0).toFixed(1), '📍')}
                </div>
            `;
            
            if (currentData.topQueries && currentData.topQueries.length > 0) {
                queriesContainer.innerHTML = currentData.topQueries.slice(0, 3)
                    .map((query, index) => createCompactQueryCard(query, index))
                    .join('');
            } else {
                queriesContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 12px; font-size: 0.75rem;">No top queries data</div>';
            }
            
        } catch (error) {
            console.error('Compact GSC error:', error);
            badge.textContent = '🔴 Error';
            badge.style.background = 'rgba(239, 68, 68, 0.3)';
            metricsContainer.innerHTML = createCompactNoData('Search error');
            queriesContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 12px; font-size: 0.75rem;">Error loading queries</div>';
        }
    }

    async function loadCompactGA4Trends(tooltip, nodeData) {
        const badge = tooltip.querySelector('#ga4-status-badge');
        const metricsContainer = tooltip.querySelector('#ga4-metrics-container');
        
        try {
            badge.textContent = '🟢 Connected';
            badge.style.background = 'rgba(16, 185, 129, 0.3)';
            
            const currentData = await window.GA4Integration.fetchData(nodeData.url);
            
            if (!currentData || currentData.noDataFound) {
                metricsContainer.innerHTML = createCompactNoData('No analytics data');
                return;
            }
            
            const previousData = await window.GA4Integration.fetchPreviousPeriodData(nodeData.url);
            
            metricsContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    ${createCompactTrendCard('Users', currentData.users || 0, previousData?.users || 0, '👥')}
                    ${createCompactTrendCard('Page Views', currentData.pageViews || 0, previousData?.pageViews || 0, '📄')}
                    ${createCompactTrendCard('Sessions', currentData.sessions || 0, previousData?.sessions || 0, '🔄')}
                    ${createCompactTrendCard('Bounce Rate', `${((currentData.bounceRate || 0) * 100).toFixed(0)}%`, `${((previousData?.bounceRate || 0) * 100).toFixed(0)}%`, '⚽')}
                </div>
            `;
            
        } catch (error) {
            console.error('Compact GA4 error:', error);
            badge.textContent = '🔴 Error';
            badge.style.background = 'rgba(239, 68, 68, 0.3)';
            metricsContainer.innerHTML = createCompactNoData('Analytics error');
        }
    }

    function createCompactNoData(message) {
        return `
            <div style="
                text-align: center; 
                color: rgba(255,255,255,0.8); 
                padding: 20px 12px;
                font-size: 0.8rem;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            ">
                <div style="font-size: 1.5rem; margin-bottom: 6px; opacity: 0.6;">📭</div>
                <div>${message}</div>
            </div>
        `;
    }

    function showGSCDisconnected(tooltip) {
        const badge = tooltip.querySelector('#gsc-status-badge');
        const metricsContainer = tooltip.querySelector('#gsc-metrics-container');
        const queriesContainer = tooltip.querySelector('#gsc-queries-list');
        
        badge.textContent = '🔴 Not Connected';
        badge.style.background = 'rgba(239, 68, 68, 0.3)';
        
        const disconnectedMessage = `
            <div style="
                text-align: center; 
                color: rgba(255,255,255,0.8); 
                padding: 20px 12px;
                font-size: 0.8rem;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            ">
                <div style="font-size: 1.5rem; margin-bottom: 6px;">🔌</div>
                <div style="font-weight: 600; margin-bottom: 4px;">Connect Search Console</div>
                <div style="font-size: 0.75rem; opacity: 0.7;">Click GSC button to connect</div>
            </div>
        `;
        
        metricsContainer.innerHTML = disconnectedMessage;
        queriesContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.6); padding: 12px; font-size: 0.75rem;">Connect GSC for queries</div>';
    }

    function showGA4Disconnected(tooltip) {
        const badge = tooltip.querySelector('#ga4-status-badge');
        const metricsContainer = tooltip.querySelector('#ga4-metrics-container');
        
        badge.textContent = '🔴 Not Connected';
        badge.style.background = 'rgba(239, 68, 68, 0.3)';
        
        metricsContainer.innerHTML = `
            <div style="
                text-align: center; 
                color: rgba(255,255,255,0.8); 
                padding: 20px 12px;
                font-size: 0.8rem;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            ">
                <div style="font-size: 1.5rem; margin-bottom: 6px;">🔌</div>
                <div style="font-weight: 600; margin-bottom: 4px;">Connect Analytics</div>
                <div style="font-size: 0.75rem; opacity: 0.7;">Click GA4 button to connect</div>
            </div>
        `;
    }

    function formatDisplayValue(value) {
        if (typeof value === 'string') return value;
        const num = parseFloat(value) || 0;
        
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        if (num < 1 && num > 0) return num.toFixed(2);
        return Math.round(num).toLocaleString();
    }

    // Behavior functions...
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
                window.currentEnhancedTooltip.style.transform = 'translateY(8px) scale(0.96)';
                setTimeout(() => {
                    if (window.currentEnhancedTooltip) {
                        window.currentEnhancedTooltip.remove();
                        window.currentEnhancedTooltip = null;
                    }
                }, 250);
            }
        }
    }

    function positionTooltip(tooltip, event) {
        let left = event.pageX + 15;
        let top = event.pageY - 50;
        
        // Smart positioning
        const tooltipWidth = 400;
        const tooltipHeight = 450; // Estimated compact height
        
        // Keep it on screen
        left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - tooltipHeight - 10));
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function addModernHoverBehavior(tooltip) {
        tooltip.addEventListener('mouseenter', () => {
            clearTooltipTimers();
        });
        
        tooltip.addEventListener('mouseleave', () => {
            hideCompactTooltip();
        });
        
        tooltip.addEventListener('click', (e) => {
            const button = e.target.closest('.compact-action-btn');
            if (!button) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const action = button.dataset.action;
            const url = button.dataset.url;
            
            handleCompactAction(action, url, tooltip);
        });
    }

    function hideCompactTooltip(immediate = false) {
        const delay = immediate ? 0 : 150;
        
        window.enhancedHideTimer = setTimeout(() => {
            if (window.currentEnhancedTooltip) {
                window.currentEnhancedTooltip.style.opacity = '0';
                window.currentEnhancedTooltip.style.transform = 'translateY(8px) scale(0.96)';
                setTimeout(() => {
                    if (window.currentEnhancedTooltip) {
                        window.currentEnhancedTooltip.remove();
                        window.currentEnhancedTooltip = null;
                    }
                }, 250);
            }
        }, delay);
    }

    function handleCompactAction(action, url, tooltip) {
        switch (action) {
            case 'visit':
                if (url && url !== 'undefined') {
                    window.open(url, '_blank');
                }
                break;
            case 'refresh':
                if (tooltip && tooltip._nodeData) {
                    loadEnhancedAnalytics(tooltip, tooltip._nodeData);
                }
                break;
            case 'detailed':
                if (window.showDetailedGSCAnalysis && url && url !== 'undefined') {
                    window.showDetailedGSCAnalysis(url);
                }
                break;
        }
    }

    // Safe fallback functions (simplified for compactness)...
    function getPageInfoSafe(data) {
        try {
            if (typeof getPageInfo === 'function') {
                const treeContext = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
                const result = getPageInfo(data, treeContext);
                if (result && typeof result === 'object') {
                    return result;
                }
            }
            
            return {
                type: data.children?.length > 0 ? 'Category' : 'Content',
                depth: calculateDepthFromUrl(data.url),
                children: data.children?.length || 0,
                siblings: 0
            };
            
        } catch (error) {
            return {
                type: 'Page',
                depth: 1,
                children: 0,
                siblings: 0
            };
        }
    }

    function getFreshnessInfoSafe(data) {
        try {
            if (typeof getFreshnessInfo === 'function' && data.lastModified) {
                const freshnessData = getFreshnessInfo(data.lastModified);
                if (freshnessData && freshnessData.freshnessLabel) {
                    return {
                        badge: `<span style="background: ${freshnessData.freshnessColor}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">${freshnessData.freshnessLabel}</span>`
                    };
                }
            }
            
            if (data.lastModified) {
                let lastMod = new Date(data.lastModified);
                
                if (lastMod && !isNaN(lastMod.getTime())) {
                    const daysSince = Math.floor((new Date() - lastMod) / (1000 * 60 * 60 * 24));
                    
                    let color, label;
                    if (daysSince < 30) {
                        color = '#10b981'; label = 'New';
                    } else if (daysSince < 90) {
                        color = '#10b981'; label = 'Fresh';
                    } else if (daysSince < 180) {
                        color = '#f59e0b'; label = 'Recent';
                    } else if (daysSince < 365) {
                        color = '#f97316'; label = 'Aging';
                    } else if (daysSince < 730) {
                        color = '#ef4444'; label = 'Old';
                    } else {
                        color = '#dc2626'; label = 'Stale';
                    }
                    
                    return {
                        badge: `<span style="background: ${color}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">${label}</span>`
                    };
                }
            }
            
            return {
                badge: '<span style="background: #64748b; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">No Date</span>'
            };
            
        } catch (error) {
            return {
                badge: '<span style="background: #64748b; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">No Date</span>'
            };
        }
    }

    function calculateDepthFromUrl(url) {
        if (!url) return 0;
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.split('/').filter(segment => segment.length > 0).length;
        } catch {
            return url.split('/').filter(segment => segment.length > 0).length;
        }
    }

    // Install the compact tooltip system
    function installCompactTooltipSystem() {
        console.log('✅ Installing compact vertical tooltip...');
        
        window.showEnhancedTooltip = modernTooltipFunction;
        window.hideEnhancedTooltip = hideCompactTooltip;
        
        console.log('🎯 Compact vertical tooltip installed!');
    }

    // Initialize
    function initCompactTooltips() {
        let attempts = 0;
        const checkReady = () => {
            attempts++;
            const gscReady = !!window.GSCIntegration;
            const ga4Ready = !!window.GA4Integration;
            
            if ((gscReady || ga4Ready) || attempts >= 50) {
                installCompactTooltipSystem();
            } else {
                setTimeout(checkReady, 200);
            }
        };
        checkReady();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCompactTooltips);
    } else {
        initCompactTooltips();
    }

    console.log('🚀 Compact vertical tooltip loaded!');

})();
