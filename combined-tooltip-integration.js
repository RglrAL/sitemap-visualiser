// enhanced-combined-tooltip.js
// Modern tooltip with sleek loading, last edited date, better contrast, and top queries

(function() {
    console.log('🚀 Loading enhanced combined tooltip...');

    const modernTooltipFunction = function(event, d) {
        console.log('🎯 Enhanced tooltip for:', d.data?.name);
        
        if (!d.data) return;

        clearTooltipTimers();
        hideExistingTooltip(d.data);

        const tooltip = createEnhancedTooltip(d.data);
        positionTooltip(tooltip, event);
        
        document.body.appendChild(tooltip);
        window.currentEnhancedTooltip = tooltip;
        tooltip._nodeData = d.data;

        // Smooth entrance animation
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0) scale(1)';
        });

        addModernHoverBehavior(tooltip);
        loadEnhancedAnalytics(tooltip, d.data);
    };

    function createEnhancedTooltip(data) {
        const tooltip = document.createElement('div');
        tooltip.className = 'enhanced-modern-tooltip';
        
        tooltip.style.cssText = `
            position: absolute;
            background: white;
            border-radius: 20px;
            padding: 0;
            box-shadow: 
                0 25px 50px -12px rgba(0, 0, 0, 0.25),
                0 0 0 1px rgba(0, 0, 0, 0.05);
            z-index: 10000;
            max-width: 450px;
            opacity: 0;
            transform: translateY(12px) scale(0.94);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            pointer-events: auto;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.18);
        `;

        tooltip.innerHTML = createEnhancedContent(data);
        return tooltip;
    }

    function createEnhancedContent(data) {
        const pageInfo = getPageInfoSafe(data);
        const freshnessInfo = getFreshnessInfoSafe(data);
        const lastEditedInfo = getLastEditedInfo(data);

        return `
            <!-- Enhanced Header with Gradient -->
            <div style="
                padding: 24px 24px 20px 24px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                position: relative;
                overflow: hidden;
            ">
                <!-- Background Pattern -->
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    opacity: 0.1;
                    background-image: radial-gradient(circle at 25% 25%, white 2px, transparent 2px);
                    background-size: 20px 20px;
                "></div>
                
                <div style="position: relative; z-index: 2;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                        <div style="flex: 1; min-width: 0;">
                            <h3 style="
                                margin: 0 0 8px 0; 
                                font-size: 1.2rem; 
                                font-weight: 600; 
                                color: white;
                                line-height: 1.3;
                                display: -webkit-box;
                                -webkit-line-clamp: 2;
                                -webkit-box-orient: vertical;
                                overflow: hidden;
                                text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            ">
                                ${data.name || 'Page'}
                            </h3>
                            
                            ${data.url ? `
                                <a href="${data.url}" target="_blank" 
                                   style="
                                       font-size: 0.8rem; 
                                       color: rgba(255,255,255,0.9); 
                                       text-decoration: none;
                                       display: block;
                                       white-space: nowrap;
                                       overflow: hidden;
                                       text-overflow: ellipsis;
                                       margin-bottom: 8px;
                                       padding: 4px 8px;
                                       background: rgba(255,255,255,0.15);
                                       border-radius: 6px;
                                       backdrop-filter: blur(10px);
                                       transition: all 0.2s ease;
                                   " 
                                   onmouseover="this.style.background='rgba(255,255,255,0.25)'" 
                                   onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                                    🔗 ${data.url}
                                </a>
                            ` : ''}
                            
                            ${lastEditedInfo}
                        </div>
                        
                        <div style="flex-shrink: 0;">
                            ${freshnessInfo.badge}
                        </div>
                    </div>
                    
                    <!-- Enhanced Page Metrics -->
                    <div style="
                        display: grid; 
                        grid-template-columns: repeat(4, 1fr); 
                        gap: 12px; 
                        margin-top: 16px;
                    ">
                        ${createEnhancedMetricPill('Type', pageInfo.type, '📄')}
                        ${createEnhancedMetricPill('Level', `L${pageInfo.depth}`, '🏗️')}
                        ${createEnhancedMetricPill('Children', pageInfo.children.toString(), '👶', pageInfo.children > 0)}
                        ${createEnhancedMetricPill('Siblings', pageInfo.siblings.toString(), '👫', pageInfo.siblings > 0)}
                    </div>
                </div>
            </div>

            <!-- Enhanced Analytics Section -->
            <div style="padding: 24px;">
                
                <!-- Search Console with Top Queries -->
                <div id="enhanced-gsc-section" style="margin-bottom: 20px;">
                    <div style="
                        background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
                        border-radius: 16px;
                        overflow: hidden;
                        position: relative;
                    ">
                        <!-- Animated Background -->
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
                            background-size: 200% 200%;
                            animation: shimmer 3s ease-in-out infinite;
                        "></div>
                        
                        <div style="padding: 20px; position: relative; z-index: 2;">
                            <!-- Header -->
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="
                                        width: 32px; height: 32px; 
                                        background: rgba(255,255,255,0.2); 
                                        border-radius: 10px; 
                                        display: flex; align-items: center; justify-content: center;
                                        font-size: 1.1rem;
                                        backdrop-filter: blur(10px);
                                    ">🔍</div>
                                    <div>
                                        <div style="font-weight: 600; font-size: 1rem; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">Search Console</div>
                                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8);">Last 30 days vs Previous 30</div>
                                    </div>
                                </div>
                                <div id="gsc-status-badge" style="
                                    padding: 6px 12px; 
                                    background: rgba(255,255,255,0.2); 
                                    border-radius: 20px; 
                                    font-size: 0.75rem; 
                                    font-weight: 600;
                                    color: white;
                                    backdrop-filter: blur(10px);
                                    border: 1px solid rgba(255,255,255,0.3);
                                ">
                                    Loading...
                                </div>
                            </div>
                            
                            <!-- Main Metrics -->
                            <div id="gsc-metrics-container" style="margin-bottom: 16px;">
                                ${createAdvancedLoadingGrid()}
                            </div>
                            
                            <!-- Top Queries Section -->
                            <div id="gsc-queries-container" style="
                                background: rgba(255,255,255,0.15);
                                border-radius: 12px;
                                padding: 16px;
                                backdrop-filter: blur(10px);
                                border: 1px solid rgba(255,255,255,0.2);
                            ">
                                <div style="font-size: 0.9rem; font-weight: 600; color: white; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                    <span>🎯</span> Top Search Queries
                                </div>
                                <div id="gsc-queries-list">
                                    ${createQueryLoadingState()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Google Analytics -->
                <div id="enhanced-ga4-section" style="margin-bottom: 20px;">
                    <div style="
                        background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
                        border-radius: 16px;
                        overflow: hidden;
                        position: relative;
                    ">
                        <!-- Animated Background -->
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
                            background-size: 200% 200%;
                            animation: shimmer 3s ease-in-out infinite;
                        "></div>
                        
                        <div style="padding: 20px; position: relative; z-index: 2;">
                            <!-- Header -->
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="
                                        width: 32px; height: 32px; 
                                        background: rgba(255,255,255,0.2); 
                                        border-radius: 10px; 
                                        display: flex; align-items: center; justify-content: center;
                                        font-size: 1.1rem;
                                        backdrop-filter: blur(10px);
                                    ">📊</div>
                                    <div>
                                        <div style="font-weight: 600; font-size: 1rem; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">Google Analytics</div>
                                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8);">Last 30 days vs Previous 30</div>
                                    </div>
                                </div>
                                <div id="ga4-status-badge" style="
                                    padding: 6px 12px; 
                                    background: rgba(255,255,255,0.2); 
                                    border-radius: 20px; 
                                    font-size: 0.75rem; 
                                    font-weight: 600;
                                    color: white;
                                    backdrop-filter: blur(10px);
                                    border: 1px solid rgba(255,255,255,0.3);
                                ">
                                    Loading...
                                </div>
                            </div>
                            
                            <!-- GA4 Metrics -->
                            <div id="ga4-metrics-container">
                                ${createAdvancedLoadingGrid()}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Enhanced Action Bar -->
                <div style="
                    display: flex; 
                    gap: 10px; 
                    padding: 16px; 
                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
                    border-radius: 16px; 
                    border: 1px solid #e2e8f0;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);
                ">
                    <button class="enhanced-action-btn enhanced-action-primary" data-action="visit" data-url="${data.url}">
                        <span class="btn-icon">🚀</span>
                        <span class="btn-text">Visit Page</span>
                    </button>
                    <button class="enhanced-action-btn enhanced-action-secondary" data-action="refresh">
                        <span class="btn-icon">🔄</span>
                        <span class="btn-text">Refresh</span>
                    </button>
                    <button class="enhanced-action-btn enhanced-action-secondary" data-action="detailed" data-url="${data.url}">
                        <span class="btn-icon">📈</span>
                        <span class="btn-text">Full Report</span>
                    </button>
                </div>
            </div>

            <style>
                @keyframes shimmer {
                    0% { background-position: -200% -200%; }
                    100% { background-position: 200% 200%; }
                }
                
                @keyframes pulse-loading {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                }
                
                @keyframes slide-up {
                    from { transform: translateY(10px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                .loading-skeleton {
                    background: linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.2) 100%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s ease-in-out infinite;
                    border-radius: 6px;
                }
                
                .enhanced-action-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px 16px;
                    border: none;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
                    font-family: inherit;
                    position: relative;
                    overflow: hidden;
                }
                
                .enhanced-action-btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    transition: left 0.5s ease;
                }
                
                .enhanced-action-btn:hover::before {
                    left: 100%;
                }
                
                .enhanced-action-primary {
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
                }
                
                .enhanced-action-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
                }
                
                .enhanced-action-secondary {
                    background: white;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }
                
                .enhanced-action-secondary:hover {
                    background: #f8fafc;
                    color: #334155;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
                
                .btn-icon {
                    font-size: 1rem;
                }
            </style>
        `;
    }

    function createEnhancedMetricPill(label, value, icon, isActive = false) {
        return `
            <div style="
                text-align: center;
                background: rgba(255,255,255,0.2);
                border-radius: 12px;
                padding: 10px 8px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.3);
                transition: all 0.2s ease;
                ${isActive ? 'box-shadow: 0 0 0 2px rgba(255,255,255,0.5);' : ''}
            ">
                <div style="font-size: 0.9rem; margin-bottom: 2px;">${icon}</div>
                <div style="font-size: 0.9rem; font-weight: 700; color: white; margin-bottom: 2px;">${value}</div>
                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.8);">${label}</div>
            </div>
        `;
    }

    function createAdvancedLoadingGrid() {
        return `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                ${Array.from({length: 4}, () => `
                    <div style="
                        background: rgba(255,255,255,0.15); 
                        border-radius: 12px; 
                        padding: 16px; 
                        text-align: center;
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255,255,255,0.2);
                        position: relative;
                        overflow: hidden;
                    ">
                        <div style="height: 20px; width: 60%; margin: 0 auto 8px; background: rgba(255,255,255,0.3); border-radius: 4px;" class="loading-skeleton"></div>
                        <div style="height: 12px; width: 80%; margin: 0 auto 6px; background: rgba(255,255,255,0.2); border-radius: 4px;" class="loading-skeleton"></div>
                        <div style="height: 8px; width: 40%; margin: 0 auto; background: rgba(255,255,255,0.2); border-radius: 4px;" class="loading-skeleton"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function createQueryLoadingState() {
        return Array.from({length: 3}, (_, i) => `
            <div style="
                display: flex; 
                align-items: center; 
                gap: 12px; 
                padding: 12px 0; 
                ${i < 2 ? 'border-bottom: 1px solid rgba(255,255,255,0.2);' : ''}
            ">
                <div style="
                    width: 24px; 
                    height: 24px; 
                    background: rgba(255,255,255,0.3); 
                    border-radius: 50%; 
                    flex-shrink: 0;
                " class="loading-skeleton"></div>
                <div style="flex: 1;">
                    <div style="height: 14px; width: 70%; margin-bottom: 6px; background: rgba(255,255,255,0.3); border-radius: 4px;" class="loading-skeleton"></div>
                    <div style="height: 10px; width: 40%; background: rgba(255,255,255,0.2); border-radius: 4px;" class="loading-skeleton"></div>
                </div>
            </div>
        `).join('');
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
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const daysSince = Math.floor((new Date() - lastMod) / (1000 * 60 * 60 * 24));
        const relativeTime = daysSince === 0 ? 'today' :
                           daysSince === 1 ? 'yesterday' :
                           daysSince < 7 ? `${daysSince} days ago` :
                           daysSince < 30 ? `${Math.floor(daysSince / 7)} weeks ago` :
                           daysSince < 365 ? `${Math.floor(daysSince / 30)} months ago` :
                           `${Math.floor(daysSince / 365)} years ago`;
        
        return `
            <div style="
                background: rgba(255,255,255,0.15);
                padding: 8px 12px;
                border-radius: 8px;
                margin-top: 8px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
            ">
                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8); margin-bottom: 2px;">📅 Last Updated</div>
                <div style="font-size: 0.85rem; color: white; font-weight: 500;">${formattedDate} <span style="opacity: 0.8;">(${relativeTime})</span></div>
            </div>
        `;
    }

    function createHighContrastTrendCard(label, currentValue, previousValue, color = '#ffffff', icon = '') {
        const current = parseFloat(currentValue) || 0;
        const previous = parseFloat(previousValue) || 0;
        
        let percentChange = 0;
        let changeDirection = '→';
        let changeColor = '#fff';
        let changeBg = 'rgba(255,255,255,0.2)';
        
        if (previous > 0) {
            percentChange = ((current - previous) / previous) * 100;
            
            if (Math.abs(percentChange) < 2) {
                changeDirection = '→';
                changeColor = '#fff';
                changeBg = 'rgba(255,255,255,0.2)';
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
                border-radius: 12px; 
                padding: 16px; 
                text-align: center;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.25);
                position: relative;
                overflow: hidden;
                animation: slide-up 0.3s ease;
            ">
                <div style="font-size: 0.8rem; color: rgba(255,255,255,0.9); margin-bottom: 4px; font-weight: 500;">
                    ${icon} ${label}
                </div>
                
                <div style="font-size: 1.3rem; font-weight: 700; color: white; margin-bottom: 8px; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                    ${formatDisplayValue(current)}
                </div>
                
                <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <div style="
                        font-size: 0.75rem; 
                        color: ${changeColor}; 
                        font-weight: 700;
                        padding: 4px 8px;
                        background: ${changeBg};
                        border-radius: 20px;
                        display: flex;
                        align-items: center;
                        gap: 2px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    ">
                        <span>${changeDirection}</span>
                        <span>${Math.abs(percentChange).toFixed(0)}%</span>
                    </div>
                </div>
                
                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.7); margin-top: 4px;">
                    was ${formatDisplayValue(previous)}
                </div>
            </div>
        `;
    }

    function createTopQueryCard(query, index) {
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
                display: flex; 
                align-items: center; 
                gap: 12px; 
                padding: 12px 0; 
                ${index < 2 ? 'border-bottom: 1px solid rgba(255,255,255,0.2);' : ''}
                animation: slide-up 0.3s ease;
                animation-delay: ${index * 0.1}s;
                animation-fill-mode: both;
            ">
                <div style="
                    width: 28px; 
                    height: 28px; 
                    background: rgba(255,255,255,0.3); 
                    border-radius: 50%; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    font-weight: 700;
                    color: white;
                    font-size: 0.8rem;
                    flex-shrink: 0;
                    backdrop-filter: blur(10px);
                ">${index + 1}</div>
                
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        font-size: 0.85rem; 
                        font-weight: 600; 
                        color: white; 
                        margin-bottom: 4px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    ">"${query.query}"</div>
                    
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.7rem; color: rgba(255,255,255,0.8);">
                        <span>${query.clicks} clicks</span>
                        <span>•</span>
                        <span>#${query.position.toFixed(0)} avg</span>
                        <span>•</span>
                        <span>${(query.ctr * 100).toFixed(1)}% CTR</span>
                    </div>
                </div>
                
                <div style="
                    padding: 4px 8px;
                    background: ${oppColor};
                    color: white;
                    border-radius: 12px;
                    font-size: 0.65rem;
                    font-weight: 600;
                    flex-shrink: 0;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                ">${opportunity.label}</div>
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
        console.log('📈 Loading enhanced analytics for:', nodeData.name);
        
        // Load GSC trends with queries
        if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
            await loadEnhancedGSCTrends(tooltip, nodeData);
        } else {
            showGSCDisconnected(tooltip);
        }
        
        // Load GA4 trends  
        if (window.GA4Integration && window.GA4Integration.isConnected()) {
            await loadEnhancedGA4Trends(tooltip, nodeData);
        } else {
            showGA4Disconnected(tooltip);
        }
    }

    async function loadEnhancedGSCTrends(tooltip, nodeData) {
        const badge = tooltip.querySelector('#gsc-status-badge');
        const metricsContainer = tooltip.querySelector('#gsc-metrics-container');
        const queriesContainer = tooltip.querySelector('#gsc-queries-list');
        
        try {
            badge.textContent = '🟢 Connected';
            badge.style.background = 'rgba(16, 185, 129, 0.3)';
            
            // Fetch current data with enhanced details
            const currentData = await window.GSCIntegration.fetchNodeData(nodeData);
            
            if (!currentData || currentData.noDataFound) {
                metricsContainer.innerHTML = createNoDataMessage('No search data available');
                queriesContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 20px;">📭 No query data available</div>';
                return;
            }
            
            // Fetch previous period data
            const previousData = await window.GSCIntegration.fetchPreviousPeriodData(nodeData);
            
            // Update metrics with high contrast
            metricsContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    ${createHighContrastTrendCard('Clicks', currentData.clicks, previousData?.clicks || 0, '#fff', '🎯')}
                    ${createHighContrastTrendCard('Impressions', currentData.impressions, previousData?.impressions || 0, '#fff', '👁️')}
                    ${createHighContrastTrendCard('CTR', `${(currentData.ctr * 100).toFixed(1)}%`, `${((previousData?.ctr || 0) * 100).toFixed(1)}%`, '#fff', '⚡')}
                    ${createHighContrastTrendCard('Position', currentData.position.toFixed(1), (previousData?.position || 0).toFixed(1), '#fff', '📍')}
                </div>
            `;
            
            // Update top queries
            if (currentData.topQueries && currentData.topQueries.length > 0) {
                queriesContainer.innerHTML = currentData.topQueries.slice(0, 3)
                    .map((query, index) => createTopQueryCard(query, index))
                    .join('');
            } else {
                queriesContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 20px; font-size: 0.85rem;">📭 No top queries data available</div>';
            }
            
        } catch (error) {
            console.error('Enhanced GSC trend error:', error);
            badge.textContent = '🔴 Error';
            badge.style.background = 'rgba(239, 68, 68, 0.3)';
            metricsContainer.innerHTML = createNoDataMessage('Failed to load search data');
            queriesContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 20px;">❌ Failed to load queries</div>';
        }
    }

    async function loadEnhancedGA4Trends(tooltip, nodeData) {
        const badge = tooltip.querySelector('#ga4-status-badge');
        const metricsContainer = tooltip.querySelector('#ga4-metrics-container');
        
        try {
            badge.textContent = '🟢 Connected';
            badge.style.background = 'rgba(16, 185, 129, 0.3)';
            
            const currentData = await window.GA4Integration.fetchData(nodeData.url);
            
            if (!currentData || currentData.noDataFound) {
                metricsContainer.innerHTML = createNoDataMessage('No analytics data available');
                return;
            }
            
            const previousData = await window.GA4Integration.fetchPreviousPeriodData(nodeData.url);
            
            metricsContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    ${createHighContrastTrendCard('Users', currentData.users || 0, previousData?.users || 0, '#fff', '👥')}
                    ${createHighContrastTrendCard('Page Views', currentData.pageViews || 0, previousData?.pageViews || 0, '#fff', '📄')}
                    ${createHighContrastTrendCard('Sessions', currentData.sessions || 0, previousData?.sessions || 0, '#fff', '🔄')}
                    ${createHighContrastTrendCard('Bounce Rate', `${((currentData.bounceRate || 0) * 100).toFixed(0)}%`, `${((previousData?.bounceRate || 0) * 100).toFixed(0)}%`, '#fff', '⚽')}
                </div>
            `;
            
        } catch (error) {
            console.error('Enhanced GA4 trend error:', error);
            badge.textContent = '🔴 Error';
            badge.style.background = 'rgba(239, 68, 68, 0.3)';
            metricsContainer.innerHTML = createNoDataMessage('Failed to load analytics data');
        }
    }

    function createNoDataMessage(message) {
        return `
            <div style="
                text-align: center; 
                color: rgba(255,255,255,0.8); 
                padding: 32px 20px;
                font-size: 0.9rem;
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <div style="font-size: 2rem; margin-bottom: 12px; opacity: 0.6;">📭</div>
                <div style="font-weight: 500; margin-bottom: 6px;">${message}</div>
                <div style="font-size: 0.8rem; opacity: 0.7;">
                    This page may not have data for the selected period
                </div>
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
                padding: 32px 20px;
                font-size: 0.9rem;
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <div style="font-size: 2rem; margin-bottom: 12px;">🔌</div>
                <div style="font-weight: 600; margin-bottom: 8px;">Connect Search Console</div>
                <div style="font-size: 0.8rem; opacity: 0.7;">
                    Click the GSC button in the toolbar to see search performance trends
                </div>
            </div>
        `;
        
        metricsContainer.innerHTML = disconnectedMessage;
        queriesContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.6); padding: 16px; font-size: 0.8rem;">Connect GSC to see top queries</div>';
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
                padding: 32px 20px;
                font-size: 0.9rem;
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <div style="font-size: 2rem; margin-bottom: 12px;">🔌</div>
                <div style="font-weight: 600; margin-bottom: 8px;">Connect Google Analytics</div>
                <div style="font-size: 0.8rem; opacity: 0.7;">
                    Click the GA4 button in the toolbar to see user behavior trends
                </div>
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

    // Keep all your existing behavior functions...
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
                window.currentEnhancedTooltip.style.transform = 'translateY(12px) scale(0.94)';
                setTimeout(() => {
                    if (window.currentEnhancedTooltip) {
                        window.currentEnhancedTooltip.remove();
                        window.currentEnhancedTooltip = null;
                    }
                }, 300);
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
            hideEnhancedTooltip();
        });
        
        tooltip.addEventListener('click', (e) => {
            const button = e.target.closest('.enhanced-action-btn');
            if (!button) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const action = button.dataset.action;
            const url = button.dataset.url;
            
            handleEnhancedAction(action, url, tooltip);
        });
    }

    function hideEnhancedTooltip(immediate = false) {
        const delay = immediate ? 0 : 200;
        
        window.enhancedHideTimer = setTimeout(() => {
            if (window.currentEnhancedTooltip) {
                window.currentEnhancedTooltip.style.opacity = '0';
                window.currentEnhancedTooltip.style.transform = 'translateY(12px) scale(0.94)';
                setTimeout(() => {
                    if (window.currentEnhancedTooltip) {
                        window.currentEnhancedTooltip.remove();
                        window.currentEnhancedTooltip = null;
                    }
                }, 300);
            }
        }, delay);
    }

    function handleEnhancedAction(action, url, tooltip) {
        console.log('🎯 Enhanced action:', action);
        
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

    // Keep your safe fallback functions...
    function getPageInfoSafe(data) {
        try {
            if (typeof getPageInfo === 'function') {
                const treeContext = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
                const result = getPageInfo(data, treeContext);
                if (result && typeof result === 'object') {
                    return result;
                }
            }
            
            const treeContext = window.treeData || (typeof treeData !== 'undefined' ? treeData : null);
            if (treeContext && data.url) {
                const nodeInfo = findNodeInTreeStructure(treeContext, data.url);
                if (nodeInfo.found) {
                    return {
                        type: determinePageType(nodeInfo.node, nodeInfo.depth, nodeInfo.hasChildren),
                        depth: nodeInfo.depth,
                        children: nodeInfo.children,
                        siblings: nodeInfo.siblings
                    };
                }
            }
            
            return {
                type: data.children?.length > 0 ? 'Category' : 'Content Page',
                depth: calculateDepthFromUrl(data.url),
                children: data.children?.length || 0,
                siblings: 0
            };
            
        } catch (error) {
            console.warn('Error getting page info:', error);
            return {
                type: 'Content Page',
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
                        badge: `<span style="background: ${freshnessData.freshnessColor}; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${freshnessData.freshnessLabel}</span>`
                    };
                }
            }
            
            if (data.lastModified) {
                let lastMod;
                if (typeof data.lastModified === 'string') {
                    lastMod = new Date(data.lastModified);
                } else if (data.lastModified instanceof Date) {
                    lastMod = data.lastModified;
                }
                
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
                        badge: `<span style="background: ${color}; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${label}</span>`
                    };
                }
            }
            
            return {
                badge: '<span style="background: #64748b; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">No Date</span>'
            };
            
        } catch (error) {
            console.warn('Error getting freshness info:', error);
            return {
                badge: '<span style="background: #64748b; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">No Date</span>'
            };
        }
    }

    // Keep other helper functions...
    function findNodeInTreeStructure(treeData, targetUrl) {
        const result = { found: false, node: null, depth: 0, children: 0, siblings: 0, hasChildren: false };

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

    function determinePageType(node, depth, hasChildren) {
        if (depth === 0) return 'Homepage';
        if (node.url && node.url.match(/\/(en|ga|ie)\/?$/)) return 'Language Root';
        
        if (hasChildren) {
            if (depth === 1) return 'Main Category';
            if (depth === 2) return 'Sub-Category';
            return 'Category';
        } else {
            if (depth === 1) return 'Root Page';
            return 'Content Page';
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

    // Install the enhanced tooltip system
    function installEnhancedTooltipSystem() {
        console.log('✅ Installing enhanced tooltip system...');
        
        window.showEnhancedTooltip = modernTooltipFunction;
        window.hideEnhancedTooltip = hideEnhancedTooltip;
        
        console.log('🎯 Enhanced combined tooltip installed!');
    }

    // Initialize
    function initEnhancedTooltips() {
        let attempts = 0;
        const checkReady = () => {
            attempts++;
            const gscReady = !!window.GSCIntegration;
            const ga4Ready = !!window.GA4Integration;
            
            if ((gscReady || ga4Ready) || attempts >= 50) {
                installEnhancedTooltipSystem();
            } else {
                setTimeout(checkReady, 200);
            }
        };
        checkReady();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEnhancedTooltips);
    } else {
        initEnhancedTooltips();
    }

    console.log('🚀 Enhanced combined tooltip loaded!');

})();
