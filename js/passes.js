// Passes management (shared utilities)
// Global API base URL - set only once
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'http://localhost:3000/api';
}

// Toast notification function (global)
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        // Create container if it doesn't exist
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
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s reverse';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

