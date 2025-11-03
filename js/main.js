// Main JavaScript for index page
// Initialize global API_BASE_URL if not already set
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'http://localhost:3000/api';
}

// Function to update page based on auth status
async function updatePageForAuth() {
    console.log('updatePageForAuth called');
    
    // Check if checkAuth exists
    if (typeof checkAuth !== 'function') {
        console.error('checkAuth function not found!');
        setTimeout(updatePageForAuth, 100);
        return;
    }
    
    const { token, user } = checkAuth();
    const allPassesSection = document.getElementById('allPassesSection');
    
    console.log('Auth status:', { token: !!token, user: !!user, sectionFound: !!allPassesSection });
    
    if (token && user && allPassesSection) {
        // User is logged in - show all passes section
        console.log('Showing all passes section for logged-in user');
        // Force display using both style property and removing important via CSS
        allPassesSection.setAttribute('style', 'display: block !important; background: var(--white);');
        allPassesSection.style.display = 'block';
        allPassesSection.style.visibility = 'visible';
        
        try {
            await loadAllPasses();
            setupFilters();
            setupCategoryTabs();
            // Load active bookings and update buttons
            await loadHomePageActiveBookings();
        } catch (error) {
            console.error('Error loading all passes:', error);
        }
    } else if (allPassesSection) {
        // User is not logged in - hide all passes section
        console.log('Hiding all passes section - user not logged in');
        allPassesSection.setAttribute('style', 'display: none !important; background: var(--white);');
        allPassesSection.style.display = 'none';
        allPassesSection.style.visibility = 'hidden';
        homePageActiveBookings = [];
    } else {
        console.warn('allPassesSection element not found in DOM');
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded - Initializing page');
    
    // Load featured passes (6 passes) for home page - always visible
    await loadFeaturedPasses();
    
    // Wait a bit for auth.js to initialize, then update page based on auth status
    setTimeout(async () => {
        await updatePageForAuth();
    }, 100);
    
    // Also check immediately (in case auth.js is already loaded)
    await updatePageForAuth();
    
    // Monitor for auth changes (e.g., after login)
    window.addEventListener('storage', (e) => {
        if (e.key === 'token' || e.key === 'user') {
            console.log('Storage event detected - auth changed');
            setTimeout(updatePageForAuth, 50);
        }
    });
    
    // Also expose a function to manually trigger update (useful when navigating from login)
    window.updatePassesSection = updatePageForAuth;
    
    // Update when page becomes visible (user switches tabs back or navigates to page)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('Page became visible - checking auth status');
            updatePageForAuth();
        }
    });
    
    // Handle clicks on Home link to refresh section
    const homeLinks = document.querySelectorAll('a[href="index.html"], a[href="#"]');
    homeLinks.forEach(link => {
        if (link.textContent.trim().toLowerCase().includes('home') || link.getAttribute('href') === 'index.html') {
            link.addEventListener('click', (e) => {
                // Small delay to ensure navigation completes
                setTimeout(() => {
                    updatePageForAuth();
                }, 100);
            });
        }
    });
    
    // Mobile menu toggle
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
    
    // Check auth status periodically (fallback) - only if section should be visible but isn't
    setInterval(() => {
        if (typeof checkAuth === 'function') {
            const { token, user } = checkAuth();
            const allPassesSection = document.getElementById('allPassesSection');
            if (token && user && allPassesSection && allPassesSection.style.display === 'none') {
                console.log('Periodic check - showing all passes section');
                updatePageForAuth();
            }
        }
    }, 2000);
});

