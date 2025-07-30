// standalone-ga4-integration.js - Corrected Clean Version

(function() {
    // GA4 Configuration
    const GA4_CONFIG = {
        CLIENT_ID: '550630256834-9quh64fnqhfse6s488c8gutstuqcch04.apps.googleusercontent.com',
        SCOPES: 'https://www.googleapis.com/auth/analytics.readonly'
    };

    // GA4 state variables
    let ga4Connected = false;
    let ga4PropertyId = null;
    let ga4AccessToken = null;
    let ga4TokenClient = null;
    let ga4DataCache = new Map();

    // Debug logging
    function ga4Log(message, data = null) {
        console.log(`[GA4 Integration] ${message}`, data || '');
    }

    // ===========================================
    // BASIC GA4 CONNECTION FUNCTIONS
    // ===========================================

    function initGA4Integration() {
        ga4Log('Initializing standalone GA4 integration...');
        addGA4Button();
        addGA4Styles();
        initializeGA4Auth();
    }

    function initializeGA4Auth() {
        ga4Log('Setting up GA4 authentication...');
        
        const checkGIS = () => {
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                createGA4TokenClient();
            } else {
                setTimeout(checkGIS, 100);
            }
        };
        checkGIS();
    }

    function createGA4TokenClient() {
        try {
            ga4TokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GA4_CONFIG.CLIENT_ID,
                scope: GA4_CONFIG.SCOPES,
                callback: handleGA4AuthResponse,
                error_callback: (error) => {
                    console.error('[GA4] Authentication error:', error);
                    alert('GA4 Authentication error: ' + (error.message || 'Unknown error'));
                }
            });
            
            ga4Log('GA4 token client created successfully');
        } catch (error) {
            console.error('[GA4] Failed to create token client:', error);
        }
    }

    function handleGA4AuthResponse(response) {
        ga4Log('GA4 auth response received', response);
        hideGA4LoadingState();
        
        if (response.error) {
            console.error('[GA4] Authentication error:', response);
            updateGA4ConnectionStatus(false);
            return;
        }
        
        ga4AccessToken = response.access_token;
        ga4Log('GA4 access token received');
        
        if (typeof gapi !== 'undefined' && gapi.client) {
            gapi.client.setToken({ access_token: ga4AccessToken });
        }
        
        setupGA4Connection();
    }

    async function setupGA4Connection() {
        try {
            hideGA4LoadingMessage();
            
            const manualPropertyId = await showManualPropertyIdDialog();
            
            if (manualPropertyId) {
                showGA4LoadingMessage('Testing property connection...');
                
                const isValid = await testGA4Property(manualPropertyId);
                
                hideGA4LoadingMessage();
                
                if (isValid) {
                    ga4PropertyId = manualPropertyId;
                    ga4Connected = true;
                    updateGA4ConnectionStatus(true);
                    showGA4SuccessMessage(`Property ${manualPropertyId}`);
                    ga4Log('GA4 connected with manual property ID:', manualPropertyId);
                } else {
                    alert('Could not access this property. Please check:\n• Property ID is correct\n• You have access to this GA4 property');
                    updateGA4ConnectionStatus(false);
                }
            } else {
                updateGA4ConnectionStatus(false);
            }
            
        } catch (error) {
            hideGA4LoadingMessage();
            console.error('[GA4] Setup failed:', error);
            alert('Failed to setup GA4 connection: ' + error.message);
            updateGA4ConnectionStatus(false);
        }
    }

    async function showManualPropertyIdDialog() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
            align-items: center; justify-content: center; padding: 20px;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white; padding: 30px; border-radius: 15px;
            max-width: 500px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        `;
        
        // Configuration object for GA4 properties
        const GA4_PROPERTIES = [
            {
                name: "Citizens Information",
                description: "Citizens Information website",
                propertyId: "341170035"
            },
            {
                name: "Citizens Information Board",
                description: "Citizens Information Board website",
                propertyId: "384792858"
            },
            {
                name: "MABS",
                description: "Money Advice and Budgeting Service",
                propertyId: "255956752"
            },
            {
                name: "RISLI",
                description: "Register of Sign Language Interpreters",
                propertyId: "254639858"
            }
        ];
        
        content.innerHTML = `
            <h3 style="margin-bottom: 20px; color: #ff6b35;">Select Your GA4 Property</h3>
            
            <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #17a2b8;">
                <strong>ℹ️ Quick Selection</strong><br>
                Choose from your configured GA4 properties below, or enter a custom Property ID.
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                    Choose Property:
                </label>
                <select id="propertySelect" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box; background: white;">
                    <option value="">-- Select a Property --</option>
                    ${GA4_PROPERTIES.map(prop => 
                        `<option value="${prop.propertyId}">${prop.name} - ${prop.description}</option>`
                    ).join('')}
                    <option value="custom">🔧 Enter Custom Property ID</option>
                </select>
            </div>
            
            <div id="customIdSection" style="margin-bottom: 20px; display: none;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                    Custom GA4 Property ID:
                </label>
                <input type="text" id="propertyIdInput" placeholder="e.g., 123456789" 
                       style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;"/>
                <div style="margin-top: 8px; font-size: 0.9rem; color: #666;">
                    This is usually a 9-10 digit number
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <strong>📍 How to find your Property ID:</strong>
                    <ol style="margin: 8px 0 0 20px; color: #666; font-size: 0.9rem; line-height: 1.4;">
                        <li>Go to <a href="https://analytics.google.com" target="_blank" style="color: #ff6b35;">analytics.google.com</a></li>
                        <li>Click the gear icon ⚙️ (Admin) in the bottom left</li>
                        <li>In the "Property" column, click "Property Settings"</li>
                        <li>Copy the Property ID from the top of the page</li>
                    </ol>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="cancelBtn" style="padding: 12px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Cancel
                </button>
                <button id="connectBtn" style="padding: 12px 20px; background: #ff6b35; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Connect Property
                </button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        const propertySelect = content.querySelector('#propertySelect');
        const customIdSection = content.querySelector('#customIdSection');
        const customInput = content.querySelector('#propertyIdInput');
        const cancelBtn = content.querySelector('#cancelBtn');
        const connectBtn = content.querySelector('#connectBtn');
        
        // Show/hide custom input based on selection
        propertySelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customIdSection.style.display = 'block';
                setTimeout(() => customInput.focus(), 100);
            } else {
                customIdSection.style.display = 'none';
            }
        });
        
        // Handle enter key in custom input
        customInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                connectBtn.click();
            }
        });
        
        cancelBtn.onclick = () => {
            modal.remove();
            resolve(null);
        };
        
        connectBtn.onclick = () => {
            const selectedValue = propertySelect.value;
            
            if (!selectedValue) {
                alert('Please select a property or choose "Enter Custom Property ID"');
                propertySelect.focus();
                return;
            }
            
            let propertyId;
            
            if (selectedValue === 'custom') {
                propertyId = customInput.value.trim();
                
                if (!propertyId) {
                    alert('Please enter a Property ID');
                    customInput.focus();
                    return;
                }
                
                if (!/^\d{8,12}$/.test(propertyId)) {
                    alert('Property ID should be 8-12 digits (numbers only)');
                    customInput.focus();
                    customInput.select();
                    return;
                }
            } else {
                propertyId = selectedValue;
            }
            
            modal.remove();
            resolve(propertyId);
        };
        
        modal.onclick = () => {
            modal.remove();
            resolve(null);
        };
        
        content.onclick = e => e.stopPropagation();
        
        // Focus the select dropdown initially
        setTimeout(() => propertySelect.focus(), 100);
    });
}

    async function testGA4Property(propertyId) {
        try {
            ga4Log('Testing GA4 property ID:', propertyId);
            
            const today = new Date();
            const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
            
            const requestBody = {
                dateRanges: [{
                    startDate: sevenDaysAgo.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                }],
                metrics: [{ name: 'screenPageViews' }],
                limit: 1
            };
            
            ga4Log('Making test request to property:', propertyId);
            ga4Log('Request body:', requestBody);
            
            const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ga4AccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            ga4Log('Response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                ga4Log('✅ Property ID test successful, data:', data);
                return true;
            } else {
                const errorText = await response.text();
                ga4Log('❌ Property ID test failed:', response.status, errorText);
                
                let errorDetails = '';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetails = errorJson.error?.message || errorText;
                } catch (e) {
                    errorDetails = errorText;
                }
                
                showDetailedErrorMessage(response.status, errorDetails, propertyId);
                return false;
            }
            
        } catch (error) {
            ga4Log('❌ Property ID test error:', error);
            alert('Network error testing property: ' + error.message);
            return false;
        }
    }

    function showDetailedErrorMessage(status, errorDetails, propertyId) {
        let message = '';
        let suggestions = '';
        
        switch (status) {
            case 403:
                message = `Access denied to GA4 property ${propertyId}`;
                suggestions = `Possible causes:
• You don't have access to this GA4 property
• The property ID is incorrect
• The property exists but you're not added as a user

Try:
• Double-check the Property ID in GA4 settings
• Ask the GA4 admin to add your email as a user
• Make sure you're signed in with the correct Google account`;
                break;
                
            case 404:
                message = `GA4 property ${propertyId} not found`;
                suggestions = `Possible causes:
• Property ID is incorrect (check for typos)
• Property might have been deleted
• You might be looking at a different GA4 account

Try:
• Double-check the Property ID in GA4 Admin → Property Settings
• Make sure you're in the correct GA4 account`;
                break;
                
            case 400:
                message = `Invalid request to GA4 property ${propertyId}`;
                suggestions = `Possible causes:
• Property ID format is wrong
• This might be a Universal Analytics ID instead of GA4

Try:
• GA4 Property IDs are usually 9-10 digits
• Don't use UA-XXXXXXX-X format (that's Universal Analytics)`;
                break;
                
            default:
                message = `Error ${status} accessing GA4 property ${propertyId}`;
                suggestions = `Error details: ${errorDetails}`;
        }
        
        showErrorModal(message, suggestions, errorDetails);
    }

    function showErrorModal(message, suggestions, details) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
            align-items: center; justify-content: center; padding: 20px;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white; padding: 30px; border-radius: 15px;
            max-width: 600px; max-height: 80vh; overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        `;
        
        content.innerHTML = `
            <h3 style="margin-bottom: 20px; color: #dc3545;">❌ GA4 Connection Failed</h3>
            
            <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
                <strong>${message}</strong>
            </div>
            
            <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                <strong>💡 Troubleshooting Steps:</strong><br>
                <pre style="white-space: pre-wrap; font-family: inherit; margin: 8px 0 0 0;">${suggestions}</pre>
            </div>
            
            ${details ? `
            <details style="margin-bottom: 20px;">
                <summary style="cursor: pointer; color: #666; font-size: 0.9rem;">Technical Details</summary>
                <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 0.8rem; margin-top: 8px; overflow-x: auto;">${details}</pre>
            </details>
            ` : ''}
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="tryAgainBtn" style="padding: 12px 20px; background: #ff6b35; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Try Different Property ID
                </button>
                <button id="closeBtn" style="padding: 12px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        content.querySelector('#closeBtn').onclick = () => modal.remove();
        content.querySelector('#tryAgainBtn').onclick = () => {
            modal.remove();
            setTimeout(() => toggleGA4Connection(), 100);
        };
        
        modal.onclick = () => modal.remove();
        content.onclick = e => e.stopPropagation();
    }

    // ===========================================
    // GA4 DATA FETCHING
    // ===========================================

    function urlToGA4Path(url) {
        if (!url) return '/';
        
        try {
            if (url.startsWith('http')) {
                const urlObj = new URL(url);
                return urlObj.pathname + urlObj.search + urlObj.hash;
            }
            
            if (url.startsWith('/')) {
                return url;
            }
            
            return '/' + url;
            
        } catch (e) {
            return url.startsWith('/') ? url : '/' + url;
        }
    }

    async function fetchGA4DataForPage(pageUrl) {
        if (!ga4Connected || !ga4PropertyId || !ga4AccessToken) {
            ga4Log('GA4 not connected, cannot fetch data');
            return null;
        }
        
        const pagePath = urlToGA4Path(pageUrl);
        ga4Log('Fetching GA4 data for path:', pagePath);
        
        if (ga4DataCache.has(pagePath)) {
            ga4Log('Returning cached GA4 data for:', pagePath);
            return ga4DataCache.get(pagePath);
        }
        
        try {
            const today = new Date();
            const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
            
            // Make multiple API calls for enhanced data
const [basicData, geoData, trafficData] = await Promise.all([
    
    // 1. Basic metrics (your existing call)
    fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ga4AccessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            dateRanges: [{
                startDate: thirtyDaysAgo.toISOString().split('T')[0],
                endDate: today.toISOString().split('T')[0]
            }],
            dimensions: [{ name: 'pagePath' }],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'newUsers' },
                { name: 'averageSessionDuration' },
                { name: 'bounceRate' },
                { name: 'engagementRate' }
            ],
            dimensionFilter: {
                filter: {
                    fieldName: 'pagePath',
                    stringFilter: {
                        matchType: 'EXACT',
                        value: pagePath
                    }
                }
            },
            limit: 1
        })
    }),
    
    // 2. NEW: Geographic data
    fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ga4AccessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            dateRanges: [{
                startDate: thirtyDaysAgo.toISOString().split('T')[0],
                endDate: today.toISOString().split('T')[0]
            }],
            dimensions: [
                { name: 'pagePath' },
                { name: 'country' },
                { name: 'region' },
                { name: 'city' }
            ],
            metrics: [
                { name: 'activeUsers' },
                { name: 'screenPageViews' }
            ],
            dimensionFilter: {
                filter: {
                    fieldName: 'pagePath',
                    stringFilter: {
                        matchType: 'EXACT',
                        value: pagePath
                    }
                }
            },
            limit: 10
        })
    }),
    
    // 3. NEW: Enhanced traffic sources
    fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ga4AccessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            dateRanges: [{
                startDate: thirtyDaysAgo.toISOString().split('T')[0],
                endDate: today.toISOString().split('T')[0]
            }],
            dimensions: [
                { name: 'pagePath' },
                { name: 'sessionDefaultChannelGrouping' },
                { name: 'sessionSource' },
                { name: 'sessionMedium' }
            ],
            metrics: [
                { name: 'sessions' },
                { name: 'activeUsers' }
            ],
            dimensionFilter: {
                filter: {
                    fieldName: 'pagePath',
                    stringFilter: {
                        matchType: 'EXACT',
                        value: pagePath
                    }
                }
            },
            limit: 10
        })
    })
]);
            
            // Process all three responses
