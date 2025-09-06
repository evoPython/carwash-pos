// Global variables
let vehicles = [];
let orders = [];
let currentVehicleData = null;

function displayAddonDetails() {
    const addonDetailsList = document.getElementById('addonDetailsList');
    if (!addonDetailsList) return;

    addonDetailsList.innerHTML = '';

    // Collect all addons with their prices and order IDs
    const addonMap = {};

    orders.forEach((order, index) => {
        order.addons.forEach(addon => {
            // Find the vehicle that has this addon
            const vehicleWithAddon = vehicles.find(v => v.addons && v.addons[addon] !== undefined);
            const addonPrice = vehicleWithAddon ? vehicleWithAddon.addons[addon] : 0;
            const orderId = index + 1; // Using index as a simple order ID

            if (!addonMap[addon]) {
                addonMap[addon] = {
                    price: addonPrice,
                    orderIds: []
                };
            }

            // Only add if this order ID isn't already in the list
            if (!addonMap[addon].orderIds.includes(orderId)) {
                addonMap[addon].orderIds.push(orderId);
            }
        });
    });

    // Display each addon with its price and order IDs
    for (const [addonName, details] of Object.entries(addonMap)) {
        const li = document.createElement('li');
        const totalPrice = details.price * details.orderIds.length;
        //console.log(`Addon detail: ${addonName}, Total: ${totalPrice}, Orders: ${details.orderIds.join(', ')}`);
        li.textContent = `${addonName} - ₱${totalPrice.toFixed(2)} (Orders: ${details.orderIds.join(', ')})`;
        addonDetailsList.appendChild(li);
    }
}

// Time display
function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString();
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Load vehicles data
async function loadVehicles() {
    try {
        const response = await fetch('/api/vehicles');
        vehicles = await response.json();

        const select = document.getElementById('vehicleType');
        select.innerHTML = '<option value="">Select Vehicle Type</option>';

        vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = vehicle.vehicle_name;
            option.textContent = vehicle.vehicle_name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading vehicles:', error);
    }
}

