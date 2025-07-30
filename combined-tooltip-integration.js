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
            max-width: 450px;
            width: 450px;
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
                padding: 20px 24px 20px 24px; 
                background: linear-gradient(135deg, #5a8200 0%, #72A300 100%);
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

                <!-- Close Button -->
<button class="tooltip-close-btn" style="
    position: absolute;
    top: 0px;
    right: 0px;
    width: 32px;
    height: 32px;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    transition: all 0.2s ease;
    z-index: 10;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
" 
onmouseover="
    this.style.background='rgba(255, 255, 255, 0.3)';
    this.style.transform='scale(1.1)';
" 
onmouseout="
    this.style.background='rgba(255, 255, 255, 0.2)';
    this.style.transform='scale(1)';
">✕</button>
                
                    <!-- Page Title and URL -->
                    <div style="margin-bottom: 16px;">
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
                            padding-right: 20px;
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
                                   margin-right: 20px;
                               " 
                               onmouseover="this.style.background='rgba(255,255,255,0.25)'" 
                               onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                                ${data.url}
                            </a>
                        ` : ''}
                    </div>
                    
                    <!-- Page Information Grid -->
                    <div style="
                        display: grid; 
                        grid-template-columns: 1fr 1fr 1fr; 
                        gap: 12px; 
                        margin-top: 16px;
                    ">
                        <!-- Page Type & Hierarchy -->
                        <div style="
                            background: rgba(255,255,255,0.15);
                            padding: 12px 14px;
                            border-radius: 10px;
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255,255,255,0.25);
                            text-align: center;
                        ">
                            <div style="font-size: 0.7rem; color: rgba(255,255,255,0.8); margin-bottom: 4px; letter-spacing: 0.5px;">Page Info</div>
                            <div style="font-size: 0.9rem; font-weight: 700; color: white; margin-bottom: 2px; line-height: 1.2;">${pageInfo.type}</div>
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.9); font-weight: 500;">Level ${pageInfo.depth}</div>
                        </div>
                        
                        <!-- Site Structure -->
                        <div style="
                            background: rgba(255,255,255,0.15);
                            padding: 12px 14px;
                            border-radius: 10px;
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255,255,255,0.25);
                            text-align: center;
                        ">
                            <div style="font-size: 0.7rem; color: rgba(255,255,255,0.8); margin-bottom: 4px;  letter-spacing: 0.5px;">Structure</div>
                            <div style="font-size: 0.85rem; color: white; font-weight: 600; margin-bottom: 2px;">
                                <span style="font-size: 0.9rem; font-weight: 700;">${pageInfo.children}</span> Children
                            </div>
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.9); font-weight: 500;">
                                <span style="font-weight: 600;">${pageInfo.siblings}</span> Siblings
                            </div>
                        </div>
                        
                        <!-- Last Updated -->
                        ${lastEditedInfo ? `
                            <div style="
                                background: rgba(255,255,255,0.15);
                                padding: 12px 14px;
                                border-radius: 10px;
                                backdrop-filter: blur(10px);
                                border: 1px solid rgba(255,255,255,0.25);
                                text-align: center;
                            ">
                                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.8); margin-bottom: 4px; letter-spacing: 0.5px;">Updated</div>
                                <div style="font-size: 0.85rem; font-weight: 700; color: white; margin-bottom: 2px; line-height: 1.2;">${getFormattedDate(data.lastModified)}</div>
                                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.9); font-weight: 500;">${getRelativeTime(data.lastModified)}</div>
                            </div>
                        ` : `
                            <div style="
                                background: rgba(255,255,255,0.1);
                                padding: 12px 14px;
                                border-radius: 10px;
                                backdrop-filter: blur(10px);
                                border: 1px solid rgba(255,255,255,0.15);
                                text-align: center;
                            ">
                                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.6); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Updated</div>
                                <div style="font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.7); margin-bottom: 2px;">Unknown</div>
                                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6);">No date</div>
                                                   
                            </div>
                        `}
                    </div>

                     <!-- Freshness Badge Row -->
                    <div style="
                        display: flex;
                        justify-content: center;
                        margin-top: 12px;
                    ">
                        ${freshnessInfo.badge}
                    </div>

                </div>
            </div>

            <!-- Tab Navigation -->
            <div style="
                padding: 0 24px;
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                border-bottom: 1px solid rgba(0,0,0,0.05);
                position: relative;
            ">
                <!-- Loading Progress Bar -->
                <div id="loading-progress" style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 4px;
                    background: linear-gradient(90deg, #5a8200, #72A300, #84cc16, #a3e635);
                    background-size: 300% 100%;
                    animation: loading-sweep 1.8s ease-in-out infinite;
                    border-radius: 0 0 2px 2px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    z-index: 10;
                    box-shadow: 0 2px 8px rgba(90, 130, 0, 0.3);
                "></div>
                
                <!-- Subtle loading pulse overlay -->
                <div id="loading-overlay" style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.05) 50%, transparent 70%);
                    background-size: 200% 200%;
                    animation: shimmer-slow 3s ease-in-out infinite;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                "></div>
                
                <div class="tab-nav" style="
                    display: flex;
                    gap: 0;
                    margin: 0;
                    padding: 0;
                ">
                    
                    <button class="tab-btn active" data-tab="analytics" style="
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
                            <svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink: 0;">
                                <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                            </svg>
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
                    <button class="tab-btn" data-tab="search" style="
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
                            <svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink: 0;">
                                <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
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
                </div>
            </div>

            <!-- Time Period Info -->
            <div style="
                padding: 12px 24px;
                background: #f1f5f9;
                border-bottom: 1px solid #e2e8f0;
                font-size: 0.8rem;
                color: #64748b;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            ">
                <span>📅</span>
                <span>Comparing <strong>Last 30 days</strong> vs <strong>Previous 30 days</strong></span>
            </div>

            <!-- Tab Content -->
            <div class="tab-content" style="
                padding: 24px;
                min-height: 320px;
                max-height: 400px;
                overflow-y: auto;
            ">
                <!-- Search Console Tab -->
                <div class="tab-panel" data-panel="search" style="display: none;">
                    <div id="gsc-metrics-container" style="margin-bottom: 20px;">
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
                            <svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink: 0;">
                                <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span>Top Search Queries</span>
                        </div>
                        <div id="gsc-queries-list">
                            ${createQueryLoadingState()}
                        </div>
                    </div>
                </div>
                
                <!-- Analytics Tab -->
                <div class="tab-panel active" data-panel="analytics">
                    <div id="ga4-metrics-container" style="margin-bottom: 20px;">
                        ${createAdvancedLoadingGrid()}
                    </div>
                    
                    <!-- Additional Analytics Insights -->
                    <div style="
                        background: linear-gradient(135deg, #fef7f0 0%, #fed7aa 100%);
                        border-radius: 12px;
                        padding: 16px;
                        border: 1px solid #fed7aa;
                    ">
                        <div style="font-size: 0.9rem; font-weight: 600; color: #9a3412; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink: 0;">
                                <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                            </svg>
                            <span>Performance Insights</span>
                        </div>
                        <div id="ga4-insights" style="font-size: 0.8rem; color: #9a3412; opacity: 0.8;">
                            Connect GA4 for performance insights
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div style="
                padding: 16px 24px;
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
            ">
                <button class="action-btn primary" data-action="visit" data-url="${data.url}">
                    <span class="btn-icon">🚀</span>
                    <span class="btn-text">Visit Page</span>
                </button>
                <button class="action-btn secondary" data-action="refresh">
                    <span class="btn-icon">🔄</span>
                    <span class="btn-text">Refresh</span>
                </button>
                <button class="action-btn secondary" data-action="detailed" data-url="${data.url}">
                    <span class="btn-icon">📈</span>
                    <span class="btn-text">Full Report</span>
                </button>
            </div>

            <style>
                @keyframes loading-sweep {
                    0% { 
                        width: 0%; 
                        background-position: -300% 0;
                    }
                    50% { 
                        width: 100%; 
                        background-position: 0% 0;
                    }
                    100% { 
                        width: 100%; 
                        background-position: 300% 0;
                    }
                }
                
                @keyframes shimmer-slow {
                    0% { background-position: -200% -200%; }
                    100% { background-position: 200% 200%; }
                }
                
                .loading-active #loading-progress,
                .loading-active #loading-overlay {
                    opacity: 1 !important;
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
                
                .action-btn {
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
                
                .action-btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    transition: left 0.5s ease;
                }
                
                .action-btn:hover::before {
                    left: 100%;
                }
                
                .action-btn.primary {
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
                }
                
                .action-btn.primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
                }
                
                .action-btn.secondary {
                    background: white;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }
                
                .action-btn.secondary:hover {
                    background: #f8fafc;
                    color: #334155;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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

    function getFormattedDate(lastModified) {
        if (!lastModified) return '';
        
        let lastMod;
        if (typeof lastModified === 'string') {
            lastMod = new Date(lastModified);
        } else if (lastModified instanceof Date) {
            lastMod = lastModified;
        }
        
        if (!lastMod || isNaN(lastMod.getTime())) return '';
        
        return lastMod.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function getRelativeTime(lastModified) {
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

    function showLoadingProgress(tooltip) {
        const progressBar = tooltip.querySelector('#loading-progress');
        if (progressBar) {
            tooltip.classList.add('loading-active');
        }
    }

    function hideLoadingProgress(tooltip) {
        const progressBar = tooltip.querySelector('#loading-progress');
        if (progressBar) {
            tooltip.classList.remove('loading-active');
        }
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
        showLoadingProgress(tooltip);
        
        try {
            // Load GSC and GA4 data in parallel
            const promises = [];
            
            if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
                promises.push(loadEnhancedGSCTrends(tooltip, nodeData));
            } else {
                showGSCDisconnected(tooltip);
            }
            
            if (window.GA4Integration && window.GA4Integration.isConnected()) {
                promises.push(loadEnhancedGA4Trends(tooltip, nodeData));
            } else {
                showGA4Disconnected(tooltip);
            }
            
            // Wait for all data to load
            await Promise.allSettled(promises);
            
        } finally {
            // Hide loading progress after a short delay to show completion
            setTimeout(() => hideLoadingProgress(tooltip), 500);
        }
    }

    async function loadEnhancedGSCTrends(tooltip, nodeData) {
        const metricsContainer = tooltip.querySelector('#gsc-metrics-container');
        const queriesContainer = tooltip.querySelector('#gsc-queries-list');
        
        try {
            // Fetch current data with enhanced details
            const currentData = await window.GSCIntegration.fetchNodeData(nodeData);
            
            if (!currentData || currentData.noDataFound) {
                metricsContainer.innerHTML = createNoDataMessage('No search data available');
                queriesContainer.innerHTML = '<div style="text-align: center; color: #64748b; padding: 20px;">📭 No query data available</div>';
                return;
            }
            
            // Fetch previous period data
            const previousData = await window.GSCIntegration.fetchPreviousPeriodData(nodeData);
            
            // Update metrics
            metricsContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    ${createTrendCard('Clicks', currentData.clicks, previousData?.clicks || 0, '#3b82f6', '🎯')}
                    ${createTrendCard('Impressions', currentData.impressions, previousData?.impressions || 0, '#06b6d4', '👁️')}
                    ${createTrendCard('CTR', `${(currentData.ctr * 100).toFixed(1)}%`, `${((previousData?.ctr || 0) * 100).toFixed(1)}%`, '#10b981', '⚡')}
                    ${createTrendCard('Position', currentData.position.toFixed(1), (previousData?.position || 0).toFixed(1), '#f59e0b', '📍')}
                </div>
            `;
            
            // Update top queries
            if (currentData.topQueries && currentData.topQueries.length > 0) {
                queriesContainer.innerHTML = currentData.topQueries.slice(0, 3)
                    .map((query, index) => createTopQueryCard(query, index))
                    .join('');
            } else {
                queriesContainer.innerHTML = '<div style="text-align: center; color: #64748b; padding: 20px; font-size: 0.85rem;">📭 No top queries data available</div>';
            }
            
        } catch (error) {
            console.error('Enhanced GSC trend error:', error);
            metricsContainer.innerHTML = createNoDataMessage('Failed to load search data');
            queriesContainer.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">❌ Failed to load queries</div>';
        }
    }

    async function loadEnhancedGA4Trends(tooltip, nodeData) {
        const metricsContainer = tooltip.querySelector('#ga4-metrics-container');
        const insightsContainer = tooltip.querySelector('#ga4-insights');
        
        try {
            const currentData = await window.GA4Integration.fetchData(nodeData.url);
            
            if (!currentData || currentData.noDataFound) {
                metricsContainer.innerHTML = createNoDataMessage('No analytics data available');
                if (insightsContainer) {
                    insightsContainer.innerHTML = 'No performance insights available';
                }
                return;
            }
            
            const previousData = await window.GA4Integration.fetchPreviousPeriodData(nodeData.url);
            
            metricsContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    ${createTrendCard('Users', currentData.users || 0, previousData?.users || 0, '#f59e0b', '👥')}
                    ${createTrendCard('Page Views', currentData.pageViews || 0, previousData?.pageViews || 0, '#ef4444', '📄')}
                    ${createTrendCard('Sessions', currentData.sessions || 0, previousData?.sessions || 0, '#8b5cf6', '🔄')}
                    ${createTrendCard('Bounce Rate', `${((currentData.bounceRate || 0) * 100).toFixed(0)}%`, `${((previousData?.bounceRate || 0) * 100).toFixed(0)}%`, '#06b6d4', '⚽')}
                </div>
            `;
            
            // Generate insights
            if (insightsContainer) {
                const insights = generateInsights(currentData, previousData);
                insightsContainer.innerHTML = insights;
            }
            
        } catch (error) {
            console.error('Enhanced GA4 trend error:', error);
            metricsContainer.innerHTML = createNoDataMessage('Failed to load analytics data');
            if (insightsContainer) {
                insightsContainer.innerHTML = 'Failed to generate insights';
            }
        }
    }

    function createTrendCard(label, currentValue, previousValue, color = '#64748b', icon = '') {
        const current = parseFloat(currentValue) || 0;
        const previous = parseFloat(previousValue) || 0;
        
        let percentChange = 0;
        let changeDirection = '→';
        let changeColor = '#64748b';
        let changeBg = '#f1f5f9';
        
        if (previous > 0) {
            percentChange = ((current - previous) / previous) * 100;
            
            if (Math.abs(percentChange) < 2) {
                changeDirection = '→';
                changeColor = '#64748b';
                changeBg = '#f1f5f9';
            } else if (percentChange > 0) {
                changeDirection = '↗';
                changeColor = '#ffffff';
                changeBg = '#10b981';
            } else {
                changeDirection = '↘';
                changeBg = '#ef4444';
                changeColor = '#ffffff';
            }
        }

        return `
            <div style="
                background: linear-gradient(135deg, ${color}15 0%, ${color}08 100%); 
                border-radius: 12px; 
                padding: 16px; 
                text-align: center;
                border: 1px solid ${color}20;
                position: relative;
                overflow: hidden;
            ">
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 4px; font-weight: 500;">
                    ${icon} ${label}
                </div>
                
                <div style="font-size: 1.2rem; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                    ${formatDisplayValue(current)}
                </div>
                
                <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <div style="
                        font-size: 0.7rem; 
                        color: ${changeColor}; 
                        font-weight: 700;
                        padding: 3px 8px;
                        background: ${changeBg};
                        border-radius: 20px;
                        display: flex;
                        align-items: center;
                        gap: 2px;
                    ">
                        <span>${changeDirection}</span>
                        <span>${Math.abs(percentChange).toFixed(0)}%</span>
                    </div>
                </div>
                
                <div style="font-size: 0.65rem; color: #64748b; margin-top: 4px;">
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
                ${index < 2 ? 'border-bottom: 1px solid #e2e8f0;' : ''}
            ">
                <div style="
                    width: 24px; 
                    height: 24px; 
                    background: #f1f5f9; 
                    border-radius: 50%; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    font-weight: 700;
                    color: #475569;
                    font-size: 0.75rem;
                    flex-shrink: 0;
                ">${index + 1}</div>
                
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        font-size: 0.85rem; 
                        font-weight: 600; 
                        color: #1e293b; 
                        margin-bottom: 4px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    ">"${query.query}"</div>
                    
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.7rem; color: #64748b;">
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

    function generateInsights(currentData, previousData) {
        const insights = [];
        
        if (previousData) {
            const userChange = ((currentData.users - previousData.users) / previousData.users * 100);
            if (userChange > 20) {
                insights.push('📈 Strong user growth this period');
            } else if (userChange < -20) {
                insights.push('📉 User traffic declining');
            }
            
            if (currentData.bounceRate < 0.3) {
                insights.push('✨ Excellent user engagement');
            } else if (currentData.bounceRate > 0.7) {
                insights.push('⚠️ High bounce rate - check content relevance');
            }
        }
        
        if (insights.length === 0) {
            insights.push('📊 Monitor performance trends over time');
        }
        
        return insights.join(' • ');
    }

    function createAdvancedLoadingGrid() {
        return `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                ${Array.from({length: 4}, () => `
                    <div style="
                        background: #f8fafc; 
                        border-radius: 12px; 
                        padding: 16px; 
                        text-align: center;
                        border: 1px solid #e2e8f0;
                        position: relative;
                        overflow: hidden;
                    ">
                        <div style="height: 16px; width: 60%; margin: 0 auto 8px; background: #e2e8f0; border-radius: 4px;" class="loading-skeleton"></div>
                        <div style="height: 20px; width: 80%; margin: 0 auto 6px; background: #e2e8f0; border-radius: 4px;" class="loading-skeleton"></div>
                        <div style="height: 12px; width: 40%; margin: 0 auto; background: #e2e8f0; border-radius: 4px;" class="loading-skeleton"></div>
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
                ${i < 2 ? 'border-bottom: 1px solid #e2e8f0;' : ''}
            ">
                <div style="
                    width: 24px; 
                    height: 24px; 
                    background: #e2e8f0; 
                    border-radius: 50%; 
                    flex-shrink: 0;
                " class="loading-skeleton"></div>
                <div style="flex: 1;">
                    <div style="height: 14px; width: 70%; margin-bottom: 6px; background: #e2e8f0; border-radius: 4px;" class="loading-skeleton"></div>
                    <div style="height: 10px; width: 40%; background: #f1f5f9; border-radius: 4px;" class="loading-skeleton"></div>
                </div>
            </div>
        `).join('');
    }

    function createNoDataMessage(message) {
        return `
            <div style="
                text-align: center; 
                color: #64748b; 
                padding: 32px 20px;
                font-size: 0.9rem;
                background: #f8fafc;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
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
        const metricsContainer = tooltip.querySelector('#gsc-metrics-container');
        const queriesContainer = tooltip.querySelector('#gsc-queries-list');
        
        const disconnectedMessage = `
            <div style="
                text-align: center; 
                color: #64748b; 
                padding: 32px 20px;
                font-size: 0.9rem;
                background: #f8fafc;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
            ">
                <div style="margin-bottom: 16px; display: flex; justify-content: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" style="opacity: 0.7;">
                        <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                </div>
                <div style="font-weight: 600; margin-bottom: 8px;">Connect Search Console</div>
                <div style="font-size: 0.8rem; opacity: 0.7;">
                    Click the GSC button in the toolbar to see search performance trends
                </div>
            </div>
        `;
        
        metricsContainer.innerHTML = disconnectedMessage;
        queriesContainer.innerHTML = `
            <div style="text-align: center; color: #64748b; padding: 16px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" style="opacity: 0.7;">
                    <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Connect GSC to see top queries</span>
            </div>
        `;
    }

    function showGA4Disconnected(tooltip) {
        const metricsContainer = tooltip.querySelector('#ga4-metrics-container');
        
        metricsContainer.innerHTML = `
            <div style="
                text-align: center; 
                color: #64748b; 
                padding: 32px 20px;
                font-size: 0.9rem;
                background: #f8fafc;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
            ">
                <div style="margin-bottom: 16px; display: flex; justify-content: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" style="opacity: 0.7;">
                        <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                    </svg>
                </div>
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

    // Core tooltip behavior functions
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

        // Handle close button click
const closeBtn = tooltip.querySelector('.tooltip-close-btn');
if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideEnhancedTooltip(true); // Force immediate close
    });
}

        
        
        tooltip.addEventListener('click', (e) => {
            const button = e.target.closest('.action-btn');
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
    if (window.createUnifiedCitizensDashboard && url && url !== 'undefined') {
        // Hide the tooltip first
        hideEnhancedTooltip(true); // Force immediate close
        
        // Show loading immediately
        const loadingOverlay = showDashboardLoading();
        
        const nodeData = tooltip._nodeData;
        console.log('📊 Opening dashboard with node data:', nodeData);
        
        // Call your dashboard function and hide loading when done
        window.showUnifiedDashboardReport(url, nodeData)
            .then(() => {
                hideDashboardLoading();
            })
            .catch((error) => {
                console.error('Dashboard loading error:', error);
                hideDashboardLoading();
                // Show error message
                alert('Failed to load dashboard. Please try again.');
            });
    }
    break;
    }
}



function showDashboardLoading() {
    // Remove any existing loading overlay
    const existingLoader = document.getElementById('dashboard-loading-overlay');
    if (existingLoader) existingLoader.remove();
    
    // Track loading start time
    window.dashboardLoadingStartTime = Date.now();
    
    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dashboard-loading-overlay';
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 15000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    loadingOverlay.innerHTML = `
        <div style="
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            text-align: center;
            max-width: 400px;
            width: 90%;
            position: relative;
            overflow: hidden;
        ">
            <!-- Animated background -->
            <div style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 6px;
                background: linear-gradient(90deg, #5a8200, #72A300, #84cc16, #a3e635);
                background-size: 300% 100%;
                animation: loading-sweep 2s ease-in-out infinite;
                border-radius: 20px 20px 0 0;
            "></div>
            
            <!-- Loading spinner -->
            <div style="
                width: 60px;
                height: 60px;
                border: 4px solid #f1f5f9;
                border-top: 4px solid #72A300;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 24px;
            "></div>
            
            <!-- Loading text -->
            <h3 style="
                margin: 0 0 12px 0;
                font-size: 1.2rem;
                font-weight: 600;
                color: #1e293b;
            ">Loading Dashboard</h3>
            
            <p style="
                margin: 0 0 20px 0;
                color: #64748b;
                font-size: 0.95rem;
                line-height: 1.5;
            ">Fetching analytics data and performance metrics...</p>
            
            <!-- Progress dots -->
            <div style="display: flex; justify-content: center; gap: 8px;">
                <div class="loading-dot" style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #72A300;
                    animation: bounce 1.4s ease-in-out infinite both;
                "></div>
                <div class="loading-dot" style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #72A300;
                    animation: bounce 1.4s ease-in-out 0.16s infinite both;
                "></div>
                <div class="loading-dot" style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #72A300;
                    animation: bounce 1.4s ease-in-out 0.32s infinite both;
                "></div>
            </div>
        </div>
        
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @keyframes bounce {
                0%, 80%, 100% {
                    transform: scale(0);
                    opacity: 0.5;
                }
                40% {
                    transform: scale(1);
                    opacity: 1;
                }
            }
        </style>
    `;
    
    document.body.appendChild(loadingOverlay);
    
    // Fade in
    requestAnimationFrame(() => {
        loadingOverlay.style.opacity = '1';
    });
    
    return loadingOverlay;
}

function hideDashboardLoading() {
    const loadingOverlay = document.getElementById('dashboard-loading-overlay');
    if (!loadingOverlay) return;
    
    const startTime = window.dashboardLoadingStartTime || 0;
    const elapsedTime = Date.now() - startTime;
    const minimumDuration = 2000; // 2 seconds
    
    const remainingTime = Math.max(0, minimumDuration - elapsedTime);
    
    setTimeout(() => {
        if (loadingOverlay && loadingOverlay.parentNode) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                if (loadingOverlay && loadingOverlay.parentNode) {
                    loadingOverlay.remove();
                }
            }, 300);
        }
        // Clear the start time
        window.dashboardLoadingStartTime = null;
    }, remainingTime);
}

    



    
    // Safe fallback functions from your original code
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



// New unified dashboard integration function
// REPLACE your showUnifiedDashboardReport function with this corrected version:

window.showUnifiedDashboardReport = async function(url, nodeData = null) {
    console.log('🚀 Opening Unified Citizens Dashboard for:', url);
    console.log('📄 Using node data:', nodeData);

    // RESET FILTERS WHEN OPENING NEW DASHBOARD
    if (window.resetDashboardFilters) {
        window.resetDashboardFilters();
    }
    
    try {
        // Initialize data objects
        let gscData = null, ga4Data = null, gscTrends = null, ga4Trends = null;
        let gscPrevious = null, ga4Previous = null;
        
        // Fetch GSC data if connected
        if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
            try {
                // Fetch current and previous data
                gscData = await window.GSCIntegration.fetchNodeData({ url });
                gscPrevious = await window.GSCIntegration.fetchPreviousPeriodData({ url });
                
                // Calculate trends properly
                if (gscData && gscPrevious && !gscData.noDataFound && !gscPrevious.noDataFound) {
                    gscTrends = {
                        trends: {
                            clicks: calculateTrend(gscData.clicks, gscPrevious.clicks),
                            impressions: calculateTrend(gscData.impressions, gscPrevious.impressions),
                            ctr: calculateTrend(gscData.ctr, gscPrevious.ctr),
                            position: calculateTrend(gscData.position, gscPrevious.position, true) // inverted for position
                        }
                    };
                }
            } catch (error) {
                console.error('GSC data fetch error:', error);
                gscData = { noDataFound: true };
            }
        } else {
            gscData = { noDataFound: true };
        }
        
        // Fetch GA4 data if connected  
        if (window.GA4Integration && window.GA4Integration.isConnected()) {
            try {
                // Fetch current and previous data
                ga4Data = await window.GA4Integration.fetchData(url);
                ga4Previous = await window.GA4Integration.fetchPreviousPeriodData(url);
                
                // Calculate trends properly
                if (ga4Data && ga4Previous && !ga4Data.noDataFound && !ga4Previous.noDataFound) {
                    ga4Trends = {
                        trends: {
                            users: calculateTrend(ga4Data.users, ga4Previous.users),
                            pageViews: calculateTrend(ga4Data.pageViews, ga4Previous.pageViews),
                            sessions: calculateTrend(ga4Data.sessions, ga4Previous.sessions),
                            avgSessionDuration: calculateTrend(ga4Data.avgSessionDuration, ga4Previous.avgSessionDuration),
                            bounceRate: calculateTrend(ga4Data.bounceRate, ga4Previous.bounceRate, true) // inverted for bounce rate
                        }
                    };
                }
            } catch (error) {
                console.error('GA4 data fetch error:', error);
                ga4Data = { noDataFound: true };
            }
        } else {
            ga4Data = { noDataFound: true };
        }
        
        console.log('📊 Dashboard data prepared:', { gscData, ga4Data, gscTrends, ga4Trends, nodeData });
        
        // Create the unified dashboard WITH nodeData
        const dashboardHtml = createUnifiedCitizensDashboard(
            url, 
            gscData, 
            ga4Data, 
            gscTrends, 
            ga4Trends,
            nodeData  // Pass the node data to the dashboard
        );
        
        // Show in modal
        showDashboardModal(dashboardHtml);
        
    } catch (error) {
        console.error('Error loading unified dashboard:', error);
        alert('Failed to load dashboard data. Please try again.');
    }
};


// Helper function to calculate trend data in the format the dashboard expects
function calculateTrend(currentValue, previousValue, inverted = false) {
    const current = parseFloat(currentValue) || 0;
    const previous = parseFloat(previousValue) || 0;
    
    if (previous === 0) {
        return {
            percentChange: 0,
            direction: 'neutral'
        };
    }
    
    let percentChange = ((current - previous) / previous) * 100;
    
    // For inverted metrics (position, bounce rate), flip the direction
    const actualChange = inverted ? -percentChange : percentChange;
    
    let direction = 'neutral';
    if (Math.abs(actualChange) < 2) {
        direction = 'neutral';
    } else if (actualChange > 0) {
        direction = 'up';
    } else {
        direction = 'down';
    }
    
    return {
        percentChange: Math.abs(percentChange), // Always positive number
        direction: direction
    };
}



// Modal display function (customize to match your UI style)
function showDashboardModal(htmlContent) {

    hideDashboardLoading();

    
    // Remove existing modal if present
    const existingModal = document.getElementById('unified-dashboard-modal');
    if (existingModal) existingModal.remove();
    
    // Create modal backdrop
    const modal = document.createElement('div');
    modal.id = 'unified-dashboard-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.75);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 0.3s ease;
        padding: 20px;
        box-sizing: border-box;
    `;
    
    // Create modal content container
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        width: 100%;
        max-width: 1200px;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        transform: scale(0.9);
        transition: transform 0.3s ease;
    `;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 10001;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 20px;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.2s ease;
    `;
    
    closeBtn.addEventListener('click', () => {
        modal.style.opacity = '0';
        modalContent.style.transform = 'scale(0.9)';
        setTimeout(() => modal.remove(), 300);
    });
    
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(239, 68, 68, 0.9)';
        closeBtn.style.transform = 'scale(1.1)';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'rgba(0, 0, 0, 0.7)';
        closeBtn.style.transform = 'scale(1)';
    });
    
    // Add dashboard content
    modalContent.innerHTML = htmlContent;
    modalContent.appendChild(closeBtn);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Show with animation
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modalContent.style.transform = 'scale(1)';
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeBtn.click();
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeBtn.click();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
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

    function getLastEditedInfo(data) {
        // Last edited info is now handled directly in the header layout
        return data.lastModified ? true : false;
    }

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
