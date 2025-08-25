/**
 * Time Override Module
 *
 * This module provides a floating window for overriding the current time
 * in the application. It allows users to set a custom time that will be
 * used throughout the application instead of the actual system time.
 */

// Create the floating time override window
function createTimeOverrideWindow() {
    // Create the container
    const container = document.createElement('div');
    container.id = 'time-override-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '10000';
    container.style.backgroundColor = 'white';
    container.style.border = '1px solid #ccc';
    container.style.borderRadius = '8px';
    container.style.padding = '15px';
    container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    container.style.width = '300px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '14px';

    // Create the title
    const title = document.createElement('h3');
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '16px';
    title.style.color = '#333';
    title.textContent = 'Time Override';
    container.appendChild(title);

    // Create the description
    const description = document.createElement('p');
    description.style.margin = '0 0 15px 0';
    description.style.color = '#666';
    description.style.fontSize = '13px';
    description.textContent = 'Set a custom time for testing purposes.';
    container.appendChild(description);

    // Create the date input
    const dateLabel = document.createElement('label');
    dateLabel.style.display = 'block';
    dateLabel.style.marginBottom = '5px';
    dateLabel.style.fontWeight = '500';
    dateLabel.textContent = 'Date:';
    container.appendChild(dateLabel);

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.id = 'time-override-date';
    dateInput.style.width = '100%';
    dateInput.style.padding = '8px';
    dateInput.style.border = '1px solid #ddd';
    dateInput.style.borderRadius = '4px';
    dateInput.style.boxSizing = 'border-box';
    container.appendChild(dateInput);

    // Create the time input
    const timeLabel = document.createElement('label');
    timeLabel.style.display = 'block';
    timeLabel.style.margin = '10px 0 5px 0';
    timeLabel.style.fontWeight = '500';
    timeLabel.textContent = 'Time:';
    container.appendChild(timeLabel);

    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.id = 'time-override-time';
    timeInput.style.width = '100%';
    timeInput.style.padding = '8px';
    timeInput.style.border = '1px solid #ddd';
    timeInput.style.borderRadius = '4px';
    timeInput.style.boxSizing = 'border-box';
    container.appendChild(timeInput);

    // Create the apply button
    const applyButton = document.createElement('button');
    applyButton.id = 'time-override-apply';
    applyButton.style.marginTop = '15px';
    applyButton.style.width = '100%';
    applyButton.style.padding = '10px';
    applyButton.style.backgroundColor = '#4CAF50';
    applyButton.style.color = 'white';
    applyButton.style.border = 'none';
    applyButton.style.borderRadius = '4px';
    applyButton.style.cursor = 'pointer';
    applyButton.style.fontSize = '14px';
    applyButton.style.fontWeight = '500';
    applyButton.textContent = 'Apply Time Override';
    container.appendChild(applyButton);

    // Create the reset button
    const resetButton = document.createElement('button');
    resetButton.id = 'time-override-reset';
    resetButton.style.marginTop = '8px';
    resetButton.style.width = '100%';
    resetButton.style.padding = '10px';
    resetButton.style.backgroundColor = '#f44336';
    resetButton.style.color = 'white';
    resetButton.style.border = 'none';
    resetButton.style.borderRadius = '4px';
    resetButton.style.cursor = 'pointer';
    resetButton.style.fontSize = '14px';
    resetButton.style.fontWeight = '500';
    resetButton.textContent = 'Reset to System Time';
    container.appendChild(resetButton);

    // Create the close button
    const closeButton = document.createElement('button');
    closeButton.id = 'time-override-close';
    closeButton.style.marginTop = '8px';
    closeButton.style.width = '100%';
    closeButton.style.padding = '10px';
    closeButton.style.backgroundColor = '#9e9e9e';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '14px';
    closeButton.style.fontWeight = '500';
    closeButton.textContent = 'Close';
    container.appendChild(closeButton);

    // Add the container to the body
    document.body.appendChild(container);

    // Add event listeners
    applyButton.addEventListener('click', applyTimeOverride);
    resetButton.addEventListener('click', resetTimeOverride);
    closeButton.addEventListener('click', closeTimeOverrideWindow);

    // Set default values
    const now = new Date();
    dateInput.value = now.toISOString().split('T')[0];
    timeInput.value = now.toTimeString().split(' ')[0].substring(0, 5);
}

