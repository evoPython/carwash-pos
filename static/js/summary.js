// Global variables
let vehicles = [];
let orders = [];
let currentVehicleData = null;
let selectedDate = null;
let selectedShift = null;
let expenses = [];

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
    } catch (error) {
        console.error('Error loading vehicles:', error);
    }
}

// Load orders for a specific date and shift
async function loadOrders(date, shift) {
    try {
        const response = await fetch(`/api/orders?date=${date}&shift=${shift}`);
        orders = await response.json();

        const tbody = document.querySelector('#summaryOrdersTable tbody');
        tbody.innerHTML = '';

        orders.forEach(order => {
            const row = document.createElement('tr');
            const addonsText = order.addons.length > 0 ? order.addons.join(', ') : 'None';

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

        // Update summary after loading orders
        await loadShiftSummary(selectedDate, selectedShift);
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

// Load shift summary data
async function loadShiftSummary(date, shift) {
    try {
        const response = await fetch(`/api/shift_summary/${date}/${shift}`);
        const summaryData = await response.json();

        if (summaryData) {
            // Update summary details only if elements exist
            const totalGrossSalesElem = document.getElementById('totalGrossSales');
            const fortyXElem = document.getElementById('fortyX');
            const totalAddonsSalesElem = document.getElementById('totalAddonsSales');
            const totalOtherIncomeElem = document.getElementById('totalOtherIncome');
            const gcashAmountElem = document.getElementById('gcashAmount');
            const posPaymentAmountElem = document.getElementById('posPaymentAmount');
            const vacTotalElem = document.getElementById('vacTotal');
            const grandTotalElem = document.getElementById('grandTotal');

            if (totalGrossSalesElem) totalGrossSalesElem.textContent = `₱${Number(summaryData.total_gross_sales).toFixed(2)}`;
            if (fortyXElem) fortyXElem.textContent = `₱${Number(summaryData.forty_x).toFixed(2)}`;
            if (totalAddonsSalesElem) totalAddonsSalesElem.textContent = `₱${Number(summaryData.total_addons).toFixed(2)}`;
            if (totalOtherIncomeElem) totalOtherIncomeElem.textContent = `₱${Number(summaryData.total_other_income).toFixed(2)}`;
            if (gcashAmountElem) gcashAmountElem.textContent = `₱${Number(summaryData.gcash).toFixed(2)}`;
            if (posPaymentAmountElem) posPaymentAmountElem.textContent = `₱${Number(summaryData.pos_payment).toFixed(2)}`;
            if (vacTotalElem) vacTotalElem.textContent = `₱${Number(summaryData.total_vac).toFixed(2)}`;
            if (grandTotalElem) grandTotalElem.textContent = `₱${Number(summaryData.grand_total).toFixed(2)}`;

            // Update expenses and other income tables
            const totalExpenses = updateExpensesTable(summaryData.expenses || [], summaryData);
            const totalOtherIncome = updateOtherIncomeTable(summaryData.other_income || [], summaryData);

            // Use values directly from shift_summaries table
            const grossSales = Number(summaryData.total_gross_sales || 0);
            const fortyX = Number(summaryData.forty_x || 0);
            const addons = Number(summaryData.total_addons || 0);
            const otherIncome = Number(summaryData.total_other_income || 0);
            const expenses = Number(summaryData.total_expenses || 0);
            const grandTotal = Number(summaryData.grand_total || 0);

            // Update summary displays with values from shift_summaries
            if (totalGrossSalesElem) totalGrossSalesElem.textContent = `₱${grossSales.toFixed(2)}`;
            if (fortyXElem) fortyXElem.textContent = `₱${fortyX.toFixed(2)}`;
            document.getElementById('totalAddonsSalesSummary').textContent = `₱${addons.toFixed(2)}`;
            document.getElementById('totalOtherIncomeSummary').textContent = `₱${otherIncome.toFixed(2)}`;
            document.getElementById('totalExpensesDisplay').textContent = `₱${expenses.toFixed(2)}`;
            document.getElementById('grandTotal').textContent = `₱${grandTotal.toFixed(2)}`;

            // Display addon details
            displayAddonDetails(summaryData.addons);
        }
    } catch (error) {
        console.error('Error loading shift summary:', error);
    }
}

// Update expenses table
function updateExpensesTable(expenses, summaryData) {
    const tbody = document.querySelector('#expensesTable tbody');
    tbody.innerHTML = '';

    // Calculate total expenses
    let totalExpenses = 400.00; // Start with wages

    // Add POS payment if it exists
    const posPayment = Number(summaryData.pos_payment || 0);
    if (posPayment > 0) {
        totalExpenses += posPayment;
        const posRow = document.createElement('tr');
        posRow.innerHTML = `
            <td>POS Payment</td>
            <td>Payment via POS</td>
            <td>₱${posPayment.toFixed(2)}</td>
        `;
        tbody.appendChild(posRow);
    }

    // Add VAC if it exists
    const vac = Number(summaryData.total_vac || 0);
    if (vac > 0) {
        totalExpenses += vac;
        const vacRow = document.createElement('tr');
        vacRow.innerHTML = `
            <td>VAC</td>
            <td>VAC expenses</td>
            <td>₱${vac.toFixed(2)}</td>
        `;
        tbody.appendChild(vacRow);
    }

    // Add expenses from the array
    if (Array.isArray(expenses)) {
        expenses.forEach(expense => {
            const amount = Number(expense.amount || 0);
            totalExpenses += amount;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${expense.name || '-'}</td>
                <td>${expense.description || '-'}</td>
                <td>₱${amount.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Update total expenses display
    document.getElementById('totalExpenses').textContent = `₱${totalExpenses.toFixed(2)}`;
    document.getElementById('totalExpensesDisplay').textContent = `₱${totalExpenses.toFixed(2)}`;

    return totalExpenses;
}

// Update other income table
function updateOtherIncomeTable(otherIncome, summaryData) {
    const tbody = document.querySelector('#otherIncomeTable tbody');
    tbody.innerHTML = '';

    // Use total other income directly from shift_summaries
    const totalOtherIncome = Number(summaryData.total_other_income || 0);

    // Display individual other income items (if available)
    if (Array.isArray(otherIncome)) {
        otherIncome.forEach(income => {
            const amount = Number(income.amount || 0);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${income.name || '-'}</td>
                <td>${income.description || '-'}</td>
                <td>₱${amount.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Update total other income display
    const totalOtherIncomeDisplay = document.getElementById('totalOtherIncomeDisplay');
    const totalOtherIncomeSummary = document.getElementById('totalOtherIncomeSummary');

    if (totalOtherIncomeDisplay) totalOtherIncomeDisplay.textContent = `₱${totalOtherIncome.toFixed(2)}`;
    if (totalOtherIncomeSummary) totalOtherIncomeSummary.textContent = `₱${totalOtherIncome.toFixed(2)}`;

    return totalOtherIncome;
}

// Display addon details
function displayAddonDetails(addons) {
    const addonDetailsList = document.getElementById('addonDetailsList');
    addonDetailsList.innerHTML = '';

    for (const [addonName, totalPrice] of Object.entries(addons)) {
        const li = document.createElement('li');
        li.textContent = `${addonName} - ₱${Number(totalPrice).toFixed(2)}`;
        addonDetailsList.appendChild(li);
    }
}

// Load summary data for a specific date and shift
async function loadSummaryData(shift) {
    if (!selectedDate) return;

    selectedShift = shift;
    closeModal('shiftModal');

    // Show the summary results section
    document.getElementById('summaryResults').classList.remove('hidden');
    document.getElementById('selectedDateDisplay').textContent = `${selectedDate} (${shift} Shift)`;

    // Load data
    await loadOrders(selectedDate, shift);
    await loadShiftSummary(selectedDate, shift);
}

// Initialize calendar
function initializeCalendar() {
    const calendar = document.getElementById('calendar');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');

    // Populate month and year selectors
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index + 1;
        option.textContent = month;
        monthSelect.appendChild(option);
    });

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    // Set to current month and year
    const now = new Date();
    monthSelect.value = now.getMonth() + 1;
    yearSelect.value = now.getFullYear();

    // Generate calendar for current month
    generateCalendar(now.getMonth() + 1, now.getFullYear());

    // Add event listeners
    monthSelect.addEventListener('change', () => {
        generateCalendar(parseInt(monthSelect.value), parseInt(yearSelect.value));
    });

    yearSelect.addEventListener('change', () => {
        generateCalendar(parseInt(monthSelect.value), parseInt(yearSelect.value));
    });
}

// Generate calendar for a specific month and year
function generateCalendar(month, year) {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';

    // Get first day of month and total days
    const firstDay = new Date(year, month - 1, 1).getDay();
    const totalDays = new Date(year, month, 0).getDate();

    // Create calendar header
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.innerHTML = `
        <div class="calendar-day">Sun</div>
        <div class="calendar-day">Mon</div>
        <div class="calendar-day">Tue</div>
        <div class="calendar-day">Wed</div>
        <div class="calendar-day">Thu</div>
        <div class="calendar-day">Fri</div>
        <div class="calendar-day">Sat</div>
    `;
    calendar.appendChild(header);

    // Create calendar grid
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // Add empty cells for days before the first day
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-cell empty';
        grid.appendChild(emptyCell);
    }

    // Add days of the month
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        cell.textContent = day;
        cell.addEventListener('click', () => {
            selectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            document.getElementById('modalDateDisplay').textContent = selectedDate;
            openModal('shiftModal');
        });
        grid.appendChild(cell);
    }

    calendar.appendChild(grid);
}

// Tab switching functionality
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.getAttribute('data-tab');

            // Deactivate all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Activate clicked button and corresponding pane
            button.classList.add('active');
            document.getElementById(`${tab}Tab`).classList.add('active');
        });
    });
}

// Initialize monthly sales tab
function initializeMonthlySales() {
    const monthSelect = document.getElementById('monthlyMonthSelect');
    const yearSelect = document.getElementById('monthlyYearSelect');
    const loadButton = document.getElementById('loadMonthlySales');

    // Populate year selector
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    // Set to current month and year
    const now = new Date();
    monthSelect.value = now.getMonth() + 1;
    yearSelect.value = now.getFullYear();

    // Load sales button click
    loadButton.addEventListener('click', async () => {
        const month = parseInt(monthSelect.value);
        const year = parseInt(yearSelect.value);

        // Update display
        const monthName = monthSelect.options[monthSelect.selectedIndex].text;
        document.getElementById('monthlyMonthDisplay').textContent = `${monthName} ${year}`;

        // Load sales data
        await loadMonthlySales(month, year);
    });
}

// Load monthly sales data
async function loadMonthlySales(month, year) {
    try {
        const response = await fetch(`/api/monthly_sales?month=${month}&year=${year}`);
        const salesData = await response.json();

        const tbody = document.querySelector('#monthlySalesTable tbody');
        tbody.innerHTML = '';

        let total = 0;

        // Get all days in the month
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthSales = {};

        // Initialize all days with 0
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            monthSales[dateStr] = 0;
        }

        // Populate with actual sales data
        salesData.forEach(day => {
            monthSales[day.date] = Number(day.amount || 0);
        });

        // Display all days in the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const amount = monthSales[dateStr];
            total += amount;

            const row = document.createElement('tr');

            // Format date as "Month Day" (e.g., "September 15")
            const date = new Date(dateStr);
            const formattedDate = date.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric'
            });

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>₱${amount.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        }

        // Update total
        document.getElementById('monthlyTotal').textContent = `₱${total.toFixed(2)}`;
    } catch (error) {
        console.error('Error loading monthly sales:', error);
    }
}

