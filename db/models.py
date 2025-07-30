import json
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

class Order:
    """Defines how orders are represented locally and in MongoDB."""
    @staticmethod
    def serialize(data: dict) -> str:
        # add a timestamp if not present
        if "timestamp" not in data:
            data["timestamp"] = datetime.utcnow().isoformat()
        return json.dumps(data)

    @staticmethod
    def deserialize(raw: str) -> dict:
        return json.loads(raw)


class Role:
    """Defines user roles and their permissions."""
    
    # Role constants
    DEVELOPER = 'Developer'
    ADMIN = 'Admin'
    INCHARGE = 'Incharge'
    
    # Permission levels (higher number = more permissions)
    ROLE_PERMISSIONS = {
        DEVELOPER: 100,  # Full access to everything including system settings
        ADMIN: 80,       # Full business operations access
        INCHARGE: 60,    # Limited access to daily operations
    }
    
    @staticmethod
    def get_all_roles():
        """Get all available roles."""
        return list(Role.ROLE_PERMISSIONS.keys())
    
    @staticmethod
    def get_permission_level(role_name):
        """Get permission level for a role."""
        return Role.ROLE_PERMISSIONS.get(role_name, 0)
    
    @staticmethod
    def has_permission(user_role, required_permission_level):
        """Check if user role has required permission level."""
        user_level = Role.get_permission_level(user_role)
        return user_level >= required_permission_level


class User(UserMixin):
    """User model for authentication and authorization."""
    
    def __init__(self, id, username, full_name, password_hash, role, is_active=True, created_at=None, shift=None):
        self.id = id
        self.username = username
        self.full_name = full_name  # Changed from email to full_name
        self.password_hash = password_hash
        self.role = role
        self._is_active = is_active  # Use private attribute to avoid conflict with UserMixin
        self.created_at = created_at or datetime.utcnow().isoformat()
        self.shift = shift  # For incharge shift scheduling ('AM' or 'PM')
    
    @property
    def is_active(self):
        """Override UserMixin's is_active property."""
        return self._is_active
    
    @is_active.setter
    def is_active(self, value):
        """Allow setting is_active."""
        self._is_active = value
    
    def set_password(self, password):
        """Set password hash."""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if provided password matches hash."""
        return check_password_hash(self.password_hash, password)
    
    def get_permission_level(self):
        """Get user's permission level based on role."""
        return Role.get_permission_level(self.role)
    
    def has_permission(self, required_level):
        """Check if user has required permission level."""
        return Role.has_permission(self.role, required_level)
    
    def is_developer(self):
        """Check if user is a developer."""
        return self.role == Role.DEVELOPER
    
    def is_admin(self):
        """Check if user is an admin."""
        return self.role == Role.ADMIN
    
    def is_incharge(self):
        """Check if user is an incharge."""
        return self.role == Role.INCHARGE
    
    def to_dict(self):
        """Convert user to dictionary (excluding password hash)."""
        return {
            'id': self.id,
            'username': self.username,
            'full_name': self.full_name,
            'role': self.role,
            'is_active': self._is_active,
            'created_at': self.created_at,
            'shift': self.shift
        }
    
    @staticmethod
    def from_db_row(row):
        """Create User instance from database row."""
        return User(
            id=row[0],
            username=row[1],
            full_name=row[2],
            password_hash=row[3],
            role=row[4],
            is_active=bool(row[5]),
            created_at=row[6],
            shift=row[7] if len(row) > 7 else None
        )
    
    def is_shift_active(self):
        """Check if current time is within user's shift (for incharges)."""
        if self.role != Role.INCHARGE or not self.shift:
            return True  # Non-incharges or those without shifts can always access
        
        from datetime import datetime
        
        # Get current hour (assuming system is in Manila timezone)
        current_hour = datetime.now().hour
        
        # AM shift: 5am-5pm (5-16), PM shift: 5pm-5am (17-23, 0-4)
        if self.shift == 'AM':
            return 5 <= current_hour < 17
        elif self.shift == 'PM':
            return current_hour >= 17 or current_hour < 5
        
        return True
