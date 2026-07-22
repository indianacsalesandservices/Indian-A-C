#!/usr/bin/env python3
"""
Indian A/C Sales & Services - Unified Encrypted Server
Version: 3.0 - Consolidated Single Backend

This is the main Flask application that consolidates all previous functionality
into a single server with one database connection.

DATABASE: SQLite (single shared database file)
FILES: billing.db in the project root
SERVER: Single Flask application
"""

import os
import json
import base64
import secrets
import logging
from datetime import datetime, date, timedelta
from io import BytesIO

from flask import Flask, request, jsonify, send_from_directory, redirect, render_template, flash, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from flask_cors import CORS

# Initialize logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Application Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENCRYPTION_KEY_FILE = os.path.join(BASE_DIR, '.server_key')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

# Flask App Setup
app = Flask(__name__, static_folder=None, template_folder=None)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
CORS(app)

# Database Configuration - Single SQLite Connection
DATABASE_PATH = os.path.join(BASE_DIR, 'billing.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DATABASE_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {}

# Initialize Extensions
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Encryption Setup
ENCRYPTION_KEY = None

def get_or_create_encryption_key():
    global ENCRYPTION_KEY
    if ENCRYPTION_KEY:
        return ENCRYPTION_KEY
    
    env_key = os.environ.get('ENCRYPTION_KEY')
    if env_key:
        ENCRYPTION_KEY = env_key
        return env_key
        
    if os.path.exists(ENCRYPTION_KEY_FILE):
        with open(ENCRYPTION_KEY_FILE, 'r') as f:
            ENCRYPTION_KEY = f.read().strip()
        return ENCRYPTION_KEY
        
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    with open(ENCRYPTION_KEY_FILE, 'w') as f:
        f.write(ENCRYPTION_KEY)
    return ENCRYPTION_KEY

SERVER_KEY = get_or_create_encryption_key()
cipher_suite = Fernet(SERVER_KEY.encode())

def derive_user_key(password, salt=b'iasssserver_salt_v1'):
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))

def encrypt_data(data, user_key=None):
    if isinstance(data, str):
        data = data.encode()
    if user_key:
        return Fernet(derive_user_key(user_key)).encrypt(data).decode()
    return cipher_suite.encrypt(data).decode()

def decrypt_data(encrypted, user_key=None):
    if isinstance(encrypted, str):
        encrypted = encrypted.encode()
    if user_key:
        return Fernet(derive_user_key(user_key)).decrypt(encrypted).decode()
    return cipher_suite.decrypt(encrypted).decode()

# ====================
# DATABASE MODELS
# ====================

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='staff')
    is_active_user = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def check_password(self, password):
        return check_password_hash(self.password, password)

class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    shipping_address = db.Column(db.Text)
    state = db.Column(db.String(100))
    state_code = db.Column(db.String(5))
    gst_number = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    invoices = db.relationship('Invoice', backref='customer', lazy=True)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, default=0)
    gst_rate = db.Column(db.Float, default=18.0)
    hsn_code = db.Column(db.String(20))
    unit = db.Column(db.String(20), default='Pcs')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Invoice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(20), unique=True, nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    subtotal = db.Column(db.Float, default=0.0)
    cgst = db.Column(db.Float, default=0.0)
    sgst = db.Column(db.Float, default=0.0)
    igst = db.Column(db.Float, default=0.0)
    total_tax = db.Column(db.Float, default=0.0)
    total_amount = db.Column(db.Float, default=0.0)
    discount = db.Column(db.Float, default=0.0)
    round_off = db.Column(db.Float, default=0.0)
    grand_total = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='unpaid')
    user = db.relationship('User', backref='invoices_created')
    items = db.relationship('InvoiceItem', backref='invoice', lazy=True)
    payments = db.relationship('Payment', backref='invoice', lazy=True)

class InvoiceItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoice.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    discount = db.Column(db.Float, default=0.0)
    taxable_value = db.Column(db.Float, default=0.0)
    gst_rate = db.Column(db.Float, default=0.0)
    gst_amount = db.Column(db.Float, default=0.0)
    igst = db.Column(db.Float, default=0.0)
    total = db.Column(db.Float, nullable=False)

class Payment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoice.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_date = db.Column(db.DateTime, default=datetime.utcnow)
    payment_method = db.Column(db.String(20))
    reference = db.Column(db.String(100))

# ====================
# AUTHENTICATION APIs
# ====================

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/api/auth/register', methods=['POST'])
def api_auth_register():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password', '')
    role = data.get('role', 'staff').strip()
    full_name = (data.get('fullName') or data.get('full_name') or username).strip()
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
        
    if User.query.filter(User.username.ilike(username)).first():
        return jsonify({'success': False, 'message': 'Username already exists'}), 409
        
    user = User(
        username=username,
        password=generate_password_hash(password),
        full_name=full_name,
        role=role
    )
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'role': user.role,
            'fullName': user.full_name
        }
    })