const [basicResponse, geoResponse, trafficResponse] = await Promise.all([
    basicData.json(),
    geoData.json(),
    trafficData.json()
]);

let ga4Data = {
    pagePath: pagePath,
    pageViews: 0,
    sessions: 0,
    users: 0,
    newUsers: 0,
    avgSessionDuration: 0,
    bounceRate: 0,
    engagementRate: 0,
    noDataFound: true,
    fetchedAt: Date.now(),
    
    // NEW: Geographic data
    geographic: {
        countries: [],
        regions: [],
        cities: [],
        topCountry: null,
        internationalTraffic: 0
    },
    
    // NEW: Enhanced traffic sources
    trafficSources: {
        channels: [],
        sources: [],
        topChannel: null,
        organicPercent: 0
    }
};

// Process basic data (your existing logic)
if (basicResponse.rows && basicResponse.rows.length > 0) {
    const row = basicResponse.rows[0];
    const metrics = row.metricValues;
    
    ga4Data = {
        ...ga4Data,
        pageViews: parseInt(metrics[0]?.value || 0),
        sessions: parseInt(metrics[1]?.value || 0),
        users: parseInt(metrics[2]?.value || 0),
        newUsers: parseInt(metrics[3]?.value || 0),
        avgSessionDuration: parseFloat(metrics[4]?.value || 0),
        bounceRate: parseFloat(metrics[5]?.value || 0),
        engagementRate: parseFloat(metrics[6]?.value || 0),
        noDataFound: false
    };
}

