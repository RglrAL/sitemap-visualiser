// enhanced-tabbed-tooltip.js
// Modern tooltip with sleek tabs for GSC and GA4 data

(function() {
    console.log('🚀 Loading enhanced tabbed tooltip...');

    const modernTooltipFunction = function(event, d) {
        console.log('🎯 Enhanced tabbed tooltip for:', d.data?.name);
        
        if (!d.data) return;

        clearTooltipTimers();
        hideExistingTooltip(d.data);

        const tooltip = createEnhancedTabbedTooltip(d.data);
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

    function createEnhancedTabbedTooltip(data) {
        const tooltip = document.createElement('div');
        tooltip.className = 'enhanced-tabbed-tooltip';
        
        tooltip.style.cssText = `
            position: absolute;
            background: white;
            border-radius: 20px;
            padding: 0;
            box-shadow: 
                0 25px 50px -12px rgba(0, 0, 0, 0.25),
                0 0 0 1px rgba(0, 0, 0, 0.05);
            z-index: 10000;
            max-width: 420px;
            width: 420px;
            opacity: 0;
            transform: translateY(12px) scale(0.94);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            pointer-events: auto;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.18);
        `;

        tooltip.innerHTML = createTabbedContent(data);
        
        // Initialize tabs after content is created
        setTimeout(() => initializeTabs(tooltip), 50);
        
        return tooltip;
    }

    function createTabbedContent(data) {
        const pageInfo = getPageInfoSafe(data);
        const freshnessInfo = getFreshnessInfoSafe(data);
        const lastEditedInfo = getLastEditedInfo(data);

        return `
            <!-- Enhanced Header with Gradient -->
            <div style="
                padding: 20px 24px 16px 24px; 
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
                                font-size: 1.1rem; 
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
                                       font-size: 0.75rem; 
                                       color: rgba(255,255,255,0.9); 
                                       text-decoration: none;
                                       display: block;
                                       white-space: nowrap;
                                       overflow: hidden;
                                       text-overflow: ellipsis;
                                       padding: 3px 8px;
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
                        </div>
                        
                        <div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                            ${freshnessInfo.badge}
                            ${lastEditedInfo ? `<div style="font-size: 0.7rem; color: rgba(255,255,255,0.8);">📅 ${getShortDate(data.lastModified)}</div>` : ''}
                        </div>
                    </div>
                    
                    <!-- Compact Page Metrics -->
                    <div style="
                        display: grid; 
                        grid-template-columns: repeat(4, 1fr); 
                        gap: 8px; 
                        margin-top: 12px;
                    ">
                        ${createCompactMetricPill('Type', pageInfo.type, '📄')}
                        ${createCompactMetricPill('Level', `L${pageInfo.depth}`, '🏗️')}
                        ${createCompactMetricPill('Children', pageInfo.children.toString(), '👶', pageInfo.children > 0)}
                        ${createCompactMetricPill('Siblings', pageInfo.siblings.toString(), '👫', pageInfo.siblings > 0)}
                    </div>
                </div>
            </div>

            <!-- Tab Navigation -->
            <div style="
                padding: 0 24px;
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                border-bottom: 1px solid rgba(0,0,0,0.05);
            ">
                <div class="tab-nav" style="
                    display: flex;
                    gap: 0;
                    margin: 0;
                    padding: 0;
                ">
                    <button class="tab-btn active" data-tab="search" style="
                        flex: 1;
                        padding: 12px 16px;
                        border: none;
                        background: none;
                        font-size: 0.85rem;
                        font-weight: 600;
                        cursor: pointer;
                        color: #64748b;
                        border-bottom: 3px solid transparent;
                        transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
                        position: relative;
                        font-family: inherit;
                    ">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span style="font-size: 1rem;">🔍</span>
                            <span>Search Console</span>
                            <div class="connection-dot" id="gsc-dot" style="
                                width: 6px; 
                                height: 6px; 
                                border-radius: 50%; 
                                background: #94a3b8;
                                transition: background 0.2s ease;
                            "></div>
                        </div>
                    </button>
                    <button class="tab-btn" data-tab="analytics" style="
                        flex: 1;
                        padding: 12px 16px;
                        border: none;
                        background: none;
                        font-size: 0.85rem;
                        font-weight: 600;
                        cursor: pointer;
                        color: #64748b;
                        border-bottom: 3px solid transparent;
                        transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
                        position: relative;
                        font-family: inherit;
                    ">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span style="font-size: 1rem;">📊</span>
                            <span>Analytics</span>
                            <div class="connection-dot" id="ga4-dot" style="
                                width: 6px; 
                                height: 6px; 
                                border-radius: 50%; 
                                background: #94a3b8;
                                transition: background 0.2s ease;
                            "></div>
                        </div>
                    </button>
                </div>
            </div>

            <!-- Tab Content -->
            <div class="tab-content" style="
                padding: 20px 24px;
                min-height: 200px;
                max-height: 300px;
                overflow-y: auto;
            ">
                <!-- Search Console Tab -->
                <div class="tab-panel active" data-panel="search">
                    <div id="gsc-metrics-container" style="margin-bottom: 16px;">
                        ${createAdvancedLoadingGrid()}
                    </div>
                    
                    <!-- Top Queries Section -->
                    <div style="
                        background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
                        border-radius: 12px;
                        padding: 16px;
                        border: 1px solid #e2e8f0;
                    ">
                        <div style="font-size: 0.9rem; font-weight: 600; color: #334155; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                            <span>🎯</span> Top Search Queries
                        </div>
                        <div id="gsc-queries-list">
                            ${createQueryLoadingState()}
                        </div>
                    </div>
                </div>
                
                <!-- Analytics Tab -->
                <div class="tab-panel" data-panel="analytics" style="display: none;">
                    <div id="ga4-metrics-container">
                        ${createAdvancedLoadingGrid()}
                    </div>
                    
                    <!-- Additional Analytics Insights -->
                    <div style="
                        background: linear-gradient(135deg, #fef7f0 0%, #fed7aa 100%);
                        border-radius: 12px;
                        padding: 16px;
                        border: 1px solid #fed7aa;
                        margin-top: 16px;
                    ">
                        <div style="font-size: 0.9rem; font-weight: 600; color: #9a3412; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            <span>💡</span> Performance Insights
                        </div>
                        <div id="ga4-insights" style="font-size: 0.8rem; color: #9a3412; opacity: 0.8;">
                            Loading performance insights...
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Floating Action Button -->
            <div class="floating-actions" style="
                position: absolute;
                bottom: -20px;
                right: 20px;
                display: flex;
                gap: 8px;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: 10001;
            ">
                <button class="fab-btn" data-action="visit" data-url="${data.url}" style="
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: none;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
                    transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">🚀</button>
                
                <button class="fab-btn" data-action="refresh" style="
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: none;
                    background: white;
                    color: #64748b;
                    font-size: 1.1rem;
                    cursor: pointer;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                    border: 1px solid #e2e8f0;
                    transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">🔄</button>
            </div>

            <style>
                .enhanced-tabbed-tooltip:hover .floating-actions {
                    opacity: 1;
                    transform: translateY(0);
                }
                
                .tab-btn.active {
                    color: #1e293b !important;
                    border-bottom-color: #3b82f6 !important;
                    background: linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.05)) !important;
                }
                
                .tab-btn:hover:not(.active) {
                    color: #475569;
                    background: rgba(0,0,0,0.02);
                }
                
                .fab-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 30px rgba(0,0,0,0.25);
                }
                
                .loading-skeleton {
                    background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s ease-in-out infinite;
                    border-radius: 6px;
                }
                
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                
                /* Custom scrollbar */
                .tab-content::-webkit-scrollbar {
                    width: 4px;
                }
                
                .tab-content::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 2px;
                }
                
                .tab-content::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 2px;
                }
                
                .tab-content::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            </style>
        `;
    }

    function createCompactMetricPill(label, value, icon, isActive = false) {
        return `
            <div style="
                text-align: center;
                background: rgba(255,255,255,0.2);
                border-radius: 10px;
                padding: 8px 6px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.3);
                transition: all 0.2s ease;
                ${isActive ? 'box-shadow: 0 0 0 2px rgba(255,255,255,0.5);' : ''}
            ">
                <div style="font-size: 0.8rem; margin-bottom: 1px;">${icon}</div>
                <div style="font-size: 0.8rem; font-weight: 700; color: white; margin-bottom: 1px;">${value}</div>
                <div style="font-size: 0.65rem; color: rgba(255,255,255,0.8);">${label}</div>
            </div>
        `;
    }

    function initializeTabs(tooltip) {
        const tabBtns = tooltip.querySelectorAll('.tab-btn');
        const tabPanels = tooltip.querySelectorAll('.tab-panel');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // Update buttons
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update panels with smooth transition
                tabPanels.forEach(panel => {
                    if (panel.dataset.panel === targetTab) {
                        panel.style.display = 'block';
                        panel.style.opacity = '0';
                        panel.style.transform = 'translateX(20px)';
                        
                        requestAnimationFrame(() => {
                            panel.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                            panel.style.opacity = '1';
                            panel.style.transform = 'translateX(0)';
                        });
                    } else {
                        panel.style.opacity = '0';
                        panel.style.transform = 'translateX(-20px)';
                        setTimeout(() => {
                            panel.style.display = 'none';
                        }, 300);
                    }
                });
            });
        });
    }

    function getShortDate(lastModified) {
        if (!lastModified) return '';
        
        let lastMod;
        if (typeof lastModified === 'string') {
            lastMod = new Date(lastModified);
        } else if (lastModified instanceof Date) {
            lastMod = lastModified;
        }
        
        if (!lastMod || isNaN(lastMod.getTime())) return '';
        
        const daysSince = Math.floor((new Date() - lastMod) / (1000 * 60 * 60 * 24));
        if (daysSince === 0) return 'today';
        if (daysSince === 1) return 'yesterday';
        if (daysSince < 7) return `${daysSince}d ago`;
        if (daysSince < 30) return `${Math.floor(daysSince / 7)}w ago`;
        if (daysSince < 365) return `${Math.floor(daysSince / 30)}mo ago`;
        return `${Math.floor(daysSince / 365)}y ago`;
    }

    // Update connection indicators
    function updateConnectionStatus() {
        const gscDot = document.getElementById('gsc-dot');
        const ga4Dot = document.getElementById('ga4-dot');
        
        if (gscDot) {
            gscDot.style.background = window.GSCIntegration?.isConnected() ? '#10b981' : '#ef4444';
        }
        if (ga4Dot) {
            ga4Dot.style.background = window.GA4Integration?.isConnected() ? '#10b981' : '#ef4444';
        }
    }

    // Enhanced loading functions (keeping your existing ones but updating UI elements)
    async function loadEnhancedAnalytics(tooltip, nodeData) {
        console.log('📈 Loading tabbed analytics for:', nodeData.name);
        
        updateConnectionStatus();
        
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

    // Keep your existing loading functions but update for the new layout...
    // [The rest of your loading functions would go here with minimal changes]
    
    // Installation and initialization
    function installEnhancedTooltipSystem() {
        console.log('✅ Installing enhanced tabbed tooltip system...');
        
        window.showEnhancedTooltip = modernTooltipFunction;
        window.hideEnhancedTooltip = hideEnhancedTooltip;
        
        console.log('🎯 Enhanced tabbed tooltip installed!');
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

    console.log('🚀 Enhanced tabbed tooltip loaded!');

})();