// Load orders
async function loadOrders(isPeriodicUpdate = false) {
    try {
        const response = await fetch('/api/orders');
        let allOrders = await response.json();

        // Get current user info from the page
        const userFullName = document.querySelector('.dashboard-header p').textContent.split(', ')[1].split('!')[0];

        // Get the user's shift from the window object (set by the template)
        const userShift = window.currentUserShift;

        // Get current date and time
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0];

        // Filter orders based on the user's name, shift, and current date
        const filteredOrders = allOrders.filter(order => {
            const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
            return order.incharge_name === userFullName &&
                   order.shift === userShift &&
                   orderDate === currentDate;
        });

        // Log for debugging
        console.log('All orders:', allOrders);
        console.log('Filtered orders:', filteredOrders);
        console.log('Filter criteria:', { userFullName, userShift, currentDate });

        orders = filteredOrders;

        const tbody = document.querySelector('#ordersTable tbody');
        tbody.innerHTML = '';

        orders.forEach(order => {
            const row = document.createElement('tr');
            const addonsText = order.addons.length > 0 ? order.addons.join(', ') : 'None';
            const total = Number(order.base_price) + calculateAddonTotal(order.addons);

            row.innerHTML = `
                <td>${new Date(order.timestamp).toLocaleTimeString()}</td>
                <td>${order.plate_number}</td>
                <td>${order.vehicle_type}</td>
                <td>${order.base_service}</td>
                <td>₱${Number(order.base_price).toFixed(2)}</td>
                <td>${addonsText}</td>
                <td>${order.w_vac}</td>
                <td>₱${Number(order.sixb_shares).toFixed(2)}</td>
                <td>₱${Number(order.washer_shares).toFixed(2)}</td>
                <td>₱${Number(order.sss).toFixed(2)}</td>
                <td>₱${Number(order.vac).toFixed(2)}</td>
                <td>₱${Number(order.less_40).toFixed(2)}</td>
                <td>${order.washer_name || ''}</td>
                <td>${order.incharge_name || ''}</td>
            `;
            tbody.appendChild(row);
        });

        // Load expenses and other income data from shift_summaries
        await loadShiftSummaryData();

        // If this is the first load (not a periodic update), update the summary
        if (!isPeriodicUpdate) {
            updateSummary();
            updateShiftSummary();
        } else {
            console.log('Periodic update: updating summary');
            updateSummary();
            updateShiftSummary();
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

// Load expenses and other income data from shift_summaries
async function loadShiftSummaryData() {
    try {
        // Get current user info and shift date
        const userFullName = document.querySelector('.dashboard-header p').textContent.split(', ')[1].split('!')[0];
        const userShift = window.currentUserShift;
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0];

        // Fetch shift summary data
        const response = await fetch(`/api/shift_summary/${currentDate}/${userShift}`);
        const summaryData = await response.json();

        if (summaryData) {
            // Clear existing rows
            document.getElementById('otherIncomeList').innerHTML = '';
            document.getElementById('expensesList').innerHTML = '';

            // Load other income data
            if (summaryData.other_income && summaryData.other_income.length > 0) {
                summaryData.other_income.forEach(item => {
                    addIncomeExpenseRow('otherIncomeList', 'otherIncome', item);
                });
            } else {
                // Add default row if no data
                addIncomeExpenseRow('otherIncomeList', 'otherIncome');
            }

            // Load expenses data
            if (summaryData.expenses && summaryData.expenses.length > 0) {
                summaryData.expenses.forEach(item => {
                    addIncomeExpenseRow('expensesList', 'expense', item);
                });
            } else {
                // Add default row if no data
                addIncomeExpenseRow('expensesList', 'expense');
            }

            // Update totals
            updateGrandTotal();
        }
    } catch (error) {
        console.error('Error loading shift summary data:', error);
    }
}

// Modified addIncomeExpenseRow to accept data for pre-population
function addIncomeExpenseRow(containerId, type, data = null) {
    const container = document.getElementById(containerId);
    const row = document.createElement('tr');

    if (data) {
        row.innerHTML = `
            <td><input type="text" class="form-input" placeholder="Name" value="${data.name}" required></td>
            <td><input type="text" class="form-input" placeholder="Description" value="${data.description || ''}"></td>
            <td><input type="number" class="form-input amount-input" placeholder="Amount" value="${data.amount}" required></td>
            <td>
                <button class="btn btn-danger btn-small delete-row-btn">Delete</button>
            </td>
        `;
    } else {
        row.innerHTML = `
            <td><input type="text" class="form-input" placeholder="Name" required></td>
            <td><input type="text" class="form-input" placeholder="Description"></td>
            <td><input type="number" class="form-input amount-input" placeholder="Amount" required></td>
            <td>
                <button class="btn btn-danger btn-small delete-row-btn">Delete</button>
            </td>
        `;
    }

    container.appendChild(row);

    // Add event listener for the delete button
    row.querySelector('.delete-row-btn').addEventListener('click', function() {
        row.remove();
        updateGrandTotal();
        syncWithDatabase();
    });

    // Add event listener for amount input
    row.querySelector('.amount-input').addEventListener('input', function() {
        updateGrandTotal();
        syncWithDatabase();
    });

    // Focus on the first input
    if (!data) {
        row.querySelector('input').focus();
    }
}

// Show toast notification
function showToast(message, isError = false) {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        // Create toast container if it doesn't exist
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '1000';
        document.body.appendChild(toastContainer);

        // Add styles for toasts
        const style = document.createElement('style');
        style.textContent = `
            .toast {
                background: white;
                padding: 12px 16px;
                border-radius: 4px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 10px;
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.3s ease;
            }
            .toast.show {
                opacity: 1;
                transform: translateY(0);
            }
            .toast.error {
                background: #ffdddd;
                color: #d8000c;
            }
        `;
        document.head.appendChild(style);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.textContent = message;

    // Add to container
    toastContainer.appendChild(toast);

    // Show with animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Remove after timeout
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Update shift summary in the database
async function updateShiftSummary() {
    try {
        // Get other income and expenses data
        const otherIncomeData = getOtherIncomeData();
        const expensesData = getExpensesData();

        const response = await fetch('/api/update_summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                other_income: otherIncomeData,
                expenses: expensesData
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Shift summary updated successfully');
        } else {
            showToast(data.message || 'Failed to update shift summary', true);
        }
    } catch (error) {
        console.error('Error updating shift summary:', error);
        showToast('Error updating shift summary', true);
    }
}

// Calculate addon total
function calculateAddonTotal(addons) {
    if (!currentVehicleData) return 0;

    return addons.reduce((total, addon) => {
        // Find the vehicle that has this addon
        const vehicleWithAddon = vehicles.find(v => v.addons && v.addons[addon] !== undefined);
        const addonPrice = vehicleWithAddon ? vehicleWithAddon.addons[addon] : 0;
        console.log(`Addon: ${addon}, Price: ${addonPrice}, Vehicle: ${vehicleWithAddon ? vehicleWithAddon.vehicle_name : 'Not found'}`);
        return total + addonPrice;
    }, 0);
}

// Update summary
function updateSummary() {
    if (orders.length === 0) return;

    const totalGrossSales = orders.reduce((sum, order) => sum + Number(order.sixb_shares || 0), 0);
    const fortyX = orders.length * 40;

    // Calculate total addons sales
    let totalAddonsSales = 0;
    orders.forEach(order => {
        order.addons.forEach(addon => {
            // Find the vehicle that has this addon
            const vehicleWithAddon = vehicles.find(v => v.addons && v.addons[addon] !== undefined);
            if (vehicleWithAddon) {
                totalAddonsSales += vehicleWithAddon.addons[addon];
            }
        });
    });

    document.getElementById('totalGrossSales').textContent = `₱${totalGrossSales.toFixed(2)}`;
    document.getElementById('fortyX').textContent = `₱${fortyX.toFixed(2)}`;
    document.getElementById('totalAddonsSales').textContent = `₱${totalAddonsSales.toFixed(2)}`;

    console.log(`Total Addons Sales: ${totalAddonsSales}`);

    // Display addon details
    displayAddonDetails();

    console.log('Updating grand total');
    updateGrandTotal();
}

// Update grand total
function updateGrandTotal() {
    const totalGrossSales = parseFloat(document.getElementById('totalGrossSales').textContent.replace('₱', '')) || 0;
    const totalAddonsSales = parseFloat(document.getElementById('totalAddonsSales').textContent.replace('₱', '')) || 0;
    const posPayment = orders.length * 5;

    // Update POS Payment display
    document.getElementById('posPaymentAmount').textContent = `₱${posPayment.toFixed(2)}`;

    // Match the calculation from shift_summaries table
    const grandTotal = totalGrossSales + totalAddonsSales - 400 - posPayment;

    document.getElementById('grandTotal').textContent = `₱${grandTotal.toFixed(2)}`;
}

// Handle vehicle type change
function handleVehicleChange() {
    const vehicleType = document.getElementById('vehicleType').value;
    const servicesSection = document.getElementById('servicesSection');

    if (vehicleType) {
        currentVehicleData = vehicles.find(v => v.vehicle_name === vehicleType);

        if (currentVehicleData) {
            // Show services section
            servicesSection.classList.remove('hidden');

            // Populate base services
            const baseServicesDiv = document.getElementById('baseServices');
            baseServicesDiv.innerHTML = '';

            Object.keys(currentVehicleData.bases).forEach((serviceName, index) => {
                const service = currentVehicleData.bases[serviceName];
                const div = document.createElement('div');
                div.innerHTML = `
                    <label>
                        <input type="radio" name="baseService" value="${serviceName}"
                               data-price="${service.price}" data-vac="${service.vac}"
                               ${index === 0 ? 'checked' : ''}>
                        ${serviceName} - ₱${service.price}
                    </label>
                `;
                baseServicesDiv.appendChild(div);
            });

            // Populate addons
            const addonsDiv = document.getElementById('addonsList');
            addonsDiv.innerHTML = '';

            Object.keys(currentVehicleData.addons).forEach(addonName => {
                const price = currentVehicleData.addons[addonName];
                const div = document.createElement('div');
                div.innerHTML = `
                    <label>
                        <input type="checkbox" name="addons" value="${addonName}" data-price="${price}">
                        ${addonName} - ₱${price}
                    </label>
                `;
                addonsDiv.appendChild(div);
            });

            // Add event listeners
            document.querySelectorAll('input[name="baseService"]').forEach(radio => {
                radio.addEventListener('change', calculateOrderTotal);
            });

            document.querySelectorAll('input[name="addons"]').forEach(checkbox => {
                checkbox.addEventListener('change', calculateOrderTotal);
            });

            // Initial calculation
            calculateOrderTotal();
        }
    } else {
        servicesSection.classList.add('hidden');
    }
}

// Calculate order total and shares
function calculateOrderTotal() {
    const selectedBase = document.querySelector('input[name="baseService"]:checked');
    const selectedAddons = Array.from(document.querySelectorAll('input[name="addons"]:checked'));

    if (!selectedBase || !currentVehicleData) return;

    const basePrice = parseFloat(selectedBase.dataset.price);
    const hasVac = selectedBase.dataset.vac === 'true';

    // Set base price
    document.getElementById('basePrice').value = basePrice;

    // Set W/Vac checkbox
    const wVacCheckbox = document.getElementById('wVac');
    wVacCheckbox.checked = hasVac;
    wVacCheckbox.disabled = !hasVac;

    // Calculate shares
    const addons = selectedAddons.map(checkbox => checkbox.value);
    const shares = calculateShares(basePrice, addons);

    document.getElementById('sixbShares').value = shares.sixb_shares.toFixed(2);
    document.getElementById('washerShares').value = shares.washer_shares.toFixed(2);
}

// Calculate shares (client-side version)
function calculateShares(basePrice, addons) {
    const baseShares = { sixb: 0.7, washer: 0.3 };
    const addonShares = {
        'Wax': { sixb: 0.4, washer: 0.6 },
        'Buffing': { sixb: 0.5, washer: 0.5 },
        'Deep Cleaning': { sixb: 0.5, washer: 0.5 },
        'Engine Wash': { sixb: 0.5, washer: 0.5 }
    };

    // Base calculation (after less 40)
    const baseAfterDeduction = basePrice - 40;
    const sixbBase = baseAfterDeduction * baseShares.sixb;
    const washerBase = baseAfterDeduction * baseShares.washer;

    // Addon calculations
    let sixbAddons = 0;
    let washerAddons = 0;

    addons.forEach(addon => {
        const addonPrice = currentVehicleData.addons[addon] || 0;
        const shares = addonShares[addon] || { sixb: 0.5, washer: 0.5 };
        sixbAddons += addonPrice * shares.sixb;
        washerAddons += addonPrice * shares.washer;
    });

    return {
        sixb_shares: sixbBase + sixbAddons,
        washer_shares: washerBase + washerAddons
    };
}

// Submit new order
async function submitOrder(event) {
    event.preventDefault();

    const formData = new FormData(document.getElementById('newOrderForm'));
    const selectedBase = document.querySelector('input[name="baseService"]:checked');
    const selectedAddons = Array.from(document.querySelectorAll('input[name="addons"]:checked'));

    if (!selectedBase) {
        alert('Please select a base service');
        return;
    }

    console.log(formData);
    console.log(formData.get('vehicleType'));
    console.log(formData.get('washerName'));

    const orderData = {
        plate_number: formData.get('plateNumber'),
        vehicle_type: formData.get('vehicleType'),
        base_service: selectedBase.value,
        base_price: parseFloat(document.getElementById('basePrice').value),
        addons: selectedAddons.map(checkbox => checkbox.value),
        w_vac: document.getElementById('wVac').checked,
        washer_name: formData.get('washerName') || ''
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        });

        function displayAddonDetails() {
            const addonDetailsList = document.getElementById('addonDetailsList');
            addonDetailsList.innerHTML = '';

            // Collect all addons with their prices and order IDs
            const addonMap = {};

            orders.forEach((order, index) => {
                order.addons.forEach(addon => {
                    const addonPrice = currentVehicleData?.addons[addon] || 0;
                    const orderId = index + 1; // Using index as a simple order ID

                    if (!addonMap[addon]) {
                        addonMap[addon] = {
                            price: addonPrice,
                            orderIds: []
                        };
                    }

                    // Only add if this order ID isn't already in the list
                    if (!addonMap[addon].orderIds.includes(orderId)) {
                        addonMap[addon].orderIds.push(orderId);
                    }

                });
            });

            // Display each addon with its price and order IDs
            for (const [addonName, details] of Object.entries(addonMap)) {
                const li = document.createElement('li');
                li.textContent = `${addonName} - ₱${details.price.toFixed(2)} (Orders: ${details.orderIds.join(', ')})`;
                addonDetailsList.appendChild(li);
            }
        }

        if (response.ok) {
            closeModal('newOrderModal');
            document.getElementById('newOrderForm').reset();
            loadOrders();
        } else {
            alert('Error submitting order');
        }
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('Error submitting order');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    // Update time every second
    updateTime();
    setInterval(updateTime, 1000);

    // Load initial data
    loadVehicles().then(() => {
        // After vehicles are loaded, load orders
        loadOrders();

        // Set up periodic updates every 30 seconds
        setInterval(() => {
            console.log('Periodic update triggered');
            loadOrders(true); // Pass true for periodic updates
        }, 30000);
    });

    // Event listeners
    const newOrderBtn = document.getElementById('newOrderBtn');
    if (newOrderBtn) {
        newOrderBtn.addEventListener('click', () => openModal('newOrderModal'));
    }

    document.getElementById('vehicleType').addEventListener('change', handleVehicleChange);
    document.getElementById('newOrderForm').addEventListener('submit', submitOrder);

    // GCash amount change
    const gcashInput = document.getElementById('gcashAmount');
    if (gcashInput) {
        gcashInput.addEventListener('input', updateGrandTotal);
    }

    // Modal close on outside click
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
        }
    });

    // Add other income functionality
    const addOtherIncomeBtn = document.getElementById('addOtherIncomeBtn');
    if (addOtherIncomeBtn) {
        addOtherIncomeBtn.addEventListener('click', function() {
            addIncomeExpenseRow('otherIncomeList', 'otherIncome');
        });
    }

    // Add expense functionality
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener('click', function() {
            addIncomeExpenseRow('expensesList', 'expense');
        });
    }

    // Add event listener for manage vehicles button
    const manageVehiclesBtn = document.getElementById('manageVehiclesBtn');
    if (manageVehiclesBtn) {
        manageVehiclesBtn.addEventListener('click', function() {
            window.location.href = '/vehicles';
        });
    }
});

