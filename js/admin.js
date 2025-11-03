// Admin panel functionality
// Initialize global API_BASE_URL if not already set
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'http://localhost:3000/api';
}

let editingPassId = null;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', async () => {
    const { token, user } = checkAuth();
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }
    
    if (user.role !== 'admin') {
        showToast('Access denied. Admin privileges required.', 'error');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);
        return;
    }
    
    await loadAdminData();
    setupAdminTabs();
    
    // Form submission handler
    const passForm = document.getElementById('passForm');
    if (passForm) {
        passForm.addEventListener('submit', handlePassSubmit);
    }
    
    // Close modal on outside click
    window.onclick = function(event) {
        const modal = document.getElementById('addPassModal');
        if (event.target === modal) {
            closeAddPassModal();
        }
    };
});

// Load all admin data
async function loadAdminData() {
    await Promise.all([
        loadPasses(),
        loadBookings(),
        loadUsers(),
        loadAllTransactions(),
        loadStatistics()
    ]);
}

// Setup admin tabs
function setupAdminTabs() {
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

// Load passes for admin
async function loadPasses() {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/admin/passes`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const passes = await response.json();
        displayAdminPasses(passes);
    } catch (error) {
        console.error('Error loading passes:', error);
        showToast('Error loading passes', 'error');
    }
}

// Display passes in admin table
function displayAdminPasses(passes) {
    const tbody = document.getElementById('adminPassesBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (passes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No passes found</td></tr>';
        return;
    }
    
    passes.forEach(pass => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${pass.id}</td>
            <td>${pass.provider}</td>
            <td>${pass.category.toUpperCase()}</td>
            <td>${pass.type.charAt(0).toUpperCase() + pass.type.slice(1)}</td>
            <td>₹${pass.price}</td>
            <td>${pass.validity_days} days</td>
            <td>
                <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.9rem; margin-right: 5px; background: var(--teal); color: white;" onclick="editPass(${pass.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn" style="padding: 5px 10px; font-size: 0.9rem; background: var(--error); color: white;" onclick="deletePass(${pass.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Load bookings for admin
async function loadBookings() {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/admin/bookings`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const bookings = await response.json();
        displayBookings(bookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
        showToast('Error loading bookings', 'error');
    }
}

// Display bookings in admin table
function displayBookings(bookings) {
    const tbody = document.getElementById('adminBookingsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No bookings found</td></tr>';
        return;
    }
    
    bookings.forEach(booking => {
        const row = document.createElement('tr');
        const purchaseDate = new Date(booking.purchase_date);
        const expiryDate = new Date(booking.expiry_date);
        const isExpired = expiryDate < new Date();
        
        row.innerHTML = `
            <td>${booking.id}</td>
            <td>${booking.user_name}<br><small style="color: var(--gray);">${booking.user_email}</small></td>
            <td>${booking.provider}</td>
            <td>${booking.category.toUpperCase()}</td>
            <td>${booking.type.charAt(0).toUpperCase() + booking.type.slice(1)}</td>
            <td>${purchaseDate.toLocaleDateString()}<br><small style="color: var(--gray);">${purchaseDate.toLocaleTimeString()}</small></td>
            <td>${expiryDate.toLocaleDateString()}<br><small style="color: ${isExpired ? 'var(--error)' : 'var(--success)'};">${isExpired ? 'Expired' : 'Active'}</small></td>
            <td><span class="status-badge ${booking.status}">${booking.status.toUpperCase()}</span></td>
            <td>
                <button class="btn" style="padding: 5px 10px; font-size: 0.9rem; background: var(--error); color: white;" onclick="deleteBooking(${booking.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Load users for admin
async function loadUsers() {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Error loading users', 'error');
    }
}

// Display users in admin table
function displayUsers(users) {
    const tbody = document.getElementById('adminUsersBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No users found</td></tr>';
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>₹${user.wallet_balance || 0}</td>
            <td><span class="pass-badge">${user.role.toUpperCase()}</span></td>
            <td>
                ${user.role !== 'admin' ? `
                    <button class="btn" style="padding: 5px 10px; font-size: 0.9rem; background: var(--error); color: white;" onclick="deleteUser(${user.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                ` : '<span style="color: var(--gray);">Protected</span>'}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Load all transactions for admin
async function loadAllTransactions() {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/admin/transactions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const transactions = await response.json();
        displayAdminTransactions(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
        showToast('Error loading transactions', 'error');
    }
}

// Display transactions in admin table
function displayAdminTransactions(transactions) {
    const tbody = document.getElementById('adminTransactionsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No transactions found</td></tr>';
        return;
    }
    
    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        const date = new Date(transaction.transaction_date);
        row.innerHTML = `
            <td>${transaction.id}</td>
            <td>${transaction.user_name} (${transaction.user_email})</td>
            <td>${transaction.transaction_type.toUpperCase()}</td>
            <td>${transaction.description}</td>
            <td>₹${transaction.amount}</td>
            <td>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</td>
            <td><span class="status-badge ${transaction.status}">${transaction.status.toUpperCase()}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Load statistics
async function loadStatistics() {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/admin/statistics`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const stats = await response.json();
        displayStatistics(stats);
    } catch (error) {
        console.error('Error loading statistics:', error);
        showToast('Error loading statistics', 'error');
    }
}

// Display statistics
function displayStatistics(stats) {
    document.getElementById('statUsers').textContent = stats.totalUsers || 0;
    document.getElementById('statPasses').textContent = stats.totalPasses || 0;
    document.getElementById('statRevenue').textContent = `₹${stats.totalRevenue || 0}`;
    document.getElementById('statBookings').textContent = stats.totalBookings || 0;
}

// Open add pass modal
function openAddPassModal() {
    editingPassId = null;
    const modal = document.getElementById('addPassModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('passForm');
    
    if (modal) {
        if (title) title.textContent = 'Add New Pass';
        if (form) form.reset();
        modal.classList.add('active');
    }
}

// Close add pass modal
function closeAddPassModal() {
    const modal = document.getElementById('addPassModal');
    if (modal) {
        modal.classList.remove('active');
        editingPassId = null;
        const form = document.getElementById('passForm');
        if (form) form.reset();
    }
}

// Edit pass
async function editPass(passId) {
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/passes/${passId}`);
        const pass = await response.json();
        
        editingPassId = passId;
        
        // Populate form
        document.getElementById('passProvider').value = pass.provider;
        document.getElementById('passCategory').value = pass.category;
        document.getElementById('passType').value = pass.type;
        document.getElementById('passPrice').value = pass.price;
        document.getElementById('passValidity').value = pass.validity_days;
        document.getElementById('passCoverage').value = pass.coverage || '';
        document.getElementById('passLogo').value = pass.logo_url || '';
        
        // Update modal title
        document.getElementById('modalTitle').textContent = 'Edit Pass';
        
        // Open modal
        document.getElementById('addPassModal').classList.add('active');
    } catch (error) {
        console.error('Error loading pass:', error);
        showToast('Error loading pass details', 'error');
    }
}

// Delete pass
async function deletePass(passId) {
    if (!confirm('Are you sure you want to delete this pass?')) {
        return;
    }
    
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/admin/passes/${passId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Pass deleted successfully', 'success');
            await loadPasses();
        } else {
            showToast(data.error || 'Failed to delete pass', 'error');
        }
    } catch (error) {
        console.error('Error deleting pass:', error);
        showToast('Error deleting pass', 'error');
    }
}

// Handle pass form submission
async function handlePassSubmit(e) {
    e.preventDefault();
    
    const passData = {
        provider: document.getElementById('passProvider').value,
        category: document.getElementById('passCategory').value,
        type: document.getElementById('passType').value,
        price: parseFloat(document.getElementById('passPrice').value),
        validity_days: parseInt(document.getElementById('passValidity').value),
        coverage: document.getElementById('passCoverage').value,
        logo_url: document.getElementById('passLogo').value || null
    };
    
    try {
        const token = getAuthToken();
        const url = editingPassId 
            ? `${window.API_BASE_URL}/admin/passes/${editingPassId}`
            : `${window.API_BASE_URL}/admin/passes`;
        
        const method = editingPassId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(passData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(editingPassId ? 'Pass updated successfully' : 'Pass created successfully', 'success');
            closeAddPassModal();
            await loadPasses();
        } else {
            showToast(data.error || 'Operation failed', 'error');
        }
    } catch (error) {
        console.error('Error saving pass:', error);
        showToast('Error saving pass', 'error');
    }
}

// Delete booking
async function deleteBooking(bookingId) {
    if (!confirm('Are you sure you want to delete this booking? This action cannot be undone!')) {
        return;
    }
    
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/admin/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Booking deleted successfully', 'success');
            await loadBookings();
        } else {
            showToast(data.error || 'Failed to delete booking', 'error');
        }
    } catch (error) {
        console.error('Error deleting booking:', error);
        showToast('Error deleting booking', 'error');
    }
}

// Delete user
async function deleteUser(userId) {
    // Get user details for confirmation message
    try {
        const token = getAuthToken();
        const usersResponse = await fetch(`${window.API_BASE_URL}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const users = await usersResponse.json();
        const user = users.find(u => u.id === userId);
        const userName = user ? user.name : 'this user';
        
        if (!confirm(`Are you sure you want to delete user "${userName}"? This will also delete all their bookings and transactions. This action cannot be undone!`)) {
            return;
        }
    } catch (error) {
        if (!confirm(`Are you sure you want to delete this user? This will also delete all their bookings and transactions. This action cannot be undone!`)) {
            return;
        }
    }
    
    try {
        const token = getAuthToken();
        const response = await fetch(`${window.API_BASE_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('User deleted successfully', 'success');
            await loadUsers();
        } else {
            showToast(data.error || 'Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Error deleting user', 'error');
    }
}

