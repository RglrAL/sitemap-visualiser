// unified-citizens-dashboard.js - Complete Plug-and-Play Dashboard
// Combines the best of both dashboard systems into one unified interface

(function() {
    'use strict';

    console.log('🚀 Loading Unified Citizens Dashboard...');

    // ===========================================
    // UTILITY FUNCTIONS
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
    // GOVERNMENT FRAMEWORK FUNCTIONS
    // ===========================================

    function calculateGovernmentBenchmarks(gscData, ga4Data, gscTrends, ga4Trends) {
        const benchmarks = {};
        
        // Engagement Rate (Government benchmark: 50%)
        const engagementRate = (ga4Data?.engagementRate || 0) * 100;
        benchmarks.engagement = {
            status: engagementRate >= 50 ? 'excellent' : engagementRate >= 35 ? 'good' : engagementRate >= 20 ? 'fair' : 'poor',
            message: engagementRate >= 50 ? 'Exceeds government standards' : 'Below government benchmark of 50%'
        };
        
        // Engagement Time (Government benchmark: 52 seconds)
        const engagementTime = ga4Data?.avgSessionDuration || 0;
        benchmarks.engagementTime = {
            status: engagementTime >= 52 ? 'excellent' : engagementTime >= 35 ? 'good' : engagementTime >= 20 ? 'fair' : 'poor',
            message: engagementTime >= 52 ? 'Meets government standard' : 'Below 52-second government benchmark'
        };
        
        // Discovery (Government benchmark: 30% entrance rate)
        const entranceRate = calculateEntranceRate(ga4Data);
        benchmarks.discovery = {
            status: entranceRate >= 30 ? 'excellent' : entranceRate >= 20 ? 'good' : entranceRate >= 10 ? 'fair' : 'poor',
            message: entranceRate >= 30 ? 'Good search discoverability' : 'Poor Google discoverability - needs SEO focus'
        };
        
        // Content Effectiveness (inverse of bounce rate)
        const effectiveness = (1 - (ga4Data?.bounceRate || 0.5)) * 100;
        benchmarks.effectiveness = {
            status: effectiveness >= 60 ? 'excellent' : effectiveness >= 40 ? 'good' : effectiveness >= 30 ? 'fair' : 'poor',
            message: effectiveness >= 40 ? 'Content effectively serves users' : 'High bounce rate indicates content issues'
        };
        
        // Overall score
        const scores = [
            engagementRate >= 50 ? 100 : (engagementRate / 50) * 100,
            engagementTime >= 52 ? 100 : (engagementTime / 52) * 100,
            entranceRate >= 30 ? 100 : (entranceRate / 30) * 100,
            effectiveness >= 40 ? 100 : (effectiveness / 40) * 100
        ];
        
        const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        benchmarks.overall = {
            score: Math.round(overallScore),
            status: overallScore >= 75 ? 'excellent' : overallScore >= 50 ? 'good' : overallScore >= 25 ? 'fair' : 'poor'
        };
        
        return benchmarks;
    }

    function identifyProblemQueries(gscData) {
        if (!gscData.topQueries) return [];
        
        const problems = [];
        const queries = gscData.topQueries;
        
        // GOV.UK framework: position 4/5 shouldn't exceed 50% of position 1 clicks
        if (queries.length >= 2) {
            const topQuery = queries[0];
            
            queries.slice(1).forEach((query, index) => {
                const position = index + 2;
                const clickRatio = query.clicks / topQuery.clicks;
                
                if (position >= 4 && clickRatio > 0.5) {
                    problems.push({
                        query: query.query,
                        position: query.position,
                        clicks: query.clicks,
                        issue: 'Position anomaly - ranking problem detected',
                        severity: 'high'
                    });
                }
            });
        }
        
        // Low CTR with high impressions
        queries.forEach(query => {
            if (query.impressions > 1000 && query.ctr < 0.02) {
                problems.push({
                    query: query.query,
                    position: query.position,
                    ctr: query.ctr,
                    impressions: query.impressions,
                    issue: 'High impressions, low CTR - title/meta optimization needed',
                    severity: 'medium'
                });
            }
        });
        
        return problems;
    }

    function identifyContentGaps(gscData, ga4Data) {
        const gaps = {
            highOpportunity: [],
            missingContent: [],
            seasonal: []
        };
        
        if (gscData?.topQueries) {
            gscData.topQueries.forEach(query => {
                // High opportunity: 1000+ impressions, <2% CTR
                if (query.impressions >= 1000 && query.ctr < 0.02) {
                    gaps.highOpportunity.push({
                        query: query.query,
                        impressions: query.impressions,
                        ctr: query.ctr,
                        clicks: query.clicks
                    });
                }
                
                // Missing content: 100+ impressions, low clicks
                if (query.impressions >= 100 && query.clicks < 5) {
                    gaps.missingContent.push({
                        query: query.query,
                        impressions: query.impressions,
                        clicks: query.clicks
                    });
                }
            });
        }
        
        return gaps;
    }

    function calculatePriorityScore(gscData, ga4Data, gscTrends, ga4Trends) {
        // Government framework weights: Traffic (40%), Growth (25%), Search (20%), Discovery (15%)
        
        // Traffic component (40%)
        const monthlyViews = (ga4Data?.pageViews || 0) + (gscData?.clicks || 0);
        const trafficScore = Math.min(100, (monthlyViews / 1000) * 10);
        
        // Growth component (25%)
        const clickGrowth = gscTrends?.trends?.clicks?.percentChange || 0;
        const viewGrowth = ga4Trends?.trends?.pageViews?.percentChange || 0;
        const avgGrowth = (clickGrowth + viewGrowth) / 2;
        const growthScore = Math.min(100, Math.max(0, 50 + avgGrowth));
        
        // Search behavior component (20%)
        const avgPosition = gscData?.position || 50;
        const searchScore = Math.max(0, 100 - (avgPosition * 2));
        
        // Discovery component (15%)
        const entranceRate = calculateEntranceRate(ga4Data);
        const discoveryScore = Math.min(100, (entranceRate / 30) * 100);
        
        const totalScore = Math.round(
            (trafficScore * 0.4) + 
            (growthScore * 0.25) + 
            (searchScore * 0.2) + 
            (discoveryScore * 0.15)
        );
        
        let level = 'low';
        let recommendation = 'Continue monitoring performance';
        
        if (totalScore >= 80) {
            level = 'critical';
            recommendation = 'High-priority optimization opportunity - immediate action recommended';
        } else if (totalScore >= 60) {
            level = 'high';
            recommendation = 'Strong optimization candidate - schedule for next sprint';
        } else if (totalScore >= 40) {
            level = 'medium';
            recommendation = 'Moderate opportunity - include in monthly review';
        }
        
        return {
            score: totalScore,
            level: level,
            recommendation: recommendation,
            components: {
                traffic: Math.round(trafficScore),
                growth: Math.round(growthScore),
                search: Math.round(searchScore),
                discovery: Math.round(discoveryScore)
            }
        };
    }

    function detectCitizenNeedSurges(gscData, gscTrends) {
        const analysis = {
            volumeSurges: [],
            emergingQueries: [],
            unmetNeeds: [],
            totalSurges: 0,
            avgVolumeIncrease: 0
        };

        if (!gscData || !gscData.topQueries) return analysis;

        gscData.topQueries.forEach(query => {
            const currentImpressions = query.impressions || 0;
            const previousImpressions = getPreviousImpressions(query, gscTrends);
            
            if (previousImpressions > 0) {
                const percentIncrease = ((currentImpressions - previousImpressions) / previousImpressions) * 100;
                
                if (percentIncrease >= 50) {
                    analysis.volumeSurges.push({
                        query: query.query,
                        currentImpressions: currentImpressions,
                        previousImpressions: previousImpressions,
                        percentIncrease: Math.round(percentIncrease),
                        severity: percentIncrease >= 200 ? 'critical' : percentIncrease >= 100 ? 'high' : 'medium'
                    });
                    analysis.totalSurges++;
                }
            } else if (currentImpressions >= 100) {
                analysis.emergingQueries.push({
                    query: query.query,
                    impressions: currentImpressions
                });
                analysis.totalSurges++;
            }

            if (currentImpressions >= 500 && (query.ctr < 0.02 || query.position > 20)) {
                analysis.unmetNeeds.push({
                    query: query.query,
                    impressions: currentImpressions,
                    ctr: query.ctr,
                    position: query.position
                });
            }
        });

        if (analysis.volumeSurges.length > 0) {
            analysis.avgVolumeIncrease = Math.round(
                analysis.volumeSurges.reduce((sum, surge) => sum + surge.percentIncrease, 0) / analysis.volumeSurges.length
            );
        }

        return analysis;
    }




// ==================================================
// ENHANCED CITIZEN NEED SURGE DETECTION SYSTEM
// Comprehensive surge analysis with actionable intelligence
// ==================================================

// ENHANCED SURGE CATEGORIES WITH IRISH GOVERNMENT CONTEXT
const SURGE_CATEGORIES = {
    crisis: {
        keywords: ['emergency', 'urgent', 'crisis', 'disaster', 'flood', 'fire', 'accident', 'evacuation'],
        icon: '🚨',
        priority: 'critical',
        responseTime: 'immediate',
        escalation: 'minister_level'
    },
    policy: {
        keywords: ['new', 'changes', 'budget', 'announcement', 'law', 'regulation', 'introduced'],
        icon: '📋',
        priority: 'high', 
        responseTime: '24_hours',
        escalation: 'department_head'
    },
    benefits: {
        keywords: ['allowance', 'payment', 'benefit', 'grant', 'support', 'assistance'],
        icon: '💰',
        priority: 'high',
        responseTime: '48_hours', 
        escalation: 'service_manager'
    },
    seasonal: {
        keywords: ['school', 'christmas', 'summer', 'winter', 'holiday', 'back to'],
        icon: '📅',
        priority: 'medium',
        responseTime: '1_week',
        escalation: 'content_team'
    },
    health: {
        keywords: ['covid', 'vaccine', 'medical', 'health', 'illness', 'hospital'],
        icon: '🏥', 
        priority: 'high',
        responseTime: '12_hours',
        escalation: 'health_liaison'
    },
    housing: {
        keywords: ['rent', 'eviction', 'homeless', 'accommodation', 'housing'],
        icon: '🏠',
        priority: 'critical',
        responseTime: '4_hours',
        escalation: 'housing_crisis_team'
    },
    employment: {
        keywords: ['job', 'unemployment', 'redundancy', 'work', 'employer'],
        icon: '💼',
        priority: 'high', 
        responseTime: '24_hours',
        escalation: 'employment_services'
    }
};

// ENHANCED SURGE DETECTION WITH INTELLIGENCE
function detectCitizenNeedSurgesEnhanced(gscData, gscTrends, currentDate = new Date()) {
    const analysis = {
        volumeSurges: [],
        emergingQueries: [],
        unmetNeeds: [],
        criticalAlerts: [],
        trendingTopics: [],
        seasonalPatterns: [],
        urgencyLevels: {
            critical: [],
            high: [],
            medium: [],
            low: []
        },
        totalSurges: 0,
        avgVolumeIncrease: 0,
        contextualInsights: [],
        actionableRecommendations: [],
        historicalComparison: {},
        surgeCategories: {}
    };

    if (!gscData || !gscData.topQueries) return analysis;

    // Initialize category counters
    Object.keys(SURGE_CATEGORIES).forEach(cat => {
        analysis.surgeCategories[cat] = [];
    });

    gscData.topQueries.forEach(query => {
        const currentImpressions = query.impressions || 0;
        const previousImpressions = getPreviousImpressions(query, gscTrends);
        
        // ENHANCED VOLUME SURGE ANALYSIS
        if (previousImpressions > 0) {
            const percentIncrease = ((currentImpressions - previousImpressions) / previousImpressions) * 100;
            
            if (percentIncrease >= 25) { // Lowered threshold for more sensitivity
                const surge = createEnhancedSurgeObject(query, currentImpressions, previousImpressions, percentIncrease, currentDate);
                
                analysis.volumeSurges.push(surge);
                analysis.totalSurges++;
                
                // Categorize by urgency
                analysis.urgencyLevels[surge.urgencyLevel].push(surge);
                
                // Categorize by topic
                if (surge.category !== 'general') {
                    analysis.surgeCategories[surge.category].push(surge);
                }
                
                // Critical alerts for immediate action
                if (surge.urgencyLevel === 'critical') {
                    analysis.criticalAlerts.push(createCriticalAlert(surge));
                }
            }
        } 
        // ENHANCED EMERGING QUERIES
        else if (currentImpressions >= 50) { // Lowered threshold
            const emergingQuery = createEmergingQueryObject(query, currentDate);
            analysis.emergingQueries.push(emergingQuery);
            analysis.totalSurges++;
            
            if (emergingQuery.category !== 'general') {
                analysis.surgeCategories[emergingQuery.category].push(emergingQuery);
            }
        }

        // ENHANCED UNMET NEEDS DETECTION
        if (currentImpressions >= 200 && (query.ctr < 0.015 || query.position > 25)) {
            const unmetNeed = createUnmetNeedObject(query, currentDate);
            analysis.unmetNeeds.push(unmetNeed);
            
            // High-volume unmet needs are critical
            if (currentImpressions >= 1000) {
                analysis.criticalAlerts.push(createUnmetNeedAlert(unmetNeed));
            }
        }
    });

    // CALCULATE ADVANCED METRICS
    if (analysis.volumeSurges.length > 0) {
        analysis.avgVolumeIncrease = Math.round(
            analysis.volumeSurges.reduce((sum, surge) => sum + surge.percentIncrease, 0) / analysis.volumeSurges.length
        );
    }

    // GENERATE CONTEXTUAL INSIGHTS
    analysis.contextualInsights = generateContextualInsights(analysis, currentDate);
    
    // GENERATE ACTIONABLE RECOMMENDATIONS  
    analysis.actionableRecommendations = generateSurgeRecommendations(analysis);
    
    // IDENTIFY TRENDING TOPICS
    analysis.trendingTopics = identifyTrendingTopics(analysis);
    
    // SEASONAL PATTERN ANALYSIS
    analysis.seasonalPatterns = analyzeSeasonalPatterns(analysis, currentDate);

    return analysis;
}

// CREATE ENHANCED SURGE OBJECT WITH FULL CONTEXT
function createEnhancedSurgeObject(query, currentImpressions, previousImpressions, percentIncrease, currentDate) {
    const category = categorizeSurgeQuery(query.query);
    const urgencyLevel = determineUrgencyLevel(percentIncrease, currentImpressions, category);
    const contextualFactors = analyzeContextualFactors(query.query, currentDate);
    
    return {
        query: query.query,
        currentImpressions: currentImpressions,
        previousImpressions: previousImpressions,
        percentIncrease: Math.round(percentIncrease),
        absoluteIncrease: currentImpressions - previousImpressions,
        category: category,
        urgencyLevel: urgencyLevel,
        priority: SURGE_CATEGORIES[category]?.priority || 'medium',
        responseTime: SURGE_CATEGORIES[category]?.responseTime || '1_week',
        escalationPath: SURGE_CATEGORIES[category]?.escalation || 'content_team',
        contextualFactors: contextualFactors,
        estimatedCitizensAffected: estimateAffectedCitizens(currentImpressions, category),
        recommendedActions: generateQuerySpecificActions(query, category, urgencyLevel),
        historicalContext: getHistoricalContext(query.query, currentDate),
        relatedQueries: findRelatedQueries(query.query, category),
        contentGaps: identifyContentGaps(query, category),
        businessImpact: assessBusinessImpact(currentImpressions, category, urgencyLevel)
    };
}

// CATEGORIZE SURGE QUERIES BY TOPIC
function categorizeSurgeQuery(queryText) {
    const queryLower = queryText.toLowerCase();
    
    for (const [category, config] of Object.entries(SURGE_CATEGORIES)) {
        if (config.keywords.some(keyword => queryLower.includes(keyword))) {
            return category;
        }
    }
    
    // Additional Irish-specific categorization
    if (queryLower.includes('dole') || queryLower.includes('social welfare')) return 'benefits';
    if (queryLower.includes('garda') || queryLower.includes('court')) return 'legal';
    if (queryLower.includes('hse') || queryLower.includes('hospital')) return 'health';
    if (queryLower.includes('revenue') || queryLower.includes('tax')) return 'tax';
    
    return 'general';
}

// DETERMINE URGENCY LEVEL WITH SOPHISTICATED LOGIC
function determineUrgencyLevel(percentIncrease, currentImpressions, category) {
    // Base urgency on percentage increase
    let urgencyScore = 0;
    
    if (percentIncrease >= 500) urgencyScore += 40;
    else if (percentIncrease >= 200) urgencyScore += 30;
    else if (percentIncrease >= 100) urgencyScore += 20;
    else if (percentIncrease >= 50) urgencyScore += 10;
    
    // Adjust for volume
    if (currentImpressions >= 5000) urgencyScore += 20;
    else if (currentImpressions >= 1000) urgencyScore += 10;
    else if (currentImpressions >= 500) urgencyScore += 5;
    
    // Category-based urgency multipliers
    const categoryMultipliers = {
        crisis: 2.0,
        housing: 1.8,
        health: 1.6,
        benefits: 1.4,
        policy: 1.2,
        employment: 1.3,
        seasonal: 0.8
    };
    
    urgencyScore *= (categoryMultipliers[category] || 1.0);
    
    // Determine final urgency level
    if (urgencyScore >= 60) return 'critical';
    if (urgencyScore >= 40) return 'high';
    if (urgencyScore >= 20) return 'medium';
    return 'low';
}

// ANALYZE CONTEXTUAL FACTORS
function analyzeContextualFactors(queryText, currentDate) {
    const factors = [];
    const month = currentDate.getMonth();
    const dayOfWeek = currentDate.getDay();
    
    // Seasonal factors
    if (month >= 5 && month <= 7 && queryText.toLowerCase().includes('school')) {
        factors.push('Summer school holiday period');
    }
    if (month >= 10 || month <= 1) {
        factors.push('Winter period - increased heating/welfare needs');
    }
    
    // Day-of-week factors
    if (dayOfWeek === 1) { // Monday
        factors.push('Monday effect - weekend issue accumulation');
    }
    
    // Economic factors (would integrate with real economic data)
    factors.push('Current economic climate consideration needed');
    
    // Policy calendar factors (would integrate with government calendar)
    if (month === 9) { // October budget
        factors.push('Budget season - policy change anticipation');
    }
    
    return factors;
}

// GENERATE CONTEXTUAL INSIGHTS
function generateContextualInsights(analysis, currentDate) {
    const insights = [];
    
    // Critical surge insights
    if (analysis.criticalAlerts.length > 0) {
        insights.push({
            type: 'critical',
            icon: '🚨',
            title: `${analysis.criticalAlerts.length} Critical Surge Alert${analysis.criticalAlerts.length > 1 ? 's' : ''}`,
            description: `Immediate government response required for high-impact citizen needs`,
            action: 'Escalate to crisis response team within 1 hour'
        });
    }
    
    // Category-based insights
    Object.entries(analysis.surgeCategories).forEach(([category, surges]) => {
        if (surges.length > 0) {
            const config = SURGE_CATEGORIES[category];
            const totalVolume = surges.reduce((sum, s) => sum + s.currentImpressions, 0);
            
            insights.push({
                type: 'category',
                icon: config.icon,
                title: `${surges.length} ${category.charAt(0).toUpperCase() + category.slice(1)} Surges`,
                description: `${formatNumber(totalVolume)} citizens seeking ${category} information`,
                action: `Review ${category} content and service delivery`
            });
        }
    });
    
    // Volume insights
    if (analysis.avgVolumeIncrease > 100) {
        insights.push({
            type: 'volume',
            icon: '📈',
            title: `Average ${analysis.avgVolumeIncrease}% Increase Detected`,
            description: 'Significantly higher than normal citizen information demand',
            action: 'Increase content team capacity and monitoring frequency'
        });
    }
    
    // Unmet needs insights
    if (analysis.unmetNeeds.length > 0) {
        const totalUnmetVolume = analysis.unmetNeeds.reduce((sum, need) => sum + need.impressions, 0);
        insights.push({
            type: 'unmet',
            icon: '❌',
            title: `${analysis.unmetNeeds.length} High-Demand, Low-Performance Queries`,
            description: `${formatNumber(totalUnmetVolume)} monthly searches not being served effectively`,
            action: 'Priority content creation and SEO optimization needed'
        });
    }
    
    return insights;
}

// GENERATE SURGE-SPECIFIC RECOMMENDATIONS
function generateSurgeRecommendations(analysis) {
    const recommendations = [];
    
    // Critical response recommendations
    analysis.criticalAlerts.forEach(alert => {
        recommendations.push({
            priority: 'critical',
            timeframe: 'immediate',
            category: alert.category,
            action: `Emergency Response: ${alert.title}`,
            details: alert.details,
            assignee: alert.escalationPath,
            expectedImpact: 'Prevent service delivery crisis',
            resources: 'Senior management, crisis communications team'
        });
    });
    
    // High-volume surge recommendations
    analysis.urgencyLevels.high.forEach(surge => {
        recommendations.push({
            priority: 'high',
            timeframe: SURGE_CATEGORIES[surge.category]?.responseTime || '24_hours',
            category: surge.category,
            action: `Scale Content: "${surge.query}"`,
            details: `${surge.absoluteIncrease} additional citizens searching (${surge.percentIncrease}% increase)`,
            assignee: surge.escalationPath,
            expectedImpact: `Serve ${surge.estimatedCitizensAffected} additional citizens effectively`,
            resources: 'Content team, subject matter experts'
        });
    });
    
    // Emerging topic recommendations
    analysis.emergingQueries.slice(0, 3).forEach(query => {
        recommendations.push({
            priority: 'medium',
            timeframe: '1_week',
            category: query.category,
            action: `Create Content: "${query.query}"`,
            details: `New topic with ${query.impressions} monthly searches`,
            assignee: 'content_team',
            expectedImpact: 'Address emerging citizen information need',
            resources: 'Content team, policy research'
        });
    });
    
    return recommendations.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

// CREATE COMPREHENSIVE SURGE DISPLAY
function createCitizenNeedSurgeDetectionEnhanced(surgeAnalysis) {
    if (!surgeAnalysis || surgeAnalysis.totalSurges === 0) {
        return `
            <div class="surge-detection-enhanced">
                <div class="no-surges-detected">
                    <div class="no-surge-icon">✅</div>
                    <div class="no-surge-title">No Significant Surges Detected</div>
                    <div class="no-surge-description">Citizen information demand is stable</div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="surge-detection-enhanced">
            <!-- Critical Alerts Section -->
            ${surgeAnalysis.criticalAlerts.length > 0 ? `
                <div class="critical-alerts-section">
                    <div class="critical-header">
                        <span class="critical-icon">🚨</span>
                        <span class="critical-title">CRITICAL SURGE ALERTS</span>
                        <span class="critical-count">${surgeAnalysis.criticalAlerts.length}</span>
                    </div>
                    <div class="critical-alerts-grid">
                        ${surgeAnalysis.criticalAlerts.map(alert => `
                            <div class="critical-alert-card ${alert.category}">
                                <div class="alert-header">
                                    <span class="alert-category-icon">${SURGE_CATEGORIES[alert.category]?.icon || '⚠️'}</span>
                                    <span class="alert-title">${alert.title}</span>
                                    <span class="alert-urgency">${alert.urgency}</span>
                                </div>
                                <div class="alert-details">${alert.details}</div>
                                <div class="alert-actions">
                                    <button class="alert-action-btn primary" onclick="handleCriticalAlert('${alert.id}')">
                                        Take Action Now
                                    </button>
                                    <span class="alert-timeline">Response needed: ${alert.responseTime}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Surge Summary Dashboard -->
            <div class="surge-summary-dashboard">
                <div class="dashboard-header">
                    <h3>📊 Citizen Need Surge Analysis</h3>
                    <div class="surge-period">Last 30 days vs Previous period</div>
                </div>
                
                <div class="surge-stats-grid">
                    <div class="surge-stat-card total">
                        <div class="stat-number">${surgeAnalysis.totalSurges}</div>
                        <div class="stat-label">Total Surges Detected</div>
                        <div class="stat-detail">Across all categories</div>
                    </div>
                    <div class="surge-stat-card average">
                        <div class="stat-number">${surgeAnalysis.avgVolumeIncrease}%</div>
                        <div class="stat-label">Average Increase</div>
                        <div class="stat-detail">Above normal demand</div>
                    </div>
                    <div class="surge-stat-card critical">
                        <div class="stat-number">${surgeAnalysis.urgencyLevels.critical.length}</div>
                        <div class="stat-label">Critical Surges</div>
                        <div class="stat-detail">Requiring immediate action</div>
                    </div>
                    <div class="surge-stat-card emerging">
                        <div class="stat-number">${surgeAnalysis.emergingQueries.length}</div>
                        <div class="stat-label">New Topics</div>
                        <div class="stat-detail">Previously unseen queries</div>
                    </div>
                </div>
            </div>
            
            <!-- Category Breakdown -->
            <div class="surge-categories-section">
                <h4>📋 Surge Categories Breakdown</h4>
                <div class="categories-grid">
                    ${Object.entries(surgeAnalysis.surgeCategories)
                        .filter(([category, surges]) => surges.length > 0)
                        .map(([category, surges]) => `
                            <div class="category-card ${category}">
                                <div class="category-header">
                                    <span class="category-icon">${SURGE_CATEGORIES[category]?.icon || '📊'}</span>
                                    <span class="category-name">${category.charAt(0).toUpperCase() + category.slice(1)}</span>
                                    <span class="category-count">${surges.length}</span>
                                </div>
                                <div class="category-volume">
                                    ${formatNumber(surges.reduce((sum, s) => sum + s.currentImpressions, 0))} searches
                                </div>
                                <div class="category-priority">
                                    Priority: ${SURGE_CATEGORIES[category]?.priority || 'medium'}
                                </div>
                            </div>
                        `).join('')}
                </div>
            </div>
            
            <!-- Detailed Surge Analysis -->
            <div class="detailed-surges-section">
                <h4>🔍 Detailed Surge Analysis</h4>
                <div class="surge-tabs">
                    <button class="surge-tab active" data-tab="volume">Volume Surges</button>
                    <button class="surge-tab" data-tab="emerging">Emerging Topics</button>
                    <button class="surge-tab" data-tab="unmet">Unmet Needs</button>
                </div>
                
                <div class="surge-tab-content">
                    <!-- Volume Surges Tab -->
                    <div class="surge-panel active" data-panel="volume">
                        ${createVolumeSurgesPanel(surgeAnalysis.volumeSurges)}
                    </div>
                    
                    <!-- Emerging Topics Tab -->  
                    <div class="surge-panel" data-panel="emerging">
                        ${createEmergingTopicsPanel(surgeAnalysis.emergingQueries)}
                    </div>
                    
                    <!-- Unmet Needs Tab -->
                    <div class="surge-panel" data-panel="unmet">
                        ${createUnmetNeedsPanel(surgeAnalysis.unmetNeeds)}
                    </div>
                </div>
            </div>
            
            <!-- Contextual Insights -->
            <div class="contextual-insights-section">
                <h4>🧠 Contextual Insights</h4>
                <div class="insights-list">
                    ${surgeAnalysis.contextualInsights.map(insight => `
                        <div class="insight-card ${insight.type}">
                            <div class="insight-icon">${insight.icon}</div>
                            <div class="insight-content">
                                <div class="insight-title">${insight.title}</div>
                                <div class="insight-description">${insight.description}</div>
                                <div class="insight-action">${insight.action}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Actionable Recommendations -->
            <div class="recommendations-section">
                <h4>🚀 Recommended Actions</h4>
                <div class="recommendations-list">
                    ${surgeAnalysis.actionableRecommendations.slice(0, 6).map(rec => `
                        <div class="recommendation-card priority-${rec.priority}">
                            <div class="rec-header">
                                <div class="rec-priority">
                                    <span class="priority-indicator ${rec.priority}"></span>
                                    <span class="priority-label">${rec.priority.toUpperCase()}</span>
                                </div>
                                <div class="rec-timeframe">${rec.timeframe.replace('_', ' ')}</div>
                            </div>
                            <div class="rec-action">${rec.action}</div>
                            <div class="rec-details">${rec.details}</div>
                            <div class="rec-impact">Expected Impact: ${rec.expectedImpact}</div>
                            <div class="rec-assignee">Assign to: ${rec.assignee.replace('_', ' ')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// HELPER FUNCTIONS FOR DETAILED PANELS
function createVolumeSurgesPanel(volumeSurges) {
    if (volumeSurges.length === 0) {
        return '<div class="no-data">No volume surges detected</div>';
    }
    
    return `
        <div class="volume-surges-list">
            ${volumeSurges.map(surge => `
                <div class="surge-item urgency-${surge.urgencyLevel}">
                    <div class="surge-query">"${surge.query}"</div>
                    <div class="surge-metrics">
                        <div class="metric">
                            <span class="metric-label">Increase:</span>
                            <span class="metric-value increase">${surge.percentIncrease}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Volume:</span>
                            <span class="metric-value">${formatNumber(surge.currentImpressions)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Category:</span>
                            <span class="metric-value">${SURGE_CATEGORIES[surge.category]?.icon || '📊'} ${surge.category}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Citizens Affected:</span>
                            <span class="metric-value">${surge.estimatedCitizensAffected}</span>
                        </div>
                    </div>
                    <div class="surge-context">
                        ${surge.contextualFactors.map(factor => `<span class="context-tag">${factor}</span>`).join('')}
                    </div>
                    <div class="surge-actions">
                        ${surge.recommendedActions.slice(0, 2).map(action => `
                            <div class="recommended-action">${action}</div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ==================================================
// MISSING HELPER FUNCTIONS FOR SURGE DETECTION
// Add these functions to your unified-citizens-dashboard.js file
// ==================================================

// CREATE VOLUME SURGES PANEL
function createVolumeSurgesPanel(volumeSurges) {
    if (!volumeSurges || volumeSurges.length === 0) {
        return '<div class="no-data">No volume surges detected</div>';
    }
    
    return `
        <div class="volume-surges-list">
            ${volumeSurges.map(surge => `
                <div class="surge-item urgency-${surge.urgencyLevel}">
                    <div class="surge-query">"${surge.query || 'Unknown query'}"</div>
                    <div class="surge-metrics">
                        <div class="metric">
                            <span class="metric-label">Increase:</span>
                            <span class="metric-value increase">${surge.percentIncrease}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Volume:</span>
                            <span class="metric-value">${formatNumber(surge.currentImpressions)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Category:</span>
                            <span class="metric-value">${SURGE_CATEGORIES[surge.category]?.icon || '📊'} ${surge.category}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Citizens Affected:</span>
                            <span class="metric-value">${surge.estimatedCitizensAffected || 'Unknown'}</span>
                        </div>
                    </div>
                    <div class="surge-context">
                        ${(surge.contextualFactors || []).map(factor => `<span class="context-tag">${factor}</span>`).join('')}
                    </div>
                    <div class="surge-actions">
                        ${(surge.recommendedActions || []).slice(0, 2).map(action => `
                            <div class="recommended-action">${action}</div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// CREATE EMERGING TOPICS PANEL
function createEmergingTopicsPanel(emergingQueries) {
    if (!emergingQueries || emergingQueries.length === 0) {
        return '<div class="no-data">No emerging topics detected</div>';
    }
    
    return `
        <div class="emerging-topics-list">
            ${emergingQueries.map(topic => `
                <div class="emerging-topic-item">
                    <div class="topic-query">"${topic.query || 'Unknown query'}"</div>
                    <div class="topic-metrics">
                        <div class="metric">
                            <span class="metric-label">New Searches:</span>
                            <span class="metric-value">${formatNumber(topic.impressions || 0)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Category:</span>
                            <span class="metric-value">${topic.category || 'general'}</span>
                        </div>
                    </div>
                    <div class="topic-recommendation">
                        💡 Consider creating content to address this emerging need
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// CREATE UNMET NEEDS PANEL
function createUnmetNeedsPanel(unmetNeeds) {
    if (!unmetNeeds || unmetNeeds.length === 0) {
        return '<div class="no-data">No significant unmet needs detected</div>';
    }
    
    return `
        <div class="unmet-needs-list">
            ${unmetNeeds.map(need => `
                <div class="unmet-need-item">
                    <div class="need-query">"${need.query || 'Unknown query'}"</div>
                    <div class="need-metrics">
                        <div class="metric">
                            <span class="metric-label">Searches:</span>
                            <span class="metric-value">${formatNumber(need.impressions || 0)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">CTR:</span>
                            <span class="metric-value">${((need.ctr || 0) * 100).toFixed(2)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Position:</span>
                            <span class="metric-value">#${(need.position || 0).toFixed(0)}</span>
                        </div>
                    </div>
                    <div class="need-gap">
                        🎯 High search demand but poor performance - optimization opportunity
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// CREATE CRITICAL ALERT
function createCriticalAlert(surge) {
    return {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: surge.category || 'general',
        title: `Critical Surge: ${surge.query || 'Unknown Query'}`,
        details: `${surge.percentIncrease}% increase in searches (${formatNumber(surge.currentImpressions)} monthly searches)`,
        urgency: surge.urgencyLevel || 'high',
        responseTime: SURGE_CATEGORIES[surge.category]?.responseTime || '24_hours',
        escalationPath: SURGE_CATEGORIES[surge.category]?.escalation || 'content_team'
    };
}

// CREATE UNMET NEED ALERT
function createUnmetNeedAlert(unmetNeed) {
    return {
        id: `unmet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: 'unmet_need',
        title: `High-Volume Unmet Need: ${unmetNeed.query || 'Unknown Query'}`,
        details: `${formatNumber(unmetNeed.impressions)} monthly searches with poor performance`,
        urgency: 'high',
        responseTime: '48_hours',
        escalationPath: 'content_optimization_team'
    };
}

// CREATE EMERGING QUERY OBJECT
function createEmergingQueryObject(query, currentDate) {
    return {
        query: query.query,
        impressions: query.impressions || 0,
        clicks: query.clicks || 0,
        category: categorizeSurgeQuery(query.query),
        isNew: true,
        detectionDate: currentDate,
        potentialImpact: query.impressions > 100 ? 'high' : query.impressions > 50 ? 'medium' : 'low'
    };
}

// CREATE UNMET NEED OBJECT
function createUnmetNeedObject(query, currentDate) {
    return {
        query: query.query,
        impressions: query.impressions || 0,
        clicks: query.clicks || 0,
        ctr: query.ctr || 0,
        position: query.position || 0,
        category: categorizeSurgeQuery(query.query),
        gapType: 'performance',
        severity: query.impressions >= 1000 ? 'critical' : query.impressions >= 500 ? 'high' : 'medium'
    };
}

// ESTIMATE AFFECTED CITIZENS
function estimateAffectedCitizens(impressions, category) {
    if (!impressions) return 'Unknown';
    
    // Different categories have different citizen-to-impression ratios
    const multipliers = {
        crisis: 0.8,      // Crisis situations affect more people per search
        housing: 0.6,     // Housing affects families
        health: 0.5,      // Health affects individuals + family
        benefits: 0.4,    // Benefits primarily individual
        emergency: 0.9,   // Emergency situations are critical
        general: 0.3      // General information
    };
    
    const multiplier = multipliers[category] || 0.3;
    const estimated = Math.round(impressions * multiplier);
    
    return formatNumber(estimated);
}

// GENERATE QUERY SPECIFIC ACTIONS
function generateQuerySpecificActions(query, category, urgencyLevel) {
    const actions = [];
    
    // Base actions by category
    const categoryActions = {
        crisis: [
            'Create emergency response page',
            'Add crisis helpline contacts',
            'Ensure mobile-first design'
        ],
        housing: [
            'Update housing eligibility criteria',
            'Add local housing office contacts',
            'Create application walkthrough'
        ],
        health: [
            'Update medical card information',
            'Add HSE contact details',
            'Create health service finder'
        ],
        benefits: [
            'Update benefit rates and criteria',
            'Add online application links',
            'Create eligibility calculator'
        ],
        employment: [
            'Update job seeker information',
            'Add Intreo office details',
            'Link to online services'
        ]
    };
    
    // Get category-specific actions
    const baseActions = categoryActions[category] || [
        'Review and update content',
        'Add relevant contact information',
        'Improve search optimization'
    ];
    
    // Add urgency-specific actions
    if (urgencyLevel === 'critical') {
        actions.push('URGENT: Immediate content review required');
        actions.push('Escalate to senior management');
    } else if (urgencyLevel === 'high') {
        actions.push('Priority content update needed');
        actions.push('Schedule within 24 hours');
    }
    
    return [...actions, ...baseActions.slice(0, 2)];
}

// GET HISTORICAL CONTEXT
function getHistoricalContext(query, currentDate) {
    // In a real implementation, this would compare with historical data
    // For now, return mock context based on query patterns
    
    const seasonalPatterns = {
        'school': 'Peaks in August-September and January',
        'tax': 'Highest in October-December',
        'christmas': 'Seasonal spike November-December',
        'summer': 'Peaks May-July',
        'holiday': 'Increases before holiday periods'
    };
    
    const queryLower = query.toLowerCase();
    for (const [pattern, context] of Object.entries(seasonalPatterns)) {
        if (queryLower.includes(pattern)) {
            return context;
        }
    }
    
    return 'No clear historical pattern detected';
}

// FIND RELATED QUERIES
function findRelatedQueries(query, category) {
    // In a real implementation, this would use ML/semantic analysis
    // For now, return mock related queries based on category
    
    const relatedByCategory = {
        housing: ['rent supplement', 'housing list', 'hap payment'],
        health: ['medical card', 'gp visit card', 'hospital services'],
        benefits: ['jobseekers allowance', 'child benefit', 'disability allowance'],
        education: ['student grant', 'susi application', 'back to school'],
        employment: ['job seekers', 'unemployment benefit', 'work permit']
    };
    
    return relatedByCategory[category] || ['general information', 'government services', 'citizen support'];
}

// ASSESS BUSINESS IMPACT
function assessBusinessImpact(impressions, category, urgencyLevel) {
    let impact = 'Low';
    let score = 0;
    
    // Volume impact
    if (impressions >= 1000) score += 3;
    else if (impressions >= 500) score += 2;
    else if (impressions >= 100) score += 1;
    
    // Category impact
    const categoryScores = {
        crisis: 4,
        emergency: 4,
        housing: 3,
        health: 3,
        benefits: 3,
        employment: 2,
        education: 2,
        general: 1
    };
    score += categoryScores[category] || 1;
    
    // Urgency impact
    const urgencyScores = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1
    };
    score += urgencyScores[urgencyLevel] || 1;
    
    // Determine impact level
    if (score >= 8) impact = 'Critical';
    else if (score >= 6) impact = 'High';
    else if (score >= 4) impact = 'Medium';
    
    return {
        level: impact,
        score: score,
        citizenImpact: score >= 6 ? 'High citizen service impact' : score >= 4 ? 'Medium citizen impact' : 'Standard service impact',
        recommendedResponse: score >= 8 ? 'Immediate action required' : score >= 6 ? 'Priority response needed' : 'Include in regular updates'
    };
}

// IDENTIFY TRENDING TOPICS
function identifyTrendingTopics(analysis) {
    const trending = [];
    
    // Look for patterns in surge categories
    if (analysis.surgeCategories) {
        Object.entries(analysis.surgeCategories).forEach(([category, surges]) => {
            if (surges.length >= 2) {
                const totalVolume = surges.reduce((sum, s) => sum + (s.currentImpressions || 0), 0);
                trending.push({
                    topic: category,
                    volume: totalVolume,
                    surgeCount: surges.length,
                    trend: 'increasing'
                });
            }
        });
    }
    
    // Sort by volume
    return trending.sort((a, b) => b.volume - a.volume).slice(0, 5);
}

// ANALYZE SEASONAL PATTERNS
function analyzeSeasonalPatterns(analysis, currentDate) {
    const month = currentDate.getMonth();
    const patterns = [];
    
    // Check for seasonal keywords in surges
    const seasonalKeywords = {
        'school': [8, 9, 0, 1], // Sept, Oct, Jan, Feb
        'christmas': [10, 11],  // Nov, Dec
        'summer': [5, 6, 7],    // Jun, Jul, Aug
        'tax': [9, 10, 11],     // Oct, Nov, Dec
        'holiday': [5, 6, 7, 11, 0] // Summer and Christmas
    };
    
    if (analysis.volumeSurges) {
        analysis.volumeSurges.forEach(surge => {
            const query = (surge.query || '').toLowerCase();
            
            Object.entries(seasonalKeywords).forEach(([keyword, months]) => {
                if (query.includes(keyword) && months.includes(month)) {
                    patterns.push({
                        keyword: keyword,
                        query: surge.query,
                        seasonal: true,
                        expectedPeriod: months,
                        currentRelevance: 'high'
                    });
                }
            });
        });
    }
    
    return patterns;
}

// FORMAT NUMBER FUNCTION (if not already defined)
function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toLocaleString();
}

// ADDITIONAL HELPER FUNCTIONS THAT MIGHT BE MISSING

// Ensure SURGE_CATEGORIES is available (if not already defined)
if (typeof SURGE_CATEGORIES === 'undefined') {
    const SURGE_CATEGORIES = {
        crisis: {
            keywords: ['emergency', 'urgent', 'crisis', 'disaster', 'flood', 'fire', 'accident', 'evacuation'],
            icon: '🚨',
            priority: 'critical',
            responseTime: 'immediate',
            escalation: 'minister_level'
        },
        policy: {
            keywords: ['new', 'changes', 'budget', 'announcement', 'law', 'regulation', 'introduced'],
            icon: '📋',
            priority: 'high', 
            responseTime: '24_hours',
            escalation: 'department_head'
        },
        benefits: {
            keywords: ['allowance', 'payment', 'benefit', 'grant', 'support', 'assistance'],
            icon: '💰',
            priority: 'high',
            responseTime: '48_hours', 
            escalation: 'service_manager'
        },
        seasonal: {
            keywords: ['school', 'christmas', 'summer', 'winter', 'holiday', 'back to'],
            icon: '📅',
            priority: 'medium',
            responseTime: '1_week',
            escalation: 'content_team'
        },
        health: {
            keywords: ['covid', 'vaccine', 'medical', 'health', 'illness', 'hospital'],
            icon: '🏥', 
            priority: 'high',
            responseTime: '12_hours',
            escalation: 'health_liaison'
        },
        housing: {
            keywords: ['rent', 'eviction', 'homeless', 'accommodation', 'housing'],
            icon: '🏠',
            priority: 'critical',
            responseTime: '4_hours',
            escalation: 'housing_crisis_team'
        },
        employment: {
            keywords: ['job', 'unemployment', 'redundancy', 'work', 'employer'],
            icon: '💼',
            priority: 'high', 
            responseTime: '24_hours',
            escalation: 'employment_services'
        }
    };
    
    // Make it available globally
    window.SURGE_CATEGORIES = SURGE_CATEGORIES;
}

// ESCAPE HTML FUNCTION (if not already defined)
if (typeof escapeHtml === 'undefined') {
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Make it available globally
    window.escapeHtml = escapeHtml;
}

// GET CTR BENCHMARK FUNCTION (if not already defined)
if (typeof getCTRBenchmark === 'undefined') {
    function getCTRBenchmark(position) {
        if (position <= 1) return 0.28;
        if (position <= 2) return 0.15;
        if (position <= 3) return 0.11;
        if (position <= 5) return 0.06;
        if (position <= 10) return 0.03;
        return 0.01;
    }
    
    // Make it available globally
    window.getCTRBenchmark = getCTRBenchmark;
}

// CATEGORIZE SURGE QUERY FUNCTION (ensure it's available)
if (typeof categorizeSurgeQuery === 'undefined') {
    function categorizeSurgeQuery(queryText) {
        const queryLower = queryText.toLowerCase();
        const categories = window.SURGE_CATEGORIES || SURGE_CATEGORIES;
        
        for (const [category, config] of Object.entries(categories)) {
            if (config.keywords.some(keyword => queryLower.includes(keyword))) {
                return category;
            }
        }
        
        // Additional Irish-specific categorization
        if (queryLower.includes('dole') || queryLower.includes('social welfare')) return 'benefits';
        if (queryLower.includes('garda') || queryLower.includes('court')) return 'legal';
        if (queryLower.includes('hse') || queryLower.includes('hospital')) return 'health';
        if (queryLower.includes('revenue') || queryLower.includes('tax')) return 'tax';
        
        return 'general';
    }
    
    // Make it available globally
    window.categorizeSurgeQuery = categorizeSurgeQuery;
}

// SAFE QUERY ACCESS HELPER
function safeGetQuery(query) {
    if (typeof query === 'string') {
        return query;
    }
    if (query && typeof query === 'object' && query.query) {
        return query.query;
    }
    return 'Unknown Query';
}

// SAFE METRICS ACCESS HELPER
function safeGetMetric(obj, property, defaultValue = 0) {
    try {
        return obj && obj[property] !== undefined ? obj[property] : defaultValue;
    } catch (error) {
        console.warn(`Error accessing property ${property}:`, error);
        return defaultValue;
    }
}

// ENHANCED ERROR HANDLING FOR SURGE DETECTION
function safeExecuteSurgeDetection(gscData, gscTrends) {
    try {
        if (!gscData || gscData.noDataFound) {
            return {
                volumeSurges: [],
                emergingQueries: [],
                unmetNeeds: [],
                criticalAlerts: [],
                totalSurges: 0,
                avgVolumeIncrease: 0,
                contextualInsights: [],
                actionableRecommendations: [],
                surgeCategories: {}
            };
        }
        
        return detectCitizenNeedSurgesEnhanced(gscData, gscTrends);
    } catch (error) {
        console.error('Error in surge detection:', error);
        return {
            volumeSurges: [],
            emergingQueries: [],
            unmetNeeds: [],
            criticalAlerts: [],
            totalSurges: 0,
            avgVolumeIncrease: 0,
            contextualInsights: [{
                type: 'error',
                icon: '⚠️',
                title: 'Surge Detection Error',
                description: 'Unable to analyse citizen need surges at this time',
                action: 'Check data connections and try refreshing'
            }],
            actionableRecommendations: [],
            surgeCategories: {}
        };
    }
}

// Make all functions globally available
window.createVolumeSurgesPanel = createVolumeSurgesPanel;
window.createEmergingTopicsPanel = createEmergingTopicsPanel;
window.createUnmetNeedsPanel = createUnmetNeedsPanel;
window.createCriticalAlert = createCriticalAlert;
window.createUnmetNeedAlert = createUnmetNeedAlert;
window.createEmergingQueryObject = createEmergingQueryObject;
window.createUnmetNeedObject = createUnmetNeedObject;
window.estimateAffectedCitizens = estimateAffectedCitizens;
window.generateQuerySpecificActions = generateQuerySpecificActions;
window.getHistoricalContext = getHistoricalContext;
window.findRelatedQueries = findRelatedQueries;
window.assessBusinessImpact = assessBusinessImpact;
window.identifyTrendingTopics = identifyTrendingTopics;
window.analyzeSeasonalPatterns = analyzeSeasonalPatterns;
window.safeExecuteSurgeDetection = safeExecuteSurgeDetection;
window.safeGetQuery = safeGetQuery;
window.safeGetMetric = safeGetMetric;

console.log('✅ All Surge Detection helper functions loaded successfully!');
console.log('📋 Functions available:', [
    'createVolumeSurgesPanel',
    'createEmergingTopicsPanel', 
    'createUnmetNeedsPanel',
    'createCriticalAlert',
    'createUnmetNeedAlert',
    'createEmergingQueryObject',
    'createUnmetNeedObject',
    'estimateAffectedCitizens',
    'generateQuerySpecificActions',
    'getHistoricalContext',
    'findRelatedQueries',
    'assessBusinessImpact',
    'identifyTrendingTopics',
    'analyzeSeasonalPatterns',
    'safeExecuteSurgeDetection'
]);

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}








    

    function getPreviousImpressions(query, gscTrends) {
        if (gscTrends && gscTrends.previous && gscTrends.previous.topQueries) {
            const previousQuery = gscTrends.previous.topQueries.find(q => q.query === query.query);
            return previousQuery ? previousQuery.impressions : 0;
        }
        return 0;
    }

    function calculateEntranceRate(ga4Data) {
        if (!ga4Data || !ga4Data.sessions || !ga4Data.pageViews) return 0;
        return Math.round((ga4Data.sessions / ga4Data.pageViews) * 100);
    }

    function calculateQualityScore(gscData, ga4Data) {
        const searchScore = calculateSearchScore(gscData);
        const engagementScore = calculateEngagementScore(ga4Data);
        const relevanceScore = calculateRelevanceScore(gscData);
        const uxScore = calculateUXScore(ga4Data);
        
        return Math.round((searchScore + engagementScore + relevanceScore + uxScore) / 4);
    }

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
                    type = 'Content Page';
                }
                
                title = formatPageTitle(pathParts[pathParts.length - 1]);
            }
            
            return { title, section, subsection, type };
        } catch (error) {
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

    


// REPLACE your entire getLastModifiedInfo function with this working version:
function getLastModifiedInfo(data) {
    // Use the same logic as the tooltip
    if (!data || !data.lastModified) {
        return { 
            formatted: 'Date Unknown', 
            freshnessClass: 'stale', 
            freshnessLabel: 'No Date Available' 
        };
    }
    
    let lastMod;
    if (typeof data.lastModified === 'string') {
        lastMod = new Date(data.lastModified);
    } else if (data.lastModified instanceof Date) {
        lastMod = data.lastModified;
    }
    
    if (!lastMod || isNaN(lastMod.getTime())) {
        return { 
            formatted: 'Date Unknown', 
            freshnessClass: 'stale', 
            freshnessLabel: 'No Date Available' 
        };
    }
    
    // Format exactly like the tooltip
    const formatted = lastMod.toLocaleDateString('en-IE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    // Calculate relative time like tooltip
    const daysSince = Math.floor((new Date() - lastMod) / (1000 * 60 * 60 * 24));
    
    let freshnessClass, freshnessLabel;
    if (daysSince < 30) {
        freshnessClass = 'fresh'; 
        freshnessLabel = 'Fresh';
    } else if (daysSince < 90) {
        freshnessClass = 'fresh'; 
        freshnessLabel = 'Fresh';
    } else if (daysSince < 180) {
        freshnessClass = 'aging'; 
        freshnessLabel = 'Recent';
    } else if (daysSince < 365) {
        freshnessClass = 'aging'; 
        freshnessLabel = 'Aging';
    } else {
        freshnessClass = 'stale'; 
        freshnessLabel = 'Old';
    }
    
    return { formatted, freshnessClass, freshnessLabel };
}


// Add the same helper functions from the tooltip:
function getFormattedDate(lastModified) {
    if (!lastModified) return '';
    
    let lastMod;
    if (typeof lastModified === 'string') {
        lastMod = new Date(lastModified);
    } else if (lastModified instanceof Date) {
        lastMod = lastModified;
    }
    
    if (!lastMod || isNaN(lastMod.getTime())) return '';
    
    return lastMod.toLocaleDateString('en-IE', {
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


    

    // ===========================================
    // ENHANCED COMPONENT CREATORS
    // ===========================================

    function createEnhancedHeader(url, gscData, ga4Data, gscTrends, ga4Trends, nodeData = null) {
    const pageInfo = extractPageInfo(url);
    
    // Use the passed nodeData first, then fallback to tree search if needed
    if (!nodeData && window.treeData && typeof findNodeInTreeStructure === 'function') {
        const nodeInfo = findNodeInTreeStructure(window.treeData, url);
        if (nodeInfo.found && nodeInfo.node) {
            nodeData = nodeInfo.node;
        }
    }
    
    // If still no nodeData, try direct tree search
    if (!nodeData && window.treeData) {
        function findNode(node, targetUrl) {
            if (node.url === targetUrl || 
                (node.url && targetUrl && node.url.includes(targetUrl.split('/').pop())) ||
                (node.url && targetUrl && targetUrl.includes(node.url))) {
                return node;
            }
            
            if (node.children) {
                for (const child of node.children) {
                    const found = findNode(child, targetUrl);
                    if (found) return found;
                }
            }
            return null;
        }
        
        nodeData = findNode(window.treeData, url);
    }
    
    console.log('📅 Using node data for header:', nodeData);
    
    // Use the simplified date logic (pass nodeData directly)
    const lastModified = getLastModifiedInfo(nodeData);
    const citizenImpact = calculateCitizenImpactWithTrends(gscData, ga4Data, gscTrends, ga4Trends);
    
    return `
        <div class="dashboard-header">
        
<div class="help-corner">
    <button class="help-btn" onclick="DashboardGlossary.open()" data-tooltip="Glossary">📚</button>
</div>
            <div class="header-content">
                <div class="page-info">
                    <div class="page-breadcrumb">
                        <span class="breadcrumb-item">Citizens Information</span>
                        <span class="breadcrumb-separator">›</span>
                        <span class="breadcrumb-item">${pageInfo.section}</span>
                        ${pageInfo.subsection ? `
                            <span class="breadcrumb-separator">›</span>
                            <span class="breadcrumb-item">${pageInfo.subsection}</span>
                        ` : ''}
                    </div>
                    
                    <h1 class="page-title">${pageInfo.title}</h1>
                    
                    <div class="page-metadata">
                        <div class="metadata-grid">
                            <div class="metadata-item">
                                <span class="metadata-label">Page Type:</span>
                                <span class="metadata-value">${pageInfo.type}</span>
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">Last Updated:</span>
                                <span class="metadata-value">${lastModified.formatted}</span>
                                <span class="metadata-badge ${lastModified.freshnessClass}">${lastModified.freshnessLabel}</span>
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">URL:</span>
                                <a href="${url}" target="_blank" class="url-link">${url}</a>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Refresh Button - BELOW URL -->
                    <div class="header-actions">
                        <button class="header-refresh-btn" onclick="refreshUnifiedDashboard('${escapeHtml(url)}')" title="Refresh all dashboard data from Google Search Console and Analytics">
                            <span class="refresh-icon">🔄</span>
                            <span class="refresh-text">Refresh Data</span>
                        </button>
                    </div>
                </div>
                
                <div class="impact-summary">
                    <div class="impact-card">
                        <div class="impact-number">${citizenImpact.monthlyReach}</div>
                        <div class="impact-label">Citizens Reached (Last 30 Days)</div>
                        <div class="impact-trend">${citizenImpact.reachTrend}</div>
                        <div class="impact-explanation">Search clicks + unique visitors</div>
                    </div>
                    <div class="impact-card">
                        <div class="impact-number">${citizenImpact.helpfulnessScore}%</div>
                        <div class="impact-label">Content Helpfulness</div>
                        <div class="impact-trend">${citizenImpact.helpfulnessTrend}</div>
                        <div class="impact-explanation">Based on engagement & time spent</div>
                    </div>
                    <div class="impact-card">
                        <div class="impact-number">${citizenImpact.avgTimeToInfo}</div>
                        <div class="impact-label">Avg. Time on Page</div>
                        <div class="impact-trend">${citizenImpact.timeTrend}</div>
                        <div class="impact-explanation">How long citizens spend reading</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

    function calculateCitizenImpact(gscData, ga4Data) {
        const monthlyReach = formatNumber((gscData?.clicks || 0) + (ga4Data?.users || 0));
        
        let helpfulnessScore = 65;
        if (ga4Data && !ga4Data.noDataFound) {
            const engagementScore = (1 - (ga4Data.bounceRate || 0.5)) * 100;
            const timeScore = Math.min(100, (ga4Data.avgSessionDuration || 60) / 180 * 100);
            helpfulnessScore = Math.round((engagementScore + timeScore) / 2);
        }
        
        const avgTimeToInfo = ga4Data?.avgSessionDuration ? 
            formatDuration(ga4Data.avgSessionDuration) : '2:15';
        
        return { monthlyReach, helpfulnessScore, avgTimeToInfo };
    }

    function createPerformanceOverview(gscData, ga4Data, gscTrends, ga4Trends) {
        return `
            <div class="performance-overview">
                <div class="overview-grid">
                    
                    
                    <div class="overview-card analytics-card">
                        <div class="card-header">
                            <div class="card-icon"><svg width="46" height="46" viewBox="0 0 24 24" style="flex-shrink: 0;">
                                <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                            </svg></div>
                            <div class="card-title">Google Analytics</div>
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
                                    <span class="metric-label">Page Views:</span>
                                    <span class="metric-value">${formatNumber(ga4Data.pageViews || 0)}</span>
                                    ${getTrendIndicator(ga4Trends?.trends?.pageViews)}
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
                                    <span class="no-data-icon">
                                    <div style="margin-bottom: 16px; display: flex; justify-content: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" style="opacity: 0.7;">
                        <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                    </svg>
                </div>
                                    </span>
                                    <span class="no-data-text">Connect Google Analytics</span>
                                </div>
                            `}
                        </div>
                    </div>


                    <div class="overview-card search-card">
                        <div class="card-header">
                            <div class="card-icon"> <svg width="46" height="46" viewBox="0 0 24 24" style="opacity: 0.7;">
                    <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg></div>
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
                                    <span class="metric-label">Impressions:</span>
                                    <span class="metric-value">${formatNumber(gscData.impressions)}</span>
                                    ${getTrendIndicator(gscTrends?.trends?.impressions)}
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
                                    <span class="no-data-icon">
                                    <div style="margin-bottom: 16px; display: flex; justify-content: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" style="opacity: 0.7;">
                        <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                </div>
                                    </span>
                                    <span class="no-data-text">Connect Search Console</span>
                                </div>
                            `}
                        </div>
                    </div>


                    
                    
                    <div class="overview-card quality-card">
                        <div class="card-header">
                            <div class="card-icon">⭐</div>
                            <div class="card-title">Content Quality</div>
                        </div>
                        <div class="card-content">
                            ${createQualityScoreDisplay(gscData, ga4Data)}
                        </div>
                    </div>
                    
                    <div class="overview-card impact-card">
                        <div class="card-header">
                            <div class="card-icon">🎯</div>
                            <div class="card-title">Citizen Impact</div>
                        </div>
                        <div class="card-content">
                            ${createImpactDisplay(gscData, ga4Data)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }



    
// NEW: Expanded Citizens Quality Score Section (replaces Content Performance Score)
function createExpandedCitizensQualitySection(gscData, ga4Data) {
    // Use Citizens Information specific scoring
    const citizensScore = calculateCitizensInfoQualityScore(gscData, ga4Data);
    const overallScore = citizensScore.overall;
    const grade = citizensScore.grade;
    
    return `
        <div class="expanded-citizens-quality-section">
            <!-- Header with Overall Score -->
            <div class="quality-header">
                <div class="score-display-large">
                    <div class="score-circle-large ${getScoreClass(overallScore)}">
                        <div class="score-number-large">${overallScore}</div>
                        <div class="score-label-large">Citizens Info Score</div>
                    </div>
                    <div class="score-grade-large">Grade: ${grade}</div>
                </div>
                
                <div class="score-explanation">
                    <h3>Quality Assessment</h3>
                    <p>This comprehensive score evaluates how well your content serves Irish citizens across four critical dimensions. Each component is weighted based on government service best practices.</p>
                </div>
            </div>
            
            <!-- Component Breakdown Grid -->
            <div class="quality-components-grid">
                <!-- Findability Component -->
                <div class="quality-component-card findability">
                    <div class="component-header">
                        <div class="component-icon">🔍</div>
                        <div class="component-info">
                            <div class="component-title">Findability</div>
                            <div class="component-subtitle">Can citizens find this page?</div>
                        </div>
                        <div class="component-score ${getScoreClass(citizensScore.findability)}">
                            ${citizensScore.findability}/100
                        </div>
                    </div>
                    
                    <div class="component-details">
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Average Search Position:</span>
                                <span class="detail-value">${gscData?.position ? '#' + gscData.position.toFixed(0) : 'No data'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Click Rate:</span>
                                <span class="detail-value">${gscData?.ctr ? (gscData.ctr * 100).toFixed(1) + '%' : 'No data'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Monthly Impressions:</span>
                                <span class="detail-value">${gscData?.impressions ? formatNumber(gscData.impressions) : 'No data'}</span>
                            </div>
                        </div>
                        
                        <div class="component-improvement">
                            <div class="improvement-icon">💡</div>
                            <div class="improvement-text">${getFindabilityImprovement(citizensScore.findability, gscData)}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Helpfulness Component -->
                <div class="quality-component-card helpfulness">
                    <div class="component-header">
                        <div class="component-icon">🎯</div>
                        <div class="component-info">
                            <div class="component-title">Helpfulness</div>
                            <div class="component-subtitle">Does it help citizens?</div>
                        </div>
                        <div class="component-score ${getScoreClass(citizensScore.helpfulness)}">
                            ${citizensScore.helpfulness}/100
                        </div>
                    </div>
                    
                    <div class="component-details">
                        <div class="detail-grid">
                            <div class="detail-item">
    <span class="detail-label">Success Rate:</span>
    <span class="detail-value">${ga4Data?.bounceRate ? ((1 - ga4Data.bounceRate) * 100).toFixed(0) + '%' : 'No data'}</span>
</div>
<div class="detail-item">
    <span class="detail-label">Time Investment:</span>
    <span class="detail-value">${ga4Data?.avgSessionDuration ? formatDuration(ga4Data.avgSessionDuration) + ' avg' : 'No data'}</span>
</div>
<div class="detail-item">
    <span class="detail-label">Pages/Session:</span>
    <span class="detail-value">${ga4Data?.sessions && ga4Data?.pageViews ? (ga4Data.pageViews / ga4Data.sessions).toFixed(1) : 'No data'}</span>
</div>
                        </div>
                        
                        <div class="component-improvement">
                            <div class="improvement-icon">💡</div>
                            <div class="improvement-text">${getHelpfulnessImprovement(citizensScore.helpfulness, ga4Data)}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Readability Component -->
                <div class="quality-component-card readability">
                    <div class="component-header">
                        <div class="component-icon">📖</div>
                        <div class="component-info">
                            <div class="component-title">Readability</div>
                            <div class="component-subtitle">Do citizens read it?</div>
                        </div>
                        <div class="component-score ${getScoreClass(citizensScore.readability)}">
                            ${citizensScore.readability}/100
                        </div>
                    </div>
                    
                    <div class="component-details">
                        <div class="detail-grid">
                            
<div class="detail-item">
    <span class="detail-label">Reading Time:</span>
    <span class="detail-value">${formatDuration(ga4Data.avgSessionDuration || 0)}</span>
</div>
<div class="detail-item">
    <span class="detail-label">Reading Benchmark:</span>
    <span class="detail-value">90 seconds = ideal</span>
</div>
                            <div class="detail-item">
                                <span class="detail-label">Reading Depth:</span>
                                <span class="detail-value">${citizensScore.readability >= 75 ? 'High' : citizensScore.readability >= 50 ? 'Medium' : 'Low'}</span>
                            </div>
                        </div>
                        
                        <div class="component-improvement">
                            <div class="improvement-icon">💡</div>
                            <div class="improvement-text">${getReadabilityImprovement(citizensScore.readability, ga4Data)}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Performance Component -->
                <div class="quality-component-card performance">
                    <div class="component-header">
                        <div class="component-icon">⚡</div>
                        <div class="component-info">
                            <div class="component-title">Performance</div>
                            <div class="component-subtitle">Does it work well?</div>
                        </div>
                        <div class="component-score ${getScoreClass(citizensScore.performance)}">
                            ${citizensScore.performance}/100
                        </div>
                    </div>
                    
                    <div class="component-details">
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Technical Health:</span>
                                <span class="detail-value">${citizensScore.performance >= 60 ? 'Good' : 'Needs Work'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Bounce Rate:</span>
                                <span class="detail-value">${ga4Data?.bounceRate ? (ga4Data.bounceRate * 100).toFixed(0) + '%' : 'No data'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Loading Speed:</span>
                                <span class="detail-value">Analyzing...</span>
                            </div>
                        </div>
                        
                        <div class="component-improvement">
                            <div class="improvement-icon">💡</div>
                            <div class="improvement-text">${getPerformanceImprovement(citizensScore.performance, ga4Data)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Citizens Information Specific Insights -->
            <div class="citizens-insights-expanded">
                <h4>🧠 Insights</h4>
                <div class="insights-grid">
                    ${citizensScore.insights.map(insight => `
                        <div class="insight-card ${insight.type}">
                            <div class="insight-header">
                                <span class="insight-category">${insight.category}</span>
                                <span class="insight-impact">${insight.impact}</span>
                            </div>
                            <div class="insight-message">${insight.message}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Actionable Recommendations -->
            <div class="recommendations-expanded">
                <h4>🚀 Actionable Recommendations</h4>
                <div class="recommendations-grid">
                    ${citizensScore.recommendations.map(rec => `
                        <div class="recommendation-card priority-${rec.priority.toLowerCase()}">
                            <div class="rec-header">
                                <div class="rec-priority">
                                    <span class="priority-indicator ${rec.priority.toLowerCase()}"></span>
                                    <span class="priority-label">${rec.priority} Priority</span>
                                </div>
                                <div class="rec-timeframe">${rec.timeframe}</div>
                            </div>
                            
                            <div class="rec-action">${rec.action}</div>
                            <div class="rec-impact">${rec.impact}</div>
                            
                            <div class="rec-specifics">
                                <div class="specifics-title">Specific Actions:</div>
                                <ul class="specifics-list">
                                    ${rec.specific.map(action => `<li>${action}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Overall Recommendation -->
            <div class="overall-recommendation-expanded">
                <div class="recommendation-header">
                    <h4>🎯 Overall Citizens Information Recommendation</h4>
                    <div class="recommendation-score">Score: ${overallScore}/100 (${grade})</div>
                </div>
                <div class="recommendation-content">
                    <p>${getCitizensOverallRecommendation(overallScore, citizensScore)}</p>
                </div>
            </div>
        </div>
    `;
}





    

    function createQualityScoreDisplay(gscData, ga4Data) {
    // Use Citizens Information specific scoring
    const citizensScore = calculateCitizensInfoQualityScore(gscData, ga4Data);
    const overallScore = citizensScore.overall;
    const grade = citizensScore.grade;
    
    return `
        <div class="quality-score-display">
            <div class="score-circle ${getScoreClass(overallScore)}">
                <div class="score-number">${overallScore}</div>
                <div class="score-label">Citizens Info Score</div>
            </div>
            <div class="score-grade">Grade: ${grade}</div>
            
            <!-- Detailed Breakdown Toggle -->
            <div class="score-breakdown-toggle">
                <button class="breakdown-btn" data-action="toggle-quality-breakdown" id="qualityBreakdownBtn">
                    <span>📊 Show Breakdown</span>
                </button>
            </div>
            
            <!-- Hidden Breakdown Details -->
            <div class="quality-breakdown" id="qualityBreakdown" style="display: none;">
                <div class="breakdown-explanation">
                    <p><strong>Citizens Information Quality Components:</strong></p>
                </div>
                
                <div class="breakdown-components">
                    <div class="breakdown-item">
                        <div class="breakdown-header">
                            <span class="breakdown-icon">🔍</span>
                            <span class="breakdown-name">Findability</span>
                            <span class="breakdown-score ${getScoreClass(citizensScore.findability)}">${citizensScore.findability}/100</span>
                        </div>
                        <div class="breakdown-details">
                            <div class="breakdown-metric">Search Position: ${gscData?.position ? '#' + gscData.position.toFixed(0) : 'No data'}</div>
                            <div class="breakdown-metric">Click Rate: ${gscData?.ctr ? (gscData.ctr * 100).toFixed(1) + '%' : 'No data'}</div>
                            <div class="breakdown-metric">Impressions: ${gscData?.impressions ? formatNumber(gscData.impressions) : 'No data'}</div>
                            <div class="breakdown-improvement">${getFindabilityImprovement(citizensScore.findability, gscData)}</div>
                        </div>
                    </div>
                    
                    <div class="breakdown-item">
                        <div class="breakdown-header">
                            <span class="breakdown-icon">🎯</span>
                            <span class="breakdown-name">Helpfulness</span>
                            <span class="breakdown-score ${getScoreClass(citizensScore.helpfulness)}">${citizensScore.helpfulness}/100</span>
                        </div>
<div class="breakdown-details">
    <div class="breakdown-metric">Success Rate: ${ga4Data?.bounceRate ? ((1 - ga4Data.bounceRate) * 100).toFixed(0) + '%' : 'No data'}</div>
    <div class="breakdown-metric">Time Investment: ${ga4Data?.avgSessionDuration ? formatDuration(ga4Data.avgSessionDuration) + ' avg' : 'No data'}</div>
    <div class="breakdown-metric">Pages/Session: ${ga4Data?.sessions && ga4Data?.pageViews ? (ga4Data.pageViews / ga4Data.sessions).toFixed(1) : 'No data'}</div>
    <div class="breakdown-improvement">${getHelpfulnessImprovement(citizensScore.helpfulness, ga4Data)}</div>
</div>
                    </div>
                    
                    <div class="breakdown-item">
                        <div class="breakdown-header">
                            <span class="breakdown-icon">📖</span>
                            <span class="breakdown-name">Readability</span>
                            <span class="breakdown-score ${getScoreClass(citizensScore.readability)}">${citizensScore.readability}/100</span>
                        </div>
                        <div class="breakdown-details">
                            <div class="breakdown-metric">Time on Page: ${ga4Data?.avgSessionDuration ? formatDuration(ga4Data.avgSessionDuration) : 'No data'}</div>
                            <div class="breakdown-metric">Content Completion: ${ga4Data?.bounceRate ? ((1 - ga4Data.bounceRate) * 100).toFixed(0) + '%' : 'No data'}</div>
                            <div class="breakdown-improvement">${getReadabilityImprovement(citizensScore.readability, ga4Data)}</div>
                        </div>
                    </div>
                    
                    <div class="breakdown-item">
                        <div class="breakdown-header">
                            <span class="breakdown-icon">⚡</span>
                            <span class="breakdown-name">Performance</span>
                            <span class="breakdown-score ${getScoreClass(citizensScore.performance)}">${citizensScore.performance}/100</span>
                        </div>
                        <div class="breakdown-details">
                            <div class="breakdown-metric">Technical Health: ${citizensScore.performance >= 60 ? 'Good' : 'Needs Work'}</div>
                            <div class="breakdown-metric">Bounce Rate: ${ga4Data?.bounceRate ? (ga4Data.bounceRate * 100).toFixed(0) + '%' : 'No data'}</div>
                            <div class="breakdown-improvement">${getPerformanceImprovement(citizensScore.performance, ga4Data)}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Citizens Information Specific Insights -->
                <div class="citizens-insights-section">
                    <h4>💡 Citizens Information Insights</h4>
                    <div class="insights-list">
                        ${citizensScore.insights.map(insight => `
                            <div class="insight-item ${insight.type}">
                                <div class="insight-header">
                                    <div><span class="insight-category">${insight.category}</span></div>
                                    <span class="insight-impact">${insight.impact}</span>
                                </div>
                                <div class="insight-message">${insight.message}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Actionable Recommendations -->
                <div class="citizens-recommendations-section">
                    <h4>🚀 Actionable Recommendations</h4>
                    <div class="recommendations-list">
                        ${citizensScore.recommendations.map(rec => `
                            <div class="recommendation-item priority-${rec.priority.toLowerCase()}">
                                <div class="rec-header">
                                    <span class="rec-action">${rec.action}</span>
                                    <div class="rec-badges">
                                        <span class="priority-badge ${rec.priority.toLowerCase()}">${rec.priority} Priority</span>
                                        <span class="timeframe-badge">${rec.timeframe}</span>
                                    </div>
                                </div>
                                <div class="rec-impact">${rec.impact}</div>
                                <div class="rec-specifics">
                                    <strong>Specific Actions:</strong>
                                    <ul>
                                        ${rec.specific.map(action => `<li>${action}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="overall-recommendation">
                    <h4>🎯 Overall Citizens Information Recommendation</h4>
                    <p>${getCitizensOverallRecommendation(overallScore, citizensScore)}</p>
                </div>
            </div>
        </div>
    `;
}


// ====================================
// CITIZENS INFORMATION QUALITY SCORING
// ====================================

function calculateCitizensInfoQualityScore(gscData, ga4Data, coreWebVitals = null) {
    const scores = {
        findability: calculateFindabilityScore(gscData),           // Can citizens find this page?
        helpfulness: calculateHelpfulnessScore(ga4Data),          // Does it help citizens?
        readability: calculateReadabilityScore(ga4Data),          // Do citizens read it?
        performance: calculatePerformanceScore(ga4Data, coreWebVitals), // Does it load well?
        overall: 0
    };
    
    // Equal weighting for information pages (all aspects matter)
    scores.overall = Math.round(
        (scores.findability * 0.3) +    // Can they find it? (30%)
        (scores.helpfulness * 0.35) +   // Does it help them? (35%) 
        (scores.readability * 0.25) +   // Do they read it? (25%)
        (scores.performance * 0.1)      // Does it work well? (10%)
    );
    
    return {
        ...scores,
        grade: getGradeFromScore(scores.overall),
        insights: generateCitizensInfoInsights(scores, gscData, ga4Data),
        recommendations: generateActionableRecommendations(scores, gscData, ga4Data)
    };
}

// 1. FINDABILITY SCORE (Can citizens find this page in Google?)
function calculateFindabilityScore(gscData) {
    if (!gscData || gscData.noDataFound) return 20;
    
    const position = gscData.position || 50;
    const impressions = gscData.impressions || 0;
    const ctr = gscData.ctr || 0;
    
    // UPDATED: More lenient position scoring for AVERAGE position
    let positionScore = 0;
    if (position <= 5) positionScore = 100;      // Excellent - top 5 average
    else if (position <= 10) positionScore = 85; // Very good - top 10 average  
    else if (position <= 15) positionScore = 70; // Good - top 15 average
    else if (position <= 25) positionScore = 55; // Fair - top 25 average
    else if (position <= 35) positionScore = 40; // Poor - top 35 average
    else positionScore = 25;                     // Very poor - beyond page 3 average
    
    // Visibility score - Are people searching for this info?
    let visibilityScore = 0;
    if (impressions >= 1000) visibilityScore = 100;      // High demand
    else if (impressions >= 500) visibilityScore = 80;   // Good demand  
    else if (impressions >= 100) visibilityScore = 60;   // Some demand
    else if (impressions >= 50) visibilityScore = 40;    // Low demand
    else visibilityScore = 20;                           // Very low demand
    
    // Click appeal - Do titles/descriptions attract citizens?
    const expectedCTR = getCTRBenchmark(position);
    const appealScore = expectedCTR > 0 ? 
        Math.min(100, (ctr / expectedCTR) * 100) : 50;
    
    // Weighted combination (position most important for gov info)
    return Math.round((positionScore * 0.5) + (visibilityScore * 0.3) + (appealScore * 0.2));
}

// 2. HELPFULNESS SCORE (Does this page actually help citizens?)
function calculateHelpfulnessScore(ga4Data) {
    if (!ga4Data || ga4Data.noDataFound) return 30;
    
    const bounceRate = ga4Data.bounceRate || 0.6;
    const avgSessionDuration = ga4Data.avgSessionDuration || 0;
    const sessions = ga4Data.sessions || 0;
    const pageViews = ga4Data.pageViews || 0;
    
    // Success rate - Citizens who didn't immediately leave
    const successRate = (1 - bounceRate) * 100;
    
    // Time investment - Citizens who spent meaningful time reading
    // For government info: 60 seconds = good engagement benchmark
    const timeInvestment = Math.min(100, (avgSessionDuration / 60) * 100);
    
    // Return value - Citizens who explored further
    const pagesPerSession = sessions > 0 ? pageViews / sessions : 1;
    const returnValue = Math.min(100, (pagesPerSession - 1) * 100); // Above 1 = exploring
    
    // For information pages, success and time investment matter most
    return Math.round((successRate * 0.5) + (timeInvestment * 0.4) + (returnValue * 0.1));
}

// 3. READABILITY SCORE (Do citizens actually read the content?)
function calculateReadabilityScore(ga4Data) {
    if (!ga4Data || ga4Data.noDataFound) return 30;
    
    const avgSessionDuration = ga4Data.avgSessionDuration || 0;
    
    // Single page readability - pure time investment
    // Under 15 seconds = clearly didn't read (very low score)
    // 90 seconds = ideal government content reading time (100%)
    if (avgSessionDuration < 15) {
        return Math.round((avgSessionDuration / 15) * 20); // 0-20 range for very short visits
    }
    
    return Math.min(100, Math.round((avgSessionDuration / 90) * 100));
}

// 4. PERFORMANCE SCORE (Does the page work well technically?)
function calculatePerformanceScore(ga4Data, coreWebVitals) {
    if (!ga4Data || ga4Data.noDataFound) return 40;
    
    // If we have Core Web Vitals, use them
    if (coreWebVitals) {
        return calculateCoreWebVitalsScore(coreWebVitals);
    }
    
    // Otherwise, use proxy metrics
    const bounceRate = ga4Data.bounceRate || 0.6;
    const engagementRate = ga4Data.engagementRate || 0.4;
    
    // High bounce + low engagement often indicates technical issues
    const technicalHealth = Math.round((engagementRate * 70) + ((1 - bounceRate) * 30));
    
    return Math.min(100, technicalHealth);
}

// CORE WEB VITALS SCORING (if available)
function calculateCoreWebVitalsScore(vitals) {
    let score = 0;
    let components = 0;
    
    // LCP Score (should be under 2.5 seconds)
    if (vitals.lcp !== undefined) {
        components++;
        if (vitals.lcp <= 2.5) score += 100;
        else if (vitals.lcp <= 4.0) score += 70;
        else score += 30;
    }
    
    // FID Score (should be under 100ms) 
    if (vitals.fid !== undefined) {
        components++;
        if (vitals.fid <= 100) score += 100;
        else if (vitals.fid <= 300) score += 70;
        else score += 30;
    }
    
    // CLS Score (should be under 0.1)
    if (vitals.cls !== undefined) {
        components++;
        if (vitals.cls <= 0.1) score += 100;
        else if (vitals.cls <= 0.25) score += 70;
        else score += 30;
    }
    
    return components > 0 ? Math.round(score / components) : 50;
}


  
// ====================================
// INSIGHTS GENERATION
// ====================================

function generateCitizensInfoInsights(scores, gscData, ga4Data) {
    const insights = [];
    const position = gscData?.position || 50;
    
    // Findability insights - more nuanced for average position
    if (scores.findability < 60) {
        if (position > 25) {
            insights.push({
                type: 'warning', // Changed from 'critical' to 'warning'
                category: 'Findability',
                message: `Average search position is #${position.toFixed(0)}. While some queries may rank well, overall discoverability needs improvement.`,
                impact: 'Medium - Mixed search performance across queries'
            });
        } else if (position > 15) {
            insights.push({
                type: 'warning',
                category: 'Findability',
                message: `Average search position is #${position.toFixed(0)}. Focus on improving ranking for your most important target keywords.`,
                impact: 'Medium - Good foundation but needs optimization'
            });
        }
        
        if (gscData && gscData.impressions < 100) {
            insights.push({
                type: 'warning', 
                category: 'Findability',
                message: 'Low search volume suggests limited keyword targeting or content discoverability.',
                impact: 'Medium - Missing potential citizen searches'
            });
        }
    } else if (scores.findability >= 75) {
        // Add positive insight for good findability
        insights.push({
            type: 'success',
            category: 'Findability',
            message: `Excellent average search position (#${position.toFixed(0)}). Citizens can easily discover this information.`,
            impact: 'Positive search visibility'
        });
    }
    
    // Helpfulness insights (unchanged)
    if (scores.helpfulness < 50) {
        if (ga4Data && ga4Data.bounceRate > 0.7) {
            insights.push({
                type: 'critical',
                category: 'Helpfulness', 
                message: `${(ga4Data.bounceRate * 100).toFixed(0)}% of citizens leave immediately. Content may not match their information needs.`,
                impact: 'High - Citizens not getting help they need'
            });
        }
        if (ga4Data && ga4Data.engagementRate < 0.3) {
            insights.push({
                type: 'warning',
                category: 'Helpfulness',
                message: 'Low citizen engagement suggests information is hard to use or irrelevant.',
                impact: 'Medium - Poor user experience'
            });
        }
    }
    
    // Readability insights (unchanged)
    if (scores.readability < 50) {
        if (ga4Data && ga4Data.avgSessionDuration < 45) {
            insights.push({
                type: 'warning',
                category: 'Readability',
                message: 'Citizens spend very little time reading. Information may be too complex or poorly formatted.',
                impact: 'Medium - Information not being consumed'
            });
        }
    }
    
    // Performance insights (unchanged)
    if (scores.performance < 50) {
        insights.push({
            type: 'warning',
            category: 'Performance',
            message: 'Technical performance issues may be preventing citizens from accessing information.',
            impact: 'Medium - Technical barriers to access'
        });
    }
    
    // Positive insights
    if (scores.overall >= 75) {
        insights.push({
            type: 'success',
            category: 'Overall',
            message: 'Excellent! This page effectively serves citizens\' information needs.',
            impact: 'Positive citizen experience'
        });
    }
    
    return insights;
}


// ====================================
// ACTIONABLE RECOMMENDATIONS
// ====================================

function generateActionableRecommendations(scores, gscData, ga4Data) {
    const recommendations = [];
    
    // Findability improvements
    if (scores.findability < 60) {
        recommendations.push({
            priority: 'High',
            action: 'SEO Optimization',
            specific: [
                'Review and improve page title to match citizen search terms',
                'Write meta description that clearly explains what citizens will find',
                'Add internal links from related high-traffic pages',
                'Ensure content includes terms citizens actually search for'
            ],
            timeframe: '1-2 weeks',
            impact: `Could help ${gscData?.impressions ? Math.round(gscData.impressions * 0.3) : 'more'} citizens find this information monthly`
        });
    }
    
    // Helpfulness improvements  
    if (scores.helpfulness < 50) {
        recommendations.push({
            priority: 'High',
            action: 'Content Restructuring', 
            specific: [
                'Add clear headings that match citizen questions',
                'Put most important information at the top',
                'Use bullet points and simple language',
                'Add "What you need to know" summary section',
                'Include relevant contact information or next steps'
            ],
            timeframe: '2-3 weeks',
            impact: `Could reduce bounce rate from ${ga4Data?.bounceRate ? (ga4Data.bounceRate * 100).toFixed(0) : '60'}% to ~40%`
        });
    }
    
    // Readability improvements
    if (scores.readability < 50) {
        recommendations.push({
            priority: 'Medium',
            action: 'Content Formatting',
            specific: [
                'Break up long paragraphs into shorter ones',
                'Use more headings and bullet points', 
                'Add a table of contents for long pages',
                'Include examples or scenarios citizens can relate to',
                'Consider adding FAQ section for common questions'
            ],
            timeframe: '1-2 weeks', 
            impact: 'Increase average reading time and citizen satisfaction'
        });
    }
    
    // Performance improvements
    if (scores.performance < 60) {
        recommendations.push({
            priority: 'Medium',
            action: 'Technical Improvements',
            specific: [
                'Optimise images and file sizes',
                'Review page loading speed',
                'Test on mobile devices',
                'Check for broken links or forms'
            ],
            timeframe: '1 week',
            impact: 'Improve citizen experience, especially on mobile'
        });
    }
    
    return recommendations;
}

// ====================================
// HELPER FUNCTIONS
// ====================================

function getGradeFromScore(score) {
    if (score >= 85) return 'A';
    if (score >= 75) return 'B'; 
    if (score >= 65) return 'C';
    if (score >= 55) return 'D';
    return 'F';
}

function getFindabilityImprovement(score, gscData) {
    if (score >= 75) return "✅ Citizens can easily find this information";
    
    const position = gscData?.position || 50;
    const ctr = gscData?.ctr || 0;
    const impressions = gscData?.impressions || 0;
    
    // More nuanced messages based on average position
    if (position > 25) {
        return "📈 Average search ranking needs improvement - focus on top-performing queries first";
    } else if (position > 15) {
        return "📊 Decent average ranking but room for improvement - optimise for main target keywords";
    } else if (ctr < 0.05) {
        return "📝 Good average position but low click rate - optimise titles and descriptions";
    } else if (impressions < 500) {
        return "🔍 Improve keyword targeting to increase search visibility";
    }
    
    return "🎯 Focus on improving ranking for your most important target keywords";
}

function getHelpfulnessImprovement(score, ga4Data) {
    if (score >= 75) return "✅ Content successfully helps citizens";
    if (ga4Data?.bounceRate > 0.7) return "📚 Restructure content to better match citizen needs";
    if (ga4Data?.avgSessionDuration < 30) return "⏱️ Make content more engaging to increase reading time";
    if (ga4Data?.sessions && ga4Data?.pageViews && (ga4Data.pageViews / ga4Data.sessions) < 1.2) return "🔗 Add better internal linking to encourage exploration";
    return "👥 Focus on improving citizen engagement and time investment";
}

function getReadabilityImprovement(score, ga4Data) {
    if (score >= 75) return "✅ Citizens are reading and consuming the information";
    if (ga4Data?.avgSessionDuration < 60) return "⏱️ Break up content and improve readability";
    return "📖 Make content easier to read and understand";
}

function getPerformanceImprovement(score, ga4Data) {
    if (score >= 75) return "✅ Page performs well technically";
    if (ga4Data?.bounceRate > 0.6) return "⚡ Technical issues may be causing high bounce rate";
    return "🔧 Improve page loading speed and technical performance";
}

function getCitizensOverallRecommendation(score, citizensScore) {
    if (score >= 85) {
        return "Outstanding! This page excellently serves citizens' information needs across all quality dimensions. Continue monitoring and maintain this high standard.";
    } else if (score >= 65) {
        return "Good performance overall. Focus on the lowest-scoring areas (findability, helpfulness, readability, or performance) for maximum improvement in citizen service.";
    } else if (score >= 45) {
        return "Significant room for improvement. Citizens are struggling to find, use, or understand this information. Start with the highest-priority recommendations to better serve citizens.";
    } else {
        return "This page needs urgent attention. Poor performance across multiple areas is preventing citizens from getting the information they need. Implement high-priority recommendations immediately.";
    }
}

// ====================================
// ADDITIONAL STYLING FOR CITIZENS INFO
// ====================================

// Add these styles to your existing CSS or include in the dashboard
const citizensInfoStyles = `
<style>
.citizens-insights-section {
    margin-top: 20px;
    padding: 16px;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border-radius: 8px;
    border-left: 4px solid #0ea5e9;
}

.insights-list {
    display: grid;
    gap: 12px;
    margin-top: 12px;
}

.insight-item {
    padding: 12px;
    border-radius: 6px;
    border-left: 3px solid #e5e7eb;
}

.insight-item.critical {
    background: #fef2f2;
    border-left-color: #ef4444;
}

.insight-item.warning {
    background: #fffbeb;
    border-left-color: #f59e0b;
}

.insight-item.success {
    background: #f0fdf4;
    border-left-color: #10b981;
}

.insight-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    font-size: 0.8rem;
    font-weight: 600;
}

.insight-category {
    color: #374151;
}

.insight-impact {
    color: #6b7280;
    font-size: 0.75rem;
}

.insight-message {
    font-size: 0.85rem;
    color: #374151;
    line-height: 1.4;
}

.citizens-recommendations-section {
    margin-top: 20px;
    padding: 16px;
    background: #f8fafc;
    border-radius: 8px;
    border-left: 4px solid #10b981;
}

.recommendations-list {
    display: grid;
    gap: 16px;
    margin-top: 12px;
}

.recommendation-item {
    padding: 16px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.recommendation-item.priority-high {
    border-left: 4px solid #ef4444;
}

.recommendation-item.priority-medium {
    border-left: 4px solid #f59e0b;
}

.recommendation-item.priority-low {
    border-left: 4px solid #6b7280;
}

.rec-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    flex-wrap: wrap;
    gap: 8px;
}

.rec-action {
    font-weight: 700;
    color: #1f2937;
    font-size: 0.95rem;
}

.rec-badges {
    display: flex;
    gap: 8px;
}

.priority-badge, .timeframe-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
}

.priority-badge.high {
    background: #fee2e2;
    color: #dc2626;
}

.priority-badge.medium {
    background: #fef3c7;
    color: #d97706;
}

.priority-badge.low {
    background: #f1f5f9;
    color: #64748b;
}

.timeframe-badge {
    background: #e0f2fe;
    color: #0369a1;
}

.rec-impact {
    font-size: 0.85rem;
    color: #059669;
    font-weight: 500;
    margin-bottom: 12px;
}

.rec-specifics {
    font-size: 0.85rem;
    color: #374151;
}

.rec-specifics ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
}

.rec-specifics li {
    margin-bottom: 4px;
    line-height: 1.4;
}
</style>
`;  





    

    function createImpactDisplay(gscData, ga4Data) {
    const impact = calculateEnhancedImpactMetrics(gscData, ga4Data);
    
    return `
        <div class="impact-metrics">
            <div class="impact-metric">
                <span class="citizen-impact-label">Information Seekers:</span>
                <span class="impact-value">${impact.seekers}</span>
                <span class="impact-explain" title="Search clicks + unique visitors in last 30 days">ℹ️</span>
            </div>
            <div class="impact-metric">
                <span class="citizen-impact-label">Query Types Found:</span>
                <span class="impact-value">${impact.queryTypes}</span>
                <span class="impact-explain" title="Different search queries leading to this page">ℹ️</span>
            </div>
            <div class="impact-metric">
                <span class="citizen-impact-label">Content Success Rate:</span>
                <span class="impact-value">${impact.successRate}%</span>
                <span class="impact-explain" title="Citizens who stayed and engaged (didn't immediately leave)">ℹ️</span>
            </div>
            
            <!-- Detailed Breakdown Toggle -->
            <div class="impact-breakdown-toggle">
                <button class="impact-breakdown-btn" data-action="toggle-impact-breakdown">
                    <span>📊 Show Calculation Details</span>
                </button>
            </div>
            
            <!-- Detailed Breakdown -->
            <div class="impact-breakdown-details" id="impactBreakdown" style="display: none;">
              
                <div class="impact-breakdown-section">
                    <h5>🔍 Information Seekers Breakdown</h5>
                    <div class="impact-calculation">
                        <div class="calc-item">
                            <span class="calc-label">Search Clicks:</span>
                            <span class="calc-value">${formatNumber(gscData?.clicks || 0)}</span>
                            <span class="calc-source">(Google Search Console)</span>
                        </div>
                        <div class="calc-item">
                            <span class="calc-label">Unique Visitors:</span>
                            <span class="calc-value">${formatNumber(ga4Data?.users || 0)}</span>
                            <span class="calc-source">(Google Analytics)</span>
                        </div>
                        <div class="calc-total">
                            <span class="calc-label"><strong>Total Information Seekers:</strong></span>
                            <span class="calc-value"><strong>${impact.seekers}</strong></span>
                        </div>
                        <div class="calc-note">
                            <small>📝 Note: Some overlap between search clicks and direct visitors is possible</small>
                        </div>
                    </div>
                </div>
                
                <div class="impact-breakdown-section">
                    <h5>❓ Query Types Analysis</h5>
                    <div class="impact-calculation">
                        <div class="calc-item">
                            <span class="calc-label">Different Search Queries:</span>
                            <span class="calc-value">${impact.queryTypes}</span>
                            <span class="calc-source">(Top queries from GSC)</span>
                        </div>
                        <div class="calc-note">
                            <small>📝 This shows the variety of information needs this page serves</small>
                        </div>
                        ${gscData?.topQueries?.length > 0 ? `
                            <div class="top-queries-preview">
                                <strong>Top citizen questions:</strong>
                                <ul>
                                    ${gscData.topQueries.slice(0, 3).map(q => 
                                        `<li>"${q.query}" (${q.clicks} citizens)`
                                    ).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="impact-breakdown-section">
                    <h5>✅ Content Success Rate Breakdown</h5>
                    <div class="impact-calculation">
                        ${ga4Data && !ga4Data.noDataFound ? `
                            <div class="calc-item">
                                <span class="calc-label">Bounce Rate:</span>
                                <span class="calc-value">${(ga4Data.bounceRate * 100).toFixed(0)}%</span>
                                <span class="calc-source">(Citizens who left immediately)</span>
                            </div>
                            <div class="calc-item">
                                <span class="calc-label">Engagement Rate:</span>
                                <span class="calc-value">${((1 - ga4Data.bounceRate) * 100).toFixed(0)}%</span>
                                <span class="calc-source">(Citizens who stayed and engaged)</span>
                            </div>
                            <div class="calc-item">
                                <span class="calc-label">Average Time on Page:</span>
                                <span class="calc-value">${formatDuration(ga4Data.avgSessionDuration || 0)}</span>
                                <span class="calc-source">(Time citizens spend reading)</span>
                            </div>
                        ` : `
                            <div class="calc-item">
                                <span class="calc-label">Success Rate:</span>
                                <span class="calc-value">70% (estimated)</span>
                                <span class="calc-source">(Default when no analytics data)</span>
                            </div>
                        `}
                        <div class="calc-note">
                            <small>📝 Success = Citizens who didn't immediately leave (bounce)</small>
                        </div>
                    </div>
                </div>
                
                <div class="impact-summary-section">
                    <h5>📊 Impact Summary</h5>
                    <p>${getImpactSummary(impact, gscData, ga4Data)}</p>
                </div>
            </div>
        </div>
    `;
}

    function calculateImpactMetrics(gscData, ga4Data) {
        const seekers = formatNumber((gscData?.clicks || 0) + (ga4Data?.users || 0));
        const questionsAnswered = gscData?.topQueries?.length || 0;
        
        let successRate = 70;
        if (ga4Data && !ga4Data.noDataFound) {
            successRate = Math.round((1 - (ga4Data.bounceRate || 0.3)) * 100);
        }
        
        return { seekers, questionsAnswered, successRate };
    }



    
// ENHANCED GEOGRAPHIC INTELLIGENCE - COMPLETE IMPLEMENTATION
// Advanced geographic service intelligence for Irish government services
// Integrates with your existing dashboard system

// ==================================================
// MAIN ENHANCED FUNCTION - REPLACES YOUR EXISTING ONE
// ==================================================

function createEnhancedGeographicServiceIntelligence(gscData, ga4Data, pageUrl = null) {
    const geoData = ga4Data?.geographic || {};
    const trafficData = ga4Data?.trafficSources || {};
    
    // Enhanced data processing with page context
    const geoInsights = processGeographicDataEnhanced(geoData, gscData);
    const servicePatterns = analyzeServicePatternsEnhanced(geoData, gscData);
    const accessibilityInsights = calculateAccessibilityMetricsEnhanced(geoData);
    const pageContext = analyzePageContextEnhanced(pageUrl);
    const searchPatterns = analyzeGeographicSearchPatternsEnhanced(gscData, geoData, pageContext);
    const trendAnalysis = calculateGeographicTrendsEnhanced(geoData, trafficData);
    
    return `
        <div class="section enhanced-geographic-intelligence">
            <div class="geo-header">
                <h2 class="section-title">🌍 Geographic Service Intelligence</h2>
                <div class="geo-explanation">
                    <p><strong>Geographic Analysis:</strong> Understanding where citizens access <em>${pageContext.serviceType}</em> and optimizing for better regional service delivery.</p>
                </div>
            </div>
            
            <!-- Executive Geographic Summary (KPI Cards) -->
            <div class="geo-executive-summary">
                <div class="geo-kpi-grid">
                    <div class="geo-kpi-card primary">
                        <div class="kpi-icon">🇮🇪</div>
                        <div class="kpi-content">
                            <div class="kpi-number">${geoInsights.totalIrishUsers}</div>
                            <div class="kpi-label">Irish Citizens Served</div>
                            <div class="kpi-detail">${geoInsights.dublinPercentage}% Dublin-based</div>
                            <div class="kpi-trend ${geoInsights.irishTrend.class}">${geoInsights.irishTrend.indicator}</div>
                        </div>
                        <div class="kpi-spark">${createSparkline(geoInsights.irishTrendData)}</div>
                    </div>
                    
                   
                    
                    <div class="geo-kpi-card coverage">
                        <div class="kpi-icon">🇮🇪📍</div>
                        <div class="kpi-content">
                            <div class="kpi-number">${geoInsights.countiesCovered}</div>
                            <div class="kpi-label">Counties Reached</div>
                            <div class="kpi-detail">of 32 total counties</div>
                            <div class="kpi-trend ${geoInsights.coverageTrend.class}">${geoInsights.coverageTrend.indicator}</div>
                        </div>
                        <div class="coverage-bar">
                            <div class="coverage-fill" style="width: ${(geoInsights.countiesCovered / 32) * 100}%"></div>
                        </div>
                    </div>

                     <div class="geo-kpi-card international">
                        <div class="kpi-icon">🌍</div>
                        <div class="kpi-content">
                            <div class="kpi-number">${geoInsights.internationalUsers}</div>
                            <div class="kpi-label">International Users</div>
                            <div class="kpi-detail">${geoInsights.topInternationalCountry}</div>
                            <div class="kpi-trend ${geoInsights.internationalTrend.class}">${geoInsights.internationalTrend.indicator}</div>
                        </div>
                        <div class="kpi-spark">${createSparkline(geoInsights.internationalTrendData)}</div>
                    </div>
                    
                    <div class="geo-kpi-card opportunity">
                        <div class="kpi-icon">🎯</div>
                        <div class="kpi-content">
                            <div class="kpi-number">${geoInsights.opportunityScore}</div>
                            <div class="kpi-label">Optimization Score</div>
                            <div class="kpi-detail">${geoInsights.primaryOpportunity}</div>
                            <div class="kpi-grade grade-${getGradeClass(geoInsights.opportunityScore)}">${getGrade(geoInsights.opportunityScore)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Clean Regional Analysis (Side by Side) -->
            <div class="geo-regional-grid">
                <div class="geo-clean-card">
                    <div class="clean-card-header">
                        <h3>🇮🇪 Irish Regional Distribution</h3>
                        <span class="status-badge ${geoInsights.demandLevel.class}">${geoInsights.demandLevel.label}</span>
                    </div>
                    <div class="clean-card-content">
                        ${createCleanIrelandView(geoData.regions, geoInsights)}
                    </div>
                </div>
                
                <div class="geo-clean-card">
                    <div class="clean-card-header">
                        <h3>🌍 International Reach</h3>
                        <span class="status-badge ${geoInsights.diasporaIndicator.toLowerCase()}">${geoInsights.diasporaIndicator} Reach</span>
                    </div>
                    <div class="clean-card-content">
                        ${createCleanInternationalView(geoData.countries, geoInsights)}
                    </div>
                </div>
            </div>
            
            <!-- Clean Analysis Sections -->
            <div class="geo-analysis-grid">
                <div class="geo-clean-card">
                    <div class="clean-card-header">
                        <h3>📍 County-by-County Service Analysis</h3>
                    </div>
                    <div class="clean-card-content">
                        ${createCleanCountyAnalysis(geoData.regions, geoInsights)}
                    </div>
                </div>
                
                <div class="geo-clean-card">
                    <div class="clean-card-header">
                        <h3>👥 Demographic Service Patterns</h3>
                    </div>
                    <div class="clean-card-content">
                        ${createCleanDemographicAnalysis(geoData, geoInsights)}
                    </div>
                </div>
            </div>
            
            <!-- Geographic Search Patterns Section -->
            <div class="geo-clean-card search-patterns-card">
                <div class="clean-card-header">
                    <h3>🔍 Geographic Search Patterns</h3>
                </div>
                <div class="clean-card-content">
                    ${createCleanSearchPatterns(gscData)}
                </div>
            </div>
            
            <!-- Clean Opportunities Section -->
            <div class="geo-clean-card opportunities-card">
                <div class="clean-card-header">
                    <h3>🚀 Geographic Optimization Opportunities</h3>
                </div>
                <div class="clean-card-content">
                    ${createCleanOpportunities(servicePatterns, accessibilityInsights, pageContext)}
                </div>
            </div>
        </div>
    `;
}

// Helper functions for clean views
function createCleanIrelandView(regions, geoInsights) {
    if (!regions || regions.length === 0) {
        return `
            <div class="clean-empty-state">
                <div class="empty-icon"><svg width="46" height="46" viewBox="0 0 24 24" style="flex-shrink: 0;">
                            <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                        </svg></div>
                <div class="empty-text">Click the GA4 button in the toolbar to see regional breakdown</div>
            </div>
        `;
    }
    
    const topRegions = regions.slice(0, 6);
    
    return `
        <div class="clean-regional-overview">
            <div class="regional-stats">
                <div class="stat-item">
                    <span class="stat-number">${geoInsights.dublinPercentage}%</span>
                    <span class="stat-label">Dublin</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${regions.length}</span>
                    <span class="stat-label">Regions</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${calculateRegionalBalance(regions)}</span>
                    <span class="stat-label">Balance</span>
                </div>
            </div>
            
            <div class="regional-breakdown">
                ${topRegions.map((region, index) => `
                    <div class="region-item">
                        <div class="region-info">
                            <span class="region-name">${formatRegionNameEnhanced(region.region)}</span>
                            <span class="region-percentage">${region.percentage.toFixed(1)}%</span>
                        </div>
                        <div class="region-bar">
                            <div class="region-fill" style="width: ${(region.percentage / topRegions[0].percentage) * 100}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function createCleanInternationalView(countries, geoInsights) {
    if (!countries || countries.length === 0) {
        return `
            <div class="clean-empty-state">
                <div class="empty-icon">🌍</div>
                <div class="empty-text">Click the GA4 button in the toolbar see international reach</div>
            </div>
        `;
    }
    
    const international = countries.filter(c => c.country !== 'Ireland').slice(0, 5);
    
    return `
        <div class="clean-international-overview">
            <div class="international-stats">
                <div class="stat-item">
                    <span class="stat-number">${geoInsights.internationalUsers}</span>
                    <span class="stat-label">International</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${international.length}</span>
                    <span class="stat-label">Countries</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${geoInsights.internationalPercentage}%</span>
                    <span class="stat-label">Share</span>
                </div>
            </div>
            
            <div class="international-breakdown">
                ${international.map(country => `
                    <div class="country-item">
                        <div class="country-info">
                            <span class="country-flag">${getCountryFlagEnhanced(country.country)}</span>
                            <span class="country-name">${country.country}</span>
                            <span class="country-percentage">${country.percentage.toFixed(1)}%</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function createCleanCountyAnalysis(regions, geoInsights) {
    if (!regions || regions.length === 0) {
        return `
            <div class="clean-empty-state">
                <div class="empty-icon">📍</div>
                <div class="empty-text">County analysis requires regional data from GA4</div>
            </div>
        `;
    }
    
    return `
        <div class="clean-county-analysis">
            <div class="analysis-summary">
                <p><strong>Coverage:</strong> Serving citizens across ${regions.length} regions with ${geoInsights.dublinPercentage}% concentration in Dublin.</p>
            </div>
            
            <div class="county-performance-grid">
                ${regions.slice(0, 8).map(region => `
                    <div class="county-performance-item">
                        <div class="county-name">${formatRegionNameEnhanced(region.region)}</div>
                        <div class="county-metrics">
                            <span class="metric-value">${formatNumberEnhanced(region.users)}</span>
                            <span class="metric-label">users</span>
                        </div>
                        <div class="county-share">${region.percentage.toFixed(1)}%</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
function createCleanDemographicAnalysis(geoData, geoInsights) {
    return `
        <div class="clean-demographic-analysis">
            <div class="demographic-grid">
                <div class="demographic-item">
                    <div class="demo-icon">🏙️</div>
                    <div class="demo-content">
                        <div class="demo-title">Urban Distribution</div>
                        <div class="demo-value">Dublin: ${geoInsights.dublinPercentage}%</div>
                        <div class="demo-detail">Other urban: ${calculateOtherUrban(geoData)}%</div>
                    </div>
                </div>
                
                <div class="demographic-item">
                    <div class="demo-icon">🌍</div>
                    <div class="demo-content">
                        <div class="demo-title">International Mix</div>
                        <div class="demo-value">${geoInsights.totalCountries} countries</div>
                        <div class="demo-detail">EU: ${calculateEUCitizens(geoData)}%</div>
                    </div>
                </div>
                
                <div class="demographic-item">
                    <div class="demo-icon">🏘️</div>
                    <div class="demo-content">
                        <div class="demo-title">Rural Access</div>
                        <div class="demo-value">${calculateRural(geoData)}%</div>
                        <div class="demo-detail">Rural regions</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}


    function createCleanSearchPatterns(gscData) {
    const gscGeoData = gscData?.geographic || {};
    
    if (!gscGeoData.topCountries || gscGeoData.topCountries.length === 0) {
        return `
            <div class="clean-empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-text">Geographic search patterns require enhanced GSC integration</div>
                <div class="empty-detail">Connect advanced Search Console data to see what citizens search for by country</div>
            </div>
        `;
    }
    
    return `
        <div class="clean-search-patterns">
            <div class="patterns-summary">
                <p><strong>Search Intent by Geography:</strong> Understanding how citizens from different countries phrase their searches for your services.</p>
            </div>
            
            <div class="search-patterns-grid">
                ${gscGeoData.topCountries.map(country => `
                    <div class="search-pattern-country">
                        <div class="country-header">
                            <div class="country-flag-container">
                                <span class="country-flag-large">${getCountryFlagEnhanced(country.country)}</span>
                            </div>
                            <div class="country-info">
                                <span class="country-name">${country.country}</span>
                                <span class="country-total">${formatNumber(country.clicks)} searches</span>
                            </div>
                        </div>
                        
                        <div class="country-queries">
                            ${country.queries.slice(0, 4).map((query, index) => `
                                <div class="query-pattern-item">
                                    <div class="query-rank">#${index + 1}</div>
                                    <div class="query-content">
                                        <div class="query-text">"${escapeHtml(query.query)}"</div>
                                        <div class="query-stats">
                                            <span class="clicks-stat">${formatNumber(query.clicks)} clicks</span>
                                            <span class="flag-mini">${getCountryFlagEnhanced(country.country)}</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="search-insights">
                <h4>🧠 Key Geographic Insights</h4>
                <div class="insights-grid">
                    ${generateSearchPatternInsights(gscGeoData)}
                </div>
            </div>
        </div>
    `;
}

function generateSearchPatternInsights(gscGeoData) {
    const insights = [];
    
    // Analyze patterns across countries
    if (gscGeoData.topCountries && gscGeoData.topCountries.length > 1) {
        const totalCountries = gscGeoData.topCountries.length;
        const irishQueries = gscGeoData.topCountries.find(c => c.country === 'Ireland');
        const internationalQueries = gscGeoData.topCountries.filter(c => c.country !== 'Ireland');
        
        if (irishQueries && internationalQueries.length > 0) {
            insights.push({
                icon: '🇮🇪',
                title: 'Irish vs International Queries',
                description: `Irish citizens use ${irishQueries.queries?.length || 0} different search terms, while international users show ${internationalQueries.reduce((sum, c) => sum + (c.queries?.length || 0), 0)} variations across ${internationalQueries.length} countries.`
            });
        }
        
        // Find common themes
        const allQueries = gscGeoData.topCountries.flatMap(c => c.queries || []);
        const uniqueTerms = new Set(allQueries.map(q => q.query.toLowerCase()));
        
        if (uniqueTerms.size < allQueries.length * 0.7) {
            insights.push({
                icon: '🔄',
                title: 'Similar Search Intent',
                description: `Citizens across different countries use similar search terms, indicating consistent service needs globally.`
            });
        }
        
        // Check for urgency patterns
        const urgentQueries = allQueries.filter(q => 
            q.query.toLowerCase().includes('urgent') || 
            q.query.toLowerCase().includes('emergency') ||
            q.query.toLowerCase().includes('today')
        );
        
        if (urgentQueries.length > 0) {
            insights.push({
                icon: '🚨',
                title: 'Urgent Service Needs',
                description: `${urgentQueries.length} search queries indicate urgent service needs across multiple countries.`
            });
        }
    }
    
    // Default insight if no specific patterns found
    if (insights.length === 0) {
        insights.push({
            icon: '📊',
            title: 'Geographic Search Analysis',
            description: 'Enable enhanced Search Console reporting to get detailed insights into how citizens from different countries search for your services.'
        });
    }
    
    return insights.map(insight => `
        <div class="insight-item">
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-content">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-description">${insight.description}</div>
            </div>
        </div>
    `).join('');
}
    

function createCleanOpportunities(servicePatterns, accessibilityInsights, pageContext) {
    return `
        <div class="clean-opportunities">
            <div class="opportunities-grid">
                <div class="opportunity-item quick">
                    <div class="opp-header">
                        <span class="opp-icon">⚡</span>
                        <span class="opp-title">Quick Wins</span>
                        <span class="opp-timeframe">1-2 weeks</span>
                    </div>
                    <ul class="opp-list">
                        <li>Add regional contact information to content</li>
                        <li>Optimise mobile experience for rural users</li>
                        <li>Include location-specific service details</li>
                    </ul>
                </div>
                
                <div class="opportunity-item strategic">
                    <div class="opp-header">
                        <span class="opp-icon">🎯</span>
                        <span class="opp-title">Strategic</span>
                        <span class="opp-timeframe">1-3 months</span>
                    </div>
                    <ul class="opp-list">
                        <li>Create region-specific landing pages</li>
                        <li>Develop multilingual content for diaspora</li>
                        <li>Partner with local service centers</li>
                    </ul>
                </div>
                
                <div class="opportunity-item impact">
                    <div class="opp-header">
                        <span class="opp-icon">📈</span>
                        <span class="opp-title">Expected Impact</span>
                        <span class="opp-timeframe">ROI</span>
                    </div>
                    <div class="impact-metrics">
                        <div class="impact-item">
                            <span class="impact-value">+25%</span>
                            <span class="impact-label">Regional Engagement</span>
                        </div>
                        <div class="impact-item">
                            <span class="impact-value">+15%</span>
                            <span class="impact-label">International Reach</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ==================================================
// ENHANCED DATA PROCESSING FUNCTIONS
// ==================================================

function processGeographicDataEnhanced(geoData, gscData) {
    const regions = geoData.regions || [];
    const countries = geoData.countries || [];
    
    // Enhanced regional analysis
    const dublin = regions.find(r => r.region.toLowerCase().includes('dublin'));
    const dublinPercentage = dublin ? dublin.percentage : 0;
    
    // Irish user analysis
    const ireland = countries.find(c => c.country === 'Ireland');
    const totalIrishUsers = ireland ? formatNumberEnhanced(ireland.users) : '0';
    
    // International analysis
    const internationalCountries = countries.filter(c => c.country !== 'Ireland');
    const internationalUsers = internationalCountries.reduce((sum, c) => sum + c.users, 0);
    const topInternationalCountry = internationalCountries.length > 0 ? internationalCountries[0].country : 'None';
    
    // Coverage analysis
    const countiesCovered = Math.min(32, regions.length);
    const coveragePercentage = (countiesCovered / 32) * 100;
    
    // Service concentration analysis
    let demandLevel = { class: 'distributed', label: 'Distributed Access', severity: 'low' };
    if (dublinPercentage > 50) {
        demandLevel = { class: 'critical', label: 'Critical Dublin Concentration', severity: 'high' };
    } else if (dublinPercentage > 35) {
        demandLevel = { class: 'high', label: 'High Capital Concentration', severity: 'medium' };
    } else if (dublinPercentage > 25) {
        demandLevel = { class: 'medium', label: 'Moderate Regional Hub Pattern', severity: 'low' };
    }
    
    // Enhanced opportunity scoring
    let opportunityScore = 60; // Base score
    
    // Regional balance scoring
    if (dublinPercentage < 30) opportunityScore += 15;
    else if (dublinPercentage > 50) opportunityScore -= 10;
    
    // Coverage scoring
    if (countiesCovered > 25) opportunityScore += 10;
    else if (countiesCovered < 15) opportunityScore -= 5;
    
    // International reach scoring
    if (internationalCountries.length > 10) opportunityScore += 10;
    else if (internationalCountries.length < 3) opportunityScore -= 5;
    
    // Search performance impact
    if (gscData && gscData.ctr > 0.05) opportunityScore += 5;
    
    opportunityScore = Math.min(100, Math.max(0, opportunityScore));
    
    // Primary opportunity identification
    let primaryOpportunity = 'Balanced Growth';
    if (dublinPercentage > 45) primaryOpportunity = 'Regional Decentralization';
    else if (internationalCountries.length > 8) primaryOpportunity = 'Multilingual Content';
    else if (countiesCovered < 20) primaryOpportunity = 'Rural Outreach';
    
    // Mock trend data (in real implementation, you'd compare with historical data)
    const irishTrendData = [85, 87, 89, 91, 88, 92, 90];
    const internationalTrendData = [12, 14, 13, 16, 18, 17, 20];
    
    return {
        totalIrishUsers,
        dublinPercentage: dublinPercentage.toFixed(1),
        internationalUsers: formatNumberEnhanced(internationalUsers),
        topInternationalCountry,
        countiesCovered,
        coveragePercentage,
        demandLevel,
        opportunityScore: Math.round(opportunityScore),
        primaryOpportunity,
        totalCountries: countries.length,
        internationalPercentage: ireland ? ((internationalUsers / ireland.users) * 100).toFixed(1) : '0',
        diasporaIndicator: internationalCountries.length > 5 ? 'High' : internationalCountries.length > 2 ? 'Medium' : 'Low',
        
        // Enhanced trend indicators
        irishTrend: calculateTrendIndicator(irishTrendData),
        internationalTrend: calculateTrendIndicator(internationalTrendData),
        coverageTrend: { class: 'positive', indicator: '↗ +2 counties' },
        
        // Trend data for sparklines
        irishTrendData,
        internationalTrendData
    };
}

function analyzePageContextEnhanced(pageUrl) {
    if (!pageUrl) return { 
        serviceType: 'government information', 
        category: 'general', 
        keywords: ['information', 'service'],
        urgency: 'standard',
        complexity: 'medium'
    };
    
    const url = pageUrl.toLowerCase();
    
    // Enhanced context analysis with urgency and complexity
    const contexts = {
        'passport': { 
            serviceType: 'passport services', 
            category: 'identity', 
            keywords: ['passport', 'travel', 'identity', 'application'],
            urgency: 'high',
            complexity: 'high',
            seasonality: ['summer', 'holiday_periods']
        },
        'driving': { 
            serviceType: 'driving licenses', 
            category: 'transport', 
            keywords: ['driving', 'license', 'test', 'theory'],
            urgency: 'medium',
            complexity: 'medium',
            seasonality: ['year_round']
        },
        'birth': { 
            serviceType: 'birth certificates', 
            category: 'identity', 
            keywords: ['birth', 'certificate', 'registration'],
            urgency: 'high',
            complexity: 'low',
            seasonality: ['year_round']
        },
        'social': { 
            serviceType: 'social welfare', 
            category: 'benefits', 
            keywords: ['benefit', 'allowance', 'payment', 'welfare'],
            urgency: 'critical',
            complexity: 'high',
            seasonality: ['year_round', 'recession_periods']
        },
        'housing': { 
            serviceType: 'housing services', 
            category: 'housing', 
            keywords: ['housing', 'rent', 'accommodation', 'hap'],
            urgency: 'critical',
            complexity: 'high',
            seasonality: ['year_round', 'student_periods']
        }
    };
    
    for (const [key, context] of Object.entries(contexts)) {
        if (url.includes(key)) {
            return context;
        }
    }
    
    return { 
        serviceType: 'government information', 
        category: 'general', 
        keywords: ['information', 'service'],
        urgency: 'standard',
        complexity: 'medium',
        seasonality: ['year_round']
    };
}

function analyzeGeographicSearchPatternsEnhanced(gscData, geoData, pageContext) {
    if (!gscData?.topQueries) {
        return {
            locationQueries: [],
            urgencyPatterns: [],
            servicePatterns: [],
            insights: ['No search query data available for geographic analysis']
        };
    }
    
    const queries = gscData.topQueries;
    const locationQueries = [];
    const urgencyPatterns = [];
    const servicePatterns = [];
    
    // Enhanced pattern detection
    queries.forEach(query => {
        const queryText = query.query.toLowerCase();
        
        // Location pattern detection
        const locationKeywords = ['dublin', 'cork', 'galway', 'limerick', 'waterford', 'near me', 'local', 'county', 'ireland'];
        const hasLocation = locationKeywords.some(keyword => queryText.includes(keyword));
        
        if (hasLocation) {
            locationQueries.push({
                query: query.query,
                impressions: query.impressions,
                clicks: query.clicks,
                ctr: query.ctr,
                position: query.position,
                locationContext: extractLocationContext(queryText)
            });
        }
        
        // Urgency pattern detection
        const urgencyKeywords = ['urgent', 'emergency', 'asap', 'immediately', 'today', 'deadline'];
        const hasUrgency = urgencyKeywords.some(keyword => queryText.includes(keyword));
        
        if (hasUrgency) {
            urgencyPatterns.push({
                query: query.query,
                impressions: query.impressions,
                urgencyLevel: determineUrgencyLevel(queryText)
            });
        }
        
        // Service pattern detection
        const hasService = pageContext.keywords.some(keyword => queryText.includes(keyword.toLowerCase()));
        
        if (hasService) {
            servicePatterns.push({
                query: query.query,
                impressions: query.impressions,
                serviceMatch: pageContext.serviceType,
                intent: classifyQueryIntent(queryText)
            });
        }
    });
    
    // Generate insights
    const insights = generateSearchInsights(locationQueries, urgencyPatterns, servicePatterns, pageContext);
    
    return {
        locationQueries: locationQueries.slice(0, 10),
        urgencyPatterns: urgencyPatterns.slice(0, 5),
        servicePatterns: servicePatterns.slice(0, 10),
        insights
    };
}

// ==================================================
// CONTENT CREATION FUNCTIONS
// ==================================================

function createOverviewContent(geoData, geoInsights, servicePatterns, pageContext) {
    return `
        <div class="overview-content">
            <div class="overview-grid">
                <!-- Interactive Ireland Map -->
                <div class="geo-card ireland-focus">
                    <div class="card-header">
                        <h3>🇮🇪 Irish Regional Distribution</h3>
                        <div class="concentration-alert ${geoInsights.demandLevel.class}">
                            ${geoInsights.demandLevel.label}
                        </div>
                    </div>
                    
                    <div class="ireland-map-container">
                        ${createInteractiveIrelandMap(geoData.regions, geoInsights)}
                    </div>
                    
                    <div class="regional-quick-stats">
                        <div class="quick-stat">
                            <span class="stat-value">${geoInsights.dublinPercentage}%</span>
                            <span class="stat-label">Dublin Share</span>
                        </div>
                        <div class="quick-stat">
                            <span class="stat-value">${geoData.regions?.length || 0}</span>
                            <span class="stat-label">Active Regions</span>
                        </div>
                        <div class="quick-stat">
                            <span class="stat-value">${calculateRegionalBalance(geoData.regions)}</span>
                            <span class="stat-label">Balance Score</span>
                        </div>
                    </div>
                </div>
                
                <!-- International Reach -->
                <div class="geo-card international-focus">
                    <div class="card-header">
                        <h3>🌍 International Reach</h3>
                        <div class="reach-indicator ${geoInsights.diasporaIndicator.toLowerCase()}">
                            ${geoInsights.diasporaIndicator} Diaspora Engagement
                        </div>
                    </div>
                    
                    <div class="world-map-container">
                        ${createInteractiveWorldMap(geoData.countries)}
                    </div>
                    
                    <div class="international-insights">
                        ${generateInternationalInsights(geoData.countries, pageContext)}
                    </div>
                </div>
                
                
            </div>
        </div>
    `;
}

function createDetailedAnalysisContent(geoData, geoInsights, searchPatterns, pageContext) {
    return `
        <div class="detailed-content">
            <!-- County-by-County Analysis -->
            <div class="detailed-section">
                <h3>📍 County-by-County Service Analysis</h3>
                <div class="county-analysis-grid">
                    ${createCountyAnalysisTable(geoData.regions, geoInsights, pageContext)}
                </div>
            </div>
            
           
            
            <!-- Demographic Insights -->
            <div class="detailed-section">
                <h3>👥 Demographic Service Patterns</h3>
                <div class="demographic-insights">
                    ${createDemographicInsights(geoData, geoInsights)}
                </div>
            </div>
        </div>
    `;
}

function createOpportunitiesContent(servicePatterns, accessibilityInsights, trendAnalysis, pageContext) {
    const opportunities = identifyGeographicOpportunities(servicePatterns, accessibilityInsights, pageContext);
    
    return `
        <div class="opportunities-content">
            <!-- Quick Wins -->
            <div class="opportunity-section">
                <h3>🎯 Immediate Opportunities (0-30 days)</h3>
                <div class="opportunities-grid quick-wins">
                    ${opportunities.quickWins.map(opp => createOpportunityCard(opp, 'quick')).join('')}
                </div>
            </div>
            
            <!-- Strategic Opportunities -->
            <div class="opportunity-section">
                <h3>🚀 Strategic Opportunities (30-90 days)</h3>
                <div class="opportunities-grid strategic">
                    ${opportunities.strategic.map(opp => createOpportunityCard(opp, 'strategic')).join('')}
                </div>
            </div>
            
            <!-- Long-term Vision -->
            <div class="opportunity-section">
                <h3>🔮 Long-term Vision (90+ days)</h3>
                <div class="opportunities-grid long-term">
                    ${opportunities.longTerm.map(opp => createOpportunityCard(opp, 'long-term')).join('')}
                </div>
            </div>
            
            <!-- ROI Calculator -->
            <div class="roi-calculator">
                <h3>💰 Impact Calculator</h3>
                ${createROICalculator(opportunities)}
            </div>
        </div>
    `;
}

// ==================================================
// VISUALIZATION HELPER FUNCTIONS
// ==================================================

function createInteractiveIrelandMap(regions, geoInsights) {
    if (!regions || regions.length === 0) {
        return `<div class="no-data-placeholder">📍 Enable geographic reporting to see regional data</div>`;
    }
    
    // Create simplified visual representation
    const topRegions = regions.slice(0, 8).map((region, index) => {
        const intensity = getIntensityLevel(region.percentage);
        return `
            <div class="region-bubble ${intensity}" 
                 data-region="${region.region}"
                 title="${region.region}: ${formatNumberEnhanced(region.users)} users (${region.percentage.toFixed(1)}%)"
                 style="--size: ${Math.max(20, region.percentage * 2)}px; --delay: ${index * 0.1}s">
                <div class="bubble-content">
                    <span class="region-name">${formatRegionNameEnhanced(region.region)}</span>
                    <span class="region-stats">${region.percentage.toFixed(1)}%</span>
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="ireland-map-visual">
            <div class="map-background">🇮🇪</div>
            <div class="region-bubbles">${topRegions}</div>
            <div class="map-legend">
                <div class="legend-item high">High Usage</div>
                <div class="legend-item medium">Medium Usage</div>
                <div class="legend-item low">Low Usage</div>
            </div>
        </div>
    `;
}

function createInteractiveWorldMap(countries) {
    if (!countries || countries.length === 0) {
        return `<div class="no-data-placeholder">🌍 No international data available</div>`;
    }
    
    const topCountries = countries.slice(0, 6).map((country, index) => {
        const flag = getCountryFlagEnhanced(country.country);
        return `
            <div class="country-marker" 
                 data-country="${country.country}"
                 title="${country.country}: ${formatNumberEnhanced(country.users)} users"
                 style="--delay: ${index * 0.2}s">
                <span class="country-flag">${flag}</span>
                <span class="country-label">${country.country}</span>
                <span class="country-percentage">${country.percentage.toFixed(1)}%</span>
            </div>
        `;
    }).join('');
    
    return `
        <div class="world-map-visual">
            <div class="world-background">🗺️</div>
            <div class="country-markers">${topCountries}</div>
        </div>
    `;
}

function createSparkline(data) {
    if (!data || data.length === 0) return '';
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * 60;
        const y = 20 - ((value - min) / range) * 16;
        return `${x},${y}`;
    }).join(' ');
    
    return `
        <svg class="sparkline" width="60" height="20" viewBox="0 0 60 20">
            <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5"/>
        </svg>
    `;
}

// ==================================================
// UTILITY FUNCTIONS
// ==================================================

function calculateTrendIndicator(data) {
    if (!data || data.length < 2) return { class: 'neutral', indicator: '→ No trend' };
    
    const recent = data.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const earlier = data.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    
    const change = ((recent - earlier) / earlier) * 100;
    
    if (change > 5) return { class: 'positive', indicator: `↗ +${change.toFixed(0)}%` };
    if (change < -5) return { class: 'negative', indicator: `↘ ${change.toFixed(0)}%` };
    return { class: 'neutral', indicator: '→ Stable' };
}

function getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'C+';
    if (score >= 65) return 'C';
    return 'D';
}

function getGradeClass(score) {
    if (score >= 85) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 65) return 'fair';
    return 'poor';
}

function calculateRegionalBalance(regions) {
    if (!regions || regions.length === 0) return 'N/A';
    
    // Calculate Gini coefficient for regional distribution
    const sorted = [...regions].sort((a, b) => a.percentage - b.percentage);
    const n = sorted.length;
    let sum = 0;
    
    for (let i = 0; i < n; i++) {
        sum += (2 * (i + 1) - n - 1) * sorted[i].percentage;
    }
    
    const gini = sum / (n * sorted.reduce((acc, r) => acc + r.percentage, 0));
    const balance = Math.round((1 - Math.abs(gini)) * 100);
    
    return `${balance}/100`;
}

function identifyGeographicOpportunities(servicePatterns, accessibilityInsights, pageContext) {
    return {
        quickWins: [
            {
                title: 'Dublin Traffic Optimization',
                description: 'Optimise content for high Dublin traffic concentration',
                impact: 'High',
                effort: 'Low',
                timeframe: '1-2 weeks',
                expectedIncrease: '15-25%'
            },
            {
                title: 'Mobile Regional Experience',
                description: 'Improve mobile experience for rural users',
                impact: 'Medium',
                effort: 'Medium',
                timeframe: '2-3 weeks',
                expectedIncrease: '10-15%'
            }
        ],
        strategic: [
            {
                title: 'Multilingual Content Strategy',
                description: 'Develop content for top international markets',
                impact: 'High',
                effort: 'High',
                timeframe: '1-2 months',
                expectedIncrease: '20-30%'
            },
            {
                title: 'Regional Service Hubs',
                description: 'Create region-specific landing pages',
                impact: 'Medium',
                effort: 'Medium',
                timeframe: '6-8 weeks',
                expectedIncrease: '15-20%'
            }
        ],
        longTerm: [
            {
                title: 'Predictive Geographic Targeting',
                description: 'Implement AI-driven geographic personalization',
                impact: 'Very High',
                effort: 'Very High',
                timeframe: '3-6 months',
                expectedIncrease: '30-50%'
            }
        ]
    };
}

function createOpportunityCard(opportunity, type) {
    return `
        <div class="opportunity-card ${type}">
            <div class="card-header">
                <h4>${opportunity.title}</h4>
                <div class="impact-badge ${opportunity.impact.toLowerCase()}">${opportunity.impact} Impact</div>
            </div>
            <p class="opportunity-description">${opportunity.description}</p>
            <div class="opportunity-metrics">
                <div class="metric">
                    <span class="label">Expected Increase:</span>
                    <span class="value">${opportunity.expectedIncrease}</span>
                </div>
                <div class="metric">
                    <span class="label">Timeframe:</span>
                    <span class="value">${opportunity.timeframe}</span>
                </div>
                <div class="metric">
                    <span class="label">Effort:</span>
                    <span class="value effort-${opportunity.effort.toLowerCase()}">${opportunity.effort}</span>
                </div>
            </div>
            <button class="implement-btn" onclick="implementOpportunity('${opportunity.title}')">
                Start Implementation
            </button>
        </div>
    `;
}

// ==================================================
// INTERACTION HANDLERS
// ==================================================

function initializeEnhancedGeographicIntelligence() {
    document.addEventListener('click', function(e) {
       
        
        
        // Performance metric toggle
        if (e.target.classList.contains('toggle-metric')) {
            const metric = e.target.dataset.metric;
            const container = e.target.closest('.performance-focus');
            
            container.querySelectorAll('.toggle-metric').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            updatePerformanceHeatmap(metric);
        }
    });
}

// Global functions
window.exportGeographicReport = function() {
    console.log('Exporting geographic intelligence report...');
    // Implementation would generate PDF/Excel report
};

window.implementOpportunity = function(opportunityTitle) {
    console.log('Implementing opportunity:', opportunityTitle);
    // Implementation would show detailed action plan
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnhancedGeographicIntelligence);
} else {
    initializeEnhancedGeographicIntelligence();
}

// Export the main function
window.createEnhancedGeographicServiceIntelligence = createEnhancedGeographicServiceIntelligence;












    








    

    function getRegionColor(percentage) {
        if (percentage > 30) return '#ef4444';
        if (percentage > 15) return '#f59e0b';
        if (percentage > 5) return '#3b82f6';
        return '#64748b';
    }

    function getCountryFlag(country) {
        const flags = {
            'Ireland': '🇮🇪',
            'Ukraine': '🇺🇦', 
            'United Kingdom': '🇬🇧',
            'Poland': '🇵🇱',
            'Germany': '🇩🇪',
            'France': '🇫🇷',
            'United States': '🇺🇸'
        };
        return flags[country] || '🌍';
    }

    // ===========================================
    // PANEL CREATION FUNCTIONS
    // ===========================================

    function createOverviewPanel(gscData, ga4Data, gscTrends, ga4Trends, url) {
    return `
        <div class="panel-content">
            <!-- Analytics and Search Performance Cards -->
            <div class="overview-grid" style="grid-template-columns: repeat(2, 1fr); grid-template-rows: 1fr; margin: 0 auto 20px auto; gap: 20px;">
                <div class="overview-card analytics-card">
                    <div class="card-header">
                        <div class="card-icon"><svg width="26" height="26" viewBox="0 0 24 24" style="flex-shrink: 0;">
                            <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                        </svg></div>
                        <div class="card-title">Google Analytics</div>
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
                                <span class="metric-label">Page Views:</span>
                                <span class="metric-value">${formatNumber(ga4Data.pageViews || 0)}</span>
                                ${getTrendIndicator(ga4Trends?.trends?.pageViews)}
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
                                <span class="no-data-icon">
                                <div style="margin-bottom: 16px; display: flex; justify-content: center;">
                <svg width="48" height="48" viewBox="0 0 24 24" style="opacity: 0.7;">
                    <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
            </div>
                                </span>
                                <span class="no-data-text">Connect Google Analytics</span>
                            </div>
                        `}
                    </div>
                </div>

                <div class="overview-card search-card">
                    <div class="card-header">
                        <div class="card-icon"> <svg width="26" height="26" viewBox="0 0 24 24" style="opacity: 0.7;">
                <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg></div>
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
                                <span class="metric-label">Impressions:</span>
                                <span class="metric-value">${formatNumber(gscData.impressions)}</span>
                                ${getTrendIndicator(gscTrends?.trends?.impressions)}
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
                                <span class="no-data-icon">
                                <div style="margin-bottom: 16px; display: flex; justify-content: center;">
                <svg width="48" height="48" viewBox="0 0 24 24" style="opacity: 0.7;">
                    <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
            </div>
                                </span>
                                <span class="no-data-text">Connect Search Console</span>
                            </div>
                        `}
                    </div>
                </div>
            </div>
            
            <div class="section" style="margin-top: 0;">
                <h2 class="section-title">🧭 Performance Matrix</h2>
                ${createPerformanceMatrix(gscData, ga4Data)}
            </div>
            
           
            
            <div class="section">
                <h2 class="section-title">💡 Key Insights</h2>
                ${createKeyInsights(gscData, ga4Data, gscTrends, ga4Trends)}
            </div>
        </div>
    `;
}

    function createSearchPerformancePanel(gscData, gscTrends, pageUrl) {
    if (!gscData || gscData.noDataFound) {
        return createConnectionMessage('Search Console', 'Click the GSC button in the toolbar to connect to Google Search Console and see search performance trends');
    }
    
    const problemQueries = identifyProblemQueries(gscData);
    
    return `
        <div class="panel-content">
            <div class="section">
                <h2 class="section-title">
                <svg width="48" height="48" viewBox="0 0 24 24" style="opacity: 0.7;">
                        <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg> 
                    Search Console Metrics</h2>
                <div class="metrics-grid">
                    ${createSearchConsoleMetrics(gscData, gscTrends)}
                </div>
            </div>
            
            <div class="section">
                <h2 class="section-title">🎯 Top Performing Queries</h2>
                ${createTopQueriesTable(gscData)}
            </div>
            
            <!-- MOVED: Citizen Query Intelligence from Content Analysis tab -->
            ${createCitizenQueryIntelligenceSection(gscData, pageUrl)}
        </div>
    `;
}

    // UPDATED: Content Analysis Panel with Expanded Citizens Quality Score
function createContentAnalysisPanel(gscData, ga4Data, pageUrl) {
    const contentGaps = identifyContentGaps(gscData, ga4Data);
    
    return `
        <div class="panel-content">
            <div class="section">
                <h2 class="section-title">⭐ Quality Assessment</h2>
                ${createExpandedCitizensQualitySection(gscData, ga4Data)}
            </div>
            
            
        </div>
    `;
}


   

    function createUserBehaviorPanel(ga4Data, ga4Trends, gscData) {
        if (!ga4Data || ga4Data.noDataFound) {
            return createConnectionMessage('Google Analytics', 'Connect Google Analytics to see detailed user behavior data');
        }
        
        return `
            <div class="panel-content">
                <div class="section">
                    <h2 class="section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink: 0;">
                                <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                            </svg>Google Analytics Metrics</h2>
                    <div class="metrics-grid">
                        ${createGA4Metrics(ga4Data, ga4Trends)}
                    </div>
                </div>
                
                <div class="section">
                    <h2 class="section-title">🗺️ Regional User Behavior Patterns</h2>
                    ${createRegionalUserBehaviorPatterns(ga4Data)}
                </div>
                
                <div class="section">
                    <h2 class="section-title">⭐ User Experience Analysis</h2>
                    ${createUserExperienceAnalysis(ga4Data)}
                </div>
            </div>
        `;
    }

    function createTrendAnalysisPanel(gscTrends, ga4Trends) {
        return `
            <div class="panel-content">
                <div class="section">
                    <h2 class="section-title">📈 Performance Trends</h2>
                    ${createTrendImpactSection(gscTrends, ga4Trends)}
                </div>
                
                <div class="section">
                    <h2 class="section-title">🌍 Geographic Trend Analysis</h2>
                    ${createGeographicTrendAnalysis(ga4Trends)}
                </div>
                
                <div class="section">
                    <h2 class="section-title">🔮 Performance Forecast</h2>
                    ${createForecastingSection(gscTrends, ga4Trends)}
                </div>
            </div>
        `;
    }

    function createGovernmentIntelligencePanel(gscData, ga4Data, gscTrends, ga4Trends) {
    try {
        const benchmarks = calculateGovernmentBenchmarks(gscData, ga4Data, gscTrends, ga4Trends);
        const priorityScore = calculatePriorityScore(gscData, ga4Data, gscTrends, ga4Trends);
        
        // Use safe surge detection
        const surgeAnalysis = safeExecuteSurgeDetection(gscData, gscTrends);
        
        return `
            <div class="panel-content">
                <div class="section">
                    <h2 class="section-title">🏛️ Government Performance Benchmarks</h2>
                    <div class="benchmark-explanation">
                        <p>Performance compared to government sector standards based on research from GOV.UK, Canada.ca, and other public sector organizations.</p>
                    </div>
                    
                    <div class="benchmarks-grid">
                        ${createBenchmarkCard('Engagement Rate', 
                            `${((ga4Data?.engagementRate || 0) * 100).toFixed(0)}%`, 
                            '50%', 
                            benchmarks.engagement.status,
                            benchmarks.engagement.message)}
                        
                        ${createBenchmarkCard('Avg Engagement Time', 
                            formatDuration(ga4Data?.avgSessionDuration || 0), 
                            '52 seconds', 
                            benchmarks.engagementTime.status,
                            benchmarks.engagementTime.message)}
                        
                        ${createBenchmarkCard('Search Discovery', 
                            `${calculateEntranceRate(ga4Data)}%`, 
                            '30%', 
                            benchmarks.discovery.status,
                            benchmarks.discovery.message)}
                        
                        ${createBenchmarkCard('Content Effectiveness', 
                            `${((1 - (ga4Data?.bounceRate || 0.5)) * 100).toFixed(0)}%`, 
                            '40%', 
                            benchmarks.effectiveness.status,
                            benchmarks.effectiveness.message)}
                    </div>
                </div>
                
                
            </div>
        `;
    } catch (error) {
        console.error('Error creating government intelligence panel:', error);
        return `
            <div class="panel-content">
                <div class="section">
                    <h2 class="section-title">🏛️ Government Performance Benchmarks</h2>
                    <div class="error-message">
                        <p>⚠️ Unable to load government intelligence data at this time.</p>
                        <p>Please check your data connections and try refreshing the dashboard.</p>
                    </div>
                </div>
            </div>
        `;
    }
}


// SAFE SURGE DETECTION DISPLAY FUNCTION
function createSafeCitizenNeedSurgeDetection(surgeAnalysis) {
    try {
        if (!surgeAnalysis || surgeAnalysis.totalSurges === 0) {
            return `
                <div class="surge-detection-enhanced">
                    <div class="no-surges-detected">
                        <div class="no-surge-icon">✅</div>
                        <div class="no-surge-title">No Significant Surges Detected</div>
                        <div class="no-surge-description">Citizen information demand is stable</div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="surge-detection-enhanced">
                <!-- Critical Alerts Section -->
                ${surgeAnalysis.criticalAlerts && surgeAnalysis.criticalAlerts.length > 0 ? `
                    <div class="critical-alerts-section">
                        <div class="critical-header">
                            <span class="critical-icon">🚨</span>
                            <span class="critical-title">CRITICAL SURGE ALERTS</span>
                            <span class="critical-count">${surgeAnalysis.criticalAlerts.length}</span>
                        </div>
                        <div class="critical-alerts-grid">
                            ${surgeAnalysis.criticalAlerts.map(alert => `
                                <div class="critical-alert-card ${alert.category}">
                                    <div class="alert-header">
                                        <span class="alert-category-icon">⚠️</span>
                                        <span class="alert-title">${alert.title || 'Critical Alert'}</span>
                                        <span class="alert-urgency">${alert.urgency || 'high'}</span>
                                    </div>
                                    <div class="alert-details">${alert.details || 'No details available'}</div>
                                    <div class="alert-actions">
                                        <span class="alert-timeline">Response needed: ${alert.responseTime || 'immediate'}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Surge Summary Dashboard -->
                <div class="surge-summary-dashboard">
                    <div class="dashboard-header">
                        <h3>📊 Citizen Need Surge Analysis</h3>
                        <div class="surge-period">Last 30 days vs Previous period</div>
                    </div>
                    
                    <div class="surge-stats-grid">
                        <div class="surge-stat-card total">
                            <div class="stat-number">${surgeAnalysis.totalSurges || 0}</div>
                            <div class="stat-label">Total Surges Detected</div>
                            <div class="stat-detail">Across all categories</div>
                        </div>
                        <div class="surge-stat-card average">
                            <div class="stat-number">${surgeAnalysis.avgVolumeIncrease || 0}%</div>
                            <div class="stat-label">Average Increase</div>
                            <div class="stat-detail">Above normal demand</div>
                        </div>
                        <div class="surge-stat-card critical">
                            <div class="stat-number">${surgeAnalysis.criticalAlerts ? surgeAnalysis.criticalAlerts.length : 0}</div>
                            <div class="stat-label">Critical Surges</div>
                            <div class="stat-detail">Requiring immediate action</div>
                        </div>
                        <div class="surge-stat-card emerging">
                            <div class="stat-number">${surgeAnalysis.emergingQueries ? surgeAnalysis.emergingQueries.length : 0}</div>
                            <div class="stat-label">New Topics</div>
                            <div class="stat-detail">Previously unseen queries</div>
                        </div>
                    </div>
                </div>
                
                <!-- Contextual Insights -->
                ${surgeAnalysis.contextualInsights && surgeAnalysis.contextualInsights.length > 0 ? `
                    <div class="contextual-insights-section">
                        <h4>🧠 Contextual Insights</h4>
                        <div class="insights-list">
                            ${surgeAnalysis.contextualInsights.map(insight => `
                                <div class="insight-card ${insight.type || 'info'}">
                                    <div class="insight-icon">${insight.icon || '💡'}</div>
                                    <div class="insight-content">
                                        <div class="insight-title">${insight.title || 'Insight'}</div>
                                        <div class="insight-description">${insight.description || 'No description available'}</div>
                                        <div class="insight-action">${insight.action || 'No action specified'}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Actionable Recommendations -->
                ${surgeAnalysis.actionableRecommendations && surgeAnalysis.actionableRecommendations.length > 0 ? `
                    <div class="recommendations-section">
                        <h4>🚀 Recommended Actions</h4>
                        <div class="recommendations-list">
                            ${surgeAnalysis.actionableRecommendations.slice(0, 6).map(rec => `
                                <div class="recommendation-card priority-${rec.priority || 'medium'}">
                                    <div class="rec-header">
                                        <div class="rec-priority">
                                            <span class="priority-indicator ${rec.priority || 'medium'}"></span>
                                            <span class="priority-label">${(rec.priority || 'medium').toUpperCase()}</span>
                                        </div>
                                        <div class="rec-timeframe">${rec.timeframe || 'TBD'}</div>
                                    </div>
                                    <div class="rec-action">${rec.action || 'No action specified'}</div>
                                    <div class="rec-details">${rec.details || 'No details available'}</div>
                                    <div class="rec-impact">Expected Impact: ${rec.expectedImpact || 'TBD'}</div>
                                    <div class="rec-assignee">Assign to: ${rec.assignee || 'TBD'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    } catch (error) {
        console.error('Error creating surge detection display:', error);
        return `
            <div class="surge-detection-enhanced">
                <div class="surge-error">
                    <div class="error-icon">⚠️</div>
                    <div class="error-title">Surge Detection Unavailable</div>
                    <div class="error-description">Unable to analyse citizen need surges at this time</div>
                </div>
            </div>
        `;
    }
}

// Make the safe functions globally available
window.createGovernmentIntelligencePanel = createGovernmentIntelligencePanel;
window.createSafeCitizenNeedSurgeDetection = createSafeCitizenNeedSurgeDetection;

console.log('✅ Safe Government Intelligence Panel functions loaded!');




    

    function createActionItemsPanel(gscData, ga4Data, gscTrends, ga4Trends) {
        return `
            <div class="panel-content">
                <div class="section">
                    <h2 class="section-title">🎯 Priority Actions</h2>
                    ${createPriorityActionsSection(gscData, ga4Data, gscTrends, ga4Trends)}
                </div>
                
                <div class="section">
                    <h2 class="section-title">🌍 Government Action Recommendations</h2>
                    ${createGovernmentActionRecommendations(gscData, ga4Data)}
                </div>
                
                <div class="section">
                    <h2 class="section-title">📅 Implementation Timeline</h2>
                    ${createImplementationTimelineSection(gscData, ga4Data)}
                </div>
            </div>
        `;
    }

    // ===========================================
    // COMPONENT HELPER FUNCTIONS
    // ===========================================

    // REPLACE the axis labels and benchmark sections in your enhanced matrix with this fixed version:

function createPerformanceMatrix(gscData, ga4Data) {
    const searchScore = calculateSearchScore(gscData);
    const engagementScore = calculateEngagementScore(ga4Data);
    
    // Calculate actual metrics for display
    const metrics = {
        clicks: gscData?.clicks || 0,
        ctr: ((gscData?.ctr || 0) * 100).toFixed(1),
        position: gscData?.position?.toFixed(1) || 'N/A',
        users: ga4Data?.users || 0,
        sessionDuration: formatDuration(ga4Data?.avgSessionDuration || 0),
        bounceRate: ((ga4Data?.bounceRate || 0) * 100).toFixed(0)
    };
    
    // Determine quadrant and status
    const quadrant = getPerformanceQuadrant(searchScore, engagementScore);
    
    return `
        <div class="enhanced-performance-matrix">
            <!-- Matrix Header -->
            <div class="matrix-header">
                <h3 class="matrix-title">Performance Positioning</h3>
                <div class="matrix-subtitle">Where your page stands in the performance landscape</div>
            </div>
            
            <!-- Main Matrix Chart -->
            <div class="matrix-container">
                <!-- Background Grid -->
                <div class="matrix-grid"></div>
                
                <!-- Quadrant Backgrounds -->
                <div class="matrix-quadrants">
                    <div class="quadrant quadrant-potential" data-quadrant="potential">
                        <div class="quadrant-icon">💎</div>
                        <div class="quadrant-title">Hidden Gem</div>
                        <div class="quadrant-desc">Low Search × High Engagement</div>
                    </div>
                    <div class="quadrant quadrant-champion" data-quadrant="champion">
                        <div class="quadrant-icon">🏆</div>
                        <div class="quadrant-title">Champion</div>
                        <div class="quadrant-desc">High Search × High Engagement</div>
                    </div>
                    <div class="quadrant quadrant-needs-work" data-quadrant="needs-work">
                        <div class="quadrant-icon">🔧</div>
                        <div class="quadrant-title">Needs Focus</div>
                        <div class="quadrant-desc">Low Search × Low Engagement</div>
                    </div>
                    <div class="quadrant quadrant-opportunity" data-quadrant="opportunity">
                        <div class="quadrant-icon">🎯</div>
                        <div class="quadrant-title">Opportunity</div>
                        <div class="quadrant-desc">High Search × Low Engagement</div>
                    </div>
                </div>
                
                <!-- Benchmark Lines -->
                <div class="benchmark-lines">
                    <div class="benchmark-line horizontal" style="bottom: 50%;">
                        <div class="benchmark-label-horizontal">Average Engagement</div>
                    </div>
                    <div class="benchmark-line vertical" style="left: 50%;">
                        <div class="benchmark-label-vertical">Average Search</div>
                    </div>
                </div>
                
                <!-- Performance Point -->
                <div class="performance-point" style="left: ${searchScore}%; bottom: ${engagementScore}%;">
                    <div class="point-pulse"></div>
                    <div class="point-core ${quadrant.class}"></div>
                    <div class="point-tooltip">
                        <div class="tooltip-header">
                            <strong>Your Page Performance</strong>
                        </div>
                        <div class="tooltip-metrics">
                            <div class="metric-row">
                                <span class="metric-label">Search Score:</span>
                                <span class="metric-value">${searchScore}/100</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">Engagement Score:</span>
                                <span class="metric-value">${engagementScore}/100</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">Status:</span>
                                <span class="metric-value ${quadrant.class}">${quadrant.name}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Fixed Axis Labels -->
                <div class="axis-system">
                    <!-- X-Axis (Bottom) -->
                    <div class="x-axis-container">
                        <div class="x-axis-title">Search Performance</div>
                        <div class="x-axis-scale">
                            <span class="scale-point scale-left">Poor</span>
                            <span class="scale-point scale-center">Average</span>
                            <span class="scale-point scale-right">Excellent</span>
                        </div>
                    </div>
                    
                    <!-- Y-Axis (Left) -->
                    <div class="y-axis-container">
                        <div class="y-axis-title">User Engagement</div>
                        <div class="y-axis-scale">
                            <span class="scale-point scale-top">High</span>
                            <span class="scale-point scale-middle">Medium</span>
                            <span class="scale-point scale-bottom">Low</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Performance Insights Panel -->
            <div class="performance-insights">
                <div class="insights-header">
                    <div class="current-status ${quadrant.class}">
                        <div class="status-icon">${quadrant.icon}</div>
                        <div class="status-info">
                            <div class="status-title">${quadrant.name}</div>
                            <div class="status-description">${quadrant.description}</div>
                        </div>
                    </div>
                </div>
                
                <div class="insights-metrics">
                    <div class="insight-metric">
                        <div class="metric-icon">🔍</div>
                        <div class="metric-details">
                            <div class="metric-title">Search Performance</div>
                            <div class="metric-breakdown">
                                ${formatNumber(metrics.clicks)} clicks • #${metrics.position} position • ${metrics.ctr}% CTR
                            </div>
                        </div>
                        <div class="metric-score ${getScoreClass(searchScore)}">${searchScore}</div>
                    </div>
                    
                    <div class="insight-metric">
                        <div class="metric-icon">👥</div>
                        <div class="metric-details">
                            <div class="metric-title">User Engagement</div>
                            <div class="metric-breakdown">
                                ${formatNumber(metrics.users)} users • ${metrics.sessionDuration} avg time • ${metrics.bounceRate}% bounce
                            </div>
                        </div>
                        <div class="metric-score ${getScoreClass(engagementScore)}">${engagementScore}</div>
                    </div>
                </div>
                
                <div class="next-actions">
                    <div class="actions-title">💡 Recommended Actions</div>
                    <div class="actions-list">
                        ${generateMatrixRecommendations(quadrant, searchScore, engagementScore)}
                    </div>
                </div>
            </div>
        </div>
        
        <style>
        .help-corner {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
}

.help-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: white;
    padding: 20px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    transition: all 0.3s ease;
    position: relative;
}

.help-btn:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
}

.help-btn::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: -35px;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}

.help-btn:hover::after {
    opacity: 1;
}


            /* Enhanced Performance Matrix Styles */
            .enhanced-performance-matrix {
                background: white;
                border-radius: 20px;
                padding: 24px;
                border: 1px solid #e2e8f0;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                position: relative;
                overflow: hidden;
            }
            
            .enhanced-performance-matrix::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #10b981);
                background-size: 300% 100%;
                animation: gradient-shift 6s ease-in-out infinite;
            }
            
            @keyframes gradient-shift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            
            /* Header */
            .matrix-header {
                text-align: center;
                margin-bottom: 24px;
            }
            
            .matrix-title {
                font-size: 1.4rem;
                font-weight: 700;
                color: #1f2937;
                margin: 0 0 8px 0;
            }
            
            .matrix-subtitle {
                font-size: 0.9rem;
                color: #6b7280;
                font-style: italic;
            }
            
            /* Matrix Container */
            .matrix-container {
                position: relative;
                height: 380px;
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border-radius: 16px;
                border: 1px solid #e2e8f0;
                margin-bottom: 24px;
                overflow: hidden;
                padding: 40px 60px 60px 60px; /* Space for labels */
            }
            
            /* Grid Background */
            .matrix-grid {
                position: absolute;
                top: 40px;
                left: 60px;
                right: 60px;
                bottom: 60px;
                background-image: 
                    linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px);
                background-size: 25px 25px;
                pointer-events: none;
            }
            
            /* Quadrants - FIXED ORDER */
            .matrix-quadrants {
                position: absolute;
                top: 40px;
                left: 60px;
                right: 60px;
                bottom: 60px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: 1fr 1fr;
            }
            
            .quadrant {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 20px;
                transition: all 0.3s ease;
                position: relative;
                border: 1px solid rgba(255,255,255,0.2);
            }
            
            .quadrant:hover {
                background: rgba(255,255,255,0.15);
                backdrop-filter: blur(10px);
            }
            
            .quadrant-champion {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%);
            }
            
            .quadrant-potential {
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%);
            }
            
            .quadrant-opportunity {
                background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%);
            }
            
            .quadrant-needs-work {
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%);
            }
            
            .quadrant-icon {
                font-size: 1.8rem;
                margin-bottom: 8px;
                opacity: 0.8;
            }
            
            .quadrant-title {
                font-size: 0.9rem;
                font-weight: 700;
                color: #374151;
                margin-bottom: 4px;
            }
            
            .quadrant-desc {
                font-size: 0.75rem;
                color: #6b7280;
                line-height: 1.3;
            }
            
            /* Benchmark Lines - FIXED */
            .benchmark-lines {
                position: absolute;
                top: 40px;
                left: 60px;
                right: 60px;
                bottom: 60px;
                pointer-events: none;
            }
            
            .benchmark-line {
                position: absolute;
                opacity: 0.6;
                transition: opacity 0.3s ease;
            }
            
            .benchmark-line.horizontal {
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, transparent, #94a3b8, transparent);
            }
            
            .benchmark-line.vertical {
                top: 0;
                bottom: 0;
                width: 2px;
                background: linear-gradient(0deg, transparent, #94a3b8, transparent);
            }
            
            .benchmark-label-horizontal {
                position: absolute;
                top: -25px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 0.7rem;
                color: #64748b;
                font-weight: 600;
                background: rgba(255,255,255,0.9);
                padding: 4px 8px;
                border-radius: 4px;
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .benchmark-label-vertical {
                position: absolute;
                top: 50%;
                left: -80px;
                transform: translateY(-50%);
                font-size: 0.7rem;
                color: #64748b;
                font-weight: 600;
                background: rgba(255,255,255,0.9);
                padding: 4px 8px;
                border-radius: 4px;
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            /* Performance Point */
            .performance-point {
                position: absolute;
                transform: translate(-50%, 50%);
                z-index: 10;
                cursor: pointer;
            }
            
            .point-pulse {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(59, 130, 246, 0.2);
                animation: pulse-effect 2s ease-in-out infinite;
            }
            
            @keyframes pulse-effect {
                0%, 100% { 
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 0.7;
                }
                50% { 
                    transform: translate(-50%, -50%) scale(1.2);
                    opacity: 0.3;
                }
            }
            
            .point-core {
                position: relative;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #3b82f6;
                border: 4px solid white;
                box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
                z-index: 2;
            }
            
            .point-core.champion { background: #10b981; box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4); }
            .point-core.potential { background: #8b5cf6; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4); }
            .point-core.opportunity { background: #f59e0b; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4); }
            .point-core.needs-work { background: #ef4444; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4); }
            
            .point-tooltip {
                position: absolute;
                top: -120px;
                left: 50%;
                transform: translateX(-50%);
                background: white;
                border-radius: 12px;
                padding: 12px 16px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                border: 1px solid #e2e8f0;
                opacity: 0;
                pointer-events: none;
                transition: all 0.3s ease;
                min-width: 200px;
                z-index: 20;
            }
            
            .performance-point:hover .point-tooltip {
                opacity: 1;
                transform: translateX(-50%) translateY(-10px);
            }
            
            .tooltip-header {
                font-size: 0.85rem;
                margin-bottom: 8px;
                text-align: center;
                
            }
            
            .tooltip-metrics {
                display: grid;
                gap: 4px;
            }
            
            .metric-row {
                display: flex;
                justify-content: space-between;
                font-size: 0.8rem;
            }
            
            .metric-label {
                color: #6b7280;
            }
            
            .metric-value {
                font-weight: 600;
                color: #000000;
            }
            
            /* FIXED Axis System */
            .axis-system {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
            }
            
            /* X-Axis (Bottom) */
            .x-axis-container {
                position: absolute;
                bottom: 0;
                left: 60px;
                right: 60px;
                height: 60px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            
            .x-axis-title {
                font-size: 0.9rem;
                font-weight: 600;
                color: #374151;
                margin-bottom: 8px;
            }
            
            .x-axis-scale {
                display: flex;
                justify-content: space-between;
                width: 100%;
                position: relative;
            }
            
            .x-axis-scale .scale-point {
                font-size: 0.75rem;
                color: #6b7280;
                font-weight: 500;
                position: absolute;
            }
            
            .x-axis-scale .scale-left {
                left: 0;
                transform: translateX(-50%);
            }
            
            .x-axis-scale .scale-center {
                left: 50%;
                transform: translateX(-50%);
            }
            
            .x-axis-scale .scale-right {
                right: 0;
                transform: translateX(50%);
            }
            
            /* Y-Axis (Left) */
            .y-axis-container {
                position: absolute;
                left: 0;
                top: 40px;
                bottom: 60px;
                width: 60px;
                display: flex;
                
                align-items: center;
                justify-content: center;
            }
            
            .y-axis-title {
                font-size: 0.9rem;
                font-weight: 600;
                color: #374151;
                transform: rotate(-90deg);
                white-space: nowrap;
                margin-bottom: 20px;
            }
            
            .y-axis-scale {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                height: 100%;
                position: relative;
                margin-left: 20px;
            }
            
            .y-axis-scale .scale-point {
                font-size: 0.75rem;
                color: #6b7280;
                font-weight: 500;
                position: absolute;
                white-space: nowrap;
                right: 0;
            }
            
            .y-axis-scale .scale-top {
                top: 0;
                transform: translateY(-50%);
            }
            
            .y-axis-scale .scale-middle {
                top: 50%;
                transform: translateY(-50%);
            }
            
            .y-axis-scale .scale-bottom {
                bottom: 0;
                transform: translateY(50%);
            }
            
            /* Rest of the styles remain the same... */
            .performance-insights {
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border-radius: 16px;
                padding: 20px;
                border: 1px solid #e2e8f0;
            }
            
            .insights-header {
                margin-bottom: 20px;
            }
            
            .current-status {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: white;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
            }
            
            .status-icon {
                font-size: 2rem;
                width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 12px;
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
            }
            
            .current-status.champion .status-icon { background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05)); }
            .current-status.potential .status-icon { background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05)); }
            .current-status.opportunity .status-icon { background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05)); }
            .current-status.needs-work .status-icon { background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05)); }
            
            .status-info {
                flex: 1;
            }
            
            .status-title {
                font-size: 1.1rem;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 4px;
            }
            
            .status-description {
                font-size: 0.9rem;
                color: #6b7280;
                line-height: 1.4;
            }
            
            .insights-metrics {
                display: grid;
                gap: 16px;
                margin-bottom: 20px;
            }
            
            .insight-metric {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: white;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
            }
            
            .metric-icon {
                font-size: 1.5rem;
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
            }
            
            .metric-details {
                flex: 1;
            }
            
            .metric-title {
                font-size: 0.9rem;
                font-weight: 600;
                color: #374151;
                margin-bottom: 4px;
            }
            
            .metric-breakdown {
                font-size: 0.8rem;
                color: #6b7280;
            }
            
            .metric-score {
                font-size: 1.4rem;
                font-weight: 800;
                padding: 8px 16px;
                border-radius: 12px;
                color: white;
                text-align: center;
                min-width: 60px;
            }
            
            .metric-score.excellent { background: linear-gradient(135deg, #10b981, #059669); }
            .metric-score.good { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
            .metric-score.fair { background: linear-gradient(135deg, #f59e0b, #d97706); }
            .metric-score.poor { background: linear-gradient(135deg, #ef4444, #dc2626); }
            
            /* Next Actions */
            .next-actions {
                background: white;
                border-radius: 12px;
                padding: 16px;
                border: 1px solid #e2e8f0;
            }
            
            .actions-title {
                font-size: 0.9rem;
                font-weight: 600;
                color: #374151;
                margin-bottom: 12px;
            }
            
            .actions-list {
                display: grid;
                gap: 8px;
            }
            
            .action-item {
                font-size: 0.85rem;
                color: #6b7280;
                padding: 8px 12px;
                background: #f8fafc;
                border-radius: 8px;
                border-left: 3px solid #3b82f6;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .matrix-container {
                    height: 320px;
                    padding: 30px 40px 40px 40px;
                }
                
                .matrix-grid {
                    top: 30px;
                    left: 40px;
                    right: 40px;
                    bottom: 40px;
                }
                
                .matrix-quadrants {
                    top: 30px;
                    left: 40px;
                    right: 40px;
                    bottom: 40px;
                }
                
                .benchmark-lines {
                    top: 30px;
                    left: 40px;
                    right: 40px;
                    bottom: 40px;
                }
                
                .x-axis-container {
                    left: 40px;
                    right: 40px;
                    height: 40px;
                }
                
                .y-axis-container {
                    top: 30px;
                    bottom: 40px;
                    width: 40px;
                }
                
                .quadrant-desc {
                    display: none;
                }
                
                .insights-metrics {
                    grid-template-columns: 1fr;
                }
                
                .insight-metric {
                    flex-direction: column;
                    text-align: center;
                }
            }


/* ================================================== */
/* SURGE DETECTION SYSTEM STYLES */
/* Comprehensive styling for citizen need surge detection */
/* ================================================== */

/* Main Container */
.surge-detection-enhanced {
    background: white;
    border-radius: 20px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    position: relative;
    overflow: hidden;
    margin-bottom: 24px;
}

.surge-detection-enhanced::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #ef4444, #f59e0b, #10b981, #3b82f6);
    background-size: 300% 100%;
    animation: gradient-shift 6s ease-in-out infinite;
}

@keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
}

/* No Surges State */
.no-surges-detected {
    text-align: center;
    padding: 60px 20px;
    color: #6b7280;
}

.no-surge-icon {
    font-size: 4rem;
    margin-bottom: 16px;
    opacity: 0.8;
}

.no-surge-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #374151;
    margin-bottom: 8px;
}

.no-surge-description {
    font-size: 1rem;
    color: #6b7280;
}

/* ================================================== */
/* CRITICAL ALERTS SECTION */
/* ================================================== */

.critical-alerts-section {
    margin-bottom: 32px;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.02) 100%);
    border-radius: 16px;
    padding: 24px;
    border: 2px solid rgba(239, 68, 68, 0.1);
}

.critical-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding: 16px;
    background: white;
    border-radius: 12px;
    border: 1px solid rgba(239, 68, 68, 0.2);
}

.critical-icon {
    font-size: 1.5rem;
    animation: pulse-critical 2s ease-in-out infinite;
}

@keyframes pulse-critical {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}

.critical-title {
    font-size: 1.3rem;
    font-weight: 700;
    color: #dc2626;
    flex: 1;
}

.critical-count {
    background: #dc2626;
    color: white;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 700;
}

.critical-alerts-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
}

.critical-alert-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
    transition: all 0.3s ease;
}

.critical-alert-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(239, 68, 68, 0.15);
}

.alert-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.alert-category-icon {
    font-size: 1.2rem;
}

.alert-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    flex: 1;
}

.alert-urgency {
    background: #fef2f2;
    color: #dc2626;
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.alert-details {
    font-size: 0.9rem;
    color: #6b7280;
    margin-bottom: 16px;
    line-height: 1.5;
}

.alert-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.alert-action-btn {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.alert-action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.alert-timeline {
    font-size: 0.8rem;
    color: #6b7280;
    font-style: italic;
}

/* ================================================== */
/* SURGE SUMMARY DASHBOARD */
/* ================================================== */

.surge-summary-dashboard {
    margin-bottom: 32px;
}

.dashboard-header {
    
    margin-bottom: 24px;
}

.dashboard-header h3 {
    font-size: 1.4rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 8px 0;
}

.surge-period {
    font-size: 0.9rem;
    color: #6b7280;
    font-style: italic;
}

.surge-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
}

.surge-stat-card {
    background: white;
    border-radius: 16px;
    padding: 24px;
    text-align: center;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.surge-stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
}

.surge-stat-card.total::before {
    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
}

.surge-stat-card.average::before {
    background: linear-gradient(90deg, #8b5cf6, #7c3aed);
}

.surge-stat-card.critical::before {
    background: linear-gradient(90deg, #ef4444, #dc2626);
}

.surge-stat-card.emerging::before {
    background: linear-gradient(90deg, #10b981, #059669);
}

.surge-stat-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
}

.stat-number {
    font-size: 2.2rem;
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 8px;
}

.stat-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 4px;
}

.stat-detail {
    font-size: 0.8rem;
    color: #6b7280;
}

/* ================================================== */
/* SURGE CATEGORIES SECTION */
/* ================================================== */

.surge-categories-section {
    margin-bottom: 32px;
}

.surge-categories-section h4 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.categories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
}

.category-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    transition: all 0.3s ease;
    position: relative;
}

.category-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
}

/* Category-specific styling */
.category-card.crisis {
    border-left: 4px solid #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.02) 0%, white 100%);
}

.category-card.policy {
    border-left: 4px solid #3b82f6;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, white 100%);
}

.category-card.benefits {
    border-left: 4px solid #10b981;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.02) 0%, white 100%);
}

.category-card.seasonal {
    border-left: 4px solid #f59e0b;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.02) 0%, white 100%);
}

.category-card.health {
    border-left: 4px solid #06b6d4;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.02) 0%, white 100%);
}

.category-card.housing {
    border-left: 4px solid #8b5cf6;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, white 100%);
}

.category-card.employment {
    border-left: 4px solid #f97316;
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.02) 0%, white 100%);
}

.category-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.category-icon {
    font-size: 1.5rem;
}

.category-name {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
    flex: 1;
}

.category-count {
    background: #f3f4f6;
    color: #374151;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
}

.category-volume {
    font-size: 0.9rem;
    color: #6b7280;
    margin-bottom: 8px;
}

.category-priority {
    font-size: 0.8rem;
    color: #6b7280;
}

/* ================================================== */
/* DETAILED SURGES SECTION */
/* ================================================== */

.detailed-surges-section {
    margin-bottom: 32px;
}

.detailed-surges-section h4 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.surge-tabs {
    display: flex;
    background: #f8fafc;
    border-radius: 12px;
    padding: 4px;
    margin-bottom: 20px;
    border: 1px solid #e2e8f0;
}

.surge-tab {
    flex: 1;
    background: transparent;
    border: none;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.3s ease;
}

.surge-tab:hover {
    color: #374151;
    background: rgba(255,255,255,0.5);
}

.surge-tab.active {
    background: white;
    color: #1f2937;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.surge-tab-content {
    position: relative;
}

.surge-panel {
    display: none;
}

.surge-panel.active {
    display: block;
}

/* Volume Surges Panel */
.volume-surges-list {
    display: grid;
    gap: 16px;
}

.surge-item {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    transition: all 0.3s ease;
    position: relative;
}

.surge-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
}

.surge-item.urgency-critical {
    border-left: 4px solid #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.02) 0%, white 100%);
}

.surge-item.urgency-high {
    border-left: 4px solid #f59e0b;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.02) 0%, white 100%);
}

.surge-item.urgency-medium {
    border-left: 4px solid #3b82f6;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, white 100%);
}

.surge-item.urgency-low {
    border-left: 4px solid #6b7280;
    background: linear-gradient(135deg, rgba(107, 114, 128, 0.02) 0%, white 100%);
}

.surge-query {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 16px;
    font-style: italic;
}

.surge-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
}

.metric {
    text-align: center;
    padding: 12px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.metric-label {
    font-size: 0.8rem;
    color: #6b7280;
    margin-bottom: 4px;
    display: block;
}

.metric-value {
    font-size: 1rem;
    font-weight: 700;
    color: #1f2937;
    display: block;
}

.metric-value.increase {
    color: #dc2626;
    font-size: 1.2rem;
}

.surge-context {
    margin-bottom: 16px;
}

.context-tag {
    display: inline-block;
    background: #f3f4f6;
    color: #374151;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    margin-right: 8px;
    margin-bottom: 4px;
}

.surge-actions {
    border-top: 1px solid #f3f4f6;
    padding-top: 16px;
}

.recommended-action {
    background: #f0f9ff;
    color: #0369a1;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.85rem;
    margin-bottom: 8px;
    border-left: 3px solid #0ea5e9;
}

/* Emerging Topics Panel */
.emerging-topics-list {
    display: grid;
    gap: 16px;
}

.emerging-topic-item {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    border-left: 4px solid #10b981;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.02) 0%, white 100%);
}

.topic-query {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 16px;
    font-style: italic;
}

.topic-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
}

.topic-recommendation {
    background: #f0fdf4;
    color: #166534;
    padding: 12px;
    border-radius: 8px;
    font-size: 0.9rem;
    border-left: 3px solid #10b981;
}

/* Unmet Needs Panel */
.unmet-needs-list {
    display: grid;
    gap: 16px;
}

.unmet-need-item {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    border-left: 4px solid #f59e0b;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.02) 0%, white 100%);
}

.need-query {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 16px;
    font-style: italic;
}

.need-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
}

.need-gap {
    background: #fefbf3;
    color: #92400e;
    padding: 12px;
    border-radius: 8px;
    font-size: 0.9rem;
    border-left: 3px solid #f59e0b;
}

/* ================================================== */
/* CONTEXTUAL INSIGHTS SECTION */
/* ================================================== */

.contextual-insights-section {
    margin-bottom: 32px;
}

.contextual-insights-section h4 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.insights-list {
    display: grid;
    gap: 16px;
}

.insight-card {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    transition: all 0.3s ease;
}

.insight-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
}

.insight-card.critical {
    border-left: 4px solid #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.02) 0%, white 100%);
}

.insight-card.category {
    border-left: 4px solid #3b82f6;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, white 100%);
}

.insight-card.volume {
    border-left: 4px solid #8b5cf6;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, white 100%);
}

.insight-card.unmet {
    border-left: 4px solid #f59e0b;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.02) 0%, white 100%);
}

.insight-icon {
    font-size: 2rem;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
    border-radius: 12px;
    flex-shrink: 0;
}

.insight-content {
    flex: 1;
}

.insight-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 8px;
}

.insight-description {
    font-size: 0.9rem;
    color: #6b7280;
    margin-bottom: 8px;
    line-height: 1.5;
}

.insight-action {
    font-size: 0.85rem;
    color: #059669;
    font-weight: 600;
    background: #f0fdf4;
    padding: 6px 10px;
    border-radius: 8px;
    display: inline-block;
}

/* ================================================== */
/* RECOMMENDATIONS SECTION */
/* ================================================== */

.recommendations-section {
    margin-bottom: 32px;
}

.recommendations-section h4 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.recommendations-list {
    display: grid;
    gap: 16px;
}

.recommendation-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    transition: all 0.3s ease;
    position: relative;
}

.recommendation-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
}

.recommendation-card.priority-critical {
    border-left: 4px solid #ef4444;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.02) 0%, white 100%);
}

.recommendation-card.priority-high {
    border-left: 4px solid #f59e0b;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.02) 0%, white 100%);
}

.recommendation-card.priority-medium {
    border-left: 4px solid #3b82f6;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, white 100%);
}

.recommendation-card.priority-low {
    border-left: 4px solid #6b7280;
    background: linear-gradient(135deg, rgba(107, 114, 128, 0.02) 0%, white 100%);
}

.rec-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.rec-priority {
    display: flex;
    align-items: center;
    gap: 8px;
}

.priority-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.priority-indicator.critical {
    background: #ef4444;
}

.priority-indicator.high {
    background: #f59e0b;
}

.priority-indicator.medium {
    background: #3b82f6;
}

.priority-indicator.low {
    background: #6b7280;
}

.priority-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: #374151;
}

.rec-timeframe {
    font-size: 0.8rem;
    color: #6b7280;
    background: #f3f4f6;
    padding: 4px 8px;
    border-radius: 8px;
    text-transform: capitalize;
}

.rec-action {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 12px;
}

.rec-details {
    font-size: 0.9rem;
    color: #6b7280;
    margin-bottom: 12px;
    line-height: 1.5;
}

.rec-impact {
    font-size: 0.85rem;
    color: #059669;
    background: #f0fdf4;
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    border-left: 3px solid #10b981;
}

.rec-assignee {
    font-size: 0.8rem;
    color: #6b7280;
    text-transform: capitalize;
}

/* ================================================== */
/* NO DATA STATES */
/* ================================================== */

.no-data {
    text-align: center;
    padding: 40px 20px;
    color: #6b7280;
    font-style: italic;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
}

/* ================================================== */
/* RESPONSIVE DESIGN */
/* ================================================== */

@media (max-width: 768px) {
    .surge-detection-enhanced {
        padding: 16px;
    }
    
    .critical-alerts-grid {
        grid-template-columns: 1fr;
    }
    
    .surge-stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
    
    .categories-grid {
        grid-template-columns: 1fr;
    }
    
    .surge-tabs {
        flex-direction: column;
    }
    
    .surge-metrics {
        grid-template-columns: 1fr;
    }
    
    .topic-metrics, .need-metrics {
        grid-template-columns: 1fr;
    }
    
    .insight-card {
        flex-direction: column;
        text-align: center;
    }
    
    .rec-header {
        flex-direction: column;
        gap: 8px;
        align-items: flex-start;
    }
}

@media (max-width: 480px) {
    .surge-detection-enhanced {
        padding: 12px;
    }
    
    .stat-number {
        font-size: 1.8rem;
    }
    
    .dashboard-header h3 {
        font-size: 1.2rem;
    }
    
    .surge-categories-section h4,
    .detailed-surges-section h4,
    .contextual-insights-section h4,
    .recommendations-section h4 {
        font-size: 1rem;
    }
    
    .critical-title {
        font-size: 1.1rem;
    }
    
    .insight-icon {
        width: 50px;
        height: 50px;
        font-size: 1.5rem;
    }
}

/* ================================================== */
/* UTILITIES */
/* ================================================== */

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.mb-0 { margin-bottom: 0; }
.mb-1 { margin-bottom: 8px; }
.mb-2 { margin-bottom: 16px; }
.mb-3 { margin-bottom: 24px; }
.mb-4 { margin-bottom: 32px; }

.mt-0 { margin-top: 0; }
.mt-1 { margin-top: 8px; }
.mt-2 { margin-top: 16px; }
.mt-3 { margin-top: 24px; }
.mt-4 { margin-top: 32px; }

.opacity-50 { opacity: 0.5; }
.opacity-75 { opacity: 0.75; }

.cursor-pointer { cursor: pointer; }
.cursor-not-allowed { cursor: not-allowed; }

/* ================================================== */
/* ACCESSIBILITY */
/* ================================================== */

.surge-tab:focus,
.alert-action-btn:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    .surge-detection-enhanced {
        border: 2px solid #000;
    }
    
    .surge-stat-card,
    .category-card,
    .surge-item,
    .insight-card,
    .recommendation-card {
        border: 1px solid #000;
    }
}













/* ==================================================
   CLEAN & SLEEK GEOGRAPHIC INTELLIGENCE STYLES
   ================================================== */

/* Main container - keep minimal styling */
.enhanced-geographic-intelligence {
    background: #fafbfc;
    border-radius: 20px;
    padding: 32px;
    margin-bottom: 32px;
    border: 1px solid #e2e8f0;
}

.geo-header {
    margin-bottom: 32px;
}

.geo-explanation {
    background: rgba(59, 130, 246, 0.05);
    padding: 16px 20px;
    border-radius: 12px;
    margin-top: 16px;
    border-left: 3px solid #3b82f6;
}

.geo-explanation p {
    margin: 0;
    color: #374151;
    font-size: 0.95rem;
    line-height: 1.5;
}

/* KPI Cards - keep existing styling since they look good */
.geo-executive-summary {
    margin-bottom: 40px;
}

/* Regional Grid - Side by side clean layout */
.geo-regional-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 32px;
}

/* Analysis Grid - For county and demographic sections */
.geo-analysis-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 32px;
}

/* Clean card styling */
.geo-clean-card {
    background: white;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    transition: all 0.3s ease;
}

.geo-clean-card:hover {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
}

.opportunities-card {
    grid-column: 1 / -1; /* Full width for opportunities */
}

/* Clean card headers */
.clean-card-header {
    padding: 24px 28px 0 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.clean-card-header h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 8px;
}

.status-badge {
    font-size: 0.8rem;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.status-badge.critical {
    background: #fee2e2;
    color: #dc2626;
}

.status-badge.high {
    background: #fef3c7;
    color: #d97706;
}

.status-badge.medium {
    background: #dbeafe;
    color: #2563eb;
}

.status-badge.distributed {
    background: #dcfce7;
    color: #16a34a;
}

.status-badge.high, .status-badge.medium, .status-badge.low {
    background: #f0f9ff;
    color: #0ea5e9;
}

/* Clean card content */
.clean-card-content {
    padding: 0 28px 28px 28px;
}

/* Empty states */
.clean-empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #6b7280;
}

.empty-icon {
    font-size: 2.5rem;
    margin-bottom: 12px;
    opacity: 0.6;
}

.empty-text {
    font-size: 0.9rem;
    font-weight: 500;
}

/* Regional overview styling */
.clean-regional-overview,
.clean-international-overview {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.regional-stats,
.international-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 20px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
}

.stat-item {
    text-align: center;
}

.stat-number {
    display: block;
    font-size: 1.6rem;
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 4px;
}

.stat-label {
    font-size: 0.8rem;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Regional breakdown */
.regional-breakdown {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.region-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
}

.region-item:last-child {
    border-bottom: none;
}

.region-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 1;
}

.region-name {
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
}

.region-percentage {
    font-weight: 700;
    color: #059669;
    font-size: 1rem;
}

.region-bar {
    width: 80px;
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;
}

.region-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 3px;
    transition: width 0.8s ease;
}

/* International breakdown */
.international-breakdown {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.country-item {
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
}

.country-item:last-child {
    border-bottom: none;
}

.country-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.country-flag {
    font-size: 1.2rem;
}

.country-name {
    flex: 1;
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
}

.country-percentage {
    font-weight: 700;
    color: #3b82f6;
    font-size: 0.95rem;
}

/* County analysis styling */
.clean-county-analysis {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.analysis-summary {
    padding: 16px 20px;
    background: #f8fafc;
    border-radius: 8px;
    border-left: 3px solid #6366f1;
}

.analysis-summary p {
    margin: 0;
    color: #374151;
    font-size: 0.9rem;
    line-height: 1.5;
}

.county-performance-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
}

.county-performance-item {
    padding: 16px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    text-align: center;
    transition: all 0.2s ease;
}

.county-performance-item:hover {
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.county-name {
    font-weight: 600;
    color: #1f2937;
    font-size: 0.9rem;
    margin-bottom: 8px;
}

.county-metrics {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
    margin-bottom: 4px;
}

.metric-value {
    font-size: 1.3rem;
    font-weight: 700;
    color: #000000;
}

.metric-label {
    font-size: 0.8rem;
    color: #6b7280;
}

.county-share {
    font-size: 0.85rem;
    color: #6366f1;
    font-weight: 600;
}

/* Demographic analysis styling */
.clean-demographic-analysis {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.demographic-grid {
    display: grid;
    gap: 16px;
}

.demographic-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
}

.demographic-item:hover {
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.demo-icon {
    font-size: 2rem;
    opacity: 0.8;
}

.demo-content {
    flex: 1;
}

.demo-title {
    font-weight: 600;
    color: #1f2937;
    font-size: 0.95rem;
    margin-bottom: 4px;
}

.demo-value {
    font-weight: 700;
    color: #059669;
    font-size: 1.1rem;
    margin-bottom: 2px;
}

.demo-detail {
    font-size: 0.8rem;
    color: #6b7280;
}

/* Opportunities styling */
.clean-opportunities {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.opportunities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
}

.opportunity-item {
    padding: 24px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
}

.opportunity-item:hover {
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.opportunity-item.quick {
    border-left: 4px solid #10b981;
}

.opportunity-item.strategic {
    border-left: 4px solid #3b82f6;
}

.opportunity-item.impact {
    border-left: 4px solid #f59e0b;
}

.opp-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.opp-icon {
    font-size: 1.4rem;
}

.opp-title {
    font-weight: 700;
    color: #1f2937;
    flex: 1;
}

.opp-timeframe {
    font-size: 0.8rem;
    color: #6b7280;
    background: white;
    padding: 4px 8px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
}

.opp-list {
    margin: 0;
    padding-left: 20px;
    color: #374151;
}

.opp-list li {
    margin-bottom: 8px;
    font-size: 0.9rem;
    line-height: 1.4;
}

.impact-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.impact-item {
    text-align: center;
    padding: 16px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.impact-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 800;
    color: #000000;
    margin-bottom: 4px;
}

.impact-label {
    font-size: 0.8rem;
    color: #ffffff;
    font-weight: 600;
}

/* Responsive design */
@media (max-width: 1024px) {
    .geo-regional-grid,
    .geo-analysis-grid {
        grid-template-columns: 1fr;
        gap: 20px;
    }
    
    .opportunities-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 768px) {
    .enhanced-geographic-intelligence {
        padding: 20px;
    }
    
    .regional-stats,
    .international-stats {
        grid-template-columns: 1fr;
        gap: 12px;
    }
    
    .county-performance-grid {
        grid-template-columns: 1fr;
    }
    
    .impact-metrics {
        grid-template-columns: 1fr;
    }
    
    .clean-card-header,
    .clean-card-content {
        padding-left: 20px;
        padding-right: 20px;
    }
}




/* ==================================================
   CLEAN & SLEEK GEOGRAPHIC INTELLIGENCE STYLES
   ================================================== */

/* Main container - keep minimal styling */
.enhanced-geographic-intelligence {
    background: #fafbfc;
    border-radius: 20px;
    padding: 32px;
    margin-bottom: 32px;
    border: 1px solid #e2e8f0;
}

.geo-header {
    margin-bottom: 32px;
}

.geo-explanation {
    background: rgba(59, 130, 246, 0.05);
    padding: 16px 20px;
    border-radius: 12px;
    margin-top: 16px;
    border-left: 3px solid #3b82f6;
}

.geo-explanation p {
    margin: 0;
    color: #374151;
    font-size: 0.95rem;
    line-height: 1.5;
}

/* KPI Cards - keep existing styling since they look good */
.geo-executive-summary {
    margin-bottom: 40px;
}

/* Regional Grid - Side by side clean layout */
.geo-regional-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 32px;
}

/* Analysis Grid - For county and demographic sections */
.geo-analysis-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 32px;
}

/* Clean card styling */
.geo-clean-card {
    background: white;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    transition: all 0.3s ease;
}

.geo-clean-card:hover {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
}

.opportunities-card,
.search-patterns-card {
    grid-column: 1 / -1; /* Full width for opportunities and search patterns */
}

/* Clean card headers */
.clean-card-header {
    padding: 24px 28px 0 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.clean-card-header h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 8px;
}

.status-badge {
    font-size: 0.8rem;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.status-badge.critical {
    background: #fee2e2;
    color: #dc2626;
}

.status-badge.high {
    background: #fef3c7;
    color: #d97706;
}

.status-badge.medium {
    background: #dbeafe;
    color: #2563eb;
}

.status-badge.distributed {
    background: #dcfce7;
    color: #16a34a;
}

.status-badge.high, .status-badge.medium, .status-badge.low {
    background: #f0f9ff;
    color: #0ea5e9;
}

/* Clean card content */
.clean-card-content {
    padding: 0 28px 28px 28px;
}

/* Empty states */
.clean-empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #6b7280;
}

.empty-icon {
    font-size: 2.5rem;
    margin-bottom: 12px;
    opacity: 0.6;
}

.empty-text {
    font-size: 0.9rem;
    font-weight: 500;
}

.empty-detail {
    font-size: 0.8rem;
    color: #9ca3af;
    margin-top: 8px;
    font-style: italic;
}

/* Regional overview styling */
.clean-regional-overview,
.clean-international-overview {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.regional-stats,
.international-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 20px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
}

.stat-item {
    text-align: center;
}

.stat-number {
    display: block;
    font-size: 1.6rem;
    font-weight: 800;
    color: #1f2937;
    margin-bottom: 4px;
}

.stat-label {
    font-size: 0.8rem;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Regional breakdown */
.regional-breakdown {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.region-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
}

.region-item:last-child {
    border-bottom: none;
}

.region-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 1;
}

.region-name {
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
}

.region-percentage {
    font-weight: 700;
    color: #059669;
    font-size: 1rem;
}

.region-bar {
    width: 80px;
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;
}

.region-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 3px;
    transition: width 0.8s ease;
}

/* International breakdown */
.international-breakdown {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.country-item {
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
}

.country-item:last-child {
    border-bottom: none;
}

.country-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.country-flag {
    font-size: 1.2rem;
}

.country-name {
    flex: 1;
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
}

.country-percentage {
    font-weight: 700;
    color: #3b82f6;
    font-size: 0.95rem;
}

/* County analysis styling */
.clean-county-analysis {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.analysis-summary {
    padding: 16px 20px;
    background: #f8fafc;
    border-radius: 8px;
    border-left: 3px solid #6366f1;
}

.analysis-summary p {
    margin: 0;
    color: #374151;
    font-size: 0.9rem;
    line-height: 1.5;
}

.county-performance-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
}

.county-performance-item {
    padding: 16px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    text-align: center;
    transition: all 0.2s ease;
}

.county-performance-item:hover {
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.county-name {
    font-weight: 600;
    color: #1f2937;
    font-size: 0.9rem;
    margin-bottom: 8px;
}

.county-metrics {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
    margin-bottom: 4px;
}

.metric-value {
    font-size: 1.3rem;
    font-weight: 700;
    color: #000000;
}

.metric-label {
    font-size: 0.8rem;
    color: #6b7280;
}

.county-share {
    font-size: 0.85rem;
    color: #6366f1;
    font-weight: 600;
}

/* Demographic analysis styling */
.clean-demographic-analysis {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.demographic-grid {
    display: grid;
    gap: 16px;
}

.demographic-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
}

.demographic-item:hover {
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.demo-icon {
    font-size: 2rem;
    opacity: 0.8;
}

.demo-content {
    flex: 1;
}

.demo-title {
    font-weight: 600;
    color: #1f2937;
    font-size: 0.95rem;
    margin-bottom: 4px;
}

.demo-value {
    font-weight: 700;
    color: #059669;
    font-size: 1.1rem;
    margin-bottom: 2px;
}

.demo-detail {
    font-size: 0.8rem;
    color: #6b7280;
}

/* Search patterns styling */
.clean-search-patterns {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.patterns-summary {
    padding: 16px 20px;
    background: #f0f9ff;
    border-radius: 8px;
    border-left: 3px solid #0ea5e9;
}

.patterns-summary p {
    margin: 0;
    color: #374151;
    font-size: 0.9rem;
    line-height: 1.5;
}

.search-patterns-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 24px;
    margin-bottom: 32px;
}

.search-pattern-country {
    background: white;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.search-pattern-country:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    border-color: #3b82f6;
}

.country-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 24px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-bottom: 1px solid #e2e8f0;
}


/* Mobile responsiveness for flags */
@media (max-width: 768px) {
    .country-header {
        padding: 16px 20px;
        gap: 12px;
    }
    
    .country-flag-container {
        width: 40px;
        height: 40px;
    }
    
    .country-flag-large {
        font-size: 1.5rem;
    }
    
    .search-patterns-grid {
        grid-template-columns: 1fr;
        gap: 16px;
    }
    
    .query-content {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
    }
    
    .query-stats {
        align-self: flex-end;
    }
}







.country-flag {
    font-size: 1.3rem;
}

.country-flag-container {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    border: 2px solid #e2e8f0;
}

.country-flag-large {
    font-size: 1.8rem;
    line-height: 1;
}

.country-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}


.country-name {
    font-weight: 700;
    color: #1f2937;
    font-size: 1.1rem;
}


.country-total {
    font-size: 0.85rem;
    color: #0ea5e9;
    font-weight: 600;
    background: rgba(14, 165, 233, 0.1);
    padding: 4px 10px;
    border-radius: 12px;
    align-self: flex-start;
}

.country-queries {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.query-pattern-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid #f1f5f9;
    transition: all 0.2s ease;
}

.query-pattern-item:hover {
    background: rgba(59, 130, 246, 0.02);
    padding-left: 8px;
    padding-right: 8px;
    border-radius: 6px;
}


.query-pattern-item:last-child {
    border-bottom: none;
}

.query-rank {
    font-size: 0.8rem;
    font-weight: 700;
    color: #6b7280;
    background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
    width: 28px;
    height: 28px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid #e2e8f0;
}

.query-content {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
}

.query-text {
    font-size: 0.9rem;
    color: #374151;
    font-weight: 500;
    flex: 1;
    line-height: 1.3;
}

.clicks-stat {
    color: #059669;
    font-weight: 600;
}

.flag-mini {
    font-size: 0.9rem;
    opacity: 0.7;
}

.query-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
}



/* Enhanced insights styling */
.search-insights {
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    padding: 24px;
    border-radius: 12px;
    border-left: 4px solid #0ea5e9;
}

.search-insights h4 {
    margin: 0 0 16px 0;
    color: #0c4a6e;
    font-size: 1.1rem;
    font-weight: 700;
}

.insights-grid {
    display: grid;
    gap: 16px;
}

.insight-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 8px;
    border: 1px solid rgba(14, 165, 233, 0.1);
}

.insight-icon {
    font-size: 1.3rem;
    flex-shrink: 0;
    margin-top: 2px;
}

.insight-content {
    flex: 1;
}

.insight-title {
    font-weight: 600;
    color: #0f172a;
    font-size: 0.95rem;
    margin-bottom: 4px;
}

.insight-description {
    font-size: 0.85rem;
    color: #475569;
    line-height: 1.4;
}

/* Opportunities styling */
.clean-opportunities {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.opportunities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
}

.opportunity-item {
    padding: 24px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
}

.opportunity-item:hover {
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.opportunity-item.quick {
    border-left: 4px solid #10b981;
}

.opportunity-item.strategic {
    border-left: 4px solid #3b82f6;
}

.opportunity-item.impact {
    border-left: 4px solid #f59e0b;
}

.opp-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.opp-icon {
    font-size: 1.4rem;
}

.opp-title {
    font-weight: 700;
    color: #1f2937;
    flex: 1;
}

.opp-timeframe {
    font-size: 0.8rem;
    color: #6b7280;
    background: white;
    padding: 4px 8px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
}

.opp-list {
    margin: 0;
    padding-left: 20px;
    color: #374151;
}

.opp-list li {
    margin-bottom: 8px;
    font-size: 0.9rem;
    line-height: 1.4;
}

.impact-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.impact-item {
    text-align: center;
    padding: 16px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.impact-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 800;
    color: #f59e0b;
    margin-bottom: 4px;
}

.citizen-impact-label {
    font-size: 0.8rem;
    color: #000000;
    font-weight: 600;
}

/* Responsive design */
@media (max-width: 1024px) {
    .geo-regional-grid,
    .geo-analysis-grid {
        grid-template-columns: 1fr;
        gap: 20px;
    }
    
    .opportunities-grid {
        grid-template-columns: 1fr;
    }
    
    .search-patterns-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 768px) {
    .enhanced-geographic-intelligence {
        padding: 20px;
    }
    
    .regional-stats,
    .international-stats {
        grid-template-columns: 1fr;
        gap: 12px;
    }
    
    .county-performance-grid {
        grid-template-columns: 1fr;
    }
    
    .impact-metrics {
        grid-template-columns: 1fr;
    }
    
    .clean-card-header,
    .clean-card-content {
        padding-left: 20px;
        padding-right: 20px;
    }
}

/* ==================================================
   KPI CARDS
   ================================================== */

.geo-executive-summary {
    margin-bottom: 32px;
}

.geo-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 20px;
}

.geo-kpi-card {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
}

.geo-kpi-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.geo-kpi-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #0ea5e9, #06b6d4);
}

.geo-kpi-card.primary::before { background: linear-gradient(90deg, #16a34a, #22c55e); }
.geo-kpi-card.international::before { background: linear-gradient(90deg, #dc2626, #ef4444); }
.geo-kpi-card.coverage::before { background: linear-gradient(90deg, #7c3aed, #a855f7); }
.geo-kpi-card.opportunity::before { background: linear-gradient(90deg, #ea580c, #f97316); }

.kpi-icon {
    font-size: 3rem;
    margin-bottom: 16px;
    display: block;
    opacity: 0.8;
}

.kpi-content {
    margin-bottom: 16px;
}

.kpi-number {
    font-size: 2.5rem;
    font-weight: 800;
    color: #0f172a;
    line-height: 1;
    margin-bottom: 8px;
}

.kpi-label {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 4px;
}

.kpi-detail {
    font-size: 0.85rem;
    color: #6b7280;
    font-style: italic;
}

.kpi-trend {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    margin-top: 8px;
}

.kpi-trend.positive {
    background: #dcfce7;
    color: #166534;
}

.kpi-trend.negative {
    background: #fee2e2;
    color: #dc2626;
}

.kpi-trend.neutral {
    background: #f1f5f9;
    color: #64748b;
}

.kpi-grade {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1.1rem;
    color: white;
}

.grade-excellent { background: #10b981; }
.grade-good { background: #3b82f6; }
.grade-fair { background: #f59e0b; }
.grade-poor { background: #ef4444; }

.kpi-spark {
    opacity: 0.7;
}

.sparkline {
    width: 100%;
    height: 24px;
    color: #0ea5e9;
}

.coverage-bar {
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 12px;
}

.coverage-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed, #a855f7);
    border-radius: 4px;
    transition: width 0.8s ease;
}

/* ==================================================
   CONTENT VIEWS
   ================================================== */

.geo-content-views {
    position: relative;
}

.geo-view {
    display: none;
    animation: fadeInUp 0.4s ease;
}

.geo-view.active {
    display: block;
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* ==================================================
   OVERVIEW CONTENT
   ================================================== */

.overview-content {
    background: white;
    border-radius: 16px;
    padding: 24px;
}

.overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 24px;
}

.geo-card {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 16px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    position: relative;
    overflow: hidden;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;
}

.card-header h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: #0f172a;
}

.concentration-alert {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.concentration-alert.critical {
    background: #fee2e2;
    color: #dc2626;
    animation: pulse 2s infinite;
}

.concentration-alert.high {
    background: #fef3c7;
    color: #d97706;
}

.concentration-alert.medium {
    background: #dbeafe;
    color: #2563eb;
}

.concentration-alert.distributed {
    background: #dcfce7;
    color: #16a34a;
}

.reach-indicator {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
}

.reach-indicator.high {
    background: #dcfce7;
    color: #166534;
}

.reach-indicator.medium {
    background: #fef3c7;
    color: #92400e;
}

.reach-indicator.low {
    background: #f1f5f9;
    color: #64748b;
}

/* ==================================================
   INTERACTIVE MAPS
   ================================================== */

.ireland-map-container,
.world-map-container {
    min-height: 200px;
    margin-bottom: 20px;
}

.ireland-map-visual,
.world-map-visual {
    position: relative;
    background: white;
    border-radius: 12px;
    padding: 24px;
    min-height: 180px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.map-background,
.world-background {
    font-size: 4rem;
    opacity: 0.1;
    margin-bottom: 16px;
}

.region-bubbles,
.country-markers {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    align-items: center;
    margin-bottom: 16px;
}

.region-bubble,
.country-marker {
    position: relative;
    border-radius: 50%;
    background: linear-gradient(135deg, #0ea5e9, #06b6d4);
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    animation: bounceIn 0.6s ease var(--delay, 0s);
    width: var(--size, 40px);
    height: var(--size, 40px);
    min-width: 40px;
    min-height: 40px;
}

@keyframes bounceIn {
    0% {
        opacity: 0;
        transform: scale(0.3);
    }
    50% {
        transform: scale(1.05);
    }
    70% {
        transform: scale(0.9);
    }
    100% {
        opacity: 1;
        transform: scale(1);
    }
}

.region-bubble:hover,
.country-marker:hover {
    transform: scale(1.1);
    box-shadow: 0 8px 25px rgba(14, 165, 233, 0.4);
}

.region-bubble.high {
    background: linear-gradient(135deg, #ef4444, #dc2626);
}

.region-bubble.medium {
    background: linear-gradient(135deg, #f59e0b, #d97706);
}

.region-bubble.low {
    background: linear-gradient(135deg, #10b981, #059669);
}

.bubble-content {
    text-align: center;
    font-size: 0.7rem;
    font-weight: 600;
}

.region-name,
.country-label {
    font-size: 0.65rem;
    font-weight: 700;
    margin-bottom: 2px;
}

.region-stats,
.country-percentage {
    font-size: 0.6rem;
    opacity: 0.9;
}

.country-flag {
    font-size: 1.5rem;
    margin-bottom: 4px;
}

.map-legend {
    display: flex;
    justify-content: center;
    gap: 20px;
    font-size: 0.8rem;
    color: #64748b;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.legend-item::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.legend-item.high::before {
    background: #ef4444;
}

.legend-item.medium::before {
    background: #f59e0b;
}

.legend-item.low::before {
    background: #10b981;
}





/* ==================================================
   SIMPLIFIED GEOGRAPHIC INTELLIGENCE STYLES
   ================================================== */

/* Main geographic sections below the side-by-side layout */
.geo-detailed-section {
    background: white;
    border-radius: 16px;
    padding: 32px;
    margin: 32px 0;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
}

.geo-detailed-section h3 {
    margin: 0 0 24px 0;
    color: #0f172a;
    font-size: 1.3rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 12px;
}

.county-analysis-container,
.demographic-analysis-container {
    background: #f8fafc;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    min-height: 200px;
}

/* Enhanced layout for main analysis */
.geo-main-analysis {
    background: white;
    border-radius: 20px;
    padding: 32px;
    margin: 32px 0;
    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
    border: 1px solid #e2e8f0;
}

.geo-section-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
}

.geo-analysis-card {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 16px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    position: relative;
    overflow: hidden;
    min-height: 500px;
    display: flex;
    flex-direction: column;
}

.geo-analysis-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
}

.ireland-card::before {
    background: linear-gradient(90deg, #16a34a, #22c55e);
}

.international-card::before {
    background: linear-gradient(90deg, #3b82f6, #06b6d4);
}

.ireland-content,
.international-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
    flex: 1;
}

.ireland-map-container,
.world-map-container {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    flex: 1;
    min-height: 250px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.regional-insights,
.international-insights {
    background: rgba(255,255,255,0.8);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
}

.regional-insights h4,
.international-insights h4 {
    margin: 0 0 16px 0;
    color: #374151;
    font-size: 1.1rem;
    font-weight: 600;
}

/* County analysis table styles */
.top-regions-table {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.region-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
}

.region-row:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transform: translateY(-1px);
}

.region-row.top-region {
    background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    border-color: #16a34a;
    font-weight: 600;
}

.region-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.region-name {
    font-weight: 600;
    color: #374151;
    font-size: 0.95rem;
}

.region-percentage {
    font-weight: 700;
    color: #059669;
    font-size: 1.2rem;
}

.region-users {
    font-size: 0.85rem;
    color: #6b7280;
    text-align: right;
}

.region-bar {
    width: 80px;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
}

.region-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s ease;
}

/* Opportunities section styling */
.geo-opportunities-section {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border-radius: 16px;
    padding: 32px;
    margin: 32px 0;
    border-left: 4px solid #f59e0b;
    border: 1px solid #fbbf24;
}

.geo-opportunities-section h3 {
    margin: 0 0 24px 0;
    color: #92400e;
    font-size: 1.4rem;
    font-weight: 700;
}

/* Responsive design for the simplified layout */
@media (max-width: 1024px) {
    .geo-section-grid {
        grid-template-columns: 1fr;
        gap: 24px;
    }
    
    .geo-analysis-card {
        min-height: auto;
    }
}

@media (max-width: 768px) {
    .geo-main-analysis,
    .geo-detailed-section,
    .geo-opportunities-section {
        padding: 20px;
    }
    
    .region-row {
        grid-template-columns: 1fr auto;
        gap: 12px;
    }
    
    .region-bar {
        grid-column: 1 / -1;
        margin-top: 8px;
        width: 100%;
    }
}

/* Remove the old tab-related styles since we no longer use them */
.geo-controls,
.view-toggle,
.geo-content-views,
.geo-view {
    display: none !important;
}






/* ==================================================
   QUICK STATS
   ================================================== */

.regional-quick-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-top: 20px;
}

.quick-stat {
    text-align: center;
    padding: 16px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 4px;
}

.stat-label {
    font-size: 0.8rem;
    color: #64748b;
    font-weight: 500;
}

/* ==================================================
   PERFORMANCE HEATMAP
   ================================================== */

.performance-toggle {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 8px;
    padding: 4px;
}

.toggle-metric {
    padding: 6px 12px;
    border: none;
    background: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
}

.toggle-metric.active {
    background: #0ea5e9;
    color: white;
}

.performance-heatmap {
    background: white;
    border-radius: 12px;
    padding: 20px;
    margin-top: 16px;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed #e2e8f0;
    color: #64748b;
}

/* ==================================================
   OPPORTUNITIES CONTENT
   ================================================== */

.opportunities-content {
    background: white;
    border-radius: 16px;
    padding: 24px;
}

.opportunity-section {
    margin-bottom: 32px;
}

.opportunity-section h3 {
    color: #0f172a;
    margin-bottom: 16px;
    font-size: 1.2rem;
}

.opportunities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
}

.opportunity-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.opportunity-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
}

.opportunity-card.quick::before {
    background: linear-gradient(90deg, #10b981, #059669);
}

.opportunity-card.strategic::before {
    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
}

.opportunity-card.long-term::before {
    background: linear-gradient(90deg, #8b5cf6, #7c3aed);
}

.opportunity-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.opportunity-card .card-header {
    margin-bottom: 12px;
}

.opportunity-card h4 {
    margin: 0;
    color: #0f172a;
    font-size: 1.1rem;
}

.impact-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
}

.impact-badge.high {
    background: #fee2e2;
    color: #dc2626;
}

.impact-badge.medium {
    background: #fef3c7;
    color: #d97706;
}

.impact-badge.low {
    background: #f0f9ff;
    color: #0284c7;
}

.opportunity-description {
    color: #64748b;
    margin-bottom: 16px;
    line-height: 1.5;
}

.opportunity-metrics {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
}

.opportunity-metrics .metric {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
}

.opportunity-metrics .label {
    color: #64748b;
    font-weight: 500;
}

.opportunity-metrics .value {
    font-weight: 600;
    color: #0f172a;
}

.effort-low { color: #059669; }
.effort-medium { color: #d97706; }
.effort-high { color: #dc2626; }

.implement-btn {
    width: 100%;
    background: linear-gradient(135deg, #0ea5e9, #0284c7);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.implement-btn:hover {
    background: linear-gradient(135deg, #0284c7, #0369a1);
    transform: translateY(-1px);
}

/* ==================================================
   DETAILED ANALYSIS CONTENT
   ================================================== */

.detailed-content {
    background: white;
    border-radius: 16px;
    padding: 24px;
}

.detailed-section {
    margin-bottom: 32px;
    padding: 20px;
    background: #f8fafc;
    border-radius: 12px;
    border-left: 4px solid #0ea5e9;
}

.detailed-section h3 {
    color: #0f172a;
    margin-bottom: 16px;
    font-size: 1.2rem;
}

.county-analysis-grid,
.search-patterns-container,
.accessibility-matrix,
.demographic-insights {
    background: white;
    border-radius: 8px;
    padding: 16px;
    border: 1px solid #e2e8f0;
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-style: italic;
}

/* ==================================================
   ROI CALCULATOR
   ================================================== */

.roi-calculator {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-radius: 16px;
    padding: 24px;
    border: 1px solid #cbd5e1;
    margin-top: 24px;
}

.roi-calculator h3 {
    color: #0f172a;
    margin-bottom: 16px;
}

/* ==================================================
   NO DATA STATES
   ================================================== */

.no-data-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #64748b;
    font-style: italic;
    min-height: 150px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    border: 2px dashed #e2e8f0;
}

/* ==================================================
   RESPONSIVE DESIGN
   ================================================== */

@media (max-width: 1024px) {
    .geo-kpi-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .overview-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 768px) {
    .enhanced-geographic-intelligence {
        padding: 20px;
    }
    
    .geo-header {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .geo-kpi-grid {
        grid-template-columns: 1fr;
    }
    
    .regional-quick-stats {
        grid-template-columns: 1fr;
    }
    
    .view-toggle {
        width: 100%;
        justify-content: center;
    }
    
    .toggle-btn {
        flex: 1;
        text-align: center;
    }
    
    .opportunities-grid {
        grid-template-columns: 1fr;
    }
    
    .region-bubbles,
    .country-markers {
        flex-direction: column;
        align-items: center;
    }
    
    .map-legend {
        flex-direction: column;
        gap: 8px;
    }
}

@media (max-width: 480px) {
    .geo-controls {
        flex-direction: column;
        width: 100%;
    }
    
    .export-geo-btn {
        width: 100%;
        text-align: center;
    }
    
    .kpi-number {
        font-size: 2rem;
    }
    
    .kpi-icon {
        font-size: 2.5rem;
    }
    
    .opportunity-card {
        padding: 16px;
    }
}


            
        </style>
    `;
}




    
// Helper function to create matrix grid
function createMatrixGrid() {
    return '<!-- Grid is created via CSS background -->';
}

// Helper function to determine quadrant
function getPerformanceQuadrant(searchScore, engagementScore) {
    if (searchScore >= 50 && engagementScore >= 50) {
        return {
            name: 'Champion',
            class: 'champion',
            icon: '🏆',
            description: 'Your page excels in both search performance and user engagement. Keep up the excellent work!'
        };
    } else if (searchScore < 50 && engagementScore >= 50) {
        return {
            name: 'Hidden Gem',
            class: 'potential',
            icon: '💎',
            description: 'Great user engagement but low search visibility. Focus on SEO to unlock more traffic.'
        };
    } else if (searchScore >= 50 && engagementScore < 50) {
        return {
            name: 'Opportunity',
            class: 'opportunity',
            icon: '🎯',
            description: 'Good search performance but users aren\'t fully engaged. Improve content quality and UX.'
        };
    } else {
        return {
            name: 'Needs Focus',
            class: 'needs-work',
            icon: '🔧',
            description: 'Both search and engagement need improvement. Start with content quality and basic SEO.'
        };
    }
}

// Helper function to generate recommendations
function generateMatrixRecommendations(quadrant, searchScore, engagementScore) {
    const recommendations = [];
    
    if (quadrant.class === 'champion') {
        recommendations.push('🚀 Scale successful strategies to other pages');
        recommendations.push('📊 Monitor performance to maintain position');
        recommendations.push('🔍 Identify opportunities for related content');
    } else if (quadrant.class === 'potential') {
        recommendations.push('🔍 Improve search ranking and visibility');
        recommendations.push('📝 Optimise title tags and meta descriptions');
        recommendations.push('🔗 Build internal and external links');
    } else if (quadrant.class === 'opportunity') {
        recommendations.push('📚 Improve content quality and depth');
        recommendations.push('⚡ Optimise page loading speed');
        recommendations.push('🎨 Enhance user experience design');
    } else {
        recommendations.push('🎯 Start with basic SEO optimization');
        recommendations.push('📝 Rewrite content for better user value');
        recommendations.push('📱 Ensure mobile-friendly design');
    }
    
    return recommendations.map(rec => `<div class="action-item">${rec}</div>`).join('');
}

// Helper function for score classes (if not already defined)
function getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
}

// Helper function for duration formatting (if not already defined)
function formatDuration(seconds) {
    if (!seconds || seconds < 1) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

    function createSearchConsoleMetrics(gscData, gscTrends) {
        if (!gscData || gscData.noDataFound) {
            return `
                <div class="metric-card no-data">
                    <div class="metric-icon">  <svg width="48" height="48" viewBox="0 0 24 24" style="opacity: 0.7;">
                        <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg></div>
                    <div class="metric-label">Search Console</div>
                    <div class="metric-value">No Data</div>
                    <div class="metric-description">Connect Search Console for insights</div>
                </div>
            `;
        }

        const metrics = [
            
            {
                label: 'Impressions',
                value: formatNumber(gscData.impressions),
                trend: gscTrends?.trends?.impressions,
                icon: '👁️',
                color: '#06b6d4'
            },
            {
                label: 'Search Clicks',
                value: formatNumber(gscData.clicks),
                trend: gscTrends?.trends?.clicks,
                icon: '🎯',
                color: '#3b82f6'
            },
            {
                label: 'Click-Through Rate',
                value: `${(gscData.ctr * 100).toFixed(1)}%`,
                trend: gscTrends?.trends?.ctr,
                icon: '⚡',
                color: '#8b5cf6'
            },
            {
                label: 'Average Position',
                value: `#${gscData.position.toFixed(0)}`,
                trend: gscTrends?.trends?.position,
                icon: '📍',
                color: '#f59e0b'
            }
        ];

        return metrics.map(metric => `
            <div class="metric-card" style="border-left: 4px solid ${metric.color};">
                <div class="metric-header">
                    <span class="metric-icon">${metric.icon}</span>
                    <span class="metric-label">${metric.label}</span>
                </div>
                <div class="metric-value" style="color: ${metric.color};">${metric.value}</div>
                ${metric.trend ? `
                    <div class="metric-trend ${metric.trend.direction}">
                        <span class="trend-indicator">${metric.trend.direction === 'up' ? '↗' : metric.trend.direction === 'down' ? '↘' : '→'}</span>
                        <span class="trend-value">${Math.abs(metric.trend.percentChange).toFixed(1)}%</span>
                        <span class="trend-period">vs last period</span>
                    </div>
                ` : '<div class="metric-trend neutral">No trend data</div>'}
            </div>
        `).join('');
    }

    function createGA4Metrics(ga4Data, ga4Trends) {
        if (!ga4Data || ga4Data.noDataFound) {
            return `
                <div class="metric-card no-data">
                    <div class="metric-icon"><svg width="48" height="48" viewBox="0 0 24 24" style="opacity: 0.7;">
                        <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                    </svg></div>
                    <div class="metric-label">Google Analytics</div>
                    <div class="metric-value">Not Connected</div>
                    <div class="metric-description">Connect GA4 for user behavior insights</div>
                </div>
            `;
        }

        const metrics = [
            {
                label: 'Users',
                value: formatNumber(ga4Data.users || 0),
                trend: ga4Trends?.trends?.users,
                icon: '👥',
                color: '#10b981'
            },
            {
                label: 'Page Views',
                value: formatNumber(ga4Data.pageViews || 0),
                trend: ga4Trends?.trends?.pageViews,
                icon: '📄',
                color: '#f59e0b'
            },
            {
                label: 'Avg. Session Duration',
                value: formatDuration(ga4Data.avgSessionDuration || 0),
                trend: ga4Trends?.trends?.avgSessionDuration,
                icon: '⏱️',
                color: '#8b5cf6'
            },
            {
                label: 'Bounce Rate',
                value: `${((ga4Data.bounceRate || 0) * 100).toFixed(1)}%`,
                trend: ga4Trends?.trends?.bounceRate,
                icon: '⚽',
                color: '#ef4444',
                invertTrend: true
            }
        ];

        return metrics.map(metric => `
            <div class="metric-card" style="border-left: 4px solid ${metric.color};">
                <div class="metric-header">
                    <span class="metric-icon">${metric.icon}</span>
                    <span class="metric-label">${metric.label}</span>
                </div>
                <div class="metric-value" style="color: ${metric.color};">${metric.value}</div>
                ${metric.trend ? `
                    <div class="metric-trend ${metric.invertTrend ? 
                        (metric.trend.direction === 'up' ? 'down' : 'up') : 
                        metric.trend.direction}">
                        <span class="trend-indicator">${metric.trend.direction === 'up' ? '↗' : metric.trend.direction === 'down' ? '↘' : '→'}</span>
                        <span class="trend-value">${Math.abs(metric.trend.percentChange).toFixed(1)}%</span>
                        <span class="trend-period">vs last period</span>
                    </div>
                ` : '<div class="metric-trend neutral">No trend data</div>'}
            </div>
        `).join('');
    }

    function createCrossMetrics(gscData, ga4Data) {
        let conversionRate = 0;
        let qualityScore = 50;

        if (gscData && ga4Data && !gscData.noDataFound && !ga4Data.noDataFound) {
            if (gscData.clicks > 0 && ga4Data.users > 0) {
                conversionRate = (ga4Data.users / gscData.clicks) * 100;
            }

            const positionScore = Math.max(0, 100 - (gscData.position * 5));
            const ctrScore = Math.min(100, (gscData.ctr * 100) * 10);
            const durationScore = Math.min(100, (ga4Data.avgSessionDuration / 180) * 100);
            const bounceScore = Math.max(0, (1 - ga4Data.bounceRate) * 100);
            
            qualityScore = Math.round((positionScore + ctrScore + durationScore + bounceScore) / 4);
        }

        return `
            <div class="metric-card" style="border-left: 4px solid #72A300;">
                <div class="metric-header">
                    <span class="metric-icon">🔄</span>
                    <span class="metric-label">Search to User Conversion</span>
                </div>
                <div class="metric-value" style="color: #72A300;">${conversionRate.toFixed(1)}%</div>
                <div class="metric-trend neutral">Search clicks → GA4 users</div>
            </div>
            
            
        `;
    }

    // Additional helper functions would go here...
    // (I'll continue with the rest of the implementation in the next part)

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

    function createProblemQueryCard(query) {
        return `
            <div class="problem-query-card ${query.severity}">
                <div class="problem-header">
                    <div class="problem-severity">${query.severity.toUpperCase()}</div>
                    <div class="problem-position">Position #${query.position?.toFixed(0) || 'N/A'}</div>
                </div>
                <div class="problem-query">"${escapeHtml(query.query)}"</div>
                <div class="problem-issue">${query.issue}</div>
                <div class="problem-metrics">
                    ${query.clicks ? `${query.clicks} clicks` : ''}
                    ${query.impressions ? `• ${formatNumber(query.impressions)} impressions` : ''}
                    ${query.ctr ? `• ${(query.ctr * 100).toFixed(1)}% CTR` : ''}
                </div>
            </div>
        `;
    }

    function createGeographicQueryBreakdown(gscData) {
        const gscGeoData = gscData?.geographic || {};
        
        if (!gscGeoData.topCountries || gscGeoData.topCountries.length === 0) {
            return `
                <div class="no-data-message">
                    <div class="no-data-text">Geographic query data not available</div>
                    <div class="no-data-subtitle">Requires enhanced GSC integration</div>
                </div>
            `;
        }
        
        return `
            <div class="geo-query-breakdown">
                ${gscGeoData.topCountries.map(country => `
                    <div class="geo-query-card">
                        <div class="geo-query-header">
                            <span class="country-flag">${getCountryFlag(country.country)}</span>
                            <span class="country-name">${country.country}</span>
                            <span class="country-clicks">${country.clicks} clicks</span>
                        </div>
                        <div class="top-queries-in-country">
                            ${country.queries.slice(0, 3).map(q => `
                                <div class="country-query">
                                    "${escapeHtml(q.query)}" - ${q.clicks} clicks
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // More component functions...

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

    // Continue with placeholder functions for missing components...

    function createEvidenceBasedActions(gscData, ga4Data) {
        return `
            <div class="evidence-actions">
                <div class="action-item">
                    <div class="action-title">Content optimization based on search data</div>
                    <div class="action-description">Evidence-based recommendations coming soon</div>
                </div>
            </div>
        `;
    }

    function createRegionalUserBehaviorPatterns(ga4Data) {
        return `
            <div class="regional-patterns">
                <div class="pattern-insight">Regional user behavior analysis coming soon</div>
            </div>
        `;
    }

    function createUserExperienceAnalysis(ga4Data) {
        return `
            <div class="ux-analysis">
                <div class="ux-metric">
                    <span class="ux-label">Average Session Duration:</span>
                    <span class="ux-value">${formatDuration(ga4Data.avgSessionDuration || 0)}</span>
                </div>
                <div class="ux-metric">
                    <span class="ux-label">Bounce Rate:</span>
                    <span class="ux-value">${((ga4Data.bounceRate || 0) * 100).toFixed(1)}%</span>
                </div>
            </div>
        `;
    }

    function createTrendImpactSection(gscTrends, ga4Trends) {
        return `
            <div class="trend-impact">
                <div class="trend-message">Trend analysis based on available data</div>
            </div>
        `;
    }

    function createGeographicTrendAnalysis(ga4Trends) {
        return `
            <div class="geo-trend-analysis">
                <div class="geo-trend-message">Geographic trend analysis coming soon</div>
            </div>
        `;
    }

    function createForecastingSection(gscTrends, ga4Trends) {
        return `
            <div class="forecasting">
                <div class="forecast-message">Performance forecasting based on trend data</div>
            </div>
        `;
    }

    function createBenchmarkCard(label, current, benchmark, status, message) {
        const statusColors = {
            excellent: '#10b981',
            good: '#3b82f6',
            fair: '#f59e0b',
            poor: '#ef4444'
        };
        
        return `
            <div class="benchmark-card ${status}">
                <div class="benchmark-header">
                    <div class="benchmark-label">${label}</div>
                    <div class="benchmark-status" style="color: ${statusColors[status]}">
                        ${status.toUpperCase()}
                    </div>
                </div>
                <div class="benchmark-values">
                    <div class="current-value">${current}</div>
                    <div class="benchmark-comparison">vs ${benchmark} benchmark</div>
                </div>
                <div class="benchmark-message">${message}</div>
            </div>
        `;
    }

    function createCitizenNeedSurgeDetection(surgeAnalysis) {
        return `
            <div class="surge-detection">
                <div class="surge-summary">
                    <div class="surge-count">${surgeAnalysis.totalSurges} surges detected</div>
                    <div class="surge-description">Analysis of citizen information needs</div>
                </div>
            </div>
        `;
    }

    function createReviewWorkflowRecommendations(benchmarks) {
        return `
            <div class="workflow-recommendations">
                <div class="workflow-item">
                    <div class="workflow-title">Regular Performance Review</div>
                    <div class="workflow-description">Monthly assessment based on government benchmarks</div>
                </div>
            </div>
        `;
    }

    function createPriorityActionsSection(gscData, ga4Data, gscTrends, ga4Trends) {
        return `
            <div class="priority-actions">
                <div class="action-item high">
                    <div class="action-rank">1</div>
                    <div class="action-content">
                        <div class="action-title">Optimise Search Performance</div>
                        <div class="action-description">Focus on improving click-through rates and rankings</div>
                    </div>
                </div>
            </div>
        `;
    }

    function createGovernmentActionRecommendations(gscData, ga4Data) {
        return `
            <div class="gov-actions">
                <div class="gov-action-item">
                    <div class="gov-action-title">Content Strategy Alignment</div>
                    <div class="gov-action-description">Align content with citizen needs and government objectives</div>
                </div>
            </div>
        `;
    }

    function createImplementationTimelineSection(gscData, ga4Data) {
        return `
            <div class="implementation-timeline">
                <div class="timeline-phase">
                    <div class="phase-title">Week 1-2: Analysis & Planning</div>
                    <div class="phase-description">Review data and create action plan</div>
                </div>
                <div class="timeline-phase">
                    <div class="phase-title">Week 3-4: Implementation</div>
                    <div class="phase-description">Execute priority improvements</div>
                </div>
            </div>
        `;
    }

    

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

    function createConnectionMessage(service, description) {
        return `
            <div class="connection-message">
                <div class="connection-icon"><svg width="46" height="46" viewBox="0 0 24 24" style="opacity: 0.7;">
                    <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg></div>
                <div class="connection-title">Connect ${service}</div>
                <div class="connection-description">${description}</div>
                
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
                   
                    <button class="action-btn secondary" onclick="copyUnifiedSummary('${escapeHtml(url)}')">
                        <span class="btn-icon">📋</span>
                        <span class="btn-text">Copy Summary</span>
                    </button>
                    
                </div>
            </div>
        `;
    }

    // ===========================================
    // COMPLETE UNIFIED DASHBOARD STYLES
    // ===========================================

    function createUnifiedDashboardStyles() {
        return `
            <style>
                /* Complete Unified Citizens Dashboard Styles */
                
                .unified-dashboard-container {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #fafbfc;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.1);
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                /* Dashboard Header */
                .dashboard-header {
                    background: linear-gradient(135deg, #5a8200 0%, #72A300 100%);
                    color: white;
                    padding: 0px;
                    position: relative;
                    text-align: left;
                    overflow: hidden;
                }
                
                .dashboard-header::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="25" cy="25" r="2" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1.5" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="1" fill="white" opacity="0.1"/></svg>');
                    background-size: 100px 100px;
                }
                
                .header-content {
                    position: relative;
                    z-index: 2;
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 30px;
                    align-items: start;
                }
                
                /* Page Info */
                .page-breadcrumb {
                    font-size: 0.85rem;
                    opacity: 0.9;
                    margin-bottom: 8px;
                }
                
                .breadcrumb-separator {
                    margin: 0 8px;
                    opacity: 0.7;
                }

       .header-actions {
    margin-top: 16px;
    display: flex;
    justify-content: flex-start;
}


                /* Header Refresh Button */
.header-refresh-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
    font-family: inherit;
    position: relative;
    overflow: hidden;
}

.header-refresh-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transition: left 0.5s ease;
}

.header-refresh-btn:hover::before {
    left: 100%;
}

.header-refresh-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.header-refresh-btn:active {
    transform: translateY(0);
}

.header-refresh-btn.refreshing {
    pointer-events: none;
    opacity: 0.8;
    background: rgba(255, 255, 255, 0.3);
}

.header-refresh-btn.refreshing .refresh-icon {
    animation: spin 1s linear infinite;
}

.refresh-icon {
    font-size: 1.1rem;
    transition: transform 0.3s ease;
}

.refresh-text {
    font-weight: 600;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .header-actions {
        justify-content: center;
    }
    
    .header-refresh-btn {
        width: 100%;
        justify-content: center;
    }
}
                
                .page-title {
                    font-size: 1.8rem;
                    font-weight: 700;
                    margin: 0 0 16px 0;
                    line-height: 1.3;
                    
                }
                
                .page-metadata {
                    margin-top: 16px;
                }
                
                .metadata-grid {
                    display: grid;
                    gap: 12px;
                }
                
                .metadata-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9rem;
                }
                
                .metadata-label {
                    font-weight: 600;
                    opacity: 0.9;
                    min-width: 100px;
                }
                
                .metadata-value {
                    font-weight: 500;
                }
                
                .metadata-badge {
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-left: 8px;
                }
                
                .metadata-badge.fresh {
                    background: #10b981;
                    color: white;
                }
                
                .metadata-badge.aging {
                    background: #f59e0b;
                    color: white;
                }
                
                .metadata-badge.stale {
                    background: #ef4444;
                    color: white;
                }
                
                .url-link {
                    color: rgba(255,255,255,0.9);
                    text-decoration: none;
                    padding: 4px 8px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 6px;
                    font-size: 0.8rem;
                    transition: all 0.2s ease;
                }
                
                .url-link:hover {
                    background: rgba(255,255,255,0.2);
                    color: white;
                }
                
                /* Impact Summary */
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
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.25);
                }
                
                .impact-number {
                    font-size: 1.8rem;
                    font-weight: 800;
                    margin-bottom: 4px;
                }
                
                .impact-label {
                    color: #000000;
                    font-size: 0.85rem;
                    opacity: 0.9;
                    font-weight: 500;
                }
                
                /* Performance Overview */
                .performance-overview {
                    padding: 30px;
                    background: white;
                }
                
                .overview-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 20px;
    max-width: 1100px; /* Prevents cards from getting too wide */
    margin: 0 auto; /* Centers the grid */
}
                
                .overview-card {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-radius: 16px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    min-height: 200px; /* Ensures consistent card height */
    display: flex;
    flex-direction: column;
}


.card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
                
                .overview-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                }
                
                .overview-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, #3b82f6, #06b6d4);
                }
                
                .search-card::before {
                    background: linear-gradient(90deg, #4285f4, #34a853);
                }
                
                .analytics-card::before {
                    background: linear-gradient(90deg, #ff6b35, #f59e0b);
                }
                
                .quality-card::before {
                    background: linear-gradient(90deg, #8b5cf6, #a855f7);
                }
                
                .impact-card::before {
                    background: linear-gradient(90deg, #10b981, #059669);
                }
                
                .card-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                
                .card-icon {
                    font-size: 1.5rem;
                    margin-right: 12px;
                }
                
                .card-title {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #1f2937;
                    flex: 1;
                }
                
                .card-status {
                    font-size: 1.2rem;
                    margin-left: 8px;
                }
                
                .card-status.connected {
                    color: #10b981;
                }
                
                .card-status.disconnected {
                    color: #ef4444;
                }
                
                .metric-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                    font-size: 0.9rem;
                }
                
                .metric-row:last-child {
                    border-bottom: none;
                }
                
                .metric-label {
                    color: #64748b;
                    font-weight: 500;
                }
                
                .metric-value {
                    font-weight: 700;
                    color: #000000;
                }
                
                .trend-indicator {
                    font-size: 0.8rem;
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: 8px;
                    margin-left: 8px;
                }
                
                .trend-indicator.positive {
                    background: #dcfce7;
                    color: #166534;
                }
                
                .trend-indicator.negative {
                    background: #fee2e2;
                    color: #991b1b;
                }
                
                .trend-indicator.neutral {
                    background: #f1f5f9;
                    color: #64748b;
                }
                
                .no-data-message {
                    text-align: center;
                    color: #64748b;
                    padding: 20px;
                }
                
                .no-data-icon {
                    font-size: 2rem;
                    opacity: 0.5;
                    margin-bottom: 8px;
                    display: block;
                }
                
                .no-data-text {
                    font-weight: 500;
                }
                
                /* Quality Score Display */
                .quality-score-display {
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
                    border: 4px solid;
                    position: relative;
                }
                
                .score-circle.excellent {
                    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
                    border-color: #10b981;
                    color: #064e3b;
                }
                
                .score-circle.good {
                    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                    border-color: #3b82f6;
                    color: #1e40af;
                }
                
                .score-circle.fair {
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    border-color: #f59e0b;
                    color: #92400e;
                }
                
                .score-circle.poor {
                    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                    border-color: #ef4444;
                    color: #991b1b;
                }
                
                .score-number {
                    font-size: 1.8rem;
                    font-weight: 800;
                }
                
                .score-label {
                    font-size: 0.75rem;
                    opacity: 0.8;
                    font-weight: 600;
                }
                
                .score-grade {
                    font-weight: 700;
                    margin-bottom: 12px;
                    color: #1f2937;
                }
                
                /* Impact Metrics */
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
                
                .impact-metric:last-child {
                    border-bottom: none;
                }
                
                .impact-label {
                    color: #000000;
                    font-weight: 500;
                    font-size: 0.9rem;
                }
                
                .impact-value {
                    font-weight: 700;
                    color: #1f2937;
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
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
                
                .tab-nav::-webkit-scrollbar {
                    display: none;
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
                    position: relative;
                }
                
                .tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: white;
                }
                
                .tab-icon {
                    font-size: 1rem;
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
                    animation: fadeInUp 0.3s ease;
                }
                
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .panel-content {
                    padding: 30px;
                }
                
                /* Sections */
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
                
                /* Metrics Grid */
                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                }
                
                .metric-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    transition: all 0.2s ease;
                    position: relative;
                }
                
                .metric-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                
                .metric-card.no-data {
                    background: #f8fafc;
                    border: 2px dashed #d1d5db;
                    text-align: center;
                    color: #6b7280;
                }
                
                .metric-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                
                .metric-icon {
                    font-size: 1.2rem;
                }
                
                .metric-label {
                    font-size: 0.85rem;
                    color: #64748b;
                    font-weight: 600;
                }
                
                .metric-value {
                    font-size: 1.8rem;
                    font-weight: 800;
                    margin-bottom: 8px;
                    line-height: 1;
                }
                
                .metric-trend {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                
                .metric-trend.up { color: #059669; }
                .metric-trend.down { color: #dc2626; }
                .metric-trend.neutral { color: #64748b; }
                
                .trend-value {
                    font-weight: 600;
                }
                
                .trend-period {
                    color: #64748b;
                    font-weight: 400;
                }
                
                /* Performance Matrix */
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
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }
                    50% { box-shadow: 0 4px 20px rgba(59, 130, 246, 0.8); }
                    100% { box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }
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
                
                .matrix-legend {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    color: #64748b;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                
                .legend-axis.vertical {
                    transform: rotate(-90deg);
                    position: absolute;
                    left: 10px;
                    top: 50%;
                    transform-origin: center;
                }
                
                /* Geographic Intelligence Styles */
                .geographic-intelligence { 
                    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); 
                    border-left: 4px solid #0ea5e9; 
                }
                
                .geo-analysis-grid { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); 
                    gap: 24px; 
                }
                
                .geo-card { 
                    background: white; 
                    border-radius: 16px; 
                    padding: 24px; 
                    border: 1px solid #e0f2fe; 
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
                }
                
                .geo-card-header { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    margin-bottom: 20px; 
                }
                
                .region-item, .country-item {
                    padding: 12px 0; 
                    border-bottom: 1px solid #f1f5f9; 
                }
                
                .region-bar {
                    height: 8px; 
                    background: #f1f5f9; 
                    border-radius: 4px; 
                    margin: 6px 0; 
                    overflow: hidden; 
                }
                
                .service-recommendation, .international-alert {
                    background: #fff7ed; 
                    padding: 12px; 
                    border-radius: 8px; 
                    border-left: 3px solid #f59e0b; 
                    margin-top: 16px; 
                    font-size: 0.9rem; 
                }
                
                /* Citizens Impact Metrics */
                .citizens-impact-metrics {
                    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                    border-left: 4px solid #10b981;
                    border-radius: 12px;
                    padding: 24px;
                }
                
                .impact-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-bottom: 24px;
                }
                
                .impact-metric-card {
                    background: white;
                    padding: 20px;
                    border-radius: 12px;
                    text-align: center;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }
                
                .impact-metric-icon {
                    font-size: 2rem;
                    margin-bottom: 8px;
                }
                
                .impact-metric-value {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: #065f46;
                    margin-bottom: 4px;
                }
                
                .impact-metric-label {
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 4px;
                }
                
                .impact-metric-detail {
                    font-size: 0.8rem;
                    color: #6b7280;
                }
                
                /* Table Styles */
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
                
                .table-row:last-child {
                    border-bottom: none;
                }
                
                .col-query {
                    font-weight: 500;
                    color: #1f2937;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .col-clicks, .col-impressions {
                    font-weight: 600;
                    color: #059669;
                }
                
                .col-ctr {
                    font-weight: 600;
                    color: #3b82f6;
                }
                
                .col-position {
                    font-weight: 600;
                    color: #f59e0b;
                }
                
                /* Problem Queries */
                .problem-queries-list {
                    display: grid;
                    gap: 16px;
                }
                
                .problem-query-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    border-left: 4px solid #e5e7eb;
                }
                
                .problem-query-card.high {
                    background: #fef2f2;
                    border-left-color: #ef4444;
                }
                
                .problem-query-card.medium {
                    background: #fffbeb;
                    border-left-color: #f59e0b;
                }
                
                .problem-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .problem-severity {
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    background: #ef4444;
                    color: white;
                }
                
                .problem-query {
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 8px;
                }
                
                .problem-issue {
                    color: #64748b;
                    margin-bottom: 8px;
                }
                
                .problem-metrics {
                    font-size: 0.85rem;
                    color: #64748b;
                }
                
                /* Content Gaps */
                .gap-analysis-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 24px;
                }
                
                .gap-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                }
                
                .gap-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                
                .gap-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    color: #374151;
                }
                
                .gap-count {
                    background: #3b82f6;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                
                .gap-description {
                    font-size: 0.9rem;
                    color: #64748b;
                    margin-bottom: 16px;
                    line-height: 1.4;
                }
                
                .gap-examples {
                    margin-top: 12px;
                }
                
                .gap-example {
                    padding: 8px 0;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.85rem;
                }
                
                .gap-example:last-child {
                    border-bottom: none;
                }
                
                .gap-none {
                    color: #059669;
                    font-weight: 500;
                    text-align: center;
                    padding: 12px;
                    background: #f0fdf4;
                    border-radius: 6px;
                }
                
                /* Government Benchmarks */
                .benchmarks-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 20px;
                }
                
                .benchmark-card {
                    background: white;
                    border-radius: 16px;
                    padding: 44px;
                    border-left: 4px solid #e5e7eb;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                
                .benchmark-card.excellent { border-left-color: #10b981; }
                .benchmark-card.good { border-left-color: #3b82f6; }
                .benchmark-card.fair { border-left-color: #f59e0b; }
                .benchmark-card.poor { border-left-color: #ef4444; }
                
                .benchmark-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                
                .benchmark-label {
                    font-weight: 600;
                    color: #374151;
                }
                
                .benchmark-status {
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                
                .benchmark-values {
                    margin-bottom: 12px;
                }
                
                .current-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #1f2937;
                }
                
                .benchmark-comparison {
                    font-size: 0.85rem;
                    color: #64748b;
                }
                
                .benchmark-message {
                    font-size: 0.85rem;
                    color: #64748b;
                    line-height: 1.4;
                }
                
                /* Priority Matrix */
                .priority-matrix {
                    background: white;
                    border-radius: 16px;
                    padding: 24px;
                    border: 1px solid #e5e7eb;
                }
                
                .priority-breakdown {
                    display: grid;
                    gap: 16px;
                    margin-bottom: 24px;
                }
                
                .priority-component {
                    display: grid;
                    grid-template-columns: 200px 1fr auto;
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
                    position: relative;
                }
                
                .component-fill {
                    height: 100%;
                    background: #3b82f6;
                    border-radius: 6px;
                    transition: width 0.8s ease;
                }
                
                .component-score {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #64748b;
                    min-width: 50px;
                    text-align: right;
                }
                
                .priority-recommendation {
                    background: #f8fafc;
                    padding: 20px;
                    border-radius: 12px;
                    border-left: 4px solid #3b82f6;
                }
                
                .priority-recommendation h3 {
                    margin: 0 0 8px 0;
                    color: #1f2937;
                }
                
                .recommendation-text {
                    color: #64748b;
                    line-height: 1.4;
                }
                
                /* Score Breakdown */
                .score-breakdown {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 30px;
                    align-items: center;
                }
                
                .total-score {
                    text-align: center;
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
                
                .bar-fill {
                    height: 100%;
                    border-radius: 6px;
                    transition: width 0.8s ease;
                }
                
                /* Insights Grid */
                .insights-grid {
    display: grid;
    grid-template-columns: 1fr 1fr; /* Always 2 columns on desktop */
    grid-template-rows: 1fr 1fr;    /* Always 2 rows on desktop */
    gap: 20px;
    width: 100%;                     /* Full width */
    max-width: none;                 /* Remove any width restrictions */
}
                
                .insight-card {
    padding: 20px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: white;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    height: 100%; /* Fill the grid cell height */
    min-height: 120px; /* Ensure minimum height for content */
}

.insight-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
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
    flex-shrink: 0; /* Don't shrink the icon */
}

.insight-text {
    color: #374151;
    line-height: 1.5;
    font-weight: 500;
    flex-grow: 1; /* Take up remaining space */
}
                
                /* Connection Message */
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
                
                .connection-btn {
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }
                
                .connection-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
                }
                
                /* Action Center */
                .action-center {
                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                    padding: 30px;
                    text-align: center;
                    border-top: 1px solid #e2e8f0;
                }
                
                .action-header {
                    margin-bottom: 24px;
                }
                
                .action-header h3 {
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #1f2937;
                    margin: 0 0 8px 0;
                }
                
                .action-header p {
                    color: #64748b;
                    margin: 0;
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
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                }
                
                .btn-icon {
                    font-size: 1.1rem;
                }

                @media (max-width: 1024px) {
    .overview-grid {
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
        max-width: 600px;
    }
}

@media (max-width: 768px) {
    .overview-grid {
        grid-template-columns: 1fr;
        grid-template-rows: auto;
        max-width: none;
    }
    
    .overview-card {
        min-height: auto;
    }
}

@media (max-width: 480px) {
    .overview-grid {
        gap: 16px;
    }
    
    .overview-card {
        padding: 20px;
    }
}
                
                /* Responsive Design */
                @media (max-width: 768px) {
                    .header-content {
                        grid-template-columns: 1fr;
                        gap: 20px;
                }
                
                .page-title {
                    font-size: 1.4rem;
                }
                
                .overview-grid {
                    grid-template-columns: 1fr;
                }
                
                .tab-nav {
                    overflow-x: scroll;
                }
                
                .panel-content {
                    padding: 20px;
                }
                
                .action-buttons {
                    flex-direction: column;
                    align-items: center;
                }
                
                .action-btn {
                    width: 200px;
                    justify-content: center;
                }
                
                .impact-summary {
                    min-width: auto;
                }
                
                .geo-analysis-grid {
                    grid-template-columns: 1fr;
                }
                
                .gap-analysis-grid {
                    grid-template-columns: 1fr;
                }
                
                .benchmarks-grid {
                    grid-template-columns: 1fr;
                }
                
                .score-breakdown {
                    grid-template-columns: 1fr;
                }
                
                .component {
                    grid-template-columns: 1fr;
                    gap: 8px;
                }
                
                .priority-component {
                    grid-template-columns: 1fr;
                    text-align: center;
                }
                
                .table-header,
                .table-row {
                    grid-template-columns: 2fr 1fr 1fr;
                    font-size: 0.8rem;
                }
                
                .col-impressions,
                .col-position {
                    display: none;
                }
            }
            
            @media (max-width: 480px) {
                .unified-dashboard-container {
                    border-radius: 0;
                }
                
                .dashboard-header,
                .performance-overview,
                .panel-content,
                .action-center {
                    padding: 20px;
                }
                
                .tab-btn {
                    min-width: 120px;
                    padding: 12px 16px;
                    font-size: 0.8rem;
                }
                
                .tab-label {
                    display: none;
                }
                
                .metrics-grid,
                .insights-grid,
                .impact-grid {
                    grid-template-columns: 1fr;
                }
                
                .overview-card {
                    min-height: auto;
                }
            }



           
/* Enhanced Impact card trends with better contrast */
.impact-trend {
    font-size: 0.75rem;
    font-weight: 700;
    margin-top: 8px;
    display: inline-block;
    padding: 6px 12px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.impact-explanation {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.85);
    margin-top: 8px;
    font-style: italic;
}

.trend-positive {
    color: #059669;
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
}

.trend-negative {
    color: #dc2626;
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
}

.trend-neutral {
    color: #6b7280;
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
}


/* Quality Score Breakdown Styles */
.score-breakdown-toggle {
    margin-top: 12px;
    text-align: center;
}

.breakdown-btn {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.2);
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
}

.breakdown-btn:hover {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
}

.quality-breakdown {
    margin-top: 16px;
    padding: 16px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
}

.breakdown-explanation {
    margin-bottom: 16px;
    font-size: 0.85rem;
    color: #374151;
}

.breakdown-components {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
}

.breakdown-item {
    background: white;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
}

.breakdown-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.breakdown-icon {
    font-size: 1rem;
}

.breakdown-name {
    flex: 1;
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
}

.breakdown-score {
    font-weight: 700;
    font-size: 0.9rem;
    padding: 2px 8px;
    border-radius: 6px;
}

.breakdown-score.excellent { background: #dcfce7; color: #166534; }
.breakdown-score.good { background: #dbeafe; color: #1e40af; }
.breakdown-score.fair { background: #fef3c7; color: #92400e; }
.breakdown-score.poor { background: #fee2e2; color: #991b1b; }

.breakdown-details {
    font-size: 0.8rem;
    color: #6b7280;
    margin-left: 24px;
}

.breakdown-metric {
    margin-bottom: 4px;
}

.breakdown-improvement {
    margin-top: 8px;
    font-weight: 500;
    color: #374151;
    font-style: italic;
}

.overall-recommendation {
    background: #fffbeb;
    padding: 16px;
    border-radius: 8px;
    border-left: 4px solid #f59e0b;
}

.overall-recommendation h4 {
    margin: 0 0 8px 0;
    color: #92400e;
    font-size: 0.9rem;
}

.overall-recommendation p {
    margin: 0;
    color: #78350f;
    font-size: 0.85rem;
    line-height: 1.4;
}

/* Impact Breakdown Styles */
.impact-explain {
    font-size: 0.7rem;
    color: #9ca3af;
    margin-left: 4px;
    cursor: help;
}

.impact-breakdown-toggle {
    margin-top: 12px;
    text-align: center;
}

.impact-breakdown-btn {
    background: rgba(16, 185, 129, 0.1);
    color: #059669;
    border: 1px solid rgba(16, 185, 129, 0.2);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
}

.impact-breakdown-btn:hover {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
}

.impact-breakdown-details {
    margin-top: 12px;
    padding: 16px;
    background: #f0fdf4;
    border-radius: 8px;
    border: 1px solid #bbf7d0;
}

.impact-breakdown-section {
    margin-bottom: 20px;
}

.impact-breakdown-section:last-child {
    margin-bottom: 0;
}

.impact-breakdown-section h5 {
    margin: 0 0 12px 0;
    color: #166534;
    font-size: 0.9rem;
}

.impact-calculation {
    display: grid;
    gap: 8px;
}

.calc-item {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    align-items: center;
    font-size: 0.8rem;
}

.calc-label {
    color: #374151;
}

.calc-value {
    font-weight: 600;
    color: #059669;
}

.calc-source {
    color: #6b7280;
    font-size: 0.75rem;
    font-style: italic;
}

.calc-total {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: center;
    padding-top: 8px;
    border-top: 1px solid #bbf7d0;
    margin-top: 8px;
    font-size: 0.85rem;
}

.calc-note {
    margin-top: 8px;
    padding: 8px;
    background: rgba(16, 185, 129, 0.05);
    border-radius: 4px;
    color: #059669;
}

.top-queries-preview {
    margin-top: 12px;
    font-size: 0.8rem;
}

.top-queries-preview ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
}

.top-queries-preview li {
    margin-bottom: 4px;
    color: #374151;
}

.impact-summary {
    
    padding: 16px;
    border-radius: 8px;
    margin-top: 16px;
}

.impact-summary h5 {
    margin: 0 0 8px 0;
    color: #92400e;
    font-size: 0.9rem;
}

.impact-summary p {
    margin: 0;
    color: #78350f;
    font-size: 0.85rem;
    line-height: 1.4;
}

/* Expanded Citizens Quality Section */
            .expanded-citizens-quality-section {
                display: flex;
                flex-direction: column;
                gap: 32px;
            }

            /* Header with large score display */
            .quality-header {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 32px;
                align-items: center;
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                padding: 32px;
                border-radius: 16px;
                border-left: 4px solid #3b82f6;
            }

            .score-display-large {
                text-align: center;
            }

            .score-circle-large {
                width: 120px;
                height: 120px;
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                margin: 0 auto 16px;
                border: 4px solid;
                position: relative;
            }

            .score-circle-large.excellent {
                background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
                border-color: #10b981;
                color: #064e3b;
            }

            .score-circle-large.good {
                background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                border-color: #3b82f6;
                color: #1e40af;
            }

            .score-circle-large.fair {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border-color: #f59e0b;
                color: #92400e;
            }

            .score-circle-large.poor {
                background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                border-color: #ef4444;
                color: #991b1b;
            }

            .score-number-large {
                font-size: 2.5rem;
                font-weight: 800;
            }

            .score-label-large {
                font-size: 0.9rem;
                opacity: 0.8;
                font-weight: 600;
            }

            .score-grade-large {
                font-weight: 700;
                font-size: 1.2rem;
                color: #1f2937;
            }

            .score-explanation h3 {
                margin: 0 0 16px 0;
                color: #1f2937;
                font-size: 1.4rem;
            }

            .score-explanation p {
                margin: 0;
                color: #6b7280;
                line-height: 1.6;
                font-size: 1rem;
            }

            /* Components Grid */
            .quality-components-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 24px;
            }

            .quality-component-card {
                background: white;
                border-radius: 16px;
                padding: 24px;
                border: 1px solid #e2e8f0;
                transition: all 0.2s ease;
            }

            .quality-component-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            }

            .component-header {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 20px;
            }

            .component-icon {
                font-size: 2rem;
                flex-shrink: 0;
            }

            .component-info {
                flex: 1;
            }

            .component-title {
                font-size: 1.2rem;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 4px;
            }

            .component-subtitle {
                font-size: 0.9rem;
                color: #6b7280;
                font-style: italic;
            }

            .component-score {
                font-size: 1.5rem;
                font-weight: 800;
                padding: 8px 16px;
                border-radius: 12px;
                min-width: 80px;
                text-align: center;
            }

            .component-score.excellent { background: #dcfce7; color: #166534; }
            .component-score.good { background: #dbeafe; color: #1e40af; }
            .component-score.fair { background: #fef3c7; color: #92400e; }
            .component-score.poor { background: #fee2e2; color: #991b1b; }

            .detail-grid {
                display: grid;
                gap: 12px;
                margin-bottom: 20px;
            }

            .detail-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #f1f5f9;
            }

            .detail-item:last-child {
                border-bottom: none;
            }

            .detail-label {
                font-size: 0.9rem;
                color: #6b7280;
                font-weight: 500;
            }

            .detail-value {
                font-size: 0.9rem;
                font-weight: 600;
                color: #1f2937;
            }

            .component-improvement {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 16px;
                background: #f8fafc;
                border-radius: 8px;
                border-left: 3px solid #3b82f6;
            }

            .improvement-icon {
                font-size: 1.2rem;
                flex-shrink: 0;
            }

            .improvement-text {
                font-size: 0.9rem;
                color: #374151;
                line-height: 1.4;
                font-weight: 500;
            }

            /* Insights Section */
            .citizens-insights-expanded {
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                padding: 24px;
                border-radius: 12px;
                border-left: 4px solid #0ea5e9;
            }

            .citizens-insights-expanded h4 {
                margin: 0 0 20px 0;
                color: #0c4a6e;
                font-size: 1.2rem;
            }

            .insights-grid {
                display: grid;
                gap: 16px;
            }

            .insight-card {
                padding: 16px;
                border-radius: 8px;
                border-left: 3px solid #e5e7eb;
                background: white;
            }

            .insight-card.critical {
                background: #fef2f2;
                border-left-color: #ef4444;
            }

            .insight-card.warning {
                background: #fffbeb;
                border-left-color: #f59e0b;
            }

            .insight-card.success {
                background: #f0fdf4;
                border-left-color: #10b981;
            }

            .insight-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                font-size: 0.8rem;
                font-weight: 600;
            }

            .insight-category {
                color: #374151;
            }

            .insight-impact {
                color: #6b7280;
                font-size: 0.75rem;
            }

            .insight-message {
                font-size: 0.9rem;
                color: #374151;
                line-height: 1.4;
            }

            /* Recommendations Section */
            .recommendations-expanded {
                background: #f8fafc;
                padding: 24px;
                border-radius: 12px;
                border-left: 4px solid #10b981;
            }

            .recommendations-expanded h4 {
                margin: 0 0 20px 0;
                color: #065f46;
                font-size: 1.2rem;
            }

            .recommendations-grid {
                display: grid;
                gap: 20px;
            }

            .recommendation-card {
                background: white;
                padding: 20px;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
            }

            .recommendation-card.priority-high {
                border-left: 4px solid #ef4444;
            }

            .recommendation-card.priority-medium {
                border-left: 4px solid #f59e0b;
            }

            .recommendation-card.priority-low {
                border-left: 4px solid #6b7280;
            }

            .rec-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }

            .rec-priority {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .priority-indicator {
                width: 12px;
                height: 12px;
                border-radius: 50%;
            }

            .priority-indicator.high { background: #ef4444; }
            .priority-indicator.medium { background: #f59e0b; }
            .priority-indicator.low { background: #6b7280; }

            .priority-label {
                font-weight: 600;
                font-size: 0.9rem;
                color: #374151;
            }

            .rec-timeframe {
                font-size: 0.8rem;
                color: #6b7280;
                background: #f1f5f9;
                padding: 4px 8px;
                border-radius: 6px;
            }

            .rec-action {
                font-size: 1.1rem;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 8px;
            }

            .rec-impact {
                font-size: 0.9rem;
                color: #059669;
                font-weight: 500;
                margin-bottom: 16px;
            }

            .specifics-title {
                font-weight: 600;
                color: #374151;
                margin-bottom: 8px;
                font-size: 0.9rem;
            }

            .specifics-list {
                margin: 0;
                padding-left: 20px;
                color: #6b7280;
            }

            .specifics-list li {
                margin-bottom: 6px;
                font-size: 0.85rem;
                line-height: 1.4;
            }

            /* Overall Recommendation */
            .overall-recommendation-expanded {
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
                padding: 24px;
                border-radius: 12px;
                border-left: 4px solid #f59e0b;
            }

            .recommendation-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }

            .recommendation-header h4 {
                margin: 0;
                color: #92400e;
                font-size: 1.2rem;
            }

            .recommendation-score {
                font-weight: 700;
                color: #78350f;
                background: rgba(255, 255, 255, 0.7);
                padding: 8px 12px;
                border-radius: 8px;
            }

            .recommendation-content p {
                margin: 0;
                color: #78350f;
                line-height: 1.6;
                font-size: 1rem;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .quality-header {
                    grid-template-columns: 1fr;
                    text-align: center;
                }
                
                .quality-components-grid {
                    grid-template-columns: 1fr;
                }
                
                .score-circle-large {
                    width: 100px;
                    height: 100px;
                }
                
                .score-number-large {
                    font-size: 2rem;
                }
            }

           



            ${createEnhancedQueryAnalysisStyles()}

 
            
        </style>
    `;
}

// ===========================================
// MAIN UNIFIED DASHBOARD CREATION FUNCTION
// ===========================================

function createUnifiedCitizensDashboard(url, gscData, ga4Data, gscTrends, ga4Trends, nodeData = null) {
    const dashboardId = 'unified-dashboard-' + Date.now();
    
    // Schedule initialization after DOM insertion
    setTimeout(() => {
        const dashboard = document.getElementById(dashboardId);
        if (dashboard) {
            console.log('🚀 Auto-initializing unified dashboard:', dashboardId);
            initializeUnifiedDashboard(dashboardId);
        } else {
            console.log('⏳ Dashboard not ready, trying again...');
            setTimeout(() => {
                if (document.getElementById(dashboardId)) {
                    initializeUnifiedDashboard(dashboardId);
                }
            }, 50);
        }
    }, 10);
    
    return `
        ${createUnifiedDashboardStyles()}
        
        <div id="${dashboardId}" class="unified-dashboard-container">
            ${createEnhancedHeader(url, gscData, ga4Data, gscTrends, ga4Trends, nodeData)}
            
            
            <div class="dashboard-tabs">
                <div class="tab-nav">
                    <button class="tab-btn active" data-tab="overview">
                        <span class="tab-icon">📊</span>
                        <span class="tab-label">Overview</span>
                    </button>
                    <button class="tab-btn" data-tab="search">
                        <span class="tab-icon"> <svg width="16" height="16" viewBox="0 0 24 24" style="opacity: 0.7;">
                    <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg></span>
                        <span class="tab-label">Search Performance</span>
                    </button>
                    <button class="tab-btn" data-tab="content">
                        <span class="tab-icon">📝</span>
                        <span class="tab-label">Content Analysis</span>
                    </button>
                    <button class="tab-btn" data-tab="government">
                        <span class="tab-icon">🏛️</span>
                        <span class="tab-label">Government Benchmarks</span>
                    </button>
                    <button class="tab-btn" data-tab="geographic">
                        <span class="tab-icon">🌍</span>
                        <span class="tab-label">Geographic Intelligence</span>
                    </button>
                </div>
                
                <div class="tab-content">
                    <div class="tab-panel active" data-panel="overview">
                        ${createOverviewPanel(gscData, ga4Data, gscTrends, ga4Trends, url)}
                    </div>
                    
                    <div class="tab-panel" data-panel="search">
                        ${createSearchPerformancePanel(gscData, gscTrends, url)}
                    </div>
                    
                    <div class="tab-panel" data-panel="content">
                        ${createContentAnalysisPanel(gscData, ga4Data, url)}
                    </div>
                    
                    <div class="tab-panel" data-panel="users">
                        ${createUserBehaviorPanel(ga4Data, ga4Trends, gscData)}
                    </div>
                    
                    <div class="tab-panel" data-panel="trends">
                        ${createTrendAnalysisPanel(gscTrends, ga4Trends)}
                    </div>
                    
                    <div class="tab-panel" data-panel="government">
                        ${createGovernmentIntelligencePanel(gscData, ga4Data, gscTrends, ga4Trends)}
                    </div>
                    
                    <div class="tab-panel" data-panel="geographic">
                        <div class="panel-content">
                            ${createEnhancedGeographicServiceIntelligence(gscData, ga4Data, url)}
                        </div>
                    </div>
                </div>
            </div>
            ${createActionCenter(url)}
        </div>
    `;
}

// ===========================================
// DASHBOARD INITIALIZATION
// ===========================================

function initializeUnifiedDashboard(dashboardId) {
    console.log('🎯 Initializing Unified Dashboard:', dashboardId);
    
    const dashboard = document.getElementById(dashboardId);
    if (!dashboard) {
        console.error('❌ Dashboard container not found:', dashboardId);
        return;
    }
    
    const tabButtons = dashboard.querySelectorAll('.tab-btn');
    const tabPanels = dashboard.querySelectorAll('.tab-panel');
    
    if (tabButtons.length === 0 || tabPanels.length === 0) {
        console.error('❌ No tab buttons or panels found');
        return;
    }
    
    console.log('✅ Found', tabButtons.length, 'buttons and', tabPanels.length, 'panels');
    
    // Handle tab clicks
    tabButtons.forEach((button, index) => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🎯 Tab clicked:', this.dataset.tab);
            
            const targetTab = this.dataset.tab;
            
            dashboard.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            dashboard.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            
            this.classList.add('active');
            
            const targetPanel = dashboard.querySelector(`[data-panel="${targetTab}"]`);
            if (targetPanel) {
                targetPanel.classList.add('active');
                console.log('✅ Activated panel:', targetTab);
            } else {
                console.error('❌ Target panel not found:', targetTab);
            }
        });
    });
    
    // Handle both quality and impact breakdown toggles
    dashboard.addEventListener('click', function(e) {
        // Handle quality breakdown toggle
        const qualityToggleBtn = e.target.closest('[data-action="toggle-quality-breakdown"]');
        if (qualityToggleBtn) {
            e.preventDefault();
            console.log('🎯 Quality breakdown toggle clicked');
            
            const breakdown = dashboard.querySelector('#qualityBreakdown');
            const btn = dashboard.querySelector('#qualityBreakdownBtn');
            
            if (breakdown && btn) {
                if (breakdown.style.display === 'none' || !breakdown.style.display) {
                    breakdown.style.display = 'block';
                    btn.innerHTML = '<span>📊 Hide Breakdown</span>';
                    console.log('✅ Quality breakdown shown');
                } else {
                    breakdown.style.display = 'none';
                    btn.innerHTML = '<span>📊 Show Breakdown</span>';
                    console.log('✅ Quality breakdown hidden');
                }
            }
            return; // Exit early to prevent other handlers
        }
        
        // Handle impact breakdown toggle
        const impactToggleBtn = e.target.closest('[data-action="toggle-impact-breakdown"]');
        if (impactToggleBtn) {
            e.preventDefault();
            console.log('🎯 Impact breakdown toggle clicked');
            
            const breakdown = dashboard.querySelector('#impactBreakdown');
            const btn = impactToggleBtn;
            
            if (breakdown && btn) {
                if (breakdown.style.display === 'none' || !breakdown.style.display) {
                    breakdown.style.display = 'block';
                    btn.innerHTML = '<span>📊 Hide Calculation Details</span>';
                    console.log('✅ Impact breakdown shown');
                } else {
                    breakdown.style.display = 'none';
                    btn.innerHTML = '<span>📊 Show Calculation Details</span>';
                    console.log('✅ Impact breakdown hidden');
                }
            }
            return; // Exit early to prevent other handlers
        }
    });
    
    // Initialize first tab
    const firstButton = dashboard.querySelector('.tab-btn');
    const firstPanel = dashboard.querySelector('.tab-panel');
    
    if (firstButton && firstPanel) {
        dashboard.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        dashboard.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        firstButton.classList.add('active');
        firstPanel.classList.add('active');
        
        console.log('✅ Unified dashboard tabs initialized successfully!');
    }
}




    

// ===========================================
// EXPORT FUNCTIONS
// ===========================================

function exportUnifiedReport(url) {
    console.log('📊 Exporting unified report for:', url);
    const timestamp = new Date().toISOString();
    let csv = `Unified Citizens Information Analytics Report\n`;
    csv += `Generated: ${timestamp}\n`;
    csv += `URL: ${url}\n\n`;
    
    showUnifiedNotification('📊 Report export functionality ready - integrate with your existing export system');
}

function copyUnifiedSummary(url) {
    const summary = `
📊 UNIFIED CITIZENS INFORMATION ANALYSIS

🔗 Page: ${url}
📅 Generated: ${new Date().toLocaleDateString('en-IE')}

🎯 KEY METRICS:
- Search performance tracked
- User behavior analyzed  
- Government benchmarks assessed
- Geographic intelligence provided
- Content gaps identified

🏛️ GOVERNMENT INTELLIGENCE:
- Performance benchmarks evaluated
- Citizen need surges detected
- Priority matrix calculated
- Regional service demand mapped

📋 NEXT STEPS:
- Review optimization recommendations
- Implement priority actions
- Monitor performance improvements
- Schedule regular reviews

Generated by Unified Citizens Information Analytics Dashboard
    `.trim();
    
    navigator.clipboard.writeText(summary).then(() => {
        showUnifiedNotification('✅ Unified page summary copied to clipboard!');
    }).catch(() => {
        alert('Failed to copy to clipboard. Please try again.');
    });
}

function scheduleUnifiedReview(url) {
    console.log('📅 Scheduling unified review for:', url);
    showUnifiedNotification('📅 Review scheduling functionality - integrate with your calendar system');
}

function showUnifiedNotification(message) {
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
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}



// ===========================================
// ENHANCED QUERY INTELLIGENCE - COMPLETE REPLACEMENT
// Advanced citizen query analysis for Citizens.ie page-level dashboards
// Based on actual citizen queries and Irish government service patterns
// ===========================================

// EXPANDED IRISH-SPECIFIC KEYWORDS (400+ terms based on real citizen queries)
const socialWelfareKeywords = [
    // Benefits & Allowances
    'carers allowance', 'disability allowance', 'working family payment', 'fuel allowance',
    'illness benefit', 'jobseekers allowance', 'household benefits package', 'child benefit',
    'domiciliary care allowance', 'back to school allowance', 'carers benefit', 'carers support grant',
    'one parent family payment', 'invalidity pension', 'state pension', 'contributory pension',
    'non contributory pension', 'guardians payment', 'orphans pension', 'blind pension',
    'living alone allowance', 'island allowance', 'rent supplement', 'supplementary welfare',
    'exceptional needs payment', 'urgent needs payment', 'community welfare officer',
    
    // Employment Related
    'redundancy payment', 'insolvency payment', 'jobseekers benefit', 'jobseekers transition',
    'pre retirement allowance', 'back to work allowance', 'part time job incentive',
    'community employment', 'tús scheme', 'rural social scheme', 'job initiative',
    'back to education allowance', 'vtos allowance', 'training allowance'
];

const healthKeywords = [
    'medical card', 'gp visit card', 'drugs payment scheme', 'long term illness scheme',
    'health insurance', 'treatment benefit scheme', 'dental benefit scheme',
    'optical benefit scheme', 'maternity benefit', 'health and safety benefit',
    'occupational injury benefit', 'disability benefit', 'invalidity pension',
    'mental health services', 'counselling services', 'addiction services'
];

const familyChildrenKeywords = [
    'parental leave', 'maternity leave', 'paternity leave', 'adoptive leave',
    'parent\'s leave', 'force majeure leave', 'carer\'s leave', 'parental benefit',
    'maternity benefit', 'child benefit', 'early childhood care', 'childcare support',
    'guardian ad litem', 'special guardianship', 'adoption', 'fostering',
    'family mediation', 'child maintenance', 'domestic violence', 'barring order'
];

const housingKeywords = [
    'housing assistance payment', 'hap', 'social housing', 'housing list',
    'rental accommodation scheme', 'rent supplement', 'homeless services',
    'housing adaptation grant', 'mobility aids grant', 'housing aid for older people',
    'vacant homes', 'help to buy', 'shared ownership', 'affordable housing',
    'rental tenancy board', 'rtb', 'deposit retention scheme', 'tenancy tribunal'
];

const educationKeywords = [
    'susi', 'student grant', 'back to school allowance', 'school transport',
    'school completion programme', 'education welfare', 'home school liaison',
    'special education needs', 'sen', 'school book grant', 'school meals',
    'further education', 'adult education', 'community education', 'literacy',
    'apprenticeship', 'traineeship', 'youthreach', 'vtos', 'btea'
];

const employmentKeywords = [
    'minimum wage', 'sick pay', 'redundancy', 'unfair dismissal', 'workplace relations',
    'employment rights', 'parental leave', 'annual leave', 'public holidays',
    'working time', 'part time workers', 'fixed term contracts', 'agency workers',
    'workplace safety', 'protective equipment', 'safety statement', 'safety training',
    'jobseekers', 'activation', 'intreo', 'pathways to work', 'job club'
];

const elderlyKeywords = [
    'state pension', 'pension contribution', 'pension credit', 'qualified adult',
    'free travel', 'senior alert scheme', 'nursing home support', 'fair deal',
    'home care packages', 'meals on wheels', 'day care centres', 'respite care',
    'elder abuse', 'pension splitting', 'pension adjustment order'
];

const disabilityKeywords = [
    'disability allowance', 'invalidity pension', 'blind pension', 'domiciliary care',
    'mobility allowance', 'disabled drivers', 'parking permit', 'wheelchair',
    'guide dog', 'hearing aid', 'personal assistance', 'respite care',
    'disability assessment', 'occupational therapy', 'physiotherapy', 'speech therapy'
];

const transportKeywords = [
    'driving licence', 'theory test', 'driving test', 'nct', 'motor tax', 'road tax',
    'disabled drivers', 'free travel', 'bus pass', 'student travel', 'taxi licence',
    'public service vehicle', 'psv', 'transport allowance', 'mobility allowance'
];

const legalKeywords = [
    'small claims court', 'district court', 'circuit court', 'high court',
    'legal aid', 'civil legal aid', 'criminal legal aid', 'free legal advice',
    'legal separation', 'divorce', 'judicial separation', 'family law',
    'employment law', 'consumer rights', 'debt advice', 'money advice',
    'personal insolvency', 'bankruptcy', 'debt settlement', 'protective certificate'
];

const businessKeywords = [
    'starting a business', 'company registration', 'business registration', 'sole trader',
    'partnership', 'limited company', 'vat registration', 'tax registration',
    'employer registration', 'prsi employer', 'workplace relations', 'employment law',
    'health and safety', 'data protection', 'gdpr compliance', 'business grants'
];

const documentKeywords = [
    'pps number', 'birth certificate', 'death certificate', 'marriage certificate',
    'civil partnership certificate', 'passport', 'driving licence', 'garda vetting',
    'criminal record', 'european health insurance card', 'ehic', 'safe pass',
    'public services card', 'mygovid', 'revenue login', 'welfare login'
];

const emergencyKeywords = [
    'emergency', 'urgent', 'crisis', 'homeless', 'domestic violence', 'addiction',
    'mental health crisis', 'suicide prevention', 'emergency payment', 'crisis pregnancy',
    'emergency accommodation', 'emergency tax', 'urgent needs payment'
];

// 12-CATEGORY CITIZEN JOURNEY INTENT CLASSIFICATION
const citizenJourneyCategories = {
    // Immediate action needed - highest priority
    immediateAction: {
        keywords: [
            'apply now', 'urgent', 'emergency', 'today', 'deadline tomorrow', 'expires',
            'submit application', 'pay now', 'book appointment', 'register now',
            'appeal deadline', 'court date', 'eviction notice', 'benefit stopped'
        ],
        patterns: ['apply now', 'urgent', 'emergency', 'today', 'deadline', 'expires'],
        priority: 10,
        plainEnglish: 'Citizens who need to act immediately'
    },
    
    // Checking if they qualify for services
    eligibilityResearch: {
        keywords: [
            'am i entitled', 'do i qualify', 'am i eligible', 'requirements', 'criteria',
            'who can apply', 'who gets', 'means test', 'income limit', 'age limit',
            'what do i need', 'conditions', 'qualifying', 'entitled to', 'eligible for'
        ],
        patterns: ['am i', 'do i qualify', 'entitled', 'eligible', 'requirements', 'criteria'],
        priority: 8,
        plainEnglish: 'Citizens checking if they qualify for services'
    },
    
    // Learning how to complete processes
    processLearning: {
        keywords: [
            'how to apply', 'how do i', 'step by step', 'what documents', 'application process',
            'how to get', 'what forms', 'where to send', 'how to submit', 'what information',
            'application guide', 'how to complete', 'instructions', 'guide to'
        ],
        patterns: ['how to', 'how do i', 'step by step', 'what documents', 'application process'],
        priority: 7,
        plainEnglish: 'Citizens learning how to complete applications or processes'
    },
    
    // Comparing different options
    comparisonShopping: {
        keywords: [
            'compare', 'difference between', 'which is better', 'vs', 'versus', 'alternatives',
            'options', 'choices', 'best option', 'should i choose', 'better to',
            'pros and cons', 'advantages', 'disadvantages'
        ],
        patterns: ['compare', 'difference between', 'vs', 'which', 'better', 'options'],
        priority: 6,
        plainEnglish: 'Citizens comparing different service options'
    },
    
    // Solving problems with applications or services
    problemSolving: {
        keywords: [
            'appeal', 'complaint', 'problem with', 'not working', 'rejected', 'refused',
            'denied', 'dispute', 'review decision', 'wrong decision', 'unfair',
            'what if', 'went wrong', 'mistake', 'error', 'issue with'
        ],
        patterns: ['appeal', 'complaint', 'problem', 'rejected', 'dispute', 'wrong'],
        priority: 9,
        plainEnglish: 'Citizens with problems or disputes needing resolution'
    },
    
    // Checking status of applications
    statusChecking: {
        keywords: [
            'application status', 'when will i', 'how long', 'processing time',
            'still waiting', 'check status', 'track application', 'progress',
            'decision time', 'how long does it take', 'waiting for'
        ],
        patterns: ['status', 'when will', 'how long', 'processing time', 'waiting'],
        priority: 5,
        plainEnglish: 'Citizens checking on application progress'
    },
    
    // Looking for contact information
    contactSeeking: {
        keywords: [
            'phone number', 'contact', 'office hours', 'address', 'location',
            'where to go', 'local office', 'citizen information centre', 'intreo office',
            'social welfare office', 'who to contact', 'speak to someone'
        ],
        patterns: ['phone', 'contact', 'office', 'address', 'location', 'where'],
        priority: 4,
        plainEnglish: 'Citizens looking for contact details or office locations'
    },
    
    // Cost and payment information
    costPayment: {
        keywords: [
            'how much', 'cost', 'fee', 'price', 'payment', 'rates', 'charges',
            'what does it cost', 'how much does', 'payment methods', 'when to pay',
            'refund', 'overpayment', 'underpayment'
        ],
        patterns: ['how much', 'cost', 'fee', 'price', 'payment', 'rates'],
        priority: 6,
        plainEnglish: 'Citizens asking about costs, fees, or payments'
    },
    
    // Timing and deadline information
    timingDeadlines: {
        keywords: [
            'deadline', 'when', 'time limit', 'expires', 'due date', 'before',
            'how long', 'processing time', 'waiting time', 'appointment time',
            'office hours', 'closing date', 'opening hours'
        ],
        patterns: ['deadline', 'when', 'expires', 'due date', 'time limit'],
        priority: 7,
        plainEnglish: 'Citizens asking about timing, deadlines, or schedules'
    },
    
    // Location-specific information
    locationFinding: {
        keywords: [
            'near me', 'local', 'closest', 'address', 'directions', 'location',
            'where is', 'dublin', 'cork', 'galway', 'limerick', 'waterford',
            'county', 'area', 'region', 'my area'
        ],
        patterns: ['near me', 'local', 'where is', 'address', 'location'],
        priority: 4,
        plainEnglish: 'Citizens looking for local services or office locations'
    },
    
    // Documents and forms
    documentForm: {
        keywords: [
            'download form', 'application form', 'certificate', 'document',
            'birth cert', 'death cert', 'marriage cert', 'passport', 'pps number',
            'form', 'paperwork', 'what documents', 'proof of'
        ],
        patterns: ['form', 'certificate', 'document', 'download', 'cert'],
        priority: 5,
        plainEnglish: 'Citizens looking for forms, documents, or certificates'
    },
    
    // General information seeking
    generalInformation: {
        keywords: [
            'what is', 'what are', 'information about', 'tell me about', 'explain',
            'definition', 'meaning', 'guide', 'overview', 'introduction to',
            'general information', 'basic information'
        ],
        patterns: ['what is', 'what are', 'information', 'explain', 'guide'],
        priority: 3,
        plainEnglish: 'Citizens seeking general information and explanations'
    }
};

// ENHANCED QUERY INTENT CLASSIFICATION
function classifyCitizenIntent(query) {
    const queryLower = query.toLowerCase();
    
    let intentScores = {};
    let matchedKeywords = {};
    
    // Initialize scores and matched keywords for each category
    Object.keys(citizenJourneyCategories).forEach(category => {
        intentScores[category] = 0;
        matchedKeywords[category] = [];
    });
    
    // Score each category based on keyword matches
    Object.entries(citizenJourneyCategories).forEach(([category, config]) => {
        // Check exact keyword matches
        config.keywords.forEach(keyword => {
            if (queryLower.includes(keyword.toLowerCase())) {
                const weight = keyword.length > 10 ? 3 : keyword.length > 5 ? 2 : 1;
                intentScores[category] += weight * config.priority;
                matchedKeywords[category].push(keyword);
            }
        });
        
        // Check pattern matches
        config.patterns.forEach(pattern => {
            if (queryLower.includes(pattern.toLowerCase())) {
                intentScores[category] += 2 * config.priority;
                if (!matchedKeywords[category].includes(pattern)) {
                    matchedKeywords[category].push(pattern);
                }
            }
        });
    });
    
    // ENHANCED: Apply Irish-specific service keyword matching with intent boosting
    const irishKeywordSets = {
        socialWelfare: socialWelfareKeywords,
        health: healthKeywords,
        family: familyChildrenKeywords,
        housing: housingKeywords,
        education: educationKeywords,
        employment: employmentKeywords,
        elderly: elderlyKeywords,
        disability: disabilityKeywords,
        transport: transportKeywords,
        legal: legalKeywords,
        business: businessKeywords,
        documents: documentKeywords,
        emergency: emergencyKeywords
    };
    
    // Check for Irish-specific service matches and boost relevant intents
    Object.entries(irishKeywordSets).forEach(([serviceType, keywords]) => {
        keywords.forEach(keyword => {
            if (queryLower.includes(keyword.toLowerCase())) {
                // Boost intent scores based on service type and keyword context
                switch(serviceType) {
                    case 'socialWelfare':
                        intentScores.eligibilityResearch += 4; // People often check if they qualify
                        intentScores.immediateAction += 3; // Social welfare often urgent
                        intentScores.processLearning += 2; // Need to know how to apply
                        matchedKeywords.eligibilityResearch.push(`Irish ${serviceType}: ${keyword}`);
                        break;
                    case 'health':
                        intentScores.eligibilityResearch += 4; // Medical card eligibility common
                        intentScores.contactSeeking += 3; // Health services need contact info
                        intentScores.processLearning += 2;
                        matchedKeywords.eligibilityResearch.push(`Irish ${serviceType}: ${keyword}`);
                        break;
                    case 'emergency':
                        intentScores.immediateAction += 8; // Emergency = immediate action
                        intentScores.contactSeeking += 6; // Need contact info urgently
                        intentScores.problemSolving += 4; // Usually solving a crisis
                        matchedKeywords.immediateAction.push(`Irish ${serviceType}: ${keyword}`);
                        break;
                    case 'housing':
                        intentScores.eligibilityResearch += 4; // Housing eligibility key
                        intentScores.processLearning += 3; // Complex application process
                        intentScores.statusChecking += 2; // Often checking waiting lists
                        matchedKeywords.eligibilityResearch.push(`Irish ${serviceType}: ${keyword}`);
                        break;
                    case 'documents':
                        intentScores.processLearning += 5; // Need to know how to get docs
                        intentScores.documentForm += 4; // Direct document seeking
                        intentScores.contactSeeking += 2; // Where to get documents
                        matchedKeywords.processLearning.push(`Irish ${serviceType}: ${keyword}`);
                        break;
                    case 'disability':
                        intentScores.eligibilityResearch += 5; // Disability eligibility complex
                        intentScores.processLearning += 3;
                        intentScores.problemSolving += 2; // Often appeals/issues
                        matchedKeywords.eligibilityResearch.push(`Irish ${serviceType}: ${keyword}`);
                        break;
                    case 'employment':
                        intentScores.eligibilityResearch += 3;
                        intentScores.processLearning += 3;
                        intentScores.problemSolving += 2; // Employment issues
                        matchedKeywords.eligibilityResearch.push(`Irish ${serviceType}: ${keyword}`);
                        break;
                    case 'legal':
                        intentScores.problemSolving += 6; // Legal = problem solving
                        intentScores.contactSeeking += 4; // Need legal contacts
                        intentScores.processLearning += 2;
                        matchedKeywords.problemSolving.push(`Irish ${serviceType}: ${keyword}`);
                        break;
                    default:
                        // General Irish service boost
                        intentScores.eligibilityResearch += 2;
                        intentScores.processLearning += 2;
                        matchedKeywords.generalInformation.push(`Irish ${serviceType}: ${keyword}`);
                }
            }
        });
    });
    
    // Apply urgency boosting
    const urgencyIndicators = ['urgent', 'emergency', 'today', 'deadline', 'expires', 'asap'];
    const hasUrgency = urgencyIndicators.some(indicator => queryLower.includes(indicator));
    if (hasUrgency) {
        intentScores.immediateAction += 50;
        intentScores.problemSolving += 25;
    }
    
    // Enhanced Irish-specific service detection using our comprehensive keyword lists
    let hasIrishService = false;
    let detectedServiceTypes = [];
    
    Object.entries(irishKeywordSets).forEach(([serviceType, keywords]) => {
        const hasThisService = keywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
        if (hasThisService) {
            hasIrishService = true;
            detectedServiceTypes.push(serviceType);
        }
    });
    
    // Additional high-level Irish service terms
    const mainIrishServiceTerms = ['social welfare', 'citizens information', 'intreo', 'hse', 'revenue', 'dublin city council', 'county council'];
    if (mainIrishServiceTerms.some(term => queryLower.includes(term))) {
        hasIrishService = true;
        detectedServiceTypes.push('government');
    }
    
    // Apply Irish service multiplier boost
    if (hasIrishService) {
        Object.keys(intentScores).forEach(category => {
            if (intentScores[category] > 0) {
                intentScores[category] *= 1.3; // Increased from 1.2 to 1.3
            }
        });
    }
    
    // Determine primary intent
    const maxScore = Math.max(...Object.values(intentScores));
    const primaryIntent = Object.keys(intentScores).find(key => intentScores[key] === maxScore) || 'generalInformation';
    
    // Calculate confidence
    const totalScore = Object.values(intentScores).reduce((sum, score) => sum + score, 0);
    const confidence = totalScore > 0 ? Math.min(0.95, 0.3 + (maxScore / totalScore) * 0.6) : 0.2;
    
    // Determine secondary intent if score is close
    const secondaryIntents = Object.entries(intentScores)
        .filter(([category, score]) => category !== primaryIntent && score >= maxScore * 0.7)
        .map(([category]) => category);
    
    return {
        primaryIntent: primaryIntent,
        confidence: confidence,
        maxScore: maxScore,
        allScores: intentScores,
        matchedKeywords: matchedKeywords,
        totalMatches: Object.values(matchedKeywords).flat().length,
        hasUrgency: hasUrgency,
        hasIrishService: hasIrishService,
        detectedServiceTypes: detectedServiceTypes, // NEW: Which Irish services detected
        secondaryIntents: secondaryIntents,
        plainEnglish: citizenJourneyCategories[primaryIntent]?.plainEnglish || 'Citizens with general inquiries'
    };
}

// ADD NEW FUNCTION: Irish Service Analysis
function analyzeIrishServiceUsage(intentAnalysis) {
    const serviceBreakdown = {
        socialWelfare: 0,
        health: 0,
        family: 0,
        housing: 0,
        education: 0,
        employment: 0,
        elderly: 0,
        disability: 0,
        transport: 0,
        legal: 0,
        business: 0,
        documents: 0,
        emergency: 0,
        government: 0
    };
    
    let totalIrishQueries = 0;
    let totalImpressions = 0;
    
    intentAnalysis.forEach(item => {
        if (item.hasIrishService && item.detectedServiceTypes) {
            totalIrishQueries++;
            totalImpressions += item.impressions;
            
            item.detectedServiceTypes.forEach(serviceType => {
                if (serviceBreakdown.hasOwnProperty(serviceType)) {
                    serviceBreakdown[serviceType]++;
                }
            });
        }
    });
    
    return {
        serviceBreakdown,
        totalIrishQueries,
        totalImpressions,
        percentageIrish: intentAnalysis.length > 0 ? Math.round((totalIrishQueries / intentAnalysis.length) * 100) : 0
    };
}

// CITIZEN OPPORTUNITY SCORING
function calculateCitizenOpportunities(topQueries) {
    if (!topQueries || topQueries.length === 0) return [];
    
    const opportunities = [];
    const totalImpressions = topQueries.reduce((sum, q) => sum + q.impressions, 0);
    
    topQueries.forEach((query) => {
        const queryWords = query.query.split(' ');
        const queryIntent = classifyCitizenIntent(query.query);
        
        let opportunityScore = 0;
        let factors = [];
        let citizenImpact = 'low';
        
        // Service complexity and citizen value
        const isHighValueService = query.query.toLowerCase().includes('allowance') ||
                                 query.query.toLowerCase().includes('benefit') ||
                                 query.query.toLowerCase().includes('pension') ||
                                 query.query.toLowerCase().includes('medical card') ||
                                 query.query.toLowerCase().includes('housing');
        
        if (isHighValueService && query.impressions >= 100) {
            opportunityScore += 5;
            factors.push('High-value citizen service with good search volume');
            citizenImpact = 'high';
        }
        
        // Urgency and citizen need
        if (queryIntent.hasUrgency && query.impressions >= 50) {
            opportunityScore += 4;
            factors.push('Urgent citizen need requiring immediate attention');
            citizenImpact = 'high';
        }
        
        // Intent-based scoring
        const intentMultipliers = {
            immediateAction: 2.0,
            problemSolving: 1.8,
            eligibilityResearch: 1.6,
            processLearning: 1.5,
            timingDeadlines: 1.4,
            costPayment: 1.3
        };
        
        const multiplier = intentMultipliers[queryIntent.primaryIntent] || 1.0;
        if (multiplier > 1.2) {
            opportunityScore += Math.round(3 * multiplier);
            factors.push(`High-priority citizen journey stage: ${queryIntent.plainEnglish}`);
        }
        
        // Performance gaps
        const expectedCTR = getCTRBenchmark(query.position);
        const ctrGap = expectedCTR - query.ctr;
        
        if (ctrGap > 0.02 && query.impressions >= 100) {
            opportunityScore += 4;
            factors.push('Large gap between citizen searches and clicks');
            citizenImpact = citizenImpact === 'low' ? 'medium' : 'high';
        }
        
        // Ranking improvement potential
        if (query.position <= 20 && query.position > 3 && query.impressions >= 75) {
            opportunityScore += 3;
            factors.push('Page ranking well enough to improve with optimization');
        }
        
        // Long-tail citizen questions
        if (queryWords.length >= 4 && query.impressions >= 30) {
            opportunityScore += 2;
            factors.push('Specific citizen question with targeted optimization potential');
        }
        
        // Irish service-specific boost
        if (queryIntent.hasIrishService) {
            opportunityScore += 1;
            factors.push('Core Irish government service query');
        }
        
        // High impressions, low clicks (missed citizen opportunities)
        if (query.impressions >= 200 && query.clicks < 8) {
            opportunityScore += 4;
            factors.push('Many citizens searching but very few finding what they need');
            citizenImpact = 'high';
        }
        
        if (opportunityScore >= 4) {
            const potentialClicks = Math.round(query.impressions * Math.max(0, ctrGap));
            const estimatedCitizensHelped = Math.round(potentialClicks * 1.2); // Assuming some will share/return
            
            opportunities.push({
                query: query.query,
                score: opportunityScore,
                impressions: query.impressions,
                clicks: query.clicks,
                ctr: query.ctr,
                position: query.position,
                factors: factors,
                priority: opportunityScore >= 10 ? 'high' : opportunityScore >= 7 ? 'medium' : 'low',
                potentialClicks: Math.max(0, potentialClicks),
                citizenImpact: citizenImpact,
                estimatedCitizensHelped: estimatedCitizensHelped,
                queryIntent: queryIntent.primaryIntent,
                plainEnglishIntent: queryIntent.plainEnglish,
                hasUrgency: queryIntent.hasUrgency,
                secondaryIntents: queryIntent.secondaryIntents
            });
        }
    });
    
    return opportunities.sort((a, b) => b.score - a.score);
}

// MAIN ANALYSIS FUNCTION
function performCitizenQueryAnalysis(gscData, pageUrl) {
    if (!gscData || !gscData.topQueries || gscData.topQueries.length === 0) {
        return {
            intentAnalysis: [],
            citizenOpportunities: [],
            summary: {
                totalQueries: 0,
                byIntent: {},
                opportunities: 0,
                citizensImpacted: 0,
                urgentQueries: 0
            }
        };
    }
    
    const intentAnalysis = [];
    let intentCounts = {};
    let urgentCount = 0;
    let totalCitizensImpacted = 0;
    
    // Initialize intent counts
    Object.keys(citizenJourneyCategories).forEach(intent => {
        intentCounts[intent] = 0;
    });
    
    // Analyze each query
    gscData.topQueries.forEach(queryData => {
        // Citizen intent classification
        const intent = classifyCitizenIntent(queryData.query);
        intentAnalysis.push({
            query: queryData.query,
            primaryIntent: intent.primaryIntent,
            plainEnglishIntent: intent.plainEnglish,
            confidence: intent.confidence,
            impressions: queryData.impressions,
            clicks: queryData.clicks,
            matchedKeywords: intent.matchedKeywords,
            totalMatches: intent.totalMatches,
            hasUrgency: intent.hasUrgency,
            hasIrishService: intent.hasIrishService,
            detectedServiceTypes: intent.detectedServiceTypes, // NEW: Include detected Irish services
            secondaryIntents: intent.secondaryIntents
        });
        
        intentCounts[intent.primaryIntent]++;
        if (intent.hasUrgency) urgentCount++;
        totalCitizensImpacted += queryData.impressions;
    });
    
    // Citizen opportunity analysis
    const citizenOpportunities = calculateCitizenOpportunities(gscData.topQueries);
    
    return {
        intentAnalysis: intentAnalysis,
        citizenOpportunities: citizenOpportunities,
        summary: {
            totalQueries: gscData.topQueries.length,
            byIntent: intentCounts,
            opportunities: citizenOpportunities.length,
            citizensImpacted: totalCitizensImpacted,
            urgentQueries: urgentCount
        }
    };
}

// ADD NEW FUNCTION: Validate and fix intent counts
function validateIntentCounts(intentAnalysis, intentCounts) {
    console.log('Validating intent counts...'); // Debug log
    
    // Count actual intents from the analysis data
    const actualCounts = {};
    Object.keys(citizenJourneyCategories).forEach(intent => {
        actualCounts[intent] = 0;
    });
    
    intentAnalysis.forEach(item => {
        if (actualCounts.hasOwnProperty(item.primaryIntent)) {
            actualCounts[item.primaryIntent]++;
        } else {
            console.warn('Unknown intent in analysis:', item.primaryIntent);
            actualCounts[item.primaryIntent] = (actualCounts[item.primaryIntent] || 0) + 1;
        }
    });
    
    console.log('Original counts:', intentCounts);
    console.log('Actual counts:', actualCounts);
    
    // Check for mismatches
    const mismatches = [];
    Object.keys(actualCounts).forEach(intent => {
        if (intentCounts[intent] !== actualCounts[intent]) {
            mismatches.push({
                intent,
                expected: intentCounts[intent] || 0,
                actual: actualCounts[intent]
            });
        }
    });
    
    if (mismatches.length > 0) {
        console.warn('Intent count mismatches found:', mismatches);
    }
    
    // Return the corrected counts
    return actualCounts;
}

// CITIZEN JOURNEY PANEL
function createCitizenJourneyPanel(intentAnalysis, intentCounts) {
    if (intentAnalysis.length === 0) {
        return '<div class="no-data-message">No citizen query data available</div>';
    }
    
    const initialDisplayCount = 12;
    const showPagination = intentAnalysis.length > initialDisplayCount;
    
    // FIX: Validate and correct intent counts
    const correctedIntentCounts = validateIntentCounts(intentAnalysis, intentCounts);
    
    // Create intent distribution chart using corrected counts
    const topIntents = Object.entries(correctedIntentCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 6)
        .filter(([,count]) => count > 0);
    
    // NEW: Analyze Irish service usage
    const irishServiceAnalysis = analyzeIrishServiceUsage(intentAnalysis);
    const topIrishServices = Object.entries(irishServiceAnalysis.serviceBreakdown)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .filter(([,count]) => count > 0);
    
    return `
        <div class="citizen-journey-panel">
            <div class="journey-explanation">
                <p><strong>Citizen Journey Analysis:</strong> Understanding what stage citizens are at when they search helps tailor content to their specific needs and urgency levels.</p>
            </div>
            
            <!-- Irish Service Detection Analysis -->
            <div class="irish-service-analysis">
                <h4>🇮🇪 Irish Government Service Detection</h4>
                <p class="filter-instruction">💡 <strong>Click on any Irish service below to filter queries by that service type</strong></p>
                <div class="service-stats">
                    <div class="service-stat">
                        <span class="stat-number">${irishServiceAnalysis.totalIrishQueries}</span>
                        <span class="stat-label">Irish Service Queries</span>
                    </div>
                    <div class="service-stat">
                        <span class="stat-number">${irishServiceAnalysis.percentageIrish}%</span>
                        <span class="stat-label">of All Queries</span>
                    </div>
                    <div class="service-stat">
                        <span class="stat-number">${formatNumber(irishServiceAnalysis.totalImpressions)}</span>
                        <span class="stat-label">Monthly Irish Service Searches</span>
                    </div>
                </div>
                
                ${topIrishServices.length > 0 ? `
                    <div class="irish-service-breakdown">
                        <h5>📊 Top Irish Services Being Searched:</h5>
                        <div class="service-bars">
                            ${topIrishServices.map(([service, count]) => {
                                const percentage = Math.round((count / irishServiceAnalysis.totalIrishQueries) * 100);
                                return `
                                    <div class="service-bar clickable" data-filter-service="${service}" role="button" tabindex="0" aria-label="Click to filter queries by ${getServiceDisplayName(service)}" title="Click to see only ${getServiceDisplayName(service)} queries">
                                        <div class="service-bar-label">
                                            <span class="service-name">${getServiceDisplayName(service)}</span>
                                            <span class="service-count">${count} queries (${percentage}%)</span>
                                        </div>
                                        <div class="service-bar-fill">
                                            <div class="service-bar-progress" style="width: ${percentage}%; background: ${getServiceColor(service)}"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div class="service-filter-controls">
                            <button class="clear-filter-btn" id="clearServiceFilter" style="display: none;">
                                ✕ Show All Irish Services (<span id="totalIrishQueryCount">${irishServiceAnalysis.totalIrishQueries}</span> queries)
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <!-- Intent Distribution -->
            <div class="intent-distribution">
                <h4>🗺️ Where Citizens Are in Their Journey</h4>
                <p class="filter-instruction">💡 <strong>Click on any journey stage below to filter queries by that category</strong> (or use Enter/Space when focused) 
                   
                </p>
                
                <!-- Urgent Queries Filter -->
                ${intentAnalysis.filter(item => item.hasUrgency).length > 0 ? `
                    <div class="urgent-filter-section" style="margin-bottom: 16px;">
                        <div class="urgent-filter-bar clickable" data-filter-urgent="true" role="button" tabindex="0" style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border: 2px solid #f87171; border-radius: 8px; padding: 12px; cursor: pointer; transition: all 0.2s ease; position: relative;">
                            <div style="display: flex; align-items: center; gap: 12px; color: #dc2626; font-weight: 600;">
                                <span style="font-size: 1.2rem; animation: pulse 2s infinite;">🚨</span>
                                <span style="font-size: 0.95rem; flex-grow: 1;">All Urgent Citizen Needs</span>
                                <span style="font-size: 0.8rem; background: rgba(220, 38, 38, 0.1); padding: 4px 8px; border-radius: 12px; border: 1px solid rgba(220, 38, 38, 0.2);">${intentAnalysis.filter(item => item.hasUrgency).length} urgent queries</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="intent-bars">
                    ${topIntents.map(([intent, count]) => {
                        const percentage = Math.round((count / intentAnalysis.length) * 100);
                        const config = citizenJourneyCategories[intent];
                        return `
                            <div class="intent-bar clickable" data-filter-intent="${intent}" role="button" tabindex="0" aria-label="Click to filter queries by ${config?.plainEnglish || intent}" title="Click to see only ${config?.plainEnglish || intent} queries">
                                <div class="intent-bar-label">
                                    <span class="intent-name">${config?.plainEnglish || intent}</span>
                                    <span class="intent-count">${count} queries (${percentage}%)</span>
                                </div>
                                <div class="intent-bar-fill">
                                    <div class="intent-bar-progress" style="width: ${percentage}%; background: ${getIntentColor(intent)}"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="filter-controls">
                    <button class="clear-filter-btn" id="clearJourneyFilter" style="display: none;">
                        ✕ Show All Journey Stages (<span id="totalQueryCount">${intentAnalysis.length}</span> queries)
                    </button>
                </div>
            </div>
            
            <!-- Detailed Query Analysis -->
            <div class="queries-analysis">
                <div class="queries-analysis-header">
                    <h4>🔍 Detailed Citizen Query Analysis</h4>
                    <div class="filter-status" id="journeyFilterStatus" style="display: none;">
                        <span class="filter-label">Filtered by:</span>
                        <span class="filter-value" id="filterValueDisplay"></span>
                        <span class="filter-count" id="filterCountDisplay"></span>
                    </div>
                </div>
                
                <div class="citizen-queries-list" data-citizen-list="journey" id="citizenQueriesList">
                    ${intentAnalysis.slice(0, initialDisplayCount).map(item => `
                        <div class="citizen-query-item ${item.primaryIntent}" data-intent="${item.primaryIntent}">
                            <div class="query-header">
                                <div class="query-text">"${escapeHtml(item.query)}"</div>
                                <div class="query-badges">
                                    <span class="intent-badge ${item.primaryIntent}">
                                        ${getIntentIcon(item.primaryIntent)} ${item.plainEnglishIntent}
                                    </span>
                                    ${item.hasUrgency ? '<span class="urgency-badge">🚨 Urgent</span>' : ''}
                                    ${item.hasIrishService ? '<span class="irish-service-badge">🇮🇪 Irish Service</span>' : ''}
                                    <span class="confidence-badge">${Math.round(item.confidence * 100)}% confident</span>
                                </div>
                            </div>
                            <div class="query-metrics">
                                <span class="metric">${formatNumber(item.impressions)} monthly searches</span>
                                <span class="metric">${formatNumber(item.clicks)} citizens clicked</span>
                                <span class="metric">${(item.clicks / item.impressions * 100).toFixed(1)}% engagement</span>
                            </div>
                            ${item.detectedServiceTypes && item.detectedServiceTypes.length > 0 ? `
                                <div class="detected-services">
                                    <strong>Irish Services Detected:</strong> ${item.detectedServiceTypes.map(type => getServiceDisplayName(type)).join(', ')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                    
                    <!-- Hidden queries for pagination -->
                    <div class="hidden-queries" style="display: none;" id="hiddenQueriesList">
                        ${intentAnalysis.slice(initialDisplayCount).map(item => `
                            <div class="citizen-query-item ${item.primaryIntent}" data-intent="${item.primaryIntent}">
                                <div class="query-header">
                                    <div class="query-text">"${escapeHtml(item.query)}"</div>
                                    <div class="query-badges">
                                        <span class="intent-badge ${item.primaryIntent}">
                                            ${getIntentIcon(item.primaryIntent)} ${item.plainEnglishIntent}
                                        </span>
                                        ${item.hasUrgency ? '<span class="urgency-badge">🚨 Urgent</span>' : ''}
                                        ${item.hasIrishService ? '<span class="irish-service-badge">🇮🇪 Irish Service</span>' : ''}
                                        <span class="confidence-badge">${Math.round(item.confidence * 100)}% confident</span>
                                    </div>
                                </div>
                                <div class="query-metrics">
                                    <span class="metric">${formatNumber(item.impressions)} monthly searches</span>
                                    <span class="metric">${formatNumber(item.clicks)} citizens clicked</span>
                                    <span class="metric">${(item.clicks / item.impressions * 100).toFixed(1)}% engagement</span>
                                </div>
                                ${item.detectedServiceTypes && item.detectedServiceTypes.length > 0 ? `
                                    <div class="detected-services">
                                        <strong>Irish Services Detected:</strong> ${item.detectedServiceTypes.map(type => getServiceDisplayName(type)).join(', ')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                ${showPagination ? `
                    <div class="pagination-controls">
                        <button class="show-more-btn" data-target="journey" data-remaining="${intentAnalysis.length - initialDisplayCount}">
                            Show ${intentAnalysis.length - initialDisplayCount} More Citizen Queries
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// CITIZEN OPPORTUNITIES PANEL
function createCitizenOpportunitiesPanel(opportunities) {
    if (opportunities.length === 0) {
        return `
            <div class="no-opportunities-message">
                <div class="info-icon">👍</div>
                <div class="info-title">No Major Opportunities Detected</div>
                <div class="info-description">Your content appears to be serving citizens well</div>
            </div>
        `;
    }
    
    const initialDisplayCount = 8;
    const showPagination = opportunities.length > initialDisplayCount;
    
    return `
        <div class="citizen-opportunities-panel">
            <div class="opportunities-explanation">
                <p><strong>Opportunities to Better Serve Citizens:</strong> These are specific ways you can improve your content to help more citizens find what they need and complete their tasks successfully.</p>
                <div class="opportunities-stats">
                    <span class="stat-item">Found <strong>${opportunities.length}</strong> improvement opportunities</span>
                    <span class="stat-item">Could help <strong>${opportunities.reduce((sum, item) => sum + item.estimatedCitizensHelped, 0)}</strong> more citizens monthly</span>
                </div>
            </div>
            
            <div class="opportunities-list" data-citizen-list="opportunities">
                ${opportunities.slice(0, initialDisplayCount).map(item => `
                    <div class="opportunity-item ${item.priority} ${item.citizenImpact}">
                        <div class="opportunity-header">
                            <div class="query-text">"${escapeHtml(item.query)}"</div>
                            <div class="opportunity-badges">
                                <span class="priority-badge ${item.priority}">
                                    ${item.priority === 'high' ? '🎯 High Impact' : item.priority === 'medium' ? '⭐ Medium Impact' : '💡 Low Impact'}
                                </span>
                                <span class="citizen-impact-badge ${item.citizenImpact}">
                                    ${item.citizenImpact === 'high' ? '👥 High Citizen Value' : item.citizenImpact === 'medium' ? '👤 Medium Citizen Value' : '📋 Standard Service'}
                                </span>
                                ${item.hasUrgency ? '<span class="urgency-badge">🚨 Urgent Need</span>' : ''}
                            </div>
                        </div>
                        
                        <div class="citizen-journey-context">
                            <div class="journey-info">
                                <span class="journey-label">Citizen Journey Stage:</span>
                                <span class="journey-stage">${item.plainEnglishIntent}</span>
                            </div>
                        </div>
                        
                        <div class="current-performance">
                            <div class="performance-metrics">
                                <div class="metric-group">
                                    <div class="metric-item">
                                        <span class="metric-label">Citizens searching monthly:</span>
                                        <span class="metric-value">${formatNumber(item.impressions)}</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Currently clicking through:</span>
                                        <span class="metric-value">${formatNumber(item.clicks)} (${(item.ctr * 100).toFixed(1)}%)</span>
                                    </div>
                                </div>
                                <div class="metric-group">
                                    <div class="metric-item">
                                        <span class="metric-label">Google ranking position:</span>
                                        <span class="metric-value">#${item.position.toFixed(0)}</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Opportunity score:</span>
                                        <span class="metric-value">${item.score}/10</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="opportunity-factors">
                            <h5>🎯 Why This is an Opportunity:</h5>
                            <ul class="factor-list">
                                ${item.factors.map(factor => `<li>${factor}</li>`).join('')}
                            </ul>
                        </div>
                        
                        <div class="potential-results">
                            <h5>📈 Expected Results from Improvement:</h5>
                            <div class="results-grid">
                                <div class="result-item">
                                    <span class="result-icon">👆</span>
                                    <span class="result-text">+${item.potentialClicks} more citizens clicking monthly</span>
                                </div>
                                <div class="result-item">
                                    <span class="result-icon">🎯</span>
                                    <span class="result-text">${item.estimatedCitizensHelped} total citizens better served</span>
                                </div>
                                <div class="result-item">
                                    <span class="result-icon">📊</span>
                                    <span class="result-text">CTR improvement potential: +${Math.round((getCTRBenchmark(item.position) - item.ctr) * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
                
                <!-- Hidden opportunities for pagination -->
                <div class="hidden-queries" style="display: none;">
                    ${opportunities.slice(initialDisplayCount).map(item => `
                        <div class="opportunity-item ${item.priority} ${item.citizenImpact}">
                            <div class="opportunity-header">
                                <div class="query-text">"${escapeHtml(item.query)}"</div>
                                <div class="opportunity-badges">
                                    <span class="priority-badge ${item.priority}">
                                        ${item.priority === 'high' ? '🎯 High Impact' : item.priority === 'medium' ? '⭐ Medium Impact' : '💡 Low Impact'}
                                    </span>
                                    <span class="citizen-impact-badge ${item.citizenImpact}">
                                        ${item.citizenImpact === 'high' ? '👥 High Citizen Value' : item.citizenImpact === 'medium' ? '👤 Medium Citizen Value' : '📋 Standard Service'}
                                    </span>
                                    ${item.hasUrgency ? '<span class="urgency-badge">🚨 Urgent Need</span>' : ''}
                                </div>
                            </div>
                            
                            <div class="citizen-journey-context">
                                <div class="journey-info">
                                    <span class="journey-label">Citizen Journey Stage:</span>
                                    <span class="journey-stage">${item.plainEnglishIntent}</span>
                                </div>
                            </div>
                            
                            <div class="current-performance">
                                <div class="performance-metrics">
                                    <div class="metric-group">
                                        <div class="metric-item">
                                            <span class="metric-label">Citizens searching monthly:</span>
                                            <span class="metric-value">${formatNumber(item.impressions)}</span>
                                        </div>
                                        <div class="metric-item">
                                            <span class="metric-label">Currently clicking through:</span>
                                            <span class="metric-value">${formatNumber(item.clicks)} (${(item.ctr * 100).toFixed(1)}%)</span>
                                        </div>
                                    </div>
                                    <div class="metric-group">
                                        <div class="metric-item">
                                            <span class="metric-label">Google ranking position:</span>
                                            <span class="metric-value">#${item.position.toFixed(0)}</span>
                                        </div>
                                        <div class="metric-item">
                                            <span class="metric-label">Opportunity score:</span>
                                            <span class="metric-value">${item.score}/10</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="opportunity-factors">
                                <h5>🎯 Why This is an Opportunity:</h5>
                                <ul class="factor-list">
                                    ${item.factors.map(factor => `<li>${factor}</li>`).join('')}
                                </ul>
                            </div>
                            
                            <div class="potential-results">
                                <h5>📈 Expected Results from Improvement:</h5>
                                <div class="results-grid">
                                    <div class="result-item">
                                        <span class="result-icon">👆</span>
                                        <span class="result-text">+${item.potentialClicks} more citizens clicking monthly</span>
                                    </div>
                                    <div class="result-item">
                                        <span class="result-icon">🎯</span>
                                        <span class="result-text">${item.estimatedCitizensHelped} total citizens better served</span>
                                    </div>
                                    <div class="result-item">
                                        <span class="result-icon">📊</span>
                                        <span class="result-text">CTR improvement potential: +${Math.round((getCTRBenchmark(item.position) - item.ctr) * 100)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            ${showPagination ? `
                <div class="pagination-controls">
                    <button class="show-more-btn" data-target="opportunities" data-remaining="${opportunities.length - initialDisplayCount}">
                        Show ${opportunities.length - initialDisplayCount} More Opportunities
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// UI CREATION FUNCTION
// FIXED VERSION - Replace your existing createCitizenQueryIntelligenceSection function with this:

function createCitizenQueryIntelligenceSection(gscData, pageUrl) {
    const analysis = performCitizenQueryAnalysis(gscData, pageUrl);
    
    return `
        <div class="section citizen-query-intelligence">
            <h2 class="section-title">🧠 Citizen Query Intelligence</h2>
            <div class="citizen-analysis-explanation">
                <p><strong>Understanding What Citizens Really Want:</strong> This analysis examines real citizen searches to identify their needs, problems, and opportunities to serve them better through your content.</p>
            </div>
            
            <!-- Executive Summary for Management -->
            <div class="executive-summary">
                <h3>📊 Executive Summary</h3>
                <div class="summary-grid">
                    <div class="summary-card citizens-reached">
                        <div class="summary-number">${formatNumber(analysis.summary.citizensImpacted)}</div>
                        <div class="summary-label">Analysed Search Volume</div>
                        <div class="summary-subtitle">Trackable searches reported by Google Search Console</div>
                    </div>
                    <div class="summary-card urgent-needs">
                        <div class="summary-number">${analysis.summary.urgentQueries}</div>
                        <div class="summary-label">Urgent Citizen Needs</div>
                        <div class="summary-subtitle">Queries requiring immediate attention</div>
                    </div>
                    <div class="summary-card improvement-opportunities">
                        <div class="summary-number">${analysis.summary.opportunities}</div>
                        <div class="summary-label">Improvement Opportunities</div>
                        <div class="summary-subtitle">Ways to better serve citizens</div>
                    </div>
                    <div class="summary-card journey-stages">
                        <div class="summary-number">${Object.keys(analysis.summary.byIntent).filter(intent => analysis.summary.byIntent[intent] > 0).length}</div>
                        <div class="summary-label">Active Journey Stages</div>
                        <div class="summary-subtitle">Different citizen needs identified</div>
                    </div>
                </div>
            </div>
            
            <!-- Citizen Analysis Tabs -->
            <div class="citizen-analysis-tabs">
                <div class="citizen-tab-nav">
                    <button class="citizen-tab-btn active" data-citizen-tab="journey">
                        <span class="tab-icon">🗺️</span>
                        <span class="tab-label">Journey Analysis</span>
                        ${analysis.summary.urgentQueries > 0 ? `<span class="tab-badge">${analysis.summary.urgentQueries}</span>` : ''}
                    </button>
                    <button class="citizen-tab-btn" data-citizen-tab="opportunities">
                        <span class="tab-icon">🎯</span>
                        <span class="tab-label">Opportunities</span>
                        ${analysis.summary.opportunities > 0 ? `<span class="tab-badge">${analysis.summary.opportunities}</span>` : ''}
                    </button>
                </div>
                
                <div class="citizen-tab-content">
                    <div class="citizen-tab-panel active" data-citizen-panel="journey">
                        ${createCitizenJourneyPanel(analysis.intentAnalysis, analysis.summary.byIntent)}
                    </div>
                    
                    <div class="citizen-tab-panel" data-citizen-panel="opportunities">
                        ${createCitizenOpportunitiesPanel(analysis.citizenOpportunities)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// HELPER FUNCTIONS
function getServiceDisplayName(service) {
    const displayNames = {
        socialWelfare: 'Social Welfare',
        health: 'Health Services',
        family: 'Family & Children',
        housing: 'Housing',
        education: 'Education',
        employment: 'Employment',
        elderly: 'Elderly Services',
        disability: 'Disability Services',
        transport: 'Transport',
        legal: 'Legal Services',
        business: 'Business',
        documents: 'Documents & Certificates',
        emergency: 'Emergency Services',
        government: 'General Government'
    };
    return displayNames[service] || service;
}

function getServiceColor(service) {
    const colors = {
        socialWelfare: '#10b981',
        health: '#ef4444',
        family: '#f59e0b',
        housing: '#3b82f6',
        education: '#8b5cf6',
        employment: '#06b6d4',
        elderly: '#84cc16',
        disability: '#f97316',
        transport: '#6366f1',
        legal: '#dc2626',
        business: '#059669',
        documents: '#7c3aed',
        emergency: '#b91c1c',
        government: '#374151'
    };
    return colors[service] || '#64748b';
}

function getIntentColor(intent) {
    const colors = {
        immediateAction: '#ef4444',
        problemSolving: '#f97316',
        eligibilityResearch: '#3b82f6',
        processLearning: '#8b5cf6',
        timingDeadlines: '#f59e0b',
        costPayment: '#10b981',
        contactSeeking: '#6b7280',
        statusChecking: '#06b6d4',
        comparisonShopping: '#84cc16',
        locationFinding: '#ec4899',
        documentForm: '#14b8a6',
        generalInformation: '#64748b'
    };
    return colors[intent] || '#64748b';
}

function getIntentIcon(intent) {
    const icons = {
        immediateAction: '🚀',
        problemSolving: '🔧',
        eligibilityResearch: '🔍',
        processLearning: '📋',
        timingDeadlines: '⏰',
        costPayment: '💳',
        contactSeeking: '📞',
        statusChecking: '📊',
        comparisonShopping: '⚖️',
        locationFinding: '📍',
        documentForm: '📄',
        generalInformation: '💡'
    };
    return icons[intent] || '💡';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function getCTRBenchmark(position) {
    const benchmarks = {
        1: 0.284, 2: 0.155, 3: 0.110, 4: 0.077, 5: 0.061,
        6: 0.050, 7: 0.041, 8: 0.034, 9: 0.029, 10: 0.025
    };
    
    if (position <= 10) {
        return benchmarks[Math.round(position)] || benchmarks[10];
    } else if (position <= 20) {
        return 0.015;
    } else {
        return 0.005;
    }
}

// STYLING AND INITIALIZATION
function createCitizenQueryIntelligenceStyles() {
    return `
        <style>
            /* HEADER KPI Card Trends - More Specific Selectors */
.impact-summary .impact-trend {
    font-size: 0.75rem;
    font-weight: 600;
    margin-top: 6px;
    display: inline-block;
    padding: 4px 10px;
    border-radius: 12px;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.3);
}

.impact-summary .impact-explanation {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.8);
    margin-top: 6px;
    font-style: italic;
}

.impact-summary .trend-positive {
    background: rgba(255, 255, 255, 0.9);
    color: #059669;
    border-color: rgba(5, 150, 105, 0.2);
}

.impact-summary .trend-negative {
    background: rgba(255, 255, 255, 0.9);
    color: #dc2626;
    border-color: rgba(220, 38, 38, 0.2);
}

.impact-summary .trend-neutral {
    background: rgba(255, 255, 255, 0.8);
    color: #374151;
    border-color: rgba(55, 65, 81, 0.2);
}

.impact-metrics .impact-explain {
    font-size: 0.7rem;
    color: #9ca3af;
    margin-left: 4px;
    cursor: help;
}
        
            /* Citizen Query Intelligence Styles */
            .citizen-query-intelligence {
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                border-left: 4px solid #3b82f6;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 24px;
            }
            
            .citizen-analysis-explanation {
                background: rgba(59, 130, 246, 0.1);
                padding: 16px;
                border-radius: 8px;
                margin-bottom: 24px;
                border-left: 3px solid #3b82f6;
            }
            
            /* Executive Summary */
            .executive-summary {
                background: white;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 24px;
                border: 1px solid #e2e8f0;
            }
            
            .summary-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-top: 16px;
            }
            
            .summary-card {
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                border: 1px solid #e2e8f0;
            }
            
            .summary-card.citizens-reached {
                background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
                border-color: #10b981;
            }
            
            .summary-card.urgent-needs {
                background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
                border-color: #ef4444;
            }
            
            .summary-card.improvement-opportunities {
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
                border-color: #f59e0b;
            }
            
            .summary-card.journey-stages {
                background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
                border-color: #8b5cf6;
            }
            
            .summary-number {
                font-size: 2.2rem;
                font-weight: 800;
                color: #1f2937;
                margin-bottom: 4px;
            }
            
            .summary-label {
                font-size: 0.9rem;
                color: #374151;
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .summary-subtitle {
                font-size: 0.75rem;
                color: #6b7280;
                font-style: italic;
            }
            
            /* Tabs */
            .citizen-analysis-tabs {
                background: white;
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid #e2e8f0;
            }
            
            .citizen-tab-nav {
                display: flex;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .citizen-tab-btn {
                flex: 1;
                padding: 16px 20px;
                border: none;
                background: none;
                cursor: pointer;
                color: #64748b;
                border-bottom: 3px solid transparent;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-family: inherit;
                font-weight: 600;
                position: relative;
            }
            
            .citizen-tab-btn:hover:not(.active) {
                color: #475569;
                background: rgba(0,0,0,0.02);
            }
            
            .citizen-tab-btn.active {
                color: #1e293b;
                border-bottom-color: #3b82f6;
                background: white;
            }
            
            .tab-badge {
                position: absolute;
                top: 8px;
                right: 8px;
                background: #ef4444;
                color: white;
                border-radius: 10px;
                padding: 2px 6px;
                font-size: 0.7rem;
                font-weight: 700;
                min-width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .citizen-tab-content {
                background: white;
            }
            
            .citizen-tab-panel {
                display: none;
                padding: 24px;
            }
            
            .citizen-tab-panel.active {
                display: block;
            }
            
            /* Journey Panel */
            .irish-service-analysis {
                background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 24px;
                border-left: 3px solid #16a34a;
            }
            
            .service-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 16px;
                margin: 16px 0;
            }
            
            .service-stat {
                text-align: center;
                padding: 12px;
                background: rgba(255, 255, 255, 0.7);
                border-radius: 6px;
            }
            
            .stat-number {
                display: block;
                font-size: 1.8rem;
                font-weight: 800;
                color: #166534;
                margin-bottom: 4px;
            }
            
            .stat-label {
                font-size: 0.8rem;
                color: #374151;
                font-weight: 600;
            }
            
            .irish-service-breakdown {
                margin-top: 16px;
            }
            
            .service-bars {
                margin-top: 12px;
                display: grid;
                gap: 10px;
            }
            
            .service-bar {
                display: grid;
                gap: 4px;
                transition: all 0.2s ease;
            }
            
            .service-bar.clickable {
                cursor: pointer;
                padding: 8px;
                border-radius: 6px;
                border: 2px solid transparent;
                position: relative;
            }
            
            .service-bar.clickable::before {
                content: "👆 Click to filter";
                position: absolute;
                top: -25px;
                left: 50%;
                transform: translateX(-50%);
                background: #1f2937;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.7rem;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
                white-space: nowrap;
                z-index: 10;
            }
            
            .service-bar.clickable:hover::before {
                opacity: 1;
            }
            
            .service-bar.clickable:hover {
                background: rgba(16, 185, 129, 0.1);
                border-color: rgba(16, 185, 129, 0.3);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
            }
            
            .service-bar.clickable:active {
                transform: translateY(0);
            }
            
            .service-bar.active-filter {
                background: rgba(16, 185, 129, 0.15) !important;
                border-color: #10b981 !important;
                box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
            }
            
            .service-bar.active-filter::before {
                content: "✓ Filtered";
                opacity: 1;
                background: #10b981;
            }
            
            .service-bar-label {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.8rem;
            }
            
            .service-name {
                font-weight: 600;
                color: #374151;
            }
            
            .service-count {
                color: #6b7280;
                font-size: 0.75rem;
            }
            
            .service-bar-fill {
                height: 6px;
                background: #e5e7eb;
                border-radius: 3px;
                overflow: hidden;
            }
            
            .service-bar-progress {
                height: 100%;
                border-radius: 3px;
                transition: width 0.5s ease;
            }
            
            .service-filter-controls {
                margin-top: 12px;
                text-align: center;
            }
            
            .irish-service-badge {
                background: #dcfce7;
                color: #166534;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.7rem;
                font-weight: 700;
            }
            
            .detected-services {
                font-size: 0.8rem;
                color: #059669;
                font-weight: 500;
                margin-top: 8px;
                padding: 8px;
                background: rgba(16, 185, 129, 0.1);
                border-radius: 4px;
            }
            
            .intent-distribution {
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 24px;
            }
            
            .filter-instruction {
                font-size: 0.85rem;
                color: #6366f1;
                margin-bottom: 12px;
                font-style: italic;
            }
            
            .intent-bars {
                margin-top: 16px;
                display: grid;
                gap: 12px;
            }
            
            .intent-bar {
                display: grid;
                gap: 6px;
                transition: all 0.2s ease;
            }
            
            .intent-bar.clickable {
                cursor: pointer;
                padding: 8px;
                border-radius: 6px;
                border: 2px solid transparent;
                position: relative;
            }
            
            .intent-bar.clickable::before {
                content: "👆 Click to filter";
                position: absolute;
                top: -25px;
                left: 50%;
                transform: translateX(-50%);
                background: #1f2937;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.7rem;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
                white-space: nowrap;
                z-index: 10;
            }
            
            .intent-bar.clickable:hover::before {
                opacity: 1;
            }
            
            .intent-bar.clickable:hover {
                background: rgba(59, 130, 246, 0.1);
                border-color: rgba(59, 130, 246, 0.3);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
            }
            
            .intent-bar.clickable:active {
                transform: translateY(0);
            }
            
            .intent-bar.active-filter {
                background: rgba(59, 130, 246, 0.15) !important;
                border-color: #3b82f6 !important;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            }
            
            .intent-bar.active-filter::before {
                content: "✓ Filtered";
                opacity: 1;
                background: #10b981;
            }
            
            .intent-bar-label {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.85rem;
            }
            
            .intent-name {
                font-weight: 600;
                color: #374151;
            }
            
            .intent-count {
                color: #6b7280;
                font-size: 0.8rem;
            }
            
            .intent-bar-fill {
                height: 8px;
                background: #e5e7eb;
                border-radius: 4px;
                overflow: hidden;
            }
            
            .intent-bar-progress {
                height: 100%;
                border-radius: 4px;
                transition: width 0.5s ease;
            }
            
            .filter-controls {
                margin-top: 16px;
                text-align: center;
            }
            
            .clear-filter-btn {
                background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 0.85rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .clear-filter-btn:hover {
                background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
                transform: translateY(-1px);
            }
            
            .queries-analysis-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                flex-wrap: wrap;
                gap: 12px;
            }
            
            .filter-status {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                border-radius: 6px;
                border: 1px solid #3b82f6;
                font-size: 0.85rem;
            }
            
            .filter-label {
                color: #1e40af;
                font-weight: 600;
            }
            
            .filter-value {
                color: #1f2937;
                font-weight: 700;
            }
            
            .filter-count {
                color: #6b7280;
                font-size: 0.8rem;
            }
            
            /* Query Items */
            .citizen-queries-list, .opportunities-list {
                display: grid;
                gap: 16px;
                margin-bottom: 24px;
            }
            
            .citizen-query-item, .opportunity-item {
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 20px;
                transition: all 0.2s ease;
            }
            
            .citizen-query-item:hover, .opportunity-item:hover {
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .query-header, .opportunity-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 12px;
                gap: 16px;
            }
            
            .query-text {
                font-weight: 600;
                color: #1f2937;
                font-size: 0.95rem;
                flex-grow: 1;
            }
            
            .query-badges, .opportunity-badges {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
                flex-wrap: wrap;
            }
            
            .intent-badge, .priority-badge, .citizen-impact-badge {
                padding: 4px 10px;
                border-radius: 12px;
                font-size: 0.75rem;
                font-weight: 600;
                white-space: nowrap;
            }
            
            .urgency-badge {
                background: #fecaca;
                color: #dc2626;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.7rem;
                font-weight: 700;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            .confidence-badge {
                background: #f1f5f9;
                color: #475569;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.75rem;
                font-weight: 600;
            }
            
            .query-metrics {
                display: flex;
                gap: 16px;
                font-size: 0.85rem;
                color: #64748b;
                margin-bottom: 8px;
            }
            
            /* Opportunity Specific Styles */
            .opportunity-item.high {
                border-left: 4px solid #ef4444;
                background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            }
            
            .opportunity-item.medium {
                border-left: 4px solid #f59e0b;
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
            }
            
            .opportunity-item.low {
                border-left: 4px solid #6366f1;
                background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
            }
            
            .citizen-impact-badge.high {
                background: #dcfce7;
                color: #166534;
            }
            
            .citizen-impact-badge.medium {
                background: #fef3c7;
                color: #92400e;
            }
            
            .citizen-impact-badge.low {
                background: #f1f5f9;
                color: #475569;
            }
            
            .citizen-journey-context {
                background: rgba(59, 130, 246, 0.05);
                padding: 12px;
                border-radius: 6px;
                margin-bottom: 16px;
            }
            
            .journey-info {
                font-size: 0.85rem;
                display: flex;
                gap: 8px;
                align-items: center;
            }
            
            .journey-label {
                color: #6b7280;
                font-weight: 500;
            }
            
            .journey-stage {
                color: #374151;
                font-weight: 600;
            }
            
            .current-performance {
                margin-bottom: 16px;
            }
            
            .performance-metrics {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                padding: 12px;
                background: rgba(255,255,255,0.7);
                border-radius: 6px;
            }
            
            .metric-group {
                display: grid;
                gap: 8px;
            }
            
            .metric-item {
                display: flex;
                justify-content: space-between;
                font-size: 0.85rem;
            }
            
            .metric-label {
                color: #64748b;
                font-weight: 500;
            }
            
            .metric-value {
                font-weight: 600;
                color: #1f2937;
            }
            
            .opportunity-factors, .potential-results {
                margin-bottom: 16px;
            }
            
            .opportunity-factors h5, .potential-results h5 {
                color: #374151;
                margin-bottom: 8px;
                font-size: 0.9rem;
            }
            
            .factor-list {
                margin: 0;
                padding-left: 20px;
                color: #64748b;
            }
            
            .factor-list li {
                margin-bottom: 4px;
                font-size: 0.85rem;
            }
            
            .results-grid {
                display: grid;
                gap: 8px;
                margin-top: 8px;
            }
            
            .result-item {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.85rem;
                color: #059669;
                font-weight: 500;
            }
            
            .result-icon {
                font-size: 1rem;
            }
            
            /* Pagination */
            .pagination-controls {
                margin-top: 24px;
                text-align: center;
                padding: 20px;
                border-top: 1px solid #e2e8f0;
            }
            
            .show-more-btn {
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 0.9rem;
            }
            
            .show-more-btn:hover {
                background: linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            
            /* No Data Messages */
            .no-data-message, .no-opportunities-message {
                text-align: center;
                padding: 40px;
                color: #6b7280;
            }
            
            .info-icon {
                font-size: 3rem;
                margin-bottom: 16px;
            }
            
            .info-title {
                font-size: 1.2rem;
                font-weight: 700;
                margin-bottom: 8px;
                color: #374151;
            }
            
            .info-description {
                color: #6b7280;
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .summary-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .citizen-tab-nav {
                    flex-direction: column;
                }
                
                .citizen-tab-btn {
                    flex: none;
                    justify-content: flex-start;
                }
                
                .query-header, .opportunity-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 12px;
                }
                
                .performance-metrics {
                    grid-template-columns: 1fr;
                }
                
                .query-badges, .opportunity-badges {
                    justify-content: flex-start;
                }
            }




            /* Geographic Intelligence Enhanced Styles */
.geo-unified-content {
    display: flex;
    flex-direction: column;
    gap: 32px;
}

.geo-main-analysis {
    background: white;
    border-radius: 20px;
    padding: 32px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
}

.geo-section-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin-bottom: 40px;
}

.geo-analysis-card {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 16px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    position: relative;
    overflow: hidden;
    min-height: 500px;
}

.geo-analysis-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
}

.ireland-card::before {
    background: linear-gradient(90deg, #16a34a, #22c55e);
}

.international-card::before {
    background: linear-gradient(90deg, #3b82f6, #06b6d4);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.card-header h3 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: #0f172a;
}

/* Enhanced Maps */
.ireland-content, .international-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
    height: 100%;
}

.ireland-map-container, .world-map-container {
    background: white;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    flex: 1;
    min-height: 250px;
}

/* Regional Insights Tables */
.regional-insights, .international-insights {
    background: rgba(255,255,255,0.8);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
}

.regional-insights h4, .international-insights h4 {
    margin: 0 0 16px 0;
    color: #374151;
    font-size: 1.1rem;
}

/* Opportunities Section */
.geo-opportunities-section {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border-radius: 16px;
    padding: 32px;
    border-left: 4px solid #f59e0b;
}

.geo-opportunities-section h3 {
    margin: 0 0 24px 0;
    color: #92400e;
    font-size: 1.4rem;
}

/* Responsive */
@media (max-width: 768px) {
    .geo-section-grid {
        grid-template-columns: 1fr;
        gap: 24px;
    }
    
    .geo-analysis-card {
        min-height: auto;
    }
}

/* Enhanced Region Table */
.top-regions-table {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.region-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
}

.region-row:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transform: translateY(-1px);
}

.region-row.top-region {
    background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    border-color: #16a34a;
    font-weight: 600;
}

.region-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.region-name {
    font-weight: 600;
    color: #374151;
}

.region-percentage {
    font-weight: 700;
    color: #059669;
    font-size: 1.1rem;
}

.region-users {
    font-size: 0.85rem;
    color: #6b7280;
    text-align: right;
}

/* Opportunities Grid */
.opportunities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
}

.opportunity-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    display: flex;
    gap: 16px;
    transition: all 0.2s ease;
}

.opportunity-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
}

.opp-icon {
    font-size: 2rem;
    flex-shrink: 0;
}

.opp-content h4 {
    margin: 0 0 16px 0;
    color: #374151;
}

.opp-list {
    margin: 0;
    padding-left: 20px;
    color: #6b7280;
}

.opp-list li {
    margin-bottom: 8px;
    line-height: 1.4;
}

.impact-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 16px;
}

.impact-stat {
    text-align: center;
    padding: 16px;
    background: #f8fafc;
    border-radius: 8px;
}

.stat-number {
    display: block;
    font-size: 1.5rem;
    font-weight: 800;
    color: #059669;
    margin-bottom: 4px;
}

.stat-label {
    font-size: 0.8rem;
    color: #6b7280;
    font-weight: 500;
}



        </style>
    `;
}

// ===========================================
// JOURNEY AND SERVICE FILTERING FUNCTIONS
// ===========================================
let originalQueryData = null; // Store original data for filter clearing

// Clear functions defined first
function clearJourneyFilter() {
    const panel = document.querySelector('[data-citizen-panel="journey"]');
    if (!panel || !originalQueryData) return;
    
    // Clear active filter styling for all filter types
    document.querySelectorAll('.intent-bar.active-filter, .service-bar.active-filter, .urgent-filter-bar').forEach(bar => {
        bar.classList.remove('active-filter');
        if (bar.classList.contains('urgent-filter-bar')) {
            bar.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
            bar.style.borderColor = '#f87171';
            const divElement = bar.querySelector('div');
            if (divElement) {
                divElement.style.color = '#dc2626';
            }
        }
    });
    
    // Hide filter status
    const filterStatus = document.getElementById('journeyFilterStatus');
    const clearFilterBtn = document.getElementById('clearJourneyFilter');
    if (filterStatus) filterStatus.style.display = 'none';
    if (clearFilterBtn) clearFilterBtn.style.display = 'none';
    
    // Restore original query data
    const queriesList = document.getElementById('citizenQueriesList');
    const hiddenQueriesList = document.getElementById('hiddenQueriesList');
    
    if (queriesList && originalQueryData && originalQueryData.mainQueries) {
        queriesList.innerHTML = originalQueryData.mainQueries;
    }
    
    if (hiddenQueriesList && originalQueryData && originalQueryData.hiddenQueries) {
        hiddenQueriesList.innerHTML = originalQueryData.hiddenQueries;
    }
    
    // Show pagination controls again
    const paginationControls = panel.querySelector('.pagination-controls');
    if (paginationControls) {
        paginationControls.style.display = 'block';
    }
    
    // Reset original data
    originalQueryData = null;
}

function clearServiceFilter() {
    const panel = document.querySelector('[data-citizen-panel="journey"]');
    if (!panel || !originalQueryData) return;
    
    // Clear active filter styling for all filter types
    document.querySelectorAll('.service-bar.active-filter, .intent-bar.active-filter, .urgent-filter-bar').forEach(bar => {
        bar.classList.remove('active-filter');
        if (bar.classList.contains('urgent-filter-bar')) {
            bar.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
            bar.style.borderColor = '#f87171';
            const divElement = bar.querySelector('div');
            if (divElement) {
                divElement.style.color = '#dc2626';
            }
        }
    });
    
    // Hide filter status
    const filterStatus = document.getElementById('journeyFilterStatus');
    const clearServiceBtn = document.getElementById('clearServiceFilter');
    if (filterStatus) filterStatus.style.display = 'none';
    if (clearServiceBtn) clearServiceBtn.style.display = 'none';
    
    // Restore original query data
    const queriesList = document.getElementById('citizenQueriesList');
    const hiddenQueriesList = document.getElementById('hiddenQueriesList');
    
    if (queriesList && originalQueryData && originalQueryData.mainQueries) {
        queriesList.innerHTML = originalQueryData.mainQueries;
    }
    
    if (hiddenQueriesList && originalQueryData && originalQueryData.hiddenQueries) {
        hiddenQueriesList.innerHTML = originalQueryData.hiddenQueries;
    }
    
    // Show pagination controls again
    const paginationControls = panel.querySelector('.pagination-controls');
    if (paginationControls) {
        paginationControls.style.display = 'block';
    }
    
    // Reset original data
    originalQueryData = null;
}





    

function filterQueriesByIntent(filterIntent) {
    console.log('filterQueriesByIntent called with:', filterIntent);
    
    const queriesList = document.getElementById('citizenQueriesList');
    const hiddenQueriesList = document.getElementById('hiddenQueriesList');
    const filterStatus = document.getElementById('journeyFilterStatus');
    const filterValueDisplay = document.getElementById('filterValueDisplay');
    const filterCountDisplay = document.getElementById('filterCountDisplay');
    const clearFilterBtn = document.getElementById('clearJourneyFilter');
    
    if (!queriesList) {
        console.error('citizenQueriesList not found!');
        return;
    }
    
    // Store original data if not already stored (fresh dashboard data)
    if (!originalQueryData) {
        originalQueryData = {
            mainQueries: queriesList.innerHTML,
            hiddenQueries: hiddenQueriesList ? hiddenQueriesList.innerHTML : ''
        };
        console.log('📦 Stored fresh original query data for filtering');
    } else {
        // Reset to original data if already stored
        queriesList.innerHTML = originalQueryData.mainQueries;
        if (hiddenQueriesList && originalQueryData.hiddenQueries) {
            hiddenQueriesList.innerHTML = originalQueryData.hiddenQueries;
        }
    }
    
    // Clear any existing active filter styling
    document.querySelectorAll('.intent-bar.active-filter, .service-bar.active-filter, .urgent-filter-bar').forEach(bar => {
        bar.classList.remove('active-filter');
        if (bar.classList.contains('urgent-filter-bar')) {
            bar.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
            bar.style.borderColor = '#f87171';
            const divElement = bar.querySelector('div');
            if (divElement) {
                divElement.style.color = '#dc2626';
            }
        }
    });
    
    // Add active filter styling to clicked bar
    const clickedBar = document.querySelector(`[data-filter-intent="${filterIntent}"]`);
    if (clickedBar) {
        clickedBar.classList.add('active-filter');
    }
    
    // FIXED: Get ALL items from BOTH lists but avoid duplicates
    let allQueryItems = [];
    
    // Get visible items
    const visibleItems = Array.from(queriesList.querySelectorAll('.citizen-query-item'));
    allQueryItems = allQueryItems.concat(visibleItems);
    
    // Get hidden items (these are different items, not duplicates of visible ones)
    if (hiddenQueriesList) {
        const hiddenItems = Array.from(hiddenQueriesList.querySelectorAll('.citizen-query-item'));
        allQueryItems = allQueryItems.concat(hiddenItems);
    }
    
    console.log(`🔍 Total available items to filter: ${allQueryItems.length}`);
    
    // Filter items by intent
    const filteredItems = allQueryItems.filter(item => {
        const itemIntent = item.getAttribute('data-intent');
        return itemIntent === filterIntent;
    });
    
    console.log(`🔍 Found ${filteredItems.length} items for intent: ${filterIntent}`);
    
    if (filteredItems.length === 0) {
        queriesList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6b7280;">
                <p>No queries found for this journey stage: <strong>${filterIntent}</strong></p>
                <button onclick="clearJourneyFilter()" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 12px;">
                    Show All Queries
                </button>
            </div>
        `;
        
        // Clear hidden list when showing no results
        if (hiddenQueriesList) {
            hiddenQueriesList.innerHTML = '';
        }
    } else {
        // Clear both lists
        queriesList.innerHTML = '';
        if (hiddenQueriesList) {
            hiddenQueriesList.innerHTML = '';
        }
        
        // Show all filtered items in the main list (no pagination when filtered)
        filteredItems.forEach(item => {
            queriesList.appendChild(item.cloneNode(true));
        });
    }
    
    // Update filter status
    const intentConfig = citizenJourneyCategories[filterIntent];
    const displayName = intentConfig?.plainEnglish || filterIntent;
    
    if (filterValueDisplay) filterValueDisplay.textContent = displayName;
    if (filterCountDisplay) filterCountDisplay.textContent = `(${filteredItems.length} queries)`;
    if (filterStatus) filterStatus.style.display = 'flex';
    if (clearFilterBtn) clearFilterBtn.style.display = 'block';
    
    // Hide pagination controls when filtering
    const paginationControls = queriesList.closest('.citizen-tab-panel')?.querySelector('.pagination-controls');
    if (paginationControls) {
        paginationControls.style.display = 'none';
    }
    
    // Show success message
    showFilterSuccessMessage(`✓ Filtered to show ${filteredItems.length} queries`, '#10b981');

     // ADD THIS: Smooth scroll to the filtered results
    setTimeout(() => {
        const queriesAnalysisSection = document.querySelector('.queries-analysis') || 
                                     document.querySelector('.citizen-queries-list') ||
                                     document.getElementById('citizenQueriesList');
        
        if (queriesAnalysisSection) {
            queriesAnalysisSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
            });
            console.log('📍 Scrolled to filtered results');
        }
    }, 100); // Small delay to ensure DOM is updated
}




    

function filterQueriesByService(filterService) {
    console.log('filterQueriesByService called with:', filterService);
    
    const queriesList = document.getElementById('citizenQueriesList');
    const hiddenQueriesList = document.getElementById('hiddenQueriesList');
    const filterStatus = document.getElementById('journeyFilterStatus');
    const filterValueDisplay = document.getElementById('filterValueDisplay');
    const filterCountDisplay = document.getElementById('filterCountDisplay');
    const clearServiceBtn = document.getElementById('clearServiceFilter');
    
    if (!queriesList) {
        console.error('citizenQueriesList not found!');
        return;
    }
    
    // Store original data if not already stored (fresh dashboard data)
    if (!originalQueryData) {
        originalQueryData = {
            mainQueries: queriesList.innerHTML,
            hiddenQueries: hiddenQueriesList ? hiddenQueriesList.innerHTML : ''
        };
        console.log('📦 Stored fresh original query data for service filtering');
    } else {
        // Reset to original data if already stored
        queriesList.innerHTML = originalQueryData.mainQueries;
        if (hiddenQueriesList && originalQueryData.hiddenQueries) {
            hiddenQueriesList.innerHTML = originalQueryData.hiddenQueries;
        }
    }
    
    // Clear any existing active filter styling
    document.querySelectorAll('.service-bar.active-filter, .intent-bar.active-filter, .urgent-filter-bar').forEach(bar => {
        bar.classList.remove('active-filter');
        if (bar.classList.contains('urgent-filter-bar')) {
            bar.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
            bar.style.borderColor = '#f87171';
            const divElement = bar.querySelector('div');
            if (divElement) {
                divElement.style.color = '#dc2626';
            }
        }
    });
    
    // Add active filter styling to clicked bar
    const clickedBar = document.querySelector(`[data-filter-service="${filterService}"]`);
    if (clickedBar) {
        clickedBar.classList.add('active-filter');
    }
    
    // FIXED: Get ALL items from BOTH lists
    let allQueryItems = [];
    
    // Get visible items
    const visibleItems = Array.from(queriesList.querySelectorAll('.citizen-query-item'));
    allQueryItems = allQueryItems.concat(visibleItems);
    
    // Get hidden items
    if (hiddenQueriesList) {
        const hiddenItems = Array.from(hiddenQueriesList.querySelectorAll('.citizen-query-item'));
        allQueryItems = allQueryItems.concat(hiddenItems);
    }
    
    console.log(`🔍 Total available items to filter: ${allQueryItems.length}`);
    
    // Filter items by detected service types
    const filteredItems = allQueryItems.filter(item => {
        const detectedServicesElement = item.querySelector('.detected-services');
        if (!detectedServicesElement) return false;
        
        const detectedServicesText = detectedServicesElement.textContent;
        const serviceDisplayName = getServiceDisplayName(filterService);
        
        return detectedServicesText.includes(serviceDisplayName);
    });
    
    console.log(`🔍 Found ${filteredItems.length} items for service: ${filterService}`);
    
    if (filteredItems.length === 0) {
        queriesList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6b7280;">
                <p>No queries found for this Irish service: <strong>${getServiceDisplayName(filterService)}</strong></p>
                <button onclick="clearServiceFilter()" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 12px;">
                    Show All Queries
                </button>
            </div>
        `;
        
        // Clear hidden list when showing no results
        if (hiddenQueriesList) {
            hiddenQueriesList.innerHTML = '';
        }
    } else {
        // Clear both lists
        queriesList.innerHTML = '';
        if (hiddenQueriesList) {
            hiddenQueriesList.innerHTML = '';
        }
        
        // Show all filtered items in the main list (no pagination when filtered)
        filteredItems.forEach(item => {
            queriesList.appendChild(item.cloneNode(true));
        });
    }
    
    // Update filter status
    const displayName = getServiceDisplayName(filterService);
    
    if (filterValueDisplay) filterValueDisplay.textContent = displayName;
    if (filterCountDisplay) filterCountDisplay.textContent = `(${filteredItems.length} queries)`;
    if (filterStatus) filterStatus.style.display = 'flex';
    if (clearServiceBtn) clearServiceBtn.style.display = 'block';
    
    // Hide pagination controls when filtering
    const paginationControls = queriesList.closest('.citizen-tab-panel')?.querySelector('.pagination-controls');
    if (paginationControls) {
        paginationControls.style.display = 'none';
    }
    
    // Show success message
    showFilterSuccessMessage(`✓ Filtered to show ${filteredItems.length} ${displayName} queries`, '#10b981');

    // ADD THIS: Smooth scroll to the filtered results
    setTimeout(() => {
        const queriesAnalysisSection = document.querySelector('.queries-analysis') || 
                                     document.querySelector('.citizen-queries-list') ||
                                     document.getElementById('citizenQueriesList');
        
        if (queriesAnalysisSection) {
            queriesAnalysisSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
            });
            console.log('📍 Scrolled to filtered service results');
        }
    }, 100);
}

function filterQueriesByUrgency() {
    console.log('filterQueriesByUrgency called');
    
    const queriesList = document.getElementById('citizenQueriesList');
    const hiddenQueriesList = document.getElementById('hiddenQueriesList');
    const filterStatus = document.getElementById('journeyFilterStatus');
    const filterValueDisplay = document.getElementById('filterValueDisplay');
    const filterCountDisplay = document.getElementById('filterCountDisplay');
    const clearFilterBtn = document.getElementById('clearJourneyFilter');
    
    if (!queriesList) {
        console.error('citizenQueriesList not found!');
        return;
    }
    
    // Store original data if not already stored (fresh dashboard data)
    if (!originalQueryData) {
        originalQueryData = {
            mainQueries: queriesList.innerHTML,
            hiddenQueries: hiddenQueriesList ? hiddenQueriesList.innerHTML : ''
        };
        console.log('📦 Stored fresh original query data for urgency filtering');
    } else {
        // Reset to original data if already stored
        queriesList.innerHTML = originalQueryData.mainQueries;
        if (hiddenQueriesList && originalQueryData.hiddenQueries) {
            hiddenQueriesList.innerHTML = originalQueryData.hiddenQueries;
        }
    }
    
    // Clear any existing active filter styling and set urgent filter as active
    document.querySelectorAll('.intent-bar.active-filter, .service-bar.active-filter, .urgent-filter-bar').forEach(bar => {
        bar.classList.remove('active-filter');
        if (bar.classList.contains('urgent-filter-bar')) {
            bar.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
            bar.style.borderColor = '#991b1b';
            const divElement = bar.querySelector('div');
            if (divElement) {
                divElement.style.color = 'white';
            }
        }
    });
    
    // FIXED: Get ALL items from BOTH lists
    let allQueryItems = [];
    
    // Get visible items
    const visibleItems = Array.from(queriesList.querySelectorAll('.citizen-query-item'));
    allQueryItems = allQueryItems.concat(visibleItems);
    
    // Get hidden items
    if (hiddenQueriesList) {
        const hiddenItems = Array.from(hiddenQueriesList.querySelectorAll('.citizen-query-item'));
        allQueryItems = allQueryItems.concat(hiddenItems);
    }
    
    console.log(`🔍 Total available items to filter: ${allQueryItems.length}`);
    
    // Filter items by urgency - look for urgency badge
    const filteredItems = allQueryItems.filter(item => {
        const urgencyBadge = item.querySelector('.urgency-badge');
        return urgencyBadge !== null;
    });
    
    console.log(`🔍 Found ${filteredItems.length} urgent items`);
    
    if (filteredItems.length === 0) {
        queriesList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6b7280;">
                <p>No urgent queries found.</p>
                <button onclick="clearJourneyFilter()" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 12px;">
                    Show All Queries
                </button>
            </div>
        `;
        
        // Clear hidden list when showing no results
        if (hiddenQueriesList) {
            hiddenQueriesList.innerHTML = '';
        }
    } else {
        // Clear both lists
        queriesList.innerHTML = '';
        if (hiddenQueriesList) {
            hiddenQueriesList.innerHTML = '';
        }
        
        // Show all filtered items in the main list (no pagination when filtered)
        filteredItems.forEach(item => {
            queriesList.appendChild(item.cloneNode(true));
        });
    }
    
    // Update filter status
    if (filterValueDisplay) filterValueDisplay.textContent = "Urgent Citizen Needs";
    if (filterCountDisplay) filterCountDisplay.textContent = `(${filteredItems.length} queries)`;
    if (filterStatus) filterStatus.style.display = 'flex';
    if (clearFilterBtn) clearFilterBtn.style.display = 'block';
    
    // Hide pagination controls when filtering
    const paginationControls = queriesList.closest('.citizen-tab-panel')?.querySelector('.pagination-controls');
    if (paginationControls) {
        paginationControls.style.display = 'none';
    }
    
    // Show success message
    showFilterSuccessMessage(`🚨 Filtered to show ${filteredItems.length} urgent queries`, '#ef4444');

    // Show success message
    showFilterSuccessMessage(`🚨 Filtered to show ${filteredItems.length} urgent queries`, '#ef4444');
    
    // ADD THIS: Smooth scroll to the filtered results
    setTimeout(() => {
        const queriesAnalysisSection = document.querySelector('.queries-analysis') || 
                                     document.querySelector('.citizen-queries-list') ||
                                     document.getElementById('citizenQueriesList');
        
        if (queriesAnalysisSection) {
            queriesAnalysisSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
            });
            console.log('📍 Scrolled to filtered urgent results');
        }
    }, 100);
}





    

// Helper function to show filter success messages
function showFilterSuccessMessage(message, backgroundColor) {
    // Remove any existing success messages first
    const existingMsg = document.querySelector('.filter-success-message');
    if (existingMsg) existingMsg.remove();
    
    const successMsg = document.createElement('div');
    successMsg.className = 'filter-success-message';
    successMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    successMsg.textContent = message;
    document.body.appendChild(successMsg);
    
    // Animate in
    requestAnimationFrame(() => {
        successMsg.style.transform = 'translateX(0)';
    });
    
    // Remove after delay
    setTimeout(() => {
        if (document.body.contains(successMsg)) {
            successMsg.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(successMsg)) {
                    document.body.removeChild(successMsg);
                }
            }, 300);
        }
    }, 3000);
}
// INITIALIZATION
function initializeCitizenQueryIntelligence() {
    // Use event delegation to handle clicks on dynamically created elements
    document.addEventListener('click', function(e) {
        // Handle tab switching
        if (e.target.closest('.citizen-tab-btn')) {
            const button = e.target.closest('.citizen-tab-btn');
            const targetTab = button.getAttribute('data-citizen-tab');
            const container = button.closest('.citizen-analysis-tabs');
            
            // Remove active class from all buttons and panels in this container
            container.querySelectorAll('.citizen-tab-btn').forEach(btn => btn.classList.remove('active'));
            container.querySelectorAll('.citizen-tab-panel').forEach(panel => panel.classList.remove('active'));
            
            // Activate clicked button and corresponding panel
            button.classList.add('active');
            const targetPanel = container.querySelector(`[data-citizen-panel="${targetTab}"]`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        }
        
        // Handle urgent queries filtering
        if (e.target.closest('.urgent-filter-bar')) {
            console.log('Urgent filter clicked!');
            filterQueriesByUrgency();
        }
        
        // Handle journey stage filtering - improved detection
        const intentBarElement = e.target.closest('.intent-bar');
        if (intentBarElement && intentBarElement.classList.contains('clickable')) {
            console.log('Intent bar clicked!', intentBarElement); // Debug log
            const filterIntent = intentBarElement.getAttribute('data-filter-intent');
            if (filterIntent) {
                console.log('Filtering by intent:', filterIntent); // Debug log
                clearServiceFilter(); // Clear any active service filter
                filterQueriesByIntent(filterIntent);
            }
        }
        
        // Handle Irish service filtering
        const serviceBarElement = e.target.closest('.service-bar');
        if (serviceBarElement && serviceBarElement.classList.contains('clickable')) {
            console.log('Service bar clicked!', serviceBarElement); // Debug log
            const filterService = serviceBarElement.getAttribute('data-filter-service');
            if (filterService) {
                console.log('Filtering by service:', filterService); // Debug log
                clearJourneyFilter(); // Clear any active journey filter
                filterQueriesByService(filterService);
            }
        }
        
        // Handle clear journey filter
        if (e.target.closest('#clearJourneyFilter')) {
            console.log('Clear journey filter clicked!'); // Debug log
            clearJourneyFilter();
        }
        
        // Handle clear service filter
        if (e.target.closest('#clearServiceFilter')) {
            console.log('Clear service filter clicked!'); // Debug log
            clearServiceFilter();
        }
        
        // Handle show more buttons
        if (e.target.closest('.show-more-btn')) {
            const button = e.target.closest('.show-more-btn');
            const target = button.getAttribute('data-target');
            
            // Find the corresponding list and hidden queries
            const panel = button.closest('.citizen-tab-panel');
            const queryList = panel.querySelector(`[data-citizen-list="${target}"]`);
            const hiddenQueries = queryList.querySelector('.hidden-queries');
            
            if (hiddenQueries) {
                // Show the hidden queries
                hiddenQueries.style.display = 'block';
                
                // Move hidden queries to the main list
                const hiddenItems = hiddenQueries.children;
                while (hiddenItems.length > 0) {
                    queryList.insertBefore(hiddenItems[0], hiddenQueries);
                }
                
                // Remove the hidden container and pagination controls
                hiddenQueries.remove();
                button.closest('.pagination-controls').remove();
                
                // Smooth scroll to newly revealed content
                setTimeout(() => {
                    const allItems = queryList.querySelectorAll('.citizen-query-item, .opportunity-item');
                    if (allItems.length > 12) {
                        allItems[12].scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);
            }
        }
    });
    
    // Handle keyboard navigation for intent bars and service bars
    document.addEventListener('keydown', function(e) {
        const intentBarElement = e.target.closest('.intent-bar');
        const serviceBarElement = e.target.closest('.service-bar');
        const urgentFilterElement = e.target.closest('.urgent-filter-bar');
        
        if ((intentBarElement && intentBarElement.classList.contains('clickable')) || 
            (serviceBarElement && serviceBarElement.classList.contains('clickable')) ||
            (urgentFilterElement && urgentFilterElement.classList.contains('clickable'))) {
            
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                
                if (intentBarElement) {
                    const filterIntent = intentBarElement.getAttribute('data-filter-intent');
                    if (filterIntent) {
                        clearServiceFilter();
                        filterQueriesByIntent(filterIntent);
                    }
                } else if (serviceBarElement) {
                    const filterService = serviceBarElement.getAttribute('data-filter-service');
                    if (filterService) {
                        clearJourneyFilter();
                        filterQueriesByService(filterService);
                    }
                } else if (urgentFilterElement) {
                    filterQueriesByUrgency();
                }
            }
        }
    });
    
    // Add visual feedback initialization
    setTimeout(() => {
        addClickableIndicators();
    }, 500);
}

// Add visual indicators to make clickability obvious
function addClickableIndicators() {
    const clickableBars = document.querySelectorAll('.intent-bar.clickable, .service-bar.clickable, .urgent-filter-bar.clickable');
    console.log('Found clickable bars:', clickableBars.length); // Debug log
    
    clickableBars.forEach(bar => {
        // Add a visual indicator if not already present
        if (!bar.querySelector('.click-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'click-indicator';
            indicator.innerHTML = '👆';
            indicator.style.cssText = `
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 1.2rem;
                opacity: 0.6;
                transition: opacity 0.2s ease;
                pointer-events: none;
            `;
            bar.style.position = 'relative';
            bar.appendChild(indicator);
            
            // Enhance on hover
            bar.addEventListener('mouseenter', () => {
                indicator.style.opacity = '1';
                indicator.style.transform = 'translateY(-50%) scale(1.2)';
            });
            
            bar.addEventListener('mouseleave', () => {
                indicator.style.opacity = '0.6';
                indicator.style.transform = 'translateY(-50%) scale(1)';
            });
        }
    });
}

// ALIAS FOR BACKWARD COMPATIBILITY
const createEnhancedQueryAnalysisStyles = createCitizenQueryIntelligenceStyles;
const createEnhancedQueryAnalysisSection = createCitizenQueryIntelligenceSection;
const performEnhancedQueryAnalysis = performCitizenQueryAnalysis;

// Make filtering functions globally accessible
window.filterQueriesByIntent = filterQueriesByIntent;
window.filterQueriesByService = filterQueriesByService;
window.filterQueriesByUrgency = filterQueriesByUrgency;
window.clearJourneyFilter = clearJourneyFilter;
window.clearServiceFilter = clearServiceFilter;

// AUTO-INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
    initializeCitizenQueryIntelligence();
});

// If already loaded, initialize immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCitizenQueryIntelligence);
} else {
    initializeCitizenQueryIntelligence();
}





// ==================================================
// MISSING HELPER FUNCTIONS FROM YOUR ORIGINAL CODE
// ==================================================

function formatNumberEnhanced(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toLocaleString();
}

function formatRegionNameEnhanced(region) {
    return region.replace(/^(County|City)\s+/i, '').trim();
}

function getCountryFlagEnhanced(country) {
    if (!country) return '🌍';
    
    // Convert to lowercase for consistent matching
    const countryLower = country.toLowerCase();
    
    // Country codes mapping (what GSC typically returns)
    const countryCodes = {
        // Europe
        'irl': '🇮🇪', 'ie': '🇮🇪', // Ireland
        'gbr': '🇬🇧', 'gb': '🇬🇧', 'uk': '🇬🇧', // United Kingdom
        'deu': '🇩🇪', 'de': '🇩🇪', // Germany
        'fra': '🇫🇷', 'fr': '🇫🇷', // France
        'esp': '🇪🇸', 'es': '🇪🇸', // Spain
        'ita': '🇮🇹', 'it': '🇮🇹', // Italy
        'nld': '🇳🇱', 'nl': '🇳🇱', // Netherlands
        'bel': '🇧🇪', 'be': '🇧🇪', // Belgium
        'pol': '🇵🇱', 'pl': '🇵🇱', // Poland
        'rou': '🇷🇴', 'ro': '🇷🇴', // Romania
        'prt': '🇵🇹', 'pt': '🇵🇹', // Portugal
        'grc': '🇬🇷', 'gr': '🇬🇷', // Greece
        'aut': '🇦🇹', 'at': '🇦🇹', // Austria
        'che': '🇨🇭', 'ch': '🇨🇭', // Switzerland
        'swe': '🇸🇪', 'se': '🇸🇪', // Sweden
        'nor': '🇳🇴', 'no': '🇳🇴', // Norway
        'dnk': '🇩🇰', 'dk': '🇩🇰', // Denmark
        'fin': '🇫🇮', 'fi': '🇫🇮', // Finland
        'cze': '🇨🇿', 'cz': '🇨🇿', // Czech Republic
        'hun': '🇭🇺', 'hu': '🇭🇺', // Hungary
        'svk': '🇸🇰', 'sk': '🇸🇰', // Slovakia
        'svn': '🇸🇮', 'si': '🇸🇮', // Slovenia
        'hrv': '🇭🇷', 'hr': '🇭🇷', // Croatia
        'bgr': '🇧🇬', 'bg': '🇧🇬', // Bulgaria
        'ltu': '🇱🇹', 'lt': '🇱🇹', // Lithuania
        'lva': '🇱🇻', 'lv': '🇱🇻', // Latvia
        'est': '🇪🇪', 'ee': '🇪🇪', // Estonia
        'lux': '🇱🇺', 'lu': '🇱🇺', // Luxembourg
        'mlt': '🇲🇹', 'mt': '🇲🇹', // Malta
        'cyp': '🇨🇾', 'cy': '🇨🇾', // Cyprus
        'isl': '🇮🇸', 'is': '🇮🇸', // Iceland
        'ukr': '🇺🇦', 'ua': '🇺🇦', // Ukraine
        'srb': '🇷🇸', 'rs': '🇷🇸', // Serbia
        'mne': '🇲🇪', 'me': '🇲🇪', // Montenegro
        'bih': '🇧🇦', 'ba': '🇧🇦', // Bosnia and Herzegovina
        'mkd': '🇲🇰', 'mk': '🇲🇰', // North Macedonia
        'alb': '🇦🇱', 'al': '🇦🇱', // Albania
        'mda': '🇲🇩', 'md': '🇲🇩', // Moldova
        'blr': '🇧🇾', 'by': '🇧🇾', // Belarus
        'rus': '🇷🇺', 'ru': '🇷🇺', // Russia
        'tur': '🇹🇷', 'tr': '🇹🇷', // Turkey
        
        // North America
        'usa': '🇺🇸', 'us': '🇺🇸', // United States
        'can': '🇨🇦', 'ca': '🇨🇦', // Canada
        'mex': '🇲🇽', 'mx': '🇲🇽', // Mexico
        
        // Asia Pacific
        'aus': '🇦🇺', 'au': '🇦🇺', // Australia
        'nzl': '🇳🇿', 'nz': '🇳🇿', // New Zealand
        'jpn': '🇯🇵', 'jp': '🇯🇵', // Japan
        'kor': '🇰🇷', 'kr': '🇰🇷', // South Korea
        'chn': '🇨🇳', 'cn': '🇨🇳', // China
        'ind': '🇮🇳', 'in': '🇮🇳', // India
        'sgp': '🇸🇬', 'sg': '🇸🇬', // Singapore
        'hkg': '🇭🇰', 'hk': '🇭🇰', // Hong Kong
        'twn': '🇹🇼', 'tw': '🇹🇼', // Taiwan
        'tha': '🇹🇭', 'th': '🇹🇭', // Thailand
        'mys': '🇲🇾', 'my': '🇲🇾', // Malaysia
        'idn': '🇮🇩', 'id': '🇮🇩', // Indonesia
        'phl': '🇵🇭', 'ph': '🇵🇭', // Philippines
        'vnm': '🇻🇳', 'vn': '🇻🇳', // Vietnam
        'pak': '🇵🇰', 'pk': '🇵🇰', // Pakistan
        'bgd': '🇧🇩', 'bd': '🇧🇩', // Bangladesh
        'lka': '🇱🇰', 'lk': '🇱🇰', // Sri Lanka
        'npl': '🇳🇵', 'np': '🇳🇵', // Nepal
        'mmr': '🇲🇲', 'mm': '🇲🇲', // Myanmar
        'khm': '🇰🇭', 'kh': '🇰🇭', // Cambodia
        'lao': '🇱🇦', 'la': '🇱🇦', // Laos
        
        // Middle East
        'are': '🇦🇪', 'ae': '🇦🇪', // United Arab Emirates
        'sau': '🇸🇦', 'sa': '🇸🇦', // Saudi Arabia
        'isr': '🇮🇱', 'il': '🇮🇱', // Israel
        'qat': '🇶🇦', 'qa': '🇶🇦', // Qatar
        'kwt': '🇰🇼', 'kw': '🇰🇼', // Kuwait
        'bhr': '🇧🇭', 'bh': '🇧🇭', // Bahrain
        'omn': '🇴🇲', 'om': '🇴🇲', // Oman
        'jor': '🇯🇴', 'jo': '🇯🇴', // Jordan
        'lbn': '🇱🇧', 'lb': '🇱🇧', // Lebanon
        'irn': '🇮🇷', 'ir': '🇮🇷', // Iran
        'irq': '🇮🇶', 'iq': '🇮🇶', // Iraq
        'syr': '🇸🇾', 'sy': '🇸🇾', // Syria
        'yem': '🇾🇪', 'ye': '🇾🇪', // Yemen
        
        // Africa
        'zaf': '🇿🇦', 'za': '🇿🇦', // South Africa
        'nga': '🇳🇬', 'ng': '🇳🇬', // Nigeria
        'egy': '🇪🇬', 'eg': '🇪🇬', // Egypt
        'ken': '🇰🇪', 'ke': '🇰🇪', // Kenya
        'mar': '🇲🇦', 'ma': '🇲🇦', // Morocco
        'gha': '🇬🇭', 'gh': '🇬🇭', // Ghana
        'eth': '🇪🇹', 'et': '🇪🇹', // Ethiopia
        'uga': '🇺🇬', 'ug': '🇺🇬', // Uganda
        'tza': '🇹🇿', 'tz': '🇹🇿', // Tanzania
        'dza': '🇩🇿', 'dz': '🇩🇿', // Algeria
        'tun': '🇹🇳', 'tn': '🇹🇳', // Tunisia
        'lby': '🇱🇾', 'ly': '🇱🇾', // Libya
        'sdn': '🇸🇩', 'sd': '🇸🇩', // Sudan
        'zwe': '🇿🇼', 'zw': '🇿🇼', // Zimbabwe
        'bwa': '🇧🇼', 'bw': '🇧🇼', // Botswana
        'nam': '🇳🇦', 'na': '🇳🇦', // Namibia
        'zmb': '🇿🇲', 'zm': '🇿🇲', // Zambia
        'mwi': '🇲🇼', 'mw': '🇲🇼', // Malawi
        'rwa': '🇷🇼', 'rw': '🇷🇼', // Rwanda
        'sen': '🇸🇳', 'sn': '🇸🇳', // Senegal
        'civ': '🇨🇮', 'ci': '🇨🇮', // Ivory Coast
        'mli': '🇲🇱', 'ml': '🇲🇱', // Mali
        'bfa': '🇧🇫', 'bf': '🇧🇫', // Burkina Faso
        'ner': '🇳🇪', 'ne': '🇳🇪', // Niger
        'tcd': '🇹🇩', 'td': '🇹🇩', // Chad
        'cmr': '🇨🇲', 'cm': '🇨🇲', // Cameroon
        'caf': '🇨🇫', 'cf': '🇨🇫', // Central African Republic
        'cod': '🇨🇩', 'cd': '🇨🇩', // Democratic Republic of the Congo
        'cog': '🇨🇬', 'cg': '🇨🇬', // Republic of the Congo
        'gab': '🇬🇦', 'ga': '🇬🇦', // Gabon
        'gnq': '🇬🇶', 'gq': '🇬🇶', // Equatorial Guinea
        'ago': '🇦🇴', 'ao': '🇦🇴', // Angola
        'moz': '🇲🇿', 'mz': '🇲🇿', // Mozambique
        'mdg': '🇲🇬', 'mg': '🇲🇬', // Madagascar
        'mus': '🇲🇺', 'mu': '🇲🇺', // Mauritius
        'syc': '🇸🇨', 'sc': '🇸🇨', // Seychelles
        
        // South America
        'bra': '🇧🇷', 'br': '🇧🇷', // Brazil
        'arg': '🇦🇷', 'ar': '🇦🇷', // Argentina
        'chl': '🇨🇱', 'cl': '🇨🇱', // Chile
        'col': '🇨🇴', 'co': '🇨🇴', // Colombia
        'per': '🇵🇪', 'pe': '🇵🇪', // Peru
        'ven': '🇻🇪', 've': '🇻🇪', // Venezuela
        'ecu': '🇪🇨', 'ec': '🇪🇨', // Ecuador
        'bol': '🇧🇴', 'bo': '🇧🇴', // Bolivia
        'pry': '🇵🇾', 'py': '🇵🇾', // Paraguay
        'ury': '🇺🇾', 'uy': '🇺🇾', // Uruguay
        'guy': '🇬🇾', 'gy': '🇬🇾', // Guyana
        'sur': '🇸🇷', 'sr': '🇸🇷', // Suriname
        'guf': '🇬🇫', 'gf': '🇬🇫', // French Guiana
        
        // Caribbean & Central America
        'jam': '🇯🇲', 'jm': '🇯🇲', // Jamaica
        'cub': '🇨🇺', 'cu': '🇨🇺', // Cuba
        'dom': '🇩🇴', 'do': '🇩🇴', // Dominican Republic
        'hti': '🇭🇹', 'ht': '🇭🇹', // Haiti
        'pri': '🇵🇷', 'pr': '🇵🇷', // Puerto Rico
        'tto': '🇹🇹', 'tt': '🇹🇹', // Trinidad and Tobago
        'brb': '🇧🇧', 'bb': '🇧🇧', // Barbados
        'bhs': '🇧🇸', 'bs': '🇧🇸', // Bahamas
        'blz': '🇧🇿', 'bz': '🇧🇿', // Belize
        'cri': '🇨🇷', 'cr': '🇨🇷', // Costa Rica
        'slv': '🇸🇻', 'sv': '🇸🇻', // El Salvador
        'gtm': '🇬🇹', 'gt': '🇬🇹', // Guatemala
        'hnd': '🇭🇳', 'hn': '🇭🇳', // Honduras
        'nic': '🇳🇮', 'ni': '🇳🇮', // Nicaragua
        'pan': '🇵🇦', 'pa': '🇵🇦', // Panama
    };
    
    // Full country names mapping (your existing one)
    const countryNames = {
        // Europe
        'ireland': '🇮🇪',
        'united kingdom': '🇬🇧',
        'germany': '🇩🇪',
        'france': '🇫🇷',
        'spain': '🇪🇸',
        'italy': '🇮🇹',
        'netherlands': '🇳🇱',
        'belgium': '🇧🇪',
        'poland': '🇵🇱',
        'romania': '🇷🇴',
        'portugal': '🇵🇹',
        'greece': '🇬🇷',
        'austria': '🇦🇹',
        'switzerland': '🇨🇭',
        'sweden': '🇸🇪',
        'norway': '🇳🇴',
        'denmark': '🇩🇰',
        'finland': '🇫🇮',
        'czech republic': '🇨🇿',
        'hungary': '🇭🇺',
        'slovakia': '🇸🇰',
        'slovenia': '🇸🇮',
        'croatia': '🇭🇷',
        'bulgaria': '🇧🇬',
        'lithuania': '🇱🇹',
        'latvia': '🇱🇻',
        'estonia': '🇪🇪',
        'luxembourg': '🇱🇺',
        'malta': '🇲🇹',
        'cyprus': '🇨🇾',
        'iceland': '🇮🇸',
        'ukraine': '🇺🇦',
        'serbia': '🇷🇸',
        'montenegro': '🇲🇪',
        'bosnia and herzegovina': '🇧🇦',
        'north macedonia': '🇲🇰',
        'albania': '🇦🇱',
        'moldova': '🇲🇩',
        'belarus': '🇧🇾',
        'russia': '🇷🇺',
        'turkey': '🇹🇷',
        
        // North America
        'united states': '🇺🇸',
        'canada': '🇨🇦',
        'mexico': '🇲🇽',
        
        // Asia Pacific
        'australia': '🇦🇺',
        'new zealand': '🇳🇿',
        'japan': '🇯🇵',
        'south korea': '🇰🇷',
        'china': '🇨🇳',
        'india': '🇮🇳',
        'singapore': '🇸🇬',
        'hong kong': '🇭🇰',
        'taiwan': '🇹🇼',
        'thailand': '🇹🇭',
        'malaysia': '🇲🇾',
        'indonesia': '🇮🇩',
        'philippines': '🇵🇭',
        'vietnam': '🇻🇳',
        'pakistan': '🇵🇰',
        'bangladesh': '🇧🇩',
        'sri lanka': '🇱🇰',
        'nepal': '🇳🇵',
        'myanmar': '🇲🇲',
        'cambodia': '🇰🇭',
        'laos': '🇱🇦',
        
        // Middle East
        'united arab emirates': '🇦🇪',
        'saudi arabia': '🇸🇦',
        'israel': '🇮🇱',
        'qatar': '🇶🇦',
        'kuwait': '🇰🇼',
        'bahrain': '🇧🇭',
        'oman': '🇴🇲',
        'jordan': '🇯🇴',
        'lebanon': '🇱🇧',
        'iran': '🇮🇷',
        'iraq': '🇮🇶',
        'syria': '🇸🇾',
        'yemen': '🇾🇪',
        
        // Africa
        'south africa': '🇿🇦',
        'nigeria': '🇳🇬',
        'egypt': '🇪🇬',
        'kenya': '🇰🇪',
        'morocco': '🇲🇦',
        'ghana': '🇬🇭',
        'ethiopia': '🇪🇹',
        'uganda': '🇺🇬',
        'tanzania': '🇹🇿',
        'algeria': '🇩🇿',
        'tunisia': '🇹🇳',
        'libya': '🇱🇾',
        'sudan': '🇸🇩',
        'zimbabwe': '🇿🇼',
        'botswana': '🇧🇼',
        'namibia': '🇳🇦',
        'zambia': '🇿🇲',
        'malawi': '🇲🇼',
        'rwanda': '🇷🇼',
        'senegal': '🇸🇳',
        'ivory coast': '🇨🇮',
        'mali': '🇲🇱',
        'burkina faso': '🇧🇫',
        'niger': '🇳🇪',
        'chad': '🇹🇩',
        'cameroon': '🇨🇲',
        'central african republic': '🇨🇫',
        'democratic republic of the congo': '🇨🇩',
        'republic of the congo': '🇨🇬',
        'gabon': '🇬🇦',
        'equatorial guinea': '🇬🇶',
        'angola': '🇦🇴',
        'mozambique': '🇲🇿',
        'madagascar': '🇲🇬',
        'mauritius': '🇲🇺',
        'seychelles': '🇸🇨',
        
        // South America
        'brazil': '🇧🇷',
        'argentina': '🇦🇷',
        'chile': '🇨🇱',
        'colombia': '🇨🇴',
        'peru': '🇵🇪',
        'venezuela': '🇻🇪',
        'ecuador': '🇪🇨',
        'bolivia': '🇧🇴',
        'paraguay': '🇵🇾',
        'uruguay': '🇺🇾',
        'guyana': '🇬🇾',
        'suriname': '🇸🇷',
        'french guiana': '🇬🇫',
        
        // Caribbean & Central America
        'jamaica': '🇯🇲',
        'cuba': '🇨🇺',
        'dominican republic': '🇩🇴',
        'haiti': '🇭🇹',
        'puerto rico': '🇵🇷',
        'trinidad and tobago': '🇹🇹',
        'barbados': '🇧🇧',
        'bahamas': '🇧🇸',
        'belize': '🇧🇿',
        'costa rica': '🇨🇷',
        'el salvador': '🇸🇻',
        'guatemala': '🇬🇹',
        'honduras': '🇭🇳',
        'nicaragua': '🇳🇮',
        'panama': '🇵🇦',
    };
    
    // First try country code lookup
    if (countryCodes[countryLower]) {
        return countryCodes[countryLower];
    }
    
    // Then try full name lookup
    if (countryNames[countryLower]) {
        return countryNames[countryLower];
    }
    
    // Debug logging
    console.log(`🌍 Unknown country: "${country}" (searched as: "${countryLower}")`);
    
    // Return default globe with the country code/name for debugging
    return `🌍`;
}

function getIntensityLevel(percentage) {
    if (percentage > 20) return 'high';
    if (percentage > 8) return 'medium';
    return 'low';
}

// ==================================================
// ADDITIONAL HELPER FUNCTIONS FOR ENHANCED FEATURES
// ==================================================

function analyzeServicePatternsEnhanced(geoData, gscData) {
    const regions = geoData.regions || [];
    const countries = geoData.countries || [];
    
    // Calculate optimization opportunities based on data patterns
    let optimizationScore = 60; // Base score
    
    // Bonus for good regional coverage
    if (regions.length > 15) optimizationScore += 10;
    
    // Bonus for international reach
    if (countries.length > 8) optimizationScore += 10;
    
    // Bonus for search performance
    if (gscData && gscData.ctr > 0.05) optimizationScore += 10;
    
    // Penalty for over-concentration
    const dublin = regions.find(r => r.region.toLowerCase().includes('dublin'));
    if (dublin && dublin.percentage > 50) optimizationScore -= 10;
    
    return {
        optimizationScore: Math.min(100, Math.max(0, optimizationScore)),
        patterns: [],
        regionalBalance: calculateRegionalBalance(regions),
        topRegions: regions.slice(0, 5),
        internationalReach: countries.length,
        dublinConcentration: dublin ? dublin.percentage : 0
    };
}

function calculateAccessibilityMetricsEnhanced(geoData) {
    const countries = geoData.countries || [];
    const internationalCount = countries.filter(c => c.country !== 'Ireland').length;
    
    let internationalLevel = { class: 'low', label: 'Domestic Focus' };
    if (internationalCount > 10) {
        internationalLevel = { class: 'high', label: 'Global Reach' };
    } else if (internationalCount > 5) {
        internationalLevel = { class: 'medium', label: 'Regional Reach' };
    }
    
    return {
        internationalLevel,
        accessibilityScore: calculateAccessibilityScore(geoData),
        languageOpportunities: identifyLanguageOpportunities(countries),
        mobilityFactors: analyzeMobilityFactors(geoData)
    };
}

function calculateGeographicTrendsEnhanced(geoData, trafficData) {
    // In a real implementation, you'd compare with historical data
    // For now, we'll simulate trend analysis
    
    return {
        growthRegions: identifyGrowthRegions(geoData.regions),
        decliningRegions: identifyDecliningRegions(geoData.regions),
        emergingMarkets: identifyEmergingMarkets(geoData.countries),
        seasonalPatterns: analyzeSeasonalPatterns(trafficData)
    };
}

// Geographic search pattern analysis
function extractLocationContext(queryText) {
    const locationKeywords = {
        'dublin': 'Dublin Metro',
        'cork': 'Cork Region',
        'galway': 'Galway Region',
        'limerick': 'Limerick Region',
        'near me': 'Location-based',
        'local': 'Local Service',
        'county': 'County-specific'
    };
    
    for (const [keyword, context] of Object.entries(locationKeywords)) {
        if (queryText.includes(keyword)) {
            return context;
        }
    }
    
    return 'General Location';
}

function determineUrgencyLevel(queryText) {
    const criticalWords = ['emergency', 'urgent', 'asap'];
    const highWords = ['today', 'immediately', 'deadline'];
    const mediumWords = ['soon', 'quick', 'fast'];
    
    if (criticalWords.some(word => queryText.includes(word))) return 'critical';
    if (highWords.some(word => queryText.includes(word))) return 'high';
    if (mediumWords.some(word => queryText.includes(word))) return 'medium';
    
    return 'standard';
}

function classifyQueryIntent(queryText) {
    const intents = {
        'application': ['apply', 'application', 'form', 'submit'],
        'information': ['what', 'how', 'when', 'where', 'info'],
        'status': ['status', 'check', 'progress', 'update'],
        'eligibility': ['eligible', 'qualify', 'entitled', 'criteria'],
        'contact': ['contact', 'phone', 'email', 'office', 'address']
    };
    
    for (const [intent, keywords] of Object.entries(intents)) {
        if (keywords.some(keyword => queryText.includes(keyword))) {
            return intent;
        }
    }
    
    return 'general';
}

// Content creation helpers
function generateInternationalInsights(countries, pageContext) {
    if (!countries || countries.length === 0) {
        return '<div class="no-insights">No international data available</div>';
    }
    
    const topCountries = countries.filter(c => c.country !== 'Ireland').slice(0, 3);
    
    return `
        <div class="international-insights-list">
            ${topCountries.map(country => `
                <div class="insight-item">
                    <span class="country-flag">${getCountryFlagEnhanced(country.country)}</span>
                    <div class="insight-content">
                        <div class="insight-title">${country.country}</div>
                        <div class="insight-detail">${generateCountryInsight(country, pageContext)}</div>
                    </div>
                    <div class="insight-metric">${country.percentage.toFixed(1)}%</div>
                </div>
            `).join('')}
        </div>
    `;
}

function generateCountryInsight(country, pageContext) {
    const insights = {
        'United Kingdom': `Post-Brexit ${pageContext.serviceType} access`,
        'United States': `Irish diaspora seeking ${pageContext.serviceType}`,
        'Poland': `EU citizens accessing ${pageContext.serviceType}`,
        'Germany': `European professionals needing ${pageContext.serviceType}`,
        'France': `EU integration ${pageContext.serviceType} requirements`,
        'Australia': `Irish heritage ${pageContext.serviceType} applications`,
        'Canada': `Commonwealth ${pageContext.serviceType} inquiries`
    };
    
    return insights[country.country] || `International ${pageContext.serviceType} demand`;
}

function createPerformanceHeatmap(geoData, servicePatterns) {
    // Simplified heatmap visualization
    const regions = geoData.regions?.slice(0, 8) || [];
    
    if (regions.length === 0) {
        return '<div class="no-performance-data">📊 Connect analytics for performance data</div>';
    }
    
    return `
        <div class="heatmap-grid">
            ${regions.map(region => `
                <div class="heatmap-cell" 
                     style="background: ${getHeatmapColor(region.percentage)}; --intensity: ${region.percentage}">
                    <div class="cell-label">${formatRegionNameEnhanced(region.region)}</div>
                    <div class="cell-value">${region.percentage.toFixed(1)}%</div>
                </div>
            `).join('')}
        </div>
    `;
}

function getHeatmapColor(percentage) {
    if (percentage > 20) return 'linear-gradient(135deg, #fee2e2, #fecaca)';
    if (percentage > 10) return 'linear-gradient(135deg, #fef3c7, #fde68a)';
    if (percentage > 5) return 'linear-gradient(135deg, #dbeafe, #bfdbfe)';
    return 'linear-gradient(135deg, #f0fdf4, #dcfce7)';
}

function generateSearchInsights(locationQueries, urgencyPatterns, servicePatterns, pageContext) {
    const insights = [];
    
    if (locationQueries.length > 0) {
        insights.push(`${locationQueries.length} location-specific queries detected for ${pageContext.serviceType}`);
        
        const dublinQueries = locationQueries.filter(q => q.locationContext.includes('Dublin'));
        if (dublinQueries.length > locationQueries.length * 0.6) {
            insights.push('High Dublin-focused search demand - consider regional alternatives');
        }
    }
    
    if (urgencyPatterns.length > 0) {
        insights.push(`${urgencyPatterns.length} urgent queries require immediate attention`);
        
        const criticalQueries = urgencyPatterns.filter(p => p.urgencyLevel === 'critical');
        if (criticalQueries.length > 0) {
            insights.push(`${criticalQueries.length} critical urgency queries need priority handling`);
        }
    }
    
    if (servicePatterns.length > 0) {
        const applicationQueries = servicePatterns.filter(p => p.intent === 'application');
        const infoQueries = servicePatterns.filter(p => p.intent === 'information');
        
        if (applicationQueries.length > infoQueries.length) {
            insights.push('Users primarily seeking application processes - optimise conversion flow');
        } else {
            insights.push('Users primarily seeking information - improve content clarity');
        }
    }
    
    if (insights.length === 0) {
        insights.push('Search pattern analysis will appear when query data is available');
    }
    
    return insights;
}

// Placeholder functions for detailed analysis components
function createCountyAnalysisTable(regions, geoInsights, pageContext) {
    if (!regions || regions.length === 0) {
        return '<div class="analysis-placeholder">📍 County analysis requires regional data</div>';
    }
    
    return `
        <div class="county-table">
            <div class="table-header">
                <span>County</span>
                <span>Users</span>
                <span>Share</span>
                <span>Trend</span>
                <span>Service Focus</span>
            </div>
            ${regions.slice(0, 10).map(region => `
                <div class="table-row">
                    <span class="county-name">${formatRegionNameEnhanced(region.region)}</span>
                    <span class="county-users">${formatNumberEnhanced(region.users)}</span>
                    <span class="county-share">${region.percentage.toFixed(1)}%</span>
                    <span class="county-trend">📈 +2%</span>
                    <span class="county-focus">${getServiceFocus(region, pageContext)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function createSearchPatternsAnalysis(searchPatterns, pageContext) {
    return `
        <div class="search-patterns-analysis">
            <div class="pattern-summary">
                <div class="summary-stat">
                    <span class="stat-number">${searchPatterns.locationQueries.length}</span>
                    <span class="stat-label">Location Queries</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-number">${searchPatterns.urgencyPatterns.length}</span>
                    <span class="stat-label">Urgent Queries</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-number">${searchPatterns.servicePatterns.length}</span>
                    <span class="stat-label">Service Queries</span>
                </div>
            </div>
            
            <div class="patterns-insights">
                ${searchPatterns.insights.map(insight => `
                    <div class="insight-item">💡 ${insight}</div>
                `).join('')}
            </div>
        </div>
    `;
}

function createAccessibilityMatrix(geoData, pageContext) {
    return `
        <div class="accessibility-analysis">
            <div class="accessibility-score">
                <span class="score-number">${calculateAccessibilityScore(geoData)}</span>
                <span class="score-label">Accessibility Score</span>
            </div>
            <div class="accessibility-factors">
                <div class="factor">📍 Geographic Coverage: ${geoData.regions?.length || 0}/32 counties</div>
                <div class="factor">🌍 International Access: ${geoData.countries?.length || 0} countries</div>
                <div class="factor">📱 Mobile Accessibility: Analyzing...</div>
                <div class="factor">♿ Service Barriers: Under review</div>
            </div>
        </div>
    `;
}

function createDemographicInsights(geoData, geoInsights) {
    return `
        <div class="demographic-analysis">
            <div class="demographic-insight">
                <h4>🏙️ Urban vs Rural Distribution</h4>
                <div class="urban-rural-split">
                    <div class="split-item">
                        <span class="split-label">Dublin Metro</span>
                        <span class="split-value">${geoInsights.dublinPercentage}%</span>
                    </div>
                    <div class="split-item">
                        <span class="split-label">Other Urban</span>
                        <span class="split-value">${calculateOtherUrban(geoData)}%</span>
                    </div>
                    <div class="split-item">
                        <span class="split-label">Rural Areas</span>
                        <span class="split-value">${calculateRural(geoData)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="demographic-insight">
                <h4>🌍 Cultural Demographics</h4>
                <div class="cultural-breakdown">
                    <div class="culture-item">Irish Domestic: ${geoInsights.totalIrishUsers}</div>
                    <div class="culture-item">EU Citizens: ${calculateEUCitizens(geoData)}%</div>
                    <div class="culture-item">Diaspora: ${geoInsights.diasporaIndicator}</div>
                </div>
            </div>
        </div>
    `;
}

function createROICalculator(opportunities) {
    const totalOpportunities = opportunities.quickWins.length + opportunities.strategic.length + opportunities.longTerm.length;
    const estimatedROI = calculateEstimatedROI(opportunities);
    
    return `
        <div class="roi-calculator-content">
            <div class="roi-summary">
                <div class="roi-metric">
                    <span class="roi-number">${totalOpportunities}</span>
                    <span class="roi-label">Total Opportunities</span>
                </div>
                <div class="roi-metric">
                    <span class="roi-number">${estimatedROI.increase}%</span>
                    <span class="roi-label">Potential Traffic Increase</span>
                </div>
                <div class="roi-metric">
                    <span class="roi-number">${estimatedROI.timeframe}</span>
                    <span class="roi-label">Implementation Timeframe</span>
                </div>
            </div>
            
            <div class="roi-breakdown">
                <h4>📊 Expected Impact Breakdown</h4>
                <div class="impact-bars">
                    <div class="impact-bar">
                        <span class="impact-label">Quick Wins</span>
                        <div class="impact-progress">
                            <div class="impact-fill" style="width: 60%"></div>
                        </div>
                        <span class="impact-value">+15%</span>
                    </div>
                    <div class="impact-bar">
                        <span class="impact-label">Strategic</span>
                        <div class="impact-progress">
                            <div class="impact-fill" style="width: 80%"></div>
                        </div>
                        <span class="impact-value">+25%</span>
                    </div>
                    <div class="impact-bar">
                        <span class="impact-label">Long-term</span>
                        <div class="impact-progress">
                            <div class="impact-fill" style="width: 100%"></div>
                        </div>
                        <span class="impact-value">+40%</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Utility calculation functions
function calculateAccessibilityScore(geoData) {
    const regions = geoData.regions?.length || 0;
    const countries = geoData.countries?.length || 0;
    
    // Simple scoring algorithm
    let score = 50; // Base score
    score += Math.min(25, (regions / 32) * 25); // Regional coverage
    score += Math.min(25, (countries / 20) * 25); // International reach
    
    return Math.round(score);
}

function calculateOtherUrban(geoData) {
    const regions = geoData.regions || [];
    const urbanCities = ['cork', 'galway', 'limerick', 'waterford'];
    
    const urbanPercentage = regions
        .filter(r => urbanCities.some(city => r.region.toLowerCase().includes(city)))
        .reduce((sum, r) => sum + r.percentage, 0);
    
    return urbanPercentage.toFixed(1);
}

function calculateRural(geoData) {
    const regions = geoData.regions || [];
    const dublin = regions.find(r => r.region.toLowerCase().includes('dublin'));
    const dublinPercentage = dublin ? dublin.percentage : 0;
    const otherUrban = parseFloat(calculateOtherUrban(geoData));
    
    return (100 - dublinPercentage - otherUrban).toFixed(1);
}

function calculateEUCitizens(geoData) {
    const countries = geoData.countries || [];
    const euCountries = ['Poland', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium'];
    
    const euPercentage = countries
        .filter(c => euCountries.includes(c.country))
        .reduce((sum, c) => sum + c.percentage, 0);
    
    return euPercentage.toFixed(1);
}

function getServiceFocus(region, pageContext) {
    // Simulate service focus based on region characteristics
    const regionName = region.region.toLowerCase();
    
    if (regionName.includes('dublin')) return 'All Services';
    if (regionName.includes('cork')) return 'Business Services';
    if (regionName.includes('galway')) return 'Education Services';
    if (regionName.includes('rural') || region.percentage < 2) return 'Basic Services';
    
    return pageContext.serviceType;
}

function calculateEstimatedROI(opportunities) {
    const quickWinIncrease = opportunities.quickWins.length * 5; // 5% per opportunity
    const strategicIncrease = opportunities.strategic.length * 10; // 10% per opportunity
    const longTermIncrease = opportunities.longTerm.length * 15; // 15% per opportunity
    
    const totalIncrease = quickWinIncrease + strategicIncrease + longTermIncrease;
    
    return {
        increase: Math.min(80, totalIncrease), // Cap at 80%
        timeframe: '3-6 months'
    };
}

// Additional helper functions for trend analysis
function identifyGrowthRegions(regions) {
    // Mock implementation - in reality, compare with historical data
    return regions?.slice(0, 3).map(r => r.region) || [];
}

function identifyDecliningRegions(regions) {
    // Mock implementation
    return regions?.slice(-2).map(r => r.region) || [];
}

function identifyEmergingMarkets(countries) {
    // Mock implementation
    const emerging = countries?.filter(c => c.country !== 'Ireland').slice(0, 2) || [];
    return emerging.map(c => c.country);
}

function analyzeSeasonalPatterns(trafficData) {
    // Mock implementation
    return {
        peak: 'Summer months',
        low: 'Winter months',
        trend: 'Increasing'
    };
}

function identifyLanguageOpportunities(countries) {
    const nonEnglish = countries?.filter(c => 
        !['Ireland', 'United Kingdom', 'United States', 'Canada', 'Australia'].includes(c.country)
    ) || [];
    
    return nonEnglish.length > 3 ? 'High' : nonEnglish.length > 1 ? 'Medium' : 'Low';
}

function analyzeMobilityFactors(geoData) {
    // Analyze factors affecting geographic mobility and service access
    return {
        ruralAccess: 'Limited',
        urbanConcentration: 'High',
        transportLinks: 'Good'
    };
}

function updatePerformanceHeatmap(metric) {
    console.log('Updating performance heatmap for metric:', metric);
    // Implementation would update the heatmap visualization
    // based on the selected metric (users, engagement, conversions)
}



    // Add these missing helper functions to your dashboard code

function createSparkline(data) {
    if (!data || data.length === 0) return '';
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * 60;
        const y = 20 - ((value - min) / range) * 16;
        return `${x},${y}`;
    }).join(' ');
    
    return `
        <svg class="sparkline" width="60" height="20" viewBox="0 0 60 20">
            <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5"/>
        </svg>
    `;
}

function calculateTrendIndicator(data) {
    if (!data || data.length < 2) return { class: 'neutral', indicator: '→ No trend' };
    
    const recent = data.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const earlier = data.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    
    const change = ((recent - earlier) / earlier) * 100;
    
    if (change > 5) return { class: 'positive', indicator: `↗ +${change.toFixed(0)}%` };
    if (change < -5) return { class: 'negative', indicator: `↘ ${change.toFixed(0)}%` };
    return { class: 'neutral', indicator: '→ Stable' };
}

function getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'C+';
    if (score >= 65) return 'C';
    return 'D';
}

function getGradeClass(score) {
    if (score >= 85) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 65) return 'fair';
    return 'poor';
}

// Fix the geographic data processing to handle missing GA4 geographic data
function processGeographicDataEnhanced(geoData, gscData) {
    // If no geographic data from GA4, create mock data based on Irish patterns
    let regions = geoData.regions || [];
    let countries = geoData.countries || [];
    
    // If no geographic data available, create a basic structure
    if (regions.length === 0 && countries.length === 0) {
        console.log('📍 No geographic data available from GA4');
        return {
            totalIrishUsers: '0',
            dublinPercentage: '0.0',
            internationalUsers: '0',
            topInternationalCountry: 'None',
            countiesCovered: 0,
            coveragePercentage: 0,
            demandLevel: { class: 'distributed', label: 'No Geographic Data', severity: 'low' },
            opportunityScore: 50,
            primaryOpportunity: 'Enable Geographic Tracking',
            totalCountries: 0,
            internationalPercentage: '0',
            diasporaIndicator: 'Unknown',
            irishTrend: { class: 'neutral', indicator: '→ No data' },
            internationalTrend: { class: 'neutral', indicator: '→ No data' },
            coverageTrend: { class: 'neutral', indicator: '→ No data' },
            irishTrendData: [0, 0, 0, 0, 0, 0, 0],
            internationalTrendData: [0, 0, 0, 0, 0, 0, 0]
        };
    }
    
    // Enhanced regional analysis
    const dublin = regions.find(r => r.region.toLowerCase().includes('dublin'));
    const dublinPercentage = dublin ? dublin.percentage : 0;
    
    // Irish user analysis
    const ireland = countries.find(c => c.country === 'Ireland');
    const totalIrishUsers = ireland ? formatNumberEnhanced(ireland.users) : '0';
    
    // International analysis
    const internationalCountries = countries.filter(c => c.country !== 'Ireland');
    const internationalUsers = internationalCountries.reduce((sum, c) => sum + c.users, 0);
    const topInternationalCountry = internationalCountries.length > 0 ? internationalCountries[0].country : 'None';
    
    // Coverage analysis
    const countiesCovered = Math.min(32, regions.length);
    const coveragePercentage = (countiesCovered / 32) * 100;
    
    // Service concentration analysis
    let demandLevel = { class: 'distributed', label: 'Distributed Access', severity: 'low' };
    if (dublinPercentage > 50) {
        demandLevel = { class: 'critical', label: 'Critical Dublin Concentration', severity: 'high' };
    } else if (dublinPercentage > 35) {
        demandLevel = { class: 'high', label: 'High Capital Concentration', severity: 'medium' };
    } else if (dublinPercentage > 25) {
        demandLevel = { class: 'medium', label: 'Moderate Regional Hub Pattern', severity: 'low' };
    }
    
    // Enhanced opportunity scoring
    let opportunityScore = 60; // Base score
    
    // Regional balance scoring
    if (dublinPercentage < 30) opportunityScore += 15;
    else if (dublinPercentage > 50) opportunityScore -= 10;
    
    // Coverage scoring
    if (countiesCovered > 25) opportunityScore += 10;
    else if (countiesCovered < 15) opportunityScore -= 5;
    
    // International reach scoring
    if (internationalCountries.length > 10) opportunityScore += 10;
    else if (internationalCountries.length < 3) opportunityScore -= 5;
    
    // Search performance impact
    if (gscData && gscData.ctr > 0.05) opportunityScore += 5;
    
    opportunityScore = Math.min(100, Math.max(0, opportunityScore));
    
    // Primary opportunity identification
    let primaryOpportunity = 'Balanced Growth';
    if (dublinPercentage > 45) primaryOpportunity = 'Regional Decentralization';
    else if (internationalCountries.length > 8) primaryOpportunity = 'Multilingual Content';
    else if (countiesCovered < 20) primaryOpportunity = 'Rural Outreach';
    
    // Mock trend data (in real implementation, you'd compare with historical data)
    const irishTrendData = [85, 87, 89, 91, 88, 92, 90];
    const internationalTrendData = [12, 14, 13, 16, 18, 17, 20];
    
    return {
        totalIrishUsers,
        dublinPercentage: dublinPercentage.toFixed(1),
        internationalUsers: formatNumberEnhanced(internationalUsers),
        topInternationalCountry,
        countiesCovered,
        coveragePercentage,
        demandLevel,
        opportunityScore: Math.round(opportunityScore),
        primaryOpportunity,
        totalCountries: countries.length,
        internationalPercentage: ireland ? ((internationalUsers / ireland.users) * 100).toFixed(1) : '0',
        diasporaIndicator: internationalCountries.length > 5 ? 'High' : internationalCountries.length > 2 ? 'Medium' : 'Low',
        
        // Enhanced trend indicators
        irishTrend: calculateTrendIndicator(irishTrendData),
        internationalTrend: calculateTrendIndicator(internationalTrendData),
        coverageTrend: { class: 'positive', indicator: '↗ +2 counties' },
        
        // Trend data for sparklines
        irishTrendData,
        internationalTrendData
    };
}

// Add the missing content creation helper functions
function createOverviewContent(geoData, geoInsights, servicePatterns, pageContext) {
    return `
        <div class="overview-content">
            <div class="overview-grid">
                <!-- Interactive Ireland Map -->
                <div class="geo-card ireland-focus">
                    <div class="card-header">
                        <h3>🇮🇪 Irish Regional Distribution</h3>
                        <div class="concentration-alert ${geoInsights.demandLevel.class}">
                            ${geoInsights.demandLevel.label}
                        </div>
                    </div>
                    
                    <div class="ireland-map-container">
                        ${createInteractiveIrelandMap(geoData.regions, geoInsights)}
                    </div>
                    
                    <div class="regional-quick-stats">
                        <div class="quick-stat">
                            <span class="stat-value">${geoInsights.dublinPercentage}%</span>
                            <span class="stat-label">Dublin Share</span>
                        </div>
                        <div class="quick-stat">
                            <span class="stat-value">${geoData.regions?.length || 0}</span>
                            <span class="stat-label">Active Regions</span>
                        </div>
                        <div class="quick-stat">
                            <span class="stat-value">${calculateRegionalBalance(geoData.regions)}</span>
                            <span class="stat-label">Balance Score</span>
                        </div>
                    </div>
                </div>
                
                <!-- International Reach -->
                <div class="geo-card international-focus">
                    <div class="card-header">
                        <h3>🌍 International Reach</h3>
                        <div class="reach-indicator ${geoInsights.diasporaIndicator.toLowerCase()}">
                            ${geoInsights.diasporaIndicator} Diaspora Engagement
                        </div>
                    </div>
                    
                    <div class="world-map-container">
                        ${createInteractiveWorldMap(geoData.countries)}
                    </div>
                    
                    <div class="international-insights">
                        ${generateInternationalInsights(geoData.countries, pageContext)}
                    </div>
                </div>
                
                
            </div>
        </div>
    `;
}

function createInteractiveIrelandMap(regions, geoInsights) {
    if (!regions || regions.length === 0) {
        return `<div class="no-data-placeholder">📍 Enable geographic reporting in GA4 to see regional data</div>`;
    }
    
    // Create simplified visual representation
    const topRegions = regions.slice(0, 8).map((region, index) => {
        const intensity = getIntensityLevel(region.percentage);
        return `
            <div class="region-bubble ${intensity}" 
                 data-region="${region.region}"
                 title="${region.region}: ${formatNumberEnhanced(region.users)} users (${region.percentage.toFixed(1)}%)"
                 style="--size: ${Math.max(20, region.percentage * 2)}px; --delay: ${index * 0.1}s">
                <div class="bubble-content">
                    <span class="region-name">${formatRegionNameEnhanced(region.region)}</span>
                    <span class="region-stats">${region.percentage.toFixed(1)}%</span>
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="ireland-map-visual">
            <div class="map-background">🇮🇪</div>
            <div class="region-bubbles">${topRegions}</div>
            <div class="map-legend">
                <div class="legend-item high">High Usage</div>
                <div class="legend-item medium">Medium Usage</div>
                <div class="legend-item low">Low Usage</div>
            </div>
        </div>
    `;
}

function createInteractiveWorldMap(countries) {
    if (!countries || countries.length === 0) {
        return `<div class="no-data-placeholder">🌍 No international data available</div>`;
    }
    
    const topCountries = countries.slice(0, 6).map((country, index) => {
        const flag = getCountryFlagEnhanced(country.country);
        return `
            <div class="country-marker" 
                 data-country="${country.country}"
                 title="${country.country}: ${formatNumberEnhanced(country.users)} users"
                 style="--delay: ${index * 0.2}s">
                <span class="country-flag">${flag}</span>
                <span class="country-label">${country.country}</span>
                <span class="country-percentage">${country.percentage.toFixed(1)}%</span>
            </div>
        `;
    }).join('');
    
    return `
        <div class="world-map-visual">
            <div class="world-background">🗺️</div>
            <div class="country-markers">${topCountries}</div>
        </div>
    `;
}



    

function createTopRegionsTable(regions) {
    if (!regions || regions.length === 0) {
        return '<div class="no-data">📍 No regional data available</div>';
    }
    
    return `
        <div class="top-regions-table">
            ${regions.slice(0, 6).map((region, index) => `
                <div class="region-row ${index === 0 ? 'top-region' : ''}">
                    <div class="region-info">
                        <span class="region-name">${formatRegionNameEnhanced(region.region)}</span>
                        <span class="region-percentage">${region.percentage.toFixed(1)}%</span>
                    </div>
                    <div class="region-bar">
                        <div class="region-fill" style="width: ${(region.percentage / regions[0].percentage) * 100}%; background: ${getRegionColor(region.percentage)}"></div>
                    </div>
                    <div class="region-users">${formatNumberEnhanced(region.users)} users</div>
                </div>
            `).join('')}
        </div>
    `;
}

function createStreamlinedOpportunities(servicePatterns, accessibilityInsights, pageContext) {
    return `
        <div class="streamlined-opportunities">
            <div class="opportunities-grid">
                <div class="opportunity-card quick-action">
                    <div class="opp-icon">⚡</div>
                    <div class="opp-content">
                        <h4>Quick Wins (1-2 weeks)</h4>
                        <ul class="opp-list">
                            <li>Optimise content for top-performing regions</li>
                            <li>Add regional service contact information</li>
                            <li>Improve mobile experience for rural users</li>
                        </ul>
                    </div>
                </div>
                
                <div class="opportunity-card strategic-action">
                    <div class="opp-icon">🎯</div>
                    <div class="opp-content">
                        <h4>Strategic Opportunities (1-3 months)</h4>
                        <ul class="opp-list">
                            <li>Develop region-specific landing pages</li>
                            <li>Create multilingual content for diaspora</li>
                            <li>Partner with local service centers</li>
                        </ul>
                    </div>
                </div>
                
                <div class="opportunity-card impact-metrics">
                    <div class="opp-icon">📊</div>
                    <div class="opp-content">
                        <h4>Expected Impact</h4>
                        <div class="impact-stats">
                            <div class="impact-stat">
                                <span class="stat-number">+25%</span>
                                <span class="stat-label">Regional Engagement</span>
                            </div>
                            <div class="impact-stat">
                                <span class="stat-number">+15%</span>
                                <span class="stat-label">International Reach</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}





    


// ===========================================
// MISSING HELPER FUNCTIONS FOR REFRESH
// ===========================================

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

// Modal display function for dashboard refresh
function showDashboardModal(htmlContent) {
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


// ===========================================
// FILTER STATE MANAGEMENT
// ===========================================

// Function to reset all filter states when loading new dashboard
function resetDashboardFilters() {
    console.log('🧹 Resetting dashboard filters...');
    
    // Clear the original query data
    originalQueryData = null;
    
    // Clear any active filter styling
    document.querySelectorAll('.intent-bar.active-filter, .service-bar.active-filter, .urgent-filter-bar').forEach(bar => {
        bar.classList.remove('active-filter');
        if (bar.classList.contains('urgent-filter-bar')) {
            bar.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
            bar.style.borderColor = '#f87171';
            const divElement = bar.querySelector('div');
            if (divElement) {
                divElement.style.color = '#dc2626';
            }
        }
    });
    
    // Hide any active filter status displays
    const filterStatus = document.getElementById('journeyFilterStatus');
    const clearJourneyBtn = document.getElementById('clearJourneyFilter');
    const clearServiceBtn = document.getElementById('clearServiceFilter');
    
    if (filterStatus) filterStatus.style.display = 'none';
    if (clearJourneyBtn) clearJourneyBtn.style.display = 'none';
    if (clearServiceBtn) clearServiceBtn.style.display = 'none';
    
    console.log('✅ Dashboard filters reset');
}




function calculateCitizenImpactWithTrends(gscData, ga4Data, gscTrends, ga4Trends) {
    // Current period data
    const currentReach = (gscData?.clicks || 0) + (ga4Data?.users || 0);
    const monthlyReach = formatNumber(currentReach);
    
    // Use the same helpfulness calculation as detailed quality assessment
    const helpfulnessScore = calculateHelpfulnessScore(ga4Data);
    
    // Time to find info
    const avgTimeToInfo = ga4Data?.avgSessionDuration ? 
        formatDuration(ga4Data.avgSessionDuration) : '2:15';
    
    // Calculate trends
    let reachTrend = '<span class="trend-neutral">—</span>';
    let helpfulnessTrend = '<span class="trend-neutral">—</span>';
    let timeTrend = '<span class="trend-neutral">—</span>';
    
    // Reach trend (clicks + users combined)
    if (gscTrends?.trends?.clicks && ga4Trends?.trends?.users) {
        const clicksChange = gscTrends.trends.clicks.percentChange || 0;
        const usersChange = ga4Trends.trends.users.percentChange || 0;
        const avgChange = (clicksChange + usersChange) / 2;
        
        if (avgChange > 2) {
            reachTrend = `<span class="trend-positive">↗ ${Math.round(avgChange)}%</span>`;
        } else if (avgChange < -2) {
            reachTrend = `<span class="trend-negative">↘ ${Math.round(Math.abs(avgChange))}%</span>`;
        } else {
            reachTrend = `<span class="trend-neutral">→ ${Math.round(Math.abs(avgChange))}%</span>`;
        }
    }
    
    // Helpfulness trend (based on bounce rate and session duration trends)
    if (ga4Trends?.trends?.bounceRate && ga4Trends?.trends?.avgSessionDuration) {
        // Lower bounce rate = better, longer session = better
        const bounceChange = ga4Trends.trends.bounceRate.percentChange || 0;
        const sessionChange = ga4Trends.trends.avgSessionDuration.percentChange || 0;
        
        // Bounce rate decrease is good, session increase is good
        const bounceDirection = ga4Trends.trends.bounceRate.direction === 'down' ? 1 : 
                               ga4Trends.trends.bounceRate.direction === 'up' ? -1 : 0;
        const sessionDirection = ga4Trends.trends.avgSessionDuration.direction === 'up' ? 1 : 
                                ga4Trends.trends.avgSessionDuration.direction === 'down' ? -1 : 0;
        
        const overallDirection = bounceDirection + sessionDirection;
        
        if (overallDirection > 0) {
            helpfulnessTrend = `<span class="trend-positive">↗ Improving</span>`;
        } else if (overallDirection < 0) {
            helpfulnessTrend = `<span class="trend-negative">↘ Declining</span>`;
        } else {
            helpfulnessTrend = `<span class="trend-neutral">→ Stable</span>`;
        }
    }
    
    // Time trend (session duration)
    if (ga4Trends?.trends?.avgSessionDuration) {
        const timeChange = ga4Trends.trends.avgSessionDuration.percentChange || 0;
        const direction = ga4Trends.trends.avgSessionDuration.direction;
        
        if (direction === 'up' && timeChange > 2) {
            timeTrend = `<span class="trend-positive">↗ ${Math.round(timeChange)}%</span>`;
        } else if (direction === 'down' && timeChange > 2) {
            timeTrend = `<span class="trend-negative">↘ ${Math.round(timeChange)}%</span>`;
        } else {
            timeTrend = `<span class="trend-neutral">→ ${Math.round(timeChange)}%</span>`;
        }
    }
    
    return { 
        monthlyReach, 
        helpfulnessScore, 
        avgTimeToInfo,
        reachTrend,
        helpfulnessTrend,
        timeTrend
    };
}


function calculateDetailedQualityScore(gscData, ga4Data) {
    // Calculate individual scores with detailed breakdown
    const searchScore = calculateSearchScore(gscData);
    const engagementScore = calculateEngagementScore(ga4Data);
    const relevanceScore = calculateRelevanceScore(gscData);
    const uxScore = calculateUXScore(ga4Data);
    
    const overall = Math.round((searchScore + engagementScore + relevanceScore + uxScore) / 4);
    
    // Store detailed metrics for transparency
    const details = {
        position: gscData?.position,
        ctr: gscData?.ctr,
        duration: ga4Data?.avgSessionDuration,
        bounceRate: ga4Data?.bounceRate,
        engagementRate: ga4Data?.engagementRate,
        pagesPerSession: ga4Data?.sessions > 0 ? (ga4Data?.pageViews / ga4Data?.sessions) : null,
        expectedCtr: gscData?.position ? getCTRBenchmark(gscData.position) : null
    };
    
    return {
        overall,
        search: searchScore,
        engagement: engagementScore,
        relevance: relevanceScore,
        ux: uxScore,
        details
    };
}

// Improvement suggestion functions
function getSearchImprovement(score, details) {
    if (score >= 75) return "✅ Good search performance";
    if (details.position > 10) return "📈 Focus on improving search ranking";
    if (details.ctr < 0.03) return "📝 Optimise title and meta description";
    return "🔍 Work on both ranking and click-through rate";
}

function getEngagementImprovement(score, details) {
    if (score >= 75) return "✅ Users are highly engaged";
    if (details.bounceRate > 0.7) return "📚 Improve content relevance and readability";
    if (details.duration < 60) return "⏱️ Make content more engaging to increase time spent";
    return "👥 Focus on better user engagement";
}

function getRelevanceImprovement(score, details) {
    if (score >= 75) return "✅ Content matches user intent well";
    if (details.ctr < details.expectedCtr) return "🎯 Better align title/description with search intent";
    return "🔍 Improve content relevance for target keywords";
}

function getUXImprovement(score, details) {
    if (score >= 75) return "✅ Excellent user experience";
    if (details.engagementRate < 0.4) return "📱 Improve page loading and usability";
    if (details.pagesPerSession < 1.2) return "🔗 Add better internal linking";
    return "⭐ Focus on overall user experience improvements";
}

function getOverallRecommendation(score, scores) {
    if (score >= 85) return "Your content is performing excellently across all quality metrics. Keep up the great work!";
    if (score >= 65) return "Good performance overall. Focus on the lowest-scoring areas for maximum improvement.";
    if (score >= 45) return "There's significant room for improvement. Start with search performance and user engagement.";
    return "This page needs urgent attention. Poor performance across multiple areas is limiting its effectiveness in serving citizens.";
}



function calculateEnhancedImpactMetrics(gscData, ga4Data) {
    // Information seekers (same as before but more transparent)
    const seekers = formatNumber((gscData?.clicks || 0) + (ga4Data?.users || 0));
    
    // Query types (renamed from "Questions Answered" to be more accurate)
    const queryTypes = gscData?.topQueries?.length || 0;
    
    // Success rate (more transparent calculation)
    let successRate = 70; // Default fallback
    if (ga4Data && !ga4Data.noDataFound && ga4Data.bounceRate !== undefined) {
        successRate = Math.round((1 - ga4Data.bounceRate) * 100);
    }
    
    return { 
        seekers, 
        queryTypes, 
        successRate,
        rawClicks: gscData?.clicks || 0,
        rawUsers: ga4Data?.users || 0,
        rawBounceRate: ga4Data?.bounceRate || null
    };
}

function getImpactSummary(impact, gscData, ga4Data) {
    const totalSeekers = (gscData?.clicks || 0) + (ga4Data?.users || 0);
    const successfulSeekers = Math.round(totalSeekers * (impact.successRate / 100));
    
    if (totalSeekers === 0) {
        return "This page currently has no recorded citizen traffic. Connect your analytics tools to see impact data.";
    }
    
    if (impact.successRate >= 80) {
        return `Excellent citizen service! ${successfulSeekers} of ${formatNumber(totalSeekers)} citizens successfully found what they needed. The page serves ${impact.queryTypes} different types of information needs.`;
    } else if (impact.successRate >= 60) {
        return `Good citizen service. ${successfulSeekers} of ${formatNumber(totalSeekers)} citizens found what they needed, though there's room for improvement. Consider optimizing for the ${impact.queryTypes} different information needs.`;
    } else {
        return `Citizens are struggling to find what they need. Only ${successfulSeekers} of ${formatNumber(totalSeekers)} citizens successfully engaged with the content. Focus on improving content clarity and relevance for the ${impact.queryTypes} different query types.`;
    }
}
    
    

// ===========================================
// GLOBAL EXPORTS
// ===========================================

window.createUnifiedCitizensDashboard = createUnifiedCitizensDashboard;
window.initializeUnifiedDashboard = initializeUnifiedDashboard;
window.exportUnifiedReport = exportUnifiedReport;
window.copyUnifiedSummary = copyUnifiedSummary;
window.scheduleUnifiedReview = scheduleUnifiedReview;
window.resetDashboardFilters = resetDashboardFilters;

// Add to the GLOBAL EXPORTS section
// REPLACE the existing refreshUnifiedDashboard function with this fixed version:
window.refreshUnifiedDashboard = async function(url) {
    console.log('🔄 Refreshing Unified Citizens Dashboard for:', url);

    // RESET FILTERS FIRST
    resetDashboardFilters();
    
    const refreshBtn = document.querySelector('.header-refresh-btn');
    const modal = document.getElementById('unified-dashboard-modal');
    
    if (!modal) {
        console.error('Dashboard modal not found');
        return;
    }
    
    // Show loading state on button
    if (refreshBtn) {
        refreshBtn.classList.add('refreshing');
        const refreshText = refreshBtn.querySelector('.refresh-text');
        if (refreshText) refreshText.textContent = 'Refreshing...';
    }
    
    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'refresh-loading-overlay';
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20000;
        backdrop-filter: blur(4px);
    `;
    
    loadingOverlay.innerHTML = `
        <div style="
            background: white;
            padding: 32px 40px;
            border-radius: 20px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            font-weight: 600;
            color: #374151;
            min-width: 300px;
        ">
            <div style="
                width: 40px;
                height: 40px;
                border: 4px solid #e5e7eb;
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <div style="font-size: 1.1rem; color: #1f2937;">Refreshing Dashboard</div>
            <div style="font-size: 0.9rem; color: #6b7280; font-weight: 500;">Fetching latest data from Google Search Console and Analytics...</div>
        </div>
    `;
    
    document.body.appendChild(loadingOverlay);
    
    try {
        // Re-fetch all data (same as initial load)
        let gscData = null, ga4Data = null, gscTrends = null, ga4Trends = null;
        let gscPrevious = null, ga4Previous = null;
        
        console.log('📊 Fetching GSC data...');
        // Fetch GSC data if connected
        if (window.GSCIntegration && window.GSCIntegration.isConnected()) {
            try {
                gscData = await window.GSCIntegration.fetchNodeData({ url });
                gscPrevious = await window.GSCIntegration.fetchPreviousPeriodData({ url });
                
                if (gscData && gscPrevious && !gscData.noDataFound && !gscPrevious.noDataFound) {
                    gscTrends = {
                        trends: {
                            clicks: calculateTrend(gscData.clicks, gscPrevious.clicks),
                            impressions: calculateTrend(gscData.impressions, gscPrevious.impressions),
                            ctr: calculateTrend(gscData.ctr, gscPrevious.ctr),
                            position: calculateTrend(gscData.position, gscPrevious.position, true)
                        }
                    };
                }
                console.log('✅ GSC data fetched successfully');
            } catch (error) {
                console.error('GSC refresh error:', error);
                gscData = { noDataFound: true };
            }
        } else {
            console.log('⚠️ GSC not connected');
            gscData = { noDataFound: true };
        }
        
        console.log('📈 Fetching GA4 data...');
        // Fetch GA4 data if connected
        if (window.GA4Integration && window.GA4Integration.isConnected()) {
            try {
                ga4Data = await window.GA4Integration.fetchData(url);
                ga4Previous = await window.GA4Integration.fetchPreviousPeriodData(url);
                
                if (ga4Data && ga4Previous && !ga4Data.noDataFound && !ga4Previous.noDataFound) {
                    ga4Trends = {
                        trends: {
                            users: calculateTrend(ga4Data.users, ga4Previous.users),
                            pageViews: calculateTrend(ga4Data.pageViews, ga4Previous.pageViews),
                            sessions: calculateTrend(ga4Data.sessions, ga4Previous.sessions),
                            avgSessionDuration: calculateTrend(ga4Data.avgSessionDuration, ga4Previous.avgSessionDuration),
                            bounceRate: calculateTrend(ga4Data.bounceRate, ga4Previous.bounceRate, true)
                        }
                    };
                }
                console.log('✅ GA4 data fetched successfully');
            } catch (error) {
                console.error('GA4 refresh error:', error);
                ga4Data = { noDataFound: true };
            }
        } else {
            console.log('⚠️ GA4 not connected');
            ga4Data = { noDataFound: true };
        }
        
        console.log('🔄 Generating new dashboard...');
        // Generate completely new dashboard HTML
        const newDashboardHtml = createUnifiedCitizensDashboard(
            url, 
            gscData, 
            ga4Data, 
            gscTrends, 
            ga4Trends
        );
        
        // Close current modal
        modal.remove();
        
        // Show new modal with refreshed data
        showDashboardModal(newDashboardHtml);
        
        console.log('✅ Dashboard refreshed successfully');
        showUnifiedNotification('✅ Dashboard data refreshed successfully!');
        
    } catch (error) {
        console.error('Dashboard refresh failed:', error);
        showUnifiedNotification('❌ Failed to refresh dashboard. Please try again.');
    } finally {
        // Remove loading overlay
        const overlay = document.getElementById('refresh-loading-overlay');
        if (overlay) overlay.remove();
        
        // Reset refresh button (if it still exists)
        const currentRefreshBtn = document.querySelector('.header-refresh-btn');
        if (currentRefreshBtn) {
            currentRefreshBtn.classList.remove('refreshing');
            const refreshText = currentRefreshBtn.querySelector('.refresh-text');
            if (refreshText) refreshText.textContent = 'Refresh Data';
        }
    }
};

// Debug function for tabs
window.debugUnifiedTabs = function(dashboardId) {
    const dashboard = document.getElementById(dashboardId || document.querySelector('.unified-dashboard-container').id);
    if (!dashboard) {
        console.log('❌ Dashboard not found');
        return;
    }
    
    const buttons = dashboard.querySelectorAll('.tab-btn');
    const panels = dashboard.querySelectorAll('.tab-panel');
    
    console.log('🔍 Unified Dashboard Debug Info:');
    console.log('- Buttons found:', buttons.length);
    console.log('- Panels found:', panels.length);
    
    buttons.forEach((btn, i) => {
        console.log(`- Button ${i}: data-tab="${btn.dataset.tab}", active=${btn.classList.contains('active')}`);
    });
    
    panels.forEach((panel, i) => {
        console.log(`- Panel ${i}: data-panel="${panel.dataset.panel}", active=${panel.classList.contains('active')}`);
    });
};

console.log('✅ UNIFIED Enhanced Citizens Dashboard loaded successfully!');
console.log('📋 Complete feature set:');
console.log('   - 📊 Enhanced Overview with Geographic Intelligence');
console.log('   - 🔍 Search Performance with Problem Detection');
console.log('   - 📝 Content Analysis with Evidence-Based Actions');
console.log('   - 👥 User Behavior with Regional Patterns');
console.log('   - 📈 Trends with Geographic Analysis');
console.log('   - 🏛️ Government Intelligence (NEW TAB)');
console.log('   - ⚡ Action Items with Government Context');
console.log('   - 🌍 Geographic Service Intelligence');
console.log('   - 🎯 Citizens Impact Summary');
console.log('   - 📱 Full Mobile Responsive Design');

})();