// Load featured passes (limited to 6) for home page
async function loadFeaturedPasses() {
    try {
        const response = await fetch(`${window.API_BASE_URL}/passes`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const passes = await response.json();
        
        if (!Array.isArray(passes)) {
            console.error('Invalid response format:', passes);
            displayFeaturedSamplePasses();
            return;
        }
        
        if (passes.length === 0) {
            console.log('No passes found in database');
            displayFeaturedSamplePasses();
            return;
        }
        
        // Select 6 featured passes - prioritize monthly passes and good deals
        const featuredPasses = selectFeaturedPasses(passes, 6);
        console.log('Loaded featured passes:', featuredPasses.length);
        displayPasses(featuredPasses, 'passesGrid');
    } catch (error) {
        console.error('Error loading featured passes:', error);
        showToast('Error loading passes. Showing sample data.', 'warning');
        // Fallback: display sample passes if API fails
        displayFeaturedSamplePasses();
    }
}

// Load all passes for logged-in users
async function loadAllPasses() {
    try {
        const response = await fetch(`${window.API_BASE_URL}/passes`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const passes = await response.json();
        
        if (!Array.isArray(passes)) {
            console.error('Invalid response format:', passes);
            return;
        }
        
        console.log('Loaded all passes:', passes.length);
        displayPasses(passes, 'allPassesGrid');
    } catch (error) {
        console.error('Error loading all passes:', error);
    }
}

// Select featured passes (prioritize monthly, student, corporate passes)
function selectFeaturedPasses(passes, count) {
    // Sort by priority: monthly > student > corporate > weekly > daily
    const priority = { monthly: 5, student: 4, corporate: 3, weekly: 2, daily: 1 };
    
    const sorted = [...passes].sort((a, b) => {
        const priorityA = priority[a.type] || 0;
        const priorityB = priority[b.type] || 0;
        if (priorityB !== priorityA) {
            return priorityB - priorityA;
        }
        // If same priority, prefer lower price (better deals)
        return a.price - b.price;
    });
    
    // Ensure we have unique providers in the featured selection
    const selected = [];
    const providers = new Set();
    
    for (const pass of sorted) {
        if (selected.length >= count) break;
        if (!providers.has(pass.provider)) {
            selected.push(pass);
            providers.add(pass.provider);
        }
    }
    
    // Fill remaining slots if needed
    if (selected.length < count) {
        for (const pass of sorted) {
            if (selected.length >= count) break;
            if (!selected.includes(pass)) {
                selected.push(pass);
            }
        }
    }
    
    return selected.slice(0, count);
}

// Display passes in grid
function displayPasses(passes, containerId = 'passesGrid') {
    const grid = document.getElementById(containerId);
    if (!grid) {
        console.error('Passes grid container not found:', containerId);
        return;
    }
    
    if (!Array.isArray(passes)) {
        console.error('Passes is not an array:', passes);
        grid.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">Error loading passes</p>';
        return;
    }
    
    grid.innerHTML = '';
    
    if (passes.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">No passes available</p>';
        return;
    }
    
    passes.forEach(pass => {
        if (pass && pass.id) {
            const card = createPassCard(pass);
            grid.appendChild(card);
        } else {
            console.warn('Invalid pass data:', pass);
        }
    });
    
    // Update buttons after displaying passes (if logged in)
    setTimeout(() => {
        if (typeof updateHomePagePassButtons === 'function') {
            updateHomePagePassButtons();
        }
    }, 100);
}

// Create pass card element
function createPassCard(pass) {
    const card = document.createElement('div');
    card.className = 'pass-card';
    
    // Safe data extraction with defaults
    const provider = pass.provider || 'Unknown';
    const category = pass.category || 'general';
    const type = pass.type || 'standard';
    const price = pass.price || 0;
    const validityDays = pass.validity_days || 1;
    const coverage = pass.coverage || 'All routes';
    const passId = pass.id;
    
    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    // Generate logo URL - handle data URIs, http/https URLs, or generate SVG data URI
    let logoUrl = pass.logo_url || '';
    
    // Function to generate SVG data URI
    const generateLogoSVG = (letter, color = '#26a69a') => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="${color}"/><text x="40" y="50" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${letter}</text></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    };
    
    if (!logoUrl) {
        // Generate SVG data URI placeholder with first letter of provider
        const firstLetter = provider.charAt(0).toUpperCase();
        logoUrl = generateLogoSVG(firstLetter);
    } else if (logoUrl.startsWith('data:')) {
        // Already a data URI, use as is
        logoUrl = logoUrl;
    } else if (logoUrl.includes('via.placeholder.com') || logoUrl.includes('placeholder')) {
        // Old placeholder URLs - replace with SVG data URI
        const firstLetter = provider.charAt(0).toUpperCase();
        logoUrl = generateLogoSVG(firstLetter);
    } else if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
        // If logo_url exists but missing protocol, add https://
        logoUrl = 'https://' + logoUrl;
    }
    
    // Fallback logo as SVG data URI (always works, no network needed)
    const fallbackLogo = generateLogoSVG(provider.charAt(0).toUpperCase());
    
    card.innerHTML = `
        <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(provider)}" class="pass-logo" onerror="this.onerror=null; this.src='${escapeHtml(fallbackLogo)}';">
        <div class="pass-header">
            <div class="pass-provider">${escapeHtml(provider)}</div>
            <span class="pass-badge">${category.toUpperCase()}</span>
        </div>
        <div class="pass-type">${type.charAt(0).toUpperCase() + type.slice(1)} Pass</div>
        <div class="pass-details">
            <div class="pass-detail-item">
                <i class="fas fa-calendar-check"></i>
                <span>Valid for ${validityDays} ${validityDays === 1 ? 'day' : 'days'}</span>
            </div>
            <div class="pass-detail-item">
                <i class="fas fa-route"></i>
                <span>${escapeHtml(coverage)}</span>
            </div>
        </div>
        <div class="pass-price">₹${price.toFixed(2)}</div>
        <div class="pass-actions">
            <button class="btn btn-primary" onclick="purchasePass(${passId})">
                <i class="fas fa-shopping-cart"></i> Purchase
            </button>
            <button class="btn btn-secondary" onclick="viewPassDetails(${passId})">
                <i class="fas fa-info-circle"></i> Details
            </button>
        </div>
    `;
    
    return card;
}

