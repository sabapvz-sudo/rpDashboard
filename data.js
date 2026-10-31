/**
 * Google Sheets Integrated Dataset & Data Persistence Layer
 * Source: Google Spreadsheet "my dashboard DB"
 * Sheet: "Orders"
 * Authenticated via Service Account: the-ridge-512107-i1-abf2ee3e5f28.json
 */

const STORAGE_KEY = 'dashboard_google_sheets_v2';

const INITIAL_ORDERS = [
  {
    id: "ORD-0001",
    customer: {
      name: "Sarah Yusuf",
      email: "sarah.yusuf@gmail.com",
      avatar: "SY"
    },
    date: "2026-09-17T12:00:00",
    items: "Hair Brush",
    category: "Personal Care",
    amount: 5.0,
    status: "Delivered",
    priority: "Normal",
    paymentMethod: "Credit Card"
  },
  {
    id: "ORD-0002",
    customer: {
      name: "Anaya Akhtar",
      email: "anaya.akhtar@gmail.com",
      avatar: "AA"
    },
    date: "2026-09-17T12:00:00",
    items: "Hair Brush",
    category: "Personal Care",
    amount: 5.0,
    status: "Delivered",
    priority: "Normal",
    paymentMethod: "Google Pay"
  },
  {
    id: "ORD-0003",
    customer: {
      name: "Mysha Khan",
      email: "mysha.khan@gmail.com",
      avatar: "MK"
    },
    date: "2026-09-17T12:00:00",
    items: "Key Chain",
    category: "Accessories",
    amount: 5.0,
    status: "Delivered",
    priority: "Normal",
    paymentMethod: "Credit Card"
  },
  {
    id: "ORD-0004",
    customer: {
      name: "Sana Ahmed",
      email: "sana.ahmed@gmail.com",
      avatar: "SA"
    },
    date: "2026-10-15T12:00:00",
    items: "Nail Polish",
    category: "Cosmetics",
    amount: 10.0,
    status: "Pending",
    priority: "High",
    paymentMethod: "Google Pay"
  },
  {
    id: "ORD-0005",
    customer: {
      name: "Ahmed Bukhari",
      email: "ahmed.bukhari@gmail.com",
      avatar: "AB"
    },
    date: "2026-10-14T12:00:00",
    items: "Key Chain",
    category: "Accessories",
    amount: 5.0,
    status: "Pending",
    priority: "High",
    paymentMethod: "Credit Card"
  },
  {
    id: "ORD-0006",
    customer: {
      name: "Muhammad Ali",
      email: "muhammad.ali@gmail.com",
      avatar: "MA"
    },
    date: "2026-10-14T12:00:00",
    items: "Face Wash",
    category: "Skincare",
    amount: 15.0,
    status: "Pending",
    priority: "High",
    paymentMethod: "Google Pay"
  },
  {
    id: "ORD-0007",
    customer: {
      name: "Aizza Khan",
      email: "aizza.khan@gmail.com",
      avatar: "AK"
    },
    date: "2026-09-14T12:00:00",
    items: "Hair Color",
    category: "Hair Care",
    amount: 15.0,
    status: "Delivered",
    priority: "Normal",
    paymentMethod: "Credit Card"
  },
  {
    id: "ORD-0008",
    customer: {
      name: "Hira Mir",
      email: "hira.mir@gmail.com",
      avatar: "HM"
    },
    date: "2026-09-14T12:00:00",
    items: "Lipstick",
    category: "Cosmetics",
    amount: 10.0,
    status: "Delivered",
    priority: "Normal",
    paymentMethod: "Google Pay"
  },
  {
    id: "ORD-0009",
    customer: {
      name: "Muhammad Akhtar",
      email: "muhammad.akhtar@gmail.com",
      avatar: "MA"
    },
    date: "2026-10-13T12:00:00",
    items: "Moisturizer",
    category: "Skincare",
    amount: 20.0,
    status: "Pending",
    priority: "High",
    paymentMethod: "Credit Card"
  },
  {
    id: "ORD-0010",
    customer: {
      name: "Ifra Khan",
      email: "ifra.khan@gmail.com",
      avatar: "IK"
    },
    date: "2026-09-13T12:00:00",
    items: "Nail Polish",
    category: "Cosmetics",
    amount: 10.0,
    status: "Delivered",
    priority: "Normal",
    paymentMethod: "Google Pay"
  },
  {
    id: "ORD-0011",
    customer: {
      name: "Sunila Shaukat",
      email: "sunila.shaukat@gmail.com",
      avatar: "SS"
    },
    date: "2026-09-13T12:00:00",
    items: "Lipstick",
    category: "Cosmetics",
    amount: 10.0,
    status: "Delivered",
    priority: "Normal",
    paymentMethod: "Credit Card"
  },
  {
    id: "ORD-0012",
    customer: {
      name: "Asiya Raza",
      email: "asiya.raza@gmail.com",
      avatar: "AR"
    },
    date: "2026-10-12T12:00:00",
    items: "Lipstick",
    category: "Cosmetics",
    amount: 10.0,
    status: "Pending",
    priority: "High",
    paymentMethod: "Google Pay"
  },
  {
    id: "ORD-0013",
    customer: {
      name: "Syed Raza",
      email: "syed.raza@gmail.com",
      avatar: "SR"
    },
    date: "2026-09-11T12:00:00",
    items: "Facewash",
    category: "Skincare",
    amount: 15.0,
    status: "Delivered",
    priority: "Normal",
    paymentMethod: "Credit Card"
  },
  {
    id: "ORD-0014",
    customer: {
      name: "Muzammil Khan",
      email: "muzammil.khan@gmail.com",
      avatar: "MK"
    },
    date: "2026-10-10T12:00:00",
    items: "Key Chain",
    category: "Accessories",
    amount: 5.0,
    status: "Cancelled",
    priority: "Normal",
    paymentMethod: "Google Pay"
  },
  {
    id: "ORD-0015",
    customer: {
      name: "Hasan Raza",
      email: "hasan.raza@gmail.com",
      avatar: "HR"
    },
    date: "2026-09-10T12:00:00",
    items: "Hair Spray",
    category: "Hair Care",
    amount: 15.0,
    status: "Delivered",
    priority: "Normal",
    paymentMethod: "Credit Card"
  }
];