function addIncomeExpenseRow(containerId, type, data = null) {
    const container = document.getElementById(containerId);
    const row = document.createElement('tr');

    if (data) {
        row.innerHTML = `
            <td><input type="text" class="form-input" placeholder="Name" value="${data.name}" required></td>
            <td><input type="text" class="form-input" placeholder="Description" value="${data.description || ''}"></td>
            <td><input type="number" class="form-input amount-input" placeholder="Amount" value="${data.amount}" required></td>
            <td>
                <button class="btn btn-danger btn-small delete-row-btn">Delete</button>
            </td>
        `;
    } else {
        row.innerHTML = `
            <td><input type="text" class="form-input" placeholder="Name" required></td>
            <td><input type="text" class="form-input" placeholder="Description"></td>
            <td><input type="number" class="form-input amount-input" placeholder="Amount" required></td>
            <td>
                <button class="btn btn-danger btn-small delete-row-btn">Delete</button>
            </td>
        `;
    }

    container.appendChild(row);

    // Add event listener for the delete button
    row.querySelector('.delete-row-btn').addEventListener('click', function() {
        row.remove();
        updateGrandTotal();
        syncWithDatabase();
    });

    // Add event listener for amount input
    row.querySelector('.amount-input').addEventListener('input', function() {
        updateGrandTotal();
        syncWithDatabase();
    });

    // Focus on the first input
    if (!data) {
        row.querySelector('input').focus();
    }
}

