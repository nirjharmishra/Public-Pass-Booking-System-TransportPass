// Authentication Functions
// Initialize global API_BASE_URL if not already set
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'http://localhost:3000/api';
}

// Toast notification function (if not already loaded)
if (typeof showToast === 'undefined') {
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            const newContainer = document.createElement('div');
            newContainer.id = 'toastContainer';
            document.body.appendChild(newContainer);
            container = newContainer;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'check-circle';
        if (type === 'error') {
            icon = 'exclamation-circle';
        } else if (type === 'warning') {
            icon = 'exclamation-triangle';
        } else if (type === 'info') {
            icon = 'info-circle';
        }
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s reverse';
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Check authentication status
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    // Get navigation elements
    const loginNav = document.getElementById('loginNav');
    const registerNav = document.getElementById('registerNav');
    const dashboardNav = document.getElementById('dashboardNav');
    const logoutNav = document.getElementById('logoutNav');
    const adminNav = document.getElementById('adminNav');
    const homeNav = document.getElementById('homeNav');
    
    // Check if user is logged in
    const isLoggedIn = !!(token && user);
    
    if (isLoggedIn) {
        // User is logged in - show authenticated items, hide home button
        if (loginNav) loginNav.style.display = 'none';
        if (registerNav) registerNav.style.display = 'none';
        if (dashboardNav) dashboardNav.style.display = 'flex';
        if (logoutNav) logoutNav.style.display = 'flex';
        if (user.role === 'admin' && adminNav) adminNav.style.display = 'flex';
        // Hide home button when logged in
        if (homeNav) {
            homeNav.style.display = 'none';
            // Also hide parent li to avoid empty space
            const homeNavParent = homeNav.parentElement;
            if (homeNavParent && homeNavParent.tagName === 'LI') {
                homeNavParent.style.display = 'none';
            }
        }
    } else {
        // User is not logged in - show login/register and home button, hide dashboard/admin/logout
        if (loginNav) loginNav.style.display = 'flex';
        if (registerNav) registerNav.style.display = 'flex';
        if (dashboardNav) dashboardNav.style.display = 'none';
        if (logoutNav) logoutNav.style.display = 'none';
        if (adminNav) adminNav.style.display = 'none';
        // Show home button when logged out
        if (homeNav) {
            homeNav.style.display = 'flex';
            // Also show parent li
            const homeNavParent = homeNav.parentElement;
            if (homeNavParent && homeNavParent.tagName === 'LI') {
                homeNavParent.style.display = '';
            }
        }
    }
    
    return { token, user };
}

// Register user
async function register(userData) {
    try {
        console.log('Registering user:', userData.email);
        
        const response = await fetch(`${window.API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        console.log('Registration response status:', response.status);
        
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('Error parsing JSON response:', parseError);
            showToast('Server error. Please try again.', 'error');
            return;
        }
        
        console.log('Registration response data:', data);
        
        if (response.ok) {
            if (data.token && data.user) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                showToast('Registration successful!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                console.error('Missing token or user in response:', data);
                showToast('Registration incomplete. Please try logging in.', 'warning');
            }
        } else {
            const errorMsg = data.error || 'Registration failed';
            console.error('Registration failed:', errorMsg);
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Registration network error:', error);
        showToast('Network error. Please check if server is running.', 'error');
    }
}

// Login user
async function login(email, password) {
    try {
        console.log('Logging in user:', email);
        
        const response = await fetch(`${window.API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        console.log('Login response status:', response.status);
        
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('Error parsing JSON response:', parseError);
            showToast('Server error. Please try again.', 'error');
            return;
        }
        
        console.log('Login response data:', data);
        
        if (response.ok) {
            if (data.token && data.user) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                showToast('Login successful!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                console.error('Missing token or user in response:', data);
                showToast('Login incomplete. Please try again.', 'warning');
            }
        } else {
            const errorMsg = data.error || 'Login failed';
            console.error('Login failed:', errorMsg);
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Login network error:', error);
        showToast('Network error. Please check if server is running.', 'error');
    }
}

// Logout user
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Get auth token for API calls
function getAuthToken() {
    return localStorage.getItem('token');
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Register form handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            
            if (!name || !email || !password) {
                showToast('Please fill in all required fields', 'error');
                return;
            }
            
            if (password.length < 6) {
                showToast('Password must be at least 6 characters', 'error');
                return;
            }
            
            const userData = {
                name: name,
                email: email,
                password: password
            };
            
            await register(userData);
        });
    }
    
    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
            
            try {
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value;
                
                if (!email || !password) {
                    showToast('Please fill in all fields', 'error');
                    return;
                }
                
                await login(email, password);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
});

