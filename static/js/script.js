document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const tableEl = document.getElementById("orders-table");
    const dateInput = document.getElementById("filter-date");
    const monthInput = document.getElementById("filter-month");
    const btnRefresh = document.getElementById("btn-refresh");
    const btnOpen = document.getElementById("btn-open-modal");
    const modal = document.getElementById("modal");
    const modalClose = document.getElementById("modal-close");
    const form = document.getElementById("order-form");

    const vehicleSel = document.getElementById("vehicle-type");
    const baseInput = document.getElementById("base-price");
    const addonsDiv = document.getElementById("addons-container");
    const rentInput = document.getElementById("rent");
    const sssInput = document.getElementById("sss");
    const vacInput = document.getElementById("vac");
    const cetaInput = document.getElementById("cetadcco_share");
    const carwInput = document.getElementById("carwasher_share");

    let vehicleData = {}, addonNames = [];

    // Load vehicle types
    fetch("/static/dict/vehicle_types.json")
        .then(r => r.json())
        .then(data => {
            vehicleData = data;
            // extract all addon names globally
            const names = new Set();
            Object.values(data).forEach(v => {
                Object.keys(v.add_ons || {}).forEach(n => names.add(n));
            });
            addonNames = Array.from(names).sort();

            // populate vehicle dropdown
            Object.entries(data).forEach(([type, info]) => {
                const o = document.createElement("option");
                o.value = type;
                o.textContent = `${type} (₱${info.amount})`;
                vehicleSel.appendChild(o);
            });

            initTable();  // now we know addonNames
            loadData();
        });

    // Initialize Tabulator
    let table;
    function initTable() {
        const cols = [
            { title: "ID", field: "id", width: 50 },
            { title: "Vehicle", field: "vehicle_type" },
            { title: "Base", field: "base_price", formatter: "money", formatterParams: { symbol: "₱" } }
        ];
        addonNames.forEach(n => {
            cols.push({ title: n, field: n, formatter: "money", formatterParams: { symbol: "₱" } });
        });
        cols.push(
            { title: "Rent", field: "rent", formatter: "money", formatterParams: { symbol: "₱" } },
            { title: "SSS", field: "sss" },
            { title: "VAC", field: "vac" },
            { title: "Ceta Share", field: "cetadcco_share", formatter: "money", formatterParams: { symbol: "₱" } },
            { title: "Carwasher Share", field: "carwasher_share", formatter: "money", formatterParams: { symbol: "₱" } },
            { title: "Timestamp", field: "timestamp" }
        );
        table = new Tabulator(tableEl, { layout: "fitDataStretch", columns: cols });
    }

    // Recalc all derived fields
    function recalcAll() {
        const info = vehicleData[vehicleSel.value];
        if (!info) return;
        const amount = +info.amount;
        const SSS = 2;
        const vac = Array.from(addonsDiv.querySelectorAll("input:checked"))
            .some(cb => cb.nextSibling.textContent.trim().toLowerCase().startsWith("vacuum"))
            ? 5 : 0;
        const rent = amount - 40;
        const cetadcco = +(rent * 0.7).toFixed(2);
        const carwasher = +((rent * 0.3) - (SSS + vac)).toFixed(2);

        baseInput.value = amount;
        sssInput.value = SSS;
        vacInput.value = vac;
        rentInput.value = rent;
        cetaInput.value = cetadcco;
        carwInput.value = carwasher;
    }

    // When vehicle selection changes
    vehicleSel.addEventListener("change", () => {
        const info = vehicleData[vehicleSel.value];
        if (!info) return;

        // build addon checkboxes
        addonsDiv.innerHTML = "";
        Object.entries(info.add_ons || {}).forEach(([name, price]) => {
            const lbl = document.createElement("label");
            lbl.innerHTML = `<input type="checkbox" value="${price}"> ${name}:₱${price}`;
            addonsDiv.appendChild(lbl);
        });
        // recalc when any addon toggles
        addonsDiv.querySelectorAll("input").forEach(cb =>
            cb.addEventListener("change", recalcAll)
        );
        recalcAll();
    });

    // Modal
    btnOpen.onclick = () => modal.style.display = "block";
    modalClose.onclick = () => modal.style.display = "none";
    window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };

    // Load orders & summary
    async function loadData() {
        const params = new URLSearchParams();
        // if (dateInput.value) params.set("date", dateInput.value);
        if (monthInput.value) params.set("month", monthInput.value);

        const [oRes, sRes] = await Promise.all([
            fetch("/api/orders?" + params),
            fetch("/api/summary?" + params)
        ]);
        if (!oRes.ok || !sRes.ok) {
            console.error("Failed to load data");
            return;
        }
        const orders = await oRes.json();
        const summary = await sRes.json();

        // flatten addons
        const rows = orders.map(o => {
            const row = { ...o };
            addonNames.forEach(n => row[n] = (o.addons || {})[n] || 0);
            return row;
        });
        table.setData(rows);

        document.getElementById("sum-income").textContent = `₱${summary.income.toFixed(2)}`;
        document.getElementById("sum-expenses").textContent = `₱${summary.expenses.toFixed(2)}`;
        document.getElementById("sum-cetadcco").textContent = `₱${summary.cetadcco_share.toFixed(2)}`;
        document.getElementById("sum-carwasher").textContent = `₱${summary.carwasher_share.toFixed(2)}`;

        const net = summary.income
            - summary.expenses
            - summary.cetadcco_share
            - summary.carwasher_share;
        document.getElementById("sum-net").textContent = `₱${net.toFixed(2)}`;

        // update chart (now including Net)
        const ctx = document.getElementById("summary-chart").getContext("2d");
        if (window.chart) window.chart.destroy();
        window.chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: ["Gross", "Expenses", "Cetadcco", "Carwasher", "Net"],
                datasets: [{
                    data: [
                        summary.income,
                        summary.expenses,
                        summary.cetadcco_share,
                        summary.carwasher_share,
                        net
                    ]
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    btnRefresh.addEventListener("click", loadData);

    // Submit new order
    form.addEventListener("submit", async e => {
        e.preventDefault();
        const addons = {};
        addonsDiv.querySelectorAll("input:checked").forEach(cb => {
            const text = cb.nextSibling.textContent.trim();
            const name = text.split(":")[0];
            addons[name] = +cb.value;
        });
        const payload = {
            vehicle_type: vehicleSel.value,
            base_price: +baseInput.value,
            addons,
            rent: +rentInput.value,
            sss: +sssInput.value,
            vac: +vacInput.value,
            cetadcco_share: +cetaInput.value,
            carwasher_share: +carwInput.value
        };
        const r = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (r.ok) {
            form.reset();
            modal.style.display = "none";
            loadData();
        } else {
            alert("Failed to add order");
        }
    });

    // initial load
    loadData();
});