// NEW: Process geographic data
if (geoResponse.rows && geoResponse.rows.length > 0) {
    const countries = {};
    const regions = {};
    const cities = {};
    
    geoResponse.rows.forEach(row => {
        const country = row.dimensionValues[1].value;
        const region = row.dimensionValues[2].value;
        const city = row.dimensionValues[3].value;
        const users = parseInt(row.metricValues[0].value);
        
        // Aggregate by country
        if (!countries[country]) countries[country] = 0;
        countries[country] += users;
        
        // Aggregate by region (if Ireland)
        if (country === 'Ireland' && region !== '(not set)') {
            if (!regions[region]) regions[region] = 0;
            regions[region] += users;
        }
        
        // Top cities
        if (city !== '(not set)') {
            if (!cities[city]) cities[city] = 0;
            cities[city] += users;
        }
    });
    
    // Convert to arrays and sort
    ga4Data.geographic.countries = Object.entries(countries)
        .map(([country, users]) => ({ country, users, percentage: (users / ga4Data.users) * 100 }))
        .sort((a, b) => b.users - a.users);
    
    ga4Data.geographic.regions = Object.entries(regions)
        .map(([region, users]) => ({ region, users, percentage: (users / ga4Data.users) * 100 }))
        .sort((a, b) => b.users - a.users);
    
    ga4Data.geographic.cities = Object.entries(cities)
        .map(([city, users]) => ({ city, users, percentage: (users / ga4Data.users) * 100 }))
        .sort((a, b) => b.users - a.users)
        .slice(0, 5); // Top 5 cities only
    
    ga4Data.geographic.topCountry = ga4Data.geographic.countries[0]?.country || 'Ireland';
    ga4Data.geographic.internationalTraffic = ga4Data.geographic.countries
        .filter(c => c.country !== 'Ireland')
        .reduce((sum, c) => sum + c.percentage, 0);
}

