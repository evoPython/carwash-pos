from flask import Flask, render_template, request

app = Flask(__name__)

@app.route('/')
def hello_world():
    """
    This function handles requests to the home page and returns "Hello, World!".
    """
    print('[DEBUG] main route loaded')
    return render_template('index.html')

@app.route('/add_record_entry', methods=['POST'])
def add_record_entry():
    vehicleType = request.form['vehicleType']
    amount = request.form['amount']
    paymentMode = request.form['paymentMode']
    plateNumber = request.form['plateNumber']
    
    addon_names = request.form.getlist('addon_name[]')
    addon_prices = request.form.getlist('addon_price[]')

    addons = list(zip(addon_names, addon_prices))

    print(f"""
    [DEBUG] New Entry added\n
    Entry data:\n 
    \tvehicleType: {vehicleType}\n 
    \tamount: {amount}\n 
    \tpaymentMode: {paymentMode}\n 
    \tplateNumber: {plateNumber}\n 
    Addons:\n
    \t{addons}
    """)

    return "Success"

if __name__ == '__main__':
    app.run(debug=True) 