class OrderStore {
  static getOrders() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not read from localStorage, using Google Sheets seed data.", e);
    }
    this.saveOrders(INITIAL_ORDERS);
    return [...INITIAL_ORDERS];
  }

  static saveOrders(orders) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch (e) {
      console.error("Failed to write orders to localStorage", e);
    }
  }

  static async syncWithBackend() {
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.orders)) {
        this.saveOrders(data.orders);
        window.dispatchEvent(new CustomEvent('orders-synced', { detail: data }));
        return data.orders;
      }
    } catch (err) {
      console.info("Backend live sync not active (or offline), using local store:", err.message);
    }
    return this.getOrders();
  }

  static addOrder(newOrder) {
    const orders = this.getOrders();
    orders.unshift(newOrder);
    this.saveOrders(orders);
    return orders;
  }

  static updateOrderStatus(orderId, newStatus) {
    const orders = this.getOrders();
    const target = orders.find(o => o.id === orderId);
    if (target) {
      target.status = newStatus;
      this.saveOrders(orders);
    }
    return orders;
  }

  static deleteOrder(orderId) {
    let orders = this.getOrders();
    orders = orders.filter(o => o.id !== orderId);
    this.saveOrders(orders);
    return orders;
  }

  static resetToDemo() {
    this.saveOrders(INITIAL_ORDERS);
    return [...INITIAL_ORDERS];
  }
}

window.OrderStore = OrderStore;