// NEW: Process traffic sources
if (trafficResponse.rows && trafficResponse.rows.length > 0) {
    const channels = {};
    const sources = {};
    
    trafficResponse.rows.forEach(row => {
        const channel = row.dimensionValues[1].value;
        const source = row.dimensionValues[2].value;
        const sessions = parseInt(row.metricValues[0].value);
        
        // Aggregate by channel
        if (!channels[channel]) channels[channel] = 0;
        channels[channel] += sessions;
        
        // Aggregate by source
        if (!sources[source]) sources[source] = 0;
        sources[source] += sessions;
    });
    
    const totalSessions = ga4Data.sessions || 1;
    
    ga4Data.trafficSources.channels = Object.entries(channels)
        .map(([channel, sessions]) => ({ 
            channel, 
            sessions, 
            percentage: (sessions / totalSessions) * 100 
        }))
        .sort((a, b) => b.sessions - a.sessions);
    
    ga4Data.trafficSources.sources = Object.entries(sources)
        .map(([source, sessions]) => ({ 
            source, 
            sessions, 
            percentage: (sessions / totalSessions) * 100 
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 5); // Top 5 sources
    
    ga4Data.trafficSources.topChannel = ga4Data.trafficSources.channels[0]?.channel || 'Unknown';
    ga4Data.trafficSources.organicPercent = ga4Data.trafficSources.channels
        .find(c => c.channel === 'Organic Search')?.percentage || 0;
}

ga4Log('Enhanced GA4 data processed for:', pagePath, ga4Data);
            
            ga4DataCache.set(pagePath, ga4Data);
            return ga4Data;
            
        } catch (error) {
            ga4Log('Error fetching GA4 data:', error);
            
            const errorData = {
                pagePath: pagePath,
                error: error.message,
                noDataFound: true,
                fetchedAt: Date.now()
            };
            ga4DataCache.set(pagePath, errorData);
            
            return errorData;
        }
    }

    // ===========================================
    // UI FUNCTIONS
    // ===========================================

