# Carwash POS Authentication System

This document provides comprehensive information about the authentication and authorization system implemented in the Carwash POS application.

## Overview

The authentication system provides secure user login, role-based access control, and user management functionality. It uses Flask-Login for session management and implements a three-tier role system.

## User Roles and Permissions

### Role Hierarchy

1. **Developer** (Permission Level: 100)
   - Full system access including user management
   - Can create, edit, and delete users
   - Access to all application features
   - System administration capabilities

2. **Admin** (Permission Level: 80)
   - Full business operations access
   - Can manage daily operations
   - Access to financial reports and summaries
   - Cannot manage users (unless specifically granted)

3. **Incharge** (Permission Level: 60)
   - Limited daily operations access
   - Can create and view orders
   - Basic reporting access
   - No user management capabilities

### Permission System

The system uses numeric permission levels where higher numbers indicate more privileges. Routes can require specific permission levels using decorators:

```python
@require_permission(80)  # Requires Admin or Developer
@require_admin          # Requires Admin or Developer role
@require_developer      # Requires Developer role only
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);
```

### Default Users

The system creates default users on first run:

- **Username:** `admin` | **Password:** `admin123` | **Role:** Admin
- **Username:** `developer` | **Password:** `dev123` | **Role:** Developer

**⚠️ SECURITY WARNING:** Change these default passwords immediately in production!

## Authentication Flow

### Login Process

1. User accesses `/login` route
2. Enters username and password
3. System validates credentials against database
4. If valid, creates user session with Flask-Login
5. Redirects to dashboard or requested page

### Registration Process

1. User accesses `/register` route
2. Fills out registration form with username, email, password, and role
3. System validates input and checks for duplicates
4. Creates new user account
5. Redirects to login page

### Logout Process

1. User clicks logout button
2. Flask-Login clears user session
3. Redirects to login page

## API Endpoints

### Authentication Routes

- `GET/POST /login` - User login page and authentication
- `GET/POST /register` - User registration page and account creation
- `GET /logout` - User logout (requires login)

### Protected Application Routes

- `GET /` - Main dashboard (requires login)
- `GET /users` - User management page (requires admin access)

### Order API Routes (Protected)

- `POST /api/orders` - Create new order (requires login)
- `GET /api/orders` - List orders (requires login)
- `GET /api/summary` - Financial summary (requires login)

### User Management API Routes (Admin Only)

- `GET /api/users` - List all users
- `GET /api/users/<id>` - Get specific user
- `POST /api/users/create` - Create new user
- `POST /api/users/update` - Update user information
- `POST /api/users/<id>/activate` - Activate user account
- `POST /api/users/<id>/deactivate` - Deactivate user account

## Security Features

### Password Security

- Passwords are hashed using Werkzeug's `generate_password_hash()`
- Uses PBKDF2 with SHA-256 by default
- Salted hashes prevent rainbow table attacks

### Session Security

- Flask-Login manages secure sessions
- Session protection set to 'strong' mode
- Remember me functionality with configurable duration
- CSRF protection through Flask's secret key

### Access Control

- Route-level protection using decorators
- Permission-based access control
- Role-based restrictions
- Safe URL redirect validation

## File Structure

```
├── auth.py                 # Authentication module and decorators
├── db/
│   ├── __init__.py        # Database functions including user management
│   └── models.py          # User and Role models
├── templates/
│   ├── login.html         # Login page template
│   ├── register.html      # Registration page template
│   ├── users.html         # User management interface
│   └── index.html         # Main dashboard (updated with user info)
├── static/css/
│   └── styles.css         # Updated with authentication styles
├── app.py                 # Main Flask application with auth routes
├── config.py              # Configuration including auth settings
└── requirements.txt       # Dependencies including Flask-Login
```

## Usage Examples

### Protecting Routes

```python
from auth import require_login, require_admin, require_permission

@app.route('/protected')
@require_login
def protected_route():
    return "This requires login"

@app.route('/admin-only')
@require_admin
def admin_route():
    return "This requires admin access"

@app.route('/high-permission')
@require_permission(80)
def high_permission_route():
    return "This requires permission level 80+"
```

### Checking User Permissions in Templates

```html
{% if current_user.has_permission(80) %}
    <a href="{{ url_for('users') }}">Manage Users</a>
{% endif %}

{% if current_user.is_developer() %}
    <p>Developer-only content</p>
{% endif %}
```

### Creating Users Programmatically

```python
from db import create_user
from db.models import Role

# Create a new admin user
user_id = create_user(
    username="newadmin",
    email="admin@example.com",
    password="securepassword",
    role=Role.ADMIN
)
```

## Configuration

### Environment Variables

Set these environment variables for production:

```bash
SECRET_KEY=your-very-secure-secret-key-here
SQLITE_DB_PATH=/path/to/your/database.db
```

### Config Settings

In `config.py`:

```python
class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-in-production")
    REMEMBER_COOKIE_DURATION = 86400  # 24 hours
    SESSION_PROTECTION = 'strong'
```

## Installation and Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python app.py
   ```

3. Access the application at `http://localhost:5000`

4. Log in with default credentials:
   - Admin: `admin` / `admin123`
   - Developer: `developer` / `dev123`

5. **Important:** Change default passwords immediately!

## Troubleshooting

### Common Issues

1. **"User not found" errors**
   - Check if database is properly initialized
   - Verify default users were created

2. **Permission denied errors**
   - Check user role and permission levels
   - Verify route decorators are correctly applied

3. **Session issues**
   - Ensure SECRET_KEY is set
   - Check session protection settings

### Debug Mode

Enable debug mode for development:

```python
if __name__ == "__main__":
    create_app().run(debug=True, port=5000)
```

## Security Best Practices

1. **Change default passwords** immediately in production
2. **Use strong SECRET_KEY** - generate with `os.urandom(24)`
3. **Use HTTPS** in production to protect login credentials
4. **Regular password updates** - implement password expiry if needed
5. **Monitor user activity** - add logging for authentication events
6. **Backup user data** - regular database backups
7. **Validate input** - all user inputs are validated and sanitized

## Future Enhancements

Potential improvements to consider:

1. **Two-factor authentication (2FA)**
2. **Password complexity requirements**
3. **Account lockout after failed attempts**
4. **Password reset functionality**
5. **User activity logging**
6. **Email verification for registration**
7. **OAuth integration (Google, Microsoft, etc.)**
8. **API key authentication for external integrations**

## Support

For questions or issues with the authentication system, refer to:

1. Flask-Login documentation: https://flask-login.readthedocs.io/
2. Flask security best practices
3. This documentation and code comments

---

**Last Updated:** January 2024
**Version:** 1.0