async function syncWithDatabase() {
    try {
        const response = await fetch('/api/update_summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                other_income: getOtherIncomeData(),
                expenses: getExpensesData()
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Data synced successfully');
        } else {
            showToast(data.message || 'Failed to sync data', true);
        }
    } catch (error) {
        console.error('Error syncing with database:', error);
        showToast('Error syncing with database', true);
    }
}

function getOtherIncomeData() {
    const rows = document.querySelectorAll('#otherIncomeList tr');
    const data = [];

    rows.forEach(row => {
        const name = row.querySelector('input[placeholder="Name"]').value;
        const description = row.querySelector('input[placeholder="Description"]').value;
        const amount = parseFloat(row.querySelector('.amount-input').value) || 0;

        if (name && amount) {
            data.push({ name, description, amount });
        }
    });

    return data;
}

function getExpensesData() {
    const rows = document.querySelectorAll('#expensesList tr');
    const data = [];

    rows.forEach(row => {
        const name = row.querySelector('input[placeholder="Name"]').value;
        const description = row.querySelector('input[placeholder="Description"]').value;
        const amount = parseFloat(row.querySelector('.amount-input').value) || 0;

        if (name && amount) {
            data.push({ name, description, amount });
        }
    });

    return data;
}

function updateGrandTotal() {
    const totalGrossSales = parseFloat(document.getElementById('totalGrossSales').textContent.replace('₱', '')) || 0;
    const totalAddonsSales = parseFloat(document.getElementById('totalAddonsSales').textContent.replace('₱', '')) || 0;
    const posPayment = orders.length * 5;

    // Calculate VAC: number of orders with w_vac = 'yes' multiplied by 5
    const vacCount = orders.filter(order => order.w_vac === 'yes').length;
    const vacTotal = vacCount * 5;

    // Calculate total other income
    let totalOtherIncome = 0;
    document.querySelectorAll('#otherIncomeList .amount-input').forEach(input => {
        totalOtherIncome += parseFloat(input.value) || 0;
    });
    document.getElementById('totalOtherIncome').textContent = `₱${totalOtherIncome.toFixed(2)}`;

    // Calculate total expenses
    let totalExpenses = 0;
    document.querySelectorAll('#expensesList .amount-input').forEach(input => {
        totalExpenses += parseFloat(input.value) || 0;
    });

    // Update POS Payment display
    document.getElementById('posPaymentAmount').textContent = `₱${posPayment.toFixed(2)}`;

    // Update VAC display
    document.getElementById('vacTotal').textContent = `₱${vacTotal.toFixed(2)}`;

    // Calculate Grand Total according to the formula:
    // Grand Total = Total Gross Sales + 40x + Total Addons Sales + Other Income - Expenses - Wages - POS Payment - VAC
    const fortyX = orders.length * 40;
    const wages = 400; // Fixed wages
    const gcash = parseFloat(document.getElementById('gcashAmount').value) || 0;

    const grandTotal = totalGrossSales + fortyX + totalAddonsSales + totalOtherIncome - totalExpenses - wages - posPayment - vacTotal - gcash;

    document.getElementById('grandTotal').textContent = `₱${grandTotal.toFixed(2)}`;
}