function addGA4Button() {
    const checkAndAdd = () => {
        const navBar = document.querySelector('.nav-group') || 
                      document.querySelector('.nav-bar') || 
                      document.querySelector('nav') ||
                      document.querySelector('[class*="nav"]');
        
        if (!navBar) {
            setTimeout(checkAndAdd, 100);
            return;
        }
        
        if (document.getElementById('ga4ConnectBtn')) {
            ga4Log('GA4 button already exists');
            return;
        }
        
        const ga4Button = document.createElement('button');
        ga4Button.className = 'nav-btn nav-ga4-btn';
        ga4Button.id = 'ga4ConnectBtn';
        ga4Button.onclick = toggleGA4Connection;
        
        // Updated button HTML with status light
        ga4Button.innerHTML = `
            <svg id="ga4Icon" width="18" height="18" viewBox="0 0 24 24" style="flex-shrink: 0;">
                <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span id="ga4Text">GA4</span>
            <div id="ga4StatusLight" class="ga4-status-light"></div>
        `;
        
        ga4Button.style.cssText = `
            display: flex !important;
            align-items: center;
            gap: 8px;
            padding: 8px 16px !important;
            margin: 0 8px !important;
            background: #ffffff !important;
            border: 1px solid #dadce0 !important;
            border-radius: 8px !important;
            cursor: pointer;
            font-size: 14px !important;
            color: #3c4043 !important;
            transition: all 0.2s ease;
            font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-weight: 500;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
        
        const gscButton = document.getElementById('gscConnectBtn');
        if (gscButton) {
            navBar.insertBefore(ga4Button, gscButton);
        } else {
            navBar.appendChild(ga4Button);
        }
        
        ga4Log('GA4 button added to navigation');
    };
    
    checkAndAdd();
}

    function toggleGA4Connection() {
        ga4Log('Toggle GA4 connection called. Current state:', ga4Connected);
        
        if (ga4Connected) {
            if (ga4AccessToken) {
                google.accounts.oauth2.revoke(ga4AccessToken, () => {
                    ga4Log('GA4 access token revoked');
                });
            }
            disconnectGA4();
        } else {
            if (!ga4TokenClient) {
                alert('GA4 services are still loading. Please wait a moment and try again.');
                return;
            }
            
            ga4Log('Requesting GA4 access token...');
            showGA4LoadingState();
            
            try {
                ga4TokenClient.requestAccessToken({ prompt: '' });
            } catch (error) {
                console.error('[GA4] Error requesting access token:', error);
                hideGA4LoadingState();
                alert('Failed to open GA4 authentication window. Please check your popup blocker.');
            }
        }
    }

    function disconnectGA4() {
        ga4Connected = false;
        ga4PropertyId = null;
        ga4AccessToken = null;
        ga4DataCache.clear();
        updateGA4ConnectionStatus(false);
        ga4Log('GA4 disconnected');
    }

    function updateGA4ConnectionStatus(connected) {
    ga4Connected = connected;
    const ga4Btn = document.getElementById('ga4ConnectBtn');
    const ga4Text = document.getElementById('ga4Text');
    const ga4StatusLight = document.getElementById('ga4StatusLight');
    
    if (ga4Btn && ga4Text && ga4StatusLight) {
        if (connected) {
            // Connected state: Green light
            ga4Btn.classList.add('connected');
            ga4Btn.style.background = '#ffffff !important';
            ga4Btn.style.color = '#3c4043 !important';
            ga4Btn.style.borderColor = '#34a853 !important';
            ga4Text.textContent = 'GA4';
            
            // Set green status light
            ga4StatusLight.style.backgroundColor = '#34a853';
            ga4StatusLight.classList.add('connected');
            
        } else {
            // Not connected state: Red light
            ga4Btn.classList.remove('connected');
            ga4Btn.style.background = '#ffffff !important';
            ga4Btn.style.color = '#3c4043 !important';
            ga4Btn.style.borderColor = '#dadce0 !important';
            ga4Text.textContent = 'GA4';
            
            // Set red status light
            ga4StatusLight.style.backgroundColor = '#ea4335';
            ga4StatusLight.classList.remove('connected');
        }
    }
    
    ga4Log('GA4 connection status updated:', connected);
}

    function showGA4LoadingState() {
    const ga4Text = document.getElementById('ga4Text');
    if (ga4Text) {
        // Just show the loading dots animation without "Connecting" text
        ga4Text.innerHTML = '<span class="ga4-loading-dots"><span></span><span></span><span></span></span>';
    }
}

    function hideGA4LoadingState() {
        // Status will be updated by updateGA4ConnectionStatus
    }

    function showGA4LoadingMessage(message) {
        const existingMessage = document.getElementById('ga4LoadingMessage');
        if (existingMessage) existingMessage.remove();
        
        const messageDiv = document.createElement('div');
        messageDiv.id = 'ga4LoadingMessage';
        messageDiv.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #ff6b35;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-size: 14px;
        `;
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
    }

    function hideGA4LoadingMessage() {
        const message = document.getElementById('ga4LoadingMessage');
        if (message) message.remove();
    }

    function showGA4SuccessMessage(propertyName) {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 300px;
        `;
        message.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 28px;"><svg id="ga4Icon" width="28" height="28" viewBox="0 0 24 24" style="flex-shrink: 0;">
                <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg></span>
                <div>
                    <div style="font-weight: bold;">GA4 Connected!</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">${propertyName}</div>
                </div>
            </div>
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.style.transition = 'opacity 0.3s';
            message.style.opacity = '0';
            setTimeout(() => message.remove(), 300);
        }, 4000);
    }

    // Replace the addGA4Styles() function in your standalone-ga4-integration.js with this enhanced version:

function addGA4Styles() {
    if (document.getElementById('ga4-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ga4-styles';
    style.textContent = `
        .nav-ga4-btn {
            position: relative !important;
            overflow: hidden !important;
        }
        
        .nav-ga4-btn:hover {
            background: #f8f9fa !important;
            border-color: #ff6b35 !important;
            box-shadow: 0 2px 8px rgba(255, 107, 53, 0.15) !important;
            transform: translateY(-1px);
        }
        
        .nav-ga4-btn.connected {
            animation: ga4-connected-glow 3s ease-in-out infinite;
        }
        
        .nav-ga4-btn.connected:hover {
            border-color: #34a853 !important;
            box-shadow: 0 2px 8px rgba(52, 168, 83, 0.15) !important;
        }
        
        /* Status light styles */
        .ga4-status-light {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #ea4335;
            border: 1px solid rgba(255, 255, 255, 0.8);
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            flex-shrink: 0;
        }
        
        .ga4-status-light.connected {
            background-color: #34a853;
            animation: ga4-status-pulse 2s ease-in-out infinite;
        }
        
        @keyframes ga4-connected-glow {
            0%, 100% { 
                box-shadow: 0 2px 8px rgba(52, 168, 83, 0.3), 0 0 0 0 rgba(52, 168, 83, 0.4);
            }
            50% { 
                box-shadow: 0 2px 8px rgba(52, 168, 83, 0.3), 0 0 0 4px rgba(52, 168, 83, 0.1);
            }
        }
        
        @keyframes ga4-status-pulse {
            0%, 100% { 
                opacity: 1;
                transform: scale(1);
            }
            50% { 
                opacity: 0.7;
                transform: scale(1.1);
            }
        }

        /* NEW: Data flow animation for connected state - CONTAINED within button */
        .nav-ga4-btn.connected::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(52, 168, 83, 0.2), transparent);
            animation: ga4-data-flow 2.5s ease-in-out infinite;
            z-index: 1;
        }

        @keyframes ga4-data-flow {
            0% { left: -100%; }
            50% { left: 100%; }
            100% { left: 100%; }
        }

        /* Ensure content stays above shimmer */
        .nav-ga4-btn > * {
            position: relative;
            z-index: 2;
        }

        /* Enhanced icon animations */
        #ga4Icon {
            transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
            flex-shrink: 0;
        }

        .nav-ga4-btn.connected #ga4Icon {
            filter: drop-shadow(0 0 3px rgba(52, 168, 83, 0.6));
            animation: ga4-icon-glow 2s ease-in-out infinite alternate;
        }

        @keyframes ga4-icon-glow {
            0% { filter: drop-shadow(0 0 3px rgba(52, 168, 83, 0.6)); }
            100% { filter: drop-shadow(0 0 6px rgba(52, 168, 83, 0.8)); }
        }

        /* Enhanced text animation */
        #ga4Text {
            font-weight: 500;
            white-space: nowrap;
            letter-spacing: 0.25px;
            transition: all 0.3s ease;
        }

        .nav-ga4-btn.connected #ga4Text {
            text-shadow: 0 0 8px rgba(52, 168, 83, 0.3);
        }

        /* Success animation when first connected */
        .nav-ga4-btn.connecting {
            animation: ga4-connecting 0.6s ease-out;
        }

        @keyframes ga4-connecting {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        /* Click ripple effect */
        .nav-ga4-btn.connected:active {
            animation: ga4-click-ripple 0.3s ease-out;
        }

        @keyframes ga4-click-ripple {
            0% { box-shadow: 0 2px 8px rgba(52, 168, 83, 0.3), 0 0 0 0 rgba(52, 168, 83, 0.6); }
            100% { box-shadow: 0 2px 8px rgba(52, 168, 83, 0.3), 0 0 0 8px rgba(52, 168, 83, 0); }
        }
        
        .ga4-loading-dots {
            display: inline-flex;
            gap: 2px;
            margin-left: 4px;
        }
        
        .ga4-loading-dots span {
            width: 3px;
            height: 3px;
            border-radius: 50%;
            background: currentColor;
            opacity: 0.4;
            animation: ga4-loading-dot 1.4s ease-in-out infinite;
        }
        
        .ga4-loading-dots span:nth-child(1) { animation-delay: 0s; }
        .ga4-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .ga4-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes ga4-loading-dot {
            0%, 80%, 100% { opacity: 0.4; transform: scale(1); }
            40% { opacity: 1; transform: scale(1.2); }
        }
    `;
    document.head.appendChild(style);
    
    ga4Log('GA4 styles added');
}

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================

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

    // ===========================================
    // DEBUGGING FUNCTIONS (DEFINED AFTER MAIN FUNCTIONS)
    // ===========================================

    async function checkGA4Access() {
        if (!ga4AccessToken) {
            console.error('❌ Not authenticated. Click "Connect GA4" button first.');
            return;
        }
        
        console.log('🔍 Checking GA4 access...');
        console.log('✅ Access token exists (first 20 chars):', ga4AccessToken.substring(0, 20) + '...');
        
        try {
            console.log('📡 Testing Admin API access...');
            const response = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
                headers: {
                    'Authorization': `Bearer ${ga4AccessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('📊 Admin API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Admin API works! Response:', data);
                
                if (data.accountSummaries && data.accountSummaries.length > 0) {
                    console.log('📋 Your GA4 properties:');
                    let propertyCount = 0;
                    
                    data.accountSummaries.forEach(account => {
                        console.log(`📁 Account: ${account.displayName}`);
                        if (account.propertySummaries) {
                            account.propertySummaries.forEach(property => {
                                if (property.propertyType === 'PROPERTY_TYPE_GA4') {
                                    const propId = property.property.replace('properties/', '');
                                    console.log(`   📊 ${property.displayName} (ID: ${propId})`);
                                    propertyCount++;
                                }
                            });
                        }
                    });
                    
                    if (propertyCount === 0) {
                        console.log('⚠️ No GA4 properties found in your accounts');
                    }
                } else {
                    console.log('⚠️ No account summaries found');
                }
            } else {
                const errorText = await response.text();
                console.log('❌ Admin API failed:', response.status);
                console.log('📄 Error details:', errorText);
                console.log('💡 This is normal - we\'ll use manual property entry instead');
            }
        } catch (error) {
            console.log('❌ Admin API error:', error);
            console.log('💡 This is why we use manual property ID entry');
        }
        
        console.log('\n🧪 Testing Analytics Data API...');
        try {
            const testResponse = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/999999999:runReport', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ga4AccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-01' }],
                    metrics: [{ name: 'screenPageViews' }]
                })
            });
            
            console.log('📊 Analytics Data API status:', testResponse.status);
            
            if (testResponse.status === 404) {
                console.log('✅ Analytics Data API works (404 expected for invalid property)');
            } else if (testResponse.status === 403) {
                console.log('⚠️ Analytics Data API returns 403 - might be scope or permissions issue');
                const errorText = await testResponse.text();
                console.log('📄 Error details:', errorText);
            } else {
                console.log('ℹ️ Unexpected response:', testResponse.status);
            }
        } catch (error) {
            console.log('❌ Analytics Data API error:', error);
        }
        
        console.log('\n💡 Next steps:');
        console.log('   • If you see your property above, try: GA4Integration.debug.testSpecificProperty("YOUR_ID")');
        console.log('   • If no properties listed, check you\'re signed in with the correct Google account');
        console.log('   • Ask your GA4 admin to verify you have access to the property');
    }

    async function testSpecificProperty(propertyId) {
        if (!ga4AccessToken) {
            console.error('❌ Not authenticated. Click "Connect GA4" button first.');
            return false;
        }
        
        console.log(`🧪 Testing specific property: ${propertyId}`);
        
        try {
            const result = await testGA4Property(propertyId);
            
            if (result) {
                console.log('✅ Property test successful! You can use this property.');
                console.log('🔗 Auto-connecting to this property...');
                
                ga4PropertyId = propertyId;
                ga4Connected = true;
                updateGA4ConnectionStatus(true);
                showGA4SuccessMessage(`Property ${propertyId}`);
                
                console.log('🎉 Connected! You can now test URLs with:');
                console.log(`   GA4Integration.debug.testUrl('/your-page-path')`);
            } else {
                console.log('❌ Property test failed. Check the error details above.');
                console.log('💡 Make sure:');
                console.log('   • Property ID is correct (9-10 digits)');
                console.log('   • You have access to this GA4 property');
                console.log('   • You\'re signed in with the correct Google account');
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error testing property:', error);
            return false;
        }
    }

    async function testUrlData(url) {
        if (!ga4Connected) {
            console.error('GA4 not connected');
            return null;
        }
        
        ga4Log('Testing URL:', url);
        const data = await fetchGA4DataForPage(url);
        console.table(data);
        return data;
    }

    // ===========================================
    // EXPORT TO GLOBAL SCOPE
    // ===========================================

    window.GA4Integration = {
        // Main functions
        init: initGA4Integration,
        isConnected: () => ga4Connected,
        getPropertyId: () => ga4PropertyId,
        fetchData: fetchGA4DataForPage,
        disconnect: disconnectGA4,
        
        // Utility functions
        formatNumber: formatNumber,
        formatDuration: formatDuration,
        urlToPath: urlToGA4Path,
        
        // Debug functions
        debug: {
            getStatus: () => ({
                connected: ga4Connected,
                propertyId: ga4PropertyId,
                hasToken: !!ga4AccessToken,
                cacheSize: ga4DataCache.size,
                cachedPaths: Array.from(ga4DataCache.keys())
            }),
            
            testUrl: testUrlData,
            clearCache: () => {
                ga4DataCache.clear();
                ga4Log('Cache cleared');
            },
            showCache: () => {
                console.log('GA4 Cache contents:');
                ga4DataCache.forEach((data, path) => {
                    console.log(`${path}:`, data);
                });
            },
            checkAccess: checkGA4Access,
            testSpecificProperty: testSpecificProperty,
            quickConnect: (propertyId) => {
                console.log('🚀 Quick connect to property:', propertyId);
                return testSpecificProperty(propertyId);
            }
        }
    };

    // Console welcome message
    setTimeout(() => {
        if (typeof console !== 'undefined' && console.log) {
            console.log(`
📊 GA4 Integration Module Ready!

Quick start commands:
• GA4Integration.debug.checkAccess()           - Check your GA4 access
• GA4Integration.debug.testSpecificProperty("123456789") - Test a property ID
• GA4Integration.debug.getStatus()             - Check connection status

After connecting:
• GA4Integration.debug.testUrl('/your-page')   - Test URL data fetching
• GA4Integration.debug.showCache()             - View cached data

Status: ${ga4Connected ? '✅ Connected to property ' + ga4PropertyId : '⏳ Ready to connect'}
            `);
        }
    }, 500);

})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.GA4Integration.init();
    });
} else {
    window.GA4Integration.init();
}