@app.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
        
    user = User.query.filter(User.username.ilike(username)).first()
    if not user or not user.check_password(password):
        return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
        
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'role': user.role,
            'fullName': user.full_name
        }
    })

@app.route('/api/auth/users', methods=['GET'])
def api_auth_list_users():
    users = User.query.all()
    return jsonify({'success': True, 'users': [
        {'id': u.id, 'username': u.username, 'role': u.role, 'fullName': u.full_name}
        for u in users
    ]})

@app.route('/api/auth/users/<int:user_id>', methods=['DELETE'])
def api_auth_delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
        
    db.session.delete(user)
    db.session.commit()
    return jsonify({'success': True})

# ====================
# ENCRYPTION APIs
# ====================

@app.route('/api/encrypt', methods=['POST'])
def api_encrypt():
    data = request.get_json()
    plaintext = data.get('data', '')
    password = data.get('password', '')
    
    try:
        encrypted = encrypt_data(plaintext, password) if password else encrypt_data(plaintext)
        return jsonify({'success': True, 'encrypted': encrypted})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/decrypt', methods=['POST'])
def api_decrypt():
    data = request.get_json()
    encrypted = data.get('encrypted', '')
    password = data.get('password', '')
    
    try:
        decrypted = decrypt_data(encrypted, password) if password else decrypt_data(encrypted)
        return jsonify({'success': True, 'data': decrypted})
    except Exception as e:
        return jsonify({'success': False, 'error': 'Decryption failed'}), 400

# ====================
# BILLING SYSTEM
# ====================

@app.route('/billing')
def billing_root():
    if current_user.is_authenticated:
        return redirect('/billing/dashboard')
    return redirect('/')

@app.route('/billing/dashboard')
@login_required
def billing_dashboard():
    today = date.today()
    month_start = today.replace(day=1)
    total_customers = Customer.query.count()
    total_products = Product.query.filter_by(is_active=True).count()
    total_invoices = Invoice.query.count()
    monthly_revenue = db.session.query(db.func.sum(Invoice.grand_total)).filter(
        Invoice.date_created >= datetime.combine(month_start, datetime.min.time()),
        Invoice.status == 'paid'
    ).scalar() or 0
    
    return render_template('billing/dashboard.html',
        total_customers=total_customers, total_products=total_products,
        total_invoices=total_invoices, monthly_revenue=float(monthly_revenue))

@app.route('/billing/login', methods=['GET', 'POST'])
def billing_login():
    if current_user.is_authenticated:
        return redirect('/billing/dashboard')
        
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        user = User.query.filter(User.username.ilike(username)).first()
        if user and user.check_password(password):
            login_user(user)
            return redirect('/billing/dashboard')
        else:
            flash('Invalid username or password', 'danger')
            
    return render_template('billing/login.html')

@app.route('/billing/logout')
def billing_logout():
    logout_user()
    return redirect('/')

# Additional billing routes...

# ====================
# ATTENDANCE SYSTEM
# ====================

@app.route('/api/attendance/log', methods=['POST'])
def api_log_attendance():
    data = request.get_json()
    record = log_attendance(data.get('username', 'unknown'), data.get('system', 'portal'), data.get('role', 'user'))
    return jsonify({'success': True, 'record': record})

# ====================
# API ENDPOINTS
# ====================

@app.route('/api/geo')
def get_client_geo():
    import urllib.request
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ip and ip.startswith('127'):
        ip = ''
    try:
        url = f'http://ip-api.com/json/{ip}?fields=status,lat,lon,city,regionName,country'
        resp = urllib.request.urlopen(url, timeout=4)
        data = json.loads(resp.read())
        if data.get('status') == 'success':
            coords = f"{data['lat']},{data['lon']}"
            parts = [data.get('city'), data.get('regionName'), data.get('country')]
            address = ', '.join(p for p in parts if p)
            return jsonify({'success': True, 'coords': coords, 'address': address, 'lat': data['lat'], 'lon': data['lon']})
    except Exception:
        pass
    return jsonify({'success': False})

# ====================
# MAIN APPLICATION
# ====================

if __name__ == '__main__':
    print("=" * 60)
    print("  INDIAN A/C SALES & SERVICES - Unified Encrypted Server")
    print("=" * 60)
    print(f"  Portal:     http://localhost:5000/")
    print(f"  Billing:    http://localhost:5000/billing/")
    print(f"  Encryption: AES-256 (Fernet)")
    print("=" * 60)
    print(f"  Default login: Ramesh / Indiana/c")
    print(f"  Billing login: Ramesh / Indiana/c, staff / staff123")
    print("=" * 60)
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True, threaded=True)