// Store active bookings for home page duplicate check
let homePageActiveBookings = [];

// Load active bookings for home page
async function loadHomePageActiveBookings() {
    try {
        const { token } = checkAuth();
        if (!token) {
            homePageActiveBookings = [];
            return;
        }
        
        const response = await fetch(`${window.API_BASE_URL}/bookings/active`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const bookings = await response.json();
            homePageActiveBookings = bookings || [];
            console.log('Home page active bookings loaded:', homePageActiveBookings.length);
            // Update pass card buttons
            updateHomePagePassButtons();
        }
    } catch (error) {
        console.error('Error loading active bookings for home page:', error);
    }
}

// Check if pass is already booked (home page)
function isPassAlreadyBookedHome(passId) {
    return homePageActiveBookings.some(booking => booking.pass_id === passId);
}

// Update pass card buttons on home page
function updateHomePagePassButtons() {
    // Update featured passes
    const featuredCards = document.querySelectorAll('#passesGrid .pass-card');
    featuredCards.forEach(card => {
        const purchaseBtn = card.querySelector('.btn-primary');
        if (purchaseBtn) {
            const onclickAttr = purchaseBtn.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/purchasePass\((\d+)\)/);
                if (match) {
                    const passId = parseInt(match[1]);
                    if (isPassAlreadyBookedHome(passId)) {
                        purchaseBtn.disabled = true;
                        purchaseBtn.innerHTML = '<i class="fas fa-check-circle"></i> Already Booked';
                        purchaseBtn.classList.add('already-booked');
                        purchaseBtn.classList.remove('btn-primary');
                        purchaseBtn.classList.add('btn-disabled');
                    }
                }
            }
        }
    });
    
    // Update all passes section
    const allPassCards = document.querySelectorAll('#allPassesGrid .pass-card');
    allPassCards.forEach(card => {
        const purchaseBtn = card.querySelector('.btn-primary');
        if (purchaseBtn) {
            const onclickAttr = purchaseBtn.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/purchasePass\((\d+)\)/);
                if (match) {
                    const passId = parseInt(match[1]);
                    if (isPassAlreadyBookedHome(passId)) {
                        purchaseBtn.disabled = true;
                        purchaseBtn.innerHTML = '<i class="fas fa-check-circle"></i> Already Booked';
                        purchaseBtn.classList.add('already-booked');
                        purchaseBtn.classList.remove('btn-primary');
                        purchaseBtn.classList.add('btn-disabled');
                    }
                }
            }
        }
    });
}