// REPLACE the period comparison functions at the bottom of your standalone-ga4-integration.js
// with these FIXED versions that use the public API instead of private variables:

// Period comparison functions for GA4 trends
window.GA4Integration.fetchDataForPeriod = async function(pageUrl, startDate, endDate) {
    // Use public API methods instead of private variables
    if (!window.GA4Integration.isConnected()) {
        console.log('[GA4] Not connected, cannot fetch period data');
        return null;
    }
    
    const propertyId = window.GA4Integration.getPropertyId();
    if (!propertyId) {
        console.log('[GA4] No property ID available');
        return null;
    }
    
    const pagePath = window.GA4Integration.urlToPath(pageUrl);
    console.log('[GA4] Fetching data for period:', {
        pagePath: pagePath,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    });
    
    try {
        const requestBody = {
            dateRanges: [{
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            }],
            dimensions: [{ name: 'pagePath' }],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'newUsers' },
                { name: 'averageSessionDuration' },
                { name: 'bounceRate' },
                { name: 'engagementRate' },
                { name: 'activeUsers' }
            ],
            dimensionFilter: {
                filter: {
                    fieldName: 'pagePath',
                    stringFilter: { matchType: 'EXACT', value: pagePath }
                }
            },
            limit: 1
        };
        
        const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        let ga4Data = {
            pagePath: pagePath,
            pageViews: 0,
            sessions: 0,
            users: 0,
            newUsers: 0,
            avgSessionDuration: 0,
            bounceRate: 0,
            engagementRate: 0,
            activeUsers: 0,
            noDataFound: true,
            fetchedAt: Date.now(),
            period: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            }
        };
        
        if (data.rows && data.rows.length > 0) {
            const row = data.rows[0];
            const metrics = row.metricValues;
            
            ga4Data = {
                pagePath: pagePath,
                pageViews: parseInt(metrics[0]?.value || 0),
                sessions: parseInt(metrics[1]?.value || 0),
                users: parseInt(metrics[2]?.value || 0),
                newUsers: parseInt(metrics[3]?.value || 0),
                avgSessionDuration: parseFloat(metrics[4]?.value || 0),
                bounceRate: parseFloat(metrics[5]?.value || 0),
                engagementRate: parseFloat(metrics[6]?.value || 0),
                activeUsers: parseInt(metrics[7]?.value || 0),
                noDataFound: false,
                fetchedAt: Date.now(),
                period: {
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0]
                }
            };
            
            console.log('[GA4] Period data found for:', pagePath, ga4Data);
        } else {
            console.log('[GA4] No period data found for:', pagePath);
        }
        
        return ga4Data;
        
    } catch (error) {
        console.error('[GA4] Error fetching period data:', error);
        
        const errorData = {
            pagePath: pagePath,
            error: error.message,
            noDataFound: true,
            fetchedAt: Date.now(),
            period: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            }
        };
        
        return errorData;
    }
};

