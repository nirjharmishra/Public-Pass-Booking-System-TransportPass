// Dashboard functionality
// Initialize global API_BASE_URL if not already set
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'http://localhost:3000/api';
}
let selectedTopUpAmount = 0;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    const { token, user } = checkAuth();
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }
    
    await loadDashboardData();
    setupDashboardTabs();
    
    // Check URL hash to switch to specific tab (e.g., after redirect)
    const hash = window.location.hash;
    if (hash) {
        const tabName = hash.replace('#', '');
        setTimeout(() => {
            const tabBtn = document.querySelector(`.dashboard-tabs .tab-btn[data-tab="${tabName}"]`);
            if (tabBtn) {
                tabBtn.click();
            }
        }, 200);
    }
    
    // Setup custom amount input
    const customAmountInput = document.getElementById('customAmount');
    if (customAmountInput) {
        customAmountInput.addEventListener('input', () => {
            if (customAmountInput.value) {
                document.querySelectorAll('.topup-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
            }
            updateSelectedAmount();
        });
    }
    
    // Close modals on outside click
    window.onclick = function(event) {
        const walletModal = document.getElementById('walletModal');
        const passModal = document.getElementById('passDetailsModal');
        const bookingModal = document.getElementById('bookingConfirmationModal');
        
        if (event.target === walletModal) {
            closeWalletModal();
        }
        if (event.target === passModal) {
            closePassDetailsModal();
        }
        if (event.target === bookingModal) {
            closeBookingConfirmationModal();
        }
    };
});

// Store active bookings to check for duplicates
let userActiveBookings = [];

// Load dashboard data
async function loadDashboardData() {
    await Promise.all([
        loadWalletBalance(),
        loadAvailablePasses(),
        loadActivePasses(),
        loadExpiredPasses(),
        loadTransactions()
    ]);
    
    // Load active bookings for duplicate check
    await loadActiveBookingsForCheck();
}

// Load wallet balance
async function loadWalletBalance() {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/users/wallet`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const balanceEl = document.getElementById('walletBalance');
            if (balanceEl) {
                balanceEl.textContent = `₹${data.balance || 0}`;
            }
        }
    } catch (error) {
        console.error('Error loading wallet:', error);
    }
}

// Load available passes
async function loadAvailablePasses() {
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
        
        console.log('Loaded available passes:', passes.length);
        // Store all passes for filtering
        allAvailablePasses = passes.map(p => ({...p})); // Create a copy
        // Display all passes initially
        displayAvailablePasses(passes);
        setupAvailablePassFilters();
        // Update buttons after loading (if active bookings already loaded)
        setTimeout(() => updatePassCardButtons(), 100);
    } catch (error) {
        console.error('Error loading available passes:', error);
        const grid = document.getElementById('availablePassesGrid');
        if (grid) {
            grid.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">Error loading passes. Please try again later.</p>';
        }
    }
}

// Store all passes for filtering
let allAvailablePasses = [];

// Display available passes
function displayAvailablePasses(passes) {
    const grid = document.getElementById('availablePassesGrid');
    if (!grid) {
        console.error('availablePassesGrid element not found');
        return;
    }
    
    // Don't overwrite allAvailablePasses when displaying filtered results
    // Only set it initially in loadAvailablePasses()
    
    grid.innerHTML = '';
    
    if (!passes || passes.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">No passes found matching your filters.</p>';
        return;
    }
    
    passes.forEach(pass => {
        if (pass && pass.id) {
            try {
                const card = createAvailablePassCard(pass);
                grid.appendChild(card);
            } catch (error) {
                console.error('Error creating pass card:', error, pass);
            }
        } else {
            console.warn('Invalid pass data:', pass);
        }
    });
}

// Create pass card for available passes section
function createAvailablePassCard(pass) {
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
        const firstLetter = provider.charAt(0).toUpperCase();
        logoUrl = generateLogoSVG(firstLetter);
    } else if (logoUrl.startsWith('data:')) {
        logoUrl = logoUrl;
    } else if (logoUrl.includes('via.placeholder.com') || logoUrl.includes('placeholder')) {
        const firstLetter = provider.charAt(0).toUpperCase();
        logoUrl = generateLogoSVG(firstLetter);
    } else if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
        logoUrl = 'https://' + logoUrl;
    }
    
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
            <button class="btn btn-primary" id="purchaseBtn_${passId}" onclick="purchasePassFromDashboard(${passId})">
                <i class="fas fa-shopping-cart"></i> Purchase
            </button>
            <button class="btn btn-secondary" onclick="viewPassDetailsFromDashboard(${passId})">
                <i class="fas fa-info-circle"></i> Details
            </button>
        </div>
    `;
    
    return card;
}

