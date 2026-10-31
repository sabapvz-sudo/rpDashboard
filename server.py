#!/usr/bin/env python3
"""
PulseCommerce Local HTTP Server with Live Google Sheets Integration
Authenticates with Google Cloud Service Account:
the-ridge-512107-i1-abf2ee3e5f28.json
Fetches real-time data from:
https://docs.google.com/spreadsheets/d/12QHn8PRhJQy9203VwNituq4hirghmy9KolU-2noFRlA
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime

# Ensure UTF-8 output on Windows consoles to prevent cp1252 UnicodeEncodeError
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
KEY_FILE = os.path.join(DIRECTORY, "the-ridge-512107-i1-abf2ee3e5f28.json")
SPREADSHEET_ID = "12QHn8PRhJQy9203VwNituq4hirghmy9KolU-2noFRlA"
SHEET_NAME = "Orders"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

CATEGORY_MAP = {
    "hair brush": "Personal Care",
    "hair color": "Hair Care",
    "hair spray": "Hair Care",
    "lipstick": "Cosmetics",
    "nail polish": "Cosmetics",
    "face wash": "Skincare",
    "facewash": "Skincare",
    "moisturizer": "Skincare",
    "key chain": "Accessories"
}

_cached_orders = None
_last_fetch_time = None

def parse_date(date_str):
    date_str = date_str.strip()
    parts = date_str.split('/')
    if len(parts) == 3:
        d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
        if y < 100:
            y += 2000
        return f"{y:04d}-{m:02d}-{d:02d}T12:00:00"
    return datetime.utcnow().isoformat()

def transform_row(r):
    order_id_num = r[0].strip() if len(r) > 0 else "0"
    cust_raw = r[1].strip() if len(r) > 1 else "Unknown"
    prod_raw = r[2].strip() if len(r) > 2 else "Unknown Item"
    cat_raw = r[3].strip() if len(r) > 3 else ""
    amt_raw = r[4].strip() if len(r) > 4 else "0"
    status_raw = r[5].strip().lower() if len(r) > 5 else "pending"
    date_raw = r[6].strip() if len(r) > 6 else ""

    cust_name = cust_raw.title()
    name_parts = cust_name.split()
    initials = "".join(p[0] for p in name_parts[:2]).upper() if name_parts else "CU"
    email = cust_raw.lower().replace(" ", ".") + "@gmail.com"

    prod_name = prod_raw.title()
    category = cat_raw if cat_raw else CATEGORY_MAP.get(prod_raw.lower(), "Retail")

    try:
        amount = float(amt_raw)
    except ValueError:
        amount = 0.0

    if status_raw in ["completed", "delivered"]:
        status = "Delivered"
    elif status_raw in ["pending"]:
        status = "Pending"
    elif status_raw in ["cancelled", "canceled"]:
        status = "Cancelled"
    elif status_raw in ["processing"]:
        status = "Processing"
    else:
        status = status_raw.capitalize()

    date_iso = parse_date(date_raw)
    priority = "High" if status == "Pending" else "Normal"
    
    try:
        oid_int = int(order_id_num)
        oid_str = f"ORD-{oid_int:04d}"
        payment_method = "Google Pay" if oid_int % 2 == 0 else "Credit Card"
    except ValueError:
        oid_str = f"ORD-{order_id_num}"
        payment_method = "Credit Card"

    return {
        "id": oid_str,
        "customer": {
            "name": cust_name,
            "email": email,
            "avatar": initials
        },
        "date": date_iso,
        "items": prod_name,
        "category": category,
        "amount": amount,
        "status": status,
        "priority": priority,
        "paymentMethod": payment_method
    }

def fetch_from_google_sheets():
    global _cached_orders, _last_fetch_time
    try:
        from google.oauth2 import service_account
        import google.auth.transport.requests

        if not os.path.exists(KEY_FILE):
            print(f"[Google Sheets] Credentials file not found at {KEY_FILE}")
            return _cached_orders or []

        creds = service_account.Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
        auth_req = google.auth.transport.requests.Request()
        creds.refresh(auth_req)
        token = creds.token

        val_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{urllib.parse.quote(SHEET_NAME)}!A1:Z500"
        req = urllib.request.Request(val_url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            values = data.get("values", [])

        if not values or len(values) < 2:
            print("[Google Sheets] No data rows found.")
            return _cached_orders or []

        # Skip header row
        data_rows = values[1:]
        transformed = [transform_row(r) for r in data_rows if r and any(c.strip() for c in r)]
        _cached_orders = transformed
        _last_fetch_time = datetime.utcnow().isoformat()
        print(f"[Google Sheets] Successfully fetched {len(transformed)} orders from sheet '{SHEET_NAME}'.")
        return transformed

    except Exception as e:
        print(f"[Google Sheets Error] {e}")
        if _cached_orders is not None:
            print("[Google Sheets] Returning cached orders.")
            return _cached_orders
        raise

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ['/api/orders', '/api/sync']:
            try:
                orders = fetch_from_google_sheets()
                payload = {
                    "success": True,
                    "source": "Google Sheets",
                    "spreadsheetId": SPREADSHEET_ID,
                    "sheetName": SHEET_NAME,
                    "lastSync": _last_fetch_time or datetime.utcnow().isoformat(),
                    "total": len(orders),
                    "orders": orders
                }
                data_bytes = json.dumps(payload).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(data_bytes)))
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.end_headers()
                self.wfile.write(data_bytes)
                return
            except Exception as e:
                err_bytes = json.dumps({"success": False, "error": str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_bytes)))
                self.end_headers()
                self.wfile.write(err_bytes)
                return

        return super().do_GET()

    def log_message(self, format, *args):
        sys.stdout.write(f"[{self.log_date_time_string()}] {self.address_string()} - {format % args}\n")

def run():
    os.chdir(DIRECTORY)
    print("=" * 65)
    print(f"[*] Initializing PulseCommerce Google Sheets Live Integration...")
    print(f"[*] Credentials: {KEY_FILE}")
    print(f"[*] Spreadsheet: {SPREADSHEET_ID}")
    
    # Pre-fetch on server start
    try:
        orders = fetch_from_google_sheets()
        print(f"[*] Initial sync complete: {len(orders)} orders loaded.")
    except Exception as e:
        print(f"[!] Initial Google Sheets sync warning: {e}")

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 65)
        print(f"[*] PulseCommerce Dashboard is running at: {url}")
        print("=" * 65)
        print("- Press Ctrl+C in this terminal to stop the server.")
        print("- Opening dashboard in your default browser...\n")
        
        try:
            webbrowser.open(url)
        except Exception:
            pass

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server. Goodbye!")
            httpd.server_close()

if __name__ == "__main__":
    run()