// Helper function to get previous period data (30-60 days ago)
window.GA4Integration.fetchPreviousPeriodData = async function(pageUrl) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(today.getTime() - (60 * 24 * 60 * 60 * 1000));
    
    return await window.GA4Integration.fetchDataForPeriod(pageUrl, sixtyDaysAgo, thirtyDaysAgo);
};

// Enhanced function to get current vs previous comparison
window.GA4Integration.fetchTrendComparison = async function(pageUrl) {
    console.log('[GA4] Fetching trend comparison for:', pageUrl);
    
    try {
        // Fetch both periods in parallel
        const [currentData, previousData] = await Promise.all([
            window.GA4Integration.fetchData(pageUrl), // Current period (last 30 days)
            window.GA4Integration.fetchPreviousPeriodData(pageUrl) // Previous period (30-60 days ago)
        ]);

        if (!currentData || currentData.noDataFound) {
            return { 
                current: currentData, 
                previous: null, 
                trends: null 
            };
        }

        // Calculate trends if we have previous data
        let trends = null;
        if (previousData && !previousData.noDataFound) {
            trends = calculateGA4Trends(currentData, previousData);
        }

        return {
            current: currentData,
            previous: previousData,
            trends: trends
        };

    } catch (error) {
        console.log('[GA4] Error fetching trend comparison:', error);
        return { 
            current: null, 
            previous: null, 
            trends: null, 
            error: error.message 
        };
    }
};

