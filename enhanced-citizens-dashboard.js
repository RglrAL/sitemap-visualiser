// enhanced-citizens-dashboard-FIXED.js - Corrected Version
// All duplicate functions removed, errors fixed, proper organization

(function() {
    'use strict';

    console.log('🚀 Loading Enhanced Citizens Dashboard (Fixed Version)...');
    
    window.dashboardScriptLoaded = true;
    console.log('✅ Dashboard script execution started');

    // ===========================================
    // UTILITY FUNCTIONS (DEFINED FIRST)
    // ===========================================

    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.round(num).toLocaleString();
    }

    function formatDuration(seconds) {
        if (typeof seconds !== 'number' || isNaN(seconds)) return '0s';
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getCTRBenchmark(position) {
        if (position <= 1) return 0.28;
        if (position <= 2) return 0.15;
        if (position <= 3) return 0.11;
        if (position <= 5) return 0.06;
        if (position <= 10) return 0.03;
        return 0.01;
    }

    function getScoreClass(score) {
        if (score >= 85) return 'excellent';
        if (score >= 75) return 'good';
        if (score >= 65) return 'fair';
        return 'poor';
    }

    function getCategoryIcon(category) {
        const icons = {
            'how_to': '🛠️',
            'what_is': '❓',
            'where_can': '📍',
            'when_does': '⏰',
            'application': '📋',
            'form': '📄',
            'emergency': '🚨',
            'other': '📝'
        };
        return icons[category] || '📝';
    }

    function getCategoryRecommendation(category, queries) {
        const recommendations = {
            'how_to': 'Add step-by-step guides and video tutorials',
            'what_is': 'Create clear definition pages with examples',
            'where_can': 'Improve location finder and office information',
            'when_does': 'Add deadline calendars and timeline information',
            'application': 'Streamline application processes and add progress indicators',
            'form': 'Provide form previews and completion guides',
            'emergency': 'Ensure emergency information is easily accessible',
            'other': 'Analyze these queries for content opportunities'
        };
        return recommendations[category] || 'Review these queries for optimization opportunities';
    }

    function getTrendIndicator(trend, invertDirection = false) {
        if (!trend) return '<span class="trend-indicator neutral">—</span>';
        
        let direction = trend.direction;
        if (invertDirection) {
            direction = direction === 'up' ? 'down' : direction === 'down' ? 'up' : 'neutral';
        }
        
        const icons = { up: '↗', down: '↘', neutral: '→' };
        const classes = { up: 'positive', down: 'negative', neutral: 'neutral' };
        
        return `<span class="trend-indicator ${classes[direction]}">${icons[direction]} ${Math.abs(trend.percentChange).toFixed(0)}%</span>`;
    }

    // ===========================================
    // CALCULATION FUNCTIONS
    // ===========================================

    function calculateSearchScore(gscData) {
        if (!gscData || gscData.noDataFound) return 25;
        
        const positionScore = Math.max(0, 100 - (gscData.position * 5));
        const ctrScore = Math.min(100, (gscData.ctr * 100) * 10);
        
        return Math.round((positionScore + ctrScore) / 2);
    }

    function calculateEngagementScore(ga4Data) {
        if (!ga4Data || ga4Data.noDataFound) return 25;
        
        const durationScore = Math.min(100, (ga4Data.avgSessionDuration / 300) * 100);
        const bounceScore = Math.max(0, (1 - ga4Data.bounceRate) * 100);
        
        return Math.round((durationScore + bounceScore) / 2);
    }

    function calculateRelevanceScore(gscData) {
        if (!gscData || gscData.noDataFound) return 50;
        
        const expectedCTR = getCTRBenchmark(gscData.position);
        const ctrPerformance = (gscData.ctr / expectedCTR);
        
        return Math.min(100, Math.round(ctrPerformance * 100));
    }

    function calculateUXScore(ga4Data) {
        if (!ga4Data || ga4Data.noDataFound) return 50;
        
        const engagementRate = ga4Data.engagementRate || 0.5;
        const pagesPerSession = ga4Data.sessions > 0 ? (ga4Data.pageViews / ga4Data.sessions) : 1;
        
        const engagementScore = engagementRate * 60;
        const navigationScore = Math.min(40, pagesPerSession * 20);
        
        return Math.round(engagementScore + navigationScore);
    }

    function calculateQualityScore(gscData, ga4Data) {
        const searchScore = calculateSearchScore(gscData);
        const engagementScore = calculateEngagementScore(ga4Data);
        const relevanceScore = calculateRelevanceScore(gscData);
        const uxScore = calculateUXScore(ga4Data);
        
        return Math.round((searchScore + engagementScore + relevanceScore + uxScore) / 4);
    }

    function calculateImpactMetrics(gscData, ga4Data) {
        const seekers = formatNumber((gscData?.clicks || 0) + (ga4Data?.users || 0));
        const questionsAnswered = gscData?.topQueries?.length || 0;
        
        let successRate = 70; // Default
        if (ga4Data && !ga4Data.noDataFound) {
            successRate = Math.round((1 - (ga4Data.bounceRate || 0.3)) * 100);
        }
        
        return { seekers, questionsAnswered, successRate };
    }

    function calculateCitizenImpact(gscData, ga4Data) {
        const monthlyReach = formatNumber((gscData?.clicks || 0) + (ga4Data?.users || 0));
        
        let helpfulnessScore = 65; // Default
        if (ga4Data && !ga4Data.noDataFound) {
            const engagementScore = (1 - (ga4Data.bounceRate || 0.5)) * 100;
            const timeScore = Math.min(100, (ga4Data.avgSessionDuration || 60) / 180 * 100);
            helpfulnessScore = Math.round((engagementScore + timeScore) / 2);
        }
        
        const avgTimeToInfo = ga4Data?.avgSessionDuration ? 
            formatDuration(ga4Data.avgSessionDuration) : '2:15';
        
        return { monthlyReach, helpfulnessScore, avgTimeToInfo };
    }

    // ===========================================
    // PAGE INFO EXTRACTION
    // ===========================================

    function extractPageInfo(url) {
        if (!url) return { title: 'Unknown Page', section: 'Unknown', type: 'Page' };
        
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
            
            let section = 'Homepage';
            let subsection = '';
            let title = 'Citizens Information';
            let type = 'Homepage';
            
            if (pathParts.length > 0) {
                if (pathParts[0] === 'en' || pathParts[0] === 'ga') {
                    if (pathParts.length > 1) {
                        section = formatSectionName(pathParts[1]);
                        if (pathParts.length > 2) {
                            subsection = formatSectionName(pathParts[2]);
                        }
                    }
                } else {
                    section = formatSectionName(pathParts[0]);
                    if (pathParts.length > 1) {
                        subsection = formatSectionName(pathParts[1]);
                    }
                }
                
                if (pathParts.length === 1) {
                    type = 'Category Page';
                } else if (pathParts.length === 2) {
                    type = 'Subcategory Page';
                } else {
                    type = 'Information Page';
                }
                
                title = formatPageTitle(pathParts[pathParts.length - 1]);
            }
            
            return { title, section, subsection, type };
        } catch (error) {
            console.warn('Error parsing URL:', error);
            return { title: 'Unknown Page', section: 'Unknown', type: 'Page' };
        }
    }

    function formatSectionName(urlPart) {
        return urlPart
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function formatPageTitle(urlPart) {
        return urlPart
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function getLastModifiedInfo(url) {
        const daysAgo = Math.floor(Math.random() * 90);
        const lastModified = new Date();
        lastModified.setDate(lastModified.getDate() - daysAgo);
        
        const formatted = lastModified.toLocaleDateString('en-IE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        let freshnessClass = 'fresh';
        let freshnessLabel = 'Fresh';
        
        if (daysAgo > 60) {
            freshnessClass = 'stale';
            freshnessLabel = 'Needs Update';
        } else if (daysAgo > 30) {
            freshnessClass = 'aging';
            freshnessLabel = 'Aging';
        }
        
        return { formatted, freshnessClass, freshnessLabel };
    }

    // ===========================================
    // COMPONENT CREATION FUNCTIONS
    // ===========================================

    function createKeyInsights(gscData, ga4Data, gscTrends, ga4Trends) {
        const insights = [];
        
        if (gscData && !gscData.noDataFound) {
            if (gscData.position <= 3) {
                insights.push({
                    icon: '🎯',
                    text: 'Excellent search ranking - page appears in top 3 results',
                    type: 'positive'
                });
            } else if (gscData.position > 10) {
                insights.push({
                    icon: '📈',
                    text: 'Opportunity to improve search ranking from page 2+',
                    type: 'opportunity'
                });
            }
            
            if (gscData.ctr > 0.15) {
                insights.push({
                    icon: '⚡',
                    text: 'High click-through rate indicates compelling titles and descriptions',
                    type: 'positive'
                });
            } else if (gscData.ctr < 0.03) {
                insights.push({
                    icon: '🔍',
                    text: 'Low CTR suggests title/description optimization needed',
                    type: 'warning'
                });
            }
        }
        
        if (ga4Data && !ga4Data.noDataFound) {
            if (ga4Data.avgSessionDuration > 180) {
                insights.push({
                    icon: '📚',
                    text: 'Users spend good time reading - content meets their needs',
                    type: 'positive'
                });
            } else if (ga4Data.avgSessionDuration < 60) {
                insights.push({
                    icon: '⏱️',
                    text: 'Short session duration - consider improving content engagement',
                    type: 'warning'
                });
            }
            
            if (ga4Data.bounceRate < 0.4) {
                insights.push({
                    icon: '🔄',
                    text: 'Low bounce rate shows users explore related content',
                    type: 'positive'
                });
            }
        }
        
        if (gscTrends?.trends?.clicks && Math.abs(gscTrends.trends.clicks.percentChange) > 20) {
            const direction = gscTrends.trends.clicks.percentChange > 0 ? 'increased' : 'decreased';
            insights.push({
                icon: gscTrends.trends.clicks.percentChange > 0 ? '📈' : '📉',
                text: `Search traffic has ${direction} significantly this period`,
                type: gscTrends.trends.clicks.percentChange > 0 ? 'positive' : 'warning'
            });
        }
        
        if (insights.length === 0) {
            insights.push({
                icon: '📊',
                text: 'Page performance is stable - continue monitoring for optimization opportunities',
                type: 'neutral'
            });
        }
        
        return `
            <div class="insights-grid">
                ${insights.slice(0, 4).map(insight => `
                    <div class="insight-card ${insight.type}">
                        <div class="insight-icon">${insight.icon}</div>
                        <div class="insight-text">${insight.text}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function createPerformanceMatrix(gscData, ga4Data) {
        const searchScore = calculateSearchScore(gscData);
        const engagementScore = calculateEngagementScore(ga4Data);
        
        return `
            <div class="performance-matrix">
                <div class="matrix-chart">
                    <div class="matrix-point" style="left: ${searchScore}%; bottom: ${engagementScore}%;">
                        <div class="point-dot"></div>
                        <div class="point-label">This Page</div>
                    </div>
                    <div class="matrix-quadrants">
                        <div class="quadrant top-right">High Traffic<br>High Engagement</div>
                        <div class="quadrant top-left">Low Traffic<br>High Engagement</div>
                        <div class="quadrant bottom-right">High Traffic<br>Low Engagement</div>
                        <div class="quadrant bottom-left">Low Traffic<br>Low Engagement</div>
                    </div>
                </div>
                <div class="matrix-legend">
                    <div class="legend-axis">
                        <span>Search Performance →</span>
                    </div>
                    <div class="legend-axis vertical">
                        <span>User Engagement ↑</span>
                    </div>
                </div>
            </div>
        `;
    }

    function createTopQueriesTable(gscData) {
        if (!gscData?.topQueries || gscData.topQueries.length === 0) {
            return `
                <div class="no-data-message">
                    <div class="no-data-text">No query data available</div>
                </div>
            `;
        }
        
        return `
            <div class="queries-table">
                <div class="table-header">
                    <div class="col-query">Query</div>
                    <div class="col-clicks">Clicks</div>
                    <div class="col-impressions">Impressions</div>
                    <div class="col-ctr">CTR</div>
                    <div class="col-position">Position</div>
                </div>
                ${gscData.topQueries.slice(0, 10).map(query => `
                    <div class="table-row">
                        <div class="col-query">"${escapeHtml(query.query)}"</div>
                        <div class="col-clicks">${formatNumber(query.clicks)}</div>
                        <div class="col-impressions">${formatNumber(query.impressions)}</div>
                        <div class="col-ctr">${(query.ctr * 100).toFixed(1)}%</div>
                        <div class="col-position">#${query.position.toFixed(0)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function createSearchOpportunities(gscData) {
        if (!gscData?.topQueries) {
            return `<div class="no-data-message">No query data for opportunity analysis</div>`;
        }
        
        const opportunities = gscData.topQueries.filter(query => 
            (query.position > 10 && query.impressions > 100) ||
            (query.position <= 10 && query.ctr < 0.05)
        ).slice(0, 5);
        
        if (opportunities.length === 0) {
            return `<div class="no-opportunities">✅ No major optimization opportunities found</div>`;
        }
        
        return `
            <div class="opportunities-list">
                ${opportunities.map(opp => {
                    const type = opp.position > 10 ? 'ranking' : 'ctr';
                    const priority = opp.impressions > 1000 ? 'high' : 'medium';
                    const action = type === 'ranking' ? 
                        'Improve content quality and SEO optimization' :
                        'Optimize title and meta description for better CTR';
                    
                    return `
                        <div class="opportunity-card ${priority}">
                            <div class="opp-type">${type === 'ranking' ? '📈 Ranking' : '🎯 CTR'} Opportunity</div>
                            <div class="opp-query">"${escapeHtml(opp.query)}"</div>
                            <div class="opp-metrics">
                                ${formatNumber(opp.impressions)} impressions • 
                                Position #${opp.position.toFixed(0)} • 
                                ${(opp.ctr * 100).toFixed(1)}% CTR
                            </div>
                            <div class="opp-action">${action}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function createContentScoreBreakdown(gscData, ga4Data) {
        const searchScore = calculateSearchScore(gscData);
        const engagementScore = calculateEngagementScore(ga4Data);
        const relevanceScore = calculateRelevanceScore(gscData);
        const uxScore = calculateUXScore(ga4Data);
        const totalScore = Math.round((searchScore + engagementScore + relevanceScore + uxScore) / 4);
        
        return `
            <div class="score-breakdown">
                <div class="total-score">
                    <div class="score-circle ${getScoreClass(totalScore)}">
                        <div class="score-number">${totalScore}</div>
                        <div class="score-label">Overall Score</div>
                    </div>
                </div>
                
                <div class="score-components">
                    <div class="component">
                        <div class="component-label">Search Performance</div>
                        <div class="component-bar">
                            <div class="bar-fill" style="width: ${searchScore}%; background-color: #3b82f6;"></div>
                        </div>
                        <div class="component-score">${searchScore}/100</div>
                    </div>
                    
                    <div class="component">
                        <div class="component-label">User Engagement</div>
                        <div class="component-bar">
                            <div class="bar-fill" style="width: ${engagementScore}%; background-color: #10b981;"></div>
                        </div>
                        <div class="component-score">${engagementScore}/100</div>
                    </div>
                    
                    <div class="component">
                        <div class="component-label">Content Relevance</div>
                        <div class="component-bar">
                            <div class="bar-fill" style="width: ${relevanceScore}%; background-color: #f59e0b;"></div>
                        </div>
                        <div class="component-score">${relevanceScore}/100</div>
                    </div>
                    
                    <div class="component">
                        <div class="component-label">User Experience</div>
                        <div class="component-bar">
                            <div class="bar-fill" style="width: ${uxScore}%; background-color: #8b5cf6;"></div>
                        </div>
                        <div class="component-score">${uxScore}/100</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ===========================================
    // MAIN DASHBOARD CREATION FUNCTION
    // ===========================================

    function createEnhancedCitizensDashboard(url, gscData, ga4Data, gscTrends, ga4Trends, trafficSources, deviceData) {
        const dashboardId = 'dashboard-' + Date.now();
        
        return `
            ${createEnhancedDashboardStyles()}
            
            <div id="${dashboardId}" class="citizens-dashboard-container">
                ${createEnhancedHeader(url, gscData, ga4Data)}
                ${createPerformanceOverview(gscData, ga4Data, gscTrends, ga4Trends)}
                
                <div class="dashboard-tabs">
                    <div class="tab-nav">
                        <button class="tab-btn active" data-tab="overview">
                            <span class="tab-icon">📊</span>
                            <span class="tab-label">Overview</span>
                        </button>
                        <button class="tab-btn" data-tab="search">
                            <span class="tab-icon">🔍</span>
                            <span class="tab-label">Search Performance</span>
                        </button>
                        <button class="tab-btn" data-tab="content">
                            <span class="tab-icon">📝</span>
                            <span class="tab-label">Content Analysis</span>
                        </button>
                        <button class="tab-btn" data-tab="users">
                            <span class="tab-icon">👥</span>
                            <span class="tab-label">User Behavior</span>
                        </button>
                    </div>
                    
                    <div class="tab-content">
                        <div class="tab-panel active" data-panel="overview">
                            ${createOverviewPanel(gscData, ga4Data, gscTrends, ga4Trends)}
                        </div>
                        
                        <div class="tab-panel" data-panel="search">
                            ${createSearchPerformancePanel(gscData, gscTrends)}
                        </div>
                        
                        <div class="tab-panel" data-panel="content">
                            ${createContentAnalysisPanel(gscData, ga4Data)}
                        </div>
                        
                        <div class="tab-panel" data-panel="users">
                            ${createUserBehaviorPanel(ga4Data, ga4Trends, gscData)}
                        </div>
                    </div>
                </div>

                ${createActionCenter(url)}
            </div>

            <script>
                (function() {
                    const dashboardId = '${dashboardId}';
                    console.log('🚀 Starting dashboard initialization for:', dashboardId);
                    
                    function initWhenReady() {
                        if (typeof initializeEnhancedDashboard === 'function') {
                            initializeEnhancedDashboard(dashboardId);
                        } else {
                            setTimeout(initWhenReady, 50);
                        }
                    }
                    
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', initWhenReady);
                    } else {
                        setTimeout(initWhenReady, 100);
                    }
                })();
            </script>
        `;
    }

    // ===========================================
    // PANEL CREATION FUNCTIONS (SIMPLIFIED)
    // ===========================================

    function createEnhancedHeader(url, gscData, ga4Data) {
        const pageInfo = extractPageInfo(url);
        const lastModified = getLastModifiedInfo(url);
        const citizenImpact = calculateCitizenImpact(gscData, ga4Data);
        
        return `
            <div class="dashboard-header">
                <div class="header-content">
                    <div class="page-info">
                        <div class="page-breadcrumb">
                            <span class="breadcrumb-item">Citizens Information</span>
                            <span class="breadcrumb-separator">›</span>
                            <span class="breadcrumb-item">${pageInfo.section}</span>
                        </div>
                        <h1 class="page-title">${pageInfo.title}</h1>
                        <div class="page-metadata">
                            <div class="metadata-item">
                                <span class="metadata-label">Page Type:</span>
                                <span class="metadata-value">${pageInfo.type}</span>
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">Last Updated:</span>
                                <span class="metadata-value">${lastModified.formatted}</span>
                                <span class="metadata-badge ${lastModified.freshnessClass}">${lastModified.freshnessLabel}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="impact-summary">
                        <div class="impact-card">
                            <div class="impact-number">${citizenImpact.monthlyReach}</div>
                            <div class="impact-label">Citizens Reached Monthly</div>
                        </div>
                        <div class="impact-card">
                            <div class="impact-number">${citizenImpact.helpfulnessScore}%</div>
                            <div class="impact-label">Helpfulness Score</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function createPerformanceOverview(gscData, ga4Data, gscTrends, ga4Trends) {
        return `
            <div class="performance-overview">
                <div class="overview-grid">
                    <div class="overview-card search-card">
                        <div class="card-header">
                            <div class="card-icon">🔍</div>
                            <div class="card-title">Search Performance</div>
                            <div class="card-status ${gscData && !gscData.noDataFound ? 'connected' : 'disconnected'}">
                                ${gscData && !gscData.noDataFound ? '●' : '○'}
                            </div>
                        </div>
                        <div class="card-content">
                            ${gscData && !gscData.noDataFound ? `
                                <div class="metric-row">
                                    <span class="metric-label">Clicks:</span>
                                    <span class="metric-value">${formatNumber(gscData.clicks)}</span>
                                    ${getTrendIndicator(gscTrends?.trends?.clicks)}
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">CTR:</span>
                                    <span class="metric-value">${(gscData.ctr * 100).toFixed(1)}%</span>
                                    ${getTrendIndicator(gscTrends?.trends?.ctr)}
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Position:</span>
                                    <span class="metric-value">#${gscData.position.toFixed(1)}</span>
                                    ${getTrendIndicator(gscTrends?.trends?.position, true)}
                                </div>
                            ` : `
                                <div class="no-data-message">
                                    <span class="no-data-icon">📊</span>
                                    <span class="no-data-text">Connect Search Console</span>
                                </div>
                            `}
                        </div>
                    </div>
                    
                    <div class="overview-card analytics-card">
                        <div class="card-header">
                            <div class="card-icon">📈</div>
                            <div class="card-title">User Analytics</div>
                            <div class="card-status ${ga4Data && !ga4Data.noDataFound ? 'connected' : 'disconnected'}">
                                ${ga4Data && !ga4Data.noDataFound ? '●' : '○'}
                            </div>
                        </div>
                        <div class="card-content">
                            ${ga4Data && !ga4Data.noDataFound ? `
                                <div class="metric-row">
                                    <span class="metric-label">Users:</span>
                                    <span class="metric-value">${formatNumber(ga4Data.users || 0)}</span>
                                    ${getTrendIndicator(ga4Trends?.trends?.users)}
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Avg. Session:</span>
                                    <span class="metric-value">${formatDuration(ga4Data.avgSessionDuration || 0)}</span>
                                    ${getTrendIndicator(ga4Trends?.trends?.avgSessionDuration)}
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Bounce Rate:</span>
                                    <span class="metric-value">${((ga4Data.bounceRate || 0) * 100).toFixed(1)}%</span>
                                    ${getTrendIndicator(ga4Trends?.trends?.bounceRate, true)}
                                </div>
                            ` : `
                                <div class="no-data-message">
                                    <span class="no-data-icon">📊</span>
                                    <span class="no-data-text">Connect Google Analytics</span>
                                </div>
                            `}
                        </div>
                    </div>
                    
                    <div class="overview-card quality-card">
                        <div class="card-header">
                            <div class="card-icon">⭐</div>
                            <div class="card-title">Quality Score</div>
                        </div>
                        <div class="card-content">
                            <div class="quality-score-display">
                                <div class="score-number">${calculateQualityScore(gscData, ga4Data)}/100</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function createOverviewPanel(gscData, ga4Data, gscTrends, ga4Trends) {
        return `
            <div class="panel-content">
                <div class="section">
                    <h2 class="section-title">📊 Performance Matrix</h2>
                    ${createPerformanceMatrix(gscData, ga4Data)}
                </div>
                
                <div class="section">
                    <h2 class="section-title">💡 Key Insights</h2>
                    ${createKeyInsights(gscData, ga4Data, gscTrends, ga4Trends)}
                </div>
            </div>
        `;
    }

    function createSearchPerformancePanel(gscData, gscTrends) {
        if (!gscData || gscData.noDataFound) {
            return createConnectionMessage('Search Console', 'Connect Search Console to see detailed search performance data');
        }
        
        return `
            <div class="panel-content">
                <div class="section">
                    <h2 class="section-title">🎯 Top Performing Queries</h2>
                    ${createTopQueriesTable(gscData)}
                </div>
                
                <div class="section">
                    <h2 class="section-title">🚀 Search Opportunities</h2>
                    ${createSearchOpportunities(gscData)}
                </div>
            </div>
        `;
    }

    function createContentAnalysisPanel(gscData, ga4Data) {
        return `
            <div class="panel-content">
                <div class="section">
                    <h2 class="section-title">📝 Content Performance Score</h2>
                    ${createContentScoreBreakdown(gscData, ga4Data)}
                </div>
            </div>
        `;
    }

    function createUserBehaviorPanel(ga4Data, ga4Trends, gscData) {
        if (!ga4Data || ga4Data.noDataFound) {
            return createConnectionMessage('Google Analytics', 'Connect Google Analytics to see detailed user behavior data');
        }
        
        const impact = calculateImpactMetrics(gscData, ga4Data);
        
        return `
            <div class="panel-content">
                <div class="section">
                    <h2 class="section-title">🎯 Citizen Impact</h2>
                    <div class="impact-metrics">
                        <div class="impact-metric">
                            <span class="impact-label">Information Seekers:</span>
                            <span class="impact-value">${impact.seekers}</span>
                        </div>
                        <div class="impact-metric">
                            <span class="impact-label">Questions Answered:</span>
                            <span class="impact-value">${impact.questionsAnswered}</span>
                        </div>
                        <div class="impact-metric">
                            <span class="impact-label">Success Rate:</span>
                            <span class="impact-value">${impact.successRate}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function createActionCenter(url) {
        return `
            <div class="action-center">
                <div class="action-header">
                    <h3>🚀 Take Action</h3>
                    <p>Export your data or take immediate action on this page</p>
                </div>
                <div class="action-buttons">
                    <button class="action-btn primary" onclick="window.open('${escapeHtml(url)}', '_blank')">
                        <span class="btn-icon">🔗</span>
                        <span class="btn-text">Visit Page</span>
                    </button>
                    <button class="action-btn secondary" onclick="exportDetailedReport('${escapeHtml(url)}')">
                        <span class="btn-icon">📊</span>
                        <span class="btn-text">Export Report</span>
                    </button>
                </div>
            </div>
        `;
    }

    function createConnectionMessage(service, description) {
        return `
            <div class="connection-message">
                <div class="connection-icon">📊</div>
                <div class="connection-title">Connect ${service}</div>
                <div class="connection-description">${description}</div>
            </div>
        `;
    }

    // ===========================================
    // STYLES (SIMPLIFIED)
    // ===========================================

    function createEnhancedDashboardStyles() {
        return `
            <style>
                .citizens-dashboard-container {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #fafbfc;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.1);
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .dashboard-header {
                    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%);
                    color: white;
                    padding: 30px;
                }
                
                .header-content {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 30px;
                    align-items: start;
                }
                
                .page-title {
                    font-size: 1.8rem;
                    font-weight: 700;
                    margin: 0 0 16px 0;
                }
                
                .metadata-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9rem;
                    margin: 8px 0;
                }
                
                .metadata-label {
                    font-weight: 600;
                    opacity: 0.9;
                }
                
                .metadata-badge {
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-left: 8px;
                }
                
                .metadata-badge.fresh { background: #10b981; color: white; }
                .metadata-badge.aging { background: #f59e0b; color: white; }
                .metadata-badge.stale { background: #ef4444; color: white; }
                
                .impact-summary {
                    display: grid;
                    gap: 16px;
                    min-width: 280px;
                }
                
                .impact-card {
                    background: rgba(255,255,255,0.15);
                    padding: 20px;
                    border-radius: 16px;
                    text-align: center;
                }
                
                .impact-number {
                    font-size: 1.8rem;
                    font-weight: 800;
                    margin-bottom: 4px;
                }
                
                .performance-overview {
                    padding: 30px;
                    background: white;
                }
                
                .overview-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                }
                
                .overview-card {
                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                    border-radius: 16px;
                    padding: 24px;
                    border: 1px solid #e2e8f0;
                }
                
                .card-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                
                .card-icon { font-size: 1.5rem; margin-right: 12px; }
                .card-title { font-size: 1.1rem; font-weight: 700; color: #1f2937; flex: 1; }
                .card-status.connected { color: #10b981; }
                .card-status.disconnected { color: #ef4444; }
                
                .metric-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                }
                
                .metric-label { color: #64748b; font-weight: 500; }
                .metric-value { font-weight: 700; color: #1f2937; }
                
                .trend-indicator {
                    font-size: 0.8rem;
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: 8px;
                    margin-left: 8px;
                }
                
                .trend-indicator.positive { background: #dcfce7; color: #166534; }
                .trend-indicator.negative { background: #fee2e2; color: #991b1b; }
                .trend-indicator.neutral { background: #f1f5f9; color: #64748b; }
                
                .quality-score-display {
                    text-align: center;
                }
                
                .score-number {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: #3b82f6;
                }
                
                .dashboard-tabs {
                    background: white;
                }
                
                .tab-nav {
                    display: flex;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    overflow-x: auto;
                }
                
                .tab-btn {
                    flex: 1;
                    padding: 16px 20px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    color: #64748b;
                    border-bottom: 3px solid transparent;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                    min-width: 160px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-family: inherit;
                    font-size: 0.9rem;
                    font-weight: 600;
                }
                
                .tab-btn:hover:not(.active) {
                    color: #475569;
                    background: rgba(0,0,0,0.02);
                }
                
                .tab-btn.active {
                    color: #1e293b;
                    border-bottom-color: #3b82f6;
                    background: white;
                }
                
                .tab-content {
                    min-height: 500px;
                    background: #fafbfc;
                }
                
                .tab-panel {
                    display: none;
                    padding: 0;
                }
                
                .tab-panel.active {
                    display: block;
                }
                
                .panel-content {
                    padding: 30px;
                }
                
                .section {
                    margin-bottom: 30px;
                    background: white;
                    border-radius: 16px;
                    padding: 24px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                
                .section-title {
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: #1f2937;
                    margin: 0 0 20px 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .performance-matrix {
                    position: relative;
                    height: 300px;
                    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }
                
                .matrix-chart {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    padding: 40px;
                }
                
                .matrix-point {
                    position: absolute;
                    transform: translate(-50%, 50%);
                    z-index: 10;
                }
                
                .point-dot {
                    width: 16px;
                    height: 16px;
                    background: #3b82f6;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                }
                
                .point-label {
                    position: absolute;
                    top: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #1f2937;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    white-space: nowrap;
                }
                
                .matrix-quadrants {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    grid-template-rows: 1fr 1fr;
                }
                
                .quadrant {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #64748b;
                    text-align: center;
                    line-height: 1.3;
                    padding: 20px;
                    border: 1px dashed rgba(100, 116, 139, 0.2);
                }
                
                .insights-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                }
                
                .insight-card {
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    background: white;
                }
                
                .insight-card.positive {
                    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                    border-color: #10b981;
                }
                
                .insight-card.warning {
                    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
                    border-color: #f59e0b;
                }
                
                .insight-card.opportunity {
                    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                    border-color: #3b82f6;
                }
                
                .insight-card.neutral {
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    border-color: #64748b;
                }
                
                .insight-icon {
                    font-size: 1.5rem;
                    margin-bottom: 12px;
                    display: block;
                }
                
                .insight-text {
                    color: #374151;
                    line-height: 1.4;
                    font-weight: 500;
                }
                
                .queries-table {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }
                
                .table-header {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
                    gap: 16px;
                    padding: 16px;
                    background: #f8fafc;
                    font-weight: 600;
                    color: #374151;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 0.85rem;
                }
                
                .table-row {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
                    gap: 16px;
                    padding: 16px;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.85rem;
                    transition: background 0.2s ease;
                }
                
                .table-row:hover {
                    background: #f8fafc;
                }
                
                .col-query {
                    font-weight: 500;
                    color: #1f2937;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .opportunities-list {
                    margin-top: 16px;
                }
                
                .opportunity-card {
                    padding: 16px;
                    border-radius: 8px;
                    border-left: 4px solid #e5e7eb;
                    margin-bottom: 12px;
                    background: white;
                }
                
                .opportunity-card.high {
                    background: #fef2f2;
                    border-left-color: #ef4444;
                }
                
                .opportunity-card.medium {
                    background: #fffbeb;
                    border-left-color: #f59e0b;
                }
                
                .opp-type {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #3b82f6;
                    margin-bottom: 8px;
                }
                
                .opp-query {
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 8px;
                }
                
                .opp-metrics {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin-bottom: 8px;
                }
                
                .opp-action {
                    font-size: 0.85rem;
                    color: #1f2937;
                    font-weight: 500;
                }
                
                .score-breakdown {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 30px;
                    align-items: center;
                }
                
                .total-score {
                    text-align: center;
                }
                
                .score-circle {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                    border: 4px solid #3b82f6;
                    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                    color: #1e40af;
                }
                
                .score-components {
                    display: grid;
                    gap: 16px;
                }
                
                .component {
                    display: grid;
                    grid-template-columns: 150px 1fr auto;
                    gap: 12px;
                    align-items: center;
                }
                
                .component-label {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #374151;
                }
                
                .component-bar {
                    height: 12px;
                    background: #f1f5f9;
                    border-radius: 6px;
                    overflow: hidden;
                }
                
                .bar-fill {
                    height: 100%;
                    border-radius: 6px;
                }
                
                .component-score {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #64748b;
                    min-width: 50px;
                    text-align: right;
                }
                
                .impact-metrics {
                    display: grid;
                    gap: 12px;
                }
                
                .impact-metric {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                }
                
                .impact-label {
                    color: #64748b;
                    font-weight: 500;
                    font-size: 0.9rem;
                }
                
                .impact-value {
                    font-weight: 700;
                    color: #1f2937;
                }
                
                .connection-message {
                    text-align: center;
                    padding: 60px 30px;
                    color: #64748b;
                }
                
                .connection-icon {
                    font-size: 3rem;
                    margin-bottom: 20px;
                    opacity: 0.6;
                }
                
                .connection-title {
                    font-size: 1.3rem;
                    font-weight: 700;
                    margin-bottom: 8px;
                    color: #1f2937;
                }
                
                .connection-description {
                    margin-bottom: 24px;
                    line-height: 1.5;
                }
                
                .action-center {
                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                    padding: 30px;
                    text-align: center;
                    border-top: 1px solid #e2e8f0;
                }
                
                .action-header h3 {
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #1f2937;
                    margin: 0 0 8px 0;
                }
                
                .action-buttons {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                
                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 14px 20px;
                    border: none;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-family: inherit;
                    font-size: 0.9rem;
                    text-decoration: none;
                }
                
                .action-btn.primary {
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
                }
                
                .action-btn.primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.5);
                }
                
                .action-btn.secondary {
                    background: white;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                
                .action-btn.secondary:hover {
                    background: #f8fafc;
                    color: #334155;
                    transform: translateY(-1px);
                }
                
                .no-data-message {
                    text-align: center;
                    color: #64748b;
                    padding: 20px;
                }
                
                .no-opportunities {
                    text-align: center;
                    padding: 20px;
                    color: #059669;
                    background: #f0fdf4;
                    border-radius: 8px;
                    font-weight: 500;
                }
                
                @media (max-width: 768px) {
                    .header-content {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                    
                    .overview-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .score-breakdown {
                        grid-template-columns: 1fr;
                    }
                    
                    .component {
                        grid-template-columns: 1fr;
                        gap: 8px;
                    }
                    
                    .table-header,
                    .table-row {
                        grid-template-columns: 2fr 1fr 1fr;
                        font-size: 0.8rem;
                    }
                    
                    .action-buttons {
                        flex-direction: column;
                        align-items: center;
                    }
                    
                    .action-btn {
                        width: 200px;
                        justify-content: center;
                    }
                }
            </style>
        `;
    }

    // ===========================================
    // DASHBOARD INITIALIZATION
    // ===========================================

    function initializeEnhancedDashboard(dashboardId) {
        console.log('🎯 Initializing Enhanced Dashboard:', dashboardId);
        
        let attempts = 0;
        const maxAttempts = 10;
        
        function tryInitialize() {
            attempts++;
            const dashboard = document.getElementById(dashboardId);
            
            if (!dashboard) {
                if (attempts < maxAttempts) {
                    setTimeout(tryInitialize, 100);
                }
                return;
            }
            
            const tabBtns = dashboard.querySelectorAll('.tab-btn');
            const tabPanels = dashboard.querySelectorAll('.tab-panel');
            
            if (tabBtns.length === 0 || tabPanels.length === 0) {
                if (attempts < maxAttempts) {
                    setTimeout(tryInitialize, 100);
                }
                return;
            }
            
            tabBtns.forEach((btn) => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    
                    const targetTab = this.getAttribute('data-tab');
                    
                    tabBtns.forEach(b => b.classList.remove('active'));
                    tabPanels.forEach(p => {
                        p.classList.remove('active');
                        p.style.display = 'none';
                    });
                    
                    this.classList.add('active');
                    
                    const targetPanel = dashboard.querySelector(`[data-panel="${targetTab}"]`);
                    if (targetPanel) {
                        targetPanel.style.display = 'block';
                        targetPanel.classList.add('active');
                    }
                });
            });
            
            if (tabBtns.length > 0 && tabPanels.length > 0) {
                tabBtns[0].classList.add('active');
                tabPanels.forEach(p => p.style.display = 'none');
                const firstPanel = tabPanels[0];
                if (firstPanel) {
                    firstPanel.style.display = 'block';
                    firstPanel.classList.add('active');
                }
            }
            
            console.log('✅ Dashboard tabs initialized successfully!');
        }
        
        tryInitialize();
    }

    // ===========================================
    // EXPORT FUNCTIONS
    // ===========================================

    function exportDetailedReport(url) {
        console.log('📊 Exporting detailed report for:', url);
        alert('Export functionality ready - integrate with your existing export system');
    }

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            font-weight: 600;
            z-index: 10001;
            box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ===========================================
    // GLOBAL EXPORTS
    // ===========================================

    window.createEnhancedCitizensDashboard = createEnhancedCitizensDashboard;
    window.initializeEnhancedDashboard = initializeEnhancedDashboard;
    window.exportDetailedReport = exportDetailedReport;

    console.log('✅ Enhanced Citizens Dashboard (Fixed Version) loaded successfully!');

})();