// Purchase pass
async function purchasePass(passId) {
    const { token, user } = checkAuth();
    
    if (!token || !user) {
        showLoginModal();
        return;
    }
    
    if (!passId) {
        showToast('Invalid pass ID', 'error');
        return;
    }
    
    // Check if pass is already booked
    if (isPassAlreadyBookedHome(passId)) {
        showToast('You already have an active pass for this transport. Please wait for it to expire or renew it.', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${window.API_BASE_URL}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ pass_id: passId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Pass purchased successfully!', 'success');
            // Reload active bookings and update buttons
            await loadHomePageActiveBookings();
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            const errorMsg = data.error || 'Purchase failed';
            showToast(errorMsg, 'error');
            
            // Check if error is about duplicate booking
            if (errorMsg.includes('already have an active pass')) {
                // Reload active bookings and update buttons
                await loadHomePageActiveBookings();
            }
        }
    } catch (error) {
        console.error('Purchase error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

// View pass details
async function viewPassDetails(passId) {
    try {
        const response = await fetch(`${window.API_BASE_URL}/passes/${passId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const pass = await response.json();
        
        if (!pass || !pass.id) {
            throw new Error('Invalid pass data');
        }
        
        // Create modal content
        const modal = document.getElementById('passDetailsModal');
        const content = document.getElementById('passDetailsContent');
        
        if (modal && content) {
            const provider = pass.provider || 'Unknown';
            const type = pass.type || 'standard';
            const category = pass.category || 'general';
            const validityDays = pass.validity_days || 1;
            const coverage = pass.coverage || 'All routes';
            const price = pass.price || 0;
            
            content.innerHTML = `
                <h2>${provider} - ${type.charAt(0).toUpperCase() + type.slice(1)} Pass</h2>
                <div class="pass-details" style="margin: 1.5rem 0;">
                    <div class="pass-detail-item">
                        <strong>Category:</strong> ${category.toUpperCase()}
                    </div>
                    <div class="pass-detail-item">
                        <strong>Validity:</strong> ${validityDays} ${validityDays === 1 ? 'day' : 'days'}
                    </div>
                    <div class="pass-detail-item">
                        <strong>Coverage:</strong> ${coverage}
                    </div>
                    <div class="pass-detail-item">
                        <strong>Price:</strong> ₹${price.toFixed(2)}
                    </div>
                </div>
                <button class="btn btn-primary btn-block" onclick="purchasePass(${pass.id}); closePassModal();">
                    Purchase Now
                </button>
            `;
            modal.classList.add('active');
        }
    } catch (error) {
        console.error('Error loading pass details:', error);
        showToast('Error loading pass details', 'error');
    }
}

// Close pass modal
function closePassModal() {
    const modal = document.getElementById('passDetailsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Close login modal
window.addEventListener('click', function(event) {
    const loginModal = document.getElementById('loginModal');
    const passModal = document.getElementById('passDetailsModal');
    
    if (event.target === loginModal) {
        loginModal.classList.remove('active');
    }
    if (event.target === passModal) {
        closePassModal();
    }
});

// Setup filters
function setupFilters() {
    const typeFilter = document.getElementById('passTypeFilter');
    const searchFilter = document.getElementById('searchFilter');
    
    if (typeFilter) {
        typeFilter.addEventListener('change', filterPasses);
    }
    
    if (searchFilter) {
        searchFilter.addEventListener('input', filterPasses);
    }
}

// Filter passes (only for all passes section)
function filterPasses() {
    const typeFilter = document.getElementById('passTypeFilter')?.value || 'all';
    const searchTerm = document.getElementById('searchFilter')?.value.toLowerCase() || '';
    const grid = document.getElementById('allPassesGrid');
    
    if (!grid) return;
    
    const cards = grid.querySelectorAll('.pass-card');
    
    cards.forEach(card => {
        const passType = card.querySelector('.pass-type')?.textContent.toLowerCase() || '';
        const provider = card.querySelector('.pass-provider')?.textContent.toLowerCase() || '';
        
        const matchesType = typeFilter === 'all' || passType.includes(typeFilter);
        const matchesSearch = !searchTerm || provider.includes(searchTerm) || passType.includes(searchTerm);
        
        card.style.display = (matchesType && matchesSearch) ? 'block' : 'none';
    });
}

// Setup category tabs
function setupCategoryTabs() {
    const tabButtons = document.querySelectorAll('.category-tabs .tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const category = btn.dataset.category;
            filterByCategory(category);
        });
    });
}

// Filter by category (only for all passes section)
function filterByCategory(category) {
    const grid = document.getElementById('allPassesGrid');
    
    if (!grid) return;
    
    const cards = grid.querySelectorAll('.pass-card');
    
    cards.forEach(card => {
        if (category === 'all') {
            card.style.display = 'block';
        } else {
            const badge = card.querySelector('.pass-badge')?.textContent.toLowerCase() || '';
            card.style.display = badge.includes(category) ? 'block' : 'none';
        }
    });
}

// Show login modal
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('active');
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => modal.classList.remove('active');
        }
    }
}

// Sample featured passes for fallback (6 passes)
function displayFeaturedSamplePasses() {
    // Generate SVG data URIs for logos (no external network needed)
    const generateLogo = (letter, color) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="${color}"/><text x="40" y="50" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${letter}</text></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    };
    
    const samplePasses = [
        { id: 1, provider: 'RedBus', category: 'bus', type: 'monthly', price: 999, validity_days: 30, coverage: 'All routes', logo_url: generateLogo('R', '#e74c3c') },
        { id: 2, provider: 'State Transport', category: 'bus', type: 'weekly', price: 299, validity_days: 7, coverage: 'State-wide', logo_url: generateLogo('S', '#3498db') },
        { id: 3, provider: 'Indian Railways', category: 'train', type: 'monthly', price: 1499, validity_days: 30, coverage: 'All classes', logo_url: generateLogo('I', '#f39c12') },
        { id: 4, provider: 'Metro', category: 'train', type: 'daily', price: 99, validity_days: 1, coverage: 'Unlimited rides', logo_url: generateLogo('M', '#9b59b6') },
        { id: 5, provider: 'IndiGo', category: 'flight', type: 'student', price: 2499, validity_days: 90, coverage: 'Domestic flights', logo_url: generateLogo('I', '#e74c3c') },
        { id: 6, provider: 'Air India', category: 'flight', type: 'corporate', price: 4999, validity_days: 180, coverage: 'All routes', logo_url: generateLogo('A', '#26a69a') }
    ];
    
    displayPasses(samplePasses, 'passesGrid');
}