// Helper function to calculate trends (add this too if it doesn't exist)
function calculateGA4Trends(currentData, previousData) {
    const trends = {};

    // Calculate percentage changes for key metrics
    const metrics = ['pageViews', 'sessions', 'users', 'newUsers', 'avgSessionDuration', 'bounceRate', 'engagementRate', 'activeUsers'];
    
    metrics.forEach(metric => {
        if (previousData[metric] !== undefined && previousData[metric] > 0) {
            const currentValue = currentData[metric] || 0;
            const previousValue = previousData[metric];
            
            trends[metric] = {
                current: currentValue,
                previous: previousValue,
                percentChange: ((currentValue - previousValue) / previousValue) * 100,
                direction: currentValue >= previousValue ? 'up' : 'down',
                absoluteChange: currentValue - previousValue
            };
            
            // Special handling for bounce rate (lower is better)
            if (metric === 'bounceRate') {
                trends[metric].direction = currentValue <= previousValue ? 'up' : 'down'; // Inverted for bounce rate
            }
        }
    });

    return trends;
}




// Add these to standalone-ga4-integration.js
// Add these to the END of standalone-ga4-integration.js

window.GA4Integration.fetchTrafficSources = async function(pageUrl) {
    if (!window.GA4Integration.isConnected()) return null;
    
    const propertyId = window.GA4Integration.getPropertyId();
    const pagePath = window.GA4Integration.urlToPath(pageUrl);
    
    try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dateRanges: [{
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                }],
                dimensions: [
                    { name: 'pagePath' },
                    { name: 'sessionDefaultChannelGrouping' }
                ],
                metrics: [{ name: 'sessions' }],
                dimensionFilter: {
                    filter: {
                        fieldName: 'pagePath',
                        stringFilter: {
                            matchType: 'EXACT',
                            value: pagePath
                        }
                    }
                },
                limit: 10
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const sources = {};
        let totalSessions = 0;
        
        if (data.rows) {
            data.rows.forEach(row => {
                const source = row.dimensionValues[1].value;
                const sessions = parseInt(row.metricValues[0].value);
                sources[source] = (sources[source] || 0) + sessions;
                totalSessions += sessions;
            });
        }
        
        return {
            sources: Object.entries(sources).map(([source, sessions]) => ({
                source, sessions,
                percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0
            })).sort((a, b) => b.percentage - a.percentage),
            totalSessions
        };
        
    } catch (error) {
        console.error('[GA4] Error fetching traffic sources:', error);
        return null;
    }
};

window.GA4Integration.fetchDeviceData = async function(pageUrl) {
    if (!window.GA4Integration.isConnected()) return null;
    
    const propertyId = window.GA4Integration.getPropertyId();
    const pagePath = window.GA4Integration.urlToPath(pageUrl);
    
    try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dateRanges: [{
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                }],
                dimensions: [
                    { name: 'pagePath' },
                    { name: 'deviceCategory' }
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'bounceRate' },
                    { name: 'averageSessionDuration' }
                ],
                dimensionFilter: {
                    filter: {
                        fieldName: 'pagePath',
                        stringFilter: {
                            matchType: 'EXACT',
                            value: pagePath
                        }
                    }
                },
                limit: 10
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const devices = {};
        
        if (data.rows) {
            data.rows.forEach(row => {
                const device = row.dimensionValues[1].value;
                devices[device] = {
                    sessions: parseInt(row.metricValues[0].value),
                    bounceRate: parseFloat(row.metricValues[1].value),
                    avgDuration: parseFloat(row.metricValues[2].value)
                };
            });
        }
        
        return devices;
        
    } catch (error) {
        console.error('[GA4] Error fetching device data:', error);
        return null;
    }
};

console.log('✅ Enhanced GA4 functions added!');

console.log('✅ GA4 Period Comparison Functions Fixed!');
