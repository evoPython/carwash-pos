from flask import Flask, render_template, request, jsonify
from config import Config
from db import init_db, add_order, start_sync_thread, get_db
from db.models import Order

def create_app():
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.config.from_object(Config)

    init_db()
    if Config.SYNC_ENABLED:
        start_sync_thread()

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/orders", methods=["POST"])
    def api_add_order():
        data = request.get_json()
        if not data:
            return jsonify({"error": "invalid JSON"}), 400
        oid = add_order(data)
        return jsonify({"status": "ok", "id": oid}), 201

    @app.route("/api/orders", methods=["GET"])
    def api_list_orders():
        date  = request.args.get("date")
        month = request.args.get("month")
        clause = "SELECT data FROM orders"
        params = []
        if date:
            clause += ' WHERE data LIKE ?'
            params.append(f'%"{date}"%')
        elif month:
            clause += ' WHERE data LIKE ?'
            params.append(f'%"{month}%')
        with get_db() as conn:
            rows = conn.execute(clause, params).fetchall()
        orders = [Order.deserialize(r[0]) for r in rows]
        return jsonify(orders), 200

    @app.route("/api/summary", methods=["GET"])
    def api_summary():
        date  = request.args.get("date")
        month = request.args.get("month")
        clause = "SELECT data FROM orders"
        params = []
        if date:
            clause += ' WHERE data LIKE ?'
            params.append(f'%"{date}"%')
        elif month:
            clause += ' WHERE data LIKE ?'
            params.append(f'%"{month}%')
        with get_db() as conn:
            rows = conn.execute(clause, params).fetchall()
        orders = [Order.deserialize(r[0]) for r in rows]

        total_income         = sum(o.get("base_price", 0) + sum(o.get("addons", {}).values()) for o in orders)
        total_expenses       = sum(o.get("rent", 0) for o in orders)
        total_cetadcco_share = sum(o.get("cetadcco_share", 0) for o in orders)
        total_carwasher      = sum(o.get("carwasher_share", 0) for o in orders)

        return jsonify({
            "income": total_income,
            "expenses": total_expenses,
            "cetadcco_share": total_cetadcco_share,
            "carwasher_share": total_carwasher
        }), 200

    return app

if __name__ == "__main__":
    create_app().run(debug=True, port=5000)
