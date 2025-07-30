"""
Authentication module for Carwash POS system.

This module provides authentication functionality including:
- User login/logout
- User registration
- Role-based access control
- Session management

Roles and Permissions:
- Developer (100): Full system access including user management
- Admin (80): Full business operations access
- Incharge (60): Limited daily operations access
"""

from functools import wraps
from flask import request, redirect, url_for, flash, current_app
from flask_login import LoginManager, current_user
from db import get_user_by_id, get_user_by_username
from db.models import Role

# Initialize Flask-Login
login_manager = LoginManager()

def init_auth(app):
    """Initialize authentication for the Flask app."""
    login_manager.init_app(app)
    login_manager.login_view = 'login'
    login_manager.login_message = None
    login_manager.session_protection = app.config.get('SESSION_PROTECTION', 'strong')

@login_manager.user_loader
def load_user(user_id):
    """Load user by ID for Flask-Login."""
    return get_user_by_id(int(user_id))

def authenticate_user(username, password):
    """
    Authenticate a user with username and password.
    
    Args:
        username (str): Username
        password (str): Plain text password
        
    Returns:
        User: User object if authentication successful, None otherwise
    """
    user = get_user_by_username(username)
    if user and user.check_password(password):
        return user
    return None

def require_permission(required_level):
    """
    Decorator to require a minimum permission level for a route.
    
    Args:
        required_level (int): Minimum permission level required
        
    Usage:
        @require_permission(80)  # Requires Admin or Developer
        def admin_only_route():
            pass
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for('login'))
            
            if not current_user.has_permission(required_level):
                flash('You do not have permission to access this page.', 'error')
                return redirect(url_for('index'))
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def require_role(*allowed_roles):
    """
    Decorator to require specific roles for a route.
    
    Args:
        allowed_roles: Variable number of role names
        
    Usage:
        @require_role('Admin', 'Developer')
        def admin_or_dev_route():
            pass
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for('login'))
            
            if current_user.role not in allowed_roles:
                flash('You do not have permission to access this page.', 'error')
                return redirect(url_for('index'))
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def require_login(f):
    """
    Simple decorator to require login for a route.
    
    Usage:
        @require_login
        def protected_route():
            pass
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def is_safe_url(target):
    """
    Check if a URL is safe for redirects.
    
    Args:
        target (str): URL to check
        
    Returns:
        bool: True if URL is safe, False otherwise
    """
    from urllib.parse import urlparse, urljoin
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ('http', 'https') and ref_url.netloc == test_url.netloc

def get_redirect_target():
    """
    Get the target URL for redirect after login.
    
    Returns:
        str: Safe redirect URL or None
    """
    for target in request.values.get('next'), request.referrer:
        if not target:
            continue
        if is_safe_url(target):
            return target
    return None

# Permission level constants for easy reference
class PermissionLevel:
    """Permission level constants."""
    INCHARGE = 60
    ADMIN = 80
    DEVELOPER = 100

# Common permission decorators for convenience
require_incharge = require_permission(PermissionLevel.INCHARGE)
require_admin = require_permission(PermissionLevel.ADMIN)
require_developer = require_permission(PermissionLevel.DEVELOPER)

# Role-specific decorators
require_admin_role = require_role(Role.ADMIN, Role.DEVELOPER)
require_developer_role = require_role(Role.DEVELOPER)