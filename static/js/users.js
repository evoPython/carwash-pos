let users = [];
let editingUserId = null;
let deletingUserId = null;

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Load users
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        users = await response.json();

        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.full_name}</td>
                <td>${user.username}</td>
                <td><span class="role-badge ${user.role}">${user.role}</span></td>
                <td>${user.shift || '-'}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-secondary btn-small" onclick="editUser(${user.id})">Edit</button>
                    <button class="btn btn-error btn-small" onclick="deleteUser(${user.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Show add user modal
function showAddUserModal() {
    document.getElementById('modalTitle').textContent = 'Add User';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('password').required = true;
    editingUserId = null;
    openModal('userModal');
}

// Edit user
function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('modalTitle').textContent = 'Edit User';
    document.getElementById('userId').value = user.id;
    document.getElementById('fullName').value = user.full_name;
    document.getElementById('username').value = user.username;
    document.getElementById('role').value = user.role;
    document.getElementById('shift').value = user.shift || '';
    document.getElementById('password').required = false;
    document.getElementById('password').value = '';

    // Show/hide shift group based on role
    toggleShiftGroup(user.role);

    editingUserId = userId;
    openModal('userModal');
}

// Delete user
function deleteUser(userId) {
    deletingUserId = userId;
    openModal('deleteModal');
}

// Confirm delete
async function confirmDelete() {
    if (!deletingUserId) return;

    try {
        const response = await fetch(`/api/users/${deletingUserId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            closeModal('deleteModal');
            loadUsers();
        } else {
            alert('Error deleting user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user');
    }

    deletingUserId = null;
}

// Toggle shift group visibility
function toggleShiftGroup(role) {
    const shiftGroup = document.getElementById('shiftGroup');
    const shiftSelect = document.getElementById('shift');

    if (role === 'incharge') {
        shiftGroup.style.display = 'block';
        shiftSelect.required = true;
    } else {
        shiftGroup.style.display = 'none';
        shiftSelect.required = false;
        shiftSelect.value = '';
    }
}

// Submit user form
async function submitUserForm(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const userData = {
        full_name: formData.get('fullName'),
        username: formData.get('username'),
        role: formData.get('role'),
        shift: formData.get('shift') || null
    };

    const password = formData.get('password');
    if (password) {
        userData.password = password;
    }

    const method = editingUserId ? 'PUT' : 'POST';
    const url = editingUserId ? `/api/users/${editingUserId}` : '/api/users';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            closeModal('userModal');
            loadUsers();
        } else {
            try {
                const error = await response.json();
                alert(error.message || 'Error saving user');
            } catch (jsonError) {
                console.error('Error parsing JSON response:', jsonError);
                const text = await response.text();
                console.error('Response text:', text);
                alert('Error saving user. Unexpected response format.');
            }
        }
    } catch (error) {
        console.error('Error saving user:', error);
        alert('Error saving user');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    loadUsers();

    document.getElementById('addUserBtn').addEventListener('click', showAddUserModal);
    document.getElementById('role').addEventListener('change', function () {
        toggleShiftGroup(this.value);
    });
    document.getElementById('userForm').addEventListener('submit', submitUserForm);

    // Modal close on outside click
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
        }
    });
});