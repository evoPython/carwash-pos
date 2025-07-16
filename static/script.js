// Elements
const vehicleFilter = document.getElementById('vehicleFilter');
const vehicleList = document.getElementById('vehicleList');
const amountInput = document.getElementById('amount');
const addBtn = document.getElementById('addAddonBtn');
const addonList = document.getElementById('addonList');
const addonsTbody = document.querySelector('#addonsTable tbody');
const totalDisplay = document.getElementById('total');
const addonsTable = document.getElementById('addonsTable');

let data = {}, currentAddons = {};

// fetch vehicle dictionary
fetch('/static/dict/vehicle_types.json')
    .then(res => res.json())
    .then(json => {
        data = json;
        populateList(vehicleList, Object.keys(data));
        console.log(vehicleList);
    });

// helper: fill unordered list with items
function populateList(ul, items) {
    ul.innerHTML = '';
    items.forEach(i => {
        const li = document.createElement('li');
        li.textContent = i;
        ul.appendChild(li);
    });
}

// show/hide dropdown
function toggle(ul, show) {
    ul.style.display = show ? 'block' : 'none';
}

// click outside closes any open dropdown
document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown-wrapper')) {
        toggle(vehicleList, false);
        toggle(addonList, false);
    }
});

// vehicle type dropdown/filter 
vehicleFilter.addEventListener('focus', () => toggle(vehicleList, true));
vehicleFilter.addEventListener('input', () => {
    const term = vehicleFilter.value.toLowerCase();
    Array.from(vehicleList.children).forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
    toggle(vehicleList, true);
});

vehicleList.addEventListener('click', e => {
    if (e.target.tagName === 'LI') {
        const sel = e.target.textContent;
        vehicleFilter.value = sel;
        amountInput.value = data[sel].amount;
        currentAddons = {};
        renderAddons();
        updateTotal();
        toggle(vehicleList, false);
    }
});

// add‑on dropdown 
addBtn.addEventListener('click', e => {
    e.stopPropagation();
    const vt = vehicleFilter.value;
    if (!data[vt]) return alert('Select a vehicle type first.');
    const opts = Object.entries(data[vt].add_ons).map(([n, p]) => `${n} – ₱${p}`);
    populateList(addonList, opts);
    toggle(addonList, true);
});

addonList.addEventListener('click', e => {
    if (e.target.tagName === 'LI') {
        const [name, priceTxt] = e.target.textContent.split(' – ₱');
        currentAddons[name] = Number(priceTxt);
        renderAddons();
        updateTotal();
        toggle(addonList, false);
    }
});

// rendering & calculation 

function renderAddons() {
    // clear out existing rows
    addonsTbody.innerHTML = '';

    const entries = Object.entries(currentAddons);

    if (entries.length === 0) {
        // no add‑ons: hide the table
        addonsTable.style.display = 'none';
    } else {
        // has add‑ons: show the table and re‐populate
        addonsTable.style.display = '';

        entries.forEach(([name, price]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${name}</td>
        <td>₱${price}</td>
        <td>
          <button class="remove-btn" data-name="${name}">remove</button>
          <!-- Hidden inputs for form submission -->
          <input type="hidden" name="addon_name[]" value="${name}">
          <input type="hidden" name="addon_price[]" value="${price}">
        </td>`;

            addonsTbody.appendChild(tr);
        });


        // wire up remove buttons
        addonsTbody.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = () => {
                delete currentAddons[btn.dataset.name];
                renderAddons();
                updateTotal();
            };
        });
    }
}


function updateTotal() {
    let total = parseFloat(amountInput.value) || 0;
    Object.values(currentAddons).forEach(p => total += p);
    totalDisplay.textContent = `Total: ₱${total}`;
}
