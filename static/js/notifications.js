// ====================================
// NOTIFICATION SYSTEM
// ====================================

class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notification-container');
        }
    }

    show(type, title, message, duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        notification.innerHTML = `
            <div class="notification-header">
                <h4 class="notification-title">${icons[type]} ${title}</h4>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
            <p class="notification-message">${message}</p>
        `;

        this.container.appendChild(notification);

        // Show animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }

        return notification;
    }

    success(title, message, duration = 4000) {
        return this.show('success', title, message, duration);
    }

    error(title, message, duration = 6000) {
        return this.show('error', title, message, duration);
    }

    warning(title, message, duration = 5000) {
        return this.show('warning', title, message, duration);
    }

    info(title, message, duration = 4000) {
        return this.show('info', title, message, duration);
    }
}

// ====================================
// CONFIRMATION MODAL SYSTEM
// ====================================

class ConfirmationModal {
    constructor() {
        this.modal = null;
        this.init();
    }

    init() {
        // Create confirmation modal if it doesn't exist
        if (!document.getElementById('confirmation-modal')) {
            this.modal = document.createElement('div');
            this.modal.id = 'confirmation-modal';
            this.modal.className = 'confirmation-modal';
            this.modal.innerHTML = `
                <div class="confirmation-content">
                    <div class="confirmation-icon">
                        <span class="icon-symbol"></span>
                    </div>
                    <h3 class="confirmation-title"></h3>
                    <p class="confirmation-message"></p>
                    <div class="confirmation-buttons"></div>
                </div>
            `;
            document.body.appendChild(this.modal);

            // Close on outside click
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.hide();
                }
            });
        } else {
            this.modal = document.getElementById('confirmation-modal');
        }
    }

    show(options = {}) {
        const {
            type = 'question',
            title = 'Confirm Action',
            message = 'Are you sure you want to proceed?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            onConfirm = () => {},
            onCancel = () => {},
            showCancel = true
        } = options;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            question: '?'
        };

        // Update content
        const iconEl = this.modal.querySelector('.confirmation-icon');
        const titleEl = this.modal.querySelector('.confirmation-title');
        const messageEl = this.modal.querySelector('.confirmation-message');
        const buttonsEl = this.modal.querySelector('.confirmation-buttons');

        iconEl.className = `confirmation-icon ${type}`;
        iconEl.querySelector('.icon-symbol').textContent = icons[type];
        titleEl.textContent = title;
        messageEl.textContent = message;

        // Create buttons
        buttonsEl.innerHTML = '';

        if (showCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'confirmation-btn secondary';
            cancelBtn.textContent = cancelText;
            cancelBtn.onclick = () => {
                this.hide();
                onCancel();
            };
            buttonsEl.appendChild(cancelBtn);
        }

        const confirmBtn = document.createElement('button');
        confirmBtn.className = `confirmation-btn ${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'}`;
        confirmBtn.textContent = confirmText;
        confirmBtn.onclick = () => {
            this.hide();
            onConfirm();
        };
        buttonsEl.appendChild(confirmBtn);

        // Show modal
        this.modal.classList.add('show');
        
        // Focus on confirm button
        setTimeout(() => confirmBtn.focus(), 300);

        return new Promise((resolve) => {
            const originalOnConfirm = onConfirm;
            const originalOnCancel = onCancel;

            confirmBtn.onclick = () => {
                this.hide();
                originalOnConfirm();
                resolve(true);
            };

            if (showCancel) {
                const cancelBtn = buttonsEl.querySelector('.secondary');
                cancelBtn.onclick = () => {
                    this.hide();
                    originalOnCancel();
                    resolve(false);
                };
            }
        });
    }

    hide() {
        this.modal.classList.remove('show');
    }

    confirm(options = {}) {
        return this.show({
            type: 'question',
            confirmText: 'Yes',
            cancelText: 'No',
            ...options
        });
    }

    success(options = {}) {
        return this.show({
            type: 'success',
            confirmText: 'OK',
            showCancel: false,
            ...options
        });
    }

    error(options = {}) {
        return this.show({
            type: 'error',
            confirmText: 'OK',
            showCancel: false,
            ...options
        });
    }

    warning(options = {}) {
        return this.show({
            type: 'warning',
            confirmText: 'OK',
            ...options
        });
    }
}

// ====================================
// LOADING OVERLAY
// ====================================

class LoadingOverlay {
    constructor() {
        this.overlay = null;
        this.init();
    }

