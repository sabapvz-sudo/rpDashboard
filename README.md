# PulseCommerce Analytics & Operations Dashboard

A modern, responsive, high-performance web dashboard engineered to monitor core e-commerce metrics: **Total Revenue**, **Total Orders**, **Average Order Value (AOV)**, and **Pending Orders Alert Count**.

---

## 🌟 Key Metric Displays & Logic

| Metric | Calculation / Definition | Interactive Behavior |
| :--- | :--- | :--- |
| **Total Revenue** | Sum of all completed and in-flight transactions (excluding cancelled orders) | Dynamically updates when date range changes or new orders are added |
| **Total Orders** | Total transaction count across all categories | Shows completed vs processing ratio |
| **Average Order Value (AOV)** | \(\frac{\text{Total Revenue}}{\text{Active Orders}}\) | Real-time recalculation, tracks basket size health |
| **Pending Orders Alert Count** | Orders with status `Pending` | **Urgent pulse badge** + banner callout with one-click queue filtering |

---

## 🚀 Quick Start Guide

### Option 1: Double-Click (Zero Setup)
Simply double-click **`run.bat`** or double-click **`index.html`** in File Explorer to open directly in your web browser.

### Option 2: Python Local Server (Live Google Sheets Sync)
Run the included Python 3 HTTP server:
```bash
python server.py
```
This serves the application at **`http://localhost:8000`**, automatically authenticates using [the-ridge-512107-i1-abf2ee3e5f28.json](file:///c:/Users/saba_/OneDrive/Documents/Dashboard/the-ridge-512107-i1-abf2ee3e5f28.json), fetches live transactions from the **"my dashboard DB"** Google Sheet (`12QHn8PRhJQy9203VwNituq4hirghmy9KolU-2noFRlA`), and launches the dashboard in your default browser.

---

## 📊 Live Google Sheets Data Source
- **Spreadsheet**: [my dashboard DB](https://docs.google.com/spreadsheets/d/12QHn8PRhJQy9203VwNituq4hirghmy9KolU-2noFRlA/edit?gid=0#gid=0)
- **Worksheet**: `Orders`
- **Authentication**: Google Cloud Service Account `robdashboard@the-ridge-512107-i1.iam.gserviceaccount.com`
- **Fields Synchronized**:
  - `Order_ID` &rarr; Order Code (`ORD-0001` ... `ORD-0015`)
  - `Customer_Name` &rarr; Full customer profile & avatar initials
  - `Product_Name` &rarr; Line item name & automated retail categorization
  - `Amount_USD` &rarr; Transaction volume & KPI aggregations
  - `Status` &rarr; Fulfillment pipeline (`completed` &rarr; Delivered, `pending` &rarr; Pending, `cancelled` &rarr; Cancelled)
  - `Order_Date` &rarr; Transaction timestamping & timeline charts

---

## 🛠️ Feature Set

- **4 Core KPI Cards**: Real-time summary tiles with trend indicators, sparklines, and sub-metric breakdowns.
- **High-Visibility Pending Alert Banner**: Highlights backlogged orders requiring fulfillment attention with a one-click "Process Oldest" or "View Queue" button.
- **Interactive Visualizations (Chart.js)**:
  - **Revenue & Orders Trend**: Dual-axis line and bar chart with view toggles (Combined, Revenue Only, Orders Only).
  - **Fulfillment Status**: Doughnut chart showing status shares (Delivered, Processing, Pending, Cancelled) and delivery fulfillment rate.
- **Orders Management Table**:
  - Live instant search across Customer Name, Email, Order ID, and Product Items.
  - Status filter tabs with dynamic count badges (`All`, `Pending`, `Processing`, `Delivered`, `Cancelled`).
  - In-line status selector: Change order status on the fly (e.g. from `Pending` to `Delivered`) to see all 4 KPIs update instantaneously.
  - Quick fulfillment and delete actions.
  - Pagination controls.
- **Add New Order Modal**: Add custom transactions to test KPI recalculation in real time.
- **Export to CSV**: Export current table view with one click.
- **Dark / Light Theme Toggle**: Seamless UI switching with persistent theme memory.
- **Reset Demo Data**: Easily restore initial demonstration data at any time.

---

## 📂 Project Architecture

```
Dashboard/
├── index.html       # Primary layout, KPI cards, charts canvas & table
├── styles.css       # Custom animations (urgent pulse), typography & themes
├── app.js           # Core calculation engine, Chart.js logic, event handlers
├── data.js          # Initial realistic transaction dataset & LocalStorage store
├── server.py        # Lightweight Python HTTP server with auto-browser opening
├── run.bat          # 1-click Windows launcher
└── README.md        # Documentation and operational manual
```