// Store selected pass for booking confirmation
let selectedPassForBooking = null;

// Purchase pass from dashboard - shows confirmation modal first
async function purchasePassFromDashboard(passId) {
    const { token, user } = checkAuth();
    
    if (!token || !user) {
        showToast('Please login to purchase passes', 'error');
        window.location.href = 'login.html';
        return;
    }
    
    if (!passId) {
        showToast('Invalid pass ID', 'error');
        return;
    }
    
    // Check if pass is already booked
    if (isPassAlreadyBooked(passId)) {
        showToast('You already have an active pass for this transport. Please wait for it to expire or renew it.', 'warning');
        return;
    }
    
    try {
        // Fetch pass details
        const passResponse = await fetch(`${window.API_BASE_URL}/passes/${passId}`);
        
        if (!passResponse.ok) {
            throw new Error('Failed to fetch pass details');
        }
        
        const pass = await passResponse.json();
        selectedPassForBooking = pass;
        
        // Show booking confirmation modal
        showBookingConfirmationModal(pass, user);
        
    } catch (error) {
        console.error('Error loading pass details:', error);
        showToast('Error loading pass details. Please try again.', 'error');
    }
}

// Show booking confirmation modal
function showBookingConfirmationModal(pass, user) {
    const modal = document.getElementById('bookingConfirmationModal');
    if (!modal) return;
    
    // Calculate expiry date (today + validity_days)
    const today = new Date();
    const expiryDate = new Date(today);
    expiryDate.setDate(today.getDate() + (pass.validity_days || 30));
    
    // Format dates
    const formattedExpiry = expiryDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Populate user information
    document.getElementById('bookingUserName').textContent = user.name || 'N/A';
    document.getElementById('bookingUserEmail').textContent = user.email || 'N/A';
    
    // Populate pass information
    document.getElementById('bookingPassProvider').textContent = pass.provider || 'N/A';
    document.getElementById('bookingPassCategory').textContent = (pass.category || 'N/A').toUpperCase();
    document.getElementById('bookingPassType').textContent = (pass.type || 'N/A').charAt(0).toUpperCase() + (pass.type || '').slice(1);
    document.getElementById('bookingPassCoverage').textContent = pass.coverage || 'All routes';
    document.getElementById('bookingPassValidity').textContent = `${pass.validity_days || 30} ${pass.validity_days === 1 ? 'day' : 'days'}`;
    document.getElementById('bookingPassPrice').textContent = `₹${(pass.price || 0).toFixed(2)}`;
    
    // Populate expiry date
    document.getElementById('bookingExpiryDate').textContent = formattedExpiry;
    
    // Reset terms checkbox
    const termsCheckbox = document.getElementById('termsAgreement');
    if (termsCheckbox) {
        termsCheckbox.checked = false;
    }
    
    // Show modal
    modal.classList.add('active');
}

// Close booking confirmation modal
function closeBookingConfirmationModal() {
    const modal = document.getElementById('bookingConfirmationModal');
    if (modal) {
        modal.classList.remove('active');
        selectedPassForBooking = null;
    }
}

// Show booking success loader
function showBookingLoader() {
    const loader = document.getElementById('bookingLoader');
    if (loader) {
        loader.classList.add('active');
    }
}

// Hide booking success loader
function hideBookingLoader() {
    const loader = document.getElementById('bookingLoader');
    if (loader) {
        loader.classList.remove('active');
    }
}

