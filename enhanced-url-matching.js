// enhanced-url-matching.js - Add this to improve URL matching between GSC and GA4

(function() {
    
    // Enhanced URL matching system
    class URLMatcher {
        constructor() {
            this.cache = new Map(); // Cache successful matches
        }

        // Create comprehensive URL variations for better matching
        createAllVariations(originalUrl) {
            const variations = new Set();
            
            if (!originalUrl) return ['/'];
            
            try {
                let baseUrl, pathname, search, hash;
                
                // Handle different URL formats
                if (originalUrl.startsWith('http')) {
                    // Full URL: https://www.citizensinformation.ie/en/housing/
                    const urlObj = new URL(originalUrl);
                    baseUrl = urlObj.origin;
                    pathname = urlObj.pathname;
                    search = urlObj.search;
                    hash = urlObj.hash;
                } else if (originalUrl.startsWith('/')) {
                    // Path only: /en/housing/
                    pathname = originalUrl;
                    search = '';
                    hash = '';
                } else {
                    // Relative: en/housing/
                    pathname = '/' + originalUrl;
                    search = '';
                    hash = '';
                }

                // Core path variations
                const pathVariations = this.createPathVariations(pathname);
                
                // For each path variation, create GSC and GA4 versions
                pathVariations.forEach(path => {
                    // GA4 versions (paths only)
                    variations.add(path);
                    variations.add(path + search + hash);
                    
                    // GSC versions (full URLs) - if we have a base URL
                    if (baseUrl) {
                        variations.add(baseUrl + path);
                        variations.add(baseUrl + path + search + hash);
                    }
                });

                console.log(`[URL Matcher] Generated ${variations.size} variations for: ${originalUrl}`);
                return Array.from(variations);
                
            } catch (error) {
                console.warn('[URL Matcher] Error creating variations:', error);
                return [originalUrl];
            }
        }

        // Create path-specific variations
        createPathVariations(pathname) {
            const variations = new Set();
            
            if (!pathname) {
                variations.add('/');
                return Array.from(variations);
            }

            // Add original path
            variations.add(pathname);

            // Trailing slash variations
            if (pathname.endsWith('/')) {
                variations.add(pathname.slice(0, -1)); // Remove trailing slash
            } else {
                variations.add(pathname + '/'); // Add trailing slash
            }

            // Index page variations
            const withoutTrailingSlash = pathname.replace(/\/$/, '');
            const withTrailingSlash = pathname.endsWith('/') ? pathname : pathname + '/';
            
            variations.add(withoutTrailingSlash + '/index.html');
            variations.add(withoutTrailingSlash + '/index.php');
            variations.add(withTrailingSlash + 'index.html');
            variations.add(withTrailingSlash + 'index.php');

            // Remove index variations
            if (pathname.endsWith('/index.html')) {
                variations.add(pathname.replace('/index.html', '/'));
                variations.add(pathname.replace('/index.html', ''));
            }
            if (pathname.endsWith('/index.php')) {
                variations.add(pathname.replace('/index.php', '/'));
                variations.add(pathname.replace('/index.php', ''));
            }

            // Language code variations (for your Citizens Information case)
            const langPatterns = ['/en/', '/ga/', '/ie/'];
            langPatterns.forEach(lang => {
                if (pathname.includes(lang)) {
                    // Try without language
                    const withoutLang = pathname.replace(lang, '/');
                    if (withoutLang !== '//') {
                        variations.add(withoutLang);
                        variations.add(withoutLang.replace(/\/$/, ''));
                    }
                } else {
                    // Try with language prefixes
                    langPatterns.forEach(langPrefix => {
                        if (!pathname.includes(langPrefix)) {
                            const withLang = pathname.replace('/', langPrefix);
                            variations.add(withLang);
                        }
                    });
                }
            });

            // Clean up variations
            const cleanedVariations = Array.from(variations)
                .filter(v => v && v.length > 0)
                .filter(v => !v.includes('//')) // Remove double slashes
                .slice(0, 15); // Limit to prevent too many requests

            return cleanedVariations;
        }

        // Smart fetch that tries multiple variations
        async fetchWithVariations(fetchFunction, originalUrl, maxAttempts = 5) {
            // Check cache first
            const cacheKey = `${fetchFunction.name}-${originalUrl}`;
            if (this.cache.has(cacheKey)) {
                console.log(`[URL Matcher] Cache hit for: ${originalUrl}`);
                return this.cache.get(cacheKey);
            }

            const variations = this.createAllVariations(originalUrl);
            console.log(`[URL Matcher] Trying ${Math.min(maxAttempts, variations.length)} variations for: ${originalUrl}`);

            // Try variations in order of likelihood
            for (let i = 0; i < Math.min(maxAttempts, variations.length); i++) {
                const variation = variations[i];
                
                try {
                    console.log(`[URL Matcher] Attempt ${i + 1}: ${variation}`);
                    const result = await fetchFunction(variation);
                    
                    // Check if we got meaningful data
                    if (this.isValidResult(result)) {
                        console.log(`[URL Matcher] ✅ Success with variation: ${variation}`);
                        
                        // Cache the successful variation
                        this.cache.set(cacheKey, result);
                        
                        return result;
                    } else {
                        console.log(`[URL Matcher] ⚪ No data for: ${variation}`);
                    }
                    
                } catch (error) {
                    console.log(`[URL Matcher] ❌ Error with ${variation}:`, error.message);
                    
                    // Add delay for rate limiting
                    if (error.message.includes('429') || error.message.includes('rate')) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                
                // Small delay between attempts
                if (i < Math.min(maxAttempts, variations.length) - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // No successful variation found
            console.log(`[URL Matcher] ❌ No data found after ${Math.min(maxAttempts, variations.length)} attempts`);
            const noDataResult = { noDataFound: true, triedVariations: Math.min(maxAttempts, variations.length) };
            
            // Cache the negative result to avoid repeated attempts
            this.cache.set(cacheKey, noDataResult);
            
            return noDataResult;
        }

        // Check if a result contains meaningful data
        isValidResult(result) {
            if (!result || result.noDataFound) return false;
            
            // For GSC data
            if (result.clicks !== undefined) {
                return result.clicks > 0 || result.impressions > 0;
            }
            
            // For GA4 data
            if (result.pageViews !== undefined) {
                return result.pageViews > 0 || result.sessions > 0;
            }
            
            return false;
        }

        // Clear cache (useful for debugging)
        clearCache() {
            this.cache.clear();
            console.log('[URL Matcher] Cache cleared');
        }

        // Show cache contents (useful for debugging)
        showCache() {
            console.log('[URL Matcher] Cache contents:');
            this.cache.forEach((result, key) => {
                console.log(`${key}:`, this.isValidResult(result) ? '✅ Has data' : '⚪ No data');
            });
        }
    }

    // Create global URL matcher instance
    window.URLMatcher = new URLMatcher();

    // Enhanced wrapper functions for GSC and GA4
    async function fetchGSCWithSmartMatching(nodeData) {
        if (!window.GSCIntegration || !window.GSCIntegration.isConnected()) {
            return { noDataFound: true, error: 'GSC not connected' };
        }

        return await window.URLMatcher.fetchWithVariations(
            async (url) => {
                // Use GSC's existing fetch function
                return await window.GSCIntegration.fetchNodeData({ url: url });
            },
            nodeData.url
        );
    }

    async function fetchGA4WithSmartMatching(nodeData) {
        if (!window.GA4Integration || !window.GA4Integration.isConnected()) {
            return { noDataFound: true, error: 'GA4 not connected' };
        }

        return await window.URLMatcher.fetchWithVariations(
            async (url) => {
                // Use GA4's existing fetch function
                return await window.GA4Integration.fetchData(url);
            },
            nodeData.url
        );
    }

    // Override the combined data fetching function
    function enhanceCombinedDataFetching() {
        // Store original function
        const originalFetch = window.fetchCombinedAnalyticsData;
        
        // Enhanced version with smart matching
        window.fetchCombinedAnalyticsData = async function(nodeData) {
            console.log(`[Enhanced Fetching] Starting smart fetch for: ${nodeData.url}`);
            
            const results = { gsc: null, ga4: null };
            
            try {
                // Start both requests in parallel with smart matching
                const promises = [
                    fetchGSCWithSmartMatching(nodeData)
                        .then(data => { results.gsc = data; })
                        .catch(error => { 
                            console.warn('Enhanced GSC fetch failed:', error);
                            results.gsc = { noDataFound: true, error: error.message };
                        }),
                    
                    fetchGA4WithSmartMatching(nodeData)
                        .then(data => { results.ga4 = data; })
                        .catch(error => { 
                            console.warn('Enhanced GA4 fetch failed:', error);
                            results.ga4 = { noDataFound: true, error: error.message };
                        })
                ];
                
                // Wait for both to complete
                await Promise.all(promises);
                
                console.log(`[Enhanced Fetching] Results:`, {
                    gsc: results.gsc && !results.gsc.noDataFound ? '✅ Data found' : '⚪ No data',
                    ga4: results.ga4 && !results.ga4.noDataFound ? '✅ Data found' : '⚪ No data'
                });
                
            } catch (error) {
                console.error('[Enhanced Fetching] Error:', error);
            }
            
            return results;
        };
        
        console.log('✅ Enhanced URL matching enabled for combined analytics');
    }

    // Debugging functions
    window.URLMatcher.debug = {
        testUrl: (url) => {
            console.log('🧪 Testing URL variations for:', url);
            const variations = window.URLMatcher.createAllVariations(url);
            console.log('Generated variations:');
            variations.forEach((v, i) => console.log(`${i + 1}. ${v}`));
            return variations;
        },
        
        clearCache: () => {
            window.URLMatcher.clearCache();
        },
        
        showCache: () => {
            window.URLMatcher.showCache();
        },
        
        testMatching: async (url) => {
            console.log('🔄 Testing smart matching for:', url);
            
            // Test both data sources
            const gscResult = await fetchGSCWithSmartMatching({ url });
            const ga4Result = await fetchGA4WithSmartMatching({ url });
            
            console.log('Results:');
            console.log('GSC:', gscResult);
            console.log('GA4:', ga4Result);
            
            return { gsc: gscResult, ga4: ga4Result };
        }
    };

    // Initialize when page loads
    function initializeEnhancedMatching() {
        // Wait for both integrations
        const checkReady = () => {
            if (window.GSCIntegration && window.GA4Integration) {
                enhanceCombinedDataFetching();
                console.log('🚀 Enhanced URL matching initialized');
            } else {
                setTimeout(checkReady, 100);
            }
        };
        checkReady();
    }

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeEnhancedMatching);
    } else {
        initializeEnhancedMatching();
    }

    // Console help
    setTimeout(() => {
        console.log(`
🔗 Enhanced URL Matching Ready!

Debug commands:
• URLMatcher.debug.testUrl('/en/housing/') - Test URL variations
• URLMatcher.debug.testMatching('/en/housing/') - Test full matching
• URLMatcher.debug.showCache() - View cached results
• URLMatcher.debug.clearCache() - Clear cache

The system now automatically tries multiple URL variations to match data between GSC and GA4!
        `);
    }, 1000);

})();