// Apply the time override
function applyTimeOverride() {
    const dateInput = document.getElementById('time-override-date');
    const timeInput = document.getElementById('time-override-time');

    if (dateInput && timeInput) {
        const dateValue = dateInput.value;
        const timeValue = timeInput.value;

        if (dateValue && timeValue) {
            const overrideDate = new Date(`${dateValue}T${timeValue}:00`);
            if (!isNaN(overrideDate.getTime())) {
                // Store the override time in localStorage
                localStorage.setItem('timeOverride', overrideDate.toISOString());

                // Update the display
                updateCurrentDatetimeDisplay();

                // Show a confirmation
                alert('Time override applied successfully!');
            } else {
                alert('Invalid date or time format.');
            }
        }
    }
}

// Reset to system time
function resetTimeOverride() {
    // Remove the override from localStorage
    localStorage.removeItem('timeOverride');

    // Update the display
    updateCurrentDatetimeDisplay();

    // Show a confirmation
    alert('Time override has been reset to system time.');
}

// Close the time override window
function closeTimeOverrideWindow() {
    const container = document.getElementById('time-override-container');
    if (container) {
        container.style.display = 'none';
    }
}

// Update the current datetime display
function updateCurrentDatetimeDisplay() {
    const datetimeElement = document.getElementById('current-datetime');
    if (datetimeElement) {
        const overrideTime = localStorage.getItem('timeOverride');
        if (overrideTime) {
            const overrideDate = new Date(overrideTime);
            datetimeElement.textContent = `Current time (OVERRIDDEN): ${overrideDate.toLocaleString()}`;
        } else {
            const now = new Date();
            datetimeElement.textContent = `Current time: ${now.toLocaleString()}`;
        }
    }
}

// Get the current time (with override if set)
function getCurrentTime() {
    const overrideTime = localStorage.getItem('timeOverride');
    if (overrideTime) {
        // Create a new Date directly from the string to avoid recursion
        // This works because Date.parse() is not overridden
        return new Date(Date.parse(overrideTime));
    }
    // Create a new Date with the current timestamp to avoid recursion
    return new Date(Date.now());
}

// Initialize the time override module
function initTimeOverride() {
    // Create the time override window
    createTimeOverrideWindow();

    // Update the display initially
    updateCurrentDatetimeDisplay();

    // Add a button to toggle the time override window
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-time-override';
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = '20px';
    toggleButton.style.right = '320px';
    toggleButton.style.zIndex = '10001';
    toggleButton.style.backgroundColor = '#2196F3';
    toggleButton.style.color = 'white';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '50%';
    toggleButton.style.width = '40px';
    toggleButton.style.height = '40px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    toggleButton.style.display = 'flex';
    toggleButton.style.alignItems = 'center';
    toggleButton.style.justifyContent = 'center';
    toggleButton.style.fontSize = '18px';
    toggleButton.textContent = '⏰';
    document.body.appendChild(toggleButton);

    // Add event listener to toggle the window
    toggleButton.addEventListener('click', () => {
        const container = document.getElementById('time-override-container');
        if (container) {
            container.style.display = container.style.display === 'none' ? 'block' : 'none';
        }
    });

    // Override the existing updateCurrentDatetime function
    const originalUpdateCurrentDatetime = window.updateCurrentDatetime;
    window.updateCurrentDatetime = function() {
        updateCurrentDatetimeDisplay();
        if (originalUpdateCurrentDatetime) {
            originalUpdateCurrentDatetime();
        }
    };

    // Override the Date constructor to use our custom time
    const originalDate = Date;
    window.Date = function(...args) {
        if (args.length === 0) {
            // If no arguments, return the overridden time
            return new originalDate(getCurrentTime());
        }
        // Otherwise, use the original Date constructor
        return new originalDate(...args);
    };

    // Copy static properties and methods
    window.Date.now = function() {
        const overrideTime = localStorage.getItem('timeOverride');
        if (overrideTime) {
            return new Date(overrideTime).getTime();
        }
        return originalDate.now();
    };

    window.Date.UTC = originalDate.UTC;
    window.Date.parse = originalDate.parse;
}

// Export the module
window.TimeOverride = {
    init: initTimeOverride,
    getCurrentTime: getCurrentTime
};

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initTimeOverride();
});