// Initialize yearly sales tab
function initializeYearlySales() {
    const yearSelect = document.getElementById('yearlyYearSelect');
    const loadButton = document.getElementById('loadYearlySales');

    // Populate year selector
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    // Set to current year
    yearSelect.value = currentYear;

    // Load sales button click
    loadButton.addEventListener('click', async () => {
        const year = parseInt(yearSelect.value);

        // Update display
        document.getElementById('yearlyYearDisplay').textContent = year;

        // Load sales data
        await loadYearlySales(year);
    });
}

// Load yearly sales data
async function loadYearlySales(year) {
    try {
        const response = await fetch(`/api/yearly_sales?year=${year}`);
        const salesData = await response.json();

        const tbody = document.querySelector('#yearlySalesTable tbody');
        tbody.innerHTML = '';

        let total = 0;

        // Populate table with sales data
        salesData.forEach(month => {
            const row = document.createElement('tr');
            const amount = Number(month.amount || 0);
            total += amount;

            row.innerHTML = `
                <td>${month.month}</td>
                <td>₱${amount.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });

        // Update total
        document.getElementById('yearlyTotal').textContent = `₱${total.toFixed(2)}`;
    } catch (error) {
        console.error('Error loading yearly sales:', error);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    // Load initial data
    loadVehicles();

    // Initialize calendar
    initializeCalendar();

    // Initialize tabs
    initializeTabs();

    // Initialize monthly sales tab
    initializeMonthlySales();

    // Initialize yearly sales tab
    initializeYearlySales();

    // Modal close on outside click
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
        }
    });
});