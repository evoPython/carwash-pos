# Carwash POS System

## Project Overview

The Carwash POS System is a comprehensive point-of-sale application designed for carwash businesses. It provides a user-friendly interface for managing orders, tracking sales, and generating reports. The system supports multiple user roles, including in-charge personnel, administrators, and developers, each with specific permissions and access levels.

## Features

### User Management
- Role-based access control (In-charge, Admin, Developer)
- User authentication and authorization
- User account creation, editing, and deletion

### Order Management
- Create and track orders with detailed information
- Calculate shares for 6B and washers based on business rules
- Support for various vehicle types and services
- Addon services with customizable pricing

### Reporting and Analytics
- Daily and shift-based summary reports
- Detailed order history and tracking
- Expense and income tracking
- Grand total calculation with all financial metrics

### Vehicle Management
- Manage vehicle types and their associated services
- Configure base services and addons with pricing
- Customizable service options (with/without vacuum)

### Database Management
- SQLite database for data storage
- Database viewer for direct access and management
- Schema setup with tables for users, orders, vehicles, and shift summaries

## Installation and Setup

### Prerequisites
- Python 3.x
- Flask
- SQLite

### Setup Instructions
1. Clone the repository
2. Install dependencies: `pip install -r requirements.txt`
3. Run the database setup: `python database_setup.py`
4. Start the application: `python app.py`
5. Access the application at `http://localhost:5000`

## Project Structure

```
carwash-pos/
├── app.py                  # Main application file
├── database_setup.py       # Database initialization script
├── carwash_pos.db          # SQLite database file
├── static/
│   ├── css/
│   │   └── style.css       # CSS styles
│   └── js/
│       ├── dashboard.js    # Dashboard JavaScript
│       ├── summary.js      # Summary page JavaScript
│       ├── users.js        # User management JavaScript
│       └── vehicles.js     # Vehicle management JavaScript
└── templates/
    ├── base.html           # Base template
    ├── login.html          # Login page
    ├── dashboard.html      # In-charge dashboard
    ├── admin_dashboard.html # Admin dashboard
    ├── summary.html        # Summary reports
    ├── users.html          # User management
    ├── vehicles.html       # Vehicle management
    └── database.html       # Database viewer
```

## Usage

### Login
- Access the application and log in with your credentials
- Default developer account: username `developer`, password `dev123`

### Dashboard
- View and manage orders for the current shift
- Track sales and financial metrics
- Add other income and expenses

### Admin Dashboard
- Access summary reports
- Manage users and vehicles
- View recent activity

### Summary Reports
- Select a date and shift to view detailed reports
- View orders, expenses, and income for the selected period
- Generate grand total calculations

### User Management
- Add, edit, and delete user accounts
- Assign roles and shifts to users
- Manage user permissions

### Vehicle Management
- Add and configure vehicle types
- Set base services and addons with pricing
- Customize service options

## Database Schema

The application uses an SQLite database with the following tables:

- `users`: Stores user account information
- `orders`: Stores order details and financial calculations
- `vehicles`: Stores vehicle types, services, and pricing
- `shift_summaries`: Stores shift-based summary data

## Development and Contribution

### Code Structure
- The application is built using Flask for the backend
- SQLite is used for data storage
- HTML/CSS/JavaScript is used for the frontend

### Contribution Guidelines
- Fork the repository and create a feature branch
- Make your changes and submit a pull request
- Follow the existing code style and conventions

### Running Tests
- Tests can be run using the standard Python testing framework

## License

This project is licensed under the MIT License.