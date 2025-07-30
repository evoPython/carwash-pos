# Carwash POS System

A comprehensive Point of Sale system for carwash businesses built with Flask, featuring role-based access control, shift management, and automated financial calculations.

## Features

### Core Functionality
- **New Order Management**: Vehicle name, plate number, pricing with automatic calculations
- **Financial Calculations**: 
  - C-SHARES = (PRICE - 40) * 0.7 - VAC
  - W-SHARE = (PRICE - 40) * 0.3 - 2 - VAC
  - Automatic VAC deduction (5 pesos) when vacuum service is selected
- **Real-time Dashboard**: Shows orders with role-based filtering

### User Management & Security
- **Role-Based Access Control**:
  - **Admin/Developer**: Full access to all data, financial summaries, user management
  - **Incharge**: Limited to own sales from current shift only
- **Shift Management**: 
  - AM Shift: 5:00 AM - 5:00 PM
  - PM Shift: 5:00 PM - 5:00 AM
  - Automatic shift detection and access control
- **Authentication**: Uses full names instead of email addresses

### Dashboard Features
- **Clean Interface**: Title bar shows only "Carwash POS" centered
- **User Display**: Full name and role prominently displayed
- **Shift-Based Data**: Incharges see only their current shift data
- **Financial Summaries**: Available only to Admin/Developer roles

## Installation & Setup

1. **Install Dependencies**:
```bash
pip install -r requirements.txt
```

2. **Start the Application**:
```bash
python start_app.py
```
*The database will be automatically initialized on first run*

3. **Access the Application**:
   - Open your browser to `http://localhost:5000`
   - Login redirects directly to dashboard (no welcome page)

## Default Accounts

- **Admin**: username=`admin`, password=`admin123`, full_name=`Administrator`
- **Developer**: username=`developer`, password=`dev123`, full_name=`System Developer`

## Database Schema

### Orders Table
- **No.** (ID): Auto-incrementing primary key
- **VEHICLE NAME**: Customer's vehicle name
- **PLATE NO.**: Vehicle plate number
- **W/Vac**: Yes/No for vacuum service
- **ADDONS**: Additional services (text)
- **PRICE**: Total service price
- **LESS 40**: Always 40 (fixed deduction)
- **C-SHARES**: Calculated company share
- **W-SHARE**: Calculated worker share
- **W-NAME**: Worker's full name
- **SSS**: Always 2 (fixed deduction)

### Users Table
- **ID**: Auto-incrementing primary key
- **Username**: Unique login identifier
- **Full Name**: User's complete name
- **Role**: Admin, Developer, or Incharge
- **Shift**: AM or PM (for Incharge users only)
- **Active Status**: Account activation status

## Usage Guide

### For Incharges
1. Login during your assigned shift time
2. View your own sales from the current shift
3. Add new orders using the "New Order" button
4. System automatically calculates shares and deductions

### For Admin/Developers
1. Access all system data regardless of shift
2. View financial summaries and reports
3. Manage user accounts and assign shifts
4. Monitor all transactions across shifts

### Adding New Orders
1. Click "New Order" button
2. Fill in:
   - Vehicle Name
   - Plate Number
   - Select W/Vac (Yes/No)
   - Enter Price
   - Add any additional services
3. System automatically calculates:
   - C-SHARES and W-SHARE based on price and VAC
   - Applies proper deductions (LESS 40, SSS, VAC)

## Technical Details

- **Backend**: Flask with SQLite database
- **Frontend**: HTML, CSS, JavaScript with Tabulator.js
- **Authentication**: Flask-Login with role-based permissions
- **Database**: Automatic schema detection and reinitialization
- **Responsive Design**: Works on desktop and mobile devices

## File Structure

```
carwash-pos/
├── app.py                 # Main Flask application
├── start_app.py          # Startup script
├── auth.py               # Authentication logic
├── config.py             # Configuration settings
├── db/
│   ├── __init__.py       # Database functions
│   └── models.py         # Data models
├── templates/            # HTML templates
├── static/               # CSS, JS, and assets
└── requirements.txt      # Python dependencies
```

## Troubleshooting

- **Database Issues**: The system automatically reinitializes the database if schema is outdated
- **Login Problems**: Check if user is accessing during correct shift time (for Incharges)
- **Permission Errors**: Verify user role and permissions in user management
- **Calculation Issues**: Ensure price is entered correctly and VAC selection is made

## Support

For technical support or feature requests, please refer to the system administrator.
