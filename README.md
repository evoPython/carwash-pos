# Carwash POS System

A comprehensive Point of Sale (POS) system for Cetadcco carwash with integrated user authentication and role-based access control.

## Features

### Core Functionality
- **Order Management**: Create, track, and manage carwash orders
- **Financial Reporting**: Real-time income, expenses, and profit tracking
- **Vehicle Type Management**: Support for different vehicle categories and pricing
- **Add-on Services**: Flexible pricing for additional services

### Authentication & Security
- **User Authentication**: Secure login/logout system with session management
- **Role-Based Access Control**: Three-tier permission system (Developer, Admin, Incharge)
- **User Management**: Admin interface for creating and managing user accounts
- **Password Security**: Encrypted password storage with secure hashing
- **Session Protection**: Strong session security with CSRF protection

## User Roles

| Role | Permission Level | Access |
|------|------------------|--------|
| **Developer** | 100 | Full system access, user management, system administration |
| **Admin** | 80 | Full business operations, financial reports, order management |
| **Incharge** | 60 | Daily operations, basic order management, limited reporting |

## Quick Start

### Prerequisites
- Python 3.7+
- Flask and dependencies (see requirements.txt)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd carwash-pos
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   python app.py
   ```

4. **Access the application**
   - Open your browser to `http://localhost:5000`
   - You'll be redirected to the login page

### Default Login Credentials

**⚠️ Change these passwords immediately in production!**

- **Admin Account**
  - Username: `admin`
  - Password: `admin123`

- **Developer Account**
  - Username: `developer`
  - Password: `dev123`

## Project Structure

```
carwash-pos/
├── app.py                 # Main Flask application
├── auth.py                # Authentication module and decorators
├── config.py              # Application configuration
├── requirements.txt       # Python dependencies
├── AUTHENTICATION.md      # Detailed authentication documentation
├── db/
│   ├── __init__.py       # Database initialization and user functions
│   └── models.py         # Data models (Order, User, Role)
├── templates/
│   ├── index.html        # Main dashboard
│   ├── login.html        # Login page
│   ├── register.html     # User registration
│   └── users.html        # User management interface
├── static/
│   ├── css/
│   │   └── styles.css    # Application styles
│   ├── js/
│   │   ├── script.js     # Main application JavaScript
│   │   └── tabulator/    # Table library for data display
│   └── dict/
│       └── vehicle_types.json # Vehicle type definitions
└── carwash.db            # SQLite database (created on first run)
```

## API Endpoints

### Authentication
- `GET/POST /login` - User login
- `GET/POST /register` - User registration
- `GET /logout` - User logout

### Application Routes
- `GET /` - Main dashboard (requires login)
- `GET /users` - User management (admin only)

### API Routes
- `GET/POST /api/orders` - Order management (requires login)
- `GET /api/summary` - Financial summary (requires login)
- `GET/POST /api/users/*` - User management APIs (admin only)

## Configuration

### Environment Variables

For production deployment, set these environment variables:

```bash
SECRET_KEY=your-very-secure-secret-key-here
SQLITE_DB_PATH=/path/to/your/database.db
MONGO_URI=mongodb://localhost:27017/carwash_main  # Optional
SYNC_ENABLED=1  # Enable/disable MongoDB sync
```

### Security Configuration

The application includes several security features:

- **Password Hashing**: Uses Werkzeug's secure password hashing
- **Session Security**: Strong session protection enabled
- **CSRF Protection**: Built-in CSRF protection via Flask
- **Input Validation**: All user inputs are validated and sanitized

## Development

### Adding New User Roles

1. Update the `Role` class in [`db/models.py`](db/models.py:25)
2. Add the new role to `ROLE_PERMISSIONS` dictionary
3. Update templates and documentation as needed

### Adding Protected Routes

Use the authentication decorators:

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
```

### Database Schema

The application uses SQLite with the following main tables:

- **orders**: Store order data as JSON
- **users**: User accounts with authentication info
- **roles**: Implicit in the User model with permission levels

## Security Best Practices

1. **Change default passwords** immediately
2. **Use strong SECRET_KEY** in production
3. **Enable HTTPS** for production deployment
4. **Regular backups** of the database
5. **Monitor user activity** and access logs
6. **Keep dependencies updated**

## Troubleshooting

### Common Issues

1. **Database not found**: The database is created automatically on first run
2. **Permission denied**: Check user roles and permission levels
3. **Login issues**: Verify default users were created successfully

### Debug Mode

For development, the application runs in debug mode by default. For production:

```python
if __name__ == "__main__":
    create_app().run(debug=False, host='0.0.0.0', port=5000)
```

## Documentation

- **[AUTHENTICATION.md](AUTHENTICATION.md)**: Comprehensive authentication system documentation
- **Code Comments**: Detailed inline documentation throughout the codebase
- **API Documentation**: Available in the authentication documentation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is in development for Cetadcco carwash operations.

## Support

For questions or issues:
1. Check the [AUTHENTICATION.md](AUTHENTICATION.md) documentation
2. Review code comments and inline documentation
3. Create an issue in the repository

---

**Status**: Active Development
**Version**: 1.0 with Authentication System
**Last Updated**: January 2024
