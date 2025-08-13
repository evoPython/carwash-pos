document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const tableEl = document.getElementById("orders-table");
    const monthInput = document.getElementById("filter-month");
    const btnRefresh = document.getElementById("btn-refresh");
    const btnOpen = document.getElementById("btn-open-modal");
    const btnTemporary = document.getElementById("btn-temporary");
    const modal = document.getElementById("modal");
    const modalClose = document.getElementById("modal-close");
    const temporaryModal = document.getElementById("temporary-modal");
    const temporaryModalClose = document.getElementById("temporary-modal-close");
    const temporaryForm = document.getElementById("temporary-form");
    const form = document.getElementById("order-form");

    // New form elements
    const vehicleTypeSelect = document.getElementById("vehicle-type");
    const serviceTypeSelect = null; // Removed service type field
    const plateNoInput = document.getElementById("plate-no");
    const wVacCheckbox = document.getElementById("w-vac");
    const priceInput = document.getElementById("price");
    const less40Input = document.getElementById("less-40");
    const cSharesInput = document.getElementById("c-shares");
    const wShareInput = document.getElementById("w-share");
    const wNameInput = document.getElementById("w-name");
    const sssInput = document.getElementById("sss");

    // Addon checkboxes
    const addonCheckboxes = document.querySelectorAll('.addon-checkboxes input[type="checkbox"]');

    // Vehicle types data
    let vehicleTypes = {};

    // Initialize table variable
    let table;

    // Initialize table and load data
    if (tableEl) {
        initTable();
        loadData();
    }

    // Load vehicle types and initialize form
    loadVehicleTypes();

    // Initialize Tabulator
    function initTable() {
        const cols = [
            {
                title: "No.", field: "id", width: 60, formatter: function (cell) {
                    // Get the row index (1-based) from the row component
                    const rowIndex = cell.getRow().getPosition();
                    return rowIndex;
                }
            },
            { title: "Vehicle Name", field: "vehicle_name", width: 150 },
            { title: "Plate No.", field: "plate_no", width: 120 },
            { title: "W/Vac", field: "w_vac", width: 80 },
            { title: "Addons", field: "addons", width: 150 },
            { title: "Price", field: "price", formatter: "money", formatterParams: { symbol: "₱" }, width: 100 },
            { title: "Less 40", field: "less_40", formatter: "money", formatterParams: { symbol: "₱" }, width: 100 },
            { title: "C-Shares", field: "c_shares", formatter: "money", formatterParams: { symbol: "₱" }, width: 100 },
            { title: "W-Share", field: "w_share", formatter: "money", formatterParams: { symbol: "₱" }, width: 100 },
            { title: "W-Name", field: "w_name", width: 150 },
            { title: "SSS", field: "sss", formatter: "money", formatterParams: { symbol: "₱" }, width: 80 },
            { title: "Timestamp", field: "timestamp", width: 150 }
        ];
        table = new Tabulator(tableEl, { layout: "fitDataStretch", columns: cols });
    }

    // Load vehicle types from JSON
    async function loadVehicleTypes() {
        try {
            const response = await fetch('/static/dict/vehicle_types.json');
            vehicleTypes = await response.json();

            // Populate vehicle type dropdown
            if (vehicleTypeSelect) {
                Object.keys(vehicleTypes).forEach(vehicleType => {
                    const option = document.createElement('option');
                    option.value = vehicleType;
                    option.textContent = vehicleType;
                    vehicleTypeSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load vehicle types:', error);
        }
    }

    // Update addon services based on selected vehicle type
    function updateAddonServices() {
        const selectedVehicle = vehicleTypeSelect.value;
        const addonsContainer = document.querySelector('.addon-checkboxes');

        // Clear existing addon checkboxes
        addonsContainer.innerHTML = '';

        if (selectedVehicle && vehicleTypes[selectedVehicle]) {
            const services = vehicleTypes[selectedVehicle];

            // Create checkboxes for each addon service
            for (const [serviceName, servicePrice] of Object.entries(services)) {
                // Skip base services (Bodywash, Bodywash with Vacuum, Vacuum Only, Spray Only)
                if (['Bodywash', 'Bodywash with Vacuum', 'Vacuum Only', 'Spray Only'].includes(serviceName)) {
                    continue;
                }

                const label = document.createElement('label');
                label.className = 'checkbox-label';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = serviceName;
                checkbox.id = `addon-${serviceName.toLowerCase().replace(' ', '-')}`;

                // Add event listener for price update
                checkbox.addEventListener('change', updatePrice);

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${serviceName} (+₱${servicePrice})`));

                addonsContainer.appendChild(label);
            }
        }

        // Update the addonCheckboxes NodeList after modifying the DOM
        globalThis.addonCheckboxes = document.querySelectorAll('.addon-checkboxes input[type="checkbox"]');
    }

    // Update price based on selected vehicle, base service, and addons
    function updatePrice() {
        if (!vehicleTypeSelect || !priceInput) return;

        const selectedVehicle = vehicleTypeSelect.value;
        let basePrice = 0;

        // Get the selected base service from radio buttons
        const selectedBaseService = document.querySelector('input[name="base-service"]:checked');
        if (selectedBaseService) {
            const baseServiceName = selectedBaseService.value;
            if (selectedVehicle && vehicleTypes[selectedVehicle] && vehicleTypes[selectedVehicle][baseServiceName] !== undefined) {
                basePrice = vehicleTypes[selectedVehicle][baseServiceName];
            }
        }

        // Add addon prices
        let addonPrice = 0;
        const addonCheckboxes = document.querySelectorAll('.addon-checkboxes input[type="checkbox"]');
        addonCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                // Get the addon price from vehicleTypes data
                const addonName = checkbox.value;
                if (selectedVehicle && vehicleTypes[selectedVehicle] && vehicleTypes[selectedVehicle][addonName] !== undefined) {
                    addonPrice += vehicleTypes[selectedVehicle][addonName];
                } else {
                    // Fallback to extracting from label if not found in vehicleTypes
                    const label = checkbox.parentElement.textContent;
                    const priceMatch = label.match(/\+₱(\d+)/);
                    if (priceMatch) {
                        addonPrice += parseInt(priceMatch[1]);
                    }
                }
            }
        });

        const totalPrice = basePrice + addonPrice;
        priceInput.value = totalPrice;

        // Recalculate shares
        calculateShares();
    }

    // Define price share percentages for each add-on
    const addonShares = {
        'Bodywash': { cetadcco: 0.7, washer: 0.3 },
        'Bodywash with Vacuum': { cetadcco: 0.7, washer: 0.3 },
        'Wax': { cetadcco: 0.4, washer: 0.6 },
        'Buffing': { cetadcco: 0.5, washer: 0.5 },
        'Deep Cleaning': { cetadcco: 0.5, washer: 0.5 },
        'Engine Wash': { cetadcco: 0.5, washer: 0.5 },
        'Seat Cover': { cetadcco: 0.4, washer: 0.6 },
        'Vacuum Only': { cetadcco: 0.7, washer: 0.3 },
        'Spray Only': { cetadcco: 0.7, washer: 0.3 }
    };

    // Calculate shares based on price, VAC selection, and selected services
    function calculateShares() {
        const price = parseFloat(priceInput.value) || 0;
        const wVac = wVacCheckbox ? wVacCheckbox.checked : false;
        const vacDeduction = wVac ? 5 : 0;

        // LESS 40 is always 40
        const less40 = 40;

        // Initialize shares
        let cetadccoShare = 0;
        let washerShare = 0;

        // Get selected base service
        const selectedBaseService = document.querySelector('input[name="base-service"]:checked');
        if (selectedBaseService) {
            const baseServiceName = selectedBaseService.value;
            const selectedVehicle = vehicleTypeSelect.value;

            if (selectedVehicle && vehicleTypes[selectedVehicle] && vehicleTypes[selectedVehicle][baseServiceName] !== undefined) {
                const basePrice = vehicleTypes[selectedVehicle][baseServiceName];

                // Apply share percentages for base service (after subtracting 40)
                if (addonShares[baseServiceName]) {
                    cetadccoShare += (basePrice - less40) * addonShares[baseServiceName].cetadcco;
                    washerShare += (basePrice - less40) * addonShares[baseServiceName].washer;
                }
            }
        }

        // Get selected addons
        const selectedAddons = [];
        const addonCheckboxes = document.querySelectorAll('.addon-checkboxes input[type="checkbox"]');
        addonCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedAddons.push(checkbox.value);
            }
        });

        // Calculate shares for addons (full price, no less 40 deduction)
        selectedAddons.forEach(addon => {
            if (addonShares[addon]) {
                const addonPrice = getAddonPrice(addon);
                cetadccoShare += addonPrice * addonShares[addon].cetadcco;
                washerShare += addonPrice * addonShares[addon].washer;
            }
        });

        // Apply deductions
        const totalCetadccoShare = cetadccoShare;
        const totalWasherShare = washerShare - 2 - vacDeduction; // 2 is for SSS

        if (cSharesInput) cSharesInput.value = totalCetadccoShare.toFixed(2);
        if (wShareInput) wShareInput.value = totalWasherShare.toFixed(2);
    }

    // Helper function to get addon price
    function getAddonPrice(addonName) {
        const selectedVehicle = vehicleTypeSelect.value;
        if (selectedVehicle && vehicleTypes[selectedVehicle] && vehicleTypes[selectedVehicle][addonName] !== undefined) {
            return vehicleTypes[selectedVehicle][addonName];
        }
        return 0;
    }

    // Add event listeners for form updates
    if (vehicleTypeSelect) {
        vehicleTypeSelect.addEventListener("change", () => {
            updatePrice();
            updateAddonServices();
        });
    }
    if (wVacCheckbox) wVacCheckbox.addEventListener("change", calculateShares);

    // Add event listeners for addon checkboxes
    addonCheckboxes.forEach(checkbox => {
        checkbox.addEventListener("change", updatePrice);
    });

    // Add event listeners for base service radio buttons
    const baseServiceRadios = document.querySelectorAll('input[name="base-service"]');
    baseServiceRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            updateWVacSwitch();
            updatePrice();
            calculateShares();
        });
    });

    // Function to update w/vac switch based on selected base service
    function updateWVacSwitch() {
        const selectedBaseService = document.querySelector('input[name="base-service"]:checked');
        if (!selectedBaseService) return;

        const baseServiceName = selectedBaseService.value;
        const isVacuumService = baseServiceName === 'Bodywash with Vacuum' || baseServiceName === 'Vacuum Only';

        if (wVacCheckbox) {
            wVacCheckbox.checked = isVacuumService;
            wVacCheckbox.disabled = isVacuumService;

            // If it's not a vacuum service, enable the checkbox
            if (!isVacuumService) {
                wVacCheckbox.disabled = false;
            }
        }
    }

    // Modal
    btnOpen.onclick = () => {
        modal.style.display = "flex";
        // Center the modal content
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.margin = '0 auto';
        }
    };
    modalClose.onclick = () => modal.style.display = "none";

    // Temporary Button Modal
    if (btnTemporary) {
        btnTemporary.onclick = () => {
            temporaryModal.style.display = "flex";
            // Center the modal content
            const tempModalContent = temporaryModal.querySelector('.modal-content');
            if (tempModalContent) {
                tempModalContent.style.margin = '0 auto';
            }
        };
    }
    if (temporaryModalClose) {
        temporaryModalClose.onclick = () => temporaryModal.style.display = "none";
    }
    window.onclick = e => {
        if (e.target === modal) modal.style.display = "none";
        if (e.target === temporaryModal) temporaryModal.style.display = "none";
    };

    // Load orders & summary
    async function loadData() {
        const params = new URLSearchParams();
        // if (dateInput.value) params.set("date", dateInput.value);
        if (monthInput && monthInput.value) params.set("month", monthInput.value);

        // Check if the current shift is active
        const userShiftElement = document.getElementById("user-shift");
        const userRoleElement = document.querySelector(".user-role");

        // Debug log
        if (userRoleElement) {
            console.log("User role:", userRoleElement.textContent);
        } else {
            console.log("User role element not found");
        }

        // If user is admin or developer, always load data
        if (userRoleElement && (userRoleElement.textContent === 'Admin' || userRoleElement.textContent === 'Developer')) {
            try {
                // Fetch orders first
                const oRes = await fetch('/api/orders?' + params);
                if (!oRes.ok) {
                    console.error('Orders fetch failed:', oRes.status);
                    return;
                }
                const orders = await oRes.json();
                const rows = orders.map(o => ({ ...o, addons: typeof o.addons === 'object' ? JSON.stringify(o.addons) : o.addons || '' }));
                table.clearData();
                table.setData(rows);

                // Only load summary if user has permission (admin/dev)
                if (document.getElementById("sum-income")) {
                    const sRes = await fetch('/api/summary?' + params);
                    const summary = await sRes.json();

                    // document.getElementById("sum-income").textContent = `₱${summary.income.toFixed(2)}`;
                    // document.getElementById("sum-expenses").textContent = `₱${summary.expenses.toFixed(2)}`;
                    // document.getElementById("sum-cetadcco").textContent = `₱${summary.cetadcco_share.toFixed(2)}`;
                    // document.getElementById("sum-carwasher").textContent = `₱${summary.carwasher_share.toFixed(2)}`;

                    const net = summary.income
                        - summary.expenses
                        - summary.cetadcco_share
                        - summary.carwasher_share;
                    // document.getElementById("sum-net").textContent = `₱${net.toFixed(2)}`;
                }
            } catch (error) {
                console.error("Error loading data:", error);
            }
            return;
        }

        // For regular users, check shift status
        if (!userShiftElement) {
            console.error("User shift information not available");
            return;
        }

        const userShift = userShiftElement.textContent;
        const now = new Date();
        const currentHour = now.getHours();

        // Check if current time is within the user's shift
        let isWithinShift = false;
        if (userShift === 'AM') {
            isWithinShift = currentHour >= 5 && currentHour < 17;
        } else if (userShift === 'PM') {
            isWithinShift = currentHour >= 17 || currentHour < 5;
        }

        // Only load data if the shift is active
        if (!isWithinShift) {
            console.log("Current shift is inactive. Not loading orders.");
            return;
        }

        try {
            // Fetch orders first
            const oRes = await fetch('/api/orders?' + params);
            if (!oRes.ok) {
                console.error('Orders fetch failed:', oRes.status);
                return;
            }
            const orders = await oRes.json();
            const rows = orders.map(o => ({ ...o, addons: typeof o.addons === 'object' ? JSON.stringify(o.addons) : o.addons || '' }));
            table.clearData();
            table.setData(rows);

            // Only load summary if user has permission (admin/dev)
            if (document.getElementById("sum-income")) {
                const sRes = await fetch('/api/summary?' + params);
                const summary = await sRes.json();

                // document.getElementById("sum-income").textContent = `₱${summary.income.toFixed(2)}`;
                // document.getElementById("sum-expenses").textContent = `₱${summary.expenses.toFixed(2)}`;
                // document.getElementById("sum-cetadcco").textContent = `₱${summary.cetadcco_share.toFixed(2)}`;
                // document.getElementById("sum-carwasher").textContent = `₱${summary.carwasher_share.toFixed(2)}`;

                const net = summary.income
                    - summary.expenses
                    - summary.cetadcco_share
                    - summary.carwasher_share;
                // document.getElementById("sum-net").textContent = `₱${net.toFixed(2)}`;
            }
        } catch (error) {
            console.error("Error loading data:", error);
        }
    }

    if (btnRefresh) btnRefresh.addEventListener("click", loadData);

    // Load previous shift data
    async function loadPreviousShiftData() {
        try {
            const response = await fetch('/api/previous-shift-orders');
            if (!response.ok) {
                console.error('Previous shift orders fetch failed:', response.status);
                return;
            }
            const orders = await response.json();
            const rows = orders.map(o => ({ ...o, addons: typeof o.addons === 'object' ? JSON.stringify(o.addons) : o.addons || '' }));
            table.clearData();
            table.setData(rows);
        } catch (error) {
            console.error("Error loading previous shift data:", error);
        }
    }

    // Submit new order
    if (form) {
        form.addEventListener("submit", async e => {
            e.preventDefault();

            // Get selected addons
            const selectedAddons = [];
            const addonCheckboxes = document.querySelectorAll('.addon-checkboxes input[type="checkbox"]');

            addonCheckboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    selectedAddons.push(checkbox.value);
                }
            });

            // Get selected base service
            const selectedBaseService = document.querySelector('input[name="base-service"]:checked');
            const baseService = selectedBaseService ? selectedBaseService.value : '';

            const vehicleName = vehicleTypeSelect ? vehicleTypeSelect.value : '';
            const combinedVehicleName = vehicleName;

            const payload = {
                vehicle_name: combinedVehicleName,
                plate_no: plateNoInput ? plateNoInput.value : '',
                w_vac: wVacCheckbox ? (wVacCheckbox.checked ? 'Yes' : 'No') : 'No',
                addons: selectedAddons.join(', '),
                base_service: baseService,
                price: parseFloat(priceInput ? priceInput.value : 0),
                c_shares: parseFloat(cSharesInput ? cSharesInput.value : 0),
                w_share: parseFloat(wShareInput ? wShareInput.value : 0),
                w_name: wNameInput ? wNameInput.value : ''
            };

            const r = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (r.ok) {
                form.reset();
                modal.style.display = "none";
                loadData(); // Refresh the table data
                // Reset calculated fields and dropdowns
                if (cSharesInput) cSharesInput.value = '';
                if (wShareInput) wShareInput.value = '';
                if (serviceTypeSelect) {
                    serviceTypeSelect.innerHTML = '<option value="" disabled selected>Choose service</option>';
                }
                if (priceInput) priceInput.value = '';
            } else {
                const error = await r.json();
                alert("Failed to add order: " + (error.error || "Unknown error"));
            }
        });
    }

    // Shift timer functionality
    function updateShiftTimer() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();

        // Get the current user's shift from the DOM
        const userShiftElement = document.getElementById("user-shift");
        if (!userShiftElement) {
            // If no shift info is available, don't show the timer
            const timerElement = document.getElementById("shift-timer");
            if (timerElement) timerElement.style.display = 'none';
            return;
        }

        const userShift = userShiftElement.textContent;
        const userRoleElement = document.querySelector(".user-role");

        // Check if current time is within the user's shift
        let isWithinShift = false;
        if (userShift === 'AM') {
            isWithinShift = currentHour >= 5 && currentHour < 17;
        } else if (userShift === 'PM') {
            isWithinShift = currentHour >= 17 || currentHour < 5;
        }

        // Special logic for InCharges - show temporary button 30 minutes before shift ends
        let showTemporaryButton = false;
        if (userRoleElement && userRoleElement.textContent === 'Incharge' && userShift === 'AM') {
            // For AM shift, show from 4:30 PM to 5:00 PM
            showTemporaryButton = (currentHour === 16 && currentMinutes >= 30) || (currentHour === 17 && currentMinutes === 0);
        } else if (userRoleElement && userRoleElement.textContent === 'Incharge' && userShift === 'PM') {

            showTemporaryButton = (currentHour === 4 && currentMinutes >= 30 || (currentHour === 5 && currentMinutes === 0));
        }

        // Show/hide elements based on shift and time
        const tableSection = document.querySelector('.table-section');
        const newOrderSection = document.querySelector('.new-order-section');
        const timerElement = document.getElementById("shift-timer");
        const previousShiftHeader = document.getElementById("previous-shift-header");
        const btnTemporary = document.getElementById("btn-temporary");
        const btnOpen = document.getElementById("btn-open-modal");

        if (timerElement) {
            if (isWithinShift) {
                // Show elements during user's shift
                if (tableSection) tableSection.style.display = 'block';
                if (newOrderSection) newOrderSection.style.display = 'block';
                timerElement.textContent = `Your shift: ${userShift} (Active)`;

                // Hide previous shift header for active shifts
                if (previousShiftHeader) previousShiftHeader.style.display = 'none';

                // Handle button visibility for InCharges
                if (userRoleElement && userRoleElement.textContent === 'Incharge') {
                    // Show temporary button 30 minutes before shift ends
                    if (showTemporaryButton) {
                        if (btnTemporary) btnTemporary.style.display = 'inline-block';
                    } else {
                        if (btnTemporary) btnTemporary.style.display = 'inline-block';
                    }

                    // Handle button visibility based on shift and time
                    if (userShift === 'AM') {
                        // Hide both buttons after 5:00 PM
                        if (currentHour >= 17) {
                            if (btnTemporary) btnTemporary.style.display = 'none';
                            if (btnOpen) btnOpen.style.display = 'none';
                        }
                        // Show btnOpen at 5:00 AM
                        else if (currentHour === 5) {
                            if (btnOpen) btnOpen.style.display = 'inline-block';
                            if (btnTemporary) btnTemporary.style.display = 'none';
                        }
                        // Show btnTemporary at 4:30 PM
                        else if ((currentHour === 16 && currentMinutes >= 30) || (currentHour === 17 && currentMinutes === 0)) {
                            if (btnTemporary) btnTemporary.style.display = 'inline-block';
                            if (btnOpen) btnOpen.style.display = 'none';
                        }
                    } else if (userShift === 'PM') {
                        // Hide both buttons after 5:00 AM
                        if (currentHour >= 5 && currentHour < 17) {
                            if (btnTemporary) btnTemporary.style.display = 'none';
                            if (btnOpen) btnOpen.style.display = 'none';
                        }
                        // Show btnOpen at 5:00 PM
                        else if (currentHour === 17) {
                            if (btnOpen) btnOpen.style.display = 'inline-block';
                            if (btnTemporary) btnTemporary.style.display = 'none';
                        }
                        // Show btnTemporary at 4:30 AM
                        else if ((currentHour === 4 && currentMinutes >= 30) || (currentHour === 5 && currentMinutes === 0)) {
                            if (btnTemporary) btnTemporary.style.display = 'inline-block';
                            if (btnOpen) btnOpen.style.display = 'none';
                        }
                    }
                }

                // Load current shift data
                if (tableEl) {
                    loadData();
                }
            } else {
                // Hide new order section but show table for previous shift
                if (newOrderSection) newOrderSection.style.display = 'none';
                if (tableSection) tableSection.style.display = 'block';
                timerElement.textContent = `Your shift: ${userShift} (Inactive - Outside shift hours)`;

                // Show previous shift header only for Incharges with inactive shifts
                if (previousShiftHeader && userRoleElement && userRoleElement.textContent === 'Incharge') {
                    previousShiftHeader.style.display = 'block';
                } else if (previousShiftHeader) {
                    previousShiftHeader.style.display = 'none';
                }

                // Load previous shift data
                if (tableEl) {
                    loadPreviousShiftData();
                }
            }
            timerElement.style.display = 'block';
        }
    }

    // Update timer every second
    setInterval(updateShiftTimer, 1000);
    updateShiftTimer(); // Initial call

    // Update current datetime every second
    function updateCurrentDatetime() {
        const now = new Date();
        const datetimeElement = document.getElementById("current-datetime");
        if (datetimeElement) {
            datetimeElement.textContent = `Current time: ${now.toLocaleString()}`;
        }
    }

    // Update current datetime every second
    setInterval(updateCurrentDatetime, 1000);
    updateCurrentDatetime(); // Initial call
    // Other Income functionality
    const addOtherIncomeBtn = document.getElementById('add-other-income');
    const otherIncomeDropdown = document.getElementById('other-income-dropdown');
    const otherIncomeContainer = document.createElement('div');
    otherIncomeContainer.id = 'other-income-container';
    otherIncomeContainer.className = 'form-row';

    // Insert the container after the dropdown
    if (otherIncomeDropdown) {
        otherIncomeDropdown.parentNode.insertBefore(otherIncomeContainer, otherIncomeDropdown.nextSibling);
    }

    if (addOtherIncomeBtn) {
        addOtherIncomeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            otherIncomeDropdown.style.display = otherIncomeDropdown.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Handle dropdown item selection
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('dropdown-item')) {
            e.preventDefault();
            e.stopPropagation();
            const selectedValue = e.target.getAttribute('data-value');
            addOtherIncomeItem(selectedValue);
            otherIncomeDropdown.style.display = 'none';
        } else if (!addOtherIncomeBtn.contains(e.target) && !otherIncomeDropdown.contains(e.target)) {
            otherIncomeDropdown.style.display = 'none';
        }
    });

    function addOtherIncomeItem(name) {
        // Create a new row for the other income item
        const itemDiv = document.createElement('div');
        itemDiv.className = 'other-income-item';

        const label = document.createElement('label');
        label.textContent = name;

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '0.01';
        input.placeholder = 'Amount';

        itemDiv.appendChild(label);
        itemDiv.appendChild(input);
        otherIncomeContainer.appendChild(itemDiv);
    }

    // Expenses functionality
    const addExpenseBtn = document.getElementById('add-expense');
    const expensesTable = document.getElementById('expenses-table').querySelector('tbody');

    if (addExpenseBtn) {
        addExpenseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addExpenseRow();
        });
    }

    function addExpenseRow() {
        const row = document.createElement('tr');

        // Name column
        const nameCell = document.createElement('td');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Name';
        nameCell.appendChild(nameInput);

        // Description column
        const descCell = document.createElement('td');
        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.placeholder = 'Description';
        descCell.appendChild(descInput);

        // Amount column
        const amountCell = document.createElement('td');
        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.min = '0';
        amountInput.step = '0.01';
        amountInput.placeholder = 'Amount';
        amountCell.appendChild(amountInput);

        // Action column (delete button)
        const actionCell = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'btn-secondary';
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            row.remove();
        });
        actionCell.appendChild(deleteBtn);

        // Append all cells to the row
        row.appendChild(nameCell);
        row.appendChild(descCell);
        row.appendChild(amountCell);
        row.appendChild(actionCell);

        // Add the row to the table
        expensesTable.appendChild(row);
    }
});