    init() {
        if (!document.getElementById('loading-overlay')) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'loading-overlay';
            this.overlay.className = 'loading-overlay';
            this.overlay.innerHTML = `
                <div>
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading...</div>
                </div>
            `;
            document.body.appendChild(this.overlay);
        } else {
            this.overlay = document.getElementById('loading-overlay');
        }
    }

    show(text = 'Loading...') {
        const textEl = this.overlay.querySelector('.loading-text');
        textEl.textContent = text;
        this.overlay.classList.add('show');
    }

    hide() {
        this.overlay.classList.remove('show');
    }
}

// ====================================
// DRAFT SAVING SYSTEM
// ====================================

class DraftManager {
    constructor(formId, keyPrefix = 'draft') {
        this.formId = formId;
        this.keyPrefix = keyPrefix;
        this.storageKey = `${keyPrefix}_${formId}`;
    }

    save(data) {
        try {
            const draftData = {
                data: data,
                timestamp: Date.now(),
                formId: this.formId
            };
            localStorage.setItem(this.storageKey, JSON.stringify(draftData));
            return true;
        } catch (error) {
            console.error('Failed to save draft:', error);
            return false;
        }
    }

    load() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const draftData = JSON.parse(stored);
                return draftData.data;
            }
            return null;
        } catch (error) {
            console.error('Failed to load draft:', error);
            return null;
        }
    }

    clear() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('Failed to clear draft:', error);
            return false;
        }
    }

    exists() {
        return localStorage.getItem(this.storageKey) !== null;
    }

    getTimestamp() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const draftData = JSON.parse(stored);
                return draftData.timestamp;
            }
            return null;
        } catch (error) {
            console.error('Failed to get draft timestamp:', error);
            return null;
        }
    }
}

// ====================================
// TIME UTILITIES
// ====================================

class TimeUtils {
    static getCurrentTime() {
        return new Date();
    }

    static isWithinShift(shift) {
        const now = new Date();
        const currentHour = now.getHours();
        
        if (shift === 'AM') {
            return currentHour >= 5 && currentHour < 17;
        } else if (shift === 'PM') {
            return currentHour >= 17 || currentHour < 5;
        }
        
        return false;
    }

    static getMinutesUntilShiftEnd(shift) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        let shiftEndHour;
        
        if (shift === 'AM') {
            shiftEndHour = 17; // 5 PM
            if (currentHour < 17) {
                return ((shiftEndHour - currentHour - 1) * 60) + (60 - currentMinute);
            } else {
                return 0; // Shift has ended
            }
        } else if (shift === 'PM') {
            if (currentHour >= 17) {
                // Same day, shift ends at 5 AM next day
                return ((24 - currentHour - 1) * 60) + (60 - currentMinute) + (5 * 60);
            } else if (currentHour < 5) {
                // Next day, shift ends at 5 AM
                return ((5 - currentHour - 1) * 60) + (60 - currentMinute);
            } else {
                return 0; // Shift has ended
            }
        }
        
        return 0;
    }

    static shouldShowSummaryForm(shift) {
        const minutesUntilEnd = this.getMinutesUntilShiftEnd(shift);
        return minutesUntilEnd <= 30 && minutesUntilEnd > 0;
    }

    static hasShiftEnded(shift) {
        return this.getMinutesUntilShiftEnd(shift) <= 0;
    }

    static formatTimeRemaining(minutes) {
        if (minutes <= 0) return 'Shift ended';
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return `${hours}h ${mins}m remaining`;
        } else {
            return `${mins}m remaining`;
        }
    }
}

// ====================================
// GLOBAL INSTANCES
// ====================================

// Initialize global instances
const notify = new NotificationSystem();
const confirm = new ConfirmationModal();
const loading = new LoadingOverlay();

// Utility functions for backward compatibility
window.showNotification = (type, title, message, duration) => notify.show(type, title, message, duration);
window.showSuccess = (title, message) => notify.success(title, message);
window.showError = (title, message) => notify.error(title, message);
window.showWarning = (title, message) => notify.warning(title, message);
window.showInfo = (title, message) => notify.info(title, message);

window.showConfirm = (options) => confirm.confirm(options);
window.showSuccessDialog = (options) => confirm.success(options);
window.showErrorDialog = (options) => confirm.error(options);
window.showWarningDialog = (options) => confirm.warning(options);

window.showLoading = (text) => loading.show(text);
window.hideLoading = () => loading.hide();

// Button loading state utility
window.setButtonLoading = (button, loading = true) => {
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
};