// Confirm booking purchase
async function confirmBookingPurchase() {
    if (!selectedPassForBooking) {
        showToast('No pass selected', 'error');
        return;
    }
    
    const { token, user } = checkAuth();
    
    if (!token || !user) {
        showToast('Please login to purchase passes', 'error');
        return;
    }
    
    // Check if terms are accepted
    const termsCheckbox = document.getElementById('termsAgreement');
    if (!termsCheckbox || !termsCheckbox.checked) {
        showToast('Please accept the Terms & Conditions to proceed', 'warning');
        // Scroll to terms section
        const termsSection = document.querySelector('.booking-terms-section');
        if (termsSection) {
            termsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            termsSection.style.animation = 'pulse 0.5s ease-in-out';
            setTimeout(() => {
                termsSection.style.animation = '';
            }, 500);
        }
        return;
    }
    
    // Show loading state
    const confirmBtn = document.querySelector('.btn-confirm');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    confirmBtn.disabled = true;
    
    try {
        const response = await fetch(`${window.API_BASE_URL}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ pass_id: selectedPassForBooking.id })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Close modal
            closeBookingConfirmationModal();
            
            // Show success loader
            showBookingLoader();
            
            // Reload wallet balance and active passes in background
            setTimeout(async () => {
                await loadWalletBalance();
                await loadActivePasses();
                await loadTransactions();
                // Update pass card buttons after purchase
                updatePassCardButtons();
            }, 100);
            
            // Switch to Active Passes tab after 2 seconds
            setTimeout(() => {
                // Switch to Active Passes tab
                const activeTabBtn = document.querySelector('.dashboard-tabs .tab-btn[data-tab="active"]');
                if (activeTabBtn) {
                    activeTabBtn.click();
                    
                    // Scroll to top of Active Passes section
                    setTimeout(() => {
                        const activeTab = document.getElementById('activeTab');
                        if (activeTab) {
                            activeTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 100);
                }
                
                // Hide loader after tab switch
                setTimeout(() => {
                    hideBookingLoader();
                }, 400);
            }, 2000);
        } else {
            const errorMsg = data.error || 'Failed to purchase pass';
            showToast(errorMsg, 'error');
            
            // Check if error is about duplicate booking
            if (errorMsg.includes('already have an active pass')) {
                // Reload active bookings and update buttons
                await loadActiveBookingsForCheck();
            }
            
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error purchasing pass:', error);
        showToast('Network error. Please try again.', 'error');
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    }
}

// View pass details from dashboard
async function viewPassDetailsFromDashboard(passId) {
    try {
        const response = await fetch(`${window.API_BASE_URL}/passes/${passId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const pass = await response.json();
        showPassDetailsModal(pass);
    } catch (error) {
        console.error('Error loading pass details:', error);
        showToast('Error loading pass details', 'error');
    }
}

// Show pass details modal
function showPassDetailsModal(pass) {
    const modal = document.getElementById('passDetailsModal');
    const content = document.getElementById('passDetailsContent');
    
    if (!modal || !content) return;
    
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    content.innerHTML = `
        <h2>${escapeHtml(pass.provider)} - ${escapeHtml(pass.type)} Pass</h2>
        <div class="pass-details-full">
            <p><strong>Category:</strong> ${escapeHtml(pass.category)}</p>
            <p><strong>Validity:</strong> ${pass.validity_days} ${pass.validity_days === 1 ? 'day' : 'days'}</p>
            <p><strong>Coverage:</strong> ${escapeHtml(pass.coverage)}</p>
            <p><strong>Price:</strong> ₹${pass.price.toFixed(2)}</p>
        </div>
        <button class="btn btn-primary" onclick="purchasePassFromDashboard(${pass.id})" style="margin-top: 1rem;">
            <i class="fas fa-shopping-cart"></i> Purchase Pass
        </button>
    `;
    
    modal.classList.add('active');
}

// Setup filters for available passes
function setupAvailablePassFilters() {
    // Allow Enter key to trigger search
    const searchFilter = document.getElementById('dashboardSearchFilter');
    const typeFilter = document.getElementById('dashboardPassTypeFilter');
    
    // Remove any automatic filtering on change
    if (typeFilter) {
        // Don't add change event - filters only apply on search button click
    }
    
    if (searchFilter) {
        searchFilter.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchAvailablePasses();
            }
        });
    }
}

// Search available passes (triggered by search button)
function searchAvailablePasses() {
    filterAvailablePasses();
    // Optionally show a toast notification
    const searchFilter = document.getElementById('dashboardSearchFilter');
    const typeFilter = document.getElementById('dashboardPassTypeFilter');
    
    if (searchFilter && searchFilter.value.trim() !== '') {
        showToast('Search results updated', 'info');
    } else if (typeFilter && typeFilter.value !== 'all') {
        showToast('Filters applied', 'info');
    }
}

