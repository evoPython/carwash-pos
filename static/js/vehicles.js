let vehicles = [];
let editingVehicleId = null;

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Load vehicles
async function loadVehicles() {
    try {
        const response = await fetch('/api/vehicles');
        vehicles = await response.json();
        displayVehicles();
    } catch (error) {
        console.error('Error loading vehicles:', error);
    }
}

// Display vehicles
function displayVehicles() {
    const container = document.getElementById('vehiclesList');
    container.innerHTML = '';

    vehicles.forEach(vehicle => {
        const vehicleCard = document.createElement('div');
        vehicleCard.className = 'card mb-24';

        const baseServicesHTML = Object.entries(vehicle.bases).map(([name, data]) =>
            `<li>${name} - ₱${data.price} ${data.vac ? '(with vac)' : ''}</li>`
        ).join('');

        const addonsHTML = Object.entries(vehicle.addons).map(([name, price]) =>
            `<li>${name} - ₱${price}</li>`
        ).join('');

        vehicleCard.innerHTML = `
            <div class="card-header">
                <div class="flex justify-between items-center">
                    <h3>${vehicle.vehicle_name}</h3>
                    <div class="flex gap-8">
                        <button class="btn btn-secondary btn-small" onclick="editVehicle('${vehicle.vehicle_name}')">Edit</button>
                        <button class="btn btn-error btn-small" onclick="deleteVehicle('${vehicle.vehicle_name}')">Delete</button>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="grid grid-cols-2 gap-24">
                    <div>
                        <h4>Base Services</h4>
                        <ul>${baseServicesHTML}</ul>
                    </div>
                    <div>
                        <h4>Addons</h4>
                        <ul>${addonsHTML}</ul>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(vehicleCard);
    });
}

// Show add vehicle modal
function showAddVehicleModal() {
    document.getElementById('modalTitle').textContent = 'Add Vehicle Type';
    document.getElementById('vehicleForm').reset();
    document.getElementById('vehicleId').value = '';
    editingVehicleId = null;

    // Reset service and addon lists to one item each
    resetServicesList();
    resetAddonsList();

    openModal('vehicleModal');
}

// Reset services list
function resetServicesList() {
    const container = document.getElementById('baseServicesList');
    container.innerHTML = `
        <div class="service-item">
            <input type="text" placeholder="Service name" class="form-input service-name" required>
            <input type="number" placeholder="Price" class="form-input service-price" required>
            <label>
                <input type="checkbox" class="service-vac"> With Vacuum
            </label>
            <button type="button" class="btn btn-error btn-small" onclick="removeServiceItem(this)">Remove</button>
        </div>
    `;
}

// Reset addons list
function resetAddonsList() {
    const container = document.getElementById('addonsList');
    container.innerHTML = `
        <div class="addon-item">
            <input type="text" placeholder="Addon name" class="form-input addon-name" required>
            <input type="number" placeholder="Price" class="form-input addon-price" required>
            <button type="button" class="btn btn-error btn-small" onclick="removeAddonItem(this)">Remove</button>
        </div>
    `;
}

// Add base service item
function addBaseServiceItem() {
    const container = document.getElementById('baseServicesList');
    const div = document.createElement('div');
    div.className = 'service-item';
    div.innerHTML = `
        <input type="text" placeholder="Service name" class="form-input service-name" required>
        <input type="number" placeholder="Price" class="form-input service-price" required>
        <label>
            <input type="checkbox" class="service-vac"> With Vacuum
        </label>
        <button type="button" class="btn btn-error btn-small" onclick="removeServiceItem(this)">Remove</button>
    `;
    container.appendChild(div);
}

// Add addon item
function addAddonItem() {
    const container = document.getElementById('addonsList');
    const div = document.createElement('div');
    div.className = 'addon-item';
    div.innerHTML = `
        <input type="text" placeholder="Addon name" class="form-input addon-name" required>
        <input type="number" placeholder="Price" class="form-input addon-price" required>
        <button type="button" class="btn btn-error btn-small" onclick="removeAddonItem(this)">Remove</button>
    `;
    container.appendChild(div);
}

// Remove service item
function removeServiceItem(button) {
    const container = document.getElementById('baseServicesList');
    if (container.children.length > 1) {
        button.parentElement.remove();
    }
}

// Remove addon item
function removeAddonItem(button) {
    const container = document.getElementById('addonsList');
    if (container.children.length > 1) {
        button.parentElement.remove();
    }
}

// Edit vehicle
function editVehicle(vehicleName) {
    const vehicle = vehicles.find(v => v.vehicle_name === vehicleName);
    if (!vehicle) return;

    document.getElementById('modalTitle').textContent = 'Edit Vehicle Type';
    document.getElementById('vehicleName').value = vehicle.vehicle_name;
    editingVehicleId = vehicleName;

    // Populate base services
    const baseContainer = document.getElementById('baseServicesList');
    baseContainer.innerHTML = '';

    Object.entries(vehicle.bases).forEach(([name, data]) => {
        const div = document.createElement('div');
        div.className = 'service-item';
        div.innerHTML = `
            <input type="text" placeholder="Service name" class="form-input service-name" value="${name}" required>
            <input type="number" placeholder="Price" class="form-input service-price" value="${data.price}" required>
            <label>
                <input type="checkbox" class="service-vac" ${data.vac ? 'checked' : ''}> With Vacuum
            </label>
            <button type="button" class="btn btn-error btn-small" onclick="removeServiceItem(this)">Remove</button>
        `;
        baseContainer.appendChild(div);
    });

    // Populate addons
    const addonContainer = document.getElementById('addonsList');
    addonContainer.innerHTML = '';

    Object.entries(vehicle.addons).forEach(([name, price]) => {
        const div = document.createElement('div');
        div.className = 'addon-item';
        div.innerHTML = `
            <input type="text" placeholder="Addon name" class="form-input addon-name" value="${name}" required>
            <input type="number" placeholder="Price" class="form-input addon-price" value="${price}" required>
            <button type="button" class="btn btn-error btn-small" onclick="removeAddonItem(this)">Remove</button>
        `;
        addonContainer.appendChild(div);
    });

    openModal('vehicleModal');
}

// Delete vehicle
async function deleteVehicle(vehicleName) {
    if (!confirm('Are you sure you want to delete this vehicle type?')) return;

    try {
        const response = await fetch('/api/vehicles/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ vehicle_name: vehicleName })
        });

        if (response.ok) {
            loadVehicles();
        } else {
            const error = await response.json();
            alert(error.message || 'Error deleting vehicle');
        }
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        alert('Error deleting vehicle');
    }
}

// Submit vehicle form
async function submitVehicleForm(event) {
    event.preventDefault();

    const vehicleName = document.getElementById('vehicleName').value;

    // Collect base services
    const bases = {};
    const serviceItems = document.querySelectorAll('.service-item');
    serviceItems.forEach(item => {
        const name = item.querySelector('.service-name').value;
        const price = parseFloat(item.querySelector('.service-price').value);
        const vac = item.querySelector('.service-vac').checked;

        if (name && !isNaN(price)) {
            bases[name] = { price, vac };
        }
    });

    // Collect addons
    const addons = {};
    const addonItems = document.querySelectorAll('.addon-item');
    addonItems.forEach(item => {
        const name = item.querySelector('.addon-name').value;
        const price = parseFloat(item.querySelector('.addon-price').value);

        if (name && !isNaN(price)) {
            addons[name] = price;
        }
    });

    const vehicleData = {
        vehicle_name: vehicleName,
        bases,
        addons
    };

    const method = editingVehicleId ? 'POST' : 'POST';
    const url = editingVehicleId ? '/api/vehicles/edit' : '/api/vehicles';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(vehicleData)
        });

        if (response.ok) {
            closeModal('vehicleModal');
            loadVehicles();
        } else {
            const error = await response.json();
            alert(error.message || 'Error saving vehicle');
        }
    } catch (error) {
        console.error('Error saving vehicle:', error);
        alert('Error saving vehicle');
    }
}

// Add CSS for form items
const vehicleStyles = `
<style>
.service-item, .addon-item {
    display: grid;
    grid-template-columns: 1fr 100px auto auto;
    gap: 8px;
    margin-bottom: 8px;
    align-items: center;
}

.service-item {
    grid-template-columns: 1fr 100px 150px auto;
}

.addon-item {
    grid-template-columns: 1fr 100px auto;
}
</style>
`;

// Add styles to head
document.head.insertAdjacentHTML('beforeend', vehicleStyles);

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    loadVehicles();

    document.getElementById('addVehicleBtn').addEventListener('click', showAddVehicleModal);
    document.getElementById('addBaseServiceBtn').addEventListener('click', addBaseServiceItem);
    document.getElementById('addAddonBtn').addEventListener('click', addAddonItem);
    document.getElementById('vehicleForm').addEventListener('submit', submitVehicleForm);

    // Modal close on outside click
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
        }
    });
});