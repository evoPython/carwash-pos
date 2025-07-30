from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user
from config import Config
from db import (init_db, add_order, start_sync_thread, get_db,
                get_user_by_username, create_user, get_all_users,
                get_user_by_id, update_user_role, activate_user,
                deactivate_user, change_user_password, update_user_shift)
from db.models import Order, User, Role
from auth import (init_auth, authenticate_user, require_login,
                  require_admin, require_developer, get_redirect_target)

def create_app():
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.config.from_object(Config)
    
    # Configure session settings for better persistence
    app.permanent_session_lifetime = app.config['PERMANENT_SESSION_LIFETIME']

    # Initialize authentication
    init_auth(app)

    init_db()
    if Config.SYNC_ENABLED:
        start_sync_thread()

    # ============================================
    # AUTHENTICATION ROUTES
    # ============================================
    
    @app.route("/login", methods=["GET", "POST"])
    def login():
        """User login route."""
        if current_user.is_authenticated:
            return redirect(url_for('index'))
        
        if request.method == "POST":
            username = request.form.get('username')
            password = request.form.get('password')
            remember_me = bool(request.form.get('remember_me'))
            
            if not username or not password:
                flash('Please enter both username and password.', 'error')
                return render_template('login.html')
            
            user = authenticate_user(username, password)
            if user:
                login_user(user, remember=remember_me)
                if remember_me:
                    from flask import session
                    session.permanent = True

                # Redirect directly to dashboard (no welcome message)
                next_page = get_redirect_target()
                return redirect(next_page or url_for('index'))
            else:
                flash('Invalid username or password.', 'error')
        
        return render_template('login.html')
    
    @app.route("/register", methods=["GET", "POST"])
    def register():
        """User registration route."""
        if current_user.is_authenticated:
            return redirect(url_for('index'))
        
        if request.method == "POST":
            username = request.form.get('username')
            full_name = request.form.get('full_name')
            password = request.form.get('password')
            confirm_password = request.form.get('confirm_password')
            role = request.form.get('role')
            shift = request.form.get('shift')
            
            # Validation
            if not all([username, full_name, password, confirm_password, role]):
                flash('All fields are required.', 'error')
                return render_template('register.html')
            
            if password != confirm_password:
                flash('Passwords do not match.', 'error')
                return render_template('register.html')
            
            if len(password) < 6:
                flash('Password must be at least 6 characters long.', 'error')
                return render_template('register.html')
            
            if role not in Role.get_all_roles():
                flash('Invalid role selected.', 'error')
                return render_template('register.html')
            
            # For incharges, shift is required
            if role == 'Incharge' and not shift:
                flash('Shift selection is required for Incharge role.', 'error')
                return render_template('register.html')
            
            # Validate shift value
            if shift and shift not in ['AM', 'PM']:
                flash('Invalid shift selected.', 'error')
                return render_template('register.html')
            
            try:
                user_id = create_user(username, full_name, password, role, shift)
                flash('Account created successfully! You can now log in.', 'success')
                return redirect(url_for('login'))
            except ValueError as e:
                flash(str(e), 'error')
        
        return render_template('register.html')
    
    @app.route("/logout")
    @login_required
    def logout():
        """User logout route."""
        logout_user()
        return redirect(url_for('login'))

    # ============================================
    # MAIN APPLICATION ROUTES
    # ============================================

    @app.route("/")
    @require_login
    def index():
        """Main dashboard - requires login."""
        # Allow all users to access the dashboard
        
        return render_template("index.html")
    
    @app.route("/users")
    @require_admin
    def users():
        """User management page - requires admin access."""
        return render_template("users.html")

    # ============================================
    # ORDER API ROUTES (Protected)
    # ============================================
    
    @app.route("/api/orders", methods=["POST"])
    @require_login
    def api_add_order():
        """Add new order - requires login."""
        data = request.get_json()
        if not data:
            return jsonify({"error": "invalid JSON"}), 400
        oid = add_order(data)
        return jsonify({"status": "ok", "id": oid}), 201

    @app.route("/api/orders", methods=["GET"])
    @require_login
    def api_list_orders():
        """List orders - requires login with role-based filtering."""
        from datetime import datetime, time
        import pytz

        date = request.args.get("date")
        month = request.args.get("month")

        # Base query for new order structure
        clause = """
            SELECT id, vehicle_name, plate_no, w_vac, addons, price, less_40,
                   c_shares, w_share, w_name, sss, timestamp, shift, created_by
            FROM orders WHERE 1=1
        """
        params = []

        # Date/month filtering
        if date:
            clause += ' AND DATE(timestamp) = ?'
            params.append(date)
        elif month:
            clause += ' AND strftime("%Y-%m", timestamp) = ?'
            params.append(month)

        # Get current user's full name and role
        current_user_full_name = current_user.full_name
        current_user_role = current_user.role

        # Check if user is admin or developer
        is_admin_or_dev = current_user_role in ['Admin', 'Developer']

        # Apply filtering based on user type
        if not is_admin_or_dev:
            # For regular users, filter by W-Name and timestamp day
            # Get current day in Manila timezone
            manila_tz = pytz.timezone('Asia/Manila')
            current_day = datetime.now(manila_tz).strftime('%Y-%m-%d')

            # Add conditions for W-Name and timestamp day
            clause += ' AND w_name = ? AND DATE(timestamp) = ?'
            params.append(current_user_full_name)
            params.append(current_day)

        with get_db() as conn:
            rows = conn.execute(clause, params).fetchall()

        # Convert to the expected format
        orders = []
        for row in rows:
            order = {
                'id': row[0],
                'vehicle_name': row[1],
                'plate_no': row[2],
                'w_vac': row[3],
                'addons': row[4],  # Store as string
                'price': row[5],
                'less_40': row[6],
                'c_shares': row[7],
                'w_share': row[8],
                'w_name': row[9],
                'sss': row[10],
                'timestamp': row[11],
                'shift': row[12],
                'created_by': row[13]
            }
            orders.append(order)

        return jsonify(orders), 200

    @app.route("/api/summary", methods=["GET"])
    @require_login
    def api_summary():
        """Get financial summary - admin/dev only."""
        # Only admin/dev can see financial summaries
        if current_user.role == 'Incharge':
            return jsonify({"error": "Access denied"}), 403
        
        from datetime import datetime
        
        date = request.args.get("date")
        month = request.args.get("month")
        
        clause = "SELECT price, c_shares, w_share FROM orders WHERE 1=1"
        params = []
        
        if date:
            clause += ' AND DATE(timestamp) = ?'
            params.append(date)
        elif month:
            clause += ' AND strftime("%Y-%m", timestamp) = ?'
            params.append(month)
        
        with get_db() as conn:
            rows = conn.execute(clause, params).fetchall()
        
        total_income = sum(row[0] for row in rows)
        total_expenses = len(rows) * 40  # LESS 40 per order
        total_cetadcco_share = sum(row[1] for row in rows)
        total_carwasher_share = sum(row[2] for row in rows)

        return jsonify({
            "income": total_income,
            "expenses": total_expenses,
            "cetadcco_share": total_cetadcco_share,
            "carwasher_share": total_carwasher_share
        }), 200

    # ============================================
    # USER MANAGEMENT API ROUTES (Admin Only)
    # ============================================
    
    @app.route("/api/users", methods=["GET"])
    @require_admin
    def api_list_users():
        """List all users - admin only."""
        try:
            users = get_all_users()
            return jsonify([user.to_dict() for user in users]), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/<int:user_id>", methods=["GET"])
    @require_admin
    def api_get_user(user_id):
        """Get specific user - admin only."""
        try:
            user = get_user_by_id(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404
            return jsonify(user.to_dict()), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/create", methods=["POST"])
    @require_admin
    def api_create_user():
        """Create new user - admin only."""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            username = data.get('username')
            full_name = data.get('full_name')
            password = data.get('password')
            role = data.get('role')
            shift_start = data.get('shift_start')
            shift_end = data.get('shift_end')
            
            if not all([username, full_name, password, role]):
                return jsonify({"error": "Missing required fields"}), 400
            
            if role not in Role.get_all_roles():
                return jsonify({"error": "Invalid role"}), 400
            
            # For incharges, shift times are required
            if role == 'Incharge' and (not shift_start or not shift_end):
                return jsonify({"error": "Shift times required for Incharge role"}), 400
            
            user_id = create_user(username, full_name, password, role, shift_start, shift_end)
            return jsonify({"message": "User created successfully", "id": user_id}), 201
            
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/update", methods=["POST"])
    @require_admin
    def api_update_user():
        """Update user - admin only."""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            user_id = data.get('user_id')
            if not user_id:
                return jsonify({"error": "User ID required"}), 400
            
            user = get_user_by_id(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404
            
            # Update role if provided
            if 'role' in data and data['role'] != user.role:
                if data['role'] not in Role.get_all_roles():
                    return jsonify({"error": "Invalid role"}), 400
                update_user_role(user_id, data['role'])
            
            # Update password if provided
            if 'password' in data and data['password']:
                if len(data['password']) < 6:
                    return jsonify({"error": "Password must be at least 6 characters"}), 400
                change_user_password(user_id, data['password'])
            
            # Update active status if provided
            if 'is_active' in data:
                if data['is_active']:
                    activate_user(user_id)
                else:
                    deactivate_user(user_id)
            
            # Update shift times if provided
            if 'shift_start' in data and 'shift_end' in data:
                update_user_shift(user_id, data['shift_start'], data['shift_end'])
            
            return jsonify({"message": "User updated successfully"}), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/<int:user_id>/activate", methods=["POST"])
    @require_admin
    def api_activate_user(user_id):
        """Activate user - admin only."""
        try:
            if activate_user(user_id):
                return jsonify({"message": "User activated successfully"}), 200
            else:
                return jsonify({"error": "User not found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/<int:user_id>/deactivate", methods=["POST"])
    @require_admin
    def api_deactivate_user(user_id):
        """Deactivate user - admin only."""
        try:
            if deactivate_user(user_id):
                return jsonify({"message": "User deactivated successfully"}), 200
            else:
                return jsonify({"error": "User not found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return app

if __name__ == "__main__":
    create_app().run(debug=True, port=5000)