// Reset all filters
function resetFilters() {
    const searchFilter = document.getElementById('dashboardSearchFilter');
    const typeFilter = document.getElementById('dashboardPassTypeFilter');
    
    if (searchFilter) {
        searchFilter.value = '';
    }
    
    if (typeFilter) {
        typeFilter.value = 'all';
    }
    
    // Reset category to "All"
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === 'all') {
            btn.classList.add('active');
        }
    });
    
    // Reset and show all passes
    filterAvailablePasses();
    showToast('Filters reset', 'info');
}

// Filter by category (All, Buses, Trains, Flights) - Only updates UI, doesn't filter until search is clicked
function filterByCategory(category) {
    // Update active category button
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });
    
    // Don't apply filter immediately - wait for search button click
}

// Filter available passes
function filterAvailablePasses() {
    console.log('Filtering passes...', { 
        allPassesCount: allAvailablePasses.length,
        allPassesSample: allAvailablePasses.slice(0, 2)
    });
    
    const typeFilter = document.getElementById('dashboardPassTypeFilter');
    const searchFilter = document.getElementById('dashboardSearchFilter');
    const activeCategoryBtn = document.querySelector('.category-btn.active');
    
    const selectedType = typeFilter ? typeFilter.value : 'all';
    const searchTerm = searchFilter ? searchFilter.value.trim().toLowerCase() : '';
    const selectedCategory = activeCategoryBtn ? activeCategoryBtn.dataset.category : 'all';
    
    console.log('Filter criteria:', { selectedType, selectedCategory, searchTerm });
    
    // Check if we have passes to filter
    if (!Array.isArray(allAvailablePasses) || allAvailablePasses.length === 0) {
        console.warn('No passes available to filter');
        const grid = document.getElementById('availablePassesGrid');
        if (grid) {
            grid.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">No passes available</p>';
        }
        return;
    }
    
    let filtered = allAvailablePasses.filter(pass => {
        if (!pass) {
            console.warn('Invalid pass in array:', pass);
            return false;
        }
        
        // Type filter
        const typeMatch = selectedType === 'all' || (pass.type && pass.type.toLowerCase() === selectedType.toLowerCase());
        
        // Category filter
        const categoryMatch = selectedCategory === 'all' || (pass.category && pass.category.toLowerCase() === selectedCategory.toLowerCase());
        
        // Search filter
        let searchMatch = true;
        if (searchTerm) {
            const provider = (pass.provider || '').toLowerCase();
            const type = (pass.type || '').toLowerCase();
            const category = (pass.category || '').toLowerCase();
            const coverage = (pass.coverage || '').toLowerCase();
            
            searchMatch = provider.includes(searchTerm) ||
                         type.includes(searchTerm) ||
                         category.includes(searchTerm) ||
                         coverage.includes(searchTerm);
        }
        
        return typeMatch && categoryMatch && searchMatch;
    });
    
    console.log('Filtered results:', { 
        total: allAvailablePasses.length, 
        filtered: filtered.length,
        sample: filtered.slice(0, 2)
    });
    
    displayAvailablePasses(filtered);
}

// Load active bookings for duplicate checking
async function loadActiveBookingsForCheck() {
    try {
        const token = getAuthToken();
        if (!token) return;
        
        const response = await fetch(`${window.API_BASE_URL}/bookings/active`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const bookings = await response.json();
            userActiveBookings = bookings || [];
            console.log('Active bookings loaded for duplicate check:', userActiveBookings.length);
            // Update pass cards to show if already booked
            updatePassCardButtons();
        }
    } catch (error) {
        console.error('Error loading active bookings for check:', error);
    }
}

// Load active passes
async function loadActivePasses() {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/bookings/active`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            return;
        }
        
        const bookings = await response.json();
        console.log('Active bookings loaded:', bookings);
        userActiveBookings = bookings || [];
        displayBookings(bookings, 'activePassesList');
        // Update pass cards after loading active passes
        updatePassCardButtons();
    } catch (error) {
        console.error('Error loading active passes:', error);
        const container = document.getElementById('activePassesList');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">Error loading passes. Please try again.</p>';
        }
    }
}

// Check if pass is already booked
function isPassAlreadyBooked(passId) {
    return userActiveBookings.some(booking => booking.pass_id === passId);
}

// Update pass card buttons based on booking status
function updatePassCardButtons() {
    const passCards = document.querySelectorAll('#availablePassesGrid .pass-card');
    passCards.forEach(card => {
        const purchaseBtn = card.querySelector('.btn-primary');
        if (purchaseBtn) {
            const onclickAttr = purchaseBtn.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/purchasePassFromDashboard\((\d+)\)/);
                if (match) {
                    const passId = parseInt(match[1]);
                    if (isPassAlreadyBooked(passId)) {
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

// Load expired passes
async function loadExpiredPasses() {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/bookings/expired`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            return;
        }
        
        const bookings = await response.json();
        console.log('Expired bookings loaded:', bookings);
        displayBookings(bookings, 'expiredPassesList', true);
    } catch (error) {
        console.error('Error loading expired passes:', error);
        const container = document.getElementById('expiredPassesList');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">Error loading passes. Please try again.</p>';
        }
    }
}

