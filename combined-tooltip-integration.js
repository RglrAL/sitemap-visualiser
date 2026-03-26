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
        
        // Detect mobile/tablet
        const isMobileDevice = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobileDevice) {
            // Mobile-specific styling
            tooltip.style.cssText = `
                position: fixed;
                top: 20px;
                left: 10px;
                right: 10px;
                bottom: auto;
                background: var(--color-bg-primary);
                border-radius: 16px;
                padding: 0;
                box-shadow:
                    0 25px 50px -12px rgba(0, 0, 0, 0.4),
                    0 0 0 1px rgba(0, 0, 0, 0.1);
                z-index: 15000;
                max-width: calc(100vw - 20px);
                width: calc(100vw - 20px);
                max-height: calc(85vh - 40px);
                opacity: 0;
                transform: translateY(-20px) scale(0.95);
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
                pointer-events: auto;
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.18);
                -webkit-overflow-scrolling: touch;
            `;
        } else {
            // Desktop styling (more compact)
            tooltip.style.cssText = `
                position: absolute;
                background: var(--color-bg-primary);
                border-radius: 16px;
                padding: 0;
                box-shadow:
                    0 20px 40px -12px rgba(0, 0, 0, 0.25),
                    0 0 0 1px rgba(0, 0, 0, 0.05);
                z-index: 10000;
                max-width: 480px;
                width: 480px;
                opacity: 0;
                transform: translateY(12px) scale(0.94);
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
                pointer-events: auto;
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.18);
            `;
        }

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
                padding: 16px 20px; 
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
                    <div class="page-info-grid" style="
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
                padding: 0 20px;
                background: var(--color-bg-secondary);
                border-bottom: 1px solid var(--color-border-primary);
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
                        color: var(--color-text-secondary);
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
                        color: var(--color-text-secondary);
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
                    <button class="tab-btn" data-tab="content" style="
                        flex: 1;
                        padding: 12px 16px;
                        border: none;
                        background: none;
                        font-size: 0.85rem;
                        font-weight: 600;
                        cursor: pointer;
                        color: var(--color-text-secondary);
                        border-bottom: 3px solid transparent;
                        transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
                        position: relative;
                        font-family: inherit;
                    ">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10 9 9 9 8 9"/>
                            </svg>
                            <span>Content</span>
                        </div>
                    </button>
                </div>
            </div>

            <!-- Time Period Info -->
            <div style="
                padding: 10px 20px;
                background: var(--color-bg-tertiary);
                border-bottom: 1px solid var(--color-border-primary);
                font-size: 0.8rem;
                color: var(--color-text-secondary);
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
                padding: 16px;
                min-height: 220px;
                max-height: 280px;
                overflow-y: auto;
            ">
                <!-- Search Console Tab -->
                <div class="tab-panel" data-panel="search" style="display: none;">
                    <div id="gsc-metrics-container" style="margin-bottom: 20px;">
                        ${createAdvancedLoadingGrid()}
                    </div>
                    
                    <!-- Top Queries Section -->
                    <div style="
                        background: var(--color-bg-tertiary);
                        border-radius: 12px;
                        padding: 16px;
                        border: 1px solid var(--color-border-primary);
                    ">
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--color-text-primary); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
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
                
                <!-- Content Analysis Tab -->
                <div class="tab-panel" data-panel="content" style="display: none;">
                    <div id="content-analysis-container">
                        <div style="text-align: center; padding: 32px 16px; color: var(--color-text-secondary);">
                            <div style="font-size: 2rem; margin-bottom: 10px;">📄</div>
                            <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 6px; font-size: 0.9rem;">Content Analysis</div>
                            <div style="font-size: 0.78rem; line-height: 1.5;">Readability, word count, heading<br>structure, SEO &amp; accessibility checks.</div>
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
                        background: var(--color-bg-tertiary);
                        border-radius: 12px;
                        padding: 16px;
                        border: 1px solid var(--color-border-primary);
                    ">
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink: 0;">
                                <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                            </svg>
                            <span>Performance Insights</span>
                        </div>
                        <div id="ga4-insights" style="font-size: 0.8rem; color: var(--color-text-secondary); opacity: 0.8;">
                            Connect GA4 for performance insights
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div style="
                padding: 16px 20px;
                background: var(--color-bg-secondary);
                border-top: 1px solid var(--color-border-primary);
                display: flex;
                width: 100%;
            ">
                <button class="action-btn primary full-width-report" data-action="detailed" data-url="${data.url}" style="flex: 1; justify-content: center; padding: 16px 20px; font-weight: 700; font-size: 1.05rem;">
                    <span class="btn-icon"> <svg width="28" height="28" viewBox="0 0 24 24" style="opacity: 0.9;">
                        <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg></span>
                    <span class="btn-text" style="font-size: 1.1rem; font-weight: 700; margin-left: 8px;">FULL REPORT</span>
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
                    color: var(--color-text-primary) !important;
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
                    background: var(--color-bg-primary);
                    color: var(--color-text-secondary);
                    border: 1px solid var(--color-border-primary);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }
                
                .action-btn.secondary:hover {
                    background: var(--color-bg-secondary);
                    color: var(--color-text-primary);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
                
                .loading-skeleton {
                    background: linear-gradient(90deg, var(--color-bg-tertiary) 0%, var(--color-border-primary) 50%, var(--color-bg-tertiary) 100%);
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
                    background: var(--color-bg-tertiary);
                    border-radius: 2px;
                }
                
                .tab-content::-webkit-scrollbar-thumb {
                    background: var(--color-border-secondary);
                    border-radius: 2px;
                }

                .tab-content::-webkit-scrollbar-thumb:hover {
                    background: var(--color-text-muted);
                }
                
                /* Mobile-specific responsive styles */
                @media (max-width: 768px) {
                    .page-info-grid {
                        grid-template-columns: 1fr !important;
                        gap: 8px !important;
                    }
                    
                    .enhanced-tabbed-tooltip .tab-content {
                        padding: 16px !important;
                        max-height: calc(50vh) !important;
                        overflow-y: auto !important;
                    }
                    
                    .enhanced-tabbed-tooltip .action-btn {
                        flex-direction: column !important;
                        min-height: 48px !important;
                        padding: 12px !important;
                        margin: 4px 0 !important;
                    }
                    
                    .enhanced-tabbed-tooltip .tab-btn {
                        padding: 12px 8px !important;
                        font-size: 13px !important;
                        min-height: 44px !important;
                    }
                    
                    .enhanced-tabbed-tooltip .tab-btn .btn-icon {
                        margin-bottom: 4px !important;
                    }
                }
            </style>
        `;
    }

    function initializeTabs(tooltip) {
        const tabBtns = tooltip.querySelectorAll('.tab-btn');
        const tabPanels = tooltip.querySelectorAll('.tab-panel');
        const isMobileDevice = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        tabBtns.forEach(btn => {
            const handleTabSwitch = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const targetTab = btn.dataset.tab;

                // Update buttons
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update panels with smooth transition
                tabPanels.forEach(panel => {
                    if (panel.dataset.panel === targetTab) {
                        panel.style.display = 'block';
                        panel.style.opacity = '0';
                        panel.style.transform = isMobileDevice ? 'translateY(10px)' : 'translateX(20px)';

                        requestAnimationFrame(() => {
                            panel.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                            panel.style.opacity = '1';
                            panel.style.transform = isMobileDevice ? 'translateY(0)' : 'translateX(0)';
                        });
                    } else {
                        panel.style.opacity = '0';
                        panel.style.transform = isMobileDevice ? 'translateY(-10px)' : 'translateX(-20px)';
                        setTimeout(() => {
                            panel.style.display = 'none';
                        }, 300);
                    }
                });

                // Lazy-load Content Analysis on first click
                if (targetTab === 'content' && !tooltip._contentLoaded) {
                    tooltip._contentLoaded = true;
                    const contentPanel = tooltip.querySelector('[data-panel="content"] #content-analysis-container');
                    const url = tooltip._nodeData?.url;
                    if (url && window.PageIntelligence) {
                        window.PageIntelligence.renderContentTab(contentPanel, url);
                    } else if (!url) {
                        const panel = tooltip.querySelector('[data-panel="content"] #content-analysis-container');
                        if (panel) panel.innerHTML = '<div style="text-align:center;padding:28px;color:var(--color-text-muted);font-size:0.85rem;">No URL available for this node.</div>';
                    }
                }
            };
            
            // Add both click and touch handlers for mobile compatibility
            btn.addEventListener('click', handleTabSwitch);
            if (isMobileDevice) {
                btn.addEventListener('touchend', handleTabSwitch, { passive: false });
            }
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
                queriesContainer.innerHTML = '<div style="text-align: center; color: var(--color-text-secondary); padding: 20px;">📭 No query data available</div>';
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
                queriesContainer.innerHTML = '<div style="text-align: center; color: var(--color-text-secondary); padding: 20px; font-size: 0.85rem;">📭 No top queries data available</div>';
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
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
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

    function createTrendCard(label, currentValue, previousValue, color = 'var(--color-text-secondary)', icon = '') {
        const current = parseFloat(currentValue) || 0;
        const previous = parseFloat(previousValue) || 0;
        
        let percentChange = 0;
        let changeDirection = '→';
        let changeColor = 'var(--color-text-secondary)';
        let changeBg = 'var(--color-bg-tertiary)';
        
        if (previous > 0) {
            percentChange = ((current - previous) / previous) * 100;
            
            if (Math.abs(percentChange) < 2) {
                changeDirection = '→';
                changeColor = 'var(--color-text-secondary)';
                changeBg = 'var(--color-bg-tertiary)';
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
                border-radius: 10px; 
                padding: 10px; 
                text-align: center;
                border: 1px solid ${color}20;
                position: relative;
                overflow: hidden;
            ">
                <div style="font-size: 0.7rem; color: var(--color-text-secondary); margin-bottom: 2px; font-weight: 500;">
                    ${icon} ${label}
                </div>
                
                <div style="font-size: 1rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 4px;">
                    ${formatDisplayValue(current)}
                </div>
                
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <div style="
                        font-size: 0.65rem; 
                        color: ${changeColor}; 
                        font-weight: 600;
                        padding: 2px 6px;
                        background: ${changeBg};
                        border-radius: 16px;
                        display: flex;
                        align-items: center;
                        gap: 2px;
                    ">
                        <span style="font-size: 0.6rem;">${changeDirection}</span>
                        <span>${Math.abs(percentChange).toFixed(0)}%</span>
                    </div>
                    <span style="font-size: 0.6rem; color: #94a3b8;">vs ${formatDisplayValue(previous)}</span>
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
                ${index < 2 ? 'border-bottom: 1px solid var(--color-border-primary);' : ''}
            ">
                <div style="
                    width: 24px; 
                    height: 24px; 
                    background: var(--color-bg-tertiary); 
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
                        color: var(--color-text-primary); 
                        margin-bottom: 4px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    ">"${query.query}"</div>
                    
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.7rem; color: var(--color-text-secondary);">
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
                        background: var(--color-bg-secondary); 
                        border-radius: 12px; 
                        padding: 16px; 
                        text-align: center;
                        border: 1px solid var(--color-border-primary);
                        position: relative;
                        overflow: hidden;
                    ">
                        <div style="height: 16px; width: 60%; margin: 0 auto 8px; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
                        <div style="height: 20px; width: 80%; margin: 0 auto 6px; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
                        <div style="height: 12px; width: 40%; margin: 0 auto; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
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
                ${i < 2 ? 'border-bottom: 1px solid var(--color-border-primary);' : ''}
            ">
                <div style="
                    width: 24px; 
                    height: 24px; 
                    background: var(--color-border-primary); 
                    border-radius: 50%; 
                    flex-shrink: 0;
                " class="loading-skeleton"></div>
                <div style="flex: 1;">
                    <div style="height: 14px; width: 70%; margin-bottom: 6px; background: var(--color-border-primary); border-radius: 4px;" class="loading-skeleton"></div>
                    <div style="height: 10px; width: 40%; background: var(--color-bg-tertiary); border-radius: 4px;" class="loading-skeleton"></div>
                </div>
            </div>
        `).join('');
    }

    function createNoDataMessage(message) {
        return `
            <div style="
                text-align: center; 
                color: var(--color-text-secondary); 
                padding: 32px 20px;
                font-size: 0.9rem;
                background: var(--color-bg-secondary);
                border-radius: 12px;
                border: 1px solid var(--color-border-primary);
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
                color: var(--color-text-secondary); 
                padding: 32px 20px;
                font-size: 0.9rem;
                background: var(--color-bg-secondary);
                border-radius: 12px;
                border: 1px solid var(--color-border-primary);
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
            <div style="text-align: center; color: var(--color-text-secondary); padding: 16px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
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
                color: var(--color-text-secondary); 
                padding: 32px 20px;
                font-size: 0.9rem;
                background: var(--color-bg-secondary);
                border-radius: 12px;
                border: 1px solid var(--color-border-primary);
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
        console.log('🧹 hideExistingTooltip called');
        
        // Remove ALL existing tooltips regardless of content
        const existingTooltips = document.querySelectorAll('.enhanced-tabbed-tooltip, .enhanced-tooltip');
        console.log(`🔍 Found ${existingTooltips.length} existing tooltips`);
        
        existingTooltips.forEach((tooltip, index) => {
            console.log(`🗑️ Removing tooltip ${index + 1}`);
            
            // Remove backdrop immediately
            if (tooltip._backdrop) {
                console.log(`🚪 Removing backdrop for existing tooltip ${index + 1}`);
                tooltip._backdrop.remove();
            }
            
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(12px) scale(0.94)';
            setTimeout(() => tooltip.remove(), 100);
        });
        
        // Also clean up any orphaned backdrops
        const orphanedBackdrops = document.querySelectorAll('[style*="backdrop-filter: blur(2px)"]');
        orphanedBackdrops.forEach((backdrop, index) => {
            console.log(`🧹 Removing orphaned backdrop from hideExistingTooltip ${index + 1}`);
            backdrop.remove();
        });
        
        // Clear global reference
        window.currentEnhancedTooltip = null;
        
        console.log('✅ All existing tooltips cleaned up');
    }

    function positionTooltip(tooltip, event) {
        const isMobileDevice = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobileDevice) {
            // Mobile: Use fixed positioning to center on screen
            tooltip.style.position = 'fixed';
            tooltip.style.top = '20px';
            tooltip.style.left = '10px';
            tooltip.style.right = '10px';
            tooltip.style.bottom = 'auto';
            tooltip.style.maxHeight = 'calc(100vh - 40px)';
            tooltip.style.transform = 'none';
            tooltip.style.width = 'calc(100vw - 20px)';
            tooltip.style.maxWidth = 'calc(100vw - 20px)';
            
            // Enable scrolling for mobile
            tooltip.style.overflowY = 'auto';
            tooltip.style.webkitOverflowScrolling = 'touch';
        } else {
            // Desktop: Original positioning logic
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
    }

    function addModernHoverBehavior(tooltip) {
        let isHovering = false;
        const isMobileDevice = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobileDevice) {
            // Mobile-specific touch behavior
            let touchStartTime = 0;
            
            tooltip.addEventListener('touchstart', (e) => {
                isHovering = true;
                touchStartTime = Date.now();
                clearTooltipTimers();
                e.stopPropagation(); // Prevent event bubbling
            }, { passive: true });
            
            tooltip.addEventListener('touchend', (e) => {
                const touchDuration = Date.now() - touchStartTime;
                // Only close on quick taps (< 200ms), not scrolling
                if (touchDuration < 200 && e.target === tooltip) {
                    isHovering = false;
                    hideEnhancedTooltip();
                }
                e.stopPropagation();
            }, { passive: true });
            
            // Prevent mobile scroll when touching tooltip content
            tooltip.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            }, { passive: true });
            
            // Add backdrop touch to close
            const backdrop = document.createElement('div');
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.3);
                z-index: 14999;
                backdrop-filter: blur(2px);
            `;
            
            backdrop.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideEnhancedTooltip(true);
            }, { passive: false });
            
            // Insert backdrop before tooltip
            document.body.insertBefore(backdrop, tooltip);
            tooltip._backdrop = backdrop;
            
        } else {
            // Desktop behavior (unchanged)
            tooltip.addEventListener('mouseenter', () => {
                isHovering = true;
                clearTooltipTimers();
            });
            
            tooltip.addEventListener('mouseleave', () => {
                isHovering = false;
                hideEnhancedTooltip();
            });
        }

        // Handle close button click (both mobile and desktop)
        const closeBtn = tooltip.querySelector('.tooltip-close-btn');
        if (closeBtn) {
            // Make close button more touch-friendly on mobile
            if (isMobileDevice) {
                closeBtn.style.minWidth = '44px';
                closeBtn.style.minHeight = '44px';
                closeBtn.style.padding = '12px';
            }
            
            const closeHandler = (e) => {
                console.log('🔘 Tooltip close button clicked!');
                e.preventDefault();
                e.stopPropagation();
                hideEnhancedTooltip(true); // Force immediate close
            };
            
            closeBtn.addEventListener('click', closeHandler);
            if (isMobileDevice) {
                closeBtn.addEventListener('touchend', closeHandler, { passive: false });
            }
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
        console.log('🚪 hideEnhancedTooltip called, immediate:', immediate);
        const delay = immediate ? 0 : 200;
        
        window.enhancedHideTimer = setTimeout(() => {
            // Remove ALL tooltips, not just the tracked one
            const allTooltips = document.querySelectorAll('.enhanced-tabbed-tooltip, .enhanced-tooltip');
            console.log(`🧹 Found ${allTooltips.length} tooltips to hide`);
            
            allTooltips.forEach((tooltip, index) => {
                console.log(`🗑️ Hiding tooltip ${index + 1}`);
                const isMobileDevice = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                
                tooltip.style.opacity = '0';
                
                if (isMobileDevice) {
                    tooltip.style.transform = 'translateY(-20px) scale(0.95)';
                } else {
                    tooltip.style.transform = 'translateY(12px) scale(0.94)';
                }
                
                // Remove mobile backdrop IMMEDIATELY, don't wait
                if (tooltip._backdrop) {
                    console.log(`🚪 Removing backdrop for tooltip ${index + 1}`);
                    tooltip._backdrop.remove();
                }
                
                setTimeout(() => {
                    tooltip.remove();
                }, 300);
            });
            
            // ALSO remove any orphaned backdrops that might exist
            const orphanedBackdrops = document.querySelectorAll('[style*="backdrop-filter: blur(2px)"]');
            orphanedBackdrops.forEach((backdrop, index) => {
                console.log(`🧹 Removing orphaned backdrop ${index + 1}`);
                backdrop.remove();
            });
            
            // Clear global reference
            window.currentEnhancedTooltip = null;
            console.log('✅ All tooltips hidden and removed');
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
    console.log('🔍 Detailed action triggered for URL:', url);
    console.log('🔍 createUnifiedCitizensDashboard available:', !!window.createUnifiedCitizensDashboard);
    console.log('🔍 showUnifiedDashboardReport available:', !!window.showUnifiedDashboardReport);
    
    // Check if function is available, if not, wait a bit and try again
    if (!window.createUnifiedCitizensDashboard) {
        console.log('⏳ Dashboard function not available, waiting for script to load...');
        setTimeout(() => {
            console.log('🔍 Retry - createUnifiedCitizensDashboard available:', !!window.createUnifiedCitizensDashboard);
            if (window.createUnifiedCitizensDashboard && url && url !== 'undefined') {
                handleEnhancedAction('detailed', url, tooltip);
            } else {
                console.error('❌ Dashboard function still not available after wait');
                alert('Dashboard function is not loaded. Please refresh the page and try again.');
            }
        }, 500);
        return;
    }
    
    if (window.createUnifiedCitizensDashboard && url && url !== 'undefined') {
        console.log('✅ All checks passed, proceeding with dashboard...');
        
        // Aggressively hide all tooltips on mobile
        const isMobileDevice = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobileDevice) {
            console.log('📱 Mobile device detected, force closing all tooltips');
            // Clear any timers
            if (window.enhancedHideTimer) {
                clearTimeout(window.enhancedHideTimer);
            }
            if (window.enhancedShowTimer) {
                clearTimeout(window.enhancedShowTimer);
            }
            
            // Remove all existing tooltips immediately
            const existingTooltips = document.querySelectorAll('.enhanced-tooltip');
            existingTooltips.forEach(tip => {
                console.log('🗑️ Removing existing tooltip');
                tip.remove();
            });
            
            // Clear global reference
            window.currentEnhancedTooltip = null;
            
            // Small delay to ensure tooltip is fully removed
            setTimeout(() => {
                console.log('📱 Tooltip cleanup complete, proceeding with dashboard');
                proceedWithDashboard();
            }, 100);
            return;
        } else {
            // Desktop: normal hide
            hideEnhancedTooltip(true); // Force immediate close
        }
        
        proceedWithDashboard();
        
        function proceedWithDashboard() {
            // Show loading immediately
            const loadingOverlay = showDashboardLoading();
            console.log('⏳ Loading overlay shown');
        
            const nodeData = tooltip._nodeData;
            console.log('📊 Opening dashboard with node data:', nodeData);
            
            // Store original tooltip data for restoration on mobile
            window.originalTooltipData = {
                event: { target: tooltip._originalEvent?.target },
                nodeData: nodeData
            };
            
            // Call your dashboard function and hide loading when done
            console.log('🚀 Calling showUnifiedDashboardReport...');
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
    
    // Create loading overlay — sits below the nav bar, same spatial zone as the panel
    const _navBar = document.getElementById('navBar');
    const _navH = _navBar ? Math.round(_navBar.getBoundingClientRect().bottom) : 48;
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dashboard-loading-overlay';
    loadingOverlay.style.cssText = `
        position: fixed;
        top: ${_navH}px;
        left: 0;
        width: 100%;
        height: calc(100% - ${_navH}px);
        background: var(--color-bg-primary);
        z-index: 999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        opacity: 1;
        transition: opacity 0.25s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    loadingOverlay.innerHTML = `
        <div style="
            background: var(--color-bg-primary);
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
                border: 4px solid var(--color-bg-tertiary);
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
                color: var(--color-text-primary);
            ">Loading Dashboard</h3>
            
            <p style="
                margin: 0 0 20px 0;
                color: var(--color-text-secondary);
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

    // Crossfade: fade the visualisation out as the loader fades in
    const vizWrapper = document.querySelector('.visualization-wrapper');
    if (vizWrapper) {
        vizWrapper.style.transition = 'opacity 0.3s ease';
        vizWrapper.style.opacity = '0';
    }
    loadingOverlay.style.opacity = '0';
    requestAnimationFrame(() => {
        loadingOverlay.style.opacity = '1';
    });

    return loadingOverlay;
}

function hideDashboardLoading(onComplete) {
    const loadingOverlay = document.getElementById('dashboard-loading-overlay');
    if (!loadingOverlay) { if (onComplete) onComplete(); return; }

    const startTime = window.dashboardLoadingStartTime || 0;
    const elapsedTime = Date.now() - startTime;
    const minimumDuration = 2000; // 2 seconds

    const remainingTime = Math.max(0, minimumDuration - elapsedTime);

    setTimeout(() => {
        window.dashboardLoadingStartTime = null;
        // Fire callback immediately so the panel starts its slide-up at the same
        // time as the overlay fades out — no gap where the tree map shows through.
        if (onComplete) onComplete();
        if (loadingOverlay && loadingOverlay.parentNode) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                if (loadingOverlay && loadingOverlay.parentNode) loadingOverlay.remove();
            }, 300);
        }
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
    console.log('📅 Current date range:', window.currentDateRange);

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
        console.log('🚀 About to create unified dashboard with data:', {
            url,
            hasGscData: !!gscData,
            hasGa4Data: !!ga4Data,
            hasNodeData: !!nodeData,
            gscKeys: gscData ? Object.keys(gscData) : [],
            ga4Keys: ga4Data ? Object.keys(ga4Data) : []
        });
        
        const dashboardHtml = createUnifiedCitizensDashboard(
            url, 
            gscData, 
            ga4Data, 
            gscTrends, 
            ga4Trends,
            nodeData  // Pass the node data to the dashboard
        );
        
        console.log('✅ Dashboard HTML created successfully, length:', dashboardHtml?.length);
        
        // Show in modal
        showDashboardModal(dashboardHtml);
        
        // On mobile, if currentDateRange is not default, refresh to ensure correct data
        const isMobileDevice = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobileDevice && window.currentDateRange && window.currentDateRange.period !== '30d') {
            console.log('📱 Mobile device detected with non-default date range, refreshing dashboard...');
            setTimeout(() => {
                if (window.refreshUnifiedDashboard) {
                    window.refreshUnifiedDashboard(url);
                }
            }, 500); // Small delay to ensure modal is fully loaded
        }
        
    } catch (error) {
        console.error('❌ Error loading unified dashboard:');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Full error object:', error);
        console.error('Dashboard data states:', {
            hasGscData: !!gscData,
            hasGa4Data: !!ga4Data,
            hasNodeData: !!nodeData,
            gscDataSize: gscData ? Object.keys(gscData).length : 0,
            ga4DataSize: ga4Data ? Object.keys(ga4Data).length : 0
        });
        alert(`Failed to load dashboard data: ${error.message}. Check console for details.`);
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
// Expose under a stable name so unified-citizens-dashboard.js (which has its own
// local showDashboardModal that shadows this one) can always reach the real implementation.
window._showDashboardPanelFn = function(htmlContent) { showDashboardModal(htmlContent); };

function showDashboardModal(htmlContent) {
    // Remove any existing panel
    const existing = document.getElementById('unified-dashboard-modal');
    if (existing) existing.remove();

    // Measure nav bar bottom edge — use getBoundingClientRect so the panel clears
    // both the green header and the nav bar when the user is at the top of the page.
    const navBar = document.getElementById('navBar');
    const navHeight = navBar ? Math.round(navBar.getBoundingClientRect().bottom) : 48;

    // Full-screen panel — below the nav bar, fills the rest of the viewport
    const panel = document.createElement('div');
    panel.id = 'unified-dashboard-modal';
    panel.style.cssText = `
        position: fixed;
        top: ${navHeight}px;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 998;
        background: var(--color-bg-primary);
        overflow-y: auto;
        transform: translateY(100%);
        transition: transform 0.42s cubic-bezier(0.33, 1, 0.68, 1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Override dashboard container styles that were designed for a modal context —
    // remove rounded corners, max-width cap, and box shadow so content fills flush
    const styleOverride = document.createElement('style');
    styleOverride.id = 'dashboard-panel-overrides';
    styleOverride.textContent =
        '#unified-dashboard-modal .unified-dashboard-container{' +
            'border-radius:0!important;max-width:100%!important;' +
            'margin:0!important;box-shadow:none!important;}' +
        // Hide map controls, KPI stats bar and colour legend while the report panel is open
        '.tree-controls{display:none!important;}' +
        '#stats{display:none!important;}' +
        '#colourLegend{display:none!important;}' +
        '#breadcrumbContainer{display:none!important;}';
    document.head.appendChild(styleOverride);

    // Dismiss: slide back down
    const closeFn = () => {
        panel.style.transition = 'transform 0.32s cubic-bezier(0.32, 0, 0.67, 0)';
        panel.style.transform = 'translateY(100%)';
        document.removeEventListener('keydown', escHandler);
        if (navBar) navBar.removeEventListener('click', navClickHandler);
        // Fade the visualisation back in as the panel slides away
        const _viz = document.querySelector('.visualization-wrapper');
        if (_viz) {
            _viz.style.transition = 'opacity 0.32s ease';
            _viz.style.opacity = '1';
        }
        setTimeout(() => {
            if (panel.parentNode) panel.remove();
            const so = document.getElementById('dashboard-panel-overrides');
            if (so) so.remove();
        }, 340);
    };

    // Any nav click dismisses — except utility toggles (GSC/GA4, AI, theme, search)
    const NAV_EXCEPTIONS = ['#integrationsNav', '.nav-ai-btn', '.nav-theme-btn', '.nav-search'];
    const navClickHandler = (e) => {
        if (!NAV_EXCEPTIONS.some(sel => e.target.closest(sel))) closeFn();
    };
    if (navBar) navBar.addEventListener('click', navClickHandler);

    // Escape key
    const escHandler = (e) => { if (e.key === 'Escape') closeFn(); };
    document.addEventListener('keydown', escHandler);

    // Dashboard content
    const content = document.createElement('div');
    content.innerHTML = htmlContent;
    panel.appendChild(content);
    document.body.appendChild(panel);

    // Start the panel slide-up at the same moment the loading overlay begins fading out.
    // One rAF ensures the initial translateY(100%) is painted before we animate.
    hideDashboardLoading(() => {
        requestAnimationFrame(() => {
            panel.style.transform = 'translateY(0)';
        });
    });
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
                    if (daysSince < 90) {
                        color = '#10b981'; label = 'New';
                    } else if (daysSince < 180) {
                        color = '#10b981'; label = 'Fresh';
                    } else if (daysSince < 365) {
                        color = '#f59e0b'; label = 'Recent';
                    } else if (daysSince < 730) {
                        color = '#f97316'; label = 'Aging';
                    } else if (daysSince < 1095) {
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
                badge: '<span style="background: var(--color-text-muted); color: var(--color-bg-primary); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">No Date</span>'
            };
            
        } catch (error) {
            console.warn('Error getting freshness info:', error);
            return {
                badge: '<span style="background: var(--color-text-muted); color: var(--color-bg-primary); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">No Date</span>'
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
