document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const tableEl = document.getElementById("orders-table");
    const monthInput = document.getElementById("filter-month");
    const btnRefresh = document.getElementById("btn-refresh");
    const btnOpen = document.getElementById("btn-open-modal");
    const modal = document.getElementById("modal");
    const modalClose = document.getElementById("modal-close");
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
            { title: "No.", field: "id", width: 60 },
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
            updatePrice();
            calculateShares();
        });
    });

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
    window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };

    // Load orders & summary
    async function loadData() {
        const params = new URLSearchParams();
        // if (dateInput.value) params.set("date", dateInput.value);
        if (monthInput && monthInput.value) params.set("month", monthInput.value);

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

        // Get the current user's shift from the DOM
        const userShiftElement = document.getElementById("user-shift");
        if (!userShiftElement) {
            // If no shift info is available, don't show the timer
            const timerElement = document.getElementById("shift-timer");
            if (timerElement) timerElement.style.display = 'none';
            return;
        }

        const userShift = userShiftElement.textContent;

        // Check if current time is within the user's shift
        let isWithinShift = false;
        if (userShift === 'AM') {
            isWithinShift = currentHour >= 5 && currentHour < 17;
        } else if (userShift === 'PM') {
            isWithinShift = currentHour >= 17 || currentHour < 5;
        }

        // Show/hide elements based on shift
        const tableSection = document.querySelector('.table-section');
        const newOrderSection = document.querySelector('.new-order-section');
        const timerElement = document.getElementById("shift-timer");

        if (timerElement) {
            if (isWithinShift) {
                // Show elements during user's shift
                if (tableSection) tableSection.style.display = 'block';
                if (newOrderSection) newOrderSection.style.display = 'block';
                timerElement.textContent = `Your shift: ${userShift} (Active)`;
            } else {
                // Hide elements outside user's shift
                if (tableSection) tableSection.style.display = 'none';
                if (newOrderSection) newOrderSection.style.display = 'none';
                timerElement.textContent = `Your shift: ${userShift} (Inactive - Outside shift hours)`;
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
});