// Display bookings
function displayBookings(bookings, containerId, isExpired = false) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Container not found:', containerId);
        return;
    }
    
    container.innerHTML = '';
    
    if (!Array.isArray(bookings)) {
        console.error('Bookings is not an array:', bookings);
        container.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">Error loading passes</p>';
        return;
    }
    
    if (bookings.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">No passes found</p>';
        return;
    }
    
    bookings.forEach(booking => {
        const card = createBookingCard(booking, isExpired);
        container.appendChild(card);
    });
}

// Create booking card
function createBookingCard(booking, isExpired) {
    const card = document.createElement('div');
    card.className = 'pass-item';
    
    // The API returns booking data with pass fields already joined
    const provider = booking.provider || 'N/A';
    const passType = booking.type ? booking.type.charAt(0).toUpperCase() + booking.type.slice(1) : '';
    const purchaseDate = booking.purchase_date ? new Date(booking.purchase_date) : new Date();
    const expiryDate = booking.expiry_date ? new Date(booking.expiry_date) : new Date();
    const coverage = booking.coverage || 'All routes';
    const bookingId = booking.id;
    
    card.innerHTML = `
        <div class="pass-header">
            <div>
                <h3>${provider}</h3>
                <p style="color: var(--gray);">${passType} Pass</p>
            </div>
            <span class="pass-badge ${isExpired ? 'expired' : ''}">
                ${isExpired ? 'Expired' : 'Active'}
            </span>
        </div>
        <div class="pass-details" style="margin: 1rem 0;">
            <div class="pass-detail-item">
                <i class="fas fa-calendar-alt"></i>
                <span>Purchased: ${purchaseDate.toLocaleDateString()}</span>
            </div>
            <div class="pass-detail-item">
                <i class="fas fa-calendar-times"></i>
                <span>Expires: ${expiryDate.toLocaleDateString()}</span>
            </div>
            <div class="pass-detail-item">
                <i class="fas fa-route"></i>
                <span>${coverage}</span>
            </div>
        </div>
        <div class="pass-actions">
            ${!isExpired ? `
                <button class="btn btn-secondary" onclick="downloadReceipt(${bookingId})">
                    <i class="fas fa-download"></i> Receipt
                </button>
            ` : `
                <button class="btn btn-primary" onclick="renewPass(${bookingId})">
                    <i class="fas fa-redo"></i> Renew
                </button>
            `}
        </div>
    `;
    
    return card;
}

