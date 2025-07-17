# -- LOCAL SQL SETUP
from db import init_db, add_order
init_db()

# -- MONGODB SETUP
import os
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv

load_dotenv()

# For later, when online sync is implemented
# uri = os.getenv("MONGO_URI")
# client = MongoClient(uri, server_api=ServerApi('1'))

# try:
#     client.admin.command('ping')
#     print("Pinged your deployment. You successfully connected to MongoDB!")
# except Exception as e:
#     print(e)

# -- FLASK Setup
from flask import Flask, render_template, request
app = Flask(__name__)

@app.route('/')
def hello_world():
    print('[DEBUG] main route loaded')
    return render_template('index.html')

@app.route('/add_record_entry', methods=['POST'])
def add_record_entry():
    data = request.get_json()
    print(f"Received:\n{data}")
    
    add_order(data)

    # vehicleType = request.form['vehicleType']
    # amount = request.form['amount']
    # paymentMode = request.form['paymentMode']
    # plateNumber = request.form['plateNumber']
    
    # addon_names = request.form.getlist('addon_name[]')
    # addon_prices = request.form.getlist('addon_price[]')

    # addons = list(zip(addon_names, addon_prices))

    # SSS = 2
    # VAC = 5 if "vacuum" in addon_names else 0

    # rent = int(amount) - 40 
    # cetadcco_share = rent * 0.7
    # carwasher_share = (rent * 0.3) - (SSS + VAC)

    # print(f"""
    # [DEBUG] New Entry added\n
    # Entry data:\n 
    # \tvehicleType: {vehicleType}\n 
    # \tamount: {amount}\n 
    # \tpaymentMode: {paymentMode}\n 
    # \tplateNumber: {plateNumber}\n\n
    # \tRent: {rent}\n 
    # \tCetadcco Share: {cetadcco_share}\n
    # \tCarwasher Share: {carwasher_share}\n
    # Addons:\n
    # \t{addons}
    # """)

    # todo: return user to pos, add to mongodb
    # todo: finalize database format

    return {"response": "Success"}

if __name__ == '__main__':
    app.run(debug=True) 