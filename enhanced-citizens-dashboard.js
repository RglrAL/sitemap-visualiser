// enhanced-citizens-dashboard.js
// Comprehensive enhanced dashboard for Citizens Information analytics

(function() {
    'use strict';

    // ===========================================
    // MAIN ENHANCED DASHBOARD FUNCTION
    // ===========================================

    function createEnhancedCitizensDashboard(url, gscData, ga4Data, gscTrends, ga4Trends, trafficSources, deviceData) {
        return `
            ${createEnhancedDashboardStyles()}
            
            <!-- Enhanced Executive Summary -->
            <div class="citizen-impact-header">
                <div class="impact-hero">
                    <h1>🏛️ Citizens Information Impact Report</h1>
                    <div class="page-url">${url}</div>
                    <div class="hero-stats">
                        <div class="hero-stat">
                            <span class="hero-number">${formatNumber((gscData?.clicks || 0) + (ga4Data?.users || 0))}</span>
                            <span class="hero-label">Citizens Helped Monthly</span>
                        </div>
                        <div class="hero-stat">
                            <span class="hero-number">${calculateCitizenSatisfaction(ga4Data)}%</span>
                            <span class="hero-label">Information Success Rate</span>
                        </div>
                        <div class="hero-stat">
                            <span class="hero-number">${calculateTimeToInformation(ga4Data)}</span>
                            <span class="hero-label">Avg. Time to Find Info</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Enhanced Tabbed Content -->
            <div class="dashboard-tabs">
                <div class="tab-nav">
                    <button class="tab-btn active" data-tab="overview">📊 Overview</button>
                    <button class="tab-btn" data-tab="content">📝 Content Intelligence</button>
                    <button class="tab-btn" data-tab="quality">✨ Quality Assessment</button>
                    <button class="tab-btn" data-tab="trends">📈 Trend Analysis</button>
                    <button class="tab-btn" data-tab="actions">⚡ Action Plan</button>
                </div>
                
                <div class="tab-content">
                    <div class="tab-panel active" data-panel="overview">
                        ${createOverviewPanel(gscData, ga4Data, gscTrends, ga4Trends)}
                    </div>
                    
                    <div class="tab-panel" data-panel="content">
                        ${createContentIntelligencePanel(gscData, ga4Data)}
                    </div>
                    
                    <div class="tab-panel" data-panel="quality">
                        ${createQualityAssessmentPanel(ga4Data, gscData)}
                    </div>
                    
                    <div class="tab-panel" data-panel="trends">
                        ${createTrendAnalysisPanel(gscTrends, ga4Trends)}
                    </div>
                    
                    <div class="tab-panel" data-panel="actions">
                        ${createActionPlanPanel(gscData, ga4Data, gscTrends, ga4Trends)}
                    </div>
                </div>
            </div>

            <!-- Enhanced Action Center -->
            <div class="action-center">
                <h3>📊 Export & Implementation Tools</h3>
                <div class="action-buttons">
                    <button class="action-btn primary" onclick="window.open('${escapeHtml(url)}', '_blank')">
                        <span>🔗</span><span>Visit Page</span>
                    </button>
                    <button class="action-btn secondary" onclick="exportEnhancedReport('${escapeHtml(url)}')">
                        <span>📊</span><span>Export Enhanced Report</span>
                    </button>
                    <button class="action-btn secondary" onclick="copyEnhancedSummary('${escapeHtml(url)}')">
                        <span>📋</span><span>Copy Summary</span>
                    </button>
                </div>
            </div>

            <script>
                // Initialize enhanced dashboard interactions
                setTimeout(() => {
                    initializeEnhancedDashboard();
                }, 100);
            </script>
        `;
    }

    // ===========================================
    // PANEL CREATION FUNCTIONS
    // ===========================================

    function createOverviewPanel(gscData, ga4Data, gscTrends, ga4Trends) {
        return `
            <!-- Performance Matrix -->
            ${createContentPerformanceMatrix(gscData, ga4Data)}
            
            <!-- Key Metrics Overview -->
            <div class="section metrics-overview">
                <h2 class="section-title">📊 Key Performance Metrics</h2>
                <div class="metrics-grid">
                    ${createSearchConsoleMetrics(gscData, gscTrends)}
                    ${createGA4Metrics(ga4Data, ga4Trends)}
                    ${createCrossMetrics(gscData, ga4Data)}
                </div>
            </div>
        `;
    }

    function createContentIntelligencePanel(gscData, ga4Data) {
        return `
            ${createQueryIntelligenceSection(gscData)}
            ${createContentGapAnalysis(gscData, ga4Data)}
        `;
    }

    function createQualityAssessmentPanel(ga4Data, gscData) {
        return `
            ${createTrafficQualitySection(ga4Data, gscData)}
            ${createUserExperienceAnalysis(ga4Data)}
        `;
    }

    function createTrendAnalysisPanel(gscTrends, ga4Trends) {
        return `
            ${createTrendImpactSection(gscTrends, ga4Trends)}
            ${createForecastingSection(gscTrends, ga4Trends)}
        `;
    }

    function createActionPlanPanel(gscData, ga4Data, gscTrends, ga4Trends) {
        return `
            ${createPriorityActionsSection(gscData, ga4Data, gscTrends, ga4Trends)}
            ${createImplementationTimelineSection(gscData, ga4Data)}
        `;
    }

    // ===========================================
    // CONTENT PERFORMANCE MATRIX
    // ===========================================

    function createContentPerformanceMatrix(gscData, ga4Data) {
        const searchPerformance = calculateSearchScore(gscData);
        const userEngagement = calculateEngagementScore(ga4Data);
        
        return `
            <div class="section performance-matrix">
                <h2 class="section-title">📊 Content Performance Matrix</h2>
                
                <div class="matrix-container">
                    <div class="matrix-display">
                        <div class="matrix-quadrant ${getQuadrantClass(searchPerformance, userEngagement)}">
                            <div class="quadrant-label">${getQuadrantLabel(searchPerformance, userEngagement)}</div>
                            <div class="quadrant-metrics">
                                <div class="metric-pair">
                                    <span class="metric-label">Search Performance:</span>
                                    <span class="metric-value">${searchPerformance}/100</span>
                                </div>
                                <div class="metric-pair">
                                    <span class="metric-label">User Engagement:</span>
                                    <span class="metric-value">${userEngagement}/100</span>
                                </div>
                            </div>
                            <div class="quadrant-recommendation">
                                ${getQuadrantRecommendation(searchPerformance, userEngagement)}
                            </div>
                        </div>
                    </div>
                    
                    <div class="matrix-insights">
                        <h3>📈 Performance Insights</h3>
                        <div class="insights-list">
                            ${generateMatrixInsights(searchPerformance, userEngagement, gscData, ga4Data)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ===========================================
    // QUERY INTELLIGENCE SECTION
    // ===========================================

    function createQueryIntelligenceSection(gscData) {
        if (!gscData?.topQueries || gscData.topQueries.length === 0) {
            return `
                <div class="section query-intelligence">
                    <h2 class="section-title">🧠 Search Query Intelligence</h2>
                    <div class="no-data-message">
                        <div class="no-data-icon">🔍</div>
                        <div class="no-data-text">No query data available for analysis</div>
                    </div>
                </div>
            `;
        }
        
        const queryAnalysis = analyzeExistingQueries(gscData.topQueries);
        
        return `
            <div class="section query-intelligence">
                <h2 class="section-title">🧠 Search Query Intelligence</h2>
                
                <!-- Query Categories -->
                <div class="query-categories">
                    <div class="category-grid">
                        ${Object.entries(queryAnalysis.categories).map(([category, queries]) => 
                            queries.length > 0 ? `
                                <div class="category-card ${category}">
                                    <div class="category-header">
                                        <span class="category-icon">${getCategoryIcon(category)}</span>
                                        <span class="category-name">${category.replace('_', ' ').toUpperCase()}</span>
                                        <span class="category-count">${queries.length}</span>
                                    </div>
                                    <div class="category-metrics">
                                        <div>Total Clicks: ${queries.reduce((sum, q) => sum + q.clicks, 0)}</div>
                                        <div>Avg Position: ${(queries.reduce((sum, q) => sum + q.position, 0) / queries.length).toFixed(1)}</div>
                                        <div>Avg CTR: ${((queries.reduce((sum, q) => sum + q.ctr, 0) / queries.length) * 100).toFixed(1)}%</div>
                                    </div>
                                    <div class="category-action">
                                        ${getCategoryRecommendation(category, queries)}
                                    </div>
                                </div>
                            ` : ''
                        ).join('')}
                    </div>
                </div>
                
                <!-- Query Opportunities -->
                <div class="query-opportunities">
                    <h3>⚡ Immediate Query Opportunities</h3>
                    <div class="opportunities-list">
                        ${queryAnalysis.opportunities.length > 0 ? 
                            queryAnalysis.opportunities.map(opp => `
                                <div class="opportunity-item ${opp.priority}">
                                    <div class="opp-query">"${escapeHtml(opp.query)}"</div>
                                    <div class="opp-metrics">
                                        ${formatNumber(opp.impressions)} impressions • Position ${opp.position.toFixed(0)} • ${(opp.ctr * 100).toFixed(1)}% CTR
                                    </div>
                                    <div class="opp-action">${opp.action}</div>
                                </div>
                            `).join('') : 
                            '<div class="no-opportunities">✅ No immediate optimization opportunities found</div>'
                        }
                    </div>
                </div>
            </div>
        `;
    }

    // ===========================================
    // TRAFFIC QUALITY SECTION
    // ===========================================

    function createTrafficQualitySection(ga4Data, gscData) {
        if (!ga4Data || ga4Data.noDataFound) {
            return `
                <div class="section traffic-quality">
                    <h2 class="section-title">✨ Traffic Quality Assessment</h2>
                    <div class="no-ga4-message">
                        <div class="no-data-icon">📊</div>
                        <div class="no-data-text">Connect GA4 for detailed traffic quality analysis</div>
                        <div class="no-data-action">Click the GA4 button in the toolbar to connect</div>
                    </div>
                </div>
            `;
        }
        
        const qualityMetrics = calculateTrafficQuality(ga4Data, gscData);
        
        return `
            <div class="section traffic-quality">
                <h2 class="section-title">✨ Traffic Quality Assessment</h2>
                
                <div class="quality-overview">
                    <div class="quality-score-card">
                        <div class="score-circle ${qualityMetrics.overall.grade.toLowerCase()}">
                            <div class="score-number">${qualityMetrics.overall.score}</div>
                            <div class="score-label">Quality Score</div>
                        </div>
                        <div class="score-grade">Grade: ${qualityMetrics.overall.grade}</div>
                        <div class="score-description">${qualityMetrics.overall.description}</div>
                    </div>
                    
                    <div class="quality-breakdown">
                        <div class="quality-metric">
                            <div class="metric-header">
                                <span class="metric-icon">🎯</span>
                                <span class="metric-name">Search Relevance</span>
                                <span class="metric-score ${qualityMetrics.relevance.status}">${qualityMetrics.relevance.score}/100</span>
                            </div>
                            <div class="metric-insight">${qualityMetrics.relevance.insight}</div>
                        </div>
                        
                        <div class="quality-metric">
                            <div class="metric-header">
                                <span class="metric-icon">⏱️</span>
                                <span class="metric-name">User Engagement</span>
                                <span class="metric-score ${qualityMetrics.engagement.status}">${qualityMetrics.engagement.score}/100</span>
                            </div>
                            <div class="metric-insight">${qualityMetrics.engagement.insight}</div>
                        </div>
                        
                        <div class="quality-metric">
                            <div class="metric-header">
                                <span class="metric-icon">🔄</span>
                                <span class="metric-name">User Retention</span>
                                <span class="metric-score ${qualityMetrics.retention.status}">${qualityMetrics.retention.score}/100</span>
                            </div>
                            <div class="metric-insight">${qualityMetrics.retention.insight}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Quality Improvement Actions -->
                <div class="quality-actions">
                    <h3>🚀 Quality Improvement Actions</h3>
                    <div class="actions-grid">
                        ${qualityMetrics.actions.length > 0 ? 
                            qualityMetrics.actions.map(action => `
                                <div class="action-card ${action.priority}">
                                    <div class="action-title">${action.title}</div>
                                    <div class="action-description">${action.description}</div>
                                    <div class="action-impact">Expected Impact: ${action.impact}</div>
                                </div>
                            `).join('') :
                            '<div class="no-actions">✅ No immediate quality issues detected</div>'
                        }
                    </div>
                </div>
            </div>
        `;
    }

    // ===========================================
    // TREND IMPACT SECTION
    // ===========================================

    function createTrendImpactSection(gscTrends, ga4Trends) {
        if (!gscTrends?.trends && !ga4Trends?.trends) {
            return `
                <div class="section trend-impact">
                    <h2 class="section-title">📈 Trend Impact Analysis</h2>
                    <div class="no-data-message">
                        <div class="no-data-icon">📊</div>
                        <div class="no-data-text">No trend data available for analysis</div>
                        <div class="no-data-subtitle">Trend analysis requires historical comparison data</div>
                    </div>
                </div>
            `;
        }
        
        const trendAnalysis = analyzeTrendImpact(gscTrends, ga4Trends);
        
        return `
            <div class="section trend-impact">
                <h2 class="section-title">📈 Trend Impact Analysis</h2>
                
                <div class="trend-summary">
                    <div class="trend-indicator ${trendAnalysis.overall.direction}">
                        <div class="trend-icon">${trendAnalysis.overall.icon}</div>
                        <div class="trend-label">${trendAnalysis.overall.label}</div>
                        <div class="trend-description">${trendAnalysis.overall.description}</div>
                    </div>
                </div>
                
                <div class="trend-breakdown">
                    <div class="trend-metrics-grid">
                        ${Object.entries(trendAnalysis.metrics).map(([metric, data]) => `
                            <div class="trend-metric-card ${data.direction}">
                                <div class="trend-metric-header">
                                    <span class="trend-metric-name">${metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                                    <span class="trend-change ${data.direction}">
                                        ${data.direction === 'up' ? '↗' : data.direction === 'down' ? '↘' : '→'} ${Math.abs(data.change).toFixed(1)}%
                                    </span>
                                </div>
                                <div class="trend-values">
                                    <span class="current-value">${data.current}</span>
                                    <span class="previous-value">was ${data.previous}</span>
                                </div>
                                <div class="trend-insight">${data.insight}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="trend-actions">
                    <h3>🎯 Trend-Based Actions</h3>
                    <div class="trend-actions-list">
                        ${trendAnalysis.actions.length > 0 ? 
                            trendAnalysis.actions.map(action => `
                                <div class="trend-action ${action.urgency}">
                                    <div class="action-urgency">${action.urgency.toUpperCase()}</div>
                                    <div class="action-content">
                                        <div class="action-title">${action.title}</div>
                                        <div class="action-reason">${action.reason}</div>
                                    </div>
                                </div>
                            `).join('') :
                            '<div class="no-actions">📊 Continue monitoring current trends</div>'
                        }
                    </div>
                </div>
            </div>
        `;
    }

    // ===========================================
    // CALCULATION FUNCTIONS
    // ===========================================

    function calculateSearchScore(gscData) {
        if (!gscData || gscData.noDataFound) return 0;
        
        const positionScore = Math.max(0, 100 - (gscData.position * 5));
        const ctrScore = Math.min(100, (gscData.ctr * 100) * 10);
        const volumeScore = Math.min(100, (gscData.clicks / 100) * 10);
        
        return Math.round((positionScore * 0.4) + (ctrScore * 0.4) + (volumeScore * 0.2));
    }

    function calculateEngagementScore(ga4Data) {
        if (!ga4Data || ga4Data.noDataFound) return 0;
        
        const durationScore = Math.min(100, (ga4Data.avgSessionDuration / 300) * 100);
        const bounceScore = Math.max(0, (1 - ga4Data.bounceRate) * 100);
        const engagementScore = (ga4Data.engagementRate || 0) * 100;
        
        return Math.round((durationScore * 0.4) + (bounceScore * 0.3) + (engagementScore * 0.3));
    }

    function calculateTrafficQuality(ga4Data, gscData) {
        // Get expected CTR benchmark
        const expectedCTR = getCTRBenchmark(gscData?.position || 20);
        const ctrPerformance = (gscData?.ctr || 0) / expectedCTR;
        const relevanceScore = Math.min(100, ctrPerformance * 100);
        
        // Engagement Score
        const durationScore = Math.min(100, (ga4Data.avgSessionDuration / 120) * 50);
        const bounceScore = Math.max(0, (1 - ga4Data.bounceRate) * 50);
        const engagementScore = Math.min(100, durationScore + bounceScore);
        
        // Retention Score
        const returnRate = ga4Data.users > 0 ? ((ga4Data.users - (ga4Data.newUsers || 0)) / ga4Data.users) : 0;
        const pagesPerSession = ga4Data.sessions > 0 ? (ga4Data.pageViews / ga4Data.sessions) : 1;
        const retentionScore = Math.min(100, (returnRate * 60) + (Math.min(3, pagesPerSession) / 3 * 40));
        
        // Overall score
        const overallScore = Math.round((relevanceScore * 0.4) + (engagementScore * 0.35) + (retentionScore * 0.25));
        
        // Generate actions
        const actions = [];
        
        if (relevanceScore < 50) {
            actions.push({
                priority: 'high',
                title: 'Improve Search Result Relevance',
                description: 'Your CTR is below expected levels. Optimize title tags and meta descriptions.',
                impact: '+15-30% click-through rate'
            });
        }
        
        if (engagementScore < 60) {
            actions.push({
                priority: 'medium',
                title: 'Enhance Content Engagement',
                description: 'Users are not engaging deeply with content. Improve readability and structure.',
                impact: '+20-40% time on page'
            });
        }
        
        if (retentionScore < 40) {
            actions.push({
                priority: 'medium',
                title: 'Improve Content Discoverability',
                description: 'Add related content links and improve internal navigation.',
                impact: '+10-25% pages per session'
            });
        }
        
        return {
            overall: {
                score: overallScore,
                grade: overallScore >= 80 ? 'A' : overallScore >= 60 ? 'B' : overallScore >= 40 ? 'C' : 'D',
                description: overallScore >= 80 ? 'Excellent traffic quality' : 
                            overallScore >= 60 ? 'Good traffic quality' : 
                            overallScore >= 40 ? 'Fair traffic quality' : 'Poor traffic quality - needs improvement'
            },
            relevance: {
                score: Math.round(relevanceScore),
                status: relevanceScore >= 70 ? 'excellent' : relevanceScore >= 50 ? 'good' : 'poor',
                insight: ctrPerformance >= 1.2 ? 'Title and description are highly relevant to searches' :
                        ctrPerformance >= 0.8 ? 'Search relevance is acceptable' :
                        'Search results may not match user intent'
            },
            engagement: {
                score: Math.round(engagementScore),
                status: engagementScore >= 70 ? 'excellent' : engagementScore >= 50 ? 'good' : 'poor',
                insight: ga4Data.avgSessionDuration > 120 ? 'Users are thoroughly reading content' :
                        ga4Data.avgSessionDuration > 60 ? 'Moderate content engagement' :
                        'Users are leaving quickly - content may not meet expectations'
            },
            retention: {
                score: Math.round(retentionScore),
                status: retentionScore >= 60 ? 'excellent' : retentionScore >= 40 ? 'good' : 'poor',
                insight: returnRate > 0.3 ? 'Strong return visitor rate' :
                        returnRate > 0.15 ? 'Moderate return visitor engagement' :
                        'Low return visits - content may not encourage deeper exploration'
            },
            actions: actions
        };
    }

    // ===========================================
    // ANALYSIS FUNCTIONS
    // ===========================================

    function analyzeExistingQueries(topQueries) {
        const categories = {
            how_to: [],
            what_is: [],
            where_can: [],
            when_does: [],
            application: [],
            form: [],
            emergency: [],
            other: []
        };
        
        const opportunities = [];
        
        topQueries.forEach(query => {
            const queryText = query.query.toLowerCase();
            
            // Categorize queries
            if (queryText.includes('how to') || queryText.includes('how do') || queryText.includes('how can')) {
                categories.how_to.push(query);
            } else if (queryText.includes('what is') || queryText.includes('what are') || queryText.includes('what does')) {
                categories.what_is.push(query);
            } else if (queryText.includes('where') || queryText.includes('location') || queryText.includes('office')) {
                categories.where_can.push(query);
            } else if (queryText.includes('when') || queryText.includes('deadline') || queryText.includes('time')) {
                categories.when_does.push(query);
            } else if (queryText.includes('apply') || queryText.includes('application') || queryText.includes('eligibility')) {
                categories.application.push(query);
            } else if (queryText.includes('form') || queryText.includes('document') || queryText.includes('certificate')) {
                categories.form.push(query);
            } else if (queryText.includes('emergency') || queryText.includes('urgent') || queryText.includes('immediately')) {
                categories.emergency.push(query);
            } else {
                categories.other.push(query);
            }
            
            // Identify opportunities
            if (query.impressions > 100 && (query.ctr < 0.05 || query.position > 10)) {
                let priority = 'medium';
                let action = 'Optimize title and meta description';
                
                if (query.impressions > 1000 && query.ctr < 0.02) {
                    priority = 'high';
                    action = 'URGENT: Rewrite title tag - very low CTR for high volume';
                } else if (query.position > 20 && query.impressions > 500) {
                    priority = 'high';
                    action = 'Content optimization needed - good volume but poor ranking';
                }
                
                opportunities.push({
                    query: query.query,
                    impressions: query.impressions,
                    position: query.position,
                    ctr: query.ctr,
                    priority: priority,
                    action: action
                });
            }
        });
        
        return { categories, opportunities };
    }

    function analyzeTrendImpact(gscTrends, ga4Trends) {
        const metrics = {};
        const actions = [];
        
        // Analyze GSC trends
        if (gscTrends?.trends) {
            if (gscTrends.trends.clicks) {
                metrics.searchClicks = {
                    current: formatNumber(gscTrends.trends.clicks.current),
                    previous: formatNumber(gscTrends.trends.clicks.previous),
                    change: gscTrends.trends.clicks.percentChange,
                    direction: gscTrends.trends.clicks.direction,
                    insight: Math.abs(gscTrends.trends.clicks.percentChange) > 20 ? 
                        'Significant change in search traffic' : 'Moderate search traffic change'
                };
                
                if (gscTrends.trends.clicks.percentChange < -20) {
                    actions.push({
                        urgency: 'high',
                        title: 'Investigate Search Traffic Drop',
                        reason: `Search clicks dropped by ${Math.abs(gscTrends.trends.clicks.percentChange).toFixed(0)}%`
                    });
                }
            }
            
            if (gscTrends.trends.position) {
                metrics.searchPosition = {
                    current: `#${gscTrends.trends.position.current.toFixed(0)}`,
                    previous: `#${gscTrends.trends.position.previous.toFixed(0)}`,
                    change: gscTrends.trends.position.percentChange,
                    direction: gscTrends.trends.position.direction,
                    insight: gscTrends.trends.position.direction === 'up' ? 
                        'Rankings are improving' : 'Rankings may be declining'
                };
            }
        }
        
        // Analyze GA4 trends
        if (ga4Trends?.trends) {
            if (ga4Trends.trends.pageViews) {
                metrics.pageViews = {
                    current: formatNumber(ga4Trends.trends.pageViews.current),
                    previous: formatNumber(ga4Trends.trends.pageViews.previous),
                    change: ga4Trends.trends.pageViews.percentChange,
                    direction: ga4Trends.trends.pageViews.direction,
                    insight: Math.abs(ga4Trends.trends.pageViews.percentChange) > 15 ? 
                        'Significant change in page views' : 'Stable page view performance'
                };
            }
            
            if (ga4Trends.trends.bounceRate) {
                metrics.bounceRate = {
                    current: `${(ga4Trends.trends.bounceRate.current * 100).toFixed(1)}%`,
                    previous: `${(ga4Trends.trends.bounceRate.previous * 100).toFixed(1)}%`,
                    change: ga4Trends.trends.bounceRate.percentChange,
                    direction: ga4Trends.trends.bounceRate.direction === 'up' ? 'down' : 'up',
                    insight: ga4Trends.trends.bounceRate.direction === 'down' ? 
                        'User engagement is improving' : 'User engagement may be declining'
                };
            }
        }
        
        // Determine overall trend
        let overallDirection = 'stable';
        let overallLabel = 'Stable Performance';
        let overallIcon = '→';
        let overallDescription = 'Performance is relatively stable with no major changes.';
        
        const positiveMetrics = Object.values(metrics).filter(m => m.direction === 'up').length;
        const negativeMetrics = Object.values(metrics).filter(m => m.direction === 'down').length;
        
        if (positiveMetrics > negativeMetrics) {
            overallDirection = 'improving';
            overallLabel = 'Improving Performance';
            overallIcon = '📈';
            overallDescription = 'Multiple metrics show positive trends indicating improving performance.';
        } else if (negativeMetrics > positiveMetrics) {
            overallDirection = 'declining';
            overallLabel = 'Performance Concerns';
            overallIcon = '📉';
            overallDescription = 'Several metrics show declining trends that need attention.';
        }
        
        return {
            overall: {
                direction: overallDirection,
                label: overallLabel,
                icon: overallIcon,
                description: overallDescription
            },
            metrics: metrics,
            actions: actions
        };
    }

    // ===========================================
    // HELPER FUNCTIONS
    // ===========================================

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

    function getQuadrantClass(searchScore, engagementScore) {
        if (searchScore >= 60 && engagementScore >= 60) return 'high-high';
        if (searchScore >= 60 && engagementScore < 60) return 'high-low';
        if (searchScore < 60 && engagementScore >= 60) return 'low-high';
        return 'low-low';
    }

    function getQuadrantLabel(searchScore, engagementScore) {
        if (searchScore >= 60 && engagementScore >= 60) return '🌟 Star Performer';
        if (searchScore >= 60 && engagementScore < 60) return '🎯 Search Success';
        if (searchScore < 60 && engagementScore >= 60) return '💎 Hidden Gem';
        return '⚠️ Needs Attention';
    }

    function getQuadrantRecommendation(searchScore, engagementScore) {
        if (searchScore >= 60 && engagementScore >= 60) {
            return 'Excellent performance! Focus on maintaining quality and expanding reach.';
        }
        if (searchScore >= 60 && engagementScore < 60) {
            return 'Good search visibility but poor engagement. Improve content quality and user experience.';
        }
        if (searchScore < 60 && engagementScore >= 60) {
            return 'Great content that users love! Focus on SEO optimization to increase discoverability.';
        }
        return 'Needs improvement in both search visibility and user engagement. Start with content optimization.';
    }

    function generateMatrixInsights(searchScore, engagementScore, gscData, ga4Data) {
        const insights = [];
        
        if (searchScore < 50) {
            insights.push(`🔍 Search performance is below average. Consider optimizing for better keywords and improving meta descriptions.`);
        }
        
        if (engagementScore < 50 && ga4Data && !ga4Data.noDataFound) {
            insights.push(`👥 User engagement is low. Content may not be meeting user expectations or needs better structure.`);
        }
        
        if (gscData && gscData.position > 10 && gscData.impressions > 500) {
            insights.push(`📊 High search volume but poor ranking - significant SEO opportunity exists.`);
        }
        
        if (insights.length === 0) {
            insights.push(`✅ Performance is within acceptable ranges. Continue monitoring and gradual optimization.`);
        }
        
        return insights.map(insight => `<div class="insight-item">${insight}</div>`).join('');
    }

    function calculateCitizenSatisfaction(ga4Data) {
        if (!ga4Data || ga4Data.noDataFound) return 50;
        
        const engagementScore = (ga4Data.engagementRate || 0.5) * 100;
        const bounceScore = (1 - (ga4Data.bounceRate || 0.5)) * 100;
        const timeScore = Math.min(100, (ga4Data.avgSessionDuration / 180) * 100);
        
        return Math.round((engagementScore + bounceScore + timeScore) / 3);
    }

    function calculateTimeToInformation(ga4Data) {
        if (!ga4Data || ga4Data.noDataFound) return '2:30';
        
        const avgTime = ga4Data.avgSessionDuration || 150;
        const minutes = Math.floor(avgTime / 60);
        const seconds = Math.round(avgTime % 60);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // Include existing helper functions
    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.round(num).toLocaleString();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getCTRBenchmark(position) {
        if (position <= 1) return 0.28;
        if (position <= 2) return 0.15;
        if (position <= 3) return 0.11;
        if (position <= 4) return 0.08;
        if (position <= 5) return 0.06;
        if (position <= 10) return 0.03;
        return 0.01;
    }

    // ===========================================
    // STUB FUNCTIONS FOR MISSING SECTIONS
    // ===========================================

    function createSearchConsoleMetrics(gscData, gscTrends) {
        // Use your existing implementation
        return '';
    }

    function createGA4Metrics(ga4Data, ga4Trends) {
        // Use your existing implementation  
        return '';
    }

    function createCrossMetrics(gscData, ga4Data) {
        // Use your existing implementation
        return '';
    }

    function createContentGapAnalysis(gscData, ga4Data) {
        return '<div class="section"><h3>Content Gap Analysis</h3><p>Analysis coming soon...</p></div>';
    }

    function createUserExperienceAnalysis(ga4Data) {
        return '<div class="section"><h3>User Experience Analysis</h3><p>Analysis coming soon...</p></div>';
    }

    function createForecastingSection(gscTrends, ga4Trends) {
        return '<div class="section"><h3>Performance Forecasting</h3><p>Forecasting coming soon...</p></div>';
    }

    function createPriorityActionsSection(gscData, ga4Data, gscTrends, ga4Trends) {
        return '<div class="section"><h3>Priority Actions</h3><p>Action planning coming soon...</p></div>';
    }

    function createImplementationTimelineSection(gscData, ga4Data) {
        return '<div class="section"><h3>Implementation Timeline</h3><p>Timeline coming soon...</p></div>';
    }

    // ===========================================
    // ENHANCED STYLES
    // ===========================================

    function createEnhancedDashboardStyles() {
        return `
            <style>
                /* Enhanced Citizens Dashboard Styles */
                .citizen-impact-header {
                    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%);
                    color: white;
                    margin: 0 0 0 0;
                    border-radius: 20px 20px 0 0;
                    overflow: hidden;
                }
                
                .impact-hero {
                    padding: 35px;
                    text-align: center;
                }
                
                .impact-hero h1 {
                    font-size: 2.2rem;
                    font-weight: 800;
                    margin: 0 0 8px 0;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .page-url {
                    font-family: monospace;
                    font-size: 0.9rem;
                    opacity: 0.8;
                    margin: 0 0 20px 0;
                    word-break: break-all;
                }
                
                .hero-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                
                .hero-stat {
                    background: rgba(255,255,255,0.15);
                    padding: 20px;
                    border-radius: 16px;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.25);
                }
                
                .hero-number {
                    display: block;
                    font-size: 2rem;
                    font-weight: 800;
                    margin-bottom: 8px;
                }
                
                .hero-label {
                    display: block;
                    font-size: 0.9rem;
                    opacity: 0.9;
                }
                
                /* Dashboard Tabs */
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
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    color: #64748b;
                    border-bottom: 3px solid transparent;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                    min-width: 160px;
                }
                
                .tab-btn:hover {
                    color: #3b82f6;
                    background: rgba(59, 130, 246, 0.05);
                }
                
                .tab-btn.active {
                    color: #3b82f6;
                    border-bottom-color: #3b82f6;
                    background: white;
                }
                
                .tab-content {
                    min-height: 500px;
                }
                
                .tab-panel {
                    display: none;
                    padding: 20px;
                }
                
                .tab-panel.active {
                    display: block;
                }
                
                /* Sections */
                .section {
                    margin-bottom: 40px;
                    padding: 30px;
                    background: white;
                    border-radius: 16px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                
                .section-title {
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #1f2937;
                    margin: 0 0 20px 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                /* Performance Matrix */
                .matrix-container {
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: 30px;
                    align-items: start;
                }
                
                .matrix-quadrant {
                    padding: 30px;
                    border-radius: 16px;
                    text-align: center;
                    min-height: 200px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                
                .matrix-quadrant.high-high {
                    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
                    border: 2px solid #10b981;
                    color: #064e3b;
                }
                
                .matrix-quadrant.high-low {
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    border: 2px solid #f59e0b;
                    color: #92400e;
                }
                
                .matrix-quadrant.low-high {
                    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                    border: 2px solid #3b82f6;
                    color: #1e40af;
                }
                
                .matrix-quadrant.low-low {
                    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                    border: 2px solid #ef4444;
                    color: #991b1b;
                }
                
                .quadrant-label {
                    font-size: 1.2rem;
                    font-weight: 700;
                    margin-bottom: 16px;
                }
                
                .metric-pair {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 0.9rem;
                }
                
                .metric-value {
                    font-weight: 600;
                }
                
                .quadrant-recommendation {
                    margin-top: 16px;
                    font-size: 0.85rem;
                    line-height: 1.4;
                    opacity: 0.9;
                }
                
                /* Query Intelligence */
                .category-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .category-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                }
                
                .category-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }
                
                .category-name {
                    font-weight: 600;
                    color: #374151;
                    margin-left: 8px;
                }
                
                .category-count {
                    background: #3b82f6;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                
                .category-metrics {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin-bottom: 12px;
                }
                
                .category-metrics div {
                    margin-bottom: 4px;
                }
                
                .category-action {
                    font-size: 0.8rem;
                    color: #3b82f6;
                    background: rgba(59, 130, 246, 0.1);
                    padding: 8px;
                    border-radius: 6px;
                    line-height: 1.3;
                }
                
                /* Opportunities */
                .opportunities-list {
                    space-y: 12px;
                }
                
                .opportunity-item {
                    padding: 16px;
                    border-radius: 8px;
                    border-left: 4px solid #e5e7eb;
                    margin-bottom: 12px;
                }
                
                .opportunity-item.high {
                    background: #fef2f2;
                    border-left-color: #ef4444;
                }
                
                .opportunity-item.medium {
                    background: #fffbeb;
                    border-left-color: #f59e0b;
                }
                
                .opp-query {
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 6px;
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
                
                /* Quality Assessment */
                .quality-overview {
                    display: grid;
                    grid-template-columns: 250px 1fr;
                    gap: 30px;
                    margin-bottom: 30px;
                }
                
                .quality-score-card {
                    text-align: center;
                }
                
                .score-circle {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                    border: 4px solid;
                }
                
                .score-circle.a { 
                    background: #d1fae5; 
                    border-color: #10b981; 
                    color: #064e3b; 
                }
                
                .score-circle.b { 
                    background: #dbeafe; 
                    border-color: #3b82f6; 
                    color: #1e40af; 
                }
                
                .score-circle.c { 
                    background: #fef3c7; 
                    border-color: #f59e0b; 
                    color: #92400e; 
                }
                
                .score-circle.d { 
                    background: #fee2e2; 
                    border-color: #ef4444; 
                    color: #991b1b; 
                }
                
                .score-number {
                    font-size: 2rem;
                    font-weight: 800;
                }
                
                .score-label {
                    font-size: 0.8rem;
                    opacity: 0.8;
                }
                
                .quality-breakdown {
                    space-y: 20px;
                }
                
                .quality-metric {
                    padding: 16px;
                    background: #f8fafc;
                    border-radius: 8px;
                    margin-bottom: 16px;
                }
                
                .metric-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                
                .metric-name {
                    font-weight: 600;
                    color: #374151;
                    margin-left: 8px;
                }
                
                .metric-score {
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                
                .metric-score.excellent {
                    background: #d1fae5;
                    color: #065f46;
                }
                
                .metric-score.good {
                    background: #dbeafe;
                    color: #1e40af;
                }
                
                .metric-score.poor {
                    background: #fee2e2;
                    color: #991b1b;
                }
                
                .metric-insight {
                    font-size: 0.85rem;
                    color: #64748b;
                    line-height: 1.4;
                }
                
                /* Trend Analysis */
                .trend-indicator {
                    text-align: center;
                    padding: 30px;
                    background: #f8fafc;
                    border-radius: 16px;
                    margin-bottom: 30px;
                }
                
                .trend-indicator.improving {
                    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
                    border: 2px solid #10b981;
                }
                
                .trend-indicator.declining {
                    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                    border: 2px solid #ef4444;
                }
                
                .trend-icon {
                    font-size: 3rem;
                    margin-bottom: 16px;
                }
                
                .trend-label {
                    font-size: 1.3rem;
                    font-weight: 700;
                    margin-bottom: 8px;
                }
                
                .trend-metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }
                
                .trend-metric-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                }
                
                .trend-metric-card.up {
                    border-left: 4px solid #10b981;
                }
                
                .trend-metric-card.down {
                    border-left: 4px solid #ef4444;
                }
                
                .trend-metric-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }
                
                .trend-metric-name {
                    font-weight: 600;
                    color: #374151;
                }
                
                .trend-change {
                    padding: 4px 8px;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                
                .trend-change.up {
                    background: #d1fae5;
                    color: #065f46;
                }
                
                .trend-change.down {
                    background: #fee2e2;
                    color: #991b1b;
                }
                
                .trend-values {
                    margin-bottom: 8px;
                }
                
                .current-value {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #1f2937;
                }
                
                .previous-value {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin-left: 12px;
                }
                
                /* Actions */
                .actions-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }
                
                .action-card {
                    padding: 20px;
                    border-radius: 12px;
                    border-left: 4px solid #e5e7eb;
                }
                
                .action-card.high {
                    background: #fef2f2;
                    border-left-color: #ef4444;
                }
                
                .action-card.medium {
                    background: #fffbeb;
                    border-left-color: #f59e0b;
                }
                
                .action-title {
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 8px;
                }
                
                .action-description {
                    color: #64748b;
                    margin-bottom: 8px;
                    line-height: 1.4;
                }
                
                .action-impact {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #059669;
                }
                
                /* No Data States */
                .no-data-message {
                    text-align: center;
                    padding: 60px 20px;
                    color: #64748b;
                }
                
                .no-data-icon {
                    font-size: 3rem;
                    margin-bottom: 16px;
                    opacity: 0.6;
                }
                
                .no-data-text {
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                
                .no-data-subtitle {
                    font-size: 0.9rem;
                    opacity: 0.8;
                }
                
                .no-ga4-message {
                    text-align: center;
                    padding: 60px 20px;
                    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                    border-radius: 12px;
                    border: 2px dashed #0ea5e9;
                }
                
                .no-data-action {
                    margin-top: 12px;
                    padding: 8px 16px;
                    background: #0ea5e9;
                    color: white;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    display: inline-block;
                }
                
                /* Action Center */
                .action-center {
                    padding: 30px;
                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                    text-align: center;
                    border-radius: 0 0 20px 20px;
                }
                
                .action-buttons {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    flex-wrap: wrap;
                    margin-top: 20px;
                }
                
                .action-btn {
                    padding: 14px 28px;
                    border: none;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 0.95rem;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .action-btn.primary {
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    color: white;
                    box-shadow: 0 4px 14px rgba(59,130,246,0.3);
                }
                
                .action-btn.primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(59,130,246,0.4);
                }
                
                .action-btn.secondary {
                    background: white;
                    color: #64748b;
                    border: 2px solid #e2e8f0;
                }
                
                .action-btn.secondary:hover {
                    background: #f8fafc;
                    border-color: #3b82f6;
                    color: #3b82f6;
                    transform: translateY(-1px);
                }
                
                /* Responsive Design */
                @media (max-width: 768px) {
                    .impact-hero h1 {
                        font-size: 1.8rem;
                    }
                    
                    .hero-stats {
                        grid-template-columns: 1fr;
                    }
                    
                    .tab-nav {
                        overflow-x: scroll;
                    }
                    
                    .tab-btn {
                        min-width: 140px;
                    }
                    
                    .matrix-container {
                        grid-template-columns: 1fr;
                    }
                    
                    .quality-overview {
                        grid-template-columns: 1fr;
                    }
                    
                    .category-grid,
                    .trend-metrics-grid,
                    .actions-grid {
                        grid-template-columns: 1fr;
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
    // DASHBOARD INTERACTIONS
    // ===========================================

    function initializeEnhancedDashboard() {
        // Tab functionality
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // Update buttons
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update panels
                tabPanels.forEach(panel => {
                    if (panel.dataset.panel === targetTab) {
                        panel.classList.add('active');
                    } else {
                        panel.classList.remove('active');
                    }
                });
            });
        });
    }

    // ===========================================
    // EXPORT FUNCTIONS
    // ===========================================

    function exportEnhancedReport(url) {
        // Create comprehensive CSV export
        const timestamp = new Date().toISOString();
        let csv = `Enhanced Citizens Information Analytics Report\n`;
        csv += `Generated: ${timestamp}\n`;
        csv += `URL: ${url}\n\n`;
        
        // Add your export logic here
        console.log('Exporting enhanced report for:', url);
        alert('Enhanced export functionality - integrate with your data export logic');
    }

    function copyEnhancedSummary(url) {
        const summary = `
📊 ENHANCED CITIZENS INFORMATION ANALYSIS

🔗 Page: ${url}
📅 Generated: ${new Date().toLocaleDateString()}

🎯 KEY INSIGHTS:
- Performance matrix analysis complete
- Query intelligence extracted
- Traffic quality assessed
- Trend impact analyzed

📋 NEXT STEPS:
- Review content optimization opportunities
- Implement recommended improvements
- Monitor performance trends
- Schedule regular reviews

Generated by Enhanced Citizens Information Analytics Dashboard
        `.trim();
        
        navigator.clipboard.writeText(summary).then(() => {
            const message = document.createElement('div');
            message.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: #10b981; color: white; padding: 15px 25px; border-radius: 8px;
                font-weight: 600; z-index: 10001; animation: fadeIn 0.3s ease;
            `;
            message.textContent = '✅ Enhanced summary copied to clipboard!';
            document.body.appendChild(message);
            
            setTimeout(() => {
                message.style.opacity = '0';
                setTimeout(() => message.remove(), 300);
            }, 2000);
        }).catch(() => {
            alert('Failed to copy to clipboard. Please try again.');
        });
    }

    // ===========================================
    // EXPORT TO GLOBAL SCOPE
    // ===========================================

    // Export main function to global scope
    window.createEnhancedCitizensDashboard = createEnhancedCitizensDashboard;
    window.exportEnhancedReport = exportEnhancedReport;
    window.copyEnhancedSummary = copyEnhancedSummary;
    window.initializeEnhancedDashboard = initializeEnhancedDashboard;

    console.log('✅ Enhanced Citizens Dashboard module loaded!');

})();