/**
 * Pulse Cycles Dashboard Application Logic
 * Implements real-time KPI computations, dynamic Chart.js visualizations,
 * status change workflows, search/filtering, and responsive theme support.
 */

(function () {
  'use strict';

  // --- STATE MANAGEMENT ---
  const state = {
    orders: [],
    dateRange: 'all',
    statusFilter: 'all',
    searchQuery: '',
    sortField: 'date',
    sortAsc: false,
    currentPage: 1,
    pageSize: 8,
    chartView: 'both', // 'both' | 'rev' | 'orders'
    isDark: false,
  };

  let revenueChart = null;
  let statusChart = null;

  // --- HELPER FORMATTERS ---
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // --- INITIALIZATION ---
  function init() {
    initTheme();
    loadOrders();
    setupEventListeners();
    updateDashboard();
    initLastSync();

    // Trigger live Google Sheets sync in the background
    if (window.OrderStore && window.OrderStore.syncWithBackend) {
      window.OrderStore.syncWithBackend().then(orders => {
        if (orders && orders.length) {
          state.orders = orders;
          updateDashboard();
          initLastSync();
          const sheetBadge = document.getElementById('sheet-sync-status');
          if (sheetBadge) {
            sheetBadge.classList.remove('hidden');
            sheetBadge.textContent = 'Google Sheet Live (' + orders.length + ' orders)';
          }
        }
      });
    }

    window.addEventListener('orders-synced', (e) => {
      if (e.detail && e.detail.orders) {
        state.orders = e.detail.orders;
        updateDashboard();
        initLastSync();
      }
    });
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('pulse_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    state.isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
    applyTheme();
  }

  function applyTheme() {
    const html = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    if (state.isDark) {
      html.classList.add('dark');
      localStorage.setItem('pulse_theme', 'dark');
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('pulse_theme', 'light');
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
    }
    if (window.lucide) lucide.createIcons();
    if (revenueChart && statusChart) {
      updateChartsTheme();
    }
  }

  function toggleTheme() {
    state.isDark = !state.isDark;
    applyTheme();
  }

  function loadOrders() {
    state.orders = window.OrderStore.getOrders();
  }

  function initLastSync() {
    const el = document.getElementById('last-sync-time');
    if (el) {
      el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  // --- FILTERING LOGIC ---
  function getFilteredOrdersByDate() {
    if (state.dateRange === 'all') {
      return [...state.orders];
    }

    // Find the latest date present in orders or default to now
    let maxDate = new Date();
    state.orders.forEach(o => {
      const d = new Date(o.date);
      if (d > maxDate) maxDate = d;
    });

    const now = maxDate.getTime();
    let daysToSubtract = 30;
    if (state.dateRange === '7d') daysToSubtract = 7;
    if (state.dateRange === 'today') daysToSubtract = 1;

    const cutoff = now - daysToSubtract * 24 * 60 * 60 * 1000;
    return state.orders.filter(o => new Date(o.date).getTime() >= cutoff);
  }

  // --- KPI CALCULATIONS ---
  function computeMetrics(orders) {
    // Non-cancelled orders represent real sales revenue
    const nonCancelled = orders.filter(o => o.status !== 'Cancelled');
    const completedOrders = orders.filter(o => o.status === 'Delivered');
    const processingOrders = orders.filter(o => o.status === 'Processing');
    const pendingOrders = orders.filter(o => o.status === 'Pending');

    const totalRevenue = nonCancelled.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const totalOrdersCount = orders.length;

    // Average Order Value = Total Revenue / non-cancelled orders (or total orders)
    const activeOrderCount = nonCancelled.length;
    const averageOrderValue = activeOrderCount > 0 ? totalRevenue / activeOrderCount : 0;

    const pendingCount = pendingOrders.length;
    const pendingAmount = pendingOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const completedRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0) + processingOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    const maxOrderValue = orders.length > 0 ? Math.max(...orders.map(o => Number(o.amount) || 0)) : 0;

    return {
      totalRevenue,
      totalOrdersCount,
      averageOrderValue,
      pendingCount,
      pendingAmount,
      completedOrdersCount: completedOrders.length,
      processingCount: processingOrders.length,
      cancelledCount: orders.filter(o => o.status === 'Cancelled').length,
      completedRevenue,
      maxOrderValue,
    };
  }

  // --- RENDER KPI CARDS & ALERT BANNER ---
  function renderKPIs(metrics) {
    // 1. Total Revenue
    const elRevenue = document.getElementById('kpi-total-revenue');
    if (elRevenue) elRevenue.textContent = formatCurrency(metrics.totalRevenue);

    const elRevBreakdown = document.getElementById('kpi-revenue-breakdown');
    if (elRevBreakdown) elRevBreakdown.textContent = formatCurrency(metrics.completedRevenue);

    // 2. Total Orders
    const elOrders = document.getElementById('kpi-total-orders');
    if (elOrders) elOrders.textContent = metrics.totalOrdersCount.toLocaleString();

    const elDeliveredCount = document.getElementById('kpi-delivered-count');
    if (elDeliveredCount) {
      elDeliveredCount.textContent = `${metrics.completedOrdersCount} shipped (${metrics.processingCount} proc.)`;
    }

    // 3. Average Order Value
    const elAOV = document.getElementById('kpi-avg-order-value');
    if (elAOV) elAOV.textContent = formatCurrency(metrics.averageOrderValue);

    const elMaxAOV = document.getElementById('kpi-max-order-value');
    if (elMaxAOV) elMaxAOV.textContent = formatCurrency(metrics.maxOrderValue);

    // 4. Pending Orders Alert Count
    const elPending = document.getElementById('kpi-pending-count');
    if (elPending) elPending.textContent = metrics.pendingCount.toString();

    const elPendingAmt = document.getElementById('kpi-pending-amount');
    if (elPendingAmt) elPendingAmt.textContent = `${formatCurrency(metrics.pendingAmount)} backlog`;

    // Alert State Visual Styling
    const pendingDot = document.getElementById('kpi-pending-pulse-dot');
    const pendingBadge = document.getElementById('kpi-pending-badge-text');
    const alertBanner = document.getElementById('pending-alert-banner');
    const bannerPendingPill = document.getElementById('banner-pending-pill');

    if (metrics.pendingCount > 0) {
      if (pendingDot) pendingDot.classList.remove('hidden');
      if (pendingBadge) {
        pendingBadge.className = 'text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300';
        pendingBadge.textContent = 'Needs Attention';
      }
      if (alertBanner) {
        alertBanner.classList.remove('hidden');
      }
      if (bannerPendingPill) {
        bannerPendingPill.textContent = `${metrics.pendingCount} Pending`;
      }
    } else {
      if (pendingDot) pendingDot.classList.add('hidden');
      if (pendingBadge) {
        pendingBadge.className = 'text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300';
        pendingBadge.textContent = 'All Clear ✓';
      }
      if (alertBanner) {
        alertBanner.classList.add('hidden');
      }
    }

    // Status breakdown rates
    const deliveredRateEl = document.getElementById('rate-delivered');
    const pendingRateEl = document.getElementById('rate-pending');
    if (deliveredRateEl) {
      const rate = metrics.totalOrdersCount > 0 ? Math.round((metrics.completedOrdersCount / metrics.totalOrdersCount) * 100) : 0;
      deliveredRateEl.textContent = `${rate}%`;
    }
    if (pendingRateEl) {
      const rate = metrics.totalOrdersCount > 0 ? Math.round((metrics.pendingCount / metrics.totalOrdersCount) * 100) : 0;
      pendingRateEl.textContent = `${rate}%`;
    }
  }

  // --- CHART RENDERING ---
  function updateCharts(orders) {
    renderRevenueOrdersChart(orders);
    renderStatusDoughnutChart(orders);
  }

  function getChartThemeColors() {
    const isDark = state.isDark;
    return {
      textColor: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)',
      tooltipBg: isDark ? '#0f172a' : '#ffffff',
      tooltipBorder: isDark ? '#334155' : '#e2e8f0',
      tooltipText: isDark ? '#f8fafc' : '#0f172a',
    };
  }

  function updateChartsTheme() {
    if (revenueChart) {
      const colors = getChartThemeColors();
      revenueChart.options.scales.x.ticks.color = colors.textColor;
      revenueChart.options.scales.x.grid.color = colors.gridColor;
      if (revenueChart.options.scales.y) {
        revenueChart.options.scales.y.ticks.color = colors.textColor;
        revenueChart.options.scales.y.grid.color = colors.gridColor;
      }
      if (revenueChart.options.scales.y1) {
        revenueChart.options.scales.y1.ticks.color = colors.textColor;
        revenueChart.options.scales.y1.grid.color = 'transparent';
      }
      revenueChart.update();
    }
    if (statusChart) {
      statusChart.update();
    }
  }

  function renderRevenueOrdersChart(orders) {
    const ctx = document.getElementById('revenueOrdersChart');
    if (!ctx) return;

    // Group orders by date (YYYY-MM-DD)
    const grouped = {};
    const sorted = [...orders].sort((a, b) => new Date(a.date) - new Date(b.date));

    sorted.forEach(o => {
      const d = o.date.split('T')[0];
      if (!grouped[d]) {
        grouped[d] = { revenue: 0, orders: 0 };
      }
      grouped[d].orders += 1;
      if (o.status !== 'Cancelled') {
        grouped[d].revenue += Number(o.amount) || 0;
      }
    });

    const labels = Object.keys(grouped).map(k => {
      const parts = k.split('-');
      return `${parts[1]}/${parts[2]}`;
    });
    const revenueData = Object.values(grouped).map(g => Number(g.revenue.toFixed(2)));
    const ordersData = Object.values(grouped).map(g => g.orders);

    const colors = getChartThemeColors();

    const datasets = [];

    // Revenue dataset
    if (state.chartView === 'both' || state.chartView === 'rev') {
      datasets.push({
        label: 'Revenue ($)',
        data: revenueData,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
        yAxisID: 'y',
        type: 'line',
      });
    }

    // Orders dataset
    if (state.chartView === 'both' || state.chartView === 'orders') {
      datasets.push({
        label: 'Order Volume',
        data: ordersData,
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        hoverBackgroundColor: '#4f46e5',
        borderRadius: 6,
        yAxisID: state.chartView === 'both' ? 'y1' : 'y',
        type: 'bar',
      });
    }

    if (revenueChart) {
      revenueChart.destroy();
    }

    revenueChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 },
              color: colors.textColor,
            },
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 10,
            callbacks: {
              label: function (context) {
                if (context.dataset.label.includes('Revenue')) {
                  return ` Revenue: ${formatCurrency(context.raw)}`;
                }
                return ` Orders: ${context.raw}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, font: { family: 'Plus Jakarta Sans', size: 10 } },
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: colors.gridColor },
            ticks: {
              color: colors.textColor,
              font: { family: 'Plus Jakarta Sans', size: 10 },
              callback: function (val) {
                return state.chartView === 'orders' ? val : '$' + val;
              },
            },
          },
          y1: {
            type: 'linear',
            display: state.chartView === 'both',
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: colors.textColor,
              font: { family: 'Plus Jakarta Sans', size: 10 },
              stepSize: 1,
            },
          },
        },
      },
    });
  }

  function renderStatusDoughnutChart(orders) {
    const ctx = document.getElementById('statusDoughnutChart');
    if (!ctx) return;

    let delivered = 0;
    let processing = 0;
    let pending = 0;
    let cancelled = 0;

    orders.forEach(o => {
      if (o.status === 'Delivered') delivered++;
      else if (o.status === 'Processing') processing++;
      else if (o.status === 'Pending') pending++;
      else if (o.status === 'Cancelled') cancelled++;
    });

    const data = [delivered, processing, pending, cancelled];
    const labels = ['Delivered', 'Processing', 'Pending', 'Cancelled'];
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
    const theme = getChartThemeColors();

    if (statusChart) {
      statusChart.destroy();
    }

    statusChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: colors,
            hoverOffset: 6,
            borderWidth: 2,
            borderColor: state.isDark ? '#0f172a' : '#ffffff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              font: { family: 'Plus Jakarta Sans', size: 11, weight: 500 },
              color: theme.textColor,
              padding: 12,
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            padding: 10,
            callbacks: {
              label: function (context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.raw || 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${context.label}: ${val} (${pct}%)`;
              },
            },
          },
        },
        cutout: '70%',
      },
    });
  }

  // --- ORDERS TABLE MANAGEMENT ---
  function getTableOrders() {
    let list = getFilteredOrdersByDate();

    // Status filter tab
    if (state.statusFilter !== 'all') {
      list = list.filter(o => o.status === state.statusFilter);
    }

    // Search query filter
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.email.toLowerCase().includes(q) ||
        o.items.toLowerCase().includes(q) ||
        o.category.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      let valA, valB;
      if (state.sortField === 'amount') {
        valA = Number(a.amount);
        valB = Number(b.amount);
      } else if (state.sortField === 'date') {
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
      } else {
        valA = a.id;
        valB = b.id;
      }
      return state.sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return list;
  }

  function renderStatusPills(orders) {
    const allCount = orders.length;
    const pendingCount = orders.filter(o => o.status === 'Pending').length;
    const processingCount = orders.filter(o => o.status === 'Processing').length;
    const deliveredCount = orders.filter(o => o.status === 'Delivered').length;
    const cancelledCount = orders.filter(o => o.status === 'Cancelled').length;

    const elAll = document.getElementById('tab-count-all');
    const elPending = document.getElementById('tab-count-pending');
    const elProc = document.getElementById('tab-count-processing');
    const elDeliv = document.getElementById('tab-count-delivered');
    const elCanc = document.getElementById('tab-count-cancelled');
    const badgeCount = document.getElementById('orders-count-badge');

    if (elAll) elAll.textContent = allCount;
    if (elPending) elPending.textContent = pendingCount;
    if (elProc) elProc.textContent = processingCount;
    if (elDeliv) elDeliv.textContent = deliveredCount;
    if (elCanc) elCanc.textContent = cancelledCount;
    if (badgeCount) badgeCount.textContent = `${allCount} orders`;

    // Highlight active tab
    document.querySelectorAll('.status-tab').forEach(tab => {
      const tabStatus = tab.getAttribute('data-status');
      if (tabStatus === state.statusFilter) {
        tab.classList.add('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'font-bold', 'border', 'border-slate-200', 'dark:border-slate-700');
      } else {
        tab.classList.remove('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'font-bold', 'border', 'border-slate-200', 'dark:border-slate-700');
      }
    });
  }

  function renderOrdersTable() {
    const allFiltered = getTableOrders();
    const tbody = document.getElementById('orders-table-body');
    const emptyState = document.getElementById('table-empty-state');
    if (!tbody) return;

    renderStatusPills(getFilteredOrdersByDate());

    if (allFiltered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      updatePaginationControls(0);
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Pagination slice
    const totalItems = allFiltered.length;
    const totalPages = Math.ceil(totalItems / state.pageSize) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    const startIdx = (state.currentPage - 1) * state.pageSize;
    const endIdx = Math.min(startIdx + state.pageSize, totalItems);
    const pageItems = allFiltered.slice(startIdx, endIdx);

    tbody.innerHTML = pageItems.map(order => {
      const statusBadge = getStatusBadgeHTML(order.status);
      return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
          <!-- Order ID & Priority -->
          <td class="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
            <div class="flex items-center space-x-1.5">
              <span>${order.id}</span>
              ${order.status === 'Pending' ? '<span class="inline-block w-2 h-2 rounded-full bg-amber-500 urgent-badge-pulse" title="Requires attention"></span>' : ''}
            </div>
          </td>

          <!-- Customer info -->
          <td class="py-3.5 px-4">
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                ${order.customer.avatar || order.customer.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div class="font-semibold text-slate-800 dark:text-slate-200">${escapeHTML(order.customer.name)}</div>
                <div class="text-[11px] text-slate-400 dark:text-slate-500">${escapeHTML(order.customer.email)}</div>
              </div>
            </div>
          </td>

          <!-- Items & Category -->
          <td class="py-3.5 px-4 max-w-xs">
            <div class="font-medium text-slate-800 dark:text-slate-200 truncate" title="${escapeHTML(order.items)}">
              ${escapeHTML(order.items)}
            </div>
            <span class="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              ${escapeHTML(order.category || 'General')}
            </span>
          </td>

          <!-- Date -->
          <td class="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
            ${formatDate(order.date)}
          </td>

          <!-- Amount -->
          <td class="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
            ${formatCurrency(order.amount)}
          </td>

          <!-- Status & Dropdown Quick Switcher -->
          <td class="py-3.5 px-4 whitespace-nowrap">
            <div class="flex items-center space-x-2">
              ${statusBadge}
              <select onchange="window.handleStatusChange('${order.id}', this.value)" class="text-[11px] py-1 px-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer">
                <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
                <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
          </td>

          <!-- Actions -->
          <td class="py-3.5 px-4 text-right whitespace-nowrap">
            <div class="flex items-center justify-end space-x-1">
              ${order.status === 'Pending' ? `
                <button onclick="window.handleQuickFulfill('${order.id}')" title="Quick Mark as Delivered" class="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors">
                  <i data-lucide="check-circle" class="w-4 h-4"></i>
                </button>
              ` : ''}
              <button onclick="window.handleDeleteOrder('${order.id}')" title="Delete Order" class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    updatePaginationControls(totalItems, startIdx + 1, endIdx);

    if (window.lucide) lucide.createIcons();
  }

  function getStatusBadgeHTML(status) {
    switch (status) {
      case 'Pending':
        return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          Pending
        </span>`;
      case 'Processing':
        return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-blue-500"></span>
          Processing
        </span>`;
      case 'Delivered':
        return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500"></span>
          Delivered
        </span>`;
      case 'Cancelled':
        return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-rose-500"></span>
          Cancelled
        </span>`;
      default:
        return `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">${status}</span>`;
    }
  }

  function updatePaginationControls(total, start = 0, end = 0) {
    const elStart = document.getElementById('pagination-start');
    const elEnd = document.getElementById('pagination-end');
    const elTotal = document.getElementById('pagination-total');
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    const pagesContainer = document.getElementById('pagination-pages');

    if (elStart) elStart.textContent = total > 0 ? start : 0;
    if (elEnd) elEnd.textContent = end;
    if (elTotal) elTotal.textContent = total;

    const totalPages = Math.ceil(total / state.pageSize) || 1;
    if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;

    if (pagesContainer) {
      pagesContainer.innerHTML = '';
      for (let p = 1; p <= totalPages; p++) {
        const btn = document.createElement('button');
        btn.textContent = p;
        btn.className = `w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
          p === state.currentPage
            ? 'bg-brand-600 text-white'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`;
        btn.addEventListener('click', () => {
          state.currentPage = p;
          renderOrdersTable();
        });
        pagesContainer.appendChild(btn);
      }
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- OVERALL DASHBOARD REFRESH ---
  function updateDashboard() {
    const filteredOrders = getFilteredOrdersByDate();
    const metrics = computeMetrics(filteredOrders);

    renderKPIs(metrics);
    updateCharts(filteredOrders);
    renderOrdersTable();
    initLastSync();
  }

  // --- ACTIONS & HANDLERS ---
  window.handleStatusChange = function (orderId, newStatus) {
    state.orders = window.OrderStore.updateOrderStatus(orderId, newStatus);
    showToast(`Order #${orderId} status changed to ${newStatus}. Metrics updated!`, 'info');
    updateDashboard();
  };

  window.handleQuickFulfill = function (orderId) {
    state.orders = window.OrderStore.updateOrderStatus(orderId, 'Delivered');
    showToast(`Order #${orderId} fulfilled and marked Delivered!`, 'success');
    updateDashboard();
  };

  window.handleDeleteOrder = function (orderId) {
    if (confirm(`Are you sure you want to delete order ${orderId}?`)) {
      state.orders = window.OrderStore.deleteOrder(orderId);
      showToast(`Order #${orderId} removed.`, 'warning');
      updateDashboard();
    }
  };

  function processOldestPending() {
    const pending = state.orders.filter(o => o.status === 'Pending').sort((a, b) => new Date(a.date) - new Date(b.date));
    if (pending.length > 0) {
      const oldest = pending[0];
      window.handleStatusChange(oldest.id, 'Processing');
      showToast(`Oldest pending order (${oldest.id}) moved to Processing!`, 'success');
    } else {
      showToast('No pending orders to process!', 'info');
    }
  }

  function exportCSV() {
    const list = getTableOrders();
    if (list.length === 0) {
      showToast('No orders to export in current view', 'warning');
      return;
    }

    const headers = ['Order ID', 'Customer Name', 'Customer Email', 'Items', 'Category', 'Date', 'Amount', 'Status', 'Payment Method'];
    const rows = list.map(o => [
      `"${o.id}"`,
      `"${o.customer.name.replace(/"/g, '""')}"`,
      `"${o.customer.email.replace(/"/g, '""')}"`,
      `"${o.items.replace(/"/g, '""')}"`,
      `"${o.category || ''}"`,
      `"${o.date}"`,
      o.amount,
      `"${o.status}"`,
      `"${o.paymentMethod || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${list.length} orders to CSV`, 'success');
  }

  // --- MODAL HANDLING ---
  function openAddOrderModal() {
    const modal = document.getElementById('add-order-modal');
    if (modal) {
      modal.classList.remove('modal-hidden');
      document.getElementById('form-customer-name')?.focus();
    }
  }

  function closeAddOrderModal() {
    const modal = document.getElementById('add-order-modal');
    if (modal) {
      modal.classList.add('modal-hidden');
      document.getElementById('add-order-form')?.reset();
    }
  }

  function handleAddOrderSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('form-customer-name').value.trim();
    const email = document.getElementById('form-customer-email').value.trim();
    const items = document.getElementById('form-items').value.trim();
    const category = document.getElementById('form-category').value;
    const payment = document.getElementById('form-payment').value;
    const amount = parseFloat(document.getElementById('form-amount').value);
    const status = document.getElementById('form-status').value;

    if (!name || !email || !items || isNaN(amount)) {
      showToast('Please fill out all required fields correctly', 'warning');
      return;
    }

    const initials = name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0].toUpperCase())
      .slice(0, 2)
      .join('');

    const newOrderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder = {
      id: newOrderId,
      customer: { name, email, avatar: initials || 'CU' },
      date: new Date().toISOString(),
      items,
      category,
      amount: Number(amount.toFixed(2)),
      status,
      priority: status === 'Pending' ? 'High' : 'Normal',
      paymentMethod: payment,
    };

    state.orders = window.OrderStore.addOrder(newOrder);
    closeAddOrderModal();

    if (status === 'Pending') {
      showToast(`New Pending Order #${newOrderId} recorded! Pending Alert Count triggered.`, 'warning');
    } else {
      showToast(`New Order #${newOrderId} added! Total Revenue & Orders updated.`, 'success');
    }

    updateDashboard();
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const iconName = type === 'success' ? 'check-circle' : type === 'warning' ? 'alert-circle' : 'info';
    const bgColors = {
      success: 'bg-emerald-600 text-white shadow-emerald-500/20',
      warning: 'bg-amber-600 text-white shadow-amber-500/20',
      info: 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-slate-900/20',
    };

    toast.className = `toast flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
      <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
      <span>${escapeHTML(message)}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

    // Date range filter
    document.getElementById('date-range-select')?.addEventListener('change', (e) => {
      state.dateRange = e.target.value;
      state.currentPage = 1;
      updateDashboard();
      showToast(`Date filter updated: ${e.target.options[e.target.selectedIndex].text}`);
    });

    // Chart metric views
    const btnBoth = document.getElementById('chart-view-both');
    const btnRev = document.getElementById('chart-view-rev');
    const btnOrders = document.getElementById('chart-view-orders');

    const setActiveChartBtn = (active) => {
      [btnBoth, btnRev, btnOrders].forEach(b => {
        if (!b) return;
        if (b === active) {
          b.className = 'px-2.5 py-1 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm transition-all font-semibold';
        } else {
          b.className = 'px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
        }
      });
    };

    btnBoth?.addEventListener('click', () => {
      state.chartView = 'both';
      setActiveChartBtn(btnBoth);
      renderRevenueOrdersChart(getFilteredOrdersByDate());
    });
    btnRev?.addEventListener('click', () => {
      state.chartView = 'rev';
      setActiveChartBtn(btnRev);
      renderRevenueOrdersChart(getFilteredOrdersByDate());
    });
    btnOrders?.addEventListener('click', () => {
      state.chartView = 'orders';
      setActiveChartBtn(btnOrders);
      renderRevenueOrdersChart(getFilteredOrdersByDate());
    });

    // Pending Orders Card Click -> Quick filter to Pending
    document.getElementById('card-pending-orders')?.addEventListener('click', () => {
      state.statusFilter = 'Pending';
      state.currentPage = 1;
      renderOrdersTable();
      showToast('Filtered table to show Pending Orders');
      document.getElementById('orders-table-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Pending Banner buttons
    document.getElementById('btn-banner-filter-pending')?.addEventListener('click', () => {
      state.statusFilter = 'Pending';
      state.currentPage = 1;
      renderOrdersTable();
      document.getElementById('orders-table-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('btn-banner-quick-process')?.addEventListener('click', processOldestPending);

    // Status Tab buttons
    document.querySelectorAll('.status-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.statusFilter = btn.getAttribute('data-status');
        state.currentPage = 1;
        renderOrdersTable();
      });
    });

    // Search input
    const searchInput = document.getElementById('order-search');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        state.currentPage = 1;
        if (clearSearchBtn) {
          if (state.searchQuery) clearSearchBtn.classList.remove('hidden');
          else clearSearchBtn.classList.add('hidden');
        }
        renderOrdersTable();
      });
    }
    clearSearchBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      state.searchQuery = '';
      clearSearchBtn.classList.add('hidden');
      state.currentPage = 1;
      renderOrdersTable();
    });

    // Table sorting
    document.getElementById('th-sort-date')?.addEventListener('click', () => {
      if (state.sortField === 'date') state.sortAsc = !state.sortAsc;
      else {
        state.sortField = 'date';
        state.sortAsc = false;
      }
      renderOrdersTable();
    });
    document.getElementById('th-sort-amount')?.addEventListener('click', () => {
      if (state.sortField === 'amount') state.sortAsc = !state.sortAsc;
      else {
        state.sortField = 'amount';
        state.sortAsc = false;
      }
      renderOrdersTable();
    });

    // Pagination buttons
    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderOrdersTable();
      }
    });
    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      const allFiltered = getTableOrders();
      const totalPages = Math.ceil(allFiltered.length / state.pageSize);
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderOrdersTable();
      }
    });

    // Export CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);

    // Reset Demo Data
    document.getElementById('btn-reset-demo')?.addEventListener('click', () => {
      if (confirm('Reset orders back to default demonstration dataset?')) {
        state.orders = window.OrderStore.resetToDemo();
        state.statusFilter = 'all';
        state.searchQuery = '';
        state.currentPage = 1;
        if (searchInput) searchInput.value = '';
        showToast('Demo data restored successfully!', 'info');
        updateDashboard();
      }
    });

    // Modal controls
    document.getElementById('btn-open-add-order')?.addEventListener('click', openAddOrderModal);
    document.getElementById('btn-close-modal')?.addEventListener('click', closeAddOrderModal);
    document.getElementById('btn-cancel-modal')?.addEventListener('click', closeAddOrderModal);
    document.getElementById('add-order-form')?.addEventListener('submit', handleAddOrderSubmit);

    // Close modal on escape or clicking outside
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAddOrderModal();
    });
    document.getElementById('add-order-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'add-order-modal') closeAddOrderModal();
    });
  }

  // Global trigger for manual Google Sheet sync
  window.syncGoogleSheets = async function () {
    const syncBtnIcon = document.querySelector('#btn-sync-sheet i');
    if (syncBtnIcon) syncBtnIcon.classList.add('animate-spin');
    showToast('Fetching latest records from Google Sheets...');

    try {
      const orders = await window.OrderStore.syncWithBackend();
      state.orders = orders;
      updateDashboard();
      initLastSync();
      showToast(`Synchronized ${orders.length} orders from Google Sheets!`, 'success');
      const sheetBadge = document.getElementById('sheet-sync-status');
      if (sheetBadge) {
        sheetBadge.classList.remove('hidden');
        sheetBadge.textContent = 'Google Sheet Live (' + orders.length + ' orders)';
      }
    } catch (err) {
      showToast('Sync error: ' + err.message, 'warning');
    } finally {
      if (syncBtnIcon) {
        setTimeout(() => syncBtnIcon.classList.remove('animate-spin'), 600);
      }
    }
  };

  // Kickstart when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
