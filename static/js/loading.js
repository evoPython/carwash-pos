/**
 * Loading animation and request interceptor
 */

// Create loading overlay element
function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.style.display = 'none';

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    overlay.appendChild(spinner);

    document.body.appendChild(overlay);
    return overlay;
}

// Show loading overlay
function showLoading() {
    console.log('Showing loading animation');
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

// Hide loading overlay
function hideLoading() {
    console.log('Hiding loading animation');
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Override fetch to show loading animation
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    showLoading();

    try {
        const response = await originalFetch.apply(this, args);

        // Clone the response to handle it twice (once for the consumer, once for error checking)
        const responseClone = response.clone();

        // Check for error status
        if (!response.ok) {
            try {
                const errorData = await responseClone.json();
                const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
                console.error('Request error:', errorMessage);
                alert(errorMessage);
            } catch (e) {
                console.error('Failed to parse error response:', e);
                alert(`Request failed with status: ${response.status}`);
            }
        }

        return response;
    } catch (error) {
        console.error('Network error:', error);
        alert('Network error: ' + error.message);
        throw error;
    } finally {
        hideLoading();
    }
};

// Initialize loading overlay on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    createLoadingOverlay();
});