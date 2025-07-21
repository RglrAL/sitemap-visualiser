// standalone-ga4-integration.js - Basic GA4 Connection (Separate from GSC)

(function() {
    // GA4 Configuration
    const GA4_CONFIG = {
        CLIENT_ID: '550630256834-9quh64fnqhfse6s488c8gutstuqcch04.apps.googleusercontent.com', // Same as your GSC
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

    // Initialize GA4 integration
    function initGA4Integration() {
        ga4Log('Initializing standalone GA4 integration...');
        addGA4Button();
        addGA4Styles();
        initializeGA4Auth();
    }

    // Initialize Google Identity Services for GA4
    function initializeGA4Auth() {
        ga4Log('Setting up GA4 authentication...');
        
        // Wait for Google Identity Services to load
        const checkGIS = () => {
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                createGA4TokenClient();
            } else {
                setTimeout(checkGIS, 100);
            }
        };
        checkGIS();
    }

    // Create GA4 token client
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

    // Handle GA4 authentication response
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
        
        // Set token in gapi client if available
        if (typeof gapi !== 'undefined' && gapi.client) {
            gapi.client.setToken({ access_token: ga4AccessToken });
        }
        
        // Start GA4 setup process
        setupGA4Connection();
    }

    // Setup GA4 connection and property selection
    // QUICK FIX: Add this to your standalone-ga4-integration.js
// Replace your existing setupGA4Connection function with this:

async function setupGA4Connection() {
    try {
        // Skip the auto-fetch and go straight to manual entry for now
        hideGA4LoadingMessage();
        
        const manualPropertyId = await showManualPropertyIdDialog();
        
        if (manualPropertyId) {
            showGA4LoadingMessage('Testing property connection...');
            
            // Test the manually entered property ID
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

// Add this new function for manual property ID entry
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
        
        content.innerHTML = `
            <h3 style="margin-bottom: 20px; color: #ff6b35;">Enter Your GA4 Property ID</h3>
            
            <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #17a2b8;">
                <strong>ℹ️ Manual Setup Required</strong><br>
                We'll connect directly using your GA4 Property ID. This is actually more reliable than auto-detection!
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                    GA4 Property ID:
                </label>
                <input type="text" id="propertyIdInput" placeholder="e.g., 123456789" 
                       style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;"/>
                <div style="margin-top: 8px; font-size: 0.9rem; color: #666;">
                    This is usually a 9-10 digit number
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <strong>📍 How to find your Property ID:</strong>
                <ol style="margin: 8px 0 0 20px; color: #666; font-size: 0.9rem; line-height: 1.4;">
                    <li>Go to <a href="https://analytics.google.com" target="_blank" style="color: #ff6b35;">analytics.google.com</a></li>
                    <li>Click the gear icon ⚙️ (Admin) in the bottom left</li>
                    <li>In the "Property" column, click "Property Settings"</li>
                    <li>Copy the Property ID from the top of the page</li>
                </ol>
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
        
        const input = content.querySelector('#propertyIdInput');
        const cancelBtn = content.querySelector('#cancelBtn');
        const connectBtn = content.querySelector('#connectBtn');
        
        // Focus the input
        setTimeout(() => input.focus(), 100);
        
        // Handle enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                connectBtn.click();
            }
        });
        
        cancelBtn.onclick = () => {
            modal.remove();
            resolve(null);
        };
        
        connectBtn.onclick = () => {
            const propertyId = input.value.trim();
            if (!propertyId) {
                alert('Please enter a Property ID');
                input.focus();
                return;
            }
            
            // Basic validation
            if (!/^\d{8,12}$/.test(propertyId)) {
                alert('Property ID should be 8-12 digits (numbers only)');
                input.focus();
                input.select();
                return;
            }
            
            modal.remove();
            resolve(propertyId);
        };
        
        modal.onclick = () => {
            modal.remove();
            resolve(null);
        };
        
        content.onclick = e => e.stopPropagation();
    });
}

// Add this function to test a property ID
// Enhanced GA4 debugging and error handling
// Replace your testGA4Property function with this improved version:

async function testGA4Property(propertyId) {
    try {
        ga4Log('Testing GA4 property ID:', propertyId);
        
        // Use a simple query to test access
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
        ga4Log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const data = await response.json();
            ga4Log('✅ Property ID test successful, data:', data);
            return true;
        } else {
            const errorText = await response.text();
            ga4Log('❌ Property ID test failed:', response.status, errorText);
            
            // Parse error details
            let errorDetails = '';
            try {
                const errorJson = JSON.parse(errorText);
                errorDetails = errorJson.error?.message || errorText;
            } catch (e) {
                errorDetails = errorText;
            }
            
            // Show specific error message
            showDetailedErrorMessage(response.status, errorDetails, propertyId);
            return false;
        }
        
    } catch (error) {
        ga4Log('❌ Property ID test error:', error);
        alert('Network error testing property: ' + error.message);
        return false;
    }
}

// Add detailed error messaging
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
    
    // Create detailed error modal
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
        // Restart the connection process
        setTimeout(() => toggleGA4Connection(), 100);
    };
    
    modal.onclick = () => modal.remove();
    content.onclick = e => e.stopPropagation();
}

// Add a function to check what GA4 properties the user can access
window.GA4Integration.debug.checkAccess = async function() {
    if (!ga4AccessToken) {
        console.error('Not authenticated. Connect to GA4 first.');
        return;
    }
    
    console.log('🔍 Checking GA4 access...');
    console.log('Access token (first 20 chars):', ga4AccessToken.substring(0, 20) + '...');
    
    // Try to access the Analytics Admin API to list properties
    try {
        const response = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
            headers: {
                'Authorization': `Bearer ${ga4AccessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Admin API response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Admin API works! Available accounts:', data);
            
            if (data.accountSummaries) {
                console.log('📊 Your GA4 properties:');
                data.accountSummaries.forEach(account => {
                    if (account.propertySummaries) {
                        account.propertySummaries.forEach(property => {
                            if (property.propertyType === 'PROPERTY_TYPE_GA4') {
                                const propId = property.property.replace('properties/', '');
                                console.log(`   • ${property.displayName} (ID: ${propId})`);
                            }
                        });
                    }
                });
            }
        } else {
            const errorText = await response.text();
            console.log('❌ Admin API failed:', response.status, errorText);
            console.log('💡 This is why we use manual property ID entry');
        }
    } catch (error) {
        console.log('❌ Admin API error:', error);
    }
    
    // Test Analytics Data API with a known invalid property
    console.log('\n🧪 Testing Analytics Data API access...');
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
        
        console.log('Analytics Data API response status:', testResponse.status);
        
        if (testResponse.status === 404) {
            console.log('✅ Analytics Data API works (404 expected for invalid property)');
        } else if (testResponse.status === 403) {
            console.log('❓ Analytics Data API returns 403 - might be permissions issue');
        } else {
            console.log('ℹ️ Unexpected response:', testResponse.status);
        }
    } catch (error) {
        console.log('❌ Analytics Data API error:', error);
    }
    
    console.log('\n💡 If you know your property ID, try: GA4Integration.debug.testSpecificProperty("YOUR_ID")');
};

// Add function to test a specific property with detailed logging
window.GA4Integration.debug.testSpecificProperty = async function(propertyId) {
    if (!ga4AccessToken) {
        console.error('Not authenticated. Connect to GA4 first.');
        return;
    }
    
    console.log(`🧪 Testing specific property: ${propertyId}`);
    
    const result = await testGA4Property(propertyId);
    
    if (result) {
        console.log('✅ Property test successful! You can use this property.');
        // Optionally auto-connect
        ga4PropertyId = propertyId;
        ga4Connected = true;
        updateGA4ConnectionStatus(true);
        console.log('🔗 Auto-connected to this property');
    } else {
        console.log('❌ Property test failed. Check the error details above.');
    }
    
    return result;
};

    // Fetch GA4 properties using Admin API
    async function fetchGA4Properties() {
        try {
            const response = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${ga4AccessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const properties = [];
            
            if (data.accountSummaries) {
                data.accountSummaries.forEach(account => {
                    if (account.propertySummaries) {
                        account.propertySummaries.forEach(property => {
                            if (property.propertyType === 'PROPERTY_TYPE_GA4') {
                                properties.push({
                                    propertyId: property.property.replace('properties/', ''),
                                    displayName: property.displayName,
                                    accountName: account.displayName
                                });
                            }
                        });
                    }
                });
            }
            
            ga4Log(`Found ${properties.length} GA4 properties`);
            return properties;
            
        } catch (error) {
            ga4Log('Failed to fetch GA4 properties:', error);
            throw error;
        }
    }

    // ===========================================
    // BASIC GA4 DATA FETCHING
    // ===========================================

    // Convert URL to GA4 page path
    function urlToGA4Path(url) {
        if (!url) return '/';
        
        try {
            // If it's a full URL, extract the path
            if (url.startsWith('http')) {
                const urlObj = new URL(url);
                return urlObj.pathname + urlObj.search + urlObj.hash;
            }
            
            // If it's already a path, return as-is
            if (url.startsWith('/')) {
                return url;
            }
            
            // Otherwise, add leading slash
            return '/' + url;
            
        } catch (e) {
            // Fallback
            return url.startsWith('/') ? url : '/' + url;
        }
    }

    // Fetch basic GA4 data for a page
    async function fetchGA4DataForPage(pageUrl) {
        if (!ga4Connected || !ga4PropertyId || !ga4AccessToken) {
            ga4Log('GA4 not connected, cannot fetch data');
            return null;
        }
        
        const pagePath = urlToGA4Path(pageUrl);
        ga4Log('Fetching GA4 data for path:', pagePath);
        
        // Check cache first
        if (ga4DataCache.has(pagePath)) {
            ga4Log('Returning cached GA4 data for:', pagePath);
            return ga4DataCache.get(pagePath);
        }
        
        try {
            // Calculate date range (last 30 days)
            const today = new Date();
            const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
            
            const requestBody = {
                dateRanges: [{
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                }],
                dimensions: [
                    { name: 'pagePath' }
                ],
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
            };
            
            const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ga4AccessToken}`,
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
                noDataFound: true,
                fetchedAt: Date.now()
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
                    noDataFound: false,
                    fetchedAt: Date.now()
                };
                
                ga4Log('GA4 data found for:', pagePath, ga4Data);
            } else {
                ga4Log('No GA4 data found for:', pagePath);
            }
            
            // Cache the result
            ga4DataCache.set(pagePath, ga4Data);
            return ga4Data;
            
        } catch (error) {
            ga4Log('Error fetching GA4 data:', error);
            
            // Cache the error to avoid repeated failed requests
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

    // Add GA4 button to navigation
    function addGA4Button() {
        const checkAndAdd = () => {
            // Look for navigation area
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
            
            ga4Button.innerHTML = `
                <svg id="ga4Icon" width="18" height="18" viewBox="0 0 24 24" style="flex-shrink: 0;">
                    <path fill="#ff6b35" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span id="ga4Text">Connect GA4</span>
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
            
            // Insert next to GSC button if it exists, otherwise at the end
            const gscButton = document.getElementById('gscConnectBtn');
            if (gscButton) {
                navBar.insertBefore(ga4Button, gscButton.nextSibling);
            } else {
                navBar.appendChild(ga4Button);
            }
            
            ga4Log('GA4 button added to navigation');
        };
        
        checkAndAdd();
    }

    // Toggle GA4 connection
    function toggleGA4Connection() {
        ga4Log('Toggle GA4 connection called. Current state:', ga4Connected);
        
        if (ga4Connected) {
            // Disconnect
            if (ga4AccessToken) {
                google.accounts.oauth2.revoke(ga4AccessToken, () => {
                    ga4Log('GA4 access token revoked');
                });
            }
            disconnectGA4();
        } else {
            // Connect
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

    // Disconnect GA4
    function disconnectGA4() {
        ga4Connected = false;
        ga4PropertyId = null;
        ga4AccessToken = null;
        ga4DataCache.clear();
        updateGA4ConnectionStatus(false);
        ga4Log('GA4 disconnected');
    }

    // Update GA4 connection status
    function updateGA4ConnectionStatus(connected) {
        ga4Connected = connected;
        const ga4Btn = document.getElementById('ga4ConnectBtn');
        const ga4Text = document.getElementById('ga4Text');
        
        if (ga4Btn && ga4Text) {
            if (connected) {
                ga4Btn.classList.add('connected');
                ga4Btn.style.background = 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%) !important';
                ga4Btn.style.color = 'white !important';
                ga4Btn.style.borderColor = '#ff6b35 !important';
                ga4Text.textContent = 'GA4 Connected';
                
            } else {
                ga4Btn.classList.remove('connected');
                ga4Btn.style.background = '#ffffff !important';
                ga4Btn.style.color = '#3c4043 !important';
                ga4Btn.style.borderColor = '#dadce0 !important';
                ga4Text.textContent = 'Connect GA4';
            }
        }
        
        ga4Log('GA4 connection status updated:', connected);
    }

    // Loading state functions
    function showGA4LoadingState() {
        const ga4Text = document.getElementById('ga4Text');
        if (ga4Text) {
            ga4Text.innerHTML = 'Connecting<span class="ga4-loading-dots"><span></span><span></span><span></span></span>';
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
                <span style="font-size: 20px;">📊</span>
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

    // Property selector
    async function showGA4PropertySelector(properties) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            `;
            
            content.innerHTML = `
                <h3 style="margin-bottom: 20px; color: #ff6b35;">Select GA4 Property</h3>
                <div style="color: #666; margin-bottom: 20px;">
                    Choose which GA4 property you want to connect:
                </div>
            `;
            
            properties.forEach(property => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    display: block;
                    width: 100%;
                    padding: 15px;
                    margin-bottom: 10px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    background: white;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                `;
                btn.innerHTML = `
                    <div style="font-weight: bold; color: #ff6b35;">${property.displayName}</div>
                    <div style="font-size: 0.9rem; color: #666; margin-top: 4px;">
                        Account: ${property.accountName}
                    </div>
                    <div style="font-size: 0.8rem; color: #999; margin-top: 2px;">
                        Property ID: ${property.propertyId}
                    </div>
                `;
                btn.onmouseover = () => btn.style.background = '#fff8f5';
                btn.onmouseout = () => btn.style.background = 'white';
                btn.onclick = () => {
                    modal.remove();
                    resolve(property);
                };
                content.appendChild(btn);
            });
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = `
                padding: 10px 20px;
                background: #666;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 15px;
            `;
            cancelBtn.onclick = () => {
                modal.remove();
                resolve(null);
            };
            content.appendChild(cancelBtn);
            
            modal.appendChild(content);
            modal.onclick = () => {
                modal.remove();
                resolve(null);
            };
            content.onclick = e => e.stopPropagation();
            
            document.body.appendChild(modal);
        });
    }

    // Add GA4 styles
    function addGA4Styles() {
        if (document.getElementById('ga4-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'ga4-styles';
        style.textContent = `
            .nav-ga4-btn:hover {
                background: #f8f9fa !important;
                border-color: #ff6b35 !important;
                box-shadow: 0 2px 8px rgba(255, 107, 53, 0.15) !important;
                transform: translateY(-1px);
            }
            
            .nav-ga4-btn.connected {
                animation: ga4-connected-glow 3s ease-in-out infinite;
            }
            
            @keyframes ga4-connected-glow {
                0%, 100% { 
                    box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3), 0 0 0 0 rgba(255, 107, 53, 0.4);
                }
                50% { 
                    box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3), 0 0 0 4px rgba(255, 107, 53, 0.1);
                }
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
    // DEBUGGING AND TESTING
    // ===========================================

    // Format numbers for display
    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    }

    // Format duration (seconds to readable format)
    function formatDuration(seconds) {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    }

    // ===========================================
    // EXPORT TO GLOBAL SCOPE
    // ===========================================

    // FIX for the debug error
// Add this at the end of your standalone-ga4-integration.js file
// (Replace the existing window.GA4Integration section)

// ===========================================
// EXPORT TO GLOBAL SCOPE (FIXED VERSION)
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
    
    // Debug functions - properly initialized
    debug: {
        getStatus: () => ({
            connected: ga4Connected,
            propertyId: ga4PropertyId,
            hasToken: !!ga4AccessToken,
            cacheSize: ga4DataCache.size,
            cachedPaths: Array.from(ga4DataCache.keys())
        }),
        
        testUrl: async (url) => {
            if (!ga4Connected) {
                console.error('GA4 not connected');
                return null;
            }
            
            ga4Log('Testing URL:', url);
            const data = await fetchGA4DataForPage(url);
            console.table(data);
            return data;
        },
        
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
        
        // Enhanced debugging functions
        checkAccess: async () => {
            if (!ga4AccessToken) {
                console.error('❌ Not authenticated. Click "Connect GA4" button first.');
                return;
            }
            
            console.log('🔍 Checking GA4 access...');
            console.log('✅ Access token exists (first 20 chars):', ga4AccessToken.substring(0, 20) + '...');
            
            // Try to access the Analytics Admin API to list properties
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
            
            // Test Analytics Data API
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
        },
        
        testSpecificProperty: async (propertyId) => {
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
                    
                    // Auto-connect if test passes
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
        },
        
        // Quick connection shortcut
        quickConnect: (propertyId) => {
            console.log('🚀 Quick connect to property:', propertyId);
            return window.GA4Integration.debug.testSpecificProperty(propertyId);
        }
    }
};

// Console welcome message (updated)
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