// Load transactions
async function loadTransactions() {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/transactions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const transactions = await response.json();
        displayTransactions(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// Display transactions
function displayTransactions(transactions) {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No transactions found</td></tr>';
        return;
    }
    
    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        const date = new Date(transaction.transaction_date);
        
        row.innerHTML = `
            <td>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</td>
            <td>${transaction.transaction_type.toUpperCase()}</td>
            <td>${transaction.description}</td>
            <td>₹${transaction.amount}</td>
            <td><span class="status-badge ${transaction.status}">${transaction.status.toUpperCase()}</span></td>
            <td>
                ${transaction.transaction_type === 'topup' || transaction.transaction_type === 'purchase' || transaction.transaction_type === 'renewal' ? `
                    <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.9rem;" onclick="downloadReceipt(${transaction.id}, 'transaction')">
                        <i class="fas fa-download"></i>
                    </button>
                ` : '-'}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Setup dashboard tabs
function setupDashboardTabs() {
    const tabButtons = document.querySelectorAll('.dashboard-tabs .tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tabName = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            const targetTab = document.getElementById(`${tabName}Tab`);
            if (targetTab) {
                targetTab.classList.add('active');
            }
        });
    });
}

// Wallet modal functions
function openWalletModal() {
    const modal = document.getElementById('walletModal');
    if (modal) {
        modal.classList.add('active');
        selectedTopUpAmount = 0;
        updateSelectedAmount();
    }
}

function closeWalletModal() {
    const modal = document.getElementById('walletModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function selectTopUp(amount) {
    selectedTopUpAmount = amount;
    document.querySelectorAll('.topup-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    event.target.classList.add('selected');
    document.getElementById('customAmount').value = '';
    updateSelectedAmount();
}

function updateSelectedAmount() {
    const customAmount = document.getElementById('customAmount')?.value;
    if (customAmount && parseInt(customAmount) >= 100) {
        selectedTopUpAmount = parseInt(customAmount);
    }
    
    const selectedAmountEl = document.getElementById('selectedAmount');
    if (selectedAmountEl) {
        selectedAmountEl.textContent = `₹${selectedTopUpAmount}`;
    }
}

// Setup custom amount input (duplicate handler removed - already in main DOMContentLoaded)

// Process top-up
async function processTopUp() {
    const customAmount = document.getElementById('customAmount')?.value;
    const amount = customAmount && parseInt(customAmount) >= 100 
        ? parseInt(customAmount) 
        : selectedTopUpAmount;
    
    if (amount < 100) {
        showToast('Minimum top-up amount is ₹100', 'error');
        return;
    }
    
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/transactions/topup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(`Successfully added ₹${amount} to wallet!`, 'success');
            closeWalletModal();
            await loadWalletBalance();
            await loadTransactions();
        } else {
            showToast(data.error || 'Top-up failed', 'error');
        }
    } catch (error) {
        console.error('Top-up error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

// Renew pass
async function renewPass(bookingId) {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/bookings/${bookingId}/renew`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Pass renewed successfully!', 'success');
            await loadDashboardData();
        } else {
            showToast(data.error || 'Renewal failed', 'error');
        }
    } catch (error) {
        console.error('Renewal error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

// Download receipt
async function downloadReceipt(id, type = 'booking') {
    try {
        const token = getAuthToken();
        const endpoint = type === 'transaction' 
            ? `${window.API_BASE_URL}/transactions/${id}/receipt`
            : `${window.API_BASE_URL}/bookings/${id}/receipt`;
        
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Create and download receipt
            const receiptContent = generateReceiptHTML(data);
            const blob = new Blob([receiptContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt_${id}.html`;
            a.click();
            URL.revokeObjectURL(url);
            
            showToast('Receipt downloaded!', 'success');
        } else {
            showToast(data.error || 'Failed to download receipt', 'error');
        }
    } catch (error) {
        console.error('Receipt error:', error);
        showToast('Error downloading receipt', 'error');
    }
}

// Generate receipt HTML
function generateReceiptHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Receipt - TransportPass</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .receipt { max-width: 600px; margin: 0 auto; border: 2px solid #26a69a; padding: 30px; }
        .header { text-align: center; margin-bottom: 30px; }
        .details { margin: 20px 0; }
        .details div { margin: 10px 0; }
        .total { font-size: 1.5rem; font-weight: bold; color: #26a69a; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <h1>TransportPass</h1>
            <h2>Receipt</h2>
        </div>
        <div class="details">
            ${data.provider ? `<div><strong>Provider:</strong> ${data.provider}</div>` : ''}
            ${data.transaction_type ? `<div><strong>Type:</strong> ${data.transaction_type.toUpperCase()}</div>` : ''}
            ${data.description ? `<div><strong>Description:</strong> ${data.description}</div>` : ''}
            ${data.purchase_date ? `<div><strong>Date:</strong> ${new Date(data.purchase_date).toLocaleString()}</div>` : ''}
            ${data.transaction_date ? `<div><strong>Date:</strong> ${new Date(data.transaction_date).toLocaleString()}</div>` : ''}
            ${data.expiry_date ? `<div><strong>Expiry:</strong> ${new Date(data.expiry_date).toLocaleDateString()}</div>` : ''}
            <div class="total">Amount: ₹${data.amount || data.price || 0}</div>
        </div>
        <div style="margin-top: 30px; text-align: center; color: #666;">
            <p>Thank you for using TransportPass!</p>
        </div>
    </div>
</body>
</html>
    `;
}

// Close pass details modal
function closePassDetailsModal() {
    const modal = document.getElementById('passDetailsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}
